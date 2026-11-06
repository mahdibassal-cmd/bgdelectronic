-- =====================================================================
-- migration-adicionar-divida.sql — Loja /main (bagda-loja). Idempotente.
-- NÃO executar daqui contra produção. Esperar autorização do MB.
--
-- Contas a receber → Adicionar dívida (só admin de verdade).
-- Cria uma nota Paga Depois só de frete, no padrão das notas antigas
-- de frete na conta do cliente (sem item, sem SKU).
-- frete = total = valor do prazo. Não grava sales, então o estoque não muda.
-- Não grava caixa_movimentos, cliente_creditos nem caixa_especial_mov.
-- Não é crédito da Caixa Geral (o cliente passa a dever, não a ter saldo).
-- Não altera criar_nota, criar_nota_local, LARANJIHA, GETNET nem o ledger cxesp.
--
-- Pré-requisitos já presentes em produção (esta migration NÃO os cria):
--   public.notas.frete (migration-frete.sql)
--   public.notas.obs_pagamento (migration-caixa-geral.sql)
--   public.notas.cliente_id e pay_method 'prazo' (migration-clientes.sql)
--   public.cliente_saldo_calc(bigint), public.can(text), public.profiles
-- Não cria frete_dia. Em produção essa função não existe; criá-la faria o
-- Resumo do dia passar a mostrar "Frete (motoboy)" de todas as notas, não só
-- desta dívida. O extrato e o relatório por forma deixam esta nota de fora
-- pelo rótulo DÍVIDA ANTERIOR. Caixa, crédito e lucro de produto não mudam.
-- =====================================================================

do $$ begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'notas' and column_name = 'frete') then
    raise exception 'Parar: falta public.notas.frete. Não criar a coluna aqui.';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'notas' and column_name = 'obs_pagamento') then
    raise exception 'Parar: falta public.notas.obs_pagamento.';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'notas' and column_name = 'cliente_id') then
    raise exception 'Parar: falta public.notas.cliente_id.';
  end if;
  if not exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
                  where t.typname = 'pay_method' and e.enumlabel = 'prazo') then
    raise exception 'Parar: pay_method sem prazo.';
  end if;
  if to_regprocedure('public.cliente_saldo_calc(bigint)') is null
     or to_regprocedure('public.can(text)') is null then
    raise exception 'Parar: falta cliente_saldo_calc ou can.';
  end if;
end $$;

create table if not exists public.divida_legado_idem (
  chave      text primary key,
  user_id    uuid not null,
  cliente_id bigint not null,
  valor      numeric(12,2) not null check (valor > 0),
  nota_id    bigint not null,
  created_at timestamptz not null default now(),
  constraint divida_legado_idem_chave_chk check (chave ~ '^[A-Za-z0-9._:-]{8,80}$')
);
alter table public.divida_legado_idem enable row level security;
alter table public.divida_legado_idem force row level security;
revoke all on table public.divida_legado_idem from public, anon, authenticated;

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
  if v_val <= 0 or v_val > 999999.99 then
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

-- Relatório por forma: a dívida anterior não entra como faturamento.
create or replace view public.v_report_payment with (security_invoker = true) as
select n.data, np.metodo as forma_pagamento, count(distinct n.id) as vendas, sum(np.valor) as faturamento
from public.notas n join public.nota_pagamentos np on np.nota_id = n.id
where n.status = 'ativa'
  and coalesce(n.obs_pagamento, '') not like 'DÍVIDA ANTERIOR%'
  and public.has_perm('admin')
group by n.data, np.metodo;

notify pgrst, 'reload schema';
select 'adicionar divida ok' as status;
