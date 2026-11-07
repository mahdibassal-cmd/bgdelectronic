-- READ ONLY. bagda-loja / xvsxnicmpkvzzhkkqgam.
-- Do not call registrar_recebimento or registrar_recebimento_credito.
-- Do not select clientes, recebimentos, or movements.

select 'caixa' as kind, c.id::text as object, c.nome as name,
       coalesce(c.metodo::text, 'NULL') || ' ativo=' || c.ativo::text as detail
  from public.caixas c
 where c.id in (10, 11) or c.nome in ('LARANJIHA', 'GETNET')
union all
select 'function', p.oid::text, p.proname,
       case when p.prosrc like '%if v_met is null then raise exception ''Caixa inválido''%' then 'NULL metodo is Caixa inválido'
            when p.prosrc like '%if v_cx is null then raise exception ''Caixa inválido''%' then 'missing or inactive id is Caixa inválido'
            else 'other' end
       || ' ' || case when p.prosecdef then 'security definer' else 'invoker' end
       || ' ' || coalesce(array_to_string(p.proconfig, ','), '')
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('registrar_recebimento', 'registrar_recebimento_credito', 'registrar_recebimento_cxesp')
union all
select 'grant', p.proname, r.rolname, privilege_type
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a on true
  join pg_roles r on r.oid = a.grantee
 where n.nspname = 'public'
   and p.proname in ('registrar_recebimento', 'registrar_recebimento_credito', 'registrar_recebimento_cxesp')
order by 1, 2, 3;
