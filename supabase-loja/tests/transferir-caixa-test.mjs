// Transferência entre caixas. PGlite, sem produção.
import { readFileSync } from "node:fs";
const { PGlite } = await import("@electric-sql/pglite").catch(() => import("/tmp/pgdeps/node_modules/@electric-sql/pglite/dist/index.js"));

const sql = readFileSync(new URL("../migration-transferir-caixa.sql", import.meta.url), "utf8");
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
create table public.profiles(id uuid primary key, role text, ativo boolean default true, handle text, nome text);
create table public.role_perms(role text, perm text);
insert into public.profiles values ('${mike}','admin',true), ('${pam}','financeiro',true), ('${kaio}','vendedor',true);
insert into public.role_perms values ('admin','admin'),('admin','caixa'),('admin','financas'),('financeiro','caixa'),('financeiro','financas'),('vendedor','vendas');
create function public.can(p text) returns boolean language sql stable as $$
  select exists (select 1 from public.profiles pr join public.role_perms rp on rp.role = pr.role
    where pr.id = auth.uid() and pr.ativo and rp.perm = p) $$;
create function public.caixa_acesso() returns boolean language sql stable as $$
  select public.can('caixa')
     and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role::text = 'vendedor');
$$;
create table public.caixas(id smallint primary key, nome text, metodo text, ativo boolean default true);
insert into public.caixas values (1, 'Caixa Dinheiro', 'dinheiro', true), (12, 'GASTOS LOJA', null, true), (99, 'Fechado', 'dinheiro', false);
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
create function public.caixa_saldo_calc(p_caixa smallint) returns numeric language sql stable as $$
  select coalesce(sum(case when tipo in ('venda','entrada') then valor else -valor end), 0)
  from public.caixa_movimentos where caixa_id = p_caixa;
$$;
create table public.clientes(id bigint primary key, nome text, ativo boolean default true);
insert into public.clientes values (1, 'Maria Souza', true);
create table public.notas(id bigint primary key, cliente text, cliente_id bigint);
insert into public.notas values (21, 'Maria Souza', 1);
create table public.cliente_recebimentos(id bigint generated always as identity primary key, cliente_id bigint, mov_id bigint);
`);
try { await db.exec(sql); } catch (e) { console.error("SQL FAIL", e.message); process.exit(1); }

const as = async id => db.exec(`select set_config('request.jwt.claims', '{"sub":"${id}"}', false)`);
const one = async q => (await db.query(q)).rows[0];
const num = async q => Number(Object.values(await one(q))[0]);
const err = async q => { try { await db.query(q); return ""; } catch (e) { return e.message; } };

await as(mike);
await db.query(`insert into caixa_movimentos(caixa_id, tipo, valor, motivo) values (1, 'entrada', 1000, 'Fundo')`);
ok(await num("select caixa_saldo_calc(1::smallint)") === 1000, "seed saldo on Dinheiro is 1000");

await as(kaio);
let e = await err(`select public.transferir_caixa(1::smallint, 12::smallint, 100::numeric, 'sangria')`);
ok(/Sem permissão de caixa/.test(e), "seller cannot transfer: " + e);
ok(await num("select count(*) from caixa_movimentos") === 1, "refused seller transfer writes nothing extra");

await as(pam);
e = await err(`select public.transferir_caixa(1::smallint, 1::smallint, 100::numeric, 'mesmo')`);
ok(/Escolha caixas diferentes/.test(e), "same caixa is refused: " + e);
e = await err(`select public.transferir_caixa(1::smallint, 99::smallint, 100::numeric, 'fechado')`);
ok(/destino inválido/.test(e), "inactive destination is refused: " + e);
e = await err(`select public.transferir_caixa(99::smallint, 12::smallint, 100::numeric, 'fechado')`);
ok(/origem inválido/.test(e), "inactive origin is refused: " + e);
e = await err(`select public.transferir_caixa(1::smallint, 12::smallint, 0::numeric, 'zero')`);
ok(/maior que zero/.test(e), "zero value is refused: " + e);
e = await err(`select public.transferir_caixa(1::smallint, 12::smallint, 50::numeric, 'ab')`);
ok(/Informe o motivo/.test(e), "short motivo is refused: " + e);
e = await err(`select public.transferir_caixa(1::smallint, 12::smallint, 5000::numeric, 'maior que o saldo')`);
ok(/Saldo insuficiente/.test(e), "overdraft is refused: " + e);
ok(await num("select count(*) from caixa_movimentos") === 1, "failed transfers write nothing");

const r = await one(`select * from jsonb_to_record(public.transferir_caixa(1::smallint, 12::smallint, 250.50::numeric, 'sangria loja')) as x(saida_id bigint, entrada_id bigint, origem int, destino int, valor numeric, saldo_origem numeric, saldo_destino numeric)`);
ok(Number(r.valor) === 250.5 && Number(r.origem) === 1 && Number(r.destino) === 12, "financeiro transfer returns the pair");
ok(Number(r.saldo_origem) === 749.5 && Number(r.saldo_destino) === 250.5, "saldos move 250.50 from Dinheiro to GASTOS");
const sai = await one(`select tipo, caixa_id, valor, motivo, user_id from caixa_movimentos where id = ${r.saida_id}`);
const ent = await one(`select tipo, caixa_id, valor, motivo, user_id from caixa_movimentos where id = ${r.entrada_id}`);
ok(sai.tipo === "saida" && Number(sai.caixa_id) === 1 && Number(sai.valor) === 250.5 && sai.motivo === "Transferência para GASTOS LOJA: sangria loja", "origin saida has the paired motivo");
ok(ent.tipo === "entrada" && Number(ent.caixa_id) === 12 && Number(ent.valor) === 250.5 && ent.motivo === "Transferência de Caixa Dinheiro: sangria loja", "destination entrada has the paired motivo");
ok(String(sai.user_id) === pam && String(ent.user_id) === pam, "both movements record the financeiro user");
ok(await num("select count(*) from caixa_movimentos") === 3, "success writes exactly two movements");

await as(mike);
await db.query(`insert into caixa_movimentos(caixa_id, tipo, valor, motivo, nota_id) values (1, 'venda', 80, 'Nota 000021', 21)`);
await db.query(`insert into caixa_movimentos(caixa_id, tipo, valor, motivo) values (1, 'entrada', 40, 'Recebimento cliente Maria Souza')`);
const recMov = (await one(`select id from caixa_movimentos order by id desc limit 1`)).id;
await db.query(`insert into cliente_recebimentos(cliente_id, mov_id) values (1, ${recMov})`);
const venda = await one(`select cliente from v_caixa_extrato where nota_id = 21`);
const rec = await one(`select cliente from v_caixa_extrato where id = ${recMov}`);
const tr = await one(`select cliente from v_caixa_extrato where id = ${r.saida_id}`);
ok(venda.cliente === "Maria Souza", "extrato shows the note's client");
ok(rec.cliente === "Maria Souza", "extrato shows the receipt's client");
ok(tr.cliente == null, "a caixa-to-caixa transfer has no client");

if (failed) { console.error(failed + " failed"); process.exit(1); }
console.log("transferir caixa sql ok");
