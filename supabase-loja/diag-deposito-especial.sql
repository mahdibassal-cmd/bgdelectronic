-- DIAG Depósito Especial (loja) — SOMENTE LEITURA. Não altera nada. Rodar e mandar o resultado de cada bloco.
-- 1) Tabelas/views existem? RLS ligado/forçado?
select c.relname, c.relkind, c.relrowsecurity as rls, c.relforcerowsecurity as rls_forcada, c.reloptions
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('deposito_especial','deposito_especial_mov','v_deposito_especial','v_deposito_especial_mov','products','product_costs','security_events','profiles')
order by 1;
-- 2) Policies (procure policies extras criadas por "Run and enable RLS" ou falta de policy de select p/ admin)
select tablename, policyname, cmd, roles, qual, with_check from pg_policies
where schemaname = 'public' and tablename in ('deposito_especial','deposito_especial_mov','products','profiles','security_events') order by 1, 2;
-- 3) Grants nas tabelas/views
select table_name, grantee, string_agg(privilege_type, ',' order by privilege_type) privs from information_schema.role_table_grants
where table_schema = 'public' and table_name in ('deposito_especial','deposito_especial_mov','v_deposito_especial','v_deposito_especial_mov') and grantee in ('anon','authenticated','public')
group by 1, 2 order by 1, 2;
-- 4) Funções: existem, assinatura, security definer, search_path, execute p/ authenticated
select p.proname, pg_get_function_identity_arguments(p.oid) args, p.prosecdef as security_definer, p.proconfig,
  has_function_privilege('authenticated', p.oid, 'execute') as exec_authenticated, has_function_privilege('anon', p.oid, 'execute') as exec_anon
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('dep_esp_entrada','dep_esp_ajuste','dep_esp_transferir','dep_esp_entrada_lote','registrar_compra_lote','can') order by 1;
-- 5) A constraint de tipos do log aceita os tipos do Depósito Especial? (se false, TODA entrada falha com 23514)
select pg_get_constraintdef(oid) like '%dep_esp_entrada%' as aceita_dep_esp_entrada, pg_get_constraintdef(oid) as def
from pg_constraint where conname = 'security_events_kind_check';
-- 6) Contagens
select (select count(*) from public.deposito_especial) dep_linhas, (select coalesce(sum(qtd),0) from public.deposito_especial) dep_un,
       (select count(*) from public.deposito_especial_mov) dep_movs, (select count(*) from public.products) produtos,
       (select count(*) from public.products where ativo) produtos_ativos,
       (select count(*) from public.products where sku ~* '^(PERF|FER)') perfumes_perf_fer,
       (select count(*) from public.security_events where kind like 'dep_esp%') logs_dep_esp;
-- 7) Últimos movimentos e erros de log (se houver)
select id, sku, tipo, qtd, qtd_antes, qtd_depois, motivo, created_at from public.deposito_especial_mov order by id desc limit 10;
-- 8) can('admin') resolve? (rodar no SQL editor retorna false porque não há usuário logado — esperado)
select public.can('admin') as can_admin_no_editor;
