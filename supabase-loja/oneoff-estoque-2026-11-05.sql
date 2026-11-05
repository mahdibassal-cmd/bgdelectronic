-- SUPERSEDED - DO NOT RUN. Already applied 2026-11-05 via fix-hayati-cdn-liquidbrun-2026-11-05.sql
-- (Hayati 13->2, PERF-008 +720 @155, PERF-150 Liquid Brun +48 @194). Running this would double the compras.
do $$ begin raise exception 'SUPERSEDED: oneoff-estoque-2026-11-05.sql was already applied - do not run'; end $$;

-- 05/11 MB (bagda-loja xvsxnicmpkvzzhkkqgam). Uma transação. NÃO rodar sem o "yes" do MB. Nunca "Run without RLS".
-- 1) PERF-125 Hayati: estoque 13 -> 2 (erro da contagem 04/11). Custo NÃO muda. Log em estoque_contagem_log.
-- 2) Compra PERF-008 Club de Nuit Intense Man: +720 @ 155,00 (insert em purchases; trigger purchase_ai soma estoque + product_costs).
-- 3) French Avenue Liquid Brun 100 ml: cria o produto (próximo PERF-xxx livre = max+1, tabela travada) e compra +48 @ 194,00.
-- Guardas (2ª execução não duplica nada):
--   Hayati: só altera se estoque = 13; se já = 2 pula; outro valor = erro (rollback).
--   Compras: marcadas na observacao '[oneoff-2026-11-05 ...]'; se a linha já existe em purchases, pula.
--   Liquid Brun: se já existe produto French Avenue Liquid Brun, reaproveita o SKU (não cria outro).
begin;

create table if not exists public.estoque_contagem_log (
  id bigint generated always as identity primary key,
  pagina text not null, sku text not null, perfume_contado text not null,
  estoque_antes integer not null, estoque_depois integer not null,
  custo_sistema numeric(10,2), custo_contado numeric(10,2),
  at timestamptz not null default now(), actor uuid default auth.uid());
alter table public.estoque_contagem_log enable row level security;
revoke all on public.estoque_contagem_log from public, anon, authenticated;

-- trava escrita em products durante o max+1 (evita SKU duplicado em corrida)
lock table public.products in share row exclusive mode;

drop table if exists _oo_before;
create temp table _oo_before as
select p.sku, p.marca, p.produto, p.estoque, c.custo
from public.products p left join public.product_costs c on c.sku = p.sku
where p.sku in ('PERF-125', 'PERF-008')
   or (p.marca ilike 'French Avenue' and p.produto ilike '%liquid brun%');

do $$
declare h record; cdn record; v_admin uuid; v_lb text; v_n int; v_mx int;
begin
  select id into v_admin from public.profiles where role = 'admin' and ativo order by (handle = '@mike') desc, created_at limit 1;
  if v_admin is null then raise exception 'Nenhum perfil admin ativo para created_by.'; end if;

  -- 1) Hayati
  select * into h from public.products where sku = 'PERF-125' for update;
  if h.sku is null then raise exception 'PERF-125 não encontrado'; end if;
  if h.produto !~* 'hayati' then raise exception 'PERF-125 não é Hayati (é %)', h.produto; end if;
  if h.estoque = 13 then
    update public.products set estoque = 2, updated_at = now() where sku = 'PERF-125';
    insert into public.estoque_contagem_log (pagina, sku, perfume_contado, estoque_antes, estoque_depois, custo_sistema, custo_contado)
    values ('correcao-hayati-2026-11-05', 'PERF-125', 'Hayati', 13, 2,
            (select custo from public.product_costs where sku = 'PERF-125'), (select custo from public.product_costs where sku = 'PERF-125'));
  elsif h.estoque = 2 then raise notice 'Hayati já está em 2 — pulado';
  else raise exception 'Hayati PERF-125 está com estoque % (esperado 13). Nada aplicado.', h.estoque;
  end if;

  -- 2) CDN Intense Man
  select * into cdn from public.products where sku = 'PERF-008';
  if cdn.sku is null or cdn.produto !~* 'club de nuit intense' or cdn.produto ~* '(woman|women|mulher|fuego)' then
    raise exception 'PERF-008 não é Club de Nuit Intense Man (é %)', coalesce(cdn.produto, '(não existe)'); end if;
  if not exists (select 1 from public.purchases where observacao like '[oneoff-2026-11-05 cdn]%') then
    insert into public.purchases (sku, qtd, custo_unit, observacao, created_by)
    values ('PERF-008', 720, 155.00, '[oneoff-2026-11-05 cdn] Compra 05/11 Club de Nuit Intense Man (SQL)', v_admin);
  else raise notice 'Compra CDN já lançada — pulada'; end if;

  -- 3) French Avenue Liquid Brun
  select count(*), min(sku) into v_n, v_lb from public.products where marca ilike 'French Avenue' and produto ilike '%liquid brun%';
  if v_n > 1 then raise exception 'Mais de um Liquid Brun cadastrado — conferir antes'; end if;
  if v_lb is null then
    select coalesce(max(substring(sku from '^PERF-(\d+)$')::int), 0) into v_mx from public.products where sku ~ '^PERF-\d+$';
    if v_mx = 0 then raise exception 'Nenhum PERF-xxx encontrado — abortado'; end if;
    v_lb := 'PERF-' || lpad((v_mx + 1)::text, 3, '0');
    insert into public.products (sku, marca, produto, tamanho, fornecedor, preco_venda, estoque, estoque_minimo, ativo, updated_at)
    values (v_lb, 'French Avenue', 'Liquid Brun', '100 ml', null, 0, 0, 2, true, now());
    raise notice 'Criado %', v_lb;
  end if;
  if not exists (select 1 from public.purchases where observacao like '[oneoff-2026-11-05 liquidbrun]%') then
    insert into public.purchases (sku, qtd, custo_unit, observacao, created_by)
    values (v_lb, 48, 194.00, '[oneoff-2026-11-05 liquidbrun] Compra 05/11 French Avenue Liquid Brun 100 ml (SQL)', v_admin);
  else raise notice 'Compra Liquid Brun já lançada — pulada'; end if;
end $$;

commit;

-- Resultado (antes/depois)
select p.sku, p.marca, p.produto, p.tamanho, b.estoque as estoque_antes, p.estoque as estoque_depois,
       b.custo as custo_antes, c.custo as custo_depois, p.preco_venda
from public.products p
left join _oo_before b on b.sku = p.sku
left join public.product_costs c on c.sku = p.sku
where p.sku in ('PERF-125', 'PERF-008') or (p.marca ilike 'French Avenue' and p.produto ilike '%liquid brun%')
order by p.sku;
