/* PIX Local do pagamento: cinco caixas por id, nome atual, lançamento forma pix e estorno. Sem banco. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const app = readFileSync(join(dir, "app.js"), "utf8");
const html = readFileSync(join(dir, "index.html"), "utf8");
const sql = readFileSync(join(dir, "../supabase-loja/migration-pix-locais-caixas.sql"), "utf8");
const lancar = readFileSync(join(dir, "../supabase-loja/migration-receber-caixa-especial.sql"), "utf8");
const cancel = readFileSync(join(dir, "../supabase-loja/migration-venda-origem.sql"), "utf8");
let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.error("FAIL", m); } else console.log("ok", m); };

eval(readFileSync(join(dir, "pix-locais.js"), "utf8"));
const P = globalThis.BAGDA_PIX_LOCAIS;

const live = [
  { caixa_id: 15, nome: "PRESTIGE ROSA" },
  { caixa_id: 2, nome: "Caixa PIX (HX)" },
  { caixa_id: 3, nome: "Máquina Loja" },
  { caixa_id: 14, nome: "CAIXA S2" },
  { caixa_id: 13, nome: "PRIME" },
  { caixa_id: 1, nome: "Caixa Dinheiro" },
  { caixa_id: 16, nome: "BITLOG CONTAINER" }
];
const admin = P.opcoes(live, true);
const vend = P.opcoes(live, false);
ok(admin.filter(o => o.id).map(o => o.id).join() === "15,2,3,14,13", "PIX locais follow caixa ids 15, 2, 3, 14, 13");
ok(admin.filter(o => o.id).map(o => o.label).join("|") === "PRESTIGE ROSA|Caixa PIX (HX)|Máquina Loja|CAIXA S2|PRIME", "labels are the current caixa names");
ok(!admin.some(o => /AURA/.test(o.label) || /AURA/.test(o.value)), "stale PRESTIGE AURA is not an option");
ok(admin[admin.length - 1].value === "CAIXA ESPECIAL" && admin.filter(o => o.value === "CAIXA ESPECIAL").length === 1, "admin keeps a single CAIXA ESPECIAL");
ok(!vend.some(o => o.value === "CAIXA ESPECIAL" || o.value === "BITLOG CONTAINER"), "vendedor PIX list has no admin-only local");
ok(!vend.some(o => o.id === 1 || o.id === 16), "PIX list does not add Dinheiro or BITLOG");

const renamed = live.map(c => c.caixa_id === 15 ? { ...c, nome: "PRESTIGE ROSA" } : c);
const stale = [{ caixa_id: 15, nome: "PRESTIGE ROSA" }, { caixa_id: 99, nome: "PRESTIGE AURA" }];
ok(P.opcoes(renamed, false)[0].label === "PRESTIGE ROSA" && P.opcoes(renamed, false)[0].id === 15, "caixa 15 is shown by id, whatever the old label was");
ok(P.caixaId("PRESTIGE AURA", stale) === 15 && P.caixaId("PRESTIGE ROSA", stale) === 15, "old PRESTIGE AURA notes still resolve to caixa 15");
ok(P.nomeDe([], 15) === "PRESTIGE ROSA" && P.nomeDe([{ id: 15, nome: "PRESTIGE ROSA" }], 15) === "PRESTIGE ROSA", "missing row uses the current fallback name, not AURA");

ok(P.soPix([{ metodo: "pix", valor: 10 }]), "single PIX uses the PIX locais");
ok(!P.soPix([{ metodo: "dinheiro", valor: 10 }]) && !P.soPix([{ metodo: "cartao", valor: 10 }]) && !P.soPix([{ metodo: "", valor: 10 }]), "dinheiro, cartão and empty keep the shared list");
ok(!P.soPix([{ metodo: "pix", valor: 10 }, { metodo: "dinheiro", valor: 5 }]), "a split with another method is not PIX-only");
ok(P.soPix([{ metodo: "pix", valor: 80 }, { metodo: "prazo", valor: 20 }]), "PIX plus Paga Depois is still the PIX list");

const movs = P.lancar("Caixa PIX (HX)", live, [{ metodo: "pix", valor: 150 }]);
ok(movs.length === 1 && movs[0].caixa_id === 2 && movs[0].tipo === "venda" && movs[0].forma === "pix" && movs[0].valor === 150, "PIX books into the chosen caixa with forma pix");
const est = P.estornar(movs);
ok(est.length === 1 && est[0].caixa_id === 2 && est[0].tipo === "estorno" && est[0].forma === "pix" && est[0].valor === 150, "cancellation reverses that caixa and keeps forma pix");
ok(P.lancar("PRIME", live, [{ metodo: "pix", valor: 40 }, { metodo: "prazo", valor: 10 }]).every(m => m.caixa_id === 13 && m.forma === "pix") && P.lancar("PRIME", live, [{ metodo: "pix", valor: 40 }, { metodo: "prazo", valor: 10 }]).length === 1, "Paga Depois is not a caixa movement");
ok(P.lancar("CAIXA ESPECIAL", live, [{ metodo: "pix", valor: 10 }]).length === 0, "Caixa Especial stays off the day caixas");
ok(P.caixaId("HX", live) === 2 && P.caixaId("MAQUINA", live) === 3 && P.caixaId("CAIXA S2", live) === 14 && P.caixaId("PRIME", live) === 13, "legacy labels map to the same ids");

const outros = app.match(/const LOCAIS = \[[^\]]*\]/)[0];
ok(outros === 'const LOCAIS = ["MAQUINA", "HX", "DINHEIRO", "CAIXA GERAL", "CAIXA S2", "PRESTIGE ROSA"]', "dinheiro and cartão still use the shared local list");
ok(app.includes('const LOCAIS_ADMIN = ["BITLOG CONTAINER", "CAIXA ESPECIAL"]') && app.includes('LOCAIS.concat(me.role === "admin" ? LOCAIS_ADMIN : [])'), "non-PIX admin list still appends BITLOG and Caixa Especial");
ok(app.includes("PX.soPix(pgs) ? PX.opcoes(caixasPix, me.role === \"admin\")") && app.includes("async caixasPix()"), "the sale screen swaps the dropdown only for PIX and loads nomes by id");
ok(app.includes("migration-pix-locais-caixas.sql"), "a rejected new local names the SQL file and saves nothing");
ok(app.includes("MV[MV.length - 1].forma = g.metodo") && app.includes("if (forma) MV[MV.length - 1].forma = forma"), "demo lançar stores forma pix and cancel copies it onto the estorno");
ok(html.includes("pix-locais.js?v=20261114a") && html.includes("app.js?v=20261114c") && html.indexOf("pix-locais.js") < html.indexOf("app.js?v=20261114c"), "cache tag 20261113d and the helper loads first");

ok(sql.includes("c.id in (15, 2, 3, 14, 13)") && sql.includes("'Caixa PIX (HX)'") && sql.includes("'Máquina Loja'") && sql.includes("'PRIME'") && sql.includes("'PRESTIGE ROSA'") && sql.includes("'CAIXA S2'"), "SQL accepts the five current names and any future nome of those ids");
ok(sql.includes("'PRESTIGE AURA'") && sql.includes("if p_local = 'PRESTIGE AURA' then p_local := 'PRESTIGE ROSA'; end if;"), "old AURA label is still accepted and stored as PRESTIGE ROSA");
ok(sql.includes("caixas_para_local_pix") && sql.includes("public.can('vendas')"), "vendedor can read the five nomes without the caixa permission");
ok(!/insert into public\.caixa_movimentos/.test(sql) && !/create or replace function public\.(lancar_nota_caixa|cancelar_nota)\b/.test(sql), "creating the nota still does not post, and lançar/cancel stay the live functions");
ok(lancar.includes("insert into public.caixa_movimentos(caixa_id, tipo, valor, motivo, nota_id, user_id, forma)") && lancar.includes("pg.m"), "lancar_nota_caixa writes forma from the payment, so PIX is forma pix on the chosen caixa id");
ok(cancel.includes("group by caixa_id, forma") && cancel.includes("auth.uid(), r.forma"), "cancelar_nota_financas reverses each caixa and copies forma");

if (failed) { console.error(failed + " failed"); process.exit(1); }
console.log("pix locais ok");
