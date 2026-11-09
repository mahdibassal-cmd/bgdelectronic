-- DRAFT — não aplicar em produção até revisão.
-- Caixa Geral → Adicionar crédito (Entrada) pode entrar num caixa e virar crédito.
-- Não quita dívida. Não substitui lancar_credito, registrar_recebimento_credito,
-- criar_nota, criar_nota_local, pagar_conta, cancelar_nota nem cancelar_nota_financas.
-- estornar_credito ganha só o estorno do caixa ligado (mov_id). O resto fica como está em produção (2026-11-09).
-- tg_mov_insert força caixa_movimentos.data = hoje (São Paulo). Data diferente é recusada.
-- Caixa Especial fica de fora: o ledger dela não é caixa_movimentos.

alter table public.cliente_creditos add column if not exists mov_id bigint;
do $fk$ begin
  if not exists (
    select 1 from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.conrelid = 'public.cliente_creditos'::regclass and c.contype = 'f' and a.attname = 'mov_id'
  ) then
    alter table public.cliente_creditos
      add constraint cliente_creditos_mov_fk foreign key (mov_id) references public.caixa_movimentos(id);
  end if;
end $fk$;
create index if not exists cliente_creditos_mov_idx on public.cliente_creditos(mov_id);

create or replace function public.lancar_credito_caixa(p_cliente bigint, p_valor numeric, p_caixa smallint,
  p_forma text default null, p_obs text default null, p_data date default null)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare v_nome text; v_cx smallint; v_met text; v_forma text; v_mov bigint; v_id bigint; v_hoje date;
begin
  if not public.can('financas') then raise exception 'Sem permissão (financeiro/admin)' using errcode = '42501'; end if;
  if coalesce(p_valor, 0) <= 0 then raise exception 'Valor inválido' using errcode = 'P0001'; end if;
  v_hoje := (now() at time zone 'America/Sao_Paulo')::date;
  if p_data is not null and p_data is distinct from v_hoje then
    raise exception 'O caixa grava só a data de hoje' using errcode = 'P0001'; end if;
  select nome into v_nome from public.clientes where id = p_cliente for update;
  if v_nome is null then raise exception 'Cliente não encontrado' using errcode = 'P0001'; end if;
  select id, metodo::text into v_cx, v_met from public.caixas where id = p_caixa and ativo;
  if v_cx is null then raise exception 'Caixa inválido' using errcode = 'P0001'; end if;
  v_forma := coalesce(nullif(trim(p_forma), ''), nullif(v_met, ''));
  if v_forma is null or v_forma not in ('dinheiro','pix','cartao','transferencia') then
    raise exception 'Forma de pagamento inválida' using errcode = 'P0001'; end if;
  insert into public.caixa_movimentos(caixa_id, tipo, valor, motivo, user_id, forma)
  values (p_caixa, 'entrada', round(p_valor, 2), left('Crédito Caixa Geral ' || v_nome, 300), auth.uid(), v_forma)
  returning id into v_mov;
  insert into public.cliente_creditos(cliente_id, tipo, valor, obs, mov_id)
  values (p_cliente, 'entrada', round(p_valor, 2), nullif(left(trim(coalesce(p_obs,'')), 300), ''), v_mov)
  returning id into v_id;
  perform public.fin_log('credito_entrada', jsonb_build_object('cliente_id', p_cliente, 'valor', round(p_valor, 2),
    'caixa_id', p_caixa, 'mov_id', v_mov, 'forma', v_forma, 'credito_id', v_id, 'via', 'credito_caixa'));
  return jsonb_build_object('credito_id', v_id, 'mov_id', v_mov, 'caixa_id', p_caixa, 'forma', v_forma, 'valor', round(p_valor, 2));
end $fn$;

-- Mesma função que está no ar, mais o estorno do caixa quando o crédito tem mov_id.
create or replace function public.estornar_credito(p_id bigint, p_motivo text)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare kr record; v_mot text := left(trim(coalesce(p_motivo, '')), 200); v_saldo numeric; v_new bigint; v_inv text; v_est bigint;
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
  if kr.mov_id is not null and not exists (select 1 from public.caixa_movimentos e where e.estorno_de = kr.mov_id) then
    insert into public.caixa_movimentos(caixa_id, tipo, valor, motivo, forma, estorno_de)
    select m.caixa_id, 'estorno', m.valor, left('Estorno crédito Caixa Geral: ' || v_mot, 300), m.forma, m.id
    from public.caixa_movimentos m where m.id = kr.mov_id
    returning id into v_est;
  end if;
  insert into public.security_events(kind, actor, detail) values ('estorno_credito', auth.uid(),
    jsonb_build_object('credito_id', kr.id, 'estorno_id', v_new, 'cliente_id', kr.cliente_id, 'tipo', kr.tipo, 'valor', kr.valor, 'motivo', v_mot, 'mov_id', kr.mov_id, 'caixa_estorno', v_est));
  perform public.fin_log('fin_alteracao', jsonb_build_object('acao', 'estorno_credito', 'credito_id', kr.id, 'valor', kr.valor, 'mov_id', kr.mov_id, 'caixa_estorno', v_est));
  return jsonb_build_object('estorno_id', v_new, 'tipo', v_inv, 'valor', kr.valor, 'caixa_estorno', v_est);
end $fn$;

create or replace view public.v_cliente_creditos_mov with (security_invoker = true) as
select k.id, k.cliente_id, c.nome as cliente, k.tipo, k.valor, k.obs, k.nota_id,
       n.status as nota_status, pr.handle, k.created_at, k.estorno_de, k.recebimento_id,
       (exists (select 1 from public.cliente_creditos e where e.estorno_de = k.id)) as estornado,
       cx.nome as caixa
from public.cliente_creditos k
join public.clientes c on c.id = k.cliente_id
left join public.notas n on n.id = k.nota_id
left join public.profiles pr on pr.id = k.created_by
left join public.caixa_movimentos m on m.id = k.mov_id
left join public.caixas cx on cx.id = m.caixa_id
where public.can('financas');

revoke all on function public.lancar_credito_caixa(bigint, numeric, smallint, text, text, date) from public, anon;
grant execute on function public.lancar_credito_caixa(bigint, numeric, smallint, text, text, date) to authenticated;
revoke all on function public.estornar_credito(bigint, text) from public, anon;
grant execute on function public.estornar_credito(bigint, text) to authenticated;

notify pgrst, 'reload schema';
select 'credito caixa draft' as status;
