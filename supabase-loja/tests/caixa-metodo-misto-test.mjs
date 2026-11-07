/* Caixa sem metodo fixo (PGlite). Não conecta em produção.
   node caixa-metodo-misto-test.mjs */
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
const R = new URL("..", import.meta.url).pathname, S = f => fs.readFileSync(R + f, "utf8");
const ids = { mike: "a", sam: "b", hadi: "c", kaio: "d", bianca: "e", suelen: "f", pamela: "1", leticia: "2" };
const U = k => "00000000-0000-0000-0000-00000000000" + ids[k];
let fails = 0, passes = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); c ? passes++ : fails++; };
const db = new PGlite();
await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin; create schema auth; grant usage on schema auth to anon, authenticated; grant usage on schema public to anon, authenticated;
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
const fix = S("fix-caixa-metodo-misto.sql"), back = S("rollback-caixa-metodo-misto.sql");
ok(!/update\s+public\.caixas/i.test(fix), "fix does not write a method onto a caixa");
const fixBody = fix.slice(fix.indexOf("create or replace"), fix.lastIndexOf("notify"));
ok(!/registrar_recebimento_cxesp|caixa_especial_mov|create table/i.test(fixBody), "fix does not touch cxesp or add a retry table");
ok(/sem chave de idempotência/.test(fix), "the file states these RPCs still have no retry key");
ok(/if v_cx is null/.test(fix) && /Forma de pagamento inválida/.test(fix), "fix separates missing caixa from explicit forma");
ok(!/,\s*'dinheiro'\)/.test(fix), "fix does not default a missing form to dinheiro");
const ui = fs.readFileSync(new URL("../../main/app.js", import.meta.url), "utf8");
ok(ui.includes('sb.rpc("registrar_recebimento_credito"') && /forma = \(o\.dataset\.m \|\| \(\$\("#fm"\)/.test(ui), "deployed-style payload sends the selected forma with the caixa id");
const as = k => db.exec(`reset role; select set_config('request.jwt.claims', '${JSON.stringify({ sub: U(k), aal: "aal1" })}', false); set role authenticated;`);
const err = async q => { try { await db.query(q); return null; } catch (e) { return e.message; } };
const one = async q => (await db.query(q)).rows[0];
const num = async q => Number(Object.values(await one(q))[0]);
const ownerNum = async q => { await db.exec("reset role"); return num(q); };

await db.exec("reset role; insert into public.products(sku,marca,produto,preco_venda,estoque) values ('SYN-001','Sint','Fone',100,20)");
await db.exec("insert into public.caixas(nome, metodo) values ('LARANJIHA', null), ('GETNET', null)");
await db.exec(back);
await as("kaio");
const maria = await num("select public.criar_cliente('Maria Souza','11999990000','52998224725')");
await num(`select public.criar_nota('[{"sku":"SYN-001","qtd":1,"preco_vendido":700}]','[{"metodo":"prazo","valor":700}]', null, ${maria})`);
const lar = await ownerNum("select id from public.caixas where nome = 'LARANJIHA'");
const get = await ownerNum("select id from public.caixas where nome = 'GETNET'");
const pix = await ownerNum("select id from public.caixas where nome = 'Caixa PIX (HX)'");
await as("pamela");
let e = await err(`select public.registrar_recebimento_credito(${maria}, 200, ${lar}::smallint, 'pix', '2026-11-07', null)`);
ok(e && /Caixa inválido/.test(e), "live body rejects LARANJIHA plus explicit PIX: " + e);
ok(await ownerNum("select count(*) from public.cliente_recebimentos") === 0, "the rejected call wrote no receipt");
ok(await ownerNum("select count(*) from public.caixa_movimentos where caixa_id = " + lar) === 0, "the rejected call wrote no movement");
ok(await ownerNum("select metodo::text is null from public.caixas where id = " + lar) === 1, "LARANJIHA method stays null");

await db.exec("reset role");
await db.exec(fix);
await as("pamela");
const r = (await one(`select public.registrar_recebimento_credito(${maria}, 200, ${lar}::smallint, 'pix', '2026-11-07', null) j`)).j;
ok(Number(r.quitado) === 200 && Number(r.credito) === 0, "financeiro records 200 PIX on LARANJIHA: " + JSON.stringify(r));
const row = (await db.query(`select r.forma rf, m.forma mf, m.valor::float8 v from public.cliente_recebimentos r join public.caixa_movimentos m on m.id = r.mov_id where r.id = ${r.recebimento_id}`)).rows[0];
ok(row.rf === "pix" && row.mf === "pix" && row.v === 200, "receipt and movement keep explicit PIX: " + JSON.stringify(row));
ok(await ownerNum(`select metodo::text is null from public.caixas where id = ${lar}`) === 1, "the fix did not store PIX on the caixa");
ok(await ownerNum("select count(*) from public.caixa_especial_mov") === 0, "ordinary LARANJIHA receipt does not touch cxesp");
const again = (await one(`select public.registrar_recebimento_credito(${maria}, 200, ${lar}::smallint, 'pix', '2026-11-07', null) j`)).j;
ok(Number(again.recebimento_id) !== Number(r.recebimento_id) && await ownerNum("select count(*) from public.cliente_recebimentos") === 2, "a second successful call posts again; these RPCs have no retry key");

e = await err(`select public.registrar_recebimento_credito(${maria}, 10, ${lar}::smallint, null, null, null)`);
ok(e && /Forma de pagamento inválida/.test(e), "null method caixa requires an explicit form: " + e);
e = await err(`select public.registrar_recebimento_credito(${maria}, 10, ${lar}::smallint, 'boleto', null, null)`);
ok(e && /Forma de pagamento inválida/.test(e), "unknown form is rejected");
const beforeBad = await ownerNum("select count(*) from public.cliente_recebimentos");
ok(beforeBad === 2, "invalid form wrote nothing");
const g = (await one(`select public.registrar_recebimento_credito(${maria}, 20, ${get}::smallint, 'cartao', null, null) j`)).j;
ok(Number(g.quitado) === 20 && (await db.query(`select forma from public.cliente_recebimentos where id = ${g.recebimento_id}`)).rows[0].forma === "cartao", "GETNET accepts cartao without a stored method");
const hx = await num(`select public.registrar_recebimento(${maria}, 15, ${pix}::smallint, null, null, null)`);
ok((await db.query(`select forma from public.cliente_recebimentos where id = ${hx}`)).rows[0].forma === "pix", "a caixa that already has metodo pix still defaults the form");
await db.exec(`reset role; update public.caixas set ativo = false where id = ${lar}`);
await as("pamela");
e = await err(`select public.registrar_recebimento_credito(${maria}, 10, ${lar}::smallint, 'pix', null, null)`);
ok(e && /Caixa inválido/.test(e), "inactive caixa is still Caixa inválido");
await db.exec(`reset role; update public.caixas set ativo = true where id = ${lar}`);
e = await err(`select public.registrar_recebimento_credito(${maria}, 10, 99::smallint, 'pix', null, null)`);
ok(e && /Caixa inválido/.test(e), "missing caixa id is still Caixa inválido");

await as("kaio");
e = await err(`select public.registrar_recebimento_credito(${maria}, 10, ${get}::smallint, 'pix', null, null)`);
ok(e && /Sem permissão/.test(e), "vendedor denied: " + e);
await db.exec("reset role; set role anon");
e = await err(`select public.registrar_recebimento_credito(${maria}, 10, ${get}::smallint, 'pix', null, null)`);
ok(e && /permission denied/.test(e), "anon denied: " + e);
await as("mike");
const adm = (await one(`select public.registrar_recebimento_credito(${maria}, 30, ${lar}::smallint, 'transferencia', null, null) j`)).j;
ok(Number(adm.quitado) === 30, "admin with financas can use the same ordinary caixa");

const saldo = await ownerNum(`select public.cliente_saldo_calc(${maria})`);
const over = (await one(`select public.registrar_recebimento_credito(${maria}, ${saldo + 40}, ${get}::smallint, 'pix', null, null) j`)).j;
ok(Number(over.quitado) === saldo && Number(over.credito) === 40, "excess stays on the same caixa and becomes store credit: " + JSON.stringify(over));
const excess = (await db.query(`select forma from public.caixa_movimentos where caixa_id = ${get} and motivo like 'Crédito Caixa Geral%'`)).rows;
ok(excess.length === 1 && excess[0].forma === "pix", "excess movement keeps the explicit form even though the caixa method is null");
ok(await ownerNum(`select metodo::text is null from public.caixas where id = ${get}`) === 1, "GETNET method stays null");
ok(await ownerNum("select count(*) from public.caixa_especial_mov") === 0, "excess on GETNET still is not cxesp");
ok(await ownerNum("select has_function_privilege('anon', 'public.registrar_recebimento_credito(bigint, numeric, smallint, text, date, text)', 'execute')::int") === 0, "anon has no execute");
ok(await ownerNum("select has_function_privilege('authenticated', 'public.registrar_recebimento_credito(bigint, numeric, smallint, text, date, text)', 'execute')::int") === 1, "authenticated keeps execute");
ok(await ownerNum("select has_function_privilege('service_role', 'public.registrar_recebimento(bigint, numeric, smallint, text, date, text)', 'execute')::int") === 1, "service_role keeps execute");

await db.exec("reset role; alter table public.cliente_creditos add constraint misto_no_exc check (obs is null or obs not like 'Excedente%') not valid");
const rec0 = await ownerNum("select count(*) from public.cliente_recebimentos");
const mov0 = await ownerNum("select count(*) from public.caixa_movimentos");
const cred0 = await ownerNum("select count(*) from public.cliente_creditos");
await as("pamela");
await db.exec("reset role; update public.clientes set ativo = true");
const outro = await ownerNum("select public.criar_cliente('Outro Cliente','11900000000', null)");
await as("kaio");
await num(`select public.criar_nota('[{"sku":"SYN-001","qtd":1,"preco_vendido":50}]','[{"metodo":"prazo","valor":50}]', null, ${outro})`);
await as("pamela");
e = await err(`select public.registrar_recebimento_credito(${outro}, 90, ${lar}::smallint, 'pix', null, null)`);
ok(!!e, "excess insert failure raises: " + e);
ok(await ownerNum("select count(*) from public.cliente_recebimentos") === rec0 && await ownerNum("select count(*) from public.caixa_movimentos") === mov0 && await ownerNum("select count(*) from public.cliente_creditos") === cred0, "failed excess rolls back the debt receipt and the movement");
await db.exec("reset role; alter table public.cliente_creditos drop constraint misto_no_exc");

await db.exec(back);
await as("pamela");
e = await err(`select public.registrar_recebimento_credito(${maria}, 5, ${lar}::smallint, 'pix', null, null)`);
ok(e && /Caixa inválido/.test(e), "rollback restores the null-method rejection");

if (fails) { console.error(fails + " failed"); process.exit(1); }
console.log(passes + " passed");
