/* Vencimentos button for vendedores: only their own unpaid notas. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(dir, "index.html"), "utf8");
const app = readFileSync(join(dir, "app.js"), "utf8");
const pz = readFileSync(join(dir, "prazo-vencimento.js"), "utf8");
const sql = readFileSync(join(dir, "..", "supabase-loja", "migration-vencimentos-vendedor.sql"), "utf8");
const rb = readFileSync(join(dir, "..", "supabase-loja", "rollback-vencimentos-vendedor.sql"), "utf8");
let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.error("FAIL", m); } else console.log("ok", m); };

ok(html.includes('data-v="vencimentos"') && html.includes('data-role="vendedor"') && html.includes("Vencimentos"), "nav has a Vencimentos button gated to the vendedor role");
ok(html.includes("prazo-vencimento.js?v=20261114a") && html.includes("app.js?v=20261114d") && !html.includes("app.js?v=20261114c"), "cache bumped to app 20261114d and prazo 20261114a");
ok(html.indexOf("prazo-vencimento.js") < html.indexOf("app.js?v=20261114d"), "prazo helper still loads before the app");

ok(app.includes('vencimentos: "vendas"') && app.includes('v === "vencimentos" && me && me.role !== "vendedor"'), "route requires vendas and is rejected unless the user is a vendedor");
ok(app.includes("nav button[data-role]") && app.includes("me.role !== b.dataset.role"), "boot hides data-role buttons for every other role");
ok(app.includes("refreshVencimentosBadge") && app.includes("api.vencimentosVendedor") && app.includes('me.role !== "vendedor"'), "badge is only filled for vendedores");
ok(app.includes("async function viewVencimentos") && app.includes("somente as suas notas em aberto") && app.includes("viewVencimentosCliente"), "Vencimentos page and scoped client view exist");
ok(app.includes('class="cob-nota"') && app.includes("viewRecibo(+a.dataset.n, () => viewVencimentos())"), "a nota number opens the existing nota viewer and Voltar returns to Vencimentos");
ok(app.includes("viewVencimentosCliente(+a.dataset.c, cob)") && app.includes("não é o extrato financeiro"), "a client name opens the scoped list, not the finance statement");
ok(!/async function viewVencimentos[\s\S]*cliente_extrato/.test(app.slice(app.indexOf("async function viewVencimentos"), app.indexOf("async function viewReceber"))), "the vendedor views do not call cliente_extrato");
ok(app.includes('receber: "financas"') && app.includes('if (!isFin) return ""') && app.includes("api.cobrancaAlertas"), "admin/financeiro Cobrança path is unchanged");

const live = app.slice(app.indexOf("async vencimentosVendedor() { const r"), app.indexOf("async estornarRecebimento"));
ok(live.includes('rpc("vencimentos_vendedor")') && live.includes("pendente_sql") && !live.includes("apply_migration") && !live.includes("execute_sql"), "live API only reads vencimentos_vendedor and degrades if the SQL is pending");

const mock = app.slice(app.indexOf("async vencimentosVendedor() { await ready"), app.indexOf("async estornarRecebimento(rid, m) { if (meU.role"));
ok(mock.includes('role !== "vendedor"') && mock.includes("n.handle === meU.handle") && mock.includes("todos: true") && !mock.includes("needFin()"), "mock filters by the signed-in vendedor handle and does not use the finance gate");
ok(app.includes('handle: "@kaio"') && mock.includes("meU.handle"), "demo Kaio notes stay attributed to @kaio so the vendedor mock only sees his");

ok(pz.includes("todos") && pz.includes("html[data-theme=dark] .cobranca-panel .badge.vencida"), "montar accepts todos=true and badges have dark-mode colors");

ok(sql.includes("private.vencimentos_vendedor_ler") && sql.includes("security definer") && sql.includes("seller_id = v_uid") && sql.includes("auth.uid()"), "RPC is security definer and always filters seller_id = auth.uid()");
ok(sql.includes("public.can('vendas')") && sql.includes("public.vencimentos_vendedor") && sql.includes("security invoker"), "public wrapper is invoker, requires vendas, and does not use financas");
const sqlBody = sql.replace(/--[^\n]*/g, "");
ok(!sqlBody.includes("limite_prazo") && !sqlBody.includes("caixa_") && !/custo/i.test(sqlBody) && !sqlBody.includes("cobranca_alertas") && !sql.includes("create or replace function public.cobranca_alertas"), "vendedor RPC does not return limite, caixa, cost, and does not redefine cobranca_alertas");
ok(sql.includes("em_aberto > 0.001") && sql.includes("status = 'ativa'") && sql.includes("n_sem_vencimento"), "lists every unpaid active nota of the caller, including those without vencimento");
ok(sql.includes("revoke all on function public.vencimentos_vendedor()") && sql.includes("grant execute") && sql.includes("rollback-vencimentos-vendedor.sql"), "grants are locked down and the rollback path is documented");
ok(rb.includes("drop function if exists public.vencimentos_vendedor()") && rb.includes("drop function if exists private.vencimentos_vendedor_ler()") && rb.includes("Does not touch cobranca_alertas"), "rollback drops only the new RPCs");
ok(!sql.includes("update public.notas") && !sql.includes("insert into") && !sql.includes("delete from"), "migration does not write business data");

if (failed) { console.error(failed + " failed"); process.exit(1); }
console.log("vencimentos vendedor ok");
