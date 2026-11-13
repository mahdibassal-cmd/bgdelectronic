/* Origem do preço (Nacional / Importado) e a regra ,99.
   Nacional: o preço em R$ é o digitado e a cotação não mexe nele.
   Importado: venda em R$ = preço US$ × cotação, arredondado ao real (half away from zero)
   e depois − R$ 0,01. Se esse ,99 ficar abaixo do custo em R$, fica o valor redondo.
   Ex.: 100,00 → 99,99. O servidor (preco_reais_importado) é quem grava; isto é a mesma conta. */
(function (root) {
  "use strict";
  const USD_MAX = 999999.99;
  const COT_MAX = 999;
  function unitsOf(n, scale) {
    if (typeof n === "number" && !Number.isFinite(n)) return null;
    const raw = String(n).trim();
    if (!raw || /e/i.test(raw)) return null;
    const neg = raw.startsWith("-");
    const s = neg ? raw.slice(1) : raw;
    if (!/^\d+(\.\d+)?$/.test(s)) return null;
    const [a, b = ""] = s.split(".");
    if (b.length > scale) return null;
    const units = Number(a + b.padEnd(scale, "0"));
    if (!Number.isSafeInteger(units)) return null;
    return neg ? -units : units;
  }
  function fromUnits(units, scale) {
    const neg = units < 0;
    const s = String(Math.abs(units)).padStart(scale + 1, "0");
    const cut = s.length - scale;
    const value = Number((neg ? "-" : "") + s.slice(0, cut) + "." + s.slice(cut));
    return value;
  }
  function normMoney(raw) {
    if (raw == null) return "";
    let s = String(raw).trim().replace(/\s/g, "").replace(/^(R\$|US\$)/i, "");
    if (!s) return "";
    if (s.includes(",") && s.includes(".")) {
      if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
      else s = s.replace(/,/g, "");
    } else if (s.includes(",")) s = s.replace(",", ".");
    return s;
  }
  function parseScaled(raw, scale, label, max, allowZero) {
    const s = normMoney(raw);
    if (!s) return { error: "Informe " + label + "." };
    if (!/^\d+(\.\d+)?$/.test(s)) return { error: label + " inválido." };
    const [a, b = ""] = s.split(".");
    if (b.length > scale) return { error: "Use no máximo " + scale + " casas decimais." };
    const units = Number(a + b.padEnd(scale, "0"));
    if (!Number.isSafeInteger(units)) return { error: label + " alto demais." };
    const value = fromUnits(units, scale);
    if (value < 0 || (!allowZero && value <= 0)) return { error: label + " precisa ser maior que zero." };
    if (allowZero && value < 0) return { error: label + " não pode ser negativo." };
    if (value > max) return { error: label + " alto demais." };
    return { value };
  }
  function parseUsd(raw) { return parseScaled(raw, 2, "o preço em US$", USD_MAX, false); }
  function parseCustoUsd(raw) {
    if (raw == null || String(raw).trim() === "") return { value: null };
    return parseScaled(raw, 2, "o custo em US$", USD_MAX, true);
  }
  function parseCotacao(raw) { return parseScaled(raw, 4, "a cotação", COT_MAX, false); }
  function precoReaisImportado(precoUsd, cotacao, custoReais) {
    const usd = unitsOf(precoUsd, 2);
    const rate = unitsOf(cotacao, 4);
    if (usd == null || usd <= 0) return { error: "Informe o preço em US$ (maior que zero, até 2 casas)." };
    if (rate == null || rate <= 0) return { error: "Defina a cotação do dólar antes de lançar produto importado." };
    const micro = usd * rate;
    const div = 1000000;
    let redondo = Math.trunc(micro / div);
    const rem = micro % div;
    if (rem * 2 >= div) redondo += 1;
    if (redondo > 99999999) return { error: "Preço em R$ alto demais." };
    const charmCents = redondo * 100 - 1;
    let costCents = null;
    if (custoReais != null && custoReais !== "") {
      costCents = unitsOf(custoReais, 2);
      if (costCents == null || costCents < 0) return { error: "Custo em R$ inválido." };
    }
    if (charmCents < 0 || (costCents != null && charmCents < costCents)) return { redondo, preco: redondo, aplicado99: false };
    return { redondo, preco: fromUnits(charmCents, 2), aplicado99: true };
  }
  function custoReaisDeUsd(custoUsd, cotacao) {
    const usd = unitsOf(custoUsd, 2);
    const rate = unitsOf(cotacao, 4);
    if (usd == null || usd < 0) return { error: "Custo em US$ inválido." };
    if (rate == null || rate <= 0) return { error: "Defina a cotação do dólar antes de converter o custo." };
    const micro = usd * rate;
    const div = 10000;
    let cents = Math.trunc(micro / div);
    const rem = micro % div;
    if (rem * 2 >= div) cents += 1;
    if (cents > 9999999999) return { error: "Custo em R$ alto demais." };
    return { value: fromUnits(cents, 2) };
  }
  function aplicarLinha(product, item, cotacao) {
    const next = Object.assign({}, product);
    if (item.origem == null || item.origem === "") return { product: next };
    if (item.origem === "Nacional") { next.origem = "Nacional"; return { product: next }; }
    if (item.origem !== "Importado") return { error: "Origem inválida." };
    next.origem = "Importado";
    if (next.preco_usd == null || next.preco_usd === "") return { product: next };
    const calc = precoReaisImportado(next.preco_usd, cotacao, item.custo_reais);
    if (calc.error) return calc;
    next.preco_venda = calc.preco;
    return { product: next, aplicado99: calc.aplicado99, redondo: calc.redondo };
  }
  function recalcularImportados(products, custos, cotacao) {
    return products.map(p => {
      if (p.origem !== "Importado") return Object.assign({}, p);
      if (p.preco_usd == null || p.preco_usd === "") return Object.assign({}, p);
      const calc = precoReaisImportado(p.preco_usd, cotacao, custos ? custos[p.sku] : null);
      if (calc.error) return Object.assign({}, p, { error: calc.error });
      return Object.assign({}, p, { preco_venda: calc.preco });
    });
  }
  /* Cotação geral: Importado com custo_usd ganha custo R$ = custo_usd × cotação (sem ,99).
     O preço de gôndola usa esse custo novo no piso. Nacional não muda. */
  function aplicarCotacao(products, costs, cotacao) {
    const nextCosts = {};
    const nextProducts = products.map(p => {
      const c = Object.assign({ custo: null, custo_usd: null }, costs ? costs[p.sku] : null);
      if (p.origem !== "Importado") { nextCosts[p.sku] = c; return Object.assign({}, p); }
      let custo = c.custo;
      if (c.custo_usd != null && c.custo_usd !== "") {
        const conv = custoReaisDeUsd(c.custo_usd, cotacao);
        if (conv.error) { nextCosts[p.sku] = c; return Object.assign({}, p, { error: conv.error }); }
        custo = conv.value;
      }
      nextCosts[p.sku] = Object.assign({}, c, { custo: custo });
      if (p.preco_usd == null || p.preco_usd === "") return Object.assign({}, p);
      const calc = precoReaisImportado(p.preco_usd, cotacao, custo != null && custo !== "" ? custo : null);
      if (calc.error) return Object.assign({}, p, { error: calc.error });
      return Object.assign({}, p, { preco_venda: calc.preco });
    });
    return { products: nextProducts, costs: nextCosts };
  }
  function formatUsd(v) {
    return "US$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function formatCotacao(v) {
    return "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  }
  root.BAGDA_ORIGEM = {
    parseUsd, parseCustoUsd, parseCotacao, precoReaisImportado, custoReaisDeUsd,
    aplicarLinha, recalcularImportados, aplicarCotacao, formatUsd, formatCotacao, unitsOf
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
