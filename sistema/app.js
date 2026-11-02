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
let me = null;
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
  const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, { auth: { persistSession: true, storage: sessionStorage, detectSessionInUrl: false, flowType: "pkce" } });
  sb.auth.onAuthStateChange(ev => { if (ev === "PASSWORD_RECOVERY") needPassword = true; });
  const ok = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
  api = {
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
    async profile() { const u = (await sb.auth.getUser()).data.user; return ok(await sb.from("profiles").select("handle,nome,role,ativo").eq("id", u.id).single()); },
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
    async profile() { return role === "admin" ? { handle: "@mb", nome: "MB", role } : { handle: "@kaio", nome: "Kaio", role }; },
    async products() { await ready; return P; }, async costs() { return role === "admin" ? Object.entries(K).map(([sku, custo]) => ({ sku, custo })) : []; },
    async addSale(s) { const p = P.find(x => x.sku === s.sku); if (!p || p.estoque < s.qtd) throw new Error("Estoque insuficiente ou produto inativo"); p.estoque -= s.qtd; S.unshift({ id: id++, data: today(), ...s, marca: p.marca, produto: p.produto, preco_tabela: p.preco_venda, total: s.qtd * s.preco_vendido, handle: me.handle, nome: me.nome, custo: K[p.sku], aviso: s.preco_vendido < p.preco_venda ? "Abaixo da tabela" : null, created_at: new Date().toISOString() }); },
    async sales() { return S; }, async repSeller() { return grp(S, "handle"); }, async repPay() { return grp(S, "forma_pagamento"); },
    async repProfit() { return role === "admin" ? grp(S, "handle").map(r => ({ ...r, lucro: r.faturamento - r.custo })) : []; },
    async criarNota(forma, items, cliente) { const nid = 1000 + id++; for (const it of items) { await this.addSale({ ...it, forma_pagamento: forma }); S[0].nota_id = nid; S[0].cliente = cliente; } return nid; },
    async nota(nid) { return S.filter(s => s.nota_id === nid); },
    async notas() { return S.filter(s => s.nota_id); },
    async estoqueVendedor() { await ready; return P.filter(p => p.ativo).map(({ sku, marca, produto, tamanho, estoque }) => ({ sku, marca, produto, tamanho, estoque })); },
    async adminProducts() { return P.map(p => ({ ...p, custo: K[p.sku] })); },
    async purchases() { return PU; }, async addPurchase(p) { PU.unshift({ id: id++, data: today(), ...p, total: p.qtd * p.custo_unit }); const x = P.find(y => y.sku === p.sku); x.estoque += p.qtd; K[p.sku] = p.custo_unit; },
    async saveProduct(p, c) { const i = P.findIndex(x => x.sku === p.sku); i < 0 ? P.push({ ...p, estoque: 0 }) : Object.assign(P[i], p); if (c !== "") K[p.sku] = Number(c); }
  };
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
  if (!s) return viewLogin();
  const a = await api.aal();
  if (a.nextLevel === "aal2" && a.currentLevel !== "aal2") return viewMfaChallenge();
  if (needPassword) return viewCriarSenha();
  try { me = await api.profile(); } catch { me = null; }
  if (!me || me.ativo === false) { await api.logout(); return viewLogin("Conta sem perfil ativo. Fale com o MB."); }
  $("#who").textContent = `${me.nome} (${me.handle}) · ${me.role === "admin" ? "Admin" : "Vendedor(a)"}`;
  $("#nav").hidden = false;
  document.querySelectorAll("nav .adm").forEach(b => b.hidden = me.role !== "admin");
  if (MOCK && qs.has("demo")) return viewRecibo(await api.criarNota("PIX", [{ sku: "ARM-001", qtd: 1, preco_vendido: 270 }, { sku: "FER-004", qtd: 2, preco_vendido: 100 }], "Cliente Teste"));
  go(location.hash.slice(1) || "nota");
}
function go(v) {
  if (["compras", "produtos", "relatorio", "vendas"].includes(v) && me.role !== "admin") v = "nota";
  document.querySelectorAll("nav button[data-v]").forEach(b => b.classList.toggle("on", b.dataset.v === v));
  history.replaceState(null, "", location.pathname + location.search + "#" + v);
  ({ nota: viewNota, notas: viewNotas, venda: viewNota, vendas: viewVendas, estoque: viewEstoque, relatorio: viewRelatorio, compras: viewCompras, produtos: viewProdutos, seguranca: viewSeguranca }[v] || viewNota)()
    .catch(e => toast(e.message));
}
document.querySelectorAll("nav button[data-v]").forEach(b => b.onclick = () => go(b.dataset.v));
$("#sair").onclick = async () => { await api.logout(); location.hash = ""; location.reload(); };

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
    catch (e) { fails++; $("#m").textContent = "Nome ou senha inválidos."; setTimeout(() => b.disabled = false, Math.min(30000, 1000 * 2 ** fails)); } };
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
  ${RP.map(r => `<tr><td>${esc(r.forma_pagamento)}</td><td class="n">${r.vendas}</td><td class="n">${r.itens}</td><td class="n">${brl(r.faturamento)}</td></tr>`).join("")}</table></div>`;
  $("#d").onchange = e => viewRelatorio(e.target.value);
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
  $("#fin").onclick = async () => { if (!items.length) return toast("Adicione pelo menos 1 item"); $("#fin").disabled = true;
    try { const nid = await api.criarNota($("#fp").value, items.map(({ sku, qtd, preco_vendido }) => ({ sku, qtd, preco_vendido })), $("#cl").value); toast("Nota gerada ✓"); viewRecibo(nid); }
    catch (e) { toast(e.message); $("#fin").disabled = false; } };
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
