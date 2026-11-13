-- =====================================================================
-- migration-compras-pagamento-admin.sql — Loja (bagda-loja). Idempotente.
-- NÃO foi aplicado em produção por este rascunho. Rodar no SQL editor depois
-- de migration-compras-pagamento.sql, junto com o app novo.
--
-- 1) Compras pendentes / pagamento ao fornecedor: só admin.
--    compra_pagamentos, compras_pendentes, compra_pagar e compras_caixas_pagamento
--    exigem can('admin'). pagamento e vencimento saem do SELECT direto em compras
--    (a tabela continua legível nas outras colunas; os RPCs de IMEI não devolvem
--    esses campos).
-- 2) Caixa novo nasce somente_admin (default true). 16, 17 e 18 ficam true.
--    Caixas 1, 2, 3 e 10–15 NÃO são alterados.
-- 3) Financeiro vê movimento/extrato dos caixas permitidos só nos últimos 3 dias
--    corridos (hoje e os dois anteriores, America/Sao_Paulo). Admin vê tudo.
--    HX continua "só hoje" enquanto a chave antiga estiver desligada; uma
--    liberação abaixo alarga também o HX.
-- 4) Admin libera uma janela maior (data inicial OU número de dias, caixa
--    opcional, validade opcional) e pode revogar.
-- 5) Saldo acumulado NÃO é mostrado ao financeiro: ele soma movimento anterior
--    ao período visível. A tela mostra só o movimento do período. Admin continua
--    com o saldo real (inclusive dívida negativa).
-- =====================================================================

-- ---------- Compras: pagamento só admin ----------
drop policy if exists compra_pag_ler on public.compra_pagamentos;
create policy compra_pag_ler on public.compra_pagamentos
  for select to authenticated
  using (
    (select public.can('admin'))
    and (select public.compra_pag_visivel(caixa_id))
  );

do $$
declare cols text;
begin
  if to_regclass('public.compras') is null then return; end if;
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'compras'
     and column_name not in ('pagamento', 'vencimento');
  if cols is null then return; end if;
  execute 'revoke select on table public.compras from authenticated';
  execute 'grant select (' || cols || ') on table public.compras to authenticated';
end $$;

create or replace function public.compra_pagar(p_compra bigint, p_valor numeric, p_caixa smallint)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
begin
  if not (select public.can('admin')) then
    raise exception 'Somente admin' using errcode = '42501';
  end if;
  return public.compra_lancar_saida(p_compra, p_caixa, p_valor);
end
$fn$;

create or replace function public.compras_caixas_pagamento()
returns jsonb language plpgsql stable security definer set search_path = '' as $fn$
declare r jsonb;
begin
  if not (select public.can('admin')) then
    raise exception 'Somente admin' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'caixa_id', c.id, 'nome', c.nome, 'metodo', c.metodo::text,
           'somente_admin', c.somente_admin, 'saldo', round(public.caixa_saldo_calc(c.id), 2)
         ) order by c.id), '[]'::jsonb) into r
    from public.caixas c
   where c.ativo and public.caixa_permitido(c.id);
  return r;
end
$fn$;

create or replace function public.compras_pendentes()
returns jsonb language plpgsql stable security definer set search_path = '' as $fn$
declare
  v_admin boolean := public.has_perm('admin');
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_grupos jsonb;
  v_pagas jsonb;
begin
  if not (select public.can('admin')) then
    raise exception 'Somente admin' using errcode = '42501';
  end if;
  with linhas as (
    select c.id,
           public.compra_numero(c.id) as numero,
           c.data,
           nullif(btrim(c.fornecedor), '') as fornecedor,
           c.vencimento,
           c.pagamento,
           round(coalesce((select sum(p.qtd * p.custo_unit) from public.purchases p where p.compra_id = c.id), 0), 2) as total,
           round(coalesce((select sum(pg.valor) from public.compra_pagamentos pg where pg.compra_id = c.id), 0), 2) as pago
      from public.compras c
     where c.pagamento in ('agora', 'depois', 'divida')
  ),
  calc as (
    select l.*,
           round(l.total - l.pago, 2) as restante,
           (l.vencimento is not null and l.vencimento < v_hoje and round(l.total - l.pago, 2) > 0) as atrasada
      from linhas l
  ),
  objs as (
    select c.*,
           jsonb_build_object(
             'id', c.id, 'numero', c.numero, 'data', c.data,
             'fornecedor', coalesce(c.fornecedor, 'Sem fornecedor'),
             'vencimento', c.vencimento, 'pagamento', c.pagamento,
             'total', c.total, 'pago', c.pago, 'restante', c.restante, 'atrasada', c.atrasada,
             'pagamentos', coalesce((
               select jsonb_agg(jsonb_build_object(
                        'id', pg.id, 'valor', pg.valor, 'data', pg.data,
                        'caixa', case when cx.somente_admin and not v_admin then null else cx.nome end,
                        'caixa_id', case when cx.somente_admin and not v_admin then null else cx.id end,
                        'caixa_oculto', cx.somente_admin and not v_admin
                      ) order by pg.id)
                 from public.compra_pagamentos pg
                 join public.caixas cx on cx.id = pg.caixa_id
                where pg.compra_id = c.id
             ), '[]'::jsonb)
           ) as obj
      from calc c
  )
  select coalesce((
           select jsonb_agg(jsonb_build_object(
                    'fornecedor', g.fornecedor, 'total_devido', g.total_devido, 'compras', g.compras
                  ) order by g.fornecedor)
             from (
               select coalesce(fornecedor, 'Sem fornecedor') as fornecedor,
                      round(sum(restante), 2) as total_devido,
                      jsonb_agg(obj order by atrasada desc, vencimento nulls last, data, id) as compras
                 from objs
                where restante > 0
                group by coalesce(fornecedor, 'Sem fornecedor')
             ) g
         ), '[]'::jsonb),
         coalesce((
           select jsonb_agg(obj order by id desc)
             from (select obj, id from objs where restante <= 0 order by id desc limit 40) s
         ), '[]'::jsonb)
    into v_grupos, v_pagas;
  return jsonb_build_object('grupos', v_grupos, 'pagas', v_pagas);
end
$fn$;

revoke all on function public.compra_pagar(bigint, numeric, smallint),
  public.compras_caixas_pagamento(), public.compras_pendentes() from public, anon;
grant execute on function public.compra_pagar(bigint, numeric, smallint),
  public.compras_caixas_pagamento(), public.compras_pendentes() to authenticated;

-- ---------- Caixas: novo caixa nasce só admin; 16/17/18 permanecem ----------
alter table public.caixas alter column somente_admin set default true;
update public.caixas set somente_admin = true where id in (16, 17, 18);

drop policy if exists caixas_read on public.caixas;
create policy caixas_read on public.caixas for select to authenticated
  using (
    (select public.caixa_acesso())
    and ((not somente_admin) or (select public.has_perm('admin')))
  );

create or replace function public.caixas_ocultas()
returns smallint[]
language sql stable security definer set search_path = '' as $$
  select case when public.has_perm('admin') then '{}'::smallint[]
              else coalesce((select array_agg(id) from public.caixas where somente_admin), '{}'::smallint[]) end;
$$;
revoke all on function public.caixas_ocultas() from public, anon;
grant execute on function public.caixas_ocultas() to authenticated;

-- ---------- Liberação de histórico (só via RPC de admin) ----------
create table if not exists public.caixa_fin_historico (
  id bigint generated always as identity primary key,
  caixa_id smallint references public.caixas(id),
  desde date,
  dias integer,
  expira_em timestamptz,
  ativo boolean not null default true,
  criado_por uuid,
  criado_em timestamptz not null default now(),
  revogado_em timestamptz,
  revogado_por uuid,
  constraint caixa_fin_historico_janela check (
    (desde is not null and dias is null) or (desde is null and dias is not null and dias >= 3)
  )
);
alter table public.caixa_fin_historico enable row level security;
alter table public.caixa_fin_historico force row level security;
revoke all on public.caixa_fin_historico from anon, public, authenticated;

create or replace function public.caixa_mov_visivel(p_caixa smallint, p_data date)
returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_corte date;
  g record;
begin
  if p_caixa is null or p_data is null then return false; end if;
  if public.has_perm('admin') then return true; end if;
  if not public.caixa_permitido(p_caixa) then return false; end if;
  -- Padrão: HX restrito = só hoje; os outros caixas permitidos = hoje e 2 dias anteriores.
  v_corte := case when public.caixa_hx_restrito(p_caixa) then v_hoje else v_hoje - 2 end;
  for g in
    select h.desde, h.dias
      from public.caixa_fin_historico h
     where h.ativo
       and h.revogado_em is null
       and (h.expira_em is null or h.expira_em > now())
       and (h.caixa_id is null or h.caixa_id = p_caixa)
  loop
    if g.desde is not null then v_corte := least(v_corte, g.desde); end if;
    if g.dias is not null and g.dias > 0 then
      v_corte := least(v_corte, v_hoje - (g.dias - 1));
    end if;
  end loop;
  return p_data >= v_corte and p_data <= v_hoje;
end $$;
revoke all on function public.caixa_mov_visivel(smallint, date) from public, anon;
grant execute on function public.caixa_mov_visivel(smallint, date) to authenticated;

drop policy if exists mov_read on public.caixa_movimentos;
create policy mov_read on public.caixa_movimentos for select to authenticated
  using (
    (select public.caixa_acesso())
    and (select public.caixa_mov_visivel(caixa_id, data))
    and (caixa_id <> all (((select public.caixas_ocultas()))::smallint[]))
  );

do $$ begin
  if to_regclass('public.caixa_sessoes') is not null then
    execute 'drop policy if exists sessoes_read on public.caixa_sessoes';
    execute $p$create policy sessoes_read on public.caixa_sessoes for select to authenticated
      using (
        (select public.caixa_acesso())
        and (select public.caixa_mov_visivel(caixa_id, data))
        and (caixa_id <> all (((select public.caixas_ocultas()))::smallint[]))
      )$p$;
    execute 'revoke select on table public.caixa_sessoes from authenticated';
    execute 'grant select (id, caixa_id, data, abertura_valor, aberto_por, aberto_em, fechamento_contado, fechado_por, fechado_em, obs) on table public.caixa_sessoes to authenticated';
  end if;
end $$;

-- Saldo da view: admin vê o acumulado (RLS deixa todas as linhas). Financeiro recebe NULL
-- no saldo, porque a soma das linhas visíveis não é o saldo e o saldo real vazaria o período oculto.
do $$ begin
  if to_regclass('public.v_caixa_saldo') is not null then
    execute $v$
      create or replace view public.v_caixa_saldo with (security_invoker = true) as
      select c.id as caixa_id, c.nome, c.metodo,
             case when public.has_perm('admin') then coalesce(sum(case when m.tipo in ('venda','entrada') then m.valor else -m.valor end), 0) end as saldo,
             coalesce(sum(case when m.data = (now() at time zone 'America/Sao_Paulo')::date then case when m.tipo in ('venda','entrada') then m.valor else -m.valor end end), 0) as movimento_hoje,
             coalesce(sum(case when m.tipo in ('venda','entrada') then m.valor else -m.valor end), 0) as movimento_visivel,
             c.somente_admin
        from public.caixas c
        left join public.caixa_movimentos m on m.caixa_id = c.id
       where c.ativo
       group by c.id, c.nome, c.metodo, c.somente_admin
    $v$;
    execute 'alter view public.v_caixa_saldo set (security_invoker = true)';
    execute 'revoke all on public.v_caixa_saldo from anon, public';
    execute 'grant select on public.v_caixa_saldo to authenticated';
  end if;
  if to_regclass('public.v_caixa_extrato') is not null then
    execute 'alter view public.v_caixa_extrato set (security_invoker = true)';
  end if;
end $$;

create or replace function public.caixa_fin_janela()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_desde date := v_hoje - 2;
  g record;
begin
  if not public.caixa_acesso() then
    raise exception 'Sem permissão de caixa' using errcode = '42501';
  end if;
  if public.has_perm('admin') then
    return jsonb_build_object('ilimitado', true, 'mostra_saldo', true, 'hoje', v_hoje, 'desde', null, 'rotulo', 'tudo');
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
    'ilimitado', false, 'mostra_saldo', false, 'hoje', v_hoje, 'desde', v_desde,
    'rotulo', case when v_desde = v_hoje - 2 then 'últimos 3 dias' else 'período liberado' end);
end $$;

create or replace function public.caixa_fin_lista()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  if not (select public.can('admin')) then
    raise exception 'Somente admin' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', h.id, 'caixa_id', h.caixa_id,
           'caixa', case when h.caixa_id is null then 'Todos os caixas do financeiro' else c.nome end,
           'desde', h.desde, 'dias', h.dias, 'expira_em', h.expira_em,
           'ativo', h.ativo and h.revogado_em is null and (h.expira_em is null or h.expira_em > now()),
           'criado_em', h.criado_em
         ) order by h.id desc), '[]'::jsonb) into r
    from public.caixa_fin_historico h
    left join public.caixas c on c.id = h.caixa_id
   where h.revogado_em is null;
  return r;
end $$;

create or replace function public.caixa_fin_liberar(p_caixa smallint, p_desde date, p_dias integer, p_expira timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id bigint; v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not (select public.can('admin')) then
    raise exception 'Somente admin' using errcode = '42501';
  end if;
  if p_caixa is not null and not exists (select 1 from public.caixas c where c.id = p_caixa and not c.somente_admin) then
    raise exception 'Caixa inválido para o financeiro' using errcode = 'P0001';
  end if;
  if (p_desde is null) = (p_dias is null) then
    raise exception 'Informe a data inicial ou o número de dias' using errcode = 'P0001';
  end if;
  if p_dias is not null and p_dias < 3 then
    raise exception 'A liberação só alarga a janela (mínimo 3 dias)' using errcode = 'P0001';
  end if;
  if p_desde is not null and p_desde > v_hoje then
    raise exception 'A data inicial não pode ser no futuro' using errcode = 'P0001';
  end if;
  if p_expira is not null and p_expira <= now() then
    raise exception 'A validade já passou' using errcode = 'P0001';
  end if;
  insert into public.caixa_fin_historico(caixa_id, desde, dias, expira_em, criado_por)
  values (p_caixa, p_desde, p_dias, p_expira, auth.uid())
  returning id into v_id;
  if to_regclass('public.security_events') is not null then
    begin
      insert into public.security_events(kind, actor, detail)
      values ('fin_alteracao', auth.uid(), jsonb_build_object(
        'op', 'caixa_fin_liberar', 'id', v_id, 'caixa_id', p_caixa, 'desde', p_desde, 'dias', p_dias, 'expira_em', p_expira));
    exception when others then null;
    end;
  end if;
  return jsonb_build_object('id', v_id, 'caixa_id', p_caixa, 'desde', p_desde, 'dias', p_dias, 'expira_em', p_expira);
end $$;

create or replace function public.caixa_fin_revogar(p_id bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare h public.caixa_fin_historico%rowtype;
begin
  if not (select public.can('admin')) then
    raise exception 'Somente admin' using errcode = '42501';
  end if;
  select * into h from public.caixa_fin_historico where id = p_id;
  if not found then raise exception 'Liberação não encontrada' using errcode = 'P0001'; end if;
  if h.revogado_em is not null or not h.ativo then
    return jsonb_build_object('id', h.id, 'ja_revogado', true);
  end if;
  update public.caixa_fin_historico
     set ativo = false, revogado_em = now(), revogado_por = auth.uid()
   where id = h.id;
  if to_regclass('public.security_events') is not null then
    begin
      insert into public.security_events(kind, actor, detail)
      values ('fin_alteracao', auth.uid(), jsonb_build_object('op', 'caixa_fin_revogar', 'id', h.id, 'caixa_id', h.caixa_id));
    exception when others then null;
    end;
  end if;
  return jsonb_build_object('id', h.id, 'revogado', true);
end $$;

revoke all on function public.caixa_fin_janela(), public.caixa_fin_lista(),
  public.caixa_fin_liberar(smallint, date, integer, timestamptz),
  public.caixa_fin_revogar(bigint) from public, anon;
grant execute on function public.caixa_fin_janela(), public.caixa_fin_lista(),
  public.caixa_fin_liberar(smallint, date, integer, timestamptz),
  public.caixa_fin_revogar(bigint) to authenticated;

create or replace function public.caixa_sessoes_dia(p_data date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r jsonb; v_admin boolean := public.has_perm('admin');
begin
  if not public.caixa_acesso() then
    raise exception 'Sem permissão de caixa' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s.id, 'caixa_id', s.caixa_id, 'data', s.data,
           'abertura_valor', s.abertura_valor, 'aberto_por', s.aberto_por, 'aberto_em', s.aberto_em,
           'fechamento_contado', s.fechamento_contado, 'fechado_por', s.fechado_por, 'fechado_em', s.fechado_em,
           'obs', s.obs,
           'abertura_sistema', case when v_admin then s.abertura_sistema end,
           'fechamento_sistema', case when v_admin then s.fechamento_sistema end,
           'diferenca', case when v_admin then s.diferenca end
         ) order by s.caixa_id), '[]'::jsonb) into r
    from public.caixa_sessoes s
   where s.data = p_data and public.caixa_mov_visivel(s.caixa_id, s.data);
  return r;
end $$;
revoke all on function public.caixa_sessoes_dia(date) from public, anon;
grant execute on function public.caixa_sessoes_dia(date) to authenticated;

-- Resumo do dia: financeiro não recebe saldo inicial/final (eles incluem dias ocultos).
create or replace function public.caixa_resumo(p_caixa smallint, p_data date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v jsonb; v_ini numeric; v_fim numeric; v_admin boolean := public.has_perm('admin');
begin
  if not (public.caixa_acesso() and (public.has_perm('admin') or public.has_perm('financas'))) then
    raise exception 'Sem permissão (admin/financeiro)' using errcode = '42501'; end if;
  if not public.caixa_permitido(p_caixa) then raise exception 'Caixa inválido' using errcode = '42501'; end if;
  if not public.caixa_mov_visivel(p_caixa, p_data) then
    raise exception 'Extrato fora da janela do financeiro' using errcode = '42501'; end if;
  if not v_admin then
    v_ini := null; v_fim := null;
  elsif public.caixa_hx_restrito(p_caixa) then
    v_ini := 0;
  else
    select coalesce(sum(case when tipo in ('venda','entrada') then valor else -valor end), 0) into v_ini
      from public.caixa_movimentos where caixa_id = p_caixa and data < p_data;
  end if;
  if v_admin then
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

select 'compras-pagamento-admin draft' as status;
