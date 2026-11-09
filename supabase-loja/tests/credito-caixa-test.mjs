// Crédito da Caixa Geral que também entra num caixa. PGlite, sem produção.
import { readFileSync } from "node:fs";
const { PGlite } = await import("@electric-sql/pglite").catch(() => import("/tmp/pgdeps/node_modules/@electric-sql/pglite/dist/index.js"));

const sql = readFileSync(new URL("../migration-credito-caixa.sql", import.meta.url), "utf8");
const db = new PGlite();
let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.error("FAIL", m); } else console.log("ok", m); };
const mike = "00000000-0000-0000-0000-00000000000a";
const pam = "00000000-0000-0000-0000-00000000000b";
const kaio = "00000000-0000-0000-0000-00000000000d";

await db.exec(`
create role anon nologin; create role authenticated nologin;
create schema if not exists auth;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt()->>'sub','')::uuid $$;
create table public.profiles(id uuid primary key, role text, ativo boolean default true, handle text);
create table public.role_perms(role text, perm text);
insert into public.profiles values ('${mike}','admin',true), ('${pam}','financeiro',true), ('${kaio}','vendedor',true);
insert into public.role_perms values ('admin','admin'),('admin','financas'),('financeiro','financas'),('vendedor','vendas');
create function public.can(p text) returns boolean language sql stable as $$
  select exists (select 1 from public.profiles pr join public.role_perms rp on rp.role = pr.role
    where pr.id = auth.uid() and pr.ativo and rp.perm = p) $$;
create table public.clientes(id bigint primary key, nome text, ativo boolean default true);
insert into public.clientes values (1, 'Maria Souza', true);
create table public.caixas(id smallint primary key, nome text, metodo text, ativo boolean default true);
insert into public.caixas values (2, 'Caixa PIX (HX)', 'pix', true), (13, 'PRIME', null, true), (99, 'Fechado', 'dinheiro', false);
create type public.mov_tipo as enum ('venda','entrada','saida','estorno');
create table public.caixa_movimentos(
  id bigint generated always as identity primary key, caixa_id smallint, tipo public.mov_tipo, valor numeric,
  motivo text, forma text, user_id uuid, estorno_de bigint, data date, created_at timestamptz, nota_id bigint);
create function public.tg_mov_insert() returns trigger language plpgsql as $$
begin
  new.user_id := coalesce(auth.uid(), new.user_id);
  new.data := (now() at time zone 'America/Sao_Paulo')::date;
  new.created_at := now();
  return new;
end $$;
create trigger mov_bi before insert on public.caixa_movimentos for each row execute function public.tg_mov_insert();
create table public.cliente_creditos(
  id bigint generated always as identity primary key, cliente_id bigint not null, tipo text not null, valor numeric not null,
  obs text, nota_id bigint, created_by uuid default auth.uid(), created_at timestamptz default now(),
  estorno_de bigint, recebimento_id bigint);
create table public.cliente_recebimentos(id bigint primary key);
create table public.notas(id bigint primary key, status text);
create function public._credito_saldo(p bigint) returns numeric language sql stable as $$
  select coalesce(sum(case when tipo = 'entrada' then valor else -valor end), 0) from public.cliente_creditos where cliente_id = p $$;
create table public.security_events(id bigint generated always as identity primary key, kind text, actor uuid, detail jsonb,
  constraint security_events_kind_check check (kind in ('credito_entrada','estorno_credito','fin_alteracao')));
create function public.fin_log(p_kind text, p_detail jsonb) returns void language plpgsql as $$
begin insert into public.security_events(kind, actor, detail) values (p_kind, auth.uid(), p_detail); end $$;
`);
try { await db.exec(sql); } catch (e) { console.error("SQL FAIL", e.message); process.exit(1); }

const as = async id => db.exec(`select set_config('request.jwt.claims', '{"sub":"${id}"}', false)`);
const one = async q => (await db.query(q)).rows[0];
const num = async q => Number(Object.values(await one(q))[0]);
const err = async q => { try { await db.query(q); return ""; } catch (e) { return e.message; } };

await as(kaio);
let e = await err(`select public.lancar_credito_caixa(1::bigint, 50::numeric, 2::smallint, 'pix', 'adiantado', null::date)`);
ok(/Sem permissão/.test(e), "seller cannot book credit into a caixa: " + e);
ok(await num("select count(*) from cliente_creditos") === 0 && await num("select count(*) from caixa_movimentos") === 0, "refused credit writes nothing");

await as(pam);
e = await err(`select public.lancar_credito_caixa(1::bigint, 40::numeric, 13::smallint, null::text, null::text, null::date)`);
ok(/Forma de pagamento inválida/.test(e), "PRIME without a form is refused: " + e);
e = await err(`select public.lancar_credito_caixa(1::bigint, 40::numeric, 99::smallint, 'dinheiro', null::text, null::date)`);
ok(/Caixa inválido/.test(e), "inactive caixa is refused: " + e);
e = await err(`select public.lancar_credito_caixa(1::bigint, 40::numeric, 2::smallint, 'pix', null::text, '2000-01-01'::date)`);
ok(/O caixa grava só a data de hoje/.test(e), "a past date is refused: " + e);

const booked = await one(`select * from jsonb_to_record(public.lancar_credito_caixa(1::bigint, 80::numeric, 2::smallint, null::text, 'segura o crédito', null::date)) as x(credito_id bigint, mov_id bigint, forma text, valor numeric, caixa_id int)`);
ok(Number(booked.valor) === 80 && booked.forma === "pix", "PIX caixa uses its own method when the form is omitted");
const mov = await one(`select tipo, valor, motivo, caixa_id, data from caixa_movimentos where id = ${booked.mov_id}`);
const cred = await one(`select tipo, valor, mov_id from cliente_creditos where id = ${booked.credito_id}`);
ok(mov.tipo === "entrada" && Number(mov.valor) === 80 && mov.motivo === "Crédito Caixa Geral Maria Souza" && Number(mov.caixa_id) === 2, "the paid amount enters the PIX caixa");
ok(cred.tipo === "entrada" && Number(cred.mov_id) === Number(booked.mov_id), "the credit points at that caixa movement");
ok(String(mov.data) === String((await one("select (now() at time zone 'America/Sao_Paulo')::date d")).d), "the trigger keeps today's date");
ok(await num("select count(*) from cliente_recebimentos") === 0, "pure credit does not pay a debt");

const prime = await one(`select * from jsonb_to_record(public.lancar_credito_caixa(1::bigint, 15::numeric, 13::smallint, 'transferencia', null::text, null::date)) as x(credito_id bigint, mov_id bigint)`);
ok((await one(`select forma from caixa_movimentos where id = ${prime.mov_id}`)).forma === "transferencia", "PRIME stores the chosen form");

await as(pam);
e = await err(`select public.estornar_credito(${booked.credito_id}::bigint, 'devolveu')`);
ok(/Somente admin/.test(e), "financeiro cannot reverse the credit: " + e);

await as(mike);
const old = await num(`insert into cliente_creditos(cliente_id, tipo, valor, obs) values (1, 'entrada', 5, 'antigo') returning id`);
await db.exec(`select public.estornar_credito(${old}::bigint, 'credito antigo')`);
ok(await num(`select count(*) from caixa_movimentos where tipo = 'estorno'`) === 0, "a credit without a caixa does not move a caixa");
await db.exec(`select public.estornar_credito(${booked.credito_id}::bigint, 'devolveu o pix')`);
const rev = await one(`select tipo, valor, caixa_id, estorno_de from caixa_movimentos where estorno_de = ${booked.mov_id}`);
ok(rev.tipo === "estorno" && Number(rev.valor) === 80 && Number(rev.caixa_id) === 2 && Number(rev.estorno_de) === Number(booked.mov_id), "admin reversal puts the same value back out of the same caixa");
const nome = await one(`select caixa from v_cliente_creditos_mov where id = ${booked.credito_id}`);
ok(nome.caixa === "Caixa PIX (HX)", "the credit history names the caixa");

if (failed) { console.error(failed + " failed"); process.exit(1); }
console.log("credito caixa sql ok");
