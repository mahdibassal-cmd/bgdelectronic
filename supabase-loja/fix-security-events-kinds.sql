-- Fix: Caixa Geral functions log kinds not allowed by security_events_kind_check.
-- Idempotent: re-creates the constraint with all previous kinds (security.sql + migration-clientes.sql)
-- plus the new ones used by migration-caixa-geral.sql (lancar_credito, registrar_recebimento_credito, lancar_nota_caixa).
do $$ begin
  if to_regclass('public.security_events') is not null then
    alter table public.security_events drop constraint if exists security_events_kind_check;
    alter table public.security_events add constraint security_events_kind_check check (kind in (
      'failed_login','role_change','admin_added','profile_added','profile_removed','lock','unlock','signout_all',
      'fin_pagamento','fin_recebimento','fin_alteracao',
      'credito_entrada','credito_uso','credito_excedente','nota_lancada'));
  end if;
end $$;
