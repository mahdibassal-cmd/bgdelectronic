-- Vencimentos for vendedores: unpaid Paga Depois notas they themselves
-- created (notas.seller_id = auth.uid()). Admin and Financeiro keep
-- cobranca_alertas / Contas a receber unchanged.
-- Lists every open unpaid nota of the caller (including legacy rows
-- without vencimento), grouped by cliente. Does not return other
-- vendedores' notas, caixa, cost, credito, limite_prazo or recebimentos.
-- No business-data writes. Rollback: /workspace/loja-perf/rollback-vencimentos-vendedor.sql

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
grant usage on schema private to authenticated;

create or replace function private.vencimentos_vendedor_ler()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_uid uuid := auth.uid();
  v_out jsonb;
begin
  if v_uid is null or not public.can('vendas') then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  with abertas as (
    select n.id as nota_id,
           n.cliente_id,
           c.nome,
           n.data,
           n.prazo_dias,
           n.vencimento,
           round((
             coalesce((select sum(g.valor) from public.nota_pagamentos g
                        where g.nota_id = n.id and g.metodo::text = 'prazo'), 0)
             - coalesce((select sum(a.valor) from public.recebimento_notas a
                          where a.nota_id = n.id), 0)
           ), 2) as em_aberto
    from public.notas n
    join public.clientes c on c.id = n.cliente_id
    where n.status = 'ativa'
      and n.cliente_id is not null
      and n.seller_id = v_uid
  ),
  vivas as (
    select * from abertas where em_aberto > 0.001
  ),
  classif as (
    select v.*,
           case
             when v.vencimento is null then null
             when v.vencimento < v_hoje then 'vencida'
             when v.vencimento = v_hoje then 'vence_hoje'
             when v.vencimento <= v_hoje + 2 then 'vence_breve'
             else null
           end as classe,
           case
             when v.vencimento is null then null
             when v.vencimento < v_hoje then (v_hoje - v.vencimento)
             when v.vencimento = v_hoje then 0
             else null
           end as dias_atraso
    from vivas v
  ),
  por_cli as (
    select c.cliente_id, c.nome,
           round(sum(c.em_aberto), 2) as saldo_aberto,
           bool_or(c.classe = 'vencida') as tem_vencida,
           bool_or(c.classe = 'vence_hoje') as tem_vence_hoje,
           bool_or(c.classe = 'vence_breve') as tem_vence_breve,
           bool_or(c.vencimento is null) as tem_sem_vencimento,
           jsonb_agg(
             jsonb_build_object(
               'nota_id', c.nota_id,
               'numero', lpad(c.nota_id::text, 6, '0'),
               'em_aberto', c.em_aberto,
               'vencimento', c.vencimento,
               'prazo_dias', c.prazo_dias,
               'dias_atraso', c.dias_atraso,
               'classe', c.classe
             )
             order by case c.classe when 'vencida' then 0 when 'vence_hoje' then 1 when 'vence_breve' then 2 else 3 end,
                      c.vencimento nulls last, c.nota_id
           ) as notas
    from classif c
    group by c.cliente_id, c.nome
  )
  select jsonb_build_object(
    'hoje', v_hoje,
    'clientes', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'cliente_id', f.cliente_id,
          'nome', f.nome,
          'saldo_aberto', f.saldo_aberto,
          'tem_vencida', f.tem_vencida,
          'tem_vence_hoje', f.tem_vence_hoje,
          'tem_vence_breve', f.tem_vence_breve,
          'tem_sem_vencimento', f.tem_sem_vencimento,
          'notas', f.notas
        )
        order by case when f.tem_vencida then 0 when f.tem_vence_hoje then 1 when f.tem_vence_breve then 2 else 3 end,
                 f.nome
      )
      from por_cli f
    ), '[]'::jsonb),
    'n_clientes', (select count(*) from por_cli),
    'n_vencidas', (select count(*) from por_cli f where f.tem_vencida),
    'n_vence_hoje', (select count(*) from por_cli f where f.tem_vence_hoje),
    'n_vence_breve', (select count(*) from por_cli f where f.tem_vence_breve),
    'n_sem_vencimento', (select count(*) from por_cli f where f.tem_sem_vencimento)
  ) into v_out;

  return v_out;
end $fn$;

revoke all on function private.vencimentos_vendedor_ler() from public, anon;
grant execute on function private.vencimentos_vendedor_ler() to authenticated;

create or replace function public.vencimentos_vendedor()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.can('vendas') then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  return private.vencimentos_vendedor_ler();
end $$;

revoke all on function public.vencimentos_vendedor() from public, anon;
grant execute on function public.vencimentos_vendedor() to authenticated;

notify pgrst, 'reload schema';
select 'vencimentos vendedor draft' as status;
