import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
const S = f => fs.readFileSync(f, "utf8");
const stub = `
create role anon nologin; create role authenticated nologin;
create schema auth; grant usage on schema auth to anon, authenticated; grant usage on schema public to anon, authenticated;
create table auth.users(id uuid primary key, email text);
create table auth.mfa_factors(user_id uuid, status text);
create table auth.sessions(id uuid primary key, user_id uuid); create table auth.refresh_tokens(id bigserial primary key, session_id uuid);
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt()->>'sub','')::uuid $$;
grant execute on all functions in schema auth to anon, authenticated;
insert into auth.users values ('00000000-0000-0000-0000-00000000000a','mahdibassal@icloud.com'),('00000000-0000-0000-0000-00000000000b','kaio@sistema.bgdstores.local'),('00000000-0000-0000-0000-00000000000c','suelen@sistema.bgdstores.local');`;
const R = process.env.R || new URL("../", import.meta.url).pathname;
let fails = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
async function as(db, uid, aal = "aal1") {
  await db.exec(`reset role; select set_config('request.jwt.claims', '${JSON.stringify({ sub: uid, aal })}', false); set role authenticated;`);
}
async function err(db, q) { try { await db.query(q); return null; } catch (e) { return e.message; } }
async function suite(label, files) {
  console.log("== " + label);
  const db = new PGlite(); await db.exec(stub);
  for (const f of files) { try { await db.exec(S(f.startsWith("/") ? f : R + f)); console.log("ran " + f); } catch (e) { ok(false, f + ": " + e.message); return; } }
  await db.exec(S(R + "users.sql"));
  const A = "00000000-0000-0000-0000-00000000000a", K = "00000000-0000-0000-0000-00000000000b", U = "00000000-0000-0000-0000-00000000000c";
  ok((await db.query("select count(*)::int n from public.profiles")).rows[0].n === 3, "users.sql maps existing users (3 of 8 stubbed)");
  await db.exec(S(R + "users.sql")); ok(true, "users.sql re-run idempotent");
  await db.exec("update public.products set estoque=3 where sku='ARM-001'");
  await as(db, A);
  await db.query("insert into public.purchases(sku,qtd,custo_unit) values ('FER-004',5,40)");
  ok((await db.query("select estoque from public.products where sku='FER-004'")).rows[0].estoque === 5, "admin purchase adds stock");
  // seller
  await as(db, K);
  for (const t of ["product_costs", "sale_costs", "purchases", "v_report_seller", "v_report_payment", "v_report_profit", "v_low_stock", "v_admin_products"]) {
    const r = await db.query(`select count(*)::int n from public.${t}`); ok(r.rows[0].n === 0, `seller sees 0 rows in ${t}`);
  }
  const ev = await db.query("select * from public.estoque_vendedor order by sku");
  ok(ev.rows.length > 100, "seller reads estoque_vendedor (" + ev.rows.length + " rows)");
  ok(JSON.stringify(Object.keys(ev.rows[0])) === JSON.stringify(["sku","marca","produto","tamanho","estoque"]), "estoque_vendedor columns: " + Object.keys(ev.rows[0]).join(","));
  ok(!!(await err(db, "update public.estoque_vendedor set estoque=99 where sku='ARM-001'")) || (await db.query("select estoque from public.products where sku='ARM-001'")).rows[0].estoque !== 99, "seller cannot write via estoque_vendedor");
  ok(!!(await err(db, "insert into public.product_costs values ('ARM-001',1)")), "seller cannot write cost");
  ok(!!(await err(db, "update public.products set preco_venda=1 where sku='ARM-001'")) || (await db.query("select preco_venda from public.products where sku='ARM-001'")).rows[0].preco_venda != 1, "seller cannot change price");
  const n = (await db.query(`select public.criar_nota('PIX', '[{"sku":"ARM-001","qtd":2,"preco_vendido":270},{"sku":"FER-004","qtd":1,"preco_vendido":100}]'::jsonb, 'Cliente') id`)).rows[0].id;
  ok(!!n, "seller creates nota " + n);
  ok((await db.query("select estoque from public.products where sku='ARM-001'")).rows[0].estoque === 1, "trigger decremented ARM-001 3->1");
  const e = await err(db, `select public.criar_nota('PIX','[{"sku":"FER-004","qtd":1,"preco_vendido":100},{"sku":"ARM-001","qtd":5,"preco_vendido":1}]'::jsonb)`);
  ok(e && /Estoque insuficiente/.test(e), "insufficient stock refused: " + e);
  ok((await db.query("select estoque from public.products where sku='FER-004'")).rows[0].estoque === 4, "failed nota rolled back (FER-004 still 4)");
  const it = await db.query("select * from public.v_nota_itens where nota_id=$1", [n]);
  ok(it.rows.length === 2 && it.rows[0].handle === "@kaio", "seller reads own receipt");
  ok(!Object.keys(it.rows[0]).some(k => /custo/.test(k)), "receipt has no cost column");
  ok(!!(await err(db, "insert into public.notas(forma_pagamento,seller_id) values ('PIX','" + U + "') returning id")) || (await db.query("select count(*)::int n from public.notas where seller_id='" + U + "'")).rows[0].n === 0, "seller cannot create nota for another seller");
  ok(!!(await err(db, "delete from public.sales")) || (await db.query("select count(*)::int n from public.sales")).rows[0].n === 2, "seller cannot delete sales");
  await as(db, U);
  ok((await db.query("select count(*)::int n from public.v_nota_itens")).rows[0].n === 0, "other seller cannot see Kaio's nota");
  ok(!!(await err(db, `insert into public.sales(nota_id,sku,qtd,preco_vendido,forma_pagamento) values (${n},'FER-004',1,1,'PIX')`)), "other seller cannot add items to Kaio's nota");
  await db.exec("reset role; select set_config('request.jwt.claims','{}',false); set role anon;");
  ok(!!(await err(db, "select * from public.products")), "anon blocked from products");
  ok(!!(await err(db, "select public.criar_nota('PIX','[]')")), "anon cannot call criar_nota");
  ok(!!(await err(db, "select * from public.estoque_vendedor")), "anon blocked from estoque_vendedor");
  // MFA
  await db.exec(`reset role; insert into auth.mfa_factors values ('${A}','verified')`);
  await as(db, A, "aal1"); ok((await db.query("select count(*)::int n from public.v_admin_products")).rows[0].n === 0, "admin with 2FA but aal1 sees nothing");
  await as(db, A, "aal2");
  const ap = await db.query("select * from public.v_admin_products where sku='FER-004'");
  ok(ap.rows.length === 1 && Number(ap.rows[0].custo) === 40, "admin export view has cost");
  ok((await db.query("select count(*)::int n from public.estoque_vendedor")).rows[0].n > 100, "admin still reads estoque_vendedor");
  ok((await db.query("select count(*)::int n from public.product_costs")).rows[0].n > 0, "admin still reads product_costs");
  ok((await db.query("select sum(lucro)::numeric l from public.v_report_profit")).rows[0].l != null, "admin profit report works");
  ok((await db.query("select count(*)::int n from public.v_report_payment")).rows[0].n === 1, "admin payment report works");
  await db.query("delete from public.notas where id=$1", [n]);
  ok((await db.query("select estoque from public.products where sku='ARM-001'")).rows[0].estoque === 3, "admin deleting nota restores stock");
  // ---------- migration-004: trava, log, sessões ----------
  if (!files.some(f => f.includes("migration-004"))) return;
  await db.exec(`reset role; delete from auth.mfa_factors; insert into auth.sessions values ('00000000-0000-0000-0000-0000000000f1','${K}'); insert into auth.refresh_tokens(session_id) values ('00000000-0000-0000-0000-0000000000f1');`);
  await as(db, K);
  ok(!!(await err(db, "select public.lock_system('x')")), "seller cannot lock");
  ok(!!(await err(db, "select public.signout_all()")), "seller cannot sign out all");
  ok(!!(await err(db, "select * from public.system_settings")), "staff cannot read system_settings directly");
  ok((await db.query("select count(*)::int n from public.security_events")).rows[0].n === 0, "seller sees 0 security_events");
  await db.exec("reset role; insert into auth.users values ('00000000-0000-0000-0000-00000000000d','samer@x.com'); insert into public.profiles(id,handle,nome,role) values ('00000000-0000-0000-0000-00000000000d','@samer','Samer','admin')");
  const D = "00000000-0000-0000-0000-00000000000d";
  ok((await db.query("select count(*)::int n from public.security_events where kind='admin_added'")).rows[0].n >= 1, "new admin logged as admin_added");
  await as(db, D);
  ok(!!(await err(db, `update public.profiles set role='seller' where id='${A}'`)), "non-owner admin cannot demote owner");
  ok(!(await err(db, `update public.profiles set ativo=false where id='${U}'`)), "admin can deactivate seller");
  await db.exec("reset role"); ok((await db.query("select count(*)::int n from public.security_events where kind='role_change'")).rows[0].n === 1, "role/ativo change logged by trigger");
  await db.exec(`update public.profiles set ativo=true where id='${U}'`);
  await as(db, D);
  await db.query("select public.lock_system('teste')");
  ok((await db.query("select public.system_status() s")).rows[0].s.locked === true, "non-owner admin locked the system");
  ok(!!(await err(db, "select public.unlock_system()")), "non-owner admin cannot unlock");
  for (const [who, uid] of [["admin", D], ["seller", K]]) { await as(db, uid);
    for (const t of ["products", "estoque_vendedor", "notas", "v_nota_itens", "profiles", "product_costs", "security_events"]) {
      const r = await db.query(`select count(*)::int n from public.${t}`); ok(r.rows[0].n === 0, `LOCKED: ${who} sees 0 rows in ${t}`); }
    ok(!!(await err(db, `select public.criar_nota('PIX','[{"sku":"FER-004","qtd":1,"preco_vendido":100}]'::jsonb)`)), `LOCKED: ${who} cannot create nota`);
  }
  await as(db, D); ok(!!(await err(db, "insert into public.purchases(sku,qtd,custo_unit) values ('FER-004',1,1)")), "LOCKED: admin cannot insert purchase");
  await as(db, A);
  ok((await db.query("select count(*)::int n from public.products")).rows[0].n > 100, "LOCKED: owner still reads products");
  ok((await db.query("select count(*)::int n from public.product_costs")).rows[0].n > 0, "LOCKED: owner still reads costs");
  ok((await db.query("select public.system_status() s")).rows[0].s.is_owner === true, "owner detected");
  ok((await db.query("select public.signout_all() n")).rows[0].n === 1, "owner signs out all sessions");
  await db.exec("reset role"); ok((await db.query("select count(*)::int n from auth.refresh_tokens")).rows[0].n === 0, "refresh tokens deleted");
  await as(db, A); await db.query("select public.unlock_system()");
  await as(db, K); ok((await db.query("select count(*)::int n from public.estoque_vendedor")).rows[0].n > 100, "UNLOCKED: seller reads stock again");
  await db.exec("reset role; select set_config('request.jwt.claims','{}',false); set role anon;");
  for (let i = 0; i < 8; i++) await db.query("select public.report_failed_login('x@y.com')");
  ok(!!(await err(db, "select * from public.security_events")), "anon cannot read security_events");
  ok(!!(await err(db, "select public.lock_system('x')")), "anon cannot lock");
  await db.exec("reset role"); ok((await db.query("select count(*)::int n from public.security_events where kind='failed_login'")).rows[0].n === 5, "failed_login rate limited to 5/min per email");
  const kinds = (await db.query("select string_agg(distinct kind, ',' order by kind) k from public.security_events")).rows[0].k;
  ok(/lock/.test(kinds) && /unlock/.test(kinds) && /signout_all/.test(kinds), "lock/unlock/signout logged: " + kinds);
}
await suite("UPGRADE: old schema + seed + migration-002 x2", ["/tmp/pgt/schema-old.sql", "seed-produtos.sql", "migration-002.sql", "migration-002.sql", "migration-003.sql", "migration-003.sql", "migration-004.sql", "migration-004.sql"]);
await suite("FRESH: new schema + seed (+ migration re-run)", ["schema.sql", "seed-produtos.sql", "migration-002.sql", "migration-003.sql", "migration-004.sql", "schema.sql", "migration-002.sql", "migration-003.sql", "migration-004.sql"]);
console.log(fails ? `${fails} FAILURES` : "ALL PASS");
