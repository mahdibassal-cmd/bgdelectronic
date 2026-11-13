// Câmbio pago trava o custo do Importado. PGlite, sem produção.
import { readFileSync } from "node:fs";
const { PGlite } = await import("@electric-sql/pglite").catch(() => import("/tmp/pgdeps/node_modules/@electric-sql/pglite/dist/index.js"));

const read = name => readFileSync(new URL("../" + name, import.meta.url), "utf8");
const db = new PGlite();
let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.error("FAIL", m); } else console.log("ok", m); };
const mike = "00000000-0000-0000-0000-00000000000a";
const pam = "00000000-0000-0000-0000-00000000000b";

await db.exec(`
create role anon nologin;
create role authenticated nologin;
grant usage on schema public to anon, authenticated;
create schema if not exists auth;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt()->>'sub','')::uuid $$;
create table public.profiles(id uuid primary key, role text, ativo boolean default true, handle text, nome text);
create table public.role_perms(role text, perm text);
insert into public.profiles values ('${mike}','admin',true,'@mike','Mike'), ('${pam}','financeiro',true,'@pamela','Pamela');
insert into public.role_perms values
  ('admin','admin'),('admin','caixa'),('admin','financas'),
  ('financeiro','caixa'),('financeiro','financas');
create function public.has_perm(p text) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles pr join public.role_perms rp on rp.role = pr.role
    where pr.id = auth.uid() and pr.ativo and rp.perm = p) $$;
create function public.can(p text) returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_perm(p) $$;
create function public.caixa_acesso() returns boolean language sql stable security definer set search_path = '' as $$
  select public.can('caixa') $$;
create table public.products(
  sku text primary key, marca text, produto text, tamanho text, fornecedor text, notas text,
  preco_venda numeric not null default 0, estoque int not null default 0,
  estoque_minimo int not null default 2, ativo boolean not null default true,
  updated_at timestamptz not null default now());
create table public.product_costs(
  sku text primary key references public.products(sku),
  custo numeric not null, updated_at timestamptz not null default now());
create table public.fornecedores(id bigint generated always as identity primary key, nome text);
create table public.compras(
  id bigint generated always as identity primary key,
  lote uuid unique, data date, fornecedor text, observacao text, created_by uuid, created_at timestamptz default now());
create function public.compra_numero(p_id bigint) returns text language sql immutable as $$
  select 'C-' || lpad(p_id::text, 6, '0') $$;
create table public.purchases(
  id bigint generated always as identity primary key,
  data date, sku text references public.products(sku), fornecedor text, qtd int, custo_unit numeric, observacao text,
  compra_lote uuid, compra_id bigint,
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
create table public.caixas(id smallint primary key, nome text, metodo text, ativo boolean default true);
insert into public.caixas values
  (1, 'Caixa Dinheiro', 'dinheiro', true),
  (18, 'COMPRA PRODUTOS', null, true);
create type public.mov_tipo as enum ('venda','entrada','saida','estorno');
create table public.caixa_movimentos(
  id bigint generated always as identity primary key,
  caixa_id smallint not null, tipo public.mov_tipo not null, valor numeric not null check (valor > 0),
  motivo text, forma text, user_id uuid, data date, created_at timestamptz);
create function public.tg_mov_insert() returns trigger language plpgsql as $$
begin
  new.user_id := coalesce(auth.uid(), new.user_id);
  new.data := (now() at time zone 'America/Sao_Paulo')::date;
  new.created_at := coalesce(new.created_at, now());
  return new;
end $$;
create trigger mov_bi before insert on public.caixa_movimentos for each row execute function public.tg_mov_insert();
create function public.caixa_saldo_calc(p_caixa smallint) returns numeric language sql stable as $$
  select coalesce(sum(case when tipo in ('venda','entrada') then valor else -valor end), 0)
  from public.caixa_movimentos where caixa_id = p_caixa;
$$;
create table public.security_events(
  id bigint generated always as identity primary key, at timestamptz default now(),
  kind text not null, actor uuid, email text, detail jsonb not null default '{}', alerted boolean not null default false);
alter table public.security_events add constraint security_events_kind_check check (kind in ('fin_pagamento')) not valid;
create function public.fin_log(p_kind text, p_detail jsonb) returns void language plpgsql as $$
begin
  insert into public.security_events(kind, actor, detail) values (p_kind, auth.uid(), p_detail);
end $$;
`);

for (const file of ["migration-origem-dolar.sql", "migration-compras-pagamento.sql", "migration-cambio-pago.sql"]) {
  try { await db.exec(read(file)); }
  catch (e) { console.error("SQL FAIL", file, e.message); process.exit(1); }
}
await db.exec(`
drop trigger if exists purchase_ai on public.purchases;
create trigger purchase_ai after insert on public.purchases for each row execute function public.tg_purchase_insert();
update public.caixas set somente_admin = true where id = 18;
`);

const as = async (id, role) => {
  await db.exec(`select set_config('request.jwt.claims', '{"sub":"${id}"}', false)`);
  await db.exec(role ? `set role ${role}` : `reset role`);
};
const one = async q => (await db.query(q)).rows[0];
const num = async q => Number(Object.values(await one(q))[0]);
const err = async q => { try { await db.query(q); return ""; } catch (e) { return e.message; } };
const cents = n => Math.round(Number(n) * 100);
const hdr = (extra = {}) => JSON.stringify(extra).replace(/'/g, "''");
const itens = rows => JSON.stringify(rows).replace(/'/g, "''");

await as(mike);
await db.query(`insert into caixa_movimentos(caixa_id, tipo, valor, motivo) values (1, 'entrada', 10000, 'Fundo')`);
const cot = await one(`select public.cotacao_dolar_salvar(5.4) as r`);
ok(Number(cot.r.valor) === 5.4, "admin saves the rate 5.40");
await db.query(`insert into products(sku, marca, produto, preco_venda, estoque, origem, preco_usd) values
  ('IMP', 'Apple', 'Importado', 1, 0, 'Importado', 100),
  ('NAC', 'JBL', 'Nacional', 50, 0, 'Nacional', null),
  ('IMPD', 'Apple', 'Divida', 1, 0, 'Importado', 80),
  ('IMPS', 'Apple', 'Curto', 1, 0, 'Importado', 50)`);

const agora = await one(`select public.registrar_compra_pagamento('${hdr({ fornecedor: "Miami", pagamento: "agora", caixa_id: 1, taxa_dolar: 5 })}'::jsonb, '${itens([{ sku: "IMP", qtd: 2, custo_usd: 100, origem: "Importado" }])}'::jsonb) as r`);
ok(agora.r.pagamento === "agora", "pagar agora saves");
ok(cents(await num(`select custo from product_costs where sku = 'IMP'`)) === 50000, "pagar agora locks the product cost at the compra rate, not the global 5.40");
ok(Number(await num(`select cambio_pago from compras where id = ${agora.r.compra_id}`)) === 5, "cambio_pago stores the compra rate");
const depoisCot = await one(`select public.cotacao_dolar_salvar(6) as r`);
ok(Number(depoisCot.r.valor) === 6, "rate moves to 6");
ok(cents(await num(`select custo from product_costs where sku = 'IMP'`)) === 50000, "a later rate does not move the locked pagar-agora cost");

const depois = await one(`select public.registrar_compra_pagamento('${hdr({ fornecedor: "Miami", pagamento: "depois", taxa_dolar: 5.1, pagar_em: "2026-12-01" })}'::jsonb, '${itens([{ sku: "IMP", qtd: 2, custo_usd: 100, origem: "Importado" }])}'::jsonb) as r`);
ok(cents(await num(`select custo from product_costs where sku = 'IMP'`)) === 55000, "open lot floats at 6 and averages with the locked lot: (500+600)/2 = 550");
ok(cents(await num(`select custo_unit from purchases where compra_id = ${depois.r.compra_id}`)) === 51000, "the purchase line keeps the quote rate until payment");
await one(`select public.cotacao_dolar_salvar(7) as r`);
ok(cents(await num(`select custo from product_costs where sku = 'IMP'`)) === 60000, "raising the rate to 7 only moves the open lot: (500+700)/2 = 600");

const ontem = (await one(`select ((now() at time zone 'America/Sao_Paulo')::date - 1)::text as d`)).d;
const pago = await one(`select public.compra_pagar(${depois.r.compra_id}, 1, 1::smallint, 6.5, '${ontem}'::date) as r`);
ok(Number(pago.r.cambio_pago) === 6.5 && pago.r.travado === true && cents(pago.r.total) === 130000, "payment ignores the partial amount and debits US$ total × câmbio: 200 × 6.50 = 1300");
ok(cents(await num(`select custo from product_costs where sku = 'IMP'`)) === 57500, "after payment the average locks: (500+650)/2 = 575");
ok((await one(`select data::text as d from compra_pagamentos where compra_id = ${depois.r.compra_id}`)).d === ontem, "data_pagamento is the date the admin chose");
ok((await one(`select data::text as d from caixa_movimentos where motivo like 'Compra ${depois.r.numero}%'`)).d === ontem, "the caixa line uses that payment date");
await one(`select public.cotacao_dolar_salvar(8) as r`);
ok(cents(await num(`select custo from product_costs where sku = 'IMP'`)) === 57500, "a later rate leaves the paid lot locked");
ok(cents(await num(`select preco_venda from products where sku = 'IMP'`)) === 79999, "shelf price still follows the new rate with the ,99 rule and the locked cost as the floor");

const nac = await one(`select public.registrar_compra_pagamento('${hdr({ fornecedor: "SP", pagamento: "depois" })}'::jsonb, '${itens([{ sku: "NAC", qtd: 1, custo_unit: 10, origem: "Nacional" }])}'::jsonb) as r`);
ok(cents(await num(`select custo from product_costs where sku = 'NAC'`)) === 1000, "nacional cost is the R$ typed on the line");
await one(`select public.cotacao_dolar_salvar(9) as r`);
ok(cents(await num(`select custo from product_costs where sku = 'NAC'`)) === 1000 && cents(await num(`select custo from product_costs where sku = 'IMP'`)) === 57500, "nacional and locked importado stay put when the rate changes");

const divida = await one(`select public.registrar_compra_pagamento('${hdr({ fornecedor: "Miami", pagamento: "divida", caixa_id: 18, taxa_dolar: 5.4 })}'::jsonb, '${itens([{ sku: "IMPD", qtd: 2, custo_usd: 80, origem: "Importado" }])}'::jsonb) as r`);
ok(cents(await num(`select caixa_saldo_calc(18::smallint)`)) === -86400, "dívida books US$ × taxa on COMPRA PRODUTOS without a saldo check");
ok(cents(await num(`select custo from product_costs where sku = 'IMPD'`)) === 72000, "unpaid dívida follows the current rate 9, not the booked 5.40");
const quita = await one(`select public.compra_pagar(${divida.r.compra_id}, 0, null, 5.5, '${ontem}'::date) as r`);
ok(cents(quita.r.total) === 88000, "settling the dívida uses US$ × câmbio pago");
ok(cents(await num(`select caixa_saldo_calc(18::smallint)`)) === -88000, "the debt caixa moves by the difference, still without a saldo check");
ok(cents(await num(`select custo from product_costs where sku = 'IMPD'`)) === 44000, "the dívida units lock at the câmbio pago");
await one(`select public.cotacao_dolar_salvar(4) as r`);
ok(cents(await num(`select custo from product_costs where sku = 'IMPD'`)) === 44000, "after the dívida is settled the rate does not move that cost");

const curto = await one(`select public.registrar_compra_pagamento('${hdr({ fornecedor: "Miami", pagamento: "depois", taxa_dolar: 5 })}'::jsonb, '${itens([{ sku: "IMPS", qtd: 2, custo_usd: 80, origem: "Importado" }])}'::jsonb) as r`);
await db.query(`insert into caixa_movimentos(caixa_id, tipo, valor, motivo) values (1, 'saida', 9900, 'Esvazia')`);
const saldoAntes = await num(`select caixa_saldo_calc(1::smallint)`);
const curtoErr = await err(`select public.compra_pagar(${curto.r.compra_id}, 1, 1::smallint, 5, null)`);
ok(/Saldo insuficiente/.test(curtoErr), "pagar depois checks the caixa saldo: " + curtoErr);
ok((await one(`select cambio_pago from compras where id = ${curto.r.compra_id}`)).cambio_pago == null, "a refused payment does not lock the cost");
ok(await num(`select caixa_saldo_calc(1::smallint)`) === saldoAntes, "a refused payment posts no movement");

const fut = await err(`select public.compra_pagar(${curto.r.compra_id}, 1, 1::smallint, 5, (now() at time zone 'America/Sao_Paulo')::date + 1)`);
ok(/Data do pagamento inválida/.test(fut), "payment date cannot be in the future");
const agenda = await one(`select public.compra_agendar(${curto.r.compra_id}, ((now() at time zone 'America/Sao_Paulo')::date + 3)) as r`);
ok(String(agenda.r.pagar_em).slice(0, 10).length === 10, "pagar em is stored and does not pay");
ok(await num(`select count(*) from caixa_movimentos where motivo like '%${curto.r.numero}%'`) === 0, "scheduling posts no caixa movement");

const lista = await one(`select public.compras_pendentes() as r`);
const miami = lista.r.grupos.find(g => g.fornecedor === "Miami");
const aberta = miami.compras.find(c => c.id === curto.r.compra_id);
ok(aberta.flutuante === true && cents(aberta.total_usd) === 16000 && aberta.total > 0, "pending list shows the US$ total and a current R$ estimate");
ok(lista.r.cotacao === 4 || Number(lista.r.cotacao) === 4, "pending list carries the current rate");
const ordem = miami.compras.map(c => c.id);
ok(ordem.indexOf(curto.r.compra_id) >= 0, "the scheduled compra is listed");

const custos = await one(`select public.custos_loja() as r`);
const imp = custos.r.find(x => x.sku === "IMP");
const nacRow = custos.r.find(x => x.sku === "NAC");
const abertoRow = custos.r.find(x => x.sku === "IMPS");
ok(imp.situacao === "travado" && cents(imp.custo) === 57500, "paid importado is travado at the weighted cost");
ok(nacRow.situacao === "nacional" && cents(nacRow.custo) === 1000, "nacional stays nacional");
ok(abertoRow.situacao === "cotacao", "an unpaid importado lot still follows the rate");

await as(pam, "authenticated");
let e = await err(`select public.compras_pendentes()`);
ok(/Somente admin/.test(e), "financeiro cannot open compras pendentes: " + e);
e = await err(`select public.compra_pagar(${curto.r.compra_id}, 1, 1::smallint, 5, null)`);
ok(/Somente admin/.test(e), "financeiro cannot pay: " + e);
e = await err(`select public.compra_agendar(${curto.r.compra_id}, null)`);
ok(/Somente admin/.test(e), "financeiro cannot schedule: " + e);
e = await err(`select public.custos_loja()`);
ok(/Somente admin/.test(e), "financeiro cannot read cost mode: " + e);
e = await err(`select cambio_pago from public.compras`);
ok(/permission denied|permissão/i.test(e), "cambio_pago is not selectable: " + e);
e = await err(`select pagar_em, data_pagamento from public.compras`);
ok(/permission denied|permissão/i.test(e), "schedule and payment date are not selectable: " + e);

const sql = read("migration-cambio-pago.sql");
ok(sql.startsWith("-- DRAFT") && sql.includes("Não rodar no SQL Editor") && !/update\s+public\.(sales|notas|sale_costs)\b/i.test(sql), "draft header and saved notas are untouched");

await as(mike);
try { await db.exec(read("rollback-cambio-pago.sql")); }
catch (e) { console.error("ROLLBACK FAIL", e.message); process.exit(1); }
await one(`select public.cotacao_dolar_salvar(4) as r`);
ok(cents(await num(`select custo from product_costs where sku = 'IMP'`)) === 40000, "rollback restores custo = custo_usd × cotação");
const gone = await err(`select cambio_pago from public.compras`);
ok(/does not exist|não existe/i.test(gone), "rollback drops cambio_pago: " + gone);

if (failed) { console.error(failed + " failed"); process.exit(1); }
console.log("cambio pago ok");
