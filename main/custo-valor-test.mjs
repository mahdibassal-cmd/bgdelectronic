/* Custo unitário atual: validação, tela só admin, e a policy já existente. Não grava produção. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const dir = dirname(fileURLToPath(import.meta.url));
const read = name => readFileSync(join(dir, name), "utf8");
const sandbox = {};
runInNewContext(read("custo-valor.js"), sandbox, { filename: "custo-valor.js" });
const { parseCusto, sameCents } = sandbox.BAGDA_CUSTO;
let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.error("FAIL", m); } else console.log("ok", m); };

ok(parseCusto("").error && parseCusto("   ").error && parseCusto(null).error, "empty cost is rejected");
ok(parseCusto("-1").error && parseCusto("-0,01").error && parseCusto("abc").error && parseCusto("10.509").error, "negative, text, and extra decimals are rejected");
ok(parseCusto("0").value === 0 && parseCusto("0,00").value === 0, "explicit zero is kept only when typed");
ok(parseCusto("10,50").value === 10.5 && parseCusto("10.50").value === 10.5 && parseCusto("R$ 1.234,56").value === 1234.56, "BRL decimals parse to cents");
ok(parseCusto("99999999.99").value === 99999999.99 && parseCusto("100000000").error, "value stays inside numeric(10,2)");
ok(sameCents("10.50", 10.5) && !sameCents(10.5, 10.51), "reread compares cents");

const app = read("app.js");
const realStart = app.indexOf("async custoSalvar(sku, custo)");
const real = app.slice(realStart, app.indexOf("async repSeller", realStart));
ok(real.includes('from("product_costs")') && real.includes('.eq("sku", sku)') && real.includes("não foi confirmado"), "save writes one cost row and rereads it");
ok(!real.includes("preco_venda") && !real.includes("purchases") && !real.includes("sale_costs") && !/estoque\s*=/.test(real), "save does not touch sale price, stock, purchases, or past sale costs");
const mockMark = app.indexOf('if (qs.has("failcusto"))');
const mock = app.slice(app.lastIndexOf("async custoSalvar", mockMark), app.indexOf("async estoqueVendedor", mockMark));
ok(mock.includes('role !== "admin"') && mock.includes("failcusto") && mock.includes("p.estoque !== est") && mock.includes("p.preco_venda !== preco"), "mock refuses non-admin, simulated failure, and stock or price drift");

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const mockFn = new AsyncFunction("role", "qs", "P", "K", "sku", "custo", mock.slice(mock.indexOf("{") + 1, mock.lastIndexOf("}")));
const product = { sku: "APL-001", estoque: 5, preco_venda: 1000 };
const K = { "APL-001": 600 };
const qs = { has: () => false };
let denied = "";
try { await mockFn("vendedor", qs, [product], K, "APL-001", 12); } catch (e) { denied = e.message; }
ok(denied === "Sem permissão" && K["APL-001"] === 600 && product.estoque === 5 && product.preco_venda === 1000, "non-admin mock write is rejected and changes nothing");
const saved = await mockFn("admin", qs, [product], K, "APL-001", 12.5);
ok(saved.sku === "APL-001" && saved.custo === 12.5 && K["APL-001"] === 12.5 && product.estoque === 5 && product.preco_venda === 1000, "admin mock save updates only that SKU cost");
let failedSave = "";
const K2 = { "APL-001": 12.5 };
try { await mockFn("admin", { has: k => k === "failcusto" }, [product], K2, "APL-001", 99); } catch (e) { failedSave = e.message; }
ok(failedSave.includes("Falha simulada") && K2["APL-001"] === 12.5, "failed save does not change the cost");

const schema = readFileSync(join(dir, "../supabase-loja/schema.sql"), "utf8");
const policy = schema.slice(schema.indexOf("policy costs_admin"), schema.indexOf("policy purchases_admin"));
ok(/for all to authenticated/.test(policy) && policy.includes("public.can('admin')") && policy.includes("with check (public.can('admin'))"), "existing cost policy is admin-only for every command");
ok(/custo numeric\(10,2\) not null check \(custo >= 0\)/.test(schema), "stored cost rejects null and negative");
const salePolicy = schema.slice(schema.indexOf("policy sale_costs_admin"), schema.indexOf("policy notas_read"));
ok(/for select to authenticated/.test(salePolicy) && !/for all/.test(salePolicy), "historical sale costs stay read-only");
ok(!/grant .*product_costs.* to anon/.test(schema), "anon has no cost grant");

const view = app.slice(app.indexOf("async function viewEstoque"), app.indexOf("async function viewRelatorio"));
ok(view.includes("if (adm)") && view.includes("await api.costs()") && view.includes("Editar custo"), "stock screen loads cost only for admin");
const seller = view.slice(view.indexOf("const rowSeller"), view.indexOf("const row ="));
ok(!seller.includes("Editar custo") && !seller.includes("product_costs"), "seller markup has no cost button");
const kiosk = readFileSync(join(dir, "../kiosk/app.js"), "utf8");
ok(!kiosk.includes("Editar custo") && !kiosk.includes("custoSalvar"), "kiosk has no cost editor");

if (failed) { console.error(failed + " failed"); process.exit(1); }
console.log("custo valor ok");
