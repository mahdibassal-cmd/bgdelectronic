/* Origem Nacional/Importado, regra ,99 e a cotação. Não grava produção. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const dir = dirname(fileURLToPath(import.meta.url));
const read = name => readFileSync(join(dir, name), "utf8");
const sandbox = {};
runInNewContext(read("origem-preco.js"), sandbox, { filename: "origem-preco.js" });
const O = sandbox.BAGDA_ORIGEM;
let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.error("FAIL", m); } else console.log("ok", m); };
const cents = n => Math.round(Number(n) * 100);

ok(O.parseUsd("").error && O.parseUsd("0").error && O.parseUsd("-1").error && O.parseCotacao("0").error && O.parseCotacao("1000").error, "zero, empty, and out-of-range rates are rejected");
ok(O.parseUsd("10,50").value === 10.5 && O.parseCotacao("R$ 5,4321").value === 5.4321 && O.parseCotacao("5.40").value === 5.4, "comma and dot money parse");
ok(O.parseCotacao("5,43214").error && O.parseUsd("10.509").error, "extra decimals are rejected");
ok(O.parseCustoUsd("").value === null && O.parseCustoUsd("0").value === 0 && O.parseCustoUsd("-1").error, "US$ cost is optional and can be zero");

const a = O.precoReaisImportado(100, 1, null);
ok(a.aplicado99 && a.redondo === 100 && cents(a.preco) === 9999, "100.00 becomes 99.99");
ok(cents(O.precoReaisImportado(100, 1, 100).preco) === 10000 && O.precoReaisImportado(100, 1, 100).aplicado99 === false, "99.99 below the cost keeps the round value");
ok(cents(O.precoReaisImportado(100, 1, 99.99).preco) === 9999, "99.99 equal to the cost still uses ,99");
ok(cents(O.precoReaisImportado(100, 1, 99.98).preco) === 9999, "cost under the ,99 price keeps ,99");
ok(cents(O.precoReaisImportado(10, 5.4321, null).preco) === 5399 && O.precoReaisImportado(10, 5.4321, null).redondo === 54, "10 × 5.4321 rounds to 54 then 53.99");
ok(cents(O.precoReaisImportado(10.5, 5.4, null).preco) === 5699 && O.precoReaisImportado(10.5, 5.4, null).redondo === 57, "56.70 rounds half up to 57 then 56.99");
ok(O.precoReaisImportado(1, 10.5, null).redondo === 11 && cents(O.precoReaisImportado(1, 10.5, null).preco) === 1099, "10.50 rounds half away from zero to 11");
ok(cents(O.precoReaisImportado(1, 10.5, 11).preco) === 1100, "half-up round value is kept when ,99 is below cost");
ok(O.precoReaisImportado(1, 10.4999, null).redondo === 10 && cents(O.precoReaisImportado(1, 10.4999, null).preco) === 999, "10.4999 stays on 10 then 9.99");
ok(O.precoReaisImportado(0, 5).error && O.precoReaisImportado(10, 0).error, "missing dollar price or rate is rejected");
ok(cents(O.custoReaisDeUsd(10, 5.4321).value) === 5432, "US$ cost converts to cents without the ,99 rule");

const nacional = O.aplicarLinha({ sku: "JBL-001", origem: "Nacional", preco_venda: 799, preco_usd: 150 }, { origem: "Nacional", preco_usd: 150, custo_reais: 400 }, 5.4);
ok(nacional.product.preco_venda === 799 && nacional.product.origem === "Nacional", "Nacional keeps the current R$ price");
const intact = O.aplicarLinha({ sku: "JBL-001", origem: "Importado", preco_venda: 799, preco_usd: 100 }, { origem: null }, 5.4);
ok(intact.product.preco_venda === 799 && intact.product.preco_usd === 100, "a purchase line without origin does not retouch the product");
const imp = O.aplicarLinha({ sku: "APL-001", origem: "Nacional", preco_venda: 1299, preco_usd: null }, { origem: "Importado", custo_reais: 400 }, 5.4);
ok(imp.product.origem === "Importado" && imp.product.preco_usd == null && imp.product.preco_venda === 1299, "a compra does not invent a US$ sale price or zero the shelf price");
const ja = O.aplicarLinha({ sku: "APL-001", origem: "Importado", preco_venda: 10, preco_usd: 100 }, { origem: "Importado", custo_reais: 40 }, 1);
ok(ja.product.preco_usd === 100 && cents(ja.product.preco_venda) === 9999, "an existing US$ sale price is repriced from the global rate");

const notas = [{ sku: "APL-001", preco_vendido: 1299, preco_tabela: 1299 }];
const antes = JSON.stringify(notas);
const custos = { "APL-001": 400, "JBL-001": 480 };
const produtos = [
  { sku: "JBL-001", origem: "Nacional", preco_venda: 799 },
  { sku: "APL-001", origem: "Importado", preco_usd: 100, preco_venda: 500 }
];
const depois = O.recalcularImportados(produtos, custos, 5.4);
ok(depois[0].preco_venda === 799 && cents(depois[1].preco_venda) === 53999, "a new rate reprices only Importado rows");
ok(JSON.stringify(notas) === antes && JSON.stringify(produtos[1].preco_venda) === "500", "saved notas and the previous list stay untouched");
const piso = O.recalcularImportados([{ sku: "APL-001", origem: "Importado", preco_usd: 100, preco_venda: 99.99 }], { "APL-001": 100 }, 1);
ok(cents(piso[0].preco_venda) === 10000, "rate recalc keeps the round value when ,99 would drop under cost");

const ex = O.aplicarCotacao(
  [{ sku: "IMP", origem: "Importado", preco_usd: 100, preco_venda: 1 }, { sku: "NAC", origem: "Nacional", preco_venda: 799 }],
  { IMP: { custo: 100, custo_usd: 80 }, NAC: { custo: 480, custo_usd: null } },
  5.4
);
ok(cents(ex.costs.IMP.custo) === 43200 && cents(ex.products[0].preco_venda) === 53999, "US$ 80 at 5.40 becomes R$ 432.00 and the shelf is 539.99");
ok(ex.costs.NAC.custo === 480 && ex.products[1].preco_venda === 799, "a Nacional cost and price are not touched by the rate");
const acima = O.aplicarCotacao([{ sku: "IMP", origem: "Importado", preco_usd: 100, preco_venda: 1 }], { IMP: { custo: 1, custo_usd: 100 } }, 5.4);
ok(cents(acima.costs.IMP.custo) === 54000 && cents(acima.products[0].preco_venda) === 54000, "when the new R$ cost is 540 the ,99 price is kept at the round 540");
const compra = O.custoReaisDeUsd(80, 5.8);
ok(cents(compra.value) === 46400 && cents(ex.costs.IMP.custo) === 43200, "the compra rate prices that purchase; the live cost stays on the global rate");
const semPreco = O.aplicarCotacao([{ sku: "IMP", origem: "Importado", preco_venda: 799, preco_usd: null }], { IMP: { custo: 10, custo_usd: 80 } }, 5.4);
ok(cents(semPreco.costs.IMP.custo) === 43200 && semPreco.products[0].preco_venda === 799, "rate save updates the R$ cost and leaves the shelf price when there is no US$ price");

const app = read("app.js");
const html = read("index.html");
ok(html.includes("origem-preco.js?v=20261113f") && html.includes("app.js?v=20261113k") && html.includes("loja.css?v=20261113d"), "cache tags bumped for the new script and app");
const compras = app.slice(app.indexOf("async function viewCompras"), app.indexOf("// ---------- Compras numeradas"));
ok(compras.includes('class="lo"') && compras.includes(">Nacional<") && compras.includes(">Importado<") && compras.includes("Custo (US$)") && compras.includes("Custo un. (R$)"), "compra lines ask only for cost, in R$ or US$");
ok(!compras.includes("Preço venda") && !compras.includes('class="lu"') && !compras.includes("Preço (US$)"), "Compras has no selling-price input");
ok(compras.includes('id="taxa"') && compras.includes("Taxa do dólar desta compra") && compras.indexOf('id="lns"') < compras.indexOf('id="taxabox"'), "one dollar rate sits after the lines");
ok(compras.includes("Custo em R$") && compras.includes("custo_usd"), "an Importado line previews custo_usd times the compra rate");
const telaProdutos = app.slice(app.indexOf("async function viewProdutos"), app.indexOf("async function viewSeguranca"));
ok(telaProdutos.includes('id="pu"') && telaProdutos.includes("Preço (US$)"), "the US$ selling price stays on the product screen");
ok(app.includes('id="cotacao"') && app.includes("Cotação do dólar") && app.includes("cotacaoSalvar") && app.includes("última atualização"), "admin can edit the rate and sees when it last changed");
ok(app.includes("usd-b") && app.includes(">US$<"), "importado rows get a US$ badge");
const nota = app.slice(app.indexOf("async function viewNota"), app.indexOf("async function viewRecibo"));
ok(nota.includes("usdBadge") && !nota.includes("preco_usd") && nota.includes("brl(p.preco_venda)"), "Nova nota keeps showing the R$ table price");
const estoque = app.slice(app.indexOf("async function viewEstoque"), app.indexOf("async function viewRelatorio"));
ok(estoque.includes("usdBadge") && !estoque.includes("preco_usd"), "stock list badges Importado and does not print the dollar price");
ok(app.includes('role !== "admin"') && app.includes("Só admin altera a cotação"), "mock refuses a non-admin rate change");
ok(app.includes("registrar_compra_origem") && app.includes("Nada foi salvo"), "Importado is not saved on the old compra RPC");

const sql = readFileSync(join(dir, "../supabase-loja/migration-origem-dolar.sql"), "utf8");
ok(sql.startsWith("-- DRAFT") && sql.includes('default \'Nacional\'') && sql.includes("where origem is null"), "existing products default to Nacional");
ok(sql.includes("round(p_usd * p_cotacao, 0)") && sql.includes("v_redondo - 0.01") && sql.includes("v_99 < p_custo"), "SQL uses the same ,99 rule");
ok(sql.includes("Só admin altera a cotação") && sql.includes("Só admin altera origem ou preço em US$"), "rate and origin changes require admin");
ok(/revoke all on public\.cotacao_dolar from public, anon, authenticated/.test(sql), "the rate history is not granted to the client roles");
ok(sql.includes("alterado_por") && sql.includes("alterado_em") && sql.includes("historico"), "history keeps value, who, and when");
ok(!/update\s+public\.(sales|notas|sale_costs)\b/i.test(sql), "saved notas and their prices are not rewritten");
ok(sql.includes("where origem = 'Importado'") && sql.includes("bagda.recalc_dolar"), "saving the rate recalculates Importado shelf prices immediately");
ok(sql.includes("origem_ok") && sql.includes("registrar_compra_origem") && sql.includes("new.origem is null then return null"), "compra sets origin only when the line sends it");
ok(sql.includes("custo_usd") && sql.includes("product_costs") && sql.includes("round(c.custo_usd * round(p_valor, 4), 2)") && sql.includes("p.origem = 'Importado' and c.custo_usd is not null"), "saving the global rate recomputes Importado R$ cost from custo_usd");
ok(sql.includes("new.custo_usd * new.taxa_dolar") && sql.includes("new.taxa_dolar := null") && sql.includes("new.custo_usd * v_global"), "the compra rate prices that purchase line; the live cost uses the global rate; Nacional stores no rate");
ok(sql.includes("if new.preco_usd is null then") && sql.includes("return new") && !sql.includes("Item importado precisa de preço em US$") && sql.includes("Item importado precisa de custo em US$"), "without a US$ sale price the shelf price stays, and an import costs in US$");
ok(sql.includes("compras add column if not exists taxa_dolar") && sql.includes("purchases add column if not exists taxa_dolar"), "the rate used is stored on the compra and on the purchase line");
const sellerView = sql.slice(sql.indexOf("view public.estoque_vendedor"), sql.indexOf("view public.v_admin_products"));
ok(sellerView.includes("p.origem") && !sellerView.includes("preco_usd"), "seller stock view gains origin and not the US$ price");
const kiosk = readFileSync(join(dir, "../kiosk/app.js"), "utf8");
ok(kiosk.includes("preco_venda") && !kiosk.includes("preco_usd") && !kiosk.includes("BAGDA_ORIGEM"), "kiosk still sells the stored R$ price");

if (failed) { console.error(failed + " failed"); process.exit(1); }
console.log("origem preco ok");
