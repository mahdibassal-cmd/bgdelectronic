/* Devolução pelo número da nota (PGlite). Não conecta em produção.
   node devolucao-nota-test.mjs */
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
for (const f of ["migration-adicionar-divida.sql", "migration-devolucao-nota.sql"]) {
  try { await db.exec(S(f)); console.log("ran " + f); }
  catch (e) { console.error("FAIL load " + f + ": " + e.message); process.exit(1); }
}
const sql = S("migration-devolucao-nota.sql");
const ui = fs.readFileSync(new URL("../../main/app.js", import.meta.url), "utf8");
ok(!/create or replace function public\.criar_nota/.test(sql), "migration does not replace criar_nota");
const credFn = sql.slice(sql.indexOf("function public.confirmar_devolucao_credito_loja"), sql.indexOf("function public.cancelar_nota_financas"));
ok(credFn && !/insert into public\.(caixa_movimentos|cliente_recebimentos|caixa_especial_mov)/.test(credFn), "store-credit return does not write a caixa, a receipt, or cxesp");
ok(/update public\.products p set estoque = p\.estoque \+ v_need/.test(sql), "paid return restocks the goods");
ok(/credito_loja/.test(sql), "paid return is store credit");
ok(/confirmacao_habilitada', false/.test(sql) && /Acerto financeiro pendente/.test(sql), "confirmation stays refused");
ok(/Devolução pelo número da nota/.test(ui) && /data-v="devolucao"/.test(fs.readFileSync(new URL("../../main/index.html", import.meta.url), "utf8")) && ui.includes("migration-devolucao-nota.sql") && /id="bc"[^>]*disabled/.test(ui), "UI is admin-only and the settlement button is disabled");
const as = k => db.exec(`reset role; select set_config('request.jwt.claims', '${JSON.stringify({ sub: U(k), aal: "aal1" })}', false); set role authenticated;`);
const err = async q => { try { await db.query(q); return null; } catch (e) { return e.message; } };
const one = async q => (await db.query(q)).rows[0];
const num = async q => Number(Object.values(await one(q))[0]);
const ownerNum = async q => { await db.exec("reset role"); return num(q); };

await db.exec("reset role; insert into public.products(sku,marca,produto,preco_venda,estoque) values ('APL-001','Apple','AirPods 4',1000,50), ('BAS-001','Baseus','Cabo',40,50)");
await as("kaio");
const maria = await num("select public.criar_cliente('Maria Souza','11999990000','52998224725')");
const pago = await num(`select public.criar_nota('[{"sku":"APL-001","qtd":2,"preco_vendido":100}]','[{"metodo":"cartao","valor":200}]', null, null)`);
const misto = await num(`select public.criar_nota('[{"sku":"APL-001","qtd":1,"preco_vendido":80},{"sku":"BAS-001","qtd":2,"preco_vendido":15.5}]','[{"metodo":"pix","valor":50},{"metodo":"prazo","valor":61}]', null, ${maria})`);
const soPrazo = await num(`select public.criar_nota('[{"sku":"BAS-001","qtd":1,"preco_vendido":40}]','[{"metodo":"prazo","valor":40}]', null, ${maria})`);
await db.exec("reset role");
await db.exec(`insert into public.cliente_creditos(cliente_id, tipo, valor, obs, created_by) values (${maria}, 'entrada', 500, 'saldo teste', '${U("mike")}')`);
await as("kaio");
const credito = await num(`select public.criar_nota_local('[{"sku":"BAS-001","qtd":1,"preco_vendido":30}]','[]', null, ${maria}, 'CAIXA GERAL', null)`);
const est0 = await ownerNum("select sum(estoque) from public.products");
const mov0 = await ownerNum("select count(*) from public.caixa_movimentos");
const cr0 = await ownerNum("select count(*) from public.cliente_creditos");
const saldo0 = await ownerNum(`select public.cliente_saldo_calc(${maria})`);
await as("mike");
const cx = await num("select id from public.caixas where nome = 'Caixa Dinheiro'");
await num(`select public.lancar_nota_caixa(${pago}, ${cx}::smallint)`);
const movLancado = await ownerNum("select count(*) from public.caixa_movimentos");
ok(movLancado > mov0, "paid note was posted to a caixa so the proposal can be checked against it");

await db.exec("reset role; update public.products set preco_venda = 1 where sku = 'APL-001'");
await as("pamela");
let e = await err(`select public.consultar_devolucao_nota(${pago})`);
ok(e && /Somente admin/.test(e), "financeiro denied: " + e);
await as("kaio");
e = await err(`select public.consultar_devolucao_nota(${pago})`);
ok(e && /Somente admin/.test(e), "vendedor denied: " + e);
await db.exec("reset role; set role anon");
e = await err(`select public.consultar_devolucao_nota(${pago})`);
ok(e && /permission denied/.test(e), "anon denied: " + e);

await as("mike");
const salePago = await ownerNum(`select id from public.sales where nota_id = ${pago}`);
const visto = await one(`select public.consultar_devolucao_nota(${pago}) j`);
const info = visto.j;
ok(info.aceita === true && info.confirmacao_habilitada === false && info.acerto === "pendente", "lookup is a proposal, not a settlement");
ok(Number(info.itens[0].preco_vendido) === 100 && Number(info.itens[0].qtd_vendida) === 2, "uses the original sale price, not the new shelf price: " + JSON.stringify(info.itens[0]));
ok(info.pagamentos.some(p => p.metodo === "cartao" && Number(p.valor) === 200), "shows the original card payment");
const prop = (await one(`select public.propor_devolucao_nota(${pago}, '[{"sale_id":${salePago},"qtd":1}]', 'cliente devolveu uma unidade', 'chave-pago-01') j`)).j;
ok(prop.idempotente === false && Number(prop.mercadoria) === 100 && prop.estoque_aplicado === false && prop.confirmacao_habilitada === false, "partial proposal stores original price: " + JSON.stringify(prop));
const again = (await one(`select public.propor_devolucao_nota(${pago}, '[{"sale_id":${salePago},"qtd":1}]', 'cliente devolveu uma unidade', 'chave-pago-01') j`)).j;
ok(again.idempotente === true && again.proposta_id === prop.proposta_id, "same key does not create a second proposal");
e = await err(`select public.propor_devolucao_nota(${pago}, '[{"sale_id":${salePago},"qtd":2}]', 'outra quantidade', 'chave-pago-01')`);
ok(e && /Chave já usada/.test(e), "same key with another quantity is rejected");
e = await err(`select public.propor_devolucao_nota(${pago}, '[{"sale_id":${salePago},"qtd":2}]', 'passa do vendido', 'chave-pago-02')`);
ok(e && /maior que a vendida/.test(e), "cannot return more than sold, counting the open proposal: " + e);
ok(await ownerNum("select sum(estoque) from public.products") === est0, "stock unchanged");
ok(await ownerNum("select count(*) from public.caixa_movimentos") === movLancado, "caixa movements unchanged");
await db.exec("reset role");
ok((await one(`select status from public.notas where id = ${pago}`)).status === "ativa", "original note stays active");
await as("mike");
e = await err(`select public.confirmar_devolucao_nota(${prop.proposta_id})`);
ok(e && /Acerto financeiro pendente/.test(e), "confirm is refused: " + e);
ok(await ownerNum("select sum(estoque) from public.products") === est0 && await ownerNum("select count(*) from public.caixa_movimentos") === movLancado, "refused confirm still did not move stock or cash");

const linhas = (await db.query(`select id, sku, preco_vendido::float8 preco, qtd from public.sales where nota_id = ${misto} order by id`)).rows;
const um = linhas[0], cabo = linhas[1];
const pm = (await one(`select public.propor_devolucao_nota(${misto}, '[{"sale_id":${um.id},"qtd":1},{"sale_id":${cabo.id},"qtd":1}]', 'devolucao mista parcial', 'chave-misto-01') j`)).j;
ok(Number(pm.mercadoria) === 95.5, "mixed note uses each original line price: " + pm.mercadoria);
const im = (await one(`select public.consultar_devolucao_nota(${misto}) j`)).j;
ok(im.pagamentos.length === 2 && im.divida_aplicada === false, "mixed payments are shown and the debt is not changed by the lookup");
ok(await ownerNum(`select public.cliente_saldo_calc(${maria})`) === saldo0, "customer balance unchanged after paid, mixed, and prazo notes' proposals");

const sp = await ownerNum(`select id from public.sales where nota_id = ${soPrazo}`);
const pp = (await one(`select public.propor_devolucao_nota(${soPrazo}, '[{"sale_id":${sp},"qtd":1}]', 'devolve o paga depois', 'chave-prazo-01') j`)).j;
ok(Number(pp.mercadoria) === 40 && pp.divida_aplicada === false, "prazo proposal does not settle the debt");
ok(await ownerNum(`select public.cliente_saldo_calc(${maria})`) === saldo0, "prazo balance still unchanged");

const sc = await ownerNum(`select id from public.sales where nota_id = ${credito}`);
const pc = (await one(`select public.propor_devolucao_nota(${credito}, '[{"sale_id":${sc},"qtd":1}]', 'devolve pago com credito', 'chave-credito-01') j`)).j;
ok(Number(pc.mercadoria) === 30 && pc.credito_aplicado === false, "Caixa Geral note does not grant credit back");
ok(await ownerNum("select count(*) from public.cliente_creditos") === cr0, "no extra credit row");

await as("mike");
await db.query(`select public.cancelar_nota(${pago}, 'teste cancelada')`);
e = await err(`select public.propor_devolucao_nota(${pago}, '[{"sale_id":${salePago},"qtd":1}]', 'depois de cancelar', 'chave-cancel-01')`);
ok(e && /Nota cancelada/.test(e), "cancelled note rejected: " + e);
const antesCancelEst = await ownerNum("select sum(estoque) from public.products");
ok(antesCancelEst === est0 + 2, "existing full cancel still returns every unit");

const divida = (await one(`select public.adicionar_divida(${maria}, 25, 'antiga', 'chave-divida-dev') j`)).j;
e = await err(`select public.propor_devolucao_nota(${divida.nota_id}, '[{"sale_id":1,"qtd":1}]', 'nao e mercadoria', 'chave-divida-01')`);
ok(e && /dívida anterior/.test(e), "debt-only note rejected: " + e);

await as("mike");
const livre = (await one(`select public.retirar_proposta_devolucao(${prop.proposta_id}, 'proposta errada') j`)).j;
ok(livre.status === "retirada" && livre.estoque_aplicado === false, "withdrawing a proposal does not move stock");
const depois = (await one(`select public.consultar_devolucao_nota(${pago}) j`)).j;
ok(depois.aceita === false, "withdrawn proposal does not reopen a cancelled note");

await db.exec("reset role; set role authenticated");
e = await err("select * from public.devolucao_proposta");
ok(e && /permission denied/.test(e), "proposal table is not readable by authenticated: " + e);
await db.exec("reset role");
ok(await ownerNum("select count(*) from public.devolucao_proposta where status = 'proposta'") >= 3, "open proposals remain auditable by the owner count");

await db.exec("reset role; insert into public.products(sku,marca,produto,preco_venda,estoque) values ('SYN-13450','Sint','Duo sintetico',13450,10)");
await as("kaio");
const credor = await num("select public.criar_cliente('Cliente Sintetico','11977770000', null)");
const homonimo = await num("select public.criar_cliente('comprador sem cadastro','11977770001', null)");
const caixaDe = async nome => ownerNum(`select id from public.caixas where nome = '${nome}'`);
const din = await caixaDe("Caixa Dinheiro"), hx = await caixaDe("Caixa PIX (HX)"), maq = await caixaDe("Máquina Loja");
const notaCaixa = async (metodo, caixa) => {
  await as("kaio");
  const idn = await num(`select public.criar_nota('[{"sku":"SYN-13450","qtd":1,"preco_vendido":13450}]','[{"metodo":"${metodo}","valor":13450}]', 'comprador sem cadastro', null)`);
  await as("mike");
  await num(`select public.lancar_nota_caixa(${idn}, ${caixa}::smallint)`);
  return idn;
};
const nDin = await notaCaixa("dinheiro", din), nHx = await notaCaixa("pix", hx), nCard = await notaCaixa("cartao", maq);
const fotoCaixa = async () => { await db.exec("reset role"); return (await one("select md5(coalesce(string_agg(caixa_id::text || tipo || valor::text || coalesce(nota_id::text, ''), ',' order by id), '')) h from public.caixa_movimentos")).h; };
const foto = await fotoCaixa();
const espAntes = await ownerNum("select count(*) from public.caixa_especial_mov");
const recAntes = await ownerNum("select count(*) from public.cliente_recebimentos");
const estAntes = await ownerNum("select estoque from public.products where sku = 'SYN-13450'");
await as("mike");
for (const [idn, chave] of [[nDin, "sint-din-13450"], [nHx, "sint-hx-13450"], [nCard, "sint-card-13450"]]) {
  const sid = await ownerNum(`select id from public.sales where nota_id = ${idn}`);
  const r = (await one(`select public.confirmar_devolucao_credito_loja(${idn}, '[{"sale_id":${sid},"qtd":1}]', 'devolucao paga sintetica', '${chave}', ${credor}) j`)).j;
  ok(Number(r.mercadoria) === 13450 && r.caixa_alterado === false && r.cxesp_alterado === false && r.cliente_id === credor, "credit 13450 without moving cash: " + chave);
  await db.exec("reset role");
  ok((await one(`select cliente_id from public.notas where id = ${idn}`)).cliente_id == null, "historical note stays unlinked: " + idn);
  await as("mike");
}
ok(await fotoCaixa() === foto, "dinheiro, HX, and card caixas are unchanged");
ok(await ownerNum("select count(*) from public.caixa_especial_mov") === espAntes, "cxesp balance is untouched");
ok(await ownerNum("select count(*) from public.cliente_recebimentos") === recAntes, "no new receipt");
const estDepois = await ownerNum("select estoque from public.products where sku = 'SYN-13450'");
ok(estDepois === estAntes + 3, "three paid units restocked once");
ok(await ownerNum(`select count(*) from public.cliente_creditos where cliente_id = ${credor} and valor = 13450`) === 3, "three store credits, none for the namesake");
ok(await ownerNum(`select count(*) from public.cliente_creditos where cliente_id = ${homonimo}`) === 0, "same typed name does not receive the credit");
const sidHx = await ownerNum(`select id from public.sales where nota_id = ${nHx}`);
const replay = (await one(`select public.confirmar_devolucao_credito_loja(${nHx}, '[{"sale_id":${sidHx},"qtd":1}]', 'devolucao paga sintetica', 'sint-hx-13450', ${credor}) j`)).j;
ok(replay.idempotente === true && await ownerNum(`select count(*) from public.cliente_creditos where cliente_id = ${credor} and valor = 13450`) === 3, "replay does not credit again");
e = await err(`select public.confirmar_devolucao_credito_loja(${nHx}, '[{"sale_id":${sidHx},"qtd":1}]', 'outra', 'sint-hx-mais', ${credor})`);
ok(e && /maior que a vendida/.test(e), "overreturn refused: " + e);
e = await err(`select public.confirmar_devolucao_credito_loja(${nDin}, '[{"sale_id":1,"qtd":1}]', 'sem cliente', 'sint-sem-cli', null)`);
ok(e && /Escolha o cliente/.test(e), "missing customer refused");
await as("kaio");
const soPrazo2 = await num(`select public.criar_nota('[{"sku":"SYN-13450","qtd":1,"preco_vendido":13450}]','[{"metodo":"prazo","valor":13450}]', null, ${credor})`);
await as("mike");
const sp2 = await ownerNum(`select id from public.sales where nota_id = ${soPrazo2}`);
e = await err(`select public.confirmar_devolucao_credito_loja(${soPrazo2}, '[{"sale_id":${sp2},"qtd":1}]', 'prazo aberto', 'sint-prazo', ${credor})`);
ok(e && /não recebido/.test(e), "unpaid note stays disabled: " + e);
await as("kaio");
const mistao = await num(`select public.criar_nota('[{"sku":"SYN-13450","qtd":1,"preco_vendido":13450}]','[{"metodo":"pix","valor":100},{"metodo":"prazo","valor":13350}]', null, ${credor})`);
await as("mike");
const sm = await ownerNum(`select id from public.sales where nota_id = ${mistao}`);
e = await err(`select public.confirmar_devolucao_credito_loja(${mistao}, '[{"sale_id":${sm},"qtd":1}]', 'misto aberto', 'sint-misto', ${credor})`);
ok(e && /não recebido/.test(e), "mixed unpaid remainder stays disabled: " + e);
e = await err(`select public.cancelar_nota(${nHx}, 'nao pode dobrar')`);
ok(e && /devolveria o estoque outra vez/.test(e), "later cancel cannot restock or pull the caixa: " + e);
ok(await fotoCaixa() === foto && await ownerNum("select estoque from public.products where sku = 'SYN-13450'") === estDepois - 2, "failed cancel left stock and every caixa as they were");
await as("pamela");
e = await err(`select public.confirmar_devolucao_credito_loja(${nCard}, '[{"sale_id":1,"qtd":1}]', 'financeiro', 'sint-fin', ${credor})`);
ok(e && /Somente admin/.test(e), "financeiro cannot confirm the credit return");

if (fails) { console.error(fails + " failed"); process.exit(1); }
console.log(passes + " passed");
