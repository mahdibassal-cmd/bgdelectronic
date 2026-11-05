// Carrinho grande não pode mais cair em "Nota sem itens". PGlite, sem produção.
// Rodar: node nota-sem-limite-linhas-test.mjs
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
const R = new URL("..", import.meta.url).pathname, S = f => fs.readFileSync(R + f, "utf8");
const ids = { mike: "a", kaio: "d" };
const U = k => "00000000-0000-0000-0000-00000000000" + ids[k];
let fails = 0, passes = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); c ? passes++ : fails++; };
const db = new PGlite();
await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth; grant usage on schema auth to anon, authenticated; grant usage on schema public to anon, authenticated;
create table auth.users(id uuid primary key, email text); create table auth.mfa_factors(user_id uuid, status text); create table auth.sessions(id uuid, user_id uuid); create table auth.refresh_tokens(id int, session_id uuid);
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt()->>'sub','')::uuid $$;
grant execute on all functions in schema auth to anon, authenticated;
insert into auth.users values ('${U("mike")}','mike@loja.bgdstores.local'), ('${U("kaio")}','kaio@loja.bgdstores.local');`);
for (const f of ["schema.sql", "users.sql", "security.sql", "migration-clientes.sql", "migration-caixa-geral.sql", "migration-frete.sql", "migration-caxinha-natal.sql", "fix-nota-no-line-limit.sql"]) {
  try { await db.exec(S(f)); console.log("ran " + f); }
  catch (e) { console.error("FAIL load " + f + ": " + e.message); process.exit(1); }
}
const src = S("fix-nota-no-line-limit.sql") + S("migration-caxinha-natal.sql") + S("migration-frete.sql");
ok(!/jsonb_array_length\(p_items\)\s*>\s*\d+/.test(src), "loja definitions have no p_items line cap");
ok(!/jsonb_array_length\(p_items\)\s*>\s*\d+/.test(fs.readFileSync(new URL("../../supabase/kiosk/migration-caxinha-natal-kiosk.sql", import.meta.url), "utf8")), "kiosk caxinha has no line cap");
ok(!/items\.length\s*>\s*30|máximo de 30|maximo de 30/.test(fs.readFileSync(new URL("../../main/app.js", import.meta.url), "utf8")), "loja UI has no 30-line cap");
const as = k => db.exec(`reset role; select set_config('request.jwt.claims', '${JSON.stringify({ sub: U(k), aal: "aal1" })}', false); set role authenticated;`);
const err = async q => { try { await db.query(q); return null; } catch (e) { return e.message; } };
const one = async q => (await db.query(q)).rows[0];
const num = async q => Number(Object.values(await one(q))[0]);
const items = n => JSON.stringify(Array.from({ length: n }, () => ({ sku: "APL-001", qtd: 1, preco_vendido: 1 })));
await db.exec("reset role; insert into public.products(sku,marca,produto,preco_venda,estoque) values ('APL-001','Armaf','Gossip Homme',1,5000)");
await as("kaio");
const cli = await num("select public.criar_cliente('Maria Souza','11999990000','52998224725')");
// Payload da tela com Frete 0 e Caxinha 0: os dois parâmetros somem (defaults 0). 45 linhas, Paga Depois.
const payload45 = { p_items: JSON.parse(items(45)), p_pagamentos: [{ metodo: "prazo", valor: 45 }], p_cliente: "Maria Souza", p_cliente_id: cli, p_local: null, p_obs: null };
ok(payload45.p_items.length === 45 && payload45.p_frete === undefined && payload45.p_caxinha_natal === undefined, "captured product-only payload omits zero fees and keeps 45 lines");
const n45 = await num(`select public.criar_nota_local('${items(45)}'::jsonb, '[{"metodo":"prazo","valor":45}]'::jsonb, 'Maria Souza', ${cli}, null, null)`);
ok(n45 > 0 && await num(`select count(*) from public.sales where nota_id=${n45}`) === 45, "45 lines, fees omitted (screen payload) saves");
ok(await num(`select frete::float8 + caxinha_natal::float8 from public.notas where id=${n45}`) === 0, "omitted fees stored as 0");
for (const n of [30, 31, 100, 101, 250]) {
  const id = await num(`select public.criar_nota('${items(n)}'::jsonb, '[{"metodo":"pix","valor":${n}}]'::jsonb, null, null, 0, 0)`);
  ok(await num(`select count(*) from public.sales where nota_id=${id}`) === n, n + " lines pass with explicit zero fees");
}
let e = await err(`select public.criar_nota('[]'::jsonb, '[{"metodo":"pix","valor":1}]'::jsonb, null, null, 0, 0)`);
ok(e && /Nota sem itens/.test(e), "empty cart and zero fees refused: " + e);
e = await err(`select public.criar_nota('{"sku":"APL-001"}'::jsonb, '[{"metodo":"pix","valor":1}]'::jsonb, null, null, 0, 0)`);
ok(e && /Nota sem itens/.test(e), "malformed object refused: " + e);
e = await err(`select public.criar_nota(null, '[{"metodo":"pix","valor":1}]'::jsonb, null, null, 0, 0)`);
ok(e && /Nota sem itens/.test(e), "null p_items refused: " + e);
const fee = await num(`select public.criar_nota_local('[]'::jsonb, '[{"metodo":"pix","valor":12.5}]'::jsonb, null, null, 'HX', null, 10, 2.5)`);
ok(fee > 0 && await num(`select count(*) from public.sales where nota_id=${fee}`) === 0 && await num(`select frete::float8 from public.notas where id=${fee}`) === 10 && await num(`select caxinha_natal::float8 from public.notas where id=${fee}`) === 2.5, "fee-only note (no lines) saves");
const both = await num(`select public.criar_nota_local('${items(3)}'::jsonb, '[{"metodo":"pix","valor":20}]'::jsonb, null, null, 'MAQUINA', null, 15, 2)`);
ok(await num(`select count(*) from public.sales where nota_id=${both}`) === 3 && await num(`select total::float8 from public.notas where id=${both}`) === 20, "products plus fees keep lines and total");
ok((await one("select pg_get_function_identity_arguments(p.oid) a from pg_proc p where proname='criar_nota_local'")).a.includes("p_caxinha_natal"), "Frete+Caxinha signature kept");
ok(!/jsonb_array_length\(p_items\) >/.test((await one("select prosrc s from pg_proc where proname='criar_nota' and pg_get_function_identity_arguments(oid) like '%p_caxinha_natal%'")).s), "live criar_nota body has no line cap");
console.log(fails ? `FAILED ${fails} (${passes} pass)` : `ALL PASS (${passes})`);
process.exit(fails ? 1 : 0);
