-- Compra 03/11: 2x Club de Nuit Intense Man, custo R$ 155,00/un (bagda-loja).
-- RAW: https://raw.githubusercontent.com/mahdibassal-cmd/bgdelectronic/main/supabase-loja/compra-cdn-intense-2026-11-03.sql
-- Uma transação. O trigger purchase_ai soma o estoque (+2) e faz upsert em product_costs.
-- Não cria produto, não muda preço de venda, não mexe em outros perfumes.
begin;

drop table if exists _cdn_before;
create temp table _cdn_before as
select p.sku, p.marca, p.produto, p.estoque, c.custo
from public.products p left join public.product_costs c on c.sku = p.sku
where p.produto ilike '%club de nuit intense%'
  and (p.produto ~* '\m(man|men|homem)\M' or coalesce(p.tamanho,'') ~* '\m(man|men|homem)\M')
  and p.produto !~* '(woman|women|mulher|fuego)';

do $$
declare v_n int; v_sku text; v_admin uuid; v_list text;
begin
  select count(*), min(sku), string_agg(sku || ' = ' || produto, '; ') into v_n, v_sku, v_list from _cdn_before;
  if v_n <> 1 then
    select string_agg(sku || ' = ' || produto, '; ') into v_list from public.products where produto ilike '%club de nuit%';
    raise exception 'Esperado 1 produto Club de Nuit Intense Man, achei %. Candidatos: %', v_n, coalesce(v_list, '(nenhum)');
  end if;
  select id into v_admin from public.profiles where role = 'admin' and ativo
  order by (handle = '@mike') desc, created_at limit 1;
  if v_admin is null then raise exception 'Nenhum perfil admin ativo para created_by.'; end if;
  insert into public.purchases (sku, qtd, custo_unit, observacao, created_by)
  values (v_sku, 2, 155.00, 'Compra 03/11 Club de Nuit Intense Man (SQL)', v_admin);
end $$;

commit;

-- Resultado (antes/depois):
select b.produto, b.sku, b.estoque as estoque_antes, p.estoque as estoque_depois,
       b.custo as custo_antes, c.custo as custo_depois, p.preco_venda
from _cdn_before b join public.products p on p.sku = b.sku
left join public.product_costs c on c.sku = b.sku;
