// Pagamento de compra (agora / depois) e contas a pagar. PGlite, sem produção.
import { readFileSync } from "node:fs";
const { PGlite } = await import("@electric-sql/pglite").catch(() => import("/tmp/pgdeps/node_modules/@electric-sql/pglite/dist/index.js"));

const sql = readFileSync(new URL("../migration-compras-pagamento.sql", import.meta.url), "utf8");
const db = new PGlite();
let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.error("FAIL", m); } else console.log("ok", m); };
const mike = "00000000-0000-0000-0000-00000000000a";
const pam = "00000000-0000-0000-0000-00000000000b";
const kaio = "00000000-0000-0000-0000-00000000000d";

await db.exec(`
create role anon nologin;
create role authenticated nologin;
create schema if not exists auth;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt()->>'sub','')::uuid $$;
create table public.profiles(id uuid primary key, role text, ativo boolean default true, handle text, nome text);
create table public.role_perms(role text, perm text);
insert into public.profiles values ('${mike}','admin',true,'@mike','Mike'), ('${pam}','financeiro',true,'@pamela','Pamela'), ('${kaio}','vendedor',true,'@kaio','Kaio');
insert into public.role_perms values
  ('admin','admin'),('admin','caixa'),('admin','financas'),
  ('financeiro','caixa'),('financeiro','financas'),
  ('vendedor','vendas');
create function public.has_perm(p text) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles pr join public.role_perms rp on rp.role = pr.role
    where pr.id = auth.uid() and pr.ativo and rp.perm = p) $$;
create function public.can(p text) returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_perm(p) $$;
create function public.caixa_acesso() returns boolean language sql stable security definer set search_path = '' as $$
  select public.can('caixa')
     and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role::text = 'vendedor');
$$;
create table public.caixas(id smallint primary key, nome text, metodo text, ativo boolean default true, somente_admin boolean not null default false);
insert into public.caixas values
  (1, 'Caixa Dinheiro', 'dinheiro', true, false),
  (12, 'GASTOS LOJA', null, true, false),
  (17, 'PAGAMENTO PRODUTOS', null, true, true),
  (99, 'Fechado', 'dinheiro', false, false);
create type public.mov_tipo as enum ('venda','entrada','saida','estorno');
create table public.caixa_movimentos(
  id bigint generated always as identity primary key,
  caixa_id smallint not null, tipo public.mov_tipo not null, valor numeric not null check (valor > 0),
  motivo text, forma text, user_id uuid, data date, created_at timestamptz, nota_id bigint);
create function public.tg_mov_insert() returns trigger language plpgsql as $$
begin
  new.user_id := coalesce(auth.uid(), new.user_id);
  new.data := coalesce(new.data, (now() at time zone 'America/Sao_Paulo')::date);
  new.created_at := coalesce(new.created_at, now());
  return new;
end $$;
create trigger mov_bi before insert on public.caixa_movimentos for each row execute function public.tg_mov_insert();
create function public.caixa_saldo_calc(p_caixa smallint) returns numeric language sql stable as $$
  select coalesce(sum(case when tipo in ('venda','entrada') then valor else -valor end), 0)
  from public.caixa_movimentos where caixa_id = p_caixa;
$$;
create table public.products(sku text primary key, estoque int not null default 0);
insert into public.products(sku, estoque) values ('JBL-001', 5), ('APL-001', 1);
create table public.fornecedores(id bigint generated always as identity primary key, nome text);
create table public.compras(
  id bigint generated always as identity primary key,
  lote uuid unique, data date, fornecedor text, observacao text, created_by uuid, created_at timestamptz default now());
create function public.compra_numero(p_id bigint) returns text language sql immutable as $$
  select 'C-' || lpad(p_id::text, 6, '0') $$;
create table public.purchases(
  id bigint generated always as identity primary key,
  data date, sku text, fornecedor text, qtd int, custo_unit numeric, observacao text,
  compra_lote uuid, compra_id bigint, origem text, preco_usd numeric, custo_usd numeric, taxa_dolar numeric,
  total numeric generated always as (qtd * custo_unit) stored);
create function public.purchase_compra_bi() returns trigger language plpgsql as $$
declare v bigint;
begin
  if new.compra_id is null then
    select id into v from public.compras where lote = new.compra_lote;
    if v is null then
      insert into public.compras(lote, data, fornecedor, observacao)
      values (new.compra_lote, new.data, new.fornecedor, new.observacao) returning id into v;
    end if;
    new.compra_id := v;
  end if;
  return new;
end $$;
create trigger purchase_compra_bi before insert on public.purchases for each row execute function public.purchase_compra_bi();
create function public.tg_stock() returns trigger language plpgsql as $$
begin
  update public.products set estoque = estoque + new.qtd where sku = new.sku;
  return null;
end $$;
create trigger purchase_ai after insert on public.purchases for each row execute function public.tg_stock();
create table public.security_events(
  id bigint generated always as identity primary key, at timestamptz default now(),
  kind text not null, actor uuid, email text, detail jsonb not null default '{}', alerted boolean not null default false);
alter table public.security_events add constraint security_events_kind_check check (kind in ('fin_pagamento')) not valid;
create function public.fin_log(p_kind text, p_detail jsonb) returns void language plpgsql as $$
begin
  insert into public.security_events(kind, actor, detail) values (p_kind, auth.uid(), p_detail);
end $$;
`);

try { await db.exec(sql); } catch (e) { console.error("SQL FAIL", e.message); process.exit(1); }

const as = async id => db.exec(`select set_config('request.jwt.claims', '{"sub":"${id}"}', false)`);
const one = async q => (await db.query(q)).rows[0];
const num = async q => Number(Object.values(await one(q))[0]);
const err = async q => { try { await db.query(q); return ""; } catch (e) { return e.message; } };
const hdr = (extra = {}) => JSON.stringify({ fornecedor: "Distribuidora Tech SP", data: "2026-11-13", ...extra }).replace(/'/g, "''");
const item = (extra = {}) => JSON.stringify([{ sku: "JBL-001", qtd: 2, custo_unit: 100, origem: "Nacional", ...extra }]).replace(/'/g, "''");

await as(mike);
await db.query(`insert into caixa_movimentos(caixa_id, tipo, valor, motivo) values (1, 'entrada', 1000, 'Fundo'), (17, 'entrada', 5000, 'Produtos'), (12, 'entrada', 30, 'Gastos')`);
ok(await num("select caixa_saldo_calc(1::smallint)") === 1000, "dinheiro starts at 1000");
ok(await num("select estoque from products where sku = 'JBL-001'") === 5, "stock starts at 5");

const pol = await one(`select pg_get_expr(polqual, polrelid) as u from pg_policy where polname = 'compra_pag_ler'`);
ok(/\( ?SELECT can\(/.test(pol.u) && /compra_pag_visivel/.test(pol.u), "RLS wraps the permission call: " + pol.u);

await as(kaio);
let e = await err(`select public.registrar_compra_pagamento('${hdr({ pagamento: "depois" })}'::jsonb, '${item()}'::jsonb)`);
ok(/Só admin registra compra/.test(e), "seller cannot save a compra: " + e);
ok(await num("select count(*) from purchases") === 0, "refused seller save writes no purchase");

await as(pam);
e = await err(`select public.registrar_compra_pagamento('${hdr({ pagamento: "depois" })}'::jsonb, '${item()}'::jsonb)`);
ok(/Só admin registra compra/.test(e), "financeiro cannot register a compra: " + e);

await as(mike);
e = await err(`select public.registrar_compra_pagamento('${hdr()}'::jsonb, '${item()}'::jsonb)`);
ok(/Escolha a forma de pagamento/.test(e), "new rpc requires a payment choice: " + e);
ok(await num("select count(*) from purchases") === 0, "missing payment writes nothing");

e = await err(`select public.registrar_compra_pagamento('${hdr({ pagamento: "agora", caixa_id: 12 })}'::jsonb, '${item()}'::jsonb)`);
ok(/Saldo insuficiente/.test(e), "pay now blocks when saldo is short: " + e);
ok(await num("select count(*) from purchases") === 0 && await num("select estoque from products where sku = 'JBL-001'") === 5, "short saldo rolls the compra and the stock back");
ok(await num("select count(*) from caixa_movimentos where tipo = 'saida'") === 0, "short saldo writes no saida");

const legado = await one(`select public.registrar_compra_lote('${hdr()}'::jsonb, '${item()}'::jsonb) as r`);
ok(legado.r.pagamento_ok === false && legado.r.origem_ok === true, "lote without payment stays legacy");
ok(await num("select count(*) from compras where pagamento is null") === 1, "legacy row has null pagamento");
const legadoId = legado.r.compra_id;
e = await err(`select public.compra_pagar(${legadoId}::bigint, 10::numeric, 1::smallint)`);
ok(/Compra antiga sem controle de pagamento/.test(e), "legacy compra cannot be paid later: " + e);

const depois = await one(`select public.registrar_compra_pagamento('${hdr({ pagamento: "depois", vencimento: "2026-11-01" })}'::jsonb, '${item()}'::jsonb) as r`);
ok(depois.r.pagamento === "depois" && depois.r.pagamento_ok === true, "pay later returns pagamento depois");
ok(await num(`select count(*) from caixa_movimentos where motivo like 'Compra ${depois.r.numero}%'`) === 0, "pay later creates no caixa movement");
ok((await one(`select vencimento::text from compras where id = ${depois.r.compra_id}`)).vencimento === "2026-11-01", "optional due date is stored");

const lista1 = await one(`select public.compras_pendentes() as r`);
const g1 = lista1.r.grupos.find(g => g.fornecedor === "Distribuidora Tech SP");
ok(g1 && g1.compras.some(c => c.numero === depois.r.numero && c.atrasada && Number(c.restante) === 200), "overdue pay-later shows in the supplier group");
ok(!lista1.r.grupos.some(g => g.compras.some(c => c.id === legadoId)), "legacy compra is not pending");

e = await err(`select public.registrar_compra_pagamento('${hdr({ pagamento: "agora", caixa_id: 1, taxa_dolar: 5.4 })}'::jsonb, '${JSON.stringify([{ sku: "APL-001", qtd: 1, origem: "Importado", custo_usd: 80 }])}'::jsonb)`);
ok(e === "", "importado pay now with the compra rate saves: " + e);
const imp = await one(`select custo_unit::float8 from purchases where sku = 'APL-001' order by id desc limit 1`);
ok(Math.round(imp.custo_unit * 100) === 43200, "importado line stores US$ x taxa (80 x 5.40 = 432)");

const agora = await one(`select public.registrar_compra_pagamento('${hdr({ pagamento: "agora", caixa_id: 17 })}'::jsonb, '${item()}'::jsonb) as r`);
ok(agora.r.pagamento === "agora" && Number(agora.r.total) === 200, "pay now from PAGAMENTO PRODUTOS");
const saida = await one(`select tipo::text, valor::float8, motivo, forma from caixa_movimentos where caixa_id = 17 and tipo = 'saida'`);
ok(saida.tipo === "saida" && saida.valor === 200 && saida.motivo.includes(agora.r.numero) && saida.motivo.includes("Distribuidora Tech SP"), "saida names the compra and the fornecedor: " + saida.motivo);
ok(await num("select caixa_saldo_calc(17::smallint)") === 4800, "admin caixa saldo dropped by the compra");
const lista2 = await one(`select public.compras_pendentes() as r`);
ok(!lista2.r.grupos.some(g => g.compras.some(c => c.numero === agora.r.numero)), "fully paid compra leaves the pending list");
ok(lista2.r.pagas.some(c => c.numero === agora.r.numero && c.pagamentos[0].caixa === "PAGAMENTO PRODUTOS"), "admin history shows the admin-only caixa");

await as(pam);
const cxFin = await one(`select public.compras_caixas_pagamento() as r`);
ok(cxFin.r.some(c => c.caixa_id === 1) && !cxFin.r.some(c => c.caixa_id === 17), "financeiro caixa list hides PAGAMENTO PRODUTOS");
e = await err(`select public.compra_pagar(${depois.r.compra_id}::bigint, 50::numeric, 17::smallint)`);
ok(/Caixa inválido/.test(e), "financeiro cannot pay from an admin-only caixa: " + e);
ok(await num("select count(*) from compra_pagamentos where compra_id = " + depois.r.compra_id) === 0, "refused admin-caixa payment writes nothing");

const parcial = await one(`select public.compra_pagar(${depois.r.compra_id}::bigint, 80::numeric, 1::smallint) as r`);
ok(Number(parcial.r.restante) === 120 && Number(parcial.r.valor) === 80, "partial payment leaves the remainder");
ok(await num("select caixa_saldo_calc(1::smallint)") === 488, "dinheiro saldo dropped by the partial (1000 - 432 importado - 80)");
e = await err(`select public.compra_pagar(${depois.r.compra_id}::bigint, 500::numeric, 1::smallint)`);
ok(/Pagamento maior que o saldo da compra/.test(e), "overpay is refused: " + e);

const vista = await one(`select public.compras_pendentes() as r`);
const row = vista.r.grupos.flatMap(g => g.compras).find(c => c.id === depois.r.compra_id);
ok(row && Number(row.pago) === 80 && Number(row.restante) === 120 && row.pagamentos.length === 1 && row.pagamentos[0].caixa === "Caixa Dinheiro", "pending row keeps payment history");

await as(mike);
await db.query(`select public.compra_pagar(${depois.r.compra_id}::bigint, 20::numeric, 17::smallint)`);
await as(pam);
const oculto = await one(`select public.compras_pendentes() as r`);
const hist = oculto.r.grupos.flatMap(g => g.compras).find(c => c.id === depois.r.compra_id).pagamentos;
const admPay = hist.find(p => p.caixa_oculto);
ok(admPay && admPay.caixa == null && Number(admPay.valor) === 20, "financeiro sees the amount paid from an admin caixa without the caixa name");
ok(Number(oculto.r.grupos.flatMap(g => g.compras).find(c => c.id === depois.r.compra_id).restante) === 100, "remainder counts the hidden admin payment");

await as(pam);
await db.exec("set role authenticated");
const vis = await db.query("select caixa_id from public.compra_pagamentos");
ok(vis.rows.every(r => r.caixa_id !== 17) && vis.rows.some(r => r.caixa_id === 1), "RLS hides admin-caixa payment rows from financeiro");
await db.exec("reset role");
await as(mike);
await db.exec("set role authenticated");
const visAdm = await db.query("select caixa_id from public.compra_pagamentos where caixa_id = 17");
ok(visAdm.rows.length >= 1, "admin can read the admin-caixa payment rows");
await db.exec("reset role");

await db.exec("reset role");
await as(mike);
const antesDiv = await num("select caixa_saldo_calc(17::smallint)");
const nPurch = await num("select count(*) from purchases");
e = await err(`select public.registrar_compra_pagamento('${hdr({ pagamento: "divida", caixa_id: 1 })}'::jsonb, '${item()}'::jsonb)`);
ok(/Dívida só no caixa especial/.test(e), "debt on a normal caixa is refused: " + e);
ok(await num("select count(*) from purchases") === nPurch, "refused debt writes no purchase");
const big = JSON.stringify([{ sku: "JBL-001", qtd: 1, custo_unit: 10000, origem: "Nacional" }]).replace(/'/g, "''");
const dv = await one(`select public.registrar_compra_pagamento('${hdr({ pagamento: "divida", caixa_id: 17 })}'::jsonb, '${big}'::jsonb) as r`);
ok(dv.r.pagamento === "divida" && dv.r.pagamento_ok === true, "admin debt option returns divida");
const saldoDiv = await num("select caixa_saldo_calc(17::smallint)");
ok(saldoDiv === antesDiv - 10000 && saldoDiv < 0, "admin caixa goes negative without a saldo block (" + antesDiv + " -> " + saldoDiv + ")");
const mot = await one(`select motivo from caixa_movimentos where caixa_id = 17 and motivo like 'Dívida%' order by id desc limit 1`);
ok(mot.motivo.includes(dv.r.numero) && mot.motivo.includes("Distribuidora Tech SP"), "debt saida names the compra and the fornecedor: " + mot.motivo);
const listaDiv = await one(`select public.compras_pendentes() as r`);
ok(!listaDiv.r.grupos.some(g => g.compras.some(c => c.numero === dv.r.numero)), "a debt compra is not left as payable to the supplier");
ok(await num("select count(*) from purchases") === nPurch + 1, "the debt compra itself was saved");
await as(pam);
e = await err(`select public.registrar_compra_pagamento('${hdr({ pagamento: "divida", caixa_id: 17 })}'::jsonb, '${item()}'::jsonb)`);
ok(/Só admin registra compra/.test(e), "financeiro cannot launch a debt compra: " + e);

if (failed) { console.error(failed + " failed"); process.exit(1); }
console.log("compras pagamento ok");
