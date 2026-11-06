-- =====================================================================
-- migration-compra-custo-obrigatorio.sql — Loja /main. Idempotente.
-- NÃO executar em produção sem autorização do MB.
--
-- Custo unitário da COMPRA (purchases.custo_unit), não câmbio.
-- Reaproveita o campo que já existe. Não cria outro. Não altera compras antigas
-- e não recalcula custo de produto a partir do histórico.
--
-- Quem registra compra hoje: só admin (registrar_compra_lote e RLS de purchases).
-- Financeiro e estoque consultam Compras & IMEI sem ver custo. Vendedor não entra.
-- Esta migration NÃO abre nem fecha papel: continua só admin.
--
-- Custo ausente, em branco ou inválido é recusado. Não vira 0.
-- Vírgula brasileira (1.234,56 e 12,50) é aceita. Zero continua válido
-- (a coluna já permite custo_unit >= 0; product_costs também aceita 0).
-- Rodar DEPOIS de migration-compras-imei.sql. Se aquele arquivo for rodado de novo,
-- rode este em seguida para não voltar a aceitar custo vazio.
-- =====================================================================

create or replace function public._compra_custo_unit(p jsonb, p_n integer)
returns numeric language plpgsql immutable set search_path = '' as $$
declare t text; n numeric;
begin
  if p is null or jsonb_typeof(p) = 'null' then
    raise exception 'Item %: informe o custo unitário', p_n using errcode = 'P0001';
  end if;
  if jsonb_typeof(p) = 'number' then
    t := p #>> '{}';
  elsif jsonb_typeof(p) = 'string' then
    t := btrim(p #>> '{}');
    t := regexp_replace(t, '^\s*R\$\s*', '', 'i');
    if t = '' then
      raise exception 'Item %: informe o custo unitário', p_n using errcode = 'P0001';
    end if;
    if position(',' in t) > 0 then
      t := replace(replace(t, '.', ''), ',', '.');
    end if;
  else
    raise exception 'Item %: custo inválido', p_n using errcode = 'P0001';
  end if;
  if t !~ '^[0-9]+(\.[0-9]+)?$' then
    raise exception 'Item %: custo inválido', p_n using errcode = 'P0001';
  end if;
  n := round(t::numeric, 2);
  if n < 0 or n > 99999999.99 then
    raise exception 'Item %: custo inválido', p_n using errcode = 'P0001';
  end if;
  return n;
end $$;
revoke all on function public._compra_custo_unit(jsonb, integer) from public, anon, authenticated;

-- Mesmo corpo de migration-compras-imei.sql, com o custo lido por _compra_custo_unit.
create or replace function public.registrar_compra_lote(p_header jsonb, p_itens jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_lote uuid := gen_random_uuid(); it jsonb; n int := 0; v_tot numeric := 0; v_cid bigint; v_custo numeric;
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
    v_custo := public._compra_custo_unit(it->'custo_unit', n);
    insert into public.purchases (data, sku, fornecedor, qtd, custo_unit, observacao, compra_lote)
    values (v_data, it->>'sku', v_forn, (it->>'qtd')::int, v_custo, v_obs, v_lote);
    v_tot := v_tot + (it->>'qtd')::int * v_custo;
  end loop;
  if v_forn is not null and length(v_forn) >= 2 and not exists (select 1 from public.fornecedores f where lower(btrim(f.nome)) = lower(v_forn)) then
    insert into public.fornecedores (nome) values (v_forn);
  end if;
  select id into v_cid from public.compras where lote = v_lote;
  return jsonb_build_object('lote', v_lote, 'itens', n, 'total', v_tot, 'compra_id', v_cid, 'numero', public.compra_numero(v_cid));
end $$;
revoke all on function public.registrar_compra_lote(jsonb, jsonb) from public, anon;
grant execute on function public.registrar_compra_lote(jsonb, jsonb) to authenticated;

notify pgrst, 'reload schema';
select 'compra custo obrigatorio ok' as status;
