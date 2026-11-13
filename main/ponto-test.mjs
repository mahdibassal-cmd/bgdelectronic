/* UI/string tests for the facial time-clock (no camera, no production). */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const dir = dirname(fileURLToPath(import.meta.url));
const read = f => readFileSync(join(dir, f), "utf8");
const html = read("index.html");
const app = read("app.js");
const js = read("ponto.js");
const css = read("ponto.css");
const sql = readFileSync(join(dir, "../supabase-loja/migration-ponto.sql"), "utf8");
const kiosk = readFileSync(join(dir, "../kiosk/app.js"), "utf8");
let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.error("FAIL", m); } else console.log("ok", m); };

ok(html.includes('data-v="ponto"') && /<button type="button" data-v="ponto">Ponto<\/button>/.test(html), "nav has Ponto with no data-p");
ok(html.includes("ponto.js?v=20261111d") && html.includes("app.js?v=20261113c") && html.includes("ponto.css?v=20261111d"), "cache ponto 20261111d, app 20261113c");
ok(html.includes("loja.css?v=20261109e") && html.includes("venda-origem.js?v=20261109e"), "prior helper cache tags stay 20261109e");
ok(/wasm-unsafe-eval/.test(html) && /worker-src 'self' blob:/.test(html) && /media-src 'self' blob:/.test(html), "CSP allows in-browser face models and camera frames");
ok(html.indexOf("ponto.js") < html.indexOf("app.js?v=20261113c") && html.indexOf("prazo-vencimento.js?v=20261111e") < html.indexOf("app.js?v=20261113c"), "prazo helper and ponto.js load before app.js");
ok(/v !== "seguranca" && v !== "ponto"/.test(app) && /ponto: \(\) => window\.BAGDA_PONTO\.view\(/.test(app), "go() routes #ponto for every role");
ok(js.includes("BAGDA_PONTO") && js.includes("Bater ponto") && js.includes("Cadastro facial") && js.includes("Totem de ponto") && js.includes("Espelho de ponto"), "punch, enrollment, totem and espelho screens exist");
ok(js.includes("Lei 13.709/2018") && js.includes("biometria facial") && js.includes("Li e autorizo"), "LGPD consent text at enrollment");
ok(js.includes("vendor/face-api/face-api.js") && js.includes("faceRecognitionNet.loadFromUri"), "face-api is lazy-loaded from the vendored copy");
ok(/entrada[\s\S]*saida_almoco[\s\S]*volta_almoco[\s\S]*saida/.test(js) && js.includes("nextTipo"), "four punch types and auto-suggest");
ok(js.includes("Imprimir A4") && js.includes("espelho-a4") && /a\.download = "espelho-ponto-/.test(js), "printable A4 espelho and CSV export");
ok(css.includes(".espelho-a4") && /@page\{size:A4/.test(css) && css.includes(".ponto-totem"), "A4 and totem styles");
ok(app.includes("registrar_ponto") && app.includes("registrar_ponto_totem") && app.includes("ponto_cadastrar_face"), "live RPCs wired");
ok(app.includes("PONTOfaces") && app.includes("distDemo") && app.includes("@totem") && app.includes("registrarPontoTotem"), "mock enrollment, matching and totem role");
ok(sql.includes("create table if not exists public.ponto_faces") && sql.includes("ponto_registros") && sql.includes("ponto_falhas") && sql.includes("ponto_auditoria"), "migration has faces, punches, failures, audit");
ok(/registrado_em := now\(\)/.test(sql) && sql.includes("America/Sao_Paulo") && !/p_registrado_em/.test(sql), "server clock only, no client timestamp param");
ok(sql.includes("grant execute on function public.registrar_ponto") && sql.includes("grant execute on function public.registrar_ponto_totem") && sql.includes("to authenticated"), "RPCs granted to authenticated");
ok(sql.includes("security definer") && sql.includes("user_id = auth.uid() or public.is_admin()"), "SECURITY DEFINER RPCs and RLS own+admin");
ok(/Só o administrador altera um ponto/.test(sql) && sql.includes("ponto_auditoria") && /Informe o motivo/.test(sql), "admin edit/delete requires motivo and audit");
ok(sql.includes("insert into storage.buckets") && sql.includes("public = false") && sql.includes("'ponto'"), "private storage bucket");
ok(!kiosk.includes("registrar_ponto") && !kiosk.includes("BAGDA_PONTO"), "kiosk app is unchanged");
ok(app.includes("lancar_credito_caixa") && app.includes("Transferir entre caixas") && app.includes("CAIXA SPECIAL"), "prior caixa features stay in app.js");

ok(js.includes("Bater ponto agora?") && js.includes("maybePrompt") && js.includes("ppular") && js.includes("Alterar tipo"), "login prompt modal with skip and type change");
ok(app.includes("BAGDA_PONTO.maybePrompt") && app.includes("ponto_hoje"), "boot offers the punch prompt after session; mock can seed today's punches");
ok(/function viewLogin\([\s\S]*type="password"[\s\S]*Entrar/.test(app) && !/function viewLogin\([\s\S]*face-api|[\s\S]*Bater ponto agora/.test(app.slice(app.indexOf("function viewLogin"), app.indexOf("async function viewMfaChallenge"))), "login itself stays email+password, no face login");
ok(js.includes("bagda-ponto-skip:") && js.includes("sessionStorage") && js.includes("ponto-hint") && js.includes("Cadastro facial"), "Pular is per type/day in this browser session; no-face users get a cadastro hint");
ok(js.includes("maybePromptLogout") && js.includes("Antes de sair do sistema") && js.includes("shouldPromptLogout"), "logout also offers the punch modal before Sair");

ok(js.includes("isTotemAccount") && js.includes("pontoTotens") && js.includes("@totem"), "totem accounts are skipped");
ok(css.includes(".ponto-prompt-overlay") && css.includes(".ponto-tipo-sug"), "prompt styles");

if (failed) { console.error(failed + " failed"); process.exit(1); }
console.log("ponto ui ok");
