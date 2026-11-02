-- =====================================================================
-- IMPORTANTE: rodar de novo SEMPRE que rodar supabase-loja/schema.sql (o schema recria has_perm/mfa_ok sem a trava).
-- supabase-loja/security.sql — Segurança (bagda-loja): trava de emergência (kill switch), log de segurança,
-- encerrar sessões, endurecimento. Idempotente: pode rodar de novo.
-- Rodar DEPOIS de supabase-loja/schema.sql (e users.sql).
-- Dono (único que funciona com o sistema bloqueado e único que desbloqueia):
--   mahdibassal@icloud.com
-- =====================================================================

-- ---------- Configuração do sistema (1 linha) ----------
create table if not exists public.system_settings (
  id        int primary key default 1 check (id = 1),
  locked    boolean not null default false,
  locked_at timestamptz,
  locked_by uuid references auth.users(id) on delete set null,
  reason    text check (length(reason) <= 300)
);
insert into public.system_settings(id) values (1) on conflict (id) do nothing;
alter table public.system_settings enable row level security;
alter table public.system_settings force row level security;
revoke all on public.system_settings from public, anon, authenticated;   -- só via RPC

-- ---------- Log de segurança ----------
create table if not exists public.security_events (
  id       bigint generated always as identity primary key,
  at       timestamptz not null default now(),
  kind     text not null check (kind in ('failed_login','role_change','admin_added','profile_added','profile_removed','lock','unlock','signout_all')),
  actor    uuid,
  email    text check (length(email) <= 160),
  detail   jsonb not null default '{}'::jsonb,
  alerted  boolean not null default false
);
create index if not exists security_events_at_idx on public.security_events(at);
create index if not exists security_events_kind_at_idx on public.security_events(kind, at);
alter table public.security_events enable row level security;
alter table public.security_events force row level security;
revoke all on public.security_events from public, anon, authenticated;
grant select on public.security_events to authenticated;                -- policy: só admin

-- ---------- Helpers ----------
create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.users u
                 where u.id = auth.uid() and lower(u.email) = 'mahdibassal@icloud.com');
$$;

create or replace function public.system_unlocked() returns boolean
language sql stable security definer set search_path = '' as $$
  select not coalesce((select s.locked from public.system_settings s where s.id = 1), false)
      or public.is_owner();
$$;

-- Todas as policies usam mfa_ok(); is_admin()/is_active_staff() também passam a exigir
-- sistema desbloqueado => com a trava ligada, ninguém (exceto o dono) lê ou grava nada.
create or replace function public.mfa_ok() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.system_unlocked() and (
         coalesce(auth.jwt()->>'aal','') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f
                     where f.user_id = auth.uid() and f.status = 'verified'));
$$;
create or replace function public.has_perm(p text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.system_unlocked() and exists (select 1 from public.profiles pr join public.role_perms rp on rp.role = pr.role
                 where pr.id = auth.uid() and pr.ativo and rp.perm = p);
$$;
create or replace function public.is_active_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.system_unlocked() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.ativo);
$$;

-- aal real (sem olhar a trava), usado nas RPCs de trava
create or replace function public.aal_ok() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt()->>'aal','') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified');
$$;

revoke all on function public.is_owner(), public.system_unlocked(), public.mfa_ok(), public.is_admin(),
  public.is_active_staff(), public.aal_ok(), public.has_perm(text) from public, anon;
grant execute on function public.is_owner(), public.system_unlocked(), public.mfa_ok(), public.is_admin(),
  public.is_active_staff(), public.aal_ok(), public.has_perm(text) to authenticated;

drop policy if exists security_events_admin on public.security_events;
create policy security_events_admin on public.security_events for select to authenticated
  using (public.mfa_ok() and public.is_admin());

-- ---------- RPCs da trava ----------
-- Status: qualquer logado (a tela "Sistema bloqueado" precisa saber).
create or replace function public.system_status() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('locked', coalesce(s.locked, false), 'locked_at', s.locked_at,
                            'reason', case when public.is_owner() or not coalesce(s.locked,false) then s.reason end,
                            'is_owner', public.is_owner())
  from (select 1) x left join public.system_settings s on s.id = 1;
$$;

-- Bloquear: qualquer admin ativo (com 2FA válido se tiver).
create or replace function public.lock_system(p_reason text default null) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not (public.is_owner() or (public.aal_ok() and exists (select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'admin' and p.ativo))) then
    raise exception 'Somente admin' using errcode = '42501';
  end if;
  update public.system_settings set locked = true, locked_at = now(), locked_by = auth.uid(),
         reason = left(nullif(trim(p_reason), ''), 300) where id = 1;
  insert into public.security_events(kind, actor, detail) values ('lock', auth.uid(), jsonb_build_object('reason', left(p_reason, 300)));
end $$;

-- Desbloquear: só o dono.
create or replace function public.unlock_system() returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not (public.is_owner() and public.aal_ok()) then raise exception 'Somente o dono' using errcode = '42501'; end if;
  update public.system_settings set locked = false, locked_at = null, locked_by = null, reason = null where id = 1;
  insert into public.security_events(kind, actor) values ('unlock', auth.uid());
end $$;

-- Encerrar TODAS as sessões (inclusive a do dono): só o dono.
create or replace function public.signout_all() returns int
language plpgsql volatile security definer set search_path = '' as $$
declare n int;
begin
  if not (public.is_owner() and public.aal_ok()) then raise exception 'Somente o dono' using errcode = '42501'; end if;
  delete from auth.refresh_tokens;
  delete from auth.sessions; get diagnostics n = row_count;
  insert into public.security_events(kind, actor, detail) values ('signout_all', auth.uid(), jsonb_build_object('sessions', n));
  return n;
end $$;

-- Login falho (chamado pelo navegador, também sem login). Rate limit: 5/min por e-mail, 60/min no total.
create or replace function public.report_failed_login(p_email text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare e text := left(lower(trim(coalesce(p_email, ''))), 160); ip text;
begin
  if (select count(*) from public.security_events where kind = 'failed_login' and at > now() - interval '1 minute') >= 60
     or (select count(*) from public.security_events where kind = 'failed_login' and email = e and at > now() - interval '1 minute') >= 5 then
    return;
  end if;
  begin ip := left(split_part(coalesce(current_setting('request.headers', true)::jsonb->>'x-forwarded-for', ''), ',', 1), 64);
  exception when others then ip := null; end;
  insert into public.security_events(kind, email, detail) values ('failed_login', e, jsonb_build_object('ip', ip));
end $$;

revoke all on function public.system_status(), public.lock_system(text), public.unlock_system(),
  public.signout_all(), public.report_failed_login(text) from public, anon, authenticated;
grant execute on function public.system_status(), public.lock_system(text), public.unlock_system(),
  public.signout_all(), public.report_failed_login(text) to authenticated;
grant execute on function public.report_failed_login(text) to anon;

-- ---------- Perfis: log de mudanças + só o dono mexe em admins ----------
create or replace function public.tg_profiles_audit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.security_events(kind, actor, detail)
    values (case when new.role = 'admin' then 'admin_added' else 'profile_added' end, auth.uid(),
            jsonb_build_object('handle', new.handle, 'role', new.role));
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.security_events(kind, actor, detail) values ('profile_removed', auth.uid(), jsonb_build_object('handle', old.handle, 'role', old.role));
    return old;
  end if;
  if new.role is distinct from old.role or new.ativo is distinct from old.ativo then
    insert into public.security_events(kind, actor, detail)
    values (case when new.role = 'admin' and old.role <> 'admin' then 'admin_added' else 'role_change' end, auth.uid(),
            jsonb_build_object('handle', new.handle, 'from', old.role, 'to', new.role, 'ativo_from', old.ativo, 'ativo_to', new.ativo));
  end if;
  return new;
end $$;
-- Pelo app/API, um admin que não é o dono não pode criar/remover admins nem desativar admins.
-- (SQL Editor do dashboard roda sem auth.uid() e continua livre.)
create or replace function public.tg_profiles_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not public.is_owner()
     and (new.role is distinct from old.role and 'admin' in (new.role::text, old.role::text)
          or (old.role = 'admin' and new.ativo is distinct from old.ativo)) then
    raise exception 'Somente o dono altera administradores' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.tg_profiles_audit(), public.tg_profiles_guard() from public, anon, authenticated;
drop trigger if exists profiles_audit on public.profiles;
create trigger profiles_audit after insert or update or delete on public.profiles for each row execute function public.tg_profiles_audit();
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles for each row execute function public.tg_profiles_guard();

-- ---------- Endurecimento ----------
-- Funções novas no schema public não ganham EXECUTE para PUBLIC/anon automaticamente.
alter default privileges in schema public revoke execute on functions from public, anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
revoke all on all sequences in schema public from anon;
