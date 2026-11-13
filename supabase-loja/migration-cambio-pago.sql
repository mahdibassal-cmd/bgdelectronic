-- DRAFT — NÃO APLICAR em produção até o dono (MB) dizer "publica".
-- Não rodar no SQL Editor do projeto xvsxnicmpkvzzhkkqgam antes disso.
-- Loja /main apenas. Não mexe no quiosque. Não altera notas nem sale_costs.
-- Rodar depois de migration-origem-dolar.sql, migration-compras-pagamento.sql
-- e migration-compras-pagamento-admin.sql.
--
-- Custo do Importado é por produto (product_costs.custo), não por lote.
-- Cada linha de compra é um lote: quantidade × custo em US$.
--
-- Taxa de cada lote Importado:
--   pagar agora ............... travada na taxa da compra, já na criação
--                               (cambio_pago = taxa_dolar, data_pagamento = data da compra)
--   pagar depois / dívida ..... flutua com a cotação geral enquanto cambio_pago for nulo
--   depois de paga ............ travada em cambio_pago
--   compra antiga (pagamento nulo) trava na taxa já gravada na linha
--
-- Custo atual = média ponderada pela quantidade comprada (não pelo estoque
-- restante: a venda não escolhe lote):
--   round( sum(qtd × round(custo_usd × taxa_do_lote, 2)) / sum(qtd) , 2 )
-- Lote nacional não entra nessa média. Se o produto volta a ser Nacional,
-- o custo em R$ daquela compra nacional substitui a média, como hoje.
-- Sem nenhuma linha Importado, o custo_usd do produto × cotação continua
-- valendo (cadastro manual).
--
-- No pagamento (Compras pendentes, só admin) de uma compra Importado ainda
-- aberta o admin informa a data (padrão hoje, não futura) e o câmbio pago
-- (vem preenchido com a cotação, pode mudar).
--   total R$ = round( nacional + US$ total × câmbio pago , 2 )
--   pagar depois: sai esse valor do caixa escolhido, com trava de saldo
--   dívida: o mesmo valor ajusta o caixa COMPRA PRODUTOS (sem trava de saldo)
-- O custo das unidades dessa compra fica travado. Cotação nova não mexe nele.
-- pagar_em é só agenda: aparece e ordena Compras pendentes. Não paga sozinho.
--
-- O valor que sai do caixa é o US$ total × câmbio (uma conta). O custo de
-- cada unidade é round(custo_usd × câmbio, 2). Com um custo US$ só, os dois
-- batem. Se o arredondamento por unidade divergir um centavo, o caixa segue
-- o total da compra.

alter table public.compras add column if not exists cambio_pago numeric(7,4);
alter table public.compras drop constraint if exists compras_cambio_pago_check;
alter table public.compras add constraint compras_cambio_pago_check
  check (cambio_pago is null or (cambio_pago > 0 and cambio_pago <= 999));
alter table public.compras add column if not exists data_pagamento date;
alter table public.compras add column if not exists pagar_em date;
create index if not exists compras_cambio_aberto_idx
  on public.compras (pagar_em)
  where pagamento in ('depois', 'divida') and cambio_pago is null;

-- pagamento, vencimento e os campos novos não saem no SELECT direto.
-- O admin lê pela RPC. O financeiro não lê nenhum deles.
do $$
declare cols text;
begin
  if to_regclass('public.compras') is null then return; end if;
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'compras'
     and column_name not in ('pagamento', 'vencimento', 'cambio_pago', 'data_pagamento', 'pagar_em');
  if cols is null then return; end if;
  execute 'revoke select on table public.compras from authenticated';
  execute 'grant select (' || cols || ') on table public.compras to authenticated';
end $$;

drop policy if exists compra_pag_ler on public.compra_pagamentos;
create policy compra_pag_ler on public.compra_pagamentos
  for select to authenticated
  using (
    (select public.can('admin'))
    and (select public.compra_pag_visivel(caixa_id))
  );

-- Recalcula o custo R$ dos Importados. p_sku nulo = todos.
create or replace function public.recalcular_custo_importado(p_sku text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_cot numeric := public.cotacao_dolar_valor();
  r record;
  ln record;
  v_num numeric;
  v_den numeric;
  v_rate numeric;
  v_custo numeric;
begin
  for r in
    select pr.sku
      from public.products pr
     where pr.origem = 'Importado'
       and (p_sku is null or pr.sku = p_sku)
  loop
    v_num := 0;
    v_den := 0;
    for ln in
      select pu.qtd, pu.custo_usd, pu.taxa_dolar,
             c.pagamento, c.cambio_pago, c.taxa_dolar as taxa_compra
        from public.purchases pu
        left join public.compras c on c.id = pu.compra_id
       where pu.sku = r.sku
         and pu.origem = 'Importado'
         and pu.custo_usd is not null
    loop
      if ln.cambio_pago is not null then
        v_rate := ln.cambio_pago;
      elsif ln.pagamento = 'agora' then
        v_rate := coalesce(ln.taxa_dolar, ln.taxa_compra);
      elsif ln.pagamento in ('depois', 'divida') then
        if v_cot is null then
          raise exception 'Defina a cotação do dólar antes de recalcular o custo importado' using errcode = 'P0001';
        end if;
        v_rate := v_cot;
      else
        v_rate := coalesce(ln.taxa_dolar, ln.taxa_compra);
      end if;
      if v_rate is null or v_rate <= 0 then
        continue;
      end if;
      v_num := v_num + ln.qtd * round(ln.custo_usd * v_rate, 2);
      v_den := v_den + ln.qtd;
    end loop;
    if v_den > 0 then
      v_custo := round(v_num / v_den, 2);
      update public.product_costs
         set custo = v_custo, updated_at = now()
       where sku = r.sku;
    elsif v_cot is not null then
      update public.product_costs c
         set custo = round(c.custo_usd * v_cot, 2), updated_at = now()
       where c.sku = r.sku and c.custo_usd is not null;
    end if;
  end loop;
  perform set_config('bagda.recalc_dolar', '1', true);
  update public.products pr
     set updated_at = now()
   where pr.origem = 'Importado'
     and (p_sku is null or pr.sku = p_sku);
end
$fn$;
revoke all on function public.recalcular_custo_importado(text) from public, anon, authenticated;

create or replace function public.cotacao_dolar_salvar(p_valor numeric)
returns jsonb language plpgsql volatile security definer set search_path = '' as $fn$
begin
  if not public.can('admin') then raise exception 'Só admin altera a cotação' using errcode = '42501'; end if;
  if auth.uid() is null then raise exception 'Sem sessão' using errcode = '42501'; end if;
  if p_valor is null or p_valor <= 0 or p_valor > 999 or p_valor <> round(p_valor, 4) then
    raise exception 'Cotação inválida' using errcode = 'P0001';
  end if;
  insert into public.cotacao_dolar(valor, alterado_por) values (round(p_valor, 4), auth.uid());
  perform public.recalcular_custo_importado(null);
  return public.cotacao_dolar_ler();
end
$fn$;

-- A linha entra com um custo provisório. O recálculo logo abaixo usa a média
-- (na criação o pagamento ainda pode estar nulo: a RPC grava a forma e recalcula de novo).
create or replace function public.tg_purchase_insert()
returns trigger language plpgsql security definer set search_path = '' as $fn$
declare v_custo numeric := new.custo_unit; v_global numeric;
begin
  update public.products set estoque = estoque + new.qtd, updated_at = now() where sku = new.sku;
  if new.origem = 'Importado' and new.custo_usd is not null then
    v_global := public.cotacao_dolar_valor();
    if v_global is null then
      raise exception 'Defina a cotação do dólar antes de lançar produto importado' using errcode = 'P0001';
    end if;
    v_custo := round(new.custo_usd * v_global, 2);
  end if;
  insert into public.product_costs(sku, custo, custo_usd)
  values (new.sku, v_custo, new.custo_usd)
  on conflict (sku) do update set
    custo = excluded.custo,
    custo_usd = coalesce(excluded.custo_usd, public.product_costs.custo_usd),
    updated_at = now();
  if new.taxa_dolar is not null and new.compra_id is not null then
    update public.compras set taxa_dolar = new.taxa_dolar where id = new.compra_id;
  end if;
  if new.origem is null then return null; end if;
  if new.origem = 'Importado' then
    perform set_config('bagda.recalc_dolar', '1', true);
    update public.products set origem = 'Importado', updated_at = now() where sku = new.sku;
    perform public.recalcular_custo_importado(new.sku);
  elsif new.origem = 'Nacional' then
    update public.products set origem = 'Nacional', updated_at = now() where sku = new.sku;
  else
    raise exception 'Origem inválida' using errcode = 'P0001';
  end if;
  return null;
end
$fn$;
revoke all on function public.tg_purchase_insert() from public, anon, authenticated;

-- Saída ou entrada no caixa da compra. Não é chamada pelo cliente.
create or replace function public.compra_mover_caixa(
  p_caixa smallint,
  p_tipo text,
  p_valor numeric,
  p_motivo text,
  p_data date,
  p_sem_saldo boolean
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_val numeric := round(coalesce(p_valor, 0), 2);
  v_cx smallint;
  v_nome text;
  v_forma text;
  v_saldo numeric;
  v_mov bigint;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not (select public.can('admin')) then
    raise exception 'Somente admin' using errcode = '42501';
  end if;
  if auth.uid() is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  if v_val <= 0 or p_tipo not in ('saida', 'entrada') then
    raise exception 'Valor inválido' using errcode = 'P0001';
  end if;
  if p_caixa is null then
    raise exception 'Escolha o caixa' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(892341, p_caixa::int);
  select id, nome, metodo::text into v_cx, v_nome, v_forma
    from public.caixas
   where id = p_caixa and ativo and public.caixa_permitido(p_caixa);
  if v_cx is null then
    raise exception 'Caixa inválido' using errcode = 'P0001';
  end if;
  v_saldo := round(public.caixa_saldo_calc(v_cx), 2);
  if p_tipo = 'saida' and not coalesce(p_sem_saldo, false) and v_val > v_saldo then
    raise exception 'Saldo insuficiente no caixa (R$ %)',
      replace(to_char(v_saldo, 'FM999999990.00'), '.', ',') using errcode = 'P0001';
  end if;
  if coalesce(p_sem_saldo, false) then
    if not exists (select 1 from public.caixas where id = v_cx and somente_admin) then
      raise exception 'Dívida só no caixa especial' using errcode = 'P0001';
    end if;
  end if;
  insert into public.caixa_movimentos(caixa_id, tipo, valor, motivo, user_id, forma)
  values (v_cx, p_tipo::public.mov_tipo, v_val, left(coalesce(p_motivo, ''), 300), auth.uid(), v_forma)
  returning id into v_mov;
  if p_data is not null and p_data <= v_hoje then
    update public.caixa_movimentos set data = p_data where id = v_mov;
  end if;
  return jsonb_build_object(
    'mov_id', v_mov, 'valor', v_val, 'caixa', v_nome, 'caixa_id', v_cx,
    'saldo_caixa', public.caixa_saldo_calc(v_cx));
end
$fn$;
revoke all on function public.compra_mover_caixa(smallint, text, numeric, text, date, boolean) from public, anon, authenticated;

create or replace function public.registrar_compra_lote(p_header jsonb, p_itens jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare v_lote uuid := gen_random_uuid(); it jsonb; n int := 0; v_tot numeric := 0; v_cid bigint;
  v_forn text := nullif(btrim(regexp_replace(coalesce(p_header->>'fornecedor', ''), '\s+', ' ', 'g')), '');
  v_obs text := nullif(btrim(coalesce(p_header->>'observacao', '')), '');
  v_data date := coalesce(nullif(p_header->>'data', '')::date, (now() at time zone 'America/Sao_Paulo')::date);
  v_taxa numeric := nullif(p_header->>'taxa_dolar', '')::numeric;
  v_origem text; v_cusd numeric; v_custo numeric;
  v_pag text; v_venc date; v_quando date; v_cx smallint; v_imp boolean := false; sk record;
begin
  if not (public.can('admin')) then raise exception 'Só admin registra compra' using errcode = '42501'; end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then raise exception 'Nenhum item' using errcode = 'P0001'; end if;
  if jsonb_array_length(p_itens) > 200 then raise exception 'Máximo 200 itens por compra' using errcode = 'P0001'; end if;
  if v_data > (now() at time zone 'America/Sao_Paulo')::date then raise exception 'Data no futuro' using errcode = 'P0001'; end if;
  if length(v_forn) > 120 or length(v_obs) > 500 then raise exception 'Fornecedor/observação longos demais' using errcode = 'P0001'; end if;
  if v_taxa is not null and (v_taxa <= 0 or v_taxa > 999 or v_taxa <> round(v_taxa, 4)) then raise exception 'Taxa do dólar inválida' using errcode = 'P0001'; end if;
  for it in select * from jsonb_array_elements(p_itens) loop
    n := n + 1;
    v_origem := nullif(btrim(coalesce(it->>'origem', '')), '');
    v_cusd := nullif(it->>'custo_usd', '')::numeric;
    if not exists (select 1 from public.products where sku = it->>'sku') then raise exception 'Item %: SKU % não existe', n, it->>'sku' using errcode = 'P0001'; end if;
    if coalesce((it->>'qtd')::int, 0) <= 0 then raise exception 'Item %: quantidade inválida', n using errcode = 'P0001'; end if;
    if v_origem is not null and v_origem not in ('Nacional', 'Importado') then raise exception 'Item %: origem inválida', n using errcode = 'P0001'; end if;
    if v_origem = 'Importado' and v_taxa is null then raise exception 'Item %: informe a taxa do dólar desta compra', n using errcode = 'P0001'; end if;
    if v_origem = 'Importado' and (v_cusd is null or v_cusd < 0) then raise exception 'Item %: informe o custo em US$', n using errcode = 'P0001'; end if;
    if v_origem is distinct from 'Importado' and coalesce((it->>'custo_unit')::numeric, -1) < 0 then raise exception 'Item %: custo inválido', n using errcode = 'P0001'; end if;
    v_custo := case when v_origem = 'Importado' then round(v_cusd * v_taxa, 2) else round((it->>'custo_unit')::numeric, 2) end;
    insert into public.purchases (data, sku, fornecedor, qtd, custo_unit, observacao, compra_lote, origem, preco_usd, custo_usd, taxa_dolar)
    values (v_data, it->>'sku', v_forn, (it->>'qtd')::int, v_custo, v_obs, v_lote,
            v_origem, null,
            case when v_origem = 'Importado' then round(v_cusd, 2) end,
            case when v_origem = 'Importado' then round(v_taxa, 4) end);
    v_tot := v_tot + (it->>'qtd')::int * v_custo;
  end loop;
  if v_forn is not null and length(v_forn) >= 2 and not exists (select 1 from public.fornecedores f where lower(btrim(f.nome)) = lower(v_forn)) then
    insert into public.fornecedores (nome) values (v_forn);
  end if;
  select id into v_cid from public.compras where lote = v_lote;
  if v_cid is null then raise exception 'Compra não numerada' using errcode = 'P0001'; end if;
  v_imp := exists (select 1 from public.purchases p where p.compra_id = v_cid and p.origem = 'Importado');
  v_pag := nullif(lower(btrim(coalesce(p_header->>'pagamento', ''))), '');
  if v_pag is not null then
    if v_pag not in ('agora', 'depois', 'divida') then
      raise exception 'Escolha a forma de pagamento' using errcode = 'P0001';
    end if;
    if v_pag = 'divida' and not public.has_perm('admin') then
      raise exception 'Só admin lança dívida no caixa especial' using errcode = '42501';
    end if;
    v_venc := null;
    if v_pag = 'depois' and nullif(btrim(coalesce(p_header->>'vencimento', '')), '') is not null then
      begin
        v_venc := (p_header->>'vencimento')::date;
      exception when others then
        raise exception 'Vencimento inválido' using errcode = 'P0001';
      end;
    end if;
    v_quando := null;
    if v_pag in ('depois', 'divida') and nullif(btrim(coalesce(p_header->>'pagar_em', '')), '') is not null then
      begin
        v_quando := (p_header->>'pagar_em')::date;
      exception when others then
        raise exception 'Data de pagar em inválida' using errcode = 'P0001';
      end;
      if v_quando < date '2020-01-01' or v_quando > (now() at time zone 'America/Sao_Paulo')::date + 1825 then
        raise exception 'Data de pagar em inválida' using errcode = 'P0001';
      end if;
    end if;
    update public.compras
       set pagamento = v_pag,
           vencimento = case when v_pag = 'depois' then v_venc end,
           pagar_em = case when v_pag in ('depois', 'divida') then v_quando end,
           cambio_pago = case when v_pag = 'agora' and v_imp and v_taxa is not null then round(v_taxa, 4) end,
           data_pagamento = case when v_pag = 'agora' and v_imp and v_taxa is not null then v_data end
     where id = v_cid;
    if v_pag in ('agora', 'divida') and round(v_tot, 2) > 0 then
      begin
        v_cx := nullif(btrim(coalesce(p_header->>'caixa_id', '')), '')::smallint;
      exception when others then
        raise exception 'Caixa inválido' using errcode = 'P0001';
      end;
      if v_cx is null then raise exception 'Escolha o caixa' using errcode = 'P0001'; end if;
      perform public.compra_lancar_saida(v_cid, v_cx, round(v_tot, 2), v_pag = 'divida');
    end if;
    for sk in
      select distinct pu.sku from public.purchases pu
       where pu.compra_id = v_cid and pu.origem = 'Importado'
    loop
      perform public.recalcular_custo_importado(sk.sku);
    end loop;
  end if;
  return jsonb_build_object(
    'lote', v_lote, 'itens', n, 'total', round(v_tot, 2), 'compra_id', v_cid,
    'numero', public.compra_numero(v_cid), 'origem_ok', true,
    'pagamento', v_pag, 'pagamento_ok', v_pag is not null);
end
$fn$;

create or replace function public.compra_agendar(p_compra bigint, p_quando date)
returns jsonb language plpgsql volatile security definer set search_path = '' as $fn$
declare c record;
begin
  if not (select public.can('admin')) then
    raise exception 'Somente admin' using errcode = '42501';
  end if;
  select * into c from public.compras where id = p_compra for update;
  if not found or c.pagamento is null or c.pagamento not in ('depois', 'divida') then
    raise exception 'Só dá para agendar uma compra ainda não paga' using errcode = 'P0001';
  end if;
  if c.cambio_pago is not null then
    raise exception 'Esta compra já foi paga' using errcode = 'P0001';
  end if;
  if p_quando is not null and (p_quando < date '2020-01-01' or p_quando > (now() at time zone 'America/Sao_Paulo')::date + 1825) then
    raise exception 'Data de pagar em inválida' using errcode = 'P0001';
  end if;
  update public.compras set pagar_em = p_quando where id = c.id;
  return jsonb_build_object('id', c.id, 'pagar_em', p_quando);
end
$fn$;

drop function if exists public.compra_pagar(bigint, numeric, smallint);
create or replace function public.compra_pagar(
  p_compra bigint,
  p_valor numeric,
  p_caixa smallint,
  p_cambio numeric default null,
  p_data date default null
) returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  c record;
  v_usd numeric;
  v_nac numeric;
  v_cambio numeric;
  v_data date;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_total numeric;
  v_pago numeric;
  v_debito numeric;
  v_cx smallint;
  v_mov jsonb;
  v_pag_id bigint;
  v_num text;
  sk record;
  v_n_pag int;
begin
  if not (select public.can('admin')) then
    raise exception 'Somente admin' using errcode = '42501';
  end if;
  select * into c from public.compras where id = p_compra for update;
  if not found or c.pagamento is null or c.pagamento not in ('agora', 'depois', 'divida') then
    raise exception 'Compra antiga sem controle de pagamento' using errcode = 'P0001';
  end if;
  select coalesce(sum(p.qtd * p.custo_usd), 0) into v_usd
    from public.purchases p
   where p.compra_id = c.id and p.origem = 'Importado' and p.custo_usd is not null;
  if v_usd > 0 and c.cambio_pago is null and c.pagamento in ('depois', 'divida') then
    if p_cambio is null or p_cambio <= 0 or p_cambio > 999 or p_cambio <> round(p_cambio, 4) then
      raise exception 'Câmbio pago inválido' using errcode = 'P0001';
    end if;
    v_cambio := round(p_cambio, 4);
    v_data := coalesce(p_data, v_hoje);
    if v_data > v_hoje or v_data < date '2020-01-01' then
      raise exception 'Data do pagamento inválida' using errcode = 'P0001';
    end if;
    select coalesce(sum(p.qtd * p.custo_unit), 0) into v_nac
      from public.purchases p
     where p.compra_id = c.id and p.origem is distinct from 'Importado';
    v_total := round(v_nac + round(v_usd * v_cambio, 2), 2);
    if v_total <= 0 then
      raise exception 'Valor inválido' using errcode = 'P0001';
    end if;
    update public.purchases
       set custo_unit = round(custo_usd * v_cambio, 2)
     where compra_id = c.id and origem = 'Importado' and custo_usd is not null;
    update public.compras
       set cambio_pago = v_cambio, data_pagamento = v_data
     where id = c.id;
    select round(coalesce(sum(pg.valor), 0), 2) into v_pago
      from public.compra_pagamentos pg where pg.compra_id = c.id;
    v_num := public.compra_numero(c.id);
    if c.pagamento = 'divida' then
      select count(*) into v_n_pag from public.compra_pagamentos where compra_id = c.id;
      if v_n_pag <> 1 then
        raise exception 'Dívida sem um único lançamento no caixa' using errcode = 'P0001';
      end if;
      select pg.caixa_id into v_cx from public.compra_pagamentos pg where pg.compra_id = c.id;
      v_debito := round(v_total - v_pago, 2);
      if v_debito > 0.001 then
        v_mov := public.compra_mover_caixa(v_cx, 'saida', v_debito,
          left('Ajuste câmbio Compra ' || v_num || ' — ' || coalesce(nullif(btrim(c.fornecedor), ''), 'fornecedor'), 300),
          v_data, true);
      elsif v_debito < -0.001 then
        v_mov := public.compra_mover_caixa(v_cx, 'entrada', abs(v_debito),
          left('Ajuste câmbio Compra ' || v_num || ' — ' || coalesce(nullif(btrim(c.fornecedor), ''), 'fornecedor'), 300),
          v_data, true);
      end if;
      update public.compra_pagamentos
         set valor = v_total, data = v_data
       where compra_id = c.id
       returning id into v_pag_id;
    else
      v_debito := round(v_total - v_pago, 2);
      if v_debito < -0.009 then
        raise exception 'O câmbio deixa o total menor do que já foi pago' using errcode = 'P0001';
      end if;
      if v_debito > 0.001 then
        if p_caixa is null then
          raise exception 'Escolha o caixa' using errcode = 'P0001';
        end if;
        v_mov := public.compra_mover_caixa(p_caixa, 'saida', v_debito,
          left('Compra ' || v_num || ' — ' || coalesce(nullif(btrim(c.fornecedor), ''), 'fornecedor'), 300),
          v_data, false);
        insert into public.compra_pagamentos(compra_id, valor, data, caixa_id, mov_id, user_id)
        values (c.id, v_debito, v_data, p_caixa, (v_mov->>'mov_id')::bigint, auth.uid())
        returning id into v_pag_id;
      end if;
    end if;
    if to_regprocedure('public.fin_log(text,jsonb)') is not null then
      perform public.fin_log('fin_pagamento', jsonb_build_object(
        'compra_id', c.id, 'numero', v_num, 'valor', v_total, 'cambio_pago', v_cambio, 'data_pagamento', v_data));
    end if;
    if to_regclass('public.security_events') is not null then
      insert into public.security_events(kind, actor, detail)
      values ('compra_pagamento', auth.uid(), jsonb_build_object(
        'compra_id', c.id, 'numero', v_num, 'valor', v_total, 'cambio_pago', v_cambio,
        'data_pagamento', v_data, 'fornecedor', c.fornecedor, 'pagamento', c.pagamento));
    end if;
    for sk in
      select distinct pu.sku from public.purchases pu
       where pu.compra_id = c.id and pu.origem = 'Importado'
    loop
      perform public.recalcular_custo_importado(sk.sku);
    end loop;
    return jsonb_build_object(
      'pagamento_id', v_pag_id, 'valor', coalesce(v_debito, 0), 'total', v_total,
      'cambio_pago', v_cambio, 'data_pagamento', v_data, 'restante', 0, 'travado', true,
      'saldo_caixa', case when v_mov is null then null else v_mov->'saldo_caixa' end,
      'caixa', case when v_mov is null then null else v_mov->>'caixa' end);
  end if;
  return public.compra_lancar_saida(p_compra, p_caixa, p_valor);
end
$fn$;

create or replace function public.compras_pendentes()
returns jsonb language plpgsql stable security definer set search_path = '' as $fn$
declare
  v_admin boolean := public.has_perm('admin');
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_cot numeric := public.cotacao_dolar_valor();
  v_grupos jsonb;
  v_pagas jsonb;
begin
  if not (select public.can('admin')) then
    raise exception 'Somente admin' using errcode = '42501';
  end if;
  with linhas as (
    select c.id,
           public.compra_numero(c.id) as numero,
           c.data,
           nullif(btrim(c.fornecedor), '') as fornecedor,
           c.vencimento,
           c.pagamento,
           c.pagar_em,
           c.cambio_pago,
           c.data_pagamento,
           c.taxa_dolar,
           coalesce((
             select round(sum(p.qtd * p.custo_usd), 2)
               from public.purchases p
              where p.compra_id = c.id and p.origem = 'Importado' and p.custo_usd is not null
           ), 0) as total_usd,
           coalesce((
             select round(sum(p.qtd * p.custo_unit), 2)
               from public.purchases p
              where p.compra_id = c.id and p.origem is distinct from 'Importado'
           ), 0) as total_nacional,
           round(coalesce((select sum(p.qtd * p.custo_unit) from public.purchases p where p.compra_id = c.id), 0), 2) as total_linhas,
           round(coalesce((select sum(pg.valor) from public.compra_pagamentos pg where pg.compra_id = c.id), 0), 2) as pago
      from public.compras c
     where c.pagamento in ('agora', 'depois', 'divida')
  ),
  calc as (
    select l.*,
           (l.total_usd > 0 and l.cambio_pago is null and l.pagamento in ('depois', 'divida')) as flutuante,
           case
             when l.total_usd > 0 and l.cambio_pago is not null
               then round(l.total_nacional + round(l.total_usd * l.cambio_pago, 2), 2)
             when l.total_usd > 0 and l.pagamento in ('depois', 'divida') and l.cambio_pago is null and v_cot is not null
               then round(l.total_nacional + round(l.total_usd * v_cot, 2), 2)
             else l.total_linhas
           end as total
      from linhas l
  ),
  calc2 as (
    select c.*,
           round(c.total - c.pago, 2) as restante,
           (c.vencimento is not null and c.vencimento < v_hoje) as atrasada,
           (c.pagamento = 'depois' and round(c.total - c.pago, 2) > 0.009)
             or (c.pagamento = 'divida' and c.flutuante) as aberta
      from calc c
  ),
  objs as (
    select c.*,
           case when c.pagamento = 'divida' and c.flutuante then c.total else round(c.total - c.pago, 2) end as devido,
           jsonb_build_object(
             'id', c.id, 'numero', c.numero, 'data', c.data,
             'fornecedor', coalesce(c.fornecedor, 'Sem fornecedor'),
             'vencimento', c.vencimento, 'pagamento', c.pagamento,
             'pagar_em', c.pagar_em, 'cambio_pago', c.cambio_pago, 'data_pagamento', c.data_pagamento,
             'taxa_dolar', c.taxa_dolar,
             'total_usd', case when c.total_usd > 0 then c.total_usd else null end,
             'total_nacional', c.total_nacional,
             'flutuante', c.flutuante,
             'total', c.total, 'pago', c.pago, 'restante', round(c.total - c.pago, 2),
             'atrasada', c.atrasada and c.aberta,
             'pagamentos', coalesce((
               select jsonb_agg(jsonb_build_object(
                        'id', pg.id, 'valor', pg.valor, 'data', pg.data,
                        'caixa', case when cx.somente_admin and not v_admin then null else cx.nome end,
                        'caixa_id', case when cx.somente_admin and not v_admin then null else cx.id end,
                        'caixa_oculto', cx.somente_admin and not v_admin
                      ) order by pg.id)
                 from public.compra_pagamentos pg
                 join public.caixas cx on cx.id = pg.caixa_id
                where pg.compra_id = c.id
             ), '[]'::jsonb)
           ) as obj
      from calc2 c
  )
  select coalesce((
           select jsonb_agg(jsonb_build_object(
                    'fornecedor', g.fornecedor, 'total_devido', g.total_devido, 'compras', g.compras
                  ) order by g.fornecedor)
             from (
               select coalesce(fornecedor, 'Sem fornecedor') as fornecedor,
                      round(sum(devido), 2) as total_devido,
                      jsonb_agg(obj order by (atrasada and aberta) desc, pagar_em nulls last, vencimento nulls last, data, id) as compras
                 from objs
                where aberta
                group by coalesce(fornecedor, 'Sem fornecedor')
             ) g
         ), '[]'::jsonb),
         coalesce((
           select jsonb_agg(obj order by id desc)
             from (select obj, id from objs where not aberta order by id desc limit 40) s
         ), '[]'::jsonb)
    into v_grupos, v_pagas;
  return jsonb_build_object('grupos', v_grupos, 'pagas', v_pagas, 'cotacao', v_cot);
end
$fn$;

create or replace function public.custos_loja()
returns jsonb language plpgsql stable security definer set search_path = '' as $fn$
declare
  r record;
  v_out jsonb := '[]'::jsonb;
  v_float int;
  v_lock int;
  v_rates int;
  v_rate numeric;
  v_sit text;
begin
  if not (select public.can('admin')) then
    raise exception 'Somente admin' using errcode = '42501';
  end if;
  for r in
    select pr.sku, pr.origem, c.custo, c.custo_usd
      from public.products pr
      left join public.product_costs c on c.sku = pr.sku
     order by pr.sku
  loop
    if r.origem is distinct from 'Importado' then
      v_sit := 'nacional';
      v_rate := null;
    else
      select
        count(*) filter (where coalesce(c.pagamento in ('depois', 'divida'), false) and c.cambio_pago is null),
        count(*) filter (where not (coalesce(c.pagamento in ('depois', 'divida'), false) and c.cambio_pago is null)),
        count(distinct case
          when c.cambio_pago is not null then c.cambio_pago
          when c.pagamento = 'agora' then coalesce(pu.taxa_dolar, c.taxa_dolar)
          when c.pagamento is null then coalesce(pu.taxa_dolar, c.taxa_dolar)
          else null end),
        min(case
          when c.cambio_pago is not null then c.cambio_pago
          when c.pagamento = 'agora' then coalesce(pu.taxa_dolar, c.taxa_dolar)
          when c.pagamento is null then coalesce(pu.taxa_dolar, c.taxa_dolar)
          else null end)
        into v_float, v_lock, v_rates, v_rate
        from public.purchases pu
        left join public.compras c on c.id = pu.compra_id
       where pu.sku = r.sku and pu.origem = 'Importado' and pu.custo_usd is not null;
      if coalesce(v_float, 0) + coalesce(v_lock, 0) = 0 then
        v_sit := case when r.custo_usd is not null then 'cotacao' else 'nacional' end;
        v_rate := null;
      elsif v_float > 0 and v_lock > 0 then
        v_sit := 'misto';
        v_rate := null;
      elsif v_float > 0 then
        v_sit := 'cotacao';
        v_rate := null;
      else
        v_sit := 'travado';
        if v_rates is distinct from 1 then v_rate := null; end if;
      end if;
    end if;
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'sku', r.sku, 'custo', r.custo, 'situacao', v_sit, 'cambio', v_rate));
  end loop;
  return v_out;
end
$fn$;

revoke all on function public.cotacao_dolar_salvar(numeric),
  public.registrar_compra_lote(jsonb, jsonb),
  public.compra_agendar(bigint, date),
  public.compra_pagar(bigint, numeric, smallint, numeric, date),
  public.compras_pendentes(),
  public.custos_loja() from public, anon;
grant execute on function public.cotacao_dolar_salvar(numeric),
  public.registrar_compra_lote(jsonb, jsonb),
  public.compra_agendar(bigint, date),
  public.compra_pagar(bigint, numeric, smallint, numeric, date),
  public.compras_pendentes(),
  public.custos_loja() to authenticated;

notify pgrst, 'reload schema';
select 'cambio-pago draft' as status;
