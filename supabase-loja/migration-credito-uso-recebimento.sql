-- =====================================================================
-- migration-credito-uso-recebimento.sql — Loja (bagda-loja). Idempotente.
-- Rodar DEPOIS de migration-estornos.sql e migration-receber-credito.sql.
-- Raw: https://raw.githubusercontent.com/mahdibassal-cmd/bgdelectronic/main/supabase-loja/migration-credito-uso-recebimento.sql
--
-- Caixa Geral → "Uso (baixar crédito)" (lancar_credito tipo 'uso', sem nota) para cliente com dívida
-- Paga Depois: agora grava AUTOMATICAMENTE um cliente_recebimentos forma 'credito' (sem caixa, sem
-- movimento de dinheiro) no valor de min(uso, dívida). O trigger existente aloca nas notas (mais antiga
-- primeiro) => Pagou / dívida atualizam. A linha de uso fica ligada (recebimento_id), então:
--   * estornar_recebimento (Contas a receber) devolve o crédito usando ESSA linha (não duplica);
--   * estornar_credito recusa o uso ligado ("estorne em Contas a receber"), como já fazia.
-- Entrada de crédito (tipo 'entrada') NÃO paga dívida sozinha (sem mudança).
-- Sem novos tipos de log (usa 'credito_uso' e 'fin_recebimento').
-- =====================================================================
create or replace function public.lancar_credito(p_cliente bigint, p_tipo text, p_valor numeric, p_obs text default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint; v_saldo numeric; v_div numeric; v_rec bigint; v_pg numeric;
begin
  if not public.can('financas') then raise exception 'Sem permissão' using errcode = '42501'; end if;
  if p_tipo not in ('entrada','uso') then raise exception 'Tipo inválido' using errcode = 'P0001'; end if;
  if p_valor is null or p_valor <= 0 then raise exception 'Informe um valor maior que zero' using errcode = 'P0001'; end if;
  perform 1 from public.clientes where id = p_cliente for update;   -- trava o cliente (evita uso duplo simultâneo)
  if not found then raise exception 'Cliente não encontrado' using errcode = 'P0001'; end if;
  if p_tipo = 'uso' then
    v_saldo := public._credito_saldo(p_cliente);
    if round(p_valor, 2) > round(v_saldo, 2) then
      raise exception 'Valor maior que o crédito do cliente (R$ %)', replace(to_char(v_saldo, 'FM999999990.00'), '.', ',') using errcode = 'P0001'; end if;
  end if;
  insert into public.cliente_creditos(cliente_id, tipo, valor, obs)
  values (p_cliente, p_tipo, round(p_valor, 2), nullif(left(trim(coalesce(p_obs,'')), 300), '')) returning id into v_id;
  perform public.fin_log('credito_' || p_tipo, jsonb_build_object('cliente_id', p_cliente, 'valor', p_valor));
  if p_tipo = 'uso' then
    v_div := round(public.cliente_saldo_calc(p_cliente), 2);
    v_pg := least(round(p_valor, 2), v_div);
    if v_pg > 0 then
      insert into public.cliente_recebimentos(cliente_id, valor, data, forma, caixa_id, obs, mov_id, user_id)
      values (p_cliente, v_pg, (now() at time zone 'America/Sao_Paulo')::date, 'credito', null,
              left('Uso Caixa Geral (crédito #' || v_id || ')' || coalesce(' — ' || nullif(trim(coalesce(p_obs, '')), ''), ''), 300), null, auth.uid())
      returning id into v_rec;
      update public.cliente_creditos set recebimento_id = v_rec where id = v_id;
      perform public.fin_log('fin_recebimento', jsonb_build_object('cliente_id', p_cliente, 'valor', v_pg, 'recebimento_id', v_rec, 'credito_id', v_id, 'via', 'uso_caixa_geral'));
    end if;
  end if;
  return v_id;
end $$;
revoke all on function public.lancar_credito(bigint, text, numeric, text) from public, anon;
grant execute on function public.lancar_credito(bigint, text, numeric, text) to authenticated;

select 'credito_uso_recebimento ok' as status;
