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
const C = window.SISTEMA_CONFIG || {};
const qs = new URLSearchParams(location.search);
const MOCK = qs.has("mock") || !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(C.SUPABASE_URL || "");
const PAY = ["PIX", "Débito", "Crédito", "Dinheiro"];
const $ = s => document.querySelector(s);
const app = $("#app");
const banner = (ok, html) => { document.querySelectorAll(".nb").forEach(x => x.remove()); const d = document.createElement("div"); d.className = "nb noprint"; d.setAttribute("role", ok ? "status" : "alert"); d.style.cssText = `background:${ok ? "#15803d" : "#b91c1c"};color:#fff;padding:18px 20px;border-radius:12px;margin:0 0 14px;font-size:1.35em;line-height:1.35;box-shadow:0 4px 14px rgba(0,0,0,.25)`; d.innerHTML = html; app.prepend(d); d.scrollIntoView({ block: "start" }); return d; };
const nidOk = n => Number.isInteger(+n) && +n > 0 && n !== null && n !== "";
let notaSaving = false;
const confirmNota = (items, total, pag) => new Promise(res => { const o = document.createElement("div"); o.className = "nmodal noprint"; o.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px";
  o.innerHTML = `<div role="dialog" aria-modal="true" style="background:#fff;color:#111;border-radius:14px;max-width:560px;width:100%;max-height:90vh;overflow:auto;padding:22px;box-shadow:0 10px 40px rgba(0,0,0,.35)"><h2 style="margin:0 0 12px">Confirmar nota</h2>
  <table style="width:100%;border-collapse:collapse;font-size:1.05em"><tr><th style="text-align:left">Item</th><th style="text-align:right">Qtd</th><th style="text-align:right">Total</th></tr>${items.map(x => `<tr><td style="padding:6px 0;border-top:1px solid #eee">${esc(x.nome)}</td><td style="text-align:right;border-top:1px solid #eee">${x.qtd}</td><td style="text-align:right;border-top:1px solid #eee">${brl(x.qtd * x.preco_vendido)}</td></tr>`).join("")}</table>
  <p style="font-size:1.4em;margin:14px 0 6px"><b>TOTAL: ${brl(total)}</b></p><p style="font-size:1.1em;margin:0 0 18px">Pagamento: <b>${pag}</b></p>
  <div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap"><button type="button" class="btn ghost" id="nmv">Voltar</button><button type="button" class="btn gold" id="nmc">Confirmar e salvar</button></div></div>`;
  const done = v => { o.remove(); document.removeEventListener("keydown", k); res(v); }, k = e => { if (e.key === "Escape") done(false); };
  document.body.append(o); o.querySelector("#nmv").onclick = () => done(false); o.querySelector("#nmc").onclick = () => done(true); document.addEventListener("keydown", k); o.querySelector("#nmc").focus(); });
const printVia = via => { let v = document.querySelector(".recibo .via"); if (!v) { v = document.createElement("div"); v.className = "via"; v.style.cssText = "text-align:center;font-weight:700;letter-spacing:.12em;border:1px dashed #000;padding:3px;margin:6px 0"; const r = document.querySelector(".recibo .rh"); r ? r.after(v) : document.querySelector(".recibo")?.prepend(v); } v.textContent = "*** " + via + " ***"; window.print(); };
const printBtns = () => { const pr = $("#pr"); if (!pr) return; pr.textContent = "🖨️ Imprimir de novo"; pr.onclick = () => printVia("VIA DA LOJA");
  const c = document.createElement("button"); c.className = "btn gold"; c.id = "prc"; c.textContent = "🧾 Imprimir via do cliente"; c.style.marginLeft = "6px"; c.onclick = () => printVia("VIA DO CLIENTE"); pr.after(c); setTimeout(() => printVia("VIA DA LOJA"), 350); };
const brl = v => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const norm = s => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const match = (p, q) => { const h = norm(`${p.sku} ${p.marca} ${p.produto} ${p.tamanho || ""}`); return norm(q).split(/\s+/).filter(Boolean).every(t => h.includes(t)); };
const coll = new Intl.Collator("pt-BR", { sensitivity: "base" });
const stockSort = L => [...L].sort((a, b) => ((+b.estoque > 0) - (+a.estoque > 0)) || coll.compare(a.produto || "", b.produto || "") || coll.compare(a.marca || "", b.marca || ""));
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const toEmail = v => { v = v.trim(); if (v.includes("@")) return v.toLowerCase();
  const n = v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return n ? n + "@sistema.bgdstores.local" : ""; };
const toast = m => { const t = $("#toast"); t.textContent = m; t.style.display = "block"; clearTimeout(t._h); t._h = setTimeout(() => t.style.display = "none", 3500); };
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
  if (c.includes("expired") || /expired|invalid/i.test(AUTH.error_description || "")) return "Este link expirou ou já foi usado. Peça ao MB um novo convite.";
  if (c.includes("access_denied")) return "Acesso negado pelo link. Peça ao MB um novo convite.";
  return "Não foi possível abrir o link. Peça ao MB um novo convite.";
};
const strongPw = p => p.length >= 12 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p); // {handle, nome, role}

// ---------------- Camada de dados ----------------
let api;
if (!MOCK) {
  const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, { auth: { persistSession: true, storage: sessionStorage, storageKey: (window.BGDSwitch ? BGDSwitch.storageKey(C.SUPABASE_URL) : undefined), detectSessionInUrl: false, flowType: "pkce" } });
  sb.auth.onAuthStateChange(ev => { if (ev === "PASSWORD_RECOVERY") needPassword = true; });
  const ok = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
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
    async products() { return ok(await sb.from("products").select("sku,marca,produto,tamanho,preco_venda,estoque,estoque_minimo,ativo").order("sku")); },
    async estoqueVendedor() { return ok(await sb.from("estoque_vendedor").select("sku,marca,produto,tamanho,estoque")); },
    async costs() { return ok(await sb.from("product_costs").select("sku,custo")); },
    async addSale(s) { ok(await sb.from("sales").insert(s)); },
    async sales(d1, d2) { return ok(await sb.from("v_sales").select("*").gte("data", d1).lte("data", d2).order("created_at", { ascending: false })); },
    async repSeller(d) { return ok(await sb.from("v_report_seller").select("*").eq("data", d)); },
    async repPay(d) { return ok(await sb.from("v_report_payment").select("*").eq("data", d)); },
    async repProfit(d) { return ok(await sb.from("v_report_profit").select("*").eq("data", d)); },
    async criarNota(forma, items, cliente) { return ok(await sb.rpc("criar_nota", { p_forma: forma, p_items: items, p_cliente: cliente || null })); },
    async nota(id) { return ok(await sb.from("v_nota_itens").select("*").eq("nota_id", id)); },
    async extrato(d, adm) { const itens = ok(await sb.from("v_nota_itens").select("*").eq("data", d).order("created_at").order("nota_id").limit(5000)), ids = [...new Set(itens.map(r => r.nota_id))], lucro = {}, seen = {};
      const pags = itens.filter(r => !seen[r.nota_id] && (seen[r.nota_id] = 1)).map(r => ({ nota_id: r.nota_id, metodo: r.forma_pagamento, valor: itens.filter(x => x.nota_id === r.nota_id).reduce((a, x) => a + Number(x.total), 0) }));
      if (adm && ids.length) { const S = ok(await sb.from("sales").select("id,nota_id,qtd,total").in("nota_id", ids).limit(5000)), C = S.length ? ok(await sb.from("sale_costs").select("sale_id,custo_unit").in("sale_id", S.map(x => x.id)).limit(5000)) : [], cm = Object.fromEntries(C.map(c => [c.sale_id, Number(c.custo_unit)]));
        S.forEach(x => { if (x.id in cm) lucro[x.nota_id] = (lucro[x.nota_id] || 0) + Number(x.total) - Number(x.qtd) * cm[x.id]; }); }
      return { itens, pags, lucro }; },
    async notas() { return ok(await sb.from("v_nota_itens").select("nota_id,data,created_at,forma_pagamento,handle,total").order("created_at", { ascending: false }).order("nota_id", { ascending: false }).limit(300)); },
    async adminProducts() { return ok(await sb.from("v_admin_products").select("*").order("sku")); },
    async purchases() { return ok(await sb.from("purchases").select("*").order("id", { ascending: false }).limit(100)); },
    async addPurchase(p) { ok(await sb.from("purchases").insert(p)); },
    async saveProduct(p, custo) {
      ok(await sb.from("products").upsert(p));
      if (custo !== "" && custo != null) ok(await sb.from("product_costs").upsert({ sku: p.sku, custo: Number(custo) }));
    }
  };
} else {
  $("#mockbar").hidden = false;
  const role = qs.get("mock") === "seller" ? "seller" : "admin";
  let P = [], S = [], PU = [], K = {}, id = 1, logged = qs.has("auto");
  const ready = fetch("mock-produtos.json").then(r => r.json()).then(j => {
    P = j.map((p, i) => ({ ...p, estoque: (i * 7) % 9, estoque_minimo: 2, ativo: true }));
    P.forEach(p => K[p.sku] = Math.round(p.preco_venda * 0.55));
    const sellers = [["@kaio", "Kaio"], ["@suelen", "Suelen"], ["@leticia", "Leticia"], ["@bianca", "Bianca"]];
    for (let i = 0; i < 14; i++) {
      const p = P[(i * 5) % P.length], s = role === "seller" ? ["@kaio", "Kaio"] : sellers[i % 4], pv = p.preco_venda - (i % 3 === 0 ? 10 : 0);
      S.push({ id: id++, data: today(), sku: p.sku, marca: p.marca, produto: p.produto, qtd: 1 + (i % 2), preco_tabela: p.preco_venda, preco_vendido: pv, total: pv * (1 + (i % 2)), forma_pagamento: PAY[i % 4], handle: s[0], nome: s[1], custo: K[p.sku], aviso: pv < p.preco_venda ? "Abaixo da tabela" : null, created_at: new Date(Date.now() - Math.floor(i / 2) * 9e6 - (i > 7 ? 864e5 * (i - 6) : 0)).toISOString(), nota_id: 1 + (6 - Math.floor(i / 2)), cliente: null });
    }
  });
  const grp = (rows, key) => Object.values(rows.reduce((a, r) => { const k = r[key]; a[k] ||= { [key]: k, nome: r.nome, vendas: 0, itens: 0, faturamento: 0, custo: 0 }; a[k].vendas++; a[k].itens += r.qtd; a[k].faturamento += r.total; a[k].custo += r.qtd * r.custo; return a; }, {}));
  api = {
    async login(e, pw) { if (!e || !pw) throw new Error("Preencha e-mail e senha"); logged = true; },
    async logout() { logged = false; }, async consumeUrl() { if (AUTH.access_token || AUTH.code || AUTH.token_hash) logged = true; }, async setPassword() {}, async session() { await ready; return logged ? {} : null; },
    async aal() { return { currentLevel: "aal1", nextLevel: "aal1" }; }, async factors() { return []; },
    async enroll() { return { id: "f1", totp: { qr_code: "", secret: "DEMO-SECRET-XXXX" } }; },
    async verify() { toast("Demonstração: 2FA ativado"); }, async unenroll() {},
    async status() { return { locked: qs.has("locked"), is_owner: role === "admin" }; }, async lock() { toast("Demonstração: nada bloqueado"); }, async unlock() {}, async signoutAll() { return 0; }, async reportFail() {},
    async events() { return [{ at: new Date().toISOString(), kind: "failed_login", email: "teste@x.com", detail: {} }]; }, async dumpTable(t) { return t === "products" ? P : []; },
    async profile() { return role === "admin" ? { id: "u-me", handle: "@mb", nome: "MB", role } : { id: "u-me", handle: "@kaio", nome: "Kaio", role }; },
    async products() { await ready; return P; }, async costs() { return role === "admin" ? Object.entries(K).map(([sku, custo]) => ({ sku, custo })) : []; },
    async addSale(s) { const p = P.find(x => x.sku === s.sku); if (!p || p.estoque < s.qtd) throw new Error("Estoque insuficiente ou produto inativo"); p.estoque -= s.qtd; S.unshift({ id: id++, data: today(), ...s, marca: p.marca, produto: p.produto, preco_tabela: p.preco_venda, total: s.qtd * s.preco_vendido, handle: me.handle, nome: me.nome, custo: K[p.sku], aviso: s.preco_vendido < p.preco_venda ? "Abaixo da tabela" : null, created_at: new Date().toISOString() }); },
    async sales() { return S; }, async repSeller() { return grp(S, "handle"); }, async repPay() { return grp(S, "forma_pagamento"); },
    async repProfit() { return role === "admin" ? grp(S, "handle").map(r => ({ ...r, lucro: r.faturamento - r.custo })) : []; },
    async criarNota(forma, items, cliente) { await new Promise(r => setTimeout(r, 400)); if (qs.has("fail")) throw new Error("Falha simulada (demo ?fail=1)"); const nid = 1000 + id++; for (const it of items) { await this.addSale({ ...it, forma_pagamento: forma }); S[0].nota_id = nid; S[0].cliente = cliente; } return nid; },
    async nota(nid) { return S.filter(s => s.nota_id === nid); },
    async extrato(d) { const itens = S.filter(s => s.data === d && s.nota_id), lucro = {}, seen = {}; if (role === "admin") itens.forEach(i => lucro[i.nota_id] = (lucro[i.nota_id] || 0) + i.total - i.qtd * i.custo);
      return { itens, lucro, pags: itens.filter(r => !seen[r.nota_id] && (seen[r.nota_id] = 1)).map(r => ({ nota_id: r.nota_id, metodo: r.forma_pagamento, valor: itens.filter(x => x.nota_id === r.nota_id).reduce((a, x) => a + x.total, 0) })) }; },
    async notas() { return S.filter(s => s.nota_id); },
    async estoqueVendedor() { await ready; return P.filter(p => p.ativo).map(({ sku, marca, produto, tamanho, estoque }) => ({ sku, marca, produto, tamanho, estoque })); },
    async adminProducts() { return P.map(p => ({ ...p, custo: K[p.sku] })); },
    async purchases() { return PU; }, async addPurchase(p) { PU.unshift({ id: id++, data: today(), ...p, total: p.qtd * p.custo_unit }); const x = P.find(y => y.sku === p.sku); x.estoque += p.qtd; K[p.sku] = p.custo_unit; },
    async saveProduct(p, c) { const i = P.findIndex(x => x.sku === p.sku); i < 0 ? P.push({ ...p, estoque: 0 }) : Object.assign(P[i], p); if (c !== "") K[p.sku] = Number(c); }
  };
  const KU = [{ id: "u-me", handle: role === "admin" ? "@mb" : "@kaio", nome: role === "admin" ? "MB" : "Kaio", role: role === "admin" ? "admin" : "vendedor", ativo: true }, { id: "u@sam", handle: "@sam", nome: "Sam", role: "admin", ativo: true }, { id: "u@bianca", handle: "@bianca", nome: "Bianca", role: "vendedor", ativo: true }, { id: "u@suelen", handle: "@suelen", nome: "Suelen", role: "vendedor", ativo: false }];
  Object.assign(api, BGDUsers.mockApi(qs, KU, "u-me"));
}

// ---------------- Telas ----------------
let urlDone = false;
async function boot() {
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
  const st = await api.status().catch(() => null);   // null = migration-004 ainda não rodada
  if (st && st.locked && !st.is_owner) return viewBloqueado();
  isOwner = !!(st && st.is_owner); lockedNow = !!(st && st.locked);
  if (!(await BGDUsers.guard(api, m => viewLogin(m)))) return;
  try { me = await api.profile(); } catch { me = null; }
  if (!me || me.ativo === false) { await api.logout(); return viewLogin("Conta sem perfil ativo. Fale com o MB."); }
  $("#who").textContent = `${me.nome} (${me.handle}) · ${me.role === "admin" ? "Admin" : "Vendedor(a)"}`;
  $("#nav").hidden = false;
  if (window.BGDSwitch) BGDSwitch.mount(me, MOCK ? "mb@demo.local" : await api.email().catch(() => ""));
  document.querySelectorAll("nav .adm").forEach(b => b.hidden = me.role !== "admin");
  if (MOCK && qs.has("demo")) return viewRecibo(await api.criarNota("PIX", [{ sku: "ARM-001", qtd: 1, preco_vendido: 270 }, { sku: "FER-004", qtd: 2, preco_vendido: 100 }], "Cliente Teste"));
  go(location.hash.slice(1) || "nota");
}
function go(v) {
  if (["compras", "produtos", "relatorio", "vendas", "usuarios"].includes(v) && me.role !== "admin") v = "nota";
  document.querySelectorAll("nav button[data-v]").forEach(b => b.classList.toggle("on", b.dataset.v === v));
  history.replaceState(null, "", location.pathname + location.search + "#" + v);
  ({ nota: viewNota, notas: viewNotas, venda: viewNota, vendas: viewVendas, estoque: viewEstoque, relatorio: viewRelatorio, compras: viewCompras, produtos: viewProdutos, seguranca: viewSeguranca, usuarios: viewUsuarios }[v] || viewNota)()
    .catch(e => toast(e.message));
}
document.querySelectorAll("nav button[data-v]").forEach(b => b.onclick = () => go(b.dataset.v));
$("#sair").onclick = async () => { await api.logout(); location.hash = ""; location.reload(); };

async function viewUsuarios() { if (me.role !== "admin") return viewNota(); return BGDUsers.view(app, api, me, { roles: { vendedor: "Vendedor(a)", admin: "Admin" }, toast, store: "Kiosk", myId: me.id }); }
function viewBloqueado() {
  $("#nav").hidden = true; $("#who").textContent = "";
  app.innerHTML = `<div class="card login"><h2>Sistema bloqueado</h2><p class="muted">O sistema foi bloqueado por segurança. Fale com o MB.</p><button class="btn ghost" id="x">Sair</button></div>`;
  $("#x").onclick = async () => { await api.logout(); location.reload(); };
}
const BK_TABLES = ["profiles", "products", "product_costs", "purchases", "notas", "sales", "sale_costs", "security_events"];
async function backupAgora(b) {
  b.disabled = true; const out = { exportado_em: new Date().toISOString(), por: me.handle, tabelas: {} };
  try { for (const t of BK_TABLES) { b.textContent = "Exportando " + t + "…"; out.tabelas[t] = await api.dumpTable(t); }
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 1)], { type: "application/json" }));
    a.download = `backup-sistema-${today()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); toast("Backup baixado ✓ guarde em local seguro");
  } catch (e) { toast(e.message); } b.disabled = false; b.textContent = "Backup agora";
}
async function secAdmin() {
  if (me.role !== "admin") return "";
  const ev = await api.events().catch(() => null);
  const L = { failed_login: "Login falho", role_change: "Mudança de função", admin_added: "Novo admin", profile_added: "Novo usuário", profile_removed: "Usuário removido", lock: "Bloqueio", unlock: "Desbloqueio", signout_all: "Sessões encerradas" };
  return `<div class="card"><h2>Segurança do sistema</h2>
  <p class="muted">Backup agora baixa um arquivo JSON com todas as tabelas (inclui custos). Guarde fora do computador da loja.</p>
  <button class="btn" id="bk">Backup agora</button>
  ${ev === null ? `<p class="muted">Bloqueio e log de segurança ainda não ativados no banco (migration-004).</p>` : `
  ${lockedNow ? `<p class="warn"><b>Sistema BLOQUEADO</b> (só o dono acessa)</p>` : `<button class="btn gold" id="lk" style="background:#b91c1c;color:#fff">Bloquear sistema</button>`}
  ${isOwner ? `${lockedNow ? `<button class="btn" id="ul">Desbloquear sistema</button>` : ""} <button class="btn ghost" id="so">Encerrar todas as sessões</button>` : ""}
  <h3>Eventos recentes</h3><table class="stk"><tr><th>Quando</th><th>Evento</th><th>Detalhe</th></tr>
  ${ev.map(e => `<tr><td>${esc(new Date(e.at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }))}</td><td>${esc(L[e.kind] || e.kind)}</td><td>${esc(e.email || e.detail?.handle || e.detail?.reason || "")}</td></tr>`).join("") || `<tr><td colspan="3" class="muted">Nenhum evento.</td></tr>`}</table>`}</div>`;
}
function wireSec() {
  const b = $("#bk"); if (b) b.onclick = () => backupAgora(b);
  const lk = $("#lk"); if (lk) lk.onclick = async () => { const r = prompt("BLOQUEAR o sistema para todos (exceto o MB)? Escreva o motivo e confirme:"); if (r === null) return;
    if (!confirm("Confirmar bloqueio? Vendedores e admins perdem o acesso até o MB desbloquear.")) return;
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
async function viewVenda() {
  const P = (await api.products()).filter(p => p.ativo);
  app.innerHTML = `<div class="card"><h2>Nova venda</h2><form id="f">
  <label>Produto</label><select id="sku" required><option value="">Escolha…</option>${P.map(p => `<option value="${esc(p.sku)}" ${p.estoque < 1 ? "disabled" : ""}>${esc(p.sku)} · ${esc(p.marca)} ${esc(p.produto)} ${esc(p.tamanho || "")} — ${brl(p.preco_venda)} (${p.estoque} em estoque)</option>`).join("")}</select>
  <div class="grid"><div><label>Quantidade</label><input id="q" type="number" min="1" max="50" value="1" required></div>
  <div><label>Preço vendido (R$/un) — obrigatório</label><input id="pv" type="number" min="0.01" step="0.01" required></div>
  <div><label>Forma de pagamento</label><select id="fp" required>${PAY.map(x => `<option>${x}</option>`).join("")}</select></div></div>
  <label>Observação (opcional)</label><input id="ob" maxlength="300">
  <p class="warn" id="w"></p><button class="btn gold">Registrar venda</button></form></div>`;
  const chk = () => { const p = P.find(x => x.sku === $("#sku").value), v = +$("#pv").value; $("#w").textContent = p && v && v < p.preco_venda ? `Atenção: abaixo do preço de tabela (${brl(p.preco_venda)})` : ""; };
  $("#sku").onchange = chk; $("#pv").oninput = chk;
  $("#f").onsubmit = async ev => { ev.preventDefault();
    try { await api.addSale({ sku: $("#sku").value, qtd: +$("#q").value, preco_vendido: +$("#pv").value, forma_pagamento: $("#fp").value, observacao: $("#ob").value || null }); toast("Venda registrada ✓"); viewVenda(); }
    catch (e) { toast(e.message); } };
}
async function viewVendas() {
  const d = today(), S = await api.sales(d, d), adm = me.role === "admin";
  app.innerHTML = `<div class="card"><h2>${adm ? "Vendas de hoje (todos)" : "Minhas vendas de hoje"}</h2>
  <table><tr><th>Hora</th><th>Produto</th><th class="n">Qtd</th><th class="n">Vendido</th><th class="n">Total</th><th>Pagamento</th>${adm ? "<th>Vendedor</th>" : ""}</tr>
  ${S.map(s => `<tr><td>${new Date(s.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}</td><td>${esc(s.marca)} ${esc(s.produto)}${s.aviso ? ` <span class="warn">${esc(s.aviso)}</span>` : ""}</td><td class="n">${s.qtd}</td><td class="n">${brl(s.preco_vendido)}</td><td class="n">${brl(s.total)}</td><td>${esc(s.forma_pagamento)}</td>${adm ? `<td>${esc(s.handle)}</td>` : ""}</tr>`).join("") || `<tr><td colspan="7" class="muted">Nenhuma venda hoje.</td></tr>`}</table></div>`;
}
async function viewEstoque() {
  const adm = me.role === "admin";
  const P = stockSort(adm ? await api.products() : await api.estoqueVendedor());
  app.innerHTML = `<div class="card"><h2>Estoque${adm ? "" : " (consulta)"} <button class="btn noprint" id="pe" style="float:right;margin:0">Imprimir / PDF</button></h2><input id="b" class="noprint" type="search" autocomplete="off" placeholder="Buscar produto, marca ou SKU…" autofocus>
  <table id="t" class="stk"></table></div>`;
  const row = adm ? p => `<tr><td>${esc(p.sku)}</td><td>${esc(p.marca)} ${esc(p.produto)} ${esc(p.tamanho || "")}</td><td class="n">${brl(p.preco_venda)}</td><td class="n ${p.estoque <= p.estoque_minimo ? "low" : ""}">${p.estoque}${p.estoque <= p.estoque_minimo ? " · REPOR" : ""}</td><td class="n">${p.estoque_minimo}</td></tr>` : p => `<tr><td>${esc(p.sku)}</td><td>${esc(p.marca)}</td><td>${esc(p.produto)}</td><td>${esc(p.tamanho || "")}</td><td class="n">${p.estoque}</td></tr>`;
  const draw = () => { const L = P.filter(p => match(p, $("#b").value)), com = L.filter(p => +p.estoque > 0), sem = L.filter(p => !(+p.estoque > 0));
    $("#t").innerHTML = (adm ? `<tr><th>SKU</th><th>Produto</th><th class="n">Preço</th><th class="n">Estoque</th><th class="n">Mín.</th></tr>` : `<tr><th>SKU</th><th>Marca</th><th>Produto</th><th>Tamanho</th><th class="n">Estoque</th></tr>`) + com.map(row).join("") +
      (sem.length ? `<tr class="sep"><th colspan="5">Sem estoque (${sem.length})</th></tr>` + sem.map(row).join("") : "") + (L.length ? "" : '<tr><td colspan="5" class="muted">Nada encontrado.</td></tr>'); };
  $("#b").oninput = draw; $("#pe").onclick = () => window.print(); draw(); $("#b").focus();
}
async function viewRelatorio(d = today()) {
  const adm = me.role === "admin";
  const [RS, RP, RL] = await Promise.all([api.repSeller(d), api.repPay(d), adm ? api.repProfit(d) : []]);
  const fat = RS.reduce((a, r) => a + Number(r.faturamento), 0), it = RS.reduce((a, r) => a + Number(r.itens), 0), n = RS.reduce((a, r) => a + Number(r.vendas), 0);
  const luc = RL.reduce((a, r) => a + Number(r.lucro), 0);
  app.innerHTML = `<div class="card"><h2>Relatório diário${adm ? "" : " (suas vendas)"}</h2>
  <label>Data</label><input id="d" type="date" value="${d}" style="max-width:200px">
  <div class="grid" style="margin-top:14px"><div class="kpi"><small>Vendas</small><b>${n}</b></div><div class="kpi"><small>Itens</small><b>${it}</b></div>
  <div class="kpi"><small>Faturamento</small><b>${brl(fat)}</b></div><div class="kpi"><small>Ticket médio</small><b>${brl(n ? fat / n : 0)}</b></div>
  ${adm ? `<div class="kpi"><small>Lucro</small><b>${brl(luc)}</b></div><div class="kpi"><small>Margem</small><b>${fat ? (luc / fat * 100).toFixed(1) : 0}%</b></div>` : ""}</div>
  <h3>Por vendedor</h3><table><tr><th>Handle</th><th>Nome</th><th class="n">Itens</th><th class="n">Faturamento</th>${adm ? '<th class="n">Lucro</th>' : ""}</tr>
  ${RS.map(r => `<tr><td>${esc(r.handle)}</td><td>${esc(r.nome)}</td><td class="n">${r.itens}</td><td class="n">${brl(r.faturamento)}</td>${adm ? `<td class="n">${brl((RL.find(x => x.handle === r.handle) || {}).lucro)}</td>` : ""}</tr>`).join("")}</table>
  <h3>Por forma de pagamento</h3><table><tr><th>Pagamento</th><th class="n">Vendas</th><th class="n">Itens</th><th class="n">Faturamento</th></tr>
  ${RP.map(r => `<tr><td>${esc(r.forma_pagamento)}</td><td class="n">${r.vendas}</td><td class="n">${r.itens}</td><td class="n">${brl(r.faturamento)}</td></tr>`).join("")}</table></div><div class="card" id="ext"><h2>Extrato de vendas</h2><p class="muted">Carregando notas…</p></div>`;
  $("#d").onchange = e => viewRelatorio(e.target.value);
  viewExtrato(d, adm, { on: adm, n, it, fat, luc }, { pl: m => m, linhas: true });
}
// ---------- Extrato de vendas (Relatório diário): uma linha por nota, itens expansíveis, totais conferidos com o resumo ----------
async function viewExtrato(d, adm, K, cfg) {
  const host = $("#ext"); if (!host) return;
  let X; try { X = await api.extrato(d, adm); } catch (e) { host.innerHTML = `<h2>Extrato de vendas</h2><p class="warn">${esc(e.message || e)}</p>`; return; }
  if ($("#d") && $("#d").value !== d) return;
  const by = {};
  X.itens.forEach(r => { const n = by[r.nota_id] ||= { nota_id: r.nota_id, created_at: r.created_at, handle: r.handle, nome: r.nome, cliente: r.cliente, status: r.status || "ativa", itens: [], qtd: 0, total: 0, pags: [], lucro: null }; n.itens.push(r); n.qtd += Number(r.qtd); n.total += Number(r.total); });
  X.pags.forEach(g => by[g.nota_id] && by[g.nota_id].pags.push(g));
  if (adm) Object.entries(X.lucro || {}).forEach(([k, v]) => by[k] && (by[k].lucro = Number(v)));
  const L = Object.values(by).sort((a, b) => (new Date(a.created_at) - new Date(b.created_at)) || (a.nota_id - b.nota_id));
  const A = L.filter(n => n.status !== "cancelada"), C = L.filter(n => n.status === "cancelada");
  const sum = (a, f) => a.reduce((s, n) => s + Number(f(n) || 0), 0), c2 = v => Math.round(Number(v || 0) * 100);
  const T = { n: cfg.linhas ? sum(A, n => n.itens.length) : A.length, it: sum(A, n => n.qtd), fat: sum(A, n => n.total), luc: sum(A, n => n.lucro) };
  const PF = {}; A.forEach(n => n.pags.forEach(g => { const k = cfg.pl(g.metodo); PF[k] ||= { n: 0, v: 0 }; PF[k].n++; PF[k].v += Number(g.valor); }));
  const dif = []; if (T.n !== K.n) dif.push(`vendas ${T.n} × ${K.n}`); if (T.it !== K.it) dif.push(`itens ${T.it} × ${K.it}`); if (c2(T.fat) !== c2(K.fat)) dif.push(`faturamento ${brl(T.fat)} × ${brl(K.fat)}`); if (adm && c2(T.luc) !== c2(K.luc)) dif.push(`lucro ${brl(T.luc)} × ${brl(K.luc)}`);
  const hm = t => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(t));
  const nn = id => String(id).padStart(6, "0"), pg = n => n.pags.map(g => `${cfg.pl(g.metodo)} ${brl(g.valor)}`).join(" + ");
  const cols = adm ? 10 : 9, dd = d.split("-").reverse().join("/");
  const rows = L.map(n => { const cx = n.status === "cancelada";
    return `<tr class="${cx ? "exc" : ""}"><td class="noprint"><button class="ext-t" data-n="${n.nota_id}" title="Ver itens" aria-expanded="false">▸</button></td><td>${nn(n.nota_id)}</td><td>${esc(hm(n.created_at))}</td><td>${esc(n.handle || "")}</td><td>${esc(n.cliente || "—")}</td><td>${esc(pg(n))}</td><td class="n">${n.qtd}</td><td class="n">${brl(n.total)}</td>${adm ? `<td class="n">${n.lucro == null ? "—" : brl(n.lucro)}</td>` : ""}<td>${cx ? '<b class="warn">CANCELADA</b><br><small class="muted">fora dos totais</small>' : "Ativa"}</td><td class="noprint"><button class="ext-o" data-n="${n.nota_id}">Abrir nota</button></td></tr>
    <tr class="exi" data-p="${n.nota_id}" hidden><td class="noprint"></td><td colspan="${cols - 2}"><table class="exit"><tr><th>Produto</th><th class="n">Qtd</th><th class="n">Preço un.</th><th class="n">Subtotal</th></tr>
    ${n.itens.map(i => `<tr><td>${esc(i.sku ? i.sku + " · " : "")}${esc(i.marca)} ${esc(i.produto)} ${esc(i.tamanho || "")}</td><td class="n">${i.qtd}</td><td class="n">${brl(i.preco_vendido)}</td><td class="n">${brl(i.total)}</td></tr>`).join("")}</table></td><td class="noprint"></td></tr>`; }).join("");
  host.innerHTML = `<h2>Extrato de vendas — ${esc(dd)} <span class="noprint" style="float:right"><button class="btn ghost" id="exa" style="margin:0">Expandir itens</button> <button class="btn ghost" id="excsv" style="margin:0">CSV</button> <button class="btn" id="expr" style="margin:0">Imprimir / PDF (A4)</button></span></h2>
  <p class="muted">${L.length} nota(s)${C.length ? ` · ${C.length} cancelada(s) mostrada(s) mas fora dos totais` : ""}${cfg.linhas ? " · “Vendas” no resumo = linhas de item" : ""}</p>
  <div style="overflow-x:auto"><table class="stk ext"><tr><th class="noprint"></th><th>Nº</th><th>Hora</th><th>Vendedor</th><th>Cliente</th><th>Pagamento</th><th class="n">Itens</th><th class="n">Total</th>${adm ? '<th class="n">Lucro</th>' : ""}<th>Status</th><th class="noprint"></th></tr>
  ${rows || `<tr><td colspan="${cols + 1}" class="muted">Nenhuma nota nesta data.</td></tr>`}
  ${Object.entries(PF).map(([k, v]) => `<tr class="sep"><th class="noprint"></th><th colspan="5">Total ${esc(k)} (${v.n} ${v.n === 1 ? "nota" : "notas"})</th><th></th><th class="n">${brl(v.v)}</th>${adm ? "<th></th>" : ""}<th></th><th class="noprint"></th></tr>`).join("")}
  <tr class="tot"><th class="noprint"></th><th colspan="5">TOTAL (${A.length} nota(s) ativas${cfg.linhas ? `, ${T.n} linhas` : ""})</th><th class="n">${T.it}</th><th class="n">${brl(T.fat)}</th>${adm ? `<th class="n">${brl(T.luc)}</th>` : ""}<th></th><th class="noprint"></th></tr></table></div>
  ${K.on ? (dif.length ? `<p class="warn"><b>⚠ Não confere com o resumo:</b> ${esc(dif.join(" · "))}</p>` : `<p class="ok-r">✓ Confere com o resumo: ${T.n} vendas · ${T.it} itens · ${brl(T.fat)}${adm ? " · lucro " + brl(T.luc) : ""}</p>`) : ""}`;
  const tog = (id, on) => { const r = host.querySelector(`tr.exi[data-p="${id}"]`), b = host.querySelector(`.ext-t[data-n="${id}"]`); if (!r) return; r.hidden = on == null ? !r.hidden : !on; b.textContent = r.hidden ? "▸" : "▾"; b.setAttribute("aria-expanded", String(!r.hidden)); };
  host.querySelectorAll(".ext-t").forEach(b => b.onclick = () => tog(b.dataset.n));
  host.querySelectorAll(".ext-o").forEach(b => b.onclick = () => viewRecibo(+b.dataset.n));
  $("#exa").onclick = () => { const open = $("#exa").textContent.startsWith("Expandir"); L.forEach(n => tog(n.nota_id, open)); $("#exa").textContent = open ? "Recolher itens" : "Expandir itens"; };
  $("#expr").onclick = () => window.print();
  $("#excsv").onclick = () => { const q = v => { let t = String(v ?? ""); if (/^[=+\-@]/.test(t) && !/^-?\d/.test(t)) t = "'" + t; return '"' + t.replace(/"/g, '""') + '"'; }, m = v => v == null ? "" : Number(v).toFixed(2).replace(".", ",");
    const H = ["Nº", "Data", "Hora", "Vendedor", "Cliente", "Pagamento", "Itens", "Total", ...(adm ? ["Lucro"] : []), "Status", "Nos totais"];
    const out = [["Extrato de vendas", dd], [], H, ...L.map(n => [nn(n.nota_id), dd, hm(n.created_at), n.handle || "", n.cliente || "", n.pags.map(g => `${cfg.pl(g.metodo)} ${m(g.valor)}`).join(" + "), n.qtd, m(n.total), ...(adm ? [m(n.lucro)] : []), n.status === "cancelada" ? "CANCELADA" : "Ativa", n.status === "cancelada" ? "não" : "sim"]), [],
      ["Nº", "SKU", "Produto", "Qtd", "Preço un.", "Subtotal", "Status"], ...L.flatMap(n => n.itens.map(i => [nn(n.nota_id), i.sku || "", `${i.marca || ""} ${i.produto || ""} ${i.tamanho || ""}`.trim(), i.qtd, m(i.preco_vendido), m(i.total), n.status === "cancelada" ? "CANCELADA" : "Ativa"])), [],
      ...Object.entries(PF).map(([k, v]) => ["Total " + k, v.n + " nota(s)", m(v.v)]), ["TOTAL (ativas)", A.length + " nota(s)", m(T.fat), "Itens", T.it, ...(adm ? ["Lucro", m(T.luc)] : [])], ...(C.length ? [["Canceladas (fora dos totais)", C.length + " nota(s)", m(sum(C, n => n.total))]] : [])];
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + out.map(r => r.map(q).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    a.download = `extrato-vendas-${d}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
}
async function viewCompras() {
  const [P, PU] = await Promise.all([api.products(), api.purchases()]);
  app.innerHTML = `<div class="card"><h2>Registrar compra</h2><form id="f"><label>Produto</label><select id="sku" required>${P.map(p => `<option value="${esc(p.sku)}">${esc(p.sku)} · ${esc(p.marca)} ${esc(p.produto)}</option>`).join("")}</select>
  <div class="grid"><div><label>Fornecedor</label><input id="fo"></div><div><label>Qtd</label><input id="q" type="number" min="1" required></div><div><label>Custo unitário (R$)</label><input id="c" type="number" min="0" step="0.01" required></div></div>
  <label>Observação</label><input id="ob"><button class="btn">Salvar compra (soma ao estoque)</button></form></div>
  <div class="card"><h2>Últimas compras</h2><table><tr><th>Data</th><th>SKU</th><th>Fornecedor</th><th class="n">Qtd</th><th class="n">Custo un.</th><th class="n">Total</th></tr>
  ${PU.map(p => `<tr><td>${esc(p.data)}</td><td>${esc(p.sku)}</td><td>${esc(p.fornecedor)}</td><td class="n">${p.qtd}</td><td class="n">${brl(p.custo_unit)}</td><td class="n">${brl(p.total)}</td></tr>`).join("") || '<tr><td colspan="6" class="muted">Nenhuma compra.</td></tr>'}</table></div>`;
  $("#f").onsubmit = async ev => { ev.preventDefault(); try { await api.addPurchase({ sku: $("#sku").value, fornecedor: $("#fo").value || null, qtd: +$("#q").value, custo_unit: +$("#c").value, observacao: $("#ob").value || null }); toast("Compra salva ✓"); viewCompras(); } catch (e) { toast(e.message); } };
}
async function viewProdutos() {
  const [P, K] = await Promise.all([api.products(), api.costs()]); const cm = Object.fromEntries(K.map(k => [k.sku, k.custo]));
  app.innerHTML = `<div class="card"><h2>Produtos e custos (admin) <button class="btn" id="csv" style="float:right;margin:0">Exportar CSV</button></h2><input id="b" type="search" autocomplete="off" placeholder="Buscar produto, marca ou SKU…"><table id="pt"></table></div>
  <div class="card"><h2>Adicionar / editar produto</h2><form id="f"><div class="grid"><div><label>SKU</label><input id="sku" required pattern="[A-Z0-9-]{3,20}"></div><div><label>Marca</label><input id="ma" required></div><div><label>Produto</label><input id="pr" required></div><div><label>Tamanho</label><input id="ta"></div><div><label>Preço de venda</label><input id="pv" type="number" step="0.01" required></div><div><label>Custo (só admin vê)</label><input id="cu" type="number" step="0.01"></div><div><label>Estoque mínimo</label><input id="em" type="number" value="2"></div></div><button class="btn">Salvar</button></form></div>`;
  const head = `<tr><th>SKU</th><th>Produto</th><th class="n">Custo</th><th class="n">Venda</th><th class="n">Margem</th><th class="n">Estoque</th></tr>`;
  const drawP = () => { $("#pt").innerHTML = head + P.filter(p => match(p, $("#b").value)).map(p => { const c = cm[p.sku]; return `<tr><td>${esc(p.sku)}</td><td>${esc(p.marca)} ${esc(p.produto)} ${esc(p.tamanho || "")}</td><td class="n">${c != null ? brl(c) : "—"}</td><td class="n">${brl(p.preco_venda)}</td><td class="n">${c ? ((p.preco_venda - c) / p.preco_venda * 100).toFixed(0) + "%" : "—"}</td><td class="n">${p.estoque}</td></tr>`; }).join(""); };
  $("#b").oninput = drawP; drawP(); $("#b").focus();
  $("#csv").onclick = () => exportCSV().catch(e => toast(e.message));
  $("#f").onsubmit = async ev => { ev.preventDefault(); try { await api.saveProduct({ sku: $("#sku").value, marca: $("#ma").value, produto: $("#pr").value, tamanho: $("#ta").value || null, preco_venda: +$("#pv").value, estoque_minimo: +$("#em").value, ativo: true }, $("#cu").value); toast("Produto salvo ✓"); viewProdutos(); } catch (e) { toast(e.message); } };
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
async function viewNota() {
  const P = (await api.products()).filter(p => p.ativo); let items = [];
  app.innerHTML = `<div class="card"><h2>Nova nota</h2><form id="f">
  <label>Produto</label><input id="bq" type="search" autocomplete="off" placeholder="Digite nome, marca ou SKU… (Enter adiciona)" autofocus>
  <ul id="sug" class="sug"></ul><input type="hidden" id="sku"><div id="sel" class="muted"></div>
  <div class="grid"><div><label>Quantidade</label><input id="q" type="number" min="1" max="50" value="1" required></div>
  <div><label>Preço vendido (R$/un) — obrigatório</label><input id="pv" type="number" min="0.01" step="0.01" required></div></div>
  <p class="warn" id="w"></p><button class="btn ghost">+ Adicionar item</button></form>
  <h3>Itens da nota</h3><table id="it"></table>
  <div class="grid"><div><label>Forma de pagamento</label><select id="fp">${PAY.map(x => `<option>${x}</option>`).join("")}</select></div>
  <div><label>Cliente (opcional)</label><input id="cl" maxlength="120"></div></div>
  <button class="btn gold" id="fin">Finalizar e gerar nota</button></div>`;
  const draw = () => { $("#it").innerHTML = `<tr><th>Produto</th><th class="n">Qtd</th><th class="n">Preço</th><th class="n">Total</th><th></th></tr>` + items.map((x, i) => `<tr><td>${esc(x.nome)}</td><td class="n">${x.qtd}</td><td class="n">${brl(x.preco_vendido)}</td><td class="n">${brl(x.qtd * x.preco_vendido)}</td><td><button data-i="${i}" class="rm">✕</button></td></tr>`).join("") + `<tr><th colspan="3">TOTAL</th><th class="n">${brl(items.reduce((a, x) => a + x.qtd * x.preco_vendido, 0))}</th><th></th></tr>`;
    document.querySelectorAll(".rm").forEach(b => b.onclick = () => { items.splice(+b.dataset.i, 1); draw(); }); };
  const chk = () => { const p = P.find(x => x.sku === $("#sku").value), v = +$("#pv").value; if (p && !$("#pv").value) $("#pv").placeholder = p.preco_venda; $("#w").textContent = p && v && v < p.preco_venda ? `Atenção: abaixo do preço de tabela (${brl(p.preco_venda)})` : ""; };
  let hi = 0, M = [];
  const drawS = () => { const q = $("#bq").value.trim(); M = q ? P.filter(p => match(p, q)).sort((a, b) => (b.estoque > 0) - (a.estoque > 0)).slice(0, 12) : []; hi = Math.min(hi, Math.max(M.length - 1, 0));
    $("#sug").innerHTML = M.map((p, i) => `<li data-s="${esc(p.sku)}" class="${i === hi ? "hi" : ""} ${p.estoque < 1 ? "off" : ""}"><b>${esc(p.marca)} ${esc(p.produto)} ${esc(p.tamanho || "")}</b> <small>${esc(p.sku)} · ${brl(p.preco_venda)} · ${p.estoque} disp.</small></li>`).join("") || (q ? '<li class="off">Nada encontrado</li>' : "");
    document.querySelectorAll("#sug li[data-s]").forEach(li => li.onmousedown = e => { e.preventDefault(); pick(li.dataset.s); }); };
  const pick = sku => { const p = P.find(x => x.sku === sku); if (!p) return; if (p.estoque < 1) return toast("Sem estoque");
    const pv = +$("#pv").value || p.preco_venda, q = +$("#q").value || 1, ja = items.filter(x => x.sku === p.sku).reduce((a, x) => a + x.qtd, 0);
    if (q + ja > p.estoque) return toast(`Só ${p.estoque} disponível`);
    items.push({ sku: p.sku, qtd: q, preco_vendido: pv, nome: `${p.marca} ${p.produto} ${p.tamanho || ""}` }); toast(`+ ${p.marca} ${p.produto}`);
    $("#f").reset(); $("#w").textContent = ""; $("#pv").placeholder = ""; hi = 0; drawS(); draw(); $("#bq").focus(); };
  $("#bq").oninput = () => { hi = 0; drawS(); };
  $("#bq").onkeydown = e => { if (e.key === "ArrowDown") { e.preventDefault(); hi = Math.min(hi + 1, M.length - 1); drawS(); } else if (e.key === "ArrowUp") { e.preventDefault(); hi = Math.max(hi - 1, 0); drawS(); } else if (e.key === "Enter") { e.preventDefault(); if (M[hi]) pick(M[hi].sku); } else if (e.key === "Escape") { $("#bq").value = ""; drawS(); } };
  $("#pv").oninput = chk;
  $("#f").onsubmit = ev => { ev.preventDefault(); if (M[hi]) return pick(M[hi].sku); const p = P.find(x => x.sku === $("#sku").value), q = +$("#q").value; if (!p) return toast("Escolha um produto");
    const ja = items.filter(x => x.sku === p.sku).reduce((a, x) => a + x.qtd, 0);
    if (q + ja > p.estoque) return toast(`Só ${p.estoque} disponível`);
    items.push({ sku: p.sku, qtd: q, preco_vendido: +$("#pv").value, nome: `${p.marca} ${p.produto} ${p.tamanho || ""}` }); $("#f").reset(); $("#w").textContent = ""; draw(); };
  $("#fin").onclick = async () => { if (!items.length) return toast("Adicione pelo menos 1 item");
    if (notaSaving) return; notaSaving = true; if (!(await confirmNota(items, items.reduce((a, x) => a + x.qtd * x.preco_vendido, 0), esc($("#fp").value)))) { notaSaving = false; return; } const fb = $("#fin"), lbl = fb.textContent; fb.disabled = true; fb.textContent = "Salvando..."; document.querySelectorAll(".nb").forEach(x => x.remove());
    const total = items.reduce((a, x) => a + x.qtd * x.preco_vendido, 0), pagTxt = esc($("#fp").value);
    try { const nid = await api.criarNota($("#fp").value, items.map(({ sku, qtd, preco_vendido }) => ({ sku, qtd, preco_vendido })), $("#cl").value);
      if (!nidOk(nid)) throw new Error("Servidor não confirmou o número da nota (retorno: " + JSON.stringify(nid) + ")");
      const R = await api.nota(+nid); if (!R || !R.length) throw new Error("Nota " + nid + " não encontrada após salvar");
      items = []; await viewRecibo(+nid);
      banner(true, `✅ <b>Nota salva nº ${String(nid).padStart(6, "0")}</b><br>Total: <b>${brl(total)}</b> · Pagamento: <b>${pagTxt}</b>`);  printBtns();}
    catch (e) { console.error("Nota NÃO salva:", e); fb.disabled = false; fb.textContent = lbl;
      banner(false, `❌ <b>Nota NÃO salva — tente de novo</b><br><small>${esc(e.message || String(e))}</small><br><small>Os itens continuam no carrinho.</small>`); }
    finally { notaSaving = false; } };
  draw(); $("#bq").focus();
}
async function viewRecibo(nid) {
  const R = await api.nota(nid); if (!R.length) return toast("Nota não encontrada");
  const h = R[0], tot = R.reduce((a, r) => a + Number(r.total), 0);
  app.innerHTML = `<div class="noprint" style="margin-bottom:12px"><button class="btn gold" id="pr">Imprimir / Salvar PDF</button> <button class="btn ghost" id="nv">Nova nota</button></div>
  <div class="recibo"><div class="rh"><b>BAGDA PERFUMES</b><small>bgdstores.com</small></div>
  <div class="rm2"><span>NOTA Nº <b>${String(nid).padStart(6, "0")}</b></span><span>${new Date(h.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span></div>
  <div class="rm2"><span>Vendedor(a): ${esc(h.nome)} (${esc(h.handle)})</span>${h.cliente ? `<span>Cliente: ${esc(h.cliente)}</span>` : ""}</div>
  <table class="ri"><tr><th>Item</th><th class="n">Total</th></tr>
  ${R.map(r => `<tr class="in"><td colspan="2">${esc(r.marca)} ${esc(r.produto)} ${esc(r.tamanho || "")}</td></tr><tr class="iq"><td>${r.qtd} x ${brl(r.preco_vendido)}</td><td class="n">${brl(r.total)}</td></tr>`).join("")}
  <tr class="tot"><td>TOTAL</td><td class="n">${brl(tot)}</td></tr></table>
  <p>Pagamento: <b>${esc(h.forma_pagamento)}</b></p><p class="muted" style="text-align:center">Obrigado pela preferência!</p></div>`;
  $("#pr").onclick = () => window.print(); $("#nv").onclick = () => go("nota");
}
async function viewNotas() {
  const R = await api.notas(), by = {}, adm = me.role === "admin", TZ = "America/Sao_Paulo";
  R.forEach(r => { by[r.nota_id] ||= { ...r, total: 0 }; by[r.nota_id].total += Number(r.total); });
  const L = Object.values(by).sort((a, b) => (new Date(b.created_at) - new Date(a.created_at)) || (b.nota_id - a.nota_id));
  const dkey = d => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
  const dt = d => new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(d).replace(",", "");
  const hoje = dkey(new Date()), ontem = dkey(new Date(Date.now() - 864e5));
  const label = d => { const k = dkey(d); return k === hoje ? "Hoje" : k === ontem ? "Ontem" : new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" }).format(d); };
  const cols = adm ? 6 : 5; let last = "", rows = "";
  for (const n of L) { const d = new Date(n.created_at), k = dkey(d);
    if (k !== last) { rows += `<tr class="sep"><th colspan="${cols}">${esc(label(d))}</th></tr>`; last = k; }
    rows += `<tr><td>${String(n.nota_id).padStart(6, "0")}</td><td>${esc(dt(d))}</td><td>${esc(n.forma_pagamento)}</td>${adm ? `<td>${esc(n.handle)}</td>` : ""}<td class="n">${brl(n.total)}</td><td><button class="ver" data-n="${n.nota_id}">Ver / imprimir</button></td></tr>`; }
  app.innerHTML = `<div class="card"><h2>${adm ? "Notas" : "Minhas notas"}</h2><table class="stk"><tr><th>Nº</th><th>Data / hora</th><th>Pagamento</th>${adm ? "<th>Vendedor</th>" : ""}<th class="n">Total</th><th></th></tr>
  ${rows || `<tr><td colspan="${cols}" class="muted">Nenhuma nota.</td></tr>`}</table></div>`;
  document.querySelectorAll(".ver").forEach(b => b.onclick = () => viewRecibo(+b.dataset.n));
}
async function exportCSV() {
  const R = stockSort(await api.adminProducts()), cols = ["sku", "marca", "produto", "tamanho", "fornecedor", "custo", "preco_venda", "margem_pct", "estoque", "estoque_minimo", "ativo"];
  const cell = v => { let s = String(v ?? ""); if (/^[=+\-@]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
  const csv = "\ufeff" + cols.join(";") + "\n" + R.map(r => cols.map(c => cell(r[c])).join(";")).join("\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `produtos-custo-${today()}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
boot().catch(e => { console.error(e); viewLogin("Erro ao conectar."); });
})();
