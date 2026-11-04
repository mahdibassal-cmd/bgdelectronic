-- =====================================================================
-- migration-caixa-hx-dia.sql — Loja (bagda-loja). Idempotente (pode rodar mais de uma vez).
-- Rodar DEPOIS de migration-caixa-estornar-mov.sql (2f8f9de) e migration-paga-depois-caixa-geral.sql (55e5ffc).
-- Raw: https://raw.githubusercontent.com/mahdibassal-cmd/bgdelectronic/main/supabase-loja/migration-caixa-hx-dia.sql
--
-- CAIXA HX (caixas.nome contém 'HX'; reserva: metodo = 'pix'): quem NÃO é admin (financeiro) só enxerga
-- o DIA DE HOJE (America/Sao_Paulo). Virou o dia -> movimentos, extrato, resumo do dia, sessões e
-- notas lançadas no HX em dias anteriores somem para o financeiro. Admin vê tudo.
-- Saldo do HX para o financeiro = só o movimento de hoje (nada carregado de dias anteriores).
-- Sessão do HX (abrir/fechar): 'sistema' = movimento de hoje (para todos), assim a diferença do
-- fechamento não revela o saldo acumulado.
-- Outros caixas: sem mudança. security_events: sem mudança (28 tipos mantidos).
-- =====================================================================

-- ---------- Helpers ----------
create or replace function public.caixa_hx_id() returns smallint
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select id from public.caixas where nome ilike '%HX%' order by id limit 1),
    (select id from public.caixas where metodo::text = 'pix' order by id limit 1));
$$;

-- true = este caixa é o HX e quem consulta NÃO é admin.
create or replace function public.caixa_hx_restrito(p_caixa smallint) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_caixa is not distinct from public.caixa_hx_id() and not public.has_perm('admin');
$$;

-- true = pode ver este caixa nesta data.
create or replace function public.caixa_dia_visivel(p_caixa smallint, p_data date) returns boolean
language sql stable security definer set search_path = '' as $$
  select not public.caixa_hx_restrito(p_caixa)
      or p_data >= (now() at time zone 'America/Sao_Paulo')::date;
$$;
revoke all on function public.caixa_hx_id(), public.caixa_hx_restrito(smallint), public.caixa_dia_visivel(smallint, date) from public, anon;
grant execute on function public.caixa_hx_id(), public.caixa_hx_restrito(smallint), public.caixa_dia_visivel(smallint, date) to authenticated;

-- ---------- RLS (views security_invoker herdam: v_caixa_saldo, v_caixa_extrato) ----------
drop policy if exists mov_read on public.caixa_movimentos;
create policy mov_read on public.caixa_movimentos for select to authenticated
  using (public.can('caixa') and public.caixa_dia_visivel(caixa_id, data));
drop policy if exists sessoes_read on public.caixa_sessoes;
create policy sessoes_read on public.caixa_sessoes for select to authenticated
  using (public.can('caixa') and public.caixa_dia_visivel(caixa_id, data));
-- cliente_recebimentos / conta_pagamentos NÃO são filtrados: v_clientes_saldo e v_contas_pagar somam
-- esses registros (security_invoker) e filtrar quebraria a dívida dos clientes e o saldo das contas.

-- Garante security_invoker nas views de caixa (não bypassam RLS).
do $$ declare v text; begin
  foreach v in array array['v_caixa_saldo','v_caixa_extrato'] loop
    if to_regclass('public.' || v) is not null then execute format('alter view public.%I set (security_invoker = true)', v); end if;
  end loop;
end $$;

-- ---------- Saldo usado em abrir/fechar: HX = só o movimento de hoje ----------
create or replace function public.caixa_saldo_calc(p_caixa smallint) returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(case when tipo in ('venda','entrada') then valor else -valor end), 0)
  from public.caixa_movimentos
  where caixa_id = p_caixa
    and (p_caixa is distinct from public.caixa_hx_id() or data = (now() at time zone 'America/Sao_Paulo')::date);
$$;
revoke all on function public.caixa_saldo_calc(smallint) from public, anon, authenticated;

-- ---------- Resumo do dia (security definer: checagem explícita) ----------
create or replace function public.caixa_resumo(p_caixa smallint, p_data date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v jsonb; v_ini numeric; v_fim numeric;
begin
  if not (public.can('caixa') and (public.has_perm('admin') or public.has_perm('financas'))) then
    raise exception 'Sem permissão (admin/financeiro)' using errcode = '42501'; end if;
  -- Caixa HX: não-admin só vê o dia de hoje (SP) e sem saldo carregado de dias anteriores.
  if not public.caixa_dia_visivel(p_caixa, p_data) then
    raise exception 'Caixa HX: dias anteriores visíveis só para admin' using errcode = '42501'; end if;
  if public.caixa_hx_restrito(p_caixa) then
    v_ini := 0;
  else
    select coalesce(sum(case when tipo in ('venda','entrada') then valor else -valor end), 0) into v_ini
      from public.caixa_movimentos where caixa_id = p_caixa and data < p_data;
  end if;
  select coalesce(sum(case when tipo in ('venda','entrada') then valor else -valor end), 0) + v_ini into v_fim
    from public.caixa_movimentos where caixa_id = p_caixa and data = p_data;
  with mv as (
    select m.id, m.tipo::text tipo, m.valor, case when m.tipo in ('venda','entrada') then m.valor else -m.valor end assinado,
           m.forma, m.motivo, m.created_at,
           to_char(m.created_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') hora,
           p.nome usuario, r.id rec_id, cp.id cpag_id,
           coalesce(n.cliente, cl.nome, f.nome) cliente,
           case when m.nota_id is not null then lpad(m.nota_id::text, 6, '0')
                when r.id is not null then (select string_agg(lpad(rn.nota_id::text, 6, '0') || ' (R$ ' || to_char(rn.valor, 'FM999999990.00') || ')', ', ' order by rn.nota_id)
                                              from public.recebimento_notas rn where rn.recebimento_id = r.id) end notas
      from public.caixa_movimentos m
      left join public.profiles p on p.id = m.user_id
      left join public.notas n on n.id = m.nota_id
      left join public.cliente_recebimentos r on r.mov_id = m.id
      left join public.clientes cl on cl.id = r.cliente_id
      left join public.conta_pagamentos cp on cp.mov_id = m.id
      left join public.contas_pagar ct on ct.id = cp.conta_id
      left join public.fornecedores f on f.id = ct.fornecedor_id
     where m.caixa_id = p_caixa and m.data = p_data)
  select jsonb_build_object(
    'caixa', (select nome from public.caixas where id = p_caixa), 'data', p_data,
    'saldo_inicial', v_ini, 'saldo_final', v_fim,
    'sessao', (select jsonb_build_object('abertura_valor', s.abertura_valor, 'aberto_por', pa.nome,
                 'aberto_em', to_char(s.aberto_em at time zone 'America/Sao_Paulo', 'HH24:MI'),
                 'fechamento_contado', s.fechamento_contado, 'fechamento_sistema', s.fechamento_sistema, 'diferenca', s.diferenca,
                 'fechado_por', pf.nome, 'fechado_em', to_char(s.fechado_em at time zone 'America/Sao_Paulo', 'HH24:MI'))
                 from public.caixa_sessoes s left join public.profiles pa on pa.id = s.aberto_por left join public.profiles pf on pf.id = s.fechado_por
                where s.caixa_id = p_caixa and s.data = p_data),
    'movimentos', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'hora', hora, 'tipo', tipo, 'valor', valor, 'assinado', assinado,
                 'forma', forma, 'nota', notas, 'cliente', cliente, 'usuario', usuario, 'motivo', motivo) order by created_at, id) from mv), '[]'),
    'por_forma', coalesce((select jsonb_object_agg(coalesce(forma, '-'), t) from (select forma, sum(assinado) t from mv group by forma) z), '{}'),
    'entradas', (select coalesce(sum(valor), 0) from mv where assinado > 0),
    'saidas',   (select coalesce(sum(valor), 0) from mv where assinado < 0)
  ) into v;
  return v;
end $$;
revoke all on function public.caixa_resumo(smallint, date) from public, anon;
grant execute on function public.caixa_resumo(smallint, date) to authenticated;

-- ---------- Notas p/ lançar (security definer): esconde do financeiro as lançadas no HX em dias anteriores ----------
create or replace function public.notas_lancar_financas(p_limit int default 300)
returns setof public.v_notas_lancar
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.can('financas') then
    raise exception 'Sem permissão (financeiro/admin)' using errcode = '42501';
  end if;
  return query select v.* from public.v_notas_lancar v
    where not (v.caixa_lancada_id is not null and public.caixa_hx_restrito(v.caixa_lancada_id)
               and (v.lancada_em at time zone 'America/Sao_Paulo')::date < (now() at time zone 'America/Sao_Paulo')::date)
    order by v.created_at desc limit least(greatest(coalesce(p_limit, 300), 1), 1000);
end $$;
revoke all on function public.notas_lancar_financas(int) from public, anon;
grant execute on function public.notas_lancar_financas(int) to authenticated;

-- estornar_movimento_caixa / lancar_nota_caixa / cancelar_nota_financas: não devolvem extrato nem saldo
-- (estornar é só admin). Sem mudança.

select 'caixa_hx_dia ok' as status, public.caixa_hx_id() as hx_caixa_id;
