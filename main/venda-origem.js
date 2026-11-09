/* Origem da venda: Principal (estoque da loja) ou Especial (Depósito Especial).
   Não transfere estoque. Cada linha usa só a origem escolhida. */
(function (root) {
  "use strict";
  function origemOf(item) {
    return item && item.origem === "especial" ? "especial" : "principal";
  }
  function origemLabel(origem) {
    return origemOf({ origem }) === "especial" ? "Especial" : "Principal";
  }
  function reserved(items, sku, origem) {
    const want = origemOf({ origem });
    return (items || []).filter(x => x.sku === sku && origemOf(x) === want).reduce((a, x) => a + (Number(x.qtd) || 0), 0);
  }
  function available(estoqueLoja, estoqueEspecial, origem) {
    const n = Number(origemOf({ origem }) === "especial" ? estoqueEspecial : estoqueLoja);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
  function checkQty(estoqueLoja, estoqueEspecial, items, sku, origem, qtd) {
    const o = origemOf({ origem });
    const have = available(estoqueLoja, estoqueEspecial, o);
    const ja = reserved(items, sku, o);
    const q = Number(qtd) || 0;
    return { origem: o, have, ja, ok: Number.isInteger(q) && q >= 1 && q + ja <= have };
  }
  root.BAGDA_VENDA_ORIGEM = { origemOf, origemLabel, reserved, available, checkQty };
})(typeof globalThis !== "undefined" ? globalThis : this);
