-- BAGDA STORES (bagda-loja) — Depósito Especial (somente admin). Idempotente.
-- Rodar DEPOIS de migration-estornos.sql (mantém os 17 tipos de security_events e adiciona 3).
-- Estoque separado: NÃO mexe em products.estoque (estoque da loja), então Estoque, Nova nota, catálogo
-- e vendedor/financeiro nunca veem estas quantidades. Notas não vendem daqui: transfira para a loja antes.
--   dep_esp_entrada(sku, qtd, custo, motivo)       entrada (custo médio ponderado)
--   dep_esp_ajuste(sku, nova_qtd, motivo)          remover/ajustar (motivo obrigatório)
--   dep_esp_transferir(sku, qtd, direcao, motivo)  'para_loja' (especial -> loja) | 'da_loja' (loja -> especial)

-- ---------- Log: 17 tipos existentes + 3 novos ----------
do $$ begin
  if to_regclass('public.security_events') is not null then
    alter table public.security_events drop constraint if exists security_events_kind_check;
    alter table public.security_events add constraint security_events_kind_check check (kind in (
      'failed_login','role_change','admin_added','profile_added','profile_removed','lock','unlock','signout_all',
      'fin_pagamento','fin_recebimento','fin_alteracao',
      'credito_entrada','credito_uso','credito_excedente','nota_lancada',
      'estorno_recebimento','estorno_credito',
      'dep_esp_entrada','dep_esp_ajuste','dep_esp_transferencia'));
  end if;
end $$;

-- ---------- Tabelas ----------
create table if not exists public.deposito_especial (
  sku        text primary key references public.products(sku) on update cascade on delete restrict,
  qtd        integer not null default 0 check (qtd >= 0),
  custo      numeric(10,2) not null default 0 check (custo >= 0),
  updated_at timestamptz not null default now()
);
create table if not exists public.deposito_especial_mov (
  id         bigint generated always as identity primary key,
  sku        text not null references public.products(sku) on update cascade on delete restrict,
  tipo       text not null check (tipo in ('entrada','ajuste','para_loja','da_loja')),
  qtd        integer not null,            -- variação no Depósito Especial (+/-)
  qtd_antes  integer not null,
  qtd_depois integer not null,
  custo_unit numeric(10,2),
  motivo     text not null,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists dep_esp_mov_sku_idx on public.deposito_especial_mov(sku, id desc);

-- ---------- RLS: só admin lê; escrita só pelas funções ----------
do $$ declare t text; begin
  foreach t in array array['deposito_especial','deposito_especial_mov'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, public, authenticated', t);
  end loop;
end $$;
grant select on public.deposito_especial, public.deposito_especial_mov to authenticated;
drop policy if exists dep_esp_admin on public.deposito_especial;
create policy dep_esp_admin on public.deposito_especial for select to authenticated using (public.can('admin'));
drop policy if exists dep_esp_mov_admin on public.deposito_especial_mov;
create policy dep_esp_mov_admin on public.deposito_especial_mov for select to authenticated using (public.can('admin'));

-- ---------- Views (security_invoker => RLS acima vale) ----------
create or replace view public.v_deposito_especial with (security_invoker = true) as
select d.sku, p.marca, p.produto, p.tamanho, d.qtd, d.custo, round(d.qtd * d.custo, 2) as total, p.estoque as estoque_loja, d.updated_at
from public.deposito_especial d join public.products p on p.sku = d.sku
where public.can('admin');
create or replace view public.v_deposito_especial_mov with (security_invoker = true) as
select m.id, m.sku, p.marca, p.produto, m.tipo, m.qtd, m.qtd_antes, m.qtd_depois, m.custo_unit, m.motivo, pr.handle, m.created_at
from public.deposito_especial_mov m join public.products p on p.sku = m.sku
left join public.profiles pr on pr.id = m.created_by
where public.can('admin');
revoke all on public.v_deposito_especial, public.v_deposito_especial_mov from anon, public;
grant select on public.v_deposito_especial, public.v_deposito_especial_mov to authenticated;

-- ---------- Entrada ----------
create or replace function public.dep_esp_entrada(p_sku text, p_qtd integer, p_custo numeric, p_motivo text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_mot text := left(trim(coalesce(p_motivo, '')), 200); d record; v_new integer; v_custo numeric;
begin
  if not public.can('admin') then raise exception 'Somente admin' using errcode = '42501'; end if;
  if coalesce(p_qtd, 0) <= 0 then raise exception 'Quantidade deve ser maior que zero' using errcode = 'P0001'; end if;
  if p_custo is null or p_custo < 0 then raise exception 'Informe o custo unitário' using errcode = 'P0001'; end if;
  if v_mot = '' then v_mot := 'Entrada'; end if;
  perform 1 from public.products where sku = p_sku;
  if not found then raise exception 'Produto não encontrado (%)', p_sku using errcode = 'P0001'; end if;
  insert into public.deposito_especial(sku) values (p_sku) on conflict (sku) do nothing;
  select * into d from public.deposito_especial where sku = p_sku for update;
  v_new := d.qtd + p_qtd;
  v_custo := round((d.qtd * d.custo + p_qtd * p_custo) / v_new, 2);
  update public.deposito_especial set qtd = v_new, custo = v_custo, updated_at = now() where sku = p_sku;
  insert into public.deposito_especial_mov(sku, tipo, qtd, qtd_antes, qtd_depois, custo_unit, motivo)
  values (p_sku, 'entrada', p_qtd, d.qtd, v_new, p_custo, v_mot);
  insert into public.security_events(kind, actor, detail) values ('dep_esp_entrada', auth.uid(),
    jsonb_build_object('sku', p_sku, 'qtd', p_qtd, 'custo', p_custo, 'antes', d.qtd, 'depois', v_new, 'motivo', v_mot));
  return jsonb_build_object('sku', p_sku, 'qtd', v_new, 'custo', v_custo);
end $$;

-- ---------- Remover / ajustar ----------
create or replace function public.dep_esp_ajuste(p_sku text, p_nova integer, p_motivo text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_mot text := left(trim(coalesce(p_motivo, '')), 200); d record;
begin
  if not public.can('admin') then raise exception 'Somente admin' using errcode = '42501'; end if;
  if length(v_mot) < 3 then raise exception 'Informe o motivo' using errcode = 'P0001'; end if;
  if p_nova is null or p_nova < 0 then raise exception 'Quantidade inválida' using errcode = 'P0001'; end if;
  select * into d from public.deposito_especial where sku = p_sku for update;
  if d.sku is null then raise exception 'Produto não está no Depósito Especial' using errcode = 'P0001'; end if;
  if p_nova = d.qtd then return jsonb_build_object('sku', p_sku, 'qtd', d.qtd, 'sem_mudanca', true); end if;
  update public.deposito_especial set qtd = p_nova, updated_at = now() where sku = p_sku;
  insert into public.deposito_especial_mov(sku, tipo, qtd, qtd_antes, qtd_depois, custo_unit, motivo)
  values (p_sku, 'ajuste', p_nova - d.qtd, d.qtd, p_nova, d.custo, v_mot);
  insert into public.security_events(kind, actor, detail) values ('dep_esp_ajuste', auth.uid(),
    jsonb_build_object('sku', p_sku, 'antes', d.qtd, 'depois', p_nova, 'motivo', v_mot));
  return jsonb_build_object('sku', p_sku, 'qtd', p_nova);
end $$;

-- ---------- Transferir (especial <-> loja) ----------
create or replace function public.dep_esp_transferir(p_sku text, p_qtd integer, p_direcao text, p_motivo text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_mot text := left(trim(coalesce(p_motivo, '')), 200); d record; pr record; v_new integer; v_custo numeric; v_cl numeric;
begin
  if not public.can('admin') then raise exception 'Somente admin' using errcode = '42501'; end if;
  if coalesce(p_qtd, 0) <= 0 then raise exception 'Quantidade deve ser maior que zero' using errcode = 'P0001'; end if;
  if p_direcao not in ('para_loja','da_loja') then raise exception 'Direção inválida' using errcode = 'P0001'; end if;
  if v_mot = '' then v_mot := case when p_direcao = 'para_loja' then 'Transferência para a loja' else 'Transferência da loja' end; end if;
  select * into pr from public.products where sku = p_sku for update;
  if pr.sku is null then raise exception 'Produto não encontrado (%)', p_sku using errcode = 'P0001'; end if;
  insert into public.deposito_especial(sku) values (p_sku) on conflict (sku) do nothing;
  select * into d from public.deposito_especial where sku = p_sku for update;
  select custo into v_cl from public.product_costs where sku = p_sku;
  if p_direcao = 'para_loja' then
    if d.qtd < p_qtd then raise exception 'Depósito Especial só tem % un.', d.qtd using errcode = 'P0001'; end if;
    v_new := d.qtd - p_qtd; v_custo := d.custo;
    update public.deposito_especial set qtd = v_new, updated_at = now() where sku = p_sku;
    update public.products set estoque = estoque + p_qtd, updated_at = now() where sku = p_sku;
    -- custo da loja: se não tinha, usa o do especial; senão média ponderada
    insert into public.product_costs(sku, custo) values (p_sku, d.custo)
    on conflict (sku) do update set custo = round((greatest(pr.estoque, 0) * public.product_costs.custo + p_qtd * d.custo) / (greatest(pr.estoque, 0) + p_qtd), 2), updated_at = now();
  else
    if pr.estoque < p_qtd then raise exception 'Loja só tem % un.', pr.estoque using errcode = 'P0001'; end if;
    v_new := d.qtd + p_qtd; v_custo := round((d.qtd * d.custo + p_qtd * coalesce(v_cl, d.custo)) / v_new, 2);
    update public.products set estoque = estoque - p_qtd, updated_at = now() where sku = p_sku;
    update public.deposito_especial set qtd = v_new, custo = v_custo, updated_at = now() where sku = p_sku;
  end if;
  insert into public.deposito_especial_mov(sku, tipo, qtd, qtd_antes, qtd_depois, custo_unit, motivo)
  values (p_sku, p_direcao, case when p_direcao = 'para_loja' then -p_qtd else p_qtd end, d.qtd, v_new,
          case when p_direcao = 'para_loja' then d.custo else coalesce(v_cl, d.custo) end, v_mot);
  insert into public.security_events(kind, actor, detail) values ('dep_esp_transferencia', auth.uid(),
    jsonb_build_object('sku', p_sku, 'qtd', p_qtd, 'direcao', p_direcao, 'especial_antes', d.qtd, 'especial_depois', v_new,
                       'loja_antes', pr.estoque, 'loja_depois', pr.estoque + case when p_direcao = 'para_loja' then p_qtd else -p_qtd end, 'motivo', v_mot));
  return jsonb_build_object('sku', p_sku, 'especial', v_new, 'loja', pr.estoque + case when p_direcao = 'para_loja' then p_qtd else -p_qtd end);
end $$;

revoke all on function public.dep_esp_entrada(text, integer, numeric, text), public.dep_esp_ajuste(text, integer, text),
  public.dep_esp_transferir(text, integer, text, text) from public, anon;
grant execute on function public.dep_esp_entrada(text, integer, numeric, text), public.dep_esp_ajuste(text, integer, text),
  public.dep_esp_transferir(text, integer, text, text) to authenticated;

select 'deposito_especial ok' as status;
