-- =====================================================================
-- BAGDA STORES (bagda-loja) — FIX cliente_credito_saldo retornando NULL no SQL Editor. Idempotente.
-- Causa: cliente_credito_saldo = "case when public.can('financas') then ... end". No SQL Editor (role postgres)
--   não há auth.uid() -> can('financas') = false -> o CASE sem ELSE devolve NULL. Os dados (cliente_creditos) estão certos;
--   no app (usuário financeiro/admin com MFA) já funcionava.
-- Correção: também libera quando a SESSÃO é o dono do banco (postgres/supabase_admin = SQL Editor / service).
--   Pelo PostgREST a session_user é sempre 'authenticator', então anon/authenticated continuam dependendo de can().
--   Fora disso devolve NULL como antes (não vaza saldo). Mantém security definer, search_path = '', grants. RLS intocado.
-- =====================================================================
create or replace function public.cliente_credito_saldo(p_cliente bigint) returns numeric
language sql stable security definer set search_path = '' as $$
  select case when public.can('financas') or session_user in ('postgres', 'supabase_admin')
              then public._credito_saldo(p_cliente) end;
$$;
revoke all on function public.cliente_credito_saldo(bigint) from public, anon;
grant execute on function public.cliente_credito_saldo(bigint) to authenticated;

-- Conferência (SQL Editor): Willian 11 deve mostrar 19763.00
select public.cliente_credito_saldo(5) as credito_cliente_5, public._credito_saldo(5) as credito_interno_5;
