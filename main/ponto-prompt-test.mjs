/* Unit + string tests for the post-login "Bater ponto agora?" prompt (no camera, no production). */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const dir = dirname(fileURLToPath(import.meta.url));
const read = f => readFileSync(join(dir, f), "utf8");
const js = read("ponto.js");
const app = read("app.js");
const html = read("index.html");
let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.error("FAIL", m); } else console.log("ok", m); };

const store = {};
const sandbox = {
  window: {},
  document: {
    body: { classList: { contains: () => false, toggle() {} }, appendChild() {} },
    getElementById: () => null,
    querySelector: () => null,
    createElement: () => ({ style: {}, classList: { add() {}, toggle() {} }, querySelector() { return null; }, appendChild() {} })
  },
  location: { search: "", pathname: "/", hash: "", href: "http://local/main/" },
  navigator: { userAgent: "test", mediaDevices: {}, geolocation: null },
  sessionStorage: {
    getItem: k => Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  },
  URLSearchParams,
  console
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(js, sandbox);
const P = sandbox.window.BAGDA_PONTO;
ok(!!P && typeof P.maybePrompt === "function" && typeof P.maybePromptLogout === "function" && typeof P.proximoTipo === "function", "BAGDA_PONTO exports maybePrompt, maybePromptLogout and proximoTipo");
ok(P.shouldPromptLogout({ tipo: "saida_almoco", done: false }) === true, "logout prompt after entrada suggests saida_almoco");
ok(P.shouldPromptLogout({ tipo: "saida", done: false }) === true, "logout prompt after volta_almoco suggests saida");
ok(P.shouldPromptLogout({ tipo: "entrada", done: false }) === false, "logout does not ask entrada if they never punched in");
ok(P.shouldPromptLogout({ tipo: "saida", done: true }) === false, "logout does not ask after saida is already recorded");

const day = "2026-11-11"; // Wednesday, work day (3)
const r = (tipo, d = day) => ({ tipo, data_sp: d, excluido: false });

ok(P.proximoTipo([], day).tipo === "entrada" && P.proximoTipo([], day).done === false, "no punches today → entrada");
ok(P.proximoTipo([r("entrada")], day).tipo === "saida_almoco" && !P.proximoTipo([r("entrada")], day).done, "entrada already → saida_almoco");
ok(P.proximoTipo([r("entrada"), r("saida_almoco")], day).tipo === "volta_almoco", "after saida_almoco → volta_almoco");
ok(P.proximoTipo([r("entrada"), r("saida_almoco"), r("volta_almoco")], day).tipo === "saida", "after volta_almoco → saida");
ok(P.proximoTipo([r("entrada"), r("saida_almoco"), r("volta_almoco"), r("saida")], day).done === true, "after saida → done, no prompt");
ok(P.proximoTipo([r("entrada", "2026-11-10")], day).tipo === "entrada", "yesterday's punches do not count");
ok(P.proximoTipo([r("entrada"), { tipo: "saida", data_sp: day, excluido: true }], day).tipo === "saida_almoco", "excluded punches are ignored");
ok(P.proximoTipo([r("entrada"), r("saida")], day).done === true, "saida present (even without lunch) ends the day");

ok(P.isWorkDay(null, "2026-11-11") === true, "default jornada is Mon–Fri; 11/11/2026 is Wednesday");
ok(P.isWorkDay(null, "2026-11-14") === false, "default jornada skips Saturday 14/11/2026");
ok(P.isWorkDay({ dias_semana: [6, 7] }, "2026-11-11") === false, "custom jornada can exclude a weekday");
ok(P.isWorkDay({ dias_semana: [3] }, "2026-11-11") === true, "custom jornada can include only Wednesday");

ok(P.skipKey("u1", day, "saida_almoco") === "bagda-ponto-skip:u1:2026-11-11:saida_almoco", "skip key is user+day+type in this browser session");

ok(html.includes("ponto.js?v=20261111d") && html.includes("app.js?v=20261113h") && html.includes("ponto.css?v=20261111d"), "cache ponto 20261111d, app 20261113f");
ok(app.includes("BAGDA_PONTO.maybePrompt") && app.includes("BAGDA_PONTO.maybePromptLogout") && app.includes('qs.get("ponto_hoje")') && app.includes('qs.get("ponto_logout")'), "boot + Sair hook + demo seed wired");
ok(app.includes("$(\"#sair\").onclick") && app.includes("maybePromptLogout") && js.includes("Antes de sair do sistema") && js.includes('dataset.mode'), "Sair shows the leaving punch modal, then logs out either way");
ok(js.includes("registrarPonto") && js.includes("Rosto não confere") && js.includes("ppular"), "mismatch stays in the modal (retry or skip) and punch goes through registrar_ponto");
ok(!js.includes("signInWithPassword") && app.includes("signInWithPassword") && /type="password"/.test(app), "auth remains email+password");
const login = app.slice(app.indexOf("function viewLogin"), app.indexOf("async function viewMfaChallenge"));
ok(login.includes("Senha") && !login.includes("Bater ponto agora?") && !login.includes("face-api") && !login.includes("getUserMedia"), "viewLogin has no camera or face check");

if (failed) { console.error(failed + " failed"); process.exit(1); }
console.log("ponto prompt ok");
