// Testes RLS da LOJA em PGlite (auth do Supabase simulado). Rodar: node rls-test.mjs (precisa @electric-sql/pglite)
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
const R = new URL("..", import.meta.url).pathname;
const S = f => fs.readFileSync(R + f, "utf8");
const ids = { mike: "a", sam: "b", hadi: "c", kaio: "d", bianca: "e", suelen: "f", pamela: "1", leticia: "2" };
const U = k => "00000000-0000-0000-0000-00000000000" + ids[k];
const stub = `
create role anon nologin; create role authenticated nologin;
create schema auth; grant usage on schema auth to anon, authenticated; grant usage on schema public to anon, authenticated;
create table auth.users(id uuid primary key, email text);
create table auth.mfa_factors(user_id uuid, status text);
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt()->>'sub','')::uuid $$;
grant execute on all functions in schema auth to anon, authenticated;
insert into auth.users values ${Object.keys(ids).map(k => `('${U(k)}','${k}@loja.bgdstores.local')`).join(",")};`;
let fails = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
const as = (db, k, aal = "aal1") => db.exec(`reset role; select set_config('request.jwt.claims', '${JSON.stringify({ sub: U(k), aal })}', false); set role authenticated;`);
const err = async (db, q) => { try { await db.query(q); return null; } catch (e) { return e.message; } };
const n = async (db, q) => (await db.query(`select count(*)::int n from (${q}) x`)).rows[0].n;
const one = async (db, q) => (await db.query(q)).rows[0];

const db = new PGlite(); await db.exec(stub);
for (const f of ["schema.sql", "schema.sql", "users.sql", "users.sql"]) {
  try { await db.exec(S(f)); console.log("ran " + f); } catch (e) { ok(false, f + ": " + e.message); process.exit(1); }
}
ok(await n(db, "select * from public.profiles") === 8, "users.sql maps 8 profiles (idempotent)");
ok(await n(db, "select * from public.caixas") === 3, "3 caixas seeded once");
ok(await n(db, "select * from public.products") === 0, "loja starts with no products");
// produtos de teste (só no PGlite)
await db.exec("insert into public.products(sku,marca,produto,tamanho,preco_venda,estoque) values ('ARM-001','JBL','Flip 6',null,280,10),('FER-004','Xiaomi','Redmi Buds 5',null,100,10),('CAB-001','Baseus','Cabo USB-C 1m',null,30,0)");

// ---- admin
await as(db, "mike");
await db.query("insert into public.purchases(sku,qtd,custo_unit) values ('FER-004',5,40)");
ok((await one(db, "select estoque from public.products where sku='FER-004'")).estoque === 15, "admin purchase adds stock + cost");
ok(!!(await err(db, "select public.caixa_abrir(1::smallint, 100)")) === false, "admin opens Caixa Dinheiro with 100");

// ---- vendedor
await as(db, "kaio");
const nid = (await one(db, `select public.criar_nota('[{"sku":"ARM-001","qtd":2,"preco_vendido":280},{"sku":"FER-004","qtd":1,"preco_vendido":100}]',
  '[{"metodo":"pix","valor":400},{"metodo":"dinheiro","valor":260}]', 'Cliente') id`)).id;
ok(!!nid, "vendedor creates nota with split payment " + nid);
ok((await one(db, "select estoque from public.products where sku='ARM-001'")).estoque === 8, "stock decremented 10->8");
let e = await err(db, `select public.criar_nota('[{"sku":"FER-004","qtd":1,"preco_vendido":100}]','[{"metodo":"pix","valor":90}]')`);
ok(e && /diferentes do total/.test(e), "payments must sum to total: " + e);
ok((await one(db, "select estoque from public.products where sku='FER-004'")).estoque === 14, "failed nota rolled back stock");
e = await err(db, `select public.criar_nota('[{"sku":"ARM-001","qtd":50,"preco_vendido":1}]','[{"metodo":"pix","valor":50}]')`);
ok(e && /Estoque insuficiente/.test(e), "insufficient stock refused");
ok(await n(db, "select * from public.v_nota_itens where nota_id=" + nid) === 2, "vendedor reads own receipt");
ok(await n(db, "select * from public.nota_pagamentos where nota_id=" + nid) === 2, "vendedor reads own nota payments");
ok(await n(db, "select * from public.estoque_vendedor") === 3, "vendedor reads estoque_vendedor");
ok(Object.keys((await db.query("select * from public.estoque_vendedor limit 1")).rows[0]).join() === "sku,marca,produto,tamanho,estoque", "estoque_vendedor has no cost/price columns");
for (const t of ["product_costs", "sale_costs", "purchases", "v_admin_products", "v_report_profit", "v_report_seller", "v_report_payment",
                 "caixas", "caixa_movimentos", "caixa_sessoes", "v_caixa_saldo", "v_caixa_extrato"])
  ok(await n(db, "select * from public." + t) === 0, "vendedor sees 0 rows in " + t);
ok(!!(await err(db, "insert into public.caixa_movimentos(caixa_id,tipo,valor,motivo) values (1,'entrada',10,'teste')")), "vendedor cannot post caixa movement");
ok(!!(await err(db, "select public.caixa_abrir(2::smallint, 0)")), "vendedor cannot open caixa");
ok(!!(await err(db, "insert into public.notas(cliente) values ('x')")), "vendedor cannot insert nota directly (RPC only)");
ok(!!(await err(db, `insert into public.sales(nota_id,sku,qtd,preco_vendido) values (${nid},'FER-004',1,1)`)), "vendedor cannot insert sales directly");
ok(!!(await err(db, `select public.cancelar_nota(${nid}, 'teste')`)), "vendedor cannot cancel nota");
ok(!!(await err(db, "update public.profiles set role='admin' where handle='@kaio'")) || (await one(db, "select role from public.profiles where handle='@kaio'")).role === "vendedor", "vendedor cannot promote self");
await as(db, "bianca");
ok(await n(db, "select * from public.v_nota_itens") === 0, "other vendedor cannot see Kaio's nota");

// ---- financeiro
await as(db, "pamela");
for (const t of ["products", "product_costs", "sale_costs", "purchases", "notas", "sales", "nota_pagamentos", "v_nota_itens", "v_notas",
                 "estoque_vendedor", "v_admin_products", "v_report_profit", "v_report_seller", "v_report_payment"])
  ok(await n(db, "select * from public." + t) === 0, "financeiro sees 0 rows in " + t);
ok(!!(await err(db, `select public.criar_nota('[{"sku":"FER-004","qtd":1,"preco_vendido":100}]','[{"metodo":"pix","valor":100}]')`)), "financeiro cannot create nota");
const sal = Object.fromEntries((await db.query("select metodo, saldo::numeric s from public.v_caixa_saldo")).rows.map(r => [r.metodo, Number(r.s)]));
ok(sal.pix === 400 && sal.dinheiro === 260 && sal.cartao === 0, "financeiro sees caixa balances from nota: " + JSON.stringify(sal));
e = await err(db, "insert into public.caixa_movimentos(caixa_id,tipo,valor) values (1,'saida',50)");
ok(!!e, "manual saída without motivo refused");
await db.query("insert into public.caixa_movimentos(caixa_id,tipo,valor,motivo) values (1,'saida',50,'Troco banco')");
ok(!!(await err(db, "insert into public.caixa_movimentos(caixa_id,tipo,valor,motivo,nota_id) values (1,'venda',50,'fake'," + nid + ")")), "financeiro cannot forge venda movement");
ok(!!(await err(db, "update public.caixa_movimentos set valor=1")), "movements are immutable (no update)");
ok(!!(await err(db, "delete from public.caixa_movimentos")) || await n(db, "select * from public.caixa_movimentos") === 3, "movements cannot be deleted");
ok(await n(db, "select * from public.v_caixa_extrato where handle is not null") === 3, "extrato shows who posted each movement");
ok(!!(await err(db, "select public.caixa_abrir(1::smallint, 0)")), "caixa cannot be opened twice the same day");
const dif = Number((await one(db, "select public.caixa_fechar(1::smallint, 200) d")).d);
ok(dif === -10, "fechamento: counted 200 vs system 210 => diferença -10 (" + dif + ")");
{ let r = null; try { r = await db.query("update public.products set preco_venda=1 returning sku"); } catch (x) {} ok(!r || r.rows.length === 0, "financeiro cannot change products"); }

// ---- admin cancels -> estorno
await as(db, "sam");
await db.query(`select public.cancelar_nota(${nid}, 'Cliente desistiu')`);
ok((await one(db, "select estoque from public.products where sku='ARM-001'")).estoque === 10, "cancel restores stock");
const s2 = Object.fromEntries((await db.query("select metodo, saldo::numeric s from public.v_caixa_saldo")).rows.map(r => [r.metodo, Number(r.s)]));
ok(s2.pix === 0 && s2.dinheiro === -50, "cancel posts estornos: " + JSON.stringify(s2));
ok(await n(db, "select * from public.caixa_movimentos where tipo='estorno'") === 2, "2 estorno movements");
ok(!!(await err(db, `select public.cancelar_nota(${nid}, 'de novo')`)), "cannot cancel twice");
ok(await n(db, "select * from public.v_report_seller") === 0, "cancelled nota excluded from reports");
ok(await n(db, "select * from public.product_costs") > 0 && await n(db, "select * from public.v_admin_products") === 3, "admin reads costs + export view");
await db.query("update public.profiles set role='financeiro' where handle='@bianca'");
await as(db, "bianca"); ok(await n(db, "select * from public.v_caixa_saldo") === 3 && await n(db, "select * from public.products") === 0, "role change via profiles takes effect (bianca -> financeiro)");
// MFA
await db.exec(`reset role; insert into auth.mfa_factors values ('${U("mike")}','verified')`);
await as(db, "mike", "aal1"); ok(await n(db, "select * from public.v_caixa_saldo") === 0 && await n(db, "select * from public.products") === 0, "admin with 2FA at aal1 sees nothing");
await as(db, "mike", "aal2"); ok(await n(db, "select * from public.v_caixa_saldo") === 3, "admin at aal2 sees caixa");
// anon
await db.exec("reset role; select set_config('request.jwt.claims','{}',false); set role anon;");
for (const t of ["products", "caixas", "caixa_movimentos", "notas", "v_caixa_saldo"]) ok(!!(await err(db, "select * from public." + t)), "anon blocked from " + t);
ok(!!(await err(db, "select public.criar_nota('[]','[]')")), "anon cannot call criar_nota");
console.log(fails ? `${fails} FAILURES` : "ALL PASS");
process.exit(fails ? 1 : 0);
