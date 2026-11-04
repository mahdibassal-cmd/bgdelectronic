-- =====================================================================
-- correcao-credito-uso-recebimentos.sql — Loja (bagda-loja). Rodar no SQL Editor (role postgres).
-- Pode rodar mais de uma vez: só pega usos ainda SEM recebimento ligado.
-- Caso principal: Willian 11 — uso de crédito R$ 19.025 em 03/11/2026 ~13:11 (Caixa Geral) que não baixou a dívida.
--
-- Candidato = cliente_creditos tipo 'uso', sem nota_id, sem recebimento_id, não é estorno e não foi estornado,
--   não é o uso gravado por "Pagar com crédito" (obs 'Pagamento Contas a receber%'), e o cliente tem dívida.
-- Para cada candidato (mais antigo primeiro, por cliente): grava cliente_recebimentos forma 'credito'
--   no valor min(uso, dívida restante), data = data do uso, e liga cliente_creditos.recebimento_id.
--   NÃO cria crédito nem mexe no saldo de crédito (o uso já foi descontado) => não conta duas vezes.
--   Linha id 5 (entrada manual de Willian) nunca é tocada (só tipo 'uso' entra).
-- PASSO 1: rode só o PREVIEW (SELECT abaixo) e confira. PASSO 2: rode o arquivo inteiro.
-- =====================================================================

-- PREVIEW (somente leitura)
select k.id credito_id, c.id cliente_id, c.nome, k.valor uso, k.obs,
       to_char(k.created_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') quando,
       round(public.cliente_saldo_calc(c.id), 2) divida_hoje,
       least(k.valor, greatest(round(public.cliente_saldo_calc(c.id), 2), 0)) recebimento_a_criar
from public.cliente_creditos k join public.clientes c on c.id = k.cliente_id
where k.tipo = 'uso' and k.nota_id is null and k.recebimento_id is null and k.estorno_de is null
  and not exists (select 1 from public.cliente_creditos e where e.estorno_de = k.id)
  and coalesce(k.obs, '') not like 'Pagamento Contas a receber%'
  and k.id <> 5
  and public.cliente_saldo_calc(c.id) > 0
order by k.created_at, k.id;

begin;
do $$
declare k record; v_div numeric; v_pg numeric; v_rec bigint; v_n int := 0;
begin
  for k in
    select k.* from public.cliente_creditos k
    where k.tipo = 'uso' and k.nota_id is null and k.recebimento_id is null and k.estorno_de is null
      and not exists (select 1 from public.cliente_creditos e where e.estorno_de = k.id)
      and coalesce(k.obs, '') not like 'Pagamento Contas a receber%'
      and k.id <> 5
    order by k.created_at, k.id
  loop
    perform 1 from public.clientes where id = k.cliente_id for update;
    v_div := round(public.cliente_saldo_calc(k.cliente_id), 2);
    v_pg := least(k.valor, v_div);
    continue when v_pg is null or v_pg <= 0;
    insert into public.cliente_recebimentos(cliente_id, valor, data, forma, caixa_id, obs, mov_id, user_id, created_at)
    values (k.cliente_id, v_pg, (k.created_at at time zone 'America/Sao_Paulo')::date, 'credito', null,
            left('Correção: uso Caixa Geral (crédito #' || k.id || ')', 300), null, k.created_by, k.created_at)
    returning id into v_rec;
    update public.cliente_creditos set recebimento_id = v_rec where id = k.id;
    insert into public.security_events(kind, actor, detail) values ('fin_recebimento', k.created_by,
      jsonb_build_object('cliente_id', k.cliente_id, 'valor', v_pg, 'recebimento_id', v_rec, 'credito_id', k.id, 'via', 'correcao-credito-uso'));
    v_n := v_n + 1;
  end loop;
  raise notice 'Recebimentos criados: %', v_n;
end $$;

-- Conferência
select r.id recebimento_id, c.nome, r.valor, r.data, r.obs,
       (select string_agg(lpad(rn.nota_id::text, 6, '0') || ' R$ ' || rn.valor, ', ') from public.recebimento_notas rn where rn.recebimento_id = r.id) notas,
       round(public.cliente_saldo_calc(c.id), 2) divida_agora
from public.cliente_recebimentos r join public.clientes c on c.id = r.cliente_id
where r.obs like 'Correção: uso Caixa Geral%' order by r.id;
commit;
