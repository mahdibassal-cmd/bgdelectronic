-- fix-nota-no-line-limit.sql — Kiosk. Idempotente. NÃO executar daqui contra produção.
-- Mesma regra da loja: sem teto de linhas em criar_nota. Não altera colunas frete/caxinha.
-- Assinatura Frete+Caxinha permanece. Recusa array inválido ou carrinho vazio com frete e caxinha 0.
-- Rodar DEPOIS de migration-caxinha-natal-kiosk.sql.

create or replace function public.criar_nota(p_forma public.pay_method, p_items jsonb, p_cliente text default null, p_frete numeric default 0, p_caxinha_natal numeric default 0)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare v_id bigint; it jsonb; v_frete numeric := round(coalesce(p_frete, 0), 2);
  v_cx numeric := round(coalesce(p_caxinha_natal, 0), 2);
begin
  if v_frete < 0 then raise exception 'Frete inválido' using errcode = 'P0001'; end if;
  if v_cx < 0 then raise exception 'Caxinha d Natal inválido' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' or (jsonb_array_length(p_items) = 0 and v_frete <= 0 and v_cx <= 0) then
    raise exception 'Nota sem itens' using errcode = 'P0001';
  end if;
  insert into public.notas(forma_pagamento, cliente, frete, caxinha_natal) values (p_forma, nullif(trim(p_cliente), ''), v_frete, v_cx)
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
select 'kiosk nota sem teto de linhas ok' as status;
