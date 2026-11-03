-- registrar_compra_lote: compra com vários itens salva de uma vez (atômica).
-- Idempotente. Mantém RLS e o trigger purchase_ai (soma estoque / grava custo) — cada item vira 1 linha em purchases com o mesmo compra_lote.
-- NÃO rodar sem o "yes" do MB.
alter table public.purchases add column if not exists compra_lote uuid;
create index if not exists purchases_compra_lote_idx on public.purchases (compra_lote) where compra_lote is not null;

create or replace function public.registrar_compra_lote(p_header jsonb, p_itens jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_lote uuid := gen_random_uuid(); it jsonb; n int := 0; v_tot numeric := 0;
  v_forn text := nullif(btrim(regexp_replace(coalesce(p_header->>'fornecedor', ''), '\s+', ' ', 'g')), '');
  v_obs text := nullif(btrim(coalesce(p_header->>'observacao', '')), '');
  v_data date := coalesce(nullif(p_header->>'data', '')::date, (now() at time zone 'America/Sao_Paulo')::date);
begin
  if not (public.can('admin')) then raise exception 'Só admin registra compra' using errcode = '42501'; end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then raise exception 'Nenhum item' using errcode = 'P0001'; end if;
  if jsonb_array_length(p_itens) > 200 then raise exception 'Máximo 200 itens por compra' using errcode = 'P0001'; end if;
  if v_data > (now() at time zone 'America/Sao_Paulo')::date then raise exception 'Data no futuro' using errcode = 'P0001'; end if;
  if length(v_forn) > 120 or length(v_obs) > 500 then raise exception 'Fornecedor/observação longos demais' using errcode = 'P0001'; end if;
  for it in select * from jsonb_array_elements(p_itens) loop
    n := n + 1;
    if not exists (select 1 from public.products where sku = it->>'sku') then raise exception 'Item %: SKU % não existe', n, it->>'sku' using errcode = 'P0001'; end if;
    if coalesce((it->>'qtd')::int, 0) <= 0 then raise exception 'Item %: quantidade inválida', n using errcode = 'P0001'; end if;
    if coalesce((it->>'custo_unit')::numeric, -1) < 0 then raise exception 'Item %: custo inválido', n using errcode = 'P0001'; end if;
    insert into public.purchases (data, sku, fornecedor, qtd, custo_unit, observacao, compra_lote)
    values (v_data, it->>'sku', v_forn, (it->>'qtd')::int, round((it->>'custo_unit')::numeric, 2), v_obs, v_lote);
    v_tot := v_tot + (it->>'qtd')::int * round((it->>'custo_unit')::numeric, 2);
  end loop;
  if v_forn is not null and length(v_forn) >= 2 and not exists (select 1 from public.fornecedores f where lower(btrim(f.nome)) = lower(v_forn)) then
    insert into public.fornecedores (nome) values (v_forn);  -- cadastra p/ reuso
  end if;
  return jsonb_build_object('lote', v_lote, 'itens', n, 'total', v_tot);
end $$;
revoke all on function public.registrar_compra_lote(jsonb, jsonb) from public, anon;
grant execute on function public.registrar_compra_lote(jsonb, jsonb) to authenticated;
notify pgrst, 'reload schema';
select 'registrar_compra_lote ok' as status;
