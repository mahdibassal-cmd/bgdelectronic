/* BAGDA: tela Usuários (admin) + controle de acesso por horário/bloqueio. Compartilhado por /main e /kiosk.
   Toda regra de segurança vive no servidor (Edge Function admin-users + acesso_liberado() no banco); aqui é só interface. */
(function () {
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const hm = t => String(t || "").slice(0, 5);
  function msgAcesso(st) {
    if (!st) return "";
    if (st.bloqueado) return "Acesso bloqueado pelo administrador.";
    return `Sistema fechado — abre às ${hm(st.abre) || "08:00"}.`;
  }
  /* Checa no login e a cada 60 s; se bloqueado (e não admin) desloga e mostra a mensagem. */
  let timer = null;
  async function guard(api, onBlocked) {
    const check = async () => {
      if (!api.acessoStatus) return true;
      const st = await api.acessoStatus().catch(() => null);
      if (st && st.liberado === false) { clearInterval(timer); if (api.registrarTentativa) await api.registrarTentativa().catch(() => {}); await api.logout().catch(() => {}); onBlocked(msgAcesso(st)); return false; }
      return true;
    };
    const okNow = await check();
    if (okNow) { clearInterval(timer); timer = setInterval(check, 60000); }
    return okNow;
  }
  async function view(app, api, me, o) {
    const roles = o.roles, toast = o.toast;
    app.innerHTML = `<div class="card"><h2>Usuários</h2><p class="muted">Carregando…</p></div>`;
    let L = [], err = "";
    try { L = (await api.adminUsers({ action: "list" })).users || []; } catch (e) { err = e.message; }
    const ac = api.acessoStatus ? await api.acessoStatus().catch(() => null) : null;
    const T = api.tentativas ? await api.tentativas().catch(e => ({ erro: e.message })) : [];
    const MOT = { fora_horario: "Fora do horário", bloqueio_manual: "Bloqueio manual" };
    const dt = d => new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
    const ro = r => Object.entries(roles).map(([v, l]) => `<option value="${v}" ${r === v ? "selected" : ""}>${l}</option>`).join("");
    app.innerHTML = `
<div class="card"><h2>Acesso da loja — ${esc(o.store)}</h2>
${ac ? `<p><b style="color:${ac.liberado_staff ? "#15803d" : "#b91c1c"}">${ac.liberado_staff ? "LIBERADO para vendedores/financeiro" : "BLOQUEADO para vendedores/financeiro"}</b> <span class="muted">· ${ac.bloqueado ? "bloqueio manual ativo" : ac.liberado_staff ? "dentro do horário" : "fora do horário"} · admins nunca são bloqueados</span></p>
<div class="cxa"><button class="btn" id="ab" style="background:#b91c1c;color:#fff">Bloquear acesso</button><button class="btn" id="al" style="background:#15803d;color:#fff">Liberar acesso</button></div>
<div class="grid pgrow" style="margin-top:10px"><div><label>Fecha às</label><input type="time" id="af" value="${esc(hm(ac.fecha))}"></div><div><label>Abre às</label><input type="time" id="aa" value="${esc(hm(ac.abre))}"></div><div><button class="btn ghost" id="as">Salvar horário</button></div></div>
<p class="muted">Bloqueio automático diário (horário de São Paulo). "Liberar acesso" só remove o bloqueio manual; fora do horário continua fechado.</p>`
        : `<p class="warn">Controle de acesso indisponível: rode <code>migration-usuarios.sql</code> no Supabase.</p>`}
</div>
<div class="card"><h2>Novo usuário</h2>
<div class="grid"><div><label>Nome</label><input id="nn" maxlength="60" autocomplete="off"></div><div><label>E-mail</label><input id="ne" type="email" maxlength="160" autocomplete="off"></div>
<div><label>Senha (mín. 8)</label><input id="np" type="password" minlength="8" maxlength="72" autocomplete="new-password"></div>
<div><label>Função</label><select id="nr">${ro("vendedor")}</select></div><div><label>Loja</label><select id="ns" disabled><option>${esc(o.store)}</option></select></div></div>
<p class="muted">Para criar no outro sistema, troque de loja no seletor (admin) e crie lá.</p>
<button class="btn" id="nc">Criar usuário</button></div>
<div class="card"><h2>Usuários (${L.length})</h2>${err ? `<p class="warn" role="alert">${esc(err)}</p>` : ""}
<table><tr><th>Nome</th><th>E-mail</th><th>Função</th><th>Status</th><th></th></tr>
${L.map(u => { const self = u.id === o.myId; return `<tr><td>${esc(u.nome)}<br><small class="muted">${esc(u.handle)}</small></td><td>${esc(u.email)}</td>
<td><select class="ur" data-id="${esc(u.id)}" ${self ? "disabled title='Você não pode mudar a própria função'" : ""}>${ro(u.role)}</select></td>
<td>${u.ativo ? "Ativo" : "<b class='low'>Desativado</b>"}</td>
<td><div class="cxa"><button class="btn ghost up" data-id="${esc(u.id)}">Nova senha</button>${self ? "" : `<button class="btn ghost ua" data-id="${esc(u.id)}" data-on="${u.ativo ? 0 : 1}">${u.ativo ? "Desativar" : "Ativar"}</button>`}</div></td></tr>`; }).join("") || `<tr><td colspan="5" class="muted">${err ? "—" : "Nenhum usuário."}</td></tr>`}
</table></div>
<div class="card"><h2>Tentativas fora do horário</h2><p class="muted">Quem tentou entrar/usar com o acesso bloqueado (horário de São Paulo; no máx. 1 registro por usuário a cada 5 min).</p>
${T.erro ? `<p class="warn" role="alert">${esc(T.erro)}</p>` : `<table><tr><th>Quando</th><th>Usuário</th><th>Função</th><th>Motivo</th><th>Navegador</th></tr>
${T.map(x => `<tr><td>${esc(dt(x.occurred_at))}</td><td>${esc(x.nome || "—")}<br><small class="muted">${esc(x.email || "")}</small></td><td>${esc(roles[x.role] || (x.role === "seller" && roles.vendedor) || x.role || "")}</td><td>${esc(MOT[x.motivo] || x.motivo)}</td><td><small class="muted">${esc((x.user_agent || "").slice(0, 60))}</small></td></tr>`).join("") || `<tr><td colspan="5" class="muted">Nenhuma tentativa registrada.</td></tr>`}</table>`}</div>`;
    const run = async (body, okMsg) => { try { await api.adminUsers(body); toast(okMsg); view(app, api, me, o); } catch (e) { toast(e.message); alert(e.message); } };
    const $ = s => app.querySelector(s);
    if (ac) {
      $("#ab").onclick = async () => { if (!confirm("Bloquear o acesso de vendedores e financeiro agora?")) return; try { await api.setAcesso({ bloqueado: true }); toast("Acesso bloqueado"); view(app, api, me, o); } catch (e) { toast(e.message); } };
      $("#al").onclick = async () => { try { await api.setAcesso({ bloqueado: false }); toast("Bloqueio manual removido"); view(app, api, me, o); } catch (e) { toast(e.message); } };
      $("#as").onclick = async () => { const f = $("#af").value, a = $("#aa").value; if (!/^\d\d:\d\d$/.test(f) || !/^\d\d:\d\d$/.test(a) || f === a) return toast("Horários inválidos"); try { await api.setAcesso({ fecha: f, abre: a }); toast("Horário salvo"); view(app, api, me, o); } catch (e) { toast(e.message); } };
    }
    $("#nc").onclick = () => {
      const nome = $("#nn").value.trim(), email = $("#ne").value.trim().toLowerCase(), password = $("#np").value, role = $("#nr").value;
      if (nome.length < 2) return toast("Informe o nome");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return toast("E-mail inválido");
      if (password.length < 8) return toast("Senha precisa de pelo menos 8 caracteres");
      run({ action: "create", nome, email, password, role, store: o.store }, "Usuário criado ✓");
    };
    app.querySelectorAll(".ur").forEach(s => s.onchange = () => run({ action: "set_role", id: s.dataset.id, role: s.value }, "Função alterada ✓"));
    app.querySelectorAll(".ua").forEach(b => b.onclick = () => { const on = b.dataset.on === "1"; if (!on && !confirm("Desativar este usuário? Ele não consegue mais entrar.")) return; run({ action: "set_active", id: b.dataset.id, ativo: on }, on ? "Usuário ativado ✓" : "Usuário desativado ✓"); });
    app.querySelectorAll(".up").forEach(b => b.onclick = () => { const p = prompt("Nova senha (mín. 8 caracteres):"); if (p == null) return; if (p.length < 8) return toast("Senha precisa de pelo menos 8 caracteres"); run({ action: "reset_password", id: b.dataset.id, password: p }, "Senha redefinida ✓"); });
  }
  /* helpers para a camada de dados real */
  function realApi(sb) {
    return {
      async adminUsers(body) {
        const { data, error } = await sb.functions.invoke("admin-users", { body });
        if (!error) { if (data && data.error) throw new Error(data.error); return data; }
        const st = error.context && error.context.status; let m = "";
        try { m = (await error.context.json()).error; } catch {}
        if (error.name === "FunctionsFetchError" || error.name === "FunctionsRelayError" || st === 404) throw new Error("Função admin-users ainda não publicada no Supabase (deploy pendente). Fale com o MB.");
        throw new Error(m || error.message);
      },
      async acessoStatus() { const { data, error } = await sb.rpc("acesso_status"); if (error) return null; return data; },
      async registrarTentativa() { await sb.rpc("registrar_tentativa_bloqueada", { p_user_agent: (navigator.userAgent || "").slice(0, 300) }); },
      async tentativas() { const { data, error } = await sb.from("acesso_tentativas").select("occurred_at,nome,email,role,motivo,user_agent").order("occurred_at", { ascending: false }).limit(200);
        if (error) { if (/acesso_tentativas|schema cache|does not exist/i.test(error.message)) throw new Error("Histórico ainda não instalado (rode migration-tentativas.sql)."); throw new Error(error.message); } return data || []; },
      async setAcesso(a) { const { error } = await sb.rpc("set_acesso", { p_bloqueado: a.bloqueado ?? null, p_fecha: a.fecha ?? null, p_abre: a.abre ?? null }); if (error) throw new Error(error.message); }
    };
  }
  /* demonstração: ?mock=vendedor&bloqueado=1 ou &fechado=1 simula o bloqueio */
  function mockApi(qs, users, myId) {
    const A = { bloqueado: qs.has("bloqueado"), fecha: "17:30", abre: "08:00" };
    const nowSP = () => new Date().toLocaleTimeString("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
    const fora = () => { const t = nowSP(); return A.fecha > A.abre ? (t >= A.fecha || t < A.abre) : (t >= A.fecha && t < A.abre); };
    const me = () => users.find(u => u.id === myId) || {};
    const adm = () => me() && me().role === "admin";
    return {
      async adminUsers(b) {
        if (qs.has("nofn")) throw new Error("Função admin-users ainda não publicada no Supabase (deploy pendente). Fale com o MB.");
        if (!adm()) throw new Error("Só admin");
        if (b.action === "list") return { users: users.map(u => ({ email: u.email || u.handle.slice(1) + "@demo.local", ...u })) };
        if (b.action === "create") { if ((b.password || "").length < 8) throw new Error("Senha precisa de pelo menos 8 caracteres"); users.push({ id: "u" + Date.now(), handle: "@" + b.nome.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20), nome: b.nome, email: b.email, role: b.role, ativo: true }); return { ok: true }; }
        const u = users.find(x => x.id === b.id); if (!u) throw new Error("Usuário não encontrado");
        if (b.id === myId && (b.action === "set_role" || b.action === "set_active")) throw new Error("Você não pode mudar a própria função nem se desativar");
        if (b.action === "set_role") u.role = b.role; else if (b.action === "set_active") u.ativo = !!b.ativo; return { ok: true };
      },
      async acessoStatus() { const lib = !A.bloqueado && !qs.has("fechado") && (qs.has("aberto") || !fora()); return { liberado: adm() || lib, liberado_staff: lib, bloqueado: A.bloqueado, fecha: A.fecha, abre: A.abre }; },
      async registrarTentativa() {},
      async tentativas() { if (!adm()) throw new Error("Só admin"); const h = 36e5; return [
        { occurred_at: new Date(Date.now() - 2 * h).toISOString(), nome: "Ana Vendas", email: "ana@demo.local", role: "vendedor", motivo: "fora_horario", user_agent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)" },
        { occurred_at: new Date(Date.now() - 26 * h).toISOString(), nome: "Bruno Caixa", email: "bruno@demo.local", role: "financeiro", motivo: "bloqueio_manual", user_agent: "Mozilla/5.0 (Windows NT 10.0)" }]; },
      async setAcesso(a) { if (!adm()) throw new Error("Só admin"); if (a.bloqueado != null) A.bloqueado = a.bloqueado; if (a.fecha) A.fecha = a.fecha; if (a.abre) A.abre = a.abre; }
    };
  }
  window.BGDUsers = { view, guard, realApi, mockApi, msgAcesso };
})();
