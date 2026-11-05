-- BAGDA KIOSK DB (Supabase project zoapljfhebbvbsrebtjt) — NÃO é a loja. Sem preço mínimo de venda (MB 05/11).
-- NÃO rodar sem o "yes" do MB. Idempotente. Único piso: sales.preco_vendido > 0 (supabase/schema.sql:69) -> passa a >= 0.
-- Mantido: qtd 1..50; a coluna informativa 'Abaixo da tabela' nos relatórios (só rótulo, não bloqueia).
begin;
do $$ declare c text; begin
  for c in select conname from pg_constraint where conrelid = 'public.sales'::regclass and contype = 'c'
           and pg_get_constraintdef(oid) ~ 'preco_vendido > ' loop
    execute format('alter table public.sales drop constraint %I', c);
  end loop;
end $$;
alter table public.sales drop constraint if exists sales_preco_vendido_nao_negativo;
alter table public.sales add constraint sales_preco_vendido_nao_negativo check (preco_vendido >= 0);
commit;
select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.sales'::regclass and contype = 'c' order by 1;
