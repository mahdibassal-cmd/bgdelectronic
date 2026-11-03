-- =====================================================================
-- BAGDA (KIOSK, bagda-sistema, ref zoapljfhebbvbsrebtjt, /kiosk) — CORREÇÃO DE PREÇO em 4 notas de 02/11/2026
-- Rode no SQL Editor (role postgres), arquivo inteiro, de uma vez. Pedido do MB (admin).
--   nota 000006 -> 2 unidades a R$ 95,00 = R$ 190,00
--   nota 000019 -> R$ 252,00 | nota 000023 -> R$ 288,00 | nota 000024 -> R$ 225,00
-- Nº da nota no /kiosk = notas.id (o app mostra String(id).padStart(6,'0'); NÃO é sequência por dia).
--   Busca: notas.id = N AND notas.data = '2026-11-02' (mesmo filtro do Extrato: v_nota_itens.data).
-- Kiosk: pagamento único por nota (notas.forma_pagamento = sales.forma_pagamento), sem caixa, sem cancelamento.
--   Total da nota = soma de sales.total (coluna gerada qtd*preco_vendido). Lucro = sales.total - qtd*sale_costs.custo_unit
--   (calculado nas views) => ajusta sozinho. O que muda: SOMENTE sales.preco_vendido. NÃO mexe em custo nem estoque
--   (não há trigger de UPDATE em sales; triggers de estoque são só INSERT/DELETE).
-- Itens: preço unitário escalado proporcionalmente; resto dos centavos vai no último item com qtd 1
--   (ou no último item, se a divisão fechar). Nota 6: todos os itens a 95,00 e exige exatamente 2 unidades.
-- Travas (aborta, nada gravado): nota inexistente em 02/11, item com data diferente de 02/11, nota 6 ≠ 2 unidades,
--   preço resultante <= 0, resto impossível em centavos, total final ≠ alvo, UPDATE com linhas inesperadas.
-- Resultado: a ÚLTIMA consulta mostra ANTES x DEPOIS por nota + totais do dia 02/11.
-- =====================================================================
begin;

drop table if exists pg_temp.fix_alvo, pg_temp.fix_log;
create temp table fix_alvo (nota_id bigint primary key, novo_total numeric(12,2) not null, preco_unit_fixo numeric(10,2));
insert into fix_alvo values (6, 190.00, 95.00), (19, 252.00, null), (23, 288.00, null), (24, 225.00, null);
create temp table fix_log (ordem int, nota text, fase text, como_achou text, vendedor text, pagamento text,
  itens text, unidades int, total numeric, lucro numeric);

create or replace function pg_temp.fix_snap(p_fase text) returns void language sql as $$
  insert into fix_log
  select n.id::int, lpad(n.id::text, 6, '0'), p_fase,
    'notas.id=' || n.id || ' e notas.data=' || n.data, pr.handle, n.forma_pagamento::text,
    (select string_agg(p.marca || ' ' || p.produto || ' x' || s.qtd || ' @ ' || s.preco_vendido, ' | ' order by s.id)
       from public.sales s join public.products p on p.sku = s.sku where s.nota_id = n.id),
    (select sum(s.qtd) from public.sales s where s.nota_id = n.id),
    (select sum(s.total) from public.sales s where s.nota_id = n.id),
    (select sum(s.total - s.qtd * coalesce(sc.custo_unit, 0)) from public.sales s left join public.sale_costs sc on sc.sale_id = s.id where s.nota_id = n.id)
  from public.notas n left join public.profiles pr on pr.id = n.seller_id
  where n.id in (select nota_id from fix_alvo) and n.data = date '2026-11-02';
$$;

-- ---------- 0) Totais do dia ANTES ----------
insert into fix_log
select 0, 'DIA 02/11', '0 ANTES', 'sales.data=2026-11-02 (= cards do Relatório)', null,
  null, count(*) || ' vendas (linhas)', sum(qtd), sum(total),
  (select sum(s.total - s.qtd * sc.custo_unit) from public.sales s join public.sale_costs sc on sc.sale_id = s.id where s.data = date '2026-11-02')
from public.sales where data = date '2026-11-02';

select pg_temp.fix_snap('1 ANTES');

-- ---------- 1) Travas + 2) Correção ----------
do $$
declare a record; n record; it record;
  v_old numeric; v_qtd int; v_last bigint; v_last_qtd int; v_rest numeric; v_unit numeric; v_cnt int; v_new numeric;
begin
  for a in select * from fix_alvo order by nota_id loop
    select * into n from public.notas where id = a.nota_id;
    if not found then raise exception 'Nota % não encontrada no kiosk', lpad(a.nota_id::text,6,'0'); end if;
    if n.data <> date '2026-11-02' then
      raise exception 'Nota % é de % (não 02/11/2026)', lpad(a.nota_id::text,6,'0'), n.data; end if;
    select coalesce(sum(total),0), coalesce(sum(qtd),0), count(*) into v_old, v_qtd, v_cnt from public.sales where nota_id = a.nota_id;
    if v_cnt = 0 then raise exception 'Nota % sem itens', lpad(a.nota_id::text,6,'0'); end if;
    if exists (select 1 from public.sales where nota_id = a.nota_id and data <> date '2026-11-02') then
      raise exception 'Nota % tem item com data diferente de 02/11', lpad(a.nota_id::text,6,'0'); end if;

    if a.preco_unit_fixo is not null then
      if v_qtd <> 2 then raise exception 'Nota % tem % unidade(s), esperado exatamente 2', lpad(a.nota_id::text,6,'0'), v_qtd; end if;
      update public.sales set preco_vendido = a.preco_unit_fixo where nota_id = a.nota_id;
      get diagnostics v_cnt = row_count;
    else
      if v_old <= 0 then raise exception 'Nota % com total atual 0', lpad(a.nota_id::text,6,'0'); end if;
      -- escala todos
      update public.sales set preco_vendido = round(preco_vendido * a.novo_total / v_old, 2) where nota_id = a.nota_id;
      select coalesce(sum(total),0) into v_new from public.sales where nota_id = a.nota_id;
      v_rest := a.novo_total - v_new;
      if v_rest <> 0 then
        select id, qtd into v_last, v_last_qtd from public.sales where nota_id = a.nota_id and qtd = 1 order by id desc limit 1;
        if not found then
          select id, qtd into v_last, v_last_qtd from public.sales where nota_id = a.nota_id order by id desc limit 1;
          if (v_rest * 100) % v_last_qtd <> 0 then
            raise exception 'Nota %: resto de % não divide em centavos pelo item (qtd %)', lpad(a.nota_id::text,6,'0'), v_rest, v_last_qtd; end if;
        end if;
        update public.sales set preco_vendido = preco_vendido + v_rest / v_last_qtd where id = v_last;
      end if;
    end if;
    if exists (select 1 from public.sales where nota_id = a.nota_id and preco_vendido <= 0) then
      raise exception 'Nota %: preço ficaria <= 0', lpad(a.nota_id::text,6,'0'); end if;
    select sum(total) into v_new from public.sales where nota_id = a.nota_id;
    if v_new <> a.novo_total then
      raise exception 'Nota %: total final % ≠ alvo %', lpad(a.nota_id::text,6,'0'), v_new, a.novo_total; end if;
  end loop;
end $$;

select pg_temp.fix_snap('2 DEPOIS');

insert into fix_log
select 99, 'DIA 02/11', '3 DEPOIS', 'sales.data=2026-11-02 (= cards do Relatório)', null,
  null, count(*) || ' vendas (linhas)', sum(qtd), sum(total),
  (select sum(s.total - s.qtd * sc.custo_unit) from public.sales s join public.sale_costs sc on sc.sale_id = s.id where s.data = date '2026-11-02')
from public.sales where data = date '2026-11-02';

commit;

select nota, fase, como_achou, vendedor, pagamento, itens, unidades, total, lucro
from fix_log order by ordem, fase;
