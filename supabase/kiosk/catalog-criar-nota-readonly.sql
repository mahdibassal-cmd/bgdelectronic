-- READ ONLY. Run on the project the browser actually called.
-- Loja xvsxnicmpkvzzhkkqgam was cataloged at 16:07 BRT on 6 Nov 2026:
-- one criar_nota (oid 18753) and one criar_nota_local (oid 18755).
-- No pay_method-leading signature. Do not drop or replace anything from this file.

select n.nspname, p.proname, p.oid::bigint as oid,
       pg_get_function_identity_arguments(p.oid) as identity_args,
       pg_get_function_result(p.oid) as result,
       p.prosecdef as security_definer,
       coalesce(array_to_string(p.proconfig, ','), '') as config
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('criar_nota', 'criar_nota_local')
 order by p.proname, p.oid;
