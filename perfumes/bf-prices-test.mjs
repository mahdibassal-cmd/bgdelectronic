/* Manifest parity: public De/Por match sanitized v3. No cost figures. */
import { readFileSync } from "node:fs";
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
const man = JSON.parse(readFileSync(join(root, "bf-manifest-public.json"), "utf8"));
const html = readFileSync(join(root, "index.html"), "utf8");
const app = readFileSync(join(root, "assets/app.js"), "utf8");
const feed = readFileSync(join(repo, "feeds/google-merchant.xml"), "utf8");
const P = data.perfumes;
const by = new Map(P.map(p => [p.id, p]));
const rows = man.rows;
const perfume = rows.filter(r => r.scope === "perfume");
const known = perfume.filter(r => !r.unknown);
const held = perfume.filter(r => r.unknown);
const beauty = rows.filter(r => r.scope === "beauty");

ok(rows.length === 113 && perfume.length === 104 && known.length === 88 && held.length === 16 && beauty.length === 9, "113 manifest rows: 88 priced, 16 held, 9 beauty");
ok(!JSON.stringify(data).match(/"(cost|custo)"/i) && !JSON.stringify(man).match(/"(cost|custo)"/i), "no cost field in public catalog or sanitized manifest");
ok(json.perfumes.every((p, i) => p.id === P[i].id && p.price === P[i].price && p.priceFrom === P[i].priceFrom && p.bf === P[i].bf && p.soldOut === P[i].soldOut), "data.json matches data.js");

let knownMismatch = 0;
for (const r of known) {
  const p = by.get(r.id);
  const off = Math.round((1 - r.por / r.de) * 100);
  const priceOk = p && Math.abs(p.price - r.por) < 0.001 && p.priceFrom === r.de && p.bf === true && p.bfOff === off;
  const payOk = p && !!p.waOnly === (r.previous == null || Math.abs(r.por - r.previous) > 0.001);
  if (!priceOk || !payOk) { knownMismatch++; console.error("KNOWN", r.sku, r.name, p && p.price, p && p.priceFrom, "want", r.por, r.de); }
}
ok(knownMismatch === 0, "known-cost mismatch count after correction is " + knownMismatch);

let divergence = 0;
const inStock = ["PERF-063", "PERF-013", "PERF-079"];
for (const r of held) {
  const p = by.get(r.id);
  const same = p && !p.bf && p.priceFrom == null && Math.abs(p.price - r.hold) < 0.001 && Math.abs(p.price - r.manifestPor) > 0.001;
  const stockOk = p && p.soldOut === (r.stock === "ESGOTADO") && (r.stock === "IN STOCK") === inStock.includes(r.sku);
  if (!same || !stockOk || p.waOnly) { divergence++; console.error("HOLD", r.sku, p && p.price, p && p.soldOut, p && p.bf); }
}
ok(held.length === 16 && divergence === 0, "16 missing-cost rows stay at the published price and out of the sale; divergence vs half-price is " + held.length);

const jam = by.get("ferassa-jamra");
const fab = by.get("mpf-fabulicious");
const brun = by.get("french-avenue-liquid-brun");
ok(jam.priceFrom === 95 && jam.price === 85 && jam.bfOff === 11 && jam.waOnly, "Jamra 95 to 85");
ok(fab.priceFrom === 110 && fab.price === 105 && fab.bfOff === 5 && fab.waOnly && !fab.soldOut, "Fabulicious 110 to 105");
ok(brun.priceFrom === 210 && brun.price === 195 && brun.bfOff === 7 && brun.waOnly, "Liquid Brun 210 to 195");
ok(by.get("arabiyat-prestige-swar-venin").price === 230 && !by.get("arabiyat-prestige-swar-venin").bf && !by.get("arabiyat-prestige-swar-venin").soldOut, "Swar Venin stays 230 in stock");
ok(by.get("armaf-magical-oud").price === 150 && !by.get("armaf-magical-oud").bf, "Magical Oud stays 150");
ok(by.get("ibraheem-al-qurashi-cuban-tobacco").price === 150 && !by.get("ibraheem-al-qurashi-cuban-tobacco").bf, "Cuban Tobacco stays 150");
ok(by.get("armaf-club-de-nuit-intense-fuego").soldOut && by.get("armaf-club-de-nuit-intense-fuego").price === 320 && !by.get("armaf-club-de-nuit-intense-fuego").bf, "Fuego held at 320 and marked sold out");
ok(beauty.every(r => !P.some(p => p.name === r.name)), "beauty rows are not added to the perfume catalog");

function ld(id) {
  const m = html.match(new RegExp('"sku":"' + id + '"[\\s\\S]*?"price":"([0-9.]+)"[\\s\\S]*?"availability":"([^"]+)"'));
  return m && { price: m[1], avail: m[2] };
}
ok(ld("ferassa-jamra").price === "85.00" && ld("mpf-fabulicious").price === "105.00" && ld("french-avenue-liquid-brun").price === "195.00", "JSON-LD charges Por");
ok(ld("arabiyat-prestige-swar-venin").price === "230.00" && ld("arabiyat-prestige-swar-venin").avail.endsWith("InStock"), "JSON-LD keeps Swar Venin at 230");
ok(ld("armaf-club-de-nuit-intense-fuego").price === "320.00" && ld("armaf-club-de-nuit-intense-fuego").avail.endsWith("OutOfStock"), "JSON-LD marks Fuego sold out at 320");

function item(id) {
  const m = feed.match(new RegExp("<g:id>" + id + "</g:id>[\\s\\S]*?</item>"));
  return m && m[0];
}
const jamFeed = item("ferassa-jamra");
ok(jamFeed.includes("<g:price>95.00 BRL</g:price>") && jamFeed.includes("<g:sale_price>85.00 BRL</g:sale_price>"), "merchant De 95 Por 85");
const fabFeed = item("mpf-fabulicious");
ok(fabFeed.includes("<g:price>110.00 BRL</g:price>") && fabFeed.includes("<g:sale_price>105.00 BRL</g:sale_price>"), "merchant Fabulicious 110 to 105");
const fuego = item("armaf-club-de-nuit-intense-fuego");
ok(fuego.includes("<g:price>320.00 BRL</g:price>") && !fuego.includes("sale_price") && fuego.includes("out_of_stock"), "merchant leaves Fuego at 320 without a sale price");
const same = item("mpf-rouge-lights");
ok(same.includes("<g:price>105.00 BRL</g:price>") && same.includes("<g:sale_price>100.00 BRL</g:sale_price>"), "merchant shows De even when Por equals the old shelf price");
ok(/if\(p\.waOnly\) return ""/.test(app) && !/if\(p\.bf\|\|p\.waOnly\)/.test(app), "Getnet stays only when the charged amount did not change");
ok(!/Distribuidor oficial/i.test(html) && !/50%\s*OFF/.test(html), "no blanket discount or new distributor claim");

if (failed) { console.error(failed + " failed"); process.exit(1); }
console.log("manifest parity ok; known mismatches 0; intentional holds 16");
