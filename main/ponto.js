/* Ponto eletrônico com biometria facial (cliente). Recebe toast, esc, today, me, api, $, app via view(deps). */
(() => {
  let $, app, me, api, toast, esc, today;
  const qs = () => new URLSearchParams(location.search);
  const isMock = () => !!(window.__demo || qs().has("mock"));
  const TIPOS = [
    { id: "entrada", label: "Entrada" },
    { id: "saida_almoco", label: "Saída almoço" },
    { id: "volta_almoco", label: "Volta almoço" },
    { id: "saida", label: "Saída" }
  ];
  const TLAB = Object.fromEntries(TIPOS.map(t => [t.id, t.label]));
  const CONSENT =
    "Ao cadastrar meu rosto, autorizo a BAGDA STORES a tratar minha biometria facial apenas para o registro de ponto eletrônico (controle de jornada), nos termos da LGPD (Lei 13.709/2018). A foto e o descritor ficam em área restrita, acessível à administração, e não são usados para outro fim. Posso pedir a exclusão deste cadastro ao administrador.";
  const LIMIAR = 0.55;
  let camStream = null, modelsReady = false, tab = "bater";

  const isAdmin = () => !!(me && me.role === "admin");
  const missingRpc = em => /PGRST202|42883|schema cache|does not exist|registrar_ponto|ponto_cadastrar/i.test(em || "");
  const rpcToast = em => toast(missingRpc(em) ? "Ponto ainda depende da atualização do banco (supabase-loja/migration-ponto.sql). Nada foi lançado." : (em || "Erro"));

  const jornadaOf = j => Object.assign({ entrada: "08:00", saida: "18:00", almoco_minutos: 60, dias_semana: [1, 2, 3, 4, 5], tolerancia_minutos: 10 }, j || {});
  const pad2 = n => String(n).padStart(2, "0");
  const fmtHM = min => {
    if (min == null || Number.isNaN(min)) return "—";
    const s = min < 0 ? "-" : "";
    min = Math.abs(Math.round(min));
    return s + Math.floor(min / 60) + ":" + pad2(min % 60);
  };
  const clockOf = iso => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false });
  };
  const tminIso = iso => {
    const p = new Date(iso).toLocaleTimeString("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false }).split(":");
    return (+p[0]) * 60 + (+p[1]);
  };
  const tminStr = t => { const [h, m] = String(t || "00:00").split(":"); return (+h) * 60 + (+m || 0); };
  const dowSP = d => { // ISO 1-7, date YYYY-MM-DD
    const [y, mo, da] = d.split("-").map(Number);
    const dt = new Date(Date.UTC(y, mo - 1, da, 15)); // midday-ish UTC avoids DST edge
    const wd = new Date(dt.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })).getDay();
    return wd === 0 ? 7 : wd;
  };
  const monthDays = ym => {
    const [y, m] = ym.split("-").map(Number);
    const last = new Date(y, m, 0).getDate();
    return Array.from({ length: last }, (_, i) => ym + "-" + pad2(i + 1));
  };
  const nextTipo = regs => {
    const d = today();
    const n = (regs || []).filter(r => !r.excluido && r.data_sp === d).length;
    return TIPOS[Math.min(n, 3)].id;
  };
  const dayStats = (day, j) => {
    const E = day.entrada, SA = day.saida_almoco, VA = day.volta_almoco, S = day.saida;
    const expected = tminStr(j.saida) - tminStr(j.entrada) - (j.almoco_minutos || 0);
    let worked = null, late = false, lateMin = 0, overtime = 0, notes = [], missing = [];
    if (E && SA && VA && S) worked = (tminIso(SA.registrado_em) - tminIso(E.registrado_em)) + (tminIso(S.registrado_em) - tminIso(VA.registrado_em));
    else if (E && S && !SA && !VA) { worked = Math.max(0, tminIso(S.registrado_em) - tminIso(E.registrado_em) - (j.almoco_minutos || 0)); notes.push("Sem batidas de almoço"); }
    else if (E || SA || VA || S) {
      if (!E) missing.push("entrada");
      if (!S) missing.push("saída");
      notes.push("Batidas incompletas");
      if (E && SA) worked = tminIso(SA.registrado_em) - tminIso(E.registrado_em);
      if (VA && S) worked = (worked || 0) + (tminIso(S.registrado_em) - tminIso(VA.registrado_em));
    }
    if (E) {
      lateMin = tminIso(E.registrado_em) - (tminStr(j.entrada) + (j.tolerancia_minutos || 0));
      if (lateMin > 0) { late = true; notes.push("Atraso " + fmtHM(lateMin)); }
    }
    if (worked != null && worked > expected) overtime = worked - expected;
    return { worked, expected, late, lateMin, overtime, notes, missing };
  };

  async function loadFace() {
    if (modelsReady && window.faceapi) return true;
    if (!window.faceapi) {
      await new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = "vendor/face-api/face-api.js?v=1.7.15";
        s.onload = res; s.onerror = () => rej(new Error("Não carregou o reconhecedor facial"));
        document.head.appendChild(s);
      });
    }
    const m = "vendor/face-api/model";
    await window.faceapi.nets.tinyFaceDetector.loadFromUri(m);
    await window.faceapi.nets.faceLandmark68TinyNet.loadFromUri(m);
    await window.faceapi.nets.faceRecognitionNet.loadFromUri(m);
    modelsReady = true;
    return true;
  }
  function stopCam() {
    if (camStream) { camStream.getTracks().forEach(t => t.stop()); camStream = null; }
  }
  async function startCam(video) {
    stopCam();
    camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 } }, audio: false });
    video.srcObject = camStream;
    await video.play();
  }
  async function grab(video) {
    const c = document.createElement("canvas");
    c.width = video.videoWidth || 640; c.height = video.videoHeight || 480;
    c.getContext("2d").drawImage(video, 0, 0, c.width, c.height);
    const blob = await new Promise(res => c.toBlob(res, "image/jpeg", 0.85));
    return { canvas: c, blob };
  }
  async function describe(canvas) {
    await loadFace();
    const det = await window.faceapi
      .detectSingleFace(canvas, new window.faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
      .withFaceLandmarks(true)
      .withFaceDescriptor();
    if (!det || !det.descriptor) throw new Error("Não encontrei um rosto nítido. Olhe para a câmera e tente de novo.");
    return Array.from(det.descriptor);
  }
  async function geo() {
    if (!navigator.geolocation) return {};
    return new Promise(res => {
      const t = setTimeout(() => res({}), 2500);
      navigator.geolocation.getCurrentPosition(
        p => { clearTimeout(t); res({ lat: p.coords.latitude, lng: p.coords.longitude }); },
        () => { clearTimeout(t); res({}); },
        { timeout: 2000, maximumAge: 60000 }
      );
    });
  }
  function mockPreview(title, sub) {
    return `<div class="ponto-cam" id="pcam"><div class="ph"><div class="ponto-face"></div><b>${esc(title)}</b><span>${esc(sub)}</span></div></div>`;
  }

  async function maybeUpload(folder, blob) {
    if (!blob || !api.pontoUploadFoto) return folder + "/" + Date.now() + ".jpg";
    const path = folder + "/" + (crypto.randomUUID ? crypto.randomUUID() : Date.now()) + ".jpg";
    try { return await api.pontoUploadFoto(path, blob); }
    catch (e) { if (missingRpc(e.message) || /bucket|not found|ponto/i.test(e.message || "")) return path; throw e; }
  }

  async function view() {
    stopCam();
    document.body.classList.toggle("ponto-totem", tab === "totem");
    if (qs().get("ptab") === "totem") tab = "totem";
    if (qs().get("ptab") === "espelho") tab = "espelho";
    if (qs().get("ptab") === "cadastro") tab = "cadastro";
    const souTotem = !!(api.pontoSouTotem && await api.pontoSouTotem().catch(() => false));
    if (souTotem && !isAdmin() && tab === "bater") tab = "totem";
    const tabs = [
      !souTotem || isAdmin() ? ["bater", "Bater ponto"] : null,
      !souTotem || isAdmin() ? ["hist", "Meu histórico"] : null,
      !souTotem || isAdmin() ? ["cadastro", "Cadastro facial"] : null,
      isAdmin() || souTotem ? ["totem", "Totem"] : null,
      isAdmin() ? ["espelho", "Espelho de ponto"] : null,
      isAdmin() ? ["config", "Jornadas e totens"] : null,
      isAdmin() ? ["falhas", "Falhas faciais"] : null
    ].filter(Boolean);
    if (!tabs.some(t => t[0] === tab)) tab = tabs[0][0];
    const bar = `<div class="ponto-tabs noprint">${tabs.map(([id, lab]) => `<button type="button" class="btn ${tab === id ? "" : "ghost"}" data-tab="${id}">${lab}</button>`).join("")}</div>`;
    try {
      if (tab === "bater") await viewBater(bar);
      else if (tab === "hist") await viewHist(bar);
      else if (tab === "cadastro") await viewCadastro(bar);
      else if (tab === "totem") await viewTotem(bar);
      else if (tab === "espelho") await viewEspelho(bar);
      else if (tab === "config") await viewConfig(bar);
      else if (tab === "falhas") await viewFalhas(bar);
    } catch (e) { rpcToast(e.message); }
    app.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => { tab = b.dataset.tab; view(); });
  }

  async function viewBater(bar) {
    const [face, regs] = await Promise.all([api.pontoMinhaFace().catch(() => null), api.pontoMeusRegistros().catch(() => [])]);
    const tipo = nextTipo(regs);
    const hoje = (regs || []).filter(r => !r.excluido && r.data_sp === today());
    const mock = isMock();
    app.innerHTML = `<div class="card"><h2>Ponto</h2>${bar}
      <p class="muted">O horário gravado é o do servidor, não o deste aparelho. Tipos: entrada, saída almoço, volta almoço e saída.</p>
      ${face ? "" : `<p class="warn">Você ainda não cadastrou o rosto. Abra <b>Cadastro facial</b> e aceite o termo (LGPD) antes de bater o ponto.</p>`}
      ${mock ? mockPreview("Câmera (demonstração)", "Neste modo o reconhecimento é simulado. No aparelho real usamos a câmera deste dispositivo.") : `<div class="ponto-cam"><video id="pv" playsinline autoplay muted></video></div>`}
      <div class="grid" style="max-width:520px;margin:0 auto">
        <div><label>Tipo</label><select id="ptipo">${TIPOS.map(t => `<option value="${t.id}" ${t.id === tipo ? "selected" : ""}>${t.label}</option>`).join("")}</select></div>
      </div>
      <p class="muted" style="text-align:center">Sugerido agora: <b>${esc(TLAB[tipo])}</b></p>
      <p style="text-align:center"><button class="btn" id="pgo" ${face ? "" : "disabled"}>Bater ponto</button></p>
      <p id="pmsg" class="muted" style="text-align:center"></p>
      <h3>Hoje</h3>
      <table class="stk"><thead><tr><th>Hora</th><th>Tipo</th><th>Score</th></tr></thead>
      <tbody>${hoje.length ? hoje.map(r => `<tr><td>${esc(clockOf(r.registrado_em))}</td><td>${esc(TLAB[r.tipo] || r.tipo)}</td><td>${r.score != null ? Number(r.score).toFixed(3) : "—"}</td></tr>`).join("") : `<tr><td colspan="3" class="muted">Nenhuma batida hoje.</td></tr>`}</tbody></table>
    </div>`;
    const video = $("#pv");
    if (video) startCam(video).catch(e => toast("Câmera: " + (e.message || "sem permissão")));
    $("#pgo").onclick = async ev => {
      ev.preventDefault();
      const b = ev.currentTarget, tp = $("#ptipo").value, msg = $("#pmsg");
      b.disabled = true;
      try {
        let desc, blob;
        if (mock) {
          desc = (face && face.descriptor) || Array.from({ length: 128 }, (_, i) => (i + 1) * 0.001);
          blob = null;
        } else {
          if (!video || !video.srcObject) throw new Error("Câmera indisponível");
          const g = await grab(video);
          blob = g.blob;
          desc = await describe(g.canvas);
        }
        const gpos = await geo();
        const path = await maybeUpload(me.id || "eu", blob);
        const r = await api.registrarPonto(tp, desc, path, navigator.userAgent, gpos.lat, gpos.lng);
        if (r && r.ok === false) {
          msg.innerHTML = `<span class="ponto-bad">${esc(r.motivo || "Rosto não confere.")}</span>`;
          toast(r.motivo || "Rosto não confere. O ponto não foi registrado.");
        } else {
          msg.innerHTML = `<span class="ponto-ok">Ponto registrado: ${esc(TLAB[tp])} ✓</span>`;
          toast("Ponto registrado ✓");
          setTimeout(view, 600);
        }
      } catch (e) { rpcToast(e.message); }
      finally { b.disabled = false; }
    };
  }

  async function viewHist(bar) {
    const regs = (await api.pontoMeusRegistros().catch(() => [])).filter(r => !r.excluido);
    const rows = regs.map(r => `<tr><td>${esc(r.data_sp)}</td><td>${esc(clockOf(r.registrado_em))}</td><td>${esc(TLAB[r.tipo] || r.tipo)}</td><td>${r.score != null ? Number(r.score).toFixed(3) : "—"}</td><td>${esc(r.origem || "app")}</td></tr>`).join("");
    app.innerHTML = `<div class="card"><h2>Ponto</h2>${bar}
      <p class="muted">Só você vê o seu histórico (o administrador vê o de todos no espelho).</p>
      <table class="stk"><thead><tr><th>Data</th><th>Hora</th><th>Tipo</th><th>Score</th><th>Origem</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="5" class="muted">Nenhum registro.</td></tr>`}</tbody></table></div>`;
  }

  async function viewCadastro(bar) {
    const users = isAdmin() ? (await api.usuarios().catch(() => [])).filter(u => u.ativo) : [me];
    const face = await api.pontoMinhaFace().catch(() => null);
    const mock = isMock();
    const alvo = `<div><label>Colaborador</label><select id="palvo">${users.map(u => `<option value="${esc(u.id)}" ${u.id === me.id ? "selected" : ""}>${esc(u.nome)} (${esc(u.handle || "")})</option>`).join("")}</select></div>`;
    app.innerHTML = `<div class="card"><h2>Ponto</h2>${bar}
      <p>Cadastro da face de referência. A foto e o descritor ficam no armazenamento privado do sistema.</p>
      ${face ? `<p class="muted">Há um cadastro facial em ${esc(new Date(face.cadastrado_em || Date.now()).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }))}.</p>` : `<p class="warn">Ainda não há rosto cadastrado para a sua conta.</p>`}
      ${isAdmin() ? alvo : ""}
      ${mock ? mockPreview("Câmera (demonstração)", "No aparelho real a foto de referência sai desta câmera.") : `<div class="ponto-cam"><video id="pv" playsinline autoplay muted></video></div>`}
      <div class="ponto-consent">
        <b>Consentimento (LGPD)</b>
        <p>${esc(CONSENT)}</p>
        <label><input type="checkbox" id="pcok"> Li e autorizo o uso da minha biometria facial para o ponto eletrônico da BAGDA STORES.</label>
      </div>
      <p><button class="btn" id="penr">Cadastrar rosto</button>
      ${face || isAdmin() ? ` <button class="btn ghost" id="pdel">Excluir cadastro facial</button>` : ""}</p>
    </div>`;
    const video = $("#pv");
    if (video) startCam(video).catch(e => toast("Câmera: " + (e.message || "sem permissão")));
    $("#penr").onclick = async ev => {
      ev.preventDefault();
      if (!$("#pcok").checked) return toast("Aceite o termo de consentimento para continuar.");
      const b = ev.currentTarget; b.disabled = true;
      try {
        let desc, blob;
        if (mock) { desc = Array.from({ length: 128 }, (_, i) => (i + 1) * 0.001 + (me.role === "admin" ? 0.4 : 0.1)); blob = null; }
        else {
          if (!video || !video.srcObject) throw new Error("Câmera indisponível");
          const g = await grab(video); blob = g.blob; desc = await describe(g.canvas);
        }
        const uid = ($("#palvo") && $("#palvo").value) || me.id;
        const path = await maybeUpload(uid + "/ref", blob);
        const r = await api.pontoCadastrarFace(desc, path, true, CONSENT, uid === me.id ? null : uid);
        if (r && r.ok === false) return toast(r.motivo || "Não cadastrou");
        toast("Rosto cadastrado ✓"); view();
      } catch (e) { rpcToast(e.message); }
      finally { b.disabled = false; }
    };
    if ($("#pdel")) $("#pdel").onclick = async () => {
      const mot = prompt("Motivo da exclusão do cadastro facial (LGPD):");
      if (mot == null) return;
      try {
        const uid = ($("#palvo") && $("#palvo").value) || me.id;
        await api.pontoExcluirFace(uid, mot);
        toast("Cadastro facial excluído"); view();
      } catch (e) { rpcToast(e.message); }
    };
  }

  async function viewTotem(bar) {
    const mock = isMock();
    const users = (await api.usuarios().catch(() => [])).filter(u => u.ativo);
    app.innerHTML = `<div class="card"><h2>Totem de ponto</h2>${isAdmin() ? bar : `<p class="noprint"><button class="btn ghost" id="psair">Encerrar totem</button></p>`}
      <p class="muted">Aparelho compartilhado da loja. A pessoa se identifica pelo rosto entre os cadastros. O horário é o do servidor.</p>
      ${mock ? mockPreview("Totem (demonstração)", "Escolha um colaborador para simular o reconhecimento 1:N.") : `<div class="ponto-cam"><video id="pv" playsinline autoplay muted></video></div>`}
      ${mock && users.length ? `<div><label>Simular rosto de</label><select id="psim">${users.map(u => `<option value="${esc(u.id)}">${esc(u.nome)}</option>`).join("")}</select></div>` : ""}
      <div class="grid"><div><label>Tipo</label><select id="ptipo">${TIPOS.map(t => `<option value="${t.id}">${t.label}</option>`).join("")}</select></div></div>
      <p class="ponto-hello" id="phello">Olhe para a câmera</p>
      <p style="text-align:center"><button class="btn" id="pgo">Identificar e bater ponto</button></p>
    </div>`;
    const video = $("#pv");
    if (video) startCam(video).catch(e => toast("Câmera: " + (e.message || "sem permissão")));
    if ($("#psair")) $("#psair").onclick = () => { tab = "bater"; view(); };
    $("#pgo").onclick = async ev => {
      ev.preventDefault();
      const b = ev.currentTarget, hello = $("#phello"); b.disabled = true;
      try {
        let desc, blob;
        if (mock) {
          const faces = await api.pontoFacesDemo().catch(() => []);
          const uid = ($("#psim") && $("#psim").value) || (faces[0] && faces[0].user_id);
          const f = faces.find(x => x.user_id === uid) || faces[0];
          if (!f) throw new Error("Nenhum rosto cadastrado no modo demonstração");
          desc = f.descriptor; blob = null;
        } else {
          if (!video || !video.srcObject) throw new Error("Câmera indisponível");
          const g = await grab(video); blob = g.blob; desc = await describe(g.canvas);
        }
        const gpos = await geo();
        const path = await maybeUpload("totem", blob);
        const r = await api.registrarPontoTotem($("#ptipo").value, desc, path, navigator.userAgent, gpos.lat, gpos.lng);
        if (r && r.ok === false) {
          hello.innerHTML = `<span class="ponto-bad">${esc(r.motivo || "Não reconhecido")}</span>`;
          toast(r.motivo || "Rosto não reconhecido. O ponto não foi registrado.");
        } else {
          hello.innerHTML = `<span class="ponto-ok">Olá, ${esc(r.nome || "colaborador")} — ${esc(TLAB[r.tipo] || r.tipo)} ✓</span>`;
          toast("Ponto de " + (r.nome || "") + " registrado ✓");
        }
      } catch (e) { rpcToast(e.message); }
      finally { b.disabled = false; }
    };
  }

  async function viewEspelho(bar) {
    const ym = ($("#pmes") && $("#pmes").value) || today().slice(0, 7);
    const users = (await api.usuarios().catch(() => [])).filter(u => u.ativo);
    const uid = ($("#pcol") && $("#pcol").value) || (users[0] && users[0].id) || "";
    const [regs, jor] = await Promise.all([
      api.pontoRegistrosMes(ym).catch(() => []),
      api.pontoJornadas().catch(() => [])
    ]);
    const u = users.find(x => x.id === uid) || users[0] || { nome: "—", handle: "" };
    const j = jornadaOf((jor || []).find(x => x.user_id === (u.id || uid)));
    const byDay = {};
    (regs || []).filter(r => !r.excluido && r.user_id === (u.id || uid)).forEach(r => { (byDay[r.data_sp] ||= {})[r.tipo] = r; });
    let totTrab = 0, totExt = 0, atrasos = 0, faltas = 0, incompletos = 0;
    const days = monthDays(ym);
    const body = days.map(d => {
      const dow = dowSP(d);
      const esperado = (j.dias_semana || [1, 2, 3, 4, 5]).map(Number).includes(dow);
      const st = dayStats(byDay[d] || {}, j);
      if (esperado && !byDay[d]) faltas++;
      if (st.late) atrasos++;
      if (st.missing.length) incompletos++;
      if (st.worked != null) totTrab += st.worked;
      if (st.overtime) totExt += st.overtime;
      const day = byDay[d] || {};
      const cell = t => clockOf(day[t] && day[t].registrado_em);
      const wk = !esperado && !byDay[d] ? "Folga" : (!byDay[d] && esperado ? "Falta" : st.notes.join("; "));
      return `<tr><td>${d.slice(8)}/${d.slice(5, 7)}</td><td>${cell("entrada")}</td><td>${cell("saida_almoco")}</td><td>${cell("volta_almoco")}</td><td>${cell("saida")}</td><td>${fmtHM(st.worked)}</td><td class="l">${esc(wk || "—")}</td></tr>`;
    }).join("");
    const [y, m] = ym.split("-");
    const meses = "janeiro fevereiro março abril maio junho julho agosto setembro outubro novembro dezembro".split(" ");
    app.innerHTML = `<div class="card ponto-print-root"><h2>Ponto <button class="btn noprint" id="pimp" style="float:right;margin:0">Imprimir A4</button> <button class="btn ghost noprint" id="pcsv" style="float:right;margin:0 8px 0 0">CSV</button></h2>${bar}
      <div class="grid noprint"><div><label>Mês</label><input id="pmes" type="month" value="${esc(ym)}"></div>
      <div><label>Colaborador</label><select id="pcol">${users.map(x => `<option value="${esc(x.id)}" ${x.id === (u.id || uid) ? "selected" : ""}>${esc(x.nome)}</option>`).join("")}</select></div></div>
      <div class="espelho-a4" id="espelho">
        <h2>Espelho de ponto</h2>
        <p><b>BAGDA STORES</b> — ${esc(meses[+m - 1] || "")} de ${esc(y)}<br>
        Colaborador: <b>${esc(u.nome)}</b> (${esc(u.handle || "")})<br>
        Jornada: ${esc(j.entrada.slice(0, 5))}–${esc(j.saida.slice(0, 5))}, intervalo ${j.almoco_minutos} min, tolerância ${j.tolerancia_minutos} min.</p>
        <table><thead><tr><th>Dia</th><th>Entrada</th><th>S. almoço</th><th>V. almoço</th><th>Saída</th><th>Horas</th><th>Ocorrências</th></tr></thead>
        <tbody>${body}
        <tr class="tot"><td colspan="5">Totais do mês</td><td>${fmtHM(totTrab)}</td><td class="l">Extra ${fmtHM(totExt)} · Atrasos ${atrasos} · Faltas ${faltas} · Incompletos ${incompletos}</td></tr>
        </tbody></table>
        <p style="margin-top:18px;font-size:12px">Declaro que as marcações acima conferem com a jornada realizada.<br><br>Assinatura do colaborador: ________________________________</p>
      </div>
    </div>`;
    const redraw = () => viewEspelho(bar);
    $("#pmes").onchange = redraw; $("#pcol").onchange = redraw;
    $("#pimp").onclick = () => window.print();
    $("#pcsv").onclick = () => {
      const cell = v => '"' + String(v ?? "").replace(/"/g, '""') + '"';
      const lines = [["Data", "Entrada", "Saida_almoco", "Volta_almoco", "Saida", "Horas", "Ocorrencias"].join(";")];
      days.forEach(d => {
        const day = byDay[d] || {}, st = dayStats(day, j);
        const c = t => clockOf(day[t] && day[t].registrado_em);
        lines.push([d, c("entrada"), c("saida_almoco"), c("volta_almoco"), c("saida"), fmtHM(st.worked), st.notes.join(" | ") || (!day.entrada && (j.dias_semana || []).map(Number).includes(dowSP(d)) ? "Falta" : "")].map(cell).join(";"));
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" }));
      a.download = "espelho-ponto-" + (u.handle || "colab") + "-" + ym + ".csv";
      a.click();
    };
  }

  async function viewConfig(bar) {
    const [users, jor, totens] = await Promise.all([api.usuarios().catch(() => []), api.pontoJornadas().catch(() => []), api.pontoTotens().catch(() => [])]);
    const T = new Set((totens || []).map(t => t.user_id));
    const rows = (users || []).filter(u => u.ativo).map(u => {
      const j = jornadaOf((jor || []).find(x => x.user_id === u.id));
      return `<tr data-u="${esc(u.id)}"><td>${esc(u.nome)}<br><span class="muted">${esc(u.handle || "")}</span></td>
        <td><input type="time" class="je" value="${esc(j.entrada.slice(0, 5))}"></td>
        <td><input type="time" class="js" value="${esc(j.saida.slice(0, 5))}"></td>
        <td><input type="number" class="ja" min="0" max="240" value="${j.almoco_minutos}" style="width:5em"></td>
        <td><input type="number" class="jt" min="0" max="120" value="${j.tolerancia_minutos}" style="width:5em"></td>
        <td><label><input type="checkbox" class="jto" ${T.has(u.id) ? "checked" : ""}> Totem</label></td>
        <td><button class="btn ghost jsav" type="button">Salvar</button></td></tr>`;
    }).join("");
    app.innerHTML = `<div class="card"><h2>Ponto</h2>${bar}
      <p class="muted">Jornada padrão: 08:00–18:00, 1h de almoço, segunda a sexta, 10 min de tolerância. Marque <b>Totem</b> na conta do tablet da loja (não use a conta pessoal de um vendedor no aparelho compartilhado).</p>
      <table class="stk"><thead><tr><th>Colaborador</th><th>Entrada</th><th>Saída</th><th>Almoço (min)</th><th>Tolerância</th><th>Totem</th><th></th></tr></thead>
      <tbody>${rows || `<tr><td colspan="7" class="muted">Nenhum usuário.</td></tr>`}</tbody></table>
    </div>`;
    app.querySelectorAll(".jsav").forEach(b => b.onclick = async () => {
      const tr = b.closest("tr"), id = tr.dataset.u;
      try {
        await api.pontoSetJornada(id, tr.querySelector(".je").value, tr.querySelector(".js").value, +tr.querySelector(".ja").value, [1, 2, 3, 4, 5], +tr.querySelector(".jt").value);
        await api.pontoSetTotem(id, tr.querySelector(".jto").checked, "Totem loja");
        toast("Jornada salva ✓");
      } catch (e) { rpcToast(e.message); }
    });
  }

  async function viewFalhas(bar) {
    const L = await api.pontoFalhas().catch(() => []);
    const rows = (L || []).map(r => `<tr><td>${esc(new Date(r.criado_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }))}</td><td>${esc(r.nome || r.user_id || "—")}</td><td>${esc(TLAB[r.tipo] || r.tipo || "—")}</td><td>${r.score != null ? Number(r.score).toFixed(3) : "—"}</td><td class="l">${esc(r.motivo)}</td><td>${esc(r.origem)}</td></tr>`).join("");
    app.innerHTML = `<div class="card"><h2>Ponto</h2>${bar}
      <p class="muted">Tentativas em que o rosto não conferiu. O ponto <b>não</b> foi aceito nesses casos.</p>
      <table class="stk"><thead><tr><th>Quando</th><th>Pessoa</th><th>Tipo</th><th>Score</th><th>Motivo</th><th>Origem</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="6" class="muted">Nenhuma falha registrada.</td></tr>`}</tbody></table>
    </div>`;
  }

  window.BAGDA_PONTO = {
    view: (deps) => { ({ $, app, me, api, toast, esc, today } = deps); return view(); },
    consentimento: CONSENT,
    tipos: TIPOS,
    nextTipo,
    dayStats,
    jornadaOf,
    fmtHM
  };
})();
