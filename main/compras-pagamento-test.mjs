/* Forma de pagamento na compra e a lista de compras pendentes. Não grava produção. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const app = readFileSync(join(dir, "app.js"), "utf8");
const html = readFileSync(join(dir, "index.html"), "utf8");
const sql = readFileSync(join(dir, "../supabase-loja/migration-compras-pagamento.sql"), "utf8");
let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.error("FAIL", m); } else console.log("ok", m); };

ok(html.includes("app.js?v=20261113g") && html.includes('data-v="cpend" data-p="financas"') && html.includes("Compras pendentes"), "nav and cache expose Compras pendentes to financeiro");
ok(html.includes('data-v="pagar" data-p="financas"'), "the manual Contas a pagar button stays");

const compras = app.slice(app.indexOf("async function viewCompras"), app.indexOf("// ---------- Compras numeradas"));
ok(compras.includes("Pagar agora de um caixa") && compras.includes("Pagar depois (a pagar ao fornecedor)") && compras.includes('id="fpcx"') && compras.includes('id="fpsaldo"') && compras.includes('id="fpven"'), "compra save asks for a caixa with saldo or a later due date");
ok(compras.includes("somente_admin") && compras.includes("(só admin)"), "admin-only caixas are labeled and not offered to everyone");
ok(compras.includes("Saldo insuficiente") && compras.includes("api.compraPagamento") && compras.includes("migration-compras-pagamento.sql") && compras.includes('hd.pagamento = "agora"') && compras.includes('hd.pagamento = "depois"'), "loja save goes through the payment rpc and blocks a short saldo");
ok(compras.includes("depEspLote") && compras.indexOf('dest() === "esp"') < compras.indexOf("api.compraPagamento"), "Depósito Especial still saves without a caixa payment");
ok(compras.includes('id="taxa"') && compras.includes(">Nacional<") && compras.includes(">Importado<"), "Nacional/Importado cost lines stay on the compra screen");

const lista = app.slice(app.indexOf("async function viewComprasPendentes"), app.indexOf("async function viewPagar"));
ok(lista.includes("Compras pendentes") && lista.includes("atrasada") && lista.includes("Pagar") && lista.includes("caixa só admin") && lista.includes("Compras antigas"), "pending list groups what is owed and hides admin-only caixa names");
ok(app.includes('cpend: "financas"') && app.includes("cpend: viewComprasPendentes"), "the route is financeiro, which admin also has");
ok(app.includes("PAGAMENTO PRODUTOS") && app.includes("somente_admin: true"), "demo includes the admin-only product caixa");
ok(sql.includes("pagamento is null") && sql.includes("Compra antiga sem controle de pagamento") && sql.includes("(select public.can('financas'))") && sql.includes("somente_admin"), "SQL keeps legacy compras out and wraps the permission check");

if (failed) { console.error(failed + " failed"); process.exit(1); }
console.log("compras pagamento ui ok");
