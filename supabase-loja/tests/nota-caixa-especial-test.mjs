// CAIXA ESPECIAL na criação da nota. PGlite, sem produção.
import { readFileSync } from "node:fs";
const { PGlite } = await import("@electric-sql/pglite").catch(() => import("/tmp/pgdeps/node_modules/@electric-sql/pglite/dist/index.js"));

const sql = readFileSync(new URL("../migration-nota-caixa-especial.sql", import.meta.url), "utf8");
const db = new PGlite();
let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.error("FAIL", m); } else console.log("ok", m); };
const mike = "00000000-0000-0000-0000-00000000000a";
const kaio = "00000000-0000-0000-0000-00000000000d";

await db.exec(`
create role anon nologin; create role authenticated nologin;
create schema if not exists auth;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt()->>'sub','')::uuid $$;
create type public.pay_method as enum ('dinheiro','pix','cartao','prazo','credito');
create table public.profiles(id uuid primary key, role text, ativo boolean default true);
create table public.role_perms(role text, perm text);
insert into public.profiles values ('${mike}','admin',true), ('${kaio}','vendedor',true);
insert into public.role_perms values ('admin','admin'),('admin','vendas'),('vendedor','vendas');
create function public.can(p text) returns boolean language sql stable as $$
  select exists (select 1 from public.profiles pr join public.role_perms rp on rp.role = pr.role
    where pr.id = auth.uid() and pr.ativo and rp.perm = p) $$;
create table public.clientes(id bigint primary key, nome text, ativo boolean default true);
create table public.cliente_creditos(id bigint generated always as identity primary key, cliente_id bigint, tipo text, valor numeric, obs text, nota_id bigint);
create function public._credito_saldo(p bigint) returns numeric language sql stable as $$ select 0::numeric $$;
create table public.notas(
  id bigint generated always as identity primary key, seller_id uuid, cliente text, cliente_id bigint,
  frete numeric default 0, caxinha_natal numeric default 0, total numeric default 0, status text default 'ativa',
  local_pagamento text, obs_pagamento text, caixa_lancada_id smallint, lancada_em timestamptz, lancada_por uuid,
  cxesp_lancada_em timestamptz, cxesp_lancada_por uuid, cxesp_mov_id bigint,
  constraint notas_local_pag_chk check (local_pagamento is null or local_pagamento in ('MAQUINA','HX','DINHEIRO','CAIXA GERAL')));
create table public.nota_pagamentos(id bigint generated always as identity primary key, nota_id bigint, metodo public.pay_method, valor numeric);
create table public.caixa_movimentos(id bigint generated always as identity primary key, caixa_id smallint, tipo text, valor numeric, motivo text, nota_id bigint, user_id uuid, forma text);
create table public.caixa_especial_mov(
  id bigint generated always as identity primary key, tipo text not null, valor numeric not null,
  motivo text, estorno_de bigint, cliente_id bigint, credito_id bigint, nota_id bigint, created_by uuid, created_at timestamptz default now());
create table public.fin_log_t(kind text, detail jsonb);
create function public.fin_log(kind text, detail jsonb) returns void language plpgsql as $$ begin insert into public.fin_log_t values (kind, detail); end $$;
create function public._cxesp_inserir(p_tipo text, p_valor numeric, p_motivo text, p_estorno_de bigint default null, p_cliente bigint default null, p_credito bigint default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint;
begin
  if p_tipo not in ('entrada','saida') then raise exception 'Tipo inválido' using errcode = 'P0001'; end if;
  if coalesce(p_valor, 0) <= 0 then raise exception 'Valor inválido' using errcode = 'P0001'; end if;
  insert into public.caixa_especial_mov(tipo, valor, motivo, estorno_de, cliente_id, credito_id, created_by)
  values (p_tipo, round(p_valor, 2), left(coalesce(p_motivo, ''), 300), p_estorno_de, p_cliente, p_credito, auth.uid())
  returning id into v_id;
  return v_id;
end $$;
create function public._cxesp_estornar_nota(p_nota bigint, p_motivo text) returns bigint language plpgsql security definer set search_path = '' as $$
declare n record; v_ent record; v_saida bigint;
begin
  select cxesp_mov_id into n from public.notas where id = p_nota for update;
  if n.cxesp_mov_id is null then return null; end if;
  select * into v_ent from public.caixa_especial_mov where id = n.cxesp_mov_id for update;
  if v_ent.id is null then
    update public.notas set cxesp_lancada_em = null, cxesp_lancada_por = null, cxesp_mov_id = null where id = p_nota;
    return null;
  end if;
  select e.id into v_saida from public.caixa_especial_mov e where e.estorno_de = v_ent.id;
  if v_saida is null then
    v_saida := public._cxesp_inserir('saida', v_ent.valor, left(coalesce(p_motivo, 'Estorno nota'), 300), v_ent.id, null, null);
    update public.caixa_especial_mov set nota_id = p_nota where id = v_saida;
  end if;
  update public.notas set cxesp_lancada_em = null, cxesp_lancada_por = null, cxesp_mov_id = null where id = p_nota;
  return v_saida;
end $$;
create function public.criar_nota(p_items jsonb, p_pagamentos jsonb, p_cliente text, p_cliente_id bigint, p_frete numeric, p_caxinha_natal numeric)
returns bigint language plpgsql as $$
declare v_id bigint; it jsonb; pg jsonb; v_tot numeric := 0;
begin
  insert into public.notas(seller_id, cliente, cliente_id, frete, caxinha_natal) values (auth.uid(), p_cliente, p_cliente_id, p_frete, p_caxinha_natal) returning id into v_id;
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_tot := v_tot + (it->>'qtd')::int * (it->>'preco_vendido')::numeric;
  end loop;
  v_tot := v_tot + coalesce(p_frete, 0) + coalesce(p_caxinha_natal, 0);
  for pg in select * from jsonb_array_elements(p_pagamentos) loop
    insert into public.nota_pagamentos(nota_id, metodo, valor) values (v_id, (pg->>'metodo')::public.pay_method, (pg->>'valor')::numeric);
  end loop;
  update public.notas set total = v_tot where id = v_id;
  return v_id;
end $$;
`);

const runnable = sql.split(/;\s*\n/).filter(s => !/^\s*(revoke|grant|notify)\b/i.test(s)).join(";\n");
try { await db.exec(runnable); } catch (e) { console.error("SQL FAIL", e.message); process.exit(1); }

const asUser = async (id, fn) => {
  await db.exec(`select set_config('request.jwt.claims', '{"sub":"${id}"}', false)`);
  return fn();
};
const fail = async (p) => { try { await p; return ""; } catch (e) { return e.message; } };
const one = async (q) => (await db.query(q)).rows[0];

const sellerMsg = await asUser(kaio, () => fail(db.query(`select public.criar_nota_local('[{"sku":"JBL-001","qtd":1,"preco_vendido":100}]'::jsonb, '[{"metodo":"pix","valor":100}]'::jsonb, null, null, 'CAIXA ESPECIAL', null, 0, 0)`)));
ok(/Somente admin/.test(sellerMsg), "seller cannot book Caixa Especial: " + sellerMsg);
ok(Number((await one("select count(*)::int n from public.notas")).n) === 0 && Number((await one("select count(*)::int n from public.caixa_especial_mov")).n) === 0, "refused sale writes nothing");

const nid = await asUser(mike, async () => Number((await one(`select public.criar_nota_local('[{"sku":"JBL-001","qtd":1,"preco_vendido":100}]'::jsonb, '[{"metodo":"pix","valor":100}]'::jsonb, null, null, 'CAIXA ESPECIAL', null, 0, 0) id`)).id));
const booked = await one(`select n.local_pagamento, n.cxesp_mov_id, m.tipo, m.valor, m.nota_id from public.notas n join public.caixa_especial_mov m on m.id = n.cxesp_mov_id where n.id = ${nid}`);
ok(booked.local_pagamento === "CAIXA ESPECIAL" && booked.tipo === "entrada" && Number(booked.valor) === 100 && Number(booked.nota_id) === nid, "paid nota enters Caixa Especial tied to the nota");
ok(Number((await one("select count(*)::int n from public.caixa_movimentos")).n) === 0, "Caixa Especial does not write HX, machine, or cash");

const mix = await asUser(mike, async () => Number((await one(`select public.criar_nota_local('[{"sku":"JBL-001","qtd":1,"preco_vendido":100}]'::jsonb, '[{"metodo":"pix","valor":60},{"metodo":"prazo","valor":40}]'::jsonb, null, null, 'CAIXA ESPECIAL', null, 0, 0) id`)).id));
const mixMov = await one(`select m.valor from public.notas n join public.caixa_especial_mov m on m.id = n.cxesp_mov_id where n.id = ${mix}`);
ok(Number(mixMov.valor) === 60, "only the paid part enters; Paga Depois stays out");

const maq = await asUser(mike, async () => Number((await one(`select public.criar_nota_local('[{"sku":"JBL-001","qtd":1,"preco_vendido":20}]'::jsonb, '[{"metodo":"pix","valor":20}]'::jsonb, null, null, 'MAQUINA', null, 0, 0) id`)).id));
const maqRow = await one(`select local_pagamento, cxesp_mov_id from public.notas where id = ${maq}`);
ok(maqRow.local_pagamento === "MAQUINA" && maqRow.cxesp_mov_id == null, "Máquina still does not touch Caixa Especial");
ok(Number((await one("select count(*)::int n from public.caixa_especial_mov")).n) === 2, "Máquina added no special movement");

const bad = await asUser(mike, () => fail(db.query(`select public.criar_nota_local('[{"sku":"JBL-001","qtd":1,"preco_vendido":10}]'::jsonb, '[{"metodo":"pix","valor":10}]'::jsonb, null, null, 'GASTOS LOJA', null, 0, 0)`)));
ok(/Escolha o Local do pagamento/.test(bad), "an unknown local is refused: " + bad);

const saida = await asUser(mike, async () => Number((await one(`select public._cxesp_estornar_nota(${nid}, 'cancelou a nota') id`)).id));
const after = await one(`select n.cxesp_mov_id, s.tipo, s.valor, s.nota_id, s.estorno_de from public.notas n, public.caixa_especial_mov s where n.id = ${nid} and s.id = ${saida}`);
ok(after.cxesp_mov_id == null && after.tipo === "saida" && Number(after.valor) === 100 && Number(after.nota_id) === nid && Number(after.estorno_de) > 0, "cancel reversal uses the existing special-ledger estorno");
ok(Number((await one("select count(*)::int n from public.caixa_movimentos")).n) === 0, "reversal does not touch the day caixas");

if (failed) { console.error(failed + " failed"); process.exit(1); }
console.log("nota caixa especial sql ok");
