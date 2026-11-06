/* Adicionar dívida (PGlite). Não conecta em produção.
   node adicionar-divida-test.mjs */
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
const R = new URL("..", import.meta.url).pathname, S = f => fs.readFileSync(R + f, "utf8");
const ids = { mike: "a", sam: "b", hadi: "c", kaio: "d", bianca: "e", suelen: "f", pamela: "1", leticia: "2" };
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
const files = ["schema.sql", "users.sql", "security.sql", "migration-clientes.sql", "migration-caixa-resumo.sql",
  "fix-security-events-kinds.sql", "migration-caixa-geral.sql", "migration-receber-credito.sql", "migration-estornos.sql",
  "migration-caixa-metodo-null.sql", "migration-receber-caixa-especial.sql"];
for (const f of files) {
  try { await db.exec(S(f)); console.log("ran " + f); }
  catch (e) { console.error("FAIL load " + f + ": " + e.message); process.exit(1); }
}
await db.exec("alter table public.notas add column if not exists frete numeric(12,2) not null default 0");
try { await db.exec(S("migration-adicionar-divida.sql")); console.log("ran migration-adicionar-divida.sql"); }
catch (e) { console.error("FAIL load migration-adicionar-divida.sql: " + e.message); process.exit(1); }
ok(!/create or replace function public\.frete_dia/.test(S("migration-adicionar-divida.sql")), "migration does not create frete_dia");
ok(!/add column if not exists frete/.test(S("migration-adicionar-divida.sql")), "migration does not create notas.frete");
ok(/DÍVIDA ANTERIOR%/.test(S("migration-adicionar-divida.sql")) && /v_report_payment/.test(S("migration-adicionar-divida.sql")), "payment report excludes the legacy label");
const as = k => db.exec(`reset role; select set_config('request.jwt.claims', '${JSON.stringify({ sub: U(k), aal: "aal1" })}', false); set role authenticated;`);
const err = async q => { try { await db.query(q); return null; } catch (e) { return e.message; } };
const one = async q => (await db.query(q)).rows[0];
const num = async q => Number(Object.values(await one(q))[0]);
const ownerNum = async q => { await db.exec("reset role"); return num(q); };
const ui = fs.readFileSync(new URL("../../main/app.js", import.meta.url), "utf8");
const sql = S("migration-adicionar-divida.sql");
ok(/Adicionar dívida/.test(ui) && /isAdm \?/.test(ui) && ui.includes("migration-adicionar-divida.sql"), "UI form is admin-only and names the SQL file");
ok(!/create or replace function public\.criar_nota/.test(sql), "migration does not replace criar_nota");
ok(!/insert into public\.(caixa_especial_mov|cliente_creditos|caixa_movimentos)/.test(sql), "migration does not insert cash, credit, or cxesp");

await db.exec("reset role; insert into public.products(sku,marca,produto,preco_venda,estoque) values ('APL-001','Apple','AirPods 4',1000,50)");
const est0 = await ownerNum("select estoque from public.products where sku = 'APL-001'");
const cx0 = await ownerNum("select id from public.caixas where nome = 'Caixa Dinheiro'");

await as("kaio");
const maria = await num("select public.criar_cliente('Maria Souza','11999990000','52998224725')");
await num(`select public.criar_nota('[{"sku":"APL-001","qtd":1,"preco_vendido":100}]','[{"metodo":"prazo","valor":100}]', null, ${maria})`);
const estAfterSale = await ownerNum("select estoque from public.products where sku = 'APL-001'");
ok(estAfterSale === est0 - 1, "ordinary sale still moves stock");
let e = await err(`select public.criar_nota('[]','[{"metodo":"prazo","valor":10}]', null, ${maria})`);
ok(e && /Nota sem itens/.test(e), "ordinary empty note still rejected: " + e);

await as("pamela");
e = await err(`select public.adicionar_divida(${maria}, 40, 'frete antigo', 'fin-chave-01')`);
ok(e && /Somente admin/.test(e), "financeiro denied: " + e);
await as("kaio");
e = await err(`select public.adicionar_divida(${maria}, 40, null, 'vend-chave1')`);
ok(e && /Somente admin/.test(e), "vendedor denied: " + e);
await db.exec("reset role; select set_config('request.jwt.claims','{}', false); set role anon;");
e = await err(`select public.adicionar_divida(${maria}, 40, null, 'anon-chave1')`);
ok(!!e, "anon denied: " + e);
ok(await ownerNum("select count(*) from public.divida_legado_idem") === 0, "denied calls wrote no debt");

await as("mike");
const mov0 = await ownerNum("select count(*) from public.caixa_movimentos");
const cred0 = await ownerNum("select count(*) from public.cliente_creditos");
const esp0 = await ownerNum("select count(*) from public.caixa_especial_mov");
const saldo0 = await num(`select public.cliente_saldo_calc(${maria})`);
const r1 = (await one(`select public.adicionar_divida(${maria}, 80.126, 'frete da moto', 'chave-maria-80') j`)).j;
ok(r1.idempotente === false && Number(r1.valor) === 80.13 && Number(r1.frete) === 80.13 && r1.rotulo === "DÍVIDA ANTERIOR", "admin adds 80.13 of legacy debt: " + JSON.stringify(r1));
ok(Math.round((Number(r1.saldo) - Number(saldo0)) * 100) === 8013, "open balance grew by exactly 80.13");
await db.exec("reset role");
const nrow = (await db.query(`select frete::float8 frete, total::float8 total, obs_pagamento obs, status from public.notas where id = ${r1.nota_id}`)).rows[0];
ok(nrow.frete === 80.13 && nrow.total === 80.13 && nrow.status === "ativa" && nrow.obs.startsWith("DÍVIDA ANTERIOR — frete da moto"), "note is frete-only and labeled: " + nrow.obs);
ok((await db.query(`select metodo::text m, valor::float8 v from public.nota_pagamentos where nota_id = ${r1.nota_id}`)).rows[0].m === "prazo", "payment is prazo");
ok(await ownerNum(`select count(*) from public.sales where nota_id = ${r1.nota_id}`) === 0, "no sale lines");
ok(await ownerNum("select estoque from public.products where sku = 'APL-001'") === estAfterSale, "stock unchanged by the debt");
ok(await ownerNum("select count(*) from public.caixa_movimentos") === mov0, "no caixa movement");
ok(await ownerNum("select count(*) from public.cliente_creditos") === cred0, "no customer credit");
ok(await ownerNum("select count(*) from public.caixa_especial_mov") === esp0, "no cxesp movement");
await as("mike");
const again = (await one(`select public.adicionar_divida(${maria}, 80.13, 'frete da moto', 'chave-maria-80') j`)).j;
ok(again.idempotente === true && Number(again.nota_id) === Number(r1.nota_id), "same key does not create a second note");
ok(await ownerNum("select count(*) from public.divida_legado_idem") === 1, "one idempotency row");
e = await err(`select public.adicionar_divida(${maria}, 10, null, 'chave-maria-80')`);
ok(e && /Chave já usada/.test(e), "same key with another amount is rejected");
const inativo = await num("select public.criar_cliente('Inativo Teste','11900000000', null)");
await db.exec(`reset role; update public.clientes set ativo = false where id = ${inativo}`);
await as("mike");
e = await err(`select public.adicionar_divida(${inativo}, 15, null, 'chave-inativo1')`);
ok(e && /Cliente inativo/.test(e), "inactive client rejected: " + e);
e = await err(`select public.adicionar_divida(${maria}, 0, null, 'chave-zero-01')`);
ok(e && /Valor inválido/.test(e), "zero rejected");
e = await err(`select public.adicionar_divida(99999, 10, null, 'chave-ausente')`);
ok(e && /Cliente não encontrado/.test(e), "unknown client rejected");

await as("pamela");
const rec = await num(`select public.registrar_recebimento(${maria}::bigint, 30::numeric, ${cx0}::smallint, 'dinheiro', null::date, 'parte')`);
const saldoPay = await ownerNum(`select public.cliente_saldo_calc(${maria})`);
ok(Math.round((Number(saldo0) + 80.13 - 30) * 100) === Math.round(saldoPay * 100), "repayment reduces the same debt: " + saldoPay);
ok(await ownerNum("select count(*) from public.caixa_movimentos") === mov0 + 1, "only the receipt entered the caixa");
await as("mike");
const prazoFat = await num("select coalesce(sum(faturamento),0)::float8 from public.v_report_payment where forma_pagamento::text = 'prazo'");
ok(prazoFat === 100, "daily payment report keeps the real prazo sale and excludes the debt: " + prazoFat);
ok(await ownerNum("select count(*) from pg_proc where proname = 'frete_dia'") === 0, "frete_dia stays absent");

await as("mike");
await db.query(`select public.cancelar_nota(${r1.nota_id}, 'lancamento errado')`);
const saldoCancel = await ownerNum(`select public.cliente_saldo_calc(${maria})`);
ok(Math.round((Number(saldo0) - 30) * 100) === Math.round(saldoCancel * 100), "cancel removes the debt and leaves the receipt: " + saldoCancel);
ok(await ownerNum("select estoque from public.products where sku = 'APL-001'") === estAfterSale, "cancel did not change stock");
await db.exec("reset role");
ok((await db.query(`select status from public.notas where id = ${r1.nota_id}`)).rows[0].status === "cancelada", "note cancelled");

if (fails) { console.error(fails + " failed"); process.exit(1); }
console.log(passes + " passed");
