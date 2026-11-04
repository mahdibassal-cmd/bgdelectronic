-- BAGDA LOJA — cupom de compra 80mm: compra_detalhe passa a devolver 'usuario' (handle de quem registrou) e 'deposito' ('loja').
-- Requer migration-estoque-role.sql (869fb19) já rodada. Mesmo corpo de 869fb19 + 2 campos. Idempotente. NÃO rodar sem o "yes" do MB.
create or replace function public.compra_detalhe(p_numero text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v bigint := nullif(regexp_replace(coalesce(p_numero, ''), '\D', '', 'g'), '')::bigint; c record; a boolean := public.can('admin'); its jsonb;
begin
  if not (a or public.can('financas') or public.can('estoque')) then raise exception 'Sem permissão' using errcode = '42501'; end if;
  select * into c from public.compras where id = v;
  if not found then raise exception 'Compra % não encontrada', p_numero using errcode = 'P0001'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('purchase_id', p.id, 'sku', p.sku, 'marca', pr.marca, 'produto', pr.produto, 'tamanho', pr.tamanho,
        'qtd', p.qtd, 'custo_unit', case when a then p.custo_unit end, 'total', case when a then p.total end,
        'recebido_sem_imei', p.recebido_sem_imei, 'recebidos', public.compra_item_recebidos(p.id),
        'status', case when public.compra_item_recebidos(p.id) >= p.qtd then 'completo' else 'pendente' end,
        'imeis', coalesce((select jsonb_agg(jsonb_build_object('slot', i.slot, 'imei1', i.imei1, 'imei2', i.imei2) order by i.slot) from public.compra_imeis i where i.purchase_id = p.id), '[]'))
      order by p.id), '[]') into its
  from public.purchases p join public.products pr on pr.sku = p.sku where p.compra_id = c.id;
  return jsonb_build_object('id', c.id, 'numero', public.compra_numero(c.id), 'data', c.data, 'created_at', c.created_at, 'usuario', (select pf.handle from public.profiles pf where pf.id = c.created_by), 'deposito', 'loja', 'fornecedor', c.fornecedor, 'observacao', c.observacao,
    'total', case when a then (select coalesce(sum(total), 0) from public.purchases where compra_id = c.id) end,
    'status', case when exists (select 1 from jsonb_array_elements(its) e where e->>'status' = 'pendente') then 'pendente' else 'completo' end,
    'itens', its);
end $$;

revoke all on function public.compra_detalhe(text) from public, anon;
grant execute on function public.compra_detalhe(text) to authenticated;
notify pgrst, 'reload schema';
select 'compra_recibo ok' as status;
