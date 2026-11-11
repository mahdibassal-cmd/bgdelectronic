-- DRAFT — não aplicar em produção até revisão e OK explícito do MB ("publica").
-- Estende transferir_caixa para a Caixa Especial (somente admin).
-- Transferência para Especial: saída no caixa de origem (aparece no extrato com motivo)
-- + entrada em caixa_especial_mov, na mesma transação, ligadas para o estorno reverter os dois lados.
-- Financeiro continua transferindo só entre caixas normais; o RPC recusa Especial (não é só a UI).
-- Não substitui cx_esp_entrada, cx_esp_saida, criar_nota, lancar_credito,
-- lancar_credito_caixa, registrar_recebimento_credito, pagar_conta nem cancelar_nota.

-- Ligação entre o movimento do caixa do dia e o lançamento da Caixa Especial.
alter table public.caixa_especial_mov
  add column if not exists caixa_mov_id bigint references public.caixa_movimentos(id);
create unique index if not exists cx_esp_caixa_mov_uq
  on public.caixa_especial_mov(caixa_mov_id) where caixa_mov_id is not null;

-- Recria com parâmetros extras (default false): chamadas de 4 argumentos continuam válidas.
drop function if exists public.transferir_caixa(smallint, smallint, numeric, text);

create or replace function public.transferir_caixa(
  p_origem smallint,
  p_destino smallint,
  p_valor numeric,
  p_motivo text,
  p_origem_especial boolean default false,
  p_destino_especial boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_val numeric := round(coalesce(p_valor, 0), 2);
  v_mot text := left(trim(coalesce(p_motivo, '')), 300);
  v_o_esp boolean := coalesce(p_origem_especial, false);
  v_d_esp boolean := coalesce(p_destino_especial, false);
  v_o_id smallint; v_d_id smallint;
  v_o_nome text; v_d_nome text;
  v_saldo numeric;
  v_sai bigint; v_ent bigint; v_cxesp bigint;
  v_lo smallint; v_hi smallint;
begin
  if not public.caixa_acesso() then
    raise exception 'Sem permissão de caixa' using errcode = '42501';
  end if;
  if (v_o_esp or v_d_esp) and not public.can('admin') then
    raise exception 'Somente admin pode transferir envolvendo a Caixa Especial' using errcode = '42501';
  end if;
  if v_val <= 0 then
    raise exception 'Informe um valor maior que zero' using errcode = 'P0001';
  end if;
  if length(v_mot) < 3 then
    raise exception 'Informe o motivo' using errcode = 'P0001';
  end if;
  if v_o_esp and v_d_esp then
    raise exception 'Escolha caixas diferentes' using errcode = 'P0001';
  end if;

  if not v_o_esp and not v_d_esp then
    if p_origem is not distinct from p_destino then
      raise exception 'Escolha caixas diferentes' using errcode = 'P0001';
    end if;
    select id, nome into v_o_id, v_o_nome from public.caixas where id = p_origem and ativo;
    if v_o_id is null then
      raise exception 'Caixa de origem inválido' using errcode = 'P0001';
    end if;
    select id, nome into v_d_id, v_d_nome from public.caixas where id = p_destino and ativo;
    if v_d_id is null then
      raise exception 'Caixa de destino inválido' using errcode = 'P0001';
    end if;
    v_lo := least(v_o_id, v_d_id);
    v_hi := greatest(v_o_id, v_d_id);
    perform pg_advisory_xact_lock(892341, v_lo::int);
    perform pg_advisory_xact_lock(892341, v_hi::int);
    v_saldo := round(public.caixa_saldo_calc(v_o_id), 2);
    if v_val > v_saldo then
      raise exception 'Saldo insuficiente no caixa de origem (R$ %)',
        replace(to_char(v_saldo, 'FM999999990.00'), '.', ',') using errcode = 'P0001';
    end if;
    insert into public.caixa_movimentos(caixa_id, tipo, valor, motivo, user_id)
    values (v_o_id, 'saida', v_val, left('Transferência para ' || v_d_nome || ': ' || v_mot, 300), auth.uid())
    returning id into v_sai;
    insert into public.caixa_movimentos(caixa_id, tipo, valor, motivo, user_id)
    values (v_d_id, 'entrada', v_val, left('Transferência de ' || v_o_nome || ': ' || v_mot, 300), auth.uid())
    returning id into v_ent;
    return jsonb_build_object(
      'saida_id', v_sai, 'entrada_id', v_ent, 'origem', v_o_id, 'destino', v_d_id,
      'valor', v_val, 'saldo_origem', public.caixa_saldo_calc(v_o_id),
      'saldo_destino', public.caixa_saldo_calc(v_d_id)
    );
  end if;

  if v_o_esp then
    v_o_nome := 'CAIXA ESPECIAL';
    select id, nome into v_d_id, v_d_nome from public.caixas where id = p_destino and ativo;
    if v_d_id is null then
      raise exception 'Caixa de destino inválido' using errcode = 'P0001';
    end if;
  else
    v_d_nome := 'CAIXA ESPECIAL';
    select id, nome into v_o_id, v_o_nome from public.caixas where id = p_origem and ativo;
    if v_o_id is null then
      raise exception 'Caixa de origem inválido' using errcode = 'P0001';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtext('caixa_especial'));
  if v_o_id is not null then perform pg_advisory_xact_lock(892341, v_o_id::int); end if;
  if v_d_id is not null then perform pg_advisory_xact_lock(892341, v_d_id::int); end if;

  if v_o_esp then
    v_saldo := round(public._cx_esp_saldo(), 2);
    if v_val > v_saldo then
      raise exception 'Saldo da Caixa Especial insuficiente (R$ %)',
        replace(to_char(v_saldo, 'FM999999990.00'), '.', ',') using errcode = 'P0001';
    end if;
    insert into public.caixa_movimentos(caixa_id, tipo, valor, motivo, user_id)
    values (v_d_id, 'entrada', v_val, left('Transferência de CAIXA ESPECIAL: ' || v_mot, 300), auth.uid())
    returning id into v_ent;
    insert into public.caixa_especial_mov(tipo, valor, motivo, caixa_mov_id, created_by)
    values ('saida', v_val, left('Transferência para ' || v_d_nome || ': ' || v_mot, 300), v_ent, auth.uid())
    returning id into v_cxesp;
    return jsonb_build_object(
      'saida_id', v_cxesp, 'entrada_id', v_ent, 'origem', 'cxesp', 'destino', v_d_id,
      'valor', v_val, 'cxesp_id', v_cxesp,
      'saldo_origem', public._cx_esp_saldo(),
      'saldo_destino', public.caixa_saldo_calc(v_d_id)
    );
  end if;

  v_saldo := round(public.caixa_saldo_calc(v_o_id), 2);
  if v_val > v_saldo then
    raise exception 'Saldo insuficiente no caixa de origem (R$ %)',
      replace(to_char(v_saldo, 'FM999999990.00'), '.', ',') using errcode = 'P0001';
  end if;
  insert into public.caixa_movimentos(caixa_id, tipo, valor, motivo, user_id)
  values (v_o_id, 'saida', v_val, left('Transferência para CAIXA ESPECIAL: ' || v_mot, 300), auth.uid())
  returning id into v_sai;
  insert into public.caixa_especial_mov(tipo, valor, motivo, caixa_mov_id, created_by)
  values ('entrada', v_val, left('Transferência de ' || v_o_nome || ': ' || v_mot, 300), v_sai, auth.uid())
  returning id into v_cxesp;
  return jsonb_build_object(
    'saida_id', v_sai, 'entrada_id', v_cxesp, 'origem', v_o_id, 'destino', 'cxesp',
    'valor', v_val, 'cxesp_id', v_cxesp,
    'saldo_origem', public.caixa_saldo_calc(v_o_id),
    'saldo_destino', public._cx_esp_saldo()
  );
end
$fn$;

revoke all on function public.transferir_caixa(smallint, smallint, numeric, text, boolean, boolean) from public, anon;
grant execute on function public.transferir_caixa(smallint, smallint, numeric, text, boolean, boolean) to authenticated;

-- Estorno do movimento do caixa do dia também reverte o lançamento ligado na Caixa Especial.
create or replace function public.estornar_movimento_caixa(p_mov bigint, p_motivo text, p_cancelar_nota boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare m record; v_mot text := left(trim(coalesce(p_motivo, '')), 200); v_new bigint; v_rec bigint; v_liq numeric; v_r jsonb;
        v_acao text; v_nn text; v_outros numeric;
        v_esp public.caixa_especial_mov%rowtype; v_esp_new bigint; v_saldo_esp numeric; v_esp_id bigint;
begin
  if not public.can('admin') then raise exception 'Somente admin pode estornar movimento de caixa' using errcode = '42501'; end if;
  if length(v_mot) < 3 then raise exception 'Informe o motivo do estorno' using errcode = 'P0001'; end if;
  select * into m from public.caixa_movimentos where id = p_mov for update;
  if m.id is null then raise exception 'Movimento não encontrado' using errcode = 'P0001'; end if;
  select e.id into v_new from public.caixa_movimentos e where e.estorno_de = m.id;
  if v_new is not null then return jsonb_build_object('ja_estornado', true, 'mov_id', m.id, 'estorno_id', v_new); end if;
  if m.estorno_de is not null or m.tipo = 'estorno' then raise exception 'Este movimento já é um estorno' using errcode = 'P0001'; end if;
  if exists (select 1 from public.conta_pagamentos p where p.mov_id = m.id) then
    raise exception 'Pagamento de conta: estorne em Contas a pagar' using errcode = 'P0001'; end if;

  select r.id into v_rec from public.cliente_recebimentos r where r.mov_id = m.id;
  if v_rec is not null then
    v_r := public.estornar_recebimento(v_rec, v_mot);
    v_new := nullif(v_r->>'mov_saida', '')::bigint;
    if v_new is not null then update public.caixa_movimentos set estorno_de = m.id where id = v_new; end if;
    v_acao := 'recebimento';
  elsif m.tipo = 'venda' then
    v_nn := lpad(m.nota_id::text, 6, '0');
    if p_cancelar_nota then
      if to_regprocedure('public.cancelar_nota_financas(bigint,text)') is null then
        raise exception 'Rode migration-cancelar-nota-financas.sql antes' using errcode = 'P0001'; end if;
      v_r := public.cancelar_nota_financas(m.nota_id, v_mot);
      select max(e.id) into v_new from public.caixa_movimentos e
       where e.nota_id = m.nota_id and e.caixa_id = m.caixa_id and e.tipo = 'estorno' and e.estorno_de is null and e.created_at = now();
      if v_new is not null then update public.caixa_movimentos set estorno_de = m.id where id = v_new; end if;
      v_acao := 'nota_cancelada';
    else
      perform 1 from public.notas where id = m.nota_id for update;
      select coalesce(sum(case when tipo = 'venda' then valor when tipo = 'estorno' then -valor else 0 end), 0) into v_liq
        from public.caixa_movimentos where nota_id = m.nota_id and caixa_id = m.caixa_id;
      if v_liq <= 0 then raise exception 'Nota % não tem mais valor neste caixa (já estornada/transferida)', v_nn using errcode = 'P0001'; end if;
      insert into public.caixa_movimentos(caixa_id, tipo, valor, motivo, nota_id, user_id, forma, estorno_de)
      values (m.caixa_id, 'estorno', v_liq, left('Estorno caixa nota ' || v_nn || ' (volta p/ lançar): ' || v_mot, 300), m.nota_id, auth.uid(), m.forma, m.id)
      returning id into v_new;
      select coalesce(sum(case when tipo = 'venda' then valor when tipo = 'estorno' then -valor else 0 end), 0) into v_outros
        from public.caixa_movimentos where nota_id = m.nota_id;
      if v_outros <= 0 then
        update public.notas set caixa_lancada_id = null, lancada_em = null, lancada_por = null where id = m.nota_id; end if;
      v_acao := 'nota_volta_a_lancar';
    end if;
  elsif m.tipo in ('entrada','saida') then
    insert into public.caixa_movimentos(caixa_id, tipo, valor, motivo, user_id, forma, estorno_de)
    values (m.caixa_id, case when m.tipo = 'entrada' then 'saida' else 'entrada' end::public.mov_tipo, m.valor,
            left('Estorno mov #' || m.id || ' (' || coalesce(m.motivo, '') || '): ' || v_mot, 300), auth.uid(), m.forma, m.id)
    returning id into v_new;
    v_acao := 'manual';
  else
    raise exception 'Tipo de movimento não pode ser estornado' using errcode = 'P0001';
  end if;

  if v_acao = 'manual' then
    select * into v_esp from public.caixa_especial_mov where caixa_mov_id = m.id for update;
    if v_esp.id is not null then
      select e.id into v_esp_new from public.caixa_especial_mov e where e.estorno_de = v_esp.id;
      if v_esp_new is null then
        perform pg_advisory_xact_lock(hashtext('caixa_especial'));
        if v_esp.tipo = 'entrada' then
          v_saldo_esp := round(public._cx_esp_saldo(), 2);
          if v_esp.valor > v_saldo_esp then
            raise exception 'Saldo da Caixa Especial ficaria negativo (R$ %)',
              replace(to_char(v_saldo_esp, 'FM999999990.00'), '.', ',') using errcode = 'P0001';
          end if;
        end if;
        insert into public.caixa_especial_mov(tipo, valor, motivo, estorno_de, caixa_mov_id, created_by)
        values (case when v_esp.tipo = 'entrada' then 'saida' else 'entrada' end, v_esp.valor,
                left('Estorno transferência #' || v_esp.id || ' (mov #' || m.id || '): ' || v_mot, 300),
                v_esp.id, v_new, auth.uid())
        returning id into v_esp_new;
      end if;
      v_acao := 'transferencia_especial';
      v_esp_id := v_esp.id;
    end if;
  end if;

  if to_regclass('public.security_events') is not null then
    insert into public.security_events(kind, actor, detail) values ('caixa_mov_estornado', auth.uid(),
      jsonb_build_object('mov_id', m.id, 'estorno_id', v_new, 'acao', v_acao, 'caixa', m.caixa_id, 'tipo', m.tipo, 'valor', m.valor,
                         'forma', m.forma, 'nota_id', m.nota_id, 'recebimento_id', v_rec, 'mov_motivo', m.motivo,
                         'mov_data', m.data, 'mov_user', m.user_id, 'cancelar_nota', p_cancelar_nota, 'motivo', v_mot,
                         'cxesp_id', v_esp_id, 'cxesp_estorno_id', v_esp_new));
  end if;
  return jsonb_build_object('mov_id', m.id, 'estorno_id', v_new, 'acao', v_acao, 'valor', m.valor, 'nota_id', m.nota_id,
                            'cxesp_id', v_esp_id, 'cxesp_estorno_id', v_esp_new);
end $$;
revoke all on function public.estornar_movimento_caixa(bigint, text, boolean) from public, anon;
grant execute on function public.estornar_movimento_caixa(bigint, text, boolean) to authenticated;

-- Estorno pela tela da Caixa Especial também reverte o movimento ligado no caixa do dia.
create or replace function public.cx_esp_estornar(p_id bigint, p_motivo text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare m record; v_new bigint; v_cred bigint; v_mot text := left(trim(coalesce(p_motivo, '')), 200); v_saldo numeric;
        v_cm public.caixa_movimentos%rowtype; v_cm_new bigint;
begin
  if not public.can('admin') then raise exception 'Somente admin' using errcode = '42501'; end if;
  if length(v_mot) < 3 then raise exception 'Informe o motivo do estorno' using errcode = 'P0001'; end if;
  perform pg_advisory_xact_lock(hashtext('caixa_especial'));
  select * into m from public.caixa_especial_mov where id = p_id for update;
  if m.id is null then raise exception 'Lançamento não encontrado' using errcode = 'P0001'; end if;
  select e.id into v_new from public.caixa_especial_mov e where e.estorno_de = m.id;
  if v_new is not null then return jsonb_build_object('ja_estornado', true, 'estorno_id', v_new); end if;
  if m.estorno_de is not null then raise exception 'Este lançamento já é um estorno' using errcode = 'P0001'; end if;
  if m.tipo = 'entrada' then
    v_saldo := round(public._cx_esp_saldo(), 2);
    if m.valor > v_saldo then
      raise exception 'Saldo da Caixa Especial ficaria negativo (R$ %)', replace(to_char(v_saldo, 'FM999999990.00'), '.', ',') using errcode = 'P0001'; end if;
  end if;
  insert into public.caixa_especial_mov(tipo, valor, motivo, cliente_id, estorno_de, created_by)
  values (case when m.tipo = 'entrada' then 'saida' else 'entrada' end, m.valor,
          left('Estorno #' || m.id || ': ' || v_mot, 300), m.cliente_id, m.id, auth.uid()) returning id into v_new;
  if m.credito_id is not null then
    perform 1 from public.clientes where id = m.cliente_id for update;
    perform set_config('bagda.cx_esp', '1', true);
    insert into public.cliente_creditos(cliente_id, tipo, valor, obs, estorno_de)
    values (m.cliente_id, 'entrada', m.valor, left('Estorno devolução Caixa Especial #' || m.id || ': ' || v_mot, 300), m.credito_id)
    returning id into v_cred;
    perform set_config('bagda.cx_esp', '', true);
    if to_regprocedure('public.fin_log(text,jsonb)') is not null then
      perform public.fin_log('credito_entrada', jsonb_build_object('cliente_id', m.cliente_id, 'valor', m.valor, 'estorno_de', m.credito_id, 'via', 'caixa_especial'));
    end if;
  end if;
  if m.caixa_mov_id is not null then
    select * into v_cm from public.caixa_movimentos where id = m.caixa_mov_id for update;
    if v_cm.id is not null then
      select e.id into v_cm_new from public.caixa_movimentos e where e.estorno_de = v_cm.id;
      if v_cm_new is null and v_cm.estorno_de is null and v_cm.tipo is distinct from 'estorno' then
        insert into public.caixa_movimentos(caixa_id, tipo, valor, motivo, user_id, forma, estorno_de)
        values (v_cm.caixa_id, case when v_cm.tipo = 'entrada' then 'saida' else 'entrada' end::public.mov_tipo,
                v_cm.valor,
                left('Estorno mov #' || v_cm.id || ' (transferência Caixa Especial #' || m.id || '): ' || v_mot, 300),
                auth.uid(), v_cm.forma, v_cm.id)
        returning id into v_cm_new;
      end if;
      if v_cm_new is not null then
        update public.caixa_especial_mov set caixa_mov_id = v_cm_new where id = v_new;
      end if;
    end if;
  end if;
  return jsonb_build_object('estorno_id', v_new, 'credito_id', v_cred, 'saldo', public._cx_esp_saldo(),
                            'caixa_mov_id', m.caixa_mov_id, 'caixa_estorno_id', v_cm_new);
end $$;
revoke all on function public.cx_esp_estornar(bigint, text) from public, anon;
grant execute on function public.cx_esp_estornar(bigint, text) to authenticated;

notify pgrst, 'reload schema';
select 'transferir especial draft' as status;
