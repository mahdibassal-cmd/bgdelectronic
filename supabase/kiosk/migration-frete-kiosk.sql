-- migration-frete-kiosk.sql — Kiosk (zoapljfhebbvbsrebtjt)
-- Frete (motoboy) na nota: valor livre >= 0 em notas.frete; cobrado na mesma forma de pagamento da nota.
-- Frete NÃO é estoque: sem SKU, sem linha em sales, sem custo (lucro de produto não muda).
-- Nota pode ter ZERO itens se frete > 0.
-- Base: criar_nota viva (schema.sql / migration-002.sql; migration-004 só regrant). Mantém SECURITY INVOKER
-- (RLS de notas/sales e triggers de estoque/vendedor continuam valendo), search_path = ''.
-- A assinatura antiga (pay_method, jsonb, text) é trocada por (pay_method, jsonb, text, numeric DEFAULT 0):
-- chamadas antigas sem p_frete continuam funcionando. RLS não muda. Idempotente.
begin;

alter table public.notas add column if not exists frete numeric(12,2) not null default 0;
alter table public.notas drop constraint if exists notas_frete_check;
alter table public.notas add constraint notas_frete_check check (frete >= 0);

drop function if exists public.criar_nota(public.pay_method, jsonb, text);
create or replace function public.criar_nota(p_forma public.pay_method, p_items jsonb, p_cliente text default null, p_frete numeric default 0)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare v_id bigint; it jsonb; v_frete numeric := round(coalesce(p_frete, 0), 2);
begin
  if v_frete < 0 then raise exception 'Frete inválido' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 30
     or (jsonb_array_length(p_items) = 0 and v_frete <= 0) then
    raise exception 'Nota sem itens' using errcode = 'P0001';
  end if;
  insert into public.notas(forma_pagamento, cliente, frete) values (p_forma, nullif(trim(p_cliente), ''), v_frete)
  returning id into v_id;
  for it in select * from jsonb_array_elements(p_items) loop
    insert into public.sales(nota_id, sku, qtd, preco_vendido, forma_pagamento)
    values (v_id, it->>'sku', (it->>'qtd')::int, (it->>'preco_vendido')::numeric, p_forma);
  end loop;
  return v_id;
end $$;
revoke all on function public.criar_nota(public.pay_method, jsonb, text, numeric) from public, anon;
grant execute on function public.criar_nota(public.pay_method, jsonb, text, numeric) to authenticated;
notify pgrst, 'reload schema';
commit;
select 'frete kiosk ok' as status;
