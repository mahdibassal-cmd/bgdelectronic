-- Aplicado em produção em 2026-11-13 (OK do MB). Rollback: /workspace/loja-perf/rollback-prazo-vencimento.sql
-- Paga Depois: prazo de 1 a 30 dias na nota (prazo_dias + vencimento),
-- limite opcional por cliente (clientes.limite_prazo) e painel de Cobrança
-- em Contas a receber (RPC cobranca_alertas, só financas / admin+financeiro).
-- Notas antigas sem prazo ficam com prazo_dias e vencimento NULL: não entram
-- nos alertas de vencimento (não há data). Continuam no saldo e podem entrar
-- no alerta de limite. Notas totalmente quitadas em recebimento_notas não alertam.
-- Não substitui criar_nota, cancelar_nota, pagar_conta, frete, caxinha,
-- Caixa Especial, estoque_origem nem o teto de linhas (já removido).
-- Estende criar_nota_local com p_prazo_dias integer default null (chamadas
-- de 8 argumentos continuam válidas; Paga Depois novo exige 1–30).

-- ---------- colunas ----------
alter table public.notas add column if not exists prazo_dias smallint;
alter table public.notas add column if not exists vencimento date;
alter table public.notas drop constraint if exists notas_prazo_dias_chk;
alter table public.notas add constraint notas_prazo_dias_chk
  check (prazo_dias is null or (prazo_dias between 1 and 30));
alter table public.notas drop constraint if exists notas_prazo_venc_chk;
alter table public.notas add constraint notas_prazo_venc_chk
  check ((prazo_dias is null) = (vencimento is null));

create index if not exists notas_vencimento_aberta_idx
  on public.notas (vencimento)
  where vencimento is not null and status = 'ativa';

alter table public.clientes add column if not exists limite_prazo numeric(12,2);
alter table public.clientes drop constraint if exists clientes_limite_prazo_chk;
alter table public.clientes add constraint clientes_limite_prazo_chk
  check (limite_prazo is null or limite_prazo >= 0);

-- ---------- criar_nota_local: mesmo comportamento + prazo opcional ----------
drop function if exists public.criar_nota_local(jsonb, jsonb, text, bigint, text, text, numeric, numeric);

create or replace function public.criar_nota_local(
  p_items jsonb, p_pagamentos jsonb, p_cliente text default null, p_cliente_id bigint default null,
  p_local text default null, p_obs text default null, p_frete numeric default 0, p_caxinha_natal numeric default 0,
  p_prazo_dias integer default null
)
returns bigint language plpgsql security definer set search_path = '' as $fn$
declare v_id bigint; v_tot numeric := 0; v_saldo numeric; it jsonb; v_pags jsonb := p_pagamentos;
  v_frete numeric := round(coalesce(p_frete, 0), 2);
  v_cx numeric := round(coalesce(p_caxinha_natal, 0), 2);
  v_pago numeric := 0;
  v_cxid bigint;
  v_tem_prazo boolean := false;
  v_dias integer;
begin
  if not public.can('vendas') then raise exception 'Sem permissão para criar nota' using errcode = '42501'; end if;
  if v_frete < 0 then raise exception 'Frete inválido' using errcode = 'P0001'; end if;
  if v_cx < 0 then raise exception 'Caxinha d Natal inválido' using errcode = 'P0001'; end if;
  if p_local is not null and p_local not in ('MAQUINA','HX','DINHEIRO','CAIXA GERAL','CAIXA ESPECIAL','CAIXA S2','PRESTIGE AURA') then
    raise exception 'Escolha o Local do pagamento' using errcode = 'P0001'; end if;
  if p_local is null and (jsonb_typeof(p_pagamentos) is distinct from 'array' or exists (
      select 1 from jsonb_array_elements(p_pagamentos) g
      where coalesce(g->>'metodo','') <> 'prazo' and coalesce(nullif(g->>'valor','')::numeric, 0) > 0)) then
    raise exception 'Escolha o Local do pagamento' using errcode = 'P0001'; end if;
  if p_local = 'CAIXA ESPECIAL' then
    if not (public.can('admin') and exists (
          select 1 from public.profiles p where p.id = auth.uid() and p.role::text = 'admin' and p.ativo)) then
      raise exception 'Somente admin' using errcode = '42501'; end if;
  end if;
  if p_local = 'CAIXA GERAL' then
    if p_cliente_id is null then raise exception 'Caixa Geral exige cliente cadastrado' using errcode = 'P0001'; end if;
    if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Nota sem itens' using errcode = 'P0001'; end if;
    for it in select * from jsonb_array_elements(p_items) loop
      v_tot := v_tot + (it->>'qtd')::int * (it->>'preco_vendido')::numeric; end loop;
    v_tot := v_tot + v_frete + v_cx;
    perform 1 from public.clientes where id = p_cliente_id for update;
    v_saldo := public._credito_saldo(p_cliente_id);
    if round(v_tot, 2) > round(v_saldo, 2) then
      raise exception 'Crédito insuficiente na Caixa Geral (saldo R$ %)', replace(to_char(v_saldo, 'FM999999990.00'), '.', ',') using errcode = 'P0001'; end if;
    v_pags := jsonb_build_array(jsonb_build_object('metodo', 'credito', 'valor', round(v_tot, 2)));
    perform set_config('bagda.credito_ok', '1', true);
  end if;
  v_id := public.criar_nota(p_items, v_pags, p_cliente, p_cliente_id, v_frete, v_cx);
  perform set_config('bagda.credito_ok', '', true);
  update public.notas set local_pagamento = p_local, obs_pagamento = nullif(left(trim(coalesce(p_obs,'')), 200), '') where id = v_id;
  if p_local = 'CAIXA GERAL' then
    insert into public.cliente_creditos(cliente_id, tipo, valor, obs, nota_id)
    values (p_cliente_id, 'uso', round(v_tot, 2), 'Nota ' || lpad(v_id::text, 6, '0'), v_id);
  end if;
  if p_local = 'CAIXA ESPECIAL' then
    select coalesce(sum(valor), 0) into v_pago from public.nota_pagamentos
     where nota_id = v_id and metodo::text not in ('prazo', 'credito');
    if v_pago <= 0 then raise exception 'Nota sem valor para a Caixa Especial' using errcode = 'P0001'; end if;
    v_cxid := public._cxesp_inserir('entrada', v_pago, 'Nota ' || lpad(v_id::text, 6, '0'), null, p_cliente_id, null);
    update public.caixa_especial_mov set nota_id = v_id where id = v_cxid;
    update public.notas set caixa_lancada_id = null, lancada_em = now(), lancada_por = auth.uid(),
           cxesp_lancada_em = now(), cxesp_lancada_por = auth.uid(), cxesp_mov_id = v_cxid
     where id = v_id;
    perform public.fin_log('nota_lancada', jsonb_build_object('nota_id', v_id, 'destino', 'cxesp', 'cxesp_id', v_cxid, 'valor', v_pago, 'na_criacao', true));
  end if;

  select exists (
    select 1 from public.nota_pagamentos g
     where g.nota_id = v_id and g.metodo::text = 'prazo' and g.valor > 0
  ) into v_tem_prazo;
  if v_tem_prazo then
    v_dias := p_prazo_dias;
    -- Sem prazo (app antigo em cache): a nota é criada sem vencimento, como antes.
    if v_dias is not null and (v_dias < 1 or v_dias > 30) then
      raise exception 'Informe o prazo (1 a 30 dias) para Paga Depois' using errcode = 'P0001';
    end if;
    if v_dias is not null then
      update public.notas
         set prazo_dias = v_dias,
             vencimento = data + v_dias
       where id = v_id;
    end if;
  end if;
  return v_id;
end $fn$;

revoke all on function public.criar_nota_local(jsonb, jsonb, text, bigint, text, text, numeric, numeric, integer) from public, anon;
grant execute on function public.criar_nota_local(jsonb, jsonb, text, bigint, text, text, numeric, numeric, integer) to authenticated;

-- ---------- saldo: inclui o limite ----------
create or replace view public.v_clientes_saldo with (security_invoker = true) as
select c.id, c.nome, c.doc, c.telefone, c.email, c.endereco, c.obs, c.ativo,
       coalesce(f.fiado, 0) as total_fiado, coalesce(r.recebido, 0) as total_recebido,
       coalesce(f.fiado, 0) - coalesce(r.recebido, 0) as saldo,
       -- new columns go last: CREATE OR REPLACE VIEW can only append columns.
       c.limite_prazo,
       c.atendimento
from public.clientes c
left join public.clientes_fiado() f on f.cliente_id = c.id
left join (select cliente_id, sum(valor) recebido from public.cliente_recebimentos group by cliente_id) r on r.cliente_id = c.id
where public.can('financas');

revoke all on public.v_clientes_saldo from anon, public;
grant select on public.v_clientes_saldo to authenticated;

-- ---------- Cobrança: notas em aberto (prazo − recebimento_notas) ----------
create or replace function public.cobranca_alertas()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_out jsonb;
begin
  if not public.can('financas') then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  with abertas as (
    select n.id as nota_id,
           n.cliente_id,
           c.nome,
           c.limite_prazo,
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
    select c.cliente_id, c.nome, c.limite_prazo,
           round(sum(c.em_aberto), 2) as saldo_aberto,
           bool_or(c.classe = 'vencida') as tem_vencida,
           bool_or(c.classe = 'vence_hoje') as tem_vence_hoje,
           bool_or(c.classe = 'vence_breve') as tem_vence_breve,
           (c.limite_prazo is not null and round(sum(c.em_aberto), 2) >= c.limite_prazo) as no_limite,
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
    group by c.cliente_id, c.nome, c.limite_prazo
  ),
  filtrado as (
    select * from por_cli
     where tem_vencida or tem_vence_hoje or tem_vence_breve or no_limite
  )
  select jsonb_build_object(
    'hoje', v_hoje,
    'clientes', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'cliente_id', f.cliente_id,
          'nome', f.nome,
          'saldo_aberto', f.saldo_aberto,
          'limite_prazo', f.limite_prazo,
          'no_limite', f.no_limite,
          'tem_vencida', f.tem_vencida,
          'tem_vence_hoje', f.tem_vence_hoje,
          'tem_vence_breve', f.tem_vence_breve,
          'notas', f.notas
        )
        order by case when f.tem_vencida then 0 when f.tem_vence_hoje then 1 when f.no_limite then 2 else 3 end,
                 f.nome
      )
      from filtrado f
    ), '[]'::jsonb),
    'n_clientes', (select count(*) from filtrado),
    'n_vencidas', (select count(*) from filtrado f where f.tem_vencida),
    'n_vence_hoje', (select count(*) from filtrado f where f.tem_vence_hoje),
    'n_vence_breve', (select count(*) from filtrado f where f.tem_vence_breve),
    'n_limite', (select count(*) from filtrado f where f.no_limite)
  ) into v_out;

  return v_out;
end $fn$;

revoke all on function public.cobranca_alertas() from public, anon;
grant execute on function public.cobranca_alertas() to authenticated;

notify pgrst, 'reload schema';
select 'prazo vencimento draft' as status;
