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
