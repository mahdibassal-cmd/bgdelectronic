-- LOJA (bagda-loja, ref xvsxnicmpkvzzhkkqgam) — histórico de tentativas com acesso bloqueado
-- Rodar DEPOIS de supabase-loja/migration-usuarios.sql (já aplicada). Idempotente.
begin;
do $$ begin
  if to_regclass('public.acesso_config') is null then raise exception 'Rode migration-usuarios.sql antes'; end if;
end $$;
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
