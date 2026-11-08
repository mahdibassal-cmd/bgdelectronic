-- DRAFT — não aplicar em produção até revisão.
-- Loja /main apenas. Vender do estoque Principal ou do Depósito Especial.
-- A origem vai em cada linha (sales.estoque_origem). Notas antigas ficam 'principal'.
-- Não transfere de um estoque para o outro. Não mexe em preço, frete, caxinha, caixas nem sale_costs históricos.
-- Rodar depois de migration-nota-caixa-especial.sql. Não substitui criar_nota_local nem pagar_conta.
-- cancelar_nota_financas continua can('admin'), como em produção em 2026-11-09.
-- O estorno da Caixa Especial continua a chamada direta a _cxesp_estornar_nota.

alter table public.sales add column if not exists estoque_origem text;
update public.sales set estoque_origem = 'principal' where estoque_origem is null;
alter table public.sales alter column estoque_origem set default 'principal';
alter table public.sales alter column estoque_origem set not null;
alter table public.sales drop constraint if exists sales_estoque_origem_check;
alter table public.sales add constraint sales_estoque_origem_check check (estoque_origem in ('principal', 'especial'));

do $$
declare c name;
begin
  if to_regclass('public.deposito_especial_mov') is null then
    raise exception 'deposito_especial_mov não existe';
  end if;
  for c in
    select conname from pg_constraint
    where conrelid = 'public.deposito_especial_mov'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%tipo%'
  loop
    execute format('alter table public.deposito_especial_mov drop constraint %I', c);
  end loop;
end $$;
alter table public.deposito_especial_mov
  add constraint deposito_especial_mov_tipo_check
  check (tipo in ('entrada', 'ajuste', 'para_loja', 'da_loja', 'venda', 'estorno_venda'));

create or replace function public.tg_sale_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_preco numeric; v_origem text := coalesce(new.estoque_origem, 'principal'); v_antes integer; v_depois integer; v_custo numeric; v_qtd integer := new.qtd; v_sku text := new.sku; v_nota text := coalesce(new.nota_id::text, '');
begin
  if v_origem not in ('principal', 'especial') then
    raise exception 'Origem de estoque inválida' using errcode = 'P0001'; end if;
  new.estoque_origem := v_origem;
  select preco_venda into v_preco from public.products where sku = v_sku and ativo;
  if not found then raise exception 'Estoque insuficiente ou produto inativo (%)', v_sku using errcode = 'P0001'; end if;
  new.preco_tabela := v_preco;
  if v_origem = 'principal' then
    update public.products set estoque = estoque - v_qtd, updated_at = now()
     where sku = v_sku and ativo and estoque >= v_qtd;
    if not found then raise exception 'Estoque insuficiente ou produto inativo (%)', v_sku using errcode = 'P0001'; end if;
  else
    if not (public.can('admin') or public.can('estoque')) then
      raise exception 'Sem permissão para vender do Depósito Especial' using errcode = '42501'; end if;
    update public.deposito_especial set qtd = qtd - v_qtd, updated_at = now()
     where sku = v_sku and qtd >= v_qtd
     returning qtd + v_qtd, qtd, custo into v_antes, v_depois, v_custo;
    if not found then raise exception 'Depósito Especial sem estoque suficiente (%)', v_sku using errcode = 'P0001'; end if;
    insert into public.deposito_especial_mov(sku, tipo, qtd, qtd_antes, qtd_depois, custo_unit, motivo)
    values (v_sku, 'venda', -v_qtd, v_antes, v_depois, v_custo, 'Venda nota ' || v_nota);
  end if;
  return new;
end $$;

create or replace function public.tg_sale_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_custo numeric;
begin
  if coalesce(new.estoque_origem, 'principal') = 'especial' then
    select custo into v_custo from public.deposito_especial where sku = new.sku;
  else
    select custo into v_custo from public.product_costs where sku = new.sku;
  end if;
  insert into public.sale_costs(sale_id, custo_unit) values (new.id, coalesce(v_custo, 0));
  return null;
end $$;
revoke all on function public.tg_sale_insert(), public.tg_sale_after_insert() from public, anon, authenticated;

create or replace function public._devolver_estoque_nota(p_nota bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare r record; d record; v_new integer;
begin
  for r in
    select sku, coalesce(estoque_origem, 'principal') as origem, sum(qtd)::int as qtd
    from public.sales where nota_id = p_nota
    group by sku, coalesce(estoque_origem, 'principal')
  loop
    if r.origem = 'especial' then
      insert into public.deposito_especial(sku) values (r.sku) on conflict (sku) do nothing;
      select * into d from public.deposito_especial where sku = r.sku for update;
      v_new := d.qtd + r.qtd;
      update public.deposito_especial set qtd = v_new, updated_at = now() where sku = r.sku;
      insert into public.deposito_especial_mov(sku, tipo, qtd, qtd_antes, qtd_depois, custo_unit, motivo)
      values (r.sku, 'estorno_venda', r.qtd, d.qtd, v_new, d.custo, 'Cancelamento nota ' || p_nota::text);
    else
      update public.products set estoque = estoque + r.qtd, updated_at = now() where sku = r.sku;
    end if;
  end loop;
end $$;
revoke all on function public._devolver_estoque_nota(bigint) from public, anon, authenticated;

-- criar_nota: mesma assinatura de fix-nota-no-line-limit.sql. A origem vem no JSON da linha.
create or replace function public.criar_nota(p_items jsonb, p_pagamentos jsonb, p_cliente text default null, p_cliente_id bigint default null,
  p_frete numeric default 0, p_caxinha_natal numeric default 0)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint; it jsonb; pg jsonb; v_tot numeric := 0; v_pag numeric := 0; v_nome text; v_prazo boolean := false;
  v_frete numeric := round(coalesce(p_frete, 0), 2);
  v_cx numeric := round(coalesce(p_caxinha_natal, 0), 2);
  v_origem text;
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
    v_origem := coalesce(nullif(it->>'origem', ''), 'principal');
    if v_origem not in ('principal', 'especial') then raise exception 'Origem de estoque inválida' using errcode = 'P0001'; end if;
    insert into public.sales(nota_id, sku, qtd, preco_vendido, seller_id, estoque_origem)
    values (v_id, it->>'sku', (it->>'qtd')::int, (it->>'preco_vendido')::numeric, auth.uid(), v_origem);
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

-- Cancelamentos devolvem cada linha para a origem gravada. Caixa e crédito seguem as funções atuais.
create or replace function public.cancelar_nota_financas(p_nota bigint, p_motivo text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare n record; r record; v_nn text := lpad(p_nota::text, 6, '0'); v_est numeric := 0; v_rec numeric; v_cxesp bigint;
begin
  if not public.can('admin') then raise exception 'Só admin cancela nota' using errcode = '42501'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Informe o motivo' using errcode = 'P0001'; end if;
  select * into n from public.notas where id = p_nota for update;
  if not found then raise exception 'Nota não encontrada' using errcode = 'P0001'; end if;
  if n.status = 'cancelada' then raise exception 'Nota já cancelada' using errcode = 'P0001'; end if;
  select coalesce(sum(valor), 0) into v_rec from public.recebimento_notas where nota_id = p_nota;
  if v_rec > 0 then
    raise exception 'Nota % tem recebimento de R$ % em Contas a receber — estorne o recebimento antes de cancelar', v_nn,
      replace(to_char(v_rec, 'FM999999990.00'), '.', ',') using errcode = 'P0001'; end if;
  perform public._devolver_estoque_nota(p_nota);
  for r in select caixa_id, forma, sum(case when tipo = 'venda' then valor when tipo = 'estorno' then -valor else 0 end) liq
             from public.caixa_movimentos where nota_id = p_nota group by caixa_id, forma loop
    if r.liq > 0 then
      insert into public.caixa_movimentos(caixa_id, tipo, valor, motivo, nota_id, user_id, forma)
      values (r.caixa_id, 'estorno', r.liq, left('Cancelamento nota ' || v_nn || ': ' || trim(p_motivo), 300), p_nota, auth.uid(), r.forma);
      v_est := v_est + r.liq;
    end if;
  end loop;
  v_cxesp := public._cxesp_estornar_nota(p_nota, left('Cancelamento nota ' || v_nn || ': ' || trim(p_motivo), 300));
  update public.notas set status = 'cancelada', cancelada_em = now(), cancelada_por = auth.uid(), motivo_cancel = left(trim(p_motivo), 300),
         caixa_lancada_id = null, lancada_em = null, lancada_por = null, prazo_lancada_em = null, prazo_lancada_por = null,
         cxesp_lancada_em = null, cxesp_lancada_por = null, cxesp_mov_id = null
   where id = p_nota;
  perform public.fin_log('nota_cancelada_financas', jsonb_build_object('nota_id', p_nota, 'motivo', trim(p_motivo), 'total', n.total,
    'estornado_caixa', v_est, 'cxesp_saida', v_cxesp, 'caixa_antes', n.caixa_lancada_id, 'cliente_id', n.cliente_id));
  return jsonb_build_object('nota_id', p_nota, 'estornado_caixa', v_est, 'cxesp_saida', v_cxesp, 'cancelada', true);
end $$;

create or replace function public.cancelar_nota(p_id bigint, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare n record; r record;
begin
  if not public.can('admin') then raise exception 'Só admin cancela nota' using errcode = '42501'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Informe o motivo' using errcode = 'P0001'; end if;
  select * into n from public.notas where id = p_id for update;
  if not found then raise exception 'Nota não encontrada' using errcode = 'P0001'; end if;
  if n.status = 'cancelada' then raise exception 'Nota já cancelada' using errcode = 'P0001'; end if;
  perform public._devolver_estoque_nota(p_id);
  for r in select caixa_id, sum(case when tipo = 'venda' then valor when tipo = 'estorno' then -valor else 0 end) liq
             from public.caixa_movimentos where nota_id = p_id group by caixa_id loop
    if r.liq > 0 then
      insert into public.caixa_movimentos(caixa_id, tipo, valor, motivo, nota_id, user_id)
      values (r.caixa_id, 'estorno', r.liq, left('Cancelamento nota ' || lpad(p_id::text, 6, '0') || ': ' || trim(p_motivo), 300), p_id, auth.uid());
    end if;
  end loop;
  perform public._cxesp_estornar_nota(p_id, left('Cancelamento nota ' || lpad(p_id::text, 6, '0') || ': ' || trim(p_motivo), 300));
  update public.notas set status = 'cancelada', cancelada_em = now(), cancelada_por = auth.uid(), motivo_cancel = trim(p_motivo),
         cxesp_lancada_em = null, cxesp_lancada_por = null, cxesp_mov_id = null
   where id = p_id;
end $$;

create or replace view public.v_nota_itens with (security_invoker = true) as
select n.id as nota_id, n.data, n.created_at, n.cliente, n.status, n.total as nota_total, pr.handle, pr.nome,
       s.sku, p.marca, p.produto, p.tamanho, s.qtd, s.preco_vendido, s.total, coalesce(s.estoque_origem, 'principal') as estoque_origem
from public.notas n join public.sales s on s.nota_id = n.id join public.products p on p.sku = s.sku
left join public.profiles pr on pr.id = n.seller_id;

revoke all on function public.criar_nota(jsonb, jsonb, text, bigint, numeric, numeric),
  public.cancelar_nota(bigint, text), public.cancelar_nota_financas(bigint, text) from public, anon;
grant execute on function public.criar_nota(jsonb, jsonb, text, bigint, numeric, numeric),
  public.cancelar_nota(bigint, text), public.cancelar_nota_financas(bigint, text) to authenticated;

notify pgrst, 'reload schema';
select 'venda origem estoque draft' as status;
