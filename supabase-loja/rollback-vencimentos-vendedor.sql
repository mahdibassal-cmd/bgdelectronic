-- Rollback of migration-vencimentos-vendedor.sql
-- Drops the vendedor Vencimentos RPCs only. Does not touch cobranca_alertas,
-- notas, clientes, or any business data.

drop function if exists public.vencimentos_vendedor();
drop function if exists private.vencimentos_vendedor_ler();

notify pgrst, 'reload schema';
select 'rollback vencimentos vendedor' as status;
