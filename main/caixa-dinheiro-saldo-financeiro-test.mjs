/* Caixa Dinheiro: Financeiro sees accumulated saldo only on caixa 1. Não grava produção. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const app = readFileSync(join(dir, "app.js"), "utf8");
const html = readFileSync(join(dir, "index.html"), "utf8");
const sql = readFileSync(join(dir, "../supabase-loja/migration-caixa-dinheiro-saldo-financeiro.sql"), "utf8");
let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.error("FAIL", m); } else console.log("ok", m); };

ok(html.includes("app.js?v=20261113k") && !html.includes("app.js?v=20261113j"), "live cache is 20261113k");

const caixa = app.slice(app.indexOf("const valorCard = c =>"), app.indexOf("const card = c =>"));
ok(caixa.includes("if (c.saldo != null)") && caixa.includes("Saldo total · hoje:") && caixa.includes("sem saldo acumulado"), "valorCard shows saldo total when the view returns a saldo, otherwise the 3-day movimento");
ok(caixa.includes("if (adm)") && caixa.includes("isHX(c)") && caixa.includes("Total de hoje"), "admin HX card still shows today's total, not accumulated saldo");

ok(app.includes("O saldo total aparece só na Caixa Dinheiro") && app.includes("nos outros caixas o saldo acumulado fica oculto"), "finNota explains Caixa Dinheiro is the exception");
ok(app.includes("admR || R.saldo_inicial != null || R.saldo_final != null") && app.includes("mostraSaldo ? \"SALDO FINAL\""), "Resumo uses returned saldo_inicial/final, not only the admin role");
ok(app.includes("role === \"admin\" || c.caixa_id === 1 ? saldo(c.caixa_id) : null") && app.includes("mostraSaldo = role === \"admin\" || c === 1"), "mock Financeiro saldo is only caixa 1");
ok(app.includes("mostra_saldo_caixas: [1]"), "janela fallback lists caixa 1 as saldo-visible");

ok(sql.includes("saldo_visivel_financeiro") && sql.includes("caixa_saldo_visivel") && sql.includes("set saldo_visivel_financeiro = true") && sql.includes("where id = 1"), "migration flags only caixa 1");
ok(sql.includes("security definer") && sql.includes("grant execute on function public.caixa_saldo_visivel(smallint) to authenticated") && !/grant execute on function public\.caixa_saldo_calc/.test(sql), "Financeiro cannot call caixa_saldo_calc directly");
ok(sql.includes("create or replace function public.caixa_resumo") && sql.includes("v_mostra := v_admin or exists (") && sql.includes("c.saldo_visivel_financeiro and not c.somente_admin"), "resumo returns real ini/fim only for flagged, allowed caixas");

if (failed) { console.error(failed + " failed"); process.exit(1); }
console.log("caixa dinheiro saldo financeiro ui ok");
