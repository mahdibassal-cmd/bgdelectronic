-- KIOSK (bagda-sistema, ref zoapljfhebbvbsrebtjt) — Usuários + controle de acesso (17:30–08:00 SP) + tentativas bloqueadas
-- SÓ PARA O KIOSK. Não referencia nada da loja (sem clientes, can(), has_perm()).
-- Ordem no Kiosk: schema.sql -> migration-002.sql -> migration-003.sql -> migration-004.sql -> ESTE arquivo.
-- Depende apenas de: profiles(id,nome,role app_role,ativo), system_unlocked(), security_events (migration-004).
-- Idempotente: pode rodar de novo após falha parcial.
begin;

do $$ begin
  if to_regtype('public.app_role') is null or to_regclass('public.security_events') is null
     or to_regprocedure('public.system_unlocked()') is null then
    raise exception 'Rode schema.sql e migration-002..004 do Kiosk antes deste arquivo';
  end if;
  if to_regclass('public.clientes') is not null then
    raise notice 'Aviso: public.clientes existe — confirme que este é o projeto do KIOSK (zoapljfhebbvbsrebtjt)';
  end if;
end $$;

alter table public.profiles add column if not exists tipo text not null default 'staff' check (tipo in ('staff','cliente'));

-- ---------- Config de acesso (1 linha) ----------
create table if not exists public.acesso_config (
  id         smallint primary key default 1 check (id = 1),
  bloqueado  boolean not null default false,          -- bloqueio manual ("Bloquear acesso")
  fecha      time not null default '17:30',           -- horário America/Sao_Paulo
  abre       time not null default '08:00',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  check (fecha <> abre)
);
insert into public.acesso_config (id) values (1) on conflict (id) do nothing;
alter table public.acesso_config enable row level security;
alter table public.acesso_config force row level security;
revoke all on public.acesso_config from public, anon, authenticated;   -- só via RPCs abaixo

-- Admin ativo (checagem direta, sem passar pelas travas, para nunca bloquear admin).
create or replace function public.acesso_is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.ativo);
$$;

-- true = pode usar o sistema agora. Admin sempre true. Demais: sem bloqueio manual e dentro do horário.
create or replace function public.acesso_liberado() returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare c public.acesso_config; t time := (now() at time zone 'America/Sao_Paulo')::time;
begin
  if public.acesso_is_admin() then return true; end if;
  select * into c from public.acesso_config where id = 1;
  if not found then return true; end if;
  if c.bloqueado then return false; end if;
  if c.fecha > c.abre then return not (t >= c.fecha or t < c.abre);   -- ex.: fecha 17:30, abre 08:00 (vira a noite)
  else return not (t >= c.fecha and t < c.abre); end if;
end $$;

create or replace function public.acesso_status() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c public.acesso_config; t time := (now() at time zone 'America/Sao_Paulo')::time; staff boolean;
begin
  select * into c from public.acesso_config where id = 1;
  staff := not coalesce(c.bloqueado, false) and (c.id is null or
           case when c.fecha > c.abre then not (t >= c.fecha or t < c.abre) else not (t >= c.fecha and t < c.abre) end);
  return jsonb_build_object('liberado', public.acesso_is_admin() or staff, 'liberado_staff', staff,
    'bloqueado', coalesce(c.bloqueado, false), 'fecha', to_char(coalesce(c.fecha, '17:30'), 'HH24:MI'),
    'abre', to_char(coalesce(c.abre, '08:00'), 'HH24:MI'), 'agora', to_char(t, 'HH24:MI'), 'admin', public.acesso_is_admin());
end $$;

create or replace function public.set_acesso(p_bloqueado boolean default null, p_fecha time default null, p_abre time default null) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not (public.acesso_is_admin() and public.mfa_ok()) then raise exception 'Só admin' using errcode = '42501'; end if;
  if coalesce(p_fecha, (select fecha from public.acesso_config where id = 1)) = coalesce(p_abre, (select abre from public.acesso_config where id = 1))
    then raise exception 'Horário de abrir e fechar não podem ser iguais' using errcode = 'P0001'; end if;
  update public.acesso_config set bloqueado = coalesce(p_bloqueado, bloqueado), fecha = coalesce(p_fecha, fecha),
         abre = coalesce(p_abre, abre), updated_at = now(), updated_by = auth.uid() where id = 1;
  insert into public.security_events (kind, actor, detail)
    values (case when p_bloqueado is true then 'lock' when p_bloqueado is false then 'unlock' else 'role_change' end, auth.uid(),
            jsonb_build_object('acesso', true, 'bloqueado', p_bloqueado, 'fecha', p_fecha, 'abre', p_abre));
end $$;

revoke all on function public.acesso_is_admin(), public.acesso_liberado(), public.acesso_status(), public.set_acesso(boolean, time, time) from public, anon;
grant execute on function public.acesso_is_admin(), public.acesso_liberado(), public.acesso_status(), public.set_acesso(boolean, time, time) to authenticated;

-- ---------- Liga a trava em TODAS as policies/RPCs ----------
-- Kiosk: toda policy usa mfa_ok() e/ou is_active_staff()/is_admin(); RPCs (criar_nota incluída) usam is_admin()/is_active_staff().
-- Acrescentar acesso_liberado() nessas funções-base aplica o bloqueio em tudo, para não-admins.
create or replace function public.mfa_ok() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.system_unlocked() and public.acesso_liberado() and (
         coalesce(auth.jwt()->>'aal','') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f
                     where f.user_id = auth.uid() and f.status = 'verified'));
$$;
create or replace function public.is_active_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.system_unlocked() and public.acesso_liberado() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.ativo);
$$;
-- ---------- Histórico de tentativas com acesso bloqueado ----------
create table if not exists public.acesso_tentativas (
  id          bigint generated always as identity primary key,
  user_id     uuid references auth.users(id) on delete set null,
  email       text check (length(email) <= 160),
  nome        text check (length(nome) <= 120),
  role        text check (length(role) <= 30),
  motivo      text not null check (motivo in ('fora_horario','bloqueio_manual')),
  occurred_at timestamptz not null default now(),
  user_agent  text check (length(user_agent) <= 300)
);
create index if not exists acesso_tentativas_at_idx on public.acesso_tentativas(occurred_at desc);
create index if not exists acesso_tentativas_user_at_idx on public.acesso_tentativas(user_id, occurred_at desc);
alter table public.acesso_tentativas enable row level security;
alter table public.acesso_tentativas force row level security;
revoke all on public.acesso_tentativas from public, anon, authenticated;
grant select on public.acesso_tentativas to authenticated;          -- só SELECT; nada de insert/update/delete direto
drop policy if exists acesso_tentativas_admin_read on public.acesso_tentativas;
create policy acesso_tentativas_admin_read on public.acesso_tentativas for select to authenticated
  using (public.acesso_is_admin());

-- Chamado pelo frontend quando detecta o bloqueio (login/checagem periódica). Motivo calculado no servidor.
-- Dedup: no máximo 1 linha por usuário a cada 5 minutos. Retorna true se gravou.
create or replace function public.registrar_tentativa_bloqueada(p_user_agent text default null) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare uid uuid := auth.uid(); c public.acesso_config; t time := (now() at time zone 'America/Sao_Paulo')::time;
        m text; p record; e text;
begin
  if uid is null or public.acesso_is_admin() then return false; end if;
  select * into c from public.acesso_config where id = 1;
  if not found then return false; end if;
  if c.bloqueado then m := 'bloqueio_manual';
  elsif (case when c.fecha > c.abre then (t >= c.fecha or t < c.abre) else (t >= c.fecha and t < c.abre) end) then m := 'fora_horario';
  else return false; end if;
  perform pg_advisory_xact_lock(hashtext('acesso_tentativas:' || uid::text));
  if exists (select 1 from public.acesso_tentativas a where a.user_id = uid and a.occurred_at > now() - interval '5 minutes') then return false; end if;
  select pr.nome, pr.role::text as role into p from public.profiles pr where pr.id = uid;
  select u.email into e from auth.users u where u.id = uid;
  insert into public.acesso_tentativas (user_id, email, nome, role, motivo, user_agent)
    values (uid, left(e, 160), left(p.nome, 120), left(p.role, 30), m, left(p_user_agent, 300));
  return true;
end $$;
revoke all on function public.registrar_tentativa_bloqueada(text) from public, anon;
grant execute on function public.registrar_tentativa_bloqueada(text) to authenticated;
commit;
-- select public.acesso_status();
