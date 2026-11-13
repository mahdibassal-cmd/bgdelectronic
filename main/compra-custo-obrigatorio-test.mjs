/* Compra sem custo (vazio ou 0) é bloqueada na tela e no banco. Sem banco. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const dir = dirname(fileURLToPath(import.meta.url));
const app = readFileSync(join(dir, "app.js"), "utf8");
const html = readFileSync(join(dir, "index.html"), "utf8");
const sql = readFileSync(join(dir, "../supabase-loja/migration-compra-custo-obrigatorio.sql"), "utf8");
let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.error("FAIL", m); } else console.log("ok", m); };
ok(app.includes('if (!(num(l.custo) > 0) || String(l.custo).trim() === "") return w.textContent = `Linha ${n}: informe o custo unitário (maior que zero)'), "screen blocks empty and zero cost per line");
ok(!app.includes("num(l.custo) >= 0"), "zero cost no longer passes the screen check");
ok((app.match(/Compra sem custo não é aceita/g) || []).length >= 2, "demo purchase and Depósito entrada also refuse cost <= 0");
ok(html.includes("app.js?v=20261113d"), "cache tag 20261113d");
ok(sql.includes("new.custo_unit is null or new.custo_unit <= 0") && sql.includes("before insert or update of custo_unit on public.purchases") && sql.includes("create trigger purchase_a_custo_obrigatorio") && sql.includes("before insert on public.deposito_especial_mov"), "server blocks purchases and Depósito entradas without cost");
ok(sql.includes("new.tipo is distinct from 'entrada'"), "Depósito venda/transfer/ajuste movements are not affected");
ok(!/create or replace function public\.(criar_nota|criar_nota_local|registrar_compra_lote|dep_esp_entrada)\b/.test(sql), "no nota or purchase RPC is rewritten");
if (failed) { console.error(failed + " failed"); process.exit(1); } else console.log("compra custo ok");
