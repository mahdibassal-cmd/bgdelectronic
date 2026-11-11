// Prazo 1–30 dias + cobrança. PGlite, sem produção.
import { readFileSync } from "node:fs";
const { PGlite } = await import("@electric-sql/pglite").catch(() => import("/tmp/pgdeps/node_modules/@electric-sql/pglite/dist/index.js"));

const sql = readFileSync(new URL("../migration-prazo-vencimento.sql", import.meta.url), "utf8");
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
insert into public.role_perms values ('admin','admin'),('admin','caixa'),('admin','financas'),('admin','vendas'),('financeiro','caixa'),('financeiro','financas'),('vendedor','vendas');
create function public.can(p text) returns boolean language sql stable as $$
  select exists (select 1 from public.profiles pr join public.role_perms rp on rp.role = pr.role
    where pr.id = auth.uid() and pr.ativo and rp.perm = p) $$;
create table public.clientes(
  id bigint generated always as identity primary key,
  nome text not null,
  doc text, telefone text, email text, endereco text, obs text,
  ativo boolean not null default true,
  atendimento text,
  created_at timestamptz not null default now()
);
create table public.notas(
  id bigint generated always as identity primary key,
  cliente_id bigint references public.clientes(id),
  data date not null default (now() at time zone 'America/Sao_Paulo')::date,
  status text not null default 'ativa',
  total numeric(12,2) not null default 0,
  frete numeric(12,2) not null default 0,
  caxinha_natal numeric(12,2) not null default 0,
  local_pagamento text,
  obs_pagamento text,
  caixa_lancada_id smallint,
  lancada_em timestamptz,
  lancada_por uuid,
  cxesp_lancada_em timestamptz,
  cxesp_lancada_por uuid,
  cxesp_mov_id bigint
);
create type public.pay_method as enum ('dinheiro','pix','cartao','prazo','credito','transferencia');
create table public.nota_pagamentos(
  id bigint generated always as identity primary key,
  nota_id bigint not null references public.notas(id),
  metodo public.pay_method not null,
  valor numeric(12,2) not null
);
create table public.cliente_recebimentos(
  id bigint generated always as identity primary key,
  cliente_id bigint not null references public.clientes(id),
  valor numeric(12,2) not null,
  data date not null default current_date,
  forma text, caixa_id smallint, obs text, mov_id bigint, user_id uuid
);
create table public.recebimento_notas(
  recebimento_id bigint not null references public.cliente_recebimentos(id) on delete cascade,
  nota_id bigint not null references public.notas(id),
  valor numeric(12,2) not null check (valor > 0),
  primary key (recebimento_id, nota_id)
);
create table public.cliente_creditos(id bigint generated always as identity primary key, cliente_id bigint, tipo text, valor numeric, obs text, nota_id bigint);
create table public.caixa_especial_mov(id bigint generated always as identity primary key, nota_id bigint);
create function public._credito_saldo(p bigint) returns numeric language sql stable as $$ select 0::numeric $$;
create function public._cxesp_inserir(t text, v numeric, m text, a text, c bigint, d bigint) returns bigint language sql as $$ select 0::bigint $$;
create function public.fin_log(k text, d jsonb) returns void language sql as $$ select $$;
create function public.clientes_fiado() returns table(cliente_id bigint, fiado numeric)
language sql stable security definer set search_path = '' as $$
  select n.cliente_id, sum(np.valor) from public.notas n join public.nota_pagamentos np on np.nota_id = n.id
   where public.can('financas') and n.status = 'ativa' and n.cliente_id is not null and np.metodo::text = 'prazo' group by n.cliente_id;
$$;
create function public.criar_nota(p_items jsonb, p_pagamentos jsonb, p_cliente text default null, p_cliente_id bigint default null,
  p_frete numeric default 0, p_caxinha_natal numeric default 0)
returns bigint language plpgsql as $$
declare v_id bigint; pg jsonb;
begin
  if exists (select 1 from jsonb_array_elements(p_pagamentos) x where x->>'metodo' = 'prazo') and p_cliente_id is null then
    raise exception 'Paga Depois exige cliente cadastrado' using errcode = 'P0001';
  end if;
  insert into public.notas(cliente_id, status, total, frete, caxinha_natal)
  values (p_cliente_id, 'ativa', 0, coalesce(p_frete,0), coalesce(p_caxinha_natal,0))
  returning id into v_id;
  for pg in select * from jsonb_array_elements(coalesce(p_pagamentos, '[]'::jsonb)) loop
    insert into public.nota_pagamentos(nota_id, metodo, valor)
    values (v_id, (pg->>'metodo')::public.pay_method, (pg->>'valor')::numeric);
  end loop;
  return v_id;
end $$;
insert into public.clientes(nome) values ('Maria Souza'), ('João Lima'), ('Pedro Pago'), ('Sofia Prado');
`);

try { await db.exec(sql); } catch (e) { console.error("SQL FAIL", e.message); process.exit(1); }

const as = async id => db.exec(`select set_config('request.jwt.claims', '{"sub":"${id}"}', false)`);
const one = async q => (await db.query(q)).rows[0];
const err = async q => { try { await db.query(q); return ""; } catch (e) { return e.message; } };

const cols = await db.query(`select column_name from information_schema.columns where table_schema='public' and table_name='notas' and column_name in ('prazo_dias','vencimento') order by 1`);
ok(cols.rows.map(r => r.column_name).join(",") === "prazo_dias,vencimento", "notas.prazo_dias and vencimento exist");
const lim = await one(`select column_name, data_type from information_schema.columns where table_schema='public' and table_name='clientes' and column_name='limite_prazo'`);
ok(lim && /numeric/.test(lim.data_type), "clientes.limite_prazo numeric");

const sig = await db.query(`select pg_get_function_identity_arguments(p.oid) as args from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='criar_nota_local'`);
ok(sig.rows.length === 1 && /p_prazo_dias/.test(sig.rows[0].args), "criar_nota_local has p_prazo_dias: " + (sig.rows[0] || {}).args);
const old = await one(`select exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='criar_nota_local' and pg_get_function_identity_arguments(p.oid) = 'p_items jsonb, p_pagamentos jsonb, p_cliente text, p_cliente_id bigint, p_local text, p_obs text, p_frete numeric, p_caxinha_natal numeric') as has_old`);
ok(old.has_old === false, "old 8-arg criar_nota_local was dropped (9-arg with default covers it)");

const grant = await one(`select exists (select 1 from information_schema.routine_privileges where routine_schema='public' and routine_name='criar_nota_local' and grantee='authenticated' and privilege_type='EXECUTE') as g`);
ok(grant.g === true, "criar_nota_local execute granted to authenticated");
const grant2 = await one(`select exists (select 1 from information_schema.routine_privileges where routine_schema='public' and routine_name='cobranca_alertas' and grantee='authenticated' and privilege_type='EXECUTE') as g`);
ok(grant2.g === true, "cobranca_alertas execute granted to authenticated");

await as(kaio);
const pags = `[{"metodo":"prazo","valor":100}]`;
let e = await err(`select public.criar_nota_local('[]'::jsonb, '${pags}'::jsonb, 'Maria', 1, null, null, 0, 0, null)`);
ok(!/Informe o prazo/.test(e), "prazo note without term is not refused for the term (old cached app keeps working): " + e);
e = await err(`select public.criar_nota_local('[]'::jsonb, '${pags}'::jsonb, 'Maria', 1, null, null, 0, 0, 0)`);
ok(/Informe o prazo/.test(e), "prazo 0 is refused");
e = await err(`select public.criar_nota_local('[]'::jsonb, '${pags}'::jsonb, 'Maria', 1, null, null, 0, 0, 31)`);
ok(/Informe o prazo/.test(e), "prazo 31 is refused");

const n7 = await one(`select public.criar_nota_local('[]'::jsonb, '${pags}'::jsonb, 'Maria', 1, null, null, 0, 0, 7) as id`);
ok(n7 && n7.id > 0, "prazo 7 is accepted");
const row = await one(`select prazo_dias, vencimento, data, vencimento - data as delta from public.notas where id = ${n7.id}`);
ok(+row.prazo_dias === 7 && Number(row.delta) === 7, "vencimento = data + 7 (prazo_dias=" + row.prazo_dias + " vencimento=" + row.vencimento + " data=" + row.data + ")");
ok(Number(row.delta) === 7, "delta is 7 days, got " + row.delta);

const pix = await one(`select public.criar_nota_local('[]'::jsonb, '[{"metodo":"pix","valor":50}]'::jsonb, null, null, 'DINHEIRO', null, 0, 0, null) as id`);
const pixRow = await one(`select prazo_dias, vencimento from public.notas where id = ${pix.id}`);
ok(pixRow.prazo_dias == null && pixRow.vencimento == null, "non-prazo note stays without term");

// seed cobrança cases relative to today SP
await db.exec(`
insert into public.notas(id, cliente_id, data, status, total, prazo_dias, vencimento)
  overriding system value
  values
  (9001, 1, (now() at time zone 'America/Sao_Paulo')::date - 12, 'ativa', 800, 7, (now() at time zone 'America/Sao_Paulo')::date - 5),
  (9002, 2, (now() at time zone 'America/Sao_Paulo')::date, 'ativa', 300, 1, (now() at time zone 'America/Sao_Paulo')::date),
  (9003, 2, (now() at time zone 'America/Sao_Paulo')::date, 'ativa', 200, 2, (now() at time zone 'America/Sao_Paulo')::date + 2),
  (9004, 3, (now() at time zone 'America/Sao_Paulo')::date - 20, 'ativa', 400, 7, (now() at time zone 'America/Sao_Paulo')::date - 13),
  (9005, 4, (now() at time zone 'America/Sao_Paulo')::date, 'ativa', 1500, 15, (now() at time zone 'America/Sao_Paulo')::date + 15);
select setval('public.notas_id_seq', 9100, false);
insert into public.nota_pagamentos(nota_id, metodo, valor) values
  (9001,'prazo',800),(9002,'prazo',300),(9003,'prazo',200),(9004,'prazo',400),(9005,'prazo',1500);
insert into public.cliente_recebimentos(id, cliente_id, valor, data) overriding system value values (801, 3, 400, current_date);
insert into public.recebimento_notas(recebimento_id, nota_id, valor) values (801, 9004, 400);
update public.clientes set limite_prazo = 1000 where id = 4;
update public.clientes set limite_prazo = 50 where id = 1;
`);

await as(kaio);
e = await err(`select public.cobranca_alertas()`);
ok(/Sem permissão/.test(e), "vendedor cannot read cobranca_alertas: " + e);

await as(pam);
const raw = await one(`select public.cobranca_alertas() as j`);
const j = raw.j;
ok(j && Number(j.n_clientes) >= 3, "financeiro sees cobrança clients: " + JSON.stringify(j.n_clientes));
const ids = (j.clientes || []).map(c => +c.cliente_id);
ok(ids.includes(1) && (j.clientes.find(c => +c.cliente_id === 1) || {}).tem_vencida, "Maria has vencida");
ok((j.clientes.find(c => +c.cliente_id === 1) || {}).no_limite === true, "Maria is over her limite");
ok((j.clientes.find(c => +c.cliente_id === 2) || {}).tem_vence_hoje === true, "João has vence hoje");
ok((j.clientes.find(c => +c.cliente_id === 2) || {}).tem_vence_breve === true, "João also has vence em até 2 dias");
ok(!ids.includes(3), "fully paid overdue nota is not alerted");
ok((j.clientes.find(c => +c.cliente_id === 4) || {}).no_limite === true
  && !(j.clientes.find(c => +c.cliente_id === 4) || {}).tem_vencida, "Sofia is only over the limite (due in 15 days)");

// legacy note without vencimento does not create a date alert by itself
await db.exec(`
insert into public.notas(id, cliente_id, data, status, total) overriding system value
  values (9006, 2, (now() at time zone 'America/Sao_Paulo')::date - 40, 'ativa', 50);
insert into public.nota_pagamentos(nota_id, metodo, valor) values (9006,'prazo',50);
`);
const j2 = (await one(`select public.cobranca_alertas() as j`)).j;
const joao = (j2.clientes || []).find(c => +c.cliente_id === 2);
const undated = (joao.notas || []).find(n => +n.nota_id === 9006);
ok(undated && undated.classe == null && undated.vencimento == null, "legacy prazo nota has no due date and no date class");

if (failed) { console.error(failed + " failed"); process.exit(1); }
console.log("prazo vencimento sql ok");
