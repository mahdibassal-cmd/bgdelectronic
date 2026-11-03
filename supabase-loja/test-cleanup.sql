-- =====================================================================
-- BAGDA STORES (bagda-loja, ref xvsxnicmpkvzzhkkqgam) — LIMPEZA dos dados do test-e2e.sql
-- Rode no SQL Editor (role postgres), arquivo inteiro. Idempotente: sem dados TEST, não faz nada.
-- Apaga SÓ o que é TEST e seus dependentes, em ordem de FK:
--   recebimento_notas -> cliente_recebimentos -> conta_pagamentos -> caixa_movimentos (das notas TEST e dos
--   recebimentos/pagamentos TEST) -> notas TEST (itens/custos/pagamentos em cascata) -> purchases TEST
--   (trigger devolve o estoque) -> contas_pagar TEST -> produto TEST (custo em cascata) -> cliente TEST -> fornecedor TEST.
-- Identificação: SKU 'TEST-E2E'; fornecedor nome 'TEST Fornecedor E2E'; cliente nome 'TEST Cliente E2E';
--   notas = do cliente TEST ou com item TEST-E2E. Nenhum produto real é tocado (as vendas TEST só baixaram o produto TEST).
-- Não apaga o log de segurança (security_events), que é trilha de auditoria.
-- Mostra contagens ANTES (NOTICE) e DEPOIS (SELECT final).
-- =====================================================================
begin;

do $$ begin
  if not (select rolsuper or rolbypassrls from pg_roles where rolname = current_user) then
    raise exception 'Rode como postgres (precisa ignorar RLS). Usuário atual: %', current_user;
  end if;
end $$;

drop table if exists pg_temp.t_cli, pg_temp.t_forn, pg_temp.t_notas, pg_temp.t_rec, pg_temp.t_conta, pg_temp.t_cpag, pg_temp.t_mov, pg_temp.t_cnt;
create temp table t_cli   as select id from public.clientes where nome = 'TEST Cliente E2E';
create temp table t_forn  as select id from public.fornecedores where nome = 'TEST Fornecedor E2E';
create temp table t_notas as select id from public.notas where cliente_id in (select id from t_cli)
                             union select nota_id from public.sales where sku = 'TEST-E2E';
create temp table t_rec   as select id, mov_id from public.cliente_recebimentos where cliente_id in (select id from t_cli);
create temp table t_conta as select id from public.contas_pagar where fornecedor_id in (select id from t_forn);
create temp table t_cpag  as select id, mov_id from public.conta_pagamentos where conta_id in (select id from t_conta);
create temp table t_mov   as select id from public.caixa_movimentos where nota_id in (select id from t_notas)
                             union select mov_id from t_rec where mov_id is not null
                             union select mov_id from t_cpag where mov_id is not null;

create temp table t_cnt (ordem int, tabela text, antes bigint, depois bigint);
insert into t_cnt(ordem, tabela, antes) values
  (1, 'recebimento_notas', (select count(*) from public.recebimento_notas where recebimento_id in (select id from t_rec) or nota_id in (select id from t_notas))),
  (2, 'cliente_recebimentos', (select count(*) from t_rec)),
  (3, 'conta_pagamentos', (select count(*) from t_cpag)),
  (4, 'caixa_movimentos', (select count(*) from t_mov)),
  (5, 'notas', (select count(*) from t_notas)),
  (6, 'sales (itens)', (select count(*) from public.sales where nota_id in (select id from t_notas))),
  (7, 'nota_pagamentos', (select count(*) from public.nota_pagamentos where nota_id in (select id from t_notas))),
  (8, 'purchases', (select count(*) from public.purchases where sku = 'TEST-E2E')),
  (9, 'contas_pagar', (select count(*) from t_conta)),
  (10, 'products (TEST-E2E)', (select count(*) from public.products where sku = 'TEST-E2E')),
  (11, 'clientes', (select count(*) from t_cli)),
  (12, 'fornecedores', (select count(*) from t_forn));

do $$ declare r record; begin
  for r in select * from t_cnt order by ordem loop raise notice 'ANTES  %: %', r.tabela, r.antes; end loop;
  if exists (select 1 from public.sales s where s.nota_id in (select id from t_notas) and s.sku <> 'TEST-E2E') then
    raise exception 'Uma nota TEST tem item de produto real — abortado, nada apagado. Verifique manualmente.';
  end if;
end $$;

delete from public.recebimento_notas where recebimento_id in (select id from t_rec) or nota_id in (select id from t_notas);
delete from public.cliente_recebimentos where id in (select id from t_rec);
delete from public.conta_pagamentos where id in (select id from t_cpag);
delete from public.caixa_movimentos where id in (select id from t_mov);
-- notas TEST: sales/sale_costs/nota_pagamentos caem em cascata. Só o produto TEST foi baixado (apagado abaixo).
delete from public.notas where id in (select id from t_notas);
delete from public.purchases where sku = 'TEST-E2E';           -- trigger purchase_bd devolve (tira) o estoque
delete from public.contas_pagar where id in (select id from t_conta);
delete from public.products where sku = 'TEST-E2E';            -- product_costs em cascata
update public.profiles set cliente_id = null where cliente_id in (select id from t_cli);
delete from public.clientes where id in (select id from t_cli);
delete from public.fornecedores where id in (select id from t_forn);

update t_cnt set depois = case ordem
  when 1 then (select count(*) from public.recebimento_notas where recebimento_id in (select id from t_rec) or nota_id in (select id from t_notas))
  when 2 then (select count(*) from public.cliente_recebimentos where id in (select id from t_rec))
  when 3 then (select count(*) from public.conta_pagamentos where id in (select id from t_cpag))
  when 4 then (select count(*) from public.caixa_movimentos where id in (select id from t_mov))
  when 5 then (select count(*) from public.notas where id in (select id from t_notas))
  when 6 then (select count(*) from public.sales where nota_id in (select id from t_notas))
  when 7 then (select count(*) from public.nota_pagamentos where nota_id in (select id from t_notas))
  when 8 then (select count(*) from public.purchases where sku = 'TEST-E2E')
  when 9 then (select count(*) from public.contas_pagar where id in (select id from t_conta))
  when 10 then (select count(*) from public.products where sku = 'TEST-E2E')
  when 11 then (select count(*) from public.clientes where nome = 'TEST Cliente E2E')
  when 12 then (select count(*) from public.fornecedores where nome = 'TEST Fornecedor E2E') end;

do $$ begin
  if exists (select 1 from t_cnt where depois <> 0) then raise exception 'Limpeza incompleta — desfeito. Veja t_cnt.'; end if;
end $$;

commit;

select tabela, antes, depois from t_cnt order by ordem;
