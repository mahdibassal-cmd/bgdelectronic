-- =====================================================================
-- fix-adicionar-divida-sem-teto.sql — Loja /main (xvsxnicmpkvzzhkkqgam).
-- NÃO executar sem autorização. Não cria dívida, não chama a função.
--
-- Tira só o teto comercial v_val > 999999.99 de public.adicionar_divida.
-- Não troca o tipo das colunas. frete, total, nota_pagamentos.valor e
-- divida_legado_idem.valor já são numeric(12,2): 10 dígitos antes da
-- vírgula e 2 centavos. 1.592.870,00 cabe. Um valor maior do que esse
-- tipo consegue gravar continua inválido, porque a coluna não muda.
-- Admin, chave e a mesma chave repetida ficam como estão.
-- Não mexe em criar_nota, criar_nota_local, na view de pagamento nem em RLS.
-- =====================================================================

do $$
declare
  v_cols int;
begin
  if to_regprocedure('public.adicionar_divida(bigint, numeric, text, text)') is null then
    raise exception 'Parar: public.adicionar_divida(bigint, numeric, text, text) ausente.';
  end if;
  select count(*) into v_cols
    from information_schema.columns c
   where c.table_schema = 'public'
     and (c.table_name, c.column_name) in (
       ('notas', 'frete'), ('notas', 'total'),
       ('nota_pagamentos', 'valor'), ('divida_legado_idem', 'valor'))
     and c.data_type = 'numeric'
     and c.numeric_precision = 12
     and c.numeric_scale = 2;
  if v_cols <> 4 then
    raise exception 'Parar: as quatro colunas de valor não estão numeric(12,2). Não alterar o tipo aqui.';
  end if;
end $$;

create or replace function public.adicionar_divida(
  p_cliente bigint, p_valor numeric, p_obs text default null, p_chave text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_chave text := trim(coalesce(p_chave, ''));
  v_val numeric := round(coalesce(p_valor, 0), 2);
  v_nome text; v_ativo boolean; v_id bigint; v_obs text; v_saldo numeric;
  v_idem record;
begin
  if not (public.can('admin') and exists (
        select 1 from public.profiles p
         where p.id = auth.uid() and p.role::text = 'admin' and p.ativo)) then
    raise exception 'Somente admin' using errcode = '42501';
  end if;
  if v_chave !~ '^[A-Za-z0-9._:-]{8,80}$' then
    raise exception 'Informe a chave da dívida' using errcode = 'P0001';
  end if;
  if v_val::text = 'NaN' or v_val <= 0 then
    raise exception 'Valor inválido' using errcode = 'P0001';
  end if;
  -- Cabe nas colunas que esta função já grava. O typmod é o da coluna, não um teto novo.
  if exists (
    select 1
      from pg_attribute a
     where a.attrelid in ('public.notas'::regclass, 'public.nota_pagamentos'::regclass, 'public.divida_legado_idem'::regclass)
       and a.attname in ('frete', 'total', 'valor')
       and a.attnum > 0
       and not a.attisdropped
       and a.atttypid = 'pg_catalog.numeric'::regtype
       and a.atttypmod >= 0
       and (
         length(trunc(abs(v_val))::text) > (((a.atttypmod - 4) >> 16) - ((a.atttypmod - 4) & 65535))
         or scale(v_val) > ((a.atttypmod - 4) & 65535)
       )
  ) then
    raise exception 'Valor inválido' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(87234021, hashtext(v_chave));
  select * into v_idem from public.divida_legado_idem where chave = v_chave;
  if found then
    if v_idem.user_id is distinct from auth.uid()
       or v_idem.cliente_id is distinct from p_cliente
       or v_idem.valor is distinct from v_val then
      raise exception 'Chave já usada em outra dívida' using errcode = 'P0001';
    end if;
    v_saldo := public.cliente_saldo_calc(p_cliente);
    return jsonb_build_object(
      'nota_id', v_idem.nota_id, 'valor', v_val, 'cliente_id', p_cliente,
      'saldo', v_saldo, 'idempotente', true, 'rotulo', 'DÍVIDA ANTERIOR');
  end if;
  select nome, ativo into v_nome, v_ativo from public.clientes where id = p_cliente for update;
  if v_nome is null then raise exception 'Cliente não encontrado' using errcode = 'P0001'; end if;
  if not coalesce(v_ativo, false) then raise exception 'Cliente inativo' using errcode = 'P0001'; end if;
  v_obs := left('DÍVIDA ANTERIOR' || case when length(trim(coalesce(p_obs, ''))) > 0
    then ' — ' || trim(p_obs) else '' end, 200);
  insert into public.notas(seller_id, cliente, cliente_id, frete, total, obs_pagamento)
  values (auth.uid(), v_nome, p_cliente, v_val, v_val, v_obs)
  returning id into v_id;
  insert into public.nota_pagamentos(nota_id, metodo, valor)
  values (v_id, 'prazo'::public.pay_method, v_val);
  insert into public.divida_legado_idem(chave, user_id, cliente_id, valor, nota_id)
  values (v_chave, auth.uid(), p_cliente, v_val, v_id);
  v_saldo := public.cliente_saldo_calc(p_cliente);
  return jsonb_build_object(
    'nota_id', v_id, 'valor', v_val, 'cliente_id', p_cliente,
    'frete', v_val, 'saldo', v_saldo, 'idempotente', false, 'rotulo', 'DÍVIDA ANTERIOR');
end $$;

revoke all on function public.adicionar_divida(bigint, numeric, text, text) from public, anon;
grant execute on function public.adicionar_divida(bigint, numeric, text, text) to authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.adicionar_divida(bigint, numeric, text, text) to service_role;
  end if;
end $$;

notify pgrst, 'reload schema';
select 'adicionar divida sem teto comercial' as status;
