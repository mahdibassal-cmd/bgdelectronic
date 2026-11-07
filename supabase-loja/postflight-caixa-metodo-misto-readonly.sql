-- READ ONLY after the audited apply. bagda-loja / xvsxnicmpkvzzhkkqgam.
-- Do not call the receipt functions. Do not select customer rows.

select 'caixa' as kind, c.id::text as object, c.nome as name,
       coalesce(c.metodo::text, 'NULL') || ' ativo=' || c.ativo::text as detail
  from public.caixas c
 where c.id in (10, 11) or c.nome in ('LARANJIHA', 'GETNET')
union all
select 'function', p.oid::text, p.proname,
       case when p.prosrc like '%if v_met is null then raise exception ''Caixa inválido''%' then 'OLD NULL-metodo check remains'
            when p.prosrc like '%if v_cx is null then raise exception ''Caixa inválido''%'
             and p.prosrc like '%Forma de pagamento inválida%' then 'id check plus explicit forma'
            else 'UNEXPECTED' end
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('registrar_recebimento', 'registrar_recebimento_credito')
union all
select 'unchanged', p.oid::text, 'registrar_recebimento_cxesp',
       md5(p.prosrc) || ' ' || case when p.prosrc like '%can(''admin'')%' then 'still admin' else 'ADMIN CHECK MISSING' end
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'registrar_recebimento_cxesp'
union all
select 'grant', p.proname, r.rolname, privilege_type
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a on true
  join pg_roles r on r.oid = a.grantee
 where n.nspname = 'public'
   and p.proname in ('registrar_recebimento', 'registrar_recebimento_credito')
order by 1, 2, 3;
