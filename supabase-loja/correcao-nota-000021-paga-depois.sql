-- correcao-nota-000021-paga-depois.sql — Loja (bagda-loja). UMA transação, presa à nota 000021. Grava SÓ se o estado for o esperado.
-- MB confirmou: @bianca lançou PIX por engano; é Paga Depois para o cliente cadastrado Eduardo Corajoso.
-- Faz o mesmo que uma nota Paga Depois salva normalmente: 1 linha nota_pagamentos metodo 'prazo' 25155.00 + notas.cliente_id.
-- A dívida em Contas a receber vem sozinha (cliente_saldo_calc / v_clientes_saldo somam 'prazo' de notas ativas) — nada é
-- inserido em cliente_recebimentos/cliente_creditos (sem contar em dobro). valor_caixa vira 0 -> sai da lista de caixa pendente;
-- se migration-paga-depois-caixa-geral.sql já rodou, aparece como "Paga Depois p/ Caixa Geral" pendente (prazo_lancada_em fica NULL).
-- Alternativa equivalente: cancelar no app (Cancelar nota) e refazer como Paga Depois — gera nota nova com outro número.
begin;
do $$
declare n record; v_cli bigint; v_nome text; v_qtd int; v_pags int; v_pix int;
begin
  select * into n from public.notas where id = 21 for update;
  if not found then raise exception 'ABORTADO: nota 000021 não existe'; end if;
  if n.status <> 'ativa' then raise exception 'ABORTADO: nota 000021 está %', n.status; end if;
  if round(n.total, 2) <> 25155.00 then raise exception 'ABORTADO: total da nota 000021 é % (esperado 25155.00)', n.total; end if;
  if n.data <> date '2026-11-03' then raise exception 'ABORTADO: data da nota 000021 é % (esperado 2026-11-03)', n.data; end if;
  if n.caixa_lancada_id is not null or exists (select 1 from public.caixa_movimentos where nota_id = 21) then
    raise exception 'ABORTADO: nota 000021 JÁ FOI LANÇADA em caixa (caixa %). Cancele no app (Cancelar nota) e refaça como Paga Depois.', n.caixa_lancada_id; end if;
  if exists (select 1 from public.recebimento_notas where nota_id = 21) then raise exception 'ABORTADO: nota 000021 tem recebimento alocado'; end if;
  select count(*), count(*) filter (where metodo::text = 'pix' and valor = 25155.00) into v_pags, v_pix from public.nota_pagamentos where nota_id = 21;
  if v_pags <> 1 or v_pix <> 1 then raise exception 'ABORTADO: esperado exatamente 1 pagamento PIX 25155.00 (achou % linhas, % PIX 25155)', v_pags, v_pix; end if;
  select count(*) into v_qtd from public.clientes where ativo and nome ilike '%eduardo%corajoso%';
  if v_qtd <> 1 then raise exception 'ABORTADO: % clientes ativos batem com "Eduardo Corajoso" (esperado 1)', v_qtd; end if;
  select id, nome into v_cli, v_nome from public.clientes where ativo and nome ilike '%eduardo%corajoso%';
  if n.cliente_id is not null and n.cliente_id <> v_cli then raise exception 'ABORTADO: nota 000021 já ligada a outro cliente (id %)', n.cliente_id; end if;

  update public.nota_pagamentos set metodo = 'prazo' where nota_id = 21 and metodo::text = 'pix' and valor = 25155.00;
  update public.notas set cliente_id = v_cli, cliente = v_nome, local_pagamento = null where id = 21;
  perform public.fin_log('fin_alteracao', jsonb_build_object('tabela', 'nota_pagamentos', 'op', 'CORRECAO', 'nota_id', 21,
    'antes', 'pix:25155.00', 'depois', 'prazo:25155.00', 'cliente_id', v_cli, 'local_antes', n.local_pagamento,
    'motivo', 'Vendedor lançou PIX por engano; MB confirmou Paga Depois (03/11/2026)'));
  raise notice 'OK: nota 000021 -> Paga Depois R$ 25.155,00, cliente % (id %)', v_nome, v_cli;
end $$;
commit;

select n.id, n.status, n.total, n.cliente, n.cliente_id, n.local_pagamento, n.caixa_lancada_id from public.notas n where n.id = 21;
select id, metodo::text, valor from public.nota_pagamentos where nota_id = 21;
select c.id, c.nome, public.cliente_saldo_calc(c.id) as divida, public._credito_saldo(c.id) as credito
  from public.clientes c where c.ativo and c.nome ilike '%eduardo%corajoso%';
