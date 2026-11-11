// Transferir entre caixas ↔ Caixa Especial. PGlite, sem produção.
import { readFileSync } from "node:fs";
const { PGlite } = await import("@electric-sql/pglite").catch(() => import("/tmp/pgdeps/node_modules/@electric-sql/pglite/dist/index.js"));

const sql = readFileSync(new URL("../migration-transferir-especial.sql", import.meta.url), "utf8");
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
insert into public.profiles values ('${mike}','admin',true,'@mike','Mike'), ('${pam}','financeiro',true,'@pamela','Pamela'), ('${kaio}','vendedor',true,'@kaio','Kaio');
insert into public.role_perms values ('admin','admin'),('admin','caixa'),('admin','financas'),('financeiro','caixa'),('financeiro','financas'),('vendedor','vendas');
create function public.can(p text) returns boolean language sql stable as $$
  select exists (select 1 from public.profiles pr join public.role_perms rp on rp.role = pr.role
    where pr.id = auth.uid() and pr.ativo and rp.perm = p) $$;
create function public.caixa_acesso() returns boolean language sql stable as $$
  select public.can('caixa')
     and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role::text = 'vendedor');
$$;
create table public.caixas(id smallint primary key, nome text, metodo text, ativo boolean default true);
insert into public.caixas values (1, 'Caixa Dinheiro', 'dinheiro', true), (12, 'GASTOS LOJA', null, true);
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
create table public.caixa_especial_mov (
  id bigint generated always as identity primary key,
  tipo text not null check (tipo in ('entrada','saida')),
  valor numeric(12,2) not null check (valor > 0),
  motivo text not null,
  cliente_id bigint, credito_id bigint, estorno_de bigint,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create function public._cx_esp_saldo() returns numeric language sql stable security definer set search_path = '' as $$
  select coalesce(sum(case when tipo = 'entrada' then valor else -valor end), 0) from public.caixa_especial_mov;
$$;
create table public.conta_pagamentos(id bigint generated always as identity primary key, mov_id bigint);
create table public.cliente_recebimentos(id bigint generated always as identity primary key, mov_id bigint);
create table public.notas(id bigint primary key, caixa_lancada_id smallint, lancada_em timestamptz, lancada_por uuid);
`);
try { await db.exec(sql); } catch (e) { console.error("SQL FAIL", e.message); process.exit(1); }

const as = async id => db.exec(`select set_config('request.jwt.claims', '{"sub":"${id}"}', false)`);
const one = async q => (await db.query(q)).rows[0];
const num = async q => Number(Object.values(await one(q))[0]);
const err = async q => { try { await db.query(q); return ""; } catch (e) { return e.message; } };

await as(mike);
await db.query(`insert into caixa_movimentos(caixa_id, tipo, valor, motivo) values (1, 'entrada', 1000, 'Fundo')`);

await as(pam);
const normal = await one(`select * from jsonb_to_record(public.transferir_caixa(1::smallint, 12::smallint, 100::numeric, 'sangria normal')) as x(saida_id bigint, entrada_id bigint, origem int, destino int, valor numeric)`);
ok(Number(normal.valor) === 100 && Number(normal.destino) === 12, "financeiro can still transfer caixa ↔ caixa");

let e = await err(`select public.transferir_caixa(1::smallint, null, 50::numeric, 'para especial', false, true)`);
ok(/Somente admin/.test(e), "financeiro cannot transfer to Caixa Especial: " + e);
e = await err(`select public.transferir_caixa(null, 1::smallint, 50::numeric, 'da especial', true, false)`);
ok(/Somente admin/.test(e), "financeiro cannot transfer from Caixa Especial");
ok(await num("select count(*) from caixa_especial_mov") === 0, "refused financeiro especial transfer writes nothing to especial");

await as(kaio);
e = await err(`select public.transferir_caixa(1::smallint, null, 50::numeric, 'vendedor', false, true)`);
ok(/Sem permissão de caixa/.test(e), "seller cannot transfer to especial");

await as(mike);
e = await err(`select public.transferir_caixa(1::smallint, null, 5000::numeric, 'estouro', false, true)`);
ok(/Saldo insuficiente/.test(e), "admin overdraft on Dinheiro to especial is refused");

const r = await one(`select * from jsonb_to_record(public.transferir_caixa(1::smallint, null, 200.40::numeric, 'sangria especial', false, true)) as x(saida_id bigint, entrada_id bigint, origem text, destino text, valor numeric, cxesp_id bigint, saldo_origem numeric, saldo_destino numeric)`);
ok(r.destino === "cxesp" && String(r.origem) === "1" && Number(r.valor) === 200.4, "admin transfer to especial returns the pair: " + JSON.stringify(r));
ok(Number(r.saldo_origem) === 699.6, "Dinheiro falls by 200.40 (1000-100-200.40) got " + r.saldo_origem);
ok(Number(r.saldo_destino) === 200.4, "Caixa Especial saldo is 200.40 got " + r.saldo_destino);
const sai = await one(`select tipo, caixa_id, valor, motivo from caixa_movimentos where id = ${r.saida_id}`);
const esp = await one(`select tipo, valor, motivo, caixa_mov_id from caixa_especial_mov where id = ${r.cxesp_id}`);
ok(sai.tipo === "saida" && Number(sai.caixa_id) === 1 && sai.motivo === "Transferência para CAIXA ESPECIAL: sangria especial", "origin saida appears in caixa extrato with motivo");
ok(esp.tipo === "entrada" && Number(esp.valor) === 200.4 && Number(esp.caixa_mov_id) === Number(r.saida_id) && esp.motivo === "Transferência de Caixa Dinheiro: sangria especial", "especial entrada is linked to the caixa saida");

const est = await one(`select * from jsonb_to_record(public.estornar_movimento_caixa(${r.saida_id}::bigint, 'desfazer especial')) as x(mov_id bigint, estorno_id bigint, acao text, valor numeric, nota_id bigint, cxesp_id bigint, cxesp_estorno_id bigint, ja_estornado boolean)`);
ok(est.acao === "transferencia_especial" && est.cxesp_estorno_id, "estorno of the caixa saida reverses the especial side too: " + JSON.stringify(est));
ok(await num("select caixa_saldo_calc(1::smallint)") === 900, "after estorno Dinheiro is back to 900 (1000-100)");
ok(await num("select _cx_esp_saldo()") === 0, "after estorno especial saldo is back to 0");
const ja = await one(`select * from jsonb_to_record(public.estornar_movimento_caixa(${r.saida_id}::bigint, 'de novo')) as x(ja_estornado boolean, mov_id bigint, estorno_id bigint)`);
ok(ja.ja_estornado === true, "second caixa estorno is idempotent");

const r2 = await one(`select * from jsonb_to_record(public.transferir_caixa(1::smallint, null, 80::numeric, 'segunda', false, true)) as x(saida_id bigint, entrada_id bigint, origem text, destino text, valor numeric, cxesp_id bigint, saldo_origem numeric, saldo_destino numeric)`);
ok(Number(r2.saldo_destino) === 80, "admin can transfer again after estorno got " + r2.saldo_destino);
e = await err(`select public.transferir_caixa(null, 1::smallint, 500::numeric, 'sem saldo', true, false)`);
ok(/Saldo da Caixa Especial insuficiente/.test(e), "especial origin overdraft is refused: " + e);
const r3 = await one(`select * from jsonb_to_record(public.transferir_caixa(null, 1::smallint, 30::numeric, 'volta dinheiro', true, false)) as x(saida_id bigint, entrada_id bigint, origem text, destino text, valor numeric, cxesp_id bigint, saldo_origem numeric, saldo_destino numeric)`);
ok(r3.origem === "cxesp" && String(r3.destino) === "1" && Number(r3.saldo_origem) === 50, "admin can transfer especial → Caixa Dinheiro: " + JSON.stringify(r3));
const ent = await one(`select tipo, caixa_id, motivo from caixa_movimentos where id = ${r3.entrada_id}`);
ok(ent.tipo === "entrada" && Number(ent.caixa_id) === 1 && ent.motivo === "Transferência de CAIXA ESPECIAL: volta dinheiro", "return trip books an entrada on Dinheiro");
const est2 = await one(`select * from jsonb_to_record(public.cx_esp_estornar(${r3.cxesp_id}::bigint, 'desfazer volta')) as x(estorno_id bigint, credito_id bigint, saldo numeric, caixa_mov_id bigint, caixa_estorno_id bigint)`);
ok(est2.caixa_estorno_id && await num("select _cx_esp_saldo()") === 80, "estorno from the especial screen also reverses the caixa side: " + JSON.stringify(est2) + " saldo=" + await num("select _cx_esp_saldo()"));

ok(!/create or replace function public\.(cx_esp_entrada|cx_esp_saida|criar_nota|lancar_credito)\b/.test(sql), "draft does not replace cx_esp_entrada/saida or sale/credit functions");
ok(sql.includes("DRAFT") && sql.includes("não aplicar") && sql.includes("Somente admin pode transferir envolvendo a Caixa Especial"), "SQL is marked draft and server-enforces admin-only especial");

if (failed) { console.error(failed + " failed"); process.exit(1); }
console.log("transferir especial sql ok");
