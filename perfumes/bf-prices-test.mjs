/* Black Friday public prices: per-perfume De/Por, no blanket 50%, no cost fields. */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const repo = dirname(root);
let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.error("FAIL", m); } else console.log("ok", m); };

function loadJs(name) {
  const s = readFileSync(join(root, name), "utf8");
  return JSON.parse(s.slice(s.indexOf("{"), s.lastIndexOf("}") + 1));
}
const data = loadJs("assets/data.js");
const json = JSON.parse(readFileSync(join(root, "data.json"), "utf8"));
const html = readFileSync(join(root, "index.html"), "utf8");
const app = readFileSync(join(root, "assets/app.js"), "utf8");
const extras = readFileSync(join(root, "assets/extras.js"), "utf8");
const feed = readFileSync(join(repo, "feeds/google-merchant.xml"), "utf8");
const home = readFileSync(join(repo, "index.html"), "utf8");
const P = data.perfumes;
const by = new Map(P.map(p => [p.id, p]));

const held = ["armaf-club-de-nuit-intense-fuego","armaf-club-de-nuit-bling","armaf-tag-uomo-nero","armaf-le-parfait-pour-homme","armaf-magical-oud","mpf-wicked","arabiyat-prestige-swar-venin","arabiyat-prestige-marwa","ibraheem-al-qurashi-cuban-tobacco","mpf-poudre","mpf-dark-scudo","mpf-vanilla-tobacco","mpf-wicked-elixir","mpf-wicked-legend","mpf-wicked-noir","paris-corner-khair-pistachio"];
const heldPrice = { "armaf-club-de-nuit-intense-fuego":320, "armaf-club-de-nuit-bling":210, "armaf-tag-uomo-nero":180, "armaf-le-parfait-pour-homme":150, "armaf-magical-oud":150, "mpf-wicked":99.99, "arabiyat-prestige-swar-venin":230, "arabiyat-prestige-marwa":240, "ibraheem-al-qurashi-cuban-tobacco":150, "mpf-poudre":99.99, "mpf-dark-scudo":99.99, "mpf-vanilla-tobacco":99.99, "mpf-wicked-elixir":99.99, "mpf-wicked-legend":99.99, "mpf-wicked-noir":99.99, "paris-corner-khair-pistachio":85 };

ok(P.length === 104 && data.meta.count === 104, "104 perfumes");
ok(json.perfumes.length === 104 && json.perfumes.every((p, i) => p.id === P[i].id && p.price === P[i].price && p.bf === P[i].bf), "data.json matches data.js");
ok(!JSON.stringify(data).match(/"(cost|custo|wholesale)"/i), "no cost fields in public catalog");
ok(!/50%\s*OFF|-50%|metade da loja|tudo pela metade/i.test(html + readFileSync(join(root, "assets/bf.css"), "utf8")), "no blanket 50% claim");
ok(!/Distribuidor oficial/i.test(html), "perfume page adds no distribuidor oficial claim");
ok(!/Distribuidor oficial/i.test(app), "cards and product dialog add no distribuidor oficial claim");
ok(/if\(p\.bf\|\|p\.waOnly\) return ""/.test(app), "changed prices do not open a payment link");
ok(extras.includes("https://pag.getnet.com.br/NzK6N-pmh"), "existing Getnet links stay in extras.js");

const bf = P.filter(p => p.bf);
ok(bf.length === 73 && P.filter(p => p.waOnly).length === 74, "73 discounted, 74 WhatsApp-only");
ok(bf.every(p => p.priceFrom % 5 === 0 && p.price <= p.priceFrom + 1e-9 && p.price + 1e-9 >= p.priceFrom / 2), "Por is at least half of De and never above De");
ok(bf.every(p => p.bfOff === Math.round((1 - p.price / p.priceFrom) * 100) && p.bfOff > 0 && p.bfOff < 50 && p.waOnly && p.priceFromLabel), "badge is the real discount, never 50");
ok(held.every(id => by.get(id) && !by.get(id).bf && !by.get(id).waOnly && by.get(id).price === heldPrice[id] && !by.get(id).priceFrom), "16 uncosted perfumes keep the live price");

const gold = [
  ["ferassa-jamra", 100, 85, 15],
  ["ferassa-nemer", 100, 70, 30],
  ["armaf-club-de-nuit-elite", 280, 260, 7],
  ["arabiyat-prestige-nyla", 150, 85, 43],
  ["mpf-highway-parfum", 100, 70, 30],
  ["french-avenue-liquid-brun", 210, 195, 7],
];
for (const [id, de, por, off] of gold) {
  const p = by.get(id);
  ok(p && p.priceFrom === de && p.price === por && p.bfOff === off && p.photo.indexOf("assets/img/") === 0, id + " De/Por");
}
const fab = by.get("mpf-fabulicious");
ok(fab && !fab.bf && fab.waOnly && fab.price === 105 && !fab.priceFrom, "Fabulicious rises to 105 with no fake strikethrough");
ok(existsSync(join(root, "assets/img/french-avenue-liquid-brun.webp")), "Liquid Brun photo shipped");
ok(by.get("ferassa-jamra").photo === "assets/img/ferassa-jamra.webp", "existing photo path kept");

function ldPrice(id) {
  const m = html.match(new RegExp('"sku":"' + id + '"[\\s\\S]*?"price":"([0-9.]+)"'));
  return m && m[1];
}
ok(ldPrice("ferassa-jamra") === "85.00" && ldPrice("armaf-club-de-nuit-intense-fuego") === "320.00" && ldPrice("mpf-fabulicious") === "105.00" && ldPrice("french-avenue-liquid-brun") === "195.00", "JSON-LD offer price is the amount charged");

function item(id) {
  const m = feed.match(new RegExp("<g:id>" + id + "</g:id>[\\s\\S]*?</item>"));
  return m && m[0];
}
const jam = item("ferassa-jamra");
ok(jam && jam.includes("<g:price>100.00 BRL</g:price>") && jam.includes("<g:sale_price>85.00 BRL</g:sale_price>"), "merchant feed De/Por for a discounted perfume");
const fuego = item("armaf-club-de-nuit-intense-fuego");
ok(fuego && fuego.includes("<g:price>320.00 BRL</g:price>") && !fuego.includes("sale_price"), "merchant feed leaves an unchanged perfume alone");
ok(item("mpf-fabulicious").includes("<g:price>105.00 BRL</g:price>") && !item("mpf-fabulicious").includes("sale_price"), "merchant feed shows the Fabulicious increase as the price");
ok(home.includes("perfumes/assets/data.js?v=20261105bf") && html.includes("assets/bf.css?v=20261105bf") && html.includes('rel="canonical" href="https://bgdstores.com/perfumes/"') && !html.includes("noindex"), "cache bump, canonical, still indexable");

if (failed) { console.error(failed + " failed"); process.exit(1); }
console.log("bf prices ok");
