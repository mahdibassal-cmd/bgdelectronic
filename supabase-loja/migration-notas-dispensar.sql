-- =====================================================================
-- migration-notas-dispensar.sql — Loja (bagda-loja). Idempotente. NÃO cancela nada.
-- Rodar DEPOIS de migration-paga-depois-caixa-geral.sql (recria v_notas_lancar com as colunas dela + 3 no fim).
-- 'Não lançar' (dispensar): a nota continua válida (venda, estoque, dívida Paga Depois intactos), só sai da lista
-- de pendentes de 'Notas a lançar'. Desfazer volta para pendente. financas/admin, com log.
-- 'Cancelar nota' continua sendo public.cancelar_nota (só admin) — sem mudança aqui.
-- =====================================================================
alter table public.notas add column if not exists dispensada_em   timestamptz;
alter table public.notas add column if not exists dispensada_por  uuid references public.profiles(id);
alter table public.notas add column if not exists dispensa_motivo text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'notas_dispensa_motivo_chk') then
    alter table public.notas add constraint notas_dispensa_motivo_chk check (dispensa_motivo is null or length(dispensa_motivo) <= 200); end if;
end $$;

-- ---------- Log: 21 tipos existentes + 2 novos ----------
do $$ begin
  if to_regclass('public.security_events') is not null then
    alter table public.security_events drop constraint if exists security_events_kind_check;
    alter table public.security_events add constraint security_events_kind_check check (kind in (
      'failed_login','role_change','admin_added','profile_added','profile_removed','lock','unlock','signout_all',
      'fin_pagamento','fin_recebimento','fin_alteracao',
      'credito_entrada','credito_uso','credito_excedente','nota_lancada',
      'estorno_recebimento','estorno_credito',
      'dep_esp_entrada','dep_esp_ajuste','dep_esp_transferencia',
      'nota_prazo_lancada',
      'nota_dispensada','nota_dispensa_desfeita'));
  end if;
end $$;

create or replace function public.dispensar_nota(p_nota bigint, p_motivo text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare n record;
begin
  if not public.can('financas') then raise exception 'Sem permissão (financeiro/admin)' using errcode = '42501'; end if;
  select * into n from public.notas where id = p_nota for update;
  if not found then raise exception 'Nota não encontrada' using errcode = 'P0001'; end if;
  if n.status <> 'ativa' then raise exception 'Nota cancelada' using errcode = 'P0001'; end if;
  if n.dispensada_em is not null then return jsonb_build_object('nota_id', p_nota, 'mudou', false); end if;
  update public.notas set dispensada_em = now(), dispensada_por = auth.uid(),
         dispensa_motivo = nullif(left(trim(coalesce(p_motivo, '')), 200), '') where id = p_nota;
  perform public.fin_log('nota_dispensada', jsonb_build_object('nota_id', p_nota, 'motivo', nullif(trim(coalesce(p_motivo, '')), '')));
  return jsonb_build_object('nota_id', p_nota, 'mudou', true);
end $$;

create or replace function public.desfazer_dispensa_nota(p_nota bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare n record;
begin
  if not public.can('financas') then raise exception 'Sem permissão (financeiro/admin)' using errcode = '42501'; end if;
  select * into n from public.notas where id = p_nota for update;
  if not found then raise exception 'Nota não encontrada' using errcode = 'P0001'; end if;
  if n.dispensada_em is null then return jsonb_build_object('nota_id', p_nota, 'mudou', false); end if;
  update public.notas set dispensada_em = null, dispensada_por = null, dispensa_motivo = null where id = p_nota;
  perform public.fin_log('nota_dispensa_desfeita', jsonb_build_object('nota_id', p_nota, 'antes', n.dispensada_em, 'motivo_antes', n.dispensa_motivo));
  return jsonb_build_object('nota_id', p_nota, 'mudou', true);
end $$;
revoke all on function public.dispensar_nota(bigint, text), public.desfazer_dispensa_nota(bigint) from public, anon;
grant execute on function public.dispensar_nota(bigint, text), public.desfazer_dispensa_nota(bigint) to authenticated;

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
       n.prazo_lancada_em,
       n.dispensada_em,
       n.dispensa_motivo,
       pd.handle as dispensada_por
from public.notas n left join public.profiles pr on pr.id = n.seller_id
left join public.clientes cl on cl.id = n.cliente_id
left join public.profiles pd on pd.id = n.dispensada_por
where public.can('financas') and n.status = 'ativa';
revoke all on public.v_notas_lancar from anon, public;
grant select on public.v_notas_lancar to authenticated;

-- A view continua listando dispensadas (o app esconde das pendentes e mostra com 'Mostrar também...').
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

select 'notas_dispensar ok' as status;
