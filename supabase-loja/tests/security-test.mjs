import { PGlite } from "@electric-sql/pglite"; import fs from "fs";
const R=new URL("../", import.meta.url).pathname, S=f=>fs.readFileSync(R+f,"utf8");
const db=new PGlite(); let fails=0; const ok=(c,m)=>{console.log((c?"PASS ":"FAIL ")+m); if(!c)fails++;};
await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth; grant usage on schema auth to anon, authenticated; grant usage on schema public to anon, authenticated;
create table auth.users(id uuid primary key, email text); create table auth.mfa_factors(user_id uuid, status text); create table auth.sessions(id uuid, user_id uuid); create table auth.refresh_tokens(id int, session_id uuid);
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt()->>'sub','')::uuid $$;
grant execute on all functions in schema auth to anon, authenticated;`);
const users=fs.readFileSync(R+"users.sql","utf8"); const emails=[...users.matchAll(/\('([^']+@[^']+)'/g)].map(m=>m[1]);
await db.exec(`insert into auth.users values ${emails.map((e,i)=>`('00000000-0000-0000-0000-0000000001${String(i).padStart(2,"0")}','${e}')`).join(",")}, ('00000000-0000-0000-0000-000000000999','mahdibassal@icloud.com')`);
for (const f of ["schema.sql","users.sql","security.sql","security.sql","schema.sql","security.sql"]) { await db.exec(S(f)); console.log("ran "+f); }
const ad=(await db.query("select p.id from public.profiles p where role='admin' limit 1")).rows[0].id, ve=(await db.query("select p.id from public.profiles p where role='vendedor' limit 1")).rows[0].id;
await db.exec(`insert into public.profiles(id,handle,nome,role) select '00000000-0000-0000-0000-000000000999','@mbx','MB','admin' where not exists (select 1 from public.profiles where id='00000000-0000-0000-0000-000000000999')`);
const as=uid=>db.exec(`reset role; select set_config('request.jwt.claims','${JSON.stringify({sub:uid,aal:"aal1"})}',false); set role authenticated;`);
await as(ve); const before=(await db.query("select count(*)::int n from public.caixas")).rows[0].n;
await as(ad); const cb=(await db.query("select count(*)::int n from public.caixas")).rows[0].n; ok(cb===3,"admin sees caixas unlocked");
await db.query("select public.lock_system('t')");
for (const t of ["caixas","products","profiles","notas"]) { await as(ad); ok((await db.query(`select count(*)::int n from public.${t}`)).rows[0].n===0,"LOCKED admin 0 rows "+t); await as(ve); ok((await db.query(`select count(*)::int n from public.${t}`)).rows[0].n===0,"LOCKED vendedor 0 rows "+t); }
await as("00000000-0000-0000-0000-000000000999"); ok((await db.query("select count(*)::int n from public.caixas")).rows[0].n===3,"LOCKED owner sees caixas");
await db.query("select public.unlock_system()"); await as(ad); ok((await db.query("select count(*)::int n from public.caixas")).rows[0].n===3,"unlocked again");
await db.exec("reset role"); console.log((await db.query("select string_agg(kind,',') k from public.security_events")).rows[0].k);
console.log(fails?fails+" FAILURES":"ALL PASS");
