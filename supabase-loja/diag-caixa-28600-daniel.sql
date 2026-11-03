-- diag-caixa-28600-daniel.sql — SOMENTE LEITURA (Loja). Acha o movimento de R$ 28.600 de 03/11/2026
-- (Entrada · DANIEL IPHONE DUO · PAMELA · Cartão · Máquina Loja) e a nota ligada, se houver.
-- 1) Movimentos candidatos
select m.id as mov_id, m.data, to_char(m.created_at at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI') as hora_sp,
       c.nome as caixa, m.tipo, m.valor, m.forma, m.motivo, m.nota_id, pr.handle as usuario,
       r.id as recebimento_id, cl.nome as cliente_receb, p.id as conta_pag_id
from public.caixa_movimentos m
join public.caixas c on c.id = m.caixa_id
left join public.profiles pr on pr.id = m.user_id
left join public.cliente_recebimentos r on r.mov_id = m.id
left join public.clientes cl on cl.id = r.cliente_id
left join public.conta_pagamentos p on p.mov_id = m.id
where m.data between date '2026-11-02' and date '2026-11-04'
  and (m.valor = 28600 or m.motivo ilike '%daniel%' or cl.nome ilike '%daniel%')
order by m.created_at;
-- 2) Notas de 03/11 com 28.600 ou cliente DANIEL
select n.id as nota_id, lpad(n.id::text, 6, '0') as nota, n.status, n.total, n.cliente, n.cliente_id, n.local_pagamento,
       n.caixa_lancada_id, n.lancada_em, pr.handle as vendedor,
       (select string_agg(g.metodo::text || ':' || g.valor, '+' order by g.id) from public.nota_pagamentos g where g.nota_id = n.id) as pagamentos,
       (select string_agg(s.sku || ' x' || s.qtd, ', ') from public.sales s where s.nota_id = n.id) as itens
from public.notas n left join public.profiles pr on pr.id = n.seller_id
where n.data between date '2026-11-02' and date '2026-11-04' and (n.total = 28600 or n.cliente ilike '%daniel%')
order by n.id;
-- 3) Recebimentos de 28.600 / DANIEL
select r.id, r.data, r.valor, r.forma, r.caixa_id, r.mov_id, cl.nome
from public.cliente_recebimentos r join public.clientes cl on cl.id = r.cliente_id
where r.data between date '2026-11-02' and date '2026-11-04' and (r.valor = 28600 or cl.nome ilike '%daniel%');
