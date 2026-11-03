-- =====================================================================
-- BAGDA STORES (bagda-loja) — ESTORNO do recebimento PIX R$ 19.025,00 de Willian 11 (nota 000007), 03/11/2026 ~12:48.
-- Pedido do MB: Pamela registrou por PIX em Contas a receber, mas devia sair do crédito da Caixa Geral.
-- O que o recebimento gravou (registrar_recebimento via registrar_recebimento_credito):
--   1) caixa_movimentos 'entrada' R$ 19.025 no caixa PIX ("Recebimento cliente Willian 11")
--   2) cliente_recebimentos (mov_id -> esse movimento)  -> baixa a dívida (cliente_saldo_calc)
--   3) recebimento_notas (trigger) -> nota 000007 R$ 19.025 (cascade ao apagar o recebimento)
--   4) security_events 'fin_recebimento'. Sem excedente (valor = dívida alocada) -> sem cliente_creditos.
-- Estorno: lança 'saida' de R$ 19.025 no mesmo caixa (rastro fica no extrato), apaga o recebimento
--   (a alocação some junto => dívida da nota 000007 volta a ficar em aberto) e registra fin_alteracao.
-- Travas: aborta se não achar EXATAMENTE 1 recebimento, se houver excedente/crédito no mesmo minuto,
--   ou se já foi estornado (idempotente: rodar de novo = "nada a fazer", sem erro).
-- Rodar inteiro no SQL Editor (role postgres). Não desliga RLS nem triggers.
-- =====================================================================
begin;
do $$
declare r record; n int; v_admin uuid; v_saida bigint;
begin
  if exists (select 1 from public.caixa_movimentos where motivo like 'Estorno recebimento #% nota 000007 Willian%') then
    raise notice 'Já estornado — nada a fazer.'; return; end if;
  select count(*) into n
    from public.cliente_recebimentos r join public.clientes c on c.id = r.cliente_id
    join public.caixa_movimentos m on m.id = r.mov_id
   where c.nome ilike 'willian%' and r.valor = 19025.00 and r.forma = 'pix' and m.tipo = 'entrada' and m.valor = 19025.00
     and (r.created_at at time zone 'America/Sao_Paulo')::date = date '2026-11-03'
     and to_char(r.created_at at time zone 'America/Sao_Paulo', 'HH24:MI') between '12:40' and '12:55'
     and exists (select 1 from public.recebimento_notas rn where rn.recebimento_id = r.id and rn.nota_id = 7 and rn.valor = 19025.00)
     and (select count(*) from public.recebimento_notas rn where rn.recebimento_id = r.id) = 1;
  if n <> 1 then raise exception 'Esperava 1 recebimento, achei % — nada gravado', n; end if;
  select r.*, c.nome cli, m.caixa_id mcx into r
    from public.cliente_recebimentos r join public.clientes c on c.id = r.cliente_id
    join public.caixa_movimentos m on m.id = r.mov_id
   where c.nome ilike 'willian%' and r.valor = 19025.00 and r.forma = 'pix' and m.tipo = 'entrada' and m.valor = 19025.00
     and (r.created_at at time zone 'America/Sao_Paulo')::date = date '2026-11-03'
     and to_char(r.created_at at time zone 'America/Sao_Paulo', 'HH24:MI') between '12:40' and '12:55'
     and exists (select 1 from public.recebimento_notas rn where rn.recebimento_id = r.id and rn.nota_id = 7);
  if exists (select 1 from public.cliente_creditos k where k.cliente_id = r.cliente_id and k.tipo = 'entrada'
              and k.created_at between r.created_at - interval '1 minute' and r.created_at + interval '1 minute') then
    raise exception 'Há crédito (excedente) gravado junto — revisar manualmente, nada gravado'; end if;
  select id into v_admin from public.profiles where role = 'admin' order by created_at limit 1;
  insert into public.caixa_movimentos(caixa_id, tipo, valor, motivo, user_id, forma)
  values (r.mcx, 'saida', r.valor, left('Estorno recebimento #' || r.id || ' nota 000007 ' || r.cli || ' (lançado por engano no PIX; pago com crédito Caixa Geral)', 300),
          coalesce(v_admin, r.user_id), 'pix') returning id into v_saida;
  delete from public.cliente_recebimentos where id = r.id;   -- recebimento_notas sai por cascade
  get diagnostics n = row_count; if n <> 1 then raise exception 'Delete não atingiu 1 linha'; end if;
  insert into public.security_events(kind, actor, detail) values ('fin_alteracao', v_admin,
    jsonb_build_object('acao', 'estorno_recebimento', 'recebimento_id', r.id, 'mov_entrada', r.mov_id, 'mov_saida', v_saida,
                       'cliente_id', r.cliente_id, 'nota', '000007', 'valor', r.valor, 'pedido', 'MB 03/11/2026'));
  raise notice 'Estornado: recebimento % / saída % no caixa %', r.id, v_saida, r.mcx;
end $$;
commit;
-- Conferência: dívida do Willian volta a incluir a nota 000007
select c.id, c.nome, public.cliente_saldo_calc(c.id) divida, public.cliente_credito_saldo(c.id) credito
  from public.clientes c where c.nome ilike 'willian%';
