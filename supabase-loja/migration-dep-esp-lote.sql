-- Depósito Especial: entrada em lote (vários itens, atômica) + garante que o log aceita os tipos dep_esp_*.
-- Idempotente. NÃO mexe em products.estoque nem cria purchases (Depósito Especial é estoque separado).
-- Reaproveita public.dep_esp_entrada (custo médio, movimento e log por item). NÃO rodar sem o "yes" do MB.

-- 1) Log: lista completa de tipos (inclui dep_esp_*; se algum script posterior regravou a constraint sem eles, toda entrada falhava)
do $$ begin
  if to_regclass('public.security_events') is not null then
    alter table public.security_events drop constraint if exists security_events_kind_check;
    alter table public.security_events add constraint security_events_kind_check check (kind in (
      'failed_login','role_change','admin_added','profile_added','profile_removed','lock','unlock','signout_all',
      'fin_pagamento','fin_recebimento','fin_alteracao',
      'credito_entrada','credito_uso','credito_excedente','nota_lancada',
      'estorno_recebimento','estorno_credito',
      'dep_esp_entrada','dep_esp_ajuste','dep_esp_transferencia',
      'nota_prazo_lancada','nota_dispensada','nota_dispensa_desfeita',
      'nota_cancelada_financas','nota_pag_corrigido')) not valid;
  end if;
end $$;

-- 2) Grants/policies (repõe caso "Run and enable RLS" tenha mexido)
grant select on public.deposito_especial, public.deposito_especial_mov, public.v_deposito_especial, public.v_deposito_especial_mov to authenticated;
drop policy if exists dep_esp_admin on public.deposito_especial;
create policy dep_esp_admin on public.deposito_especial for select to authenticated using (public.can('admin'));
drop policy if exists dep_esp_mov_admin on public.deposito_especial_mov;
create policy dep_esp_mov_admin on public.deposito_especial_mov for select to authenticated using (public.can('admin'));

-- 3) Entrada em lote
create or replace function public.dep_esp_entrada_lote(p_header jsonb, p_itens jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare it jsonb; n int := 0; v_tot numeric := 0;
  v_mot text := left(nullif(btrim(coalesce(p_header->>'motivo', '')), ''), 200);
begin
  if not public.can('admin') then raise exception 'Somente admin' using errcode = '42501'; end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then raise exception 'Nenhum item' using errcode = 'P0001'; end if;
  if jsonb_array_length(p_itens) > 200 then raise exception 'Máximo 200 itens' using errcode = 'P0001'; end if;
  v_mot := coalesce(v_mot, left(concat_ws(' · ', 'Compra', nullif(btrim(p_header->>'fornecedor'), ''), nullif(btrim(p_header->>'observacao'), '')), 200));
  for it in select * from jsonb_array_elements(p_itens) loop
    n := n + 1;
    begin
      perform public.dep_esp_entrada(it->>'sku', (it->>'qtd')::int, round((it->>'custo_unit')::numeric, 2), v_mot);
    exception when others then raise exception 'Item % (%): %', n, it->>'sku', sqlerrm using errcode = 'P0001';
    end;
    v_tot := v_tot + (it->>'qtd')::int * round((it->>'custo_unit')::numeric, 2);
  end loop;
  return jsonb_build_object('itens', n, 'total', v_tot);
end $$;
revoke all on function public.dep_esp_entrada_lote(jsonb, jsonb) from public, anon;
grant execute on function public.dep_esp_entrada_lote(jsonb, jsonb) to authenticated;
notify pgrst, 'reload schema';
select 'dep_esp_lote ok' as status;
