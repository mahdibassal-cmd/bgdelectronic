/* Extrato do cliente (PGlite). Não conecta em produção.
   node cliente-extrato-test.mjs */
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
try { await db.exec(S("migration-cliente-extrato.sql")); console.log("ran migration-cliente-extrato.sql"); }
catch (e) { console.error("FAIL load migration-cliente-extrato.sql: " + e.message); process.exit(1); }
const sql = S("migration-cliente-extrato.sql");
ok(!/product_costs|sale_costs|caixa_especial/.test(sql), "statement SQL does not read cost or cxesp");
ok(!/cliente\s*=/.test(sql) && /n\.cliente_id = p_cliente/.test(sql), "statement matches cliente_id only");
const ui = fs.readFileSync(new URL("../../main/app.js", import.meta.url), "utf8");
ok(ui.includes("Ver notas") && ui.includes("cliente_extrato") && ui.includes("migration-cliente-extrato.sql"), "UI opens the statement and names the SQL file");

const as = k => db.exec(`reset role; select set_config('request.jwt.claims', '${JSON.stringify({ sub: U(k), aal: "aal1" })}', false); set role authenticated;`);
const err = async q => { try { await db.query(q); return null; } catch (e) { return e.message; } };
const one = async q => (await db.query(q)).rows[0];
const num = async q => Number(Object.values(await one(q))[0]);
const ownerNum = async q => { await db.exec("reset role"); return num(q); };

await db.exec("reset role; insert into public.products(sku,marca,produto,preco_venda,estoque) values ('SYN-001','Sint','Fone',100,20)");
await as("kaio");
const maria = await num("select public.criar_cliente('Maria Souza','11999990000','52998224725')");
const outro = await num("select public.criar_cliente('Outro Cliente','11988880000', null)");
const pago = await num(`select public.criar_nota('[{"sku":"SYN-001","qtd":1,"preco_vendido":100}]','[{"metodo":"cartao","valor":100}]', null, ${maria})`);
const misto = await num(`select public.criar_nota('[{"sku":"SYN-001","qtd":2,"preco_vendido":40}]','[{"metodo":"pix","valor":30},{"metodo":"prazo","valor":50}]', null, ${maria})`);
const prazo = await num(`select public.criar_nota('[{"sku":"SYN-001","qtd":1,"preco_vendido":70}]','[{"metodo":"prazo","valor":70}]', null, ${maria})`);
const alheia = await num(`select public.criar_nota('[{"sku":"SYN-001","qtd":1,"preco_vendido":15}]','[{"metodo":"prazo","valor":15}]', null, ${outro})`);
await db.exec("reset role");
await db.exec(`insert into public.sale_costs(sale_id, custo_unit) select id, 77.77 from public.sales where nota_id = ${pago} on conflict (sale_id) do update set custo_unit = 77.77`);
const divida = await ownerNum(`insert into public.notas(seller_id, cliente, cliente_id, total, obs_pagamento, frete) values ('${U("mike")}', 'Maria Souza', ${maria}, 20, 'DÍVIDA ANTERIOR', 20) returning id`);
await db.exec(`insert into public.nota_pagamentos(nota_id, metodo, valor) values (${divida}, 'prazo', 20)`);
const solta = await ownerNum(`insert into public.notas(seller_id, cliente, cliente_id, total, frete) values ('${U("mike")}', 'Maria Souza', null, 999, 0) returning id`);
await db.exec(`insert into public.nota_pagamentos(nota_id, metodo, valor) values (${solta}, 'prazo', 999)`);
await db.exec(`insert into public.cliente_creditos(cliente_id, tipo, valor, obs, created_by) values (${maria}, 'entrada', 15, 'credito de loja teste', '${U("mike")}')`);
await as("pamela");
const cx = await num("select id from public.caixas where nome = 'Caixa Dinheiro'");
await num(`select public.registrar_recebimento(${maria}::bigint, 30::numeric, ${cx}::smallint, 'dinheiro', null::date, 'parte')`);
const saldo = await ownerNum(`select public.cliente_saldo_calc(${maria})`);
ok(saldo === 20 + 50 + 70 - 30, "fixture saldo is prazo minus receipt: " + saldo);

await as("kaio");
let e = await err(`select public.cliente_extrato(${maria})`);
ok(e && /Sem permissão/.test(e), "vendedor denied: " + e);
await db.exec("reset role; set role anon");
e = await err(`select public.cliente_extrato(${maria})`);
ok(e && /permission denied/.test(e), "anon denied: " + e);
await as("pamela");
const ext = (await one(`select public.cliente_extrato(${maria}) j`)).j;
const blob = JSON.stringify(ext);
ok(Number(ext.saldo) === saldo && Number(ext.total_prazo) - Number(ext.total_recebido) === Number(ext.saldo), "statement reconciles with cliente_saldo_calc");
ok(Number(ext.credito_saldo) === 15 && !ext.explicacao.includes("abate essa dívida") === false, "store credit is separate from the receivable");
ok(ext.explicacao.includes("não abate"), "explanation says credit does not reduce the debt");
const idsNotas = ext.notas.map(n => n.nota_id);
ok(idsNotas.includes(pago) && idsNotas.includes(misto) && idsNotas.includes(prazo) && idsNotas.includes(divida), "paid, mixed, prazo, and legacy debt are linked");
ok(!idsNotas.includes(solta) && !idsNotas.includes(alheia), "name-only and other-client notes stay out");
const leg = ext.notas.find(n => n.nota_id === divida);
ok(leg.rotulo === "Dívida anterior" && leg.itens.length === 0 && Number(leg.em_aberto) === 20, "legacy debt is labeled and has no goods");
const mx = ext.notas.find(n => n.nota_id === misto);
ok(mx.itens.length === 1 && mx.itens[0].qtd === 2 && Number(mx.itens[0].preco_vendido) === 40 && Number(mx.prazo) === 50, "mixed note keeps original qty and price, and only prazo is open");
const pg = ext.notas.find(n => n.nota_id === pago);
ok(Number(pg.em_aberto) === 0 && pg.porque.includes("não fica em Contas a receber"), "paid note explains it is not receivable debt");
ok(!blob.includes("77.77") && !/"custo"/.test(blob) && !/cxesp|caixa_especial/i.test(blob), "no cost and no cxesp in the payload");
ok(ext.historico_sem_vinculo.includes("sem cliente vinculado"), "unlinked history is labeled, not searched");
ok(ext.recebimentos.length === 1 && Number(ext.recebimentos[0].valor) === 30 && ext.recebimentos[0].caixa_id == null && ext.recebimentos[0].mov_id == null, "receipt is listed without caixa movement ids");

if (fails) { console.error(fails + " failed"); process.exit(1); }
console.log(passes + " passed");
