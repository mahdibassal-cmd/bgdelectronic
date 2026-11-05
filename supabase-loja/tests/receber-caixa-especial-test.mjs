// CAIXA SPECIAL em Contas a receber (PGlite). Não conecta em produção.
// Rodar: node receber-caixa-especial-test.mjs
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
  "migration-caixa-metodo-null.sql", "migration-receber-caixa-especial.sql", "migration-receber-caixa-especial.sql"];
for (const f of files) {
  try { await db.exec(S(f)); console.log("ran " + f); }
  catch (e) { console.error("FAIL load " + f + ": " + e.message); process.exit(1); }
}
const as = k => db.exec(`reset role; select set_config('request.jwt.claims', '${JSON.stringify({ sub: U(k), aal: "aal1" })}', false); set role authenticated;`);
const err = async q => { try { await db.query(q); return null; } catch (e) { return e.message; } };
const one = async q => (await db.query(q)).rows[0];
const num = async q => Number(Object.values(await one(q))[0]);
const ui = fs.readFileSync(new URL("../../main/app.js", import.meta.url), "utf8");
ok(/isAdm \? `<option value="cxesp" data-m="dinheiro">Entrada dinheiro — CAIXA SPECIAL<\/option>` : ""/.test(ui), "UI option Entrada dinheiro — CAIXA SPECIAL is admin-only and cash");
ok(ui.includes("migration-receber-caixa-especial.sql") && ui.includes("Nada foi lançado"), "UI names the SQL file when the RPC is missing");
ok(ui.includes('sb.rpc("registrar_recebimento_credito"'), "ordinary receipt still calls registrar_recebimento_credito");
ok(!/insert into public\.caixas[\s\S]{0,200}CAIXA SPECIAL/.test(S("migration-receber-caixa-especial.sql")), "migration does not insert a CAIXA SPECIAL caixa");

await db.exec("reset role; insert into public.products(sku,marca,produto,preco_venda,estoque) values ('APL-001','Apple','AirPods 4',1000,50)");
await db.exec("insert into public.caixas(nome, metodo) values ('LARANJIHA', null), ('GETNET', null)");
const caixasAntes = await num("select count(*) from public.caixas");
ok(await num("select count(*) from public.caixas where nome = 'CAIXA SPECIAL'") === 0, "no public.caixas row named CAIXA SPECIAL");
ok(await num("select count(*) from public.caixas where nome in ('LARANJIHA','GETNET')") === 2, "LARANJIHA and GETNET remain normal caixas");

await as("kaio");
const maria = await num("select public.criar_cliente('Maria Souza','11999990000','52998224725')");
const n1 = await num(`select public.criar_nota('[{"sku":"APL-001","qtd":1,"preco_vendido":700}]','[{"metodo":"prazo","valor":700}]', null, ${maria})`);
const n2 = await num(`select public.criar_nota('[{"sku":"APL-001","qtd":1,"preco_vendido":300}]','[{"metodo":"prazo","valor":300}]', null, ${maria})`);
const joao = await num("select public.criar_cliente('Joao Lima','11988881111', null)");
const nj = await num(`select public.criar_nota('[{"sku":"APL-001","qtd":1,"preco_vendido":400}]','[{"metodo":"prazo","valor":400}]', null, ${joao})`);
const ana = await num("select public.criar_cliente('Ana Costa','11977772222', null)");
const na = await num(`select public.criar_nota('[{"sku":"APL-001","qtd":1,"preco_vendido":100}]','[{"metodo":"prazo","valor":100}]', null, ${ana})`);
const pedro = await num("select public.criar_cliente('Pedro Alves','11966663333', null)");
await db.query(`select public.criar_nota('[{"sku":"APL-001","qtd":1,"preco_vendido":100}]','[{"metodo":"prazo","valor":100}]', null, ${pedro})`);

const ownerNum = async q => { await db.exec("reset role"); return num(q); };
const cxMov = () => ownerNum("select count(*) from public.caixa_movimentos");
const cxEsp = () => ownerNum("select count(*) from public.caixa_especial_mov");
const mov0 = await cxMov();

await as("pamela");
let e = await err(`select public.registrar_recebimento_cxesp(${maria}, 50, 'pix', null, null, 'fin-chave-01')`);
ok(e && /Somente admin/.test(e), "financeiro denied: " + e);
ok(await cxEsp() === 0 && await cxMov() === mov0, "financeiro denial wrote nothing");
await as("kaio");
e = await err(`select public.registrar_recebimento_cxesp(${maria}, 50, 'pix', null, null, 'vend-chave01')`);
ok(e && /Somente admin/.test(e), "vendedor denied: " + e);
await db.exec("reset role; select set_config('request.jwt.claims','{}', false); update public.profiles set ativo = false where handle = '@hadi'");
await as("hadi");
e = await err(`select public.registrar_recebimento_cxesp(${maria}, 50, 'pix', null, null, 'hadi-chave1')`);
ok(e && /Somente admin/.test(e), "inactive admin denied: " + e);
await db.exec("reset role; select set_config('request.jwt.claims','{}', false); update public.profiles set ativo = true where handle = '@hadi'");
await db.exec("reset role; select set_config('request.jwt.claims','{}', false); set role anon;");
e = await err(`select public.registrar_recebimento_cxesp(${maria}, 50, 'pix', null, null, 'anon-chave1')`);
ok(!!e, "anon denied: " + e);
ok(await cxEsp() === 0, "denied calls created no cxesp row");

await as("mike");
const antes = await cxMov();
const r1 = (await one(`select public.registrar_recebimento_cxesp(${maria}, 800, 'pix', null, 'parcela', 'chave-maria-800') j`)).j;
ok(Number(r1.quitado) === 800 && Number(r1.credito) === 0 && r1.destino === "cxesp" && r1.idempotente === false, "admin receipt allocates full 800 without excess");
ok(await cxEsp() === 1, "exactly one cxesp entrada");
ok((await one("select tipo, valor::float8 v from public.caixa_especial_mov")).tipo === "entrada" && Number((await one("select valor::float8 v from public.caixa_especial_mov")).v) === 800, "entrada is 800");
ok(await cxMov() === antes, "special receipt did not touch caixa_movimentos");
ok(await num("select count(*) from public.caixas") === caixasAntes, "special receipt did not add a caixa");
const al = (await db.query(`select nota_id::int, valor::float8 v from public.recebimento_notas where recebimento_id = ${r1.recebimento_id} order by nota_id`)).rows;
ok(al.length === 2 && al[0].nota_id === n1 && al[0].v === 700 && al[1].nota_id === n2 && al[1].v === 100, "allocated oldest first 700 + 100");
ok(await num(`select saldo::float8 from public.v_clientes_saldo where id = ${maria}`) === 200, "debt left 200");
const r1b = (await one(`select public.registrar_recebimento_cxesp(${maria}, 800, 'pix', null, 'parcela', 'chave-maria-800') j`)).j;
ok(r1b.idempotente === true && Number(r1b.recebimento_id) === Number(r1.recebimento_id) && await cxEsp() === 1, "same chave does not create a second entrada");
e = await err(`select public.registrar_recebimento_cxesp(${maria}, 100, 'pix', null, null, 'chave-maria-800')`);
ok(e && /Chave já usada/.test(e) && await cxEsp() === 1, "same chave with another amount is refused: " + e);

const r2 = (await one(`select public.registrar_recebimento_cxesp(${joao}, 650, 'transferencia', null, null, 'chave-joao-650') j`)).j;
ok(Number(r2.quitado) === 400 && Number(r2.credito) === 250 && await num(`select valor::float8 from public.caixa_especial_mov where id = ${r2.cxesp_id}`) === 650, "excess: one entrada of 650, debt 400, credit 250");
ok(await num(`select saldo::float8 from public.v_cliente_credito where cliente_id = ${joao}`) === 250, "excess became customer credit");
ok(await num(`select saldo::float8 from public.v_clientes_saldo where id = ${joao}`) === 0, "Joao debt cleared");
ok((await one(`select caixa from public.v_recebimentos where id = ${r2.recebimento_id}`)).caixa === "CAIXA SPECIAL", "history label is CAIXA SPECIAL");
const saidasAntes = await num("select count(*) from public.caixa_especial_mov where tipo = 'saida'");
const est = (await one(`select public.estornar_recebimento(${r2.recebimento_id}, 'cliente devolveu') j`)).j;
ok(est.ja_estornado !== true && Number(est.cxesp_saida) > 0 && est.mov_saida == null, "estorno returns linked cxesp saida and no caixa mov");
ok(await num("select count(*) from public.caixa_especial_mov where tipo = 'saida'") === saidasAntes + 1, "exactly one cxesp saida");
ok(await num(`select count(*) from public.caixa_especial_mov e where e.estorno_de = ${r2.cxesp_id}`) === 1, "saida is linked to that entrada");
ok(await num(`select saldo::float8 from public.v_clientes_saldo where id = ${joao}`) === 400, "debt reopened");
ok(await num(`select count(*) from public.v_cliente_credito where cliente_id = ${joao}`) === 0 || await num(`select coalesce(sum(case when tipo='entrada' then valor else -valor end),0)::float8 from public.cliente_creditos where cliente_id = ${joao}`) === 0, "excess credit reversed");
ok(await cxMov() === antes, "estorno did not write caixa_movimentos");
const est2 = (await one(`select public.estornar_recebimento(${r2.recebimento_id}, 'cliente devolveu') j`)).j;
ok(est2.ja_estornado === true && await num("select count(*) from public.caixa_especial_mov where tipo = 'saida'") === saidasAntes + 1, "second estorno does not reverse again");

await db.exec("reset role");
e = await err(`insert into public.caixa_especial_mov(tipo, valor, motivo, estorno_de) values ('saida', 800, 'manual', ${r1.cxesp_id})`);
ok(e && /Contas a receber/.test(e), "direct reverse of an open receipt is blocked: " + e);
await as("mike");
ok(!!(await err("insert into public.caixa_especial_mov(tipo, valor, motivo) values ('entrada', 1, 'direto')")), "authenticated cannot insert into the ledger");
await as("pamela");
ok(await num("select count(*) from public.caixa_especial_mov") === 0, "financeiro sees no ledger rows (RLS)");
ok(await num(`select count(*) from public.v_recebimentos where caixa = 'CAIXA SPECIAL'`) >= 1, "financeiro still sees the receipt history");
ok(!!(await err("select * from public.recebimento_cxesp_idem")), "idempotency table is not readable by financeiro");

await db.exec("reset role; alter table public.cliente_creditos add constraint cxesp_test_no_exc check (obs is null or obs not like 'Excedente%') not valid");
const espAntes = await cxEsp(), recAntes = await num("select count(*) from public.cliente_recebimentos"), credAntes = await num("select count(*) from public.cliente_creditos");
await as("mike");
e = await err(`select public.registrar_recebimento_cxesp(${ana}, 150, 'dinheiro', null, null, 'chave-ana-roll')`);
ok(!!e, "excess insert failure raises: " + e);
await db.exec("reset role");
ok(await cxEsp() === espAntes && await num("select count(*) from public.cliente_recebimentos") === recAntes && await num("select count(*) from public.cliente_creditos") === credAntes, "failed receipt rolled back entrada, recebimento and credit");
await db.exec("alter table public.cliente_creditos drop constraint cxesp_test_no_exc");
await as("mike");
const rAna = (await one(`select public.registrar_recebimento_cxesp(${ana}, 100, 'dinheiro', null, null, 'chave-ana-ok1') j`)).j;
ok(Number(rAna.quitado) === 100 && Number(rAna.credito) === 0 && await num(`select saldo::float8 from public.v_clientes_saldo where id = ${ana}`) === 0, "retry after rollback succeeds for the real debt");

await as("mike");
const rP = (await one(`select public.registrar_recebimento_cxesp(${pedro}, 180, 'cartao', null, null, 'chave-pedro-180') j`)).j;
ok(Number(rP.credito) === 80, "Pedro excess 80");
await db.query(`select public.lancar_credito(${pedro}, 'uso', 80, 'gastou')`);
const espP = await cxEsp();
e = await err(`select public.estornar_recebimento(${rP.recebimento_id}, 'nao pode')`);
ok(e && /já foi usado|ja foi usado/.test(e), "estorno refused when excess credit was spent: " + e);
ok(await cxEsp() === espP && await num(`select saldo::float8 from public.v_clientes_saldo where id = ${pedro}`) === 0, "refused estorno rolled back");

await as("pamela");
const lar = await num("select id from public.caixas where nome = 'LARANJIHA'");
const get = await num("select id from public.caixas where nome = 'GETNET'");
const espL = await cxEsp();
await db.query(`select public.registrar_recebimento(${maria}, 50, ${lar}::smallint, 'pix', null, 'lar')`);
const g = (await one(`select public.registrar_recebimento_credito(${maria}, 20, ${get}::smallint, 'cartao', null, 'get') j`)).j;
ok(await cxEsp() === espL, "LARANJIHA and GETNET receipts do not touch cxesp");
ok(await num(`select count(*) from public.caixa_movimentos where caixa_id in (${lar}, ${get})`) === 2, "LARANJIHA and GETNET received on their own caixas");
await as("mike");
const estN = (await one(`select public.estornar_recebimento(${g.recebimento_id}, 'teste normal') j`)).j;
ok(estN.mov_saida != null && estN.cxesp_saida == null, "ordinary estorno still writes a caixa saida only");
ok(await num(`select count(*) from public.caixa_movimentos where caixa_id = ${get} and tipo = 'saida'`) === 1, "GETNET saida exists");

await as("mike");
await db.query(`select public.lancar_credito(${maria}, 'entrada', 40, 'saldo')`);
e = await err(`select public.registrar_recebimento_com_credito(${maria}, 10, null, 'cred')`);
ok(!e, "pagar com crédito da Caixa Geral ainda funciona: " + e);
ok(await num(`select count(*) from public.cliente_recebimentos where forma = 'credito' and cliente_id = ${maria}`) === 1, "credito receipt stored without cxesp");

console.log(fails ? `FAILED ${fails} (${passes} pass)` : `ALL PASS (${passes})`);
process.exit(fails ? 1 : 0);
