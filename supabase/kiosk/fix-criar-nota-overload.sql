-- =====================================================================
-- fix-criar-nota-overload.sql — Kiosk zoapljfhebbvbsrebtjt apenas.
-- NÃO executar sem autorização explícita do kiosk. Sem CASCADE.
-- Não roda na loja. Não cria criar_nota_local. Não recria pay_method.
--
-- Catálogo ao vivo (6 Nov 2026): 
--   oid 17807 criar_nota(pay_method, jsonb, text) ainda com "> 30"
--   oid 18018 criar_nota(..., numeric default 0, numeric default 0) ainda com "> 30"
-- Chamada sem p_frete/p_caxinha_natal cabe nas duas.
-- Este arquivo regrava só a de 5 argumentos, tira somente o "> 30",
-- e remove a de 3 só se nada depender dela.
-- =====================================================================

do $$
declare
  v_old oid := to_regprocedure('public.criar_nota(public.pay_method, jsonb, text)');
  v_new oid := to_regprocedure('public.criar_nota(public.pay_method, jsonb, text, numeric, numeric)');
  v_deps int;
begin
  if v_new is null then
    raise exception 'Parar: criar_nota Frete+Caxinha ausente. Não remover a assinatura curta.';
  end if;
  if v_old is null then
    raise exception 'Parar: a assinatura curta já não existe.';
  end if;
  select count(*) into v_deps
    from pg_depend d
   where d.refobjid = v_old
     and d.deptype in ('n', 'a')
     and d.objid is distinct from v_old;
  if v_deps > 0 then
    raise exception 'Parar: % dependência(s) na assinatura curta. Não remover.', v_deps;
  end if;
end $$;

create or replace function public.criar_nota(p_forma public.pay_method, p_items jsonb, p_cliente text default null, p_frete numeric default 0, p_caxinha_natal numeric default 0)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare v_id bigint; it jsonb; v_frete numeric := round(coalesce(p_frete, 0), 2);
  v_cx numeric := round(coalesce(p_caxinha_natal, 0), 2);
begin
  if v_frete < 0 then raise exception 'Frete inválido' using errcode = 'P0001'; end if;
  if v_cx < 0 then raise exception 'Caxinha d Natal inválido' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Nota sem itens' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_items) = 0 and v_frete <= 0 and v_cx <= 0 then
    raise exception 'Nota sem itens' using errcode = 'P0001';
  end if;
  insert into public.notas(forma_pagamento, cliente, frete, caxinha_natal)
  values (p_forma, nullif(trim(p_cliente), ''), v_frete, v_cx)
  returning id into v_id;
  for it in select * from jsonb_array_elements(p_items) loop
    insert into public.sales(nota_id, sku, qtd, preco_vendido, forma_pagamento)
    values (v_id, it->>'sku', (it->>'qtd')::int, (it->>'preco_vendido')::numeric, p_forma);
  end loop;
  return v_id;
end $$;

revoke all on function public.criar_nota(public.pay_method, jsonb, text, numeric, numeric) from public, anon;
grant execute on function public.criar_nota(public.pay_method, jsonb, text, numeric, numeric) to authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.criar_nota(public.pay_method, jsonb, text, numeric, numeric) to service_role;
  end if;
end $$;

drop function public.criar_nota(public.pay_method, jsonb, text) restrict;

notify pgrst, 'reload schema';
select 'kiosk criar_nota overload ok' as status;
