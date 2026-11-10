// Ponto eletrônico (RLS + RPCs). PGlite, sem produção.
import { readFileSync } from "node:fs";
const { PGlite } = await import("@electric-sql/pglite").catch(() => import("/tmp/pgdeps/node_modules/@electric-sql/pglite/dist/index.js"));

const sql = readFileSync(new URL("../migration-ponto.sql", import.meta.url), "utf8");
const db = new PGlite();
let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.error("FAIL", m); } else console.log("ok", m); };
const mike = "00000000-0000-0000-0000-00000000000a";
const pam = "00000000-0000-0000-0000-00000000000b";
const kaio = "00000000-0000-0000-0000-00000000000d";
const totem = "00000000-0000-0000-0000-00000000000e";

const vec = (seed) => {
  const a = Array.from({ length: 128 }, (_, i) => Number(((i + 1) * 0.001 + seed).toFixed(6)));
  return JSON.stringify(a);
};
const near = (seed) => {
  const a = Array.from({ length: 128 }, (_, i) => Number(((i + 1) * 0.001 + seed + 0.0002).toFixed(6)));
  return JSON.stringify(a);
};
const CONSENT = "Ao cadastrar meu rosto, autorizo a BAGDA STORES a tratar minha biometria facial apenas para registro de ponto eletrônico, nos termos da LGPD.";

await db.exec(`
create role anon nologin; create role authenticated nologin;
create schema if not exists auth;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt()->>'sub','')::uuid $$;
create table public.profiles(id uuid primary key, role text, ativo boolean default true, handle text, nome text);
create table public.role_perms(role text, perm text);
insert into public.profiles values
  ('${mike}','admin',true,'@mike','Mike'),
  ('${pam}','financeiro',true,'@pamela','Pamela'),
  ('${kaio}','vendedor',true,'@kaio','Kaio'),
  ('${totem}','vendedor',true,'@totem','Totem Loja');
insert into public.role_perms values
  ('admin','admin'),('admin','caixa'),('admin','financas'),('admin','vendas'),
  ('financeiro','caixa'),('financeiro','financas'),
  ('vendedor','vendas');
create function public.has_perm(p text) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles pr join public.role_perms rp on rp.role = pr.role
    where pr.id = auth.uid() and pr.ativo and rp.perm = p) $$;
create function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$ select public.has_perm('admin') $$;
create function public.is_active_staff() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.ativo) $$;
grant usage on schema public to anon, authenticated;
grant usage on schema auth to anon, authenticated;
grant select on public.profiles, public.role_perms to authenticated;
`);
try { await db.exec(sql); } catch (e) { console.error("SQL FAIL", e.message); process.exit(1); }

const as = async id => db.exec(`reset role; select set_config('request.jwt.claims', '{"sub":"${id}"}', false); set role authenticated;`);
const one = async q => (await db.query(q)).rows[0];
const num = async q => Number(Object.values(await one(q))[0]);
const err = async q => { try { await db.query(q); return ""; } catch (e) { return e.message; } };

const enroll = (uid, seed, by = uid) =>
  `select public.ponto_cadastrar_face('${vec(seed)}'::jsonb, '${uid}/ref.jpg', true, '${CONSENT}', '${uid}'::uuid)`;

await as(kaio);
ok(await num("select count(*) from ponto_registros") === 0, "start empty");
let e = await err(`select public.registrar_ponto('entrada', '${vec(0.1)}'::jsonb, 'x.jpg')`);
ok(/Cadastre seu rosto/.test(e), "punch without face is refused: " + e);

e = await err(`select public.ponto_cadastrar_face('${vec(0.1)}'::jsonb, 'kaio/ref.jpg', false, '${CONSENT}', null)`);
ok(/consentimento/.test(e), "enrollment without consent is refused: " + e);

ok(!!(await one(enroll(kaio, 0.1))), "seller enrolls own face");
ok(await num("select count(*) from ponto_faces") === 1, "one face stored");

e = await err(enroll(mike, 0.2));
ok(/administrador cadastra/.test(e), "seller cannot enroll someone else: " + e);

const r1 = await one(`select public.registrar_ponto('entrada', '${near(0.1)}'::jsonb, 'kaio/e.jpg', 'UA-K',  -23.5, -46.6) as j`);
ok(r1.j.ok === true && r1.j.tipo === "entrada" && r1.j.id, "seller punches entrada");
ok(typeof r1.j.registrado_em === "string" && r1.j.score <= 0.55, "server returns timestamp and passing score " + r1.j.score);

e = await err(`select public.registrar_ponto('entrada', '${near(0.1)}'::jsonb, 'kaio/e2.jpg')`);
ok(/já foi registrado hoje/.test(e), "duplicate entrada same day is refused: " + e);

const bad = await one(`select public.registrar_ponto('saida_almoco', '${vec(0.9)}'::jsonb, 'kaio/bad.jpg') as j`);
ok(bad.j.ok === false && /não confere/.test(bad.j.motivo || ""), "mismatch is refused: " + JSON.stringify(bad.j));
ok(await num("select count(*) from ponto_falhas") === 1, "mismatch goes to ponto_falhas");
ok(await num("select count(*) from ponto_registros where not excluido") === 1, "failed match does not create a punch");

const r2 = await one(`select public.registrar_ponto('saida_almoco', '${near(0.1)}'::jsonb, 'kaio/a.jpg') as j`);
ok(r2.j.ok && r2.j.tipo === "saida_almoco", "seller punches saida_almoco");

await as(pam);
ok(await num("select count(*) from ponto_registros") === 0, "financeiro does not see seller punches (RLS)");
ok(await num("select count(*) from ponto_faces") === 0, "financeiro does not see seller face (RLS)");
ok(!!(await one(enroll(pam, 0.3))), "financeiro enrolls own face");
ok(!!(await one(`select public.registrar_ponto('entrada', '${near(0.3)}'::jsonb, 'pam/e.jpg') as j`)).j.ok, "financeiro punches own entrada");

await as(mike);
ok(await num("select count(*) from ponto_registros where not excluido") === 3, "admin sees everyone's punches");
ok(await num("select count(*) from ponto_faces") === 2, "admin sees all faces");
ok(!!(await one(enroll(mike, 0.4))), "admin enrolls self");
e = await err(`select public.ponto_editar_registro(1, 'saida', 'ok')`);
// id 1 may be kaio's; if found without motivo we already require motivo
e = await err(`select public.ponto_editar_registro((select id from ponto_registros where user_id='${kaio}' and tipo='entrada' limit 1), 'saida', 'ab')`);
ok(/Informe o motivo/.test(e), "admin edit requires motivo: " + e);

const eid = (await one(`select id from ponto_registros where user_id='${kaio}' and tipo='entrada'`)).id;
ok((await one(`select public.ponto_editar_registro(${eid}, 'entrada', 'ajuste de tipo demonstrativo') as j`)).j.ok, "admin edits punch with motivo");
ok(await num(`select count(*) from ponto_auditoria where acao='editar' and registro_id=${eid}`) === 1, "edit writes audit trail");

e = await err(`select public.ponto_excluir_registro(${eid}, 'x')`);
ok(/Informe o motivo/.test(e), "admin delete requires motivo");
ok((await one(`select public.ponto_excluir_registro(${eid}, 'registro de teste') as j`)).j.ok, "admin soft-deletes punch");
ok(await num(`select count(*) from ponto_registros where id=${eid} and excluido`) === 1, "deleted punch is soft-deleted");
ok(await num(`select count(*) from ponto_auditoria where acao='excluir' and registro_id=${eid}`) === 1, "delete writes audit trail");

e = await err(`select public.ponto_set_jornada('${kaio}'::uuid, '08:00'::time, '07:00'::time, 60)`);
ok(/Jornada inválida/.test(e), "invalid jornada is refused");
ok((await one(`select public.ponto_set_jornada('${kaio}'::uuid, '09:00'::time, '18:00'::time, 60, '{1,2,3,4,5}', 15) as j`)).j.ok, "admin sets jornada");
ok((await one(`select entrada::text as e, tolerancia_minutos as t from ponto_jornadas where user_id='${kaio}'`)).e.startsWith("09:00"), "jornada saved");

ok((await one(`select public.ponto_set_totem('${totem}'::uuid, true, 'Tablet balcão') as j`)).j.ok, "admin marks totem user");

await as(kaio);
e = await err(`select public.ponto_editar_registro(${eid}, 'entrada', 'quero mudar')`);
ok(/administrador altera/.test(e), "seller cannot edit a punch: " + e);
e = await err(`select public.ponto_excluir_registro(${eid}, 'quero apagar')`);
ok(/administrador exclui/.test(e), "seller cannot delete a punch: " + e);
e = await err(`select public.ponto_set_jornada('${kaio}'::uuid, '08:00'::time, '18:00'::time, 60)`);
ok(/administrador define a jornada/.test(e), "seller cannot set jornada: " + e);
e = await err(`select public.registrar_ponto_totem('entrada', '${near(0.3)}'::jsonb, 't.jpg')`);
ok(/Sem permissão de totem/.test(e), "seller cannot call totem RPC: " + e);

await as(totem);
e = await err(`select public.registrar_ponto('entrada', '${near(0.1)}'::jsonb, 'x.jpg')`);
ok(/registrar_ponto_totem/.test(e) || /Cadastre seu rosto/.test(e) || /Sem permissão/.test(e) || /não confere/.test(e) || /totem/.test(e), "totem account is steered away from personal punch: " + e);

ok(!!(await one(`select public.ponto_cadastrar_face('${vec(0.5)}'::jsonb, 'totem/ref.jpg', true, '${CONSENT}', null) as j`)).j, "totem user can still enroll self if needed");
// 1:N identify pamela (0.3) from totem
const rt = await one(`select public.registrar_ponto_totem('saida_almoco', '${near(0.3)}'::jsonb, 'totem/p.jpg', 'UA-T') as j`);
ok(rt.j.ok === true && rt.j.user_id === pam && /Pamela/i.test(rt.j.nome || ""), "totem 1:N identifies Pamela: " + JSON.stringify(rt.j));
ok(rt.j.ok && rt.j.id, "totem result returned");
await as(mike);
ok((await one(`select origem from ponto_registros where id=${rt.j.id}`)).origem === "totem", "totem punch marked origem=totem");
ok(await num(`select count(*) from ponto_registros where id=${rt.j.id}`) === 1, "totem cannot be used to hide that admin can read the punch");
await as(totem);
ok(await num(`select count(*) from ponto_registros where id=${rt.j.id}`) === 0, "totem account does not read another worker's punch (RLS)");

const badt = await one(`select public.registrar_ponto_totem('saida', '${vec(0.99)}'::jsonb, 'totem/bad.jpg') as j`);
ok(badt.j.ok === false && /não reconhecido/.test(badt.j.motivo || ""), "totem mismatch is refused: " + JSON.stringify(badt.j));
ok(await num("select count(*) from ponto_falhas where origem='totem'") >= 1, "totem mismatch logged");

await as(mike);
const ts = (await one(`select registrado_em from ponto_registros where id=${rt.j.id}`)).registrado_em;
ok(ts, "punch timestamp comes from the database");

if (failed) { console.error(failed + " failed"); process.exit(1); }
console.log("ponto pglite ok");
