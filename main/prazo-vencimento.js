/* Paga Depois: prazo 1–30 dias, vencimento e alertas de cobrança (helper do /main). */
(() => {
  "use strict";
  const MIN = 1, MAX = 30, DEFAULT_DIAS = 7, BREVE = 2;
  const addDays = (ymd, days) => {
    const p = String(ymd || "").split("-").map(Number);
    if (p.length !== 3 || !p[0] || !p[1] || !p[2]) return null;
    const dt = new Date(Date.UTC(p[0], p[1] - 1, p[2] + Number(days || 0)));
    if (!Number.isFinite(dt.getTime())) return null;
    return dt.toISOString().slice(0, 10);
  };
  const daysBetween = (a, b) => {
    const pa = String(a || "").split("-").map(Number), pb = String(b || "").split("-").map(Number);
    if (pa.length !== 3 || pb.length !== 3 || !pa[0] || !pb[0]) return null;
    const da = Date.UTC(pa[0], pa[1] - 1, pa[2]), db = Date.UTC(pb[0], pb[1] - 1, pb[2]);
    return Math.round((db - da) / 864e5);
  };
  const classificar = (venc, hoje) => {
    if (!venc || !hoje) return null;
    const d = daysBetween(hoje, venc);
    if (d == null) return null;
    if (d < 0) return "vencida";
    if (d === 0) return "vence_hoje";
    if (d > 0 && d <= BREVE) return "vence_breve";
    return null;
  };
  const LABEL = { vencida: "Vencida", vence_hoje: "Vence hoje", vence_breve: "Vence em até 2 dias", limite: "No limite Paga Depois" };
  const labelClasse = c => LABEL[c] || "";
  const optionsHtml = (selected) => {
    const sel = selected == null || selected === "" ? DEFAULT_DIAS : +selected;
    let s = "";
    for (let i = MIN; i <= MAX; i++) {
      const lab = i === 1 ? "1 dia" : i + " dias";
      s += `<option value="${i}"${i === sel ? " selected" : ""}>${lab}</option>`;
    }
    return s;
  };
  const montar = ({ hoje, notas, clientes, todos }) => {
    const byCli = new Map();
    const cliOf = id => (clientes || []).find(c => +c.id === +id || +c.cliente_id === +id) || {};
    for (const n of notas || []) {
      const aberto = Math.round(Number(n.em_aberto || 0) * 100) / 100;
      if (!(aberto > 0.001)) continue;
      if (!n.cliente_id) continue;
      const c = cliOf(n.cliente_id);
      const id = +n.cliente_id;
      if (!byCli.has(id)) {
        byCli.set(id, {
          cliente_id: id,
          nome: n.nome || c.nome || "",
          saldo_aberto: 0,
          limite_prazo: c.limite_prazo == null || c.limite_prazo === "" ? null : Number(c.limite_prazo),
          no_limite: false,
          tem_vencida: false,
          tem_vence_hoje: false,
          tem_vence_breve: false,
          notas: []
        });
      }
      const row = byCli.get(id);
      row.saldo_aberto = Math.round((row.saldo_aberto + aberto) * 100) / 100;
      const classe = classificar(n.vencimento, hoje);
      const dias = n.vencimento && hoje ? daysBetween(n.vencimento, hoje) : null;
      row.notas.push({
        nota_id: n.nota_id,
        numero: String(n.nota_id).padStart(6, "0"),
        em_aberto: aberto,
        vencimento: n.vencimento || null,
        prazo_dias: n.prazo_dias == null ? null : +n.prazo_dias,
        dias_atraso: dias != null && dias > 0 ? dias : (classe === "vence_hoje" ? 0 : null),
        classe
      });
      if (classe === "vencida") row.tem_vencida = true;
      if (classe === "vence_hoje") row.tem_vence_hoje = true;
      if (classe === "vence_breve") row.tem_vence_breve = true;
    }
    const clientesOut = [];
    for (const row of byCli.values()) {
      if (row.limite_prazo != null && Number.isFinite(row.limite_prazo) && row.saldo_aberto + 0.001 >= row.limite_prazo) row.no_limite = true;
      if (todos || row.tem_vencida || row.tem_vence_hoje || row.tem_vence_breve || row.no_limite) {
        row.notas.sort((a, b) => {
          const ord = { vencida: 0, vence_hoje: 1, vence_breve: 2 };
          const ao = a.classe in ord ? ord[a.classe] : 3, bo = b.classe in ord ? ord[b.classe] : 3;
          return ao - bo || String(a.vencimento || "9999").localeCompare(String(b.vencimento || "9999"));
        });
        clientesOut.push(row);
      }
    }
    const pri = r => r.tem_vencida ? 0 : r.tem_vence_hoje ? 1 : r.no_limite ? 2 : 3;
    clientesOut.sort((a, b) => pri(a) - pri(b) || a.nome.localeCompare(b.nome, "pt"));
    return {
      hoje,
      clientes: clientesOut,
      n_clientes: clientesOut.length,
      n_vencidas: clientesOut.filter(c => c.tem_vencida).length,
      n_vence_hoje: clientesOut.filter(c => c.tem_vence_hoje).length,
      n_vence_breve: clientesOut.filter(c => c.tem_vence_breve).length,
      n_limite: clientesOut.filter(c => c.no_limite).length
    };
  };
  const installStyles = () => {
    if (document.getElementById("prazo-venc-css")) return;
    const s = document.createElement("style");
    s.id = "prazo-venc-css";
    s.textContent = `
      .nav-alert{display:inline-block;min-width:1.2em;margin-left:6px;padding:1px 7px;border-radius:10px;background:#b91c1c;color:#fff;font-size:.72rem;font-weight:700;line-height:1.3;vertical-align:middle}
      .nav-alert[hidden]{display:none}
      .cobranca-panel .badge.vencida{background:#fee2e2;color:#991b1b}
      .cobranca-panel .badge.vence_hoje{background:#ffedd5;color:#9a3412}
      .cobranca-panel .badge.vence_breve{background:#fef3c7;color:#92400e}
      .cobranca-panel .badge.limite{background:#e0e7ff;color:#3730a3}
      .cobranca-panel tr.vencida td:first-child{box-shadow:inset 3px 0 0 #b91c1c}
      html[data-theme=dark] .nav-alert{background:#ef4444;color:#fff}
      html[data-theme=dark] .cobranca-panel .badge.vencida{background:#7f1d1d;color:#fecaca}
      html[data-theme=dark] .cobranca-panel .badge.vence_hoje{background:#7c2d12;color:#fed7aa}
      html[data-theme=dark] .cobranca-panel .badge.vence_breve{background:#713f12;color:#fde68a}
      html[data-theme=dark] .cobranca-panel .badge.limite{background:#312e81;color:#c7d2fe}
      html[data-theme=dark] .cobranca-panel tr.vencida td:first-child{box-shadow:inset 3px 0 0 #ef4444}
      html[data-theme=dark] .cobranca-panel a.cob-nota,html[data-theme=dark] .cobranca-panel a.cob-cli{color:#e8c979}
    `;
    document.head.appendChild(s);
  };
  globalThis.BAGDA_PRAZO = { MIN, MAX, DEFAULT_DIAS, BREVE, addDays, daysBetween, classificar, labelClasse, optionsHtml, montar, installStyles, LABEL };
})();
