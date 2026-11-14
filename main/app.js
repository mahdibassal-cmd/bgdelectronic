/* largura do recibo: ?w=58 ou ?w=80 (salvo em localStorage) */
(function () {
  const q = new URLSearchParams(location.search).get("w");
  if (q === "58" || q === "80") localStorage.setItem("recibo_w", q);
  const w = localStorage.getItem("recibo_w") === "58" ? 58 : 80;
  document.documentElement.classList.toggle("w58", w === 58);
  const st = document.createElement("style"); document.head.appendChild(st);
  /* Chrome não aceita "auto" na altura: mede o recibo e define WIDTHmm x ALTURAmm */
  const fit = () => {
    /* aplica as regras de @media print temporariamente (largura do papel) para medir a altura real */
    let css = ""; for (const sh of document.styleSheets) { try { for (const r of sh.cssRules) if (r.media && /print/.test(r.media.mediaText)) css += [...r.cssRules].map(x => x.cssText).join("\n"); } catch (e) {} }
    const tmp = document.createElement("style"); tmp.textContent = css + `html,body{width:${w}mm!important}`; document.head.appendChild(tmp);
    const r = document.querySelector(".recibo"); if (!r) { tmp.remove(); st.textContent = "@page{size:A4;margin:10mm}"; return; } const hmm = r ? Math.ceil(r.getBoundingClientRect().height * 25.4 / 96) + 8 : 200;
    tmp.remove(); st.textContent = `@page{size:${w}mm ${Math.max(hmm, 40)}mm;margin:0}`;
  };
  fit();
  let t0 = document.title;
  addEventListener("beforeprint", () => { t0 = document.title; document.title = " "; fit(); });
  addEventListener("afterprint", () => { document.title = t0; });
})();
(() => {
"use strict";
const C = window.LOJA_CONFIG || {};
const qs = new URLSearchParams(location.search);
const ATEND = ["1", "2", "3", "4", "BAGDA OFFICIAL"];
const CONFIGURED = /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(C.SUPABASE_URL || "") && /^(sb_publishable_|eyJ)/.test(C.SUPABASE_ANON_KEY || "");
const MOCK = qs.has("mock");
if (MOCK) window.__demo = { get api() { return api; }, viewComprovante: (...a) => viewComprovante(...a), viewImei: (...a) => viewImei(...a), get me() { return me; } };
const PAY = [["dinheiro", "Dinheiro"], ["pix", "PIX"], ["cartao", "Cartão"], ["prazo", "Paga Depois"]];
const PAYL = { ...Object.fromEntries(PAY), credito: "Caixa Geral (crédito)" };
const LOCAIS = ["MAQUINA", "HX", "DINHEIRO", "CAIXA GERAL", "CAIXA S2", "PRESTIGE ROSA"];
// Only admins see/use these in Nova nota (criar_nota_local also rejects them for non-admins).
const LOCAIS_ADMIN = ["BITLOG CONTAINER", "CAIXA ESPECIAL"];
// PRESTIGE AURA was renamed PRESTIGE ROSA (caixa 15); old notas keep the old stored value.
const localLbl = l => l === "PRESTIGE AURA" ? "PRESTIGE ROSA" : l;
const ROLEL = { admin: "Admin", vendedor: "Vendedor(a)", financeiro: "Financeiro", estoque: "Estoque" };
/* permissões por papel (espelha public.role_perms no banco; o banco é quem garante) */
const PERMS = { admin: ["admin", "vendas", "caixa", "financas", "estoque"], vendedor: ["vendas"], financeiro: ["caixa", "financas"], estoque: ["estoque"] };
const can = p => !!me && String(p).split("|").some(x => (PERMS[me.role] || []).includes(x));
const $ = s => document.querySelector(s);
const app = $("#app");
const banner = (ok, html) => { document.querySelectorAll(".nb").forEach(x => x.remove()); const d = document.createElement("div"); d.className = "nb noprint"; d.setAttribute("role", ok ? "status" : "alert"); d.style.cssText = `background:${ok ? "#15803d" : "#b91c1c"};color:#fff;padding:18px 20px;border-radius:12px;margin:0 0 14px;font-size:1.35em;line-height:1.35;box-shadow:0 4px 14px rgba(0,0,0,.25)`; d.innerHTML = html; app.prepend(d); d.scrollIntoView({ block: "start" }); return d; };
const nidOk = n => Number.isInteger(+n) && +n > 0 && n !== null && n !== "";
let notaSaving = false;
const confirmNota = (items, total, pag, frete = 0, caxinha = 0, prazoTxt = "") => new Promise(res => { const o = document.createElement("div"); o.className = "nmodal noprint"; o.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px";
  o.innerHTML = `<div role="dialog" aria-modal="true" style="background:#fff;color:#111;border-radius:14px;max-width:560px;width:100%;max-height:90vh;overflow:auto;padding:22px;box-shadow:0 10px 40px rgba(0,0,0,.35)"><h2 style="margin:0 0 12px">Confirmar nota</h2>
  <table style="width:100%;border-collapse:collapse;font-size:1.05em"><tr><th style="text-align:left">Item</th><th style="text-align:right">Qtd</th><th style="text-align:right">Total</th></tr>${items.map(x => `<tr><td style="padding:6px 0;border-top:1px solid #eee">${esc(x.nome)}${x.origem && globalThis.BAGDA_VENDA_ORIGEM ? " · " + esc(globalThis.BAGDA_VENDA_ORIGEM.origemLabel(x.origem)) : ""}</td><td style="text-align:right;border-top:1px solid #eee">${x.qtd}</td><td style="text-align:right;border-top:1px solid #eee">${brl(x.qtd * x.preco_vendido)}</td></tr>`).join("")}${frete > 0 ? `<tr><td style="padding:6px 0;border-top:1px solid #eee"><b>Frete</b> (motoboy)</td><td style="text-align:right;border-top:1px solid #eee">—</td><td style="text-align:right;border-top:1px solid #eee">${brl(frete)}</td></tr>` : ""}${caxinha > 0 ? `<tr><td style="padding:6px 0;border-top:1px solid #eee"><b>Caxinha d Natal</b></td><td style="text-align:right;border-top:1px solid #eee">—</td><td style="text-align:right;border-top:1px solid #eee">${brl(caxinha)}</td></tr>` : ""}</table>
  <p style="font-size:1.4em;margin:14px 0 6px"><b>TOTAL: ${brl(total)}</b></p><p style="font-size:1.1em;margin:0 0 18px">Pagamento: <b>${pag}</b>${prazoTxt ? `<br>Paga em: <b>${prazoTxt}</b>` : ""}</p>
  <div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap"><button type="button" class="btn ghost" id="nmv">Voltar</button><button type="button" class="btn gold" id="nmc">Confirmar e salvar</button></div></div>`;
  const done = v => { o.remove(); document.removeEventListener("keydown", k); res(v); }, k = e => { if (e.key === "Escape") done(false); };
  document.body.append(o); o.querySelector("#nmv").onclick = () => done(false); o.querySelector("#nmc").onclick = () => done(true); document.addEventListener("keydown", k); o.querySelector("#nmc").focus(); });
const confirmBox = html => new Promise(res => { const o = document.createElement("div"); o.className = "nmodal"; o.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:99";
  o.innerHTML = `<div class="card" style="max-width:440px;margin:0"><h2>Confirmar</h2><p>${html}</p><button class="btn ghost" id="cbn">Voltar</button> <button class="btn gold" id="cby">Confirmar</button></div>`;
  const done = v => { o.remove(); res(v); }; document.body.append(o); o.querySelector("#cbn").onclick = () => done(false); o.querySelector("#cby").onclick = () => done(true); o.querySelector("#cby").focus(); });
const textBox = (title, html, okLbl, req, danger) => new Promise(res => { const o = document.createElement("div"); o.className = "nmodal"; o.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:99";
  o.innerHTML = `<div class="card" style="max-width:480px;margin:0${danger ? ";border:2px solid #b91c1c" : ""}"><h2${danger ? ' style="color:#b91c1c"' : ""}>${title}</h2><p>${html}</p><label>Motivo${req ? " *" : " (opcional)"}</label><input id="tbm" maxlength="200"><p class="warn" id="tbw" style="min-height:1em"></p><button class="btn ghost" id="cbn">Voltar</button> <button class="btn ${danger ? "danger" : "gold"}" id="cby">${okLbl}</button></div>`;
  const done = v => { o.remove(); res(v); }; document.body.append(o); const i = o.querySelector("#tbm"); i.focus(); o.querySelector("#cbn").onclick = () => done(null);
  o.querySelector("#cby").onclick = () => { const v = i.value.trim(); if (req && v.length < 3) { o.querySelector("#tbw").textContent = "Informe o motivo (mín. 3 letras)"; return i.focus(); } done(v); }; });
const motivoBox = html => new Promise(res => { const o = document.createElement("div"); o.className = "nmodal"; o.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:99";
  o.innerHTML = `<div class="card" style="max-width:460px;margin:0"><h2>Confirmar estorno</h2><p>${html}</p><label>Motivo *</label><input id="mbm" maxlength="200" placeholder="Ex.: lançado por engano"><p class="warn" id="mbw" style="min-height:1em"></p><button class="btn ghost" id="cbn">Voltar</button> <button class="btn gold" id="cby">Estornar</button></div>`;
  const done = v => { o.remove(); res(v); }; document.body.append(o); const i = o.querySelector("#mbm"); i.focus(); o.querySelector("#cbn").onclick = () => done(null);
  o.querySelector("#cby").onclick = () => { const m = i.value.trim(); if (m.length < 3) { o.querySelector("#mbw").textContent = "Informe o motivo (mín. 3 letras)"; i.focus(); return; } done(m); }; });
const estErr = e => /could not find the function|schema cache|does not exist|PGRST202/i.test(e.message) ? "Estorno ainda não instalado no banco (falta rodar migration-estornos.sql)" : e.message;
const escolherClienteBox = (html, okLbl) => new Promise(res => { const o = document.createElement("div"); o.className = "nmodal"; o.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:10000;padding:16px";
  o.innerHTML = `<div class="card" role="dialog" aria-modal="true" style="max-width:480px;margin:0"><h2>Cliente já cadastrado</h2><p>${html}</p><button type="button" class="btn ghost" id="cbn">Voltar</button> <button type="button" class="btn gold" id="cby">${esc(okLbl || "Usar este cliente")}</button></div>`;
  const done = v => { o.remove(); document.removeEventListener("keydown", k); res(v); }, k = e => { if (e.key === "Escape") done(false); };
  document.body.append(o); o.querySelector("#cbn").onclick = () => done(false); o.querySelector("#cby").onclick = () => done(true); document.addEventListener("keydown", k); o.querySelector("#cby").focus(); });
const printVia = via => { let v = document.querySelector(".recibo .via"); if (!v) { v = document.createElement("pre"); v.className = "via rpre"; const r = document.querySelector(".recibo .rh"); r ? r.after(v) : document.querySelector(".recibo")?.prepend(v); } v.textContent = rcC("*** " + via + " ***"); window.print(); };
const printBtns = () => { const pr = $("#pr"); if (!pr) return; pr.textContent = "🖨️ Imprimir de novo"; pr.onclick = () => printVia("VIA DA LOJA");
  const c = document.createElement("button"); c.className = "btn gold"; c.id = "prc"; c.textContent = "🧾 Imprimir via do cliente"; c.style.marginLeft = "6px"; c.onclick = () => printVia("VIA DO CLIENTE"); pr.after(c); setTimeout(() => printVia("VIA DA LOJA"), 350); };
const rnum = v => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); /* sem "R$" nem U+00A0 (o driver térmico imprime o NBSP como lixo) */
/* cupom térmico em texto puro (ASCII, colunas com espaços): o driver da Bematech ignora CSS e não usa UTF-8 */
const asc = s => String(s ?? "").replace(/º/g, "o").replace(/ª/g, "a").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\u00a0\u202f]/g, " ").replace(/[^\x20-\x7e]/g, "");
const rcW = () => document.documentElement.classList.contains("w58") ? 32 : 40;
const rcL = (a, b, W = rcW()) => { a = asc(a); b = asc(b); const n = W - a.length - b.length; return n >= 1 ? a + " ".repeat(n) + b : a + "\n" + " ".repeat(Math.max(0, W - b.length)) + b; };
const rcC = (s, W = rcW()) => { s = asc(s).slice(0, W); return s.length >= W ? s : " ".repeat(Math.floor((W - s.length) / 2)) + s; };
const rcWrap = (s, W = rcW()) => { const o = []; let l = ""; for (const w of asc(s).split(/\s+/).filter(Boolean)) { if (!l) l = w; else if ((l + " " + w).length <= W) l += " " + w; else { o.push(l); l = w; } while (l.length > W) { o.push(l.slice(0, W)); l = l.slice(W); } } if (l) o.push(l); return o.join("\n"); };
const rc3 = (a, b, c, W = rcW()) => { const cw = W >= 40 ? 13 : 11; a = asc(a); return a + " ".repeat(Math.max(1, W - 2 * cw - a.length)) + asc(b).padStart(cw) + asc(c).padStart(cw); };
const rcEsc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const rcDot = (a, b, W = rcW()) => { a = asc(a); b = asc(b); const n = W - a.length - b.length - 2; return n >= 2 ? a + " " + ".".repeat(n) + " " + b : rcL(a, b, W); };
const reciboTxt = (store, nid, h, R, tot, pays, cancel) => { const fr = Math.round(Number(h.frete || 0) * 100) / 100, cx = Math.round(Number(h.caxinha_natal || 0) * 100) / 100, legado = String(h.obs_pagamento || "").startsWith("DÍVIDA ANTERIOR"); const W = rcW(), dt = new Date(h.created_at), TZ = "America/Sao_Paulo", E = "=".repeat(W), D = "-".repeat(W), qt = R.reduce((a, r) => a + Number(r.qtd), 0);
  const head = [rcC(store), rcC("bgdstores.com"), E].join("\n") + "\n";
  const L = [legado ? "DIVIDA ANTERIOR" : "PEDIDO DE VENDA", rcL("Data: " + dt.toLocaleDateString("pt-BR", { timeZone: TZ }), dt.toLocaleTimeString("pt-BR", { timeZone: TZ })),
    ...(h.cliente ? [rcWrap("Cliente: " + h.cliente)] : []), rcWrap("Vendedor: " + h.nome + " (" + h.handle + ")"), "Nota No.: " + String(nid).padStart(6, "0"), E,
    "Codigo Descricao", rc3("Qtd", "Preco", "Total"), D,
    ...R.flatMap(r => [rcWrap([r.sku, r.marca, r.produto, r.tamanho].filter(Boolean).join(" ").toUpperCase()), rc3(r.qtd + " Un", rnum(r.preco_vendido), rnum(r.total))]), D,
    rcL("Total: " + qt, "Itens: " + R.length), D, rcL("Subtotal:", rnum(legado ? 0 : tot)), ...(legado ? [rcDot("DIVIDA ANTERIOR", rnum(fr || tot))] : [...(fr > 0 ? [rcDot("FRETE", rnum(fr))] : []), ...(cx > 0 ? [rcDot("CAXINHA D NATAL", rnum(cx))] : [])]), rcL("Desc.:", "0,00"), rcL("TOTAL:", "R$ " + rnum(legado ? (fr || tot) : tot + fr + cx)), D,
    ...pays.map(p => rcWrap("Pago: " + p)), ...(h.prazo_dias ? [rcWrap("Paga em: " + h.prazo_dias + (Number(h.prazo_dias) === 1 ? " dia" : " dias") + (h.vencimento ? " (vence " + String(h.vencimento).slice(0, 10).split("-").reverse().join("/") + ")" : ""))] : []), ...(h.local_pagamento ? [rcWrap("Local pagto: " + localLbl(h.local_pagamento))] : []), ...(h.obs_pagamento ? [rcWrap("Obs: " + h.obs_pagamento)] : []), ...(cancel ? [rcC("*** NOTA CANCELADA ***")] : []), E, rcC(">>> CONFIRA SUAS MERCADORIAS <<<"), rcC("Obrigado pela preferencia!"), "", "", "", "", "."];
  return `<div class="recibo"><pre class="rpre rh">${rcEsc(head)}</pre><pre class="rpre">${rcEsc(L.map(l => l.split("\n").map(x => x.slice(0, W)).join("\n")).join("\n"))}</pre></div>`; };
const brl = v => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const caixaSaldoHtml = n => { const v = Number(n) || 0; return v < -0.001 ? `<span class="low">${brl(v)} · dívida</span>` : brl(v); };
const usdBadge = p => p && p.origem === "Importado" ? ' <span class="badge usd-b" title="Importado">US$</span>' : "";
const quandoSP = iso => iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "";
const norm = s => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const match = (p, q) => { const h = norm(`${p.sku} ${p.marca} ${p.produto} ${p.tamanho || ""}`); return norm(q).split(/\s+/).filter(Boolean).every(t => h.includes(t)); };
const coll = new Intl.Collator("pt-BR", { sensitivity: "base" });
const stockSort = L => [...L].sort((a, b) => ((+b.estoque > 0) - (+a.estoque > 0)) || coll.compare(a.produto || "", b.produto || "") || coll.compare(a.marca || "", b.marca || ""));
const dig = s => String(s ?? "").replace(/\D/g, "");
const docOk = v => { const d = dig(v); if (!d) return true; if (/^(\d)\1+$/.test(d)) return false;
  if (d.length === 11) { const f = n => { let s = 0; for (let i = 0; i < n; i++) s += +d[i] * (n + 1 - i); const r = s * 10 % 11; return r === 10 ? 0 : r; }; return f(9) === +d[9] && f(10) === +d[10]; }
  if (d.length === 14) { const f = n => { let s = 0, w = n - 7; for (let i = 0; i < n; i++) { s += +d[i] * w--; if (w < 2) w = 9; } const r = s % 11; return r < 2 ? 0 : 11 - r; }; return f(12) === +d[12] && f(13) === +d[13]; }
  return false; };
const fmtDoc = v => { const d = dig(v); return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : d.length === 14 ? d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5") : (v || ""); };
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const spAdd = (iso, n) => { const [y, m, d] = String(iso).split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
/* Caxinha d Natal: campo só até 24/12/2026 inclusive (calendário America/Sao_Paulo). Histórico permanece. */
const CAXINHA_ATE = "2026-12-24";
const caxinhaOn = () => today() <= CAXINHA_ATE;
const toEmail = v => { v = v.trim(); if (v.includes("@")) return v.toLowerCase();
  const n = v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return n ? n + "@loja.bgdstores.local" : ""; };
const toast = m => { const t = $("#toast"); t.textContent = m; t.style.display = "block"; clearTimeout(t._h); t._h = setTimeout(() => t.style.display = "none", /Já existe um cliente/.test(String(m || "")) ? 8000 : 3500); };
let me = null, isOwner = false, lockedNow = false;
// ---------- Links de convite / recuperação do Supabase ----------
const H = new URLSearchParams(location.hash.slice(1));
const AUTH = { type: H.get("type") || qs.get("type"), access_token: H.get("access_token"), refresh_token: H.get("refresh_token"),
  code: qs.get("code"), token_hash: qs.get("token_hash"), error: H.get("error") || qs.get("error"),
  error_code: H.get("error_code") || qs.get("error_code"), error_description: H.get("error_description") || qs.get("error_description") };
let needPassword = ["invite", "recovery"].includes(AUTH.type);
const cleanUrl = () => history.replaceState(null, "", location.pathname + (MOCK ? "?mock=" + (qs.get("mock") || "admin") + (qs.has("auto") || needPassword ? "&auto=1" : "") : ""));
const authErrorMsg = () => {
  const c = (AUTH.error_code || AUTH.error || "").toLowerCase();
  if (c.includes("expired") || /expired|invalid/i.test(AUTH.error_description || "")) return "Este link expirou ou já foi usado. Peça ao administrador um novo convite.";
  if (c.includes("access_denied")) return "Acesso negado pelo link. Peça ao administrador um novo convite.";
  return "Não foi possível abrir o link. Peça ao administrador um novo convite.";
};
const strongPw = p => p.length >= 12 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p); // {handle, nome, role}

// ---------------- Camada de dados ----------------
let api;
if (!MOCK && !CONFIGURED) {
  api = null;
} else if (!MOCK) {
  const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, { auth: { persistSession: true, storage: sessionStorage, storageKey: (window.BGDSwitch ? BGDSwitch.storageKey(C.SUPABASE_URL) : undefined), detectSessionInUrl: false, flowType: "pkce" } });
  sb.auth.onAuthStateChange(ev => { if (ev === "PASSWORD_RECOVERY") needPassword = true; });
  const ok = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
  const allRows = async q => { const out = []; for (let i = 0; ; i += 1000) { const d = ok(await q().range(i, i + 999)); out.push(...d); if (d.length < 1000) return out; } }; // PostgREST corta em 1000 linhas
  api = { ...BGDUsers.realApi(sb),
    async login(email, pw) { if (!email) throw new Error("x"); ok(await sb.auth.signInWithPassword({ email, password: pw })); },
    async logout() { await sb.auth.signOut(); },
    async consumeUrl() {
      if (AUTH.access_token && AUTH.refresh_token) ok(await sb.auth.setSession({ access_token: AUTH.access_token, refresh_token: AUTH.refresh_token }));
      else if (AUTH.code) ok(await sb.auth.exchangeCodeForSession(AUTH.code));
      else if (AUTH.token_hash && AUTH.type) ok(await sb.auth.verifyOtp({ token_hash: AUTH.token_hash, type: AUTH.type }));
    },
    async setPassword(p) { ok(await sb.auth.updateUser({ password: p })); },
    async session() { return (await sb.auth.getSession()).data.session; },
    async aal() { return ok(await sb.auth.mfa.getAuthenticatorAssuranceLevel()); },
    async factors() { return ok(await sb.auth.mfa.listFactors()).totp || []; },
    async enroll() { return ok(await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: "BAGDA " + Date.now() })); },
    async verify(factorId, code) { ok(await sb.auth.mfa.challengeAndVerify({ factorId, code })); },
    async unenroll(factorId) { ok(await sb.auth.mfa.unenroll({ factorId })); },
    async status() { const { data, error } = await sb.rpc("system_status"); if (error) return null; return data; },
    async lock(r) { ok(await sb.rpc("lock_system", { p_reason: r })); },
    async unlock() { ok(await sb.rpc("unlock_system")); },
    async signoutAll() { return ok(await sb.rpc("signout_all")); },
    async reportFail(e) { try { await sb.rpc("report_failed_login", { p_email: e }); } catch {} },
    async events() { const { data, error } = await sb.from("security_events").select("at,kind,email,detail").order("at", { ascending: false }).limit(50); return error ? null : data; },
    async dumpTable(t) { const out = []; for (let i = 0; ; i += 1000) { const { data, error } = await sb.from(t).select("*").range(i, i + 999); if (error) return { error: error.message }; out.push(...data); if (data.length < 1000) return out; } },
    async email() { return (await sb.auth.getUser()).data.user?.email || ""; },
    async profile() { const u = (await sb.auth.getUser()).data.user; return ok(await sb.from("profiles").select("id,handle,nome,role,ativo").eq("id", u.id).single()); },
    async products() {
      const admin = me && me.role === "admin";
      const base = "sku,marca,produto,tamanho,preco_venda,estoque,estoque_minimo,ativo";
      const cols = admin ? base + ",origem,preco_usd" : base + ",origem";
      const load = list => allRows(() => sb.from("products").select(list).order("sku"));
      try { return await load(cols); }
      catch (e) {
        if (!/origem|preco_usd|42703/i.test(e.message || "")) throw e;
        return load(base);
      }
    },
    async productsFull() { return allRows(() => sb.from("products").select("*").order("sku")); },
    async estoqueVendedor() { return ok(await sb.from("estoque_vendedor").select("sku,marca,produto,tamanho,estoque")); },
    async costs() { return ok(await sb.from("product_costs").select("sku,custo")); },
    async custoSalvar(sku, custo) {
      const n = Number(custo);
      if (!/^[A-Z0-9-]{3,20}$/.test(String(sku || "")) || !Number.isFinite(n) || n < 0) throw new Error("Custo inválido");
      ok(await sb.from("product_costs").upsert({ sku, custo: n }, { onConflict: "sku" }).select("sku,custo"));
      const again = ok(await sb.from("product_costs").select("sku,custo").eq("sku", sku));
      const row = (again || []).find(r => r.sku === sku);
      if (!row || !globalThis.BAGDA_CUSTO.sameCents(row.custo, n)) throw new Error("O custo não foi confirmado. O valor na tela não foi trocado.");
      return { sku: row.sku, custo: Number(row.custo) };
    },
    async repSeller(d) { return ok(await sb.from("v_report_seller").select("*").eq("data", d)); },
    async repPay(d) { return ok(await sb.from("v_report_payment").select("*").eq("data", d)); },
    async repProfit(d) { return ok(await sb.from("v_report_profit").select("*").eq("data", d)); },
    async criarNota(items, pagamentos, cliente, clienteId, local, obs, frete, caxinha, prazoDias) { const a = { p_items: items, p_pagamentos: pagamentos, p_cliente: cliente || null, p_cliente_id: clienteId || null, p_local: local || null, p_obs: obs || null }, f = Math.round((+frete || 0) * 100) / 100, c = Math.round((+caxinha || 0) * 100) / 100;
      const dias = prazoDias == null || prazoDias === "" ? null : +prazoDias;
      if (dias != null) a.p_prazo_dias = dias;
      const rpcLocal = async args => { const r = await sb.rpc("criar_nota_local", args); const em = (r.error && ((r.error.code || "") + " " + (r.error.message || ""))) || "";
        if (r.error && a.p_local && !["MAQUINA", "HX", "DINHEIRO", "CAIXA GERAL", "CAIXA ESPECIAL", "CAIXA S2", "PRESTIGE ROSA", "PRESTIGE AURA", "BITLOG CONTAINER"].includes(a.p_local) && /Escolha o Local do pagamento|notas_local_pag|23514/.test(em)) throw new Error("Este local de PIX ainda depende da atualização do banco (supabase-loja/migration-pix-locais-caixas.sql). Nada foi salvo.");
        if (r.error && a.p_local === "CAIXA ESPECIAL" && /Escolha o Local do pagamento|notas_local_pag|23514/.test(em)) throw new Error("Caixa Especial na nota ainda depende da atualização do banco (supabase-loja/migration-nota-caixa-especial.sql). Nada foi salvo.");
        if (r.error && dias != null && /PGRST202|42883|p_prazo_dias|schema cache|does not exist/i.test(em)) throw new Error("Prazo de Paga Depois ainda depende da atualização do banco (supabase-loja/migration-prazo-vencimento.sql). Nada foi salvo.");
        return r; };
      if (!(f > 0) && !(c > 0) && dias == null) return ok(await rpcLocal(a)); /* chamada antiga, sem extras */
      const extra = { ...a, ...(f > 0 ? { p_frete: f } : {}), ...(c > 0 ? { p_caxinha_natal: c } : {}) };
      const r = await rpcLocal(extra); const em = (r.error && ((r.error.code || "") + " " + (r.error.message || ""))) || "";
      if (r.error && c > 0 && /PGRST202|42883|p_caxinha/.test(em)) throw new Error("Caxinha d Natal depende de atualização do banco — avise o admin.");
      if (r.error && f > 0 && /PGRST202|42883|p_frete/.test(em)) throw new Error("Frete depende de atualização do banco — avise o admin.");
      if (r.error && dias != null && /PGRST202|42883|p_prazo_dias|schema cache|does not exist/i.test(em)) throw new Error("Prazo de Paga Depois ainda depende da atualização do banco (supabase-loja/migration-prazo-vencimento.sql). Nada foi salvo.");
      return ok(r); },
    async freteDia(d) { const r = await sb.rpc("frete_dia", { p_data: d }); return r.error ? null : r.data; },
    async caxinhaDia(d) { const r = await sb.rpc("caxinha_dia", { p_data: d }); return r.error ? null : r.data; },
    async notaHead(id) { return ok(await sb.from("v_notas").select("*").eq("nota_id", id)); },
    async notasLancar() { const r = await sb.rpc("notas_lancar_financas", { p_limit: 300 }); /* RPC definer: financeiro não tem 'vendas' e a view (security_invoker) voltava vazia */
      if (!r.error) return r.data || []; if (!/PGRST202|42883|notas_lancar_financas/.test((r.error.code || "") + " " + (r.error.message || ""))) throw new Error(r.error.message);
      return ok(await sb.from("v_notas_lancar").select("*").order("created_at", { ascending: false }).limit(300)); },
    async lancarNota(nid, cx) { return ok(await sb.rpc("lancar_nota_caixa", { p_nota: nid, p_caixa: cx })); },
    async lancarNotaCxesp(nid) { const r = await sb.rpc("lancar_nota_cxesp", { p_nota: nid }); if (r.error && /PGRST202|42883|lancar_nota_cxesp|schema cache/i.test((r.error.code || "") + " " + (r.error.message || ""))) throw new Error("Lançar na CAIXA SPECIAL ainda depende da atualização do banco (supabase-loja/migration-receber-caixa-especial.sql). Nada foi lançado."); return ok(r); },
    async cancelarNotaFin(nid, m) { const r = await sb.rpc("cancelar_nota_financas", { p_nota: nid, p_motivo: m }); if (r.error && /PGRST202|42883/.test((r.error.code || "") + " " + (r.error.message || ""))) { if (me.role !== "admin") throw new Error("Cancelar nota pelo financeiro ainda depende de uma atualização do banco — avise o admin."); ok(await sb.rpc("cancelar_nota", { p_id: nid, p_motivo: m })); return { cancelada: true }; } return ok(r); },
    async corrigirPag(nid, pags, cli, m) { const r = await sb.rpc("corrigir_pagamento_nota", { p_nota: nid, p_pagamentos: pags, p_cliente_id: cli || null, p_motivo: m }); if (r.error && /PGRST202|42883/.test((r.error.code || "") + " " + (r.error.message || ""))) throw new Error("Corrigir pagamento ainda depende de uma atualização do banco — avise o admin."); return ok(r); },
    async dispensarNota(nid, m) { const r = await sb.rpc("dispensar_nota", { p_nota: nid, p_motivo: m || null }); if (r.error && /PGRST202|42883|dispensar_nota/.test((r.error.code || "") + " " + (r.error.message || ""))) throw new Error("'Não lançar' ainda depende de uma atualização do banco — avise o admin."); return ok(r); },
    async desfazerDispensa(nid) { return ok(await sb.rpc("desfazer_dispensa_nota", { p_nota: nid })); },
    async lancarNotaCG(nid) { const r = await sb.rpc("lancar_nota_caixa_geral", { p_nota: nid }); if (r.error && /PGRST202|42883|lancar_nota_caixa_geral/.test((r.error.code || "") + " " + (r.error.message || ""))) throw new Error("Caixa Geral (débito do cliente) ainda depende de uma atualização do banco — avise o admin."); return ok(r); },
    async notasInfo(ids) { if (!ids.length) return []; let r = await sb.from("notas").select("id,local_pagamento,obs_pagamento,frete,caxinha_natal,prazo_dias,vencimento").in("id", ids); if (r.error) r = await sb.from("notas").select("id,local_pagamento,obs_pagamento,frete,caxinha_natal").in("id", ids); if (r.error) r = await sb.from("notas").select("id,local_pagamento,obs_pagamento,frete").in("id", ids); if (r.error) r = await sb.from("notas").select("id,local_pagamento,obs_pagamento").in("id", ids); return r.error ? [] : r.data; },
    async fretesDia(d) { const r = await sb.from("notas").select("id,frete").eq("data", d).gt("frete", 0).limit(5000); return r.error ? [] : r.data; },
    async caxinhasDia(d) { const r = await sb.from("notas").select("id,caxinha_natal").eq("data", d).gt("caxinha_natal", 0).limit(5000); return r.error ? [] : r.data; },
    async creditos() { return ok(await sb.from("v_cliente_credito").select("*").order("nome")); },
    async creditoMov(cid) { let q = sb.from("v_cliente_creditos_mov").select("*").order("id", { ascending: false }).limit(200); if (cid) q = q.eq("cliente_id", cid); return ok(await q); },
    async lancarCredito(cid, tipo, v, obs) { return ok(await sb.rpc("lancar_credito", { p_cliente: cid, p_tipo: tipo, p_valor: v, p_obs: obs || null })); },
    async lancarCreditoCaixa(cid, v, cx, forma, obs, data) { const r = await sb.rpc("lancar_credito_caixa", { p_cliente: cid, p_valor: v, p_caixa: cx, p_forma: forma || null, p_obs: obs || null, p_data: data || null }); const em = (r.error && ((r.error.code || "") + " " + (r.error.message || ""))) || ""; if (r.error && /PGRST202|42883|lancar_credito_caixa|schema cache/.test(em)) throw new Error("Crédito no caixa ainda depende da atualização do banco (supabase-loja/migration-credito-caixa.sql). Nada foi lançado."); return ok(r); },
    async buscarClientes(q) { return ok(await sb.rpc("buscar_clientes", { p_q: q })); },
    async clientePorNome(nome) { const r = await sb.rpc("cliente_por_nome", { p_nome: nome }); const em = (r.error && ((r.error.code || "") + " " + (r.error.message || ""))) || "";
      if (r.error && /PGRST202|42883|cliente_por_nome|schema cache|does not exist/i.test(em)) return null; if (r.error) throw new Error(globalThis.BAGDA_CLIENTE_NOME ? BAGDA_CLIENTE_NOME.limparErro(r.error.message) : r.error.message);
      const row = Array.isArray(r.data) ? r.data[0] : r.data; return row && row.id ? row : null; },
    async criarCliente(c) { const CN = globalThis.BAGDA_CLIENTE_NOME; if (CN && c && c.nome) { const dup = await localizarClienteDuplicado(c, null); if (dup) throw new Error(CN.mensagem(dup)); }
      const limpo = e => { throw new Error(CN ? CN.limparErro(e.message) : e.message); };
      try { if ("atendimento" in c) { const r = await sb.rpc("criar_cliente_atendimento", { p_nome: c.nome, p_atendimento: c.atendimento || null });
        if (!r.error) return r.data; if (!/PGRST202|criar_cliente_atendimento|schema cache/i.test((r.error.code || "") + " " + (r.error.message || ""))) return ok(r); }
      return ok(await sb.rpc("criar_cliente", { p_nome: c.nome, p_telefone: c.telefone || null, p_doc: c.doc || null, p_email: c.email || null, p_endereco: c.endereco || null, p_obs: c.obs || null })); }
      catch (e) { limpo(e); } },
    async clienteExtrato(id) { const r = await sb.rpc("cliente_extrato", { p_cliente: id }); if (r.error && /PGRST202|42883|cliente_extrato/.test((r.error.code || "") + " " + (r.error.message || ""))) throw new Error("Extrato do cliente depende de atualização do banco — avise o admin (supabase-loja/migration-cliente-extrato.sql)."); return ok(r); },
    async clientes() { const L = ok(await sb.from("v_clientes_saldo").select("*").order("nome")); let extra = await sb.from("clientes").select("id,atendimento,limite_prazo").limit(5000);
      if (extra.error) extra = await sb.from("clientes").select("id,atendimento").limit(5000);
      if (!extra.error && extra.data) { const m = Object.fromEntries(extra.data.map(x => [x.id, x])); L.forEach(c => { const e = m[c.id] || {}; if (c.atendimento == null) c.atendimento = e.atendimento ?? null; if (c.limite_prazo == null && e.limite_prazo != null) c.limite_prazo = e.limite_prazo; }); } return L; },
    async salvarCliente(id, c) { const CN = globalThis.BAGDA_CLIENTE_NOME; if (CN && c && (c.nome || c.doc || c.telefone)) { const dup = await localizarClienteDuplicado(c, id); if (dup) throw new Error(CN.mensagem(dup)); }
      try { ok(await sb.from("clientes").update(c).eq("id", id)); } catch (e) { throw new Error(CN ? CN.limparErro(e.message) : e.message); } },
    async fornecedores() { return ok(await sb.from("fornecedores").select("*").order("nome")); },
    async salvarFornecedor(id, f) { ok(id ? await sb.from("fornecedores").update(f).eq("id", id) : await sb.from("fornecedores").insert(f)); },
    async contas() { return ok(await sb.from("v_contas_pagar").select("*").order("vencimento")); },
    async salvarConta(id, c) { ok(id ? await sb.from("contas_pagar").update(c).eq("id", id) : await sb.from("contas_pagar").insert(c)); },
    async pagarConta(id, v, cx, forma, data) { return ok(await sb.rpc("pagar_conta", { p_conta: id, p_valor: v, p_caixa: cx, p_forma: forma, p_data: data || null })); },
    async contaPagamentos() { return ok(await sb.from("conta_pagamentos").select("*").order("id", { ascending: false }).limit(100)); },
    async recebimentos() { return ok(await sb.from("v_recebimentos").select("*").order("id", { ascending: false }).limit(100)); },
    async cobrancaAlertas() { const r = await sb.rpc("cobranca_alertas"); const em = (r.error && ((r.error.code || "") + " " + (r.error.message || ""))) || "";
      if (r.error && /PGRST202|42883|cobranca_alertas|schema cache|does not exist/i.test(em)) return { hoje: today(), clientes: [], n_clientes: 0, n_vencidas: 0, n_vence_hoje: 0, n_vence_breve: 0, n_limite: 0, pendente_sql: true };
      return ok(r); },
    async estornarRecebimento(rid, m) { return ok(await sb.rpc("estornar_recebimento", { p_rec: rid, p_motivo: m })); },
    async estornarCredito(kid, m) { return ok(await sb.rpc("estornar_credito", { p_id: kid, p_motivo: m })); },
    async cxEsp() { return ok(await sb.from("v_caixa_especial").select("*").order("id", { ascending: false }).limit(300)); },
    async cxEspEntrada(v, m) { return ok(await sb.rpc("cx_esp_entrada", { p_valor: v, p_motivo: m })); },
    async cxEspSaida(v, m, cid) { return ok(await sb.rpc("cx_esp_saida", { p_valor: v, p_motivo: m, p_cliente: cid || null })); },
    async cxEspEstornar(i, m) { return ok(await sb.rpc("cx_esp_estornar", { p_id: i, p_motivo: m })); },
    async depEsp() { if (me.role !== "admin") return ok(await sb.rpc("dep_esp_lista")); return ok(await sb.from("v_deposito_especial").select("*").order("sku")); },
    async depEspMov() { if (me.role !== "admin") return ok(await sb.rpc("dep_esp_movs", { p_limit: 100 })); return ok(await sb.from("v_deposito_especial_mov").select("*").order("id", { ascending: false }).limit(100)); },
    async depEspLote(h, itens) { return ok(await sb.rpc("dep_esp_entrada_lote", { p_header: h, p_itens: itens })); },
    async depEspEntrada(sku, q, c, m) { return ok(await sb.rpc("dep_esp_entrada", { p_sku: sku, p_qtd: q, p_custo: c, p_motivo: m })); },
    async depEspAjuste(sku, q, m) { return ok(await sb.rpc("dep_esp_ajuste", { p_sku: sku, p_nova: q, p_motivo: m })); },
    async depEspTransf(sku, q, d, m) { return ok(await sb.rpc("dep_esp_transferir", { p_sku: sku, p_qtd: q, p_direcao: d, p_motivo: m })); },
    async vendaOrigemPronta() { const r = await sb.from("v_nota_itens").select("estoque_origem").limit(1); return !r.error; },
    async receberCredito(cli, v, data, obs) { return ok(await sb.rpc("registrar_recebimento_com_credito", { p_cliente: cli, p_valor: v, p_data: data || null, p_obs: obs || null })); },
    async receber(cli, v, cx, forma, data, obs) { return ok(await sb.rpc("registrar_recebimento_credito", { p_cliente: cli, p_valor: v, p_caixa: cx, p_forma: forma, p_data: data || null, p_obs: obs || null })); },
    async receberCxesp(cli, v, forma, data, obs, chave) { return ok(await sb.rpc("registrar_recebimento_cxesp", { p_cliente: cli, p_valor: v, p_forma: forma, p_data: data || null, p_obs: obs || null, p_chave: chave })); },
    async adicionarDivida(cli, v, obs, chave) { return ok(await sb.rpc("adicionar_divida", { p_cliente: cli, p_valor: v, p_obs: obs || null, p_chave: chave })); },
    async caixasLista() {
      const q = await sb.from("caixas").select("id,nome,metodo,somente_admin").eq("ativo", true).order("id");
      const rows = q.error && /somente_admin|42703/.test(q.error.message || "")
        ? ok(await sb.from("caixas").select("id,nome,metodo").eq("ativo", true).order("id")).map(c => ({ ...c, somente_admin: false }))
        : ok(q);
      return rows.map(c => ({ caixa_id: c.id, nome: c.nome, metodo: c.metodo, somente_admin: !!c.somente_admin }));
    },
    async caixasPix() { const r = await sb.rpc("caixas_para_local_pix"); if (r.error) return []; return (r.data || []).map(c => ({ caixa_id: c.id, nome: c.nome })); },
    async cancelarNota(id, motivo) { ok(await sb.rpc("cancelar_nota", { p_id: id, p_motivo: motivo })); },
    async nota(id) { return ok(await sb.from("v_nota_itens").select("*").eq("nota_id", id)); },
    async notaPag(id) { return ok(await sb.from("nota_pagamentos").select("metodo,valor").eq("nota_id", id).order("id")); },
    async extrato(d, adm) { const itens = ok(await sb.from("v_nota_itens").select("*").eq("data", d).order("created_at").order("nota_id").limit(5000)), lucro = {}, fre = {}, cn = {}; (await api.fretesDia(d)).forEach(x => fre[x.id] = Number(x.frete)); (await api.caxinhasDia(d).catch(() => [])).forEach(x => cn[x.id] = Number(x.caxinha_natal));
      const so = [...new Set([...Object.keys(fre), ...Object.keys(cn)].map(Number))].filter(k => !itens.some(r => r.nota_id === k)), heads = so.length ? ok(await sb.from("v_notas").select("*").in("nota_id", so)) : [], ids = [...new Set([...itens.map(r => r.nota_id), ...so])]; if (!ids.length) return { itens, pags: [], lucro, fre, cn, heads };
      const pags = ok(await sb.from("nota_pagamentos").select("nota_id,metodo,valor").in("nota_id", ids).order("id"));
      if (adm) { const S = ok(await sb.from("sales").select("id,nota_id,qtd,total").in("nota_id", ids).limit(5000)), C = S.length ? ok(await sb.from("sale_costs").select("sale_id,custo_unit").in("sale_id", S.map(x => x.id)).limit(5000)) : [], cm = Object.fromEntries(C.map(c => [c.sale_id, Number(c.custo_unit)]));
        S.forEach(x => { if (x.id in cm) lucro[x.nota_id] = (lucro[x.nota_id] || 0) + Number(x.total) - Number(x.qtd) * cm[x.id]; }); }
      return { itens, pags, lucro, fre, cn, heads }; },
    async notas() { return ok(await sb.from("v_notas").select("*").order("created_at", { ascending: false }).order("nota_id", { ascending: false }).limit(300)); },
    async caixaSaldos() { return ok(await sb.from("v_caixa_saldo").select("*").order("caixa_id")); },
    async caixaExtrato(d) { return ok(await sb.from("v_caixa_extrato").select("*").eq("data", d).order("created_at")); },
    async caixaResumo(c, d) { return ok(await sb.rpc("caixa_resumo", { p_caixa: c, p_data: d })); },
    async caixaHxDia(d) { return ok(await sb.rpc("caixa_hx_dia", { p_data: d })); },
    async hxConfig() { return ok(await sb.rpc("caixa_hx_config")); },
    async hxConfigSet(on) { return ok(await sb.rpc("caixa_hx_config_set", { p_on: on })); },
    async caixaSessoes(d) {
      const r = await sb.rpc("caixa_sessoes_dia", { p_data: d });
      const em = (r.error && ((r.error.code || "") + " " + (r.error.message || ""))) || "";
      if (!r.error) return r.data || [];
      if (!/PGRST202|42883|caixa_sessoes_dia|schema cache|does not exist/i.test(em)) throw new Error(r.error.message);
      const q = await sb.from("caixa_sessoes").select("*").eq("data", d);
      if (!q.error) return q.data;
      return ok(await sb.from("caixa_sessoes").select("id,caixa_id,data,abertura_valor,aberto_por,aberto_em,fechamento_contado,fechado_por,fechado_em,obs").eq("data", d));
    },
    async caixaFinJanela() {
      const r = await sb.rpc("caixa_fin_janela");
      const em = (r.error && ((r.error.code || "") + " " + (r.error.message || ""))) || "";
      if (r.error && /PGRST202|42883|caixa_fin_janela|schema cache|does not exist/i.test(em))
        return { ilimitado: me.role === "admin", mostra_saldo: me.role === "admin", mostra_saldo_caixas: [1], hoje: today(), desde: me.role === "admin" ? null : spAdd(today(), -2), rotulo: me.role === "admin" ? "tudo" : "últimos 3 dias" };
      return ok(r);
    },
    async caixaFinLista() { return ok(await sb.rpc("caixa_fin_lista")); },
    async caixaFinLiberar(caixa, desde, dias, expira) { return ok(await sb.rpc("caixa_fin_liberar", { p_caixa: caixa || null, p_desde: desde || null, p_dias: dias || null, p_expira: expira || null })); },
    async caixaFinRevogar(id) { return ok(await sb.rpc("caixa_fin_revogar", { p_id: id })); },
    async caixaLancar(m) { ok(await sb.from("caixa_movimentos").insert(m)); },
    async transferirCaixa(origem, destino, valor, motivo, esp) {
      const oEsp = !!(esp && esp.origemEspecial), dEsp = !!(esp && esp.destinoEspecial);
      const r = await sb.rpc("transferir_caixa", { p_origem: oEsp ? null : origem, p_destino: dEsp ? null : destino, p_valor: valor, p_motivo: motivo, p_origem_especial: oEsp, p_destino_especial: dEsp });
      if (r.error && /PGRST202|42883|transferir_caixa|schema cache|does not exist/i.test((r.error.code || "") + " " + (r.error.message || "")))
        throw new Error((oEsp || dEsp) ? "Transferir envolvendo a Caixa Especial ainda depende da atualização do banco (supabase-loja/migration-transferir-especial.sql). Nada foi lançado." : "Transferir entre caixas ainda depende da atualização do banco (supabase-loja/migration-transferir-caixa.sql). Nada foi lançado.");
      return ok(r);
    },
    async estornarMov(mid, m, cn) { const r = await sb.rpc("estornar_movimento_caixa", { p_mov: mid, p_motivo: m, p_cancelar_nota: !!cn }); if (r.error && /PGRST202|42883|estornar_movimento_caixa/.test((r.error.code || "") + " " + (r.error.message || ""))) throw new Error("Estornar movimento de caixa ainda depende de uma atualização do banco — avise o admin."); return ok(r); },
    async caixaAbrir(c, v) { return ok(await sb.rpc("caixa_abrir", { p_caixa: c, p_valor: v })); },
    async caixaFechar(c, v) { return ok(await sb.rpc("caixa_fechar", { p_caixa: c, p_contado: v })); },
    async usuarios() { return ok(await sb.from("profiles").select("id,handle,nome,role,ativo").order("nome")); },
    async salvarUsuario(id, u) { ok(await sb.from("profiles").update(u).eq("id", id)); },
    async adminProducts() { return ok(await sb.from("v_admin_products").select("*").order("sku")); },
    async purchases() { return ok(await sb.from("purchases").select("*").order("id", { ascending: false }).limit(100)); },
    async addPurchase(p) { ok(await sb.from("purchases").insert(p)); },
    async compraLote(header, itens) { return ok(await sb.rpc("registrar_compra_lote", { p_header: header, p_itens: itens })); },
    async compraOrigem(header, itens) {
      const r = await sb.rpc("registrar_compra_origem", { p_header: header, p_itens: itens });
      const em = (r.error && ((r.error.code || "") + " " + (r.error.message || ""))) || "";
      if (r.error && /PGRST202|42883|registrar_compra_origem|schema cache|does not exist/i.test(em)) { const err = new Error("registrar_compra_origem"); err.norpc = true; throw err; }
      return ok(r);
    },
    async compraPagamento(header, itens) {
      const r = await sb.rpc("registrar_compra_pagamento", { p_header: header, p_itens: itens });
      const em = (r.error && ((r.error.code || "") + " " + (r.error.message || ""))) || "";
      if (r.error && /PGRST202|42883|registrar_compra_pagamento|schema cache|does not exist/i.test(em)) { const err = new Error("Pagamento da compra ainda depende da atualização do banco (supabase-loja/migration-compras-pagamento.sql). Nada foi salvo."); err.norpc = true; throw err; }
      return ok(r);
    },
    async comprasCaixas() {
      const r = await sb.rpc("compras_caixas_pagamento");
      const em = (r.error && ((r.error.code || "") + " " + (r.error.message || ""))) || "";
      if (r.error && /PGRST202|42883|compras_caixas_pagamento|schema cache|does not exist/i.test(em)) throw new Error("Pagamento da compra ainda depende da atualização do banco (supabase-loja/migration-compras-pagamento.sql).");
      return ok(r);
    },
    async comprasPendentes() {
      const r = await sb.rpc("compras_pendentes");
      const em = (r.error && ((r.error.code || "") + " " + (r.error.message || ""))) || "";
      if (r.error && /PGRST202|42883|compras_pendentes|schema cache|does not exist/i.test(em)) throw new Error("Compras pendentes ainda dependem da atualização do banco (supabase-loja/migration-compras-pagamento.sql).");
      return ok(r);
    },
    async compraPagar(id, valor, caixa, cambio, data) {
      const args = { p_compra: id, p_valor: valor, p_caixa: caixa };
      if (cambio != null && cambio !== "") args.p_cambio = cambio;
      if (data) args.p_data = data;
      const r = await sb.rpc("compra_pagar", args);
      const em = (r.error && ((r.error.code || "") + " " + (r.error.message || ""))) || "";
      if (r.error && /PGRST202|42883|compra_pagar|schema cache|does not exist/i.test(em)) throw new Error(cambio != null ? "Câmbio do pagamento ainda depende da atualização do banco (supabase-loja/migration-cambio-pago.sql). Nada foi lançado." : "Pagamento da compra ainda depende da atualização do banco (supabase-loja/migration-compras-pagamento.sql). Nada foi lançado.");
      return ok(r);
    },
    async compraAgendar(id, quando) {
      const r = await sb.rpc("compra_agendar", { p_compra: id, p_quando: quando || null });
      const em = (r.error && ((r.error.code || "") + " " + (r.error.message || ""))) || "";
      if (r.error && /PGRST202|42883|compra_agendar|schema cache|does not exist/i.test(em)) throw new Error("Agenda da compra ainda depende da atualização do banco (supabase-loja/migration-cambio-pago.sql). Nada foi salvo.");
      return ok(r);
    },
    async custosLoja() {
      const r = await sb.rpc("custos_loja");
      const em = (r.error && ((r.error.code || "") + " " + (r.error.message || ""))) || "";
      if (r.error && /PGRST202|42883|custos_loja|schema cache|does not exist/i.test(em)) return null;
      return ok(r);
    },
    async cotacaoLer() {
      const r = await sb.rpc("cotacao_dolar_ler");
      const em = (r.error && ((r.error.code || "") + " " + (r.error.message || ""))) || "";
      if (r.error && /PGRST202|42883|cotacao_dolar_ler|schema cache|does not exist/i.test(em)) return { valor: null, historico: [], pendente_sql: true };
      return ok(r);
    },
    async cotacaoSalvar(valor) {
      const r = await sb.rpc("cotacao_dolar_salvar", { p_valor: valor });
      const em = (r.error && ((r.error.code || "") + " " + (r.error.message || ""))) || "";
      if (r.error && /PGRST202|42883|cotacao_dolar_salvar|schema cache|does not exist/i.test(em)) throw new Error("Cotação do dólar ainda depende da atualização do banco (supabase-loja/migration-origem-dolar.sql). Nada foi salvo.");
      return ok(r);
    },
    async recalcularImportado(sku) {
      const r = await sb.rpc("recalcular_preco_importado", { p_sku: sku });
      const em = (r.error && ((r.error.code || "") + " " + (r.error.message || ""))) || "";
      if (r.error && /PGRST202|42883|recalcular_preco_importado|schema cache|does not exist/i.test(em)) throw new Error("Origem e preço em US$ ainda dependem da atualização do banco (supabase-loja/migration-origem-dolar.sql). Nada foi salvo.");
      return ok(r);
    },
    async comprasListar(q) { return ok(await sb.rpc("compras_listar", { p_q: q || null, p_limit: 200 })); },
    async compraDetalhe(n) { return ok(await sb.rpc("compra_detalhe", { p_numero: String(n) })); },
    async imeiSalvar(pid, slots) { return ok(await sb.rpc("compra_imei_salvar", { p_purchase_id: pid, p_slots: slots })); },
    async imeiBaixar(pid, a, b) { return ok(await sb.rpc("compra_imei_baixar", { p_purchase_id: pid, p_imei1: a, p_imei2: b || null })); },
    async itemReceber(pid, q) { return ok(await sb.rpc("compra_item_receber", { p_purchase_id: pid, p_qtd: q })); },
    async imeiBuscar(q) { return ok(await sb.rpc("imei_buscar", { p_q: q })); },
    async saveProduct(p, custo) {
      const send = async body => ok(await sb.from("products").upsert(body));
      try { await send(p); }
      catch (e) {
        if (p.origem === "Importado" || p.preco_usd != null) throw new Error("Origem e preço em US$ ainda dependem da atualização do banco (supabase-loja/migration-origem-dolar.sql). Nada foi salvo.");
        if (/origem|preco_usd|PGRST204|42703/i.test(e.message || "")) {
          const rest = { ...p }; delete rest.origem; delete rest.preco_usd; await send(rest);
        } else throw e;
      }
      if (custo !== "" && custo != null) ok(await sb.from("product_costs").upsert({ sku: p.sku, custo: Number(custo) }));
      if (p.origem === "Importado") await api.recalcularImportado(p.sku);
    },
    async pontoMinhaFace() { const r = await sb.from("ponto_faces").select("user_id,foto_path,consentimento_em,cadastrado_em,descriptor").eq("user_id", me.id).maybeSingle(); if (r.error) throw new Error(r.error.message); return r.data; },
    async pontoMeusRegistros() { return ok(await sb.from("v_ponto_registros").select("*").eq("user_id", me.id).eq("excluido", false).order("registrado_em", { ascending: false }).limit(400)); },
    async pontoRegistrosMes(ym) { const a = ym + "-01", b = ym + "-31"; return ok(await sb.from("v_ponto_registros").select("*").gte("data_sp", a).lte("data_sp", b).eq("excluido", false).order("registrado_em")); },
    async pontoJornadas() { return ok(await sb.from("ponto_jornadas").select("*")); },
    async pontoTotens() { return ok(await sb.from("ponto_totens").select("*")); },
    async pontoFalhas() { return ok(await sb.from("ponto_falhas").select("*").order("criado_em", { ascending: false }).limit(200)); },
    async pontoSouTotem() { return ok(await sb.rpc("ponto_e_totem")); },
    async pontoUploadFoto(path, blob) { if (!blob) return path; const r = await sb.storage.from("ponto").upload(path, blob, { upsert: true, contentType: (blob.type || "image/jpeg") }); if (r.error) throw new Error(r.error.message); return path; },
    async pontoCadastrarFace(desc, path, consent, texto, uid) { return ok(await sb.rpc("ponto_cadastrar_face", { p_descriptor: desc, p_foto_path: path, p_consentimento: !!consent, p_consentimento_texto: texto, p_user_id: uid || null })); },
    async pontoExcluirFace(uid, mot) { return ok(await sb.rpc("ponto_excluir_face", { p_user_id: uid, p_motivo: mot })); },
    async registrarPonto(tipo, desc, path, ua, lat, lng) { return ok(await sb.rpc("registrar_ponto", { p_tipo: tipo, p_descriptor: desc, p_foto_path: path, p_user_agent: ua || null, p_lat: lat ?? null, p_lng: lng ?? null })); },
    async registrarPontoTotem(tipo, desc, path, ua, lat, lng) { return ok(await sb.rpc("registrar_ponto_totem", { p_tipo: tipo, p_descriptor: desc, p_foto_path: path, p_user_agent: ua || null, p_lat: lat ?? null, p_lng: lng ?? null })); },
    async pontoEditarRegistro(id, tipo, mot) { return ok(await sb.rpc("ponto_editar_registro", { p_id: id, p_tipo: tipo, p_motivo: mot })); },
    async pontoExcluirRegistro(id, mot) { return ok(await sb.rpc("ponto_excluir_registro", { p_id: id, p_motivo: mot })); },
    async pontoSetJornada(uid, e, s, a, dias, tol) { return ok(await sb.rpc("ponto_set_jornada", { p_user_id: uid, p_entrada: e, p_saida: s, p_almoco_minutos: a, p_dias_semana: dias, p_tolerancia_minutos: tol })); },
    async pontoSetTotem(uid, on, nome) { return ok(await sb.rpc("ponto_set_totem", { p_user_id: uid, p_on: !!on, p_nome: nome || null })); }
  };
} else {
  $("#mockbar").hidden = false;
  const role = ["vendedor", "financeiro", "estoque", "totem"].includes(qs.get("mock")) ? qs.get("mock") : "admin";
  const W = { admin: ["@mike", "Mike"], vendedor: ["@kaio", "Kaio"], financeiro: ["@pamela", "Pamela"], estoque: ["@rafa", "Rafa"], totem: ["@totem", "Totem Loja"] }[role];
  const meU = { id: "u-" + role, handle: W[0], nome: W[1], role, ativo: true };
  const U = [meU, ...[["@sam", "Sam", "admin"], ["@hadi", "Hadi", "admin"], ["@bianca", "Bianca", "vendedor"], ["@suelen", "Suelen", "vendedor"], ["@leticia", "Leticia", "financeiro"]].map(([h, n, r]) => ({ id: "u" + h, handle: h, nome: n, role: r, ativo: true }))];
  if (role !== "vendedor") U.push({ id: "u@kaio", handle: "@kaio", nome: "Kaio", role: "vendedor", ativo: true });
  if (role !== "totem") U.push({ id: "u@totem", handle: "@totem", nome: "Totem Loja", role: "vendedor", ativo: true });
  const P = [["JBL-001", "JBL", "Flip 6", "Azul", 799], ["JBL-002", "JBL", "Go 4", "Preto", 349], ["XIA-001", "Xiaomi", "Redmi Buds 5", null, 199], ["XIA-002", "Xiaomi", "Redmi Note 13", "128GB", 1499],
    ["SAM-001", "Samsung", "Galaxy A15", "128GB", 1199], ["APL-001", "Apple", "AirPods 4", null, 1299], ["BAS-001", "Baseus", "Cabo USB-C 1m", null, 49.9], ["BAS-002", "Baseus", "Carregador 30W", null, 129],
    ["ANK-001", "Anker", "Power Bank 10000mAh", null, 199], ["LEN-001", "Lenovo", "Fone LP40", null, 89.9], ["MUL-001", "Multilaser", "Mouse sem fio", null, 59.9], ["KAP-001", "Kapbom", "Suporte veicular", null, 39.9],
    ["BS-APL-270", "Apple", "iPhone 18 Duo (iPhone Duo)", "256GB", 9999, "Preto"], ["BS-APL-271", "Apple", "iPhone 18 Duo (iPhone Duo)", "256GB", 9999, "Azul-céu"], ["BS-APL-272", "Apple", "iPhone 18 Duo (iPhone Duo)", "512GB", 11999, "Branco"], ["BS-APL-273", "Apple", "iPhone 18 Duo (iPhone Duo)", null, 9999, null],
    ["BS-APL-280", "Apple", "MacBook Air M5", "13\" 16GB RAM 512GB", 12999, "Meia-noite"], ["BS-APL-281", "Apple", "MacBook Air M5", "15\" 24GB RAM 1TB", 16999, "Prateado"]]
    .map(([sku, marca, produto, tamanho, preco_venda, notas], i) => ({ sku, marca, produto, tamanho, preco_venda, notas: notas || null, fornecedor: sku.startsWith("BS-") ? "Distribuidora  Apple SP" : null, estoque: [5, 0, 8, 3, 0, 2, 20, 12, 6, 0, 9, 4, 3, 0, 1, 2, 4, 1][i], estoque_minimo: 2, ativo: true, origem: "Nacional", preco_usd: null }));
  const K = Object.fromEntries(P.map(p => [p.sku, Math.round(p.preco_venda * 0.6 * 100) / 100]));
  const COT = [{ valor: 5.4, alterado_em: "2026-11-13T12:00:00.000Z", handle: "@mike", nome: "Mike" }];
  const CX = [{ caixa_id: 1, nome: "Caixa Dinheiro", metodo: "dinheiro", somente_admin: false }, { caixa_id: 2, nome: "Caixa PIX (HX)", metodo: "pix", somente_admin: false }, { caixa_id: 3, nome: "Máquina Loja", metodo: "cartao", somente_admin: false }, { caixa_id: 10, nome: "LARANJIHA", metodo: null, somente_admin: false }, { caixa_id: 11, nome: "GETNET", metodo: null, somente_admin: false }, { caixa_id: 12, nome: "GASTOS LOJA", metodo: null, somente_admin: false }, { caixa_id: 13, nome: "PRIME", metodo: null, somente_admin: false }, { caixa_id: 14, nome: "CAIXA S2", metodo: null, somente_admin: false }, { caixa_id: 15, nome: "PRESTIGE ROSA", metodo: null, somente_admin: false }, { caixa_id: 16, nome: "BITLOG CONTAINER", metodo: null, somente_admin: true }, { caixa_id: 17, nome: "PAGAMENTO PRODUTOS", metodo: null, somente_admin: true }, { caixa_id: 18, nome: "COMPRA PRODUTOS", metodo: null, somente_admin: true }];
  const FINH = [];
  const COMP = [], CPAGTO = [];
  const CXE = [], AL = [], CR = [], N = [], IT = [], PG = [], MV = [], SE = [], PU = [], CL = [], FO = [], CP = [], CPG = [], RC = [], DE = [{ sku: "APL-001", qtd: 10, custo: 780 }, { sku: "JBL-002", qtd: 4, custo: 210 }], DEM = [], IM = []; let CNO = 0; const cnum = c => "C-" + String(c).padStart(6, "0"); let id = 1, logged = qs.has("auto");
  if (qs.has("origemfix")) { P.push({ sku: "FX-ORG-1", marca: "Apple", produto: "iPhone 18 Pro Max FIXTURE", tamanho: "Preto", preco_venda: 9999, estoque: 2, estoque_minimo: 2, ativo: true, notas: null, fornecedor: null }); DE.push({ sku: "FX-ORG-1", qtd: 5, custo: 7000 }); K["FX-ORG-1"] = 6000; }
  P.push({ sku: "IPH-IMP", marca: "Apple", produto: "iPhone Importado", tamanho: "128GB", preco_venda: 539.99, notas: null, fornecedor: "Miami Supply", estoque: 2, estoque_minimo: 2, ativo: true, origem: "Importado", preco_usd: 100, custo_usd: 80 });
  K["IPH-IMP"] = 432;
  const recb = p => Math.min(p.qtd, (p.rsi || 0) + IM.filter(i => i.purchase_id === p.id).length);
  const sv = a => ["venda", "entrada"].includes(a.tipo) ? a.valor : -a.valor;
  const mov = (caixa_id, tipo, valor, motivo, nota_id, user, at) => MV.push({ id: id++, caixa_id, caixa: CX.find(c => c.caixa_id === caixa_id).nome, tipo, valor, valor_assinado: 0, motivo, nota_id, handle: user.handle, nome: user.nome, created_at: at || new Date().toISOString(), data: new Date(at || Date.now()).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }) });
  const mkNota = (items, pags, cliente, user, at, clienteId, local, obs, frete = 0, caxinha = 0, prazoDias = null) => { frete = Math.round((+frete || 0) * 100) / 100; caxinha = Math.round((+caxinha || 0) * 100) / 100; if (frete < 0) throw new Error("Frete inválido"); if (caxinha < 0) throw new Error("Caxinha d Natal inválido"); if (!items.length && !(frete > 0) && !(caxinha > 0)) throw new Error("Nota sem itens");
    if (pags.some(g => g.metodo === "prazo") && !clienteId) throw new Error("Paga Depois exige cliente cadastrado");
    if (clienteId) cliente = (CL.find(c => c.id === clienteId) || {}).nome || cliente;
    const tot = items.reduce((a, x) => a + x.qtd * x.preco_vendido, 0) + frete + caxinha, pt = pags.reduce((a, x) => a + Number(x.valor), 0);
    if (Math.round(tot * 100) !== Math.round(pt * 100)) throw new Error(`Pagamentos (${pt.toFixed(2)}) diferentes do total (${tot.toFixed(2)})`);
    const need = {};
    for (const it of items) { const origem = it.origem === "especial" ? "especial" : "principal"; const p = P.find(x => x.sku === it.sku); if (!p || p.ativo === false) throw new Error(`Estoque insuficiente ou produto inativo (${it.sku})`); if (origem === "especial" && !["admin", "estoque"].includes(meU.role)) throw new Error("Sem permissão para vender do Depósito Especial"); need[origem + "\0" + it.sku] = (need[origem + "\0" + it.sku] || 0) + it.qtd; }
    for (const [key, qtd] of Object.entries(need)) { const origem = key.slice(0, key.indexOf("\0")), sku = key.slice(key.indexOf("\0") + 1), p = P.find(x => x.sku === sku);
      if (origem === "especial") { const d = DE.find(x => x.sku === sku); if (!d || d.qtd < qtd) throw new Error(`Depósito Especial sem estoque suficiente (${sku})`); }
      else if (p.estoque < qtd) throw new Error(`Estoque insuficiente ou produto inativo (${sku})`); }
    const nid = id++, ts = at || new Date().toISOString();
    for (const it of items) { const origem = it.origem === "especial" ? "especial" : "principal"; const p = P.find(x => x.sku === it.sku); let custo = K[p.sku];
      if (origem === "especial") { const d = DE.find(x => x.sku === it.sku); const antes = d.qtd; d.qtd -= it.qtd; custo = d.custo; DEM.unshift({ id: id++, sku: it.sku, tipo: "venda", qtd: -it.qtd, qtd_antes: antes, qtd_depois: d.qtd, custo_unit: d.custo, motivo: "Venda nota " + nid, created_at: ts }); }
      else p.estoque -= it.qtd;
      IT.push({ nota_id: nid, sku: p.sku, marca: p.marca, produto: p.produto, tamanho: p.tamanho, qtd: it.qtd, preco_vendido: it.preco_vendido, total: it.qtd * it.preco_vendido, custo, origem }); }
    const dataSp = new Date(ts).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    const temPrazo = pags.some(g => g.metodo === "prazo");
    const dias = temPrazo && prazoDias != null && prazoDias !== "" ? +prazoDias : null;
    if (temPrazo && prazoDias != null && prazoDias !== "" && (!(dias >= 1 && dias <= 30))) throw new Error("Informe o prazo (1 a 30 dias) para Paga Depois");
    const venc = dias ? (globalThis.BAGDA_PRAZO ? BAGDA_PRAZO.addDays(dataSp, dias) : dataSp) : null;
    N.push({ frete, caxinha_natal: caxinha, local_pagamento: local || null, obs_pagamento: obs || null, cliente_id: clienteId || null, nota_id: nid, data: dataSp, created_at: ts, cliente: cliente || null, status: "ativa", total: tot, handle: user.handle, nome: user.nome, pagamento: pags.map(x => x.metodo).join("+"), prazo_dias: dias, vencimento: venc });
    for (const g of pags) PG.push({ nota_id: nid, metodo: g.metodo, valor: Number(g.valor) }); /* pendente: o financeiro lança no caixa */
    return nid; };
  const devolverItem = i => { if (i.origem === "especial") { let d = DE.find(x => x.sku === i.sku); if (!d) DE.push(d = { sku: i.sku, qtd: 0, custo: i.custo || 0 }); d.qtd += i.qtd; } else { const p = P.find(x => x.sku === i.sku); if (p) p.estoque += i.qtd; } };
  const ready = Promise.resolve().then(() => {
    const kaio = U.find(u => u.handle === "@kaio") || meU, bia = U.find(u => u.handle === "@bianca");
    const H = h => new Date(Date.now() - h * 36e5).toISOString();
    mkNota([{ sku: "JBL-001", qtd: 1, preco_vendido: 799 }], [{ metodo: "cartao", valor: 799 }], "Cliente A", kaio, H(30));
    mkNota([{ sku: "XIA-001", qtd: 1, preco_vendido: 199 }, { sku: "BAS-001", qtd: 2, preco_vendido: 49.9 }], [{ metodo: "pix", valor: 200 }, { metodo: "dinheiro", valor: 98.8 }], null, bia, H(3));
    mkNota([{ sku: "ANK-001", qtd: 1, preco_vendido: 199 }], [{ metodo: "dinheiro", valor: 199 }], null, kaio, H(1));
    CL.push({ id: 1, nome: "Maria Souza", doc: "52998224725", telefone: "(11) 99999-0000", email: "maria@exemplo.com", endereco: "Rua das Flores, 10", obs: "", ativo: true }, { id: 2, nome: "João Lima", doc: null, telefone: "(11) 98888-1111", email: "", endereco: "", obs: "", ativo: true });
    mkNota([{ sku: "XIA-002", qtd: 1, preco_vendido: 1199 }], [{ metodo: "prazo", valor: 899 }, { metodo: "pix", valor: 300 }], null, kaio, H(26), 1);
    N.push({ frete: 80, caxinha_natal: 0, local_pagamento: null, obs_pagamento: "DÍVIDA ANTERIOR", cliente_id: 1, nota_id: 9101, data: "2026-01-02", created_at: H(400), cliente: "Maria Souza", status: "ativa", total: 80, handle: "@mike", nome: "Mike", pagamento: "prazo" });
    PG.push({ nota_id: 9101, metodo: "prazo", valor: 80 });
    N.push({ frete: 0, caxinha_natal: 0, local_pagamento: null, obs_pagamento: null, cliente_id: null, nota_id: 9102, data: "2026-01-03", created_at: H(390), cliente: "Maria Souza", status: "ativa", total: 50, handle: "@mike", nome: "Mike", pagamento: "prazo" });
    PG.push({ nota_id: 9102, metodo: "prazo", valor: 50 });
    CL.push({ id: 3, nome: "Eduardo Corajoso dos Santos Comércio de Eletrônicos e Acessórios", doc: null, telefone: "(11) 97777-2222", email: "", endereco: "", obs: "", ativo: true });
    mkNota([{ sku: "BAS-002", qtd: 1, preco_vendido: 25155 }], [{ metodo: "pix", valor: 25155 }], null, bia || kaio, H(0.5)); /* como a 000021: PIX por engano, sem cliente */
    CR.push({ id: id++, cliente_id: 1, tipo: "entrada", valor: 1500, obs: "Crédito antigo (sistema anterior)", nota_id: null, handle: "@mb", created_at: H(48) }, { id: id++, cliente_id: 2, tipo: "entrada", valor: 320, obs: "Troca de produto", nota_id: null, handle: "@mb", created_at: H(20) }, { id: id++, cliente_id: 1, tipo: "uso", valor: 250, obs: "Usado no balcão", nota_id: null, handle: "@mb", created_at: H(4) });
    N.filter(n => n.nota_id !== 3).forEach(n => PG.filter(g => g.nota_id === n.nota_id && !["prazo", "credito"].includes(g.metodo)).forEach(g => mov(CX.find(c => c.metodo === g.metodo).caixa_id, "venda", g.valor, "Nota " + String(n.nota_id).padStart(6, "0"), n.nota_id, meU, n.created_at)));
    FO.push({ id: 1, nome: "Distribuidora Tech SP", cnpj: "11222333000181", contato: "Ana", telefone: "(11) 3333-0000", email: "vendas@tech.com", obs: "", ativo: true });
    CP.push({ id: 1, fornecedor_id: 1, valor: 3200, vencimento: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10), descricao: "Lote fones JBL" }, { id: 2, fornecedor_id: 1, valor: 450, vencimento: new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10), descricao: "Frete" });
    const PZ = globalThis.BAGDA_PRAZO, hj = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    const dAdd = (n) => PZ ? PZ.addDays(hj, n) : hj;
    const seedPrazo = (cli, nome, valor, venc, data, alloc, dias) => {
      const nid = id++;
      N.push({ frete: 0, caxinha_natal: 0, local_pagamento: null, obs_pagamento: null, cliente_id: cli, nota_id: nid, data: data || venc || hj, created_at: (data || hj) + "T12:00:00-03:00", cliente: nome, status: "ativa", total: valor, handle: "@kaio", nome: "Kaio", pagamento: "prazo", prazo_dias: dias == null ? null : dias, vencimento: venc || null });
      PG.push({ nota_id: nid, metodo: "prazo", valor });
      if (alloc > 0) { const rid = id++; RC.unshift({ id: rid, cliente_id: cli, valor: alloc, caixa_id: 1, forma: "pix", data: hj, obs: "quitação demo" }); AL.push({ nota_id: nid, valor: alloc, rec: rid }); }
      return nid;
    };
    const cMaria = CL.find(c => c.id === 1); if (cMaria) cMaria.limite_prazo = 500;
    CL.push({ id: 4, nome: "Carlos Mendes", doc: null, telefone: "(11) 97777-3333", email: "", endereco: "", obs: "", ativo: true, limite_prazo: null },
            { id: 5, nome: "Rita Alves", doc: null, telefone: "(11) 96666-4444", email: "", endereco: "", obs: "", ativo: true, limite_prazo: null },
            { id: 6, nome: "Sofia Prado", doc: null, telefone: "(11) 95555-5555", email: "", endereco: "", obs: "", ativo: true, limite_prazo: 1000 },
            { id: 7, nome: "Pedro Pago", doc: null, telefone: "(11) 94444-6666", email: "", endereco: "", obs: "", ativo: true, limite_prazo: null });
    seedPrazo(4, "Carlos Mendes", 650, dAdd(-5), dAdd(-12), 0, 7);
    seedPrazo(5, "Rita Alves", 280, dAdd(2), hj, 0, 2);
    seedPrazo(2, "João Lima", 420, hj, dAdd(-1), 0, 1);
    seedPrazo(6, "Sofia Prado", 1500, dAdd(15), hj, 0, 15);
    seedPrazo(7, "Pedro Pago", 400, dAdd(-10), dAdd(-17), 400, 7);
    mov(1, "entrada", 200, "Fundo de troco", null, U[0], H(5)); mov(1, "saida", 35, "Compra de material de limpeza", null, U[0], H(2)); mov(1, "entrada", 150, "Recebimento cliente Maria Souza", null, U[0], H(1)); MV[MV.length - 1].cliente = "Maria Souza"; mov(3, "entrada", 28600, "DANIEL IPHONE DUO", null, U.find(u => /pamela/i.test(u.handle || "")) || U[0], H(0.2)); MV[MV.length - 1].forma = "cartao";
    mov(17, "entrada", 25000, "Saldo PAGAMENTO PRODUTOS", null, U[0], H(8)); mov(1, "entrada", 4000, "Reforço compras", null, U[0], H(8)); mov(14, "entrada", 3000, "Saldo CAIXA S2", null, U[0], H(7)); mov(15, "entrada", 2200, "Saldo PRESTIGE ROSA", null, U[0], H(7));
    mov(18, "saida", 8000, "Dívida Compra C-009010 — Distribuidora Tech SP", null, U[0], H(2));
    mov(1, "entrada", 9000, "ENTRADA ANTIGA oculta do financeiro", null, U[0], new Date(Date.now() - 10 * 864e5).toISOString());
    COMP.push({ id: 9001, numero: "C-009001", data: "2026-11-01", fornecedor: "Distribuidora Tech SP", pagamento: "depois", vencimento: "2026-11-10", total: 1800 }, { id: 9002, numero: "C-009002", data: "2026-11-12", fornecedor: "Distribuidora Tech SP", pagamento: "depois", vencimento: "2026-12-01", total: 640 }, { id: 9003, numero: "C-009003", data: "2026-11-08", fornecedor: "Apple SP", pagamento: "depois", vencimento: null, total: 960 });
    CPAGTO.push({ id: id++, compra_id: 9002, valor: 200, data: "2026-11-12", caixa_id: 1, caixa: "Caixa Dinheiro", somente_admin: false });
    PU.unshift({ id: id++, data: "2026-11-12", sku: "IPH-IMP", fornecedor: "Miami Supply", qtd: 2, custo_unit: 432, custo_usd: 80, taxa_dolar: 5.4, origem: "Importado", compra_id: 9004, total: 864, compra_lote: "seed-imp" });
    COMP.push({ id: 9004, numero: "C-009004", data: "2026-11-12", fornecedor: "Miami Supply", pagamento: "depois", vencimento: null, pagar_em: "2026-11-20", taxa_dolar: 5.4, total: 864 });
    recalcImportados();
  });
  const vec = (seed) => Array.from({ length: 128 }, (_, i) => Number(((i + 1) * 0.001 + seed).toFixed(6)));
  const PONTOfaces = [];
  const PONTOregs = [];
  const PONTOfalhas = [];
  const PONTOjor = [];
  const PONTOtotem = [];
  const PONTOaudit = [];
  let pontoId = 1;
  const enrollDemo = (u, seed) => PONTOfaces.push({ user_id: u.id, descriptor: vec(seed), foto_path: u.id + "/ref.jpg", consentimento_em: new Date().toISOString(), cadastrado_em: new Date().toISOString(), cadastrado_por: u.id });
  U.forEach((u, i) => { if (u.role !== "estoque") enrollDemo(u, 0.1 + i * 0.05); });
  const atDay = (ymd, hh, mm) => new Date(ymd + "T" + String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0") + ":00-03:00").toISOString();
  const punchDemo = (u, ymd, tipo, hh, mm, origem) => PONTOregs.push({ id: pontoId++, user_id: u.id, handle: u.handle, nome: u.nome, tipo, registrado_em: atDay(ymd, hh, mm), data_sp: ymd, foto_path: u.id + "/" + tipo + ".jpg", score: 0.12, match_ok: true, origem: origem || "app", excluido: false });
  const ka = U.find(u => /kaio/i.test(u.handle)) || U.find(u => u.role === "vendedor");
  const mik = U.find(u => /mike/i.test(u.handle)) || U.find(u => u.role === "admin");
  const pamu = U.find(u => /pamela/i.test(u.handle));
  const y = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }).slice(0, 7);
  const mk = (n) => y + "-" + String(n).padStart(2, "0");
  if (ka) { punchDemo(ka, mk(3), "entrada", 8, 4); punchDemo(ka, mk(3), "saida_almoco", 12, 2); punchDemo(ka, mk(3), "volta_almoco", 13, 5); punchDemo(ka, mk(3), "saida", 18, 8); punchDemo(ka, mk(4), "entrada", 8, 22); punchDemo(ka, mk(4), "saida", 18, 1); }
  if (mik) { punchDemo(mik, mk(3), "entrada", 7, 55); punchDemo(mik, mk(3), "saida_almoco", 12, 0); punchDemo(mik, mk(3), "volta_almoco", 13, 0); punchDemo(mik, mk(3), "saida", 19, 10); }
  if (pamu) { punchDemo(pamu, mk(5), "entrada", 8, 0, "totem"); punchDemo(pamu, mk(5), "saida", 17, 58, "totem"); }
  const limiarDemo = 0.55;
  const distDemo = (a, b) => Math.sqrt(a.reduce((s, x, i) => s + (x - b[i]) * (x - b[i]), 0));
  const todaySP = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  const totU = U.find(u => u.handle === "@totem" || u.id === "u-totem");
  if (totU && !PONTOtotem.some(t => t.user_id === totU.id)) PONTOtotem.push({ user_id: totU.id, nome: "Totem loja" });
  String(qs.get("ponto_hoje") || "").split(",").map(s => s.trim()).filter(t => ["entrada", "saida_almoco", "volta_almoco", "saida"].includes(t))
    .forEach((t, i) => punchDemo(meU, todaySP(), t, 8, 40 + i * 10));
  const crOk = k => !k.nota_id || (N.find(n => n.nota_id === k.nota_id) || {}).status === "ativa";
  const crSaldo = cid => CR.filter(k => k.cliente_id === cid && crOk(k)).reduce((a, k) => a + (k.tipo === "entrada" ? k.valor : -k.valor), 0);
  const needFin = () => { if (role === "vendedor") throw new Error("Sem permissão (financeiro/admin)"); };
  const fiado = cid => N.filter(n => n.cliente_id === cid && n.status === "ativa").reduce((a, n) => a + PG.filter(g => g.nota_id === n.nota_id && g.metodo === "prazo").reduce((b, g) => b + g.valor, 0), 0);
  const recebido = cid => RC.filter(r => r.cliente_id === cid).reduce((a, r) => a + r.valor, 0);
  const pago = k => CPG.filter(p => p.conta_id === k).reduce((a, p) => a + p.valor, 0);
  const vis = () => role === "admin" ? N : role === "vendedor" ? N.filter(n => n.handle === meU.handle) : [];
  let HXP = false; const hxR = c => role !== "admin" && !HXP && /HX/.test((CX.find(x => x.caixa_id === c) || {}).nome || ""); /* espelha caixa_dia_visivel no servidor */
  const mvV = () => MV.filter(m => !(hxR(m.caixa_id) && m.data < today()));
  const finAtivas = () => FINH.filter(g => g.ativo && !g.revogado_em && (!g.expira_em || g.expira_em > new Date().toISOString()));
  const finCorte = caixaId => {
    if (role === "admin") return "0001-01-01";
    let corte = spAdd(today(), hxR(caixaId) ? 0 : -2);
    for (const g of finAtivas()) {
      if (g.caixa_id != null && g.caixa_id !== caixaId) continue;
      if (g.desde) corte = g.desde < corte ? g.desde : corte;
      if (g.dias) { const d0 = spAdd(today(), -(g.dias - 1)); if (d0 < corte) corte = d0; }
    }
    return corte;
  };
  const finCaixa = id => { const c = CX.find(x => x.caixa_id === id); return !!c && (!c.somente_admin || role === "admin"); };
  const finVê = m => role === "admin" || (finCaixa(m.caixa_id) && m.data >= finCorte(m.caixa_id) && m.data <= today());
  const saldo = c => mvV().filter(m => m.caixa_id === c).reduce((a, m) => a + sv(m), 0);
  const needCx = () => { if (role === "vendedor") throw new Error("Sem permissão de caixa"); };
  const grp = (rows, key, f) => Object.values(rows.reduce((a, r) => { const k = r[key]; a[k] ||= { [key]: k, nome: r.nome, vendas: 0, itens: 0, faturamento: 0, custo: 0 }; f(a[k], r); return a; }, {}));
  const DIVK = {};
  const loteTravado = (c, linha) => {
    if (!c) return true;
    if (c.cambio_pago != null) return true;
    return !(c.pagamento === "depois" || c.pagamento === "divida");
  };
  const lotesSku = sku => PU.filter(p => p.sku === sku && p.origem === "Importado" && p.custo_usd != null).map(p => {
    const c = COMP.find(x => x.id === p.compra_id);
    const travado = loteTravado(c, p);
    return { qtd: p.qtd, custo_usd: p.custo_usd, taxa: c && c.cambio_pago != null ? c.cambio_pago : p.taxa_dolar, travado };
  });
  function situacaoSku(sku) {
    const p = P.find(x => x.sku === sku);
    if (!p || p.origem !== "Importado") return { situacao: "nacional", cambio: null };
    const lots = lotesSku(sku);
    if (!lots.length) return { situacao: p.custo_usd != null ? "cotacao" : "nacional", cambio: null };
    const aberto = lots.some(l => !l.travado);
    const fechado = lots.some(l => l.travado);
    if (aberto && fechado) return { situacao: "misto", cambio: null };
    if (aberto) return { situacao: "cotacao", cambio: null };
    const taxas = [...new Set(lots.map(l => Number(l.taxa)))];
    return { situacao: "travado", cambio: taxas.length === 1 ? taxas[0] : null };
  }
  function recalcImportados() {
    const cot = (COT[0] || {}).valor;
    const skus = new Set(PU.filter(p => p.origem === "Importado").map(p => p.sku));
    skus.forEach(sku => {
      const p = P.find(x => x.sku === sku);
      if (!p || p.origem !== "Importado") return;
      const medio = globalThis.BAGDA_ORIGEM.custoMedioLotes(lotesSku(sku), cot);
      if (!medio || medio.error || medio.value == null) return;
      K[sku] = medio.value;
      p.custo_usd = lotesSku(sku).length ? lotesSku(sku)[lotesSku(sku).length - 1].custo_usd : p.custo_usd;
      if (!(Number(p.preco_usd) > 0)) return;
      const calc = BAGDA_ORIGEM.precoReaisImportado(p.preco_usd, cot, medio.value);
      if (!calc.error) p.preco_venda = calc.preco;
    });
  }
  api = {
    async login(e, pw) { if (!e || !pw) throw new Error("Preencha nome e senha"); logged = true; },
    async logout() { logged = false; }, async consumeUrl() { if (AUTH.access_token || AUTH.code || AUTH.token_hash) logged = true; }, async setPassword() {}, async session() { await ready; return logged ? {} : null; },
    async aal() { return { currentLevel: "aal1", nextLevel: "aal1" }; }, async factors() { return []; },
    async enroll() { return { id: "f1", totp: { qr_code: "", secret: "DEMO-SECRET-XXXX" } }; },
    async verify() { toast("Demonstração: 2FA ativado"); }, async unenroll() {},
    async status() { return { locked: qs.has("locked"), is_owner: role === "admin" }; }, async lock() { toast("Demonstração: nada bloqueado"); }, async unlock() {}, async signoutAll() { return 0; }, async reportFail() {},
    async events() { return [{ at: new Date().toISOString(), kind: "failed_login", email: "teste@loja.bgdstores.local", detail: {} }]; },
    async dumpTable(t) { return ({ clientes: CL, fornecedores: FO, contas_pagar: CP, conta_pagamentos: CPG, cliente_recebimentos: RC, products: P, notas: N, nota_pagamentos: PG, caixas: CX, caixa_movimentos: MV, caixa_sessoes: SE, purchases: PU })[t] || []; },
    async profile() { return meU; },
    async products() { await ready; if (role === "financeiro") return []; if (role === "admin") return P.map(p => ({ ...p })); return P.map(p => { const c = { ...p }; delete c.preco_usd; delete c.custo_usd; return c; }); },
    async productsFull() { await ready; return role === "financeiro" ? [] : (role === "admin" ? P.map(p => ({ ...p })) : P.map(p => { const c = { ...p }; delete c.preco_usd; delete c.custo_usd; return c; })); },
    async costs() { if (role !== "admin") throw new Error("Sem permissão"); return Object.entries(K).map(([sku, custo]) => ({ sku, custo })); },
    async custoSalvar(sku, custo) {
      if (role !== "admin") throw new Error("Sem permissão");
      if (qs.has("failcusto")) throw new Error("Falha simulada ao salvar o custo");
      const n = Number(custo);
      if (!/^[A-Z0-9-]{3,20}$/.test(String(sku || "")) || !Number.isFinite(n) || n < 0) throw new Error("Custo inválido");
      const p = P.find(x => x.sku === sku);
      if (!p) throw new Error("Produto não encontrado");
      const est = p.estoque, preco = p.preco_venda;
      K[sku] = Math.round(n * 100) / 100;
      if (p.estoque !== est || p.preco_venda !== preco) throw new Error("Estoque ou preço não podem mudar com o custo");
      return { sku, custo: K[sku] };
    },
    async estoqueVendedor() { await ready; return role === "financeiro" ? [] : P.filter(p => p.ativo).map(({ sku, marca, produto, tamanho, estoque, origem }) => ({ sku, marca, produto, tamanho, estoque, origem })); },
    async repSeller(d) { const ids = N.filter(n => n.status === "ativa" && n.data === d).map(n => n.nota_id); return role !== "admin" ? [] : grp(IT.filter(i => ids.includes(i.nota_id)).map(i => ({ ...i, ...N.find(n => n.nota_id === i.nota_id), total: i.total })), "handle", (g, r) => { g.itens += r.qtd; g.faturamento += r.total; g.custo += r.qtd * r.custo; g._n = (g._n || new Set()).add(r.nota_id); g.vendas = g._n.size; }); },
    async repPay(d) { const ids = N.filter(n => n.status === "ativa" && n.data === d).map(n => n.nota_id); return role !== "admin" ? [] : grp(PG.filter(g => ids.includes(g.nota_id)), "metodo", (g, r) => { g.vendas++; g.faturamento += r.valor; }).map(g => ({ ...g, forma_pagamento: g.metodo })); },
    async repProfit(d) { const r = await this.repSeller(d); return r.map(x => ({ ...x, lucro: x.faturamento - x.custo })); },
    async buscarClientes(q) { if (q.trim().length < 2) return []; const d = dig(q); return CL.filter(c => c.ativo && (norm(c.nome).includes(norm(q)) || (d.length >= 3 && (dig(c.doc).includes(d) || dig(c.telefone).includes(d))))).slice(0, 15).map(({ id, nome, telefone, doc }) => ({ id, nome, telefone, doc })); },
    async clientePorNome(nome) { const CN = globalThis.BAGDA_CLIENTE_NOME; return CN ? CN.findNome(CL, nome) : null; },
    async criarCliente(c) { if (role === "financeiro" && false) return; if (!c.nome || c.nome.trim().length < 2) throw new Error("Informe o nome do cliente"); const d = dig(c.doc) || null; if (d && !docOk(d)) throw new Error("CPF/CNPJ inválido"); const ex = d && CL.find(x => x.doc === d); if (ex) return ex.id;
      const dupN = globalThis.BAGDA_CLIENTE_NOME && BAGDA_CLIENTE_NOME.duplicata(CL, c, null); if (dupN) throw new Error(BAGDA_CLIENTE_NOME.mensagem(dupN));
      const nc = { id: CL.length + 1, nome: c.nome.trim(), telefone: c.telefone || "", doc: d, email: role !== "vendedor" ? c.email || "" : "", endereco: role !== "vendedor" ? c.endereco || "" : "", obs: role !== "vendedor" ? c.obs || "" : "", atendimento: c.atendimento || null, limite_prazo: c.limite_prazo == null || c.limite_prazo === "" ? null : Number(c.limite_prazo), ativo: true }; CL.push(nc); return nc.id; },
    async clientes() { await ready; needFin(); return CL.map(c => ({ ...c, total_fiado: fiado(c.id), total_recebido: recebido(c.id), saldo: fiado(c.id) - recebido(c.id) })); },
    async clienteExtrato(cid) { await ready; needFin(); const c = CL.find(x => x.id === cid); if (!c) throw new Error("Cliente não encontrado");
      const notas = N.filter(n => n.cliente_id === cid).map(n => { const itens = IT.filter(i => i.nota_id === n.nota_id).map(({ sku, marca, produto, tamanho, qtd, preco_vendido, total }) => ({ sku, marca, produto, tamanho, qtd, preco_vendido, total })); const pags = PG.filter(g => g.nota_id === n.nota_id).map(g => ({ metodo: g.metodo, valor: g.valor })); const prazo = pags.filter(g => g.metodo === "prazo").reduce((a, g) => a + g.valor, 0); const legado = String(n.obs_pagamento || "").startsWith("DÍVIDA ANTERIOR");
        return { nota_id: n.nota_id, numero: String(n.nota_id).padStart(6, "0"), data: n.data, created_at: n.created_at, status: n.status, total: n.total, frete: n.frete || 0, obs_pagamento: n.obs_pagamento, rotulo: legado ? "Dívida anterior" : (itens.length ? "Venda" : "Sem mercadoria"), vendedor: n.handle, prazo, recebido_na_nota: 0, em_aberto: n.status === "ativa" ? prazo : 0, porque: legado ? "Dívida anterior vinculada a este cliente, sem mercadoria. Entra no saldo pelo Paga Depois." : (prazo > 0 ? "Ainda há Paga Depois desta nota sem recebimento suficiente." : "Não há Paga Depois. O que foi pago na hora não fica em Contas a receber."), itens, pagamentos: pags }; });
      const creditos = CR.filter(k => k.cliente_id === cid).map(k => ({ id: k.id, tipo: k.tipo, valor: k.valor, obs: k.obs, nota_id: k.nota_id || null, created_at: k.created_at, conta_no_credito: true }));
      const credito_saldo = creditos.reduce((a, k) => a + (k.tipo === "entrada" ? k.valor : -k.valor), 0);
      const total_prazo = notas.filter(n => n.status === "ativa").reduce((a, n) => a + n.prazo, 0), total_recebido = recebido(cid), saldo = total_prazo - total_recebido;
      return { cliente_id: cid, nome: c.nome, saldo, total_prazo, total_recebido, recebido_vinculado: 0, credito_saldo, explicacao: `Saldo a receber = Paga Depois das notas ativas vinculadas a este cliente (${total_prazo.toFixed(2)}) menos os recebimentos (${total_recebido.toFixed(2)}). O crédito da loja é outra conta e não abate essa dívida.`, historico_sem_vinculo: "Notas antigas só com nome digitado, sem cliente vinculado, não são procuradas nem listadas.", notas, recebimentos: [], creditos }; },
    async adicionarDivida(cli, v0, obs, chave) { await ready; if (role !== "admin") throw new Error("Somente admin"); if (!chave || !/^[A-Za-z0-9._:-]{8,80}$/.test(String(chave))) throw new Error("Informe a chave da dívida"); const parsed = parseValorDivida(v0); if (parsed.error) throw new Error(parsed.error); const v = parsed.value; const prev = DIVK[chave]; if (prev) { if (prev.cliente_id !== cli || prev.valor !== v) throw new Error("Chave já usada em outra dívida"); return { ...prev, idempotente: true, saldo: fiado(cli) - recebido(cli) }; } const c = CL.find(x => x.id === cli); if (!c) throw new Error("Cliente não encontrado"); if (!c.ativo) throw new Error("Cliente inativo"); const est = P.reduce((a, p) => a + p.estoque, 0), cx0 = MV.length, cr0 = CR.length; const nid = id++; const label = ("DÍVIDA ANTERIOR" + (obs && String(obs).trim() ? " — " + String(obs).trim() : "")).slice(0, 200); N.push({ frete: v, caxinha_natal: 0, local_pagamento: null, obs_pagamento: label, cliente_id: cli, nota_id: nid, data: today(), created_at: new Date().toISOString(), cliente: c.nome, status: "ativa", total: v, handle: meU.handle, nome: meU.nome, pagamento: "prazo" }); PG.push({ nota_id: nid, metodo: "prazo", valor: v }); if (P.reduce((a, p) => a + p.estoque, 0) !== est || MV.length !== cx0 || CR.length !== cr0 || IT.some(i => i.nota_id === nid)) throw new Error("Dívida não pode mover estoque, caixa ou crédito"); const out = { nota_id: nid, valor: v, cliente_id: cli, frete: v, saldo: fiado(cli) - recebido(cli), idempotente: false, rotulo: "DÍVIDA ANTERIOR" }; DIVK[chave] = out; return out; },
    async salvarCliente(cid, c) { needFin(); if (c.doc && !docOk(c.doc)) throw new Error("CPF/CNPJ inválido"); const dupN = c && globalThis.BAGDA_CLIENTE_NOME && (c.nome || c.doc || c.telefone) && BAGDA_CLIENTE_NOME.duplicata(CL, c, cid); if (dupN) throw new Error(BAGDA_CLIENTE_NOME.mensagem(dupN)); Object.assign(CL.find(x => x.id === cid), c); },
    async fornecedores() { await ready; needFin(); return FO; },
    async salvarFornecedor(fid, f) { needFin(); if (f.cnpj && !docOk(f.cnpj)) throw new Error("CNPJ inválido"); fid ? Object.assign(FO.find(x => x.id === fid), f) : FO.push({ id: FO.length + 1, ativo: true, ...f }); },
    async contas() { await ready; needFin(); const hj = today(); return CP.map(k => { const p = pago(k.id); return { ...k, fornecedor: (FO.find(f => f.id === k.fornecedor_id) || {}).nome, pago: p, restante: k.valor - p, status: p >= k.valor ? "paga" : k.vencimento < hj ? "vencida" : p > 0 ? "parcial" : "aberta" }; }); },
    async salvarConta(kid, c) { needFin(); kid ? Object.assign(CP.find(x => x.id === kid), c) : CP.push({ id: CP.length + 1, ...c }); },
    async pagarConta(kid, v, cx, forma, data) { needFin(); const k = CP.find(x => x.id === kid); if (pago(kid) + v > k.valor + 0.001) throw new Error("Pagamento maior que o saldo da conta"); CPG.unshift({ id: id++, conta_id: kid, valor: v, caixa_id: cx, forma, data: data || today() }); mov(cx, "saida", v, `Pagamento fornecedor ${(FO.find(f => f.id === k.fornecedor_id) || {}).nome} — conta ${kid}`, null, meU); },
    async contaPagamentos() { needFin(); return CPG; },
    async recebimentos() { needFin(); return RC.map(r => ({ ...r, cliente: CL.find(c => c.id === r.cliente_id).nome, caixa: r.cxesp ? "CAIXA SPECIAL" : r.caixa_id ? CX.find(c => c.caixa_id === r.caixa_id).nome : "Caixa Geral (crédito)", handle: meU.handle })); },
    async cobrancaAlertas() { await ready; needFin(); const PZ = globalThis.BAGDA_PRAZO; const hj = today();
      const notas = N.filter(n => n.status === "ativa" && n.cliente_id).map(n => {
        const prazo = PG.filter(g => g.nota_id === n.nota_id && g.metodo === "prazo").reduce((a, g) => a + g.valor, 0);
        const pago = AL.filter(x => x.nota_id === n.nota_id).reduce((a, x) => a + x.valor, 0);
        const c = CL.find(x => x.id === n.cliente_id) || {};
        return { nota_id: n.nota_id, cliente_id: n.cliente_id, nome: c.nome || n.cliente, em_aberto: Math.round((prazo - pago) * 100) / 100, vencimento: n.vencimento || null, prazo_dias: n.prazo_dias == null ? null : n.prazo_dias };
      });
      return PZ ? PZ.montar({ hoje: hj, notas, clientes: CL }) : { hoje: hj, clientes: [], n_clientes: 0, n_vencidas: 0, n_vence_hoje: 0, n_vence_breve: 0, n_limite: 0 }; },
    async estornarRecebimento(rid, m) { if (meU.role !== "admin") throw new Error("Somente admin pode estornar"); const r = RC.find(x => x.id === rid); if (!r) return { ja_estornado: true };
      const nm = CL.find(c => c.id === r.cliente_id).nome; if (r.cxesp) { if (CXE.some(y => y.estorno_de === r.cxesp)) return { ja_estornado: true }; const ent = CXE.find(y => y.id === r.cxesp), kex = r.excedente ? CR.find(x => x.id === r.excedente) : null; if (kex && kex.valor > crSaldo(r.cliente_id) + 0.001) throw new Error("Crédito do excedente já foi usado"); CXE.push({ id: id++, tipo: "saida", valor: ent ? ent.valor : r.valor, motivo: `Estorno recebimento #${rid} ${nm}: ${m}`, estorno_de: r.cxesp, created_at: new Date().toISOString() }); if (kex) CR.push({ id: id++, cliente_id: r.cliente_id, tipo: "uso", valor: kex.valor, obs: `Estorno excedente recebimento #${rid}: ${m}`, estorno_de: r.excedente, handle: meU.handle, created_at: new Date().toISOString() }); }
      else if (r.forma === "credito") { const u = CR.find(k => k.recebimento_id === rid && k.tipo === "uso"); CR.push({ id: id++, cliente_id: r.cliente_id, tipo: "entrada", valor: r.valor, obs: `Estorno recebimento #${rid}: ${m}`, nota_id: null, estorno_de: u ? u.id : null, handle: meU.handle, created_at: new Date().toISOString() }); }
      else if (r.caixa_id) { mov(r.caixa_id, "saida", r.valor, `Estorno recebimento #${rid} ${nm}: ${m}`, null, meU); MV[MV.length - 1].forma = r.forma; }
      RC.splice(RC.indexOf(r), 1); for (let i = AL.length - 1; i >= 0; i--) if (AL[i].rec === rid) AL.splice(i, 1); return { recebimento_id: rid }; },
    async depEsp() { if (!["admin", "estoque"].includes(meU.role)) throw new Error("Sem permissão"); const A = meU.role === "admin"; if (qs.has("depna")) throw new Error("PGRST205 v_deposito_especial schema cache"); return DE.map(d => { const p = P.find(x => x.sku === d.sku); return { ...d, custo: A ? d.custo : null, marca: p.marca, produto: p.produto, tamanho: p.tamanho, total: A ? d.qtd * d.custo : null, estoque_loja: p.estoque }; }); },
    async depEspMov() { return DEM.map(m => { const p = P.find(x => x.sku === m.sku); return { ...m, custo_unit: meU.role === "admin" ? m.custo_unit : null, marca: p.marca, produto: p.produto, handle: "mb" }; }); },
    async depEspLote(h, itens) { if (!qs.has("lote")) throw new Error("PGRST202 Could not find the function dep_esp_entrada_lote (demo)"); for (const x of itens) await api.depEspEntrada(x.sku, x.qtd, x.custo_unit, h.motivo); return { itens: itens.length }; },
    async depEspEntrada(sku, q, c, m) { if (qs.has("failsku") && sku === qs.get("failsku")) throw new Error("Falha simulada (demo ?failsku)"); if (meU.role !== "admin") throw new Error("Somente admin"); if (!(q > 0)) throw new Error("Quantidade deve ser maior que zero"); let d = DE.find(x => x.sku === sku); if (!d) DE.push(d = { sku, qtd: 0, custo: 0 }); const a = d.qtd; d.custo = Math.round((d.qtd * d.custo + q * c) / (d.qtd + q) * 100) / 100; d.qtd += q; DEM.unshift({ id: id++, sku, tipo: "entrada", qtd: q, qtd_antes: a, qtd_depois: d.qtd, custo_unit: c, motivo: m || "Entrada", created_at: new Date().toISOString() }); return d; },
    async depEspAjuste(sku, q, m) { if (!["admin", "estoque"].includes(meU.role)) throw new Error("Sem permissão"); if (!m || m.length < 3) throw new Error("Informe o motivo"); const d = DE.find(x => x.sku === sku); if (!d) throw new Error("Produto não está no Depósito Especial"); if (!(q >= 0)) throw new Error("Quantidade inválida"); DEM.unshift({ id: id++, sku, tipo: "ajuste", qtd: q - d.qtd, qtd_antes: d.qtd, qtd_depois: q, custo_unit: d.custo, motivo: m, created_at: new Date().toISOString() }); d.qtd = q; return d; },
    async vendaOrigemPronta() { return !qs.has("semorigem"); },
    async depEspTransf(sku, q, dir, m) { if (!["admin", "estoque"].includes(meU.role)) throw new Error("Sem permissão"); if (!(q > 0)) throw new Error("Quantidade deve ser maior que zero"); const p = P.find(x => x.sku === sku); let d = DE.find(x => x.sku === sku); if (!d) DE.push(d = { sku, qtd: 0, custo: K[sku] || 0 }); const a = d.qtd;
      if (dir === "para_loja") { if (d.qtd < q) throw new Error(`Depósito Especial só tem ${d.qtd} un.`); d.qtd -= q; p.estoque += q; } else { if (p.estoque < q) throw new Error(`Loja só tem ${p.estoque} un.`); p.estoque -= q; d.qtd += q; }
      DEM.unshift({ id: id++, sku, tipo: dir, qtd: dir === "para_loja" ? -q : q, qtd_antes: a, qtd_depois: d.qtd, custo_unit: d.custo, motivo: m || (dir === "para_loja" ? "Transferência para a loja" : "Transferência da loja"), created_at: new Date().toISOString() }); return d; },
    async cxEsp() { if (meU.role !== "admin") throw new Error("Somente admin"); let a = 0; return CXE.map(m => ({ ...m, saldo_apos: a += m.tipo === "entrada" ? m.valor : -m.valor, cliente: m.cliente_id ? CL.find(c => c.id === m.cliente_id).nome : null, estornado: CXE.some(x => x.estorno_de === m.id), handle: "mb" })).reverse(); },
    async cxEspEntrada(v, m) { if (meU.role !== "admin") throw new Error("Somente admin"); if (!(v > 0)) throw new Error("Informe um valor maior que zero"); CXE.push({ id: id++, tipo: "entrada", valor: v, motivo: m || "Entrada de dinheiro", created_at: new Date().toISOString() }); },
    async cxEspSaida(v, m, cid) { if (meU.role !== "admin") throw new Error("Somente admin"); if (!(v > 0)) throw new Error("Informe um valor maior que zero"); if (!m || m.length < 3) throw new Error("Informe o motivo / para onde vai o dinheiro"); const sd = CXE.reduce((a, x) => a + (x.tipo === "entrada" ? x.valor : -x.valor), 0); if (v > sd + 0.001) throw new Error(`Saldo da Caixa Especial insuficiente (${brl(sd)})`);
      if (cid && v > crSaldo(cid) + 0.001) throw new Error(`Valor maior que o crédito do cliente (${brl(crSaldo(cid))})`); const mid = id++; let cr = null; if (cid) { cr = id++; CR.push({ id: cr, cliente_id: cid, tipo: "uso", valor: v, obs: `Devolução em dinheiro (Caixa Especial #${mid}): ${m}`, nota_id: null, handle: meU.handle, created_at: new Date().toISOString() }); }
      CXE.push({ id: mid, tipo: "saida", valor: v, motivo: m, cliente_id: cid || null, credito_id: cr, created_at: new Date().toISOString() }); },
    async cxEspEstornar(i, m) { if (meU.role !== "admin") throw new Error("Somente admin"); const x = CXE.find(y => y.id === i); if (CXE.some(y => y.estorno_de === i)) return { ja_estornado: true }; const nid = id++; CXE.push({ id: nid, tipo: x.tipo === "entrada" ? "saida" : "entrada", valor: x.valor, motivo: `Estorno #${i}: ${m}`, cliente_id: x.cliente_id, estorno_de: i, created_at: new Date().toISOString() });
      if (x.credito_id) CR.push({ id: id++, cliente_id: x.cliente_id, tipo: "entrada", valor: x.valor, obs: `Estorno devolução Caixa Especial #${i}: ${m}`, nota_id: null, estorno_de: x.credito_id, handle: meU.handle, created_at: new Date().toISOString() });
      if (x.caixa_mov_id) { const o = MV.find(y => y.id === x.caixa_mov_id); if (o && !o.estorno_de && o.tipo !== "estorno" && !MV.some(y => y.estorno_de === o.id)) { mov(o.caixa_id, o.tipo === "entrada" ? "saida" : "entrada", o.valor, `Estorno mov #${o.id} (transferência Caixa Especial #${i}): ${m}`, null, meU); const nw = MV[MV.length - 1]; nw.estorno_de = o.id; nw.forma = o.forma; CXE.find(y => y.id === nid).caixa_mov_id = nw.id; } }
      return {}; },
    async estornarCredito(kid, m) { if (meU.role !== "admin") throw new Error("Somente admin pode estornar"); const k = CR.find(x => x.id === kid); if (CR.some(x => x.estorno_de === kid)) return { ja_estornado: true };
      if (k.estorno_de) throw new Error("Este lançamento já é um estorno"); if (k.nota_id) throw new Error("Uso ligado à nota: cancele a nota"); if (k.recebimento_id && RC.some(r => r.id === k.recebimento_id)) throw new Error(`Uso ligado ao recebimento #${k.recebimento_id}: estorne em Contas a receber`);
      if (k.tipo === "entrada" && k.valor > crSaldo(k.cliente_id) + 0.001) throw new Error(`Saldo de crédito ficaria negativo (saldo ${brl(crSaldo(k.cliente_id))})`);
      CR.push({ id: id++, cliente_id: k.cliente_id, tipo: k.tipo === "entrada" ? "uso" : "entrada", valor: k.valor, obs: `Estorno lançamento #${kid}: ${m}`, nota_id: null, estorno_de: kid, handle: meU.handle, created_at: new Date().toISOString() });
      if (k.mov_id && !MV.some(x => x.estorno_de === k.mov_id)) { const ent = MV.find(x => x.id === k.mov_id); if (ent) MV.push({ id: id++, caixa_id: ent.caixa_id, caixa: ent.caixa, tipo: "estorno", valor: ent.valor, forma: ent.forma, motivo: `Estorno crédito Caixa Geral: ${m}`, estorno_de: ent.id, handle: meU.handle, nome: meU.nome, created_at: new Date().toISOString(), data: today(), nota_id: null }); }
      return {}; },
    async lancarCreditoCaixa(cid, v, cx, forma, obs, data) { needFin(); if (!(v > 0)) throw new Error("Valor inválido"); const c = CL.find(x => x.id === cid); if (!c) throw new Error("Cliente não encontrado"); const box = CX.find(x => x.caixa_id === cx); if (!box) throw new Error("Caixa inválido"); const f = forma || box.metodo; if (!["dinheiro", "pix", "cartao", "transferencia"].includes(f)) throw new Error("Forma de pagamento inválida"); const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }); if (data && data !== hoje) throw new Error("O caixa grava só a data de hoje"); const antes = AL.length; mov(cx, "entrada", v, "Crédito Caixa Geral " + c.nome, null, meU); const mm = MV[MV.length - 1]; mm.forma = f; const kid = id++; CR.push({ id: kid, cliente_id: cid, tipo: "entrada", valor: v, obs: obs || null, nota_id: null, mov_id: mm.id, caixa: box.nome, handle: meU.handle, created_at: new Date().toISOString() }); if (AL.length !== antes) throw new Error("Crédito no caixa não quita dívida"); return { credito_id: kid, mov_id: mm.id, caixa_id: cx, forma: f, valor: v }; },
    async receberCredito(cli, v, data, obs) { needFin(); const sd = Math.max(fiado(cli) - recebido(cli), 0); if (v > sd + 0.001) throw new Error(`Valor maior que a dívida do cliente (${brl(sd)})`); if (v > crSaldo(cli) + 0.001) throw new Error(`Crédito insuficiente na Caixa Geral (saldo ${brl(crSaldo(cli))})`);
      const rid = id++; RC.unshift({ id: rid, cliente_id: cli, valor: v, caixa_id: null, forma: "credito", data: data || today(), obs }); let rest = v;
      for (const n of N.filter(x => x.cliente_id === cli && x.status === "ativa").sort((a, b) => a.nota_id - b.nota_id)) { if (rest <= 0) break; const open = PG.filter(g => g.nota_id === n.nota_id && g.metodo === "prazo").reduce((a, g) => a + g.valor, 0) - AL.filter(x => x.nota_id === n.nota_id).reduce((a, x) => a + x.valor, 0); if (open <= 0) continue; const a = Math.min(open, rest); AL.push({ nota_id: n.nota_id, valor: a, rec: rid }); rest -= a; }
      CR.push({ id: id++, cliente_id: cli, tipo: "uso", valor: v, obs: `Pagamento Contas a receber (receb. #${rid})`, recebimento_id: rid, nota_id: null, handle: meU.handle, created_at: new Date().toISOString() }); },
    async receber(cli, v0, cx, forma, data, obs) { needFin(); const sd = Math.max(fiado(cli) - recebido(cli), 0), v = Math.min(v0, sd), ex = Math.round((v0 - v) * 100) / 100;
      if (ex > 0) { mov(cx, "entrada", ex, "Crédito Caixa Geral (excedente) " + CL.find(c => c.id === cli).nome, null, meU); const ln = N.filter(x => x.cliente_id === cli).map(x => x.nota_id).sort((a, b) => b - a)[0]; CR.push({ id: id++, cliente_id: cli, tipo: "entrada", valor: ex, obs: v > 0 && ln ? "Excedente pagamento nota " + String(ln).padStart(6, "0") : "Excedente pagamento (sem dívida em aberto)", nota_id: null, handle: meU.handle, created_at: new Date().toISOString() }); }
      if (!(v > 0)) return; RC.unshift({ id: id++, cliente_id: cli, valor: v, caixa_id: cx, forma, data: data || today(), obs }); mov(cx, "entrada", v, "Recebimento cliente " + CL.find(c => c.id === cli).nome, null, meU);
      const mm = MV[MV.length - 1]; mm.forma = forma; mm.cliente = CL.find(c => c.id === cli).nome; let rest = v; const al = [];
      for (const n of N.filter(x => x.cliente_id === cli && x.status === "ativa").sort((a, b) => a.nota_id - b.nota_id)) { if (rest <= 0) break;
        const open = PG.filter(g => g.nota_id === n.nota_id && g.metodo === "prazo").reduce((a, g) => a + g.valor, 0) - AL.filter(x => x.nota_id === n.nota_id).reduce((a, x) => a + x.valor, 0);
        if (open <= 0) continue; const a = Math.min(open, rest); AL.push({ nota_id: n.nota_id, valor: a, rec: RC[0].id }); al.push(String(n.nota_id).padStart(6, "0") + " (" + brl(a) + ")"); rest -= a; }
      mm.notas = al.join(", "); },
    async receberCxesp(cli, v0, forma, data, obs, chave) { if (meU.role !== "admin") throw new Error("Somente admin"); if (!chave || String(chave).length < 8) throw new Error("Informe a chave do recebimento"); if (!["dinheiro", "pix", "cartao", "transferencia"].includes(forma)) throw new Error("Forma de pagamento inválida"); const sig = chave + "|" + cli + "|" + v0 + "|" + forma; if (RC._cx && RC._cx[sig]) return { ...RC._cx[sig], idempotente: true }; const sd = Math.max(fiado(cli) - recebido(cli), 0), v = Math.min(v0, sd), ex = Math.round((v0 - v) * 100) / 100, antes = MV.length; const mid = id++; CXE.push({ id: mid, tipo: "entrada", valor: v0, motivo: "Recebimento cliente " + CL.find(c => c.id === cli).nome, created_at: new Date().toISOString() }); let rid = null, cred = null; if (v > 0) { rid = id++; RC.unshift({ id: rid, cliente_id: cli, valor: v, caixa_id: null, cxesp: mid, forma, data: data || today(), obs }); let rest = v; for (const n of N.filter(x => x.cliente_id === cli && x.status === "ativa").sort((a, b) => a.nota_id - b.nota_id)) { if (rest <= 0) break; const open = PG.filter(g => g.nota_id === n.nota_id && g.metodo === "prazo").reduce((a, g) => a + g.valor, 0) - AL.filter(x => x.nota_id === n.nota_id).reduce((a, x) => a + x.valor, 0); if (open <= 0) continue; const a = Math.min(open, rest); AL.push({ nota_id: n.nota_id, valor: a, rec: rid }); rest -= a; } } if (ex > 0) { cred = id++; CR.push({ id: cred, cliente_id: cli, tipo: "entrada", valor: ex, obs: v > 0 ? "Excedente pagamento" : "Excedente pagamento (sem dívida em aberto)", nota_id: null, handle: meU.handle, created_at: new Date().toISOString() }); if (rid) RC[0].excedente = cred; } if (MV.length !== antes) throw new Error("CAIXA SPECIAL não entra nos caixas do dia"); const res = { recebimento_id: rid, quitado: v, credito: ex, cxesp_id: mid, destino: "cxesp", idempotente: false }; RC._cx = RC._cx || {}; RC._cx[sig] = res; return res; },
    async caixasLista() { needCx(); return CX.filter(c => !c.somente_admin || role === "admin"); },
    async caixasPix() { const P = globalThis.BAGDA_PIX_LOCAIS; if (!P) return []; return P.IDS.map(id => { const row = CX.find(c => c.caixa_id === id); return { caixa_id: id, nome: row ? row.nome : P.FALLBACK[id] }; }); },
    async criarNota(items, pags, cliente, clienteId, local, obs, frete = 0, caxinha = 0, prazoDias = null) { await new Promise(r => setTimeout(r, 400)); if (qs.has("fail")) throw new Error("Falha simulada (demo ?fail=1)"); if (role === "financeiro") throw new Error("Sem permissão para criar nota"); const pixNomes = globalThis.BAGDA_PIX_LOCAIS ? BAGDA_PIX_LOCAIS.valores(CX, false) : [], locaisOk = LOCAIS.concat(pixNomes, meU.role === "admin" ? ["CAIXA ESPECIAL"] : []); if (local ? !locaisOk.includes(local) : pags.some(g => g.metodo !== "prazo" && +g.valor > 0)) throw new Error("Escolha o Local do pagamento");
      if (pags.some(g => g.metodo === "prazo") && (prazoDias == null || prazoDias === "" || !(+prazoDias >= 1 && +prazoDias <= 30))) throw new Error("Informe o prazo (1 a 30 dias) para Paga Depois");
      if (local === "CAIXA GERAL") { if (!clienteId) throw new Error("Caixa Geral exige cliente cadastrado"); const t = Math.round((items.reduce((a, x) => a + x.qtd * x.preco_vendido, 0) + (+frete || 0) + (+caxinha || 0)) * 100) / 100, sd = crSaldo(clienteId); if (t > sd + 0.001) throw new Error(`Crédito insuficiente na Caixa Geral (saldo ${brl(sd)})`);
        const nid = mkNota(items, [{ metodo: "credito", valor: t }], cliente, meU, null, clienteId, local, obs, frete, caxinha, null); CR.push({ id: id++, cliente_id: clienteId, tipo: "uso", valor: t, obs: "Nota " + String(nid).padStart(6, "0"), nota_id: nid, handle: meU.handle, created_at: new Date().toISOString() }); return nid; }
      if (local === "BITLOG CONTAINER" && meU.role !== "admin") throw new Error("Somente admin");
      if (local === "CAIXA ESPECIAL") { if (meU.role !== "admin") throw new Error("Somente admin"); const pago = Math.round(pags.filter(g => g.metodo !== "prazo" && g.metodo !== "credito").reduce((a, g) => a + Number(g.valor), 0) * 100) / 100; if (!(pago > 0)) throw new Error("Nota sem valor para a Caixa Especial"); const antes = MV.length; const nid = mkNota(items, pags, cliente, meU, null, clienteId, local, obs, frete, caxinha, prazoDias); if (MV.length !== antes) throw new Error("CAIXA ESPECIAL não entra nos caixas do dia"); const mid = id++; CXE.push({ id: mid, tipo: "entrada", valor: pago, motivo: "Nota " + String(nid).padStart(6, "0"), nota_id: nid, created_at: new Date().toISOString() }); const n = N.find(x => x.nota_id === nid); n.cxesp_mov = mid; n.caixa_lancada_id = null; n.lancada_em = n.created_at; return nid; }
      if (+caxinha > 0 && qs.has("nocaxinha")) throw new Error("Caxinha d Natal depende de atualização do banco — avise o admin.");
      if (+frete > 0 && qs.has("nofrete")) throw new Error("Frete depende de atualização do banco — avise o admin."); return mkNota(items, pags, cliente, meU, null, clienteId, local, obs, frete, caxinha, prazoDias); },
    async freteDia(d) { if (role !== "admin" && role !== "financeiro") return null; const L = N.filter(n => n.data === d && n.status === "ativa" && !String(n.obs_pagamento || "").startsWith("DÍVIDA ANTERIOR")); return { data: d, frete: L.reduce((a, n) => a + (n.frete || 0), 0), notas: L.filter(n => n.frete > 0).length }; },
    async caxinhaDia(d) { if (role !== "admin" && role !== "financeiro") return null; const L = N.filter(n => n.data === d && n.status === "ativa"); return { data: d, caxinha: L.reduce((a, n) => a + (n.caxinha_natal || 0), 0), notas: L.filter(n => n.caxinha_natal > 0).length }; },
    async notaHead(nid) { return vis().filter(x => x.nota_id === nid); },
    async fretesDia(d) { return vis().filter(n => n.data === d && n.frete > 0).map(n => ({ id: n.nota_id, frete: n.frete })); },
    async caxinhasDia(d) { return vis().filter(n => n.data === d && n.caxinha_natal > 0).map(n => ({ id: n.nota_id, caxinha_natal: n.caxinha_natal })); },
    async notasLancar() { await ready; needFin(); return N.filter(n => n.status === "ativa").map(n => { const liq = {}; MV.filter(m => m.nota_id === n.nota_id).forEach(m => liq[m.caixa_id] = (liq[m.caixa_id] || 0) + (m.tipo === "venda" ? m.valor : m.tipo === "estorno" ? -m.valor : 0));
        return { ...n, valor_caixa: PG.filter(g => g.nota_id === n.nota_id && !["prazo", "credito"].includes(g.metodo)).reduce((a, g) => a + g.valor, 0), pagamentos: PG.filter(g => g.nota_id === n.nota_id).map(g => g.metodo + ":" + g.valor).join("+"), caixa_lancada_id: n.caixa_lancada_id || null, cliente_nome: n.cliente_id ? (CL.find(c => c.id === n.cliente_id) || {}).nome || null : null, valor_prazo: PG.filter(g => g.nota_id === n.nota_id && g.metodo === "prazo").reduce((a, g) => a + g.valor, 0), prazo_lancada_em: n.prazo_lancada_em || null, dispensada_em: n.dispensada_em || null, dispensa_motivo: n.dispensa_motivo || null, dispensada_por: n.dispensada_por || null, tem_movimento: MV.some(m => m.nota_id === n.nota_id), cxesp_lancada: !!n.cxesp_mov, caixas_mov: n.cxesp_mov ? "CAIXA SPECIAL" : Object.entries(liq).filter(([, v]) => v > 0.001).map(([k]) => CX.find(c => c.caixa_id === +k).nome).join(", ") }; }).reverse(); },
    async lancarNota(nid, cx) { needFin(); const n = N.find(x => x.nota_id === nid); if (!n || n.status !== "ativa") throw new Error("Nota cancelada não pode ser lançada"); const P2 = PG.filter(g => g.nota_id === nid && !["prazo", "credito"].includes(g.metodo)); if (!P2.length) throw new Error("Nota sem valor para caixa (Paga Depois / Caixa Geral)");
      if (n.caixa_lancada_id === cx && !n.cxesp_mov) return { mudou: false }; if (n.cxesp_mov) { const ent = CXE.find(x => x.id === n.cxesp_mov); if (ent && !CXE.some(x => x.estorno_de === ent.id)) CXE.push({ id: id++, tipo: "saida", valor: ent.valor, motivo: "Nota transferida", estorno_de: ent.id, nota_id: nid, created_at: new Date().toISOString() }); n.cxesp_mov = null; } const liq = {}; MV.filter(m => m.nota_id === nid).forEach(m => liq[m.caixa_id] = (liq[m.caixa_id] || 0) + (m.tipo === "venda" ? m.valor : m.tipo === "estorno" ? -m.valor : 0)); const nn = String(nid).padStart(6, "0"), nm = CX.find(c => c.caixa_id === cx).nome;
      Object.entries(liq).forEach(([k, v]) => { if (v > 0.001) mov(+k, "estorno", v, `Nota ${nn} transferida para ${nm}`, nid, meU); }); P2.forEach(g => { mov(cx, "venda", g.valor, "Nota " + nn, nid, meU); MV[MV.length - 1].forma = g.metodo; }); n.caixa_lancada_id = cx; return { mudou: true }; },
    async lancarNotaCxesp(nid) { if (meU.role !== "admin") throw new Error("Somente admin"); const n = N.find(x => x.nota_id === nid); if (!n || n.status !== "ativa") throw new Error("Nota cancelada não pode ser lançada"); const P2 = PG.filter(g => g.nota_id === nid && !["prazo", "credito"].includes(g.metodo)); if (!P2.length) throw new Error("Nota sem valor para caixa (Paga Depois / Caixa Geral)"); if (n.cxesp_mov && !CXE.some(x => x.estorno_de === n.cxesp_mov)) return { mudou: false, destino: "cxesp", valor: P2.reduce((a, g) => a + g.valor, 0) }; const liq = {}; MV.filter(m => m.nota_id === nid).forEach(m => liq[m.caixa_id] = (liq[m.caixa_id] || 0) + (m.tipo === "venda" ? m.valor : m.tipo === "estorno" ? -m.valor : 0)); Object.entries(liq).forEach(([k, v]) => { if (v > 0.001) mov(+k, "estorno", v, "Nota transferida para CAIXA SPECIAL", nid, meU); }); const valor = P2.reduce((a, g) => a + Number(g.valor), 0), mid = id++; CXE.push({ id: mid, tipo: "entrada", valor, motivo: "Nota " + String(nid).padStart(6, "0"), nota_id: nid, created_at: new Date().toISOString() }); n.cxesp_mov = mid; n.caixa_lancada_id = null; return { mudou: true, destino: "cxesp", valor, cxesp_id: mid }; },
    async cancelarNotaFin(nid, m) { needFin(); const n = N.find(x => x.nota_id === nid); if (!n || n.status === "cancelada") throw new Error("Nota já cancelada"); if (AL.some(x => x.nota_id === nid)) throw new Error(`Nota ${String(nid).padStart(6, "0")} tem recebimento em Contas a receber — estorne o recebimento antes de cancelar`);
      IT.filter(i => i.nota_id === nid).forEach(devolverItem); const liq = {}; MV.filter(x => x.nota_id === nid).forEach(x => { const k = x.caixa_id + "\t" + (x.forma || ""); liq[k] = (liq[k] || 0) + (x.tipo === "venda" ? x.valor : x.tipo === "estorno" ? -x.valor : 0); });
      Object.entries(liq).forEach(([k, v]) => { if (v > 0.001) { const [cid, forma] = k.split("\t"); mov(+cid, "estorno", v, `Cancelamento nota ${String(nid).padStart(6, "0")}: ${m}`, nid, meU); if (forma) MV[MV.length - 1].forma = forma; } }); if (n.cxesp_mov && !CXE.some(x => x.estorno_de === n.cxesp_mov)) { const ent = CXE.find(x => x.id === n.cxesp_mov); if (ent) CXE.push({ id: id++, tipo: "saida", valor: ent.valor, motivo: `Cancelamento nota ${String(nid).padStart(6, "0")}`, estorno_de: ent.id, nota_id: nid, created_at: new Date().toISOString() }); } Object.assign(n, { status: "cancelada", caixa_lancada_id: null, prazo_lancada_em: null, cxesp_mov: null }); SE.push({ kind: "nota_cancelada_financas", detail: { nota_id: nid, motivo: m } }); return { cancelada: true }; },
    async corrigirPag(nid, pags, cli, m) { needFin(); const n = N.find(x => x.nota_id === nid); if (n.caixa_lancada_id || n.cxesp_mov || MV.some(x => x.nota_id === nid)) throw new Error("Nota já lançada em caixa — não dá para corrigir; cancele e refaça"); if (AL.some(x => x.nota_id === nid)) throw new Error("Nota tem recebimento em Contas a receber — estorne antes");
      if (PG.some(g => g.nota_id === nid && g.metodo === "credito")) throw new Error("Nota paga com crédito da Caixa Geral — cancele e refaça"); const c = cli || n.cliente_id; if (pags.some(g => g.metodo === "prazo") && !c) throw new Error("Paga Depois exige cliente cadastrado");
      for (let i = PG.length - 1; i >= 0; i--) if (PG[i].nota_id === nid) PG.splice(i, 1); pags.forEach(g => PG.push({ nota_id: nid, metodo: g.metodo, valor: g.valor })); Object.assign(n, { cliente_id: c || null, cliente: c ? CL.find(x => x.id === c).nome : n.cliente, local_pagamento: pags.some(g => g.metodo !== "prazo") ? n.local_pagamento : null, prazo_lancada_em: null }); SE.push({ kind: "nota_pag_corrigido", detail: { nota_id: nid, motivo: m } }); return { nota_id: nid }; },
    async dispensarNota(nid, m) { needFin(); const n = N.find(x => x.nota_id === nid); if (!n || n.status !== "ativa") throw new Error("Nota cancelada"); if (n.dispensada_em) return { mudou: false }; Object.assign(n, { dispensada_em: new Date().toISOString(), dispensa_motivo: m || null, dispensada_por: meU.handle }); SE.push({ kind: "nota_dispensada", detail: { nota_id: nid, motivo: m } }); return { mudou: true }; },
    async desfazerDispensa(nid) { needFin(); const n = N.find(x => x.nota_id === nid); if (!n.dispensada_em) return { mudou: false }; Object.assign(n, { dispensada_em: null, dispensa_motivo: null, dispensada_por: null }); SE.push({ kind: "nota_dispensa_desfeita", detail: { nota_id: nid } }); return { mudou: true }; },
    async lancarNotaCG(nid) { needFin(); const n = N.find(x => x.nota_id === nid); if (!n || n.status !== "ativa") throw new Error("Nota cancelada não pode ser lançada"); if (!n.cliente_id) throw new Error("Nota sem cliente cadastrado — não dá para lançar como débito"); const v = PG.filter(g => g.nota_id === nid && g.metodo === "prazo").reduce((a, g) => a + g.valor, 0); if (!(v > 0)) throw new Error("Nota sem parte Paga Depois"); if (n.prazo_lancada_em) return { mudou: false, valor: v }; n.prazo_lancada_em = new Date().toISOString(); SE.push({ kind: "nota_prazo_lancada", detail: { nota_id: nid, cliente_id: n.cliente_id, valor: v } }); return { mudou: true, valor: v }; },
    async notasInfo(ids) { return N.filter(n => ids.includes(n.nota_id)).map(n => ({ id: n.nota_id, local_pagamento: n.local_pagamento, obs_pagamento: n.obs_pagamento, frete: n.frete || 0, caxinha_natal: n.caxinha_natal || 0, prazo_dias: n.prazo_dias == null ? null : n.prazo_dias, vencimento: n.vencimento || null })); },
    async creditos() { await ready; needFin(); return [...new Set(CR.map(k => k.cliente_id))].map(cid => { const c = CL.find(x => x.id === cid), L = CR.filter(k => k.cliente_id === cid && crOk(k)); return { cliente_id: cid, nome: c.nome, telefone: c.telefone, doc: c.doc, total_entradas: L.filter(k => k.tipo === "entrada").reduce((a, k) => a + k.valor, 0), total_usos: L.filter(k => k.tipo === "uso").reduce((a, k) => a + k.valor, 0), saldo: crSaldo(cid), ultimo_mov: L.length ? L[L.length - 1].created_at : null }; }).sort((a, b) => a.nome.localeCompare(b.nome)); },
    async creditoMov(cid) { needFin(); return CR.filter(k => !cid || k.cliente_id === cid).map(k => ({ ...k, cliente: CL.find(c => c.id === k.cliente_id).nome, nota_status: k.nota_id ? (N.find(n => n.nota_id === k.nota_id) || {}).status : null, estornado: CR.some(x => x.estorno_de === k.id) })).reverse(); },
    async lancarCredito(cid, tipo, v, obs) { needFin(); if (!(v > 0)) throw new Error("Informe um valor maior que zero"); if (tipo === "uso" && v > crSaldo(cid) + 0.001) throw new Error(`Valor maior que o crédito do cliente (${brl(crSaldo(cid))})`); CR.push({ id: id++, cliente_id: cid, tipo, valor: v, obs: obs || null, nota_id: null, handle: meU.handle, created_at: new Date().toISOString() }); },
    async cancelarNota(nid, motivo) { if (role !== "admin") throw new Error("Só admin cancela nota"); const n = N.find(x => x.nota_id === nid); if (n.status === "cancelada") throw new Error("Nota já cancelada");
      IT.filter(i => i.nota_id === nid).forEach(devolverItem);
      const liq = {}; MV.filter(m => m.nota_id === nid).forEach(m => liq[m.caixa_id] = (liq[m.caixa_id] || 0) + (m.tipo === "venda" ? m.valor : m.tipo === "estorno" ? -m.valor : 0));
      Object.entries(liq).forEach(([k, v]) => { if (v > 0.001) mov(+k, "estorno", v, `Cancelamento nota ${String(nid).padStart(6, "0")}: ${motivo}`, nid, meU); });
      if (n.cxesp_mov && !CXE.some(x => x.estorno_de === n.cxesp_mov)) { const ent = CXE.find(x => x.id === n.cxesp_mov); if (ent) CXE.push({ id: id++, tipo: "saida", valor: ent.valor, motivo: `Cancelamento nota ${String(nid).padStart(6, "0")}: ${motivo}`, estorno_de: ent.id, nota_id: nid, created_at: new Date().toISOString() }); }
      n.cxesp_mov = null; n.status = "cancelada"; },
    async nota(nid) { const n = vis().find(x => x.nota_id === nid); return n ? IT.filter(i => i.nota_id === nid).map(i => ({ ...n, ...i, estoque_origem: i.origem === "especial" ? "especial" : "principal" })) : []; },
    async notaPag(nid) { return vis().some(x => x.nota_id === nid) ? PG.filter(g => g.nota_id === nid) : []; },
    async notas() { return vis(); },
    async extrato(d) { const ns = vis().filter(n => n.data === d), ids = ns.map(n => n.nota_id), lucro = {}; const itens = IT.filter(i => ids.includes(i.nota_id)).map(i => ({ ...ns.find(n => n.nota_id === i.nota_id), ...i }));
      if (role === "admin") itens.forEach(i => lucro[i.nota_id] = (lucro[i.nota_id] || 0) + i.total - i.qtd * i.custo); const fre = {}, cn = {}; ns.forEach(n => { if (n.frete > 0) fre[n.nota_id] = n.frete; if (n.caxinha_natal > 0) cn[n.nota_id] = n.caxinha_natal; });
      return { itens, pags: PG.filter(g => ids.includes(g.nota_id)), lucro, fre, cn, heads: ns.filter(n => (n.frete > 0 || n.caxinha_natal > 0) && !IT.some(i => i.nota_id === n.nota_id)) }; },
    async caixaSaldos() { await ready; needCx(); return CX.filter(c => !c.somente_admin || role === "admin").map(c => ({ ...c, saldo: role === "admin" || c.caixa_id === 1 ? saldo(c.caixa_id) : null, saldo_visivel_financeiro: c.caixa_id === 1, movimento_hoje: MV.filter(m => m.caixa_id === c.caixa_id && m.data === today()).reduce((a, m) => a + sv(m), 0), movimento_visivel: MV.filter(m => m.caixa_id === c.caixa_id && finVê(m)).reduce((a, m) => a + sv(m), 0) })); },
    async caixaExtrato(d) { needCx(); return MV.filter(m => m.data === d && finVê(m)).sort((a, b) => a.created_at.localeCompare(b.created_at)).map(m => { const n = N.find(x => x.nota_id === m.nota_id); return { ...m, valor_assinado: sv(m), estornado: MV.some(x => x.estorno_de === m.id), cliente: (n && n.cliente) || m.cliente || null }; }); },
    async caixaResumo(c, d) { needCx(); if (role !== "admin" && role !== "financeiro") throw new Error("Sem permissão");
      if (!finCaixa(c) || (role !== "admin" && !finVê({ caixa_id: c, data: d }))) throw new Error("Extrato fora da janela do financeiro");
      const cx = CX.find(x => x.caixa_id === c), mostraSaldo = role === "admin" || c === 1, ini = !mostraSaldo ? null : hxR(c) ? 0 : MV.filter(m => m.caixa_id === c && m.data < d).reduce((a, m) => a + sv(m), 0);
      const mv = MV.filter(m => m.caixa_id === c && m.data === d && finVê(m)).sort((a, b) => a.created_at.localeCompare(b.created_at)).map(m => { const n = N.find(x => x.nota_id === m.nota_id);
        return { id: m.id, hora: new Date(m.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", ""), tipo: m.tipo, valor: m.valor, assinado: sv(m), forma: m.forma || cx.metodo, nota: m.nota_id ? String(m.nota_id).padStart(6, "0") : (m.notas || null), cliente: (n && n.cliente) || m.cliente || null, usuario: m.nome, motivo: m.motivo }; });
      const pf = {}; mv.forEach(m => pf[m.forma] = (pf[m.forma] || 0) + m.assinado); const s = SE.find(x => x.caixa_id === c && x.data === d);
      const fim = ini == null ? null : ini + mv.reduce((a, m) => a + m.assinado, 0);
      return { caixa: cx.nome, data: d, saldo_inicial: ini, saldo_final: fim, sessao: s ? { abertura_valor: s.abertura_valor, aberto_por: meU.nome, aberto_em: new Date(s.aberto_em).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }), fechamento_contado: s.fechamento_contado ?? null, diferenca: role === "admin" ? (s.diferenca ?? null) : null } : null,
        movimentos: mv, por_forma: pf, entradas: mv.filter(m => m.assinado > 0).reduce((a, m) => a + m.valor, 0), saidas: mv.filter(m => m.assinado < 0).reduce((a, m) => a + m.valor, 0) }; },
    async caixaHxDia(d) { if (role !== "admin") throw new Error("Somente admin"); const c = CX.find(x => /HX/.test(x.nome)).caixa_id, r = await api.caixaResumo(c, d); return { ...r, caixa_id: c, total_dia: r.movimentos.reduce((a, m) => a + m.assinado, 0) }; },
    async hxConfig() { if (role !== "admin") throw new Error("Somente admin"); return { hx_fin_ve_passado: HXP }; },
    async hxConfigSet(on) { if (role !== "admin") throw new Error("Somente admin"); const m = HXP !== on; HXP = on; return { hx_fin_ve_passado: on, mudou: m }; },
    async caixaSessoes(d) { needCx(); return SE.filter(x => x.data === d && finVê({ caixa_id: x.caixa_id, data: d })).map(x => role === "admin" ? x : { ...x, abertura_sistema: null, fechamento_sistema: null, diferenca: null }); },
    async caixaFinJanela() { needCx(); if (role === "admin") return { ilimitado: true, mostra_saldo: true, mostra_saldo_caixas: [1], hoje: today(), desde: null, rotulo: "tudo" }; const desde = CX.filter(c => !c.somente_admin).reduce((a, c) => { const k = finCorte(c.caixa_id); return !a || k < a ? k : a; }, null); return { ilimitado: false, mostra_saldo: false, mostra_saldo_caixas: [1], hoje: today(), desde, rotulo: desde === spAdd(today(), -2) ? "últimos 3 dias" : "período liberado" }; },
    async caixaFinLista() { if (role !== "admin") throw new Error("Somente admin"); return FINH.filter(g => !g.revogado_em).map(g => ({ ...g, caixa: g.caixa_id == null ? "Todos os caixas do financeiro" : (CX.find(c => c.caixa_id === g.caixa_id) || {}).nome, ativo: g.ativo && !g.revogado_em && (!g.expira_em || g.expira_em > new Date().toISOString()) })); },
    async caixaFinLiberar(caixa, desde, dias, expira) { if (role !== "admin") throw new Error("Somente admin"); if (caixa && !CX.some(c => c.caixa_id === +caixa && !c.somente_admin)) throw new Error("Caixa inválido para o financeiro"); if (!!desde === !!dias) throw new Error("Informe a data inicial ou o número de dias"); if (dias && dias < 3) throw new Error("A liberação só alarga a janela (mínimo 3 dias)"); const row = { id: id++, caixa_id: caixa ? +caixa : null, desde: desde || null, dias: dias || null, expira_em: expira || null, ativo: true, criado_em: new Date().toISOString(), revogado_em: null }; FINH.unshift(row); return row; },
    async caixaFinRevogar(i) { if (role !== "admin") throw new Error("Somente admin"); const g = FINH.find(x => x.id === +i); if (!g) throw new Error("Liberação não encontrada"); g.ativo = false; g.revogado_em = new Date().toISOString(); return { id: g.id, revogado: true }; },
    async estornarMov(mid, m, cn) { if (meU.role !== "admin") throw new Error("Somente admin pode estornar movimento de caixa"); if (!m || m.trim().length < 3) throw new Error("Informe o motivo do estorno"); const o = MV.find(x => x.id === mid); if (!o) throw new Error("Movimento não encontrado");
      const e = MV.find(x => x.estorno_de === mid); if (e) return { ja_estornado: true, estorno_id: e.id }; if (o.estorno_de || o.tipo === "estorno") throw new Error("Este movimento já é um estorno");
      if (o.tipo === "venda") { const n = N.find(x => x.nota_id === o.nota_id), liq = MV.filter(x => x.nota_id === o.nota_id && x.caixa_id === o.caixa_id).reduce((a, x) => a + (x.tipo === "venda" ? x.valor : x.tipo === "estorno" ? -x.valor : 0), 0);
        if (liq <= 0) throw new Error("Nota sem valor neste caixa"); mov(o.caixa_id, "estorno", liq, `${cn ? "Cancelamento nota" : "Estorno caixa nota"} ${String(o.nota_id).padStart(6, "0")}${cn ? "" : " (volta p/ lançar)"}: ${m}`, o.nota_id, meU);
        if (n) { n.caixa_lancada_id = null; if (cn) { n.status = "cancelada"; IT.filter(i => i.nota_id === n.nota_id).forEach(devolverItem); } } }
      else mov(o.caixa_id, o.tipo === "entrada" ? "saida" : "entrada", o.valor, `Estorno mov #${o.id} (${o.motivo || ""}): ${m}`, null, meU);
      const nw = MV[MV.length - 1]; nw.estorno_de = mid; nw.forma = o.forma;
      const esp = CXE.find(x => x.caixa_mov_id === mid);
      if (esp && !CXE.some(x => x.estorno_de === esp.id)) {
        const sd = CXE.reduce((a, x) => a + (x.tipo === "entrada" ? x.valor : -x.valor), 0);
        if (esp.tipo === "entrada" && esp.valor > sd + 0.001) throw new Error("Saldo da Caixa Especial ficaria negativo");
        CXE.push({ id: id++, tipo: esp.tipo === "entrada" ? "saida" : "entrada", valor: esp.valor, motivo: `Estorno transferência #${esp.id} (mov #${mid}): ${m}`, estorno_de: esp.id, caixa_mov_id: nw.id, created_at: new Date().toISOString() });
        return { estorno_id: nw.id, acao: "transferencia_especial" };
      }
      return { estorno_id: nw.id, acao: o.tipo === "venda" ? (cn ? "nota_cancelada" : "nota_volta_a_lancar") : "manual" }; },
    async caixaLancar(m) { needCx(); if (!m.motivo || m.motivo.trim().length < 3) throw new Error("Informe o motivo"); mov(m.caixa_id, m.tipo, Number(m.valor), m.motivo, null, meU); },
    async transferirCaixa(origem, destino, valor, motivo, esp) {
      needCx();
      const v = Math.round(Number(valor) * 100) / 100, mot = (motivo || "").trim();
      const oEsp = !!(esp && esp.origemEspecial), dEsp = !!(esp && esp.destinoEspecial);
      if (!(v > 0)) throw new Error("Informe um valor maior que zero");
      if (mot.length < 3) throw new Error("Informe o motivo");
      if ((oEsp && dEsp) || (!oEsp && !dEsp && origem === destino)) throw new Error("Escolha caixas diferentes");
      if (oEsp || dEsp) {
        if (meU.role !== "admin") throw new Error("Somente admin pode transferir envolvendo a Caixa Especial");
        const sdEsp = CXE.reduce((a, x) => a + (x.tipo === "entrada" ? x.valor : -x.valor), 0);
        if (oEsp) {
          const d = CX.find(c => c.caixa_id === destino); if (!d) throw new Error("Caixa de destino inválido");
          if (sdEsp + 1e-9 < v) throw new Error("Saldo da Caixa Especial insuficiente");
          mov(destino, "entrada", v, "Transferência de CAIXA ESPECIAL: " + mot, null, meU);
          const ent = MV[MV.length - 1];
          const cxid = id++;
          CXE.push({ id: cxid, tipo: "saida", valor: v, motivo: "Transferência para " + d.nome + ": " + mot, caixa_mov_id: ent.id, created_at: new Date().toISOString() });
          return { origem: "cxesp", destino, valor: v, cxesp_id: cxid, saldo_origem: sdEsp - v, saldo_destino: saldo(destino) };
        }
        const o = CX.find(c => c.caixa_id === origem); if (!o) throw new Error("Caixa de origem inválido");
        if (saldo(origem) + 1e-9 < v) throw new Error("Saldo insuficiente no caixa de origem");
        mov(origem, "saida", v, "Transferência para CAIXA ESPECIAL: " + mot, null, meU);
        const sai = MV[MV.length - 1];
        const cxid = id++;
        CXE.push({ id: cxid, tipo: "entrada", valor: v, motivo: "Transferência de " + o.nome + ": " + mot, caixa_mov_id: sai.id, created_at: new Date().toISOString() });
        return { origem, destino: "cxesp", valor: v, cxesp_id: cxid, saldo_origem: saldo(origem), saldo_destino: sdEsp + v };
      }
      const o = CX.find(c => c.caixa_id === origem), d = CX.find(c => c.caixa_id === destino);
      if (!o || !d || ((o.somente_admin || d.somente_admin) && role !== "admin")) throw new Error("Caixa inválido");
      if (saldo(origem) + 1e-9 < v) throw new Error("Saldo insuficiente no caixa de origem");
      mov(origem, "saida", v, "Transferência para " + d.nome + ": " + mot, null, meU);
      mov(destino, "entrada", v, "Transferência de " + o.nome + ": " + mot, null, meU);
      return { origem, destino, valor: v, saldo_origem: saldo(origem), saldo_destino: saldo(destino) };
    },
    async pontoMinhaFace() { const f = PONTOfaces.find(x => x.user_id === meU.id); return f ? { ...f } : null; },
    async pontoFacesDemo() { return PONTOfaces.map(x => ({ ...x })); },
    async pontoMeusRegistros() { return PONTOregs.filter(r => r.user_id === meU.id && !r.excluido).map(r => ({ ...r })); },
    async pontoRegistrosMes(ym) { if (role !== "admin") throw new Error("Só o administrador vê o espelho de todos"); return PONTOregs.filter(r => !r.excluido && String(r.data_sp).startsWith(ym)).map(r => ({ ...r })); },
    async pontoJornadas() { return PONTOjor.map(x => ({ ...x })); },
    async pontoTotens() { return PONTOtotem.map(x => ({ ...x })); },
    async pontoFalhas() { if (role !== "admin") throw new Error("Só o administrador vê as falhas"); return PONTOfalhas.map(x => ({ ...x, nome: (U.find(u => u.id === x.user_id) || {}).nome })); },
    async pontoSouTotem() { return role === "admin" || role === "totem" || PONTOtotem.some(t => t.user_id === meU.id); },
    async pontoUploadFoto(path) { return path; },
    async pontoCadastrarFace(desc, path, consent, texto, uid) {
      if (!consent || !(texto || "").trim() || (texto || "").trim().length < 20) throw new Error("É preciso aceitar o termo de consentimento (LGPD)");
      const alvo = uid || meU.id;
      if (alvo !== meU.id && role !== "admin") throw new Error("Só o administrador cadastra o rosto de outra pessoa");
      if (!Array.isArray(desc) || desc.length !== 128) throw new Error("Descritor facial inválido");
      const row = { user_id: alvo, descriptor: desc.slice(), foto_path: path, consentimento_em: new Date().toISOString(), consentimento_texto: texto, cadastrado_em: new Date().toISOString(), cadastrado_por: meU.id };
      const i = PONTOfaces.findIndex(x => x.user_id === alvo);
      if (i >= 0) PONTOfaces[i] = row; else PONTOfaces.push(row);
      return { ok: true, user_id: alvo };
    },
    async pontoExcluirFace(uid, mot) {
      if ((uid || meU.id) !== meU.id && role !== "admin") throw new Error("Sem permissão");
      if (!(mot || "").trim() || (mot || "").trim().length < 3) throw new Error("Informe o motivo");
      const i = PONTOfaces.findIndex(x => x.user_id === (uid || meU.id));
      if (i >= 0) PONTOfaces.splice(i, 1);
      PONTOaudit.push({ acao: "excluir", motivo: "Cadastro facial: " + mot, user_id: meU.id, at: new Date().toISOString() });
      return { ok: true };
    },
    async registrarPonto(tipo, desc, path, ua, lat, lng) {
      if (role === "totem") throw new Error("No totem, use registrar_ponto_totem");
      const face = PONTOfaces.find(x => x.user_id === meU.id);
      if (!face) throw new Error("Cadastre seu rosto antes de bater ponto");
      const score = distDemo(desc, face.descriptor);
      if (score > limiarDemo) {
        PONTOfalhas.push({ user_id: meU.id, tipo, foto_path: path, score, motivo: "Rosto não confere com o cadastro", user_agent: ua, latitude: lat, longitude: lng, origem: "app", criado_em: new Date().toISOString(), criado_por: meU.id });
        return { ok: false, motivo: "Rosto não confere com o cadastro. O ponto não foi registrado.", score };
      }
      const d = todaySP();
      if (PONTOregs.some(r => r.user_id === meU.id && r.data_sp === d && r.tipo === tipo && !r.excluido)) throw new Error("Este tipo de ponto já foi registrado hoje");
      const row = { id: pontoId++, user_id: meU.id, handle: meU.handle, nome: meU.nome, tipo, registrado_em: new Date().toISOString(), data_sp: d, foto_path: path, score, match_ok: true, user_agent: ua, latitude: lat, longitude: lng, origem: "app", excluido: false };
      PONTOregs.push(row);
      return { ok: true, id: row.id, tipo, score, registrado_em: row.registrado_em };
    },
    async registrarPontoTotem(tipo, desc, path, ua, lat, lng) {
      if (role !== "admin" && role !== "totem" && !PONTOtotem.some(t => t.user_id === meU.id)) throw new Error("Sem permissão de totem");
      let best = null, score = Infinity;
      for (const f of PONTOfaces) { const s = distDemo(desc, f.descriptor); if (s < score) { score = s; best = f; } }
      if (!best || score > limiarDemo) {
        PONTOfalhas.push({ user_id: best && best.user_id, tipo, foto_path: path, score: Number.isFinite(score) ? score : null, motivo: "Nenhum rosto cadastrado conferiu", user_agent: ua, latitude: lat, longitude: lng, origem: "totem", criado_em: new Date().toISOString(), criado_por: meU.id });
        return { ok: false, motivo: "Rosto não reconhecido. O ponto não foi registrado.", score };
      }
      const u = U.find(x => x.id === best.user_id) || { nome: "Colaborador", handle: "", id: best.user_id };
      const d = todaySP();
      if (PONTOregs.some(r => r.user_id === u.id && r.data_sp === d && r.tipo === tipo && !r.excluido)) throw new Error("Este tipo de ponto já foi registrado hoje para esta pessoa");
      const row = { id: pontoId++, user_id: u.id, handle: u.handle, nome: u.nome, tipo, registrado_em: new Date().toISOString(), data_sp: d, foto_path: path, score, match_ok: true, user_agent: ua, latitude: lat, longitude: lng, origem: "totem", excluido: false };
      PONTOregs.push(row);
      return { ok: true, id: row.id, user_id: u.id, nome: u.nome, tipo, score, registrado_em: row.registrado_em };
    },
    async pontoEditarRegistro(id, tipo, mot) { if (role !== "admin") throw new Error("Só o administrador altera um ponto"); if (!(mot || "").trim() || mot.trim().length < 3) throw new Error("Informe o motivo"); const r = PONTOregs.find(x => x.id === id && !x.excluido); if (!r) throw new Error("Registro não encontrado"); PONTOaudit.push({ registro_id: id, acao: "editar", motivo: mot, antes: { tipo: r.tipo }, depois: { tipo }, user_id: meU.id, at: new Date().toISOString() }); r.tipo = tipo; return { ok: true, id }; },
    async pontoExcluirRegistro(id, mot) { if (role !== "admin") throw new Error("Só o administrador exclui um ponto"); if (!(mot || "").trim() || mot.trim().length < 3) throw new Error("Informe o motivo"); const r = PONTOregs.find(x => x.id === id && !x.excluido); if (!r) throw new Error("Registro não encontrado"); r.excluido = true; PONTOaudit.push({ registro_id: id, acao: "excluir", motivo: mot, user_id: meU.id, at: new Date().toISOString() }); return { ok: true, id }; },
    async pontoSetJornada(uid, e, s, a, dias, tol) { if (role !== "admin") throw new Error("Só o administrador define a jornada"); if (!e || !s || s <= e) throw new Error("Jornada inválida"); const row = { user_id: uid, entrada: e, saida: s, almoco_minutos: a, dias_semana: dias || [1, 2, 3, 4, 5], tolerancia_minutos: tol == null ? 10 : tol }; const i = PONTOjor.findIndex(x => x.user_id === uid); if (i >= 0) PONTOjor[i] = row; else PONTOjor.push(row); return { ok: true }; },
    async pontoSetTotem(uid, on, nome) { if (role !== "admin") throw new Error("Só o administrador define o totem"); const i = PONTOtotem.findIndex(x => x.user_id === uid); if (on) { const row = { user_id: uid, nome: nome || "Totem loja" }; if (i >= 0) PONTOtotem[i] = row; else PONTOtotem.push(row); } else if (i >= 0) PONTOtotem.splice(i, 1); return { ok: true }; },
    async caixaAbrir(c, v) { needCx(); if (SE.some(x => x.caixa_id === c && x.data === today())) throw new Error("Caixa já aberto hoje"); SE.push({ caixa_id: c, data: today(), abertura_valor: v, abertura_sistema: saldo(c), aberto_em: new Date().toISOString() }); },
    async caixaFechar(c, v) { needCx(); const x = SE.find(y => y.caixa_id === c && y.data === today() && !y.fechado_em); if (!x) throw new Error("Caixa não está aberto hoje (ou já foi fechado)"); Object.assign(x, { fechamento_contado: v, fechamento_sistema: saldo(c), diferenca: v - saldo(c), fechado_em: new Date().toISOString() }); return x.diferenca; },
    async usuarios() { return role === "admin" ? U : []; },
    async salvarUsuario(uid, u) { if (role !== "admin") throw new Error("Só admin"); Object.assign(U.find(x => x.id === uid), u); },
    async adminProducts() { return role === "admin" ? P.map(p => ({ ...p, custo: K[p.sku] })) : []; },
    async compraLote(h, itens) { if (!qs.has("lote")) throw new Error("PGRST202 Could not find the function public.registrar_compra_lote (demo sem ?lote=1)"); const lote = "demo-" + Date.now(); for (const x of itens) await api.addPurchase({ ...x, fornecedor: h.fornecedor, observacao: h.observacao, compra_lote: lote }); const c = PU[0].compra_id; return { lote, itens: itens.length, compra_id: c, numero: cnum(c) }; },
    async compraOrigem(h, itens) { if (role !== "admin") throw new Error("Só admin registra compra"); const lote = "demo-" + Date.now(); for (const x of itens) await api.addPurchase({ ...x, fornecedor: h.fornecedor, observacao: h.observacao, compra_lote: lote }); const c = PU[0].compra_id; return { lote, itens: itens.length, compra_id: c, numero: cnum(c), origem_ok: true }; },
    async compraPagamento(h, itens) {
      if (role !== "admin") throw new Error("Só admin registra compra");
      const pag = String(h.pagamento || "").toLowerCase();
      if (pag !== "agora" && pag !== "depois" && pag !== "divida") throw new Error("Escolha a forma de pagamento");
      if (pag === "divida" && role !== "admin") throw new Error("Só admin lança dívida no caixa especial");
      if (pag === "depois" && h.vencimento && !/^\d{4}-\d{2}-\d{2}$/.test(h.vencimento)) throw new Error("Vencimento inválido");
      if ((pag === "depois" || pag === "divida") && h.pagar_em && !/^\d{4}-\d{2}-\d{2}$/.test(h.pagar_em)) throw new Error("Data de pagar em inválida");
      const OPX = globalThis.BAGDA_ORIGEM;
      let total = 0;
      for (const p of itens) {
        let custo = Number(p.custo_unit);
        if (p.origem === "Importado") {
          if (!(Number(p.taxa_dolar) > 0)) throw new Error("Item importado precisa da taxa do dólar desta compra");
          const cr = OPX.custoReaisDeUsd(p.custo_usd, p.taxa_dolar);
          if (cr.error) throw new Error(cr.error);
          custo = cr.value;
        } else if (!(custo >= 0)) throw new Error("Item: custo inválido");
        total += (+p.qtd) * custo;
      }
      total = Math.round(total * 100) / 100;
      let cx = null;
      if ((pag === "agora" || pag === "divida") && total > 0) {
        cx = CX.find(c => c.caixa_id === +h.caixa_id && c.ativo !== false && (!c.somente_admin || role === "admin"));
        if (!cx) throw new Error("Caixa inválido");
        if (pag === "divida" && !cx.somente_admin) throw new Error("Dívida só no caixa especial");
        const s = Math.round(saldo(cx.caixa_id) * 100) / 100;
        if (pag === "agora" && total > s + 0.001) throw new Error("Saldo insuficiente no caixa (R$ " + s.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ")");
      }
      const lote = "demo-" + Date.now();
      for (const x of itens) await api.addPurchase({ ...x, fornecedor: h.fornecedor, observacao: h.observacao, compra_lote: lote, ...(h.data ? { data: h.data } : {}) });
      const c = PU[0].compra_id, numero = cnum(c);
      const tot = Math.round(PU.filter(p => p.compra_id === c).reduce((a, p) => a + Number(p.total), 0) * 100) / 100;
      const temImp = itens.some(x => x.origem === "Importado");
      const taxa = temImp ? Number(itens.find(x => x.origem === "Importado").taxa_dolar) : null;
      COMP.push({ id: c, numero, data: h.data || today(), fornecedor: h.fornecedor || null, pagamento: pag, vencimento: pag === "depois" ? (h.vencimento || null) : null, pagar_em: pag === "agora" ? null : (h.pagar_em || null), taxa_dolar: taxa, cambio_pago: pag === "agora" && temImp ? taxa : null, data_pagamento: pag === "agora" && temImp ? (h.data || today()) : null, total: tot });
      if ((pag === "agora" || pag === "divida") && tot > 0) {
        mov(cx.caixa_id, "saida", tot, (pag === "divida" ? "Dívida " : "") + "Compra " + numero + " — " + (h.fornecedor || "fornecedor"), null, meU);
        CPAGTO.push({ id: id++, compra_id: c, valor: tot, data: today(), caixa_id: cx.caixa_id, caixa: cx.nome, somente_admin: !!cx.somente_admin });
      }
      recalcImportados();
      return { lote, itens: itens.length, compra_id: c, numero, total: tot, origem_ok: true, pagamento_ok: true, pagamento: pag };
    },
    async comprasCaixas() {
      await ready; if (role !== "admin") throw new Error("Somente admin");
      return CX.filter(c => c.ativo !== false && (!c.somente_admin || role === "admin")).map(c => ({ caixa_id: c.caixa_id, nome: c.nome, metodo: c.metodo, somente_admin: !!c.somente_admin, saldo: Math.round(saldo(c.caixa_id) * 100) / 100 }));
    },
    async comprasPendentes() {
      await ready; if (role !== "admin") throw new Error("Somente admin");
      const hj = today(), cot = (COT[0] || {}).valor || null;
      const rows = COMP.filter(c => c.pagamento === "agora" || c.pagamento === "depois" || c.pagamento === "divida").map(c => {
        const lines = PU.filter(p => p.compra_id === c.id);
        const usd = Math.round(lines.filter(p => p.origem === "Importado" && p.custo_usd != null).reduce((a, p) => a + p.qtd * Number(p.custo_usd), 0) * 100) / 100;
        const nac = Math.round(lines.filter(p => p.origem !== "Importado").reduce((a, p) => a + p.qtd * Number(p.custo_unit), 0) * 100) / 100;
        const flutuante = usd > 0 && c.cambio_pago == null && (c.pagamento === "depois" || c.pagamento === "divida");
        const rate = c.cambio_pago != null ? Number(c.cambio_pago) : (flutuante ? cot : null);
        const total = usd > 0 && rate ? Math.round((nac + Math.round(usd * rate * 100) / 100) * 100) / 100 : (lines.length ? Math.round((nac + lines.filter(p => p.origem === "Importado").reduce((a, p) => a + Number(p.total), 0)) * 100) / 100 : Number(c.total));
        const pags = CPAGTO.filter(p => p.compra_id === c.id).map(p => { const hide = !!(p.somente_admin && role !== "admin"); return { id: p.id, valor: p.valor, data: p.data, caixa: hide ? null : p.caixa, caixa_id: hide ? null : p.caixa_id, caixa_oculto: hide }; });
        const pago = Math.round(pags.reduce((a, p) => a + Number(p.valor), 0) * 100) / 100;
        const restante = Math.round((total - pago) * 100) / 100;
        const aberta = (c.pagamento === "depois" && restante > 0.009) || (c.pagamento === "divida" && flutuante);
        return { ...c, fornecedor: c.fornecedor || "Sem fornecedor", total_usd: usd || null, total_nacional: nac, flutuante, total, pago, restante, atrasada: !!(c.vencimento && c.vencimento < hj && aberta), aberta, devido: c.pagamento === "divida" && flutuante ? total : restante, pagamentos: pags };
      });
      const grupos = new Map();
      rows.filter(r => r.aberta).sort((a, b) => (b.atrasada - a.atrasada) || String(a.pagar_em || "9999-99-99").localeCompare(String(b.pagar_em || "9999-99-99")) || String(a.vencimento || "9999").localeCompare(String(b.vencimento || "9999"))).forEach(r => {
        const g = grupos.get(r.fornecedor) || { fornecedor: r.fornecedor, total_devido: 0, compras: [] };
        g.compras.push(r); g.total_devido = Math.round((g.total_devido + r.devido) * 100) / 100; grupos.set(r.fornecedor, g);
      });
      return { grupos: [...grupos.values()].sort((a, b) => a.fornecedor.localeCompare(b.fornecedor, "pt-BR")), pagas: rows.filter(r => !r.aberta).sort((a, b) => b.id - a.id).slice(0, 40), cotacao: cot };
    },
    async compraPagar(cid, valor, caixa, cambio, data) {
      await ready; if (role !== "admin") throw new Error("Somente admin");
      const c = COMP.find(x => x.id === +cid);
      if (!c || (c.pagamento !== "agora" && c.pagamento !== "depois" && c.pagamento !== "divida")) throw new Error("Compra antiga sem controle de pagamento");
      const lines = PU.filter(p => p.compra_id === c.id);
      const usd = Math.round(lines.filter(p => p.origem === "Importado" && p.custo_usd != null).reduce((a, p) => a + p.qtd * Number(p.custo_usd), 0) * 100) / 100;
      const flutuante = usd > 0 && c.cambio_pago == null && (c.pagamento === "depois" || c.pagamento === "divida");
      if (flutuante) {
        const parsed = globalThis.BAGDA_ORIGEM.parseCotacao(cambio);
        if (parsed.error) throw new Error("Câmbio pago inválido");
        const quando = data || today();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(quando) || quando > today()) throw new Error("Data do pagamento inválida");
        const nac = Math.round(lines.filter(p => p.origem !== "Importado").reduce((a, p) => a + p.qtd * Number(p.custo_unit), 0) * 100) / 100;
        const total = Math.round((nac + Math.round(usd * parsed.value * 100) / 100) * 100) / 100;
        const pago = CPAGTO.filter(p => p.compra_id === c.id).reduce((a, p) => a + Number(p.valor), 0);
        lines.filter(p => p.origem === "Importado").forEach(p => { const u = BAGDA_ORIGEM.custoReaisDeUsd(p.custo_usd, parsed.value); if (u.error) throw new Error(u.error); p.custo_unit = u.value; p.total = Math.round(p.qtd * u.value * 100) / 100; });
        c.cambio_pago = parsed.value; c.data_pagamento = quando; c.total = total;
        if (c.pagamento === "divida") {
          const row = CPAGTO.filter(p => p.compra_id === c.id);
          if (row.length !== 1) throw new Error("Dívida sem um único lançamento no caixa");
          const delta = Math.round((total - pago) * 100) / 100;
          const cx = CX.find(x => x.caixa_id === row[0].caixa_id);
          if (!cx || !cx.somente_admin) throw new Error("Dívida só no caixa especial");
          if (delta > 0.001) { mov(cx.caixa_id, "saida", delta, "Ajuste câmbio Compra " + c.numero + " — " + (c.fornecedor || "fornecedor"), null, meU); MV[MV.length - 1].data = quando; }
          else if (delta < -0.001) { mov(cx.caixa_id, "entrada", -delta, "Ajuste câmbio Compra " + c.numero + " — " + (c.fornecedor || "fornecedor"), null, meU); MV[MV.length - 1].data = quando; }
          row[0].valor = total; row[0].data = quando;
        } else {
          const debito = Math.round((total - pago) * 100) / 100;
          if (debito < -0.009) throw new Error("O câmbio deixa o total menor do que já foi pago");
          if (debito > 0.001) {
            const cx = CX.find(x => x.caixa_id === +caixa && x.ativo !== false && (!x.somente_admin || role === "admin"));
            if (!cx) throw new Error("Caixa inválido");
            const s = Math.round(saldo(cx.caixa_id) * 100) / 100;
            if (debito > s + 0.001) throw new Error("Saldo insuficiente no caixa (R$ " + s.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ")");
            mov(cx.caixa_id, "saida", debito, "Compra " + c.numero + " — " + (c.fornecedor || "fornecedor"), null, meU);
            if (quando) MV[MV.length - 1].data = quando;
            CPAGTO.push({ id: id++, compra_id: c.id, valor: debito, data: quando, caixa_id: cx.caixa_id, caixa: cx.nome, somente_admin: !!cx.somente_admin });
          }
        }
        recalcImportados();
        return { valor: Math.round((total - pago) * 100) / 100, total, cambio_pago: parsed.value, data_pagamento: quando, restante: 0, travado: true };
      }
      if (c.pagamento === "divida") throw new Error("Compra antiga sem controle de pagamento");
      valor = Math.round(Number(valor) * 100) / 100;
      if (!(valor > 0)) throw new Error("Valor inválido");
      const pago = CPAGTO.filter(p => p.compra_id === c.id).reduce((a, p) => a + Number(p.valor), 0);
      const rest = Math.round((Number(c.total) - pago) * 100) / 100;
      if (valor > rest + 0.001) throw new Error("Pagamento maior que o saldo da compra (R$ " + rest.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ")");
      const cx = CX.find(x => x.caixa_id === +caixa && x.ativo !== false && (!x.somente_admin || role === "admin"));
      if (!cx) throw new Error("Caixa inválido");
      const s = Math.round(saldo(cx.caixa_id) * 100) / 100;
      if (valor > s + 0.001) throw new Error("Saldo insuficiente no caixa (R$ " + s.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ")");
      mov(cx.caixa_id, "saida", valor, "Compra " + c.numero + " — " + (c.fornecedor || "fornecedor"), null, meU);
      CPAGTO.push({ id: id++, compra_id: c.id, valor, data: today(), caixa_id: cx.caixa_id, caixa: cx.nome, somente_admin: !!cx.somente_admin });
      return { pagamento_id: CPAGTO[CPAGTO.length - 1].id, valor, restante: Math.round((rest - valor) * 100) / 100, saldo_caixa: Math.round(saldo(cx.caixa_id) * 100) / 100, caixa: cx.nome };
    },
    async compraAgendar(cid, quando) {
      await ready; if (role !== "admin") throw new Error("Somente admin");
      const c = COMP.find(x => x.id === +cid);
      if (!c || (c.pagamento !== "depois" && c.pagamento !== "divida") || c.cambio_pago != null) throw new Error("Só dá para agendar uma compra ainda não paga");
      if (quando && !/^\d{4}-\d{2}-\d{2}$/.test(quando)) throw new Error("Data de pagar em inválida");
      c.pagar_em = quando || null;
      return { id: c.id, pagar_em: c.pagar_em };
    },
    async custosLoja() { await ready; if (role !== "admin") throw new Error("Somente admin"); return Object.keys(K).map(sku => ({ sku, custo: K[sku], ...situacaoSku(sku) })); },
    async cotacaoLer() { if (role !== "admin") throw new Error("Sem permissão"); const c = COT[0]; return { valor: c ? c.valor : null, alterado_em: c ? c.alterado_em : null, handle: c ? c.handle : null, nome: c ? c.nome : null, historico: COT.map(x => ({ ...x })) }; },
    async cotacaoSalvar(valor) { if (role !== "admin") throw new Error("Só admin altera a cotação"); const parsed = globalThis.BAGDA_ORIGEM.parseCotacao(valor); if (parsed.error) throw new Error(parsed.error); COT.unshift({ valor: parsed.value, alterado_em: new Date().toISOString(), handle: meU.handle, nome: meU.nome }); recalcImportados(); const costs = {}; P.forEach(p => { const lots = lotesSku(p.sku); costs[p.sku] = { custo: K[p.sku], custo_usd: p.custo_usd, lotes: lots.length ? lots : undefined }; }); const r = BAGDA_ORIGEM.aplicarCotacao(P, costs, parsed.value); r.products.forEach((p, i) => { if (p.error) throw new Error(p.error); if (!lotesSku(p.sku).length) { P[i].preco_venda = p.preco_venda; if (P[i].origem === "Importado" && P[i].custo_usd != null && r.costs[p.sku]) K[p.sku] = r.costs[p.sku].custo; } }); return api.cotacaoLer(); },
    async recalcularImportado(sku) { if (role !== "admin") throw new Error("Só admin altera origem ou preço em US$"); const p = P.find(x => x.sku === sku); if (!p || p.origem !== "Importado" || !(Number(p.preco_usd) > 0)) return; const calc = BAGDA_ORIGEM.precoReaisImportado(p.preco_usd, (COT[0] || {}).valor, K[sku] != null ? K[sku] : null); if (calc.error) throw new Error(calc.error); p.preco_venda = calc.preco; },
    async comprasListar(q) { if (role === "vendedor") throw new Error("Sem permissão"); const A = role === "admin"; const G = new Map(); [...PU].reverse().forEach(p => { const g = G.get(p.compra_id) || { id: p.compra_id, numero: cnum(p.compra_id), data: p.data, fornecedor: p.fornecedor, observacao: p.observacao, itens: 0, unidades: 0, total: 0, imeis: 0, recebidos: 0, _h: "" }; g.itens++; g.unidades += p.qtd; g.total += p.total; g.imeis += IM.filter(i => i.purchase_id === p.id).length; g.recebidos += recb(p); const x = P.find(y => y.sku === p.sku); g._h += ` ${p.sku} ${x.marca} ${x.produto}`; G.set(p.compra_id, g); });
      q = norm(q || ""); return [...G.values()].filter(g => !q || norm(`${g.numero} ${g.fornecedor} ${g._h}`).includes(q)).map(g => ({ ...g, total: A ? g.total : null, status: g.recebidos >= g.unidades ? "completo" : "pendente" })).sort((a, b) => b.id - a.id); },
    async compraDetalhe(n) { if (role === "vendedor") throw new Error("Sem permissão"); const A = role === "admin"; const cid = +String(n).replace(/\D/g, ""), L = PU.filter(p => p.compra_id === cid).sort((a, b) => a.id - b.id); if (!L.length) throw new Error(`Compra ${n} não encontrada`);
      return { id: cid, numero: cnum(cid), data: L[0].data, created_at: L[0].created_at || new Date().toISOString(), fornecedor: L[0].fornecedor, observacao: L[0].observacao, itens: L.map(p => { const x = P.find(y => y.sku === p.sku); return { purchase_id: p.id, sku: p.sku, marca: x.marca, produto: x.produto, tamanho: x.tamanho, qtd: p.qtd, custo_unit: A ? p.custo_unit : null, total: A ? p.total : null, recebido_sem_imei: p.rsi || 0, recebidos: recb(p), status: recb(p) >= p.qtd ? "completo" : "pendente", imeis: IM.filter(i => i.purchase_id === p.id).sort((a, b) => a.slot - b.slot) }; }), get total() { return A ? L.reduce((a, p) => a + p.total, 0) : null; }, get status() { return this.itens.some(i => i.status === "pendente") ? "pendente" : "completo"; } }; },
    async imeiSalvar(pid, slots) { if (!["admin", "estoque"].includes(role)) throw new Error("Só admin ou estoque cadastra IMEI"); const pu = PU.find(p => p.id === pid); let ok = 0, rm = 0;
      for (const s of slots) { const a = String(s.imei1 || "").replace(/\D/g, ""), b = String(s.imei2 || "").replace(/\D/g, "") || null; if (s.slot < 1 || s.slot > pu.qtd) throw new Error(`Unidade ${s.slot} fora da quantidade comprada (${pu.qtd})`);
        const k = IM.findIndex(i => i.purchase_id === pid && i.slot === s.slot); if (!a) { if (b) throw new Error(`Unidade ${s.slot}: IMEI 1 é obrigatório`); if (k >= 0) { IM.splice(k, 1); rm++; } continue; }
        if (!/^\d{15}$/.test(a) || (b && !/^\d{15}$/.test(b))) throw new Error(`Unidade ${s.slot}: IMEI precisa ter 15 dígitos`); if (a === b) throw new Error(`Unidade ${s.slot}: IMEI 1 e IMEI 2 iguais`);
        const d = IM.find(i => !(i.purchase_id === pid && i.slot === s.slot) && [i.imei1, i.imei2].some(v => v && (v === a || v === b))); if (d) throw new Error(`IMEI já cadastrado na compra ${cnum(PU.find(p => p.id === d.purchase_id).compra_id)} (unidade ${d.slot})`);
        if (k >= 0) Object.assign(IM[k], { imei1: a, imei2: b }); else IM.push({ purchase_id: pid, slot: s.slot, imei1: a, imei2: b }); ok++; }
      return { salvos: ok, removidos: rm }; },
    async imeiBuscar(q) { if (role === "vendedor") throw new Error("Sem permissão"); q = String(q).replace(/\D/g, ""); if (q.length < 4) throw new Error("Digite pelo menos 4 dígitos do IMEI");
      return IM.filter(i => i.imei1.includes(q) || (i.imei2 || "").includes(q)).map(i => { const p = PU.find(x => x.id === i.purchase_id), x = P.find(y => y.sku === p.sku); return { ...i, numero: cnum(p.compra_id), compra_id: p.compra_id, data: p.data, fornecedor: p.fornecedor, sku: p.sku, marca: x.marca, produto: x.produto, tamanho: x.tamanho, custo_unit: role === "admin" ? p.custo_unit : null, qtd: p.qtd }; }); },
    async imeiBaixar(pid, a, b) { if (!["admin", "estoque"].includes(role)) throw new Error("Sem permissão"); const pu = PU.find(p => p.id === pid); a = String(a || "").replace(/\D/g, ""); b = String(b || "").replace(/\D/g, "") || null; if (!/^\d{15}$/.test(a) || (b && !/^\d{15}$/.test(b))) throw new Error("IMEI precisa ter 15 dígitos"); if (a === b) throw new Error("IMEI 1 e IMEI 2 iguais");
      const d = IM.find(i => [i.imei1, i.imei2].some(v => v && (v === a || v === b))); if (d) throw new Error(`IMEI já cadastrado na compra ${cnum(PU.find(p => p.id === d.purchase_id).compra_id)} (unidade ${d.slot})`); if (recb(pu) >= pu.qtd) throw new Error(`Item já completo (${pu.qtd} de ${pu.qtd})`);
      let sl = 1; while (IM.some(i => i.purchase_id === pid && i.slot === sl)) sl++; IM.push({ purchase_id: pid, slot: sl, imei1: a, imei2: b }); return { purchase_id: pid, slot: sl, recebidos: recb(pu), qtd: pu.qtd, status: recb(pu) >= pu.qtd ? "completo" : "pendente" }; },
    async itemReceber(pid, q) { if (!["admin", "estoque"].includes(role)) throw new Error("Sem permissão"); const pu = PU.find(p => p.id === pid), ni = IM.filter(i => i.purchase_id === pid).length; if (!(q >= 0) || q + ni > pu.qtd) throw new Error(`Quantidade inválida (comprado ${pu.qtd}, já com IMEI ${ni})`); pu.rsi = q; return { purchase_id: pid, recebidos: recb(pu), qtd: pu.qtd }; },
    async purchases() { return PU; },
    async addPurchase(p) {
      if (role !== "admin") throw new Error("Só admin registra compra");
      if (qs.has("failsku") && p.sku === qs.get("failsku")) throw new Error("Falha simulada (demo ?failsku)");
      const x = P.find(y => y.sku === p.sku); if (!x) throw new Error("SKU não existe");
      const OPX = globalThis.BAGDA_ORIGEM; const global = (COT[0] || {}).valor;
      let custoCompra = p.custo_unit, custoLoja = p.custo_unit, taxa = null;
      if (p.origem === "Importado") {
        if (!(Number(p.taxa_dolar) > 0)) throw new Error("Item importado precisa da taxa do dólar desta compra");
        if (p.custo_usd == null || p.custo_usd === "") throw new Error("Item importado precisa de custo em US$");
        taxa = Number(p.taxa_dolar);
        const cr = OPX.custoReaisDeUsd(p.custo_usd, taxa); if (cr.error) throw new Error(cr.error);
        custoCompra = cr.value;
        const live = OPX.custoReaisDeUsd(p.custo_usd, global); if (live.error) throw new Error(live.error);
        custoLoja = live.value; x.custo_usd = OPX.parseCustoUsd(p.custo_usd).value;
      } else if (p.origem === "Nacional") { taxa = null; }
      const applied = OPX.aplicarLinha(x, { origem: p.origem || null, custo_reais: p.origem === "Importado" ? custoLoja : p.custo_unit }, global);
      if (applied.error) throw new Error(applied.error);
      const ci = p.compra_lote && (PU.find(z => z.compra_lote === p.compra_lote) || {}).compra_id || ++CNO;
      const gravado = { ...p, custo_unit: p.origem === "Importado" ? custoCompra : p.custo_unit, taxa_dolar: taxa };
      PU.unshift({ id: id++, data: today(), ...gravado, compra_id: ci, total: gravado.qtd * gravado.custo_unit });
      x.estoque += p.qtd; K[p.sku] = p.origem === "Importado" ? custoLoja : p.custo_unit;
      x.origem = applied.product.origem; x.preco_usd = applied.product.preco_usd; x.preco_venda = applied.product.preco_venda;
    },
    async saveProduct(p, c) {
      if (role !== "admin") throw new Error("Sem permissão");
      const i = P.findIndex(x => x.sku === p.sku);
      const prev = i < 0 ? { sku: p.sku, estoque: 0, origem: "Nacional", preco_venda: p.preco_venda, preco_usd: null } : P[i];
      const custo = c !== "" && c != null ? Number(c) : K[p.sku];
      let next = { ...prev, ...p, origem: p.origem || "Nacional" };
      if (next.origem === "Importado") {
        const calc = BAGDA_ORIGEM.precoReaisImportado(next.preco_usd, (COT[0] || {}).valor, custo != null ? custo : null);
        if (calc.error) throw new Error(calc.error);
        next.preco_usd = BAGDA_ORIGEM.parseUsd(next.preco_usd).value;
        next.preco_venda = calc.preco;
      }
      if (c !== "" && c != null) K[p.sku] = Number(c);
      if (next.origem === "Importado" && K[p.sku] != null) {
        const again = BAGDA_ORIGEM.precoReaisImportado(next.preco_usd, (COT[0] || {}).valor, K[p.sku]);
        if (!again.error) next.preco_venda = again.preco;
      }
      i < 0 ? P.push(next) : Object.assign(P[i], next);
    }
  };
  Object.assign(api, BGDUsers.mockApi(qs, U, meU.id));
}

// ---------------- Telas ----------------
let urlDone = false;
async function boot() {
  if (!api) return viewNaoConfigurado();
  if (!urlDone) { urlDone = true;
    if (AUTH.error) { cleanUrl(); return viewLogin(authErrorMsg()); }
    if (AUTH.access_token || AUTH.code || AUTH.token_hash) {
      try { await api.consumeUrl(); } catch (e) { needPassword = false; cleanUrl(); return viewLogin(authErrorMsg()); }
      cleanUrl();
    }
  }
  const s = await api.session();
  if (!s) { viewLogin(); if (window.BGDSwitch) BGDSwitch.prefill(); return; }
  const a = await api.aal();
  if (a.nextLevel === "aal2" && a.currentLevel !== "aal2") return viewMfaChallenge();
  if (needPassword) return viewCriarSenha();
  const st = await api.status().catch(() => null);   // null = security.sql ainda não rodado
  if (st && st.locked && !st.is_owner) return viewBloqueado();
  isOwner = !!(st && st.is_owner); lockedNow = !!(st && st.locked);
  if (!(await BGDUsers.guard(api, m => viewLogin(m)))) return;
  try { me = await api.profile(); } catch { me = null; }
  if (!me || me.ativo === false) { await api.logout(); return viewLogin("Conta sem perfil ativo. Fale com o administrador."); }
  $("#who").textContent = `${me.nome} (${me.handle}) · ${ROLEL[me.role] || me.role}`;
  $("#nav").hidden = false;
  if (window.BGDSwitch) BGDSwitch.mount(me, MOCK ? "mb@demo.local" : await api.email().catch(() => ""));
  document.querySelectorAll("nav button[data-p]").forEach(b => b.hidden = !can(b.dataset.p));
  document.querySelectorAll("nav .navg").forEach(g => { const bs = [...g.querySelectorAll("button")]; g.hidden = bs.length > 0 && bs.every(b => b.hidden); });
  if (globalThis.BAGDA_PRAZO && BAGDA_PRAZO.installStyles) BAGDA_PRAZO.installStyles();
  refreshCobrancaBadge();
  if (MOCK && qs.get("demo") === "resumo") { const L = await api.caixasLista(), px = L.find(x => x.metodo === "pix").caixa_id; await api.caixaAbrir(px, 0).catch(() => {}); await api.receber(1, 500, px, "pix", null, "parcial"); return viewResumo(today(), px); }
  if (MOCK && qs.get("demo") === "prazo") return viewRecibo(await api.criarNota([{ sku: "JBL-001", qtd: 1, preco_vendido: 799 }], [{ metodo: "prazo", valor: 599 }, { metodo: "pix", valor: 200 }], null, 1, "DINHEIRO", null, 0, 0, 7));
  if (MOCK && qs.has("demo")) return viewRecibo(await api.criarNota([{ sku: "JBL-001", qtd: 1, preco_vendido: 799 }, { sku: "BAS-001", qtd: 2, preco_vendido: 49.9 }], [{ metodo: "pix", valor: 500 }, { metodo: "cartao", valor: 398.8 }], "Cliente Teste"));
  go(location.hash.slice(1) || (can("vendas") ? "nota" : can("caixa") ? "caixa" : can("estoque") ? "estoque" : "seguranca"));
  if (window.BAGDA_PONTO) {
    const deps = { $, app, me, api, toast, esc, today };
    if (qs.get("ponto_logout") === "1" && BAGDA_PONTO.maybePromptLogout) Promise.resolve(BAGDA_PONTO.maybePromptLogout(deps)).catch(() => {});
    else if (BAGDA_PONTO.maybePrompt) Promise.resolve(BAGDA_PONTO.maybePrompt(deps)).catch(() => {});
  }
}
async function refreshCobrancaBadge() {
  const b = document.querySelector('nav button[data-v="receber"]');
  if (!b) return;
  let el = b.querySelector("#rec-badge");
  if (!el) { el = document.createElement("span"); el.id = "rec-badge"; el.className = "nav-alert"; el.hidden = true; el.setAttribute("aria-label", "clientes para cobrança"); b.append(" ", el); }
  if (!me || me.role === "vendedor" || me.role === "estoque" || !can("financas") || !api.cobrancaAlertas) { el.hidden = true; el.textContent = ""; return; }
  try {
    const x = await api.cobrancaAlertas();
    const n = x && !x.pendente_sql ? Number(x.n_clientes || 0) : 0;
    el.textContent = n ? String(n) : "";
    el.hidden = !n;
    if (n) el.title = n === 1 ? "1 cliente para cobrança" : n + " clientes para cobrança";
    else el.removeAttribute("title");
  } catch { el.hidden = true; el.textContent = ""; }
}
function navMark(v) {
  document.querySelectorAll("nav button[data-v]").forEach(b => {
    const on = b.dataset.v === v;
    b.classList.toggle("on", on);
    if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  });
}
function go(v) {
  const need = { lancar: "financas", caixageral: "financas", clientes: "financas", fornecedores: "financas", pagar: "financas", cpend: "admin", receber: "financas", resumo: "financas", nota: "vendas", notas: "vendas", estoque: "vendas|estoque", relatorio: "admin", compras: "admin", produtos: "admin", usuarios: "admin", depesp: "admin|estoque", hxdia: "admin", cxesp: "admin", imei: "financas|estoque", caixa: "caixa", comprovante: "admin" };
  if (!need[v] && v !== "seguranca" && v !== "ponto") v = "nota";
  if (need[v] && !can(need[v])) v = can("vendas") ? "nota" : can("caixa") ? "caixa" : can("estoque") ? "estoque" : "seguranca";
  navMark(v);
  history.replaceState(null, "", location.pathname + location.search + "#" + v);
  ({ nota: viewNota, notas: viewNotas, caixa: viewCaixa, usuarios: viewUsuarios, estoque: viewEstoque, relatorio: viewRelatorio, compras: viewCompras, produtos: viewProdutos, seguranca: viewSeguranca, caixageral: viewCaixaGeral, lancar: viewLancar, clientes: viewClientes, fornecedores: viewFornecedores, pagar: viewPagar, cpend: viewComprasPendentes, receber: viewReceber, resumo: viewResumo, depesp: viewDepEsp, hxdia: viewHxDia, cxesp: viewCxEsp, imei: viewImei, comprovante: () => viewImei(), ponto: () => window.BAGDA_PONTO.view({ $, app, me, api, toast, esc, today }) }[v] || viewSeguranca)()
    .catch(e => toast(e.message));
}
document.querySelectorAll("nav button[data-v]").forEach(b => b.onclick = () => go(b.dataset.v));
$("#sair").onclick = async () => {
  const b = $("#sair"); if (b) b.disabled = true;
  try { if (window.BAGDA_PONTO && BAGDA_PONTO.maybePromptLogout) await BAGDA_PONTO.maybePromptLogout({ $, app, me, api, toast, esc, today }); }
  catch (e) { toast(e && e.message ? e.message : "Erro"); }
  await api.logout(); location.hash = ""; location.reload();
};

function viewNaoConfigurado() {
  $("#nav").hidden = true;
  app.innerHTML = `<div class="card login"><h2>Sistema ainda não configurado</h2>
  <p>O banco de dados da BAGDA STORES ainda não foi conectado. Preencha <code>loja/config.js</code> com a URL e a chave <b>publishable</b> do projeto Supabase e rode os SQL de <code>supabase-loja/</code> (veja <code>docs/LOJA-SETUP.md</code>).</p>
  <p class="muted">Para ver uma demonstração com dados fictícios: <a href="?mock=admin&auto=1">admin</a> · <a href="?mock=vendedor&auto=1">vendedor</a> · <a href="?mock=financeiro&auto=1">financeiro</a></p></div>`;
}
function viewBloqueado() {
  $("#nav").hidden = true; $("#who").textContent = "";
  app.innerHTML = `<div class="card login"><h2>Sistema bloqueado</h2><p class="muted">O sistema foi bloqueado por segurança. Fale com o responsável.</p><button class="btn ghost" id="x">Sair</button></div>`;
  $("#x").onclick = async () => { await api.logout(); location.reload(); };
}
const BK_TABLES = ["profiles", "role_perms", "products", "product_costs", "purchases", "notas", "sales", "sale_costs", "nota_pagamentos", "caixas", "caixa_movimentos", "caixa_sessoes", "clientes", "fornecedores", "contas_pagar", "conta_pagamentos", "cliente_recebimentos", "recebimento_notas", "security_events", "caixa_especial_mov"];
async function backupAgora(b) {
  b.disabled = true; const out = { exportado_em: new Date().toISOString(), por: me.handle, tabelas: {} };
  try { for (const t of BK_TABLES) { b.textContent = "Exportando " + t + "…"; out.tabelas[t] = await api.dumpTable(t); }
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 1)], { type: "application/json" }));
    a.download = `backup-loja-${today()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); toast("Backup baixado ✓ guarde em local seguro");
  } catch (e) { toast(e.message); } b.disabled = false; b.textContent = "Backup agora";
}
async function secAdmin() {
  if (me.role !== "admin") return "";
  const ev = await api.events().catch(() => null);
  const L = { failed_login: "Login falho", role_change: "Mudança de função", admin_added: "Novo admin", profile_added: "Novo usuário", profile_removed: "Usuário removido", lock: "Bloqueio", unlock: "Desbloqueio", signout_all: "Sessões encerradas" };
  return `<div class="card"><h2>Segurança do sistema</h2>
  <p class="muted">Backup agora baixa um arquivo JSON com todas as tabelas (inclui custos e caixa). Guarde fora do computador da loja.</p>
  <button class="btn" id="bk">Backup agora</button>
  ${ev === null ? `<p class="muted">Bloqueio e log de segurança ainda não ativados no banco (supabase-loja/security.sql).</p>` : `
  ${lockedNow ? `<p class="warn"><b>Sistema BLOQUEADO</b> (só o dono acessa)</p>` : `<button class="btn gold" id="lk" style="background:#b91c1c;color:#fff">Bloquear sistema</button>`}
  ${isOwner ? `${lockedNow ? `<button class="btn" id="ul">Desbloquear sistema</button>` : ""} <button class="btn ghost" id="so">Encerrar todas as sessões</button>` : ""}
  <h3>Eventos recentes</h3><table class="stk"><tr><th>Quando</th><th>Evento</th><th>Detalhe</th></tr>
  ${ev.map(e => `<tr><td>${esc(new Date(e.at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }))}</td><td>${esc(L[e.kind] || e.kind)}</td><td>${esc(e.email || e.detail?.handle || e.detail?.reason || "")}</td></tr>`).join("") || `<tr><td colspan="3" class="muted">Nenhum evento.</td></tr>`}</table>`}</div>`;
}
function wireSec() {
  const b = $("#bk"); if (b) b.onclick = () => backupAgora(b);
  const lk = $("#lk"); if (lk) lk.onclick = async () => { const r = prompt("BLOQUEAR o sistema para todos (exceto o dono)? Escreva o motivo e confirme:"); if (r === null) return;
    if (!confirm("Confirmar bloqueio? Vendedores e admins perdem o acesso até o dono desbloquear.")) return;
    try { await api.lock(r); toast("Sistema bloqueado"); location.reload(); } catch (e) { toast(e.message); } };
  const ul = $("#ul"); if (ul) ul.onclick = async () => { if (!confirm("Desbloquear o sistema?")) return; try { await api.unlock(); toast("Desbloqueado ✓"); location.reload(); } catch (e) { toast(e.message); } };
  const so = $("#so"); if (so) so.onclick = async () => { if (!confirm("Encerrar TODAS as sessões (inclusive a sua)? Todos terão que entrar de novo em até 1 hora.")) return; try { const n = await api.signoutAll(); toast(n + " sessões encerradas"); await api.logout(); location.reload(); } catch (e) { toast(e.message); } };
}
function viewCriarSenha() {
  $("#nav").hidden = true; $("#who").textContent = "";
  app.innerHTML = `<div class="card login"><h2>Criar sua senha</h2>
  <p class="muted">Bem-vindo(a) ao Sistema BAGDA. Crie uma senha com pelo menos 12 caracteres, incluindo letra maiúscula, minúscula, número e símbolo.</p>
  <form id="f"><label>Nova senha</label><input id="p1" type="password" autocomplete="new-password" minlength="12" required>
  <label>Confirmar senha</label><input id="p2" type="password" autocomplete="new-password" minlength="12" required>
  <ul class="muted" id="rq" style="padding-left:18px;margin:10px 0 0"></ul>
  <button class="btn">Salvar senha e entrar</button></form><p class="warn" id="m"></p></div>`;
  const rules = [["12+ caracteres", p => p.length >= 12], ["Letra maiúscula", p => /[A-Z]/.test(p)], ["Letra minúscula", p => /[a-z]/.test(p)], ["Número", p => /[0-9]/.test(p)], ["Símbolo (!@#…)", p => /[^A-Za-z0-9]/.test(p)]];
  const draw = () => { const p = $("#p1").value; $("#rq").innerHTML = rules.map(([l, f]) => `<li style="color:${f(p) ? "#15803d" : "inherit"}">${f(p) ? "✓" : "•"} ${l}</li>`).join(""); };
  $("#p1").oninput = draw; draw();
  $("#f").onsubmit = async ev => { ev.preventDefault(); const p = $("#p1").value;
    if (!strongPw(p)) return $("#m").textContent = "A senha não atende aos requisitos.";
    if (p !== $("#p2").value) return $("#m").textContent = "As senhas não conferem.";
    ev.submitter.disabled = true;
    try { await api.setPassword(p); needPassword = false; toast("Senha criada ✓"); boot(); }
    catch (e) { ev.submitter.disabled = false; $("#m").textContent = /weak|leaked|pwned/i.test(e.message) ? "Senha fraca ou já vazada na internet. Escolha outra." : "Não foi possível salvar: " + e.message; } };
}
function viewLogin(msg) {
  $("#nav").hidden = true; $("#who").textContent = "";
  app.innerHTML = `<div class="card login"><h2>Entrar no Sistema</h2>
  <p class="muted">Acesso restrito à equipe BAGDA. Digite seu nome e senha. Contas são criadas pelo administrador.</p>
  <form id="f"><label>Nome ou e-mail</label><input id="e" autocomplete="username" autocapitalize="none" placeholder="Seu nome (ex.: Kaio) ou e-mail" required>
  <label>Senha</label><input id="p" type="password" autocomplete="current-password" minlength="10" required>
  <button class="btn">Entrar</button></form><p class="warn" id="m">${esc(msg || "")}</p></div>`;
  let fails = 0;
  $("#f").onsubmit = async ev => { ev.preventDefault(); const b = ev.submitter; b.disabled = true;
    try { await api.login(toEmail($("#e").value), $("#p").value); await boot(); }
    catch (e) { fails++; if (/invalid/i.test(e.message)) api.reportFail(toEmail($("#e").value)); $("#m").textContent = "Nome ou senha inválidos."; setTimeout(() => b.disabled = false, Math.min(30000, 1000 * 2 ** fails)); } };
}
async function viewMfaChallenge() {
  const f = (await api.factors()).find(x => x.status === "verified");
  app.innerHTML = `<div class="card login"><h2>Verificação em 2 etapas</h2><p class="muted">Digite o código de 6 dígitos do seu app autenticador.</p>
  <form id="f"><input id="c" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" required><button class="btn">Confirmar</button></form>
  <button class="btn ghost" id="x">Sair</button></div>`;
  $("#f").onsubmit = async ev => { ev.preventDefault(); try { await api.verify(f.id, $("#c").value); boot(); } catch { toast("Código inválido"); } };
  $("#x").onclick = async () => { await api.logout(); viewLogin(); };
}
async function viewEstoque() {
  const adm = me.role === "admin";
  const EC = globalThis.BAGDA_ESTOQUE_CATS;
  const base = adm ? await api.products() : await api.estoqueVendedor();
  const fix = MOCK && qs.has("estfix") && EC ? EC.previewFixtures() : [];
  const P = stockSort(fix.length ? base.concat(fix) : base);
  let cat = "", sub = "", cm = {}, custoErr = "";
  if (adm) { try { cm = Object.fromEntries((await api.costs()).map(k => [k.sku, Number(k.custo)])); } catch (e) { custoErr = e.message || "Não foi possível ler os custos."; } }
  app.innerHTML = `<div class="card"><h2>Estoque${adm ? "" : " (consulta)"} <button class="btn noprint" id="pe" style="float:right;margin:0">Imprimir / PDF</button></h2>
  ${EC ? `<div id="est-nav" class="est-nav noprint"></div>` : ""}${fix.length ? `<p class="muted noprint">Pré-visualização com itens FIXTURE — não é o estoque real.</p>` : ""}${custoErr ? `<p class="warn">${esc(custoErr)}</p>` : ""}<input id="b" class="noprint" type="search" autocomplete="off" placeholder="Buscar produto, marca ou SKU…" autofocus>
  ${EC ? `<p id="est-sum" class="muted est-sum"></p>` : ""}<div class="stk-wrap"><table id="t" class="stk"></table></div></div>`;
  const ult = p => Number(p.estoque) === 1 ? ` <span class="ult">Última peça</span>` : "";
  const cols = adm ? 6 : 5;
  const rowAdm = p => `<tr><td>${esc(p.sku)}</td><td>${esc(p.marca)} ${esc(p.produto)} ${esc(p.tamanho || "")}${usdBadge(p)}${ult(p)}</td><td class="n">${brl(p.preco_venda)}</td><td class="n">${cm[p.sku] != null ? brl(cm[p.sku]) : "—"} <button type="button" class="btn ghost ecst noprint" data-sku="${esc(p.sku)}" style="margin:0;padding:4px 8px">Editar custo</button></td><td class="n ${p.estoque <= p.estoque_minimo ? "low" : ""}">${p.estoque}${p.estoque <= p.estoque_minimo ? " · REPOR" : ""}</td><td class="n">${p.estoque_minimo}</td></tr>`;
  const rowSeller = p => `<tr><td>${esc(p.sku)}</td><td>${esc(p.marca)}</td><td>${esc(p.produto)}${usdBadge(p)}${ult(p)}</td><td>${esc(p.tamanho || "")}</td><td class="n">${p.estoque}</td></tr>`;
  const row = adm ? rowAdm : rowSeller;
  const editarCusto = sku => {
    const p = P.find(x => x.sku === sku); if (!adm || !p) return;
    const o = document.createElement("div"); o.className = "nmodal noprint"; o.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:99;padding:16px";
    o.innerHTML = `<div class="card" role="dialog" aria-modal="true" aria-labelledby="custo-title" style="max-width:440px;margin:0"><h2 id="custo-title">Editar custo</h2><p><b>${esc(p.sku)}</b> · ${esc(p.marca)} ${esc(p.produto)} ${esc(p.tamanho || "")}</p><p>Custo atual: <b>${cm[p.sku] != null ? brl(cm[p.sku]) : "sem custo cadastrado"}</b></p><p class="muted">Altera só o custo unitário atual deste SKU. Não muda o preço de venda, o estoque, nem compras e notas já lançadas.</p><label for="custo-in">Novo custo (R$)</label><input id="custo-in" inputmode="decimal" autocomplete="off" value="${cm[p.sku] != null ? esc(String(cm[p.sku])) : ""}"><p class="warn" id="custo-w" style="min-height:1em"></p><button type="button" class="btn ghost" id="custo-x">Cancelar</button> <button type="button" class="btn" id="custo-ok">Salvar custo</button></div>`;
    const close = () => { o.remove(); document.removeEventListener("keydown", onKey); };
    const onKey = e => { if (e.key === "Escape") close(); };
    document.body.append(o); document.addEventListener("keydown", onKey); const inp = o.querySelector("#custo-in"); inp.focus(); inp.select();
    o.querySelector("#custo-x").onclick = close;
    o.querySelector("#custo-ok").onclick = async () => {
      const parsed = globalThis.BAGDA_CUSTO.parseCusto(inp.value); const w = o.querySelector("#custo-w"), b = o.querySelector("#custo-ok");
      if (parsed.error) { w.textContent = parsed.error; inp.focus(); return; }
      b.disabled = true;
      try {
        const saved = await api.custoSalvar(p.sku, parsed.value);
        if (!saved || saved.sku !== p.sku || !globalThis.BAGDA_CUSTO.sameCents(saved.custo, parsed.value)) throw new Error("O custo não foi confirmado. O valor na tela não foi trocado.");
        cm[p.sku] = Number(saved.custo); close(); toast("Custo atualizado ✓"); draw();
      } catch (e) { b.disabled = false; w.textContent = e.message || "Não foi possível salvar o custo."; }
    };
  };
  const draw = focusSel => {
    const q = $("#b").value;
    const matched = EC ? P.filter(p => EC.matchProduct(p, q)) : P.filter(p => match(p, q));
    if (EC) $("#est-nav").innerHTML = EC.navHtml(matched, { cat, sub });
    const L = EC ? EC.filterList(matched, { cat, sub, q: "" }) : matched;
    if ($("#est-sum") && EC) $("#est-sum").textContent = EC.summaryText(EC.countsOf(L), EC.countsOf(matched), EC.countsOf(P));
    const sec = EC ? EC.saleSections(L) : { priority: L.filter(p => Number(p.estoque) === 1), available: L.filter(p => Number(p.estoque) > 1), missing: L.filter(p => !(Number(p.estoque) > 0)) };
    const sep = (cls, title) => `<tr class="sep${cls ? " " + cls : ""}"><th colspan="${cols}">${title}</th></tr>`;
    const head = adm ? `<tr><th>SKU</th><th>Produto</th><th class="n">Preço</th><th class="n">Custo</th><th class="n">Estoque</th><th class="n">Mín.</th></tr>` : `<tr><th>SKU</th><th>Marca</th><th>Produto</th><th>Tamanho</th><th class="n">Estoque</th></tr>`;
    let body = head;
    if (!L.length) body += `<tr><td colspan="${cols}" class="muted">${q ? "Nada encontrado." : cat ? "Nada nesta categoria." : "Nada encontrado."}</td></tr>`;
    else {
      const availN = sec.priority.length + sec.available.length;
      body += sep("", `Produtos disponíveis (${availN})`);
      if (!availN) body += `<tr><td colspan="${cols}" class="muted">Nenhum produto disponível neste filtro.</td></tr>`;
      if (sec.priority.length) body += sep("pri", `Prioridade de venda · última peça (${sec.priority.length})`) + sec.priority.map(row).join("");
      body += sec.available.map(row).join("");
      if (sec.missing.length) body += sep("", `Sem estoque (${sec.missing.length})`) + sec.missing.map(row).join("");
    }
    $("#t").innerHTML = body;
    if (adm) $("#t").querySelectorAll(".ecst").forEach(b => b.onclick = () => editarCusto(b.dataset.sku));
    if (focusSel && $("#est-nav")) { const el = $("#est-nav").querySelector(focusSel); if (el) el.focus({ preventScroll: true }); }
  };
  if ($("#est-nav")) {
    $("#est-nav").onclick = e => {
      const b = e.target.closest("button.est-chip"); if (!b) return;
      if (b.hasAttribute("data-cat")) { cat = b.dataset.cat || ""; sub = ""; }
      else sub = b.dataset.sub || "";
      draw(b.hasAttribute("data-cat") ? `button[data-cat="${CSS.escape(cat)}"]` : `button[data-sub="${CSS.escape(sub)}"]`);
    };
    $("#est-nav").onkeydown = e => EC.onToolbarKey(e);
  }
  $("#b").oninput = () => draw(); $("#pe").onclick = () => window.print(); draw(); $("#b").focus();
}
async function viewRelatorio(d = today()) {
  const adm = me.role === "admin";
  const [RS, RP, RL] = await Promise.all([api.repSeller(d), api.repPay(d), adm ? api.repProfit(d) : []]);
  const fat = RS.reduce((a, r) => a + Number(r.faturamento), 0), it = RS.reduce((a, r) => a + Number(r.itens), 0), n = RP.length ? Math.max(RS.reduce((a, r) => a + Number(r.vendas), 0), 0) : RS.reduce((a, r) => a + Number(r.vendas), 0);
  const luc = RL.reduce((a, r) => a + Number(r.lucro), 0);
  app.innerHTML = `<div class="card"><h2>Relatório diário${adm ? "" : " (suas vendas)"}</h2>
  <label>Data</label><input id="d" type="date" value="${d}" style="max-width:200px">
  <div class="grid" style="margin-top:14px"><div class="kpi"><small>Vendas</small><b>${n}</b></div><div class="kpi"><small>Itens</small><b>${it}</b></div>
  <div class="kpi"><small>Faturamento</small><b>${brl(fat)}</b></div><div class="kpi"><small>Ticket médio</small><b>${brl(n ? fat / n : 0)}</b></div>
  ${adm ? `<div class="kpi"><small>Lucro</small><b>${brl(luc)}</b></div><div class="kpi"><small>Margem</small><b>${fat ? (luc / fat * 100).toFixed(1) : 0}%</b></div>` : ""}</div>
  <h3>Por vendedor</h3><table><tr><th>Handle</th><th>Nome</th><th class="n">Itens</th><th class="n">Faturamento</th>${adm ? '<th class="n">Lucro</th>' : ""}</tr>
  ${RS.map(r => `<tr><td>${esc(r.handle)}</td><td>${esc(r.nome)}</td><td class="n">${r.itens}</td><td class="n">${brl(r.faturamento)}</td>${adm ? `<td class="n">${brl((RL.find(x => x.handle === r.handle) || {}).lucro)}</td>` : ""}</tr>`).join("")}</table>
  <h3>Por forma de pagamento</h3><table><tr><th>Pagamento</th><th class="n">Notas</th><th class="n">Valor</th></tr>
  ${RP.map(r => `<tr><td>${esc(PAYL[r.forma_pagamento] || r.forma_pagamento)}</td><td class="n">${r.vendas}</td><td class="n">${brl(r.faturamento)}</td></tr>`).join("")}</table></div><div class="card" id="ext"><h2>Extrato de vendas</h2><p class="muted">Carregando notas…</p></div>`;
  $("#d").onchange = e => viewRelatorio(e.target.value);
  viewExtrato(d, adm, { on: adm, n, it, fat, luc }, { pl: m => PAYL[m] || m });
}
// ---------- Extrato de vendas (Relatório diário): uma linha por nota, itens expansíveis, totais conferidos com o resumo ----------
async function viewExtrato(d, adm, K, cfg) {
  const host = $("#ext"); if (!host) return;
  let X; try { X = await api.extrato(d, adm); } catch (e) { host.innerHTML = `<h2>Extrato de vendas</h2><p class="warn">${esc(e.message || e)}</p>`; return; }
  if ($("#d") && $("#d").value !== d) return;
  const by = {};
  X.itens.forEach(r => { const n = by[r.nota_id] ||= { nota_id: r.nota_id, created_at: r.created_at, handle: r.handle, nome: r.nome, cliente: r.cliente, status: r.status || "ativa", itens: [], qtd: 0, total: 0, pags: [], lucro: null }; n.itens.push(r); n.qtd += Number(r.qtd); n.total += Number(r.total); });
  (X.heads || []).forEach(r => { by[r.nota_id] ||= { nota_id: r.nota_id, created_at: r.created_at, handle: r.handle, nome: r.nome, cliente: r.cliente, status: r.status || "ativa", itens: [], qtd: 0, total: 0, pags: [], lucro: null }; }); /* nota só de frete */
  Object.entries(X.fre || {}).forEach(([k, v]) => by[k] && (by[k].frete = Number(v)));
  Object.entries(X.cn || {}).forEach(([k, v]) => by[k] && (by[k].caxinha_natal = Number(v)));
  X.pags.forEach(g => by[g.nota_id] && by[g.nota_id].pags.push(g));
  if (api.notasInfo) (await api.notasInfo(Object.keys(by).map(Number)).catch(() => [])).forEach(x => by[x.id] && Object.assign(by[x.id], { local: x.local_pagamento, obs: x.obs_pagamento, frete: x.frete != null ? Number(x.frete) : by[x.id].frete, caxinha_natal: x.caxinha_natal != null ? Number(x.caxinha_natal) : by[x.id].caxinha_natal }));
  if (adm) Object.entries(X.lucro || {}).forEach(([k, v]) => by[k] && (by[k].lucro = Number(v)));
  const L = Object.values(by).sort((a, b) => (new Date(a.created_at) - new Date(b.created_at)) || (a.nota_id - b.nota_id));
  const A = L.filter(n => n.status !== "cancelada"), C = L.filter(n => n.status === "cancelada");
  const sum = (a, f) => a.reduce((s, n) => s + Number(f(n) || 0), 0), c2 = v => Math.round(Number(v || 0) * 100);
  const legado = n => String(n.obs || "").startsWith("DÍVIDA ANTERIOR");
  const T = { n: cfg.linhas ? sum(A, n => n.itens.length) : A.filter(n => n.itens.length).length, it: sum(A, n => n.qtd), fat: sum(A, n => n.total), luc: sum(A, n => n.lucro), fr: sum(A.filter(n => !legado(n)), n => n.frete), cx: sum(A, n => n.caxinha_natal) }; /* Total = produtos; Frete/Caxinha à parte; dívida anterior fora do frete */
  const PF = {}; A.filter(n => !legado(n)).forEach(n => n.pags.forEach(g => { const k = cfg.pl(g.metodo); PF[k] ||= { n: 0, v: 0 }; PF[k].n++; PF[k].v += Number(g.valor); }));
  const dif = []; if (T.n !== K.n) dif.push(`vendas ${T.n} × ${K.n}`); if (T.it !== K.it) dif.push(`itens ${T.it} × ${K.it}`); if (c2(T.fat) !== c2(K.fat)) dif.push(`faturamento ${brl(T.fat)} × ${brl(K.fat)}`); if (adm && c2(T.luc) !== c2(K.luc)) dif.push(`lucro ${brl(T.luc)} × ${brl(K.luc)}`);
  const hm = t => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(t));
  const nn = id => String(id).padStart(6, "0"), pg = n => n.pags.map(g => `${cfg.pl(g.metodo)} ${brl(g.valor)}`).join(" + ");
  const cols = adm ? 12 : 11, dd = d.split("-").reverse().join("/");
  const rows = L.map(n => { const cx = n.status === "cancelada";
    return `<tr class="${cx ? "exc" : ""}"><td class="noprint"><button class="ext-t" data-n="${n.nota_id}" title="Ver itens" aria-expanded="false">▸</button></td><td>${nn(n.nota_id)}</td><td>${esc(hm(n.created_at))}</td><td>${esc(n.handle || "")}</td><td>${esc(n.cliente || "—")}</td><td>${esc(pg(n))}${n.local ? `<br><small><b>Local:</b> ${esc(n.local)}</small>` : ""}${n.obs ? `<br><small class="muted">Obs: ${esc(n.obs)}</small>` : ""}</td><td class="n">${n.qtd}</td><td class="n">${brl(n.total)}</td><td class="n">${legado(n) || !n.frete ? "—" : brl(n.frete)}</td><td class="n">${n.caxinha_natal ? brl(n.caxinha_natal) : "—"}</td>${adm ? `<td class="n">${n.lucro == null ? "—" : brl(n.lucro)}</td>` : ""}<td>${cx ? '<b class="warn">CANCELADA</b><br><small class="muted">fora dos totais</small>' : "Ativa"}</td><td class="noprint"><button class="ext-o" data-n="${n.nota_id}">Abrir nota</button></td></tr>
    <tr class="exi" data-p="${n.nota_id}" hidden><td class="noprint"></td><td colspan="${cols - 2}"><table class="exit"><tr><th>Produto</th><th class="n">Qtd</th><th class="n">Preço un.</th><th class="n">Subtotal</th></tr>
    ${n.itens.map(i => `<tr><td>${esc(i.sku ? i.sku + " · " : "")}${esc(i.marca)} ${esc(i.produto)} ${esc(i.tamanho || "")}</td><td class="n">${i.qtd}</td><td class="n">${brl(i.preco_vendido)}</td><td class="n">${brl(i.total)}</td></tr>`).join("")}${legado(n) ? `<tr><td><b>DÍVIDA ANTERIOR</b> (não é frete do dia)</td><td class="n">—</td><td class="n">—</td><td class="n">${brl(n.frete || n.total)}</td></tr>` : n.frete ? `<tr><td><b>FRETE</b> (motoboy)</td><td class="n">—</td><td class="n">—</td><td class="n">${brl(n.frete)}</td></tr>` : ""}${n.caxinha_natal ? `<tr><td><b>CAXINHA D NATAL</b></td><td class="n">—</td><td class="n">—</td><td class="n">${brl(n.caxinha_natal)}</td></tr>` : ""}</table></td><td class="noprint"></td></tr>`; }).join("");
  host.innerHTML = `<h2>Extrato de vendas — ${esc(dd)} <span class="noprint" style="float:right"><button class="btn ghost" id="exa" style="margin:0">Expandir itens</button> <button class="btn ghost" id="excsv" style="margin:0">CSV</button> <button class="btn" id="expr" style="margin:0">Imprimir / PDF (A4)</button></span></h2>
  <p class="muted">${L.length} nota(s)${C.length ? ` · ${C.length} cancelada(s) mostrada(s) mas fora dos totais` : ""}${cfg.linhas ? " · “Vendas” no resumo = linhas de item" : ""}</p>
  <div style="overflow-x:auto"><table class="stk ext"><tr><th class="noprint"></th><th>Nº</th><th>Hora</th><th>Vendedor</th><th>Cliente</th><th>Pagamento</th><th class="n">Itens</th><th class="n">Total</th><th class="n">Frete</th><th class="n">Caxinha</th>${adm ? '<th class="n">Lucro</th>' : ""}<th>Status</th><th class="noprint"></th></tr>
  ${rows || `<tr><td colspan="${cols + 1}" class="muted">Nenhuma nota nesta data.</td></tr>`}
  ${Object.entries(PF).map(([k, v]) => `<tr class="sep"><th class="noprint"></th><th colspan="5">Total ${esc(k)} (${v.n} ${v.n === 1 ? "nota" : "notas"})</th><th></th><th class="n">${brl(v.v)}</th><th></th><th></th>${adm ? "<th></th>" : ""}<th></th><th class="noprint"></th></tr>`).join("")}
  <tr class="tot"><th class="noprint"></th><th colspan="5">TOTAL (${A.length} nota(s) ativas${cfg.linhas ? `, ${T.n} linhas` : ""})</th><th class="n">${T.it}</th><th class="n">${brl(T.fat)}</th><th class="n">${brl(T.fr)}</th><th class="n">${brl(T.cx)}</th>${adm ? `<th class="n">${brl(T.luc)}</th>` : ""}<th></th><th class="noprint"></th></tr></table></div>${T.fr ? `<p class="muted">Frete (motoboy) do dia: <b>${brl(T.fr)}</b> — fora do Total de produtos e do lucro; os pagamentos acima já incluem o frete.</p>` : ""}${T.cx ? `<p class="muted">Caxinha d Natal do dia: <b>${brl(T.cx)}</b> — fora do Total de produtos e do lucro; os pagamentos acima já incluem a caxinha.</p>` : ""}
  ${K.on ? (dif.length ? `<p class="warn"><b>⚠ Não confere com o resumo:</b> ${esc(dif.join(" · "))}</p>` : `<p class="ok-r">✓ Confere com o resumo: ${T.n} vendas · ${T.it} itens · ${brl(T.fat)}${adm ? " · lucro " + brl(T.luc) : ""}</p>`) : ""}`;
  const tog = (id, on) => { const r = host.querySelector(`tr.exi[data-p="${id}"]`), b = host.querySelector(`.ext-t[data-n="${id}"]`); if (!r) return; r.hidden = on == null ? !r.hidden : !on; b.textContent = r.hidden ? "▸" : "▾"; b.setAttribute("aria-expanded", String(!r.hidden)); };
  host.querySelectorAll(".ext-t").forEach(b => b.onclick = () => tog(b.dataset.n));
  host.querySelectorAll(".ext-o").forEach(b => b.onclick = () => viewRecibo(+b.dataset.n));
  $("#exa").onclick = () => { const open = $("#exa").textContent.startsWith("Expandir"); L.forEach(n => tog(n.nota_id, open)); $("#exa").textContent = open ? "Recolher itens" : "Expandir itens"; };
  $("#expr").onclick = () => window.print();
  $("#excsv").onclick = () => { const q = v => { let t = String(v ?? ""); if (/^[=+\-@]/.test(t) && !/^-?\d/.test(t)) t = "'" + t; return '"' + t.replace(/"/g, '""') + '"'; }, m = v => v == null ? "" : Number(v).toFixed(2).replace(".", ",");
    const H = ["Nº", "Data", "Hora", "Vendedor", "Cliente", "Pagamento", "Itens", "Total", "Frete", "Caxinha", ...(adm ? ["Lucro"] : []), "Status", "Nos totais"];
    const out = [["Extrato de vendas", dd], [], H, ...L.map(n => [nn(n.nota_id), dd, hm(n.created_at), n.handle || "", n.cliente || "", n.pags.map(g => `${cfg.pl(g.metodo)} ${m(g.valor)}`).join(" + "), n.qtd, m(n.total), legado(n) ? "" : m(n.frete || 0), m(n.caxinha_natal || 0), ...(adm ? [m(n.lucro)] : []), n.status === "cancelada" ? "CANCELADA" : (legado(n) ? "DIVIDA ANTERIOR" : "Ativa"), n.status === "cancelada" || legado(n) ? "não" : "sim"]), [],
      ["Nº", "SKU", "Produto", "Qtd", "Preço un.", "Subtotal", "Status"], ...L.flatMap(n => n.itens.map(i => [nn(n.nota_id), i.sku || "", `${i.marca || ""} ${i.produto || ""} ${i.tamanho || ""}`.trim(), i.qtd, m(i.preco_vendido), m(i.total), n.status === "cancelada" ? "CANCELADA" : "Ativa"])), [],
      ...Object.entries(PF).map(([k, v]) => ["Total " + k, v.n + " nota(s)", m(v.v)]), ["TOTAL (ativas)", A.length + " nota(s)", m(T.fat), "Itens", T.it, "Frete", m(T.fr), "Caxinha", m(T.cx), ...(adm ? ["Lucro", m(T.luc)] : [])], ...(C.length ? [["Canceladas (fora dos totais)", C.length + " nota(s)", m(sum(C, n => n.total))]] : [])];
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + out.map(r => r.map(q).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    a.download = `extrato-vendas-${d}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
}
// ---------- Registrar compra (carrinho multi-itens) ----------
const CORES = /\b(preto|preta|branco|branca|azul(?:-c[eé]u)?|verde|rosa|roxo|lil[aá]s|amarelo|vermelho|cinza|prata|prateado|dourado|ouro|grafite|meia-noite|estelar|tit[aâ]nio(?: natural| preto| branco| deserto)?|black|white|blue|silver|gold|space gray|midnight|starlight|natural|lavanda|creme|bege|laranja|coral)\b/i;
const variante = p => { const raw = [p.variante, p.cor, p.armazenamento, p.memoria, p.ram, p.tamanho, p.notas].filter(Boolean).map(String).join(" · ").replace(/\s+/g, " ").trim();
  const all = `${p.produto || ""} ${raw}`, cor = p.cor || (raw.match(CORES) || [])[0] || "", gb = [...new Set((all.match(/\b\d+\s?(?:GB|TB)\b(?:\s?RAM)?/gi) || []).map(x => x.replace(/\s+(?=GB|TB)/i, "").toUpperCase()))];
  return { raw, cor, gb }; };
// combobox genérico: itens(q) -> [{k, html}], onPick(k|null para "novo")
const combo = (inp, ul, itens, onPick) => { let hi = 0, M = [];
  const draw = () => { M = itens(inp.value.trim()); hi = Math.min(hi, Math.max(M.length - 1, 0));
    ul.innerHTML = M.map((m, i) => `<li role="option" data-i="${i}" class="${i === hi ? "hi" : ""}${m.off ? " off" : ""}">${m.html}</li>`).join("") || (inp.value.trim() ? '<li class="off">Nada encontrado</li>' : "");
    const h = ul.querySelector("li.hi"); if (h) h.scrollIntoView({ block: "nearest" });
    ul.querySelectorAll("li[data-i]").forEach(li => li.onmousedown = e => { e.preventDefault(); pick(+li.dataset.i); }); };
  const pick = i => { const m = M[i]; if (!m) return; ul.innerHTML = ""; M = []; hi = 0; onPick(m.k); };
  inp.oninput = () => { hi = 0; draw(); inp.dispatchEvent(new Event("typed")); }; inp.onfocus = draw; inp.onblur = () => setTimeout(() => { ul.innerHTML = ""; }, 150);
  inp.onkeydown = e => { if (e.key === "ArrowDown") { e.preventDefault(); if (!M.length) draw(); hi = Math.min(hi + 1, M.length - 1); draw(); } else if (e.key === "ArrowUp") { e.preventDefault(); hi = Math.max(hi - 1, 0); draw(); }
    else if (e.key === "Enter") { e.preventDefault(); if (M.length) pick(hi); } else if (e.key === "Escape") { e.preventDefault(); if (ul.innerHTML) { ul.innerHTML = ""; M = []; } else { inp.value = ""; inp.dispatchEvent(new Event("typed")); } } };
  return { pick: () => M.length && pick(hi), open: draw }; };
async function mountCotacao(el, onSaved) {
  if (!el) return null;
  if (me.role !== "admin" || !api.cotacaoLer) { el.innerHTML = ""; return null; }
  const OP = globalThis.BAGDA_ORIGEM;
  let C; try { C = await api.cotacaoLer(); }
  catch (e) { el.innerHTML = `<div class="card"><h2>Cotação do dólar</h2><p class="warn">${esc(e.message)}</p></div>`; return null; }
  const when = C && C.alterado_em ? quandoSP(C.alterado_em) : "";
  const hist = (C && C.historico || []).slice(0, 8);
  el.innerHTML = `<div class="card"><h2>Cotação do dólar</h2>
    ${C && C.pendente_sql ? '<p class="warn">Ainda não instalado no banco (falta rodar migration-origem-dolar.sql). Nada foi salvo.</p>' : ""}
    <p>${C && C.valor != null ? `Atual: <b>${OP.formatCotacao(C.valor)}</b>` : "<b>Sem cotação.</b> Defina uma antes de lançar produto importado."}${when ? ` · última atualização ${esc(when)}${C.handle ? " por " + esc(C.handle) : ""}` : ""}</p>
    <form id="cotf"><div class="grid"><div><label for="cotv">Nova cotação (R$ por US$ 1)</label><input id="cotv" inputmode="decimal" autocomplete="off" placeholder="Ex.: 5,42" required></div></div>
    <button class="btn" type="submit">Salvar cotação e recalcular importados</button></form>
    ${hist.length ? `<h3>Histórico</h3><table><tr><th>Quando</th><th>Quem</th><th class="n">Valor</th></tr>${hist.map(h => `<tr><td>${esc(quandoSP(h.alterado_em))}</td><td>${esc(h.handle || h.nome || "—")}</td><td class="n">${OP.formatCotacao(h.valor)}</td></tr>`).join("")}</table>` : ""}
    <p class="muted">Só admin. Pode mudar quantas vezes quiser. Ao salvar, o preço em R$ de cada produto Importado é recalculado na hora. O custo em R$ segue a cotação só nas unidades de compras importadas que ainda não foram pagas; compra já paga fica travada. Notas já emitidas não mudam.</p></div>`;
  el.querySelector("#cotf").onsubmit = async ev => {
    ev.preventDefault();
    const parsed = OP.parseCotacao(el.querySelector("#cotv").value);
    if (parsed.error) return toast(parsed.error);
    if (!await confirmBox(`Gravar a cotação <b>${OP.formatCotacao(parsed.value)}</b> e recalcular agora o preço em R$ de todos os produtos Importado?<br><small>Notas já emitidas não mudam.</small>`)) return;
    const b = ev.submitter; b.disabled = true;
    try { const saved = await api.cotacaoSalvar(parsed.value); toast("Cotação atualizada ✓ preços importados recalculados"); if (onSaved) await onSaved(saved); else await mountCotacao(el, onSaved); }
    catch (e) { b.disabled = false; toast(e.message); }
  };
  return C;
}
async function viewCompras(o = {}) {
  const root = o.root || app, emb = !!o.root, again = x => o.onSaved ? o.onSaved(x) : viewCompras(o);
  const adm = me.role === "admin", [P, PU, K, FT] = await Promise.all([(api.productsFull ? api.productsFull() : api.products()).catch(() => api.products()), api.purchases(), adm ? api.costs().catch(() => []) : [], api.fornecedores ? api.fornecedores().catch(() => []) : []]);
  const cm = Object.fromEntries((K || []).map(k => [k.sku, k.custo])), V = Object.fromEntries(P.map(p => [p.sku, variante(p)])), PS = Object.fromEntries(P.map(p => [p.sku, p]));
  const hay = p => `${p.sku} ${p.marca} ${p.produto} ${V[p.sku].raw} ${V[p.sku].gb.join(" ")}`, nome = p => `${p.marca} ${p.produto}${V[p.sku].raw ? " — " + V[p.sku].raw : ""}`;
  const line = p => { const v = V[p.sku], tags = [v.cor && `🎨 ${v.cor}`, v.gb.length && `💾 ${v.gb.join(" / ")}`].filter(Boolean).join(" · ");
    return `<b>${esc(p.marca)} ${esc(p.produto)}</b>${usdBadge(p)}${v.raw ? ` <span class="vt">${esc(v.raw)}</span>` : ' <span class="vt off">sem variante cadastrada</span>'}<small>${esc(p.sku)}${tags ? " · " + esc(tags) : ""} · estoque <b>${+p.estoque || 0}</b>${p.ativo === false ? " · inativo" : ""}${adm ? ` · custo ${cm[p.sku] != null ? brl(cm[p.sku]) : "—"}` : ""}</small>`; };
  const fk = x => norm(x).replace(/\s+/g, " ").trim(), sp = x => String(x ?? "").replace(/\s+/g, " ").trim(), FN = new Map();
  [...FT.filter(f => f.ativo !== false).map(f => f.nome), ...PU.map(p => p.fornecedor), ...P.map(p => p.fornecedor)].forEach(n => { n = sp(n); if (n.length >= 2 && !FN.has(fk(n))) FN.set(fk(n), n); });
  const inTab = new Set(FT.map(f => fk(f.nome))); let L = [{ sku: "", qtd: 1, custo: "", origem: "Nacional", custo_usd: "" }], busy = false, cot = null;
  let CXS = [], pagSql = !emb;
  if (!emb && api.comprasCaixas) { try { CXS = await api.comprasCaixas() || []; } catch (e) { if (/migration-compras-pagamento|PGRST202|schema cache|does not exist|compras_caixas/i.test(e.message || "")) pagSql = false; else throw e; } }
  else if (!emb) pagSql = false;
  const prefCx = CXS.some(c => c.caixa_id === 17) ? 17 : (CXS[0] || {}).caixa_id;
  root.innerHTML = `${!emb && adm ? '<div id="cotacao"></div>' : ""}<div class="card"><h2>${emb ? "Entrada no Depósito Especial" : "Registrar compra"}</h2>
  ${emb ? '<p class="muted">Vários itens de uma vez · NÃO soma ao estoque da loja.</p>' : adm ? `<label>Destino</label><select id="dst"><option value="loja">Loja (soma ao estoque da loja)</option><option value="esp" ${o.dest === "esp" ? "selected" : ""}>Depósito Especial (só admin · não aparece na loja)</option></select>` : ""}
  <div class="grid"><div><label>Fornecedor${emb ? " (opcional)" : ""}</label><input id="fo" type="search" autocomplete="off" maxlength="120" placeholder="Buscar ou digitar novo…"><ul id="fsug" class="sug" role="listbox"></ul></div>
  <div><label>Data</label><input id="cdt" type="date" value="${today()}" max="${today()}"></div><div><label>Observação</label><input id="ob" maxlength="200"></div></div>
  <h3>Itens</h3><div id="lns"></div><button type="button" class="btn ghost" id="add">+ Adicionar item</button>
  <div id="taxabox" hidden><label for="taxa">Taxa do dólar desta compra</label><input id="taxa" inputmode="decimal" autocomplete="off" placeholder="Ex.: 5,42"><p class="muted" id="taxah">Uma taxa para a compra inteira, preenchida com a cotação atual. Pagar agora trava o custo em R$ nesta taxa. Pagar depois ou dívida segue a cotação do dia até o pagamento.</p></div>
  <p style="font-size:1.15em">Total da compra: <b id="gt">R$ 0,00</b> <span class="muted" id="gq"></span></p>
  ${emb ? "" : `<div id="fpbox"><h3>Forma de pagamento</h3>${pagSql ? `<label style="display:flex;gap:8px;align-items:center"><input type="radio" name="fp" id="fp-agora" value="agora" checked style="width:auto"> Pagar agora de um caixa</label>
  <div id="fp-agora-box"><label for="fpcx">Caixa</label><select id="fpcx">${CXS.map(c => `<option value="${c.caixa_id}" ${c.caixa_id === prefCx ? "selected" : ""}>${esc(c.nome)}${c.somente_admin ? " (só admin)" : ""}</option>`).join("")}</select><p id="fpsaldo"></p></div>
  <label style="display:flex;gap:8px;align-items:center"><input type="radio" name="fp" id="fp-depois" value="depois" style="width:auto"> Pagar depois (a pagar ao fornecedor)</label>
  <div id="fp-depois-box" hidden><label for="fpven">Vencimento (opcional)</label><input id="fpven" type="date"></div>
  <div id="fp-quando-box" hidden><label for="fpquando">Pagar em (opcional)</label><input id="fpquando" type="date"><p class="muted">Aparece em Compras pendentes e ordena a lista. Não paga sozinho. O admin confirma o pagamento.</p></div>
  ${adm ? `<label style="display:flex;gap:8px;align-items:center"><input type="radio" name="fp" id="fp-divida" value="divida" style="width:auto"> Lançar como dívida no caixa especial</label>
  <div id="fp-divida-box" hidden><label for="fpdx">Caixa especial (só admin)</label><select id="fpdx">${CXS.filter(c => c.somente_admin).map(c => `<option value="${c.caixa_id}" ${c.caixa_id === 18 ? "selected" : ""}>${esc(c.nome)}</option>`).join("")}</select><p id="fpdsaldo"></p><p class="muted">Padrão: COMPRA PRODUTOS. Não confere o saldo. Se não houver dinheiro, o caixa fica negativo e a dívida aparece em vermelho no caixa e no extrato. O financeiro não vê este caixa. Depois, Transferir entre caixas para abater a dívida.</p></div>` : ""}` : `<p class="warn">Pagamento da compra ainda depende da atualização do banco (supabase-loja/migration-compras-pagamento.sql). Nada será salvo até lá.</p>`}</div>`}
  <p class="warn" id="pw"></p>
  <button class="btn" id="sv">Salvar</button></div>
  ${emb ? "" : `<div class="card"><h2>Últimas compras</h2><table><tr><th>Compra</th><th>Data</th><th>SKU</th><th>Fornecedor</th><th class="n">Qtd</th><th class="n">Custo un.</th><th class="n">Total</th></tr>
  ${PU.map(p => `<tr><td>${p.compra_id ? `<a href="#imei" class="cpn" data-c="${p.compra_id}">C-${String(p.compra_id).padStart(6, "0")}</a>` : "—"}</td><td>${esc(p.data)}</td><td>${esc(p.sku)}${usdBadge(p)}</td><td>${esc(p.fornecedor)}</td><td class="n">${p.qtd}</td><td class="n">${brl(p.custo_unit)}</td><td class="n">${brl(p.total)}</td></tr>`).join("") || '<tr><td colspan="7" class="muted">Nenhuma compra.</td></tr>'}</table></div>`}`;
  root.querySelectorAll(".cpn").forEach(a => a.onclick = e => { e.preventDefault(); viewImei({ numero: a.dataset.c }); });
  const dest = () => emb ? "esp" : ($("#dst") || {}).value || "loja", loja = () => !emb && dest() !== "esp";
  const sb0 = () => { $("#sv").textContent = dest() === "esp" ? "Salvar entrada no Depósito Especial" : "Salvar compra (soma ao estoque)"; };
  const OP = globalThis.BAGDA_ORIGEM;
  const num = v => Math.round(+String(v).replace(",", ".") * 100) / 100;
  const blank = () => ({ sku: "", qtd: 1, custo: "", origem: "Nacional", custo_usd: "" });
  const taxaAgora = () => { const raw = ($("#taxa") && $("#taxa").value) || ""; if (!String(raw).trim()) return { error: "Informe a taxa do dólar desta compra." }; return OP.parseCotacao(raw); };
  const custoReaisLinha = l => { if (!(loja() && l.origem === "Importado")) return num(l.custo) || 0; const taxa = taxaAgora(); if (taxa.error) return 0; const cu = OP.parseCustoUsd(l.custo_usd); if (cu.error || cu.value == null) return 0; const cr = OP.custoReaisDeUsd(cu.value, taxa.value); return cr.error ? 0 : cr.value; };
  const prevTxt = l => {
    if (!loja() || l.origem !== "Importado") return "";
    if (!String(l.custo_usd || "").trim()) return `<p class="muted lprev">Informe o custo em US$. O R$ da linha é esse valor × a taxa da compra.</p>`;
    const cu = OP.parseCustoUsd(l.custo_usd);
    if (cu.error || cu.value == null) return `<p class="warn lprev">${esc(cu.error || "Informe o custo em US$.")}</p>`;
    const taxa = taxaAgora();
    if (taxa.error) return `<p class="warn lprev">${esc(taxa.error)}</p>`;
    const cr = OP.custoReaisDeUsd(cu.value, taxa.value);
    if (cr.error) return `<p class="warn lprev">${esc(cr.error)}</p>`;
    return `<p class="muted lprev">Custo em R$: <b>${brl(cr.value)}</b> (${OP.formatUsd(cu.value)} × taxa ${OP.formatCotacao(taxa.value)})</p>`;
  };
  const syncTaxa = () => { const box = $("#taxabox"); if (!box) return; const show = loja() && L.some(l => l.origem === "Importado"); box.hidden = !show; const inp = $("#taxa"); if (show && inp && inp.dataset.auto !== "0" && cot && cot.valor) { inp.value = String(cot.valor).replace(".", ","); inp.dataset.auto = "1"; } };
  const linhaConta = l => !!(l.sku || (loja() && l.origem === "Importado" ? String(l.custo_usd || "").trim() : String(l.custo || "").trim()));
  const totalAgora = () => Math.round(L.filter(linhaConta).reduce((a, l) => a + (+l.qtd || 0) * custoReaisLinha(l), 0) * 100) / 100;
  const modoPag = () => ((document.querySelector('input[name="fp"]:checked') || {}).value) || "agora";
  const syncPag = () => { const box = $("#fpbox"); if (!box) return; box.hidden = !loja(); const modo = modoPag(); const a = $("#fp-agora-box"), d = $("#fp-depois-box"), z = $("#fp-divida-box"), q = $("#fp-quando-box"); if (a) a.hidden = modo !== "agora"; if (d) d.hidden = modo !== "depois"; if (z) z.hidden = modo !== "divida"; if (q) q.hidden = modo === "agora";
    const total = totalAgora();
    const paint = (el, cx, divida) => { if (!el) return; if (!cx) { el.innerHTML = '<span class="warn">Nenhum caixa disponível.</span>'; return; }
      if (divida) { const depois = Math.round((Number(cx.saldo) - total) * 100) / 100; el.innerHTML = `Saldo deste caixa: ${caixaSaldoHtml(cx.saldo)}${total > 0 ? `. Depois desta compra: ${caixaSaldoHtml(depois)}` : ""}. <span class="muted">Sem trava de saldo.</span>`; return; }
      const falta = total > Number(cx.saldo) + 0.001; el.innerHTML = `Saldo deste caixa: ${caixaSaldoHtml(cx.saldo)}${falta ? ` <span class="warn">Saldo insuficiente para o total ${brl(total)}.</span>` : ""}`; };
    if (modo === "divida") paint($("#fpdsaldo"), CXS.find(c => c.somente_admin && String(c.caixa_id) === String(($("#fpdx") || {}).value || "")), true);
    else if (modo === "agora") paint($("#fpsaldo"), CXS.find(c => String(c.caixa_id) === String(($("#fpcx") || {}).value || "")), false); };
  const tot = () => { const okL = L.filter(linhaConta); $("#gt").textContent = brl(okL.reduce((a, l) => a + (+l.qtd || 0) * custoReaisLinha(l), 0)); $("#gq").textContent = `${okL.length} item(ns) · ${okL.reduce((a, l) => a + (+l.qtd || 0), 0)} un.`;
    document.querySelectorAll("#lns .lt").forEach(td => { const l = L[+td.dataset.i]; td.textContent = brl((+l.qtd || 0) * custoReaisLinha(l)); }); syncPag(); };
  const drawL = focus => { $("#lns").innerHTML = L.map((l, i) => { const p = PS[l.sku]; const imp = loja() && l.origem === "Importado"; return `<div class="cl" data-i="${i}"><div class="clp"><label>Produto ${i + 1}</label><input class="pq" type="search" autocomplete="off" enterkeyhint="search" placeholder="Nome, marca, cor, GB ou SKU… (↑↓ Enter)" value="${p ? esc(nome(p)) : ""}"><ul class="sug" role="listbox"></ul><div class="muted ps">${p ? line(p) : ""}</div>
    ${loja() ? `<div class="clu"><div><label>Origem</label><select class="lo"><option value="Nacional" ${l.origem !== "Importado" ? "selected" : ""}>Nacional</option><option value="Importado" ${l.origem === "Importado" ? "selected" : ""}>Importado</option></select></div>${imp ? `<div><label>Custo (US$)</label><input class="lcu" inputmode="decimal" autocomplete="off" value="${esc(l.custo_usd ?? "")}" placeholder="Ex.: 80,00"></div>` : ""}</div>${prevTxt(l)}` : ""}</div>
    <div><label>Qtd</label><input class="lq" type="number" min="1" inputmode="numeric" value="${esc(l.qtd)}"></div><div><label>${imp ? "Custo (R$)" : "Custo un. (R$)"}</label>${imp ? `<div class="lcro n">${String(l.custo_usd || "").trim() && !taxaAgora().error ? brl(custoReaisLinha(l)) : "—"}</div>` : `<input class="lc" type="number" min="0" step="0.01" inputmode="decimal" value="${esc(l.custo)}" placeholder="${p && cm[p.sku] != null ? cm[p.sku] : ""}">`}</div>
    <div><label>Total</label><div class="lt n" data-i="${i}"></div></div><div><button type="button" class="btn ghost rm" title="Remover linha" ${L.length < 2 ? "disabled" : ""}>✕</button></div></div>`; }).join("");
    document.querySelectorAll("#lns .cl").forEach(r => { const i = +r.dataset.i, l = L[i], pq = r.querySelector(".pq");
      const paint = () => { const html = prevTxt(l); const box = r.querySelector(".lprev"); if (!html) { if (box) box.remove(); return; } if (box) box.outerHTML = html; else { const host = r.querySelector(".clu"); if (host) host.insertAdjacentHTML("afterend", html); } };
      combo(pq, r.querySelector(".sug"), q => (q ? P.filter(p => match({ sku: hay(p) }, q)) : P).slice(0, 40).map(p => ({ k: p.sku, html: line(p) + (L.some((x, j) => j !== i && x.sku === p.sku) ? '<small class="warn">já está em outra linha</small>' : "") })),
        sku => { l.sku = sku; const p = PS[sku]; if (p.fornecedor && !$("#fo").value.trim()) $("#fo").value = sp(p.fornecedor); if (loja() && p.origem === "Importado") l.origem = "Importado"; drawL(); const n = document.querySelectorAll("#lns .cl")[i]; n.querySelector(".lq").focus(); n.querySelector(".lq").select(); });
      pq.addEventListener("typed", () => { if (l.sku) { l.sku = ""; r.querySelector(".ps").innerHTML = ""; tot(); } });
      const lo = r.querySelector(".lo"); if (lo) lo.onchange = e => { l.origem = e.target.value; if (l.origem !== "Importado") { l.custo_usd = ""; } else l.custo = ""; drawL(); };
      const lcu = r.querySelector(".lcu"); if (lcu) lcu.oninput = e => { l.custo_usd = e.target.value; const cu = OP.parseCustoUsd(e.target.value); const taxa = taxaAgora(); const cell = r.querySelector(".lcro"); if (!cu.error && cu.value != null && !taxa.error) { const cr = OP.custoReaisDeUsd(cu.value, taxa.value); if (!cr.error) { l.custo = cr.value; if (cell) cell.textContent = brl(cr.value); tot(); } } else if (cell) cell.textContent = "—"; paint(); };
      r.querySelector(".lq").oninput = e => { l.qtd = e.target.value; tot(); };
      const lc = r.querySelector(".lc"); if (lc) { lc.oninput = e => { l.custo = e.target.value; tot(); }; lc.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); $("#add").click(); } }; }
      r.querySelector(".rm").onclick = () => { L.splice(i, 1); drawL(); }; });
    tot(); syncTaxa(); if (focus) { const all = document.querySelectorAll("#lns .pq"); all[all.length - 1].focus(); } };
  if ($("#dst")) $("#dst").onchange = () => { sb0(); drawL(); }; sb0();
  document.querySelectorAll('input[name="fp"]').forEach(r => r.onchange = syncPag); if ($("#fpcx")) $("#fpcx").onchange = syncPag; if ($("#fpdx")) $("#fpdx").onchange = syncPag;
  combo($("#fo"), $("#fsug"), q => { const R = [...FN.values()].filter(n => match({ sku: n }, q)).sort(coll.compare).slice(0, 30).map(n => ({ k: n, html: esc(n) })); if (sp(q).length >= 2 && !FN.has(fk(q))) R.push({ k: null, html: `<b>+ novo fornecedor:</b> ${esc(sp(q))}` }); return R; },
    k => { $("#fo").value = k == null ? sp($("#fo").value) : k; });
  $("#add").onclick = () => { L.push(blank()); drawL(true); };
  const onCot = async saved => { cot = saved || cot; if (api.costs) { try { (await api.costs() || []).forEach(r => { cm[r.sku] = Number(r.custo); }); } catch {} } if (cot && cot.valor) P.forEach(p => { if (p.origem !== "Importado" || !(Number(p.preco_usd) > 0)) return; const calc = OP.precoReaisImportado(p.preco_usd, cot.valor, cm[p.sku] != null ? cm[p.sku] : null); if (!calc.error) p.preco_venda = calc.preco; }); const inp = $("#taxa"); if (inp && inp.dataset.auto !== "0" && cot && cot.valor) { inp.value = String(cot.valor).replace(".", ","); inp.dataset.auto = "1"; } if ($("#cotacao")) cot = await mountCotacao($("#cotacao"), onCot) || cot; drawL(); };
  if ($("#cotacao")) cot = await mountCotacao($("#cotacao"), onCot);
  const taxaInp = $("#taxa"); if (taxaInp) taxaInp.oninput = () => { taxaInp.dataset.auto = "0"; const t = OP.parseCotacao(taxaInp.value); if (!t.error) L.forEach(l => { if (l.origem !== "Importado" || !String(l.custo_usd || "").trim()) return; const cu = OP.parseCustoUsd(l.custo_usd); if (cu.error || cu.value == null) return; const cr = OP.custoReaisDeUsd(cu.value, t.value); if (!cr.error) l.custo = cr.value; }); drawL(); };
  drawL();
  $("#sv").onclick = async () => { if (busy) return; const it = L.filter(l => l.sku || l.custo !== "" || String(l.custo_usd || "") !== ""), w = $("#pw");
    for (const l of it) { const n = L.indexOf(l) + 1; if (!l.sku) return w.textContent = `Linha ${n}: escolha o produto na lista`; if (!(Number.isInteger(+l.qtd) && +l.qtd > 0)) return w.textContent = `Linha ${n}: quantidade inválida`;
      if (loja() && l.origem === "Importado") { const taxa = taxaAgora(); if (taxa.error) return w.textContent = taxa.error; l.taxa_dolar = taxa.value;
          const cu = OP.parseCustoUsd(l.custo_usd); if (cu.error || cu.value == null) return w.textContent = `Linha ${n}: informe o custo em US$`; l.custo_usd = cu.value;
          const cr = OP.custoReaisDeUsd(cu.value, taxa.value); if (cr.error) return w.textContent = `Linha ${n}: ${cr.error}`; l.custo = cr.value;
          if (!(cot && Number(cot.valor) > 0)) return w.textContent = "Defina a cotação do dólar antes de salvar um importado. Nada foi salvo."; }
      else { if (loja()) { l.origem = "Nacional"; l.custo_usd = null; l.taxa_dolar = null; } if (!(num(l.custo) >= 0) || l.custo === "") return w.textContent = `Linha ${n}: informe o custo unitário`; } }
    if (!it.length) return w.textContent = "Adicione pelo menos um item";
    const fo = sp($("#fo").value), fx = fo && FN.get(fk(fo)) || fo, dt = $("#cdt").value || today(), ob = $("#ob").value.trim() || null;
    const itens = it.map(l => { const row = { sku: l.sku, qtd: +l.qtd, custo_unit: num(l.custo) }; if (loja()) { row.origem = l.origem === "Importado" ? "Importado" : "Nacional"; if (row.origem === "Importado") { row.taxa_dolar = l.taxa_dolar; row.custo_usd = l.custo_usd; } } return row; });
    const semOrigem = rows => rows.map(({ origem, custo_usd, taxa_dolar, ...r }) => r);
    const pendente = e => !!(e && (e.norpc || /PGRST202|could not find the function|does not exist|schema cache|registrar_compra_origem/i.test(e.message || "")));
    busy = true; $("#sv").disabled = true; w.textContent = "Salvando…";
    if (fx.length >= 2 && api.salvarFornecedor && !inTab.has(fk(fx))) await api.salvarFornecedor(null, { nome: fx }).catch(() => {});
    if (dest() === "esp") { const mot = ["Compra", fx, dt !== today() ? dt : "", ob].filter(Boolean).join(" · ").slice(0, 200);
      try { if (!api.depEspLote) throw Object.assign(new Error("sem rpc"), { norpc: 1 }); await api.depEspLote({ fornecedor: fx || null, data: dt, observacao: ob, motivo: mot }, semOrigem(itens)); toast(`Entrada salva ✓ ${itens.length} item(ns) no Depósito Especial`); return again(itens); }
      catch (e) { if (!pendente(e)) { busy = false; $("#sv").disabled = false; w.textContent = e.message; return; } }
      const fl = []; for (const [i, x] of semOrigem(itens).entries()) { w.textContent = `Salvando item ${i + 1}/${itens.length} no Depósito Especial…`; try { await api.depEspEntrada(x.sku, x.qtd, x.custo_unit, mot); } catch (er) { fl.push({ ...x, erro: er.message }); } }
      busy = false; $("#sv").disabled = false; if (!fl.length) { toast(`Entrada salva ✓ ${itens.length} item(ns) no Depósito Especial`); return again(itens); }
      L = fl.map(f => ({ sku: f.sku, qtd: f.qtd, custo: f.custo_unit, origem: "Nacional", custo_usd: "" })); drawL(); w.innerHTML = `${itens.length - fl.length} de ${itens.length} salvos. <b>Falharam ${fl.length}</b> (ficaram no carrinho):<br>` + fl.map(f => `• ${esc(f.sku)} × ${f.qtd}: ${esc(f.erro)}`).join("<br>"); return; }
    const hd = { fornecedor: fx || null, data: dt, observacao: ob }; if (itens.some(x => x.origem === "Importado")) hd.taxa_dolar = itens.find(x => x.origem === "Importado").taxa_dolar;
    const okCompra = rs => { toast(`Compra ${rs && rs.numero ? rs.numero + " " : ""}salva ✓ ${itens.length} item(ns)`); if (!emb && rs && rs.numero && api.compraDetalhe) return viewComprovante(rs.numero, true); return again(); };
    const totalCompra = Math.round(itens.reduce((a, l) => a + l.qtd * l.custo_unit, 0) * 100) / 100;
    if (!pagSql) { busy = false; $("#sv").disabled = false; w.textContent = "Pagamento da compra ainda depende da atualização do banco (supabase-loja/migration-compras-pagamento.sql). Nada foi salvo."; return; }
    const modo = modoPag();
    if (modo === "depois") { hd.pagamento = "depois"; if ($("#fpven") && $("#fpven").value) hd.vencimento = $("#fpven").value; if ($("#fpquando") && $("#fpquando").value) hd.pagar_em = $("#fpquando").value; }
    else if (modo === "divida") { if (me.role !== "admin") { busy = false; $("#sv").disabled = false; w.textContent = "Só admin lança dívida no caixa especial. Nada foi salvo."; return; }
      const cx = CXS.find(c => c.somente_admin && String(c.caixa_id) === String(($("#fpdx") || {}).value || "")); if (!cx) { busy = false; $("#sv").disabled = false; w.textContent = "Escolha o caixa especial. Nada foi salvo."; return; }
      hd.pagamento = "divida"; hd.caixa_id = cx.caixa_id; if ($("#fpquando") && $("#fpquando").value) hd.pagar_em = $("#fpquando").value; }
    else { const cx = CXS.find(c => String(c.caixa_id) === String(($("#fpcx") || {}).value || "")); if (!cx) { busy = false; $("#sv").disabled = false; w.textContent = "Escolha o caixa. Nada foi salvo."; return; }
      if (totalCompra > Number(cx.saldo) + 0.001) { busy = false; $("#sv").disabled = false; w.textContent = "Saldo insuficiente no caixa (R$ " + Number(cx.saldo).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "). Nada foi salvo."; return; }
      hd.pagamento = "agora"; hd.caixa_id = cx.caixa_id; }
    try { if (!api.compraPagamento) throw Object.assign(new Error("sem rpc"), { norpc: 1 }); const rs = await api.compraPagamento(hd, itens);
      if (rs && rs.pagamento_ok === false) throw new Error("O banco gravou a compra sem a forma de pagamento. Avise o admin."); return await okCompra(rs); }
    catch (e) { busy = false; $("#sv").disabled = false; w.textContent = (e.norpc || /PGRST202|could not find the function|does not exist|schema cache|registrar_compra_pagamento|migration-compras-pagamento/i.test(e.message || "")) ? "Pagamento da compra ainda depende da atualização do banco (supabase-loja/migration-compras-pagamento.sql). Nada foi salvo." : e.message; } };
}
// ---------- Compras numeradas + IMEI ----------
const CEL = /iphone|celular|smartphone|galaxy|redmi|poco|xiaomi.*note|motorola|moto ?[geg]\d|realme|pixel/i, isCel = it => CEL.test(`${it.marca} ${it.produto} ${it.sku}`);
const luhn = s => { let t = 0; for (let i = 0; i < 15; i++) { let d = +s[14 - i]; if (i % 2) { d *= 2; if (d > 9) d -= 9; } t += d; } return t % 10 === 0; };
async function viewImei(o = {}) {
  const adm = me.role === "admin", ed = can("admin|estoque"); if (!api.comprasListar) { app.innerHTML = '<div class="card"><h2>Compras & IMEI</h2><p class="warn">Indisponível.</p></div>'; return; }
  navMark("imei"); history.replaceState(null, "", location.pathname + location.search + "#imei");
  let C, err = ""; try { C = await api.comprasListar(o.q || ""); } catch (e) { if (/PGRST202|could not find the function|schema cache|does not exist/i.test(e.message)) { app.innerHTML = '<div class="card"><h2>Compras & IMEI</h2><p class="warn">Ainda não instalado no banco (falta rodar migration-compras-imei.sql).</p></div>'; return; } C = []; err = e.message; }
  app.innerHTML = `<div class="card"><h2>🔎 Buscar IMEI</h2><div class="grid"><div><label>IMEI (mín. 4 dígitos)</label><input id="iq" inputmode="numeric" autocomplete="off" placeholder="Ex.: 356938035643809" value="${esc(o.iq || "")}"></div><div><label>&nbsp;</label><button class="btn" id="ib">Buscar</button></div></div><div id="ir"></div></div>
  <div class="card" id="cd"></div>
  <div class="card"><h2>Compras</h2><div class="grid"><div><label>Filtrar (número, fornecedor, produto)</label><input id="cq" type="search" value="${esc(o.q || "")}" placeholder="C-000012, fornecedor, iPhone…"></div></div>${err ? `<p class="warn">${esc(err)}</p>` : ""}
  <div style="overflow-x:auto"><table><tr><th>Compra</th><th>Data</th><th>Fornecedor</th><th class="n">Itens</th><th class="n">Un.</th>${adm ? '<th class="n">Total</th>' : ""}<th class="n">IMEIs</th><th>Recebido</th><th></th></tr>
  ${C.map(c => `<tr><td><b>${esc(c.numero)}</b></td><td>${esc(c.data)}</td><td>${esc(c.fornecedor || "—")}</td><td class="n">${c.itens}</td><td class="n">${c.unidades}</td>${adm ? `<td class="n">${brl(c.total)}</td>` : ""}<td class="n">${c.imeis}</td><td>${stB(c)}</td><td><button class="btn ghost op" data-n="${esc(c.numero)}">Abrir</button>${adm ? ` <button class="btn ghost cpv" data-n="${esc(c.numero)}">Comprovante</button>` : ""}</td></tr>`).join("") || '<tr><td colspan="9" class="muted">Nenhuma compra.</td></tr>'}</table></div></div>`;
  const busca = async () => { const q = $("#iq").value.replace(/\D/g, ""), r = $("#ir"); try { const R = await api.imeiBuscar(q);
      r.innerHTML = R.length ? `<div style="overflow-x:auto"><table><tr><th>IMEI</th><th>Compra</th><th>Fornecedor</th><th>Data</th><th>Produto</th>${adm ? '<th class="n">Custo un.</th>' : ""}</tr>${R.map(x => `<tr><td>${esc(x.imei1)}${x.imei2 ? `<br><small>${esc(x.imei2)}</small>` : ""}</td><td><a href="#imei" class="opn" data-n="${esc(x.numero)}"><b>${esc(x.numero)}</b></a> · un. ${x.slot}</td><td><b>${esc(x.fornecedor || "—")}</b></td><td>${esc(x.data)}</td><td>${esc(x.marca)} ${esc(x.produto)}${x.tamanho ? " " + esc(x.tamanho) : ""}<br><small>${esc(x.sku)}</small></td>${adm ? `<td class="n">${brl(x.custo_unit)}</td>` : ""}</tr>`).join("")}</table></div>` : '<p class="warn">Nenhum aparelho com esse IMEI.</p>';
      r.querySelectorAll(".opn").forEach(a => a.onclick = e => { e.preventDefault(); abrir(a.dataset.n); }); } catch (e) { r.innerHTML = `<p class="warn">${esc(e.message)}</p>`; } };
  $("#ib").onclick = busca; $("#iq").onkeydown = e => { if (e.key === "Enter") busca(); }; if (o.iq) busca();
  let t; $("#cq").oninput = e => { clearTimeout(t); t = setTimeout(() => viewImei({ q: e.target.value, iq: $("#iq").value }).then(() => { const i = $("#cq"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }), 350); };
  document.querySelectorAll(".op").forEach(b => b.onclick = () => abrir(b.dataset.n)); document.querySelectorAll(".cpv").forEach(b => b.onclick = () => viewComprovante(b.dataset.n));
  async function abrir(n, nova) { const cd = $("#cd"); cd.hidden = false; let D; try { D = await api.compraDetalhe(n); } catch (e) { cd.innerHTML = `<p class="warn">${esc(e.message)}</p>`; return; }
    const tudo = cd.dataset.all === "1", its = D.itens.filter(it => tudo || isCel(it) || it.imeis.length);
    cd.innerHTML = `<h2>Compra ${esc(D.numero)} ${stB(D)}${adm ? ` <button class="btn ghost" id="cpv1" style="float:right;margin:0">🖨 Comprovante</button>` : ""}</h2>${nova ? '<p class="ok">✓ Compra salva. Cadastre os IMEIs dos celulares agora ou depois (Compras & IMEI).</p>' : ""}
      <p><b>Fornecedor:</b> ${esc(D.fornecedor || "—")} · <b>Data:</b> ${esc(D.data)}${D.observacao ? ` · ${esc(D.observacao)}` : ""}</p>
      <p class="muted">${D.itens.map(it => `${esc(it.marca)} ${esc(it.produto)}${it.tamanho ? " " + esc(it.tamanho) : ""} × ${it.qtd}${adm ? ` · ${brl(it.custo_unit)}` : ""} · recebido ${it.recebidos ?? it.imeis.length}/${it.qtd}${CEL.test(`${it.marca} ${it.produto} ${it.sku}`) ? "" : ed && it.status !== "completo" || ed && it.recebido_sem_imei ? ` <button class="btn ghost rcv" data-p="${it.purchase_id}" data-q="${it.qtd - it.imeis.length}" style="margin:0;padding:2px 8px">Receber sem IMEI</button>` : ""}`).join("<br>")}</p>
      <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="all" style="width:auto" ${tudo ? "checked" : ""}> Mostrar todos os itens (não só celulares)</label>
      ${its.map(it => { const M = Object.fromEntries(it.imeis.map(i => [i.slot, i])); return `<div class="card ii" data-p="${it.purchase_id}"><h3>${esc(it.marca)} ${esc(it.produto)}${it.tamanho ? " " + esc(it.tamanho) : ""} <small class="muted">${esc(it.sku)} · ${it.qtd} un. · ${it.imeis.length}/${it.qtd} com IMEI</small> ${stB(it)}</h3>
        ${ed && (it.recebidos ?? it.imeis.length) < it.qtd ? `<div class="grid bx"><div><label>Baixar IMEI (bipe ou digite — vai para a próxima unidade livre)</label><input class="b1" inputmode="numeric" maxlength="20" placeholder="IMEI 1 (15 dígitos)"><small class="w"></small></div><div><label>IMEI 2 (opcional)</label><input class="b2" inputmode="numeric" maxlength="20" placeholder="IMEI 2"><small class="w"></small></div><div><label>&nbsp;</label><button class="btn gold bb">Baixar</button> <span class="warn bs"></span></div></div>` : ""}
        <table><tr><th>Un.</th><th>IMEI 1</th><th>IMEI 2 (opcional)</th></tr>${Array.from({ length: it.qtd }, (_, k) => k + 1).map(sl => `<tr data-s="${sl}"><td>${sl}</td><td><input class="i1" inputmode="numeric" maxlength="20" value="${esc((M[sl] || {}).imei1 || "")}" ${ed ? "" : "readonly"}><small class="w"></small></td><td><input class="i2" inputmode="numeric" maxlength="20" value="${esc((M[sl] || {}).imei2 || "")}" placeholder="IMEI 2 (opcional)" ${ed ? "" : "readonly"}><small class="w"></small></td></tr>`).join("")}</table>
        ${ed ? '<button class="btn sv">Salvar IMEIs deste item</button> <span class="warn st"></span>' : ""}</div>`; }).join("") || '<p class="muted">Nenhum celular nesta compra. Marque "Mostrar todos os itens" para cadastrar IMEI de outro item.</p>'}`;
    cd.querySelector("#all").onchange = e => { cd.dataset.all = e.target.checked ? "1" : ""; abrir(n); };
    const chk = inp => { const v = inp.value.replace(/\D/g, ""), w = inp.nextElementSibling; w.className = "w"; w.textContent = !v ? "" : v.length !== 15 ? `${v.length}/15 dígitos` : luhn(v) ? "✓" : "⚠ dígito verificador não confere (confira)"; if (v && v.length !== 15) w.className = "w warn"; };
    cd.querySelectorAll(".i1,.i2,.b1,.b2").forEach(i => { chk(i); i.oninput = () => chk(i); });
    const c1 = cd.querySelector("#cpv1"); if (c1) c1.onclick = () => viewComprovante(D.numero);
    cd.querySelectorAll(".rcv").forEach(b => b.onclick = async () => { const it = D.itens.find(x => x.purchase_id === +b.dataset.p), v = prompt(`Quantas unidades SEM IMEI chegaram de ${it.marca} ${it.produto}? (máx. ${b.dataset.q})`, b.dataset.q); if (v == null) return; try { await api.itemReceber(it.purchase_id, +v); toast("Recebimento salvo ✓"); abrir(n); } catch (e) { toast(e.message); } });
    cd.querySelectorAll(".ii").forEach(box => { const bb = box.querySelector(".bb"); if (!bb) return; const b1 = box.querySelector(".b1"), b2 = box.querySelector(".b2"), bs = box.querySelector(".bs");
      const go1 = async () => { const a = b1.value.replace(/\D/g, ""), c = b2.value.replace(/\D/g, ""); if (a.length !== 15 || (c && c.length !== 15)) return bs.textContent = "IMEI precisa ter 15 dígitos"; bb.disabled = true; bs.textContent = "Baixando…";
        try { const r = await api.imeiBaixar(+box.dataset.p, a, c); toast(`IMEI baixado ✓ unidade ${r.slot} · ${r.recebidos}/${r.qtd}${r.status === "completo" ? " · COMPLETO" : ""}`); await abrir(n); const nb = cd.querySelector(`.ii[data-p="${box.dataset.p}"] .b1`); if (nb) nb.focus(); } catch (e) { bb.disabled = false; bs.textContent = e.message; } };
      bb.onclick = go1; b1.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); b2.value ? go1() : go1(); } }; });
    cd.querySelectorAll(".ii").forEach(box => { const b = box.querySelector(".sv"); if (!b) return; b.onclick = async () => { const st = box.querySelector(".st"), sl = [...box.querySelectorAll("tr[data-s]")].map(tr => ({ slot: +tr.dataset.s, imei1: tr.querySelector(".i1").value.replace(/\D/g, ""), imei2: tr.querySelector(".i2").value.replace(/\D/g, "") }));
      const bad = sl.find(s => (s.imei1 && s.imei1.length !== 15) || (s.imei2 && s.imei2.length !== 15) || (!s.imei1 && s.imei2)); if (bad) return st.textContent = `Unidade ${bad.slot}: IMEI precisa ter 15 dígitos (IMEI 1 obrigatório se tiver IMEI 2)`;
      const all = sl.flatMap(s => [s.imei1, s.imei2]).filter(Boolean), dup = all.find((v, i) => all.indexOf(v) !== i); if (dup) return st.textContent = `IMEI repetido nesta lista: ${dup}`;
      b.disabled = true; st.textContent = "Salvando…"; try { const r = await api.imeiSalvar(+box.dataset.p, sl); toast(`IMEIs salvos ✓ ${r.salvos}${r.removidos ? ` · removidos ${r.removidos}` : ""}`); abrir(n); } catch (e) { b.disabled = false; st.textContent = e.message; } }; });
    cd.scrollIntoView({ behavior: "smooth", block: "start" }); }
  $("#cd").hidden = true; if (o.numero) await abrir(o.numero, o.nova);
}
const stB = x => x && x.status ? `<span class="badge ${x.status === "completo" ? "ok-b" : "pend-b"}">${x.status === "completo" ? "✓ completo" : `pendente${x.recebidos != null && (x.unidades ?? x.qtd) != null ? ` ${x.recebidos}/${x.unidades ?? x.qtd}` : ""}`}</span>` : "";
const compraTxt = (D, usr) => { const W = rcW(), TZ = "America/Sao_Paulo", dt = D.created_at ? new Date(D.created_at) : null, E = "=".repeat(W), Dd = "-".repeat(W);
  const tot = D.itens.reduce((a, i) => a + Number(i.total ?? i.qtd * i.custo_unit), 0), qt = D.itens.reduce((a, i) => a + Number(i.qtd), 0);
  const L = [rcC("BAGDA STORES"), E, "COMPRAS",
    rcL("Data emissao: " + (dt ? dt.toLocaleDateString("pt-BR", { timeZone: TZ }) : String(D.data || "").split("-").reverse().join("/")), dt ? dt.toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }) : ""),
    "Numero...: " + D.numero, rcWrap("Usuario..: " + (D.usuario || usr || "-")), rcWrap("Fornec...: " + (D.fornecedor || "-")), "Deposito.: " + (D.deposito === "especial" ? "DEPOSITO ESPECIAL" : "LOJA"),
    ...(D.observacao ? [rcWrap("Obs......: " + D.observacao)] : []), E,
    "Codigo Produto / Variante", rc3("Qtd", "Preco unit", "Valor"), Dd,
    ...D.itens.flatMap(i => [rcWrap([i.sku, i.marca, i.produto, i.tamanho].filter(Boolean).join(" ").toUpperCase()), rc3(i.qtd + " Un", rnum(i.custo_unit), rnum(i.total ?? i.qtd * i.custo_unit))]), Dd,
    rcL("Itens: " + D.itens.length, "Unidades: " + qt), Dd,
    rcL("Total:", rnum(tot)), rcL("Desc.:", rnum(D.desconto || 0)), rcL("TOTAL:", "R$ " + rnum(tot - Number(D.desconto || 0))), Dd,
    rcWrap("Pago: " + (D.forma_pagamento || "NAO INFORMADO")), E, "", "", "Conferido: ____________________", "", "", "Responsavel: __________________", "", "", "", ".", ""];
  return `<div class="recibo"><pre class="rpre">${rcEsc(L.map(l => l.split("\n").map(x => x.slice(0, W)).join("\n")).join("\n"))}</pre></div>`; };
async function viewComprovante(n, nova) {
  if (me.role !== "admin") return viewImei();
  navMark("imei"); history.replaceState(null, "", location.pathname + location.search + "#imei");
  let D; try { D = await api.compraDetalhe(n); } catch (e) { app.innerHTML = `<div class="card"><p class="warn">${esc(e.message)}</p></div>`; return; }
  app.innerHTML = `<div class="noprint" style="margin-bottom:12px">${nova ? `<p class="ok" style="color:#1a7f37"><b>✓ Compra ${esc(D.numero)} salva.</b></p>` : ""}<button class="btn gold" id="pr">🖨️ ${nova ? "Imprimir de novo" : "Imprimir"}</button> ${nova ? '<button class="btn ghost" id="cpn">Nova compra</button> ' : ""}<button class="btn ghost" id="cpi">${nova ? "Cadastrar IMEIs agora" : "Voltar para Compras &amp; IMEI"}</button> <button class="btn ghost" id="cpa">Versao A4</button></div>
  ${compraTxt(D, D.usuario ? "" : (nova ? me.handle : ""))}`;
  $("#pr").onclick = () => window.print(); $("#cpi").onclick = () => viewImei({ numero: D.numero, nova }); $("#cpa").onclick = () => viewComprovanteA4(D.numero);
  if ($("#cpn")) $("#cpn").onclick = () => go("compras");
  if (nova) setTimeout(() => window.print(), 350);
}
async function viewComprovanteA4(n, nova) {
  if (me.role !== "admin") return viewImei();
  navMark("imei"); history.replaceState(null, "", location.pathname + location.search + "#imei");
  let D; try { D = await api.compraDetalhe(n); } catch (e) { app.innerHTML = `<div class="card"><p class="warn">${esc(e.message)}</p></div>`; return; }
  const tot = D.itens.reduce((a, i) => a + Number(i.total ?? i.qtd * i.custo_unit), 0), un = D.itens.reduce((a, i) => a + +i.qtd, 0), dd = D.created_at ? new Date(D.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : String(D.data || "").split("-").reverse().join("/");
  app.innerHTML = `<div class="card noprint">${nova ? `<p class="ok" style="color:#1a7f37"><b>✓ Compra ${esc(D.numero)} salva.</b> Imprima o comprovante abaixo.</p>` : ""}<button class="btn gold" id="cpp">Imprimir A4</button> <button class="btn ghost" id="cpt">Voltar ao cupom 80mm</button> ${nova ? '<button class="btn ghost" id="cpn">Nova compra</button> ' : ""}<button class="btn ghost" id="cpi">${nova ? "Cadastrar IMEIs agora" : "Voltar para Compras &amp; IMEI"}</button></div>
  <div class="cpa4"><div class="cph"><div><b class="cpl">BAGDA STORES</b><br><b class="cpt2">Comprovante de Compra</b></div><div class="cpn">Compra <b>${esc(D.numero)}</b><br>Data/hora: <b>${esc(dd)}</b></div></div>
  <table class="cpi2"><tr><td><b>Fornecedor:</b> ${esc(D.fornecedor || "—")}</td><td><b>Emitido em:</b> ${esc(new Date().toLocaleString("pt-BR"))} por ${esc(me.handle)}</td></tr>${D.observacao ? `<tr><td colspan="2"><b>Observação:</b> ${esc(D.observacao)}</td></tr>` : ""}</table>
  <table class="cpt"><thead><tr><th>#</th><th>SKU</th><th>Produto / variante</th><th class="n">Qtd</th><th class="n">Custo unit.</th><th class="n">Subtotal</th></tr></thead><tbody>
  ${D.itens.map((i, k) => `<tr><td>${k + 1}</td><td>${esc(i.sku)}</td><td>${esc(i.marca)} ${esc(i.produto)}${i.tamanho ? ` — ${esc(i.tamanho)}` : ""}</td><td class="n">${i.qtd}</td><td class="n">${brl(i.custo_unit)}</td><td class="n">${brl(i.total ?? i.qtd * i.custo_unit)}</td></tr>`).join("")}</tbody>
  <tfoot><tr><td colspan="3"><b>${D.itens.length}</b> item(ns)</td><td class="n"><b>${un}</b></td><td class="n">TOTAL</td><td class="n"><b>${brl(tot)}</b></td></tr></tfoot></table>
  <div class="cps"><div><span></span>Responsável pela compra</div><div><span></span>Conferido / recebido (estoque)</div><div><span></span>Fornecedor</div></div>
  <p class="cpf">Documento interno · não é nota fiscal · ${esc(D.numero)}</p></div>`;
  $("#cpp").onclick = () => window.print(); $("#cpt").onclick = () => viewComprovante(D.numero); $("#cpi").onclick = () => viewImei({ numero: D.numero, nova }); if ($("#cpn")) $("#cpn").onclick = () => go("compras");
}
const DEPT = { entrada: "Entrada", ajuste: "Ajuste", para_loja: "→ Loja", da_loja: "← Loja" };
async function viewDepEsp(o = {}) {
  if (!can("admin|estoque")) return viewSeguranca(); const adm = me.role === "admin";
  let D, M, eD = "", eM = ""; try { [D, M] = await Promise.all([api.depEsp().catch(e => { if (/PGRST20[25]|schema cache|does not exist|could not find/i.test(e.message)) throw e; eD = e.message; return []; }), api.depEspMov().catch(e => { eM = e.message; return []; })]); }
  catch (e) { if (/PGRST20[25]|schema cache|does not exist|could not find/i.test(e.message)) { app.innerHTML = `<div class="card"><h2>Depósito Especial</h2><p class="warn">Depósito Especial ainda não instalado no banco (falta rodar migration-deposito-especial.sql).</p></div>`; return; } throw e; }
  const P = (await api.products()).filter(p => p.ativo !== false), sv = new Set((o.saved || []).map(x => x.sku));
  const tq = D.reduce((a, d) => a + +d.qtd, 0), tv = D.reduce((a, d) => a + d.qtd * d.custo, 0);
  app.innerHTML = `<div class="card"><h2>Depósito Especial <span class="muted" style="font-size:.6em">(${adm ? "só admin" : "estoque · sem custos"} · não aparece no Estoque da loja nem na Nova nota)</span></h2>
  <input id="b" type="search" autocomplete="off" placeholder="Buscar produto, marca ou SKU…">${eD ? `<p class="warn">Erro ao carregar o Depósito Especial: ${esc(eD)}</p>` : ""}${sv.size ? `<p class="ok" style="color:#1a7f37"><b>✓ Entrada salva:</b> ${o.saved.map(x => `${esc(x.sku)} +${x.qtd}`).join(", ")} (destacados abaixo)</p>` : ""}<table id="dt"></table><p class="muted">Total: <b>${tq}</b> un.${adm ? ` · Valor a custo: <b>${brl(tv)}</b>` : ""}</p></div>
  ${adm ? '<div id="cartesp"></div>' : ""}
  <div class="card"><h2>Transferir</h2><form id="ft"><label>Produto</label><input id="tsq" type="search" autocomplete="off" placeholder="Nome, marca, SKU… (↑↓ Enter)"><ul id="tsug" class="sug"></ul><input type="hidden" id="ts">
  <div class="grid"><div><label>Direção</label><select id="td"><option value="para_loja">Depósito Especial → Loja</option><option value="da_loja">Loja → Depósito Especial</option></select></div><div><label>Qtd</label><input id="tq" type="number" min="1" required></div><div><label>Observação</label><input id="to" maxlength="200"></div></div><button class="btn gold">Transferir</button></form></div>
  <div class="card"><h2>Movimentos</h2><table><tr><th>Data</th><th>SKU</th><th>Tipo</th><th class="n">Qtd</th><th class="n">Antes → Depois</th><th>Motivo</th><th>Por</th></tr>
  ${eM ? `<tr><td colspan="7" class="warn">Erro ao carregar movimentos: ${esc(eM)}</td></tr>` : ""}${M.map(m => `<tr><td>${esc(new Date(m.created_at).toLocaleString("pt-BR"))}</td><td>${esc(m.sku)}</td><td>${DEPT[m.tipo] || esc(m.tipo)}</td><td class="n">${m.qtd > 0 ? "+" : ""}${m.qtd}</td><td class="n">${m.qtd_antes} → ${m.qtd_depois}</td><td>${esc(m.motivo)}</td><td>${esc(m.handle || "")}</td></tr>`).join("") || '<tr><td colspan="7" class="muted">Nenhum movimento.</td></tr>'}</table></div>`;
  const draw = () => { const L = D.filter(d => match(d, $("#b").value)); $("#dt").innerHTML = `<tr><th>SKU</th><th>Produto</th><th class="n">Qtd especial</th>${adm ? '<th class="n">Custo médio</th><th class="n">Total</th>' : ""}<th class="n">Loja</th><th></th></tr>` +
    (L.map(d => `<tr${sv.has(d.sku) ? ' style="background:#e6f6ea"' : ""}><td>${esc(d.sku)}</td><td>${esc(d.marca)} ${esc(d.produto)} ${esc(d.tamanho || "")}</td><td class="n"><b>${d.qtd}</b></td>${adm ? `<td class="n">${brl(d.custo)}</td><td class="n">${brl(d.qtd * d.custo)}</td>` : ""}<td class="n">${d.estoque_loja}</td><td><button class="btn ghost aj" data-s="${esc(d.sku)}" style="margin:0">Ajustar</button></td></tr>`).join("") || `<tr><td colspan="7" class="${eD ? "warn" : "muted"}">${eD ? "Não foi possível carregar (veja o erro acima)." : $("#b").value ? "Nada encontrado." : "Nada no Depósito Especial ainda — use a Entrada abaixo."}</td></tr>`);
    app.querySelectorAll(".aj").forEach(b => b.onclick = () => ajustar(D.find(d => d.sku === b.dataset.s))); };
  const ajustar = d => { const o = document.createElement("div"); o.className = "nmodal"; o.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:99";
    o.innerHTML = `<div class="card" style="max-width:460px;margin:0"><h2>Ajustar / remover</h2><p><b>${esc(d.sku)}</b> · ${esc(d.marca)} ${esc(d.produto)}<br>Hoje: <b>${d.qtd}</b> un.</p><label>Nova quantidade</label><input id="aq" type="number" min="0" value="${d.qtd}"><label>Motivo *</label><input id="am" maxlength="200" placeholder="Ex.: contagem, avaria, retirada"><p class="warn" id="aw" style="min-height:1em"></p><button class="btn ghost" id="an">Voltar</button> <button class="btn gold" id="ay">Salvar ajuste</button></div>`;
    document.body.append(o); o.querySelector("#an").onclick = () => o.remove(); o.querySelector("#aq").focus();
    o.querySelector("#ay").onclick = async () => { const q = +o.querySelector("#aq").value, m = o.querySelector("#am").value.trim(); if (!(Number.isInteger(q) && q >= 0)) { o.querySelector("#aw").textContent = "Quantidade inválida"; return; } if (m.length < 3) { o.querySelector("#aw").textContent = "Informe o motivo (mín. 3 letras)"; return; }
      try { await api.depEspAjuste(d.sku, q, m); o.remove(); toast("Ajuste salvo ✓"); viewDepEsp(); } catch (e) { o.querySelector("#aw").textContent = e.message; } }; };
  $("#b").oninput = draw; draw();
  if (adm) await viewCompras({ root: $("#cartesp"), dest: "esp", onSaved: itens => viewDepEsp({ saved: itens }) });
  const tl = p => `<b>${esc(p.marca)} ${esc(p.produto)} ${esc(p.tamanho || "")}</b><small>${esc(p.sku)} · loja ${+p.estoque || 0} · especial ${(D.find(d => d.sku === p.sku) || {}).qtd || 0}</small>`;
  combo($("#tsq"), $("#tsug"), q => (q ? P.filter(p => match(p, q)) : P).slice(0, 40).map(p => ({ k: p.sku, html: tl(p) })), k => { const p = P.find(x => x.sku === k); $("#ts").value = k; $("#tsq").value = `${p.marca} ${p.produto} ${p.tamanho || ""} · ${k}`; $("#tq").focus(); });
  $("#tsq").addEventListener("typed", () => { $("#ts").value = ""; });
  $("#ft").onsubmit = async ev => { ev.preventDefault(); if (!$("#ts").value) return toast("Escolha o produto na lista"); const sku = $("#ts").value, q = +$("#tq").value, dir = $("#td").value;
    if (!await confirmBox(`Transferir <b>${q}</b> un. de <b>${esc(sku)}</b> ${dir === "para_loja" ? "do Depósito Especial para a <b>Loja</b> (passa a aparecer no Estoque e na Nova nota)" : "da Loja para o <b>Depósito Especial</b> (sai do Estoque da loja)"}?`)) return;
    try { await api.depEspTransf(sku, q, dir, $("#to").value.trim()); toast("Transferência feita ✓"); viewDepEsp(); } catch (e) { toast(e.message); } };
}
async function viewProdutos() {
  const [P, K, modo] = await Promise.all([api.products(), api.costs(), api.custosLoja ? api.custosLoja().catch(() => null) : null]); const cm = Object.fromEntries(K.map(k => [k.sku, k.custo]));
  const sit = Object.fromEntries((modo || []).map(x => [x.sku, x]));
  const OP = globalThis.BAGDA_ORIGEM;
  app.innerHTML = `<div id="cotacao"></div><div class="card"><h2>Produtos e custos (admin) <button class="btn" id="csv" style="float:right;margin:0">Exportar CSV</button></h2><input id="b" type="search" autocomplete="off" placeholder="Buscar produto, marca ou SKU…"><table id="pt"></table></div>
  <div class="card"><h2>Adicionar / editar produto</h2><p class="muted">Nacional: o preço em R$ é o que você digitar e a cotação não mexe nele. Importado: o preço em R$ é o US$ × cotação, com a regra ,99.</p><form id="f"><div class="grid"><div><label>SKU</label><input id="sku" required pattern="[A-Z0-9-]{3,20}"></div><div><label>Marca</label><input id="ma" required></div><div><label>Produto</label><input id="pr" required></div><div><label>Tamanho</label><input id="ta"></div><div><label for="og">Origem</label><select id="og"><option value="Nacional">Nacional</option><option value="Importado">Importado</option></select></div><div id="usdbox" hidden><label for="pu">Preço (US$)</label><input id="pu" inputmode="decimal" autocomplete="off" placeholder="Ex.: 199,00"><p class="muted" id="puprev"></p></div><div><label for="pv">Preço de venda (R$)</label><input id="pv" inputmode="decimal"></div><div><label>Custo (R$, só admin vê)</label><input id="cu" inputmode="decimal" autocomplete="off"></div><div><label>Estoque mínimo</label><input id="em" type="number" value="2"></div></div><button class="btn">Salvar</button></form></div>`;
  const cot = await mountCotacao($("#cotacao"), () => viewProdutos());
  const head = `<tr><th>SKU</th><th>Produto</th><th class="n">Custo</th><th class="n">Venda</th><th class="n">Margem</th><th class="n">Estoque</th><th></th></tr>`;
  const custoTag = p => { const s = sit[p.sku]; if (!s || p.origem !== "Importado") return ""; if (s.situacao === "cotacao") return `<br><small class="muted">segue a cotação</small>`; if (s.situacao === "travado") return `<br><small class="muted">travado${s.cambio ? " em " + OP.formatCotacao(s.cambio) : ""}</small>`; if (s.situacao === "misto") return `<br><small class="muted">média travado + cotação</small>`; return ""; };
  const drawP = () => { $("#pt").innerHTML = head + P.filter(p => match(p, $("#b").value)).map(p => { const c = cm[p.sku]; return `<tr><td>${esc(p.sku)}</td><td>${esc(p.marca)} ${esc(p.produto)} ${esc(p.tamanho || "")}${usdBadge(p)}</td><td class="n">${c != null ? brl(c) : "—"}${custoTag(p)}</td><td class="n">${brl(p.preco_venda)}${p.origem === "Importado" && p.preco_usd != null ? `<br><small>${OP.formatUsd(p.preco_usd)}</small>` : ""}</td><td class="n">${c ? ((p.preco_venda - c) / p.preco_venda * 100).toFixed(0) + "%" : "—"}</td><td class="n">${p.estoque}</td><td><button type="button" class="btn ghost epd" data-sku="${esc(p.sku)}" style="margin:0">Editar</button></td></tr>`; }).join(""); };
  const custoAtual = () => { const raw = $("#cu").value.trim(); if (!raw) return cm[$("#sku").value] != null ? cm[$("#sku").value] : null; const c = globalThis.BAGDA_CUSTO.parseCusto(raw); return c.error ? null : c.value; };
  const sync = () => { const imp = $("#og").value === "Importado"; $("#usdbox").hidden = !imp; $("#pv").readOnly = imp; $("#puprev").textContent = ""; if (!imp) return;
    const u = OP.parseUsd($("#pu").value); if (!$("#pu").value.trim()) { $("#pv").value = ""; $("#puprev").textContent = "Informe o preço em US$."; return; } if (u.error) { $("#pv").value = ""; $("#puprev").textContent = u.error; return; }
    if (!(cot && cot.valor)) { $("#pv").value = ""; $("#puprev").textContent = "Defina a cotação do dólar para calcular o R$."; return; }
    const calc = OP.precoReaisImportado(u.value, cot.valor, custoAtual()); if (calc.error) { $("#pv").value = ""; $("#puprev").textContent = calc.error; return; }
    $("#pv").value = (Math.round(calc.preco * 100) / 100).toFixed(2); $("#puprev").textContent = calc.aplicado99 ? "R$ com a regra ,99." : "Valor redondo: o ,99 ficaria abaixo do custo."; };
  const fill = p => { $("#sku").value = p.sku; $("#ma").value = p.marca || ""; $("#pr").value = p.produto || ""; $("#ta").value = p.tamanho || ""; $("#og").value = p.origem === "Importado" ? "Importado" : "Nacional"; $("#pu").value = p.preco_usd != null ? p.preco_usd : ""; $("#pv").value = p.preco_venda; $("#cu").value = cm[p.sku] != null ? cm[p.sku] : ""; $("#em").value = p.estoque_minimo; sync(); $("#ma").focus(); };
  const draw = () => { drawP(); app.querySelectorAll(".epd").forEach(b => b.onclick = () => fill(P.find(p => p.sku === b.dataset.sku))); };
  $("#b").oninput = draw; draw(); $("#b").focus(); $("#og").onchange = sync; $("#pu").oninput = sync; $("#cu").oninput = sync; sync();
  $("#csv").onclick = () => exportCSV().catch(e => toast(e.message));
  $("#f").onsubmit = async ev => { ev.preventDefault(); try { const origem = $("#og").value; const body = { sku: $("#sku").value, marca: $("#ma").value, produto: $("#pr").value, tamanho: $("#ta").value || null, estoque_minimo: +$("#em").value, ativo: true, origem };
    if (origem === "Importado") { const u = OP.parseUsd($("#pu").value); if (u.error) throw new Error(u.error); if (!(cot && cot.valor)) throw new Error("Defina a cotação do dólar antes de salvar um importado."); body.preco_usd = u.value; sync(); }
    body.preco_venda = Number(String($("#pv").value).replace(",", ".")); if (!(body.preco_venda >= 0)) throw new Error("Informe o preço de venda em R$.");
    await api.saveProduct(body, $("#cu").value); toast("Produto salvo ✓"); viewProdutos(); } catch (e) { toast(e.message); } };
}
async function viewSeguranca() {
  const F = (await api.factors()).filter(f => f.status === "verified");
  app.innerHTML = `<div class="card"><h2>Verificação em 2 etapas (2FA)</h2>
  <p class="muted">Recomendado. Use Google Authenticator, Microsoft Authenticator ou similar. Depois de ativar, o código é pedido a cada login.</p>
  ${F.length ? `<p><b>2FA ativo ✓</b></p><button class="btn ghost" id="rm">Desativar 2FA</button>` : `<button class="btn" id="en">Ativar 2FA</button><div id="q"></div>`}</div>`;
  app.insertAdjacentHTML("beforeend", await secAdmin()); wireSec();
  if (F.length) $("#rm").onclick = async () => { if (confirm("Desativar 2FA?")) { await api.unenroll(F[0].id); viewSeguranca(); } };
  else $("#en").onclick = async () => { const r = await api.enroll();
    $("#q").innerHTML = `<h3>1. Escaneie o QR code</h3>${r.totp.qr_code ? `<img class="qr" alt="QR" src="${esc(r.totp.qr_code)}">` : ""}<p class="muted">Ou digite a chave: <code>${esc(r.totp.secret)}</code></p>
    <h3>2. Digite o código</h3><form id="vf"><input id="c" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required style="max-width:160px"><button class="btn">Confirmar</button></form>`;
    $("#vf").onsubmit = async ev => { ev.preventDefault(); try { await api.verify(r.id, $("#c").value); toast("2FA ativado ✓"); viewSeguranca(); } catch { toast("Código inválido"); } }; };
}
async function localizarClientePorNome(nome, exceptId) {
  const CN = globalThis.BAGDA_CLIENTE_NOME;
  if (!CN || CN.key(nome).length < 2) return null;
  if (api && api.clientePorNome) {
    const hit = await api.clientePorNome(nome);
    if (hit && (exceptId == null || String(hit.id) !== String(exceptId))) return { ...hit, motivo: "nome" };
  }
  const seen = [];
  for (const q of CN.consultas(nome)) {
    let rows = [];
    try { rows = (await api.buscarClientes(q)) || []; } catch { rows = []; }
    for (const row of rows) seen.push(row);
  }
  if (can("financas")) { try { const all = await api.clientes(); for (const row of all || []) seen.push(row); } catch { /* vendedor não lista a tabela */ } }
  const hit = CN.findNome(seen, nome, exceptId);
  return hit ? { ...hit, motivo: "nome" } : null;
}
async function localizarClienteDuplicado(c, exceptId) {
  const CN = globalThis.BAGDA_CLIENTE_NOME;
  if (!CN || !c) return null;
  if (c.nome) { const porNome = await localizarClientePorNome(c.nome, exceptId); if (porNome) return porNome; }
  if (!(c.doc || c.telefone) || !can("financas")) return null;
  let all = [];
  try { all = (await api.clientes()) || []; } catch { return null; }
  const doc = CN.findDoc(all, c.doc, exceptId); if (doc) return { ...doc, motivo: "doc" };
  const tel = CN.findTel(all, c.telefone, exceptId); if (tel) return { ...tel, motivo: "tel" };
  return null;
}
async function clienteCadastroLivre(c, exceptId) {
  const CN = globalThis.BAGDA_CLIENTE_NOME;
  let dup = null;
  try { dup = await localizarClienteDuplicado(c, exceptId); }
  catch (e) { toast(CN ? CN.limparErro(e.message) : e.message); return false; }
  if (!dup) return true;
  const usar = await escolherClienteBox(esc(CN.mensagem(dup)), "Abrir o cadastro existente");
  if (usar) {
    const busca = $("#b"); if (busca) { busca.value = dup.nome || ""; busca.dispatchEvent(new Event("input")); }
    const b = document.querySelector(`.ed[data-i="${dup.id}"]`); if (b) b.click();
  }
  return false;
}
async function viewNota() {
  const P = (await api.products()).filter(p => p.ativo); let items = [];
  const VO = globalThis.BAGDA_VENDA_ORIGEM;
  const podeEspecial = me.role === "admin" || me.role === "estoque";
  let esp = [], espErro = "", origemPronta = false;
  if (podeEspecial) {
    try { origemPronta = await api.vendaOrigemPronta(); } catch { origemPronta = false; }
    if (origemPronta) { try { const raw = await api.depEsp(); esp = Array.isArray(raw) ? raw : []; } catch (e) { espErro = e.message || "Depósito Especial indisponível"; } }
  }
  let caixasPix = []; try { caixasPix = (await api.caixasPix()) || []; } catch { caixasPix = []; }
  const oferece = podeEspecial && origemPronta && !espErro;
  const espDe = sku => { const d = esp.find(x => x.sku === sku); const n = d ? Number(d.qtd) : 0; return Number.isFinite(n) && n > 0 ? n : 0; };
  app.innerHTML = `<div class="card"><h2>Nova nota</h2><form id="f">
  <label>Produto</label><input id="bq" type="search" autocomplete="off" placeholder="Digite nome, marca ou SKU… (Enter seleciona)" autofocus>
  <ul id="sug" class="sug"></ul><input type="hidden" id="sku"><div id="sel" class="muted"></div>
  ${oferece ? `<label for="origem">De qual estoque</label><select id="origem"><option value="principal">Principal</option><option value="especial">Especial</option></select><p class="muted" id="odisp"></p>` : `<input type="hidden" id="origem" value="principal">${espErro ? `<p class="warn">${esc(espErro)}</p>` : ""}${podeEspecial && !origemPronta ? `<p class="muted">Venda pelo Depósito Especial ainda depende da atualização do banco. Esta nota sai só do Principal.</p>` : ""}`}
  <div class="grid"><div><label>Quantidade</label><input id="q" type="number" min="1" step="1" value="1" required></div>
  <div><label>Preço vendido (R$/un) — obrigatório</label><input id="pv" type="number" min="0.01" step="0.01" required></div></div>
  <p class="warn" id="w"></p><button class="btn ghost">+ Adicionar item</button></form>
  <h3>Itens da nota</h3><table id="it"></table>
  <div class="grid"><div><label>Frete (motoboy) R$ — opcional</label><input id="fre" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0,00"></div><div id="cxbox"></div></div>
  <p class="muted">Frete e Caxinha entram no total. Sem estoque/custo. Nota só de frete/caxinha é permitida.</p>
  <h3>Pagamento</h3><div id="pgs"></div><button class="btn ghost" id="addpg" type="button">+ Dividir pagamento</button> <span id="pgok" class="muted"></span>
  <div class="grid" id="lpbox"><div><label>Local do pagamento *</label><select id="lp" required><option value="">— selecione —</option>${LOCAIS.concat(me.role === "admin" ? LOCAIS_ADMIN : []).map(l => `<option>${l}</option>`).join("")}</select></div>
  <div><label>Observação (opcional)</label><input id="obp" maxlength="200" placeholder="Ex.: maquininha 2, pago pelo marido…"></div></div><p class="muted" id="lpinfo"></p>
  <div id="prazobox" hidden><label for="pagaem">Paga em *</label><select id="pagaem">${(globalThis.BAGDA_PRAZO ? BAGDA_PRAZO.optionsHtml(7) : "")}</select><p class="muted" id="pagavenc"></p></div>
  <label>Nome do cliente (referência, sem cadastro)</label><input id="cref" maxlength="120" placeholder="Opcional — sai no cupom como Cliente:">
  <label>Cliente cadastrado (obrigatório para Paga Depois e Caixa Geral)</label><input id="cl" type="search" autocomplete="off" maxlength="120" placeholder="Buscar por nome, telefone ou CPF…">
  <ul id="csug" class="sug"></ul><div id="csel" class="muted"></div>
  <button type="button" class="btn ghost" id="cnovo" style="margin-top:4px">+ Novo cliente</button>
  <div id="cform" hidden class="grid" style="margin-top:8px"><div><label>Nome do cliente</label><input id="cn" maxlength="120"></div><div><label>Atendimento número</label><select id="cat"><option value="">— selecione —</option>${ATEND.map(a => `<option>${a}</option>`).join("")}</select></div><div><button type="button" class="btn" id="csave">Salvar cliente</button></div></div>
  <button class="btn gold" id="fin">Finalizar e gerar nota</button></div>`;
  if (caxinhaOn()) $("#cxbox").innerHTML = `<label>Caxinha d Natal R$ — opcional (até 24/12/2026)</label><input id="cxn" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0,00">`;
  const origemSel = () => VO.origemOf({ origem: ($("#origem") || {}).value });
  const showDisp = () => { const p = P.find(x => x.sku === $("#sku").value); if (!$("#odisp")) return; if (!p) { $("#odisp").textContent = oferece ? "Principal é a loja. Especial é o Depósito Especial. A venda não transfere de um para o outro." : ""; return; }
    const o = origemSel(), have = VO.available(p.estoque, espDe(p.sku), o); $("#odisp").textContent = `${VO.origemLabel(o)}: ${have} un. ${have === 1 ? "disponível" : "disponíveis"} neste estoque.`; };
  let draw = () => { $("#it").innerHTML = `<tr><th>Produto</th><th class="n">Qtd</th><th class="n">Preço</th><th class="n">Total</th><th></th></tr>` + items.map((x, i) => `<tr><td>${esc(x.nome)} <span class="src ${x.origem === "especial" ? "esp" : ""}">${esc(VO.origemLabel(x.origem))}</span></td><td class="n">${x.qtd}</td><td class="n">${brl(x.preco_vendido)}</td><td class="n">${brl(x.qtd * x.preco_vendido)}</td><td><button data-i="${i}" class="rm">✕</button></td></tr>`).join("") + (freN() > 0 ? `<tr><td><b>Frete</b> (motoboy)</td><td class="n">—</td><td class="n">—</td><td class="n">${brl(freN())}</td><td></td></tr>` : "") + (cxN() > 0 ? `<tr><td><b>Caxinha d Natal</b></td><td class="n">—</td><td class="n">—</td><td class="n">${brl(cxN())}</td><td></td></tr>` : "") + `<tr><th colspan="3">TOTAL</th><th class="n">${brl(totalN())}</th><th></th></tr>`;
    document.querySelectorAll(".rm").forEach(b => b.onclick = () => { items.splice(+b.dataset.i, 1); draw(); }); };
  const chk = () => { const p = P.find(x => x.sku === $("#sku").value), v = +$("#pv").value; if (p && !$("#pv").value) $("#pv").placeholder = p.preco_venda; $("#w").textContent = ""; showDisp(); }; /* sem trava/aviso de preço mínimo (MB 05/11) */
  let hi = 0, M = [];
  const drawS = () => { const q = $("#bq").value.trim(); M = q ? P.filter(p => match(p, q)).sort((a, b) => (b.estoque > 0) - (a.estoque > 0)).slice(0, 12) : []; hi = Math.min(hi, Math.max(M.length - 1, 0));
    $("#sug").innerHTML = M.map((p, i) => `<li data-s="${esc(p.sku)}" class="${i === hi ? "hi" : ""} ${VO.available(p.estoque, espDe(p.sku), "principal") < 1 && (!oferece || VO.available(p.estoque, espDe(p.sku), "especial") < 1) ? "off" : ""}"><b>${esc(p.marca)} ${esc(p.produto)} ${esc(p.tamanho || "")}</b>${usdBadge(p)} <small>${esc(p.sku)} · ${brl(p.preco_venda)} · Principal ${p.estoque}${oferece ? ` · Especial ${espDe(p.sku)}` : ""}</small></li>`).join("") || (q ? '<li class="off">Nada encontrado</li>' : "");
    document.querySelectorAll("#sug li[data-s]").forEach(li => li.onmousedown = e => { e.preventDefault(); pick(li.dataset.s); }); };
  const selTxt = p => { const d = esp.find(x => x.sku === p.sku); const custoEsp = oferece && me.role === "admin" && origemSel() === "especial" && d && d.custo != null ? ` · custo deste Especial <b>${brl(d.custo)}</b>` : "";
    return `Selecionado: <b>${esc(p.marca)} ${esc(p.produto)} ${esc(p.tamanho || "")}</b> · ${esc(p.sku)} · tabela ${brl(p.preco_venda)} · Principal ${p.estoque}${oferece ? ` · Especial ${espDe(p.sku)}` : ""}${custoEsp}`; };
  const pick = sku => { const p = P.find(x => x.sku === sku); if (!p) return;
    if (VO.available(p.estoque, espDe(p.sku), "principal") < 1 && (!oferece || VO.available(p.estoque, espDe(p.sku), "especial") < 1)) return toast("Sem estoque");
    $("#sku").value = p.sku; $("#bq").value = `${p.marca} ${p.produto} ${p.tamanho || ""}`.trim(); M = []; hi = 0; $("#sug").innerHTML = "";
    $("#sel").innerHTML = selTxt(p); if (me.role === "admin" && origemSel() !== "especial") api.costs().then(C => { const c = (C || []).find(x => x.sku === p.sku); if (c && c.custo != null && $("#sku").value === p.sku && origemSel() !== "especial") $("#sel").innerHTML += ` · custo <b>${brl(c.custo)}</b>`; }).catch(() => {});
    $("#pv").value = ""; chk(); $("#q").focus(); $("#q").select(); };
  $("#bq").oninput = () => { hi = 0; $("#sku").value = ""; $("#sel").innerHTML = ""; drawS(); };
  $("#q").onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); $("#pv").focus(); } };
  $("#bq").onkeydown = e => { if (e.key === "ArrowDown") { e.preventDefault(); hi = Math.min(hi + 1, M.length - 1); drawS(); } else if (e.key === "ArrowUp") { e.preventDefault(); hi = Math.max(hi - 1, 0); drawS(); } else if (e.key === "Enter") { e.preventDefault(); if (M[hi]) pick(M[hi].sku); } else if (e.key === "Escape") { $("#bq").value = ""; drawS(); } };
  $("#pv").oninput = chk;
  $("#f").onsubmit = ev => { ev.preventDefault(); if (!$("#sku").value && M[hi]) return pick(M[hi].sku); const p = P.find(x => x.sku === $("#sku").value), q = +$("#q").value, pv = Math.round(+String($("#pv").value).replace(",", ".") * 100) / 100;
    if (!p) { toast("Escolha um produto"); return $("#bq").focus(); }
    if (!Number.isInteger(q) || q < 1) { toast("Quantidade inválida"); return $("#q").focus(); }
    if (String($("#pv").value).trim() === "" || !(pv >= 0)) { toast("Informe o preço vendido"); return $("#pv").focus(); }
    const origem = origemSel();
    if (origem === "especial" && !oferece) return toast("Sem permissão para vender do Depósito Especial");
    const chkQ = VO.checkQty(p.estoque, espDe(p.sku), items, p.sku, origem, q);
    if (!chkQ.ok) return toast(origem === "especial" ? `Depósito Especial só tem ${chkQ.have} un.` : `Loja só tem ${chkQ.have} un.`);
    items.push({ sku: p.sku, qtd: q, preco_vendido: pv, origem, nome: `${p.marca} ${p.produto} ${p.tamanho || ""}`.trim() }); toast(`+ ${p.marca} ${p.produto} (${VO.origemLabel(origem)})`);
    $("#f").reset(); if ($("#origem")) $("#origem").value = origem; $("#sku").value = ""; $("#sel").innerHTML = ""; $("#w").textContent = ""; $("#pv").placeholder = ""; hi = 0; showDisp(); drawS(); draw(); $("#bq").focus(); };
  let cli = null;
  const setCli = c => { cli = c; $("#csel").innerHTML = c ? `Cliente: <b>${esc(c.nome)}</b> ${esc(c.telefone || "")} ${c.doc ? esc(fmtDoc(c.doc)) : ""} <button type="button" id="cx0">✕</button>` : ""; $("#csug").innerHTML = ""; if (c) { $("#cl").value = ""; $("#cx0").onclick = () => setCli(null); } };
  let ct0; $("#cl").oninput = () => { clearTimeout(ct0); ct0 = setTimeout(async () => { const q = $("#cl").value; const L = q.trim().length >= 2 ? await api.buscarClientes(q).catch(e => (toast(e.message), [])) : [];
    $("#csug").innerHTML = L.map((c, i) => `<li data-i="${i}"><b>${esc(c.nome)}</b> <small>${esc(c.telefone || "")} ${c.doc ? "· " + esc(fmtDoc(c.doc)) : ""}</small></li>`).join("") || (q.trim().length >= 2 ? '<li class="off">Nenhum cliente — use "+ Novo cliente"</li>' : "");
    document.querySelectorAll("#csug li[data-i]").forEach(li => li.onmousedown = e => { e.preventDefault(); setCli(L[+li.dataset.i]); }); }, 200); };
  $("#cnovo").onclick = () => { $("#cform").hidden = !$("#cform").hidden; $("#cn").value = $("#cl").value; $("#cn").focus(); };
  $("#csave").onclick = async () => { const c = { nome: $("#cn").value.trim(), atendimento: $("#cat").value || null };
    if (c.nome.length < 2) return toast("Informe o nome do cliente"); if (!c.atendimento) return toast("Escolha o Atendimento número");
    const CN = globalThis.BAGDA_CLIENTE_NOME;
    const escolher = async dup => { if (await escolherClienteBox(esc(CN.mensagem(dup)), "Usar este cliente na nota")) { setCli({ id: dup.id, nome: dup.nome, telefone: dup.telefone || "", doc: dup.doc || null }); $("#cform").hidden = true; $("#csel").scrollIntoView({ block: "center" }); } };
    try { const dup = await localizarClientePorNome(c.nome); if (dup) return escolher(dup);
      const cid = await api.criarCliente(c); setCli({ id: +cid, ...c }); $("#cform").hidden = true; toast("Cliente salvo ✓"); }
    catch (e) { const msg = CN ? CN.limparErro(e.message) : e.message; const parsed = CN && CN.parseErro(msg); if (parsed) return escolher(parsed); toast(msg); } };
  let pgs = [{ metodo: "", valor: null }]; /* sem forma pré-escolhida: antes vinha PIX e uma nota refeita podia sair como PIX sem querer */
  const lpNeed = () => pgs.length === 1 ? !!pgs[0].metodo && pgs[0].metodo !== "prazo" : pgs.some(g => g.metodo && g.metodo !== "prazo" && +g.valor > 0);
  const prazoNeed = () => pgs.some(g => g.metodo === "prazo" && (pgs.length === 1 || +g.valor > 0));
  const prazoSync = () => {
    const n = prazoNeed(), box = $("#prazobox"), sel = $("#pagaem"), lab = $("#pagavenc");
    if (!box) return;
    box.hidden = !n; if (sel) sel.required = n;
    if (n && sel && lab && globalThis.BAGDA_PRAZO) {
      const dias = +sel.value || BAGDA_PRAZO.DEFAULT_DIAS, venc = BAGDA_PRAZO.addDays(today(), dias);
      lab.innerHTML = `Vencimento: <b>${dBR(venc)}</b>. O prazo conta a partir de hoje (data da nota).`;
    }
  };
  const fillLp = () => { const sel = $("#lp"); if (!sel || !globalThis.BAGDA_PIX_LOCAIS) return; const prev = sel.value, PX = globalThis.BAGDA_PIX_LOCAIS;
    const opts = PX.soPix(pgs) ? PX.opcoes(caixasPix, me.role === "admin") : LOCAIS.concat(me.role === "admin" ? LOCAIS_ADMIN : []).map(l => ({ value: l, label: l }));
    sel.innerHTML = `<option value="">— selecione —</option>` + opts.map(o => `<option value="${o.value}">${o.label}</option>`).join("");
    if (opts.some(o => o.value === prev)) sel.value = prev;
  };
  const lpSync = () => { const n = lpNeed(); $("#lpbox").style.display = n ? "" : "none"; $("#lp").required = n; $("#lpinfo").hidden = !n; fillLp(); prazoSync(); };
  function freN() { const v = Math.round(+String(($("#fre") || {}).value || "0").replace(",", ".") * 100) / 100; return v > 0 ? v : 0; }
  function cxN() { const v = Math.round(+String(($("#cxn") || {}).value || "0").replace(",", ".") * 100) / 100; return v > 0 ? v : 0; }
  function totalN() { return Math.round((items.reduce((a, x) => a + x.qtd * x.preco_vendido, 0) + freN() + cxN()) * 100) / 100; }
  const drawPg = () => { const t = totalN(); if (pgs.length === 1) pgs[0].valor = t;
    $("#pgs").innerHTML = pgs.map((g, i) => `<div class="grid pgrow"><div><select data-i="${i}" class="pm"><option value="" ${g.metodo ? "" : "selected"}>— forma de pagamento —</option>${PAY.map(([v, l]) => `<option value="${v}" ${g.metodo === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>
      <div><input data-i="${i}" class="pv2" type="number" min="0.01" step="0.01" value="${g.valor ?? ""}" ${pgs.length === 1 ? "readonly" : ""}></div>${pgs.length > 1 ? `<div><button type="button" class="rmpg" data-i="${i}">✕</button></div>` : ""}</div>`).join("");
    const soma = Math.round(pgs.reduce((a, g) => a + (+g.valor || 0), 0) * 100) / 100;
    $("#pgok").textContent = pgs.length > 1 ? (soma === t ? "✓ soma confere" : `Soma ${brl(soma)} · falta ${brl(t - soma)}`) : "";
    lpSync();
    document.querySelectorAll(".pm").forEach(x => x.onchange = () => { pgs[+x.dataset.i].metodo = x.value; lpSync(); });
    document.querySelectorAll(".pv2").forEach(x => x.onchange = () => { pgs[+x.dataset.i].valor = +x.value; drawPg(); });
    document.querySelectorAll(".rmpg").forEach(x => x.onclick = () => { pgs.splice(+x.dataset.i, 1); drawPg(); }); };
  $("#addpg").onclick = () => { if (pgs.length >= 3) return; const t = totalN(), soma = pgs.reduce((a, g) => a + (+g.valor || 0), 0); if (pgs.length === 1) pgs[0].valor = t; pgs.push({ metodo: PAY.map(x => x[0]).find(m => !pgs.some(g => g.metodo === m)) || "dinheiro", valor: Math.max(Math.round((t - soma) * 100) / 100, 0) || null }); drawPg(); };
  if ($("#pagaem")) $("#pagaem").onchange = prazoSync;
  const draw0 = draw; draw = () => { draw0(); drawPg(); };
  $("#fre").oninput = () => draw(); if ($("#cxn")) $("#cxn").oninput = () => draw();
  $("#fin").onclick = async () => { const FR = freN(), CXV = cxN(); if (+String(($("#fre") || {}).value || "0").replace(",", ".") < 0) return toast("Frete inválido"); if (+String(($("#cxn") || {}).value || "0").replace(",", ".") < 0) return toast("Caxinha d Natal inválido"); if (!items.length && !(FR > 0) && !(CXV > 0)) return toast("Adicione pelo menos 1 item (ou informe Frete / Caxinha)"); if (items.some(x => !(+x.preco_vendido >= 0))) return toast("Há item com preço inválido — remova e adicione de novo");
    const t = totalN(), P2 = pgs.filter(g => +g.valor > 0).map(g => ({ metodo: g.metodo, valor: Math.round(+g.valor * 100) / 100 }));
    if (P2.some(g => !g.metodo)) return toast("Escolha a forma de pagamento (PIX, Dinheiro, Cartão ou Paga Depois)");
    if (Math.round(P2.reduce((a, g) => a + g.valor, 0) * 100) !== Math.round(t * 100)) return toast("A soma dos pagamentos precisa ser igual ao total");
    if (P2.some(g => g.metodo === "prazo") && !cli) return toast("Paga Depois exige cliente — busque ou cadastre o cliente");
    const prazoDias = P2.some(g => g.metodo === "prazo") ? +(($("#pagaem") || {}).value || 0) : null;
    if (P2.some(g => g.metodo === "prazo") && !(prazoDias >= 1 && prazoDias <= 30)) { toast("Informe em quantos dias o cliente paga (1 a 30)"); return $("#pagaem") && $("#pagaem").focus(); }
    const prazoTxt = prazoDias ? (prazoDias === 1 ? "1 dia" : prazoDias + " dias") + (globalThis.BAGDA_PRAZO ? " (vence " + dBR(BAGDA_PRAZO.addDays(today(), prazoDias)) + ")" : "") : "";
    const lpN = P2.some(g => g.metodo !== "prazo"), LP = lpN ? $("#lp").value : null, OBP = lpN ? $("#obp").value.trim() : ""; if (lpN && !LP) { toast("Escolha o Local do pagamento"); return $("#lp").focus(); }
    if (LP === "CAIXA GERAL") { if (!cli) return toast("Caixa Geral exige cliente cadastrado — busque ou cadastre o cliente"); P2.splice(0, P2.length, { metodo: "credito", valor: t }); }
    if (LP === "CAIXA ESPECIAL" && me.role !== "admin") return toast("Somente admin");
    if (notaSaving) return; notaSaving = true; if (!(await confirmNota(items, t, P2.map(g => `${esc(PAYL[g.metodo] || g.metodo)} ${brl(g.valor)}`).join(" + "), FR, CXV, prazoTxt))) { notaSaving = false; return; } const fb = $("#fin"), lbl = fb.textContent; fb.disabled = true; fb.textContent = "Salvando..."; document.querySelectorAll(".nb").forEach(x => x.remove());
    const total = t, pagTxt = P2.map(g => `${esc(PAYL[g.metodo] || g.metodo)} ${brl(g.valor)}`).join(" + ");
    try { const nid = await api.criarNota(items.map(({ sku, qtd, preco_vendido, origem }) => ({ sku, qtd, preco_vendido, ...(origem === "especial" ? { origem: "especial" } : {}) })), P2, cli ? cli.nome : ($("#cref").value.trim() || $("#cl").value), cli ? cli.id : null, LP, OBP, FR, CXV, prazoDias);
      if (!nidOk(nid)) throw new Error("Servidor não confirmou o número da nota (retorno: " + JSON.stringify(nid) + ")");
      const R = await api.nota(+nid).then(r => r && r.length ? r : api.notaHead(+nid)); if (!R || !R.length) throw new Error("Nota " + nid + " não encontrada após salvar");
      items = []; await viewRecibo(+nid);
      banner(true, `✅ <b>Nota salva nº ${String(nid).padStart(6, "0")}</b><br>Total: <b>${brl(total)}</b>${FR > 0 ? ` (frete ${brl(FR)})` : ""}${CXV > 0 ? ` (caxinha ${brl(CXV)})` : ""} · Pagamento: <b>${pagTxt}</b>${LP === "CAIXA ESPECIAL" ? " · entrou na Caixa Especial" : ""}`);  printBtns();}
    catch (e) { console.error("Nota NÃO salva:", e); fb.disabled = false; fb.textContent = lbl;
      banner(false, `❌ <b>Nota NÃO salva — tente de novo</b><br><small>${esc(e.message || String(e))}</small>${!LP && /Local do pagamento/.test(e.message || "") ? "<br><small>Paga Depois sem Local ainda depende de uma atualização do banco — avise o admin.</small>" : ""}<br><small>Os itens continuam no carrinho.</small>`); if (CXV > 0 && /Caxinha d Natal depende/.test(e.message || "")) toast("Caxinha d Natal depende de atualização do banco — avise o admin"); else if (FR > 0 && /Frete depende/.test(e.message || "")) toast("Frete depende de atualização do banco — avise o admin"); else if (/Prazo de Paga Depois ainda depende/.test(e.message || "")) toast("Prazo de Paga Depois ainda depende da atualização do banco — avise o admin"); }
    finally { notaSaving = false; } };
  $("#lp").onchange = () => { const v = $("#lp").value; $("#lpinfo").textContent = v === "CAIXA GERAL" ? "Caixa Geral: o total sai do crédito do cliente cadastrado (as formas acima são ignoradas)." : v === "CAIXA ESPECIAL" ? "Caixa Especial: o valor pago entra agora na Caixa Especial, ligado a esta nota. Não entra em HX, Máquina nem Dinheiro." : ""; };
  if ($("#origem") && $("#origem").tagName === "SELECT") $("#origem").onchange = () => { showDisp(); const p = P.find(x => x.sku === $("#sku").value); if (p) { $("#sel").innerHTML = selTxt(p); if (me.role === "admin" && origemSel() !== "especial") api.costs().then(C => { const c = (C || []).find(x => x.sku === p.sku); if (c && c.custo != null && $("#sku").value === p.sku && origemSel() !== "especial") $("#sel").innerHTML += ` · custo <b>${brl(c.custo)}</b>`; }).catch(() => {}); } };
  draw(); $("#bq").focus();
}
async function viewRecibo(nid) {
  const [R0, PGN] = await Promise.all([api.nota(nid), api.notaPag(nid)]), HD = R0.length ? [] : await api.notaHead(nid).catch(() => []); if (!R0.length && !HD.length) return toast("Nota não encontrada");
  const R = R0.map(r => { const o = r.estoque_origem === "especial" ? "Especial" : "Principal"; return { ...r, produto: `${r.produto} (${o})` }; }), h = { ...(R0[0] || HD[0]), ...((await api.notasInfo([nid]).catch(() => []))[0] || {}) }, tot = R.reduce((a, r) => a + Number(r.total), 0);
  app.innerHTML = `<div class="noprint" style="margin-bottom:12px"><button class="btn gold" id="pr">Imprimir / Salvar PDF</button> <button class="btn ghost" id="nv">Nova nota</button></div>
  ${reciboTxt("BAGDA STORES", nid, h, R, tot, PGN.map(g => (PAYL[g.metodo] || g.metodo) + (PGN.length > 1 ? " R$ " + rnum(g.valor) : "")), h.status === "cancelada")}`;
  $("#pr").onclick = () => window.print(); $("#nv").onclick = () => go("nota");
}
async function viewNotas() {
  const R = await api.notas(), by = {}, adm = me.role === "admin", TZ = "America/Sao_Paulo";
  R.forEach(r => { by[r.nota_id] ||= { ...r, total: 0 }; by[r.nota_id].total += Number(r.total); });
  const all = Object.values(by).sort((a, b) => (new Date(b.created_at) - new Date(a.created_at)) || (b.nota_id - a.nota_id));
  const dkey = d => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
  const dt = d => new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(d).replace(",", "");
  const hoje = dkey(new Date()), ontem = dkey(new Date(Date.now() - 864e5));
  const label = d => { const k = dkey(d); return k === hoje ? "Hoje" : k === ontem ? "Ontem" : new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" }).format(d); };
  const cli = n => (n.cliente || n.cliente_nome || "").trim();
  const cols = adm ? 7 : 6;
  const draw = q0 => {
    const q = (q0 || "").trim(), ql = q.toLowerCase();
    const L = all.filter(n => !ql || [String(n.nota_id).padStart(6, "0"), cli(n), n.pagamento, n.handle, n.nome].join(" ").toLowerCase().includes(ql));
    let last = "", rows = "";
    for (const n of L) { const d = new Date(n.created_at), k = dkey(d);
      if (k !== last) { rows += `<tr class="sep"><th colspan="${cols}">${esc(label(d))}</th></tr>`; last = k; }
      rows += `<tr><td>${String(n.nota_id).padStart(6, "0")}</td><td>${esc(dt(d))}</td><td>${cli(n) ? esc(cli(n)) : "—"}</td><td>${esc(String(n.pagamento || "").split("+").map(m => PAYL[m] || m).join(" + "))}${n.status === "cancelada" ? ' <b class="warn">CANCELADA</b>' : ""}</td>${adm ? `<td>${esc(n.handle)}</td>` : ""}<td class="n">${brl(n.total)}</td><td><button class="ver" data-n="${n.nota_id}">Ver / imprimir</button>${adm && n.status !== "cancelada" ? ` <button class="cx" data-n="${n.nota_id}">Cancelar</button>` : ""}</td></tr>`; }
    app.innerHTML = `<div class="card"><h2>${adm ? "Notas" : "Minhas notas"}</h2>
    <label class="noprint">Buscar</label><input id="nq" class="noprint" placeholder="Nº, cliente, pagamento…" value="${esc(q)}" style="max-width:280px;margin-bottom:12px">
    <table class="stk"><tr><th>Nº</th><th>Data / hora</th><th>Cliente</th><th>Pagamento</th>${adm ? "<th>Vendedor</th>" : ""}<th class="n">Total</th><th></th></tr>
    ${rows || `<tr><td colspan="${cols}" class="muted">${q ? "Nenhuma nota neste filtro." : "Nenhuma nota."}</td></tr>`}</table></div>`;
    const inp = $("#nq"); inp.oninput = ev => { const v = ev.target.value, s = ev.target.selectionStart; draw(v); const ninp = $("#nq"); ninp.focus(); try { ninp.setSelectionRange(s, s); } catch (e) {} };
    document.querySelectorAll(".ver").forEach(b => b.onclick = () => viewRecibo(+b.dataset.n));
    document.querySelectorAll(".cx").forEach(b => b.onclick = async () => { const m = prompt(`Cancelar nota ${String(b.dataset.n).padStart(6, "0")}? Informe o motivo (estoque volta e o valor é estornado do caixa):`);
      if (!m || m.trim().length < 3) return; try { await api.cancelarNota(+b.dataset.n, m.trim()); toast("Nota cancelada ✓"); viewNotas(); } catch (e) { toast(e.message); } });
  };
  draw("");
}
// Estornar movimento de caixa (admin): motivo obrigatório + confirmação; nada é apagado (movimento inverso).
function estornarMovBox(m, after) { if (!m) return; const nota = m.tipo === "venda" && m.nota_id, nn = nota ? String(m.nota_id).padStart(6, "0") : "";
  const o = document.createElement("div"); o.className = "nmodal"; o.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:99";
  o.innerHTML = `<div class="card" style="max-width:520px;margin:0;border:2px solid #b91c1c"><h2 style="color:#b91c1c">Estornar movimento de caixa</h2>
  <p><b>${esc({ venda: "Venda", entrada: "Entrada", saida: "Saída" }[m.tipo] || m.tipo)}</b> · ${esc(m.caixa)} · <b>${brl(m.valor)}</b><br>${esc(m.motivo || "")}${m.handle ? ` · por ${esc(m.handle)}` : ""}</p>
  <p class="muted">Nada é apagado: entra um movimento inverso no mesmo caixa, ligado a este, e fica no log.${nota ? ` A nota <b>${nn}</b> volta para <b>Notas a lançar</b> (venda e estoque continuam).` : m.tipo === "entrada" ? " Se for recebimento de cliente, a dívida dele reabre." : ""}</p>
  ${nota ? `<label style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" id="emc" style="width:auto;margin-top:4px"> <span>Também <b>cancelar a nota ${nn}</b> (devolve o estoque; Paga Depois e crédito Caixa Geral voltam)</span></label>` : ""}
  <label>Motivo *</label><input id="emm" maxlength="200" placeholder="Ex.: lançado errado / cliente desistiu"><p class="warn" id="emw" style="min-height:1em"></p>
  <button class="btn ghost" id="emn">Voltar</button> <button class="btn danger" id="emy">Continuar</button></div>`;
  document.body.append(o); const i = o.querySelector("#emm"), y = o.querySelector("#emy"), w = o.querySelector("#emw"); let step = 0; i.focus();
  o.querySelector("#emn").onclick = () => o.remove();
  y.onclick = async () => { const mot = i.value.trim(), cn = !!(o.querySelector("#emc") || {}).checked; if (mot.length < 3) { w.textContent = "Informe o motivo (mín. 3 letras)."; return i.focus(); }
    if (!step) { step = 1; w.textContent = `Confirma estornar ${brl(m.valor)}${cn ? ` e CANCELAR a nota ${nn}` : ""}? Clique de novo para confirmar.`; y.textContent = "Confirmar estorno"; return; }
    y.disabled = true; try { const r = await api.estornarMov(m.id, mot, cn); o.remove(); toast(r && r.ja_estornado ? "Já estava estornado" : cn ? `Estornado ✓ nota ${nn} cancelada` : nota ? `Estornado ✓ nota ${nn} voltou para lançar` : "Movimento estornado ✓"); after && after(); }
    catch (e) { w.textContent = e.message; y.disabled = false; } }; }
async function viewCaixa(d = today()) {
  if (!can("caixa") || me.role === "vendedor") return go("nota"); /* vendedor: sem caixa (o banco também recusa) */
  const adm = me.role === "admin";
  let JAN = { ilimitado: adm, mostra_saldo: adm, mostra_saldo_caixas: [1], hoje: today(), desde: adm ? null : spAdd(today(), -2), rotulo: adm ? "tudo" : "últimos 3 dias" };
  try { JAN = Object.assign(JAN, await api.caixaFinJanela() || {}); } catch (e) { /* janela padrão de 3 dias */ }
  if (!adm && JAN.desde && d < JAN.desde) d = JAN.desde;
  if (!adm && JAN.hoje && d > JAN.hoje) d = JAN.hoje;
  const [SA, EX, SE] = await Promise.all([api.caixaSaldos(), api.caixaExtrato(d), api.caixaSessoes(d)]), hoje = d === today();
  let LIB = []; if (adm) { try { LIB = await api.caixaFinLista() || []; } catch (e) { LIB = []; } }
  const TZ = "America/Sao_Paulo", hm = t => new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(t));
  const TL = { venda: "Venda", entrada: "Entrada", saida: "Saída", estorno: "Estorno" };
  const ses = c => SE.find(x => x.caixa_id === c.caixa_id);
  const fin = me.role === "admin" || me.role === "financeiro";
  const isHX = c => /HX/.test(c.nome || ""), hxN = c => isHX(c) ? `<small class="muted">${adm ? 'Diário (hoje) · <a href="#hxdia" class="hxl">HX por dia</a>' : "HX · só hoje, salvo liberação"}</small>` : "";
  const valorCard = c => { if (adm) return isHX(c) ? `<b>${brl(c.movimento_hoje)}</b><small>Total de hoje</small>` : `<b>${caixaSaldoHtml(c.saldo)}</b><small>Hoje: ${brl(c.movimento_hoje)}</small>`; if (c.saldo != null) return `<b>${caixaSaldoHtml(c.saldo)}</b><small>Saldo total · hoje: ${brl(c.movimento_hoje)}</small>`; return `<b>${brl(c.movimento_visivel)}</b><small>Movimento visível · sem saldo acumulado</small>`; };
  const card = c => { const x = ses(c); return `<div class="kpi cxk"><small>${esc(c.nome)}${fin ? ` <button class="btn ghost so noprint" data-c="${c.caixa_id}" style="margin:0 0 0 6px;padding:2px 10px;font-size:.85em">Ver só este caixa</button>` : ""}</small>${valorCard(c)}${hxN(c)}
    <small>${x ? (x.fechado_em ? `Fechado: contado ${brl(x.fechamento_contado)} · diferença <b class="${+x.diferenca ? "warn" : ""}">${brl(x.diferenca)}</b>` : `Aberto ${hm(x.aberto_em)} com ${brl(x.abertura_valor)}`) : "Não aberto hoje"}</small>
    ${hoje ? `<div class="noprint cxa">${!x ? `<input type="number" step="0.01" min="0" placeholder="Valor contado" data-c="${c.caixa_id}" class="va"><button class="btn ghost ab" data-c="${c.caixa_id}">Abrir</button>` : !x.fechado_em ? `<input type="number" step="0.01" min="0" placeholder="Valor contado" data-c="${c.caixa_id}" class="vf"><button class="btn ghost fe" data-c="${c.caixa_id}">Fechar</button>` : ""}</div>` : ""}</div>`; };
  const tot = EX.reduce((a, m) => a + Number(m.valor_assinado), 0);
  const finNota = !adm ? `<p class="muted" id="fin-janela">Financeiro vê os caixas permitidos só nos ${esc(JAN.rotulo || "últimos 3 dias")} (America/Sao_Paulo${JAN.desde ? ", a partir de " + esc(String(JAN.desde).split("-").reverse().join("/")) : ""}). Movimento mais antigo fica oculto. O saldo total aparece só na Caixa Dinheiro; nos outros caixas o saldo acumulado fica oculto, porque incluiria esse período.</p>` : "";
  app.innerHTML = `<div class="card"><h2>Caixa <button class="btn noprint" id="pe" style="float:right;margin:0">Imprimir extrato (A4)</button></h2>
  <label class="noprint">Data</label><input id="d" class="noprint" type="date" value="${d}" style="max-width:200px" ${adm ? "" : `min="${esc(JAN.desde || "")}" max="${esc(JAN.hoje || today())}"`}>
  ${finNota}
  <div class="grid" style="margin-top:14px">${SA.map(card).join("")}</div></div>
  ${hoje ? `<div class="grid noprint" style="align-items:start">
    <div class="card noprint"><h2>Lançamento manual</h2><form id="lf"><div class="grid">
    <div><label>Caixa</label><select id="lc">${SA.map(c => `<option value="${c.caixa_id}">${esc(c.nome)}</option>`).join("")}</select></div>
    <div><label>Tipo</label><select id="lt"><option value="entrada">Entrada</option><option value="saida">Saída</option></select></div>
    <div><label>Valor (R$)</label><input id="lv" type="number" min="0.01" step="0.01" required></div></div>
    <label>Motivo (obrigatório)</label><input id="lm" minlength="3" maxlength="300" required><button class="btn">Lançar</button></form></div>
    <div class="card noprint"><h2>Transferir entre caixas</h2><form id="tf"><div class="grid">
    <div><label>De</label><select id="tde">${SA.filter(c => !c.somente_admin).map(c => `<option value="${c.caixa_id}" ${c.caixa_id === 1 ? "selected" : ""}>${esc(c.nome)}</option>`).join("")}${adm ? `<option value="cxesp">CAIXA ESPECIAL</option>` : ""}</select></div>
    <div><label>Para</label><select id="tpa">${SA.map(c => `<option value="${c.caixa_id}" ${c.caixa_id === (adm && SA.some(x => x.caixa_id === 18) ? 18 : 12) ? "selected" : ""}>${esc(c.nome)}${c.somente_admin ? " (só admin)" : ""}</option>`).join("")}${adm ? `<option value="cxesp">CAIXA ESPECIAL</option>` : ""}</select></div>
    <div><label>Valor (R$)</label><input id="tv" type="number" min="0.01" step="0.01" required></div></div>
    <label>Motivo (obrigatório)</label><input id="tm" minlength="3" maxlength="300" required placeholder="Ex.: abater dívida de COMPRA PRODUTOS">${adm ? `<p class="muted">Como admin, <b>Para</b> inclui os caixas só admin (COMPRA PRODUTOS, PAGAMENTO PRODUTOS). Transferir de Caixa Dinheiro, CAIXA S2 ou PRESTIGE ROSA para COMPRA PRODUTOS abate a dívida. O financeiro não vê esses caixas. A Caixa Especial (ledger separado) continua só aqui para admin.</p>` : ""}<button class="btn">Transferir</button></form></div>
  </div>` : ""}
  ${adm ? `<div class="card noprint" id="fin-lib"><h2>Liberar histórico para Financeiro</h2>
  <p class="muted">Padrão: últimos 3 dias, só nos caixas que o financeiro já pode ver. A liberação alarga essa janela (data inicial ou número de dias, um caixa ou todos, validade opcional). Revogar volta ao padrão na hora. O saldo acumulado continua só com o admin.</p>
  <form id="flf"><div class="grid">
  <div><label>Caixa</label><select id="fl-caixa"><option value="">Todos os caixas do financeiro</option>${SA.filter(c => !c.somente_admin).map(c => `<option value="${c.caixa_id}">${esc(c.nome)}</option>`).join("")}</select></div>
  <div><label>Como</label><select id="fl-modo"><option value="dias">Últimos N dias</option><option value="desde">A partir de uma data</option></select></div>
  <div id="fl-dias-box"><label>Dias</label><input id="fl-dias" type="number" min="3" step="1" value="30"></div>
  <div id="fl-desde-box" hidden><label>A partir de</label><input id="fl-desde" type="date"></div>
  <div><label>Validade (opcional)</label><input id="fl-expira" type="date"></div></div>
  <button class="btn" id="fl-ok">Liberar</button></form>
  <table class="stk" id="fl-tab"><tr><th>Caixa</th><th>Janela</th><th>Validade</th><th></th></tr>
  ${LIB.filter(g => g.ativo !== false).map(g => `<tr><td>${esc(g.caixa || "Todos os caixas do financeiro")}</td><td>${g.desde ? "desde " + esc(String(g.desde).split("-").reverse().join("/")) : "últimos " + esc(g.dias) + " dias"}</td><td>${g.expira_em ? esc(String(g.expira_em).slice(0, 10).split("-").reverse().join("/")) : "até revogar"}</td><td><button type="button" class="btn ghost fl-rev" data-i="${g.id}">Revogar</button></td></tr>`).join("") || '<tr><td colspan="4" class="muted">Nenhuma liberação ativa. Revogar aparece em cada linha depois de liberar.</td></tr>'}</table></div>` : ""}
  <div class="card"><h2>Extrato do dia ${esc(d.split("-").reverse().join("/"))}</h2>${!adm && !hoje && SA.some(c => /HX/.test(c.nome || "")) ? '<p class="muted">Caixa HX: dias anteriores visíveis só para admin, salvo liberação.</p>' : ""}${!adm ? '<p class="muted">Linhas anteriores à janela não entram neste extrato.</p>' : ""}<div style="overflow-x:auto"><table class="stk"><tr><th>Hora</th><th>Caixa</th><th>Tipo</th><th>Cliente</th><th>Motivo / nota</th><th>Usuário</th><th class="n">Valor</th></tr>
  ${EX.map(m => `<tr${m.estornado ? ' style="text-decoration:line-through;opacity:.6"' : ""}><td>${hm(m.created_at)}</td><td>${esc(m.caixa)}</td><td>${TL[m.tipo] || m.tipo}${m.estorno_de ? ` <small class="muted">(estorno #${m.estorno_de})</small>` : ""}</td><td>${esc((m.cliente || "").trim() || "—")}</td><td>${esc(m.motivo || "")}</td><td>${esc(m.handle || "")}</td><td class="n">${brl(m.valor_assinado)}${adm ? (m.estornado ? '<br><small class="muted noprint">Estornado</small>' : m.tipo !== "estorno" && !m.estorno_de ? `<br><button class="btn ghost emv noprint" data-m="${m.id}" style="margin:2px 0 0;padding:1px 8px;font-size:12px;color:#b91c1c">Estornar</button>` : "") : ""}</td></tr>`).join("") || '<tr><td colspan="7" class="muted">Sem movimentos.</td></tr>'}
  ${SA.map(c => { const v = EX.filter(m => m.caixa_id === c.caixa_id).reduce((a, m) => a + Number(m.valor_assinado), 0); return `<tr class="sep"><th colspan="6">${esc(c.nome)} — movimento do dia${(adm || c.saldo != null) && Number(c.saldo) < -0.001 ? ` · saldo ${caixaSaldoHtml(c.saldo)}` : ""}</th><th class="n">${brl(v)}</th></tr>`; }).join("")}
  <tr class="tot"><th colspan="6">TOTAL DO DIA</th><th class="n">${brl(tot)}</th></tr></table></div></div>`;
  document.querySelectorAll(".hxl").forEach(a => a.onclick = ev => { ev.preventDefault(); go("hxdia"); });
  document.querySelectorAll(".emv").forEach(b => b.onclick = () => estornarMovBox(EX.find(m => m.id === +b.dataset.m), () => viewCaixa(d)));
  $("#d").onchange = e => { const v = e.target.value; if (!adm && JAN.desde && v && v < JAN.desde) { toast("Fora da janela do financeiro"); viewCaixa(JAN.desde); return; } if (!adm && JAN.hoje && v > JAN.hoje) { viewCaixa(JAN.hoje); return; } viewCaixa(v); }; $("#pe").onclick = () => window.print();
  if ($("#fl-modo")) $("#fl-modo").onchange = () => { const dias = $("#fl-modo").value === "dias"; $("#fl-dias-box").hidden = !dias; $("#fl-desde-box").hidden = dias; };
  if ($("#flf")) $("#flf").onsubmit = async ev => { ev.preventDefault(); const modo = $("#fl-modo").value, caixa = $("#fl-caixa").value ? +$("#fl-caixa").value : null, dias = modo === "dias" ? +$("#fl-dias").value : null, desde = modo === "desde" ? $("#fl-desde").value : null, exp = $("#fl-expira").value ? $("#fl-expira").value + "T23:59:59-03:00" : null;
    try { await api.caixaFinLiberar(caixa, desde, dias, exp); toast("Histórico liberado para o financeiro"); viewCaixa(d); } catch (e) { toast(e.message); } };
  document.querySelectorAll(".fl-rev").forEach(b => b.onclick = async () => { try { await api.caixaFinRevogar(+b.dataset.i); toast("Liberação revogada"); viewCaixa(d); } catch (e) { toast(e.message); } });
  document.querySelectorAll(".so").forEach(b => b.onclick = () => viewResumo(d, +b.dataset.c, true));
  document.querySelectorAll(".ab").forEach(b => b.onclick = async () => { const v = document.querySelector(`.va[data-c="${b.dataset.c}"]`).value; if (v === "") return toast("Informe o valor contado");
    try { await api.caixaAbrir(+b.dataset.c, +v); toast("Caixa aberto ✓"); viewCaixa(d); } catch (e) { toast(e.message); } });
  document.querySelectorAll(".fe").forEach(b => b.onclick = async () => { const v = document.querySelector(`.vf[data-c="${b.dataset.c}"]`).value; if (v === "") return toast("Informe o valor contado");
    try { const dif = await api.caixaFechar(+b.dataset.c, +v); toast(`Caixa fechado · diferença ${brl(dif)}`); viewCaixa(d); } catch (e) { toast(e.message); } });
  if ($("#lf")) $("#lf").onsubmit = async ev => { ev.preventDefault(); const m = $("#lm").value.trim(); if (m.length < 3) return toast("Informe o motivo");
    try { await api.caixaLancar({ caixa_id: +$("#lc").value, tipo: $("#lt").value, valor: +$("#lv").value, motivo: m }); toast("Lançado ✓"); viewCaixa(d); } catch (e) { toast(e.message); } };
  if ($("#tf")) $("#tf").onsubmit = async ev => { ev.preventDefault(); const deRaw = $("#tde").value, paRaw = $("#tpa").value, oEsp = deRaw === "cxesp", dEsp = paRaw === "cxesp", de = oEsp ? null : +deRaw, pa = dEsp ? null : +paRaw, vv = Math.round(+$("#tv").value * 100) / 100, m = $("#tm").value.trim();
    if ((oEsp && dEsp) || (!oEsp && !dEsp && de === pa)) return toast("Escolha caixas diferentes"); if ((oEsp || dEsp) && !adm) return toast("Somente admin pode transferir envolvendo a Caixa Especial"); if (!(vv > 0)) return toast("Informe um valor maior que zero"); if (m.length < 3) return toast("Informe o motivo");
    const nDe = oEsp ? "CAIXA ESPECIAL" : ((SA.find(c => c.caixa_id === de) || {}).nome || de), nPa = dEsp ? "CAIXA ESPECIAL" : ((SA.find(c => c.caixa_id === pa) || {}).nome || pa);
    if (!(await confirmBox(`Transferir <b>${brl(vv)}</b> de <b>${esc(String(nDe))}</b> para <b>${esc(String(nPa))}</b>?<br><small>${oEsp || dEsp ? "Sai do primeiro e entra no segundo no mesmo momento. O estorno reverte os dois lados." : "Sai do primeiro caixa e entra no segundo, no mesmo momento."}</small>`))) return;
    const b = ev.submitter; b.disabled = true;
    try { await api.transferirCaixa(de, pa, vv, m, { origemEspecial: oEsp, destinoEspecial: dEsp }); toast("Transferência lançada ✓"); viewCaixa(d); }
    catch (e) { const em = e.message || ""; toast(/PGRST202|42883|transferir_caixa|schema cache|does not exist|migration-transferir-/i.test(em) ? ((oEsp || dEsp) ? "Transferir envolvendo a Caixa Especial ainda depende da atualização do banco (supabase-loja/migration-transferir-especial.sql). Nada foi lançado." : "Transferir entre caixas ainda depende da atualização do banco (supabase-loja/migration-transferir-caixa.sql). Nada foi lançado.") : em); b.disabled = false; } };
}
async function viewUsuarios() { return BGDUsers.view(app, api, me, { roles: ROLEL, toast, store: "BAGDA STORES", myId: me.id }); }

const PAYF = [["dinheiro", "Dinheiro"], ["pix", "PIX"], ["cartao", "Cartão"], ["transferencia", "Transferência"], ["boleto", "Boleto"]];
const STL = { aberta: "Aberta", parcial: "Parcial", paga: "Paga", vencida: "Vencida" };
const STC = { aberta: "", parcial: "warn", paga: "", vencida: "low" };
const dBR = d => d ? String(d).slice(0, 10).split("-").reverse().join("/") : "";
const val = id => ($("#" + id).value || "").trim();
async function viewClienteExtrato(cid) {
  if (!can("financas")) return go(can("vendas") ? "nota" : "seguranca");
  let x; try { x = await api.clienteExtrato(cid); } catch (e) { app.innerHTML = `<div class="card"><h2>Extrato do cliente</h2><p class="warn">${esc(e.message || e)}</p><button class="btn ghost" id="bk">Voltar</button></div>`; $("#bk").onclick = () => viewClientes(); return; }
  const notas = x.notas || [];
  const linha = n => `<tr class="cxe" data-n="${n.nota_id}" style="cursor:pointer"><td>${esc(n.numero)}</td><td>${esc(String(n.data || "").split("-").reverse().join("/"))}</td><td>${esc(n.rotulo)}</td><td>${esc(n.status)}</td><td>${esc((n.pagamentos || []).map(g => (PAYL[g.metodo] || g.metodo) + " " + brl(g.valor)).join(" + "))}</td><td class="n">${brl(n.total)}</td><td class="n">${brl(n.em_aberto)}</td></tr>
    <tr class="cxi" data-p="${n.nota_id}" hidden><td colspan="7"><p>${esc(n.porque)}</p><table><tr><th>Produto</th><th class="n">Qtd</th><th class="n">Preço da nota</th><th class="n">Total</th></tr>${(n.itens || []).map(i => `<tr><td>${esc(i.sku)} ${esc(i.marca)} ${esc(i.produto)} ${esc(i.tamanho || "")}</td><td class="n">${i.qtd}</td><td class="n">${brl(i.preco_vendido)}</td><td class="n">${brl(i.total)}</td></tr>`).join("") || `<tr><td colspan="4" class="muted">Sem mercadoria.</td></tr>`}</table></td></tr>`;
  app.innerHTML = `<div class="card"><h2>Extrato — ${esc(x.nome)} <button class="btn ghost" id="bk" style="float:right;margin:0">Voltar</button></h2>
  <div class="grid"><div class="kpi"><small>Saldo a receber</small><b>${brl(x.saldo)}</b></div><div class="kpi"><small>Paga Depois vinculado</small><b>${brl(x.total_prazo)}</b></div><div class="kpi"><small>Recebimentos</small><b>${brl(x.total_recebido)}</b></div><div class="kpi"><small>Crédito da loja</small><b>${brl(x.credito_saldo)}</b></div></div>
  <p>${esc(x.explicacao)}</p><p class="muted">${esc(x.historico_sem_vinculo)}</p>
  <h3>Notas vinculadas</h3><table class="stk"><tr><th>Nota</th><th>Data</th><th>Tipo</th><th>Status</th><th>Pagamento</th><th class="n">Total</th><th class="n">Em aberto</th></tr>
  ${notas.map(linha).join("") || `<tr><td colspan="7" class="muted">Nenhuma nota vinculada a este cliente.</td></tr>`}</table>
  <h3>Recebimentos</h3><table><tr><th>Data</th><th>Forma</th><th>Notas</th><th class="n">Valor</th></tr>
  ${(x.recebimentos || []).map(r => `<tr><td>${esc(String(r.data || "").split("-").reverse().join("/"))}</td><td>${esc(PAYL[r.forma] || r.forma || "")}</td><td>${esc((r.notas || []).map(n => n.numero + " " + brl(n.valor)).join(", ") || "sem nota vinculada")}</td><td class="n">${brl(r.valor)}</td></tr>`).join("") || `<tr><td colspan="4" class="muted">Nenhum recebimento.</td></tr>`}</table>
  <h3>Crédito da loja</h3><p class="muted">Não entra no saldo a receber.</p><table><tr><th>Tipo</th><th>Observação</th><th class="n">Valor</th></tr>
  ${(x.creditos || []).map(k => `<tr><td>${esc(k.tipo)}</td><td>${esc(k.obs || "")}</td><td class="n">${k.tipo === "uso" ? "−" : "+"}${brl(k.valor)}</td></tr>`).join("") || `<tr><td colspan="3" class="muted">Sem crédito da loja.</td></tr>`}</table></div>`;
  $("#bk").onclick = () => viewClientes();
  app.querySelectorAll(".cxe").forEach(tr => tr.onclick = () => { const d = app.querySelector(`tr.cxi[data-p="${tr.dataset.n}"]`); if (d) d.hidden = !d.hidden; });
}
async function viewClientes() {
  const L = await api.clientes(); let ed = null;
  app.innerHTML = `<div class="card"><h2>Cadastrar Clientes</h2><form id="f"><div class="grid">
  <div><label>Nome *</label><input id="n" maxlength="120" required></div><div><label>CPF/CNPJ</label><input id="d" maxlength="18" inputmode="numeric"></div>
  <div><label>Telefone</label><input id="t" maxlength="30" inputmode="tel"></div><div><label>E-mail</label><input id="e" type="email" maxlength="160"></div></div>
  <label>Endereço</label><input id="a" maxlength="300"><label>Observações</label><input id="o" maxlength="500">
  <div><label>Limite Paga Depois (R$) — opcional</label><input id="lim" inputmode="decimal" placeholder="vazio = sem limite"><p class="muted">Se o saldo em aberto chegar a esse valor, aparece em Contas a receber → Cobrança para o financeiro iniciar a cobrança.</p></div>
  <button class="btn" id="sv">Salvar cliente</button> <button type="button" class="btn ghost" id="cn" hidden>Cancelar edição</button></form></div>
  <div class="card"><h2>Clientes</h2><input id="b" type="search" placeholder="Buscar nome, telefone ou CPF…"><table id="tb" class="stk"></table></div>`;
  const draw = () => { const q = norm($("#b").value), dq = dig($("#b").value); const F = L.filter(c => !q || norm(c.nome).includes(q) || (dq && (dig(c.doc).includes(dq) || dig(c.telefone).includes(dq))));
    const limTxt = c => c.limite_prazo == null || c.limite_prazo === "" ? "—" : brl(c.limite_prazo);
    $("#tb").innerHTML = `<tr><th>Nome</th><th>CPF/CNPJ</th><th>Telefone</th><th>Atend.</th><th class="n">Limite Paga Depois</th><th class="n">Saldo a receber</th><th></th></tr>` + (F.map(c => `<tr><td>${esc(c.nome)}${c.email ? `<br><small class="muted">${esc(c.email)}</small>` : ""}</td><td>${esc(fmtDoc(c.doc))}</td><td>${esc(c.telefone || "")}</td><td>${esc(c.atendimento || "")}</td><td class="n">${limTxt(c)}</td><td class="n ${+c.saldo > 0 ? "low" : ""}">${brl(c.saldo)}</td><td><button class="vn" data-i="${c.id}">Ver notas</button> <button class="ed" data-i="${c.id}">Editar</button></td></tr>`).join("") || '<tr><td colspan="7" class="muted">Nenhum cliente.</td></tr>');
    document.querySelectorAll(".vn").forEach(b => b.onclick = () => viewClienteExtrato(+b.dataset.i));
    document.querySelectorAll(".ed").forEach(b => b.onclick = () => { const c = L.find(x => x.id === +b.dataset.i); ed = c.id; $("#n").value = c.nome; $("#d").value = fmtDoc(c.doc); $("#t").value = c.telefone || ""; $("#e").value = c.email || ""; $("#a").value = c.endereco || ""; $("#o").value = c.obs || ""; $("#lim").value = c.limite_prazo == null || c.limite_prazo === "" ? "" : Number(c.limite_prazo).toFixed(2).replace(".", ","); $("#cn").hidden = false; $("#sv").textContent = "Salvar alterações"; scrollTo(0, 0); }); };
  $("#b").oninput = draw; draw(); $("#cn").onclick = () => viewClientes();
  $("#f").onsubmit = async ev => { ev.preventDefault(); const c = { nome: val("n"), doc: dig(val("d")) || null, telefone: val("t") || null, email: val("e") || null, endereco: val("a") || null, obs: val("o") || null };
    const limRaw = val("lim");
    if (limRaw) {
      let raw = limRaw.replace(/\s/g, ""); if (raw.includes(",")) raw = raw.replace(/\./g, "").replace(",", ".");
      const vv = Math.round(Number(raw) * 100) / 100;
      if (!Number.isFinite(vv) || vv < 0) return toast("Limite inválido");
      c.limite_prazo = vv;
    } else c.limite_prazo = null;
    if (c.doc && !docOk(c.doc)) return toast("CPF/CNPJ inválido"); ev.submitter && (ev.submitter.disabled = true);
    if (!(await clienteCadastroLivre(c, ed))) { ev.submitter && (ev.submitter.disabled = false); return; }
    try {
      if (ed) await api.salvarCliente(ed, c);
      else { const nid = await api.criarCliente(c); if (c.limite_prazo != null && nid && api.salvarCliente) await api.salvarCliente(nid, { limite_prazo: c.limite_prazo }); }
      toast("Cliente salvo ✓"); viewClientes(); } catch (e) { const em = e.message || ""; toast(/limite_prazo|PGRST204|42703|schema cache/i.test(em) ? "Limite Paga Depois ainda depende da atualização do banco (supabase-loja/migration-prazo-vencimento.sql). Nada foi salvo." : em); ev.submitter && (ev.submitter.disabled = false); } };
}
async function viewFornecedores() {
  const L = await api.fornecedores(); let ed = null;
  app.innerHTML = `<div class="card"><h2>Cadastrar Fornecedor</h2><form id="f"><div class="grid">
  <div><label>Nome *</label><input id="n" maxlength="120" required></div><div><label>CNPJ</label><input id="d" maxlength="18" inputmode="numeric"></div>
  <div><label>Contato</label><input id="c" maxlength="120"></div><div><label>Telefone</label><input id="t" maxlength="30"></div><div><label>E-mail</label><input id="e" type="email" maxlength="160"></div></div>
  <label>Observações</label><input id="o" maxlength="500"><button class="btn" id="sv">Salvar fornecedor</button> <button type="button" class="btn ghost" id="cn" hidden>Cancelar edição</button></form></div>
  <div class="card"><h2>Fornecedores</h2><table class="stk"><tr><th>Nome</th><th>CNPJ</th><th>Contato</th><th>Telefone / e-mail</th><th></th></tr>
  ${L.map(f => `<tr><td>${esc(f.nome)}</td><td>${esc(fmtDoc(f.cnpj))}</td><td>${esc(f.contato || "")}</td><td>${esc(f.telefone || "")} ${esc(f.email || "")}</td><td><button class="ed" data-i="${f.id}">Editar</button></td></tr>`).join("") || '<tr><td colspan="5" class="muted">Nenhum fornecedor.</td></tr>'}</table></div>`;
  document.querySelectorAll(".ed").forEach(b => b.onclick = () => { const f = L.find(x => x.id === +b.dataset.i); ed = f.id; $("#n").value = f.nome; $("#d").value = fmtDoc(f.cnpj); $("#c").value = f.contato || ""; $("#t").value = f.telefone || ""; $("#e").value = f.email || ""; $("#o").value = f.obs || ""; $("#cn").hidden = false; scrollTo(0, 0); });
  $("#cn").onclick = () => viewFornecedores();
  $("#f").onsubmit = async ev => { ev.preventDefault(); const f = { nome: val("n"), cnpj: dig(val("d")) || null, contato: val("c") || null, telefone: val("t") || null, email: val("e") || null, obs: val("o") || null };
    if (f.cnpj && !docOk(f.cnpj)) return toast("CNPJ inválido");
    try { await api.salvarFornecedor(ed, f); toast("Fornecedor salvo ✓"); viewFornecedores(); } catch (e) { toast(e.message); } };
}
async function viewComprasPendentes() {
  if (!can("admin")) return viewSeguranca();
  let D, CX = [], err = "";
  try { [D, CX] = await Promise.all([api.comprasPendentes(), api.comprasCaixas()]); }
  catch (e) { if (/migration-compras-pagamento|migration-cambio-pago|PGRST202|schema cache|does not exist/i.test(e.message || "")) { app.innerHTML = `<div class="card"><h2>Compras pendentes</h2><p class="warn">${esc(e.message)}</p></div>`; return; } err = e.message; D = { grupos: [], pagas: [] }; }
  D = D || { grupos: [], pagas: [] };
  const OP = globalThis.BAGDA_ORIGEM;
  const grupos = D.grupos || [], pagas = D.pagas || [], cot = D.cotacao;
  const aberto = grupos.reduce((a, g) => a + Number(g.total_devido || 0), 0);
  const venc = grupos.reduce((a, g) => a + g.compras.filter(c => c.atrasada).reduce((s, c) => s + Number(c.flutuante ? c.total : c.restante || 0), 0), 0);
  const hist = pagsList => (pagsList || []).length ? `<div class="muted">Pagamentos: ${(pagsList || []).map(p => `${esc(dBR(p.data))} ${brl(p.valor)} · ${p.caixa_oculto ? "caixa só admin" : esc(p.caixa || "—")}`).join(" · ")}</div>` : "";
  const totalCell = c => {
    if (!(Number(c.total_usd) > 0)) return `${brl(c.total)}${Number(c.pago) > 0 ? `<br><small class="muted">pago ${brl(c.pago)} · resta ${brl(c.restante)}</small>` : ""}`;
    const taxaTxt = c.flutuante && cot ? `cotação ${OP.formatCotacao(cot)}` : (c.cambio_pago ? `câmbio pago ${OP.formatCotacao(c.cambio_pago)}` : "");
    return `${OP.formatUsd(c.total_usd)}<br><b>${brl(c.total)}</b>${c.flutuante ? " estimativa" : ""}<br><small class="muted">${taxaTxt}${c.pagamento === "divida" ? `${taxaTxt ? " · " : ""}dívida lançada ${brl(c.pago)}` : ""}</small>`;
  };
  const agenda = c => `<input type="date" class="pqem" data-i="${c.id}" value="${esc(c.pagar_em || "")}" aria-label="Pagar em">`;
  const linha = (c, pagar) => `<tr class="${c.atrasada ? "low" : ""}"><td><b>${esc(c.numero)}</b>${c.pagamento === "divida" ? `<br><small>Dívida</small>` : ""}</td><td>${esc(dBR(c.data))}</td><td>${c.flutuante || c.pagamento === "depois" ? agenda(c) : (c.pagar_em ? esc(dBR(c.pagar_em)) : "—")}</td><td class="${c.atrasada ? "low" : ""}">${c.vencimento ? esc(dBR(c.vencimento)) : "—"}${c.atrasada ? " · atrasada" : ""}</td><td class="n">${totalCell(c)}</td><td>${pagar ? `<button type="button" class="btn ghost pgcp" data-i="${c.id}">Pagar</button>` : ""}</td></tr>
    ${(c.pagamentos || []).length ? `<tr><td colspan="6">${hist(c.pagamentos)}</td></tr>` : ""}
    <tr class="pgf" id="pc${c.id}" hidden><td colspan="6">${c.flutuante ? `<p>Importado ainda sem câmbio travado.${cot ? ` A estimativa de hoje usa a cotação ${OP.formatCotacao(cot)}.` : ""}</p><div class="grid pgrow"><div><label>Data do pagamento</label><input class="pdata" type="date" value="${today()}" max="${today()}"></div><div><label>Câmbio pago (R$ por US$ 1)</label><input class="pcambio" inputmode="decimal" autocomplete="off" value="${cot != null ? String(cot).replace(".", ",") : ""}"></div>${c.pagamento === "divida" ? "" : `<div><label>Sai do caixa</label><select class="pcx">${CX.map(x => `<option value="${x.caixa_id}">${esc(x.nome)}${x.somente_admin ? " (só admin)" : ""} · saldo ${brl(x.saldo)}</option>`).join("")}</select></div>`}<div><label>&nbsp;</label><button type="button" class="btn pok" data-i="${c.id}" data-usd="${c.total_usd || 0}" data-nac="${c.total_nacional || 0}" data-pago="${c.pago || 0}" data-divida="${c.pagamento === "divida" ? "1" : ""}">Confirmar pagamento</button></div></div><p class="pcprev"></p><p class="muted">${c.pagamento === "divida" ? "Este valor ajusta a dívida em COMPRA PRODUTOS. Não confere saldo." : "O valor sai do caixa escolhido. O saldo tem de cobrir o total."} O custo em R$ das unidades fica travado neste câmbio.</p>` : `<div class="grid pgrow"><div><label>Valor</label><input class="pv" type="number" min="0.01" step="0.01" value="${Number(c.restante).toFixed(2)}"></div><div><label>Sai do caixa</label><select class="pcx">${CX.map(x => `<option value="${x.caixa_id}">${esc(x.nome)}${x.somente_admin ? " (só admin)" : ""} · saldo ${brl(x.saldo)}</option>`).join("")}</select></div><div><label>&nbsp;</label><button type="button" class="btn pok" data-i="${c.id}" data-rest="${c.restante}">Confirmar pagamento</button></div></div>`}<p class="warn pcw"></p></td></tr>`;
  app.innerHTML = `<div class="card"><h2>Contas a pagar — compras pendentes</h2><p class="muted">Só admin. Compras novas que ficaram a pagar ao fornecedor. Importado ainda não pago mostra o total em US$ e a estimativa em R$ pela cotação de hoje. Compras antigas, sem forma de pagamento, não entram aqui. O custo por produto continua só no admin.</p><div class="grid"><div class="kpi"><small>Em aberto</small><b>${brl(aberto)}</b></div><div class="kpi"><small>Vencido</small><b class="low">${brl(venc)}</b></div>${cot ? `<div class="kpi"><small>Cotação de hoje</small><b>${OP.formatCotacao(cot)}</b></div>` : ""}</div>${err ? `<p class="warn">${esc(err)}</p>` : ""}</div>
  ${grupos.map(g => `<div class="card"><h2>${esc(g.fornecedor)} <span class="muted">· deve ${brl(g.total_devido)}</span></h2><table class="stk"><tr><th>Compra</th><th>Data</th><th>Pagar em</th><th>Vencimento</th><th class="n">Total</th><th></th></tr>
  ${g.compras.map(c => linha(c, true)).join("") || '<tr><td colspan="6" class="muted">Nenhuma.</td></tr>'}</table></div>`).join("") || '<div class="card"><p class="muted">Nenhuma compra pendente.</p></div>'}
  <div class="card"><h2>Compras pagas</h2><table class="stk"><tr><th>Compra</th><th>Data</th><th>Pagar em</th><th>Vencimento</th><th class="n">Total</th><th></th></tr>
  ${pagas.map(c => `<tr><td><b>${esc(c.numero)}</b></td><td>${esc(dBR(c.data))}</td><td>${c.pagar_em ? esc(dBR(c.pagar_em)) : "—"}</td><td>${c.vencimento ? esc(dBR(c.vencimento)) : "—"}</td><td class="n">${totalCell(c)}</td><td>${esc(c.fornecedor || "")}</td></tr><tr><td colspan="6">${hist(c.pagamentos)}</td></tr>`).join("") || '<tr><td colspan="6" class="muted">Nenhuma compra paga por aqui ainda.</td></tr>'}</table></div>`;
  const dinheiro = (usd, nac, rate) => Math.round((Number(nac) + Math.round(Number(usd) * rate * 100) / 100) * 100) / 100;
  document.querySelectorAll(".pgcp").forEach(b => b.onclick = () => { const r = $("#pc" + b.dataset.i); if (r) r.hidden = !r.hidden; });
  document.querySelectorAll(".pcambio").forEach(inp => inp.oninput = () => {
    const r = inp.closest("tr"), b = r.querySelector(".pok"), prev = r.querySelector(".pcprev");
    const parsed = OP.parseCotacao(inp.value);
    if (parsed.error || !prev) { if (prev) prev.textContent = parsed.error || ""; return; }
    const total = dinheiro(b.dataset.usd, b.dataset.nac, parsed.value);
    const pago = Number(b.dataset.pago) || 0;
    prev.innerHTML = b.dataset.divida === "1"
      ? `Total em R$: <b>${brl(total)}</b> (${OP.formatUsd(b.dataset.usd)} × ${OP.formatCotacao(parsed.value)}). A dívida passa de ${brl(pago)} para ${brl(total)}.`
      : `Sai do caixa: <b>${brl(Math.round((total - pago) * 100) / 100)}</b> (${OP.formatUsd(b.dataset.usd)} × ${OP.formatCotacao(parsed.value)}${Number(b.dataset.nac) > 0 ? " + nacional " + brl(b.dataset.nac) : ""}).`;
  });
  document.querySelectorAll(".pcambio").forEach(inp => inp.dispatchEvent(new Event("input")));
  document.querySelectorAll(".pqem").forEach(inp => inp.onchange = async () => {
    try { await api.compraAgendar(+inp.dataset.i, inp.value || null); toast(inp.value ? "Pagar em atualizado" : "Pagar em removido"); viewComprasPendentes(); }
    catch (e) { toast(e.message); }
  });
  document.querySelectorAll(".pok").forEach(b => b.onclick = async () => {
    const r = $("#pc" + b.dataset.i), w = r.querySelector(".pcw");
    if (b.dataset.usd) {
      const parsed = OP.parseCotacao(r.querySelector(".pcambio").value);
      if (parsed.error) { w.textContent = parsed.error; return; }
      const quando = (r.querySelector(".pdata") || {}).value || today();
      if (quando > today()) { w.textContent = "Data do pagamento inválida"; return; }
      const total = dinheiro(b.dataset.usd, b.dataset.nac, parsed.value);
      const debito = Math.round((total - (Number(b.dataset.pago) || 0)) * 100) / 100;
      const cxEl = r.querySelector(".pcx");
      const cx = cxEl ? CX.find(x => String(x.caixa_id) === cxEl.value) : null;
      if (b.dataset.divida !== "1") {
        if (!cx) { w.textContent = "Escolha o caixa"; return; }
        if (debito > Number(cx.saldo) + 0.001) { w.textContent = "Saldo insuficiente no caixa (R$ " + Number(cx.saldo).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ")"; return; }
      }
      b.disabled = true;
      try { await api.compraPagar(+b.dataset.i, debito, cx ? cx.caixa_id : null, parsed.value, quando); toast("Pagamento registrado ✓ custo travado no câmbio pago"); viewComprasPendentes(); }
      catch (e) { w.textContent = e.message; b.disabled = false; }
      return;
    }
    const v = Math.round(+r.querySelector(".pv").value * 100) / 100, cx = CX.find(x => String(x.caixa_id) === r.querySelector(".pcx").value);
    if (!(v > 0)) { w.textContent = "Informe o valor"; return; }
    if (v > Number(b.dataset.rest) + 0.001) { w.textContent = "Pagamento maior que o saldo da compra"; return; }
    if (!cx) { w.textContent = "Escolha o caixa"; return; }
    if (v > Number(cx.saldo) + 0.001) { w.textContent = "Saldo insuficiente no caixa (R$ " + Number(cx.saldo).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ")"; return; }
    b.disabled = true;
    try { await api.compraPagar(+b.dataset.i, v, cx.caixa_id); toast("Pagamento registrado ✓ (saída no caixa)"); viewComprasPendentes(); }
    catch (e) { w.textContent = e.message; b.disabled = false; }
  });
}
async function viewPagar() {
  const [K, F, CX] = await Promise.all([api.contas(), api.fornecedores(), api.caixasLista()]);
  const ord = { vencida: 0, aberta: 1, parcial: 1, paga: 2 }; K.sort((a, b) => (ord[a.status] - ord[b.status]) || String(a.vencimento).localeCompare(String(b.vencimento)));
  const aberto = K.filter(k => k.status !== "paga").reduce((a, k) => a + Number(k.restante), 0), venc = K.filter(k => k.status === "vencida").reduce((a, k) => a + Number(k.restante), 0);
  app.innerHTML = `<div class="card"><h2>Contas a pagar — dívidas com fornecedores</h2><p class="muted">Contas lançadas à mão.${me.role === "admin" ? ' Compras da loja que ficaram a pagar estão em <button type="button" class="btn ghost" id="go-cpend">Compras pendentes</button>.' : " Compras pendentes da loja ficam só com o admin."}</p><div class="grid"><div class="kpi"><small>Em aberto</small><b>${brl(aberto)}</b></div><div class="kpi"><small>Vencido</small><b class="low">${brl(venc)}</b></div></div></div>
  <div class="card"><h2>Nova conta</h2><form id="f"><div class="grid"><div><label>Fornecedor</label><select id="fo" required>${F.map(f => `<option value="${f.id}">${esc(f.nome)}</option>`).join("")}</select></div>
  <div><label>Valor (R$)</label><input id="v" type="number" min="0.01" step="0.01" required></div><div><label>Vencimento</label><input id="ve" type="date" required></div></div>
  <label>Descrição</label><input id="ds" maxlength="300"><button class="btn">Salvar conta</button>${F.length ? "" : ' <span class="warn">Cadastre um fornecedor primeiro.</span>'}</form></div>
  <div class="card"><h2>Contas</h2><table class="stk"><tr><th>Vencimento</th><th>Fornecedor</th><th>Descrição</th><th class="n">Valor</th><th class="n">Pago</th><th class="n">Restante</th><th>Status</th><th></th></tr>
  ${K.map(k => `<tr><td>${dBR(k.vencimento)}</td><td>${esc(k.fornecedor)}</td><td>${esc(k.descricao || "")}</td><td class="n">${brl(k.valor)}</td><td class="n">${brl(k.pago)}</td><td class="n">${brl(k.restante)}</td><td class="${STC[k.status]}">${STL[k.status]}</td>
    <td>${k.status !== "paga" ? `<button class="pg" data-i="${k.id}">Registrar pagamento</button>` : ""}</td></tr>
    <tr class="pgf" id="pf${k.id}" hidden><td colspan="8"><div class="grid pgrow"><div><label>Valor</label><input class="pv" type="number" min="0.01" step="0.01" value="${Number(k.restante).toFixed(2)}"></div>
    <div><label>Data</label><input class="pd" type="date" value="${today()}"></div><div><label>Forma</label><select class="pfm">${PAYF.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select></div>
    <div><label>Sai do caixa</label><select class="pcx">${CX.map(c => `<option value="${c.caixa_id}">${esc(c.nome)}</option>`).join("")}</select></div><div><button class="btn pok" data-i="${k.id}">Confirmar pagamento</button></div></div></td></tr>`).join("") || '<tr><td colspan="8" class="muted">Nenhuma conta.</td></tr>'}</table></div>`;
  const goPend = $("#go-cpend"); if (goPend) goPend.onclick = () => go("cpend");
  document.querySelectorAll(".pg").forEach(b => b.onclick = () => { const r = $("#pf" + b.dataset.i); r.hidden = !r.hidden; });
  document.querySelectorAll(".pok").forEach(b => b.onclick = async () => { const r = $("#pf" + b.dataset.i), v = +r.querySelector(".pv").value; if (!(v > 0)) return toast("Informe o valor"); b.disabled = true;
    try { await api.pagarConta(+b.dataset.i, Math.round(v * 100) / 100, +r.querySelector(".pcx").value, r.querySelector(".pfm").value, r.querySelector(".pd").value); toast("Pagamento registrado ✓ (saída no caixa)"); viewPagar(); } catch (e) { toast(e.message); b.disabled = false; } });
  $("#f").onsubmit = async ev => { ev.preventDefault(); try { await api.salvarConta(null, { fornecedor_id: +$("#fo").value, valor: +$("#v").value, vencimento: $("#ve").value, descricao: val("ds") || null }); toast("Conta salva ✓"); viewPagar(); } catch (e) { toast(e.message); } };
}
const FORMAR = { dinheiro: "Dinheiro", pix: "PIX", cartao: "Cartão", transferencia: "Transferência", credito: "Crédito Caixa Geral" };
function parseValorDivida(input) {
  let raw = String(input == null ? "" : input).trim().replace(/\s/g, "");
  if (/[eE]|nan|infinity/i.test(raw)) return { error: "Valor inválido" };
  if (raw.includes(",")) raw = raw.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return { error: "Valor inválido" };
  const vv = Math.round(Number(raw) * 100) / 100;
  if (!Number.isFinite(vv) || !(vv > 0)) return { error: "Valor inválido" };
  // frete, total and the prazo amount are already numeric(12,2): 12 digits, 2 of them cents.
  if (Math.trunc(vv).toString().length > 12 - 2) return { error: "Valor inválido" };
  return { value: vv };
}
async function viewReceber(rfSel = "") {
  const [C, RC, CX, CRD, cob] = await Promise.all([api.clientes(), api.recebimentos(), api.caixasLista(), api.creditos().catch(() => []), api.cobrancaAlertas ? api.cobrancaAlertas().catch(() => null) : Promise.resolve(null)]);
  const crd = id => Number((CRD.find(k => k.cliente_id === id) || {}).saldo || 0), isAdm = me.role === "admin", isFin = me.role === "admin" || me.role === "financeiro", RCf = RC.filter(r => !rfSel || r.cliente_id === +rfSel);
  const dev = C.filter(c => +c.saldo > 0).sort((a, b) => b.saldo - a.saldo), tot = dev.reduce((a, c) => a + Number(c.saldo), 0);
  const ativos = C.filter(c => c.ativo !== false).sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
  const PZ = globalThis.BAGDA_PRAZO;
  const cobHtml = (() => {
    if (!isFin) return "";
    if (cob && cob.pendente_sql) return `<div class="card cobranca-panel" id="cobranca"><h2>Cobrança</h2><p class="muted">O painel de cobrança ainda depende da atualização do banco (supabase-loja/migration-prazo-vencimento.sql).</p></div>`;
    const L = (cob && cob.clientes) || [];
    const rows = L.flatMap(c => {
      const motivos = [
        c.tem_vencida ? `<span class="badge vencida">Vencida</span>` : "",
        c.tem_vence_hoje ? `<span class="badge vence_hoje">Vence hoje</span>` : "",
        c.tem_vence_breve ? `<span class="badge vence_breve">Vence em até 2 dias</span>` : "",
        c.no_limite ? `<span class="badge limite">No limite${c.limite_prazo != null ? " (" + brl(c.limite_prazo) + ")" : ""}</span>` : ""
      ].filter(Boolean).join(" ");
      const notas = (c.notas || []).map((n, i) => {
        const cls = n.classe || "";
        const atraso = n.dias_atraso != null && n.classe === "vencida" ? (n.dias_atraso + (n.dias_atraso === 1 ? " dia" : " dias")) : (n.classe === "vence_hoje" ? "0" : "—");
        return `<tr class="${esc(cls)}">${i === 0 ? `<td rowspan="${Math.max((c.notas || []).length, 1)}"><b>${esc(c.nome)}</b><br>${motivos}<br><small>Em aberto: <b>${brl(c.saldo_aberto)}</b></small></td>` : ""}<td>${esc(n.numero)}</td><td class="n">${brl(n.em_aberto)}</td><td>${n.vencimento ? esc(dBR(n.vencimento)) : "—"}</td><td>${esc(atraso)}</td><td>${cls ? `<span class="badge ${esc(cls)}">${esc(PZ ? PZ.labelClasse(cls) : cls)}</span>` : (n.vencimento ? "" : "<span class=\"muted\">sem vencimento</span>")}</td></tr>`;
      }).join("");
      return notas || `<tr><td><b>${esc(c.nome)}</b><br>${motivos}</td><td>—</td><td class="n">${brl(c.saldo_aberto)}</td><td>—</td><td>—</td><td></td></tr>`;
    }).join("");
    return `<div class="card cobranca-panel" id="cobranca"><h2>Cobrança <small class="muted">para o financeiro iniciar a cobrança</small></h2>
    <div class="grid"><div class="kpi"><small>Clientes na lista</small><b>${L.length}</b></div>
    <div class="kpi"><small>Vencidas</small><b class="low">${cob && cob.n_vencidas || 0}</b></div>
    <div class="kpi"><small>Vence hoje</small><b>${cob && cob.n_vence_hoje || 0}</b></div>
    <div class="kpi"><small>Vence em até 2 dias</small><b>${cob && cob.n_vence_breve || 0}</b></div>
    <div class="kpi"><small>No limite</small><b>${cob && cob.n_limite || 0}</b></div></div>
    <p class="muted">Mostra clientes com saldo em aberto cuja nota Paga Depois já venceu, vence hoje ou vence em até 2 dias, e quem chegou no limite Paga Depois cadastrado. Nota quitada em recebimento_notas não entra. Notas antigas sem prazo cadastrado não têm data de vencimento.</p>
    <table class="stk"><tr><th>Cliente</th><th>Nota</th><th class="n">Em aberto</th><th>Vencimento</th><th>Dias em atraso</th><th>Alerta</th></tr>
    ${rows || '<tr><td colspan="6" class="muted">Nenhum alerta no momento.</td></tr>'}</table></div>`;
  })();
  app.innerHTML = `${cobHtml}<div class="card"><h2>Contas a receber — Paga Depois</h2><div class="grid"><div class="kpi"><small>Total a receber</small><b>${brl(tot)}</b></div><div class="kpi"><small>Clientes devendo</small><b>${dev.length}</b></div></div></div>
  ${isAdm ? `<div class="card"><h2>Adicionar dívida</h2><p class="muted">Dívida anterior, só admin. Vira uma nota Paga Depois só de frete: sem item, sem estoque, sem entrada no caixa e sem crédito na Caixa Geral. O cliente passa a dever aqui. Não há teto comercial. O valor tem de ser positivo e caber no numeric(12,2) que frete, total e prazo já usam.</p><form id="fd"><div class="grid"><div><label>Cliente</label><select id="dc" required>${ativos.map(c => `<option value="${c.id}">${esc(c.nome)}</option>`).join("")}</select></div><div><label>Valor (R$)</label><input id="dv" type="text" inputmode="decimal" required placeholder="0,00"></div></div><label>Observação (opcional)</label><input id="do" maxlength="160"><button class="btn">Adicionar dívida</button></form></div>` : ""}
  <div class="card"><h2>Registrar pagamento do cliente</h2><form id="f"><div class="grid"><div><label>Cliente</label><select id="c" required>${dev.map(c => `<option value="${c.id}">${esc(c.nome)} — deve ${brl(c.saldo)}</option>`).join("")}</select></div>
  <div><label>Valor (R$)</label><input id="v" type="number" min="0.01" step="0.01" required></div><div><label>Data</label><input id="d" type="date" value="${today()}"></div>
  <div><label>Pagar com</label><select id="pm"><option value="caixa">Dinheiro no caixa (PIX/Máquina/Dinheiro)</option><option value="credito">Crédito (Caixa Geral)</option></select><small class="muted" id="crs"></small></div>
  <div id="cxw"><label>Entra no caixa</label><select id="cx">${CX.map(c => `<option value="${c.caixa_id}" data-m="${esc(c.metodo || "")}">${esc(c.nome)}</option>`).join("")}${isAdm ? `<option value="cxesp" data-m="dinheiro">Entrada dinheiro — CAIXA SPECIAL</option>` : ""}</select><p class="muted" id="cxespn" hidden>Entrada dinheiro — CAIXA SPECIAL: só admin. O valor entra no ledger da Caixa Especial (mesma Entrada), em dinheiro. Não é LARANJIHA nem GETNET.</p></div>
  <div id="fmw" hidden><label>Forma neste caixa</label><select id="fm">${[["dinheiro","Dinheiro"],["pix","PIX"],["cartao","Cartão"],["transferencia","Transferência"]].map(([v,l]) => `<option value="${v}">${l}</option>`).join("")}</select><small class="muted" id="fmh">Caixa sem método fixo (ex.: LARANJIHA) — escolha a forma.</small></div></div>
  <label>Observação</label><input id="o" maxlength="300"><button class="btn gold">Registrar recebimento</button>${dev.length ? "" : ' <span class="muted">Nenhum cliente com saldo.</span>'}</form></div>
  <div class="card"><h2>Saldos por cliente</h2><table class="stk"><tr><th>Cliente</th><th>Telefone</th><th class="n">Comprou (Paga Depois)</th><th class="n">Pagou</th><th class="n">Saldo</th></tr>
  ${dev.map(c => `<tr><td>${esc(c.nome)}</td><td>${esc(c.telefone || "")}</td><td class="n">${brl(c.total_fiado)}</td><td class="n">${brl(c.total_recebido)}</td><td class="n low">${brl(c.saldo)}</td></tr>`).join("") || '<tr><td colspan="5" class="muted">Ninguém devendo.</td></tr>'}</table></div>
  <div class="card"><h2>Recebimentos por cliente</h2><div class="grid"><div><label>Cliente</label><select id="rf"><option value="">Todos</option>${[...new Map(RC.map(r => [r.cliente_id, r.cliente])).entries()].map(([i, n]) => `<option value="${i}" ${+rfSel === i ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></div></div>
  <table class="stk"><tr><th>Data</th><th>Cliente</th><th>Forma</th><th>Caixa</th><th>Por</th><th class="n">Valor</th>${isAdm ? "<th></th>" : ""}</tr>
  ${RCf.map(r => `<tr><td>${dBR(r.data)}</td><td>${esc(r.cliente)}</td><td>${esc(FORMAR[r.forma] || r.forma || "")}</td><td>${esc(r.caixa === "CAIXA SPECIAL" && r.forma === "dinheiro" ? "Entrada dinheiro — CAIXA SPECIAL" : r.caixa)}</td><td>${esc(r.handle || "")}</td><td class="n">${brl(r.valor)}</td>${isAdm ? `<td><button class="btn ghost est" style="margin:0" data-i="${r.id}">Estornar</button></td>` : ""}</tr>`).join("") || `<tr><td colspan="${isAdm ? 7 : 6}" class="muted">Nenhum recebimento.</td></tr>`}</table>
  ${isAdm ? '<p class="muted">Estornar: devolve o dinheiro do caixa (saída igual), o crédito da Caixa Geral, ou a entrada ligada na Caixa Especial. A dívida da nota volta a ficar em aberto.</p>' : ""}</div>`;
  $("#rf").onchange = e => viewReceber(e.target.value);
  refreshCobrancaBadge();
  if ($("#fd")) $("#fd").onsubmit = async ev => { ev.preventDefault(); const parsed = parseValorDivida($("#dv").value); if (parsed.error) return toast(parsed.error); const vv = parsed.value; const cli = +$("#dc").value, nome = (ativos.find(c => c.id === cli) || {}).nome || ""; if (!(await confirmBox(`Lançar dívida anterior de <b>${brl(vv)}</b> para <b>${esc(nome)}</b>?<br><small>Nota Paga Depois só de frete. Não mexe em estoque, caixa nem crédito.</small>`))) return; const b = ev.submitter; b.disabled = true; const f = $("#fd"), sig = [cli, vv, val("do")].join("|"); if (f.dataset.divSig !== sig || !f.dataset.divChave) { f.dataset.divSig = sig; f.dataset.divChave = (crypto.randomUUID && crypto.randomUUID()) || ("dv" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10)); } try { const x = await api.adicionarDivida(cli, vv, val("do"), f.dataset.divChave); toast(x && x.idempotente ? "Dívida já estava lançada" : "Dívida anterior lançada ✓"); viewReceber(); } catch (e) { const em = e.message || ""; toast(/PGRST202|42883|adicionar_divida|schema cache|does not exist/i.test(em) ? "Adicionar dívida ainda depende da atualização do banco (supabase-loja/migration-adicionar-divida.sql). Nada foi lançado." : em); b.disabled = false; } };
  document.querySelectorAll(".est").forEach(b => b.onclick = async () => { const r = RC.find(x => x.id === +b.dataset.i);
    const m = await motivoBox(`Estornar o recebimento de <b>${esc(r.cliente)}</b> · ${esc(dBR(r.data))} · <b>${brl(r.valor)}</b> (${esc(FORMAR[r.forma] || r.forma)})?<br><small>${r.forma === "credito" ? "O valor volta para o crédito da Caixa Geral." : r.caixa === "CAIXA SPECIAL" ? "Estorna a entrada ligada na Caixa Especial (o excedente que virou crédito também volta, se ainda estiver lá). Os caixas do dia não mudam." : "Sai " + brl(r.valor) + " do caixa " + esc(r.caixa) + "."} A dívida volta a ficar em aberto.</small>`); if (!m) return;
    b.disabled = true; try { const x = await api.estornarRecebimento(r.id, m); toast(x && x.ja_estornado ? "Já estava estornado" : "Recebimento estornado ✓"); viewReceber(rfSel); } catch (e) { toast(estErr(e)); b.disabled = false; } });
  const sc = () => { const c = dev.find(x => x.id === +$("#c").value); if (c) $("#v").value = Number(c.saldo).toFixed(2); };
  const cxSync = () => { const o = $("#cx") && $("#cx").selectedOptions[0], special = !!(o && o.value === "cxesp"), m = o && o.dataset.m, need = !m; if ($("#fmw")) $("#fmw").hidden = !need; if ($("#cxespn")) $("#cxespn").hidden = !special; if ($("#fmh")) $("#fmh").textContent = "Caixa sem método fixo (ex.: LARANJIHA) — escolha a forma."; };
  const pm = () => { const cr = $("#pm").value === "credito", c = dev.find(x => x.id === +$("#c").value); $("#cxw").style.display = cr ? "none" : ""; if ($("#fmw")) $("#fmw").style.display = cr ? "none" : ""; $("#crs").textContent = cr && c ? "Crédito disponível: " + brl(crd(c.id)) : ""; if (!cr) cxSync(); };
  if ($("#c")) { $("#c").onchange = () => { sc(); pm(); }; sc(); $("#pm").onchange = pm; if ($("#cx")) $("#cx").onchange = cxSync; pm(); }
  $("#f").onsubmit = async ev => { ev.preventDefault(); if (!dev.length) return; const c = dev.find(x => x.id === +$("#c").value), vv = Math.round(+$("#v").value * 100) / 100, ex = Math.round((vv - Number(c.saldo)) * 100) / 100;
    if ($("#pm").value === "credito") { const cs = crd(c.id); if (ex > 0) return toast(`Valor maior que a dívida (${brl(c.saldo)})`); if (vv > cs + 0.001) return toast(`Crédito insuficiente na Caixa Geral (saldo ${brl(cs)})`);
      if (!(await confirmBox(`Pagar <b>${brl(vv)}</b> da dívida de <b>${esc(c.nome)}</b> usando o crédito da Caixa Geral?<br><small>Nenhum dinheiro entra no caixa. Crédito restante: ${brl(cs - vv)}</small>`))) return;
      const b = ev.submitter; b.disabled = true; try { await api.receberCredito(c.id, vv, $("#d").value, val("o")); toast("Pago com crédito da Caixa Geral ✓"); viewReceber(); } catch (e) { toast(e.message); b.disabled = false; } return; }
    const o = $("#cx").selectedOptions[0], special = o && o.value === "cxesp", forma = (o.dataset.m || ($("#fm") && $("#fm").value) || "dinheiro");
    if (special) {
      const msg = ex > 0 ? `Valor maior que a dívida (${brl(c.saldo)}).<br><b>${brl(ex)}</b> vira crédito na Caixa Geral de <b>${esc(c.nome)}</b>.<br>Os <b>${brl(vv)}</b> são <b>Entrada dinheiro — CAIXA SPECIAL</b> (não nos caixas do dia). Confirmar?` : `Registrar <b>${brl(vv)}</b> de <b>${esc(c.nome)}</b> como <b>Entrada dinheiro — CAIXA SPECIAL</b>?<br><small>Dinheiro no ledger da Caixa Especial. Não entra em LARANJIHA nem GETNET.</small>`;
      if (!(await confirmBox(msg))) return;
      const b = ev.submitter; b.disabled = true; const f = $("#f"), sig = [c.id, vv, forma, $("#d").value].join("|");
      if (f.dataset.cxespSig !== sig || !f.dataset.cxespChave) { f.dataset.cxespSig = sig; f.dataset.cxespChave = (crypto.randomUUID && crypto.randomUUID()) || ("cx" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10)); }
      try { await api.receberCxesp(c.id, vv, forma, $("#d").value, val("o"), f.dataset.cxespChave); toast(ex > 0 ? `Dívida quitada ✓ · ${brl(ex)} virou crédito na Caixa Geral · entrou na Caixa Especial` : "Recebimento registrado ✓ (entrada na Caixa Especial)"); viewReceber(); }
      catch (e) { const em = e.message || ""; toast(/PGRST202|42883|registrar_recebimento_cxesp|schema cache|does not exist/i.test(em) ? "CAIXA SPECIAL no recebimento ainda depende da atualização do banco (supabase-loja/migration-receber-caixa-especial.sql). Nada foi lançado." : em); b.disabled = false; }
      return;
    }
    if (ex > 0 && !(await confirmBox(`Valor maior que a dívida (${brl(c.saldo)}).<br><b>${brl(ex)}</b> vira crédito na Caixa Geral de <b>${esc(c.nome)}</b>.<br>Confirmar?`))) return;
    const b = ev.submitter; b.disabled = true;
    try { await api.receber(+$("#c").value, Math.round(+$("#v").value * 100) / 100, +$("#cx").value, forma, $("#d").value, val("o")); toast(ex > 0 ? `Dívida quitada ✓ · ${brl(ex)} virou crédito na Caixa Geral` : "Recebimento registrado ✓ (entrada no caixa)"); viewReceber(); } catch (e) { toast(e.message); b.disabled = false; } };
}
async function exportCSV() {
  const R = stockSort(await api.adminProducts()), cols = ["sku", "marca", "produto", "tamanho", "fornecedor", "custo", "preco_venda", "margem_pct", "estoque", "estoque_minimo", "ativo"];
  if (R.some(r => r.origem != null || r.preco_usd != null)) cols.push("origem", "preco_usd");
  const cell = v => { let s = String(v ?? ""); if (/^[=+\-@]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
  const csv = "\ufeff" + cols.join(";") + "\n" + R.map(r => cols.map(c => cell(r[c])).join(";")).join("\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `produtos-custo-${today()}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
// ---------- Resumo do dia por caixa (admin/financeiro; servidor confere em caixa_resumo) ----------
const FORMAL = { dinheiro: "Dinheiro", pix: "PIX", cartao: "Cartão", transferencia: "Transferência", boleto: "Boleto", prazo: "Paga Depois" };
async function viewResumo(d = today(), c = null, back = false) {
  if (me.role !== "admin" && me.role !== "financeiro") { app.innerHTML = '<div class="card"><h2>Sem acesso</h2><p class="muted">Somente admin e financeiro.</p></div>'; return; }
  let JAN = null; if (me.role !== "admin" && api.caixaFinJanela) { try { JAN = await api.caixaFinJanela(); } catch (e) { JAN = null; } }
  if (JAN && JAN.desde && d < JAN.desde) d = JAN.desde;
  if (JAN && JAN.hoje && d > JAN.hoje) d = JAN.hoje;
  const dlim = JAN && JAN.desde ? ` min="${esc(JAN.desde)}" max="${esc(JAN.hoje || today())}"` : "";
  const L = await api.caixasLista(); c = c || (L.find(x => x.metodo === "pix") || L[0]).caixa_id;
  let R; try { R = await api.caixaResumo(c, d); } catch (e) { app.innerHTML = `<div class="card"><h2>Resumo do dia</h2><p class="warn">${esc(e.message)}</p><div class="grid noprint"><div><label>Caixa</label><select id="rc">${L.map(x => `<option value="${x.caixa_id}" ${x.caixa_id === c ? "selected" : ""}>${esc(x.nome)}</option>`).join("")}</select></div><div><label>Data</label><input id="rd" type="date" value="${d}"${dlim}></div></div></div>`;
    $("#rd").onchange = ev => viewResumo(ev.target.value, c, back); $("#rc").onchange = ev => viewResumo(d, +ev.target.value, back); return; }
  const TL = { venda: "Venda", entrada: "Entrada", saida: "Saída", estorno: "Estorno" }, s = R.sessao, dd = d.split("-").reverse().join("/");
  const VD = {}; if (R.movimentos.some(m => m.nota)) (await (api.notasLancar ? api.notasLancar() : Promise.resolve([])).catch(() => [])).forEach(n => VD[String(n.nota_id).padStart(6, "0")] = n.handle);
  const vend = m => m.nota ? VD[m.nota] || "" : "";
  const FD = api.freteDia ? await api.freteDia(d).catch(() => null) : null;
  const CD = api.caxinhaDia ? await api.caxinhaDia(d).catch(() => null) : null;
  const admR = me.role === "admin", mostraSaldo = admR || R.saldo_inicial != null || R.saldo_final != null, iniR = mostraSaldo ? R.saldo_inicial : null, fimR = mostraSaldo ? R.saldo_final : null;
  const saldoTxt = v => v == null || v === "" ? "—" : caixaSaldoHtml(v);
  const hxNote = !mostraSaldo ? '<p class="muted">Saldo inicial e saldo final ficam só com o admin, exceto na Caixa Dinheiro. Eles incluem movimento anterior à janela do financeiro (últimos 3 dias, ou o período liberado).</p>' : (/HX/.test(R.caixa || "") ? "" : "");
  app.innerHTML = `<div class="card"><h2>Resumo do dia — ${esc(R.caixa)} · ${esc(dd)}
    <span class="noprint" style="float:right">${back ? '<button class="btn ghost" id="bk" style="margin:0">← Caixa (todos)</button> ' : ""}<button class="btn ghost" id="csv" style="margin:0">CSV</button> <button class="btn" id="pr" style="margin:0">Imprimir / PDF (A4)</button></span></h2>
  <div class="grid noprint"><div><label>Caixa</label><select id="rc">${L.map(x => `<option value="${x.caixa_id}" ${x.caixa_id === c ? "selected" : ""}>${esc(x.nome)}</option>`).join("")}</select></div>
  <div><label>Data (horário de São Paulo)</label><input id="rd" type="date" value="${d}"${dlim}></div></div>${FD && FD.frete > 0 ? `<p><b>Frete (motoboy) do dia — todas as notas ativas:</b> ${brl(FD.frete)} em ${FD.notas} nota(s) <small class="muted">(já incluído nos pagamentos/caixas; não é produto)</small></p>` : ""}${CD && CD.caxinha > 0 ? `<p><b>Caxinha d Natal do dia — todas as notas ativas:</b> ${brl(CD.caxinha)} em ${CD.notas} nota(s) <small class="muted">(já incluído nos pagamentos/caixas; não é produto)</small></p>` : ""}
  <div class="grid" style="margin-top:12px">
    <div class="kpi"><small>Abertura</small><b>${s ? brl(s.abertura_valor) : "—"}</b><small>${s ? `${esc(s.aberto_por || "")} ${esc(s.aberto_em || "")}` : "Não aberto"}</small></div>
    <div class="kpi"><small>Saldo inicial (sistema)</small><b>${saldoTxt(iniR)}</b></div>
    <div class="kpi"><small>Entradas</small><b>${brl(R.entradas)}</b></div><div class="kpi"><small>Saídas</small><b>${brl(R.saidas)}</b></div>
    <div class="kpi"><small>Fechamento</small><b>${s && s.fechamento_contado != null ? brl(s.fechamento_contado) : "—"}</b><small>${s && s.diferenca != null ? "Diferença " + brl(s.diferenca) : "Não fechado"}</small></div>
    <div class="kpi"><small>Saldo final</small><b>${saldoTxt(fimR)}</b></div></div>${hxNote}</div>
  <div class="card"><h2>Movimentos</h2><table class="stk"><tr><th>Data/hora</th><th>Tipo</th><th>Nota nº</th><th>Cliente</th><th>Vendedor</th><th>Lançada por</th><th>Forma</th><th class="n">Valor</th></tr>
  ${R.movimentos.map(m => `<tr><td>${esc(m.hora)}</td><td>${TL[m.tipo] || esc(m.tipo)}</td><td>${esc(m.nota || "—")}</td><td>${esc((m.cliente || "").trim() || "—")}</td><td>${esc(vend(m))}</td><td>${esc(m.usuario || "")}</td><td>${esc(FORMAL[m.forma] || m.forma || "")}</td><td class="n">${brl(m.assinado)}</td></tr>`).join("") || '<tr><td colspan="8" class="muted">Sem movimentos.</td></tr>'}
  ${Object.entries(R.por_forma).map(([f, v]) => `<tr class="sep"><th colspan="7">Total ${esc(FORMAL[f] || f)}</th><th class="n">${brl(v)}</th></tr>`).join("")}
  <tr class="tot"><th colspan="7">${mostraSaldo ? "SALDO FINAL" : "MOVIMENTO DO DIA"}</th><th class="n">${mostraSaldo ? saldoTxt(fimR) : brl((R.movimentos || []).reduce((a, m) => a + Number(m.assinado), 0))}</th></tr></table></div>`;
  $("#rd").onchange = e => viewResumo(e.target.value, c, back); $("#rc").onchange = e => viewResumo(d, +e.target.value, back); if ($("#bk")) $("#bk").onclick = () => go("caixa"); $("#pr").onclick = () => window.print();
  $("#csv").onclick = () => { const q = v => { let t = String(v ?? ""); if (/^[=+\-@]/.test(t) && !/^-?\d/.test(t)) t = "'" + t; return '"' + t.replace(/"/g, '""') + '"'; }, n = v => Number(v).toFixed(2).replace(".", ",");
    const rows = [["Caixa", R.caixa], ["Data", dd], ["Abertura", s ? n(s.abertura_valor) : ""], ["Saldo inicial", mostraSaldo && iniR != null ? n(iniR) : ""], [], ["Data/hora", "Tipo", "Nota", "Cliente", "Vendedor", "Lançada por", "Forma", "Valor", "Motivo"],
      ...R.movimentos.map(m => [m.hora, TL[m.tipo] || m.tipo, m.nota || "", m.cliente || "", vend(m), m.usuario || "", FORMAL[m.forma] || m.forma || "", n(m.assinado), m.motivo || ""]), [],
      ...Object.entries(R.por_forma).map(([f, v]) => ["Total " + (FORMAL[f] || f), n(v)]), ["Fechamento contado", s && s.fechamento_contado != null ? n(s.fechamento_contado) : ""], ["Saldo final", mostraSaldo && fimR != null ? n(fimR) : ""]];
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + rows.map(r => r.map(q).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    a.download = `resumo-${R.caixa.replace(/[^\w]+/g, "-").toLowerCase()}-${d}.csv`; a.click(); };
}
// ---------- HX por dia (SOMENTE ADMIN; servidor confere em caixa_hx_dia) ----------
async function viewHxDia(d = today()) {
  if (me.role !== "admin") { app.innerHTML = '<div class="card"><h2>Sem acesso</h2><p class="muted">Somente admin.</p></div>'; return; }
  const TL = { venda: "Venda", entrada: "Entrada", saida: "Saída", estorno: "Estorno" }, dd = d.split("-").reverse().join("/");
  let R, C; try { [R, C] = await Promise.all([api.caixaHxDia(d), api.hxConfig().catch(() => null)]); } catch (e) { app.innerHTML = `<div class="card"><h2>HX por dia</h2><p class="warn">${esc(/caixa_hx_dia|PGRST202|42883/.test(e.message) ? "Falta rodar a atualização do banco (migration-caixa-hx-dia)." : e.message)}</p></div>`; return; }
  app.innerHTML = `<div class="card"><h2>HX por dia — ${esc(R.caixa)} · ${esc(dd)} <button class="btn noprint" id="pr" style="float:right;margin:0">Imprimir</button></h2>
  <label class="noprint">Data (horário de São Paulo)</label><input id="hd" class="noprint" type="date" value="${d}" style="max-width:200px">
  <div class="grid" style="margin-top:12px"><div class="kpi"><small>Total do dia</small><b>${brl(R.total_dia)}</b></div>
    <div class="kpi"><small>Entradas</small><b>${brl(R.entradas)}</b></div><div class="kpi"><small>Saídas</small><b>${brl(R.saidas)}</b></div>
    <div class="kpi"><small>Saldo final (acumulado)</small><b>${caixaSaldoHtml(R.saldo_final)}</b></div></div></div>
  <div class="card"><h2>Movimentos</h2><table class="stk"><tr><th>Data/hora</th><th>Tipo</th><th>Nota nº</th><th>Cliente</th><th>Motivo</th><th>Lançada por</th><th class="n">Valor</th></tr>
  ${R.movimentos.map(m => `<tr><td>${esc(m.hora)}</td><td>${TL[m.tipo] || esc(m.tipo)}</td><td>${esc(m.nota || "—")}</td><td>${esc((m.cliente || "").trim() || "—")}</td><td>${esc(m.motivo || "")}</td><td>${esc(m.usuario || "")}</td><td class="n">${brl(m.assinado)}</td></tr>`).join("") || '<tr><td colspan="7" class="muted">Sem movimentos.</td></tr>'}
  <tr class="tot"><th colspan="6">TOTAL DO DIA</th><th class="n">${brl(R.total_dia)}</th></tr></table></div>
  ${C ? `<div class="card noprint"><h2>Configuração</h2><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="hxp" ${C.hx_fin_ve_passado ? "checked" : ""} style="width:auto"> Financeiro vê dias anteriores no Caixa HX</label>
  <p class="muted">Desligado (padrão): o financeiro vê só o dia de hoje no HX. Cada mudança fica registrada em Segurança.</p></div>` : ""}`;
  $("#hd").onchange = e => viewHxDia(e.target.value); $("#pr").onclick = () => window.print();
  if ($("#hxp")) $("#hxp").onchange = async e => { try { await api.hxConfigSet(e.target.checked); toast(e.target.checked ? "Financeiro agora vê dias anteriores do HX" : "Financeiro vê só hoje no HX"); } catch (x) { e.target.checked = !e.target.checked; toast(x.message); } };
}
// ---------- Caixa Especial (somente admin): entradas, saídas com motivo, devolução de crédito de cliente ----------
async function viewCxEsp() {
  if (me.role !== "admin") { app.innerHTML = '<div class="card"><h2>Sem acesso</h2><p class="muted">Somente admin.</p></div>'; return; }
  let M, S, C; try { [M, S, C] = await Promise.all([api.cxEsp(), api.creditos().catch(() => []), api.clientes().catch(() => [])]); }
  catch (e) { app.innerHTML = `<div class="card"><h2>Caixa Especial</h2><p class="warn">${esc(/v_caixa_especial|PGRST20[25]|42P01|schema cache|does not exist/i.test(e.message) ? "Falta rodar a atualização do banco (m10-caixa-especial.sql)." : e.message)}</p></div>`; return; }
  const saldo = M.length ? Number(M[0].saldo_apos) : 0, cred = S.filter(c => +c.saldo > 0), dh = t => new Date(t).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const ent = M.filter(m => m.tipo === "entrada").reduce((a, m) => a + Number(m.valor), 0), sai = M.filter(m => m.tipo === "saida").reduce((a, m) => a + Number(m.valor), 0);
  app.innerHTML = `<div class="card"><h2>Caixa Especial <small class="muted">(só admin)</small></h2><div class="grid"><div class="kpi"><small>Saldo atual</small><b>${caixaSaldoHtml(saldo)}</b></div><div class="kpi"><small>Entradas</small><b>${brl(ent)}</b></div><div class="kpi"><small>Saídas</small><b>${brl(sai)}</b></div></div>
  <p class="muted">Separada dos caixas do dia: não aparece em Caixa, Resumo nem relatórios. Quem lançou e a hora ficam gravados automaticamente.</p></div>
  <div class="card"><h2>Novo lançamento</h2><form id="f"><div class="grid"><div><label>Tipo</label><select id="tp"><option value="saida">Saída (tirar dinheiro)</option><option value="entrada">Entrada (colocar dinheiro)</option></select></div>
  <div><label>Valor (R$) *</label><input id="v" type="number" min="0.01" step="0.01" required></div>
  <div id="dv"><label>Devolução de crédito do cliente (opcional)</label><select id="c"><option value="">— não é devolução —</option>${cred.map(c => `<option value="${c.cliente_id}" data-s="${c.saldo}">${esc(c.nome)} · crédito ${brl(c.saldo)}</option>`).join("")}</select></div></div>
  <label id="lm">Motivo / para onde vai o dinheiro *</label><input id="m" maxlength="300" placeholder="Ex.: devolução excedente nota 000035 — negolu">
  <p class="muted" id="hc" hidden>A saída também baixa o crédito do cliente na Caixa Geral (mesmo valor).</p><button class="btn gold">Salvar</button></form></div>
  <div class="card"><h2>Extrato</h2><table class="stk"><tr><th>Data/hora</th><th>Tipo</th><th>Motivo / destino</th><th>Cliente</th><th>Por</th><th class="n">Valor</th><th class="n">Saldo</th><th></th></tr>
  ${M.map(m => `<tr class="${m.estornado ? "exc" : ""}"><td>${esc(dh(m.created_at))}</td><td>${m.tipo === "entrada" ? "Entrada" : "Saída"}</td><td>${esc(m.motivo)}</td><td>${esc(m.cliente || "")}${m.credito_id ? ' <small class="muted">devolução de crédito</small>' : ""}</td><td>${esc(m.handle || "")}</td><td class="n ${m.tipo === "saida" ? "low" : ""}">${m.tipo === "saida" ? "−" : "+"}${brl(m.valor)}</td><td class="n">${caixaSaldoHtml(m.saldo_apos)}</td>
  <td>${m.estornado ? '<small class="muted">estornado</small>' : m.estorno_de ? '<small class="muted">estorno</small>' : `<button class="btn ghost estx" style="margin:0" data-i="${m.id}">Estornar</button>`}</td></tr>`).join("") || '<tr><td colspan="8" class="muted">Sem lançamentos. Comece com uma Entrada (saldo inicial).</td></tr>'}</table></div>`;
  const sync = () => { const s = $("#tp").value === "saida"; $("#dv").hidden = !s; if (!s) $("#c").value = ""; $("#hc").hidden = !$("#c").value; $("#lm").textContent = s ? "Motivo / para onde vai o dinheiro *" : "Observação"; };
  $("#tp").onchange = sync; $("#c").onchange = () => { const o = $("#c").selectedOptions[0]; if (o.value && !$("#v").value) $("#v").value = (+o.dataset.s).toFixed(2); sync(); }; sync();
  document.querySelectorAll(".estx").forEach(b => b.onclick = async () => { const k = M.find(x => x.id === +b.dataset.i);
    const mo = await motivoBox(`Estornar ${k.tipo === "entrada" ? "a entrada" : "a saída"} de <b>${brl(k.valor)}</b> (${esc(k.motivo)})?${k.credito_id ? `<br><small>O crédito de ${esc(k.cliente)} volta (${brl(k.valor)}).</small>` : ""}`); if (!mo) return;
    b.disabled = true; try { const x = await api.cxEspEstornar(k.id, mo); toast(x && x.ja_estornado ? "Já estava estornado" : "Lançamento estornado ✓"); viewCxEsp(); } catch (e) { toast(e.message); b.disabled = false; } });
  $("#f").onsubmit = async ev => { ev.preventDefault(); const tp = $("#tp").value, v = Math.round(+$("#v").value * 100) / 100, m = val("m"), cid = +$("#c").value || null;
    if (!(v > 0)) return toast("Informe o valor"); if (tp === "saida" && m.length < 3) return toast("Informe o motivo / para onde vai o dinheiro");
    const cn = cid ? $("#c").selectedOptions[0].textContent.split(" · ")[0] : "";
    if (!(await confirmBox(tp === "entrada" ? `Colocar <b>${brl(v)}</b> na Caixa Especial?` : `Tirar <b>${brl(v)}</b> da Caixa Especial?<br>Motivo: ${esc(m)}${cid ? `<br>Devolução de crédito: <b>${esc(cn)}</b> (o crédito baixa ${brl(v)})` : ""}`))) return;
    const b = ev.submitter; b.disabled = true;
    try { if (tp === "entrada") await api.cxEspEntrada(v, m); else await api.cxEspSaida(v, m, cid); toast("Lançamento salvo ✓"); viewCxEsp(); } catch (e) { toast(e.message); b.disabled = false; } };
}
// ---------- Caixa Geral: crédito de cliente (entradas e usos; saldo calculado no banco) ----------
async function viewCaixaGeral(sel) {
  const [S, C, M, CX] = await Promise.all([api.creditos(), api.clientes(), api.creditoMov(sel || null), api.caixasLista().catch(() => [])]);
  const tot = S.reduce((a, c) => a + Number(c.saldo), 0), selC = sel && (S.find(c => c.cliente_id === sel) || C.find(c => c.id === sel));
  const isAdm = me.role === "admin", TPL = { entrada: "Entrada", uso: "Uso" }, dh = t => new Date(t).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const formas = [["dinheiro", "Dinheiro"], ["pix", "PIX"], ["cartao", "Cartão"], ["transferencia", "Transferência"]];
  app.innerHTML = `<div class="card"><h2>Caixa Geral — crédito de clientes</h2><div class="grid"><div class="kpi"><small>Crédito total dos clientes</small><b>${brl(tot)}</b></div><div class="kpi"><small>Clientes com crédito</small><b>${S.filter(c => +c.saldo > 0).length}</b></div></div>
  <p class="muted">Entrada sem caixa continua o crédito antigo. Entrada com caixa: o dinheiro entra nesse caixa e vira crédito. Não quita dívida de Contas a receber. Para usar numa venda: Nova nota → Local do pagamento = CAIXA GERAL.</p></div>
  <div class="card"><h2>Adicionar crédito</h2><form id="f"><div class="grid"><div><label>Cliente *</label><select id="c" required><option value="">— selecione —</option>${C.filter(c => c.ativo !== false).map(c => `<option value="${c.id}" ${sel === c.id ? "selected" : ""}>${esc(c.nome)}${c.telefone ? " · " + esc(c.telefone) : ""}</option>`).join("")}</select></div>
  <div><label>Valor (R$) *</label><input id="v" type="number" min="0.01" step="0.01" required></div><div><label>Tipo</label><select id="tp"><option value="entrada">Entrada (adicionar crédito)</option><option value="uso">Uso (baixar crédito)</option></select></div></div>
  <div id="cxcred"><div class="grid"><div><label for="cx">Entra no caixa</label><select id="cx"><option value="">Sem caixa (crédito antigo)</option>${(CX || []).map(c => `<option value="${c.caixa_id}" data-m="${esc(c.metodo || "")}">${esc(c.nome)}</option>`).join("")}</select><p class="muted" id="cxhint">Sem caixa: só o crédito. Com caixa: entra nesse caixa e vira crédito. Não quita dívida.</p></div>
  <div id="fmw" hidden><label for="fm">Forma</label><select id="fm">${formas.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select><small class="muted">Caixa sem método fixo (ex.: LARANJIHA, GETNET, GASTOS LOJA, PRIME) — escolha a forma.</small></div>
  <div id="dtw" hidden><label for="d">Data</label><input id="d" type="date" value="${today()}"><small class="muted">O caixa grava a data de hoje.</small></div></div></div>
  <label>Observação</label><input id="o" maxlength="300" placeholder="Ex.: crédito do sistema antigo"><button class="btn gold">Salvar</button> <span class="muted">Cliente novo? Cadastre em Clientes.</span></form></div>
  <div class="card"><h2>Saldos por cliente</h2><table class="stk"><tr><th>Cliente</th><th>Telefone</th><th class="n">Entradas</th><th class="n">Usos</th><th class="n">Saldo</th><th>Último mov.</th><th></th></tr>
  ${S.map(c => `<tr class="${sel === c.cliente_id ? "on" : ""}"><td>${esc(c.nome)}</td><td>${esc(c.telefone || "")}</td><td class="n">${brl(c.total_entradas)}</td><td class="n">${brl(c.total_usos)}</td><td class="n"><b>${brl(c.saldo)}</b></td><td>${c.ultimo_mov ? esc(dh(c.ultimo_mov)) : ""}</td><td><button class="hist" data-i="${c.cliente_id}">Histórico</button></td></tr>`).join("") || '<tr><td colspan="7" class="muted">Nenhum crédito lançado ainda.</td></tr>'}</table></div>
  <div class="card"><h2>${selC ? "Histórico — " + esc(selC.nome) + (selC.saldo != null ? " · saldo " + brl(selC.saldo) : "") + ' <button class="btn ghost" id="all" style="float:right;margin:0">Ver todos</button>' : "Últimos lançamentos"}</h2><table class="stk"><tr><th>Data</th><th>Cliente</th><th>Tipo</th><th>Caixa</th><th>Observação</th><th>Por</th><th class="n">Valor</th>${isAdm ? "<th></th>" : ""}</tr>
  ${M.map(k => `<tr class="${k.nota_status === "cancelada" || k.estornado ? "exc" : ""}"><td>${esc(dh(k.created_at))}</td><td>${esc(k.cliente)}</td><td>${TPL[k.tipo]}</td><td>${esc(k.caixa || "—")}</td><td>${esc(k.obs || "")}${k.nota_status === "cancelada" ? ' <b class="warn">nota cancelada — não conta</b>' : ""}</td><td>${esc(k.handle || "")}</td><td class="n ${k.tipo === "uso" ? "low" : ""}">${k.tipo === "uso" ? "−" : "+"}${brl(k.valor)}</td>${isAdm ? `<td>${k.estornado ? '<small class="muted">estornado</small>' : k.estorno_de ? '<small class="muted">estorno</small>' : k.nota_id ? "" : `<button class="btn ghost estc" style="margin:0" data-i="${k.id}">Estornar</button>`}</td>` : ""}</tr>`).join("") || '<tr><td colspan="8" class="muted">Sem lançamentos.</td></tr>'}</table></div>`;
  document.querySelectorAll(".hist").forEach(b => b.onclick = () => viewCaixaGeral(+b.dataset.i));
  document.querySelectorAll(".estc").forEach(b => b.onclick = async () => { const k = M.find(x => x.id === +b.dataset.i);
    const m = await motivoBox(`Estornar o lançamento de <b>${esc(k.cliente)}</b>: ${TPL[k.tipo]} <b>${brl(k.valor)}</b>${k.caixa ? " · " + esc(k.caixa) : ""}${k.obs ? " (" + esc(k.obs) + ")" : ""}?<br><small>Será gravado um lançamento inverso (${k.tipo === "entrada" ? "uso" : "entrada"}) de ${brl(k.valor)}.${k.caixa ? " O caixa " + esc(k.caixa) + " recebe o estorno do mesmo valor." : ""}</small>`); if (!m) return;
    b.disabled = true; try { const x = await api.estornarCredito(k.id, m); toast(x && x.ja_estornado ? "Já estava estornado" : "Lançamento estornado ✓"); viewCaixaGeral(sel); } catch (e) { toast(estErr(e)); b.disabled = false; } }); if ($("#all")) $("#all").onclick = () => viewCaixaGeral();
  const cxSync = () => { const entrada = $("#tp").value === "entrada"; $("#cxcred").hidden = !entrada; if (!entrada) return; const o = $("#cx").selectedOptions[0], on = !!(o && o.value); $("#fmw").hidden = !(on && !o.dataset.m); $("#dtw").hidden = !on; $("#cxhint").textContent = on ? "O valor entra nesse caixa e vira crédito. Não quita dívida de Contas a receber." : "Sem caixa: só o crédito, como antes. Não entra no caixa do dia."; };
  $("#tp").onchange = cxSync; $("#cx").onchange = cxSync; cxSync();
  $("#f").onsubmit = async ev => { ev.preventDefault(); const cid = +$("#c").value, v = Math.round(+$("#v").value * 100) / 100, tp = $("#tp").value; if (!cid) return toast("Escolha o cliente"); if (!(v > 0)) return toast("Informe o valor");
    const nome = $("#c").selectedOptions[0].textContent, o = $("#cx").selectedOptions[0], comCaixa = tp === "entrada" && o && o.value;
    const forma = comCaixa ? (o.dataset.m || $("#fm").value) : "";
    if (comCaixa && !forma) return toast("Escolha a forma");
    const onde = comCaixa ? ` e lançar ${brl(v)} em ${o.textContent}${forma && !o.dataset.m ? " (" + forma + ")" : ""}` : "";
    if (!confirm(`${tp === "entrada" ? "Adicionar" : "Baixar"} ${brl(v)} ${tp === "entrada" ? "de crédito para" : "do crédito de"} ${nome}${onde}?`)) return; const b = ev.submitter; b.disabled = true;
    try { if (comCaixa) await api.lancarCreditoCaixa(cid, v, +o.value, forma, val("o"), $("#d").value); else await api.lancarCredito(cid, tp, v, val("o")); toast(comCaixa ? "Crédito salvo e entrou no caixa ✓" : "Crédito salvo ✓"); viewCaixaGeral(cid); } catch (e) { toast(e.message); b.disabled = false; } };
}
// ---------- Notas a lançar: o financeiro escolhe em qual caixa entra o dinheiro de cada nota ----------
async function viewLancar(todas) {
  const [L, CX] = await Promise.all([api.notasLancar(), api.caixasLista()]);
  /* valor_prazo/prazo_lancada_em vêm da migration-paga-depois-caixa-geral; sem ela, calcula a parte Paga Depois pelo texto de pagamentos e não oferece a opção */
  const cgOk = L.some(n => "valor_prazo" in n), vp = n => n.valor_prazo != null ? +n.valor_prazo : String(n.pagamentos || "").split("+").filter(x => x.startsWith("prazo:")).reduce((a, x) => a + +x.split(":")[1], 0);
  const dsp = n => !!n.dispensada_em, cxEsp = n => !!n.cxesp_lancada, cxPend = n => !dsp(n) && +n.valor_caixa > 0 && !n.caixa_lancada_id && !n.tem_movimento && !cxEsp(n), pzPend = n => !dsp(n) && cgOk && vp(n) > 0 && !n.prazo_lancada_em, isAdm = me.role === "admin";
  const V = L.filter(n => +n.valor_caixa > 0 || vp(n) > 0), pend = V.filter(n => cxPend(n) || pzPend(n)), show = todas ? V : pend, nn = id => String(id).padStart(6, "0");
  const dh = t => new Date(t).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const pgs = n => String(n.pagamentos || "").split("+").filter(Boolean).map(x => { const [m, v] = x.split(":"); return `${PAYL[m] || m} ${brl(v)}`; }).join(" + ");
  const onde = n => cxEsp(n) ? "CAIXA SPECIAL" : n.caixa_lancada_id ? (CX.find(c => c.caixa_id === n.caixa_lancada_id) || {}).nome : n.caixas_mov || "";
  const pixOnly = n => { const ms = String(n.pagamentos || "").split("+").map(x => x.split(":")[0]).filter(m => m && m !== "prazo" && m !== "credito"); return ms.length > 0 && ms.every(m => m === "pix"); };
  const pref = n => (!n.caixa_lancada_id && pixOnly(n) && globalThis.BAGDA_PIX_LOCAIS) ? BAGDA_PIX_LOCAIS.caixaId(n.local_pagamento, CX) : null;
  const cliN = n => n.cliente_nome || n.cliente || "", cliCell = n => { const c = cliN(n); return c ? `<td class="cli" title="${esc(c)}">${esc(c)}${n.cliente_id ? "" : ' <small class="muted">(ref.)</small>'}</td>` : '<td class="muted" title="Sem cliente na nota">—</td>'; };
  const acts = n => `<div class="lacts">${dsp(n) ? `<button class="btn ghost ldz" data-n="${n.nota_id}" style="margin:0">Desfazer</button>` : `<button class="btn ghost ldp" data-n="${n.nota_id}" style="margin:0" title="Tira da lista de pendentes; a nota continua válida">Não lançar</button>`}${!(n.caixa_lancada_id || n.tem_movimento || cxEsp(n)) && !/credito:/.test(n.pagamentos || "") ? ` <button class="btn ghost lcp" data-n="${n.nota_id}" style="margin:0" title="Trocar a forma de pagamento (nota ainda não lançada)">Corrigir pagamento</button>` : ""} <button class="btn danger lcn" data-n="${n.nota_id}" style="margin:0" title="Anula a venda, devolve o estoque e estorna o caixa">Cancelar nota</button></div>`;
  const cxCells = n => { if (dsp(n)) return `<td><span class="muted">Não lançar${n.dispensada_por ? " · " + esc(n.dispensada_por) : ""}${n.dispensa_motivo ? "<br><small>" + esc(n.dispensa_motivo) + "</small>" : ""}</span></td><td>${acts(n)}</td>`;
    if (!(+n.valor_caixa > 0)) return `<td></td><td>${acts(n)}</td>`; const ld = n.caixa_lancada_id || n.tem_movimento || cxEsp(n);
    return `<td>${ld ? `<span class="ok-r">Lançada${onde(n) ? ": " + esc(onde(n)) : ""}</span>` : '<b class="warn">Pendente</b>'}</td>
    <td><select class="lcx" data-n="${n.nota_id}"><option value="">— caixa —</option>${CX.map(c => `<option value="${c.caixa_id}" ${(n.caixa_lancada_id === c.caixa_id || pref(n) === c.caixa_id) ? "selected" : ""}>${esc(c.nome)}</option>`).join("")}${isAdm ? `<option value="cxesp" ${cxEsp(n) ? "selected" : ""}>CAIXA SPECIAL</option>` : ""}</select> <button class="btn ${ld ? "ghost" : "gold"} lok" data-n="${n.nota_id}" style="margin:0">${ld ? "Mover" : "Lançar"}</button>${acts(n)}</td>`; };
  const pzCells = n => { const v = vp(n); if (!(v > 0) || dsp(n)) return ""; const ld = !!n.prazo_lancada_em;
    return `<tr class="pz"><td></td><td colspan="4"><small>Paga Depois <b>${brl(v)}</b> → débito de <b>${esc(n.cliente_nome || n.cliente || "?")}</b></small></td><td></td><td class="n">${brl(v)}</td>
    <td>${!cgOk ? '<small class="muted">Caixa Geral: atualização do banco pendente</small>' : ld ? '<span class="ok-r">Lançada: Caixa Geral (débito)</span>' : '<b class="warn">Pendente</b>'}</td>
    <td>${cgOk && !ld ? `<button class="btn gold lcg" data-n="${n.nota_id}" style="margin:0" ${n.cliente_id ? "" : 'disabled title="Nota sem cliente cadastrado"'}>Caixa Geral (débito do cliente)</button>` : ""}</td></tr>`; };
  app.innerHTML = `<div class="card"><h2>Notas a lançar no caixa</h2><div class="grid"><div class="kpi"><small>Pendentes</small><b>${pend.length}</b></div><div class="kpi"><small>Valor pendente (caixa)</small><b>${brl(pend.filter(cxPend).reduce((a, n) => a + Number(n.valor_caixa), 0))}</b></div>${cgOk ? `<div class="kpi"><small>Paga Depois p/ Caixa Geral</small><b>${brl(pend.filter(pzPend).reduce((a, n) => a + vp(n), 0))}</b></div>` : ""}</div>
  <p class="muted">A nota do vendedor fica pendente até você escolher o caixa. A parte Paga Depois vai para a <b>Caixa Geral como débito do cliente</b> (não entra dinheiro em caixa); depois, em Contas a receber, os pagamentos abatem a dívida e o que passar vira crédito. Errou o caixa? Mostre as lançadas e lance de novo no caixa certo (estorna o antigo).</p>
  <label style="display:inline-flex;gap:6px;align-items:center"><input type="checkbox" id="tod" ${todas ? "checked" : ""} style="width:auto"> Mostrar também as já lançadas e as "Não lançar"</label></div>
  <div class="card"><table class="stk lanc"><tr><th>Nº</th><th>Data</th><th>Vendedor</th><th>Cliente</th><th>Pagamento</th><th>Local</th><th class="n">Valor p/ caixa</th><th>Situação</th><th>Caixa</th></tr>
  ${show.map(n => `<tr><td>${nn(n.nota_id)}</td><td>${esc(dh(n.created_at))}</td><td>${esc(n.handle || "")}</td>${cliCell(n)}<td>${esc(pgs(n))}</td><td>${esc(localLbl(n.local_pagamento) || "")}</td><td class="n"><b>${brl(n.valor_caixa)}</b></td>${cxCells(n)}</tr>${pzCells(n)}`).join("") || `<tr><td colspan="9" class="muted">${todas ? "Nenhuma nota." : "Nenhuma nota pendente ✓"}</td></tr>`}</table></div>`;
  $("#tod").onchange = e => viewLancar(e.target.checked);
  document.querySelectorAll(".lok").forEach(b => b.onclick = async () => { const n = show.find(x => x.nota_id === +b.dataset.n), sel = document.querySelector(`.lcx[data-n="${b.dataset.n}"]`), raw = sel.value; if (!raw) return toast("Escolha o caixa");
    const nm = sel.selectedOptions[0].textContent, mv = n.caixa_lancada_id || n.tem_movimento || cxEsp(n), special = raw === "cxesp";
    const extra = special ? "<br><small>Entra só na Caixa Especial. Paga Depois e crédito da Caixa Geral não entram nesse valor.</small>" : "";
    if (!(await confirmBox(`${mv ? "Mover" : "Lançar"} a nota <b>${nn(n.nota_id)}</b> (${brl(n.valor_caixa)}) ${mv ? "para" : "no"} <b>${esc(nm)}</b>?${mv && onde(n) ? `<br><small>Sai de: ${esc(onde(n))} (estorno)</small>` : ""}${extra}`))) return; b.disabled = true;
    try {
      if (special) { const r = await api.lancarNotaCxesp(n.nota_id); toast(r && r.mudou === false ? "Já estava na Caixa Especial ✓" : `Nota ${nn(n.nota_id)} lançada na Caixa Especial ✓`); }
      else { const r = await api.lancarNota(n.nota_id, +raw); toast(r && r.mudou === false ? "Já estava neste caixa ✓" : `Nota ${nn(n.nota_id)} lançada no ${nm} ✓`); }
      viewLancar(todas);
    } catch (e) { toast(e.message); b.disabled = false; } });
  const fnd = b => show.find(x => x.nota_id === +b.dataset.n);
  document.querySelectorAll(".ldp").forEach(b => b.onclick = async () => { const n = fnd(b);
    const m = await textBox("Não lançar esta nota?", `Nota <b>${nn(n.nota_id)}</b> · ${esc(cliN(n) || "sem cliente")} · ${brl(n.total)}<br><small>Ela <b>continua válida</b> (venda, estoque e Paga Depois não mudam) — só sai da lista de pendentes. Dá para desfazer em "Mostrar também…".</small>`, "Não lançar", false, false); if (m === null) return;
    b.disabled = true; try { await api.dispensarNota(n.nota_id, m); toast(`Nota ${nn(n.nota_id)} marcada como Não lançar ✓`); viewLancar(todas); } catch (e) { toast(e.message); b.disabled = false; } });
  document.querySelectorAll(".ldz").forEach(b => b.onclick = async () => { const n = fnd(b); if (!(await confirmBox(`Voltar a nota <b>${nn(n.nota_id)}</b> para pendente?`))) return;
    b.disabled = true; try { await api.desfazerDispensa(n.nota_id); toast(`Nota ${nn(n.nota_id)} voltou para pendente ✓`); viewLancar(todas); } catch (e) { toast(e.message); b.disabled = false; } });
  document.querySelectorAll(".lcn").forEach(b => b.onclick = async () => { const n = fnd(b);
    const m = await textBox("⚠ CANCELAR NOTA", `Cancelar de vez a nota <b>${nn(n.nota_id)}</b> (${brl(n.total)} · ${esc(cliN(n) || "sem cliente")})?<br><small><b>A venda é anulada</b>, os produtos <b>voltam ao estoque</b>, ${n.caixa_lancada_id || n.tem_movimento || cxEsp(n) ? `<b>sai de ${esc(onde(n) || "o caixa")}</b> o que foi lançado (estorno)` : "nada foi lançado em caixa"} e a parte Paga Depois sai da dívida do cliente. Se o cliente já pagou algo dessa nota, estorne o recebimento antes. Não dá para desfazer.</small>`, "Cancelar nota", true, true); if (!m) return;
    b.disabled = true; try { await api.cancelarNotaFin(n.nota_id, m); toast(`Nota ${nn(n.nota_id)} cancelada ✓`); viewLancar(todas); } catch (e) { toast(e.message); b.disabled = false; } });
  document.querySelectorAll(".lcp").forEach(b => b.onclick = async () => { const n = fnd(b), C = await api.clientes().catch(() => []);
    const o = document.createElement("div"); o.className = "nmodal"; o.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:99";
    o.innerHTML = `<div class="card" style="max-width:480px;margin:0"><h2>Corrigir pagamento</h2><p>Nota <b>${nn(n.nota_id)}</b> · ${brl(n.total)}<br><small>Hoje: ${esc(pgs(n))}. Só para nota ainda não lançada em caixa.</small></p>
      <label>Nova forma (valor total ${brl(n.total)})</label><select id="cpm">${PAY.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select>
      <label>Cliente cadastrado (obrigatório para Paga Depois)</label><select id="cpc"><option value="">— manter / sem cliente —</option>${C.filter(c => c.ativo !== false).map(c => `<option value="${c.id}" ${c.id === n.cliente_id ? "selected" : ""}>${esc(c.nome)}</option>`).join("")}</select>
      <label>Motivo *</label><input id="cpo" maxlength="200" placeholder="Ex.: vendedor marcou PIX, era Paga Depois"><p class="warn" id="cpw" style="min-height:1em"></p><button class="btn ghost" id="cbn">Voltar</button> <button class="btn gold" id="cby">Corrigir</button></div>`;
    document.body.append(o); o.querySelector("#cbn").onclick = () => o.remove();
    o.querySelector("#cby").onclick = async () => { const mt = o.querySelector("#cpm").value, cl = +o.querySelector("#cpc").value || null, m = o.querySelector("#cpo").value.trim(), w = o.querySelector("#cpw");
      if (m.length < 3) return (w.textContent = "Informe o motivo (mín. 3 letras)"); if (mt === "prazo" && !cl && !n.cliente_id) return (w.textContent = "Paga Depois exige cliente cadastrado");
      try { await api.corrigirPag(n.nota_id, [{ metodo: mt, valor: Number(n.total) }], cl, m); o.remove(); toast(`Nota ${nn(n.nota_id)}: pagamento corrigido para ${PAYL[mt] || mt} ✓`); viewLancar(todas); } catch (e) { w.textContent = e.message; } }; });
  document.querySelectorAll(".lcg").forEach(b => b.onclick = async () => { const n = show.find(x => x.nota_id === +b.dataset.n), v = vp(n);
    if (!(await confirmBox(`Lançar a parte Paga Depois da nota <b>${nn(n.nota_id)}</b> (<b>${brl(v)}</b>) na <b>Caixa Geral</b> como débito de <b>${esc(n.cliente_nome || n.cliente || "")}</b>?<br><small>Nenhum dinheiro entra em caixa. Os pagamentos desse cliente em Contas a receber abatem a dívida; o que passar vira crédito na Caixa Geral.</small>`))) return; b.disabled = true;
    try { const r = await api.lancarNotaCG(n.nota_id); toast(r && r.mudou === false ? "Já estava lançada na Caixa Geral ✓" : `Nota ${nn(n.nota_id)}: ${brl(v)} no débito de ${n.cliente_nome || n.cliente} ✓`); viewLancar(todas); } catch (e) { toast(e.message); b.disabled = false; } });
}
boot().catch(e => { console.error(e); viewLogin("Erro ao conectar."); });
})();

