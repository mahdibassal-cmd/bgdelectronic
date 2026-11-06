/* Reproduz a ambiguidade do PostgREST/Postgres. Não conecta em produção. */
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
const db = new PGlite();
let fails = 0, passes = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); c ? passes++ : fails++; };
const err = async q => { try { await db.query(q); return null; } catch (e) { return e.message; } };
await db.exec(`
  create type public.pay_method as enum ('PIX','DINHEIRO','CARTAO');
  create function public.criar_nota(p_forma public.pay_method, p_items jsonb, p_cliente text default null)
    returns text language sql as $$ select 'curta' $$;
  create function public.criar_nota(p_forma public.pay_method, p_items jsonb, p_cliente text default null, p_frete numeric default 0, p_caxinha_natal numeric default 0)
    returns text language sql as $$ select 'frete+caxinha' $$;
`);
const amb = await err(`select public.criar_nota('PIX'::public.pay_method, '[]'::jsonb, null)`);
ok(amb && /not unique|não é única|is not unique/i.test(amb), "3 args hit both overloads: " + amb);
const named = (await db.query(`select public.criar_nota(p_forma => 'PIX'::public.pay_method, p_items => '[{"sku":"S","qtd":1,"preco_vendido":10}]'::jsonb, p_cliente => null, p_frete => 0, p_caxinha_natal => 0) f`)).rows[0].f;
ok(named === "frete+caxinha", "naming both fees selects the full function: " + named);
const catalog = fs.readFileSync(new URL("../catalog-criar-nota-readonly.sql", import.meta.url), "utf8");
const code = catalog.replace(/--.*$/gm, "");
ok(!/drop function|create or replace|cascade/i.test(code), "catalog file does not drop or replace functions");
await db.exec("drop function public.criar_nota(public.pay_method, jsonb, text)");
const after = (await db.query(`select public.criar_nota('PIX'::public.pay_method, '[{"sku":"S","qtd":1,"preco_vendido":10}]'::jsonb, null) f`)).rows[0].f;
ok(after === "frete+caxinha", "after dropping the short signature, defaults still save a zero-fee note");
const ui = fs.readFileSync(new URL("../../../kiosk/app.js", import.meta.url), "utf8");
const fn = ui.slice(ui.indexOf("async criarNota(forma"), ui.indexOf("async nota("));
ok(fn.includes("p_frete: f") && fn.includes("p_caxinha_natal: c"), "kiosk always sends both fee arguments");
ok(!fn.includes('rpc("criar_nota", a)') || fn.includes("p_frete: f"), "zero-fee path no longer omits the fees");
ok(!/sem fee: chamada antiga/.test(fn), "old short call removed");
if (fails) { console.error(fails + " failed"); process.exit(1); }
console.log(passes + " passed");
