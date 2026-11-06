-- =====================================================================
-- migration-cliente-extrato.sql — Loja /main. NÃO executar em produção
-- sem autorização direta do MB.
--
-- A leitura privilegiada fica em private.cliente_extrato_ler (security
-- definer, search_path ''). O schema private não entra na API.
-- public.cliente_extrato é security invoker: confere financas e só então
-- delega. A função privada repete a trava antes de qualquer leitura.
-- Não substitui criar_nota nem criar_nota_local. Não grava nada.
-- Pré-requisito já presente: public.notas.frete. Esta migration não cria a coluna.
-- =====================================================================

do $$ begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'notas' and column_name = 'frete') then
    raise exception 'Parar: falta public.notas.frete. Não criar a coluna aqui.';
  end if;
  if to_regprocedure('public.cliente_saldo_calc(bigint)') is null
     or to_regprocedure('public.can(text)') is null
     or to_regclass('public.recebimento_notas') is null
     or to_regclass('public.cliente_creditos') is null then
    raise exception 'Parar: falta saldo, recebimento ou crédito do cliente.';
  end if;
end $$;

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
grant usage on schema private to authenticated;

create or replace function private.cliente_extrato_ler(p_cliente bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c record;
  v_saldo numeric;
  v_prazo numeric;
  v_rec numeric;
  v_alocado numeric;
  v_cred numeric;
  v_notas jsonb;
  v_recs jsonb;
  v_creds jsonb;
begin
  if not public.can('financas') then
    raise exception 'Sem permissão (financeiro/admin)' using errcode = '42501';
  end if;
  if p_cliente is null or p_cliente <= 0 then
    raise exception 'Cliente não encontrado' using errcode = 'P0001';
  end if;
  select id, nome into c from public.clientes where id = p_cliente;
  if c.id is null then
    raise exception 'Cliente não encontrado' using errcode = 'P0001';
  end if;
  v_saldo := public.cliente_saldo_calc(p_cliente);
  v_cred := public._credito_saldo(p_cliente);
  select coalesce(sum(np.valor), 0) into v_prazo
    from public.nota_pagamentos np
    join public.notas n on n.id = np.nota_id
   where n.cliente_id = p_cliente and n.status = 'ativa' and np.metodo::text = 'prazo';
  select coalesce(sum(r.valor), 0) into v_rec
    from public.cliente_recebimentos r where r.cliente_id = p_cliente;
  select coalesce(sum(rn.valor), 0) into v_alocado
    from public.recebimento_notas rn
    join public.cliente_recebimentos r on r.id = rn.recebimento_id
   where r.cliente_id = p_cliente;
  select coalesce(jsonb_agg(x.obj order by x.created_at, x.id), '[]'::jsonb)
    into v_notas
    from (
      select n.id, n.created_at,
        jsonb_build_object(
          'nota_id', n.id,
          'numero', lpad(n.id::text, 6, '0'),
          'data', n.data,
          'created_at', n.created_at,
          'status', n.status,
          'total', n.total,
          'frete', coalesce(n.frete, 0),
          'obs_pagamento', n.obs_pagamento,
          'rotulo', case
            when coalesce(n.obs_pagamento, '') like 'DÍVIDA ANTERIOR%' then 'Dívida anterior'
            when not exists (select 1 from public.sales s where s.nota_id = n.id) then 'Sem mercadoria'
            else 'Venda' end,
          'vendedor', pr.handle,
          'prazo', coalesce(pz.valor, 0),
          'recebido_na_nota', coalesce(al.valor, 0),
          'em_aberto', case when n.status = 'ativa' then greatest(coalesce(pz.valor, 0) - coalesce(al.valor, 0), 0) else 0 end,
          'porque', case
            when n.status <> 'ativa' then 'Nota cancelada: fica de fora do saldo a receber.'
            when coalesce(n.obs_pagamento, '') like 'DÍVIDA ANTERIOR%' then 'Dívida anterior vinculada a este cliente, sem mercadoria. Entra no saldo pelo Paga Depois.'
            when coalesce(pz.valor, 0) <= 0 then 'Não há Paga Depois. O que foi pago na hora não fica em Contas a receber.'
            when coalesce(al.valor, 0) >= coalesce(pz.valor, 0) then 'O Paga Depois desta nota já foi coberto por recebimento.'
            else 'Ainda há Paga Depois desta nota sem recebimento suficiente.' end,
          'itens', coalesce((
            select jsonb_agg(jsonb_build_object(
                     'sku', s.sku, 'marca', p.marca, 'produto', p.produto, 'tamanho', p.tamanho,
                     'qtd', s.qtd, 'preco_vendido', s.preco_vendido, 'total', s.total)
                   order by s.id)
              from public.sales s
              join public.products p on p.sku = s.sku
             where s.nota_id = n.id), '[]'::jsonb),
          'pagamentos', coalesce((
            select jsonb_agg(jsonb_build_object('metodo', np.metodo::text, 'valor', np.valor) order by np.id)
              from public.nota_pagamentos np where np.nota_id = n.id), '[]'::jsonb)
        ) as obj
      from public.notas n
      left join public.profiles pr on pr.id = n.seller_id
      left join lateral (
        select sum(np.valor) as valor from public.nota_pagamentos np
         where np.nota_id = n.id and np.metodo::text = 'prazo') pz on true
      left join lateral (
        select sum(rn.valor) as valor from public.recebimento_notas rn
         where rn.nota_id = n.id) al on true
      where n.cliente_id = p_cliente
    ) x;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', r.id, 'data', r.data, 'valor', r.valor, 'forma', r.forma,
           'notas', coalesce((
             select jsonb_agg(jsonb_build_object('nota_id', rn.nota_id, 'numero', lpad(rn.nota_id::text, 6, '0'), 'valor', rn.valor)
                              order by rn.nota_id)
               from public.recebimento_notas rn where rn.recebimento_id = r.id), '[]'::jsonb))
         order by r.data, r.id), '[]'::jsonb)
    into v_recs
    from public.cliente_recebimentos r
   where r.cliente_id = p_cliente;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', k.id, 'tipo', k.tipo, 'valor', k.valor, 'obs', k.obs, 'nota_id', k.nota_id,
           'created_at', k.created_at,
           'conta_no_credito', (k.nota_id is null or exists (
             select 1 from public.notas n where n.id = k.nota_id and n.status = 'ativa')))
         order by k.created_at, k.id), '[]'::jsonb)
    into v_creds
    from public.cliente_creditos k
   where k.cliente_id = p_cliente;
  return jsonb_build_object(
    'cliente_id', c.id,
    'nome', c.nome,
    'saldo', v_saldo,
    'total_prazo', v_prazo,
    'total_recebido', v_rec,
    'recebido_vinculado', v_alocado,
    'credito_saldo', v_cred,
    'explicacao', 'Saldo a receber = Paga Depois das notas ativas vinculadas a este cliente ('
      || trim(to_char(v_prazo, 'FM999999990.00')) || ') menos os recebimentos ('
      || trim(to_char(v_rec, 'FM999999990.00')) || '). O crédito da loja é outra conta e não abate essa dívida.',
    'historico_sem_vinculo', 'Notas antigas só com nome digitado, sem cliente vinculado, não são procuradas nem listadas.',
    'notas', v_notas,
    'recebimentos', v_recs,
    'creditos', v_creds);
end $$;

revoke all on function private.cliente_extrato_ler(bigint) from public, anon;
grant execute on function private.cliente_extrato_ler(bigint) to authenticated;

-- Troca um rascunho anterior que era security definer em public, se chegou a ser criado.
drop function if exists public.cliente_extrato(bigint);

create or replace function public.cliente_extrato(p_cliente bigint)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not public.can('financas') then
    raise exception 'Sem permissão (financeiro/admin)' using errcode = '42501';
  end if;
  if p_cliente is null or p_cliente <= 0 then
    raise exception 'Cliente não encontrado' using errcode = 'P0001';
  end if;
  return private.cliente_extrato_ler(p_cliente);
end $$;

revoke all on function public.cliente_extrato(bigint) from public, anon;
grant execute on function public.cliente_extrato(bigint) to authenticated;

notify pgrst, 'reload schema';
select 'cliente extrato ok' as status;
