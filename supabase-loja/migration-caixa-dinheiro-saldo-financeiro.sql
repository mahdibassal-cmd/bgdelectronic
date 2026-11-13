-- Draft only. Do not apply until MB says "publica".
-- Financeiro sees the real accumulated saldo (saldo total) for Caixa Dinheiro
-- (caixa id 1) only. Other caixas stay hidden. Movement visibility is unchanged
-- (last 3 days in America/Sao_Paulo; HX today-only). Admin is unchanged.
--
-- Why a column + security-definer helper (not the invoker sum):
-- v_caixa_saldo is security_invoker, so a Financeiro sum() would only add the
-- visible 3-day window, which is not the real saldo. caixa_saldo_visivel()
-- returns caixa_saldo_calc() only for caixas with saldo_visivel_financeiro
-- (and never grants execute on caixa_saldo_calc itself, so Financeiro cannot
-- probe other caixas).
--
-- The live app (v20261113j) also hard-hides saldo for non-admin in viewCaixa
-- and viewResumo. A DB-only publish is not enough; see
-- caixa-dinheiro-saldo-financeiro-app-notes-2026-11-13.md.

alter table public.caixas
  add column if not exists saldo_visivel_financeiro boolean not null default false;

comment on column public.caixas.saldo_visivel_financeiro is
  'Se true, o financeiro vê o saldo acumulado real deste caixa (não só o movimento da janela). Padrão false. Caixa Dinheiro (id 1) é o único ligado.';

update public.caixas
   set saldo_visivel_financeiro = true
 where id = 1
   and saldo_visivel_financeiro is distinct from true;

create or replace function public.caixa_saldo_visivel(p_caixa smallint)
returns numeric
language sql
stable
security definer
set search_path = ''
as $fn$
  select case
    when p_caixa is null then null
    when not public.caixa_permitido(p_caixa) then null
    when exists (
      select 1
        from public.caixas c
       where c.id = p_caixa
         and c.saldo_visivel_financeiro
         and not c.somente_admin
    ) then public.caixa_saldo_calc(p_caixa)
    else null
  end;
$fn$;

revoke all on function public.caixa_saldo_visivel(smallint) from public, anon;
grant execute on function public.caixa_saldo_visivel(smallint) to authenticated;

create or replace view public.v_caixa_saldo
  with (security_invoker = true) as
select c.id as caixa_id,
       c.nome,
       c.metodo,
       case
         when public.has_perm('admin') then
           coalesce(sum(case when m.tipo in ('venda','entrada') then m.valor else -m.valor end), 0)
         else public.caixa_saldo_visivel(c.id)
       end as saldo,
       coalesce(sum(case when m.data = (now() at time zone 'America/Sao_Paulo')::date
                         then case when m.tipo in ('venda','entrada') then m.valor else -m.valor end
                    end), 0) as movimento_hoje,
       coalesce(sum(case when m.tipo in ('venda','entrada') then m.valor else -m.valor end), 0) as movimento_visivel,
       c.somente_admin,
       c.saldo_visivel_financeiro
  from public.caixas c
  left join public.caixa_movimentos m on m.caixa_id = c.id
 where c.ativo
 group by c.id, c.nome, c.metodo, c.somente_admin, c.saldo_visivel_financeiro;

alter view public.v_caixa_saldo set (security_invoker = true);
revoke all on public.v_caixa_saldo from anon, public;
grant select on public.v_caixa_saldo to authenticated;

create or replace function public.caixa_resumo(p_caixa smallint, p_data date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v jsonb;
  v_ini numeric;
  v_fim numeric;
  v_admin boolean := public.has_perm('admin');
  v_mostra boolean;
begin
  if not (public.caixa_acesso() and (public.has_perm('admin') or public.has_perm('financas'))) then
    raise exception 'Sem permissão (admin/financeiro)' using errcode = '42501'; end if;
  if not public.caixa_permitido(p_caixa) then raise exception 'Caixa inválido' using errcode = '42501'; end if;
  if not public.caixa_mov_visivel(p_caixa, p_data) then
    raise exception 'Extrato fora da janela do financeiro' using errcode = '42501'; end if;
  v_mostra := v_admin or exists (
    select 1 from public.caixas c
     where c.id = p_caixa and c.saldo_visivel_financeiro and not c.somente_admin
  );
  if not v_mostra then
    v_ini := null; v_fim := null;
  elsif public.caixa_hx_restrito(p_caixa) then
    v_ini := 0;
  else
    select coalesce(sum(case when tipo in ('venda','entrada') then valor else -valor end), 0) into v_ini
      from public.caixa_movimentos where caixa_id = p_caixa and data < p_data;
  end if;
  if v_mostra then
    select coalesce(sum(case when tipo in ('venda','entrada') then valor else -valor end), 0) + v_ini into v_fim
      from public.caixa_movimentos where caixa_id = p_caixa and data = p_data;
  end if;
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
                 'fechamento_contado', s.fechamento_contado, 'fechamento_sistema', case when v_admin then s.fechamento_sistema end,
                 'diferenca', case when v_admin then s.diferenca end,
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

create or replace function public.caixa_fin_janela()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_desde date := v_hoje - 2;
  v_caixas jsonb;
  g record;
begin
  if not public.caixa_acesso() then
    raise exception 'Sem permissão de caixa' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(c.id order by c.id), '[]'::jsonb) into v_caixas
    from public.caixas c
   where c.ativo and c.saldo_visivel_financeiro and not c.somente_admin;
  if public.has_perm('admin') then
    return jsonb_build_object('ilimitado', true, 'mostra_saldo', true,
      'mostra_saldo_caixas', v_caixas, 'hoje', v_hoje, 'desde', null, 'rotulo', 'tudo');
  end if;
  for g in
    select h.desde, h.dias, h.caixa_id
      from public.caixa_fin_historico h
     where h.ativo and h.revogado_em is null and (h.expira_em is null or h.expira_em > now())
  loop
    if g.desde is not null then v_desde := least(v_desde, g.desde); end if;
    if g.dias is not null and g.dias > 0 then v_desde := least(v_desde, v_hoje - (g.dias - 1)); end if;
  end loop;
  return jsonb_build_object(
    'ilimitado', false, 'mostra_saldo', false,
    'mostra_saldo_caixas', v_caixas,
    'hoje', v_hoje, 'desde', v_desde,
    'rotulo', case when v_desde = v_hoje - 2 then 'últimos 3 dias' else 'período liberado' end);
end $$;
revoke all on function public.caixa_fin_janela() from public, anon;
grant execute on function public.caixa_fin_janela() to authenticated;
