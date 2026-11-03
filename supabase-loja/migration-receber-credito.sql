-- BAGDA STORES (bagda-loja) — Contas a receber: "Pagar com crédito (Caixa Geral)". Idempotente.
-- Rodar DEPOIS de migration-caixa-geral.sql e fix-security-events-kinds.sql.
-- Quita notas Paga Depois usando o saldo de crédito do cliente: grava cliente_recebimentos forma 'credito',
-- SEM caixa e SEM movimento de dinheiro (alocação nas notas pelo trigger existente) + cliente_creditos 'uso'.
-- Bloqueia valor acima da dívida ou acima do crédito. Atômico (tudo ou nada).
alter table public.cliente_recebimentos alter column caixa_id drop not null;
alter table public.cliente_recebimentos drop constraint if exists cliente_recebimentos_forma_check;
alter table public.cliente_recebimentos add constraint cliente_recebimentos_forma_check
  check (forma in ('dinheiro','pix','cartao','transferencia','credito'));
alter table public.cliente_recebimentos drop constraint if exists cli_rec_caixa_ou_credito;
alter table public.cliente_recebimentos add constraint cli_rec_caixa_ou_credito
  check ((forma = 'credito' and caixa_id is null and mov_id is null) or (forma <> 'credito' and caixa_id is not null));

create or replace view public.v_recebimentos with (security_invoker = true) as
select r.id, r.cliente_id, c.nome as cliente, r.valor, r.data, r.forma, r.caixa_id,
       coalesce(cx.nome, 'Caixa Geral (crédito)') as caixa, r.obs, pr.handle, r.created_at
from public.cliente_recebimentos r join public.clientes c on c.id = r.cliente_id left join public.caixas cx on cx.id = r.caixa_id
left join public.profiles pr on pr.id = r.user_id where public.can('financas');
revoke all on public.v_recebimentos from anon, public;
grant select on public.v_recebimentos to authenticated;

create or replace function public.registrar_recebimento_com_credito(p_cliente bigint, p_valor numeric,
  p_data date default null, p_obs text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_nome text; v_div numeric; v_cred numeric; v_val numeric := round(coalesce(p_valor, 0), 2); v_rec bigint; v_notas text;
begin
  if not public.can('financas') then raise exception 'Sem permissão (financeiro/admin)' using errcode = '42501'; end if;
  if v_val <= 0 then raise exception 'Valor inválido' using errcode = 'P0001'; end if;
  select nome into v_nome from public.clientes where id = p_cliente for update;
  if v_nome is null then raise exception 'Cliente não encontrado' using errcode = 'P0001'; end if;
  v_div := round(public.cliente_saldo_calc(p_cliente), 2);
  v_cred := round(public._credito_saldo(p_cliente), 2);
  if v_val > v_div then raise exception 'Valor maior que a dívida do cliente (R$ %)', replace(to_char(v_div, 'FM999999990.00'), '.', ',') using errcode = 'P0001'; end if;
  if v_val > v_cred then raise exception 'Crédito insuficiente na Caixa Geral (saldo R$ %)', replace(to_char(v_cred, 'FM999999990.00'), '.', ',') using errcode = 'P0001'; end if;
  insert into public.cliente_recebimentos(cliente_id, valor, data, forma, caixa_id, obs, mov_id, user_id)
  values (p_cliente, v_val, coalesce(p_data, (now() at time zone 'America/Sao_Paulo')::date), 'credito', null,
          nullif(left(trim(coalesce(p_obs, '')), 300), ''), null, auth.uid()) returning id into v_rec;
  select string_agg(lpad(nota_id::text, 6, '0'), ', ' order by nota_id) into v_notas from public.recebimento_notas where recebimento_id = v_rec;
  insert into public.cliente_creditos(cliente_id, tipo, valor, obs)
  values (p_cliente, 'uso', v_val, left('Pagamento Contas a receber' || coalesce(' — nota ' || v_notas, '') || ' (receb. #' || v_rec || ')', 300));
  perform public.fin_log('credito_uso', jsonb_build_object('cliente_id', p_cliente, 'valor', v_val, 'recebimento_id', v_rec, 'notas', v_notas));
  return jsonb_build_object('recebimento_id', v_rec, 'valor', v_val, 'notas', v_notas, 'credito_restante', v_cred - v_val);
end $$;
revoke all on function public.registrar_recebimento_com_credito(bigint, numeric, date, text) from public, anon;
grant execute on function public.registrar_recebimento_com_credito(bigint, numeric, date, text) to authenticated;
