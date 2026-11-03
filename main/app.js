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
const CONFIGURED = /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(C.SUPABASE_URL || "") && /^(sb_publishable_|eyJ)/.test(C.SUPABASE_ANON_KEY || "");
const MOCK = qs.has("mock");
const PAY = [["dinheiro", "Dinheiro"], ["pix", "PIX"], ["cartao", "Cartão"], ["prazo", "Paga Depois"]];
const PAYL = Object.fromEntries(PAY);
const ROLEL = { admin: "Admin", vendedor: "Vendedor(a)", financeiro: "Financeiro" };
/* permissões por papel (espelha public.role_perms no banco; o banco é quem garante) */
const PERMS = { admin: ["admin", "vendas", "caixa", "financas"], vendedor: ["vendas"], financeiro: ["caixa", "financas"] };
const can = p => !!me && (PERMS[me.role] || []).includes(p);
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
const dig = s => String(s ?? "").replace(/\D/g, "");
const docOk = v => { const d = dig(v); if (!d) return true; if (/^(\d)\1+$/.test(d)) return false;
  if (d.length === 11) { const f = n => { let s = 0; for (let i = 0; i < n; i++) s += +d[i] * (n + 1 - i); const r = s * 10 % 11; return r === 10 ? 0 : r; }; return f(9) === +d[9] && f(10) === +d[10]; }
  if (d.length === 14) { const f = n => { let s = 0, w = n - 7; for (let i = 0; i < n; i++) { s += +d[i] * w--; if (w < 2) w = 9; } const r = s % 11; return r < 2 ? 0 : 11 - r; }; return f(12) === +d[12] && f(13) === +d[13]; }
  return false; };
const fmtDoc = v => { const d = dig(v); return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : d.length === 14 ? d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5") : (v || ""); };
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const toEmail = v => { v = v.trim(); if (v.includes("@")) return v.toLowerCase();
  const n = v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return n ? n + "@loja.bgdstores.local" : ""; };
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
    async status() { const { data, error } = await sb.rpc("system_status"); if (error) return null; return data; },
    async lock(r) { ok(await sb.rpc("lock_system", { p_reason: r })); },
    async unlock() { ok(await sb.rpc("unlock_system")); },
    async signoutAll() { return ok(await sb.rpc("signout_all")); },
    async reportFail(e) { try { await sb.rpc("report_failed_login", { p_email: e }); } catch {} },
    async events() { const { data, error } = await sb.from("security_events").select("at,kind,email,detail").order("at", { ascending: false }).limit(50); return error ? null : data; },
    async dumpTable(t) { const out = []; for (let i = 0; ; i += 1000) { const { data, error } = await sb.from(t).select("*").range(i, i + 999); if (error) return { error: error.message }; out.push(...data); if (data.length < 1000) return out; } },
    async email() { return (await sb.auth.getUser()).data.user?.email || ""; },
    async profile() { const u = (await sb.auth.getUser()).data.user; return ok(await sb.from("profiles").select("handle,nome,role,ativo").eq("id", u.id).single()); },
    async products() { return ok(await sb.from("products").select("sku,marca,produto,tamanho,preco_venda,estoque,estoque_minimo,ativo").order("sku")); },
    async estoqueVendedor() { return ok(await sb.from("estoque_vendedor").select("sku,marca,produto,tamanho,estoque")); },
    async costs() { return ok(await sb.from("product_costs").select("sku,custo")); },
    async repSeller(d) { return ok(await sb.from("v_report_seller").select("*").eq("data", d)); },
    async repPay(d) { return ok(await sb.from("v_report_payment").select("*").eq("data", d)); },
    async repProfit(d) { return ok(await sb.from("v_report_profit").select("*").eq("data", d)); },
    async criarNota(items, pagamentos, cliente, clienteId) { return ok(await sb.rpc("criar_nota", { p_items: items, p_pagamentos: pagamentos, p_cliente: cliente || null, p_cliente_id: clienteId || null })); },
    async buscarClientes(q) { return ok(await sb.rpc("buscar_clientes", { p_q: q })); },
    async criarCliente(c) { return ok(await sb.rpc("criar_cliente", { p_nome: c.nome, p_telefone: c.telefone || null, p_doc: c.doc || null, p_email: c.email || null, p_endereco: c.endereco || null, p_obs: c.obs || null })); },
    async clientes() { return ok(await sb.from("v_clientes_saldo").select("*").order("nome")); },
    async salvarCliente(id, c) { ok(await sb.from("clientes").update(c).eq("id", id)); },
    async fornecedores() { return ok(await sb.from("fornecedores").select("*").order("nome")); },
    async salvarFornecedor(id, f) { ok(id ? await sb.from("fornecedores").update(f).eq("id", id) : await sb.from("fornecedores").insert(f)); },
    async contas() { return ok(await sb.from("v_contas_pagar").select("*").order("vencimento")); },
    async salvarConta(id, c) { ok(id ? await sb.from("contas_pagar").update(c).eq("id", id) : await sb.from("contas_pagar").insert(c)); },
    async pagarConta(id, v, cx, forma, data) { return ok(await sb.rpc("pagar_conta", { p_conta: id, p_valor: v, p_caixa: cx, p_forma: forma, p_data: data || null })); },
    async contaPagamentos() { return ok(await sb.from("conta_pagamentos").select("*").order("id", { ascending: false }).limit(100)); },
    async recebimentos() { return ok(await sb.from("v_recebimentos").select("*").order("id", { ascending: false }).limit(100)); },
    async receber(cli, v, cx, forma, data, obs) { return ok(await sb.rpc("registrar_recebimento", { p_cliente: cli, p_valor: v, p_caixa: cx, p_forma: forma, p_data: data || null, p_obs: obs || null })); },
    async caixasLista() { return ok(await sb.from("caixas").select("id,nome,metodo").eq("ativo", true).order("id")).map(c => ({ caixa_id: c.id, nome: c.nome, metodo: c.metodo })); },
    async cancelarNota(id, motivo) { ok(await sb.rpc("cancelar_nota", { p_id: id, p_motivo: motivo })); },
    async nota(id) { return ok(await sb.from("v_nota_itens").select("*").eq("nota_id", id)); },
    async notaPag(id) { return ok(await sb.from("nota_pagamentos").select("metodo,valor").eq("nota_id", id).order("id")); },
    async notas() { return ok(await sb.from("v_notas").select("*").order("created_at", { ascending: false }).order("nota_id", { ascending: false }).limit(300)); },
    async caixaSaldos() { return ok(await sb.from("v_caixa_saldo").select("*").order("caixa_id")); },
    async caixaExtrato(d) { return ok(await sb.from("v_caixa_extrato").select("*").eq("data", d).order("created_at")); },
    async caixaResumo(c, d) { return ok(await sb.rpc("caixa_resumo", { p_caixa: c, p_data: d })); },
    async caixaSessoes(d) { return ok(await sb.from("caixa_sessoes").select("*").eq("data", d)); },
    async caixaLancar(m) { ok(await sb.from("caixa_movimentos").insert(m)); },
    async caixaAbrir(c, v) { return ok(await sb.rpc("caixa_abrir", { p_caixa: c, p_valor: v })); },
    async caixaFechar(c, v) { return ok(await sb.rpc("caixa_fechar", { p_caixa: c, p_contado: v })); },
    async usuarios() { return ok(await sb.from("profiles").select("id,handle,nome,role,ativo").order("nome")); },
    async salvarUsuario(id, u) { ok(await sb.from("profiles").update(u).eq("id", id)); },
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
  const role = ["vendedor", "financeiro"].includes(qs.get("mock")) ? qs.get("mock") : "admin";
  const W = { admin: ["@mike", "Mike"], vendedor: ["@kaio", "Kaio"], financeiro: ["@pamela", "Pamela"] }[role];
  const meU = { id: "u-" + role, handle: W[0], nome: W[1], role, ativo: true };
  const U = [meU, ...[["@sam", "Sam", "admin"], ["@hadi", "Hadi", "admin"], ["@bianca", "Bianca", "vendedor"], ["@suelen", "Suelen", "vendedor"], ["@leticia", "Leticia", "financeiro"]].map(([h, n, r]) => ({ id: "u" + h, handle: h, nome: n, role: r, ativo: true }))];
  if (role !== "vendedor") U.push({ id: "u@kaio", handle: "@kaio", nome: "Kaio", role: "vendedor", ativo: true });
  const P = [["JBL-001", "JBL", "Flip 6", "Azul", 799], ["JBL-002", "JBL", "Go 4", "Preto", 349], ["XIA-001", "Xiaomi", "Redmi Buds 5", null, 199], ["XIA-002", "Xiaomi", "Redmi Note 13", "128GB", 1499],
    ["SAM-001", "Samsung", "Galaxy A15", "128GB", 1199], ["APL-001", "Apple", "AirPods 4", null, 1299], ["BAS-001", "Baseus", "Cabo USB-C 1m", null, 49.9], ["BAS-002", "Baseus", "Carregador 30W", null, 129],
    ["ANK-001", "Anker", "Power Bank 10000mAh", null, 199], ["LEN-001", "Lenovo", "Fone LP40", null, 89.9], ["MUL-001", "Multilaser", "Mouse sem fio", null, 59.9], ["KAP-001", "Kapbom", "Suporte veicular", null, 39.9]]
    .map(([sku, marca, produto, tamanho, preco_venda], i) => ({ sku, marca, produto, tamanho, preco_venda, estoque: [5, 0, 8, 3, 0, 2, 20, 12, 6, 0, 9, 4][i], estoque_minimo: 2, ativo: true }));
  const K = Object.fromEntries(P.map(p => [p.sku, Math.round(p.preco_venda * 0.6 * 100) / 100]));
  const CX = [{ caixa_id: 1, nome: "Caixa Dinheiro", metodo: "dinheiro" }, { caixa_id: 2, nome: "Caixa PIX (HX)", metodo: "pix" }, { caixa_id: 3, nome: "Máquina Loja", metodo: "cartao" }];
  const AL = [], N = [], IT = [], PG = [], MV = [], SE = [], PU = [], CL = [], FO = [], CP = [], CPG = [], RC = []; let id = 1, logged = qs.has("auto");
  const sv = a => ["venda", "entrada"].includes(a.tipo) ? a.valor : -a.valor;
  const mov = (caixa_id, tipo, valor, motivo, nota_id, user, at) => MV.push({ id: id++, caixa_id, caixa: CX.find(c => c.caixa_id === caixa_id).nome, tipo, valor, valor_assinado: 0, motivo, nota_id, handle: user.handle, nome: user.nome, created_at: at || new Date().toISOString(), data: new Date(at || Date.now()).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }) });
  const mkNota = (items, pags, cliente, user, at, clienteId) => {
    if (pags.some(g => g.metodo === "prazo") && !clienteId) throw new Error("Paga Depois exige cliente cadastrado");
    if (clienteId) cliente = (CL.find(c => c.id === clienteId) || {}).nome || cliente;
    const tot = items.reduce((a, x) => a + x.qtd * x.preco_vendido, 0), pt = pags.reduce((a, x) => a + Number(x.valor), 0);
    if (Math.round(tot * 100) !== Math.round(pt * 100)) throw new Error(`Pagamentos (${pt.toFixed(2)}) diferentes do total (${tot.toFixed(2)})`);
    for (const it of items) { const p = P.find(x => x.sku === it.sku); if (!p || p.estoque < it.qtd) throw new Error(`Estoque insuficiente ou produto inativo (${it.sku})`); }
    const nid = id++, ts = at || new Date().toISOString();
    for (const it of items) { const p = P.find(x => x.sku === it.sku); p.estoque -= it.qtd; IT.push({ nota_id: nid, sku: p.sku, marca: p.marca, produto: p.produto, tamanho: p.tamanho, qtd: it.qtd, preco_vendido: it.preco_vendido, total: it.qtd * it.preco_vendido, custo: K[p.sku] }); }
    N.push({ cliente_id: clienteId || null, nota_id: nid, data: new Date(ts).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }), created_at: ts, cliente: cliente || null, status: "ativa", total: tot, handle: user.handle, nome: user.nome, pagamento: pags.map(x => x.metodo).join("+") });
    for (const g of pags) { PG.push({ nota_id: nid, metodo: g.metodo, valor: Number(g.valor) }); if (g.metodo !== "prazo") mov(CX.find(c => c.metodo === g.metodo).caixa_id, "venda", Number(g.valor), "Nota " + String(nid).padStart(6, "0"), nid, user, ts); }
    return nid; };
  const ready = Promise.resolve().then(() => {
    const kaio = U.find(u => u.handle === "@kaio") || meU, bia = U.find(u => u.handle === "@bianca");
    const H = h => new Date(Date.now() - h * 36e5).toISOString();
    mkNota([{ sku: "JBL-001", qtd: 1, preco_vendido: 799 }], [{ metodo: "cartao", valor: 799 }], "Cliente A", kaio, H(30));
    mkNota([{ sku: "XIA-001", qtd: 1, preco_vendido: 199 }, { sku: "BAS-001", qtd: 2, preco_vendido: 49.9 }], [{ metodo: "pix", valor: 200 }, { metodo: "dinheiro", valor: 98.8 }], null, bia, H(3));
    mkNota([{ sku: "ANK-001", qtd: 1, preco_vendido: 199 }], [{ metodo: "dinheiro", valor: 199 }], null, kaio, H(1));
    CL.push({ id: 1, nome: "Maria Souza", doc: "52998224725", telefone: "(11) 99999-0000", email: "maria@exemplo.com", endereco: "Rua das Flores, 10", obs: "", ativo: true }, { id: 2, nome: "João Lima", doc: null, telefone: "(11) 98888-1111", email: "", endereco: "", obs: "", ativo: true });
    mkNota([{ sku: "XIA-002", qtd: 1, preco_vendido: 1199 }], [{ metodo: "prazo", valor: 899 }, { metodo: "pix", valor: 300 }], null, kaio, H(26), 1);
    FO.push({ id: 1, nome: "Distribuidora Tech SP", cnpj: "11222333000181", contato: "Ana", telefone: "(11) 3333-0000", email: "vendas@tech.com", obs: "", ativo: true });
    CP.push({ id: 1, fornecedor_id: 1, valor: 3200, vencimento: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10), descricao: "Lote fones JBL" }, { id: 2, fornecedor_id: 1, valor: 450, vencimento: new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10), descricao: "Frete" });
    mov(1, "entrada", 200, "Fundo de troco", null, U[0], H(5)); mov(1, "saida", 35, "Compra de material de limpeza", null, U[0], H(2));
  });
  const needFin = () => { if (role === "vendedor") throw new Error("Sem permissão (financeiro/admin)"); };
  const fiado = cid => N.filter(n => n.cliente_id === cid && n.status === "ativa").reduce((a, n) => a + PG.filter(g => g.nota_id === n.nota_id && g.metodo === "prazo").reduce((b, g) => b + g.valor, 0), 0);
  const recebido = cid => RC.filter(r => r.cliente_id === cid).reduce((a, r) => a + r.valor, 0);
  const pago = k => CPG.filter(p => p.conta_id === k).reduce((a, p) => a + p.valor, 0);
  const vis = () => role === "admin" ? N : role === "vendedor" ? N.filter(n => n.handle === meU.handle) : [];
  const saldo = c => MV.filter(m => m.caixa_id === c).reduce((a, m) => a + sv(m), 0);
  const needCx = () => { if (role === "vendedor") throw new Error("Sem permissão de caixa"); };
  const grp = (rows, key, f) => Object.values(rows.reduce((a, r) => { const k = r[key]; a[k] ||= { [key]: k, nome: r.nome, vendas: 0, itens: 0, faturamento: 0, custo: 0 }; f(a[k], r); return a; }, {}));
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
    async products() { await ready; return role === "financeiro" ? [] : P; }, async costs() { return role === "admin" ? Object.entries(K).map(([sku, custo]) => ({ sku, custo })) : []; },
    async estoqueVendedor() { await ready; return role === "financeiro" ? [] : P.filter(p => p.ativo).map(({ sku, marca, produto, tamanho, estoque }) => ({ sku, marca, produto, tamanho, estoque })); },
    async repSeller(d) { const ids = N.filter(n => n.status === "ativa" && n.data === d).map(n => n.nota_id); return role !== "admin" ? [] : grp(IT.filter(i => ids.includes(i.nota_id)).map(i => ({ ...i, ...N.find(n => n.nota_id === i.nota_id), total: i.total })), "handle", (g, r) => { g.itens += r.qtd; g.faturamento += r.total; g.custo += r.qtd * r.custo; g._n = (g._n || new Set()).add(r.nota_id); g.vendas = g._n.size; }); },
    async repPay(d) { const ids = N.filter(n => n.status === "ativa" && n.data === d).map(n => n.nota_id); return role !== "admin" ? [] : grp(PG.filter(g => ids.includes(g.nota_id)), "metodo", (g, r) => { g.vendas++; g.faturamento += r.valor; }).map(g => ({ ...g, forma_pagamento: g.metodo })); },
    async repProfit(d) { const r = await this.repSeller(d); return r.map(x => ({ ...x, lucro: x.faturamento - x.custo })); },
    async buscarClientes(q) { if (q.trim().length < 2) return []; const d = dig(q); return CL.filter(c => c.ativo && (norm(c.nome).includes(norm(q)) || (d.length >= 3 && (dig(c.doc).includes(d) || dig(c.telefone).includes(d))))).slice(0, 15).map(({ id, nome, telefone, doc }) => ({ id, nome, telefone, doc })); },
    async criarCliente(c) { if (role === "financeiro" && false) return; if (!c.nome || c.nome.trim().length < 2) throw new Error("Informe o nome do cliente"); const d = dig(c.doc) || null; if (d && !docOk(d)) throw new Error("CPF/CNPJ inválido"); const ex = d && CL.find(x => x.doc === d); if (ex) return ex.id;
      const nc = { id: CL.length + 1, nome: c.nome.trim(), telefone: c.telefone || "", doc: d, email: role !== "vendedor" ? c.email || "" : "", endereco: role !== "vendedor" ? c.endereco || "" : "", obs: role !== "vendedor" ? c.obs || "" : "", ativo: true }; CL.push(nc); return nc.id; },
    async clientes() { await ready; needFin(); return CL.map(c => ({ ...c, total_fiado: fiado(c.id), total_recebido: recebido(c.id), saldo: fiado(c.id) - recebido(c.id) })); },
    async salvarCliente(cid, c) { needFin(); if (c.doc && !docOk(c.doc)) throw new Error("CPF/CNPJ inválido"); Object.assign(CL.find(x => x.id === cid), c); },
    async fornecedores() { await ready; needFin(); return FO; },
    async salvarFornecedor(fid, f) { needFin(); if (f.cnpj && !docOk(f.cnpj)) throw new Error("CNPJ inválido"); fid ? Object.assign(FO.find(x => x.id === fid), f) : FO.push({ id: FO.length + 1, ativo: true, ...f }); },
    async contas() { await ready; needFin(); const hj = today(); return CP.map(k => { const p = pago(k.id); return { ...k, fornecedor: (FO.find(f => f.id === k.fornecedor_id) || {}).nome, pago: p, restante: k.valor - p, status: p >= k.valor ? "paga" : k.vencimento < hj ? "vencida" : p > 0 ? "parcial" : "aberta" }; }); },
    async salvarConta(kid, c) { needFin(); kid ? Object.assign(CP.find(x => x.id === kid), c) : CP.push({ id: CP.length + 1, ...c }); },
    async pagarConta(kid, v, cx, forma, data) { needFin(); const k = CP.find(x => x.id === kid); if (pago(kid) + v > k.valor + 0.001) throw new Error("Pagamento maior que o saldo da conta"); CPG.unshift({ id: id++, conta_id: kid, valor: v, caixa_id: cx, forma, data: data || today() }); mov(cx, "saida", v, `Pagamento fornecedor ${(FO.find(f => f.id === k.fornecedor_id) || {}).nome} — conta ${kid}`, null, meU); },
    async contaPagamentos() { needFin(); return CPG; },
    async recebimentos() { needFin(); return RC.map(r => ({ ...r, cliente: CL.find(c => c.id === r.cliente_id).nome, caixa: CX.find(c => c.caixa_id === r.caixa_id).nome, handle: meU.handle })); },
    async receber(cli, v, cx, forma, data, obs) { needFin(); const sd = fiado(cli) - recebido(cli); if (v > sd + 0.001) throw new Error(`Valor maior que o saldo do cliente (${brl(sd)})`); RC.unshift({ id: id++, cliente_id: cli, valor: v, caixa_id: cx, forma, data: data || today(), obs }); mov(cx, "entrada", v, "Recebimento cliente " + CL.find(c => c.id === cli).nome, null, meU);
      const mm = MV[MV.length - 1]; mm.forma = forma; mm.cliente = CL.find(c => c.id === cli).nome; let rest = v; const al = [];
      for (const n of N.filter(x => x.cliente_id === cli && x.status === "ativa").sort((a, b) => a.nota_id - b.nota_id)) { if (rest <= 0) break;
        const open = PG.filter(g => g.nota_id === n.nota_id && g.metodo === "prazo").reduce((a, g) => a + g.valor, 0) - AL.filter(x => x.nota_id === n.nota_id).reduce((a, x) => a + x.valor, 0);
        if (open <= 0) continue; const a = Math.min(open, rest); AL.push({ nota_id: n.nota_id, valor: a }); al.push(String(n.nota_id).padStart(6, "0") + " (" + brl(a) + ")"); rest -= a; }
      mm.notas = al.join(", "); },
    async caixasLista() { needCx(); return CX; },
    async criarNota(items, pags, cliente, clienteId) { await new Promise(r => setTimeout(r, 400)); if (qs.has("fail")) throw new Error("Falha simulada (demo ?fail=1)"); if (role === "financeiro") throw new Error("Sem permissão para criar nota"); return mkNota(items, pags, cliente, meU, null, clienteId); },
    async cancelarNota(nid, motivo) { if (role !== "admin") throw new Error("Só admin cancela nota"); const n = N.find(x => x.nota_id === nid); if (n.status === "cancelada") throw new Error("Nota já cancelada");
      IT.filter(i => i.nota_id === nid).forEach(i => P.find(p => p.sku === i.sku).estoque += i.qtd);
      PG.filter(g => g.nota_id === nid).forEach(g => mov(CX.find(c => c.metodo === g.metodo).caixa_id, "estorno", g.valor, `Cancelamento nota ${String(nid).padStart(6, "0")}: ${motivo}`, nid, meU));
      n.status = "cancelada"; },
    async nota(nid) { const n = vis().find(x => x.nota_id === nid); return n ? IT.filter(i => i.nota_id === nid).map(i => ({ ...n, ...i })) : []; },
    async notaPag(nid) { return vis().some(x => x.nota_id === nid) ? PG.filter(g => g.nota_id === nid) : []; },
    async notas() { return vis(); },
    async caixaSaldos() { await ready; needCx(); return CX.map(c => ({ ...c, saldo: saldo(c.caixa_id), movimento_hoje: MV.filter(m => m.caixa_id === c.caixa_id && m.data === today()).reduce((a, m) => a + sv(m), 0) })); },
    async caixaExtrato(d) { needCx(); return MV.filter(m => m.data === d).sort((a, b) => a.created_at.localeCompare(b.created_at)).map(m => ({ ...m, valor_assinado: sv(m) })); },
    async caixaResumo(c, d) { needCx(); if (role !== "admin" && role !== "financeiro") throw new Error("Sem permissão");
      const cx = CX.find(x => x.caixa_id === c), ini = MV.filter(m => m.caixa_id === c && m.data < d).reduce((a, m) => a + sv(m), 0);
      const mv = MV.filter(m => m.caixa_id === c && m.data === d).sort((a, b) => a.created_at.localeCompare(b.created_at)).map(m => { const n = N.find(x => x.nota_id === m.nota_id);
        return { id: m.id, hora: new Date(m.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", ""), tipo: m.tipo, valor: m.valor, assinado: sv(m), forma: m.forma || cx.metodo, nota: m.nota_id ? String(m.nota_id).padStart(6, "0") : (m.notas || null), cliente: (n && n.cliente) || m.cliente || null, usuario: m.nome, motivo: m.motivo }; });
      const pf = {}; mv.forEach(m => pf[m.forma] = (pf[m.forma] || 0) + m.assinado); const s = SE.find(x => x.caixa_id === c && x.data === d);
      return { caixa: cx.nome, data: d, saldo_inicial: ini, saldo_final: ini + mv.reduce((a, m) => a + m.assinado, 0), sessao: s ? { abertura_valor: s.abertura_valor, aberto_por: meU.nome, aberto_em: new Date(s.aberto_em).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }), fechamento_contado: s.fechamento_contado ?? null, diferenca: s.diferenca ?? null } : null,
        movimentos: mv, por_forma: pf, entradas: mv.filter(m => m.assinado > 0).reduce((a, m) => a + m.valor, 0), saidas: mv.filter(m => m.assinado < 0).reduce((a, m) => a + m.valor, 0) }; },
    async caixaSessoes(d) { needCx(); return SE.filter(x => x.data === d); },
    async caixaLancar(m) { needCx(); if (!m.motivo || m.motivo.trim().length < 3) throw new Error("Informe o motivo"); mov(m.caixa_id, m.tipo, Number(m.valor), m.motivo, null, meU); },
    async caixaAbrir(c, v) { needCx(); if (SE.some(x => x.caixa_id === c && x.data === today())) throw new Error("Caixa já aberto hoje"); SE.push({ caixa_id: c, data: today(), abertura_valor: v, abertura_sistema: saldo(c), aberto_em: new Date().toISOString() }); },
    async caixaFechar(c, v) { needCx(); const x = SE.find(y => y.caixa_id === c && y.data === today() && !y.fechado_em); if (!x) throw new Error("Caixa não está aberto hoje (ou já foi fechado)"); Object.assign(x, { fechamento_contado: v, fechamento_sistema: saldo(c), diferenca: v - saldo(c), fechado_em: new Date().toISOString() }); return x.diferenca; },
    async usuarios() { return role === "admin" ? U : []; },
    async salvarUsuario(uid, u) { if (role !== "admin") throw new Error("Só admin"); Object.assign(U.find(x => x.id === uid), u); },
    async adminProducts() { return role === "admin" ? P.map(p => ({ ...p, custo: K[p.sku] })) : []; },
    async purchases() { return PU; }, async addPurchase(p) { PU.unshift({ id: id++, data: today(), ...p, total: p.qtd * p.custo_unit }); const x = P.find(y => y.sku === p.sku); x.estoque += p.qtd; K[p.sku] = p.custo_unit; },
    async saveProduct(p, c) { const i = P.findIndex(x => x.sku === p.sku); i < 0 ? P.push({ ...p, estoque: 0 }) : Object.assign(P[i], p); if (c !== "") K[p.sku] = Number(c); }
  };
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
  try { me = await api.profile(); } catch { me = null; }
  if (!me || me.ativo === false) { await api.logout(); return viewLogin("Conta sem perfil ativo. Fale com o administrador."); }
  $("#who").textContent = `${me.nome} (${me.handle}) · ${ROLEL[me.role] || me.role}`;
  $("#nav").hidden = false;
  if (window.BGDSwitch) BGDSwitch.mount(me, MOCK ? "mb@demo.local" : await api.email().catch(() => ""));
  document.querySelectorAll("nav button[data-p]").forEach(b => b.hidden = !can(b.dataset.p));
  if (MOCK && qs.get("demo") === "resumo") { const L = await api.caixasLista(), px = L.find(x => x.metodo === "pix").caixa_id; await api.caixaAbrir(px, 0).catch(() => {}); await api.receber(1, 500, px, "pix", null, "parcial"); return viewResumo(today(), px); }
  if (MOCK && qs.get("demo") === "prazo") return viewRecibo(await api.criarNota([{ sku: "JBL-001", qtd: 1, preco_vendido: 799 }], [{ metodo: "prazo", valor: 599 }, { metodo: "pix", valor: 200 }], null, 1));
  if (MOCK && qs.has("demo")) return viewRecibo(await api.criarNota([{ sku: "JBL-001", qtd: 1, preco_vendido: 799 }, { sku: "BAS-001", qtd: 2, preco_vendido: 49.9 }], [{ metodo: "pix", valor: 500 }, { metodo: "cartao", valor: 398.8 }], "Cliente Teste"));
  go(location.hash.slice(1) || (can("vendas") ? "nota" : "caixa"));
}
function go(v) {
  const need = { clientes: "financas", fornecedores: "financas", pagar: "financas", receber: "financas", resumo: "financas", nota: "vendas", notas: "vendas", estoque: "vendas", relatorio: "admin", compras: "admin", produtos: "admin", usuarios: "admin", caixa: "caixa" };
  if (!need[v] && v !== "seguranca") v = "nota";
  if (need[v] && !can(need[v])) v = can("vendas") ? "nota" : can("caixa") ? "caixa" : "seguranca";
  document.querySelectorAll("nav button[data-v]").forEach(b => b.classList.toggle("on", b.dataset.v === v));
  history.replaceState(null, "", location.pathname + location.search + "#" + v);
  ({ nota: viewNota, notas: viewNotas, caixa: viewCaixa, usuarios: viewUsuarios, estoque: viewEstoque, relatorio: viewRelatorio, compras: viewCompras, produtos: viewProdutos, seguranca: viewSeguranca, clientes: viewClientes, fornecedores: viewFornecedores, pagar: viewPagar, receber: viewReceber, resumo: viewResumo }[v] || viewSeguranca)()
    .catch(e => toast(e.message));
}
document.querySelectorAll("nav button[data-v]").forEach(b => b.onclick = () => go(b.dataset.v));
$("#sair").onclick = async () => { await api.logout(); location.hash = ""; location.reload(); };

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
const BK_TABLES = ["profiles", "role_perms", "products", "product_costs", "purchases", "notas", "sales", "sale_costs", "nota_pagamentos", "caixas", "caixa_movimentos", "caixa_sessoes", "clientes", "fornecedores", "contas_pagar", "conta_pagamentos", "cliente_recebimentos", "recebimento_notas", "security_events"];
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
  ${RP.map(r => `<tr><td>${esc(PAYL[r.forma_pagamento] || r.forma_pagamento)}</td><td class="n">${r.vendas}</td><td class="n">${brl(r.faturamento)}</td></tr>`).join("")}</table></div>`;
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
  <h3>Pagamento</h3><div id="pgs"></div><button class="btn ghost" id="addpg" type="button">+ Dividir pagamento</button> <span id="pgok" class="muted"></span>
  <label>Cliente (obrigatório para Paga Depois)</label><input id="cl" type="search" autocomplete="off" maxlength="120" placeholder="Buscar por nome, telefone ou CPF…">
  <ul id="csug" class="sug"></ul><div id="csel" class="muted"></div>
  <button type="button" class="btn ghost" id="cnovo" style="margin-top:4px">+ Novo cliente</button>
  <div id="cform" hidden class="grid" style="margin-top:8px"><div><label>Nome</label><input id="cn" maxlength="120"></div><div><label>Telefone</label><input id="ct" maxlength="30" inputmode="tel"></div><div><label>CPF/CNPJ</label><input id="cd" maxlength="18" inputmode="numeric"></div><div><button type="button" class="btn" id="csave">Salvar cliente</button></div></div>
  <button class="btn gold" id="fin">Finalizar e gerar nota</button></div>`;
  let draw = () => { $("#it").innerHTML = `<tr><th>Produto</th><th class="n">Qtd</th><th class="n">Preço</th><th class="n">Total</th><th></th></tr>` + items.map((x, i) => `<tr><td>${esc(x.nome)}</td><td class="n">${x.qtd}</td><td class="n">${brl(x.preco_vendido)}</td><td class="n">${brl(x.qtd * x.preco_vendido)}</td><td><button data-i="${i}" class="rm">✕</button></td></tr>`).join("") + `<tr><th colspan="3">TOTAL</th><th class="n">${brl(items.reduce((a, x) => a + x.qtd * x.preco_vendido, 0))}</th><th></th></tr>`;
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
  let cli = null;
  const setCli = c => { cli = c; $("#csel").innerHTML = c ? `Cliente: <b>${esc(c.nome)}</b> ${esc(c.telefone || "")} ${c.doc ? esc(fmtDoc(c.doc)) : ""} <button type="button" id="cx0">✕</button>` : ""; $("#csug").innerHTML = ""; if (c) { $("#cl").value = ""; $("#cx0").onclick = () => setCli(null); } };
  let ct0; $("#cl").oninput = () => { clearTimeout(ct0); ct0 = setTimeout(async () => { const q = $("#cl").value; const L = q.trim().length >= 2 ? await api.buscarClientes(q).catch(e => (toast(e.message), [])) : [];
    $("#csug").innerHTML = L.map((c, i) => `<li data-i="${i}"><b>${esc(c.nome)}</b> <small>${esc(c.telefone || "")} ${c.doc ? "· " + esc(fmtDoc(c.doc)) : ""}</small></li>`).join("") || (q.trim().length >= 2 ? '<li class="off">Nenhum cliente — use "+ Novo cliente"</li>' : "");
    document.querySelectorAll("#csug li[data-i]").forEach(li => li.onmousedown = e => { e.preventDefault(); setCli(L[+li.dataset.i]); }); }, 200); };
  $("#cnovo").onclick = () => { $("#cform").hidden = !$("#cform").hidden; $("#cn").value = $("#cl").value; $("#cn").focus(); };
  $("#csave").onclick = async () => { const c = { nome: $("#cn").value.trim(), telefone: $("#ct").value.trim(), doc: dig($("#cd").value) };
    if (c.nome.length < 2) return toast("Informe o nome do cliente"); if (c.doc && !docOk(c.doc)) return toast("CPF/CNPJ inválido");
    try { const cid = await api.criarCliente(c); setCli({ id: +cid, ...c }); $("#cform").hidden = true; toast("Cliente salvo ✓"); } catch (e) { toast(e.message); } };
  let pgs = [{ metodo: "pix", valor: null }];
  const totalN = () => Math.round(items.reduce((a, x) => a + x.qtd * x.preco_vendido, 0) * 100) / 100;
  const drawPg = () => { const t = totalN(); if (pgs.length === 1) pgs[0].valor = t;
    $("#pgs").innerHTML = pgs.map((g, i) => `<div class="grid pgrow"><div><select data-i="${i}" class="pm">${PAY.map(([v, l]) => `<option value="${v}" ${g.metodo === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>
      <div><input data-i="${i}" class="pv2" type="number" min="0.01" step="0.01" value="${g.valor ?? ""}" ${pgs.length === 1 ? "readonly" : ""}></div>${pgs.length > 1 ? `<div><button type="button" class="rmpg" data-i="${i}">✕</button></div>` : ""}</div>`).join("");
    const soma = Math.round(pgs.reduce((a, g) => a + (+g.valor || 0), 0) * 100) / 100;
    $("#pgok").textContent = pgs.length > 1 ? (soma === t ? "✓ soma confere" : `Soma ${brl(soma)} · falta ${brl(t - soma)}`) : "";
    document.querySelectorAll(".pm").forEach(x => x.onchange = () => { pgs[+x.dataset.i].metodo = x.value; });
    document.querySelectorAll(".pv2").forEach(x => x.onchange = () => { pgs[+x.dataset.i].valor = +x.value; drawPg(); });
    document.querySelectorAll(".rmpg").forEach(x => x.onclick = () => { pgs.splice(+x.dataset.i, 1); drawPg(); }); };
  $("#addpg").onclick = () => { if (pgs.length >= 3) return; const t = totalN(), soma = pgs.reduce((a, g) => a + (+g.valor || 0), 0); if (pgs.length === 1) pgs[0].valor = t; pgs.push({ metodo: PAY.map(x => x[0]).find(m => !pgs.some(g => g.metodo === m)) || "dinheiro", valor: Math.max(Math.round((t - soma) * 100) / 100, 0) || null }); drawPg(); };
  const draw0 = draw; draw = () => { draw0(); drawPg(); };
  $("#fin").onclick = async () => { if (!items.length) return toast("Adicione pelo menos 1 item");
    const t = totalN(), P2 = pgs.filter(g => +g.valor > 0).map(g => ({ metodo: g.metodo, valor: Math.round(+g.valor * 100) / 100 }));
    if (Math.round(P2.reduce((a, g) => a + g.valor, 0) * 100) !== Math.round(t * 100)) return toast("A soma dos pagamentos precisa ser igual ao total");
    if (P2.some(g => g.metodo === "prazo") && !cli) return toast("Paga Depois exige cliente — busque ou cadastre o cliente");
    if (notaSaving) return; notaSaving = true; if (!(await confirmNota(items, t, P2.map(g => `${esc(PAYL[g.metodo] || g.metodo)} ${brl(g.valor)}`).join(" + ")))) { notaSaving = false; return; } const fb = $("#fin"), lbl = fb.textContent; fb.disabled = true; fb.textContent = "Salvando..."; document.querySelectorAll(".nb").forEach(x => x.remove());
    const total = t, pagTxt = P2.map(g => `${esc(PAYL[g.metodo] || g.metodo)} ${brl(g.valor)}`).join(" + ");
    try { const nid = await api.criarNota(items.map(({ sku, qtd, preco_vendido }) => ({ sku, qtd, preco_vendido })), P2, cli ? cli.nome : $("#cl").value, cli ? cli.id : null);
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
  const [R, PGN] = await Promise.all([api.nota(nid), api.notaPag(nid)]); if (!R.length) return toast("Nota não encontrada");
  const h = R[0], tot = R.reduce((a, r) => a + Number(r.total), 0);
  app.innerHTML = `<div class="noprint" style="margin-bottom:12px"><button class="btn gold" id="pr">Imprimir / Salvar PDF</button> <button class="btn ghost" id="nv">Nova nota</button></div>
  <div class="recibo"><div class="rh"><b>BAGDA STORES</b><small>bgdstores.com</small></div>
  <div class="rm2"><span>NOTA Nº <b>${String(nid).padStart(6, "0")}</b></span><span>${new Date(h.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span></div>
  <div class="rm2"><span>Vendedor(a): ${esc(h.nome)} (${esc(h.handle)})</span>${h.cliente ? `<span>Cliente: <b>${esc(h.cliente)}</b></span>` : ""}</div>
  <table class="ri"><tr><th>Item</th><th class="n">Total</th></tr>
  ${R.map(r => `<tr class="in"><td colspan="2">${esc(r.marca)} ${esc(r.produto)} ${esc(r.tamanho || "")}</td></tr><tr class="iq"><td>${r.qtd} x ${brl(r.preco_vendido)}</td><td class="n">${brl(r.total)}</td></tr>`).join("")}
  <tr class="tot"><td>TOTAL</td><td class="n">${brl(tot)}</td></tr></table>
  ${PGN.map(g => `<p class="rm2"><span>${esc(PAYL[g.metodo] || g.metodo)}</span><span>${brl(g.valor)}</span></p>`).join("")}${h.status === "cancelada" ? '<p style="text-align:center;font-size:1.2em"><b>*** NOTA CANCELADA ***</b></p>' : ""}<p class="muted" style="text-align:center">Obrigado pela preferência!</p></div>`;
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
    rows += `<tr><td>${String(n.nota_id).padStart(6, "0")}</td><td>${esc(dt(d))}</td><td>${esc(String(n.pagamento || "").split("+").map(m => PAYL[m] || m).join(" + "))}${n.status === "cancelada" ? ' <b class="warn">CANCELADA</b>' : ""}</td>${adm ? `<td>${esc(n.handle)}</td>` : ""}<td class="n">${brl(n.total)}</td><td><button class="ver" data-n="${n.nota_id}">Ver / imprimir</button>${adm && n.status !== "cancelada" ? ` <button class="cx" data-n="${n.nota_id}">Cancelar</button>` : ""}</td></tr>`; }
  app.innerHTML = `<div class="card"><h2>${adm ? "Notas" : "Minhas notas"}</h2><table class="stk"><tr><th>Nº</th><th>Data / hora</th><th>Pagamento</th>${adm ? "<th>Vendedor</th>" : ""}<th class="n">Total</th><th></th></tr>
  ${rows || `<tr><td colspan="${cols}" class="muted">Nenhuma nota.</td></tr>`}</table></div>`;
  document.querySelectorAll(".ver").forEach(b => b.onclick = () => viewRecibo(+b.dataset.n));
  document.querySelectorAll(".cx").forEach(b => b.onclick = async () => { const m = prompt(`Cancelar nota ${String(b.dataset.n).padStart(6, "0")}? Informe o motivo (estoque volta e o valor é estornado do caixa):`);
    if (!m || m.trim().length < 3) return; try { await api.cancelarNota(+b.dataset.n, m.trim()); toast("Nota cancelada ✓"); viewNotas(); } catch (e) { toast(e.message); } });
}
async function viewCaixa(d = today()) {
  const [SA, EX, SE] = await Promise.all([api.caixaSaldos(), api.caixaExtrato(d), api.caixaSessoes(d)]), hoje = d === today();
  const TZ = "America/Sao_Paulo", hm = t => new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(t));
  const TL = { venda: "Venda", entrada: "Entrada", saida: "Saída", estorno: "Estorno" };
  const ses = c => SE.find(x => x.caixa_id === c.caixa_id);
  const card = c => { const x = ses(c); return `<div class="kpi cxk"><small>${esc(c.nome)}</small><b>${brl(c.saldo)}</b><small>Hoje: ${brl(c.movimento_hoje)}</small>
    <small>${x ? (x.fechado_em ? `Fechado: contado ${brl(x.fechamento_contado)} · diferença <b class="${+x.diferenca ? "warn" : ""}">${brl(x.diferenca)}</b>` : `Aberto ${hm(x.aberto_em)} com ${brl(x.abertura_valor)}`) : "Não aberto hoje"}</small>
    ${hoje ? `<div class="noprint cxa">${!x ? `<input type="number" step="0.01" min="0" placeholder="Valor contado" data-c="${c.caixa_id}" class="va"><button class="btn ghost ab" data-c="${c.caixa_id}">Abrir</button>` : !x.fechado_em ? `<input type="number" step="0.01" min="0" placeholder="Valor contado" data-c="${c.caixa_id}" class="vf"><button class="btn ghost fe" data-c="${c.caixa_id}">Fechar</button>` : ""}</div>` : ""}</div>`; };
  const tot = EX.reduce((a, m) => a + Number(m.valor_assinado), 0);
  app.innerHTML = `<div class="card"><h2>Caixa <button class="btn noprint" id="pe" style="float:right;margin:0">Imprimir extrato (A4)</button></h2>
  <label class="noprint">Data</label><input id="d" class="noprint" type="date" value="${d}" style="max-width:200px">
  <div class="grid" style="margin-top:14px">${SA.map(card).join("")}</div></div>
  ${hoje ? `<div class="card noprint"><h2>Lançamento manual</h2><form id="lf"><div class="grid">
    <div><label>Caixa</label><select id="lc">${SA.map(c => `<option value="${c.caixa_id}">${esc(c.nome)}</option>`).join("")}</select></div>
    <div><label>Tipo</label><select id="lt"><option value="entrada">Entrada</option><option value="saida">Saída</option></select></div>
    <div><label>Valor (R$)</label><input id="lv" type="number" min="0.01" step="0.01" required></div></div>
    <label>Motivo (obrigatório)</label><input id="lm" minlength="3" maxlength="300" required><button class="btn">Lançar</button></form></div>` : ""}
  <div class="card"><h2>Extrato do dia ${esc(d.split("-").reverse().join("/"))}</h2><table class="stk"><tr><th>Hora</th><th>Caixa</th><th>Tipo</th><th>Motivo / nota</th><th>Usuário</th><th class="n">Valor</th></tr>
  ${EX.map(m => `<tr><td>${hm(m.created_at)}</td><td>${esc(m.caixa)}</td><td>${TL[m.tipo] || m.tipo}</td><td>${esc(m.motivo || "")}</td><td>${esc(m.handle || "")}</td><td class="n">${brl(m.valor_assinado)}</td></tr>`).join("") || '<tr><td colspan="6" class="muted">Sem movimentos.</td></tr>'}
  ${SA.map(c => { const v = EX.filter(m => m.caixa_id === c.caixa_id).reduce((a, m) => a + Number(m.valor_assinado), 0); return `<tr class="sep"><th colspan="5">${esc(c.nome)} — movimento do dia</th><th class="n">${brl(v)}</th></tr>`; }).join("")}
  <tr class="tot"><th colspan="5">TOTAL DO DIA</th><th class="n">${brl(tot)}</th></tr></table></div>`;
  $("#d").onchange = e => viewCaixa(e.target.value); $("#pe").onclick = () => window.print();
  document.querySelectorAll(".ab").forEach(b => b.onclick = async () => { const v = document.querySelector(`.va[data-c="${b.dataset.c}"]`).value; if (v === "") return toast("Informe o valor contado");
    try { await api.caixaAbrir(+b.dataset.c, +v); toast("Caixa aberto ✓"); viewCaixa(d); } catch (e) { toast(e.message); } });
  document.querySelectorAll(".fe").forEach(b => b.onclick = async () => { const v = document.querySelector(`.vf[data-c="${b.dataset.c}"]`).value; if (v === "") return toast("Informe o valor contado");
    try { const dif = await api.caixaFechar(+b.dataset.c, +v); toast(`Caixa fechado · diferença ${brl(dif)}`); viewCaixa(d); } catch (e) { toast(e.message); } });
  if ($("#lf")) $("#lf").onsubmit = async ev => { ev.preventDefault(); const m = $("#lm").value.trim(); if (m.length < 3) return toast("Informe o motivo");
    try { await api.caixaLancar({ caixa_id: +$("#lc").value, tipo: $("#lt").value, valor: +$("#lv").value, motivo: m }); toast("Lançado ✓"); viewCaixa(d); } catch (e) { toast(e.message); } };
}
async function viewUsuarios() {
  const L = await api.usuarios();
  app.innerHTML = `<div class="card"><h2>Usuários</h2><p class="muted">Novos usuários: convide em Supabase → Authentication → Users e rode <code>supabase-loja/users.sql</code> (veja docs/LOJA-SETUP.md). Aqui você muda papel e ativa/desativa.</p>
  <table><tr><th>Nome</th><th>Handle</th><th>Papel</th><th>Ativo</th><th></th></tr>
  ${L.map(u => `<tr><td>${esc(u.nome)}</td><td>${esc(u.handle)}</td><td><select class="ur" data-id="${esc(u.id)}">${Object.entries(ROLEL).map(([v, l]) => `<option value="${v}" ${u.role === v ? "selected" : ""}>${l}</option>`).join("")}</select></td>
    <td><input type="checkbox" class="ua" data-id="${esc(u.id)}" ${u.ativo ? "checked" : ""} style="width:auto"></td><td><button class="btn ghost us" data-id="${esc(u.id)}" style="margin:0">Salvar</button></td></tr>`).join("")}</table></div>`;
  document.querySelectorAll(".us").forEach(b => b.onclick = async () => { const i = b.dataset.id;
    try { await api.salvarUsuario(i, { role: document.querySelector(`.ur[data-id="${i}"]`).value, ativo: document.querySelector(`.ua[data-id="${i}"]`).checked }); toast("Salvo ✓"); } catch (e) { toast(e.message); } });
}

const PAYF = [["dinheiro", "Dinheiro"], ["pix", "PIX"], ["cartao", "Cartão"], ["transferencia", "Transferência"], ["boleto", "Boleto"]];
const STL = { aberta: "Aberta", parcial: "Parcial", paga: "Paga", vencida: "Vencida" };
const STC = { aberta: "", parcial: "warn", paga: "", vencida: "low" };
const dBR = d => d ? String(d).slice(0, 10).split("-").reverse().join("/") : "";
const val = id => ($("#" + id).value || "").trim();
async function viewClientes() {
  const L = await api.clientes(); let ed = null;
  app.innerHTML = `<div class="card"><h2>Cadastrar Clientes</h2><form id="f"><div class="grid">
  <div><label>Nome *</label><input id="n" maxlength="120" required></div><div><label>CPF/CNPJ</label><input id="d" maxlength="18" inputmode="numeric"></div>
  <div><label>Telefone</label><input id="t" maxlength="30" inputmode="tel"></div><div><label>E-mail</label><input id="e" type="email" maxlength="160"></div></div>
  <label>Endereço</label><input id="a" maxlength="300"><label>Observações</label><input id="o" maxlength="500">
  <button class="btn" id="sv">Salvar cliente</button> <button type="button" class="btn ghost" id="cn" hidden>Cancelar edição</button></form></div>
  <div class="card"><h2>Clientes</h2><input id="b" type="search" placeholder="Buscar nome, telefone ou CPF…"><table id="tb" class="stk"></table></div>`;
  const draw = () => { const q = norm($("#b").value), dq = dig($("#b").value); const F = L.filter(c => !q || norm(c.nome).includes(q) || (dq && (dig(c.doc).includes(dq) || dig(c.telefone).includes(dq))));
    $("#tb").innerHTML = `<tr><th>Nome</th><th>CPF/CNPJ</th><th>Telefone</th><th class="n">Saldo a receber</th><th></th></tr>` + (F.map(c => `<tr><td>${esc(c.nome)}${c.email ? `<br><small class="muted">${esc(c.email)}</small>` : ""}</td><td>${esc(fmtDoc(c.doc))}</td><td>${esc(c.telefone || "")}</td><td class="n ${+c.saldo > 0 ? "low" : ""}">${brl(c.saldo)}</td><td><button class="ed" data-i="${c.id}">Editar</button></td></tr>`).join("") || '<tr><td colspan="5" class="muted">Nenhum cliente.</td></tr>');
    document.querySelectorAll(".ed").forEach(b => b.onclick = () => { const c = L.find(x => x.id === +b.dataset.i); ed = c.id; $("#n").value = c.nome; $("#d").value = fmtDoc(c.doc); $("#t").value = c.telefone || ""; $("#e").value = c.email || ""; $("#a").value = c.endereco || ""; $("#o").value = c.obs || ""; $("#cn").hidden = false; $("#sv").textContent = "Salvar alterações"; scrollTo(0, 0); }); };
  $("#b").oninput = draw; draw(); $("#cn").onclick = () => viewClientes();
  $("#f").onsubmit = async ev => { ev.preventDefault(); const c = { nome: val("n"), doc: dig(val("d")) || null, telefone: val("t") || null, email: val("e") || null, endereco: val("a") || null, obs: val("o") || null };
    if (c.doc && !docOk(c.doc)) return toast("CPF/CNPJ inválido"); ev.submitter && (ev.submitter.disabled = true);
    try { ed ? await api.salvarCliente(ed, c) : await api.criarCliente(c); toast("Cliente salvo ✓"); viewClientes(); } catch (e) { toast(e.message); ev.submitter && (ev.submitter.disabled = false); } };
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
async function viewPagar() {
  const [K, F, CX] = await Promise.all([api.contas(), api.fornecedores(), api.caixasLista()]);
  const ord = { vencida: 0, aberta: 1, parcial: 1, paga: 2 }; K.sort((a, b) => (ord[a.status] - ord[b.status]) || String(a.vencimento).localeCompare(String(b.vencimento)));
  const aberto = K.filter(k => k.status !== "paga").reduce((a, k) => a + Number(k.restante), 0), venc = K.filter(k => k.status === "vencida").reduce((a, k) => a + Number(k.restante), 0);
  app.innerHTML = `<div class="card"><h2>Contas a pagar — dívidas com fornecedores</h2><div class="grid"><div class="kpi"><small>Em aberto</small><b>${brl(aberto)}</b></div><div class="kpi"><small>Vencido</small><b class="low">${brl(venc)}</b></div></div></div>
  <div class="card"><h2>Nova conta</h2><form id="f"><div class="grid"><div><label>Fornecedor</label><select id="fo" required>${F.map(f => `<option value="${f.id}">${esc(f.nome)}</option>`).join("")}</select></div>
  <div><label>Valor (R$)</label><input id="v" type="number" min="0.01" step="0.01" required></div><div><label>Vencimento</label><input id="ve" type="date" required></div></div>
  <label>Descrição</label><input id="ds" maxlength="300"><button class="btn">Salvar conta</button>${F.length ? "" : ' <span class="warn">Cadastre um fornecedor primeiro.</span>'}</form></div>
  <div class="card"><h2>Contas</h2><table class="stk"><tr><th>Vencimento</th><th>Fornecedor</th><th>Descrição</th><th class="n">Valor</th><th class="n">Pago</th><th class="n">Restante</th><th>Status</th><th></th></tr>
  ${K.map(k => `<tr><td>${dBR(k.vencimento)}</td><td>${esc(k.fornecedor)}</td><td>${esc(k.descricao || "")}</td><td class="n">${brl(k.valor)}</td><td class="n">${brl(k.pago)}</td><td class="n">${brl(k.restante)}</td><td class="${STC[k.status]}">${STL[k.status]}</td>
    <td>${k.status !== "paga" ? `<button class="pg" data-i="${k.id}">Registrar pagamento</button>` : ""}</td></tr>
    <tr class="pgf" id="pf${k.id}" hidden><td colspan="8"><div class="grid pgrow"><div><label>Valor</label><input class="pv" type="number" min="0.01" step="0.01" value="${Number(k.restante).toFixed(2)}"></div>
    <div><label>Data</label><input class="pd" type="date" value="${today()}"></div><div><label>Forma</label><select class="pfm">${PAYF.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select></div>
    <div><label>Sai do caixa</label><select class="pcx">${CX.map(c => `<option value="${c.caixa_id}">${esc(c.nome)}</option>`).join("")}</select></div><div><button class="btn pok" data-i="${k.id}">Confirmar pagamento</button></div></div></td></tr>`).join("") || '<tr><td colspan="8" class="muted">Nenhuma conta.</td></tr>'}</table></div>`;
  document.querySelectorAll(".pg").forEach(b => b.onclick = () => { const r = $("#pf" + b.dataset.i); r.hidden = !r.hidden; });
  document.querySelectorAll(".pok").forEach(b => b.onclick = async () => { const r = $("#pf" + b.dataset.i), v = +r.querySelector(".pv").value; if (!(v > 0)) return toast("Informe o valor"); b.disabled = true;
    try { await api.pagarConta(+b.dataset.i, Math.round(v * 100) / 100, +r.querySelector(".pcx").value, r.querySelector(".pfm").value, r.querySelector(".pd").value); toast("Pagamento registrado ✓ (saída no caixa)"); viewPagar(); } catch (e) { toast(e.message); b.disabled = false; } });
  $("#f").onsubmit = async ev => { ev.preventDefault(); try { await api.salvarConta(null, { fornecedor_id: +$("#fo").value, valor: +$("#v").value, vencimento: $("#ve").value, descricao: val("ds") || null }); toast("Conta salva ✓"); viewPagar(); } catch (e) { toast(e.message); } };
}
async function viewReceber() {
  const [C, RC, CX] = await Promise.all([api.clientes(), api.recebimentos(), api.caixasLista()]);
  const dev = C.filter(c => +c.saldo > 0).sort((a, b) => b.saldo - a.saldo), tot = dev.reduce((a, c) => a + Number(c.saldo), 0);
  app.innerHTML = `<div class="card"><h2>Contas a receber — Paga Depois</h2><div class="grid"><div class="kpi"><small>Total a receber</small><b>${brl(tot)}</b></div><div class="kpi"><small>Clientes devendo</small><b>${dev.length}</b></div></div></div>
  <div class="card"><h2>Registrar pagamento do cliente</h2><form id="f"><div class="grid"><div><label>Cliente</label><select id="c" required>${dev.map(c => `<option value="${c.id}">${esc(c.nome)} — deve ${brl(c.saldo)}</option>`).join("")}</select></div>
  <div><label>Valor (R$)</label><input id="v" type="number" min="0.01" step="0.01" required></div><div><label>Data</label><input id="d" type="date" value="${today()}"></div>
  <div><label>Entra no caixa</label><select id="cx">${CX.map(c => `<option value="${c.caixa_id}" data-m="${esc(c.metodo)}">${esc(c.nome)}</option>`).join("")}</select></div></div>
  <label>Observação</label><input id="o" maxlength="300"><button class="btn gold">Registrar recebimento</button>${dev.length ? "" : ' <span class="muted">Nenhum cliente com saldo.</span>'}</form></div>
  <div class="card"><h2>Saldos por cliente</h2><table class="stk"><tr><th>Cliente</th><th>Telefone</th><th class="n">Comprou (Paga Depois)</th><th class="n">Pagou</th><th class="n">Saldo</th></tr>
  ${dev.map(c => `<tr><td>${esc(c.nome)}</td><td>${esc(c.telefone || "")}</td><td class="n">${brl(c.total_fiado)}</td><td class="n">${brl(c.total_recebido)}</td><td class="n low">${brl(c.saldo)}</td></tr>`).join("") || '<tr><td colspan="5" class="muted">Ninguém devendo.</td></tr>'}</table></div>
  <div class="card"><h2>Últimos recebimentos</h2><table class="stk"><tr><th>Data</th><th>Cliente</th><th>Caixa</th><th>Por</th><th class="n">Valor</th></tr>
  ${RC.map(r => `<tr><td>${dBR(r.data)}</td><td>${esc(r.cliente)}</td><td>${esc(r.caixa)}</td><td>${esc(r.handle || "")}</td><td class="n">${brl(r.valor)}</td></tr>`).join("") || '<tr><td colspan="5" class="muted">Nenhum recebimento.</td></tr>'}</table></div>`;
  const sc = () => { const c = dev.find(x => x.id === +$("#c").value); if (c) $("#v").value = Number(c.saldo).toFixed(2); }; if ($("#c")) { $("#c").onchange = sc; sc(); }
  $("#f").onsubmit = async ev => { ev.preventDefault(); if (!dev.length) return; const b = ev.submitter; b.disabled = true; const o = $("#cx").selectedOptions[0];
    try { await api.receber(+$("#c").value, Math.round(+$("#v").value * 100) / 100, +$("#cx").value, o.dataset.m, $("#d").value, val("o")); toast("Recebimento registrado ✓ (entrada no caixa)"); viewReceber(); } catch (e) { toast(e.message); b.disabled = false; } };
}
async function exportCSV() {
  const R = stockSort(await api.adminProducts()), cols = ["sku", "marca", "produto", "tamanho", "fornecedor", "custo", "preco_venda", "margem_pct", "estoque", "estoque_minimo", "ativo"];
  const cell = v => { let s = String(v ?? ""); if (/^[=+\-@]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
  const csv = "\ufeff" + cols.join(";") + "\n" + R.map(r => cols.map(c => cell(r[c])).join(";")).join("\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `produtos-custo-${today()}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
// ---------- Resumo do dia por caixa (admin/financeiro; servidor confere em caixa_resumo) ----------
const FORMAL = { dinheiro: "Dinheiro", pix: "PIX", cartao: "Cartão", transferencia: "Transferência", boleto: "Boleto", prazo: "Paga Depois" };
async function viewResumo(d = today(), c = null) {
  if (me.role !== "admin" && me.role !== "financeiro") { app.innerHTML = '<div class="card"><h2>Sem acesso</h2><p class="muted">Somente admin e financeiro.</p></div>'; return; }
  const L = await api.caixasLista(); c = c || (L.find(x => x.metodo === "pix") || L[0]).caixa_id;
  let R; try { R = await api.caixaResumo(c, d); } catch (e) { app.innerHTML = `<div class="card"><h2>Resumo do dia</h2><p class="warn">${esc(e.message)}</p></div>`; return; }
  const TL = { venda: "Venda", entrada: "Entrada", saida: "Saída", estorno: "Estorno" }, s = R.sessao, dd = d.split("-").reverse().join("/");
  app.innerHTML = `<div class="card"><h2>Resumo do dia — ${esc(R.caixa)} · ${esc(dd)}
    <span class="noprint" style="float:right"><button class="btn ghost" id="csv" style="margin:0">CSV</button> <button class="btn" id="pr" style="margin:0">Imprimir / PDF (A4)</button></span></h2>
  <div class="grid noprint"><div><label>Caixa</label><select id="rc">${L.map(x => `<option value="${x.caixa_id}" ${x.caixa_id === c ? "selected" : ""}>${esc(x.nome)}</option>`).join("")}</select></div>
  <div><label>Data (horário de São Paulo)</label><input id="rd" type="date" value="${d}"></div></div>
  <div class="grid" style="margin-top:12px">
    <div class="kpi"><small>Abertura</small><b>${s ? brl(s.abertura_valor) : "—"}</b><small>${s ? `${esc(s.aberto_por || "")} ${esc(s.aberto_em || "")}` : "Não aberto"}</small></div>
    <div class="kpi"><small>Saldo inicial (sistema)</small><b>${brl(R.saldo_inicial)}</b></div>
    <div class="kpi"><small>Entradas</small><b>${brl(R.entradas)}</b></div><div class="kpi"><small>Saídas</small><b>${brl(R.saidas)}</b></div>
    <div class="kpi"><small>Fechamento</small><b>${s && s.fechamento_contado != null ? brl(s.fechamento_contado) : "—"}</b><small>${s && s.diferenca != null ? "Diferença " + brl(s.diferenca) : "Não fechado"}</small></div>
    <div class="kpi"><small>Saldo final</small><b>${brl(R.saldo_final)}</b></div></div></div>
  <div class="card"><h2>Movimentos</h2><table class="stk"><tr><th>Data/hora</th><th>Tipo</th><th>Nota nº</th><th>Cliente / fornecedor</th><th>Usuário</th><th>Forma</th><th class="n">Valor</th></tr>
  ${R.movimentos.map(m => `<tr><td>${esc(m.hora)}</td><td>${TL[m.tipo] || esc(m.tipo)}</td><td>${esc(m.nota || "—")}</td><td>${esc(m.cliente || m.motivo || "")}</td><td>${esc(m.usuario || "")}</td><td>${esc(FORMAL[m.forma] || m.forma || "")}</td><td class="n">${brl(m.assinado)}</td></tr>`).join("") || '<tr><td colspan="7" class="muted">Sem movimentos.</td></tr>'}
  ${Object.entries(R.por_forma).map(([f, v]) => `<tr class="sep"><th colspan="6">Total ${esc(FORMAL[f] || f)}</th><th class="n">${brl(v)}</th></tr>`).join("")}
  <tr class="tot"><th colspan="6">SALDO FINAL</th><th class="n">${brl(R.saldo_final)}</th></tr></table></div>`;
  $("#rd").onchange = e => viewResumo(e.target.value, c); $("#rc").onchange = e => viewResumo(d, +e.target.value); $("#pr").onclick = () => window.print();
  $("#csv").onclick = () => { const q = v => { let t = String(v ?? ""); if (/^[=+\-@]/.test(t) && !/^-?\d/.test(t)) t = "'" + t; return '"' + t.replace(/"/g, '""') + '"'; }, n = v => Number(v).toFixed(2).replace(".", ",");
    const rows = [["Caixa", R.caixa], ["Data", dd], ["Abertura", s ? n(s.abertura_valor) : ""], ["Saldo inicial", n(R.saldo_inicial)], [], ["Data/hora", "Tipo", "Nota", "Cliente/fornecedor", "Usuário", "Forma", "Valor", "Motivo"],
      ...R.movimentos.map(m => [m.hora, TL[m.tipo] || m.tipo, m.nota || "", m.cliente || "", m.usuario || "", FORMAL[m.forma] || m.forma || "", n(m.assinado), m.motivo || ""]), [],
      ...Object.entries(R.por_forma).map(([f, v]) => ["Total " + (FORMAL[f] || f), n(v)]), ["Fechamento contado", s && s.fechamento_contado != null ? n(s.fechamento_contado) : ""], ["Saldo final", n(R.saldo_final)]];
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + rows.map(r => r.map(q).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    a.download = `resumo-${R.caixa.replace(/[^\w]+/g, "-").toLowerCase()}-${d}.csv`; a.click(); };
}
boot().catch(e => { console.error(e); viewLogin("Erro ao conectar."); });
})();

