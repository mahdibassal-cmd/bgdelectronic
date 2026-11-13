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
const imp = O.aplicarLinha({ sku: "APL-001", origem: "Nacional", preco_venda: 1299 }, { origem: "Importado", preco_usd: 100, custo_reais: 40 }, 1);
ok(imp.product.origem === "Importado" && imp.product.preco_usd === 100 && cents(imp.product.preco_venda) === 9999, "Importado at compra time stores US$ and the ,99 R$ price");

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

const app = read("app.js");
const html = read("index.html");
ok(html.includes("origem-preco.js?v=20261113d") && html.includes("app.js?v=20261113d") && html.includes("loja.css?v=20261113d"), "cache tags bumped for the new script, app, and css");
ok(app.includes('class="lo"') && app.includes(">Nacional<") && app.includes(">Importado<") && app.includes("preco_usd") && app.includes("custo_usd"), "compra lines choose Nacional or Importado and send the US$ price");
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
ok(sql.includes("custo_usd") && sql.includes("product_costs"), "optional US$ cost stays on the admin cost table");
const sellerView = sql.slice(sql.indexOf("view public.estoque_vendedor"), sql.indexOf("view public.v_admin_products"));
ok(sellerView.includes("p.origem") && !sellerView.includes("preco_usd"), "seller stock view gains origin and not the US$ price");
const kiosk = readFileSync(join(dir, "../kiosk/app.js"), "utf8");
ok(kiosk.includes("preco_venda") && !kiosk.includes("preco_usd") && !kiosk.includes("BAGDA_ORIGEM"), "kiosk still sells the stored R$ price");

if (failed) { console.error(failed + " failed"); process.exit(1); }
console.log("origem preco ok");
