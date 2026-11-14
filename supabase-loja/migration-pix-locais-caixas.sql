-- Nova nota / PIX: Local do pagamento pode ser o nome atual das caixas
-- 15 PRESTIGE ROSA, 2 Caixa PIX (HX), 3 Máquina Loja, 14 CAIXA S2, 13 PRIME.
-- O app escolhe pelo id e grava o nome que a tabela tiver na hora.
-- Rótulos antigos continuam válidos (HX, MAQUINA, PRESTIGE AURA, …).
--
-- Baseado na criar_nota_local viva em 14/11/2026 (pós #27–#33).
-- Única mudança de regra: o allowlist chama local_pagamento_aceito.
-- Não substitui lancar_nota_caixa nem cancelar_nota_financas.
-- Não altera linhas existentes de notas, compras, purchases, movimentos ou custos.

create or replace function public.local_pagamento_aceito(p_local text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select p_local is null
    or p_local in (
      'MAQUINA', 'HX', 'DINHEIRO', 'CAIXA GERAL', 'CAIXA ESPECIAL', 'CAIXA S2',
      'PRESTIGE AURA', 'PRESTIGE ROSA', 'BITLOG CONTAINER',
      'Caixa PIX (HX)', 'Máquina Loja', 'PRIME'
    )
    or exists (
      select 1 from public.caixas c
      where c.ativo and c.id in (15, 2, 3, 14, 13) and c.nome = p_local
    );
$fn$;

revoke all on function public.local_pagamento_aceito(text) from public, anon;
grant execute on function public.local_pagamento_aceito(text) to authenticated;

alter table public.notas drop constraint if exists notas_local_pag_chk;
alter table public.notas add constraint notas_local_pag_chk
  check (public.local_pagamento_aceito(local_pagamento));

-- Nomes atuais para o dropdown de quem não lê a tabela caixas (vendedor não tem permissão de caixa).
create or replace function public.caixas_para_local_pix()
returns table(id smallint, nome text)
language sql
stable
security definer
set search_path = ''
as $fn$
  select c.id, c.nome
  from public.caixas c
  where c.ativo
    and c.id in (15, 2, 3, 14, 13)
    and public.can('vendas');
$fn$;

revoke all on function public.caixas_para_local_pix() from public, anon;
grant execute on function public.caixas_para_local_pix() to authenticated;

create or replace function public.criar_nota_local(
  p_items jsonb, p_pagamentos jsonb, p_cliente text default null, p_cliente_id bigint default null,
  p_local text default null, p_obs text default null, p_frete numeric default 0, p_caxinha_natal numeric default 0,
  p_prazo_dias integer default null
)
returns bigint language plpgsql security definer set search_path = '' as $fn$
declare v_id bigint; v_tot numeric := 0; v_saldo numeric; it jsonb; v_pags jsonb := p_pagamentos;
  v_frete numeric := round(coalesce(p_frete, 0), 2);
  v_cx numeric := round(coalesce(p_caxinha_natal, 0), 2);
  v_pago numeric := 0;
  v_cxid bigint;
  v_tem_prazo boolean := false;
  v_dias integer;
begin
  if not public.can('vendas') then raise exception 'Sem permissão para criar nota' using errcode = '42501'; end if;
  -- PRESTIGE AURA was renamed PRESTIGE ROSA (caixa 15). Old cached apps still send the old label.
  if p_local = 'PRESTIGE AURA' then p_local := 'PRESTIGE ROSA'; end if;
  if v_frete < 0 then raise exception 'Frete inválido' using errcode = 'P0001'; end if;
  if v_cx < 0 then raise exception 'Caxinha d Natal inválido' using errcode = 'P0001'; end if;
  if p_local is not null and not public.local_pagamento_aceito(p_local) then
    raise exception 'Escolha o Local do pagamento' using errcode = 'P0001'; end if;
  if p_local is null and (jsonb_typeof(p_pagamentos) is distinct from 'array' or exists (
      select 1 from jsonb_array_elements(p_pagamentos) g
      where coalesce(g->>'metodo','') <> 'prazo' and coalesce(nullif(g->>'valor','')::numeric, 0) > 0)) then
    raise exception 'Escolha o Local do pagamento' using errcode = 'P0001'; end if;
  if p_local in ('CAIXA ESPECIAL', 'BITLOG CONTAINER') then
    if not (public.can('admin') and exists (
          select 1 from public.profiles p where p.id = auth.uid() and p.role::text = 'admin' and p.ativo)) then
      raise exception 'Somente admin' using errcode = '42501'; end if;
  end if;
  if p_local = 'CAIXA GERAL' then
    if p_cliente_id is null then raise exception 'Caixa Geral exige cliente cadastrado' using errcode = 'P0001'; end if;
    if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Nota sem itens' using errcode = 'P0001'; end if;
    for it in select * from jsonb_array_elements(p_items) loop
      v_tot := v_tot + (it->>'qtd')::int * (it->>'preco_vendido')::numeric; end loop;
    v_tot := v_tot + v_frete + v_cx;
    perform 1 from public.clientes where id = p_cliente_id for update;
    v_saldo := public._credito_saldo(p_cliente_id);
    if round(v_tot, 2) > round(v_saldo, 2) then
      raise exception 'Crédito insuficiente na Caixa Geral (saldo R$ %)', replace(to_char(v_saldo, 'FM999999990.00'), '.', ',') using errcode = 'P0001'; end if;
    v_pags := jsonb_build_array(jsonb_build_object('metodo', 'credito', 'valor', round(v_tot, 2)));
    perform set_config('bagda.credito_ok', '1', true);
  end if;
  v_id := public.criar_nota(p_items, v_pags, p_cliente, p_cliente_id, v_frete, v_cx);
  perform set_config('bagda.credito_ok', '', true);
  update public.notas set local_pagamento = p_local, obs_pagamento = nullif(left(trim(coalesce(p_obs,'')), 200), '') where id = v_id;
  if p_local = 'CAIXA GERAL' then
    insert into public.cliente_creditos(cliente_id, tipo, valor, obs, nota_id)
    values (p_cliente_id, 'uso', round(v_tot, 2), 'Nota ' || lpad(v_id::text, 6, '0'), v_id);
  end if;
  if p_local = 'CAIXA ESPECIAL' then
    select coalesce(sum(valor), 0) into v_pago from public.nota_pagamentos
     where nota_id = v_id and metodo::text not in ('prazo', 'credito');
    if v_pago <= 0 then raise exception 'Nota sem valor para a Caixa Especial' using errcode = 'P0001'; end if;
    v_cxid := public._cxesp_inserir('entrada', v_pago, 'Nota ' || lpad(v_id::text, 6, '0'), null, p_cliente_id, null);
    update public.caixa_especial_mov set nota_id = v_id where id = v_cxid;
    update public.notas set caixa_lancada_id = null, lancada_em = now(), lancada_por = auth.uid(),
           cxesp_lancada_em = now(), cxesp_lancada_por = auth.uid(), cxesp_mov_id = v_cxid
     where id = v_id;
    perform public.fin_log('nota_lancada', jsonb_build_object('nota_id', v_id, 'destino', 'cxesp', 'cxesp_id', v_cxid, 'valor', v_pago, 'na_criacao', true));
  end if;

  select exists (
    select 1 from public.nota_pagamentos g
     where g.nota_id = v_id and g.metodo::text = 'prazo' and g.valor > 0
  ) into v_tem_prazo;
  if v_tem_prazo then
    v_dias := p_prazo_dias;
    -- Sem prazo (app antigo em cache): a nota é criada sem vencimento, como antes.
    if v_dias is not null and (v_dias < 1 or v_dias > 30) then
      raise exception 'Informe o prazo (1 a 30 dias) para Paga Depois' using errcode = 'P0001';
    end if;
    if v_dias is not null then
      update public.notas
         set prazo_dias = v_dias,
             vencimento = data + v_dias
       where id = v_id;
    end if;
  end if;
  return v_id;
end
$fn$;

revoke all on function public.criar_nota_local(jsonb, jsonb, text, bigint, text, text, numeric, numeric, integer) from public, anon;
grant execute on function public.criar_nota_local(jsonb, jsonb, text, bigint, text, text, numeric, numeric, integer) to authenticated;

notify pgrst, 'reload schema';
