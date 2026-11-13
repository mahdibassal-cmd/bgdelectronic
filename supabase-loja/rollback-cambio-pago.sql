-- Rollback de migration-cambio-pago.sql. Não rodar em produção até o dono (MB) dizer.
-- Devolve a cotação, o custo e o pagamento ao comportamento de
-- migration-origem-dolar.sql + migration-compras-pagamento.sql + migration-compras-pagamento-admin.sql.
-- Não mexe em notas, sale_costs nem no saldo dos caixas já lançados.
-- Rodar este arquivo inteiro. Apaga cambio_pago, data_pagamento e pagar_em.

create or replace function public.tg_purchase_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_custo numeric := new.custo_unit; v_global numeric;
begin
  update public.products set estoque = estoque + new.qtd, updated_at = now() where sku = new.sku;
  if new.origem = 'Importado' and new.custo_usd is not null then
    v_global := public.cotacao_dolar_valor();
    if v_global is null then
      raise exception 'Defina a cotação do dólar antes de lançar produto importado' using errcode = 'P0001';
    end if;
    v_custo := round(new.custo_usd * v_global, 2);
  end if;
  insert into public.product_costs(sku, custo, custo_usd)
  values (new.sku, v_custo, new.custo_usd)
  on conflict (sku) do update set
    custo = excluded.custo,
    custo_usd = coalesce(excluded.custo_usd, public.product_costs.custo_usd),
    updated_at = now();
  if new.taxa_dolar is not null and new.compra_id is not null then
    update public.compras set taxa_dolar = new.taxa_dolar where id = new.compra_id;
  end if;
  if new.origem is null then return null; end if;
  if new.origem = 'Importado' then
    perform set_config('bagda.recalc_dolar', '1', true);
    update public.products set origem = 'Importado', updated_at = now() where sku = new.sku;
  elsif new.origem = 'Nacional' then
    update public.products set origem = 'Nacional', updated_at = now() where sku = new.sku;
  else
    raise exception 'Origem inválida' using errcode = 'P0001';
  end if;
  return null;
end $$;
revoke all on function public.tg_purchase_insert() from public, anon, authenticated;

create or replace function public.cotacao_dolar_salvar(p_valor numeric)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.can('admin') then raise exception 'Só admin altera a cotação' using errcode = '42501'; end if;
  if auth.uid() is null then raise exception 'Sem sessão' using errcode = '42501'; end if;
  if p_valor is null or p_valor <= 0 or p_valor > 999 or p_valor <> round(p_valor, 4) then
    raise exception 'Cotação inválida' using errcode = 'P0001';
  end if;
  insert into public.cotacao_dolar(valor, alterado_por) values (round(p_valor, 4), auth.uid());
  update public.product_costs c
     set custo = round(c.custo_usd * round(p_valor, 4), 2), updated_at = now()
    from public.products p
   where p.sku = c.sku and p.origem = 'Importado' and c.custo_usd is not null;
  perform set_config('bagda.recalc_dolar', '1', true);
  update public.products set updated_at = now() where origem = 'Importado';
  return public.cotacao_dolar_ler();
end $$;

create or replace function public.recalcular_preco_importado(p_sku text)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.can('admin') then raise exception 'Só admin altera origem ou preço em US$' using errcode = '42501'; end if;
  if not exists (select 1 from public.products where sku = p_sku and origem = 'Importado') then return; end if;
  perform set_config('bagda.recalc_dolar', '1', true);
  update public.products set updated_at = now() where sku = p_sku and origem = 'Importado';
end $$;

revoke all on function public.cotacao_dolar_ler(), public.cotacao_dolar_salvar(numeric), public.recalcular_preco_importado(text) from public, anon;
grant execute on function public.cotacao_dolar_ler(), public.cotacao_dolar_salvar(numeric), public.recalcular_preco_importado(text) to authenticated;

create or replace function public.registrar_compra_lote(p_header jsonb, p_itens jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare v_lote uuid := gen_random_uuid(); it jsonb; n int := 0; v_tot numeric := 0; v_cid bigint;
  v_forn text := nullif(btrim(regexp_replace(coalesce(p_header->>'fornecedor', ''), '\s+', ' ', 'g')), '');
  v_obs text := nullif(btrim(coalesce(p_header->>'observacao', '')), '');
  v_data date := coalesce(nullif(p_header->>'data', '')::date, (now() at time zone 'America/Sao_Paulo')::date);
  v_taxa numeric := nullif(p_header->>'taxa_dolar', '')::numeric;
  v_origem text; v_cusd numeric; v_custo numeric;
  v_pag text; v_venc date; v_cx smallint;
begin
  if not (public.can('admin')) then raise exception 'Só admin registra compra' using errcode = '42501'; end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then raise exception 'Nenhum item' using errcode = 'P0001'; end if;
  if jsonb_array_length(p_itens) > 200 then raise exception 'Máximo 200 itens por compra' using errcode = 'P0001'; end if;
  if v_data > (now() at time zone 'America/Sao_Paulo')::date then raise exception 'Data no futuro' using errcode = 'P0001'; end if;
  if length(v_forn) > 120 or length(v_obs) > 500 then raise exception 'Fornecedor/observação longos demais' using errcode = 'P0001'; end if;
  if v_taxa is not null and (v_taxa <= 0 or v_taxa > 999 or v_taxa <> round(v_taxa, 4)) then raise exception 'Taxa do dólar inválida' using errcode = 'P0001'; end if;
  for it in select * from jsonb_array_elements(p_itens) loop
    n := n + 1;
    v_origem := nullif(btrim(coalesce(it->>'origem', '')), '');
    v_cusd := nullif(it->>'custo_usd', '')::numeric;
    if not exists (select 1 from public.products where sku = it->>'sku') then raise exception 'Item %: SKU % não existe', n, it->>'sku' using errcode = 'P0001'; end if;
    if coalesce((it->>'qtd')::int, 0) <= 0 then raise exception 'Item %: quantidade inválida', n using errcode = 'P0001'; end if;
    if v_origem is not null and v_origem not in ('Nacional', 'Importado') then raise exception 'Item %: origem inválida', n using errcode = 'P0001'; end if;
    if v_origem = 'Importado' and v_taxa is null then raise exception 'Item %: informe a taxa do dólar desta compra', n using errcode = 'P0001'; end if;
    if v_origem = 'Importado' and (v_cusd is null or v_cusd < 0) then raise exception 'Item %: informe o custo em US$', n using errcode = 'P0001'; end if;
    if v_origem is distinct from 'Importado' and coalesce((it->>'custo_unit')::numeric, -1) < 0 then raise exception 'Item %: custo inválido', n using errcode = 'P0001'; end if;
    v_custo := case when v_origem = 'Importado' then round(v_cusd * v_taxa, 2) else round((it->>'custo_unit')::numeric, 2) end;
    insert into public.purchases (data, sku, fornecedor, qtd, custo_unit, observacao, compra_lote, origem, preco_usd, custo_usd, taxa_dolar)
    values (v_data, it->>'sku', v_forn, (it->>'qtd')::int, v_custo, v_obs, v_lote,
            v_origem, null,
            case when v_origem = 'Importado' then round(v_cusd, 2) end,
            case when v_origem = 'Importado' then round(v_taxa, 4) end);
    v_tot := v_tot + (it->>'qtd')::int * v_custo;
  end loop;
  if v_forn is not null and length(v_forn) >= 2 and not exists (select 1 from public.fornecedores f where lower(btrim(f.nome)) = lower(v_forn)) then
    insert into public.fornecedores (nome) values (v_forn);
  end if;
  select id into v_cid from public.compras where lote = v_lote;
  if v_cid is null then raise exception 'Compra não numerada' using errcode = 'P0001'; end if;
  v_pag := nullif(lower(btrim(coalesce(p_header->>'pagamento', ''))), '');
  if v_pag is not null then
    if v_pag not in ('agora', 'depois', 'divida') then
      raise exception 'Escolha a forma de pagamento' using errcode = 'P0001';
    end if;
    if v_pag = 'divida' and not public.has_perm('admin') then
      raise exception 'Só admin lança dívida no caixa especial' using errcode = '42501';
    end if;
    v_venc := null;
    if v_pag = 'depois' and nullif(btrim(coalesce(p_header->>'vencimento', '')), '') is not null then
      begin
        v_venc := (p_header->>'vencimento')::date;
      exception when others then
        raise exception 'Vencimento inválido' using errcode = 'P0001';
      end;
    end if;
    update public.compras
       set pagamento = v_pag,
           vencimento = case when v_pag = 'depois' then v_venc end
     where id = v_cid;
    if v_pag in ('agora', 'divida') and round(v_tot, 2) > 0 then
      begin
        v_cx := nullif(btrim(coalesce(p_header->>'caixa_id', '')), '')::smallint;
      exception when others then
        raise exception 'Caixa inválido' using errcode = 'P0001';
      end;
      if v_cx is null then raise exception 'Escolha o caixa' using errcode = 'P0001'; end if;
      perform public.compra_lancar_saida(v_cid, v_cx, round(v_tot, 2), v_pag = 'divida');
    end if;
  end if;
  return jsonb_build_object(
    'lote', v_lote, 'itens', n, 'total', round(v_tot, 2), 'compra_id', v_cid,
    'numero', public.compra_numero(v_cid), 'origem_ok', true,
    'pagamento', v_pag, 'pagamento_ok', v_pag is not null);
end
$fn$;

drop function if exists public.compra_pagar(bigint, numeric, smallint, numeric, date);
create or replace function public.compra_pagar(p_compra bigint, p_valor numeric, p_caixa smallint)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
begin
  if not (select public.can('admin')) then
    raise exception 'Somente admin' using errcode = '42501';
  end if;
  return public.compra_lancar_saida(p_compra, p_caixa, p_valor);
end
$fn$;

create or replace function public.compras_pendentes()
returns jsonb language plpgsql stable security definer set search_path = '' as $fn$
declare
  v_admin boolean := public.has_perm('admin');
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_grupos jsonb;
  v_pagas jsonb;
begin
  if not (select public.can('admin')) then
    raise exception 'Somente admin' using errcode = '42501';
  end if;
  with linhas as (
    select c.id,
           public.compra_numero(c.id) as numero,
           c.data,
           nullif(btrim(c.fornecedor), '') as fornecedor,
           c.vencimento,
           c.pagamento,
           round(coalesce((select sum(p.qtd * p.custo_unit) from public.purchases p where p.compra_id = c.id), 0), 2) as total,
           round(coalesce((select sum(pg.valor) from public.compra_pagamentos pg where pg.compra_id = c.id), 0), 2) as pago
      from public.compras c
     where c.pagamento in ('agora', 'depois', 'divida')
  ),
  calc as (
    select l.*,
           round(l.total - l.pago, 2) as restante,
           (l.vencimento is not null and l.vencimento < v_hoje and round(l.total - l.pago, 2) > 0) as atrasada
      from linhas l
  ),
  objs as (
    select c.*,
           jsonb_build_object(
             'id', c.id, 'numero', c.numero, 'data', c.data,
             'fornecedor', coalesce(c.fornecedor, 'Sem fornecedor'),
             'vencimento', c.vencimento, 'pagamento', c.pagamento,
             'total', c.total, 'pago', c.pago, 'restante', c.restante, 'atrasada', c.atrasada,
             'pagamentos', coalesce((
               select jsonb_agg(jsonb_build_object(
                        'id', pg.id, 'valor', pg.valor, 'data', pg.data,
                        'caixa', case when cx.somente_admin and not v_admin then null else cx.nome end,
                        'caixa_id', case when cx.somente_admin and not v_admin then null else cx.id end,
                        'caixa_oculto', cx.somente_admin and not v_admin
                      ) order by pg.id)
                 from public.compra_pagamentos pg
                 join public.caixas cx on cx.id = pg.caixa_id
                where pg.compra_id = c.id
             ), '[]'::jsonb)
           ) as obj
      from calc c
  )
  select coalesce((
           select jsonb_agg(jsonb_build_object(
                    'fornecedor', g.fornecedor, 'total_devido', g.total_devido, 'compras', g.compras
                  ) order by g.fornecedor)
             from (
               select coalesce(fornecedor, 'Sem fornecedor') as fornecedor,
                      round(sum(restante), 2) as total_devido,
                      jsonb_agg(obj order by atrasada desc, vencimento nulls last, data, id) as compras
                 from objs
                where restante > 0
                group by coalesce(fornecedor, 'Sem fornecedor')
             ) g
         ), '[]'::jsonb),
         coalesce((
           select jsonb_agg(obj order by id desc)
             from (select obj, id from objs where restante <= 0 order by id desc limit 40) s
         ), '[]'::jsonb)
    into v_grupos, v_pagas;
  return jsonb_build_object('grupos', v_grupos, 'pagas', v_pagas);
end
$fn$;

revoke all on function public.compra_pagar(bigint, numeric, smallint),
  public.compras_caixas_pagamento(), public.compras_pendentes() from public, anon;
grant execute on function public.compra_pagar(bigint, numeric, smallint),
  public.compras_caixas_pagamento(), public.compras_pendentes() to authenticated;

drop function if exists public.compra_agendar(bigint, date);
drop function if exists public.compra_mover_caixa(smallint, text, numeric, text, date, boolean);
drop function if exists public.recalcular_custo_importado(text);
drop function if exists public.custos_loja();
drop index if exists public.compras_cambio_aberto_idx;
alter table public.compras drop constraint if exists compras_cambio_pago_check;
alter table public.compras drop column if exists cambio_pago;
alter table public.compras drop column if exists data_pagamento;
alter table public.compras drop column if exists pagar_em;

do $$
declare cols text;
begin
  if to_regclass('public.compras') is null then return; end if;
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'compras'
     and column_name not in ('pagamento', 'vencimento');
  if cols is null then return; end if;
  execute 'revoke select on table public.compras from authenticated';
  execute 'grant select (' || cols || ') on table public.compras to authenticated';
end $$;

notify pgrst, 'reload schema';
select 'rollback cambio-pago' as status;
