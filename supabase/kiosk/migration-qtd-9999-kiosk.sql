-- Permite qtd por linha de venda de 1 a 9999 (antes 1..50). Estoque continua validado pelas funções.
begin;
alter table public.sales drop constraint if exists sales_qtd_check;
alter table public.sales add constraint sales_qtd_check check (qtd > 0 and qtd <= 9999);
commit;
