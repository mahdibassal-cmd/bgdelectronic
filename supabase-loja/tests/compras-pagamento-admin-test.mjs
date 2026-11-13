// Compras pendentes só admin + janela de 3 dias do financeiro. PGlite, sem produção.
import { readFileSync } from "node:fs";
const { PGlite } = await import("@electric-sql/pglite").catch(() => import("/tmp/pgdeps/node_modules/@electric-sql/pglite/dist/index.js"));

const sql = readFileSync(new URL("../migration-compras-pagamento-admin.sql", import.meta.url), "utf8");
const db = new PGlite();
let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.error("FAIL", m); } else console.log("ok", m); };
const mike = "00000000-0000-0000-0000-00000000000a";
const pam = "00000000-0000-0000-0000-00000000000b";

await db.exec(`
create role anon nologin;
create role authenticated nologin;
grant usage on schema public to authenticated;
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
create table public.caixas(id smallint primary key, nome text, metodo text, ativo boolean default true, somente_admin boolean not null default false);
insert into public.caixas values
  (1,'Caixa Dinheiro','dinheiro',true,false),
  (2,'Caixa PIX (HX)','pix',true,false),
  (10,'LARANJIHA',null,true,false),
  (16,'BITLOG CONTAINER',null,true,true),
  (17,'PAGAMENTO PRODUTOS',null,true,true),
  (18,'COMPRA PRODUTOS',null,true,true);
create function public.caixa_permitido(p_caixa smallint) returns boolean language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.caixas where id = p_caixa and somente_admin) or public.has_perm('admin') $$;
create function public.caixa_hx_restrito(p_caixa smallint) returns boolean language sql stable security definer set search_path = '' as $$
  select p_caixa = 2 and not public.has_perm('admin') $$;
create type public.mov_tipo as enum ('venda','entrada','saida','estorno');
create table public.caixa_movimentos(
  id bigint generated always as identity primary key,
  caixa_id smallint not null, tipo public.mov_tipo not null, valor numeric not null,
  motivo text, forma text, user_id uuid, data date, created_at timestamptz default now(), nota_id bigint);
alter table public.caixa_movimentos enable row level security;
grant select on public.caixa_movimentos to authenticated;
create function public.caixa_saldo_calc(p_caixa smallint) returns numeric language sql stable as $$
  select coalesce(sum(case when tipo in ('venda','entrada') then valor else -valor end), 0) from public.caixa_movimentos where caixa_id = p_caixa $$;
create table public.caixa_sessoes(
  id bigint generated always as identity primary key,
  caixa_id smallint, data date, abertura_valor numeric, abertura_sistema numeric,
  aberto_por uuid, aberto_em timestamptz, fechamento_contado numeric, fechamento_sistema numeric,
  diferenca numeric, fechado_por uuid, fechado_em timestamptz, obs text);
alter table public.caixa_sessoes enable row level security;
grant select on public.caixa_sessoes to authenticated;
create table public.compras(
  id bigint generated always as identity primary key, lote uuid, data date, fornecedor text,
  observacao text, created_by uuid, created_at timestamptz, taxa_dolar numeric,
  pagamento text, vencimento date);
insert into public.compras(data, fornecedor, pagamento, vencimento) values ('2026-11-01','Tech','depois','2026-11-10');
grant select on public.compras to authenticated;
alter table public.compras enable row level security;
create policy compras_ler on public.compras for select to authenticated using (true);
create table public.compra_pagamentos(id bigint generated always as identity primary key, compra_id bigint, caixa_id smallint, valor numeric, data date);
alter table public.compra_pagamentos enable row level security;
grant select on public.compra_pagamentos to authenticated;
create function public.compra_pag_visivel(p_caixa smallint) returns boolean language sql stable as $$ select true $$;
create function public.compra_numero(p_id bigint) returns text language sql immutable as $$ select 'C-' || lpad(p_id::text, 6, '0') $$;
create table public.purchases(id bigint primary key, compra_id bigint, qtd int, custo_unit numeric);
create function public.compra_lancar_saida(p_compra bigint, p_caixa smallint, p_valor numeric, p_divida boolean default false) returns jsonb language plpgsql as $$
begin return '{"ok":true}'::jsonb; end $$;
create view public.v_caixa_saldo with (security_invoker = true) as
select c.id as caixa_id, c.nome, c.metodo,
       coalesce(sum(case when m.tipo in ('venda','entrada') then m.valor else -m.valor end), 0) as saldo,
       0::numeric as movimento_hoje
  from public.caixas c left join public.caixa_movimentos m on m.caixa_id = c.id
 where c.ativo group by c.id, c.nome, c.metodo;
grant select on public.v_caixa_saldo to authenticated;
alter table public.caixas enable row level security;
grant select on public.caixas to authenticated;
`);

try { await db.exec(sql); } catch (e) { console.error("SQL FAIL", e.message); process.exit(1); }

const as = async id => db.exec(`select set_config('request.jwt.claims', '{"sub":"${id}"}', false)`);
const one = async q => (await db.query(q)).rows[0];
const err = async q => { try { await db.query(q); return ""; } catch (e) { return e.message; } };

const def = await one(`select column_default as d from information_schema.columns where table_name = 'caixas' and column_name = 'somente_admin'`);
ok(String(def.d).includes("true"), "new caixas default to admin-only: " + def.d);
await db.query(`insert into public.caixas(id, nome, ativo) values (19, 'CAIXA FUTURO', true)`);
ok((await one(`select somente_admin from public.caixas where id = 19`)).somente_admin === true, "a caixa inserted without the flag is admin-only");
ok((await one(`select somente_admin from public.caixas where id = 1`)).somente_admin === false, "Caixa Dinheiro stays visible to financeiro");
ok((await one(`select bool_and(somente_admin) from public.caixas where id in (16,17,18)`)).bool_and === true, "BITLOG, PAGAMENTO and COMPRA stay admin-only");

await as(pam);
let e = await err(`select public.compras_pendentes()`);
ok(/Somente admin/.test(e), "financeiro cannot list pending compras: " + e);
e = await err(`select public.compra_pagar(1::bigint, 10::numeric, 1::smallint)`);
ok(/Somente admin/.test(e), "financeiro cannot pay a compra: " + e);
e = await err(`select public.compras_caixas_pagamento()`);
ok(/Somente admin/.test(e), "financeiro cannot list payment caixas: " + e);
await db.exec("set role authenticated");
e = await err(`select pagamento from public.compras`);
ok(/permission denied/.test(e), "financeiro cannot select pagamento: " + e);
const dataOk = await one(`select data::text as d from public.compras`);
ok(dataOk.d === "2026-11-01", "other compra columns stay readable");
await db.exec("reset role");

await as(mike);
const pend = await one(`select public.compras_pendentes() as r`);
ok(Array.isArray(pend.r.grupos), "admin still lists pending compras");

await db.exec(`
insert into public.caixa_movimentos(caixa_id, tipo, valor, motivo, data) values
  (1, 'entrada', 9000, 'ENTRADA ANTIGA', (now() at time zone 'America/Sao_Paulo')::date - 10),
  (1, 'entrada', 40, 'recente', (now() at time zone 'America/Sao_Paulo')::date),
  (2, 'entrada', 15, 'hx ontem', (now() at time zone 'America/Sao_Paulo')::date - 1),
  (18, 'saida', 8000, 'divida', (now() at time zone 'America/Sao_Paulo')::date);
insert into public.caixa_sessoes(caixa_id, data, abertura_valor, abertura_sistema, diferenca)
values (1, (now() at time zone 'America/Sao_Paulo')::date, 10, 9040, 0);
`);

await as(pam);
await db.exec("set role authenticated");
const finMov = await db.query(`select motivo from public.caixa_movimentos order by motivo`);
const motivos = finMov.rows.map(r => r.motivo);
ok(motivos.includes("recente") && !motivos.includes("ENTRADA ANTIGA") && !motivos.includes("divida") && !motivos.includes("hx ontem"), "financeiro sees only the last open days, not HX yesterday, old rows, or admin caixas: " + motivos.join(","));
const finCx = await db.query(`select id from public.caixas order by id`);
const ids = finCx.rows.map(r => r.id);
ok(ids.includes(1) && ids.includes(10) && !ids.includes(16) && !ids.includes(18) && !ids.includes(19), "financeiro caixa list is the allowed set: " + ids.join(","));
const saldo = await one(`select saldo from public.v_caixa_saldo where caixa_id = 1`);
ok(saldo.saldo == null, "financeiro saldo column is null so the hidden 9000 does not leak");
const visivel = await one(`select movimento_visivel::float8 as v from public.v_caixa_saldo where caixa_id = 1`);
ok(visivel.v === 40, "visible movement is only the open window");
e = await err(`select abertura_sistema from public.caixa_sessoes`);
ok(/permission denied/.test(e), "session system saldo is not selectable: " + e);
await db.exec("reset role");
const jan = await one(`select public.caixa_fin_janela() as r`);
ok(jan.r.mostra_saldo === false && jan.r.ilimitado === false && jan.r.rotulo === "últimos 3 dias", "janela padrão esconde saldo: " + JSON.stringify(jan.r));

await as(mike);
await db.exec("set role authenticated");
const admMov = await db.query(`select motivo from public.caixa_movimentos`);
ok(admMov.rows.map(r => r.motivo).includes("ENTRADA ANTIGA") && admMov.rows.some(r => r.motivo === "divida"), "admin still sees old and admin-caixa movements");
const admSaldo = await one(`select saldo::float8 as s from public.v_caixa_saldo where caixa_id = 1`);
ok(admSaldo.s === 9040, "admin saldo is the real accumulated balance");
await db.exec("reset role");
const lib = await one(`select public.caixa_fin_liberar(null, (now() at time zone 'America/Sao_Paulo')::date - 30, null, null) as r`);
ok(lib.r.id > 0, "admin grants a start date for every financeiro caixa");
await as(pam);
await db.exec("set role authenticated");
const abriu = await db.query(`select motivo from public.caixa_movimentos where caixa_id = 1`);
ok(abriu.rows.map(r => r.motivo).includes("ENTRADA ANTIGA"), "after the grant, financeiro sees the older movimento");
const hxAinda = await db.query(`select motivo from public.caixa_movimentos where caixa_id = 2`);
ok(hxAinda.rows.map(r => r.motivo).includes("hx ontem"), "the grant also widens HX");
await db.exec("reset role");
await as(mike);
const rev = await one(`select public.caixa_fin_revogar(${lib.r.id}::bigint) as r`);
ok(rev.r.revogado === true, "admin revokes the grant");
await as(pam);
await db.exec("set role authenticated");
const fechou = await db.query(`select motivo from public.caixa_movimentos where caixa_id = 1`);
ok(!fechou.rows.map(r => r.motivo).includes("ENTRADA ANTIGA") && fechou.rows.some(r => r.motivo === "recente"), "revoke hides the old movimento again");
await db.exec("reset role");
await as(pam);
e = await err(`select public.caixa_fin_liberar(null, null, 30, null)`);
ok(/Somente admin/.test(e), "financeiro cannot grant a window: " + e);

if (failed) { console.error(failed + " failed"); process.exit(1); }
console.log("compras pagamento admin ok");
