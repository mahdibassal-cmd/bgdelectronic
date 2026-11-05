-- migration-caxinha-natal.sql — Loja (bagda-loja, xvsxnicmpkvzzhkkqgam)
-- Caxinha d Natal na nota: valor livre >= 0, entra no total e nos pagamentos (formas normais).
-- NÃO é estoque: sem SKU, sem movimento de estoque, sem custo (lucro de produto não muda).
-- Nota pode ter ZERO itens se frete > 0 OU caxinha_natal > 0.
-- UI esconde o campo após 24/12/2026 (America/Sao_Paulo); valores históricos ficam nas notas.
-- Base: criar_nota / criar_nota_local de migration-frete.sql (já com p_frete).
-- Assinaturas antigas são removidas e recriadas com p_caxinha_natal DEFAULT 0 =>
-- chamadas antigas (só p_frete ou sem ambos) continuam funcionando.
-- RLS não muda. Idempotente.
begin;

alter table public.notas add column if not exists caxinha_natal numeric(12,2) not null default 0;
alter table public.notas drop constraint if exists notas_caxinha_natal_check;
alter table public.notas add constraint notas_caxinha_natal_check check (caxinha_natal >= 0);

drop function if exists public.criar_nota(jsonb, jsonb, text, bigint, numeric);
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
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 30
     or (jsonb_array_length(p_items) = 0 and v_frete <= 0 and v_cx <= 0) then
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
    -- Sem movimento de caixa aqui: a nota fica PENDENTE até o financeiro lançar (lancar_nota_caixa).
    v_pag := v_pag + (pg->>'valor')::numeric;
  end loop;
  if round(v_pag, 2) <> round(v_tot, 2) then
    raise exception 'Pagamentos (%) diferentes do total (%)', round(v_pag, 2), round(v_tot, 2) using errcode = 'P0001'; end if;
  update public.notas set total = v_tot where id = v_id;
  return v_id;
end $$;

drop function if exists public.criar_nota_local(jsonb, jsonb, text, bigint, text, text, numeric);
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

-- Total de caxinha do dia (Resumo do dia / Relatório). Só admin/financeiro; notas canceladas fora.
create or replace function public.caxinha_dia(p_data date default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r jsonb; d date := coalesce(p_data, (now() at time zone 'America/Sao_Paulo')::date);
begin
  if not (public.can('financas') or public.has_perm('admin')) then raise exception 'Sem permissão' using errcode = '42501'; end if;
  select jsonb_build_object('data', d, 'caxinha', coalesce(sum(caxinha_natal), 0), 'notas', count(*) filter (where caxinha_natal > 0))
    into r from public.notas where data = d and status = 'ativa';
  return r;
end $$;

revoke all on function public.criar_nota(jsonb, jsonb, text, bigint, numeric, numeric),
  public.criar_nota_local(jsonb, jsonb, text, bigint, text, text, numeric, numeric),
  public.caxinha_dia(date) from public, anon;
grant execute on function public.criar_nota(jsonb, jsonb, text, bigint, numeric, numeric),
  public.criar_nota_local(jsonb, jsonb, text, bigint, text, text, numeric, numeric),
  public.caxinha_dia(date) to authenticated;
notify pgrst, 'reload schema';
commit;
select 'caxinha natal ok' as status;
