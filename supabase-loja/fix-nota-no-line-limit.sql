-- fix-nota-no-line-limit.sql — Loja (bagda-loja). Idempotente.
-- NÃO executar daqui contra produção. O KING BOT aplica o mesmo critério na loja.
--
-- Causa do P0001 "Nota sem itens" com produtos no carrinho: criar_nota recusava
-- mais de 30 linhas com esse mesmo texto. Um carrinho real de ~45 linhas
-- (Frete 0, Caxinha 0, Paga Depois) caía nesse ramo. Não era p_items vazio.
--
-- MB: sem teto de linhas, agora e nas migrations seguintes.
-- Mantém a assinatura Frete+Caxinha. Não mexe em colunas. Não apaga overload.
-- Recusa só array inválido, ou carrinho vazio quando frete e caxinha são 0.
-- criar_nota_local continua só checando se p_items é array (sem teto) antes de chamar criar_nota.
-- Rodar DEPOIS de migration-caxinha-natal.sql (colunas frete e caxinha_natal já existem).
--
-- O guard fica igual ao patch de produção:
--   if jsonb_typeof(p_items) is distinct from 'array'
--      or (jsonb_array_length(p_items) = 0 and v_frete <= 0 and v_cx <= 0) then
--     raise exception 'Nota sem itens'

create or replace function public.criar_nota(p_items jsonb, p_pagamentos jsonb, p_cliente text default null, p_cliente_id bigint default null,
  p_frete numeric default 0, p_caxinha_natal numeric default 0)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint; it jsonb; pg jsonb; v_tot numeric := 0; v_pag numeric := 0; v_nome text; v_prazo boolean := false;
  v_frete numeric := round(coalesce(p_frete, 0), 2);
  v_cx numeric := round(coalesce(p_caxinha_natal, 0), 2);
begin
  if not public.can('vendas') then raise exception 'Sem permissão para criar nota' using errcode = '42501'; end if;
  if v_frete < 0 then raise exception 'Frete inválido' using errcode = 'P0001'; end if;
  if v_cx < 0 then raise exception 'Caxinha d Natal inválido' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' or (jsonb_array_length(p_items) = 0 and v_frete <= 0 and v_cx <= 0) then
    raise exception 'Nota sem itens' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_pagamentos) is distinct from 'array' or jsonb_array_length(p_pagamentos) = 0 or jsonb_array_length(p_pagamentos) > 5 then
    raise exception 'Informe a forma de pagamento' using errcode = 'P0001'; end if;
  select bool_or(x->>'metodo' = 'prazo') into v_prazo from jsonb_array_elements(p_pagamentos) x;
  if exists (select 1 from jsonb_array_elements(p_pagamentos) x where x->>'metodo' = 'credito') and coalesce(current_setting('bagda.credito_ok', true), '') <> '1' then
    raise exception 'Crédito do cliente só pela Caixa Geral' using errcode = 'P0001'; end if;
  if p_cliente_id is not null then
    select nome into v_nome from public.clientes where id = p_cliente_id and ativo;
    if v_nome is null then raise exception 'Cliente não encontrado' using errcode = 'P0001'; end if;
  end if;
  if v_prazo and p_cliente_id is null then
    raise exception 'Paga Depois exige cliente cadastrado' using errcode = 'P0001'; end if;
  insert into public.notas(seller_id, cliente, cliente_id, frete, caxinha_natal)
  values (auth.uid(), coalesce(v_nome, nullif(trim(p_cliente), '')), p_cliente_id, v_frete, v_cx) returning id into v_id;
  for it in select * from jsonb_array_elements(p_items) loop
    insert into public.sales(nota_id, sku, qtd, preco_vendido, seller_id)
    values (v_id, it->>'sku', (it->>'qtd')::int, (it->>'preco_vendido')::numeric, auth.uid());
    v_tot := v_tot + (it->>'qtd')::int * (it->>'preco_vendido')::numeric;
  end loop;
  v_tot := v_tot + v_frete + v_cx;
  for pg in select * from jsonb_array_elements(p_pagamentos) loop
    if coalesce((pg->>'valor')::numeric, 0) <= 0 then raise exception 'Valor de pagamento inválido' using errcode = 'P0001'; end if;
    insert into public.nota_pagamentos(nota_id, metodo, valor) values (v_id, (pg->>'metodo')::public.pay_method, (pg->>'valor')::numeric);
    v_pag := v_pag + (pg->>'valor')::numeric;
  end loop;
  if round(v_pag, 2) <> round(v_tot, 2) then
    raise exception 'Pagamentos (%) diferentes do total (%)', round(v_pag, 2), round(v_tot, 2) using errcode = 'P0001'; end if;
  update public.notas set total = v_tot where id = v_id;
  return v_id;
end $$;

create or replace function public.criar_nota_local(p_items jsonb, p_pagamentos jsonb, p_cliente text default null, p_cliente_id bigint default null,
  p_local text default null, p_obs text default null, p_frete numeric default 0, p_caxinha_natal numeric default 0)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint; v_tot numeric := 0; v_saldo numeric; it jsonb; v_pags jsonb := p_pagamentos;
  v_frete numeric := round(coalesce(p_frete, 0), 2);
  v_cx numeric := round(coalesce(p_caxinha_natal, 0), 2);
begin
  if not public.can('vendas') then raise exception 'Sem permissão para criar nota' using errcode = '42501'; end if;
  if v_frete < 0 then raise exception 'Frete inválido' using errcode = 'P0001'; end if;
  if v_cx < 0 then raise exception 'Caxinha d Natal inválido' using errcode = 'P0001'; end if;
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
    v_tot := v_tot + v_frete + v_cx;
    perform 1 from public.clientes where id = p_cliente_id for update;
    v_saldo := public._credito_saldo(p_cliente_id);
    if round(v_tot, 2) > round(v_saldo, 2) then
      raise exception 'Crédito insuficiente na Caixa Geral (saldo R$ %)', replace(to_char(v_saldo, 'FM999999990.00'), '.', ',') using errcode = 'P0001'; end if;
    v_pags := jsonb_build_array(jsonb_build_object('metodo', 'credito', 'valor', round(v_tot, 2)));
    perform set_config('bagda.credito_ok', '1', true);
  end if;
  v_id := public.criar_nota(p_items, v_pags, p_cliente, p_cliente_id, v_frete, v_cx);
  perform set_config('bagda.credito_ok', '', true);
  update public.notas set local_pagamento = p_local, obs_pagamento = nullif(left(trim(coalesce(p_obs,'')), 200), '') where id = v_id;
  if p_local = 'CAIXA GERAL' then
    insert into public.cliente_creditos(cliente_id, tipo, valor, obs, nota_id)
    values (p_cliente_id, 'uso', round(v_tot, 2), 'Nota ' || lpad(v_id::text, 6, '0'), v_id);
  end if;
  return v_id;
end $$;

revoke all on function public.criar_nota(jsonb, jsonb, text, bigint, numeric, numeric),
  public.criar_nota_local(jsonb, jsonb, text, bigint, text, text, numeric, numeric) from public, anon;
grant execute on function public.criar_nota(jsonb, jsonb, text, bigint, numeric, numeric),
  public.criar_nota_local(jsonb, jsonb, text, bigint, text, text, numeric, numeric) to authenticated;
notify pgrst, 'reload schema';
select 'nota sem teto de linhas ok' as status;
