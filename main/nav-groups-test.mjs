/* Nav groups: existing buttons only, same data-p, empty groups hidden. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(dir, "index.html"), "utf8");
const js = readFileSync(join(dir, "app.js"), "utf8");
const css = readFileSync(join(dir, "loja.css"), "utf8");
let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.error("FAIL", m); } else console.log("ok", m); };

const nav = html.match(/<nav id="nav"[\s\S]*?<\/nav>/);
ok(nav, "nav block present");
const groups = [...nav[0].matchAll(/<div class="navg" data-g="([^"]+)" role="group" aria-labelledby="([^"]+)">([\s\S]*?)<\/div>\s*<\/div>/g)].map(m => {
  const buttons = [...m[3].matchAll(/<button([^>]*)>([^<]+)<\/button>/g)].map(b => {
    const attr = name => (b[1].match(new RegExp(`\\b${name}="([^"]*)"`)) || [])[1] || "";
    return { v: attr("data-v"), p: attr("data-p"), id: attr("id"), type: attr("type"), label: b[2].replace(/&amp;/g, "&") };
  });
  const heading = (m[3].match(/<span class="ngh" id="([^"]+)">([^<]+)<\/span>/) || [])[2];
  return { g: m[1], labelledby: m[2], heading, buttons };
});

ok(groups.map(g => g.g).join(",") === "notas,financas,compras,sistema", "group order");
ok(groups.map(g => g.heading).join("|") === "Notas|Financeiro|Compras e estoque|Sistema", "headings");
ok(groups.every(g => g.labelledby && html.includes(`id="${g.labelledby}"`)), "aria-labelledby targets exist");

const expected = {
  notas: [["nota", "vendas", "Nova nota"], ["notas", "vendas", "Notas"], ["lancar", "financas", "Notas a lançar"]],
  financas: [["caixa", "caixa", "Caixa"], ["caixageral", "financas", "Caixa Geral"], ["cxesp", "admin", "Caixa Especial"], ["clientes", "financas", "Clientes"], ["receber", "financas", "Contas a receber"], ["pagar", "financas", "Contas a pagar"], ["fornecedores", "financas", "Fornecedores"], ["resumo", "financas", "Resumo do dia"], ["relatorio", "admin", "Relatório"], ["hxdia", "admin", "HX por dia"]],
  compras: [["compras", "admin", "Compras"], ["imei", "financas|estoque", "Compras & IMEI"], ["estoque", "vendas|estoque", "Estoque"], ["produtos", "admin", "Produtos"], ["depesp", "admin|estoque", "Depósito Especial"]],
  sistema: [["usuarios", "admin", "Usuários"], ["seguranca", "", "Segurança"], ["", "", "Sair"]],
};
for (const g of groups) {
  const got = g.buttons.map(b => [b.v, b.p, b.label].join("|")).join(" ; ");
  const want = expected[g.g].map(x => x.join("|")).join(" ; ");
  ok(got === want, `${g.g} buttons ${got}`);
  ok(g.buttons.every(b => b.type === "button" || b.id === "sair" && b.type === "button"), `${g.g} type=button`);
}
const sair = groups.flatMap(g => g.buttons).find(b => b.id === "sair");
ok(sair && sair.label === "Sair" && sair.p === "" && sair.v === "", "Sair stays unrestricted");
const seg = groups.flatMap(g => g.buttons).find(b => b.v === "seguranca");
ok(seg && seg.p === "", "Segurança has no data-p");
const views = groups.flatMap(g => g.buttons).map(b => b.v).filter(Boolean);
ok(new Set(views).size === views.length && views.length === 20, "each route once, no extras");

const perms = JSON.parse(js.match(/const PERMS = (\{[^}]+\})/)[1].replace(/(\w+):/g, '"$1":'));
const can = (role, p) => role === "admin" || p.split("|").some(x => (perms[role] || []).includes(x));
function visible(role) {
  return groups.map(g => {
    const buttons = g.buttons.filter(b => !b.p || can(role, b.p)).map(b => b.label);
    return { heading: g.heading, buttons, hidden: buttons.length === 0 };
  }).filter(g => !g.hidden);
}
const labels = role => visible(role).flatMap(g => g.buttons);
const expectRole = {
  admin: ["Nova nota", "Notas", "Notas a lançar", "Caixa", "Caixa Geral", "Caixa Especial", "Clientes", "Contas a receber", "Contas a pagar", "Fornecedores", "Resumo do dia", "Relatório", "HX por dia", "Compras", "Compras & IMEI", "Estoque", "Produtos", "Depósito Especial", "Usuários", "Segurança", "Sair"],
  financeiro: ["Notas a lançar", "Caixa", "Caixa Geral", "Clientes", "Contas a receber", "Contas a pagar", "Fornecedores", "Resumo do dia", "Compras & IMEI", "Segurança", "Sair"],
  vendedor: ["Nova nota", "Notas", "Estoque", "Segurança", "Sair"],
  estoque: ["Compras & IMEI", "Estoque", "Depósito Especial", "Segurança", "Sair"],
};
for (const [role, want] of Object.entries(expectRole)) {
  ok(labels(role).join("|") === want.join("|"), `${role} visible ${labels(role).join(", ")}`);
}
ok(visible("vendedor").every(g => g.heading !== "Financeiro"), "vendedor hides empty Financeiro");
ok(visible("estoque").every(g => g.heading !== "Notas" && g.heading !== "Financeiro"), "estoque hides empty Notas and Financeiro");
ok(visible("financeiro").some(g => g.heading === "Notas") && visible("financeiro").some(g => g.heading === "Financeiro"), "financeiro keeps Notas and Financeiro");
ok(labels("financeiro").includes("Sair") && !labels("financeiro").includes("Usuários"), "Sair not newly admin-only");
ok(/nav \.navg[\s\S]*g\.hidden = bs\.length > 0 && bs\.every\(b => b\.hidden\)/.test(js), "app hides empty groups");
ok(/function navMark\(/.test(js) && /aria-current/.test(js) && /navMark\(v\)/.test(js) && /navMark\("imei"\)/.test(js), "active page mark kept");
ok(css.includes(".ngh") && css.includes("@media(max-width:720px)") && css.includes("nav button.on") && /@media print[\s\S]*nav,button,header\{display:none!important\}/.test(css), "compact, responsive, active, print hide");
ok(html.includes("loja.css?v=20261105n") && html.includes("app.js?v=20261105n"), "cache version bumped");
ok(!html.includes("data-v=\"comprovante\""), "no invented comprovante button");

if (failed) { console.error(failed + " failed"); process.exit(1); }
console.log("nav groups ok");
