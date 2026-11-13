/* Filtro de categorias do Estoque da loja principal. Não altera estoque nem custo. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const dir = dirname(fileURLToPath(import.meta.url));
const read = name => readFileSync(join(dir, name), "utf8");
const sandbox = {};
runInNewContext(read("estoque-categorias.js"), sandbox, { filename: "estoque-categorias.js" });
const EC = sandbox.BAGDA_ESTOQUE_CATS;
let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.error("FAIL", m); } else console.log("ok", m); };
const sku = p => p.sku;
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

ok(EC && typeof EC.classify === "function", "classifier loaded");

const demo = [
  ["JBL-001", "JBL", "Flip 6", "Azul", "outros", ""],
  ["JBL-002", "JBL", "Go 4", "Preto", "outros", ""],
  ["XIA-002", "Xiaomi", "Redmi Note 13", "128GB", "xiaomi", "celulares"],
  ["XIA-001", "Xiaomi", "Redmi Buds 5", null, "xiaomi", "fones"],
  ["SAM-001", "Samsung", "Galaxy A15", "128GB", "outros", ""],
  ["APL-001", "Apple", "AirPods 4", null, "apple", "airpods"],
  ["BAS-001", "Baseus", "Cabo USB-C 1m", null, "outros", ""],
  ["BAS-002", "Baseus", "Carregador 30W", null, "outros", ""],
  ["ANK-001", "Anker", "Power Bank 10000mAh", null, "outros", ""],
  ["LEN-001", "Lenovo", "Fone LP40", null, "outros", ""],
  ["MUL-001", "Multilaser", "Mouse sem fio", null, "outros", ""],
  ["KAP-001", "Kapbom", "Suporte veicular", null, "outros", ""],
  ["BS-APL-270", "Apple", "iPhone 18 Duo (iPhone Duo)", "256GB", "apple", "iphones"],
  ["BS-APL-280", "Apple", "MacBook Air M5", "13 pol", "apple", "macbooks"]
].map(([sku, marca, produto, tamanho, cat, sub], i) => ({ sku, marca, produto, tamanho, cat, sub, estoque: i, preco_venda: 10, custo: 4 }));

const catalog = [
  ["FER-001", "Ferassa", "Jamra", "100ml", "perfume", "ferassa"],
  ["ARM-004", "Armaf", "Club de Nuit Intense Man", "105ml", "perfume", "armaf"],
  ["ARA-023", "Arabiyat Prestige", "Marwa", "100ml", "perfume", "arabiyat"],
  ["MPF-001", "MPF", "Strength in Amber", "100ml", "perfume", "mpf"],
  ["FAV-001", "French Avenue", "Aether Extrait", "100ml", "perfume", "french-avenue"],
  ["PCN-001", "Paris Corner", "Khair Pistachio", "100ml", "perfume", "paris-corner"],
  ["IBQ-001", "IBRAHEEM AL QURASHI", "Arabian Tobacco", "100ml", "perfume", "ibq"],
  ["WAT-001", "Al Wataniah", "Atter al Wesal Gold", "100ml", "perfume", "wataniah"],
  ["RAY-001", "Rayhan", "Pacific Tropical Vibe", "100ml", "perfume", "rayhaan"],
  ["RAY-002", "Rayhaan", "Pacific Tropical Vibe", "100ml", "perfume", "rayhaan"],
  ["HAM-001", "Hamidi", "Sundown", "100ml", "perfume", "hamidi"],
  ["HAR-001", "Al Haramain", "Amber Oud Gold Extreme", "100ml", "perfume", "haramain"],
  ["HSC-001", "Hair & Skin Care", "Fino Hair Oil", "70ml", "outros", ""],
  ["HSC-003", "Hair & Skin Care", "Celimax Retinal Shot", "15ml", "outros", ""],
  ["ARM-ACC", "Ármaf", "Club de Nuit", "100ml", "perfume", "armaf"],
  ["FER-SKU", "", "Sem nome de marca", "100ml", "perfume", "ferassa"],
  ["LAT-001", "Lattafa", "Parfum Yara", "100ml", "perfume", "m-lattafa"],
  ["OUD-001", "", "Oud", "100ml", "perfume", "outros"],
  ["GEN-IP", "Baseus", "Cabo compatível com iPhone", "1m", "outros", ""],
  ["GEN-TG", "", "Rastreador compatível com iPhone", null, "outros", ""],
  ["GEN-AT", "X-Cell", "Airtag (nossa marca)", null, "outros", ""],
  ["GEN-CP", "", "Capa para iPhone 15", null, "outros", ""],
  ["APL-CAP", "Apple", "Capa iPhone 15", null, "apple", "acessorios"],
  ["APL-PK", "Apple", "iPhone Pocket", "80cm", "apple", "acessorios"],
  ["APL-FN", "Apple", "Fone USB-C com fio", null, "apple", "acessorios"],
  ["APL-IP", "", "iPhone 15 Pro", "256GB", "apple", "iphones"],
  ["APL-AW", "Apple", "Apple Watch Ultra", "49mm", "apple", "watch"],
  ["APL-PD", "Apple", "iPad Air", "64GB", "apple", "outros"],
  ["XIA-MS", "Xaiomi", "Redmi Note 12", "128GB", "xiaomi", "celulares"],
  ["XIA-AC", "Xiáomi", "Redmi Buds 4", null, "xiaomi", "fones"],
  ["XIA-WA", "Redmi", "Redmi Watch 4", null, "xiaomi", "relogios"],
  ["XIA-PC", "Poco", "Poco X6", "256GB", "xiaomi", "celulares"],
  ["XIA-CR", "Xiaomi", "Carregador 33W", null, "xiaomi", "acessorios"],
  ["GEN-RD", "", "Capa Redmi Note", null, "outros", ""],
  ["GAM-SW", "Nintendo", "Switch OLED", "Neon", "games", "consoles"],
  ["GAM-HR", "Hori", "Split Pad Pro ergonômico para Nintendo Switch", null, "games", "acessorios"],
  ["GAM-MP", "", "Mouse Pad Gamer RGB", null, "games", "acessorios"],
  ["GAM-JW", "Sony", "God of War", "PS5", "games", "jogos"],
  ["GAM-QS", "Meta", "Quest 3", null, "games", "consoles"],
  ["GAM-MK", "Nintendo", "Mario Kart", null, "games", "outros"],
  ["AUD-SN", "Sony", "WH-1000XM5", null, "outros", ""],
  ["SKU-XIA", "", "Sem marca no cadastro", null, "xiaomi", "outros"],
  ["SKU-APL", "", "iPhone 13", "128GB", "apple", "iphones"],
  ["SKU-ARM", "Armaf", "Gossip Homme", "100ml", "perfume", "armaf"]
].map(([code, marca, produto, tamanho, cat, sub], i) => ({ sku: code === "FER-SKU" ? "FER-009" : code === "SKU-XIA" ? "XIA-009" : code === "SKU-APL" ? "APL-009" : code === "SKU-ARM" ? "APL-008" : code, marca, produto, tamanho, cat, sub, estoque: i % 5, preco_venda: 20 }));

function expectRow(p) {
  const c = EC.classify(p);
  ok(c.cat === p.cat && c.sub === p.sub, `${p.sku} ${p.marca} ${p.produto} → ${c.cat}/${c.sub} (esperado ${p.cat}/${p.sub})`);
}
for (const p of demo) expectRow(p);
for (const p of catalog) expectRow(p);

const fx = EC.previewFixtures();
ok(fx.length > 0 && fx.every(p => String(p.produto).includes("FIXTURE")), "fixtures are labeled FIXTURE");
ok(fx.every(p => !Object.prototype.hasOwnProperty.call(p, "custo")), "fixtures have no cost field");
ok(new Set(fx.map(sku)).size === fx.length, "fixture skus unique");
const fxExpect = {
  "FX-APL-18A": ["apple", "iphones"], "FX-APL-18P": ["apple", "iphones"], "FX-APL-18Z": ["apple", "iphones"], "FX-APL-NG": ["apple", "iphones"],
  "FX-APL-IP": ["apple", "iphones"], "FX-APL-MB": ["apple", "macbooks"], "FX-APL-AW": ["apple", "watch"],
  "FX-APL-PD": ["apple", "airpods"], "FX-APL-CB": ["apple", "acessorios"], "FX-APL-PD2": ["apple", "outros"],
  "FX-XIA-NT": ["xiaomi", "celulares"], "FX-XIA-BD": ["xiaomi", "fones"], "FX-XIA-WA": ["xiaomi", "relogios"],
  "FX-XIA-CR": ["xiaomi", "acessorios"], "FX-GAM-SW": ["games", "consoles"], "FX-GAM-HR": ["games", "acessorios"],
  "FX-GAM-JW": ["games", "jogos"], "FX-PF-AR": ["perfume", "armaf"], "FX-PF-RY": ["perfume", "rayhaan"],
  "FX-PF-LT": ["perfume", "m-lattafa"], "FX-PF-OD": ["perfume", "outros"], "FX-GEN-CB": ["outros", ""],
  "FX-GEN-TG": ["outros", ""], "FX-GEN-AT": ["outros", ""], "FX-BEA-FN": ["outros", ""], "FX-AUD-JB": ["outros", ""]
};
for (const p of fx) {
  const c = EC.classify(p);
  const want = fxExpect[p.sku];
  ok(want && c.cat === want[0] && c.sub === want[1], `fixture ${p.sku} → ${c.cat}/${c.sub}`);
}

const all = demo.concat(catalog, fx);
const frozen = all.map(p => ({ ...p }));
const before = JSON.stringify(frozen);
for (const p of frozen) EC.classify(p);
ok(JSON.stringify(frozen) === before, "classify does not mutate stock, price, or cost");
ok(!JSON.stringify(EC.navHtml(frozen, { cat: "apple", sub: "iphones" })).toLowerCase().includes("custo"), "nav does not render cost");
ok(!EC.navHtml(frozen, {}).includes("preco_venda"), "nav does not render sale price");

const tall = EC.tally(all);
ok(tall.total === all.length, `every product counted ${tall.total} = ${all.length}`);
const catSum = Object.values(tall.cats).reduce((a, c) => a + c.n, 0);
const unitSum = Object.values(tall.cats).reduce((a, c) => a + c.units, 0);
const stockSum = all.reduce((a, p) => a + Number(p.estoque), 0);
ok(catSum === all.length && unitSum === stockSum && tall.units === stockSum, `totals reconcile products ${catSum} units ${unitSum}`);
const seen = new Map();
for (const p of all) {
  const c = EC.classify(p);
  const hit = EC.filterList(all, { cat: c.cat, sub: c.sub });
  ok(hit.some(x => x.sku === p.sku && x.produto === p.produto), `${p.sku} stays reachable in ${c.cat}/${c.sub || "todos"}`);
  seen.set(p.sku + "|" + p.produto, (seen.get(p.sku + "|" + p.produto) || 0) + 1);
}
ok([...seen.values()].every(n => n === 1), "no duplicate assignment while scanning");
for (const cat of ["games", "apple", "xiaomi", "perfume"]) {
  const bucket = tall.cats[cat];
  if (!bucket) continue;
  const subN = Object.values(bucket.subs).reduce((a, s) => a + s.n, 0);
  ok(subN === bucket.n && EC.filterList(all, { cat }).length === bucket.n, `${cat} subcategory counts ${subN} = ${bucket.n}`);
}
ok(EC.filterList(all, {}).length === all.length, "Todos returns every product");
ok(EC.filterList(all, { cat: "outros" }).length === (tall.cats.outros ? tall.cats.outros.n : 0), "Outros is the only leftover bucket");
const parts = ["games", "apple", "xiaomi", "perfume", "outros"].flatMap(cat => EC.filterList(all, { cat }));
ok(parts.length === all.length, "category partitions cover the list");

const q = "cabo";
const matched = all.filter(p => EC.matchProduct(p, q));
const searched = ["games", "apple", "xiaomi", "perfume", "outros"].flatMap(cat => EC.filterList(all, { cat, q }));
ok(searched.length === matched.length && matched.length >= 2, `search partitions reconcile ${searched.length} = ${matched.length}`);
const appleCabo = EC.filterList(all, { cat: "apple", q });
const resetCabo = EC.filterList(all, { cat: "", sub: "", q });
ok(appleCabo.every(p => resetCabo.some(x => x.sku === p.sku)) && appleCabo.length < resetCabo.length, "reset category keeps the search and brings the other cabos back");
ok(appleCabo.every(p => EC.classify(p).cat === "apple") && resetCabo.some(p => p.marca === "Baseus"), "Apple search does not absorb the Baseus cable");
ok(EC.filterList(all, { cat: "xiaomi", sub: "celulares", q: "buds" }).length === 0, "buds are not inside Xiaomi phones");
const buds = EC.filterList(all, { cat: "xiaomi", sub: "fones", q: "buds" });
ok(buds.length > 0 && EC.filterList(all, { cat: "xiaomi", q: "buds" }).length >= buds.length, "clearing the subtype keeps the Xiaomi search");
ok(EC.filterList(all, { q: "" }).length === all.length, "empty search resets to the full stock");
ok(EC.matchProduct({ sku: "FX", marca: "Ápple", produto: "Íphone 15", tamanho: "128GB" }, "IPHONE"), "search folds case and accents");
ok(EC.matchProduct({ sku: "Z", marca: "Apple", produto: "Película", tamanho: "" }, "pelicula"), "search folds ç");

const phones = [
  { sku: "IP-AZUL", marca: "Apple", produto: "iPhone 18 Pro Max", tamanho: "Azul", estoque: 1, preco_venda: 10 },
  { sku: "IP-PRETO", marca: "Apple", produto: "iPhone 18 Pro Max", tamanho: "Preto", estoque: 20, preco_venda: 10 },
  { sku: "IP-BRANCO", marca: "Apple", produto: "iPhone 18 Pro Max", tamanho: "Branco", estoque: 0, preco_venda: 10 },
  { sku: "IP-VERDE", marca: "Apple", produto: "iPhone 18 Pro Max", tamanho: "Verde", estoque: -2, preco_venda: 10, custo: 4 }
];
const oneSku = EC.tally([phones[1]]);
ok(oneSku.avail === 1 && oneSku.units === 20 && oneSku.missing === 0, "20 units of one SKU count as 1 available product");
const twoColors = EC.tally(phones.slice(0, 2));
ok(twoColors.avail === 2 && twoColors.units === 21, "two color SKUs count as 2 available products");
const phoneTall = EC.tally(phones);
ok(phoneTall.avail === 2 && phoneTall.missing === 2 && phoneTall.units === 19, "zero and negative stay unavailable and units stay exact");
const phoneNav = EC.navHtml(phones, { cat: "apple", sub: "iphones" });
ok(/data-cat="apple" data-n="2"/.test(phoneNav) && /data-sub="iphones" data-n="2"/.test(phoneNav), "chip count is stocked variants, not units");
ok(!phoneNav.toLowerCase().includes("custo") && !phoneNav.includes("4"), "availability chips do not disclose cost");
const secs = EC.saleSections(phones);
ok(secs.priority.map(p => p.sku).join(",") === "IP-AZUL", "stock of 1 is the sell-priority group");
ok(secs.available.map(p => p.sku).join(",") === "IP-PRETO", "stock of 2 or more comes after the last unit");
ok(secs.missing.map(p => p.sku).join(",") === "IP-BRANCO,IP-VERDE", "zero and negative stay below and are not sellable");
ok(secs.priority.length + secs.available.length === phoneTall.avail, "priority ordering does not change the available count");
const beforeOrder = JSON.stringify(phones);
EC.orderForSale(phones);
ok(JSON.stringify(phones) === beforeOrder, "sale order does not change stock or price");
const onlyOut = [{ sku: "SW-0", marca: "Nintendo", produto: "Switch OLED", tamanho: "Neon", estoque: 0 }];
const outNav = EC.navHtml(onlyOut, { cat: "" });
ok(/data-cat="games" data-n="0"/.test(outNav) && /data-cat="" data-n="0"/.test(outNav), "a family with only missing stock stays reachable at zero");
ok(EC.navHtml(onlyOut, { cat: "games" }).includes('data-sub="consoles" data-n="0"'), "its subtype stays reachable");
ok(EC.filterList(onlyOut, { cat: "", q: "" }).length === 1, "reset still returns the missing catalog row");

const html = EC.navHtml(fx, { cat: "apple", sub: "iphones" });
ok(html.includes('role="toolbar"') && html.includes('aria-label="Categorias do estoque"') && html.includes('aria-label="Tipos em Apple"'), "toolbars named");
ok(html.includes('type="button"') && html.includes('aria-pressed="true"') && html.includes('data-cat="apple"') && html.includes('data-sub="iphones"'), "pressed state and buttons");
for (const label of ["Todos", "Games", "Apple", "Xiaomi", "Perfumes", "Outros", "iPhones", "MacBooks", "Apple Watch", "AirPods", "Acessórios"]) ok(html.includes(label), `label ${label}`);
ok(!/xaiomi/i.test(html), "Xiaomi is spelled correctly");
const fxAvail = fx.filter(p => Number(p.estoque) > 0).length;
const catNs = [...html.matchAll(/data-cat="([^"]*)" data-n="(\d+)"/g)].map(m => [m[1], +m[2]]);
const todos = catNs.find(x => x[0] === "");
ok(todos && todos[1] === fxAvail && todos[1] < fx.length && catNs.filter(x => x[0]).reduce((a, x) => a + x[1], 0) === fxAvail, "chip counts sum to stocked fixtures, not every catalog row");
const subNs = [...html.matchAll(/data-sub="([^"]*)" data-n="(\d+)"/g)].map(m => [m[1], +m[2]]);
const subTodos = subNs.find(x => x[0] === "");
ok(subTodos && subNs.filter(x => x[0]).reduce((a, x) => a + x[1], 0) === subTodos[1], "Apple subtype available counts sum to Apple");
ok(html.includes("produtos disponíveis"), "chip label says produtos disponíveis");
ok(EC.navHtml(fx, { cat: "" }).includes("data-row=\"cat\"") && !EC.navHtml(fx, { cat: "" }).includes("data-row=\"sub\""), "Todos hides subtypes");
ok(!EC.navHtml([{ sku: "JBL-001", marca: "JBL", produto: "Flip", estoque: 1 }], { cat: "" }).includes("Games"), "empty families stay hidden");

const full = { avail: 8, missing: 2, units: 40 };
ok(EC.summaryText(full, full, full) === "8 produtos disponíveis · 2 sem estoque · 40 un.", "summary names available, missing, and units");
const narrowed = { avail: 2, missing: 1, units: 21 };
ok(EC.summaryText(narrowed, full, full) === "Neste filtro: 2 produtos disponíveis · 1 sem estoque · 21 un. · lista da tela: 8 disponíveis, 2 sem estoque, 40 un.", "category scope stays separate from the full list");
const busca = { avail: 3, missing: 0, units: 8 };
ok(EC.summaryText(busca, busca, full).startsWith("Na busca: 3 produtos disponíveis"), "search scope is labeled");
ok(EC.summaryText(narrowed, busca, full).includes("Neste filtro:") && EC.summaryText(narrowed, busca, full).includes("na busca:"), "filter inside a search names both scopes");

ok(EC.nextChipIndex(4, 0, "ArrowRight") === 1 && EC.nextChipIndex(4, 0, "ArrowDown") === 1, "arrow forward");
ok(EC.nextChipIndex(4, 0, "ArrowLeft") === 3 && EC.nextChipIndex(4, 0, "ArrowUp") === 3, "arrow wraps backward");
ok(EC.nextChipIndex(4, 3, "ArrowRight") === 0 && EC.nextChipIndex(4, 2, "Home") === 0 && EC.nextChipIndex(4, 2, "End") === 3, "end, home, wrap");
ok(EC.nextChipIndex(4, 1, "Tab") === -1 && EC.nextChipIndex(4, 1, "Enter") === -1 && EC.nextChipIndex(4, 1, " ") === -1, "tab, enter, and space stay native");

function fakeBar() {
  const buttons = ["Todos", "Apple"].map(() => ({ focused: false, parentElement: null, closest(sel) { return String(sel).includes("est-chip") ? this : String(sel).includes("data-row") ? row : null; }, focus() { buttons.forEach(b => { b.focused = b === this; }); } }));
  const row = { contains: b => buttons.includes(b), querySelectorAll: () => buttons };
  buttons.forEach(b => { b.parentElement = row; });
  return { row, buttons };
}
const bar = fakeBar();
let prevented = false;
ok(EC.onToolbarKey({ key: "ArrowRight", target: bar.buttons[0], preventDefault() { prevented = true; } }) && bar.buttons[1].focused && prevented, "arrow moves focus inside the toolbar");
ok(EC.onToolbarKey({ key: "Tab", target: bar.buttons[1], preventDefault() { throw new Error("tab swallowed"); } }) === false, "tab is not swallowed");
ok(EC.onToolbarKey({ key: "Enter", target: bar.buttons[1], preventDefault() { throw new Error("enter swallowed"); } }) === false, "enter activates the button natively");

const css = read("loja.css");
ok(css.includes(".est-row{display:flex;flex-wrap:wrap") && css.includes(".est-chip:focus-visible"), "desktop chips wrap and show focus");
ok(/@media\(max-width:720px\)\{[^}]*\.est-row\{flex-wrap:nowrap;overflow-x:auto/.test(css) && css.includes("min-height:36px"), "mobile row scrolls instead of squeezing");
ok(css.includes(".est-nav{display:none!important}") && css.includes(".ult") && css.includes(".stk-wrap{overflow:visible}") && css.includes("html[data-theme=dark] .est-chip"), "print hides chips, keeps the last-unit label, and dark mode keeps contrast");

const app = read("app.js");
const view = app.slice(app.indexOf("async function viewEstoque"), app.indexOf("async function viewRelatorio"));
ok(view.includes("await api.products()") && view.includes("await api.estoqueVendedor()") && view.includes("stockSort("), "admin and seller stock sources unchanged");
ok(view.includes("REPOR") && view.includes("Sem estoque") && view.includes("Produtos disponíveis") && view.includes("Prioridade de venda") && view.includes("Última peça") && view.includes('placeholder="Buscar produto, marca ou SKU…"') && view.includes("Imprimir / PDF"), "stock table, priority label, search, and print stay");
ok(view.includes('me.role === "admin"') && view.includes("preco_venda") && view.includes("const rowSeller") && view.includes("const rowAdm"), "admin and seller rows stay separate");
const sellerPart = view.slice(view.indexOf("const rowSeller"), view.indexOf("const row ="));
ok(!sellerPart.includes("Editar custo") && !sellerPart.includes("product_costs") && !sellerPart.includes("preco_venda"), "seller row has no price and no cost control");
ok(view.includes("if (adm)") && view.includes("await api.costs()") && view.includes("Editar custo") && view.includes("api.custoSalvar"), "cost read and edit stay inside the admin branch");
ok(view.includes('qs.has("estfix")') && view.includes("MOCK &&"), "synthetic preview is mock-only");
ok(app.includes('estoque: "vendas|estoque"') && app.includes('vendedor: ["vendas"]') && app.includes('estoque: ["estoque"]'), "route and role permissions unchanged");

const htmlMain = read("index.html");
ok(htmlMain.indexOf("estoque-categorias.js") < htmlMain.indexOf("custo-valor.js") && htmlMain.indexOf("custo-valor.js") < htmlMain.indexOf("venda-origem.js") && htmlMain.indexOf("venda-origem.js") < htmlMain.indexOf("prazo-vencimento.js?v=20261111e") && htmlMain.indexOf("prazo-vencimento.js?v=20261111e") < htmlMain.indexOf("ponto.js?v=20261111d") && htmlMain.indexOf("ponto.js?v=20261111d") < htmlMain.indexOf("app.js?v=20261113c"), "classifier, cost parser, sale-source, prazo and ponto helpers load before the app");
const kioskJs = readFileSync(join(dir, "../kiosk/app.js"), "utf8");
const kioskHtml = readFileSync(join(dir, "../kiosk/index.html"), "utf8");
ok(!kioskJs.includes("BAGDA_ESTOQUE_CATS") && !kioskJs.includes("est-nav") && !kioskHtml.includes("estoque-categorias"), "kiosk estoque is untouched");

const labels = EC.CATS.map(c => c.label).join("|");
ok(labels === "Games|Apple|Xiaomi|Perfumes|Outros", "family order");
ok(same(EC.APPLE_SUBS.map(s => s.label), ["iPhones", "MacBooks", "Apple Watch", "AirPods", "Acessórios", "Outros"]), "Apple types");
ok(tall.avail === ["games", "apple", "xiaomi", "perfume", "outros"].reduce((a, cat) => a + ((tall.cats[cat] && tall.cats[cat].avail) || 0), 0), "available family counts reconcile");
ok(tall.avail + tall.missing === all.length, "available plus missing is the whole catalog");

if (failed) { console.error(failed + " failed"); process.exit(1); }
console.log("estoque categorias ok");
