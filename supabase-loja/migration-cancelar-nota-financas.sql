-- =====================================================================
-- migration-cancelar-nota-financas.sql — Loja (bagda-loja). Idempotente.
-- Rodar DEPOIS de migration-paga-depois-caixa-geral.sql (usa notas.prazo_lancada_em). Não depende de migration-notas-dispensar.sql
-- (se ela rodar, dispensa é limpa no cancelamento/correção só se a coluna existir).
-- 1) cancelar_nota_financas(nota, motivo): financas/admin. Anula a venda, devolve o estoque, estorna no MESMO caixa e MESMA forma
--    o saldo líquido que a nota tem em cada caixa (se já lançada) e limpa o lançamento. Paga Depois sai da dívida sozinho
--    (cliente_saldo_calc só soma notas 'ativa'); uso de crédito Caixa Geral volta sozinho (_credito_saldo ignora nota cancelada).
--    RECUSA se a nota já tem recebimento alocado (recebimento_notas): estorne o recebimento antes (botão Estornar em Contas a receber).
--    cancelar_nota (só admin) continua igual.
-- 2) corrigir_pagamento_nota(nota, formas jsonb, cliente, motivo): financas/admin. Troca as formas de pagamento de uma nota
--    AINDA NÃO lançada em caixa, sem recebimentos e sem crédito Caixa Geral. Paga Depois exige cliente cadastrado.
-- =====================================================================

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
      'nota_cancelada_financas','nota_pag_corrigido'));
  end if;
end $$;

create or replace function public.cancelar_nota_financas(p_nota bigint, p_motivo text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare n record; r record; v_nn text := lpad(p_nota::text, 6, '0'); v_est numeric := 0; v_rec numeric;
begin
  if not public.can('financas') then raise exception 'Sem permissão (financeiro/admin)' using errcode = '42501'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Informe o motivo' using errcode = 'P0001'; end if;
  select * into n from public.notas where id = p_nota for update;
  if not found then raise exception 'Nota não encontrada' using errcode = 'P0001'; end if;
  if n.status = 'cancelada' then raise exception 'Nota já cancelada' using errcode = 'P0001'; end if;
  select coalesce(sum(valor), 0) into v_rec from public.recebimento_notas where nota_id = p_nota;
  if v_rec > 0 then
    raise exception 'Nota % tem recebimento de R$ % em Contas a receber — estorne o recebimento antes de cancelar', v_nn,
      replace(to_char(v_rec, 'FM999999990.00'), '.', ',') using errcode = 'P0001'; end if;
  update public.products p set estoque = p.estoque + s.qtd, updated_at = now()
    from (select sku, sum(qtd) qtd from public.sales where nota_id = p_nota group by sku) s where p.sku = s.sku;
  for r in select caixa_id, forma, sum(case when tipo = 'venda' then valor when tipo = 'estorno' then -valor else 0 end) liq
             from public.caixa_movimentos where nota_id = p_nota group by caixa_id, forma loop
    if r.liq > 0 then
      insert into public.caixa_movimentos(caixa_id, tipo, valor, motivo, nota_id, user_id, forma)
      values (r.caixa_id, 'estorno', r.liq, left('Cancelamento nota ' || v_nn || ': ' || trim(p_motivo), 300), p_nota, auth.uid(), r.forma);
      v_est := v_est + r.liq;
    end if;
  end loop;
  update public.notas set status = 'cancelada', cancelada_em = now(), cancelada_por = auth.uid(), motivo_cancel = left(trim(p_motivo), 300),
         caixa_lancada_id = null, lancada_em = null, lancada_por = null, prazo_lancada_em = null, prazo_lancada_por = null
   where id = p_nota;
  perform public.fin_log('nota_cancelada_financas', jsonb_build_object('nota_id', p_nota, 'motivo', trim(p_motivo), 'total', n.total,
    'estornado_caixa', v_est, 'caixa_antes', n.caixa_lancada_id, 'cliente_id', n.cliente_id));
  return jsonb_build_object('nota_id', p_nota, 'estornado_caixa', v_est, 'cancelada', true);
end $$;
revoke all on function public.cancelar_nota_financas(bigint, text) from public, anon;
grant execute on function public.cancelar_nota_financas(bigint, text) to authenticated;

create or replace function public.corrigir_pagamento_nota(p_nota bigint, p_pagamentos jsonb, p_cliente_id bigint, p_motivo text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare n record; g jsonb; v_soma numeric := 0; v_prazo boolean := false; v_agora boolean := false; v_nome text; v_antes jsonb; v_cli bigint;
begin
  if not public.can('financas') then raise exception 'Sem permissão (financeiro/admin)' using errcode = '42501'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Informe o motivo' using errcode = 'P0001'; end if;
  select * into n from public.notas where id = p_nota for update;
  if not found then raise exception 'Nota não encontrada' using errcode = 'P0001'; end if;
  if n.status <> 'ativa' then raise exception 'Nota cancelada' using errcode = 'P0001'; end if;
  if n.caixa_lancada_id is not null or exists (select 1 from public.caixa_movimentos where nota_id = p_nota) then
    raise exception 'Nota já lançada em caixa — não dá para corrigir; cancele e refaça' using errcode = 'P0001'; end if;
  if exists (select 1 from public.recebimento_notas where nota_id = p_nota) then
    raise exception 'Nota tem recebimento em Contas a receber — estorne antes' using errcode = 'P0001'; end if;
  if exists (select 1 from public.nota_pagamentos where nota_id = p_nota and metodo::text = 'credito')
     or exists (select 1 from public.cliente_creditos where nota_id = p_nota) then
    raise exception 'Nota paga com crédito da Caixa Geral — cancele e refaça' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_pagamentos) is distinct from 'array' or jsonb_array_length(p_pagamentos) = 0 or jsonb_array_length(p_pagamentos) > 5 then
    raise exception 'Informe a forma de pagamento' using errcode = 'P0001'; end if;
  for g in select * from jsonb_array_elements(p_pagamentos) loop
    if coalesce(g->>'metodo', '') not in ('dinheiro','pix','cartao','prazo') then raise exception 'Forma inválida: %', g->>'metodo' using errcode = 'P0001'; end if;
    if coalesce(nullif(g->>'valor', '')::numeric, 0) <= 0 then raise exception 'Valor de pagamento inválido' using errcode = 'P0001'; end if;
    v_soma := v_soma + round((g->>'valor')::numeric, 2);
    if g->>'metodo' = 'prazo' then v_prazo := true; else v_agora := true; end if;
  end loop;
  if round(v_soma, 2) <> round(n.total, 2) then
    raise exception 'Pagamentos (%) diferentes do total da nota (%)', round(v_soma, 2), round(n.total, 2) using errcode = 'P0001'; end if;
  v_cli := coalesce(p_cliente_id, n.cliente_id);
  if v_cli is not null then
    select nome into v_nome from public.clientes where id = v_cli and ativo;
    if v_nome is null then raise exception 'Cliente não encontrado' using errcode = 'P0001'; end if;
  end if;
  if v_prazo and v_cli is null then raise exception 'Paga Depois exige cliente cadastrado' using errcode = 'P0001'; end if;
  select jsonb_agg(jsonb_build_object('metodo', metodo::text, 'valor', valor) order by id) into v_antes from public.nota_pagamentos where nota_id = p_nota;
  delete from public.nota_pagamentos where nota_id = p_nota;
  for g in select * from jsonb_array_elements(p_pagamentos) loop
    insert into public.nota_pagamentos(nota_id, metodo, valor) values (p_nota, (g->>'metodo')::public.pay_method, round((g->>'valor')::numeric, 2));
  end loop;
  update public.notas set cliente_id = v_cli, cliente = coalesce(v_nome, cliente),
         local_pagamento = case when v_agora then local_pagamento end, prazo_lancada_em = null, prazo_lancada_por = null
   where id = p_nota;
  perform public.fin_log('nota_pag_corrigido', jsonb_build_object('nota_id', p_nota, 'motivo', trim(p_motivo), 'antes', v_antes,
    'depois', p_pagamentos, 'cliente_antes', n.cliente_id, 'cliente_depois', v_cli));
  return jsonb_build_object('nota_id', p_nota, 'cliente_id', v_cli, 'divida_cliente', case when v_cli is not null then public.cliente_saldo_calc(v_cli) end);
end $$;
revoke all on function public.corrigir_pagamento_nota(bigint, jsonb, bigint, text) from public, anon;
grant execute on function public.corrigir_pagamento_nota(bigint, jsonb, bigint, text) to authenticated;

select 'cancelar_nota_financas + corrigir_pagamento_nota ok' as status;
