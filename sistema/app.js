(() => {
"use strict";
const C = window.SISTEMA_CONFIG || {};
const qs = new URLSearchParams(location.search);
const MOCK = qs.has("mock") || !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(C.SUPABASE_URL || "");
const PAY = ["PIX", "Débito", "Crédito", "Dinheiro"];
const $ = s => document.querySelector(s);
const app = $("#app");
const brl = v => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const toast = m => { const t = $("#toast"); t.textContent = m; t.style.display = "block"; clearTimeout(t._h); t._h = setTimeout(() => t.style.display = "none", 3500); };
let me = null; // {handle, nome, role}

// ---------------- Camada de dados ----------------
let api;
if (!MOCK) {
  const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, { auth: { persistSession: true, storage: sessionStorage } });
  const ok = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
  api = {
    async login(email, pw) { ok(await sb.auth.signInWithPassword({ email, password: pw })); },
    async logout() { await sb.auth.signOut(); },
    async session() { return (await sb.auth.getSession()).data.session; },
    async aal() { return ok(await sb.auth.mfa.getAuthenticatorAssuranceLevel()); },
    async factors() { return ok(await sb.auth.mfa.listFactors()).totp || []; },
    async enroll() { return ok(await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: "BAGDA " + Date.now() })); },
    async verify(factorId, code) { ok(await sb.auth.mfa.challengeAndVerify({ factorId, code })); },
    async unenroll(factorId) { ok(await sb.auth.mfa.unenroll({ factorId })); },
    async profile() { const u = (await sb.auth.getUser()).data.user; return ok(await sb.from("profiles").select("handle,nome,role,ativo").eq("id", u.id).single()); },
    async products() { return ok(await sb.from("products").select("sku,marca,produto,tamanho,preco_venda,estoque,estoque_minimo,ativo").order("sku")); },
    async costs() { return ok(await sb.from("product_costs").select("sku,custo")); },
    async addSale(s) { ok(await sb.from("sales").insert(s)); },
    async sales(d1, d2) { return ok(await sb.from("v_sales").select("*").gte("data", d1).lte("data", d2).order("created_at", { ascending: false })); },
    async repSeller(d) { return ok(await sb.from("v_report_seller").select("*").eq("data", d)); },
    async repPay(d) { return ok(await sb.from("v_report_payment").select("*").eq("data", d)); },
    async repProfit(d) { return ok(await sb.from("v_report_profit").select("*").eq("data", d)); },
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
      S.push({ id: id++, data: today(), sku: p.sku, marca: p.marca, produto: p.produto, qtd: 1 + (i % 2), preco_tabela: p.preco_venda, preco_vendido: pv, total: pv * (1 + (i % 2)), forma_pagamento: PAY[i % 4], handle: s[0], nome: s[1], custo: K[p.sku], aviso: pv < p.preco_venda ? "Abaixo da tabela" : null, created_at: new Date(Date.now() - i * 3e6).toISOString() });
    }
  });
  const grp = (rows, key) => Object.values(rows.reduce((a, r) => { const k = r[key]; a[k] ||= { [key]: k, nome: r.nome, vendas: 0, itens: 0, faturamento: 0, custo: 0 }; a[k].vendas++; a[k].itens += r.qtd; a[k].faturamento += r.total; a[k].custo += r.qtd * r.custo; return a; }, {}));
  api = {
    async login(e, pw) { if (!e || !pw) throw new Error("Preencha e-mail e senha"); logged = true; },
    async logout() { logged = false; }, async session() { await ready; return logged ? {} : null; },
    async aal() { return { currentLevel: "aal1", nextLevel: "aal1" }; }, async factors() { return []; },
    async enroll() { return { id: "f1", totp: { qr_code: "", secret: "DEMO-SECRET-XXXX" } }; },
    async verify() { toast("Demonstração: 2FA ativado"); }, async unenroll() {},
    async profile() { return role === "admin" ? { handle: "@mb", nome: "MB", role } : { handle: "@kaio", nome: "Kaio", role }; },
    async products() { await ready; return P; }, async costs() { return role === "admin" ? Object.entries(K).map(([sku, custo]) => ({ sku, custo })) : []; },
    async addSale(s) { const p = P.find(x => x.sku === s.sku); if (!p || p.estoque < s.qtd) throw new Error("Estoque insuficiente ou produto inativo"); p.estoque -= s.qtd; S.unshift({ id: id++, data: today(), ...s, marca: p.marca, produto: p.produto, preco_tabela: p.preco_venda, total: s.qtd * s.preco_vendido, handle: me.handle, nome: me.nome, custo: K[p.sku], aviso: s.preco_vendido < p.preco_venda ? "Abaixo da tabela" : null, created_at: new Date().toISOString() }); },
    async sales() { return S; }, async repSeller() { return grp(S, "handle"); }, async repPay() { return grp(S, "forma_pagamento"); },
    async repProfit() { return role === "admin" ? grp(S, "handle").map(r => ({ ...r, lucro: r.faturamento - r.custo })) : []; },
    async purchases() { return PU; }, async addPurchase(p) { PU.unshift({ id: id++, data: today(), ...p, total: p.qtd * p.custo_unit }); const x = P.find(y => y.sku === p.sku); x.estoque += p.qtd; K[p.sku] = p.custo_unit; },
    async saveProduct(p, c) { const i = P.findIndex(x => x.sku === p.sku); i < 0 ? P.push({ ...p, estoque: 0 }) : Object.assign(P[i], p); if (c !== "") K[p.sku] = Number(c); }
  };
}

// ---------------- Telas ----------------
async function boot() {
  const s = await api.session();
  if (!s) return viewLogin();
  const a = await api.aal();
  if (a.nextLevel === "aal2" && a.currentLevel !== "aal2") return viewMfaChallenge();
  try { me = await api.profile(); } catch { me = null; }
  if (!me || me.ativo === false) { await api.logout(); return viewLogin("Conta sem perfil ativo. Fale com o MB."); }
  $("#who").textContent = `${me.nome} (${me.handle}) · ${me.role === "admin" ? "Admin" : "Vendedor(a)"}`;
  $("#nav").hidden = false;
  document.querySelectorAll("nav .adm").forEach(b => b.hidden = me.role !== "admin");
  go(location.hash.slice(1) || "venda");
}
function go(v) {
  if (["compras", "produtos"].includes(v) && me.role !== "admin") v = "venda";
  document.querySelectorAll("nav button[data-v]").forEach(b => b.classList.toggle("on", b.dataset.v === v));
  history.replaceState(null, "", location.pathname + location.search + "#" + v);
  ({ venda: viewVenda, vendas: viewVendas, estoque: viewEstoque, relatorio: viewRelatorio, compras: viewCompras, produtos: viewProdutos, seguranca: viewSeguranca }[v] || viewVenda)()
    .catch(e => toast(e.message));
}
document.querySelectorAll("nav button[data-v]").forEach(b => b.onclick = () => go(b.dataset.v));
$("#sair").onclick = async () => { await api.logout(); location.hash = ""; location.reload(); };

function viewLogin(msg) {
  $("#nav").hidden = true; $("#who").textContent = "";
  app.innerHTML = `<div class="card login"><h2>Entrar no Sistema</h2>
  <p class="muted">Acesso restrito à equipe BAGDA. Contas são criadas pelo administrador.</p>
  <form id="f"><label>E-mail</label><input id="e" type="email" autocomplete="username" required>
  <label>Senha</label><input id="p" type="password" autocomplete="current-password" minlength="10" required>
  <button class="btn">Entrar</button></form><p class="warn" id="m">${esc(msg || "")}</p></div>`;
  let fails = 0;
  $("#f").onsubmit = async ev => { ev.preventDefault(); const b = ev.submitter; b.disabled = true;
    try { await api.login($("#e").value.trim(), $("#p").value); await boot(); }
    catch (e) { fails++; $("#m").textContent = "E-mail ou senha inválidos."; setTimeout(() => b.disabled = false, Math.min(30000, 1000 * 2 ** fails)); } };
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
  const P = await api.products();
  app.innerHTML = `<div class="card"><h2>Estoque</h2><input id="b" placeholder="Buscar produto ou SKU…">
  <table id="t"></table></div>`;
  const draw = () => { const q = $("#b").value.toLowerCase();
    $("#t").innerHTML = `<tr><th>SKU</th><th>Produto</th><th class="n">Preço</th><th class="n">Estoque</th><th class="n">Mín.</th></tr>` +
      P.filter(p => (p.sku + p.marca + p.produto).toLowerCase().includes(q)).map(p => `<tr><td>${esc(p.sku)}</td><td>${esc(p.marca)} ${esc(p.produto)} ${esc(p.tamanho || "")}</td><td class="n">${brl(p.preco_venda)}</td><td class="n ${p.estoque <= p.estoque_minimo ? "low" : ""}">${p.estoque}${p.estoque <= p.estoque_minimo ? " · REPOR" : ""}</td><td class="n">${p.estoque_minimo}</td></tr>`).join(""); };
  $("#b").oninput = draw; draw();
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
  app.innerHTML = `<div class="card"><h2>Produtos e custos (admin)</h2><table><tr><th>SKU</th><th>Produto</th><th class="n">Custo</th><th class="n">Venda</th><th class="n">Margem</th><th class="n">Estoque</th></tr>
  ${P.map(p => { const c = cm[p.sku]; return `<tr><td>${esc(p.sku)}</td><td>${esc(p.marca)} ${esc(p.produto)} ${esc(p.tamanho || "")}</td><td class="n">${c != null ? brl(c) : "—"}</td><td class="n">${brl(p.preco_venda)}</td><td class="n">${c ? ((p.preco_venda - c) / p.preco_venda * 100).toFixed(0) + "%" : "—"}</td><td class="n">${p.estoque}</td></tr>`; }).join("")}</table></div>
  <div class="card"><h2>Adicionar / editar produto</h2><form id="f"><div class="grid"><div><label>SKU</label><input id="sku" required pattern="[A-Z0-9-]{3,20}"></div><div><label>Marca</label><input id="ma" required></div><div><label>Produto</label><input id="pr" required></div><div><label>Tamanho</label><input id="ta"></div><div><label>Preço de venda</label><input id="pv" type="number" step="0.01" required></div><div><label>Custo (só admin vê)</label><input id="cu" type="number" step="0.01"></div><div><label>Estoque mínimo</label><input id="em" type="number" value="2"></div></div><button class="btn">Salvar</button></form></div>`;
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
boot().catch(e => { console.error(e); viewLogin("Erro ao conectar."); });
})();
