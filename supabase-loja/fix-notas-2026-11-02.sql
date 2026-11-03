-- =====================================================================
-- BAGDA STORES (bagda-loja, ref xvsxnicmpkvzzhkkqgam) — CORREÇÃO DE PREÇO em 4 notas de 02/11/2026
-- Rode no SQL Editor (role postgres), arquivo inteiro, de uma vez. Pedido do MB (admin).
--   nota 000006 -> 2 perfumes a R$ 95,00 = R$ 190,00
--   nota 000019 -> R$ 252,00 | nota 000023 -> R$ 288,00 | nota 000024 -> R$ 225,00
-- Nº da nota = notas.id (o app mostra lpad(id,6,'0')).
-- O que muda: sales.preco_vendido (sales.total é coluna gerada), notas.total, nota_pagamentos.valor e o
--   caixa_movimentos 'venda' da mesma nota/forma. Saldo de cliente (Paga Depois) e lucro são calculados
--   (nota_pagamentos 'prazo' e sale_costs), então se ajustam sozinhos. NÃO mexe em custo nem estoque.
-- Itens: preço unitário escalado proporcionalmente; o resto do arredondamento vai no último item com qtd 1
--   (ou no último item, se a divisão fechar em centavos). Pagamento único: vira o total novo. Vários: ajusta
--   o maior (aborta se ficaria <= 0).
-- Travas: aborta (nada gravado) se nota não existir em 02/11, estiver cancelada, nota 6 não tiver exatamente
--   2 unidades, Paga Depois já recebido > novo valor, ou se algum UPDATE não atingir as linhas esperadas.
-- Segurança: não desliga RLS nem triggers (não há trigger de UPDATE em notas/sales/nota_pagamentos/
--   caixa_movimentos; o bloqueio de horário só vale para usuários do app, não para o SQL Editor).
-- Resultado: a última consulta mostra ANTES x DEPOIS por nota + totais do dia 02/11.
-- =====================================================================
begin;

drop table if exists pg_temp.fix_alvo, pg_temp.fix_antes, pg_temp.fix_log;
create temp table fix_alvo (nota_id bigint primary key, novo_total numeric(12,2) not null, preco_unit_fixo numeric(10,2));
insert into fix_alvo values (6, 190.00, 95.00), (19, 252.00, null), (23, 288.00, null), (24, 225.00, null);
create temp table fix_log (ordem int, nota text, fase text, itens text, total numeric, pagamentos text, caixa text, lucro numeric);

-- ---------- 1) Estado ANTES ----------
create temp table fix_antes as
select n.id nota_id, n.data, n.status, n.total,
  (select string_agg(p.marca || ' ' || p.produto || ' x' || s.qtd || ' @ ' || s.preco_vendido, ' | ' order by s.id)
     from public.sales s join public.products p on p.sku = s.sku where s.nota_id = n.id) itens,
  (select string_agg(np.metodo::text || ' ' || np.valor, ' + ' order by np.id) from public.nota_pagamentos np where np.nota_id = n.id) pags,
  (select string_agg(c.nome || ' ' || m.tipo || ' ' || m.valor, ' + ' order by m.id) from public.caixa_movimentos m join public.caixas c on c.id = m.caixa_id where m.nota_id = n.id) cx,
  (select sum(s.total - s.qtd * coalesce(sc.custo_unit, 0)) from public.sales s left join public.sale_costs sc on sc.sale_id = s.id where s.nota_id = n.id) lucro
from public.notas n where n.id in (select nota_id from fix_alvo);
insert into fix_log select a.nota_id::int, lpad(a.nota_id::text, 6, '0'), '1 ANTES', itens, total, pags, cx, lucro from fix_antes a;

-- ---------- 2) Travas + 3) Correção ----------
do $$
declare a record; n record; it record; pg record;
  v_old numeric; v_sum numeric; v_qtd int; v_last bigint; v_last_qtd int; v_rest numeric; v_unit numeric;
  v_pag_tot numeric; v_npag int; v_big bigint; v_newval numeric; v_cx smallint; v_cnt int; v_rec numeric; v_prazo numeric;
begin
  for a in select * from pg_temp.fix_alvo order by nota_id loop
    select * into n from public.notas where id = a.nota_id for update;
    if n.id is null then raise exception 'Nota % não encontrada.', lpad(a.nota_id::text,6,'0'); end if;
    if n.data <> date '2026-11-02' or (n.created_at at time zone 'America/Sao_Paulo')::date <> date '2026-11-02' then
      raise exception 'Nota % não é de 02/11/2026 (data %). Nada foi alterado.', lpad(a.nota_id::text,6,'0'), n.data; end if;
    if n.status <> 'ativa' then raise exception 'Nota % está cancelada. Nada foi alterado.', lpad(a.nota_id::text,6,'0'); end if;
    select coalesce(sum(total),0), coalesce(sum(qtd),0), count(*) into v_old, v_qtd, v_cnt from public.sales where nota_id = n.id;
    if v_cnt = 0 then raise exception 'Nota % não tem itens.', lpad(a.nota_id::text,6,'0'); end if;
    if round(v_old,2) <> round(n.total,2) then raise exception 'Nota %: soma dos itens (%) ≠ total (%).', lpad(a.nota_id::text,6,'0'), v_old, n.total; end if;

    if a.preco_unit_fixo is not null then
      if v_qtd <> 2 then raise exception 'Nota %: esperado exatamente 2 perfumes, encontrado % unidade(s). Nada foi alterado.', lpad(a.nota_id::text,6,'0'), v_qtd; end if;
      update public.sales set preco_vendido = a.preco_unit_fixo where nota_id = n.id;
    else
      -- item que recebe o resto: último com qtd 1; senão o último
      select id, qtd into v_last, v_last_qtd from public.sales where nota_id = n.id order by (qtd = 1) desc, id desc limit 1;
      v_sum := 0;
      for it in select id, qtd, preco_vendido from public.sales where nota_id = n.id and id <> v_last order by id loop
        v_unit := round(it.preco_vendido * a.novo_total / v_old, 2);
        if v_unit <= 0 then raise exception 'Nota %: preço do item ficaria <= 0.', lpad(a.nota_id::text,6,'0'); end if;
        update public.sales set preco_vendido = v_unit where id = it.id;
        v_sum := v_sum + v_unit * it.qtd;
      end loop;
      v_rest := a.novo_total - v_sum;
      if v_rest <= 0 or round(v_rest / v_last_qtd, 2) * v_last_qtd <> v_rest then
        raise exception 'Nota %: não dá para fechar R$ % em centavos (resto % / qtd %).', lpad(a.nota_id::text,6,'0'), a.novo_total, v_rest, v_last_qtd; end if;
      update public.sales set preco_vendido = round(v_rest / v_last_qtd, 2) where id = v_last;
    end if;
    select sum(total) into v_sum from public.sales where nota_id = n.id;
    if round(v_sum,2) <> a.novo_total then raise exception 'Nota %: itens somam % (esperado %).', lpad(a.nota_id::text,6,'0'), v_sum, a.novo_total; end if;
    update public.notas set total = a.novo_total where id = n.id;

    -- pagamentos: único -> total novo; vários -> ajusta o maior
    select count(*), coalesce(sum(valor),0) into v_npag, v_pag_tot from public.nota_pagamentos where nota_id = n.id;
    if v_npag = 0 then raise exception 'Nota % sem pagamentos.', lpad(a.nota_id::text,6,'0'); end if;
    select * into pg from public.nota_pagamentos where nota_id = n.id order by valor desc, id limit 1;
    v_newval := pg.valor + (a.novo_total - v_pag_tot);
    if v_newval <= 0 then raise exception 'Nota %: pagamento % ficaria % (<= 0). Ajuste manual necessário.', lpad(a.nota_id::text,6,'0'), pg.metodo, v_newval; end if;
    if v_newval <> pg.valor then
      update public.nota_pagamentos set valor = v_newval where id = pg.id;
      if pg.metodo::text = 'prazo' then
        -- Paga Depois: saldo do cliente é calculado; só garante que o já recebido não passa do novo valor
        select coalesce(sum(valor),0) into v_rec from public.recebimento_notas where nota_id = n.id;
        select sum(valor) into v_prazo from public.nota_pagamentos where nota_id = n.id and metodo::text = 'prazo';
        if v_rec > v_prazo then raise exception 'Nota %: cliente já pagou % do Paga Depois, maior que o novo valor %.', lpad(a.nota_id::text,6,'0'), v_rec, v_prazo; end if;
      else
        select id into v_cx from public.caixas where metodo = pg.metodo;
        update public.caixa_movimentos set valor = v_newval
         where id = (select id from public.caixa_movimentos where nota_id = n.id and tipo = 'venda' and caixa_id = v_cx and valor = pg.valor order by id limit 1);
        get diagnostics v_cnt = row_count;
        if v_cnt <> 1 then raise exception 'Nota %: movimento de caixa (% %) não encontrado.', lpad(a.nota_id::text,6,'0'), pg.metodo, pg.valor; end if;
      end if;
    end if;
    select sum(valor) into v_pag_tot from public.nota_pagamentos where nota_id = n.id;
    if v_pag_tot <> a.novo_total then raise exception 'Nota %: pagamentos % ≠ total %.', lpad(a.nota_id::text,6,'0'), v_pag_tot, a.novo_total; end if;
  end loop;
end $$;

-- ---------- 4) Estado DEPOIS + totais do dia ----------
insert into fix_log
select n.id::int, lpad(n.id::text, 6, '0'), '2 DEPOIS',
  (select string_agg(p.marca || ' ' || p.produto || ' x' || s.qtd || ' @ ' || s.preco_vendido, ' | ' order by s.id)
     from public.sales s join public.products p on p.sku = s.sku where s.nota_id = n.id), n.total,
  (select string_agg(np.metodo::text || ' ' || np.valor, ' + ' order by np.id) from public.nota_pagamentos np where np.nota_id = n.id),
  (select string_agg(c.nome || ' ' || m.tipo || ' ' || m.valor, ' + ' order by m.id) from public.caixa_movimentos m join public.caixas c on c.id = m.caixa_id where m.nota_id = n.id),
  (select sum(s.total - s.qtd * coalesce(sc.custo_unit, 0)) from public.sales s left join public.sale_costs sc on sc.sale_id = s.id where s.nota_id = n.id)
from public.notas n where n.id in (select nota_id from fix_alvo);
insert into fix_log
select 999, 'DIA 02/11', '3 TOTAIS',
  count(distinct n.id) || ' vendas · ' || sum(s.qtd) || ' itens' ||
  ' · sessões de caixa fechadas em 02/11: ' || (select count(*) from public.caixa_sessoes where data = date '2026-11-02' and fechado_em is not null),
  sum(s.total), 'faturamento (total) / lucro →', null, sum(s.total - s.qtd * coalesce(sc.custo_unit, 0))
from public.notas n join public.sales s on s.nota_id = n.id left join public.sale_costs sc on sc.sale_id = s.id
where n.data = date '2026-11-02' and n.status = 'ativa';

commit;

select nota, fase, itens, total, pagamentos, caixa, lucro from pg_temp.fix_log order by ordem, fase;
