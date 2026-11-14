/* Cobrança: nota number opens the existing nota viewer; client name opens the statement. Sem banco. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const app = readFileSync(join(dir, "app.js"), "utf8");
const html = readFileSync(join(dir, "index.html"), "utf8");
let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.error("FAIL", m); } else console.log("ok", m); };

ok(html.includes("app.js?v=20261114c") && !html.includes("app.js?v=20261114b"), "cache bumped past 20261114b");

const receber = app.slice(app.indexOf("async function viewReceber"), app.indexOf("async function exportCSV"));
ok(receber.includes('class="cob-nota"') && receber.includes("data-n=") && receber.includes("viewRecibo(+a.dataset.n"), "each Cobrança nota number opens the existing nota viewer");
ok(receber.includes('class="cob-cli"') && receber.includes("data-c=") && receber.includes("viewClienteExtrato(+a.dataset.c") && receber.includes("api.clienteExtrato"), "the client name opens the existing Clientes statement when the extrato is available");
ok(receber.includes("() => viewReceber(rfSel)"), "Voltar from the nota or the statement returns to Cobrança");
ok(receber.includes('if (!isFin) return ""') && app.includes('receber: "financas"') && receber.includes("me.role === \"admin\" || me.role === \"financeiro\""), "who can see Cobrança is unchanged (admin and financeiro)");
ok(receber.includes("api.cobrancaAlertas") && !receber.includes("apply_migration") && !receber.includes("execute_sql"), "still only reads cobrancaAlertas; no new write path");
ok(app.includes("async function viewRecibo(nid, back)") && app.includes('id="bk">Voltar') && app.includes("if ($(\"#bk\")) $(\"#bk\").onclick = back"), "the current nota viewer gains an optional Voltar without changing the print receipt");
ok(app.includes("async function viewClienteExtrato(cid, back)") && app.includes("(back || viewClientes)()"), "the client statement still works from Clientes, and accepts a back target from Cobrança");
ok(app.includes("reciboTxt") && app.includes("viewRecibo(+b.dataset.n)") && !app.includes("viewRecibo(+b.dataset.n,"), "Notas and Relatório still open the same viewer");

if (failed) { console.error(failed + " failed"); process.exit(1); }
console.log("cobranca abrir nota ok");
