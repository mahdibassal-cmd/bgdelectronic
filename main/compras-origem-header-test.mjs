/* Origem da compra no cabeçalho (uma vez), não por linha. Sem banco. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const app = readFileSync(join(dir, "app.js"), "utf8");
const html = readFileSync(join(dir, "index.html"), "utf8");
let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.error("FAIL", m); } else console.log("ok", m); };

ok(html.includes("app.js?v=20261114b") && html.includes("loja.css?v=20261114a") && !html.includes("app.js?v=20261114a"), "cache bumped past 20261114a");

const compras = app.slice(app.indexOf("async function viewCompras"), app.indexOf("// ---------- Compras numeradas"));
ok(compras.includes('id="corigem"') && compras.includes('id="origembox"') && compras.indexOf('id="corigem"') < compras.indexOf("<h3>Itens</h3>"), "Origem sits in the compra header, before the items");
ok(!compras.includes('class="lo"') && !compras.includes("<label>Origem</label><select class=\"lo\">"), "per-line Origem select is gone");
ok(compras.includes("origemCompra()") && compras.includes('origemCompra() === "Importado"') && compras.includes('l.origem = origemCompra() === "Importado" ? "Importado" : "Nacional"'), "save stamps every line with the header origem");
ok(compras.includes('hd.taxa_dolar = itens.find(x => x.origem === "Importado").taxa_dolar') && compras.includes("row.custo_usd") && compras.includes("custoReaisDeUsd"), "Importado still sends custo_usd and the compra taxa on each line");
ok(compras.includes("Pagar agora de um caixa") && compras.includes("Pagar depois") && compras.includes("Lançar como dívida no caixa especial") && compras.includes("api.compraPagamento") && compras.includes('c.caixa_id === 18'), "payment options from #30 stay: caixa now, pagar depois, COMPRA PRODUTOS dívida");
ok(compras.indexOf('dest() === "esp"') < compras.indexOf("api.compraPagamento") && compras.includes("depEspLote") && compras.includes("semOrigem"), "Depósito Especial still saves without origem or a caixa payment");
ok(compras.includes("obox.hidden = !loja()") && compras.includes('origemCompra() === "Importado"'), "origem and the dollar rate hide for Depósito Especial and when the compra is Nacional");
ok(!compras.includes('p.origem === "Importado") l.origem') && compras.includes('if ($("#corigem")) $("#corigem").onchange'), "changing the header origem redraws every line; picking a product does not override the header");
ok(compras.includes("Custo (US$)") && compras.includes("Custo un. (R$)") && compras.includes('class="lcu"') && compras.includes('class="lc"'), "Nacional lines take Custo (R$); Importado lines take Custo (US$)");
ok(compras.includes("Pagar depois ou dívida segue a cotação do dia até o pagamento") && compras.includes("Pagar agora trava o custo"), "câmbio pago #33 copy stays on the taxa field");
ok(compras.includes("adm ? api.costs()") && app.includes("Só admin altera a cotação") && app.includes("me.role !== \"admin\" || !api.cotacaoLer"), "costs and cotação stay admin-only");

if (failed) { console.error(failed + " failed"); process.exit(1); }
console.log("compras origem header ok");
