/* Adicionar crédito pode entrar num caixa. Sem banco. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const app = readFileSync(join(dir, "app.js"), "utf8");
const sql = readFileSync(join(dir, "../supabase-loja/migration-credito-caixa.sql"), "utf8");
const kiosk = readFileSync(join(dir, "../kiosk/app.js"), "utf8");
let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.error("FAIL", m); } else console.log("ok", m); };

const view = app.slice(app.indexOf("async function viewCaixaGeral"), app.indexOf("async function viewLancar"));
ok(view.includes("Sem caixa (crédito antigo)") && view.includes("Entra no caixa") && view.includes("api.lancarCreditoCaixa") && view.includes("api.lancarCredito"), "entrada can stay off-caixa or enter a caixa");
ok(view.includes('id="fm"') && view.includes("transferencia") && view.includes("O caixa grava a data de hoje"), "a caixa without a fixed method asks for the form, and the date stays today");
ok(!view.includes("CAIXA SPECIAL") && !view.includes("cxesp"), "Caixa Especial is not offered on this credit form");
ok(view.includes("k.caixa") && view.includes("estorno do mesmo valor"), "history shows the caixa and the estorno names it");
ok(app.includes('rpc("lancar_credito_caixa"') && app.includes("Crédito no caixa não quita dívida") && app.includes('tipo: "estorno"'), "client and mock book the caixa and reverse it");
ok(!kiosk.includes("lancarCreditoCaixa") && !kiosk.includes("lancar_credito_caixa"), "kiosk is unchanged");
ok(sql.includes("lancar_credito_caixa") && sql.includes("Crédito Caixa Geral ") && sql.includes("mov_id") && !/create or replace function public\.(lancar_credito|registrar_recebimento_credito|criar_nota|criar_nota_local|pagar_conta|cancelar_nota)\b/.test(sql), "draft adds the new function and does not replace the sale or payment functions");
ok(sql.includes("Só admin") === false || sql.includes("Somente admin pode estornar"), "credit reversal stays admin-only");
ok(sql.includes("'estorno'") && sql.includes("O caixa grava só a data de hoje") && sql.includes("credito_entrada"), "reversal uses an estorno and the existing log kind");

if (failed) { console.error(failed + " failed"); process.exit(1); }
console.log("credito caixa ui ok");
