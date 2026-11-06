/* Custo obrigatório na compra (PGlite). Não conecta em produção.
   node compra-custo-obrigatorio-test.mjs */
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
const R = new URL("..", import.meta.url).pathname, S = f => fs.readFileSync(R + f, "utf8");
const ids = { mike: "a", pamela: "1", kaio: "d" };
const U = k => "00000000-0000-0000-0000-00000000000" + ids[k];
let fails = 0, passes = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); c ? passes++ : fails++; };
const db = new PGlite();
await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth; grant usage on schema auth to anon, authenticated; grant usage on schema public to anon, authenticated;
create table auth.users(id uuid primary key, email text); create table auth.mfa_factors(user_id uuid, status text); create table auth.sessions(id uuid, user_id uuid); create table auth.refresh_tokens(id int, session_id uuid);
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt()->>'sub','')::uuid $$;
grant execute on all functions in schema auth to anon, authenticated;
insert into auth.users values ${Object.keys(ids).map(k => `('${U(k)}','${k}@loja.bgdstores.local')`).join(",")};`);
for (const f of ["schema.sql", "users.sql", "security.sql", "migration-clientes.sql", "migration-compra-lote.sql", "migration-compras-imei.sql", "migration-compra-custo-obrigatorio.sql"]) {
  try { await db.exec(S(f)); console.log("ran " + f); }
  catch (e) { console.error("FAIL load " + f + ": " + e.message); process.exit(1); }
}
const as = k => db.exec(`reset role; select set_config('request.jwt.claims', '${JSON.stringify({ sub: U(k), aal: "aal1" })}', false); set role authenticated;`);
const err = async q => { try { await db.query(q); return null; } catch (e) { return e.message; } };
const one = async q => (await db.query(q)).rows[0];
const ownerNum = async q => { await db.exec("reset role"); return Number(Object.values((await db.query(q)).rows[0])[0]); };
const ui = fs.readFileSync(new URL("../../main/app.js", import.meta.url), "utf8");
ok(/informe o custo unitário/.test(ui) && /custo inválido/.test(ui) && ui.includes('type="text" inputmode="decimal"'), "UI requires a real cost and accepts a comma");
ok(/Somente admin registra a compra/.test(ui), "UI does not show the cost form to other roles");

await db.exec("reset role; insert into public.products(sku,marca,produto,preco_venda,estoque) values ('APL-001','Apple','AirPods 4',1000,10)");
await db.exec(`insert into public.purchases(sku, qtd, custo_unit, observacao, created_by) values ('APL-001', 2, 40.00, 'historico', '${U("mike")}')`);
const oldId = await ownerNum("select id from public.purchases where observacao = 'historico'");
const est0 = await ownerNum("select estoque from public.products where sku = 'APL-001'");

const call = (body) => `select public.registrar_compra_lote('{"fornecedor":"Dist"}'::jsonb, '${body.replace(/'/g, "''")}'::jsonb)`;
await as("pamela");
let e = await err(call('[{"sku":"APL-001","qtd":1,"custo_unit":"12,50"}]'));
ok(e && /Só admin registra compra/.test(e) && !/12,50|12\.50/.test(e), "financeiro denied without a cost in the error: " + e);
await as("kaio");
e = await err(call('[{"sku":"APL-001","qtd":1,"custo_unit":10}]'));
ok(e && /Só admin registra compra/.test(e), "vendedor denied: " + e);
ok(await ownerNum("select count(*) from public.purchases") === 1, "denied roles added no purchase");

await as("mike");
const cases = [
  ['[{"sku":"APL-001","qtd":1}]', /informe o custo unitário/, "missing"],
  ['[{"sku":"APL-001","qtd":1,"custo_unit":null}]', /informe o custo unitário/, "null"],
  ['[{"sku":"APL-001","qtd":1,"custo_unit":""}]', /informe o custo unitário/, "blank"],
  ['[{"sku":"APL-001","qtd":1,"custo_unit":"abc"}]', /custo inválido/, "invalid"],
  ['[{"sku":"APL-001","qtd":1,"custo_unit":"-1"}]', /custo inválido/, "negative"],
];
for (const [body, re, name] of cases) {
  e = await err(call(body));
  ok(e && re.test(e) && !/abc|-1/.test(e.replace("custo inválido", "")), name + " rejected: " + e);
}
ok(await ownerNum("select count(*) from public.purchases where observacao is distinct from 'historico'") === 0, "rejected costs inserted nothing");
ok(await ownerNum(`select custo_unit::float8 from public.purchases where id = ${oldId}`) === 40, "historical purchase cost unchanged");
ok(await ownerNum("select estoque from public.products where sku = 'APL-001'") === est0, "rejected purchase did not move stock");

const r = (await one(call('[{"sku":"APL-001","qtd":3,"custo_unit":"1.234,56"}]'))).registrar_compra_lote;
ok(Number(r.itens) === 1 && Number(r.total) === 3703.68, "Brazilian comma stored as 1234.56 x 3: " + JSON.stringify(r));
ok(await ownerNum("select custo_unit::float8 from public.purchases where observacao is null") === 1234.56, "unit cost is 1234.56");
ok(await ownerNum("select custo::float8 from public.product_costs where sku = 'APL-001'") === 1234.56, "product unit cost follows the new purchase");
ok(await ownerNum("select estoque from public.products where sku = 'APL-001'") === est0 + 3, "quantity still increases stock");
const z = (await one(call('[{"sku":"APL-001","qtd":1,"custo_unit":"0,00"}]'))).registrar_compra_lote;
ok(Number(z.total) === 0 && Number(z.itens) === 1, "explicit zero stays zero, it is not invented from a blank");
ok(await ownerNum(`select custo_unit::float8 from public.purchases where id = ${oldId}`) === 40, "zero purchase did not rewrite history");

if (fails) { console.error(fails + " failed"); process.exit(1); }
console.log(passes + " passed");
