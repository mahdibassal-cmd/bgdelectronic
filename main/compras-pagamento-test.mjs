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

ok(html.includes("app.js?v=20261114d") && html.includes('data-v="cpend" data-p="admin"') && html.includes("Compras pendentes"), "nav and cache keep Compras pendentes for admin only");
ok(html.includes('data-v="pagar" data-p="financas"'), "the manual Contas a pagar button stays");

const compras = app.slice(app.indexOf("async function viewCompras"), app.indexOf("// ---------- Compras numeradas"));
ok(compras.includes("Pagar agora de um caixa") && compras.includes("Pagar depois (a pagar ao fornecedor)") && compras.includes("Lançar como dívida no caixa especial") && compras.includes('id="fp-divida"') && compras.includes('id="fpcx"') && compras.includes('id="fpsaldo"') && compras.includes('id="fpven"'), "compra save asks for a caixa with saldo, a later due date, or an admin debt");
ok(compras.includes('hd.pagamento = "divida"') && compras.includes("Somente admin") === false && compras.includes("me.role !== \"admin\"") && compras.includes("Sem trava de saldo"), "debt option is admin-only and does not block on saldo");
ok(compras.includes("somente_admin") && compras.includes("(só admin)"), "admin-only caixas are labeled and not offered to everyone");
ok(compras.includes("Saldo insuficiente") && compras.includes("api.compraPagamento") && compras.includes("migration-compras-pagamento.sql") && compras.includes('hd.pagamento = "agora"') && compras.includes('hd.pagamento = "depois"'), "loja save goes through the payment rpc and blocks a short saldo");
ok(compras.includes("depEspLote") && compras.indexOf('dest() === "esp"') < compras.indexOf("api.compraPagamento"), "Depósito Especial still saves without a caixa payment");
ok(compras.includes('id="taxa"') && compras.includes(">Nacional<") && compras.includes(">Importado<"), "Nacional/Importado cost lines stay on the compra screen");

const lista = app.slice(app.indexOf("async function viewComprasPendentes"), app.indexOf("async function viewPagar"));
ok(lista.includes("Compras pendentes") && lista.includes("atrasada") && lista.includes("Pagar") && lista.includes("caixa só admin") && lista.includes("Compras antigas") && lista.includes('!can("admin")'), "pending list is admin only and hides admin-only caixa names");
ok(app.includes("Liberar histórico para Financeiro") && app.includes("sem saldo acumulado") && app.includes("fl-rev"), "caixa screen still hides accumulated saldo on most caixas and lets admin grant or revoke a wider window");
ok(app.includes('cpend: "admin"') && app.includes("cpend: viewComprasPendentes"), "the route is admin only");
ok(app.includes("PAGAMENTO PRODUTOS") && app.includes("COMPRA PRODUTOS") && app.includes("caixa_id: 18") && app.includes("somente_admin: true"), "demo includes PAGAMENTO PRODUTOS and COMPRA PRODUTOS as admin-only");
ok(compras.includes('c.caixa_id === 18 ? "selected"'), "dívida defaults to COMPRA PRODUTOS (id 18)");
const caixa = app.slice(app.indexOf("async function viewCaixa"), app.indexOf("async function viewUsuarios"));
ok(caixa.includes('id="tpa"') && caixa.includes("somente_admin") && caixa.includes("COMPRA PRODUTOS"), "admin transfer Para lists the admin-only compra caixa");
ok(caixa.includes("SA.filter(c => !c.somente_admin)"), "De stays the regular caixas; admin-only caixas are the destination");
ok(sql.includes("pagamento is null") && sql.includes("Compra antiga sem controle de pagamento") && sql.includes("(select public.can('financas'))") && sql.includes("somente_admin") && sql.includes("p_divida") && sql.includes("Dívida só no caixa especial"), "SQL keeps legacy compras out, wraps the permission check, and lets an admin debt skip the saldo");
ok(app.includes("caixaSaldoHtml") && app.includes("· dívida"), "a negative caixa saldo is labeled dívida");

if (failed) { console.error(failed + " failed"); process.exit(1); }
console.log("compras pagamento ui ok");
