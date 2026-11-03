-- =====================================================================
-- migration-paga-depois-caixa-geral.sql — Loja (bagda-loja). Idempotente.
-- Pré-requisitos (já rodados): schema.sql, security.sql, migration-clientes.sql, migration-caixa-resumo.sql,
--   migration-caixa-geral.sql, fix-security-events-kinds.sql, migration-receber-credito.sql, migration-estornos.sql,
--   migration-deposito-especial.sql, migration-financeiro-notas-lancar.sql.
-- Independente de migration-local-pagamento-opcional.sql (1ff75cd), mas sem ela o vendedor ainda não consegue
--   salvar nota só Paga Depois sem Local — rode as duas.
--
-- Modelo: a parte 'prazo' (Paga Depois) de uma nota JÁ É dívida do cliente cadastrado (cliente_saldo_calc /
-- v_clientes_saldo somam nota_pagamentos.metodo='prazo' de notas ativas). Portanto "lançar na Caixa Geral"
-- NÃO cria dívida nova (evita contar em dobro) e NÃO movimenta caixa: o financeiro confirma/registra que a parte
-- Paga Depois foi para o débito do cliente na Caixa Geral (quem, quando, log). Pagamentos posteriores seguem
-- em Contas a receber (registrar_recebimento_credito / registrar_recebimento_com_credito): abatem a dívida e o
-- excedente vira crédito na Caixa Geral.
-- =====================================================================

alter table public.notas add column if not exists prazo_lancada_em  timestamptz;
alter table public.notas add column if not exists prazo_lancada_por uuid references public.profiles(id);

-- ---------- Log: 20 tipos existentes + 1 novo ----------
do $$ begin
  if to_regclass('public.security_events') is not null then
    alter table public.security_events drop constraint if exists security_events_kind_check;
    alter table public.security_events add constraint security_events_kind_check check (kind in (
      'failed_login','role_change','admin_added','profile_added','profile_removed','lock','unlock','signout_all',
      'fin_pagamento','fin_recebimento','fin_alteracao',
      'credito_entrada','credito_uso','credito_excedente','nota_lancada',
      'estorno_recebimento','estorno_credito',
      'dep_esp_entrada','dep_esp_ajuste','dep_esp_transferencia',
      'nota_prazo_lancada'));
  end if;
end $$;

-- ---------- RPC: lançar a parte Paga Depois no débito do cliente (Caixa Geral) ----------
create or replace function public.lancar_nota_caixa_geral(p_nota bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare n record; v_prazo numeric; v_nome text;
begin
  if not public.can('financas') then raise exception 'Sem permissão (financeiro/admin)' using errcode = '42501'; end if;
  select * into n from public.notas where id = p_nota for update;
  if not found then raise exception 'Nota não encontrada' using errcode = 'P0001'; end if;
  if n.status <> 'ativa' then raise exception 'Nota cancelada não pode ser lançada' using errcode = 'P0001'; end if;
  if n.cliente_id is null then raise exception 'Nota sem cliente cadastrado — não dá para lançar como débito' using errcode = 'P0001'; end if;
  select coalesce(sum(valor), 0) into v_prazo from public.nota_pagamentos where nota_id = p_nota and metodo::text = 'prazo';
  if v_prazo <= 0 then raise exception 'Nota sem parte Paga Depois' using errcode = 'P0001'; end if;
  select nome into v_nome from public.clientes where id = n.cliente_id;
  if n.prazo_lancada_em is not null then
    return jsonb_build_object('nota_id', p_nota, 'cliente_id', n.cliente_id, 'valor', v_prazo, 'mudou', false); end if;
  update public.notas set prazo_lancada_em = now(), prazo_lancada_por = auth.uid() where id = p_nota;
  perform public.fin_log('nota_prazo_lancada', jsonb_build_object('nota_id', p_nota, 'cliente_id', n.cliente_id, 'valor', v_prazo,
    'divida_cliente', public.cliente_saldo_calc(n.cliente_id)));
  return jsonb_build_object('nota_id', p_nota, 'cliente_id', n.cliente_id, 'cliente', v_nome, 'valor', v_prazo, 'mudou', true,
    'divida_cliente', public.cliente_saldo_calc(n.cliente_id));
end $$;
revoke all on function public.lancar_nota_caixa_geral(bigint) from public, anon;
grant execute on function public.lancar_nota_caixa_geral(bigint) to authenticated;

-- ---------- v_notas_lancar: mesmas colunas, na mesma ordem, + 4 no fim ----------
create or replace view public.v_notas_lancar with (security_invoker = true) as
select n.id as nota_id, n.data, n.created_at, n.cliente, n.local_pagamento, n.obs_pagamento, pr.handle, n.total,
       (select coalesce(sum(valor), 0) from public.nota_pagamentos g where g.nota_id = n.id and g.metodo::text not in ('prazo','credito')) as valor_caixa,
       (select string_agg(g.metodo::text || ':' || g.valor, '+' order by g.id) from public.nota_pagamentos g where g.nota_id = n.id) as pagamentos,
       n.caixa_lancada_id, n.lancada_em,
       exists (select 1 from public.caixa_movimentos m where m.nota_id = n.id) as tem_movimento,
       (select string_agg(x.nome, ', ') from (select c.nome from public.caixa_movimentos m join public.caixas c on c.id = m.caixa_id
         where m.nota_id = n.id group by c.nome having sum(case when m.tipo = 'venda' then m.valor when m.tipo = 'estorno' then -m.valor else 0 end) > 0) x) as caixas_mov,
       n.cliente_id,
       cl.nome as cliente_nome,
       (select coalesce(sum(valor), 0) from public.nota_pagamentos g where g.nota_id = n.id and g.metodo::text = 'prazo') as valor_prazo,
       n.prazo_lancada_em
from public.notas n left join public.profiles pr on pr.id = n.seller_id
left join public.clientes cl on cl.id = n.cliente_id
where public.can('financas') and n.status = 'ativa';
revoke all on public.v_notas_lancar from anon, public;
grant select on public.v_notas_lancar to authenticated;

-- notas_lancar_financas (d46bad8) devolve setof v_notas_lancar: recriada igual para pegar o novo tipo de linha.
create or replace function public.notas_lancar_financas(p_limit int default 300)
returns setof public.v_notas_lancar
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.can('financas') then
    raise exception 'Sem permissão (financeiro/admin)' using errcode = '42501';
  end if;
  return query select v.* from public.v_notas_lancar v
    order by v.created_at desc limit least(greatest(coalesce(p_limit, 300), 1), 1000);
end $$;
revoke all on function public.notas_lancar_financas(int) from public, anon;
grant execute on function public.notas_lancar_financas(int) to authenticated;

select 'paga_depois_caixa_geral ok' as status;
