-- DRAFT — não aplicar em produção até revisão e OK explícito do MB.
-- Transfere valor de um caixa ativo para outro (saída + entrada na mesma transação).
-- Não substitui lancar_credito, lancar_credito_caixa, registrar_recebimento_credito,
-- criar_nota, criar_nota_local, pagar_conta, cancelar_nota, cancelar_nota_financas,
-- cx_esp_entrada, cx_esp_saida nem estornar_movimento_caixa.
-- Tipos de movimento: entrada / saida já existentes. Sem tipo novo.
-- Também acrescenta a coluna cliente em v_caixa_extrato (nome do cliente da nota
-- ou do recebimento; sem nome de fornecedor). A view no ar em 2026-11-10 é a base.

create or replace function public.transferir_caixa(p_origem smallint, p_destino smallint, p_valor numeric, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_val numeric := round(coalesce(p_valor, 0), 2);
  v_mot text := left(trim(coalesce(p_motivo, '')), 300);
  v_o_id smallint; v_d_id smallint;
  v_o_nome text; v_d_nome text;
  v_saldo numeric;
  v_sai bigint; v_ent bigint;
  v_lo smallint; v_hi smallint;
begin
  if not public.caixa_acesso() then
    raise exception 'Sem permissão de caixa' using errcode = '42501';
  end if;
  if v_val <= 0 then
    raise exception 'Informe um valor maior que zero' using errcode = 'P0001';
  end if;
  if length(v_mot) < 3 then
    raise exception 'Informe o motivo' using errcode = 'P0001';
  end if;
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

  -- trava os dois caixas sempre na mesma ordem, para não cruzar com outro lançamento
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
    'saida_id', v_sai,
    'entrada_id', v_ent,
    'origem', v_o_id,
    'destino', v_d_id,
    'valor', v_val,
    'saldo_origem', public.caixa_saldo_calc(v_o_id),
    'saldo_destino', public.caixa_saldo_calc(v_d_id)
  );
end
$fn$;

revoke all on function public.transferir_caixa(smallint, smallint, numeric, text) from public, anon;
grant execute on function public.transferir_caixa(smallint, smallint, numeric, text) to authenticated;

-- Coluna cliente no extrato do caixa (nota cadastrada / texto da nota / recebimento).
-- Mantém as colunas que já estão no ar (estorno_de, estornado, forma).
create or replace view public.v_caixa_extrato with (security_invoker = true) as
select m.id, m.data, m.created_at, m.caixa_id, c.nome as caixa, m.tipo, m.valor,
       case when m.tipo in ('venda','entrada') then m.valor else -m.valor end as valor_assinado,
       m.motivo, m.nota_id, pr.handle, pr.nome,
       m.estorno_de,
       exists (select 1 from public.caixa_movimentos e where e.estorno_de = m.id) as estornado,
       m.forma,
       coalesce(cln.nome, n.cliente, cl.nome) as cliente
from public.caixa_movimentos m
join public.caixas c on c.id = m.caixa_id
left join public.profiles pr on pr.id = m.user_id
left join public.notas n on n.id = m.nota_id
left join public.clientes cln on cln.id = n.cliente_id
left join public.cliente_recebimentos r on r.mov_id = m.id
left join public.clientes cl on cl.id = r.cliente_id;

revoke all on public.v_caixa_extrato from anon, public;
grant select on public.v_caixa_extrato to authenticated;

notify pgrst, 'reload schema';
select 'transferir caixa draft' as status;
