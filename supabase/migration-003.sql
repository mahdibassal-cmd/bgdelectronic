-- migration-003: Estoque somente leitura para vendedores (sem custo). Idempotente.
-- Lê apenas public.products (que vendedores já podem ler via RLS products_read); nenhuma coluna de custo/preço de compra.
-- Nenhuma policy existente é alterada; product_costs/purchases/sale_costs continuam só admin.
create or replace view public.estoque_vendedor with (security_invoker = true) as
  select p.sku, p.marca, p.produto, p.tamanho, p.estoque
  from public.products p
  where p.ativo and public.mfa_ok() and public.is_active_staff();
revoke all on public.estoque_vendedor from public, anon;
grant select on public.estoque_vendedor to authenticated;
