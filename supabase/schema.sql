-- =====================================================================
-- BAGDA PERFUMES — Sistema da Loja (Supabase / Postgres)
-- Rode inteiro no SQL Editor do Supabase. Idempotente onde possível.
-- Espelha a planilha: Produtos, Compras, Vendas, Relatório Diário, Vendedores, Config.
-- Segurança: RLS em TODAS as tabelas; custo só para admin; vendedor só vê as próprias vendas.
-- =====================================================================

-- ---------- Tipos ----------
do $$ begin
  create type public.app_role as enum ('admin','seller');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.pay_method as enum ('Débito','Crédito','Dinheiro','PIX');
exception when duplicate_object then null; end $$;

-- ---------- Perfis (Vendedores) ----------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  handle     text unique not null check (handle ~ '^@[a-z0-9_]{2,20}$'),
  nome       text not null,
  role       public.app_role not null default 'seller',
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- Produtos (sem custo) ----------
create table if not exists public.products (
  sku            text primary key check (sku ~ '^[A-Z0-9-]{3,20}$'),
  marca          text not null,
  produto        text not null,
  tamanho        text,
  fornecedor     text,
  preco_venda    numeric(10,2) not null check (preco_venda >= 0),
  estoque        integer not null default 0 check (estoque >= 0),
  estoque_minimo integer not null default 2 check (estoque_minimo >= 0),
  notas          text,
  ativo          boolean not null default true,
  updated_at     timestamptz not null default now()
);

-- ---------- Custos (tabela separada => vendedor nunca lê) ----------
create table if not exists public.product_costs (
  sku   text primary key references public.products(sku) on update cascade on delete cascade,
  custo numeric(10,2) not null check (custo >= 0),
  updated_at timestamptz not null default now()
);

-- ---------- Compras (admin) ----------
create table if not exists public.purchases (
  id          bigint generated always as identity primary key,
  data        date not null default (now() at time zone 'America/Sao_Paulo')::date,
  sku         text not null references public.products(sku) on update cascade,
  fornecedor  text,
  qtd         integer not null check (qtd > 0),
  custo_unit  numeric(10,2) not null check (custo_unit >= 0),
  total       numeric(12,2) generated always as (qtd * custo_unit) stored,
  observacao  text,
  created_by  uuid not null default auth.uid() references auth.users(id),
  created_at  timestamptz not null default now()
);

-- ---------- Vendas ----------
create table if not exists public.sales (
  id              bigint generated always as identity primary key,
  data            date not null default (now() at time zone 'America/Sao_Paulo')::date,
  sku             text not null references public.products(sku) on update cascade,
  qtd             integer not null check (qtd > 0 and qtd <= 9999),
  preco_tabela    numeric(10,2),                       -- preenchido pelo trigger
  preco_vendido   numeric(10,2) not null check (preco_vendido > 0),  -- OBRIGATÓRIO, vendedor digita
  forma_pagamento public.pay_method not null,
  seller_id       uuid not null default auth.uid() references public.profiles(id),
  total           numeric(12,2) generated always as (qtd * preco_vendido) stored,
  observacao      text check (length(observacao) <= 300),
  created_at      timestamptz not null default now()
);
create index if not exists sales_data_idx   on public.sales(data);
create index if not exists sales_seller_idx on public.sales(seller_id);

-- custo no momento da venda (admin only)
create table if not exists public.sale_costs (
  sale_id    bigint primary key references public.sales(id) on delete cascade,
  custo_unit numeric(10,2) not null default 0
);

-- ---------- Helpers (security definer, search_path vazio, só leitura) ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.role = 'admin' and p.ativo);
$$;

create or replace function public.is_active_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.ativo);
$$;

-- Se o usuário ativou 2FA, exige sessão aal2 (código TOTP) para acessar dados.
create or replace function public.mfa_ok() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt()->>'aal','') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f
                     where f.user_id = auth.uid() and f.status = 'verified');
$$;

revoke all on function public.is_admin(), public.is_active_staff(), public.mfa_ok() from public, anon;
grant execute on function public.is_admin(), public.is_active_staff(), public.mfa_ok() to authenticated;

-- ---------- Triggers ----------
-- Venda: valida estoque, grava preço de tabela e custo, baixa o estoque (atômico).
create or replace function public.tg_sale_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_preco numeric; v_custo numeric;
begin
  if not public.is_admin() then
    new.seller_id := auth.uid();                       -- vendedor não pode lançar em nome de outro
    new.data := (now() at time zone 'America/Sao_Paulo')::date;  -- nem retroagir data
  end if;
  update public.products set estoque = estoque - new.qtd, updated_at = now()
   where sku = new.sku and ativo and estoque >= new.qtd
  returning preco_venda into v_preco;
  if not found then
    raise exception 'Estoque insuficiente ou produto inativo (%)', new.sku using errcode = 'P0001';
  end if;
  new.preco_tabela := v_preco;
  return new;
end $$;

create or replace function public.tg_sale_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.sale_costs(sale_id, custo_unit)
  values (new.id, coalesce((select custo from public.product_costs where sku = new.sku), 0));
  return null;
end $$;

-- Admin apaga venda => devolve estoque.
create or replace function public.tg_sale_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.products set estoque = estoque + old.qtd, updated_at = now() where sku = old.sku;
  return old;
end $$;

-- Compra: soma estoque e atualiza custo atual.
create or replace function public.tg_purchase_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.products set estoque = estoque + new.qtd, updated_at = now() where sku = new.sku;
  insert into public.product_costs(sku, custo) values (new.sku, new.custo_unit)
  on conflict (sku) do update set custo = excluded.custo, updated_at = now();
  return null;
end $$;

create or replace function public.tg_purchase_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.products set estoque = greatest(estoque - old.qtd, 0), updated_at = now() where sku = old.sku;
  return old;
end $$;

revoke all on function public.tg_sale_insert(), public.tg_sale_after_insert(), public.tg_sale_delete(),
  public.tg_purchase_insert(), public.tg_purchase_delete() from public, anon, authenticated;

drop trigger if exists sale_bi on public.sales;
create trigger sale_bi before insert on public.sales for each row execute function public.tg_sale_insert();
drop trigger if exists sale_ai on public.sales;
create trigger sale_ai after insert on public.sales for each row execute function public.tg_sale_after_insert();
drop trigger if exists sale_bd on public.sales;
create trigger sale_bd before delete on public.sales for each row execute function public.tg_sale_delete();
drop trigger if exists purchase_ai on public.purchases;
create trigger purchase_ai after insert on public.purchases for each row execute function public.tg_purchase_insert();
drop trigger if exists purchase_bd on public.purchases;
create trigger purchase_bd before delete on public.purchases for each row execute function public.tg_purchase_delete();

-- ---------- RLS ----------
alter table public.profiles      enable row level security;
alter table public.products      enable row level security;
alter table public.product_costs enable row level security;
alter table public.purchases     enable row level security;
alter table public.sales         enable row level security;
alter table public.sale_costs    enable row level security;
alter table public.profiles      force row level security;
alter table public.products      force row level security;
alter table public.product_costs force row level security;
alter table public.purchases     force row level security;
alter table public.sales         force row level security;
alter table public.sale_costs    force row level security;

-- Nada para anon (visitante não logado).
revoke all on public.profiles, public.products, public.product_costs,
              public.purchases, public.sales, public.sale_costs from anon;
-- Privilégios mínimos para logados (RLS filtra as linhas).
revoke all on public.profiles, public.products, public.product_costs,
              public.purchases, public.sales, public.sale_costs from authenticated;
grant select on public.profiles to authenticated;
grant update (nome, handle, role, ativo) on public.profiles to authenticated;   -- policy: só admin
grant select, insert, update, delete on public.products, public.product_costs, public.purchases to authenticated;
grant select, insert, delete on public.sales to authenticated;
grant select on public.sale_costs to authenticated;

-- profiles
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (public.mfa_ok() and (id = auth.uid() or public.is_admin()));
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles for update to authenticated
  using (public.mfa_ok() and public.is_admin()) with check (public.is_admin());

-- products: equipe ativa lê; só admin escreve
drop policy if exists products_read on public.products;
create policy products_read on public.products for select to authenticated
  using (public.mfa_ok() and public.is_active_staff());
drop policy if exists products_admin_all on public.products;
create policy products_admin_all on public.products for all to authenticated
  using (public.mfa_ok() and public.is_admin()) with check (public.mfa_ok() and public.is_admin());

-- custos / compras / custo da venda: só admin
drop policy if exists costs_admin on public.product_costs;
create policy costs_admin on public.product_costs for all to authenticated
  using (public.mfa_ok() and public.is_admin()) with check (public.mfa_ok() and public.is_admin());
drop policy if exists purchases_admin on public.purchases;
create policy purchases_admin on public.purchases for all to authenticated
  using (public.mfa_ok() and public.is_admin()) with check (public.mfa_ok() and public.is_admin());
drop policy if exists sale_costs_admin on public.sale_costs;
create policy sale_costs_admin on public.sale_costs for select to authenticated
  using (public.mfa_ok() and public.is_admin());

-- sales: vendedor vê e lança só as próprias; não edita; admin tudo (inclusive apagar)
drop policy if exists sales_read on public.sales;
create policy sales_read on public.sales for select to authenticated
  using (public.mfa_ok() and (seller_id = auth.uid() or public.is_admin()));
drop policy if exists sales_insert on public.sales;
create policy sales_insert on public.sales for insert to authenticated
  with check (public.mfa_ok() and public.is_active_staff() and (seller_id = auth.uid() or public.is_admin()));
drop policy if exists sales_admin_delete on public.sales;
create policy sales_admin_delete on public.sales for delete to authenticated
  using (public.mfa_ok() and public.is_admin());

-- ---------- Views (security_invoker => respeitam RLS de quem consulta) ----------
create or replace view public.v_sales with (security_invoker = true) as
select s.id, s.data, s.sku, p.marca, p.produto, s.qtd, s.preco_tabela, s.preco_vendido,
       s.total, s.forma_pagamento, pr.handle, pr.nome, s.created_at,
       case when s.preco_vendido < s.preco_tabela then 'Abaixo da tabela' end as aviso
from public.sales s
join public.products p on p.sku = s.sku
left join public.profiles pr on pr.id = s.seller_id;

create or replace view public.v_report_seller with (security_invoker = true) as
select s.data, pr.handle, pr.nome, count(*) as vendas, sum(s.qtd) as itens, sum(s.total) as faturamento
from public.sales s left join public.profiles pr on pr.id = s.seller_id
group by s.data, pr.handle, pr.nome;

create or replace view public.v_report_payment with (security_invoker = true) as
select s.data, s.forma_pagamento, count(*) as vendas, sum(s.qtd) as itens, sum(s.total) as faturamento
from public.sales s group by s.data, s.forma_pagamento;

-- Lucro: inner join com sale_costs => vendedor recebe 0 linhas (RLS), admin vê tudo.
create or replace view public.v_report_profit with (security_invoker = true) as
select s.data, pr.handle, sum(s.total) as faturamento, sum(s.qtd * c.custo_unit) as custo,
       sum(s.total - s.qtd * c.custo_unit) as lucro
from public.sales s join public.sale_costs c on c.sale_id = s.id
left join public.profiles pr on pr.id = s.seller_id
group by s.data, pr.handle;

create or replace view public.v_low_stock with (security_invoker = true) as
select sku, marca, produto, estoque, estoque_minimo from public.products
where ativo and estoque <= estoque_minimo;

revoke all on public.v_sales, public.v_report_seller, public.v_report_payment,
              public.v_report_profit, public.v_low_stock from anon;
grant select on public.v_sales, public.v_report_seller, public.v_report_payment,
              public.v_report_profit, public.v_low_stock to authenticated;


-- =====================================================================
-- Estado final: inclui a migração 002 (notas/recibos, relatórios e custo só admin)
-- =====================================================================
-- =====================================================================
-- Migração 002 — Notas (recibos) + admin-only para custo/relatórios/export
-- Seguro para rodar DEPOIS do schema.sql antigo e seguro para rodar de novo.
-- =====================================================================

-- ---------- Notas (cabeçalho do recibo) ----------
create table if not exists public.notas (
  id              bigint generated always as identity primary key,
  data            date not null default (now() at time zone 'America/Sao_Paulo')::date,
  seller_id       uuid not null default auth.uid() references public.profiles(id),
  forma_pagamento public.pay_method not null,
  cliente         text check (length(cliente) <= 120),
  created_at      timestamptz not null default now()
);
alter table public.sales add column if not exists nota_id bigint references public.notas(id) on delete cascade;
create index if not exists sales_nota_idx on public.sales(nota_id);
create index if not exists notas_seller_idx on public.notas(seller_id);

-- Vendedor não pode forjar seller/data da nota.
create or replace function public.tg_nota_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    new.seller_id := auth.uid();
    new.data := (now() at time zone 'America/Sao_Paulo')::date;
  end if;
  return new;
end $$;
revoke all on function public.tg_nota_insert() from public, anon, authenticated;
drop trigger if exists nota_bi on public.notas;
create trigger nota_bi before insert on public.notas for each row execute function public.tg_nota_insert();

-- Item tem que pertencer a uma nota do próprio vendedor e usar o mesmo pagamento.
create or replace function public.tg_sale_nota_check() returns trigger
language plpgsql security definer set search_path = '' as $$
declare n record;
begin
  if new.nota_id is not null then
    select seller_id, forma_pagamento into n from public.notas where id = new.nota_id;
    if not found or (n.seller_id <> new.seller_id) then
      raise exception 'Nota inválida' using errcode = 'P0001';
    end if;
    new.forma_pagamento := n.forma_pagamento;
  end if;
  return new;
end $$;
revoke all on function public.tg_sale_nota_check() from public, anon, authenticated;
-- roda depois de sale_bi (ordem alfabética: sale_bi < sale_bj)
drop trigger if exists sale_bj on public.sales;
create trigger sale_bj before insert on public.sales for each row execute function public.tg_sale_nota_check();

alter table public.notas enable row level security;
alter table public.notas force row level security;
revoke all on public.notas from anon, authenticated;
grant select, insert on public.notas to authenticated;
grant delete on public.notas to authenticated;   -- policy: só admin

drop policy if exists notas_read on public.notas;
create policy notas_read on public.notas for select to authenticated
  using (public.mfa_ok() and (seller_id = auth.uid() or public.is_admin()));
drop policy if exists notas_insert on public.notas;
create policy notas_insert on public.notas for insert to authenticated
  with check (public.mfa_ok() and public.is_active_staff() and (seller_id = auth.uid() or public.is_admin()));
drop policy if exists notas_admin_delete on public.notas;
create policy notas_admin_delete on public.notas for delete to authenticated
  using (public.mfa_ok() and public.is_admin());

-- ---------- Criar nota atômica (security INVOKER: RLS e triggers valem) ----------
-- p_items: [{"sku":"ARM-001","qtd":1,"preco_vendido":280}, ...]
create or replace function public.criar_nota(p_forma public.pay_method, p_items jsonb, p_cliente text default null)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare v_id bigint; it jsonb;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 30 then
    raise exception 'Nota sem itens' using errcode = 'P0001';
  end if;
  insert into public.notas(forma_pagamento, cliente) values (p_forma, nullif(trim(p_cliente), ''))
  returning id into v_id;
  for it in select * from jsonb_array_elements(p_items) loop
    insert into public.sales(nota_id, sku, qtd, preco_vendido, forma_pagamento)
    values (v_id, it->>'sku', (it->>'qtd')::int, (it->>'preco_vendido')::numeric, p_forma);
  end loop;
  return v_id;
end $$;
revoke all on function public.criar_nota(public.pay_method, jsonb, text) from public, anon;
grant execute on function public.criar_nota(public.pay_method, jsonb, text) to authenticated;

-- ---------- Custo: continua SOMENTE em product_costs / sale_costs / purchases ----------
-- products não tem nenhuma coluna de custo. As tabelas de custo têm RLS admin-only
-- (vendedor recebe 0 linhas mesmo chamando a API direto) e nenhuma grant para anon.
revoke all on public.product_costs, public.sale_costs, public.purchases from anon, public;

-- ---------- Views ----------
-- Recibo: vendedor vê só as próprias notas (RLS de notas/sales).
drop view if exists public.v_nota_itens;
create view public.v_nota_itens with (security_invoker = true) as
select n.id as nota_id, n.data, n.created_at, n.forma_pagamento, n.cliente, pr.handle, pr.nome,
       s.sku, p.marca, p.produto, p.tamanho, s.qtd, s.preco_vendido, s.total
from public.notas n
join public.sales s on s.nota_id = n.id
join public.products p on p.sku = s.sku
left join public.profiles pr on pr.id = n.seller_id;

-- Relatórios: só admin (vendedor recebe 0 linhas).
create or replace view public.v_report_seller with (security_invoker = true) as
select s.data, pr.handle, pr.nome, count(*) as vendas, sum(s.qtd) as itens, sum(s.total) as faturamento
from public.sales s left join public.profiles pr on pr.id = s.seller_id
where public.is_admin()
group by s.data, pr.handle, pr.nome;

create or replace view public.v_report_payment with (security_invoker = true) as
select s.data, s.forma_pagamento, count(*) as vendas, sum(s.qtd) as itens, sum(s.total) as faturamento
from public.sales s where public.is_admin()
group by s.data, s.forma_pagamento;

create or replace view public.v_low_stock with (security_invoker = true) as
select sku, marca, produto, estoque, estoque_minimo from public.products
where ativo and estoque <= estoque_minimo and public.is_admin();

-- Export admin: produtos + custo (vendedor: 0 linhas e sem permissão nas colunas).
drop view if exists public.v_admin_products;
create view public.v_admin_products with (security_invoker = true) as
select p.sku, p.marca, p.produto, p.tamanho, p.fornecedor, c.custo, p.preco_venda,
       case when c.custo > 0 and p.preco_venda > 0 then round((p.preco_venda - c.custo) / p.preco_venda * 100, 1) end as margem_pct,
       p.estoque, p.estoque_minimo, p.ativo, p.notas
from public.products p left join public.product_costs c on c.sku = p.sku
where public.is_admin() and public.mfa_ok();
revoke all on public.v_nota_itens, public.v_admin_products from anon, public;
grant select on public.v_nota_itens, public.v_admin_products, public.v_report_seller,
              public.v_report_payment, public.v_low_stock to authenticated;

-- ---------- migration-003: estoque somente leitura para vendedores ----------
-- Nenhuma policy existente é alterada; product_costs/purchases/sale_costs continuam só admin.
create or replace view public.estoque_vendedor with (security_invoker = true) as
  select p.sku, p.marca, p.produto, p.tamanho, p.estoque
  from public.products p
  where p.ativo and public.mfa_ok() and public.is_active_staff();
revoke all on public.estoque_vendedor from public, anon;
grant select on public.estoque_vendedor to authenticated;
