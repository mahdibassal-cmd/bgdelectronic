/* Round-up draft parity. Reference price is proposed, not a verified past price. */
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
const css = readFileSync(join(root, "assets/bf.css"), "utf8");
const feed = readFileSync(join(repo, "feeds/google-merchant.xml"), "utf8");
const P = data.perfumes;
const by = new Map(P.map(p => [p.id, p]));
const rows = man.rows;
const known = rows.filter(r => r.scope === "perfume" && !r.unknown);
const held = rows.filter(r => r.unknown);

ok(rows.length === 104 && known.length === 88 && held.length === 16, "104 perfume rows, 88 priced, 16 held");
ok(!JSON.stringify(data).match(/"(cost|custo|margin)"/i) && !JSON.stringify(man).match(/"(cost|custo|margin)"/i), "no cost or margin in public files");
ok(json.perfumes.every((p, i) => p.id === P[i].id && p.price === P[i].price && p.priceFrom === P[i].priceFrom && !!p.proposed === !!P[i].proposed), "data.json matches data.js");
ok(!P.some(p => /lattafa|celimax|fino/i.test(p.brand + " " + p.name)), "Lattafa excluded; Celimax and Fino not added");

let mismatch = 0;
for (const r of known) {
  const p = by.get(r.id);
  const priceOk = p && p.proposed && p.price === r.por && p.priceFrom === r.de && r.de === r.por * 2 && !p.bfOff;
  const payOk = p && !!p.waOnly === (r.previous == null || Math.abs(r.por - r.previous) > 0.001);
  if (!priceOk || !payOk) { mismatch++; console.error("PRICED", r.sku, r.name, p && p.price, p && p.priceFrom); }
}
ok(mismatch === 0, "priced-row mismatch count is " + mismatch);

const heldIds = ["PERF-020","PERF-084","PERF-085","PERF-087","PERF-088","PERF-089","PERF-090","PERF-063","PERF-068","PERF-006","PERF-007","PERF-011","PERF-012","PERF-013","PERF-079","PERF-092"];
ok(held.map(r => r.sku).sort().join() === heldIds.slice().sort().join(), "held sku set is the 16 missing-cost bottles");
let holdBad = 0;
for (const r of held) {
  const p = by.get(r.id);
  const okHold = p && !p.proposed && p.priceFrom == null && Math.abs(p.price - r.hold) < 0.001 && Math.abs(r.filePor - r.hold) > 0.001 && !p.waOnly;
  if (!okHold) { holdBad++; console.error("HOLD", r.sku, p && p.price, r.hold, r.filePor); }
}
ok(holdBad === 0, "16 held rows keep the published price and are excluded from the proposed reference");

const fer = known.filter(r => r.sku.startsWith("FER-"));
ok(fer.length === 4 && fer.every(r => r.de === 190 && r.por === 95 && by.get(r.id).price === 95 && by.get(r.id).priceFrom === 190), "all Ferassa 190/95");
const manRow = known.find(r => r.sku === "PERF-008");
ok(manRow.de === 330 && manRow.por === 165 && by.get(manRow.id).priceFrom === 330 && by.get(manRow.id).price === 165, "Club de Nuit Intense Man 330/165");
const brun = known.find(r => r.sku === "PERF-150");
ok(brun.de === 400 && brun.por === 200 && by.get(brun.id).priceFrom === 400 && by.get(brun.id).price === 200, "Liquid Brun 400/200");
ok(by.get("arabiyat-prestige-swar-venin").price === 230 && !by.get("arabiyat-prestige-swar-venin").proposed, "Swar Venin held at 230");
ok(by.get("armaf-magical-oud").price === 150 && !by.get("armaf-magical-oud").proposed, "Magical Oud held at 150");
ok(by.get("ibraheem-al-qurashi-cuban-tobacco").price === 150 && !by.get("ibraheem-al-qurashi-cuban-tobacco").proposed, "Cuban Tobacco held at 150");

ok(/referência proposta/i.test(html) && /não é um preço anterior comprovado/i.test(html) && !/Desconto real|De riscado/i.test(html), "preview calls the higher price a proposed reference");
ok(!/-50%|50%\s*OFF/.test(html + app) && !app.includes("'-'+p.bfOff"), "no blanket or percent-off claim");
ok(/if\(p\.waOnly\) return ""/.test(app), "Getnet only when the charged amount is unchanged");

function ld(id) {
  const m = html.match(new RegExp('"sku":"' + id + '"[\\s\\S]*?"price":"([0-9.]+)"'));
  return m && m[1];
}
ok(ld("ferassa-jamra") === "95.00" && ld("armaf-club-de-nuit-intense-man") === "165.00" && ld("french-avenue-liquid-brun") === "200.00", "JSON-LD price is Por, the amount charged");
ok(!html.includes("highPrice"), "JSON-LD does not publish the reference as a past price");

function item(id) {
  const m = feed.match(new RegExp("<g:id>" + id + "</g:id>[\\s\\S]*?</item>"));
  return m && m[0];
}
ok(item("ferassa-jamra").includes("<g:price>95.00 BRL</g:price>") && !item("ferassa-jamra").includes("sale_price"), "feed charges Jamra 95 and does not claim a sale from 190");
ok(item("armaf-club-de-nuit-intense-man").includes("<g:price>165.00 BRL</g:price>") && !item("armaf-club-de-nuit-intense-man").includes("sale_price"), "feed charges Intense Man 165");
ok(item("french-avenue-liquid-brun").includes("<g:price>200.00 BRL</g:price>") && !feed.includes("<g:sale_price>"), "feed has no sale_price while the reference is unvalidated");
ok(item("arabiyat-prestige-swar-venin").includes("<g:price>230.00 BRL</g:price>"), "feed keeps Swar Venin at 230");
ok(css.includes(".ref-lab") && !css.includes("text-decoration:line-through"), "reference label is not a strikethrough previous price");

if (failed) { console.error(failed + " failed"); process.exit(1); }
console.log("round-up parity ok; priced mismatches 0; held exceptions 16");
