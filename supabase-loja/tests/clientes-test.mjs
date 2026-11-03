// Testes de clientes / fornecedores / contas a pagar / contas a receber / "Paga Depois" (PGlite, auth simulado).
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
for (const f of ["schema.sql", "users.sql", "security.sql", "migration-clientes.sql", "migration-clientes.sql",
                 "schema.sql", "security.sql", "migration-clientes.sql"]) {
  try { await db.exec(S(f)); console.log("ran " + f); } catch (e) { ok(false, f + ": " + e.message); process.exit(1); }
}
const as = k => db.exec(`reset role; select set_config('request.jwt.claims', '${JSON.stringify({ sub: U(k), aal: "aal1" })}', false); set role authenticated;`);
const err = async q => { try { await db.query(q); return null; } catch (e) { return e.message; } };
const n = async q => (await db.query(`select count(*)::int n from (${q}) x`)).rows[0].n;
const one = async q => (await db.query(q)).rows[0];
const num = async q => Number(Object.values(await one(q))[0]);
ok(await n("select * from pg_proc where proname='criar_nota'") === 1, "only one criar_nota signature after re-runs");
ok(await n("select * from public.role_perms where perm='financas'") === 2, "financas perm for admin+financeiro (no dup)");
await db.exec("reset role; insert into public.products(sku,marca,produto,preco_venda,estoque) values ('APL-001','Apple','AirPods 4',1000,10),('JBL-001','JBL','Go 4',300,10)");
const cx = Object.fromEntries((await db.query("select metodo::text m, id from public.caixas")).rows.map(r => [r.m, r.id]));

// CPF/CNPJ
await db.exec("reset role");
ok((await one("select public.doc_valido('52998224725') a, public.doc_valido('11222333000181') b, public.doc_valido('12345678900') c, public.doc_valido('11111111111') d"))
  .a === true, "valid CPF accepted");
ok((await one("select public.doc_valido('11222333000181') b")).b === true, "valid CNPJ accepted");
ok((await one("select public.doc_valido('12345678900') c")).c === false && (await one("select public.doc_valido('11111111111') d")).d === false, "invalid CPFs refused");

// ---- vendedor
await as("kaio");
const c1 = await num("select public.criar_cliente('Maria Souza','11 99999-0000','529.982.247-25','m@x.com','Rua 1','vip') id");
ok(c1 > 0, "vendedor creates cliente via RPC");
ok(await num("select public.criar_cliente('Maria S','','52998224725')") === c1, "same CPF reuses cliente");
ok(!!(await err("select public.criar_cliente('Joao','','12345678900')")), "invalid CPF refused in RPC");
ok(await n("select * from public.buscar_clientes('mari')") === 1, "vendedor searches cliente by name");
ok(await n("select * from public.buscar_clientes('99999')") === 1, "vendedor searches cliente by telefone");
ok(Object.keys((await db.query("select * from public.buscar_clientes('maria')")).rows[0]).join() === "id,nome,telefone,doc", "search returns only id,nome,telefone,doc");
for (const t of ["clientes", "fornecedores", "contas_pagar", "conta_pagamentos", "cliente_recebimentos", "v_clientes_saldo", "v_contas_pagar", "v_recebimentos"])
  ok(await n("select * from public." + t) === 0, "vendedor sees 0 rows in " + t);
ok(!!(await err("insert into public.clientes(nome) values ('x')")) , "vendedor cannot insert clientes directly");
ok(!!(await err("insert into public.fornecedores(nome) values ('xx')")), "vendedor cannot insert fornecedor");
let e = await err(`select public.criar_nota('[{"sku":"APL-001","qtd":1,"preco_vendido":1000}]','[{"metodo":"prazo","valor":1000}]')`);
ok(e && /exige cliente/.test(e), "Paga Depois without cliente refused by RPC: " + e);
ok((await one("select estoque from public.products where sku='APL-001'")).estoque === 10, "refused nota rolled back stock");
const nid = await num(`select public.criar_nota('[{"sku":"APL-001","qtd":1,"preco_vendido":1000}]','[{"metodo":"prazo","valor":700},{"metodo":"pix","valor":300}]', null, ${c1})`);
ok(nid > 0, "split nota Paga Depois 700 + PIX 300 with cliente");
ok((await one("select estoque from public.products where sku='APL-001'")).estoque === 9, "stock goes down at sale");
ok((await one(`select cliente from public.v_notas where nota_id=${nid}`)).cliente === "Maria Souza", "nota stores cliente name for receipt");
ok((await one(`select pagamento from public.v_notas where nota_id=${nid}`)).pagamento === "prazo+pix", "receipt payments include prazo");
ok(!!(await err(`select public.criar_nota('[{"sku":"JBL-001","qtd":1,"preco_vendido":300}]','[{"metodo":"pix","valor":300}]', null, 999999)`)), "unknown cliente_id refused");
ok(!!(await err(`select public.registrar_recebimento(${c1}, 10, ${cx.pix}::smallint)`)), "vendedor cannot register recebimento");
ok(!!(await err("select * from public.cliente_saldo_calc(1)")), "vendedor cannot call cliente_saldo_calc");

// ---- financeiro
await as("pamela");
ok(await n("select * from public.caixa_movimentos where nota_id=" + nid) === 1, "only PIX part hit a caixa (no entrada for Paga Depois)");
ok(await num(`select saldo from public.v_clientes_saldo where id=${c1}`) === 700, "financeiro sees cliente saldo 700");
ok(!!(await err(`select public.registrar_recebimento(${c1}, 800, ${cx.dinheiro}::smallint)`)), "cannot receive more than saldo");
const pixBefore = await num(`select saldo from public.v_caixa_saldo where caixa_id=${cx.pix}`);
await db.query(`select public.registrar_recebimento(${c1}, 200, ${cx.pix}::smallint, 'pix', null, 'parcela 1')`);
ok(await num(`select saldo from public.v_clientes_saldo where id=${c1}`) === 500, "recebimento lowers saldo to 500");
ok(await num(`select saldo from public.v_caixa_saldo where caixa_id=${cx.pix}`) === pixBefore + 200, "recebimento adds entrada to Caixa PIX (HX)");
ok(await n("select * from public.v_recebimentos") === 1, "financeiro lists recebimentos");
ok(!!(await err("insert into public.cliente_recebimentos(cliente_id,valor,data,forma,caixa_id) values (1,1,current_date,'pix',1)")), "no direct insert into recebimentos");
await db.query("update public.clientes set email='novo@x.com' where id=" + c1);
ok((await one("select email from public.clientes where id=" + c1)).email === "novo@x.com", "financeiro edits cliente");
const f1 = await num("insert into public.fornecedores(nome,cnpj,contato) values ('Distribuidora X','11222333000181','Ana') returning id");
ok(f1 > 0, "financeiro creates fornecedor");
ok(!!(await err("insert into public.fornecedores(nome,cnpj) values ('Ruim','11222333000100')")), "invalid CNPJ refused");
const k1 = await num(`insert into public.contas_pagar(fornecedor_id,valor,vencimento,descricao) values (${f1},1000,current_date+10,'Lote fones') returning id`);
const k2 = await num(`insert into public.contas_pagar(fornecedor_id,valor,vencimento,descricao) values (${f1},50,(now() at time zone 'America/Sao_Paulo')::date-1,'Frete') returning id`);
ok((await one(`select status from public.v_contas_pagar where id=${k1}`)).status === "aberta", "conta status aberta");
ok((await one(`select status from public.v_contas_pagar where id=${k2}`)).status === "vencida", "conta past due => vencida");
const dinBefore = await num(`select saldo from public.v_caixa_saldo where caixa_id=${cx.dinheiro}`);
await db.query(`select public.pagar_conta(${k1}, 400, ${cx.dinheiro}::smallint, 'dinheiro')`);
ok((await one(`select status from public.v_contas_pagar where id=${k1}`)).status === "parcial", "partial payment => parcial");
ok(await num(`select saldo from public.v_caixa_saldo where caixa_id=${cx.dinheiro}`) === dinBefore - 400, "pagamento posts saída in Caixa Dinheiro");
ok(!!(await err(`select public.pagar_conta(${k1}, 700, ${cx.dinheiro}::smallint)`)), "cannot overpay conta");
await db.query(`select public.pagar_conta(${k1}, 600, ${cx.pix}::smallint, 'pix')`);
ok((await one(`select status from public.v_contas_pagar where id=${k1}`)).status === "paga", "full payment => paga");
ok(!!(await err(`delete from public.contas_pagar where id=${k1}`)), "conta with payments cannot be deleted");
ok(!!(await err(`update public.contas_pagar set valor=10 where id=${k1}`)), "conta valor cannot drop below paid");
ok(!!(await err("insert into public.conta_pagamentos(conta_id,valor,data,forma,caixa_id) values (1,1,current_date,'pix',1)")), "no direct insert into conta_pagamentos");
for (const t of ["products", "product_costs", "notas", "v_admin_products"]) ok(await n("select * from public." + t) === 0, "financeiro still sees 0 rows in " + t);
ok(!!(await err(`select public.criar_nota('[{"sku":"JBL-001","qtd":1,"preco_vendido":300}]','[{"metodo":"prazo","valor":300}]', null, ${c1})`)), "financeiro cannot create nota");

// ---- admin
await as("mike");
ok(await n("select * from public.v_contas_pagar") === 2 && await n("select * from public.v_clientes_saldo") === 1, "admin sees contas + clientes");
await db.query(`select public.cancelar_nota(${nid}, 'Cliente devolveu')`);
ok(await num(`select saldo from public.v_clientes_saldo where id=${c1}`) === -200, "cancelled nota leaves saldo (credit -200 after recebimento)");
ok(await n("select * from public.caixa_movimentos where tipo='estorno' and nota_id=" + nid) === 1, "cancel estorna only the PIX part");
ok(await n("select * from public.security_events where kind in ('fin_pagamento','fin_recebimento','fin_alteracao')") >= 4, "financial actions logged in security_events");
// trava de emergência
await db.query("select public.lock_system('teste')");
await as("pamela"); ok(await n("select * from public.v_clientes_saldo") === 0 && !!(await err(`select public.registrar_recebimento(${c1}, 1, 1::smallint)`)), "LOCKED: financeiro blocked");
await as("kaio"); ok(!!(await err("select * from public.buscar_clientes('maria')")), "LOCKED: vendedor search blocked");
await db.exec(`reset role; select set_config('request.jwt.claims','${JSON.stringify({ sub: "00000000-0000-0000-0000-000000000999", aal: "aal1" })}',false); set role authenticated;`);
await db.query("select public.unlock_system()");
// anon
await db.exec("reset role; select set_config('request.jwt.claims','{}',false); set role anon;");
for (const t of ["clientes", "fornecedores", "contas_pagar", "v_clientes_saldo"]) ok(!!(await err("select * from public." + t)), "anon blocked from " + t);
ok(!!(await err("select public.buscar_clientes('ma')")), "anon cannot search clientes");
console.log(fails ? `${fails} FAILURES (${passes} pass)` : `ALL PASS (${passes})`);
process.exit(fails ? 1 : 0);
