-- Rollback do fix-criar-nota-overload.sql. Kiosk apenas. Sem CASCADE.
-- Volta os dois corpos auditados (oid 17807 e oid 18018), inclusive o "> 30".
-- NÃO executar sem autorização. Não mexe na loja.

create or replace function public.criar_nota(p_forma public.pay_method, p_items jsonb, p_cliente text default null, p_frete numeric default 0, p_caxinha_natal numeric default 0)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare v_id bigint; it jsonb; v_frete numeric := round(coalesce(p_frete, 0), 2);
  v_cx numeric := round(coalesce(p_caxinha_natal, 0), 2);
begin
  if v_frete < 0 then raise exception 'Frete inválido' using errcode = 'P0001'; end if;
  if v_cx < 0 then raise exception 'Caxinha d Natal inválido' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 30
     or (jsonb_array_length(p_items) = 0 and v_frete <= 0 and v_cx <= 0) then
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

create or replace function public.criar_nota(p_forma public.pay_method, p_items jsonb, p_cliente text default null)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare v_id bigint; it jsonb;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 30 then
    raise exception 'Nota sem itens' using errcode = 'P0001';
  end if;
  insert into public.notas(forma_pagamento, cliente) values (p_forma, nullif(trim(p_cliente), ''))
  returning id into v_id;
  for it in select * from jsonb_array_elements(p_items) loop
    insert into public.sales(nota_id, sku, qtd, preco_vendido, forma_pagamento)
    values (v_id, it->>'sku', (it->>'qtd')::int, (it->>'preco_vendido')::numeric, p_forma);
  end loop;
  return v_id;
end $$;

revoke all on function public.criar_nota(public.pay_method, jsonb, text) from public, anon;
grant execute on function public.criar_nota(public.pay_method, jsonb, text) to authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.criar_nota(public.pay_method, jsonb, text) to service_role;
  end if;
end $$;

notify pgrst, 'reload schema';
select 'kiosk criar_nota overload rollback ok' as status;
