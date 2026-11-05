-- Permite qtd por linha de venda de sem limite, so > 0 (antes 1..50). Estoque continua validado pelas funções.
begin;
alter table public.sales drop constraint if exists sales_qtd_check;
alter table public.sales add constraint sales_qtd_check check (qtd > 0);
commit;
