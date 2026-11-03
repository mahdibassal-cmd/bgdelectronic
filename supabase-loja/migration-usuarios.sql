-- BAGDA STORES (bagda-loja, ref xvsxnicmpkvzzhkkqgam) — Usuários + controle de acesso (bloqueio manual + horário 17:30–08:00 SP)
-- Rodar DEPOIS de schema.sql, security.sql, migration-clientes.sql e migration-caixa-resumo.sql. Idempotente.
begin;

-- Perfil pronto para login de cliente no futuro (não usado ainda): tipo + vínculo opcional ao cadastro de cliente.
alter table public.profiles add column if not exists tipo text not null default 'staff' check (tipo in ('staff','cliente'));
alter table public.profiles add column if not exists cliente_id bigint references public.clientes(id) on delete set null;

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
-- Toda policy usa mfa_ok() / can() / has_perm() / is_active_staff(); todas as RPCs (criar_nota incluída) usam can()/is_admin().
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
create or replace function public.has_perm(p text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.system_unlocked() and public.acesso_liberado() and exists (select 1 from public.profiles pr join public.role_perms rp on rp.role = pr.role
                 where pr.id = auth.uid() and pr.ativo and pr.tipo = 'staff' and rp.perm = p);
$$;
commit;

-- Teste rápido (como admin no SQL editor isso retorna admin=true; para simular, veja supabase-loja/tests):
-- select public.acesso_status();
