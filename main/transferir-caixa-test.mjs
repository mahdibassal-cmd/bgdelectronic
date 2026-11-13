/* Transferência entre caixas + coluna Cliente. Sem banco. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const app = readFileSync(join(dir, "app.js"), "utf8");
const html = readFileSync(join(dir, "index.html"), "utf8");
const sql = readFileSync(join(dir, "../supabase-loja/migration-transferir-caixa.sql"), "utf8");
const kiosk = readFileSync(join(dir, "../kiosk/app.js"), "utf8");
let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.error("FAIL", m); } else console.log("ok", m); };

const caixa = app.slice(app.indexOf("async function viewCaixa"), app.indexOf("async function viewUsuarios"));
ok(caixa.includes("Lançamento manual") && caixa.includes("Transferir entre caixas") && caixa.includes('id="tde"') && caixa.includes('id="tpa"') && caixa.includes('id="tv"') && caixa.includes('id="tm"') && caixa.includes(">Transferir</button>"), "Caixa page has the transfer card next to lançamento manual");
ok(caixa.includes("api.transferirCaixa") && caixa.includes("viewCaixa(d)") && caixa.includes("Transferência lançada"), "transfer refreshes saldos after a successful RPC");
ok(caixa.includes("<th>Cliente</th>") && caixa.includes('(m.cliente || "").trim() || "—"'), "caixa extrato has a Cliente column and shows — when none");
ok(caixa.includes("migration-transferir-caixa.sql") && caixa.includes("Nada foi lançado"), "missing RPC points at the draft SQL and writes nothing");

const notas = app.slice(app.indexOf("async function viewNotas"), app.indexOf("async function estornarMovBox"));
ok(notas.includes("<th>Data / hora</th><th>Cliente</th><th>Pagamento</th>"), "Notas list puts Cliente between Data/hora and Pagamento");
ok(notas.includes('cli(n) ? esc(cli(n)) : "—"') && notas.includes("n.cliente") && notas.includes('id="nq"'), "Notas shows — when there is no client and the search includes the name");

const receber = app.slice(app.indexOf("async function viewReceber"), app.indexOf("function exportCSV"));
ok(receber.includes("<h2>Recebimentos por cliente</h2>") && receber.includes("<th>Data</th><th>Cliente</th><th>Forma</th>"), "Contas a receber / recebimentos still list the client name");

const resumo = app.slice(app.indexOf("async function viewResumo"), app.indexOf("async function viewHxDia"));
ok(resumo.includes("<th>Cliente</th>") && resumo.includes('(m.cliente || "").trim() || "—"') && !resumo.includes("Cliente / fornecedor"), "Resumo do dia Cliente column shows the name or —, not the motivo");

const hx = app.slice(app.indexOf("async function viewHxDia"), app.indexOf("async function viewCxEsp"));
ok(hx.includes("<th>Cliente</th>") && hx.includes("<th>Motivo</th>"), "HX por dia also has a Cliente column");

ok(app.includes('rpc("transferir_caixa"') && app.includes("async transferirCaixa"), "live and mock APIs call transferir_caixa");
ok(!kiosk.includes("transferir_caixa") && !kiosk.includes("Transferir entre caixas"), "kiosk is unchanged");
ok(html.includes("app.js?v=20261113i"), "cache tag is newer than 20261109e");

ok(sql.includes("create or replace function public.transferir_caixa") && sql.includes("caixa_acesso()") && sql.includes("caixa_saldo_calc") && sql.includes("grant execute on function public.transferir_caixa"), "draft RPC is security definer, gated by caixa_acesso, checks saldo, granted to authenticated");
ok(sql.includes("Transferência para ") && sql.includes("Transferência de ") && sql.includes("'saida'") && sql.includes("'entrada'"), "paired motivos use existing saida/entrada types");
ok(!/create or replace function public\.(lancar_credito|lancar_credito_caixa|registrar_recebimento_credito|criar_nota|criar_nota_local|pagar_conta|cancelar_nota|cx_esp_entrada|cx_esp_saida)\b/.test(sql), "draft does not replace credit, sale, payment, or Caixa Especial functions");
ok(sql.includes("coalesce(cln.nome, n.cliente, cl.nome) as cliente"), "extrato view gains a cliente column from the nota or the receipt");
ok(sql.includes("DRAFT") && sql.includes("não aplicar"), "SQL is marked draft, not to be applied yet");

if (failed) { console.error(failed + " failed"); process.exit(1); }
console.log("transferir caixa ui ok");
