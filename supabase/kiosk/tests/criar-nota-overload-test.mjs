/* Kiosk criar_nota: ambiguidade real e teto de 30. Não conecta em produção. */
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
const db = new PGlite();
let fails = 0, passes = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); c ? passes++ : fails++; };
const err = async q => { try { await db.exec(q); return null; } catch (e) { return e.message; } };
const one = async q => (await db.query(q)).rows[0];
const fix = fs.readFileSync(new URL("../fix-criar-nota-overload.sql", import.meta.url), "utf8");
const back = fs.readFileSync(new URL("../rollback-criar-nota-overload.sql", import.meta.url), "utf8");
const code = fix.replace(/--.*$/gm, "");
ok(!/cascade/i.test(code), "apply SQL has no CASCADE");
ok(/drop function public\.criar_nota\(public\.pay_method, jsonb, text\) restrict;/.test(code), "drops only the 3-arg signature with RESTRICT");
ok(!/drop trigger|tg_sale_insert/i.test(code), "apply SQL does not touch the stock trigger");
ok(!/criar_nota_local/.test(code), "does not touch criar_nota_local");
ok(!/>\s*30/.test(code), "apply SQL does not keep the 30-line cap");
ok(/>\s*30/.test(back), "rollback restores the audited cap");

await db.exec(`
  create type public.pay_method as enum ('Débito','Crédito','Dinheiro','PIX');
  create table public.notas (
    id bigint generated always as identity primary key,
    forma_pagamento public.pay_method,
    cliente text,
    frete numeric(12,2) not null default 0,
    caxinha_natal numeric(12,2) not null default 0
  );
  create table public.sales (
    id bigint generated always as identity primary key,
    nota_id bigint,
    sku text,
    qtd int,
    preco_vendido numeric,
    forma_pagamento public.pay_method
  );
  create function public.criar_nota(p_forma public.pay_method, p_items jsonb, p_cliente text default null)
  returns bigint language plpgsql security invoker set search_path = '' as $f$
  begin
    if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 30 then
      raise exception 'Nota sem itens' using errcode = 'P0001';
    end if;
    return 1;
  end $f$;
`);
await db.exec("create role anon nologin; create role authenticated nologin; create role service_role nologin;");
const live5 = `
  create function public.criar_nota(p_forma public.pay_method, p_items jsonb, p_cliente text default null, p_frete numeric default 0, p_caxinha_natal numeric default 0)
  returns bigint language plpgsql security invoker set search_path = '' as $f$
  declare v_id bigint; it jsonb; v_frete numeric := round(coalesce(p_frete, 0), 2); v_cx numeric := round(coalesce(p_caxinha_natal, 0), 2);
  begin
    if v_frete < 0 then raise exception 'Frete inválido' using errcode = 'P0001'; end if;
    if v_cx < 0 then raise exception 'Caxinha d Natal inválido' using errcode = 'P0001'; end if;
    if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 30
       or (jsonb_array_length(p_items) = 0 and v_frete <= 0 and v_cx <= 0) then
      raise exception 'Nota sem itens' using errcode = 'P0001';
    end if;
    insert into public.notas(forma_pagamento, cliente, frete, caxinha_natal) values (p_forma, nullif(trim(p_cliente), ''), v_frete, v_cx) returning id into v_id;
    for it in select * from jsonb_array_elements(p_items) loop
      insert into public.sales(nota_id, sku, qtd, preco_vendido, forma_pagamento)
      values (v_id, it->>'sku', (it->>'qtd')::int, (it->>'preco_vendido')::numeric, p_forma);
    end loop;
    return v_id;
  end $f$;
`;
await db.exec(live5);
const amb = await err(`select public.criar_nota('PIX'::public.pay_method, '[{"sku":"S","qtd":1,"preco_vendido":10}]'::jsonb, null)`);
ok(amb && /not unique|não é única|is not unique/i.test(amb), "zero-fee call is ambiguous: " + amb);
const items31 = JSON.stringify(Array.from({ length: 31 }, () => ({ sku: "S", qtd: 1, preco_vendido: 10 })));
const capped = await err(`select public.criar_nota('PIX'::public.pay_method, '${items31}'::jsonb, null, 0, 0)`);
ok(capped && /Nota sem itens/.test(capped), "live 5-arg still blocks 31 lines: " + capped);
ok(/pg_depend/.test(code) && /deptype in \('n', 'a'\)/.test(code), "apply SQL refuses the drop when a normal or auto dependency exists");
await db.exec(fix);
await db.exec(`
  create function public.tg_sale_insert() returns trigger language plpgsql as $f$
  begin
    if new.qtd is null or new.qtd <= 0 then
      raise exception 'Estoque insuficiente ou produto inativo' using errcode = 'P0001';
    end if;
    return new;
  end $f$;
  create trigger sale_bi before insert on public.sales for each row execute function public.tg_sale_insert();
`);
const left = await db.query("select pg_get_function_identity_arguments(p.oid) a from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='criar_nota'");
ok(left.rows.length === 1 && /p_caxinha_natal numeric$/.test(left.rows[0].a), "only the 5-arg function remains: " + JSON.stringify(left.rows));
ok(Number((await one("select has_function_privilege('anon', 'public.criar_nota(public.pay_method, jsonb, text, numeric, numeric)', 'execute')::int n")).n) === 0, "anon still has no execute");
ok(Number((await one("select has_function_privilege('authenticated', 'public.criar_nota(public.pay_method, jsonb, text, numeric, numeric)', 'execute')::int n")).n) === 1, "authenticated keeps execute");
ok(Number((await one("select has_function_privilege('service_role', 'public.criar_nota(public.pay_method, jsonb, text, numeric, numeric)', 'execute')::int n")).n) === 1, "service_role keeps execute");
const saved = await one(`select public.criar_nota('Dinheiro'::public.pay_method, '${items31}'::jsonb, 'sint', 0, 0) id`);
ok(Number(saved.id) > 0, "31 lines save after the cap is removed");
ok(Number((await one("select count(*)::int n from public.sales")).n) === 31, "each line is still inserted");
const badQty = await err(`select public.criar_nota('PIX'::public.pay_method, '[{"sku":"S","qtd":0,"preco_vendido":10}]'::jsonb, null, 0, 0)`);
ok(badQty && /Estoque insuficiente ou produto inativo/.test(badQty), "existing sale trigger still rejects a non-positive quantity");
const empty = await err(`select public.criar_nota('PIX'::public.pay_method, '[]'::jsonb, null, 0, 0)`);
ok(empty && /Nota sem itens/.test(empty), "empty cart with no fees is still rejected");
const bad = await err(`select public.criar_nota('PIX'::public.pay_method, '"nao-array"'::jsonb, null, 0, 0)`);
ok(bad && /Nota sem itens/.test(bad), "malformed items are still rejected");
const neg = await err(`select public.criar_nota('PIX'::public.pay_method, '[]'::jsonb, null, -1, 0)`);
ok(neg && /Frete inválido/.test(neg), "negative freight is still rejected");
const onlyFee = await one(`select public.criar_nota('PIX'::public.pay_method, '[]'::jsonb, null, 12.5, 0) id`);
const feeRow = await one(`select frete::float8 frete, caxinha_natal::float8 cx from public.notas where id = ${onlyFee.id}`);
ok(feeRow.frete === 12.5 && feeRow.cx === 0 && Number((await one("select count(*)::int n from public.sales where nota_id = " + onlyFee.id)).n) === 0, "freight-only note stores frete and no sale line");
const ui = fs.readFileSync(new URL("../../../kiosk/app.js", import.meta.url), "utf8");
const fn = ui.slice(ui.indexOf("async criarNota(forma"), ui.indexOf("async nota("));
ok(fn.includes("p_frete: f") && fn.includes("p_caxinha_natal: c") && !/sem fee: chamada antiga/.test(fn), "client names both fees; that does not replace the database cleanup");
if (fails) { console.error(fails + " failed"); process.exit(1); }
console.log(passes + " passed");
