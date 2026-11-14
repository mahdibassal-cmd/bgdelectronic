/* Nova nota, forma PIX: Local do pagamento é a caixa (pelo id), com o nome atual da tabela. */
(() => {
  "use strict";
  // Order is the order of the dropdown. Ids are caixas.id, not a stored label.
  const IDS = [15, 2, 3, 14, 13];
  // Used only when the caixas list has no row for that id (vendedor antes do RPC, ou demo).
  const FALLBACK = {
    15: "PRESTIGE ROSA",
    2: "Caixa PIX (HX)",
    3: "Máquina Loja",
    14: "CAIXA S2",
    13: "PRIME"
  };
  // Notas antigas guardam o rótulo, não o nome da caixa. PRESTIGE AURA é a caixa 15.
  const LEGACY = {
    "HX": 2,
    "MAQUINA": 3,
    "CAIXA S2": 14,
    "PRESTIGE AURA": 15,
    "PRESTIGE ROSA": 15,
    "PRIME": 13,
    "Caixa PIX (HX)": 2,
    "Máquina Loja": 3
  };
  const idOf = c => Number(c.caixa_id != null ? c.caixa_id : c.id);
  const nomeDe = (caixas, id) => {
    const row = (caixas || []).find(c => idOf(c) === id && c.nome);
    return row ? String(row.nome) : FALLBACK[id];
  };
  const opcoes = (caixas, isAdmin) => {
    const opts = IDS.map(id => {
      const nome = nomeDe(caixas, id);
      return { id, value: nome, label: nome };
    });
    if (isAdmin) opts.push({ id: null, value: "CAIXA ESPECIAL", label: "CAIXA ESPECIAL", admin: true });
    return opts;
  };
  // True when every paid-now part is PIX (Paga Depois does not count). Split with another method is not PIX-only.
  const soPix = pags => {
    const rows = (pags || []).filter(g => g && g.metodo && g.metodo !== "prazo" && ((pags || []).length === 1 || +g.valor > 0));
    return rows.length > 0 && rows.every(g => g.metodo === "pix");
  };
  const caixaId = (local, caixas) => {
    if (!local || local === "CAIXA ESPECIAL" || local === "BITLOG CONTAINER" || local === "CAIXA GERAL" || local === "DINHEIRO") return null;
    for (const id of IDS) if (nomeDe(caixas, id) === local) return id;
    return LEGACY[local] || null;
  };
  // Same shape lancar_nota_caixa writes, and cancelar_nota_financas reverses (forma copiada).
  const lancar = (local, caixas, pagamentos) => {
    const id = caixaId(local, caixas);
    if (!id) return [];
    return (pagamentos || []).filter(g => g && g.metodo !== "prazo" && g.metodo !== "credito" && +g.valor > 0).map(g => ({
      caixa_id: id, tipo: "venda", forma: g.metodo, valor: Math.round(+g.valor * 100) / 100
    }));
  };
  const estornar = movs => (movs || []).filter(m => m && m.tipo === "venda" && +m.valor > 0).map(m => ({
    caixa_id: m.caixa_id, tipo: "estorno", forma: m.forma, valor: m.valor
  }));
  const valores = (caixas, isAdmin) => opcoes(caixas, !!isAdmin).map(o => o.value);
  globalThis.BAGDA_PIX_LOCAIS = { IDS, FALLBACK, LEGACY, nomeDe, opcoes, soPix, caixaId, lancar, estornar, valores };
})();
