/* UI/string tests: admin can transfer to CAIXA ESPECIAL; financeiro cannot see it. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const read = f => readFileSync(join(dir, f), "utf8");
const app = read("app.js");
const html = read("index.html");
const sql = readFileSync(join(dir, "../supabase-loja/migration-transferir-especial.sql"), "utf8");
const kiosk = readFileSync(join(dir, "../kiosk/app.js"), "utf8");
let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.error("FAIL", m); } else console.log("ok", m); };

const caixa = app.slice(app.indexOf("async function viewCaixa"), app.indexOf("async function viewUsuarios"));
ok(caixa.includes('option value="cxesp">CAIXA ESPECIAL</option>') && caixa.includes("${adm ?") && caixa.includes('id="tde"') && caixa.includes('id="tpa"'), "admin transfer dropdowns include CAIXA ESPECIAL");
ok(caixa.includes("oEsp") && caixa.includes("dEsp") && caixa.includes("origemEspecial") && caixa.includes("destinoEspecial"), "form sends especial flags and keeps normal caixa ids");
ok(caixa.includes("Somente admin pode transferir envolvendo a Caixa Especial"), "UI also blocks a non-admin especial submit");
ok(caixa.includes("migration-transferir-especial.sql") && caixa.includes("Nada foi lançado"), "missing especial RPC points at the new draft SQL");

ok(app.includes("p_origem_especial") && app.includes("p_destino_especial") && app.includes('rpc("transferir_caixa"'), "live RPC passes the especial flags");
ok(app.includes('meU.role !== "admin"') && app.includes("Somente admin pode transferir envolvendo a Caixa Especial") && app.includes('destino: "cxesp"') && app.includes("caixa_mov_id"), "mock: admin-only especial path writes the link");
ok(app.includes('acao: "transferencia_especial"') && app.includes("transferência Caixa Especial"), "mock estorno reverses both sides");

ok(sql.includes("p_origem_especial") && sql.includes("p_destino_especial") && sql.includes("can('admin')") && sql.includes("caixa_especial_mov"), "draft RPC is admin-gated and writes caixa_especial_mov");
ok(sql.includes("caixa_mov_id") && sql.includes("estornar_movimento_caixa") && sql.includes("cx_esp_estornar") && sql.includes("transferencia_especial"), "link column and both estorno RPCs reverse the pair");
ok(!/create or replace function public\.(cx_esp_entrada|cx_esp_saida|criar_nota|lancar_credito|lancar_credito_caixa)\b/.test(sql), "draft does not replace cx_esp_entrada/saida or credit/sale functions");
ok(sql.includes("DRAFT") && sql.includes("não aplicar"), "SQL is marked draft, not to be applied yet");

ok(!kiosk.includes("CAIXA ESPECIAL") && !kiosk.includes("p_destino_especial"), "kiosk is unchanged");
ok(html.includes("app.js?v=20261114c") && html.includes("prazo-vencimento.js?v=20261111e") && html.includes("ponto.js?v=20261111d") && html.includes("ponto.css?v=20261111d"), "app cache 20261111e; ponto tags stay 20261111d");
ok(app.includes("Transferir entre caixas") && app.includes("lancar_credito_caixa") && app.includes("BAGDA_PONTO") && app.includes("<th>Cliente</th>"), "prior caixa, ponto, and Cliente features stay in app.js");

if (failed) { console.error(failed + " failed"); process.exit(1); }
console.log("transferir especial ui ok");
