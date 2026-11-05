// Lançar nota na CAIXA SPECIAL (PGlite). Não conecta em produção.
// Rodar: node lancar-nota-cxesp-test.mjs
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
  "migration-caixa-metodo-null.sql", "migration-paga-depois-caixa-geral.sql", "migration-notas-dispensar.sql",
  "migration-receber-caixa-especial.sql"];
for (const f of files) {
  try { await db.exec(S(f)); console.log("ran " + f); }
  catch (e) { console.error("FAIL load " + f + ": " + e.message); process.exit(1); }
}
await db.exec(`alter table public.security_events drop constraint if exists security_events_kind_check;
alter table public.security_events add constraint security_events_kind_check check (kind in (
  'failed_login','role_change','admin_added','profile_added','profile_removed','lock','unlock','signout_all',
  'fin_pagamento','fin_recebimento','fin_alteracao',
  'credito_entrada','credito_uso','credito_excedente','nota_lancada',
  'estorno_recebimento','estorno_credito',
  'nota_cancelada_financas','nota_pag_corrigido','nota_prazo_lancada')) not valid;`);
const as = k => db.exec(`reset role; select set_config('request.jwt.claims', '${JSON.stringify({ sub: U(k), aal: "aal1" })}', false); set role authenticated;`);
const err = async q => { try { await db.query(q); return null; } catch (e) { return e.message; } };
const one = async q => (await db.query(q)).rows[0];
const num = async q => Number(Object.values(await one(q))[0]);
const ownerNum = async q => { await db.exec("reset role"); return num(q); };
const ui = fs.readFileSync(new URL("../../main/app.js", import.meta.url), "utf8");
const mig = S("migration-receber-caixa-especial.sql");
ok(!/create or replace function public\.criar_nota\b/i.test(mig), "migration does not replace criar_nota");
ok(!/create or replace function public\.criar_nota_local\b/i.test(mig), "migration does not replace criar_nota_local");
ok(/isAdm \? `<option value="cxesp"/.test(ui), "lançar-nota option CAIXA SPECIAL is admin-only");
ok(ui.includes("lancar_nota_cxesp") && ui.includes("Nada foi lançado"), "missing RPC tells the user nothing was posted");

await db.exec("reset role; insert into public.products(sku,marca,produto,preco_venda,estoque) values ('APL-001','Apple','AirPods 4',1000,40)");
await db.exec("insert into public.caixas(nome, metodo) values ('LARANJIHA', null), ('GETNET', null)");
await as("kaio");
const cli = await num("select public.criar_cliente('Maria Souza','11999990000','52998224725')");
const cash = await num(`select public.criar_nota('[{"sku":"APL-001","qtd":1,"preco_vendido":500}]','[{"metodo":"pix","valor":500}]', null, ${cli})`);
const split = await num(`select public.criar_nota('[{"sku":"APL-001","qtd":1,"preco_vendido":1000}]','[{"metodo":"prazo","valor":700},{"metodo":"pix","valor":300}]', null, ${cli})`);
const onlyPrazo = await num(`select public.criar_nota('[{"sku":"APL-001","qtd":1,"preco_vendido":200}]','[{"metodo":"prazo","valor":200}]', null, ${cli})`);
const estAntes = await ownerNum("select estoque from public.products where sku='APL-001'");

await as("pamela");
let e = await err(`select public.lancar_nota_cxesp(${cash})`);
ok(e && /Somente admin/.test(e), "financeiro cannot launch into CAIXA SPECIAL: " + e);
ok(await ownerNum("select count(*) from public.caixa_especial_mov") === 0, "denial wrote no cxesp row");
ok(await ownerNum(`select cxesp_lancada_em is null from public.notas where id=${cash}`), "note stays pending after denial");

await as("mike");
const a = (await one(`select public.lancar_nota_cxesp(${cash}) j`)).j;
ok(a.mudou === true && a.destino === "cxesp" && Number(a.valor) === 500, "admin launch returns the cash amount");
ok(await ownerNum("select count(*) from public.caixa_especial_mov where tipo='entrada' and nota_id=" + cash) === 1, "exactly one cxesp entrada for the note");
ok(await ownerNum(`select valor::float8 from public.caixa_especial_mov where id=${a.cxesp_id}`) === 500, "entrada is 500");
ok(await ownerNum("select count(*) from public.caixa_movimentos where nota_id=" + cash) === 0, "launch did not touch ordinary caixas");
ok(await ownerNum(`select caixa_lancada_id is null and cxesp_lancada_em is not null from public.notas where id=${cash}`), "posted state is cxesp, not a caixa id");
ok(await ownerNum("select count(*) from public.cliente_recebimentos") === 0, "note launch is not a debt settlement");
const again = (await one(`select public.lancar_nota_cxesp(${cash}) j`)).j;
ok(again.mudou === false && Number(again.cxesp_id) === Number(a.cxesp_id) && await ownerNum("select count(*) from public.caixa_especial_mov where nota_id=" + cash) === 1, "repeat launch is idempotent");

await as("mike");
const b = (await one(`select public.lancar_nota_cxesp(${split}) j`)).j;
ok(Number(b.valor) === 300 && b.mudou === true, "split note posts only the non-prazo 300");
ok(await ownerNum(`select saldo::float8 from public.v_clientes_saldo where id=${cli}`) === 900, "Paga Depois debt stays 700+200 and is not doubled");
ok(await ownerNum("select count(*) from public.recebimento_notas") === 0, "no receivable allocation from the note launch");
const cg = (await one(`select public.lancar_nota_caixa_geral(${split}) j`)).j;
ok(cg.mudou === true && Number(cg.valor) === 700 && await ownerNum(`select saldo::float8 from public.v_clientes_saldo where id=${cli}`) === 900, "Caixa Geral débito does not create a second debt");
e = await err(`select public.lancar_nota_cxesp(${onlyPrazo})`);
ok(e && /sem valor para caixa/.test(e), "pure Paga Depois is refused: " + e);

const st = await ownerNum("select estoque from public.products where sku='APL-001'");
const can = (await one(`select public.cancelar_nota_financas(${cash}, 'cliente desistiu') j`)).j;
ok(can.cancelada === true && Number(can.cxesp_saida) > 0, "cancel returns the linked cxesp saida");
ok(await ownerNum("select count(*) from public.caixa_especial_mov e where e.estorno_de=" + a.cxesp_id) === 1, "exactly one reversal of that entrada");
ok(await ownerNum(`select coalesce(sum(case when tipo='entrada' then valor else -valor end),0)::float8 from public.caixa_especial_mov where nota_id=${cash}`) === 0, "note cxesp nets to zero");
ok(await ownerNum("select estoque from public.products where sku='APL-001'") === st + 1, "cancel restored one unit");
ok(await ownerNum(`select status='cancelada' and cxesp_mov_id is null from public.notas where id=${cash}`), "cancelled note is no longer posted to cxesp");
e = await err(`select public.cancelar_nota_financas(${cash}, 'de novo agora')`);
ok(e && /já cancelada|ja cancelada/.test(e), "second cancel does not reverse again: " + e);
ok(await ownerNum("select count(*) from public.caixa_especial_mov where tipo='saida' and nota_id=" + cash) === 1, "still one saida after the second cancel");

await as("kaio");
const mov = await num(`select public.criar_nota('[{"sku":"APL-001","qtd":1,"preco_vendido":150}]','[{"metodo":"dinheiro","valor":150}]', null, ${cli})`);
await as("mike");
const posted = (await one(`select public.lancar_nota_cxesp(${mov}) j`)).j;
const din = await ownerNum("select id from public.caixas where metodo::text='dinheiro'");
await as("pamela");
const moved = (await one(`select public.lancar_nota_caixa(${mov}, ${din}::smallint) j`)).j;
ok(moved.mudou === true && Number(moved.caixa_id) === din, "financeiro can move the note off CAIXA SPECIAL onto a normal caixa");
ok(await ownerNum("select count(*) from public.caixa_especial_mov e where e.estorno_de=" + posted.cxesp_id) === 1, "move wrote one linked cxesp saida");
ok(await ownerNum(`select coalesce(sum(case when tipo='entrada' then valor else -valor end),0)::float8 from public.caixa_especial_mov where nota_id=${mov}`) === 0, "cxesp net is zero after the move");
ok(await ownerNum(`select coalesce(sum(case when tipo='venda' then valor when tipo='estorno' then -valor else 0 end),0)::float8 from public.caixa_movimentos where nota_id=${mov}`) === 150, "ordinary caixa now holds 150");
ok(await ownerNum(`select cxesp_mov_id is null and caixa_lancada_id=${din} from public.notas where id=${mov}`), "posted state followed the normal caixa");
const same = (await one(`select public.lancar_nota_caixa(${mov}, ${din}::smallint) j`)).j;
ok(same.mudou === false, "relaunch into the same caixa does nothing");

await as("mike");
const back = (await one(`select public.lancar_nota_cxesp(${mov}) j`)).j;
ok(back.mudou === true && Number(back.valor) === 150, "admin can move the note from a normal caixa back to CAIXA SPECIAL");
ok(await ownerNum(`select coalesce(sum(case when tipo='venda' then valor when tipo='estorno' then -valor else 0 end),0)::float8 from public.caixa_movimentos where nota_id=${mov}`) === 0, "ordinary net is zero after moving back");
ok(await ownerNum(`select coalesce(sum(case when tipo='entrada' then valor else -valor end),0)::float8 from public.caixa_especial_mov where nota_id=${mov}`) === 150, "cxesp holds 150 again, one open entrada");
ok(await ownerNum("select count(*) from public.caixa_especial_mov where tipo='entrada' and nota_id=" + mov + " and id not in (select estorno_de from public.caixa_especial_mov where estorno_de is not null)") === 1, "only one open entrada");

await as("kaio");
const larNota = await num(`select public.criar_nota('[{"sku":"APL-001","qtd":1,"preco_vendido":80}]','[{"metodo":"pix","valor":80}]', null, ${cli})`);
await as("pamela");
const lar = await num("select id from public.caixas where nome='LARANJIHA'");
const get = await num("select id from public.caixas where nome='GETNET'");
const esp = await ownerNum("select count(*) from public.caixa_especial_mov");
await as("pamela");
await db.query(`select public.lancar_nota_caixa(${larNota}, ${lar}::smallint)`);
ok(await ownerNum("select count(*) from public.caixa_especial_mov") === esp, "LARANJIHA launch does not touch cxesp");
ok(await ownerNum(`select count(*) from public.caixa_movimentos where nota_id=${larNota} and caixa_id=${lar}`) === 1, "LARANJIHA received the note");
await as("mike");
await db.query(`select public.lancar_nota_caixa(${larNota}, ${get}::smallint)`);
ok(await ownerNum(`select caixa_lancada_id=${get} from public.notas where id=${larNota}`), "GETNET move still works");
ok(await ownerNum("select count(*) from public.caixa_especial_mov") === esp, "GETNET move did not touch cxesp");
ok(await ownerNum("select estoque from public.products where sku='APL-001'") === estAntes - 1, "stock: one cancel restored a unit, two later sales remain");

console.log(fails ? `FAILED ${fails} (${passes} pass)` : `ALL PASS (${passes})`);
process.exit(fails ? 1 : 0);
