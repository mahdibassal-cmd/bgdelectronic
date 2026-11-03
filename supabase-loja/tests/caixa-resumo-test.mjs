// Testes do Resumo do dia + vínculo movimento→nota (PGlite, auth simulado).
// Rodar: node clientes-test.mjs (precisa @electric-sql/pglite)
import { PGlite } from "@electric-sql/pglite"; import fs from "fs";
const R = new URL("..", import.meta.url).pathname, S = f => fs.readFileSync(R + f, "utf8");
const ids = { mike: "a", sam: "b", hadi: "c", kaio: "d", bianca: "e", suelen: "f", pamela: "1", leticia: "2" };
const U = k => "00000000-0000-0000-0000-00000000000" + ids[k];
let fails = 0, passes = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); c ? passes++ : fails++; };
const db = new PGlite();
await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth; grant usage on schema auth to anon, authenticated; grant usage on schema public to anon, authenticated;
create table auth.users(id uuid primary key, email text); create table auth.mfa_factors(user_id uuid, status text); create table auth.sessions(id uuid, user_id uuid); create table auth.refresh_tokens(id int, session_id uuid);
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt()->>'sub','')::uuid $$;
grant execute on all functions in schema auth to anon, authenticated;
insert into auth.users values ${Object.keys(ids).map(k => `('${U(k)}','${k}@loja.bgdstores.local')`).join(",")}, ('00000000-0000-0000-0000-000000000999','mahdibassal@icloud.com');`);
for (const f of ["schema.sql", "users.sql", "security.sql", "migration-clientes.sql", "migration-caixa-resumo.sql", "migration-caixa-resumo.sql",
                 "schema.sql", "security.sql", "migration-clientes.sql", "migration-caixa-resumo.sql"]) {
  try { await db.exec(S(f)); console.log("ran " + f); } catch (e) { ok(false, f + ": " + e.message); process.exit(1); }
}
const as = k => db.exec(`reset role; select set_config('request.jwt.claims', '${JSON.stringify({ sub: U(k), aal: "aal1" })}', false); set role authenticated;`);
const err = async q => { try { await db.query(q); return null; } catch (e) { return e.message; } };
const one = async q => (await db.query(q)).rows[0];
const num = async q => Number(Object.values(await one(q))[0]);
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
await db.exec("reset role; insert into public.products(sku,marca,produto,preco_venda,estoque) values ('APL-001','Apple','AirPods 4',1000,10),('JBL-001','JBL','Go 4',300,10)");
const cx = Object.fromEntries((await db.query("select metodo::text m, id from public.caixas")).rows.map(r => [r.m, r.id]));
await as("kaio");
const c1 = await num("select public.criar_cliente('Maria Souza','11 99999-0000','52998224725') id");
const n1 = await num(`select public.criar_nota('[{"sku":"APL-001","qtd":1,"preco_vendido":1000}]','[{"metodo":"prazo","valor":700},{"metodo":"pix","valor":300}]', null, ${c1})`);
const n2 = await num(`select public.criar_nota('[{"sku":"JBL-001","qtd":1,"preco_vendido":300}]','[{"metodo":"prazo","valor":300}]', null, ${c1})`);
ok(!!(await err(`select public.caixa_resumo(${cx.pix}::smallint, '${today}')`)), "vendedor cannot read resumo");
await as("pamela");
await db.query(`select public.caixa_abrir(${cx.pix}::smallint, 0)`);
await db.query(`select public.registrar_recebimento(${c1}, 800, ${cx.pix}::smallint, 'pix', null, 'quita')`);
const al = (await db.query("select nota_id::int, valor::float v from public.recebimento_notas order by nota_id")).rows;
ok(al.length === 2 && al[0].nota_id === n1 && al[0].v === 700 && al[1].nota_id === n2 && al[1].v === 100, "recebimento allocated oldest first (700 + 100)");
await db.query(`select public.registrar_recebimento(${c1}, 200, ${cx.pix}::smallint, 'transferencia')`);
ok(await num(`select sum(valor) from public.recebimento_notas where nota_id=${n2}`) === 300, "second recebimento finishes nota 2");
ok((await one("select forma from public.caixa_movimentos order by id desc limit 1")).forma === "transferencia", "movimento carries forma of recebimento");
const r = (await one(`select public.caixa_resumo(${cx.pix}::smallint, '${today}') j`)).j;
ok(r.movimentos.length === 3, "resumo lists 3 PIX movements (venda + 2 recebimentos)");
const v = r.movimentos.find(m => m.tipo === "venda");
ok(v && v.nota === String(n1).padStart(6, "0") && v.cliente === "Maria Souza" && v.usuario === "Kaio" && v.forma === "pix", "venda linked: nota, cliente, user, forma");
const rc = r.movimentos.find(m => m.tipo === "entrada");
ok(rc && rc.nota.includes(String(n1).padStart(6, "0")) && rc.nota.includes(String(n2).padStart(6, "0")) && rc.usuario === "Pamela" && rc.cliente === "Maria Souza", "recebimento linked to both notas + user + cliente");
ok(Number(r.saldo_final) === 1300 && Number(r.saldo_inicial) === 0 && Number(r.entradas) === 1300, "saldo final 1300");
ok(Number(r.por_forma.pix) === 1100 && Number(r.por_forma.transferencia) === 200, "totais por forma");
ok(r.sessao && Number(r.sessao.abertura_valor) === 0, "abertura included");
await as("kaio");
ok(await num("select count(*) from public.recebimento_notas") === 0, "vendedor sees no recebimento_notas rows (RLS)");
await as("mike");
ok(!!(await one(`select public.caixa_resumo(${cx.dinheiro}::smallint, '${today}') j`)).j, "admin reads resumo");
await db.exec("reset role; select set_config('request.jwt.claims', '', false); set role anon;");
ok(!!(await err(`select public.caixa_resumo(1::smallint, '${today}')`)), "anon blocked");
await db.exec("reset role");
await db.exec("delete from public.recebimento_notas"); await db.exec(S("migration-caixa-resumo.sql"));
ok(await num("select count(*) from public.recebimento_notas") === 3, "backfill re-allocates existing recebimentos");
console.log(fails ? `FAILED ${fails}` : `ALL PASS (${passes})`); process.exit(fails ? 1 : 0);
