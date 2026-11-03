-- migration-local-pagamento-opcional.sql — Loja (bagda-loja)
-- Nova nota: 'Local do pagamento' deixa de ser obrigatório quando TODAS as partes são Paga Depois (metodo 'prazo').
-- Se alguma parte é paga agora, continua obrigatório. notas.local_pagamento já aceita NULL (check: is null or in (...)).
-- Idempotente: só CREATE OR REPLACE da função (mesma assinatura, security definer, search_path = '') + grants.
create or replace function public.criar_nota_local(p_items jsonb, p_pagamentos jsonb, p_cliente text default null, p_cliente_id bigint default null,
  p_local text default null, p_obs text default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint; v_tot numeric := 0; v_saldo numeric; it jsonb; v_pags jsonb := p_pagamentos;
begin
  if not public.can('vendas') then raise exception 'Sem permissão para criar nota' using errcode = '42501'; end if;
  -- Local do pagamento só é obrigatório se alguma parte é paga agora (não 'prazo' / Paga Depois)
  if p_local is not null and p_local not in ('MAQUINA','HX','DINHEIRO','CAIXA GERAL') then
    raise exception 'Escolha o Local do pagamento' using errcode = 'P0001'; end if;
  if p_local is null and (jsonb_typeof(p_pagamentos) is distinct from 'array' or exists (
      select 1 from jsonb_array_elements(p_pagamentos) g
      where coalesce(g->>'metodo','') <> 'prazo' and coalesce(nullif(g->>'valor','')::numeric, 0) > 0)) then
    raise exception 'Escolha o Local do pagamento' using errcode = 'P0001'; end if;
  if p_local = 'CAIXA GERAL' then
    if p_cliente_id is null then raise exception 'Caixa Geral exige cliente cadastrado' using errcode = 'P0001'; end if;
    if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Nota sem itens' using errcode = 'P0001'; end if;
    for it in select * from jsonb_array_elements(p_items) loop
      v_tot := v_tot + (it->>'qtd')::int * (it->>'preco_vendido')::numeric; end loop;
    perform 1 from public.clientes where id = p_cliente_id for update;
    v_saldo := public._credito_saldo(p_cliente_id);
    if round(v_tot, 2) > round(v_saldo, 2) then
      raise exception 'Crédito insuficiente na Caixa Geral (saldo R$ %)', replace(to_char(v_saldo, 'FM999999990.00'), '.', ',') using errcode = 'P0001'; end if;
    v_pags := jsonb_build_array(jsonb_build_object('metodo', 'credito', 'valor', round(v_tot, 2)));
    perform set_config('bagda.credito_ok', '1', true);
  end if;
  v_id := public.criar_nota(p_items, v_pags, p_cliente, p_cliente_id);
  perform set_config('bagda.credito_ok', '', true);
  update public.notas set local_pagamento = p_local, obs_pagamento = nullif(left(trim(coalesce(p_obs,'')), 200), '') where id = v_id;
  if p_local = 'CAIXA GERAL' then
    insert into public.cliente_creditos(cliente_id, tipo, valor, obs, nota_id)
    values (p_cliente_id, 'uso', round(v_tot, 2), 'Nota ' || lpad(v_id::text, 6, '0'), v_id);
  end if;
  return v_id;
end $$;
revoke all on function public.criar_nota_local(jsonb, jsonb, text, bigint, text, text) from public, anon;
grant execute on function public.criar_nota_local(jsonb, jsonb, text, bigint, text, text) to authenticated;
select 'local_pagamento_opcional ok' as status;
