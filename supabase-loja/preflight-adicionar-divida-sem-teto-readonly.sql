-- READ ONLY. bagda-loja / xvsxnicmpkvzzhkkqgam.
-- Do not call public.adicionar_divida. Do not select clientes or notas.

select 'column' as kind, c.table_name as object, c.column_name as name,
       c.data_type || '(' || c.numeric_precision || ',' || c.numeric_scale || ')' as detail
  from information_schema.columns c
 where c.table_schema = 'public'
   and (c.table_name, c.column_name) in (
     ('notas', 'frete'), ('notas', 'total'),
     ('nota_pagamentos', 'valor'), ('divida_legado_idem', 'valor'))
union all
select 'function', 'public', p.proname,
       p.oid::text || ' ' || pg_get_function_identity_arguments(p.oid)
       || ' ' || case when p.prosecdef then 'security definer' else 'invoker' end
       || ' ' || coalesce(array_to_string(p.proconfig, ','), '')
       || ' ' || case when p.prosrc like '%v_val > 999999.99%' then 'HAS commercial cap' else 'NO commercial cap' end
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'adicionar_divida'
union all
select 'grant', 'public', p.proname, r.rolname || ' ' || privilege_type
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a on true
  join pg_roles r on r.oid = a.grantee
 where n.nspname = 'public' and p.proname = 'adicionar_divida'
union all
select 'unchanged', 'public', p.proname, p.oid::text || ' ' || pg_get_function_identity_arguments(p.oid)
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('criar_nota', 'criar_nota_local', 'cliente_extrato')
order by 1, 2, 3;
