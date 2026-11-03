-- BAGDA STORES (bagda-loja) — Estornos no app (admin). Idempotente.
-- Rodar DEPOIS de migration-caixa-geral.sql, fix-security-events-kinds.sql e migration-receber-credito.sql.
--   estornar_recebimento(rec_id, motivo): saída igual no mesmo caixa (se teve caixa) OU, se forma 'credito',
--     devolve o crédito (entrada que estorna o 'uso'); apaga o recebimento => dívida das notas reabre.
--   estornar_credito(id, motivo): lançamento inverso na Caixa Geral; bloqueia se o saldo ficaria negativo.
-- Tudo atômico; rodar de novo / clicar duas vezes não duplica.

-- ---------- Log: 15 tipos existentes + 2 novos ----------
do $$ begin
  if to_regclass('public.security_events') is not null then
    alter table public.security_events drop constraint if exists security_events_kind_check;
    alter table public.security_events add constraint security_events_kind_check check (kind in (
      'failed_login','role_change','admin_added','profile_added','profile_removed','lock','unlock','signout_all',
      'fin_pagamento','fin_recebimento','fin_alteracao',
      'credito_entrada','credito_uso','credito_excedente','nota_lancada',
      'estorno_recebimento','estorno_credito'));
  end if;
end $$;

-- ---------- Vínculo do estorno (1 estorno por lançamento) ----------
alter table public.cliente_creditos add column if not exists estorno_de bigint references public.cliente_creditos(id);
alter table public.cliente_creditos add column if not exists recebimento_id bigint;
create unique index if not exists cli_cred_estorno_de_uq on public.cliente_creditos(estorno_de) where estorno_de is not null;
-- backfill: 'uso' gravado por registrar_recebimento_com_credito tem "(receb. #N)" na obs
update public.cliente_creditos set recebimento_id = (regexp_match(obs, '\(receb\. #(\d+)\)'))[1]::bigint
 where recebimento_id is null and tipo = 'uso' and obs ~ '\(receb\. #\d+\)';

-- grava o recebimento_id nos próximos pagamentos com crédito
create or replace function public.tg_cred_rec_link() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.recebimento_id is null and new.tipo = 'uso' and new.obs ~ '\(receb\. #\d+\)' then
    new.recebimento_id := (regexp_match(new.obs, '\(receb\. #(\d+)\)'))[1]::bigint; end if;
  return new;
end $$;
revoke all on function public.tg_cred_rec_link() from public, anon, authenticated;
drop trigger if exists cred_rec_link on public.cliente_creditos;
create trigger cred_rec_link before insert on public.cliente_creditos for each row execute function public.tg_cred_rec_link();

-- histórico com status de estorno (colunas novas no fim)
create or replace view public.v_cliente_creditos_mov with (security_invoker = true) as
select k.id, k.cliente_id, c.nome as cliente, k.tipo, k.valor, k.obs, k.nota_id, n.status as nota_status, pr.handle, k.created_at,
       k.estorno_de, k.recebimento_id, exists (select 1 from public.cliente_creditos e where e.estorno_de = k.id) as estornado
from public.cliente_creditos k join public.clientes c on c.id = k.cliente_id
left join public.notas n on n.id = k.nota_id
left join public.profiles pr on pr.id = k.created_by
where public.can('financas');
revoke all on public.v_cliente_creditos_mov from anon, public;
grant select on public.v_cliente_creditos_mov to authenticated;

-- ---------- Estornar recebimento (Contas a receber) ----------
create or replace function public.estornar_recebimento(p_rec bigint, p_motivo text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare rc record; v_mot text := left(trim(coalesce(p_motivo, '')), 200); v_saida bigint; v_uso record; v_dev bigint; v_cli text; v_notas text;
begin
  if not public.can('admin') then raise exception 'Somente admin pode estornar' using errcode = '42501'; end if;
  if length(v_mot) < 3 then raise exception 'Informe o motivo do estorno' using errcode = 'P0001'; end if;
  select * into rc from public.cliente_recebimentos where id = p_rec for update;
  if rc.id is null then
    if exists (select 1 from public.security_events se where se.kind = 'estorno_recebimento' and (se.detail->>'recebimento_id')::bigint = p_rec) then
      return jsonb_build_object('ja_estornado', true, 'recebimento_id', p_rec); end if;
    raise exception 'Recebimento não encontrado' using errcode = 'P0001'; end if;
  select nome into v_cli from public.clientes where id = rc.cliente_id for update;
  select string_agg(lpad(rn.nota_id::text, 6, '0'), ', ' order by rn.nota_id) into v_notas
    from public.recebimento_notas rn where rn.recebimento_id = rc.id;
  if rc.forma = 'credito' then
    select * into v_uso from public.cliente_creditos kk
     where kk.recebimento_id = rc.id and kk.tipo = 'uso' and kk.cliente_id = rc.cliente_id order by kk.id limit 1;
    if v_uso.id is not null and not exists (select 1 from public.cliente_creditos e where e.estorno_de = v_uso.id) then
      insert into public.cliente_creditos(cliente_id, tipo, valor, obs, estorno_de)
      values (rc.cliente_id, 'entrada', v_uso.valor, left('Estorno recebimento #' || rc.id || coalesce(' nota ' || v_notas, '') || ': ' || v_mot, 300), v_uso.id)
      returning id into v_dev;
    elsif v_uso.id is null then
      insert into public.cliente_creditos(cliente_id, tipo, valor, obs)
      values (rc.cliente_id, 'entrada', rc.valor, left('Estorno recebimento #' || rc.id || coalesce(' nota ' || v_notas, '') || ': ' || v_mot, 300))
      returning id into v_dev;
    end if;
  elsif rc.caixa_id is not null then
    insert into public.caixa_movimentos(caixa_id, tipo, valor, motivo, user_id, forma)
    values (rc.caixa_id, 'saida', rc.valor, left('Estorno recebimento #' || rc.id || ' ' || coalesce(v_cli, '') || coalesce(' nota ' || v_notas, '') || ': ' || v_mot, 300),
            auth.uid(), rc.forma) returning id into v_saida;
  end if;
  delete from public.cliente_recebimentos where id = rc.id;   -- recebimento_notas sai por cascade
  insert into public.security_events(kind, actor, detail) values ('estorno_recebimento', auth.uid(),
    jsonb_build_object('recebimento_id', rc.id, 'cliente_id', rc.cliente_id, 'valor', rc.valor, 'forma', rc.forma, 'caixa', rc.caixa_id,
                       'mov_entrada', rc.mov_id, 'mov_saida', v_saida, 'credito_devolvido_id', v_dev, 'notas', v_notas, 'motivo', v_mot));
  perform public.fin_log('fin_alteracao', jsonb_build_object('acao', 'estorno_recebimento', 'recebimento_id', rc.id, 'valor', rc.valor));
  return jsonb_build_object('recebimento_id', rc.id, 'valor', rc.valor, 'mov_saida', v_saida, 'credito_devolvido_id', v_dev, 'notas', v_notas);
end $$;
revoke all on function public.estornar_recebimento(bigint, text) from public, anon;
grant execute on function public.estornar_recebimento(bigint, text) to authenticated;

-- ---------- Estornar lançamento da Caixa Geral ----------
create or replace function public.estornar_credito(p_id bigint, p_motivo text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare kr record; v_mot text := left(trim(coalesce(p_motivo, '')), 200); v_saldo numeric; v_new bigint; v_inv text;
begin
  if not public.can('admin') then raise exception 'Somente admin pode estornar' using errcode = '42501'; end if;
  if length(v_mot) < 3 then raise exception 'Informe o motivo do estorno' using errcode = 'P0001'; end if;
  select * into kr from public.cliente_creditos where id = p_id;
  if kr.id is null then raise exception 'Lançamento não encontrado' using errcode = 'P0001'; end if;
  perform 1 from public.clientes where id = kr.cliente_id for update;
  select e.id into v_new from public.cliente_creditos e where e.estorno_de = kr.id;
  if v_new is not null then return jsonb_build_object('ja_estornado', true, 'estorno_id', v_new); end if;
  if kr.estorno_de is not null then raise exception 'Este lançamento já é um estorno' using errcode = 'P0001'; end if;
  if kr.nota_id is not null then raise exception 'Uso ligado à nota %: cancele a nota (o crédito volta sozinho)', lpad(kr.nota_id::text, 6, '0') using errcode = 'P0001'; end if;
  if kr.recebimento_id is not null and exists (select 1 from public.cliente_recebimentos x where x.id = kr.recebimento_id) then
    raise exception 'Uso ligado ao recebimento #%: estorne em Contas a receber', kr.recebimento_id using errcode = 'P0001'; end if;
  v_inv := case when kr.tipo = 'entrada' then 'uso' else 'entrada' end;
  if kr.tipo = 'entrada' then
    v_saldo := round(public._credito_saldo(kr.cliente_id), 2);
    if round(kr.valor, 2) > v_saldo then
      raise exception 'Saldo de crédito ficaria negativo (saldo R$ %)', replace(to_char(v_saldo, 'FM999999990.00'), '.', ',') using errcode = 'P0001'; end if;
  end if;
  insert into public.cliente_creditos(cliente_id, tipo, valor, obs, estorno_de)
  values (kr.cliente_id, v_inv, kr.valor, left('Estorno lançamento #' || kr.id || ': ' || v_mot, 300), kr.id) returning id into v_new;
  insert into public.security_events(kind, actor, detail) values ('estorno_credito', auth.uid(),
    jsonb_build_object('credito_id', kr.id, 'estorno_id', v_new, 'cliente_id', kr.cliente_id, 'tipo', kr.tipo, 'valor', kr.valor, 'motivo', v_mot));
  perform public.fin_log('fin_alteracao', jsonb_build_object('acao', 'estorno_credito', 'credito_id', kr.id, 'valor', kr.valor));
  return jsonb_build_object('estorno_id', v_new, 'tipo', v_inv, 'valor', kr.valor);
end $$;
revoke all on function public.estornar_credito(bigint, text) from public, anon;
grant execute on function public.estornar_credito(bigint, text) to authenticated;
