/* Nova nota Local do pagamento includes CAIXA S2 and PRESTIGE ROSA (ex PRESTIGE AURA). Sem banco. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const app = readFileSync(join(dir, "app.js"), "utf8");
const html = readFileSync(join(dir, "index.html"), "utf8");
const sql = readFileSync(join(dir, "../supabase-loja/migration-locais-caixa-s2-prestige.sql"), "utf8");
let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.error("FAIL", m); } else console.log("ok", m); };

ok(app.includes('const LOCAIS = ["MAQUINA", "HX", "DINHEIRO", "CAIXA GERAL", "CAIXA S2", "PRESTIGE ROSA"]'), "LOCAIS lists CAIXA S2 and PRESTIGE AURA after the existing locals");
ok(app.includes('LOCAIS.concat(me.role === "admin" ? LOCAIS_ADMIN : [])'), "sale screen still appends Caixa Especial only for admin");
ok(html.includes("app.js?v=20261113d"), "cache tag bumped so the loja reloads app.js");
ok(sql.includes("'CAIXA S2'") && sql.includes("'PRESTIGE AURA'") && sql.includes("notas_local_pag_chk"), "migration extends the local_pagamento check");
ok(sql.includes("'MAQUINA','HX','DINHEIRO','CAIXA GERAL','CAIXA ESPECIAL','CAIXA S2','PRESTIGE AURA'"), "criar_nota_local allowlist includes the two new locais");
ok(!/insert into public\.caixa_movimentos/.test(sql), "creating the nota still does not auto-post to caixa_movimentos");

if (failed) { console.error(failed + " failed"); process.exit(1); }
console.log("locais caixa s2 prestige ok");
