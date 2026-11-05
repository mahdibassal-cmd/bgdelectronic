-- migration-caixinho-natal-kiosk.sql — Kiosk (zoapljfhebbvbsrebtjt)
-- Caixinho do Natal na nota: valor livre >= 0 em notas.caixinho_natal; cobrado na mesma forma de pagamento.
-- NÃO é estoque: sem SKU, sem linha em sales, sem custo.
-- Nota pode ter ZERO itens se frete > 0 OU caixinho_natal > 0.
-- UI esconde o campo após 24/12/2026 (America/Sao_Paulo); valores históricos ficam.
-- Base: criar_nota de migration-frete-kiosk.sql (já com p_frete). Mantém SECURITY INVOKER,
-- search_path = ''. Assinatura antiga (pay_method, jsonb, text, numeric) é trocada por
-- (... numeric, numeric DEFAULT 0): chamadas antigas sem p_caixinho_natal continuam.
-- RLS não muda. Idempotente.
begin;

alter table public.notas add column if not exists caixinho_natal numeric(12,2) not null default 0;
alter table public.notas drop constraint if exists notas_caixinho_natal_check;
alter table public.notas add constraint notas_caixinho_natal_check check (caixinho_natal >= 0);

drop function if exists public.criar_nota(public.pay_method, jsonb, text, numeric);
create or replace function public.criar_nota(p_forma public.pay_method, p_items jsonb, p_cliente text default null, p_frete numeric default 0, p_caixinho_natal numeric default 0)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare v_id bigint; it jsonb; v_frete numeric := round(coalesce(p_frete, 0), 2);
  v_cx numeric := round(coalesce(p_caixinho_natal, 0), 2);
begin
  if v_frete < 0 then raise exception 'Frete inválido' using errcode = 'P0001'; end if;
  if v_cx < 0 then raise exception 'Caixinho do Natal inválido' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 30
     or (jsonb_array_length(p_items) = 0 and v_frete <= 0 and v_cx <= 0) then
    raise exception 'Nota sem itens' using errcode = 'P0001';
  end if;
  insert into public.notas(forma_pagamento, cliente, frete, caixinho_natal) values (p_forma, nullif(trim(p_cliente), ''), v_frete, v_cx)
  returning id into v_id;
  for it in select * from jsonb_array_elements(p_items) loop
    insert into public.sales(nota_id, sku, qtd, preco_vendido, forma_pagamento)
    values (v_id, it->>'sku', (it->>'qtd')::int, (it->>'preco_vendido')::numeric, p_forma);
  end loop;
  return v_id;
end $$;
revoke all on function public.criar_nota(public.pay_method, jsonb, text, numeric, numeric) from public, anon;
grant execute on function public.criar_nota(public.pay_method, jsonb, text, numeric, numeric) to authenticated;
notify pgrst, 'reload schema';
commit;
select 'caixinho natal kiosk ok' as status;
