-- Diagnóstico (só leitura) depois de rodar migration-estoque-role.sql
select 'enum' k, string_agg(e.enumlabel, ',' order by e.enumsortorder) v from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'app_role'
union all select 'perms_estoque', string_agg(role::text || ':' || perm, ',') from public.role_perms where perm = 'estoque' or role::text = 'estoque'
union all select 'estoque_com_outras_perms', count(*)::text from public.role_perms where role::text = 'estoque' and perm <> 'estoque'
union all select 'kinds_ok', (pg_get_constraintdef(oid) like '%compra_imei_baixado%' and pg_get_constraintdef(oid) like '%compra_item_recebido%' and pg_get_constraintdef(oid) like '%caixa_hx_config%')::text from pg_constraint where conname = 'security_events_kind_check'
union all select 'col_recebido_sem_imei', count(*)::text from information_schema.columns where table_schema = 'public' and table_name = 'purchases' and column_name = 'recebido_sem_imei'
union all select 'rpcs', string_agg(proname, ',' order by proname) from pg_proc where pronamespace = 'public'::regnamespace and proname in ('dep_esp_lista','dep_esp_movs','compra_imei_baixar','compra_item_receber','compra_item_recebidos')
union all select 'policies', string_agg(policyname, ',') from pg_policies where schemaname = 'public' and policyname in ('products_read_estoque','compras_ler','compra_imeis_ler')
union all select 'usuarios_estoque', count(*)::text from public.profiles where role::text = 'estoque';
