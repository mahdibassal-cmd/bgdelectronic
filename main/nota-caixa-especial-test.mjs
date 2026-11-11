/* Local do pagamento CAIXA ESPECIAL só para quem já usa a Caixa Especial. Sem banco. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const app = readFileSync(join(dir, "app.js"), "utf8");
const sql = readFileSync(join(dir, "../supabase-loja/migration-nota-caixa-especial.sql"), "utf8");
const kiosk = readFileSync(join(dir, "../kiosk/app.js"), "utf8");
let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.error("FAIL", m); } else console.log("ok", m); };

const nota = app.slice(app.indexOf("async function viewNota"), app.indexOf("async function viewRecibo"));
ok(nota.includes('me.role === "admin" ? ["CAIXA ESPECIAL"]') && nota.includes("CAIXA GERAL"), "admin sale screen adds Caixa Especial beside the existing locals");
ok(nota.includes("Não entra em HX, Máquina nem Dinheiro"), "the hint says the money does not enter the day caixas");
ok(!app.slice(0, app.indexOf("const LOCAIS")).includes("CAIXA ESPECIAL") && app.includes('const LOCAIS = ["MAQUINA", "HX", "DINHEIRO", "CAIXA GERAL", "CAIXA S2", "PRESTIGE AURA"]'), "shared local list keeps the day caixas and adds CAIXA S2 and PRESTIGE AURA");
ok(app.includes('if (LP === "CAIXA ESPECIAL" && me.role !== "admin")') && app.includes('if (meU.role !== "admin") throw new Error("Somente admin")'), "seller is refused in the screen and in the mock");
ok(app.includes('CXE.push({ id: mid, tipo: "entrada"') && app.includes("estorno_de: ent.id"), "mock books an entrada and cancel writes the reversal");
ok(!kiosk.includes("CAIXA ESPECIAL"), "kiosk has no Caixa Especial local");
ok(sql.includes("'CAIXA ESPECIAL'") && sql.includes("_cxesp_inserir") && sql.includes("nota_id = v_id") && !/insert into public\.caixa_movimentos/.test(sql), "draft books the paid amount on the special ledger only");
ok(!/create or replace function public\.(cancelar_nota|cancelar_nota_financas|pagar_conta)\b/.test(sql), "draft does not replace the live cancel or bill-payment functions");

if (failed) { console.error(failed + " failed"); process.exit(1); }
console.log("nota caixa especial ui ok");
