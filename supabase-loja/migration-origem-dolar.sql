-- DRAFT — NÃO APLICAR em produção até o dono (MB) dizer "publica".
-- Não rodar no SQL Editor do projeto xvsxnicmpkvzzhkkqgam antes disso.
-- Loja /main apenas. Não mexe no quiosque.
--
-- Origem do produto: Nacional (padrão, preço em R$ como hoje, a cotação não altera)
-- ou Importado (preço de venda em US$; o R$ da gôndola = preco_usd × cotação).
-- A escolha entra na compra (cada linha) e também pode ser alterada depois no produto (só admin).
-- preco_venda em R$ continua preenchido para Nova nota, estoque, CSV e o sync do quiosque.
-- Notas, sales e sale_costs já gravados NÃO são recalculados.
--
-- Regra ,99 (a mesma de main/origem-preco.js):
--   redondo = round(preco_usd * cotacao, 0)     -- meio para cima, real inteiro
--   preco   = redondo - 0,01
--   se o ,99 ficaria abaixo do custo em R$ (estrito), fica o redondo.
--   Ex.: 100,00 → 99,99. Custo 100,00 → fica 100,00.
--
-- Cotação: o admin grava quando quiser (não há job diário). Cada gravação entra no
-- histórico (valor, quem, quando) e recalcula na hora o preco_venda dos Importados.
-- Custo continua só admin (product_costs). custo_usd, se informado, também fica lá.

alter table public.products add column if not exists origem text;
update public.products set origem = 'Nacional' where origem is null;
alter table public.products alter column origem set default 'Nacional';
alter table public.products alter column origem set not null;
alter table public.products drop constraint if exists products_origem_check;
alter table public.products add constraint products_origem_check check (origem in ('Nacional', 'Importado'));

alter table public.products add column if not exists preco_usd numeric(10,2);
alter table public.products drop constraint if exists products_preco_usd_check;
alter table public.products add constraint products_preco_usd_check check (preco_usd is null or (preco_usd > 0 and preco_usd <= 999999.99));
alter table public.products drop constraint if exists products_importado_preco_check;
alter table public.products add constraint products_importado_preco_check check (origem <> 'Importado' or preco_usd is not null);
create index if not exists products_importado_idx on public.products (sku) where origem = 'Importado';

alter table public.product_costs add column if not exists custo_usd numeric(10,2);
alter table public.product_costs drop constraint if exists product_costs_custo_usd_check;
alter table public.product_costs add constraint product_costs_custo_usd_check check (custo_usd is null or (custo_usd >= 0 and custo_usd <= 999999.99));

alter table public.purchases add column if not exists origem text;
alter table public.purchases add column if not exists preco_usd numeric(10,2);
alter table public.purchases add column if not exists custo_usd numeric(10,2);
alter table public.purchases drop constraint if exists purchases_origem_check;
alter table public.purchases add constraint purchases_origem_check check (origem is null or origem in ('Nacional', 'Importado'));
alter table public.purchases drop constraint if exists purchases_preco_usd_check;
alter table public.purchases add constraint purchases_preco_usd_check check (preco_usd is null or (preco_usd > 0 and preco_usd <= 999999.99));
alter table public.purchases drop constraint if exists purchases_custo_usd_check;
alter table public.purchases add constraint purchases_custo_usd_check check (custo_usd is null or (custo_usd >= 0 and custo_usd <= 999999.99));
alter table public.purchases drop constraint if exists purchases_importado_usd_check;
alter table public.purchases add constraint purchases_importado_usd_check check (origem is distinct from 'Importado' or preco_usd is not null);

-- Histórico da cotação. Sem grant: só as RPCs (security definer) leem e gravam.
create table if not exists public.cotacao_dolar (
  id           bigint generated always as identity primary key,
  valor        numeric(7,4) not null check (valor > 0 and valor <= 999),
  alterado_por uuid references public.profiles(id) on delete set null,
  alterado_em  timestamptz not null default now()
);
create index if not exists cotacao_dolar_id_idx on public.cotacao_dolar (id desc);
alter table public.cotacao_dolar enable row level security;
alter table public.cotacao_dolar force row level security;
revoke all on public.cotacao_dolar from public, anon, authenticated;

create or replace function public.cotacao_dolar_valor()
returns numeric language sql stable security definer set search_path = '' as $$
  select c.valor from public.cotacao_dolar c order by c.id desc limit 1;
$$;
revoke all on function public.cotacao_dolar_valor() from public, anon, authenticated;

create or replace function public.preco_reais_importado(p_usd numeric, p_cotacao numeric, p_custo numeric)
returns numeric language plpgsql immutable set search_path = '' as $$
declare v_redondo numeric; v_99 numeric;
begin
  if p_usd is null or p_usd <= 0 or p_cotacao is null or p_cotacao <= 0 then
    raise exception 'Preço em US$ e cotação precisam ser maiores que zero' using errcode = 'P0001';
  end if;
  v_redondo := round(p_usd * p_cotacao, 0);
  v_99 := v_redondo - 0.01;
  if v_99 < 0 then return v_redondo; end if;
  if p_custo is not null and v_99 < p_custo then return v_redondo; end if;
  return v_99;
end $$;
revoke all on function public.preco_reais_importado(numeric, numeric, numeric) from public, anon, authenticated;

-- Só recalcula preco_venda quando a origem, o US$ ou a cotação mudam.
-- Baixa de estoque (venda) não passa aqui: preco_tabela da nota continua o da hora da venda.
create or replace function public.tg_products_origem()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_recalc boolean := tg_op = 'INSERT' or coalesce(current_setting('bagda.recalc_dolar', true), '') = '1';
  v_custo numeric; v_cot numeric; v_preco numeric;
begin
  if new.origem is null then new.origem := 'Nacional'; end if;
  if tg_op = 'INSERT' and auth.uid() is not null and not public.can('admin')
     and (new.origem <> 'Nacional' or new.preco_usd is not null) then
    raise exception 'Só admin altera origem ou preço em US$' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' then
    if (new.origem is distinct from old.origem or new.preco_usd is distinct from old.preco_usd)
       and auth.uid() is not null and not public.can('admin') then
      raise exception 'Só admin altera origem ou preço em US$' using errcode = '42501';
    end if;
    v_recalc := v_recalc
      or new.origem is distinct from old.origem
      or new.preco_usd is distinct from old.preco_usd
      or new.preco_venda is distinct from old.preco_venda;
  end if;
  if new.origem = 'Nacional' then
    return new;
  end if;
  if new.origem <> 'Importado' then
    raise exception 'Origem inválida' using errcode = 'P0001';
  end if;
  if not v_recalc then return new; end if;
  if new.preco_usd is null or new.preco_usd <= 0 then
    raise exception 'Produto importado precisa de preço em US$' using errcode = 'P0001';
  end if;
  v_cot := public.cotacao_dolar_valor();
  if v_cot is null then
    raise exception 'Defina a cotação do dólar antes de marcar o produto como importado' using errcode = 'P0001';
  end if;
  select c.custo into v_custo from public.product_costs c where c.sku = new.sku;
  v_preco := public.preco_reais_importado(round(new.preco_usd, 2), v_cot, v_custo);
  if v_preco > 99999999.99 then
    raise exception 'Preço em R$ alto demais' using errcode = 'P0001';
  end if;
  new.preco_usd := round(new.preco_usd, 2);
  new.preco_venda := v_preco;
  return new;
end $$;
revoke all on function public.tg_products_origem() from public, anon, authenticated;

drop trigger if exists products_biu_origem on public.products;
create trigger products_biu_origem before insert or update on public.products
  for each row execute function public.tg_products_origem();

-- Compra: estoque e custo em R$ como hoje. Se a linha traz origem, grava no produto.
-- origem null = cliente antigo: não muda a origem nem o preço de venda.
create or replace function public.tg_purchase_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.products set estoque = estoque + new.qtd, updated_at = now() where sku = new.sku;
  insert into public.product_costs(sku, custo, custo_usd)
  values (new.sku, new.custo_unit, new.custo_usd)
  on conflict (sku) do update set
    custo = excluded.custo,
    custo_usd = coalesce(excluded.custo_usd, public.product_costs.custo_usd),
    updated_at = now();
  if new.origem is null then return null; end if;
  if new.origem = 'Importado' then
    if new.preco_usd is null or new.preco_usd <= 0 then
      raise exception 'Item importado precisa de preço em US$' using errcode = 'P0001';
    end if;
    update public.products set origem = 'Importado', preco_usd = round(new.preco_usd, 2), updated_at = now()
     where sku = new.sku;
  elsif new.origem = 'Nacional' then
    update public.products set origem = 'Nacional', updated_at = now() where sku = new.sku;
  else
    raise exception 'Origem inválida' using errcode = 'P0001';
  end if;
  return null;
end $$;
revoke all on function public.tg_purchase_insert() from public, anon, authenticated;

create or replace function public.cotacao_dolar_ler()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_cur record; v_hist jsonb;
begin
  if not public.can('admin') then raise exception 'Sem permissão' using errcode = '42501'; end if;
  select c.valor, c.alterado_em, pr.handle, pr.nome into v_cur
  from public.cotacao_dolar c left join public.profiles pr on pr.id = c.alterado_por
  order by c.id desc limit 1;
  select coalesce(jsonb_agg(jsonb_build_object(
           'valor', x.valor, 'alterado_em', x.alterado_em, 'handle', x.handle, 'nome', x.nome
         ) order by x.id desc), '[]') into v_hist
  from (
    select c.id, c.valor, c.alterado_em, pr.handle, pr.nome
    from public.cotacao_dolar c left join public.profiles pr on pr.id = c.alterado_por
    order by c.id desc limit 30
  ) x;
  return jsonb_build_object(
    'valor', v_cur.valor, 'alterado_em', v_cur.alterado_em,
    'handle', v_cur.handle, 'nome', v_cur.nome, 'historico', v_hist);
end $$;

create or replace function public.cotacao_dolar_salvar(p_valor numeric)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.can('admin') then raise exception 'Só admin altera a cotação' using errcode = '42501'; end if;
  if auth.uid() is null then raise exception 'Sem sessão' using errcode = '42501'; end if;
  if p_valor is null or p_valor <= 0 or p_valor > 999 or p_valor <> round(p_valor, 4) then
    raise exception 'Cotação inválida' using errcode = 'P0001';
  end if;
  insert into public.cotacao_dolar(valor, alterado_por) values (round(p_valor, 4), auth.uid());
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

-- Mesmo corpo de migration-compras-imei.sql, mais origem / preco_usd / custo_usd por item.
-- Devolve origem_ok para o cliente saber que esta versão está no banco.
create or replace function public.registrar_compra_lote(p_header jsonb, p_itens jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_lote uuid := gen_random_uuid(); it jsonb; n int := 0; v_tot numeric := 0; v_cid bigint;
  v_forn text := nullif(btrim(regexp_replace(coalesce(p_header->>'fornecedor', ''), '\s+', ' ', 'g')), '');
  v_obs text := nullif(btrim(coalesce(p_header->>'observacao', '')), '');
  v_data date := coalesce(nullif(p_header->>'data', '')::date, (now() at time zone 'America/Sao_Paulo')::date);
  v_origem text; v_usd numeric; v_cusd numeric;
begin
  if not (public.can('admin')) then raise exception 'Só admin registra compra' using errcode = '42501'; end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then raise exception 'Nenhum item' using errcode = 'P0001'; end if;
  if jsonb_array_length(p_itens) > 200 then raise exception 'Máximo 200 itens por compra' using errcode = 'P0001'; end if;
  if v_data > (now() at time zone 'America/Sao_Paulo')::date then raise exception 'Data no futuro' using errcode = 'P0001'; end if;
  if length(v_forn) > 120 or length(v_obs) > 500 then raise exception 'Fornecedor/observação longos demais' using errcode = 'P0001'; end if;
  for it in select * from jsonb_array_elements(p_itens) loop
    n := n + 1;
    v_origem := nullif(btrim(coalesce(it->>'origem', '')), '');
    v_usd := nullif(it->>'preco_usd', '')::numeric;
    v_cusd := nullif(it->>'custo_usd', '')::numeric;
    if not exists (select 1 from public.products where sku = it->>'sku') then raise exception 'Item %: SKU % não existe', n, it->>'sku' using errcode = 'P0001'; end if;
    if coalesce((it->>'qtd')::int, 0) <= 0 then raise exception 'Item %: quantidade inválida', n using errcode = 'P0001'; end if;
    if coalesce((it->>'custo_unit')::numeric, -1) < 0 then raise exception 'Item %: custo inválido', n using errcode = 'P0001'; end if;
    if v_origem is not null and v_origem not in ('Nacional', 'Importado') then raise exception 'Item %: origem inválida', n using errcode = 'P0001'; end if;
    if v_origem = 'Importado' and (v_usd is null or v_usd <= 0) then raise exception 'Item %: informe o preço em US$', n using errcode = 'P0001'; end if;
    if v_cusd is not null and v_cusd < 0 then raise exception 'Item %: custo em US$ inválido', n using errcode = 'P0001'; end if;
    insert into public.purchases (data, sku, fornecedor, qtd, custo_unit, observacao, compra_lote, origem, preco_usd, custo_usd)
    values (v_data, it->>'sku', v_forn, (it->>'qtd')::int, round((it->>'custo_unit')::numeric, 2), v_obs, v_lote,
            v_origem, case when v_origem = 'Importado' then round(v_usd, 2) end, case when v_cusd is not null then round(v_cusd, 2) end);
    v_tot := v_tot + (it->>'qtd')::int * round((it->>'custo_unit')::numeric, 2);
  end loop;
  if v_forn is not null and length(v_forn) >= 2 and not exists (select 1 from public.fornecedores f where lower(btrim(f.nome)) = lower(v_forn)) then
    insert into public.fornecedores (nome) values (v_forn);
  end if;
  select id into v_cid from public.compras where lote = v_lote;
  return jsonb_build_object('lote', v_lote, 'itens', n, 'total', v_tot, 'compra_id', v_cid, 'numero', public.compra_numero(v_cid), 'origem_ok', true);
end $$;

create or replace function public.registrar_compra_origem(p_header jsonb, p_itens jsonb)
returns jsonb language sql security definer set search_path = '' as $$
  select public.registrar_compra_lote(p_header, p_itens);
$$;

revoke all on function public.registrar_compra_lote(jsonb, jsonb), public.registrar_compra_origem(jsonb, jsonb) from public, anon;
grant execute on function public.registrar_compra_lote(jsonb, jsonb), public.registrar_compra_origem(jsonb, jsonb) to authenticated;

-- Selo US$ nas listas. Sem preço em dólar nesta view (vendedor/estoque não precisam do número).
create or replace view public.estoque_vendedor with (security_invoker = true) as
select p.sku, p.marca, p.produto, p.tamanho, p.estoque, p.origem
from public.products p where p.ativo and (public.can('vendas') or public.can('estoque'));

create or replace view public.v_admin_products with (security_invoker = true) as
select p.sku, p.marca, p.produto, p.tamanho, p.fornecedor, c.custo, p.preco_venda,
       case when c.custo > 0 and p.preco_venda > 0 then round((p.preco_venda - c.custo) / p.preco_venda * 100, 1) end as margem_pct,
       p.estoque, p.estoque_minimo, p.ativo, p.notas, p.origem, p.preco_usd
from public.products p left join public.product_costs c on c.sku = p.sku where public.can('admin');

notify pgrst, 'reload schema';
select 'origem-dolar draft' as status;
