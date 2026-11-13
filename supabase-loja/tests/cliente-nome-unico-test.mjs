/* Nomes de cliente únicos (PGlite). Não conecta em produção.
   node cliente-nome-unico-test.mjs */
import fs from "fs";
const { PGlite } = await import("@electric-sql/pglite").catch(() => import("/tmp/pgdeps/node_modules/@electric-sql/pglite/dist/index.js"));
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
for (const f of ["schema.sql", "users.sql", "security.sql", "migration-clientes.sql", "migration-atendimento.sql"]) {
  try { await db.exec(S(f)); console.log("ran " + f); }
  catch (e) { console.error("FAIL load " + f + ": " + e.message); process.exit(1); }
}
await db.exec("reset role");
await db.exec("insert into public.clientes(nome) values ('brenda apple'), ('brenda apple')");
const antes = (await db.query("select id from public.clientes where nome = 'brenda apple' order by id")).rows.map(r => Number(r.id));
ok(antes.length === 2, "fixture keeps the existing brenda pair before the guard: " + antes.join(","));
try { await db.exec(S("migration-cliente-nome-unico.sql")); console.log("ran migration"); }
catch (e) { console.error("FAIL migration on existing duplicates: " + e.message); process.exit(1); }
try { await db.exec(S("migration-cliente-nome-unico.sql")); console.log("ran migration again"); }
catch (e) { console.error("FAIL migration rerun: " + e.message); process.exit(1); }
const sql = S("migration-cliente-nome-unico.sql");
ok(!/create unique index[^;]*cliente_nome_norm/i.test(sql) && !/delete from public\.clientes/i.test(sql), "file does not unique-index the name and does not delete rows");
ok((await db.query("select count(*)::int n from public.clientes where nome = 'brenda apple'")).rows[0].n === 2, "existing brenda rows survive the migration");

const as = k => db.exec(`reset role; select set_config('request.jwt.claims', '${JSON.stringify({ sub: U(k), aal: "aal1" })}', false); set role authenticated;`);
const err = async q => { try { await db.query(q); return null; } catch (e) { return e.message; } };
const one = async q => (await db.query(q)).rows[0];
const num = async q => Number(Object.values(await one(q))[0]);

await db.exec("reset role");
ok((await one("select public.cliente_nome_norm('  Tiago   Belmónts ') k")).k === "tiago belmonts", "norm folds spaces, case and accent");
ok((await one("select public.cliente_nome_norm('José da Silva') k")).k === "jose da silva", "norm folds José");
const brendaEmail = await err("update public.clientes set email = 'brenda@exemplo.com' where id = " + antes[0]);
ok(!brendaEmail, "editing email of an existing duplicate does not fail: " + brendaEmail);
const brendaCase = await err("update public.clientes set nome = 'Brenda Apple' where id = " + antes[0]);
ok(!brendaCase, "rewriting the same normalized name on an existing duplicate is allowed: " + brendaCase);
const terceira = await err("insert into public.clientes(nome) values ('BRENDA   APPLE')");
ok(terceira && /Já existe um cliente com esse nome: .+ \(#\d+\)\. Use o cadastro existente\./.test(terceira), "new brenda is refused with the portuguese sentence: " + terceira);

await as("kaio");
const t = await num("select public.criar_cliente('Tiago Belmonts', null, null)");
ok(t > 0, "vendedor creates the first tiago");
for (const nome of ["tiago belmonts", "TIAGO  BELMONTS", "Tiago Belmónts", "  tiago   belmonts  "]) {
  const e = await err(`select public.criar_cliente('${nome.replace(/'/g, "''")}', null, null)`);
  ok(e && e.includes(`(#${t})`) && e.includes("Já existe um cliente com esse nome:"), `variant '${nome}' refused pointing at #${t}: ${e}`);
}
const at = await err("select public.criar_cliente_atendimento('tiago belmonts', '1')");
ok(at && at.includes(`(#${t})`), "Nova nota RPC is refused too: " + at);
const outro = await num("select public.criar_cliente('Ana Fones', '(11) 98888-7777', null)");
const tel = await err("select public.criar_cliente('Bia Fones', '11988887777', null)");
ok(tel && tel.includes("telefone") && tel.includes(`(#${outro})`), "same phone digits are refused: " + tel);
const sem1 = await num("select public.criar_cliente('Sem Fone Um', null, null)");
const sem2 = await num("select public.criar_cliente('Sem Fone Dois', '', null)");
ok(sem1 !== sem2, "blank phones do not count as the same phone");
const cpf = await num("select public.criar_cliente('Maria Souza', null, '52998224725')");
const reuse = await num("select public.criar_cliente('Maria S', null, '529.982.247-25')");
ok(reuse === cpf, "same CPF still reuses the row instead of inserting a second one");
await db.exec("reset role");
const docIns = await err(`insert into public.clientes(nome, doc) values ('Outra Maria', '52998224725')`);
ok(docIns && /CPF\/CNPJ/.test(docIns) && docIns.includes(`(#${cpf})`), "direct duplicate CPF is a portuguese error: " + docIns);
await as("pamela");
const ren = await err(`update public.clientes set nome = 'tiago belmonts' where id = ${sem1}`);
ok(ren && ren.includes(`(#${t})`), "financeiro cannot rename onto an existing name: " + ren);
const emailOk = await err(`update public.clientes set email = 'sem@exemplo.com' where id = ${sem1}`);
ok(!emailOk, "financeiro can still edit a field that is not the name: " + emailOk);
await as("kaio");
const achou = await one(`select id, nome from public.cliente_por_nome('TIAGO BELMONTS')`);
ok(Number(achou.id) === t && achou.nome === "Tiago Belmonts", "vendedor lookup returns the existing client");
const br = await one("select id from public.cliente_por_nome('Brenda Apple')");
ok(Number(br.id) === antes[0], "lookup of the legacy pair returns the lowest id");
await db.exec("reset role; set role anon");
ok(!!(await err("select * from public.cliente_por_nome('tiago')")), "anon cannot search by normalized name");
await db.exec("reset role");
const nTiago = await num("select count(*) from public.clientes where public.cliente_nome_norm(nome) = 'tiago belmonts'");
ok(nTiago === 1, "only one tiago row exists");

console.log(fails ? `${fails} FAILURES (${passes} pass)` : `ALL PASS (${passes})`);
process.exit(fails ? 1 : 0);
