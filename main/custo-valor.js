/* Custo unitário atual (R$). Não mexe em preço de venda, estoque, compras nem notas. */
(function (root) {
  "use strict";
  const MAX = 99999999.99;
  function parseCusto(raw) {
    if (raw == null) return { error: "Informe o custo." };
    let s = String(raw).trim().replace(/\s/g, "").replace(/^R\$/i, "");
    if (!s) return { error: "Informe o custo." };
    if (s.includes(",") && s.includes(".")) {
      if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
      else s = s.replace(/,/g, "");
    } else if (s.includes(",")) s = s.replace(",", ".");
    if (!/^\d+(\.\d+)?$/.test(s)) return { error: "Custo inválido. Use um valor em reais, como 10,50." };
    const n = Number(s);
    if (!Number.isFinite(n)) return { error: "Custo inválido." };
    if (n < 0) return { error: "O custo não pode ser negativo." };
    const cents = Math.round(n * 100);
    if (Math.abs(n * 100 - cents) > 1e-6) return { error: "Use no máximo 2 casas decimais." };
    const value = cents / 100;
    if (value > MAX) return { error: "Custo alto demais." };
    return { value };
  }
  function sameCents(a, b) {
    return Number.isFinite(Number(a)) && Number.isFinite(Number(b)) && Math.round(Number(a) * 100) === Math.round(Number(b) * 100);
  }
  root.BAGDA_CUSTO = { parseCusto, sameCents };
})(typeof globalThis !== "undefined" ? globalThis : this);
