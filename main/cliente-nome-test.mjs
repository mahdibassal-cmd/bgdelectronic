/* Chave de nome do cliente e a trava na tela da loja. Sem banco. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const dir = dirname(fileURLToPath(import.meta.url));
const sandbox = {};
runInNewContext(readFileSync(join(dir, "cliente-nome.js"), "utf8"), sandbox, { filename: "cliente-nome.js" });
const CN = sandbox.BAGDA_CLIENTE_NOME;
let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.error("FAIL", m); } else console.log("ok", m); };

ok(CN.key("  Tiago   Belmónts ") === "tiago belmonts", "trim, collapse, strip accent, lowercase");
ok(CN.key("TIAGO BELMONTS") === CN.key("tiago belmonts") && CN.key("Tiago\tBelmonts") === "tiago belmonts", "case and tabs fold together");
ok(CN.key("José") === "jose" && CN.key("João") === "joao" && CN.key("Ação") === "acao", "portuguese accents");
ok(CN.key("a") === "a" && CN.key("  ") === "", "short and blank keys stay empty of meaning");
ok(CN.docKey("529.982.247-25") === "52998224725" && CN.docKey("") === "" && CN.docKey(null) === "", "doc keeps digits only");
ok(CN.telKey("(11) 98888-1111") === "11988881111" && CN.telKey("  ") === "" && CN.telKey(null) === "", "phone keeps digits only");

const lista = [
  { id: 43, nome: "tiago belmonts", telefone: "(11) 99999-0000", doc: "52998224725", ativo: true },
  { id: 49, nome: "brenda apple", telefone: "", doc: null, ativo: true },
  { id: 50, nome: "brenda apple", telefone: null, doc: null, ativo: true },
  { id: 2, nome: "João Lima", telefone: "11988881111", doc: null, ativo: false }
];
ok(CN.findNome(lista, "TIAGO  BELMONTS").id === 43, "finds tiago ignoring case and spaces");
ok(CN.findNome(lista, "Brenda Apple").id === 49, "existing pair resolves to the lowest id");
ok(CN.findNome(lista, "brenda apple", 49).id === 50, "rename check skips the row being edited");
ok(CN.findNome(lista, "joao lima").id === 2, "accent-insensitive name match includes inactive");
ok(CN.findNome(lista, "ninguém aqui") === null && CN.findNome(lista, "a") === null, "unknown and too-short names are not a hit");
ok(CN.findDoc(lista, "529.982.247-25").id === 43 && CN.findDoc(lista, "") === null && CN.findDoc(lista, null) === null, "filled CPF matches; blank CPF does not");
ok(CN.findTel(lista, "(11) 98888-1111").id === 2 && CN.findTel(lista, "") === null && CN.findTel(lista, "---") === null, "filled phone matches; empty phones do not match each other");
const nomeDup = CN.duplicata(lista, { nome: "Tiago Belmonts", telefone: "", doc: null });
ok(nomeDup && nomeDup.motivo === "nome" && nomeDup.id === 43, "duplicata prefers the name");
ok(CN.duplicata(lista, { nome: "Nova Pessoa", doc: "52998224725" }).motivo === "doc", "duplicata falls through to CPF");
ok(CN.duplicata(lista, { nome: "Nova Pessoa", telefone: "11 98888-1111" }).motivo === "tel", "duplicata falls through to phone");
ok(CN.duplicata(lista, { nome: "Nova Pessoa", telefone: "", doc: "" }) === null, "a new name with empty doc and phone is free");
ok(CN.mensagem(nomeDup) === "Já existe um cliente com esse nome: tiago belmonts (#43). Use o cadastro existente.", "name message matches the database sentence");
ok(CN.mensagem({ motivo: "doc", nome: "Maria", id: 1 }).includes("CPF/CNPJ: Maria (#1)"), "doc message names the existing client");
ok(CN.mensagem({ motivo: "tel", nome: "João Lima", id: 2 }).includes("telefone: João Lima (#2)"), "phone message names the existing client");
const noisy = "ERROR:  Já existe um cliente com esse nome: tiago belmonts (#43). Use o cadastro existente.\nCONTEXT: PL/pgSQL function tg_clientes_sem_duplicata()";
ok(CN.limparErro(noisy) === CN.mensagem(nomeDup) && CN.parseErro(noisy).id === 43 && CN.parseErro(noisy).motivo === "nome", "SQL noise reduces to the sentence and the id");
ok(CN.parseErro(CN.mensagem({ motivo: "tel", nome: "Ana", id: 9 })).motivo === "tel", "phone error parses");
ok(CN.parseErro("CPF/CNPJ inválido") === null, "other errors stay other errors");
ok(CN.consultas("  Tiago   Belmonts ").includes("Tiago Belmonts") && CN.consultas("Tiago Belmonts").includes("tiago") && CN.consultas("Tiago Belmonts").includes("belmonts"), "search tokens cover the full name and each word");

const app = readFileSync(join(dir, "app.js"), "utf8");
const html = readFileSync(join(dir, "index.html"), "utf8");
const sql = readFileSync(join(dir, "../supabase-loja/migration-cliente-nome-unico.sql"), "utf8");
ok(html.includes("cliente-nome.js?v=20261113a") && html.includes("app.js?v=20261113e") && html.indexOf("cliente-nome.js") < html.indexOf("app.js?v=20261113e"), "cache is the next tag after 20261111f and the helper loads first");
ok(!html.includes("app.js?v=20261111f"), "old app.js cache tag is gone");
const nota = app.slice(app.indexOf("async function viewNota"), app.indexOf("async function viewRecibo"));
ok(nota.includes("localizarClientePorNome") && nota.includes("Usar este cliente na nota") && nota.includes("escolherClienteBox") && nota.includes("parseErro"), "Nova nota blocks a duplicate name and offers the existing client, including when the database raises");
const clientes = app.slice(app.indexOf("async function viewClientes"), app.indexOf("async function viewFornecedores"));
ok(clientes.includes("clienteCadastroLivre") && clientes.indexOf("clienteCadastroLivre") < clientes.indexOf("api.criarCliente"), "Clientes page searches before insert");
ok(app.includes("Abrir o cadastro existente") && app.includes("async function localizarClienteDuplicado"), "rename/create on the client page can open the existing cadastro");
ok(app.includes("BAGDA_CLIENTE_NOME.duplicata") && app.includes("cliente_por_nome") && app.includes("limparErro"), "demo and live saves use the same key and surface the database sentence");
const kiosk = readFileSync(join(dir, "../kiosk/app.js"), "utf8");
ok(!kiosk.includes("BAGDA_CLIENTE_NOME") && !kiosk.includes("cliente_por_nome"), "kiosk sale screen is unchanged");
ok(sql.includes("Já existe um cliente com esse nome: % (#%). Use o cadastro existente.") && sql.includes("brenda apple") && sql.includes("trigger") && !/create unique index[^;]*cliente_nome_norm/i.test(sql), "migration uses a trigger, names the existing pair, and does not add a unique name index");
ok(!/delete from public\.clientes/i.test(sql) && sql.includes("unaccent") && sql.includes("translate"), "migration does not delete clients and falls back when unaccent is missing");

if (failed) { console.error(failed + " failed"); process.exit(1); }
console.log("cliente nome ui ok");
