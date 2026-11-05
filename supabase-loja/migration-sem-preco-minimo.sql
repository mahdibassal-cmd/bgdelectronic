-- BAGDA LOJA — sem preço mínimo de venda (MB 05/11). NÃO rodar sem o "yes" do MB. Idempotente.
-- Único piso de preço no banco: sales.preco_vendido > 0 (schema.sql). Passa a aceitar >= 0 (R$ 0,00 permitido, ex.: brinde).
-- Nenhuma função muda: criar_nota/criar_nota_local (versões vivas: migration-caixa-geral / migration-local-pagamento-opcional)
-- não comparam com custo nem com preco_venda, não têm desconto máximo, aprovação, nem pagamento/compra mínima.
-- Mantido: estoque_minimo (alerta de reposição); pagamentos > 0 e soma = total; qtd 1..50 por linha.
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
