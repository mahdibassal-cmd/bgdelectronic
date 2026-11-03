-- =====================================================================
-- migration-caixa-estornar-mov.sql — Loja (bagda-loja). Idempotente (pode rodar mais de uma vez).
-- Rodar DEPOIS de migration-estornos.sql, migration-cancelar-nota-financas.sql e migration-compras-imei.sql.
--
-- estornar_movimento_caixa(mov, motivo, cancelar_nota default false) — SOMENTE ADMIN (2FA se tiver).
--   Nada é apagado: grava um movimento INVERSO no mesmo caixa e mesma forma, ligado ao original (estorno_de).
--   * Entrada manual  -> Saída igual.   * Saída manual -> Entrada igual.
--   * Entrada de recebimento (Contas a receber) -> usa estornar_recebimento (dívida do cliente reabre).
--   * Saída de pagamento de conta (Contas a pagar) -> RECUSA (estornar lá).
--   * Venda de nota:
--       padrão (cancelar_nota = false): estorna SÓ o dinheiro que a nota tem neste caixa e a nota volta
--         para "Notas a lançar" (venda, estoque e crédito Caixa Geral não mudam).
--       cancelar_nota = true: cancela a nota (cancelar_nota_financas): estorna o caixa, devolve o estoque,
--         Paga Depois sai da dívida e uso de crédito Caixa Geral volta.
--   Log: security_events kind 'caixa_mov_estornado'. Clicar duas vezes não duplica.
-- =====================================================================

-- ---------- Log: 27 tipos existentes + 1 novo ----------
do $$ begin
  if to_regclass('public.security_events') is not null then
    alter table public.security_events drop constraint if exists security_events_kind_check;
    alter table public.security_events add constraint security_events_kind_check check (kind in (
      'failed_login','role_change','admin_added','profile_added','profile_removed','lock','unlock','signout_all',
      'fin_pagamento','fin_recebimento','fin_alteracao',
      'credito_entrada','credito_uso','credito_excedente','nota_lancada',
      'estorno_recebimento','estorno_credito',
      'dep_esp_entrada','dep_esp_ajuste','dep_esp_transferencia',
      'nota_prazo_lancada','nota_dispensada','nota_dispensa_desfeita',
      'nota_cancelada_financas','nota_pag_corrigido',
      'compra_imei_registrado','compra_imei_removido',
      'caixa_mov_estornado')) not valid;
  end if;
end $$;

-- ---------- Vínculo: 1 estorno por movimento ----------
alter table public.caixa_movimentos add column if not exists estorno_de bigint references public.caixa_movimentos(id);
create unique index if not exists mov_estorno_de_uq on public.caixa_movimentos(estorno_de) where estorno_de is not null;

-- Extrato com vínculo de estorno (colunas novas no FIM da view).
create or replace view public.v_caixa_extrato with (security_invoker = true) as
select m.id, m.data, m.created_at, m.caixa_id, c.nome as caixa, m.tipo, m.valor,
       case when m.tipo in ('venda','entrada') then m.valor else -m.valor end as valor_assinado,
       m.motivo, m.nota_id, pr.handle, pr.nome,
       m.estorno_de,
       exists (select 1 from public.caixa_movimentos e where e.estorno_de = m.id) as estornado,
       m.forma
from public.caixa_movimentos m join public.caixas c on c.id = m.caixa_id left join public.profiles pr on pr.id = m.user_id;
revoke all on public.v_caixa_extrato from anon, public;
grant select on public.v_caixa_extrato to authenticated;

create or replace function public.estornar_movimento_caixa(p_mov bigint, p_motivo text, p_cancelar_nota boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare m record; v_mot text := left(trim(coalesce(p_motivo, '')), 200); v_new bigint; v_rec bigint; v_liq numeric; v_r jsonb;
        v_acao text; v_nn text; v_outros numeric;
begin
  if not public.can('admin') then raise exception 'Somente admin pode estornar movimento de caixa' using errcode = '42501'; end if;
  if length(v_mot) < 3 then raise exception 'Informe o motivo do estorno' using errcode = 'P0001'; end if;
  select * into m from public.caixa_movimentos where id = p_mov for update;
  if m.id is null then raise exception 'Movimento não encontrado' using errcode = 'P0001'; end if;
  select e.id into v_new from public.caixa_movimentos e where e.estorno_de = m.id;
  if v_new is not null then return jsonb_build_object('ja_estornado', true, 'mov_id', m.id, 'estorno_id', v_new); end if;
  if m.estorno_de is not null or m.tipo = 'estorno' then raise exception 'Este movimento já é um estorno' using errcode = 'P0001'; end if;
  if exists (select 1 from public.conta_pagamentos p where p.mov_id = m.id) then
    raise exception 'Pagamento de conta: estorne em Contas a pagar' using errcode = 'P0001'; end if;

  select r.id into v_rec from public.cliente_recebimentos r where r.mov_id = m.id;
  if v_rec is not null then
    -- recebimento de cliente: mesmo fluxo do botão Estornar em Contas a receber
    v_r := public.estornar_recebimento(v_rec, v_mot);
    v_new := nullif(v_r->>'mov_saida', '')::bigint;
    if v_new is not null then update public.caixa_movimentos set estorno_de = m.id where id = v_new; end if;
    v_acao := 'recebimento';
  elsif m.tipo = 'venda' then
    v_nn := lpad(m.nota_id::text, 6, '0');
    if p_cancelar_nota then
      if to_regprocedure('public.cancelar_nota_financas(bigint,text)') is null then
        raise exception 'Rode migration-cancelar-nota-financas.sql antes' using errcode = 'P0001'; end if;
      v_r := public.cancelar_nota_financas(m.nota_id, v_mot);
      select max(e.id) into v_new from public.caixa_movimentos e
       where e.nota_id = m.nota_id and e.caixa_id = m.caixa_id and e.tipo = 'estorno' and e.estorno_de is null and e.created_at = now();
      if v_new is not null then update public.caixa_movimentos set estorno_de = m.id where id = v_new; end if;
      v_acao := 'nota_cancelada';
    else
      perform 1 from public.notas where id = m.nota_id for update;
      select coalesce(sum(case when tipo = 'venda' then valor when tipo = 'estorno' then -valor else 0 end), 0) into v_liq
        from public.caixa_movimentos where nota_id = m.nota_id and caixa_id = m.caixa_id;
      if v_liq <= 0 then raise exception 'Nota % não tem mais valor neste caixa (já estornada/transferida)', v_nn using errcode = 'P0001'; end if;
      insert into public.caixa_movimentos(caixa_id, tipo, valor, motivo, nota_id, user_id, forma, estorno_de)
      values (m.caixa_id, 'estorno', v_liq, left('Estorno caixa nota ' || v_nn || ' (volta p/ lançar): ' || v_mot, 300), m.nota_id, auth.uid(), m.forma, m.id)
      returning id into v_new;
      select coalesce(sum(case when tipo = 'venda' then valor when tipo = 'estorno' then -valor else 0 end), 0) into v_outros
        from public.caixa_movimentos where nota_id = m.nota_id;
      if v_outros <= 0 then
        update public.notas set caixa_lancada_id = null, lancada_em = null, lancada_por = null where id = m.nota_id; end if;
      v_acao := 'nota_volta_a_lancar';
    end if;
  elsif m.tipo in ('entrada','saida') then
    insert into public.caixa_movimentos(caixa_id, tipo, valor, motivo, user_id, forma, estorno_de)
    values (m.caixa_id, case when m.tipo = 'entrada' then 'saida' else 'entrada' end::public.mov_tipo, m.valor,
            left('Estorno mov #' || m.id || ' (' || coalesce(m.motivo, '') || '): ' || v_mot, 300), auth.uid(), m.forma, m.id)
    returning id into v_new;
    v_acao := 'manual';
  else
    raise exception 'Tipo de movimento não pode ser estornado' using errcode = 'P0001';
  end if;

  insert into public.security_events(kind, actor, detail) values ('caixa_mov_estornado', auth.uid(),
    jsonb_build_object('mov_id', m.id, 'estorno_id', v_new, 'acao', v_acao, 'caixa', m.caixa_id, 'tipo', m.tipo, 'valor', m.valor,
                       'forma', m.forma, 'nota_id', m.nota_id, 'recebimento_id', v_rec, 'mov_motivo', m.motivo,
                       'mov_data', m.data, 'mov_user', m.user_id, 'cancelar_nota', p_cancelar_nota, 'motivo', v_mot));
  return jsonb_build_object('mov_id', m.id, 'estorno_id', v_new, 'acao', v_acao, 'valor', m.valor, 'nota_id', m.nota_id);
end $$;
revoke all on function public.estornar_movimento_caixa(bigint, text, boolean) from public, anon;
grant execute on function public.estornar_movimento_caixa(bigint, text, boolean) to authenticated;

notify pgrst, 'reload schema';
select 'estornar_movimento_caixa ok' as status;
