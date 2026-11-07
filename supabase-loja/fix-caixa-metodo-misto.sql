-- =====================================================================
-- fix-caixa-metodo-misto.sql — Loja xvsxnicmpkvzzhkkqgam.
-- NÃO executar sem autorização. Não grava recebimento nem muda caixas.
--
-- LARANJIHA (id 10) e GETNET (id 11) estão ativos com metodo NULL.
-- O recebimento comum lia só o metodo e, sendo NULL, dizia "Caixa inválido"
-- antes de qualquer insert, mesmo com p_forma = pix.
-- Aqui o caixa inválido é só id ausente ou inativo. A forma explícita
-- (dinheiro, pix, cartao, transferencia) vale quando o metodo do caixa é
-- nulo. Não grava metodo na linha do caixa: esses caixas recebem mais de
-- uma forma. Caixa Especial continua outro RPC, só admin.
-- Estes dois RPCs continuam sem chave de idempotência. Uma segunda chamada
-- bem-sucedida grava de novo. Não repetir o recebimento de 7 nov 2026
-- daqui.
-- =====================================================================

do $$ begin
  if to_regprocedure('public.registrar_recebimento(bigint, numeric, smallint, text, date, text)') is null
     or to_regprocedure('public.registrar_recebimento_credito(bigint, numeric, smallint, text, date, text)') is null then
    raise exception 'Parar: falta o recebimento comum.';
  end if;
end $$;

create or replace function public.registrar_recebimento(p_cliente bigint, p_valor numeric, p_caixa smallint,
  p_forma text default null, p_data date default null, p_obs text default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint; v_mov bigint; v_nome text; v_saldo numeric; v_cx smallint; v_met text; v_forma text;
begin
  if not public.can('financas') then raise exception 'Sem permissão (financeiro/admin)' using errcode = '42501'; end if;
  if coalesce(p_valor, 0) <= 0 then raise exception 'Valor inválido' using errcode = 'P0001'; end if;
  select nome into v_nome from public.clientes where id = p_cliente for update;
  if v_nome is null then raise exception 'Cliente não encontrado' using errcode = 'P0001'; end if;
  select id, metodo::text into v_cx, v_met from public.caixas where id = p_caixa and ativo;
  if v_cx is null then raise exception 'Caixa inválido' using errcode = 'P0001'; end if;
  v_forma := coalesce(nullif(trim(p_forma), ''), nullif(v_met, ''));
  if v_forma is null or v_forma not in ('dinheiro','pix','cartao','transferencia') then
    raise exception 'Forma de pagamento inválida' using errcode = 'P0001';
  end if;
  v_saldo := public.cliente_saldo_calc(p_cliente);
  if round(p_valor, 2) > round(v_saldo, 2) then
    raise exception 'Valor (%) maior que o saldo do cliente (%)', round(p_valor, 2), round(v_saldo, 2) using errcode = 'P0001'; end if;
  insert into public.caixa_movimentos(caixa_id, tipo, valor, motivo, user_id, forma)
  values (p_caixa, 'entrada', round(p_valor, 2), left('Recebimento cliente ' || v_nome, 300), auth.uid(), v_forma)
  returning id into v_mov;
  insert into public.cliente_recebimentos(cliente_id, valor, data, forma, caixa_id, obs, mov_id, user_id)
  values (p_cliente, round(p_valor, 2), coalesce(p_data, (now() at time zone 'America/Sao_Paulo')::date), v_forma, p_caixa,
          nullif(trim(p_obs), ''), v_mov, auth.uid()) returning id into v_id;
  perform public.fin_log('fin_recebimento', jsonb_build_object('cliente_id', p_cliente, 'valor', p_valor, 'caixa', p_caixa));
  return v_id;
end $$;

create or replace function public.registrar_recebimento_credito(p_cliente bigint, p_valor numeric, p_caixa smallint,
  p_forma text default null, p_data date default null, p_obs text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_nome text; v_saldo numeric; v_rec bigint; v_exc numeric := 0; v_nota bigint; v_cx smallint; v_met text; v_forma text; v_cred bigint;
begin
  if not public.can('financas') then raise exception 'Sem permissão (financeiro/admin)' using errcode = '42501'; end if;
  if coalesce(p_valor, 0) <= 0 then raise exception 'Valor inválido' using errcode = 'P0001'; end if;
  select nome into v_nome from public.clientes where id = p_cliente for update;
  if v_nome is null then raise exception 'Cliente não encontrado' using errcode = 'P0001'; end if;
  select id, metodo::text into v_cx, v_met from public.caixas where id = p_caixa and ativo;
  if v_cx is null then raise exception 'Caixa inválido' using errcode = 'P0001'; end if;
  v_forma := coalesce(nullif(trim(p_forma), ''), nullif(v_met, ''));
  if v_forma is null or v_forma not in ('dinheiro','pix','cartao','transferencia') then
    raise exception 'Forma de pagamento inválida' using errcode = 'P0001';
  end if;
  v_saldo := greatest(round(public.cliente_saldo_calc(p_cliente), 2), 0);
  if round(p_valor, 2) <= v_saldo then
    v_rec := public.registrar_recebimento(p_cliente, round(p_valor, 2), p_caixa, v_forma, p_data, p_obs);
    return jsonb_build_object('recebimento_id', v_rec, 'quitado', round(p_valor, 2), 'credito', 0);
  end if;
  v_exc := round(p_valor, 2) - v_saldo;
  if v_saldo > 0 then
    v_rec := public.registrar_recebimento(p_cliente, v_saldo, p_caixa, v_forma, p_data, p_obs);
    select max(nota_id) into v_nota from public.recebimento_notas where recebimento_id = v_rec;
  end if;
  insert into public.caixa_movimentos(caixa_id, tipo, valor, motivo, user_id, forma)
  values (p_caixa, 'entrada', v_exc, left('Crédito Caixa Geral (excedente) ' || v_nome, 300), auth.uid(), v_forma);
  insert into public.cliente_creditos(cliente_id, tipo, valor, obs)
  values (p_cliente, 'entrada', v_exc, case when v_nota is not null then 'Excedente pagamento nota ' || lpad(v_nota::text, 6, '0')
                                           else 'Excedente pagamento (sem dívida em aberto)' end) returning id into v_cred;
  perform public.fin_log('credito_excedente', jsonb_build_object('cliente_id', p_cliente, 'valor', v_exc, 'recebimento_id', v_rec));
  return jsonb_build_object('recebimento_id', v_rec, 'quitado', v_saldo, 'credito', v_exc, 'credito_id', v_cred);
end $$;

revoke all on function public.registrar_recebimento(bigint, numeric, smallint, text, date, text),
  public.registrar_recebimento_credito(bigint, numeric, smallint, text, date, text) from public, anon;
grant execute on function public.registrar_recebimento(bigint, numeric, smallint, text, date, text),
  public.registrar_recebimento_credito(bigint, numeric, smallint, text, date, text) to authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.registrar_recebimento(bigint, numeric, smallint, text, date, text),
      public.registrar_recebimento_credito(bigint, numeric, smallint, text, date, text) to service_role;
  end if;
end $$;

notify pgrst, 'reload schema';
select 'caixa metodo misto ok' as status;
