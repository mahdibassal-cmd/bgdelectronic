-- =====================================================================
-- BAGDA STORES (bagda-loja) — CAIXA GERAL: crédito de cliente (ledger por cliente).
-- Ordem: schema.sql -> users.sql -> security.sql -> migration-clientes.sql -> ESTE ARQUIVO. Idempotente.
-- Permissão: 'financas' (admin + financeiro). Leitura via view; gravação SÓ via RPC (security definer).
-- Saldo de crédito = soma(entradas) - soma(usos). Calculado, nunca dessincroniza. Uso nunca passa do saldo.
-- Nova nota: 'Local do pagamento' (MAQUINA/HX/DINHEIRO/CAIXA GERAL) + observação, salvos na nota.
-- CAIXA GERAL = paga com o crédito do cliente (forma 'credito', sem entrada em caixa) e grava um 'uso'.
-- 'Nome do cliente (referência)' usa a coluna já existente notas.cliente (p_cliente do criar_nota).
-- Não mexe em caixas/caixa_movimentos (crédito antigo de cliente não é dinheiro entrando hoje).
-- =====================================================================

create table if not exists public.cliente_creditos (
  id         bigint generated always as identity primary key,
  cliente_id bigint not null references public.clientes(id),
  tipo       text not null check (tipo in ('entrada','uso')),
  valor      numeric(12,2) not null check (valor > 0),
  obs        text check (length(obs) <= 300),
  nota_id    bigint references public.notas(id),
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists cli_cred_cli_idx on public.cliente_creditos(cliente_id);

alter table public.cliente_creditos enable row level security;
alter table public.cliente_creditos force row level security;
revoke all on public.cliente_creditos from anon, public, authenticated;
grant select on public.cliente_creditos to authenticated;          -- gravação só via RPC
drop policy if exists cli_cred_fin on public.cliente_creditos;
create policy cli_cred_fin on public.cliente_creditos for select to authenticated using (public.can('financas'));

-- ---------- Nota: local do pagamento + observação; forma 'credito' ----------
alter type public.pay_method add value if not exists 'credito';
alter table public.notas add column if not exists local_pagamento text;
alter table public.notas add column if not exists obs_pagamento text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'notas_local_pag_chk') then
    alter table public.notas add constraint notas_local_pag_chk
      check (local_pagamento is null or local_pagamento in ('MAQUINA','HX','DINHEIRO','CAIXA GERAL')); end if;
  if not exists (select 1 from pg_constraint where conname = 'notas_obs_pag_chk') then
    alter table public.notas add constraint notas_obs_pag_chk check (obs_pagamento is null or length(obs_pagamento) <= 200); end if;
end $$;

-- ---------- Saldo ----------
-- Uso ligado a nota CANCELADA não conta (o crédito volta sozinho para o cliente).
create or replace function public._credito_saldo(p_cliente bigint) returns numeric      -- interno, sem grant
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(case when k.tipo = 'entrada' then k.valor else -k.valor end), 0)
    from public.cliente_creditos k left join public.notas n on n.id = k.nota_id
   where k.cliente_id = p_cliente and (k.nota_id is null or n.status = 'ativa');
$$;
revoke all on function public._credito_saldo(bigint) from public, anon, authenticated;
create or replace function public.cliente_credito_saldo(p_cliente bigint) returns numeric
language sql stable security definer set search_path = '' as $$
  select case when public.can('financas') then public._credito_saldo(p_cliente) end;
$$;

create or replace view public.v_cliente_credito with (security_invoker = true) as
select c.id as cliente_id, c.nome, c.telefone, c.doc,
       coalesce(sum(k.valor) filter (where k.tipo = 'entrada'), 0) as total_entradas,
       coalesce(sum(k.valor) filter (where k.tipo = 'uso'), 0)     as total_usos,
       coalesce(sum(case when k.tipo = 'entrada' then k.valor else -k.valor end), 0) as saldo,
       max(k.created_at) as ultimo_mov
from public.clientes c join public.cliente_creditos k on k.cliente_id = c.id
left join public.notas n on n.id = k.nota_id
where public.can('financas') and (k.nota_id is null or n.status = 'ativa')
group by c.id, c.nome, c.telefone, c.doc;

create or replace view public.v_cliente_creditos_mov with (security_invoker = true) as
select k.id, k.cliente_id, c.nome as cliente, k.tipo, k.valor, k.obs, k.nota_id, n.status as nota_status, pr.handle, k.created_at
from public.cliente_creditos k join public.clientes c on c.id = k.cliente_id
left join public.notas n on n.id = k.nota_id
left join public.profiles pr on pr.id = k.created_by
where public.can('financas');

revoke all on public.v_cliente_credito, public.v_cliente_creditos_mov from anon, public;
grant select on public.v_cliente_credito, public.v_cliente_creditos_mov to authenticated;

-- ---------- RPC: lançar crédito (entrada) ou uso ----------
create or replace function public.lancar_credito(p_cliente bigint, p_tipo text, p_valor numeric, p_obs text default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint; v_saldo numeric;
begin
  if not public.can('financas') then raise exception 'Sem permissão' using errcode = '42501'; end if;
  if p_tipo not in ('entrada','uso') then raise exception 'Tipo inválido' using errcode = 'P0001'; end if;
  if p_valor is null or p_valor <= 0 then raise exception 'Informe um valor maior que zero' using errcode = 'P0001'; end if;
  perform 1 from public.clientes where id = p_cliente for update;   -- trava o cliente (evita uso duplo simultâneo)
  if not found then raise exception 'Cliente não encontrado' using errcode = 'P0001'; end if;
  if p_tipo = 'uso' then
    v_saldo := public._credito_saldo(p_cliente);
    if round(p_valor, 2) > round(v_saldo, 2) then
      raise exception 'Valor maior que o crédito do cliente (R$ %)', replace(to_char(v_saldo, 'FM999999990.00'), '.', ',') using errcode = 'P0001'; end if;
  end if;
  insert into public.cliente_creditos(cliente_id, tipo, valor, obs)
  values (p_cliente, p_tipo, round(p_valor, 2), nullif(left(trim(coalesce(p_obs,'')), 300), '')) returning id into v_id;
  perform public.fin_log('credito_' || p_tipo, jsonb_build_object('cliente_id', p_cliente, 'valor', p_valor));
  return v_id;
end $$;

revoke all on function public.cliente_credito_saldo(bigint), public.lancar_credito(bigint, text, numeric, text) from public, anon;
grant execute on function public.cliente_credito_saldo(bigint), public.lancar_credito(bigint, text, numeric, text) to authenticated;

-- ---------- criar_nota (mesma de migration-clientes.sql + forma 'credito' sem caixa, só via criar_nota_local) ----------
create or replace function public.criar_nota(p_items jsonb, p_pagamentos jsonb, p_cliente text default null, p_cliente_id bigint default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint; it jsonb; pg jsonb; v_tot numeric := 0; v_pag numeric := 0; v_cx smallint; v_nome text; v_prazo boolean := false;
begin
  if not public.can('vendas') then raise exception 'Sem permissão para criar nota' using errcode = '42501'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 30 then
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
  insert into public.notas(seller_id, cliente, cliente_id)
  values (auth.uid(), coalesce(v_nome, nullif(trim(p_cliente), '')), p_cliente_id) returning id into v_id;
  for it in select * from jsonb_array_elements(p_items) loop
    insert into public.sales(nota_id, sku, qtd, preco_vendido, seller_id)
    values (v_id, it->>'sku', (it->>'qtd')::int, (it->>'preco_vendido')::numeric, auth.uid());
    v_tot := v_tot + (it->>'qtd')::int * (it->>'preco_vendido')::numeric;
  end loop;
  for pg in select * from jsonb_array_elements(p_pagamentos) loop
    if coalesce((pg->>'valor')::numeric, 0) <= 0 then raise exception 'Valor de pagamento inválido' using errcode = 'P0001'; end if;
    insert into public.nota_pagamentos(nota_id, metodo, valor) values (v_id, (pg->>'metodo')::public.pay_method, (pg->>'valor')::numeric);
    if pg->>'metodo' not in ('prazo','credito') then   -- Paga Depois / Caixa Geral: sem entrada no caixa
      select id into v_cx from public.caixas where metodo = (pg->>'metodo')::public.pay_method and ativo;
      if v_cx is null then raise exception 'Sem caixa para %', pg->>'metodo' using errcode = 'P0001'; end if;
      insert into public.caixa_movimentos(caixa_id, tipo, valor, motivo, nota_id, user_id)
      values (v_cx, 'venda', (pg->>'valor')::numeric, 'Nota ' || lpad(v_id::text, 6, '0'), v_id, auth.uid());
    end if;
    v_pag := v_pag + (pg->>'valor')::numeric;
  end loop;
  if round(v_pag, 2) <> round(v_tot, 2) then
    raise exception 'Pagamentos (%) diferentes do total (%)', round(v_pag, 2), round(v_tot, 2) using errcode = 'P0001'; end if;
  update public.notas set total = v_tot where id = v_id;
  return v_id;
end $$;

-- ---------- criar_nota_local: o que a Nova nota do /main chama ----------
create or replace function public.criar_nota_local(p_items jsonb, p_pagamentos jsonb, p_cliente text default null, p_cliente_id bigint default null,
  p_local text default null, p_obs text default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint; v_tot numeric := 0; v_saldo numeric; it jsonb; v_pags jsonb := p_pagamentos;
begin
  if not public.can('vendas') then raise exception 'Sem permissão para criar nota' using errcode = '42501'; end if;
  if p_local is null or p_local not in ('MAQUINA','HX','DINHEIRO','CAIXA GERAL') then
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
revoke all on function public.criar_nota(jsonb, jsonb, text, bigint), public.criar_nota_local(jsonb, jsonb, text, bigint, text, text) from public, anon;
grant execute on function public.criar_nota(jsonb, jsonb, text, bigint), public.criar_nota_local(jsonb, jsonb, text, bigint, text, text) to authenticated;

-- ---------- Recebimento com excedente: quita a dívida e o resto vira crédito na Caixa Geral (atômico) ----------
-- Requer migration-caixa-resumo.sql (alocação nas notas via trigger). O dinheiro todo entra no caixa escolhido.
create or replace function public.registrar_recebimento_credito(p_cliente bigint, p_valor numeric, p_caixa smallint,
  p_forma text default null, p_data date default null, p_obs text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_nome text; v_saldo numeric; v_rec bigint; v_exc numeric := 0; v_nota bigint; v_met text; v_cred bigint;
begin
  if not public.can('financas') then raise exception 'Sem permissão (financeiro/admin)' using errcode = '42501'; end if;
  if coalesce(p_valor, 0) <= 0 then raise exception 'Valor inválido' using errcode = 'P0001'; end if;
  select nome into v_nome from public.clientes where id = p_cliente for update;
  if v_nome is null then raise exception 'Cliente não encontrado' using errcode = 'P0001'; end if;
  v_saldo := greatest(round(public.cliente_saldo_calc(p_cliente), 2), 0);
  if round(p_valor, 2) <= v_saldo then
    v_rec := public.registrar_recebimento(p_cliente, round(p_valor, 2), p_caixa, p_forma, p_data, p_obs);
    return jsonb_build_object('recebimento_id', v_rec, 'quitado', round(p_valor, 2), 'credito', 0);
  end if;
  v_exc := round(p_valor, 2) - v_saldo;
  if v_saldo > 0 then
    v_rec := public.registrar_recebimento(p_cliente, v_saldo, p_caixa, p_forma, p_data, p_obs);
    select max(nota_id) into v_nota from public.recebimento_notas where recebimento_id = v_rec;
  end if;
  select metodo::text into v_met from public.caixas where id = p_caixa and ativo;
  if v_met is null then raise exception 'Caixa inválido' using errcode = 'P0001'; end if;
  insert into public.caixa_movimentos(caixa_id, tipo, valor, motivo, user_id)
  values (p_caixa, 'entrada', v_exc, left('Crédito Caixa Geral (excedente) ' || v_nome, 300), auth.uid());
  insert into public.cliente_creditos(cliente_id, tipo, valor, obs)
  values (p_cliente, 'entrada', v_exc, case when v_nota is not null then 'Excedente pagamento nota ' || lpad(v_nota::text, 6, '0')
                                           else 'Excedente pagamento (sem dívida em aberto)' end) returning id into v_cred;
  perform public.fin_log('credito_excedente', jsonb_build_object('cliente_id', p_cliente, 'valor', v_exc, 'recebimento_id', v_rec));
  return jsonb_build_object('recebimento_id', v_rec, 'quitado', v_saldo, 'credito', v_exc, 'credito_id', v_cred);
end $$;
revoke all on function public.registrar_recebimento_credito(bigint, numeric, smallint, text, date, text) from public, anon;
grant execute on function public.registrar_recebimento_credito(bigint, numeric, smallint, text, date, text) to authenticated;
notify pgrst, 'reload schema';
