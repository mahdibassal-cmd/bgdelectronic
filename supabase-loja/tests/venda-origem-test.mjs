// Origem da venda: Principal x Depósito Especial. PGlite, sem produção.
import { readFileSync } from "node:fs";
const { PGlite } = await import("@electric-sql/pglite").catch(() => import("/tmp/pgdeps/node_modules/@electric-sql/pglite/dist/index.js"));

const sql = readFileSync(new URL("../migration-venda-origem.sql", import.meta.url), "utf8");
const db = new PGlite();
let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.error("FAIL", m); } else console.log("ok", m); };
const mike = "00000000-0000-0000-0000-00000000000a";
const kaio = "00000000-0000-0000-0000-00000000000d";
await db.exec(`
create role anon nologin; create role authenticated nologin;
create schema if not exists auth;
create table auth.users(id uuid primary key);
insert into auth.users values ('${mike}'), ('${kaio}');
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt()->>'sub','')::uuid $$;
create type public.pay_method as enum ('dinheiro','pix','cartao','prazo','credito');
create table public.profiles(id uuid primary key, role text, ativo boolean default true, handle text, nome text);
create table public.role_perms(role text, perm text);
insert into public.profiles values ('${mike}','admin',true), ('${kaio}','vendedor',true);
insert into public.role_perms values ('admin','admin'),('admin','vendas'),('admin','estoque'),('vendedor','vendas');
create function public.can(p text) returns boolean language sql stable as $$
  select exists (select 1 from public.profiles pr join public.role_perms rp on rp.role = pr.role
    where pr.id = auth.uid() and pr.ativo and rp.perm = p) $$;
create table public.products(sku text primary key, marca text, produto text, tamanho text, preco_venda numeric, estoque integer, ativo boolean default true, updated_at timestamptz);
create table public.product_costs(sku text primary key, custo numeric);
create table public.notas(
  id bigint generated always as identity primary key, data date default current_date, created_at timestamptz default now(),
  seller_id uuid, cliente text, cliente_id bigint,
  frete numeric, caxinha_natal numeric, total numeric default 0, status text default 'ativa',
  cancelada_em timestamptz, cancelada_por uuid, motivo_cancel text,
  caixa_lancada_id smallint, lancada_em timestamptz, lancada_por uuid,
  prazo_lancada_em timestamptz, prazo_lancada_por uuid,
  cxesp_lancada_em timestamptz, cxesp_lancada_por uuid, cxesp_mov_id bigint);
create table public.sales(
  id bigint generated always as identity primary key, nota_id bigint, data date default current_date,
  sku text, qtd integer, preco_tabela numeric, preco_vendido numeric, seller_id uuid,
  total numeric generated always as (qtd * preco_vendido) stored, created_at timestamptz default now());
create table public.sale_costs(sale_id bigint primary key, custo_unit numeric);
create table public.nota_pagamentos(id bigint generated always as identity primary key, nota_id bigint, metodo public.pay_method, valor numeric);
create table public.caixa_movimentos(id bigint generated always as identity primary key, caixa_id smallint, tipo text, valor numeric, motivo text, nota_id bigint, user_id uuid, forma text);
create table public.deposito_especial(sku text primary key, qtd integer not null default 0, custo numeric not null default 0, updated_at timestamptz default now());
create table public.deposito_especial_mov(
  id bigint generated always as identity primary key, sku text, tipo text not null check (tipo in ('entrada','ajuste','para_loja','da_loja')),
  qtd integer, qtd_antes integer, qtd_depois integer, custo_unit numeric, motivo text,
  created_by uuid default auth.uid(), created_at timestamptz default now());
create function public.fin_log(kind text, detail jsonb) returns void language sql as $$ select null::void $$;
create table public.cxesp_calls(nota bigint, motivo text);
create function public._cxesp_estornar_nota(p_nota bigint, p_motivo text) returns bigint language plpgsql as $$
begin insert into public.cxesp_calls values (p_nota, p_motivo); return 1; end $$;
insert into public.products values ('IP-1','Apple','iPhone FIXTURE','Preto',100,4,true,now()), ('IP-2','Apple','Outro FIXTURE','Azul',50,0,true,now());
insert into public.product_costs values ('IP-1',60), ('IP-2',30);
insert into public.deposito_especial values ('IP-1',5,70,now());
`);
const runnable = sql.split(/;\s*\n/).filter(s => !/^\s*(revoke|grant|notify)\b/i.test(s)).join(";\n");
try { await db.exec(runnable); } catch (e) { console.error("SQL FAIL", e.message); process.exit(1); }
await db.exec(`
create trigger sale_bi before insert on public.sales for each row execute function public.tg_sale_insert();
create trigger sale_ai after insert on public.sales for each row execute function public.tg_sale_after_insert();
`);
const as = async roleId => db.exec(`select set_config('request.jwt.claims', '${JSON.stringify({ sub: roleId, aal: "aal1" })}', false)`);
const one = async q => (await db.query(q)).rows[0];
const num = async q => Number(Object.values(await one(q))[0]);
const err = async q => { try { await db.query(q); return ""; } catch (e) { return e.message; } };

await as(kaio);
let e = await err(`select public.criar_nota('[{"sku":"IP-1","qtd":1,"preco_vendido":80,"origem":"especial"}]'::jsonb, '[{"metodo":"pix","valor":80}]'::jsonb, null, null, 0, 0)`);
ok(/Sem permissão para vender do Depósito Especial/.test(e), "seller cannot sell from Especial: " + e);
ok(await num("select qtd from deposito_especial where sku='IP-1'") === 5 && await num("select estoque from products where sku='IP-1'") === 4, "refused especial sale changes neither stock");

await as(mike);
const mainId = await num(`select public.criar_nota('[{"sku":"IP-1","qtd":1,"preco_vendido":90}]'::jsonb, '[{"metodo":"pix","valor":90}]'::jsonb, null, null, 0, 0)`);
ok(await num(`select estoque from products where sku='IP-1'`) === 3, "omitted source deducts Principal");
ok((await one(`select coalesce(estoque_origem,'') o from sales where nota_id=${mainId}`)).o === "principal", "old payload is stored as principal");
ok(await num("select qtd from deposito_especial where sku='IP-1'") === 5, "principal sale does not touch Especial");

const espId = await num(`select public.criar_nota('[{"sku":"IP-1","qtd":2,"preco_vendido":40,"origem":"especial"}]'::jsonb, '[{"metodo":"pix","valor":80}]'::jsonb, null, null, 0, 0)`);
ok(await num("select qtd from deposito_especial where sku='IP-1'") === 3 && await num("select estoque from products where sku='IP-1'") === 3, "especial sale deducts only Especial");
ok((await one(`select estoque_origem o from sales where nota_id=${espId}`)).o === "especial", "line remembers Especial");
ok(await num(`select custo_unit from sale_costs where sale_id=(select id from sales where nota_id=${espId})`) === 70, "especial cost snapshot is the special deposit cost");
ok(await num(`select custo from product_costs where sku='IP-1'`) === 60, "store cost is unchanged");

e = await err(`select public.criar_nota('[{"sku":"IP-1","qtd":9,"preco_vendido":10,"origem":"especial"}]'::jsonb, '[{"metodo":"pix","valor":90}]'::jsonb, null, null, 0, 0)`);
ok(/Depósito Especial sem estoque suficiente/.test(e), "insufficient especial stock is refused: " + e);
ok(await num("select qtd from deposito_especial where sku='IP-1'") === 3 && await num("select estoque from products where sku='IP-1'") === 3, "failed especial sale does not transfer or deduct");

e = await err(`select public.criar_nota('[{"sku":"IP-2","qtd":1,"preco_vendido":10,"origem":"especial"}]'::jsonb, '[{"metodo":"pix","valor":10}]'::jsonb, null, null, 0, 0)`);
ok(/sem estoque suficiente/.test(e) && await num("select estoque from products where sku='IP-2'") === 0, "empty especial does not take store units");

await db.exec(`select public.cancelar_nota(${espId}, 'teste origem')`);
ok(await num(`select count(*) from cxesp_calls where nota=${espId}`) === 1, "cancel still calls the Caixa Especial reversal");
ok(await num("select qtd from deposito_especial where sku='IP-1'") === 5 && await num("select estoque from products where sku='IP-1'") === 3, "cancel returns the units to Especial only");
ok((await one("select tipo from deposito_especial_mov where tipo='estorno_venda'")).tipo === "estorno_venda", "cancel writes an especial return movement");

await db.exec(`select public.cancelar_nota(${mainId}, 'teste loja')`);
ok(await num("select estoque from products where sku='IP-1'") === 4 && await num("select qtd from deposito_especial where sku='IP-1'") === 5, "cancel of a principal line restores only the store");

const both = await num(`select public.criar_nota('[{"sku":"IP-1","qtd":1,"preco_vendido":10,"origem":"principal"},{"sku":"IP-1","qtd":1,"preco_vendido":10,"origem":"especial"}]'::jsonb, '[{"metodo":"pix","valor":20}]'::jsonb, null, null, 0, 0)`);
ok(await num("select estoque from products where sku='IP-1'") === 3 && await num("select qtd from deposito_especial where sku='IP-1'") === 4, "one note can take one unit from each source");
await db.exec(`select public.cancelar_nota(${both}, 'teste misto')`);
ok(await num("select estoque from products where sku='IP-1'") === 4 && await num("select qtd from deposito_especial where sku='IP-1'") === 5, "mixed cancel restores each source");

if (failed) { console.error(failed + " failed"); process.exit(1); }
console.log("venda origem sql ok");
