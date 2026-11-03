-- diag-nota-000021.sql — Loja (bagda-loja). SOMENTE LEITURA (só SELECT). Não grava nada.
-- Objetivo: nota 000021 (03/11 14:49, @bianca) aparece com CLIENTE '—' e PAGAMENTO 'PIX R$ 25.155,00'; MB diz Paga Depois p/ Eduardo Corajoso.
-- 1) A nota
select n.id, n.created_at at time zone 'America/Sao_Paulo' as criada_brt, n.status, n.total, n.cliente, n.cliente_id,
       n.local_pagamento, n.obs_pagamento, n.caixa_lancada_id, n.lancada_em, pr.handle
  from public.notas n left join public.profiles pr on pr.id = n.seller_id where n.id = 21;
-- 2) Formas gravadas
select id, nota_id, metodo::text, valor from public.nota_pagamentos where nota_id = 21 order by id;
-- 3) Itens
select s.sku, s.qtd, s.preco_vendido from public.sales s where s.nota_id = 21;
-- 4) Movimentos de caixa ligados (já lançada?)
select id, caixa_id, tipo, valor, forma, motivo, created_at at time zone 'America/Sao_Paulo' as brt from public.caixa_movimentos where nota_id = 21 order by id;
-- 5) Cliente Eduardo Corajoso (cadastro, dívida, crédito)
select c.id, c.nome, c.ativo, public._credito_saldo(c.id) as credito, public.cliente_saldo_calc(c.id) as divida
  from public.clientes c where c.nome ilike '%corajoso%' or c.nome ilike '%eduardo%';
-- 6) Notas vizinhas da @bianca no mesmo período (tentativas anteriores / nota refeita?)
select n.id, n.created_at at time zone 'America/Sao_Paulo' as brt, n.status, n.total, n.cliente, n.cliente_id, n.local_pagamento,
       (select string_agg(g.metodo::text || ':' || g.valor, '+' order by g.id) from public.nota_pagamentos g where g.nota_id = n.id) as pags
  from public.notas n where n.created_at >= timestamptz '2026-11-03 14:00-03' and n.created_at < timestamptz '2026-11-03 16:00-03' order by n.id;
-- 7) Log de segurança em volta (14:20–15:20 BRT)
select id, kind, actor, detail, created_at at time zone 'America/Sao_Paulo' as brt from public.security_events
 where created_at between timestamptz '2026-11-03 14:20-03' and timestamptz '2026-11-03 15:20-03' order by id;
-- 8) Versão da criar_nota_local em produção (aceita Local NULL? = 1ff75cd já rodou?)
select position('p_local is null or p_local not in' in pg_get_functiondef('public.criar_nota_local(jsonb,jsonb,text,bigint,text,text)'::regprocedure)) > 0
       as local_obrigatorio_versao_antiga;
