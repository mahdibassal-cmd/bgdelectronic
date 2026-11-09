/* Carrinho: Principal e Especial não compartilham quantidade. Sem banco. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const dir = dirname(fileURLToPath(import.meta.url));
const sandbox = {};
runInNewContext(readFileSync(join(dir, "venda-origem.js"), "utf8"), sandbox, { filename: "venda-origem.js" });
const VO = sandbox.BAGDA_VENDA_ORIGEM;
let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.error("FAIL", m); } else console.log("ok", m); };

ok(VO.origemOf({}) === "principal" && VO.origemOf({ origem: null }) === "principal" && VO.origemLabel("especial") === "Especial", "missing source defaults to Principal");
ok(VO.available(2, 5, "principal") === 2 && VO.available(2, 5, "especial") === 5, "each source reports its own quantity");
ok(VO.available(0, 5, "principal") === 0 && VO.available(4, 0, "especial") === 0, "an empty source is not filled from the other");
const cart = [{ sku: "A", origem: "principal", qtd: 1 }];
const principal = VO.checkQty(2, 5, cart, "A", "principal", 1);
const especial = VO.checkQty(2, 5, cart, "A", "especial", 5);
ok(principal.ok && principal.have === 2 && especial.ok && especial.have === 5, "same SKU can use the other source without borrowing");
ok(!VO.checkQty(2, 5, cart, "A", "principal", 2).ok, "principal refuses more than its own stock");
ok(!VO.checkQty(2, 1, [], "A", "especial", 2).ok, "especial refuses more than its own stock and does not switch");
ok(VO.checkQty(0, 3, [], "A", "especial", 3).ok, "especial can sell when the store stock is zero");

const app = readFileSync(join(dir, "app.js"), "utf8");
const nota = app.slice(app.indexOf("async function viewNota"), app.indexOf("async function viewRecibo"));
ok(nota.includes('id="origem"') && nota.includes(">Principal<") && nota.includes(">Especial<") && nota.includes("podeEspecial") && nota.includes("vendaOrigemPronta"), "sale screen offers Principal and Especial");
ok(nota.includes("De qual estoque") && !nota.includes("Local do pagamento") === false, "source label is not the payment local");
ok(nota.includes('origem === "especial" ? { origem: "especial" }') && nota.includes("VO.checkQty"), "the chosen source is sent and checked");
const kiosk = readFileSync(join(dir, "../kiosk/app.js"), "utf8");
ok(!kiosk.includes('id="origem"') && !kiosk.includes("BAGDA_VENDA_ORIGEM"), "kiosk sale screen is unchanged");
const sql = readFileSync(join(dir, "../supabase-loja/migration-venda-origem.sql"), "utf8");
ok(sql.includes("default 'principal'") && sql.includes("Depósito Especial sem estoque suficiente") && sql.includes("Sem permissão para vender do Depósito Especial"), "draft SQL defaults old rows and refuses the wrong source");
ok(sql.includes("_devolver_estoque_nota") && sql.includes("estorno_venda") && sql.includes("Só admin cancela nota") && sql.includes("v_cxesp := public._cxesp_estornar_nota"), "cancel returns stock to the recorded source and keeps the live admin cancel");
ok(!/create or replace function public\.criar_nota_local/.test(sql) && !/function public\.pagar_conta/.test(sql) && !sql.includes("to_regprocedure"), "draft does not replace Caixa Especial sale creation or bill payment");

if (failed) { console.error(failed + " failed"); process.exit(1); }
console.log("venda origem ui ok");
