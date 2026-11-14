import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const dir = dirname(fileURLToPath(import.meta.url));
const js = readFileSync(join(dir, "prazo-vencimento.js"), "utf8");
const app = readFileSync(join(dir, "app.js"), "utf8");
const html = readFileSync(join(dir, "index.html"), "utf8");
const sql = readFileSync(join(dir, "..", "supabase-loja", "migration-prazo-vencimento.sql"), "utf8");
let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.error("FAIL", m); } else console.log("ok", m); };

eval(js);
const P = globalThis.BAGDA_PRAZO;
ok(!!P && P.DEFAULT_DIAS === 7 && P.MIN === 1 && P.MAX === 30, "BAGDA_PRAZO exports defaults 7 / 1–30");
ok(P.addDays("2026-11-11", 7) === "2026-11-18", "addDays 11/11 + 7 = 18/11");
ok(P.addDays("2026-11-11", 1) === "2026-11-12", "addDays 1 day");
ok(P.daysBetween("2026-11-11", "2026-11-18") === 7, "daysBetween");
ok(P.classificar("2026-11-08", "2026-11-11") === "vencida", "vencida when due date is past");
ok(P.classificar("2026-11-11", "2026-11-11") === "vence_hoje", "vence hoje");
ok(P.classificar("2026-11-12", "2026-11-11") === "vence_breve", "vence tomorrow is breve");
ok(P.classificar("2026-11-13", "2026-11-11") === "vence_breve", "vence in 2 days is breve");
ok(P.classificar("2026-11-14", "2026-11-11") === null, "vence in 3 days is not an alert");
ok(P.classificar(null, "2026-11-11") === null, "legacy note without vencimento is not a date alert");
ok(P.optionsHtml(7).includes('value="7" selected') && P.optionsHtml(7).includes('value="30"') && P.optionsHtml(7).includes(">1 dia<"), "selector lists 1–30 dias, default 7");

const cob = P.montar({
  hoje: "2026-11-11",
  clientes: [
    { id: 1, nome: "Maria Souza", limite_prazo: 500 },
    { id: 2, nome: "João Lima", limite_prazo: null },
    { id: 3, nome: "Pedro Pago", limite_prazo: null },
    { id: 4, nome: "Sofia Prado", limite_prazo: 1000 }
  ],
  notas: [
    { nota_id: 101, cliente_id: 1, nome: "Maria Souza", em_aberto: 650, vencimento: "2026-11-06", prazo_dias: 7 },
    { nota_id: 102, cliente_id: 2, nome: "João Lima", em_aberto: 420, vencimento: "2026-11-11", prazo_dias: 1 },
    { nota_id: 103, cliente_id: 2, nome: "João Lima", em_aberto: 80, vencimento: null, prazo_dias: null },
    { nota_id: 104, cliente_id: 3, nome: "Pedro Pago", em_aberto: 0, vencimento: "2026-11-01", prazo_dias: 7 },
    { nota_id: 105, cliente_id: 4, nome: "Sofia Prado", em_aberto: 1500, vencimento: "2026-11-26", prazo_dias: 15 }
  ]
});
ok(cob.n_clientes === 3 && cob.n_vencidas === 1 && cob.n_vence_hoje === 1 && cob.n_limite === 2, "montar counts: " + JSON.stringify({ n: cob.n_clientes, v: cob.n_vencidas, h: cob.n_vence_hoje, l: cob.n_limite }));
ok(cob.clientes.some(c => c.nome === "Maria Souza" && c.tem_vencida && c.no_limite && c.notas[0].dias_atraso === 5), "Maria is vencida (5 days) and over limite");
ok(cob.clientes.some(c => c.nome === "João Lima" && c.tem_vence_hoje && c.notas.some(n => n.nota_id === 103 && n.classe == null)), "João includes legacy undated nota but is listed because of vence hoje");
ok(!cob.clientes.some(c => c.nome === "Pedro Pago"), "fully paid nota is not listed");
ok(cob.clientes.some(c => c.nome === "Sofia Prado" && c.no_limite && !c.tem_vencida && !c.tem_vence_hoje), "Sofia is only over the limite");
const all = P.montar({
  hoje: "2026-11-11",
  todos: true,
  clientes: [
    { id: 2, nome: "João Lima", limite_prazo: null },
    { id: 8, nome: "Ana Clara", limite_prazo: null }
  ],
  notas: [
    { nota_id: 201, cliente_id: 2, nome: "João Lima", em_aberto: 80, vencimento: null, prazo_dias: null },
    { nota_id: 202, cliente_id: 8, nome: "Ana Clara", em_aberto: 200, vencimento: "2026-12-01", prazo_dias: 20 },
    { nota_id: 203, cliente_id: 8, nome: "Ana Clara", em_aberto: 0, vencimento: "2026-11-01", prazo_dias: 7 }
  ]
});
ok(all.n_clientes === 2 && all.clientes.some(c => c.nome === "João Lima" && c.notas[0].classe == null) && all.clientes.some(c => c.nome === "Ana Clara" && c.notas.length === 1 && c.notas[0].nota_id === 202), "montar todos lists every unpaid nota, including undated and not-yet-due");

ok(html.includes("prazo-vencimento.js?v=20261114a") && html.includes("app.js?v=20261114d"), "cache 20261111e for the new helper and app");
ok(html.indexOf("prazo-vencimento.js") < html.indexOf("app.js?v=20261114d"), "prazo helper loads before the app");
ok(app.includes('id="prazobox"') && app.includes('id="pagaem"') && app.includes("Paga em *"), "Nova nota has required Paga em selector");
ok(app.includes("prazoNeed") && app.includes("prazoSync") && app.includes("p_prazo_dias"), "selector is shown for prazo and sent as p_prazo_dias");
ok(app.includes("Informe em quantos dias o cliente paga (1 a 30)"), "Paga em is required before saving a prazo note");
ok(app.includes("id=\"cobranca\"") && app.includes("Cobrança") && app.includes("refreshCobrancaBadge") && app.includes("rec-badge"), "Contas a receber has a Cobrança panel and a nav badge");
ok(app.includes('class="cob-nota"') && app.includes('class="cob-cli"') && app.includes("viewRecibo(+a.dataset.n") && app.includes("viewClienteExtrato(+a.dataset.c"), "Cobrança nota numbers and client names open the existing viewers");
ok(app.includes("me.role === \"vendedor\"") && app.includes("refreshCobrancaBadge") && app.includes("can(\"financas\")"), "badge is skipped for vendedores");
ok(app.includes("Limite Paga Depois") && app.includes("limite_prazo"), "Clientes form and API expose limite_prazo");
ok(app.includes("Carlos Mendes") && app.includes("Rita Alves") && app.includes("Sofia Prado") && app.includes("Pedro Pago"), "mock seeds cobrança example rows");
ok(app.includes("migration-prazo-vencimento.sql") && app.includes("pendente_sql"), "live API degrades with a hint if the draft SQL is not applied");
ok(sql.includes("Aplicado") && sql.includes("OK do MB") && sql.includes("p_prazo_dias") && sql.includes("cobranca_alertas") && sql.includes("limite_prazo"), "applied migration has columns, RPC and release note");
ok(/criar_nota_local\(jsonb, jsonb, text, bigint, text, text, numeric, numeric, integer\)/.test(sql), "9-arg criar_nota_local is granted");
ok(sql.includes("não substitu") || /Nao substitui|Não substitui/i.test(sql), "migration does not replace core note RPCs");
ok(sql.includes("recebimento_notas") && sql.includes("vencimento is null"), "alerts use allocations and ignore notes without a due date");

if (failed) { console.error(failed + " failed"); process.exit(1); }
console.log("prazo vencimento ui ok");
