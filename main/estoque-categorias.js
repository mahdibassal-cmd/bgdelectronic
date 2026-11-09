/* Estoque da loja principal: família e tipo só para filtrar a tela.
   Usa marca, produto, tamanho e SKU. Não grava produto e não lê custo.
   A família olfativa do catálogo público não está na linha de estoque
   (e parte dos perfumes nem tem família), então perfume agrupa pela marca. */
(function (root) {
  "use strict";
  const CATS = [
    { id: "games", label: "Games" },
    { id: "apple", label: "Apple" },
    { id: "xiaomi", label: "Xiaomi" },
    { id: "perfume", label: "Perfumes" },
    { id: "outros", label: "Outros" }
  ];
  const APPLE_SUBS = [
    { id: "iphones", label: "iPhones" },
    { id: "macbooks", label: "MacBooks" },
    { id: "watch", label: "Apple Watch" },
    { id: "airpods", label: "AirPods" },
    { id: "acessorios", label: "Acessórios" },
    { id: "outros", label: "Outros" }
  ];
  const GAME_SUBS = [
    { id: "consoles", label: "Consoles" },
    { id: "acessorios", label: "Acessórios" },
    { id: "jogos", label: "Jogos" },
    { id: "outros", label: "Outros" }
  ];
  const XIAOMI_SUBS = [
    { id: "celulares", label: "Celulares" },
    { id: "fones", label: "Fones" },
    { id: "relogios", label: "Relógios" },
    { id: "acessorios", label: "Acessórios" },
    { id: "outros", label: "Outros" }
  ];
  /* Marcas do catálogo público (perfumes/assets/app.js BRAND_ORDER + data.json)
     e das que só entram no estoque da loja (Hamidi, Al Haramain, prefixo do seed). */
  const PERFUME_BRANDS = [
    { id: "arabiyat", label: "Arabiyat Prestige", keys: ["arabiyat prestige", "arabiyat"] },
    { id: "armaf", label: "Armaf", keys: ["armaf"] },
    { id: "ferassa", label: "Ferassa", keys: ["ferassa"] },
    { id: "mpf", label: "MPF", keys: ["mpf"] },
    { id: "french-avenue", label: "French Avenue", keys: ["french avenue"] },
    { id: "paris-corner", label: "Paris Corner", keys: ["paris corner"] },
    { id: "ibq", label: "Ibraheem Al Qurashi", keys: ["ibraheem al qurashi", "ibrahim al qurashi", "ibraheem alqurashi"] },
    { id: "wataniah", label: "Al Wataniah", keys: ["al wataniah", "wataniah"] },
    { id: "rayhaan", label: "Rayhaan", keys: ["rayhaan", "rayhan"] },
    { id: "rasasi", label: "Rasasi", keys: ["rasasi"] },
    { id: "hamidi", label: "Hamidi", keys: ["hamidi"] },
    { id: "haramain", label: "Al Haramain", keys: ["al haramain", "haramain"] }
  ];
  const PERFUME_PREFIX = {
    ARA: "arabiyat", ARM: "armaf", FER: "ferassa", MPF: "mpf", FAV: "french-avenue",
    PCN: "paris-corner", IBQ: "ibq", WAT: "wataniah", RAY: "rayhaan", HAM: "hamidi", HAR: "haramain"
  };
  const PLACEHOLDER = new Set(["sem marca", "outros", "outras", "diversos", "diversas", "generico", "generica", "n a", "na", "s n", "sn", "original", "importado", "marca", "nenhuma", "nenhum", "nd", "sem", "nao informado", "nao informada"]);
  const SUBS = { apple: APPLE_SUBS, games: GAME_SUBS, xiaomi: XIAOMI_SUBS };

  const fold = s => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const norm = s => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pack = (cat, sub, subLabel) => ({ cat, sub: sub || "", subLabel: subLabel || "" });
  const outros = () => pack("outros", "", "");
  const perfumeOf = b => pack("perfume", b.id, b.label);
  const units = p => { const n = Number(p && p.estoque); return Number.isFinite(n) ? n : 0; };
  const nameColl = new Intl.Collator("pt-BR", { sensitivity: "base" });
  const inStock = p => units(p) > 0;
  const skuOf = p => String(p && p.sku || "").toUpperCase().replace(/\s+/g, "");

  function matchKey(marcaF, keys) {
    for (const k of keys) if (marcaF === k || marcaF.startsWith(k + " ")) return true;
    return false;
  }
  function perfumeBrandOf(marcaF) {
    if (!marcaF) return null;
    const keys = PERFUME_BRANDS.flatMap(b => b.keys.map(k => ({ k, b }))).sort((a, b) => b.k.length - a.k.length);
    for (const row of keys) if (matchKey(marcaF, [row.k])) return row.b;
    return null;
  }
  function perfumeBySku(sku) {
    const m = sku.match(/^([A-Z]{2,4})-/);
    if (!m || !PERFUME_PREFIX[m[1]]) return null;
    return PERFUME_BRANDS.find(b => b.id === PERFUME_PREFIX[m[1]]) || null;
  }
  function brandFallback(marca) {
    const label = String(marca ?? "").replace(/\s+/g, " ").trim();
    const id = fold(label).replace(/ /g, "-");
    if (!label || !id) return null;
    return { id: "m-" + id, label };
  }
  function isAppleMarca(marcaF) { return marcaF === "apple" || marcaF.startsWith("apple "); }
  function isXiaomiMarca(marcaF) { return /^(xiaomi|xaiomi|xiomi|redmi|poco|pocophone)(?: |$)/.test(marcaF); }
  function blocksApple(marcaF, text) {
    const h = `${marcaF} ${text}`.trim();
    if (/\b(?:nossa marca|x cell|xcell|generico|generica|replica|replicas|similar|paralelo|paralela)\b/.test(h)) return true;
    if (!isAppleMarca(marcaF) && /\bcompativ/.test(h)) return true;
    return false;
  }
  function isBeauty(marcaF, text, sku) {
    if (/^HSC-/.test(sku)) return true;
    const h = `${marcaF} ${text}`;
    if (/\b(?:hair|skin care|skincare|celimax)\b/.test(h)) return true;
    if (/\bfino\b/.test(marcaF) && /\b(?:hair|oil|oleo|smooth|premium)\b/.test(text)) return true;
    if (/\b(?:hair oil|serum|toner|ampoule|ampola|shampoo|condicionador)\b/.test(text)) return true;
    return false;
  }
  function isAppleAccessory(text) {
    return /\b(?:capa|capinha|case|pelicula|cabo|carregador|fonte|adaptador|adapter|suporte|pocket|pulseira|pencil|airtag|air tag|earpods|magsafe|power bank|protetor|fone|fones|teclado|mouse)\b/.test(text);
  }
  function isXiaomiAccessory(text) {
    return /\b(?:capa|capinha|case|pelicula|cabo|carregador|fonte|adaptador|adapter|suporte|power bank|protetor|pelicula)\b/.test(text);
  }
  function appleSub(text) {
    if (isAppleAccessory(text)) return pack("apple", "acessorios", "Acessórios");
    if (/\biphones?\b|\bi phones?\b/.test(text)) return pack("apple", "iphones", "iPhones");
    if (/\b(?:macbooks?|mac book)\b/.test(text)) return pack("apple", "macbooks", "MacBooks");
    if (/\b(?:apple watch|watch)\b/.test(text)) return pack("apple", "watch", "Apple Watch");
    if (/\b(?:airpods?|air pods?)\b/.test(text)) return pack("apple", "airpods", "AirPods");
    return pack("apple", "outros", "Outros");
  }
  function isAppleDevice(text) {
    return /\b(?:iphones?|i phones?|macbooks?|mac book|airpods?|air pods?|apple watch)\b/.test(text);
  }
  function xiaomiSub(text) {
    if (isXiaomiAccessory(text)) return pack("xiaomi", "acessorios", "Acessórios");
    if (/\b(?:buds|earbud|earbuds|fone|fones|headphone|headphones|earphone|earphones|auricular|auriculares)\b/.test(text)) return pack("xiaomi", "fones", "Fones");
    if (/\b(?:relogio|relogios|watch|smartband|mi band|pulseira)\b/.test(text)) return pack("xiaomi", "relogios", "Relógios");
    if (/\b(?:smartphone|celular|celulares|note|poco|pocophone|phone)\b/.test(text) || /\b(?:redmi|xiaomi|xaiomi)\s?\d/.test(text) || /\bmi\s?\d{1,2}\b/.test(text)) return pack("xiaomi", "celulares", "Celulares");
    return pack("xiaomi", "outros", "Outros");
  }
  function isXiaomiName(text) { return /\b(?:xiaomi|xaiomi|xiomi|redmi|poco|pocophone)\b/.test(text); }
  function isGameMarca(marcaF, text) {
    if (/\b(?:nintendo|playstation|xbox|hori|valve)\b/.test(marcaF)) return true;
    if (/\bsony\b/.test(marcaF) && /\b(?:playstation|ps5|ps4|ps3|dualsense|dualshock)\b/.test(text)) return true;
    if (/\bmicrosoft\b/.test(marcaF) && /\bxbox\b/.test(text)) return true;
    if (/\bmeta\b/.test(marcaF) && /\b(?:quest|oculus|vr)\b/.test(text)) return true;
    return false;
  }
  function mentionsPlatform(text) {
    return /\b(?:playstation|ps5|ps4|ps3|xbox|switch|nintendo|steam deck|steam|oculus)\b/.test(text) || (/\bquest\b/.test(text) && /\b(?:meta|oculus|vr)\b/.test(text));
  }
  function isConsoleName(name) {
    if (/\b(?:jogo|jogos)\b/.test(name)) return false;
    const hardware = /\b(?:playstation|ps5|ps4|ps3|xbox|steam deck|oculus)\b/.test(name)
      || (/\bswitch\b/.test(name) && /\b(?:oled|lite|neon|nintendo|console)\b/.test(name))
      || (/\bnintendo\b/.test(name) && /\bswitch\b/.test(name))
      || (/\bquest\b/.test(name) && /\b(?:meta|oculus|vr)\b/.test(name));
    if (!hardware) return false;
    const rest = name
      .replace(/\b(?:playstation|ps5|ps4|ps3|xbox|series|one|steam|deck|oculus|quest|vr|meta|nintendo|switch|oled|lite|neon|console|digital|slim|pro|fat|gb|tb|fixture|nova|novo|new|branco|preto|azul|vermelho|cinza|prata|dourado|rosa|sky|blue|red|white|black)\b/g, " ")
      .replace(/\b\d+\b/g, " ")
      .replace(/\b[a-z]\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return rest.length === 0;
  }
  function isGameAccessory(text) {
    return /\bgamer\b/.test(text) || /\b(?:controle|controler|controller|joystick|gamepad|joy con|joycon|dualsense|dualshock|volante|headset|mouse ?pad|kit gamer|split pad|grip|dock|comando|capa|capinha|pelicula|carregador|cabo|fonte|suporte)\b/.test(text);
  }
  function isGameText(name, size) {
    const all = `${name} ${size}`.trim();
    if (/\b(?:playstation|ps5|ps4|ps3|xbox|nintendo|joy con|joycon|dualsense|dualshock|steam deck|oculus|gamepad|joystick|split pad)\b/.test(all)) return true;
    if (/\bswitch\b/.test(all) && /\b(?:oled|lite|neon|nintendo|console)\b/.test(all)) return true;
    if (/\bgamer\b/.test(all) || /\b(?:jogo|jogos)\b/.test(name) || /\bconsole\b/.test(name)) return true;
    if (/\bquest\b/.test(all) && /\b(?:meta|oculus|vr)\b/.test(all)) return true;
    return false;
  }
  function gameSub(produto, tamanho, marca) {
    const name = fold(produto);
    const size = fold(tamanho);
    const all = `${name} ${size}`.trim();
    if (isConsoleName(`${fold(marca)} ${name}`.trim())) return pack("games", "consoles", "Consoles");
    if (isGameAccessory(all)) return pack("games", "acessorios", "Acessórios");
    if (/\b(?:jogo|jogos)\b/.test(name) || mentionsPlatform(name) || mentionsPlatform(size)) return pack("games", "jogos", "Jogos");
    return pack("games", "outros", "Outros");
  }
  function isPerfumeText(text) {
    return /\b(?:perfume|perfumes|parfum|parfums|fragrancia|fragrancias|extrait|decant|decants|attar|oud)\b/.test(text) || /\beau de\b/.test(text);
  }

  function classify(p) {
    if (!p || typeof p !== "object") return outros();
    const marcaF = fold(p.marca);
    const name = fold(p.produto);
    const size = fold(p.tamanho);
    const text = `${name} ${size}`.trim();
    const sku = skuOf(p);
    const marcaKnown = !!(marcaF && !PLACEHOLDER.has(marcaF));
    if (isBeauty(marcaF, text, sku)) return outros();
    if (isAppleMarca(marcaF) && !blocksApple(marcaF, text)) return appleSub(text);
    if (isXiaomiMarca(marcaF)) return xiaomiSub(text);
    const pb = perfumeBrandOf(marcaF);
    if (pb) return perfumeOf(pb);
    if (isGameMarca(marcaF, text)) return gameSub(p.produto, p.tamanho, p.marca);
    if (!blocksApple(marcaF, text) && (!marcaKnown || isAppleMarca(marcaF)) && /^(?:APL|BS-APL)-/.test(sku)) return appleSub(text);
    if ((!marcaKnown || isXiaomiMarca(marcaF)) && /^XIA-/.test(sku)) return xiaomiSub(text);
    if (!marcaKnown) {
      const bySku = perfumeBySku(sku);
      if (bySku) return perfumeOf(bySku);
    }
    if (!marcaKnown && !blocksApple(marcaF, text) && isAppleDevice(text) && !isAppleAccessory(text)) return appleSub(text);
    if (!marcaKnown && isXiaomiName(text) && !isXiaomiAccessory(text) && !/\bcompativ/.test(text)) return xiaomiSub(text);
    if (isGameText(name, size)) return gameSub(p.produto, p.tamanho, p.marca);
    if (isPerfumeText(text)) {
      const b = marcaKnown ? brandFallback(p.marca) : null;
      return b ? perfumeOf(b) : pack("perfume", "outros", "Outros");
    }
    return outros();
  }

  function matchProduct(p, q) {
    const h = norm(`${p.sku || ""} ${p.marca || ""} ${p.produto || ""} ${p.tamanho || ""}`);
    return norm(q).split(/\s+/).filter(Boolean).every(t => h.includes(t));
  }
  function filterList(list, state) {
    const cat = state && state.cat || "";
    const sub = state && state.sub || "";
    const q = state && state.q || "";
    return (list || []).filter(p => {
      if (!matchProduct(p, q)) return false;
      if (!cat) return true;
      const c = classify(p);
      if (c.cat !== cat) return false;
      return !sub || c.sub === sub;
    });
  }
  function byName(a, b) {
    return nameColl.compare(a.produto || "", b.produto || "") || nameColl.compare(a.marca || "", b.marca || "") || nameColl.compare(a.tamanho || "", b.tamanho || "") || nameColl.compare(String(a.sku || ""), String(b.sku || ""));
  }
  function orderForSale(list) {
    const rank = p => { const n = units(p); return n === 1 ? 0 : n > 1 ? 1 : 2; };
    return [...(list || [])].sort((a, b) => rank(a) - rank(b) || byName(a, b));
  }
  function saleSections(list) {
    const ordered = orderForSale(list);
    return {
      priority: ordered.filter(p => units(p) === 1),
      available: ordered.filter(p => units(p) > 1),
      missing: ordered.filter(p => !inStock(p))
    };
  }
  function tally(list) {
    const cats = {};
    let n = 0, u = 0, avail = 0, missing = 0;
    for (const p of list || []) {
      const c = classify(p);
      const un = units(p);
      const ok = un > 0;
      n++; u += un;
      if (ok) avail++; else missing++;
      const bucket = cats[c.cat] || (cats[c.cat] = { n: 0, avail: 0, units: 0, subs: {} });
      bucket.n++; bucket.units += un;
      if (ok) bucket.avail++;
      if (c.sub) {
        const s = bucket.subs[c.sub] || (bucket.subs[c.sub] = { n: 0, avail: 0, label: c.subLabel });
        s.n++;
        if (ok) s.avail++;
      }
    }
    return { total: n, units: u, avail, missing, cats };
  }
  function orderedSubs(cat, subs, active) {
    const show = id => (subs[id] && subs[id].n > 0) || id === active;
    const item = (id, label, src) => ({ id, label, n: (src && src.avail) || 0 });
    if (cat === "perfume") {
      const out = [];
      const known = new Set(PERFUME_BRANDS.map(b => b.id).concat(["outros"]));
      for (const b of PERFUME_BRANDS) if (show(b.id)) out.push(item(b.id, (subs[b.id] && subs[b.id].label) || b.label, subs[b.id]));
      for (const id of Object.keys(subs).filter(id => !known.has(id) && show(id)).sort((a, b) => String(subs[a].label).localeCompare(String(subs[b].label), "pt"))) out.push(item(id, subs[id].label, subs[id]));
      if (show("outros")) out.push(item("outros", "Outros", subs.outros));
      return out;
    }
    return (SUBS[cat] || []).filter(s => show(s.id)).map(s => item(s.id, s.label, subs[s.id]));
  }
  function chip(attr, id, n, on, label) {
    const zero = n === 0 ? " zero" : "";
    return `<button type="button" class="est-chip${on ? " on" : ""}${zero}" ${attr}="${esc(id)}" data-n="${n}" aria-pressed="${on ? "true" : "false"}" aria-label="${esc(label)}, ${n} produtos disponíveis">${esc(label)} <span class="est-n" aria-hidden="true">${n}</span></button>`;
  }
  function navHtml(list, state) {
    const cat = state && state.cat || "";
    const sub = state && state.sub || "";
    const tall = tally(list);
    const cats = [{ id: "", label: "Todos", n: tall.avail, catalog: tall.total }].concat(CATS.map(c => ({ id: c.id, label: c.label, n: (tall.cats[c.id] && tall.cats[c.id].avail) || 0, catalog: (tall.cats[c.id] && tall.cats[c.id].n) || 0 }))).filter(c => c.id === "" || c.catalog > 0 || c.id === cat);
    let html = `<div class="est-row" role="toolbar" aria-label="Categorias do estoque" data-row="cat">${cats.map(c => chip("data-cat", c.id, c.n, c.id === cat, c.label)).join("")}</div>`;
    if (cat && SUBS[cat] || cat === "perfume") {
      const bucket = tall.cats[cat] || { n: 0, avail: 0, subs: {} };
      const subs = [{ id: "", label: "Todos", n: bucket.avail }].concat(orderedSubs(cat, bucket.subs, sub));
      const catLabel = (CATS.find(c => c.id === cat) || {}).label || cat;
      if (subs.length > 1) html += `<div class="est-row est-sub" role="toolbar" aria-label="Tipos em ${esc(catLabel)}" data-row="sub">${subs.map(s => chip("data-sub", s.id, s.n, s.id === sub, s.label)).join("")}</div>`;
    }
    return html;
  }
  function countsOf(list) {
    const t = tally(list);
    return { avail: t.avail, missing: t.missing, units: t.units, catalog: t.total };
  }
  function summaryText(view, search, all) {
    const line = s => `${s.avail} produtos disponíveis · ${s.missing} sem estoque · ${s.units} un.`;
    const same = (a, b) => a && b && a.avail === b.avail && a.missing === b.missing && a.units === b.units;
    if (!all || same(view, all)) return line(view);
    const full = `lista da tela: ${all.avail} disponíveis, ${all.missing} sem estoque, ${all.units} un.`;
    if (!search || same(view, search)) return `Na busca: ${line(view)} · ${full}`;
    if (same(search, all)) return `Neste filtro: ${line(view)} · ${full}`;
    return `Neste filtro: ${line(view)} · na busca: ${search.avail} disponíveis, ${search.missing} sem estoque, ${search.units} un. · ${full}`;
  }
  function nextChipIndex(len, i, key) {
    if (!(len > 0) || i < 0 || i >= len) return -1;
    if (key === "ArrowRight" || key === "ArrowDown") return (i + 1) % len;
    if (key === "ArrowLeft" || key === "ArrowUp") return (i - 1 + len) % len;
    if (key === "Home") return 0;
    if (key === "End") return len - 1;
    return -1;
  }
  function onToolbarKey(e) {
    const row = e.target && e.target.closest && e.target.closest("[data-row]");
    const btn = e.target && e.target.closest && e.target.closest("button.est-chip");
    if (!row || !btn || btn.parentElement !== row && !row.contains(btn)) return false;
    const btns = [...row.querySelectorAll("button.est-chip")];
    const n = nextChipIndex(btns.length, btns.indexOf(btn), e.key);
    if (n < 0) return false;
    e.preventDefault();
    btns[n].focus();
    return true;
  }
  function previewFixtures() {
    const row = (sku, marca, produto, tamanho, estoque, preco) => ({ sku, marca, produto, tamanho, estoque, estoque_minimo: 2, preco_venda: preco, ativo: true });
    return [
      row("FX-APL-18A", "Apple", "iPhone 18 Pro Max FIXTURE", "Azul", 1, 9999),
      row("FX-APL-18P", "Apple", "iPhone 18 Pro Max FIXTURE", "Preto", 20, 9999),
      row("FX-APL-18Z", "Apple", "iPhone 18 Pro Max FIXTURE", "Branco", 0, 9999),
      row("FX-APL-NG", "Apple", "iPhone 16 FIXTURE", "Preto", -1, 7999),
      row("FX-APL-IP", "Ápple", "Íphone 15 FIXTURE", "128GB", 3, 4999),
      row("FX-APL-MB", "Apple", "MacBook Air FIXTURE", "13 pol", 1, 8999),
      row("FX-APL-AW", "Apple", "Watch Series 9 FIXTURE", "45mm", 2, 3499),
      row("FX-APL-PD", "Apple", "AirPods Pro FIXTURE", null, 4, 1899),
      row("FX-APL-CB", "Apple", "Cabo USB-C FIXTURE", "1m", 10, 149),
      row("FX-APL-PD2", "Apple", "iPad FIXTURE", "64GB", 1, 4299),
      row("FX-XIA-NT", "Xiáomi", "Redmi Note 13 FIXTURE", "256GB", 2, 1599),
      row("FX-XIA-BD", "Xaiomi", "Redmi Buds FIXTURE", null, 5, 199),
      row("FX-XIA-WA", "Xiaomi", "Redmi Watch FIXTURE", null, 1, 699),
      row("FX-XIA-CR", "Poco", "Carregador 33W FIXTURE", null, 6, 89),
      row("FX-GAM-SW", "Nintendo", "Switch OLED FIXTURE", "Neon", 2, 2200),
      row("FX-GAM-HR", "Hori", "Split Pad Pro FIXTURE", "Switch", 3, 297),
      row("FX-GAM-JW", "Sony", "God of War FIXTURE", "PS5", 1, 249),
      row("FX-PF-AR", "Armaf", "Club de Nuit FIXTURE", "105ml", 4, 200),
      row("FX-PF-RY", "Rayhan", "Pacific FIXTURE", "100ml", 1, 190),
      row("FX-PF-LT", "Lattafa", "Parfum Yara FIXTURE", "100ml", 2, 180),
      row("FX-PF-OD", "", "Oud FIXTURE", "100ml", 1, 150),
      row("FX-GEN-CB", "Baseus", "Cabo compatível com iPhone FIXTURE", "1m", 8, 49),
      row("FX-GEN-TG", "", "Rastreador compatível com iPhone FIXTURE", null, 2, 55),
      row("FX-GEN-AT", "X-Cell", "Airtag nossa marca FIXTURE", null, 7, 33),
      row("FX-BEA-FN", "Hair & Skin Care", "Fino Hair Oil FIXTURE", "70ml", 3, 99),
      row("FX-AUD-JB", "JBL", "Flip 6 FIXTURE", "Azul", 0, 799)
    ];
  }

  root.BAGDA_ESTOQUE_CATS = {
    fold, norm, classify, matchProduct, filterList, tally, countsOf, orderForSale, saleSections, navHtml, summaryText, nextChipIndex, onToolbarKey, previewFixtures,
    CATS, APPLE_SUBS, GAME_SUBS, XIAOMI_SUBS, PERFUME_BRANDS
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
