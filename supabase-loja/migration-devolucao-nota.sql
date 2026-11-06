-- =====================================================================
-- migration-devolucao-nota.sql — Loja /main. NÃO executar em produção
-- sem autorização direta do MB.
--
-- Devolução de mercadoria pelo número da nota. Não existe hoje um fluxo
-- parcial. O que existe é cancelar_nota / cancelar_nota_financas: anula a
-- nota inteira, devolve todo o estoque e estorna o caixa lançado. Esta
-- migration não substitui essas funções e não grava estoque, caixa,
-- crédito, cxesp nem recebimento.
--
-- A tela guarda uma proposta. A confirmação do acerto fica recusada até
-- o MB definir para onde vai o dinheiro (pago, Paga Depois, misto,
-- Caixa Geral, frete). Sem isso, devolver estoque deixaria a venda e o
-- caixa como estavam.
-- =====================================================================

do $$ begin
  if to_regclass('public.notas') is null or to_regclass('public.sales') is null
     or to_regclass('public.nota_pagamentos') is null or to_regclass('public.products') is null then
    raise exception 'Parar: faltam notas, sales, nota_pagamentos ou products.';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'notas' and column_name = 'frete') then
    raise exception 'Parar: falta public.notas.frete. Não criar a coluna aqui.';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'notas' and column_name = 'obs_pagamento') then
    raise exception 'Parar: falta public.notas.obs_pagamento.';
  end if;
  if to_regprocedure('public.can(text)') is null then
    raise exception 'Parar: falta public.can(text).';
  end if;
end $$;

create table if not exists public.devolucao_proposta (
  id          bigint generated always as identity primary key,
  chave       text not null unique,
  nota_id     bigint not null references public.notas(id),
  user_id     uuid not null,
  motivo      text not null,
  status      text not null default 'proposta' check (status in ('proposta', 'retirada')),
  mercadoria  numeric(12,2) not null check (mercadoria >= 0),
  pedido      jsonb not null,
  created_at  timestamptz not null default now(),
  retirada_em timestamptz,
  retirada_por uuid,
  motivo_retirada text,
  constraint devolucao_proposta_chave_chk check (chave ~ '^[A-Za-z0-9._:-]{8,80}$'),
  constraint devolucao_proposta_motivo_chk check (length(trim(motivo)) >= 3 and length(motivo) <= 300)
);
create index if not exists devolucao_proposta_nota_idx on public.devolucao_proposta(nota_id) where status = 'proposta';

create table if not exists public.devolucao_proposta_item (
  id            bigint generated always as identity primary key,
  proposta_id   bigint not null references public.devolucao_proposta(id) on delete cascade,
  sale_id       bigint not null references public.sales(id),
  sku           text not null,
  qtd           integer not null check (qtd > 0),
  preco_vendido numeric(10,2) not null check (preco_vendido > 0),
  unique (proposta_id, sale_id)
);

alter table public.devolucao_proposta enable row level security;
alter table public.devolucao_proposta force row level security;
alter table public.devolucao_proposta_item enable row level security;
alter table public.devolucao_proposta_item force row level security;
revoke all on table public.devolucao_proposta, public.devolucao_proposta_item from public, anon, authenticated;

create or replace function public._devolucao_admin() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (public.can('admin') and exists (
        select 1 from public.profiles p
         where p.id = auth.uid() and p.role::text = 'admin' and p.ativo)) then
    raise exception 'Somente admin' using errcode = '42501';
  end if;
end $$;
revoke all on function public._devolucao_admin() from public, anon, authenticated;

create or replace function public._devolucao_perguntas() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_array(
    'A devolução de todos os itens restantes continua no Cancelar nota (anula a nota, devolve o estoque e estorna o caixa) ou a nota original fica ativa?',
    'Dinheiro já lançado num caixa ou na CAIXA SPECIAL: o estorno sai do mesmo lugar ou fica para um pagamento manual?',
    'Paga Depois sem recebimento: a devolução só diminui a dívida do cliente?',
    'Nota mista: numa devolução parcial, diminui primeiro o que já foi pago ou o Paga Depois?',
    'Nota paga com crédito da Caixa Geral: o crédito volta para o cliente?',
    'Frete e Caxinha entram na devolução, só quando a nota volta inteira, ou nunca?',
    'A política pública (mesmo meio, Pix ou cartão, prazos do CDC) vale no balcão?',
    'Quem confirma o acerto depois: só admin ou também o financeiro?'
  );
$$;
revoke all on function public._devolucao_perguntas() from public, anon, authenticated;

create or replace function public.consultar_devolucao_nota(p_nota bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  n record; v_cax numeric := 0; v_cax_ok boolean := false; v_aceita boolean := true; v_recusa text;
  v_itens jsonb; v_props jsonb; v_pags jsonb; v_divida numeric;
begin
  perform public._devolucao_admin();
  if p_nota is null or p_nota <= 0 then
    raise exception 'Nota não encontrada' using errcode = 'P0001';
  end if;
  select id, status, cliente, cliente_id, obs_pagamento, coalesce(frete, 0) as frete, total
    into n from public.notas where id = p_nota;
  if n.id is null then raise exception 'Nota não encontrada' using errcode = 'P0001'; end if;
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'notas' and column_name = 'caxinha_natal') then
    v_cax_ok := true;
    execute 'select coalesce(caxinha_natal, 0) from public.notas where id = $1' into v_cax using p_nota;
  end if;
  if n.status = 'cancelada' then
    v_aceita := false; v_recusa := 'Nota cancelada';
  elsif coalesce(n.obs_pagamento, '') like 'DÍVIDA ANTERIOR%' then
    v_aceita := false; v_recusa := 'Nota de dívida anterior, sem mercadoria';
  elsif not exists (select 1 from public.sales s where s.nota_id = n.id) then
    v_aceita := false; v_recusa := 'Nota sem mercadoria';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'sale_id', s.id, 'sku', s.sku, 'marca', pr.marca, 'produto', pr.produto,
           'tamanho', pr.tamanho, 'qtd_vendida', s.qtd, 'preco_vendido', s.preco_vendido,
           'qtd_em_proposta', coalesce(u.qtd, 0),
           'qtd_disponivel', case when v_aceita then s.qtd - coalesce(u.qtd, 0) else 0 end)
         order by s.id), '[]'::jsonb)
    into v_itens
    from public.sales s
    join public.products pr on pr.sku = s.sku
    left join (
      select i.sale_id, sum(i.qtd) qtd
        from public.devolucao_proposta_item i
        join public.devolucao_proposta d on d.id = i.proposta_id
       where d.nota_id = p_nota and d.status = 'proposta'
       group by i.sale_id
    ) u on u.sale_id = s.id
   where s.nota_id = p_nota;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', d.id, 'status', d.status, 'motivo', d.motivo, 'mercadoria', d.mercadoria,
           'created_at', d.created_at,
           'itens', (select coalesce(jsonb_agg(jsonb_build_object(
                       'sale_id', i.sale_id, 'sku', i.sku, 'qtd', i.qtd, 'preco_vendido', i.preco_vendido)
                     order by i.sale_id), '[]'::jsonb)
                      from public.devolucao_proposta_item i where i.proposta_id = d.id))
         order by d.id), '[]'::jsonb)
    into v_props
    from public.devolucao_proposta d where d.nota_id = p_nota;
  select coalesce(jsonb_agg(jsonb_build_object('metodo', np.metodo::text, 'valor', np.valor) order by np.id), '[]'::jsonb)
    into v_pags from public.nota_pagamentos np where np.nota_id = p_nota;
  if n.cliente_id is not null and to_regprocedure('public.cliente_saldo_calc(bigint)') is not null then
    v_divida := public.cliente_saldo_calc(n.cliente_id);
  end if;
  return jsonb_build_object(
    'nota_id', n.id, 'numero', lpad(n.id::text, 6, '0'), 'status', n.status,
    'cliente', n.cliente, 'cliente_id', n.cliente_id, 'obs_pagamento', n.obs_pagamento,
    'aceita', v_aceita, 'motivo_recusa', v_recusa, 'itens', v_itens, 'propostas', v_props,
    'pagamentos', v_pags, 'frete', n.frete, 'caxinha_natal', v_cax, 'caxinha_conhecida', v_cax_ok,
    'total_nota', n.total, 'divida_cliente_hoje', v_divida,
    'mercadoria_disponivel', coalesce((select sum((x->>'qtd_disponivel')::int * (x->>'preco_vendido')::numeric) from jsonb_array_elements(v_itens) x), 0),
    'confirmacao_habilitada', false, 'estoque_aplicado', false, 'caixa_aplicado', false,
    'credito_aplicado', false, 'divida_aplicada', false, 'acerto', 'pendente',
    'caminho_existente', 'Cancelar nota anula a nota inteira, devolve todo o estoque e estorna o caixa lançado. Não serve para quantidade parcial e não fica preservada como venda ativa.',
    'perguntas', public._devolucao_perguntas());
end $$;

create or replace function public.propor_devolucao_nota(
  p_nota bigint, p_itens jsonb, p_motivo text, p_chave text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_chave text := trim(coalesce(p_chave, ''));
  v_motivo text := trim(coalesce(p_motivo, ''));
  n record; v_info jsonb; it jsonb;   v_sale record; v_need int; v_left int; v_merc numeric := 0;
  v_pedido jsonb; v_idem record; v_id bigint; v_seen bigint[] := '{}';
begin
  perform public._devolucao_admin();
  if v_chave !~ '^[A-Za-z0-9._:-]{8,80}$' then
    raise exception 'Informe a chave da devolução' using errcode = 'P0001';
  end if;
  if length(v_motivo) < 3 or length(v_motivo) > 300 then
    raise exception 'Informe o motivo' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_itens) is distinct from 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Informe a quantidade' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(87234022, hashtext(coalesce(p_nota, 0)::text));
  select id, status into n from public.notas where id = p_nota for update;
  if n.id is null then raise exception 'Nota não encontrada' using errcode = 'P0001'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('sale_id', (x->>'sale_id')::bigint, 'qtd', (x->>'qtd')::int)
                            order by (x->>'sale_id')::bigint), '[]'::jsonb)
    into v_pedido
    from jsonb_array_elements(p_itens) x
   where coalesce((x->>'qtd')::int, 0) > 0;
  if v_pedido = '[]'::jsonb then raise exception 'Informe a quantidade' using errcode = 'P0001'; end if;
  select * into v_idem from public.devolucao_proposta where chave = v_chave;
  if found then
    if v_idem.user_id is distinct from auth.uid() or v_idem.nota_id is distinct from p_nota
       or v_idem.motivo is distinct from v_motivo or v_idem.pedido is distinct from v_pedido then
      raise exception 'Chave já usada em outra devolução' using errcode = 'P0001';
    end if;
    return jsonb_build_object(
      'proposta_id', v_idem.id, 'nota_id', p_nota, 'mercadoria', v_idem.mercadoria,
      'idempotente', true, 'status', v_idem.status, 'confirmacao_habilitada', false,
      'estoque_aplicado', false, 'acerto', 'pendente');
  end if;
  v_info := public.consultar_devolucao_nota(p_nota);
  if coalesce((v_info->>'aceita')::boolean, false) is not true then
    raise exception '%', coalesce(v_info->>'motivo_recusa', 'Nota não aceita') using errcode = 'P0001';
  end if;
  for it in select * from jsonb_array_elements(p_itens) loop
    if (it->>'sale_id') is null or (it->>'qtd') !~ '^[0-9]+$' then
      raise exception 'Item inválido' using errcode = 'P0001';
    end if;
    v_need := (it->>'qtd')::int;
    if v_need = 0 then continue; end if;
    if v_need < 0 then raise exception 'Quantidade inválida' using errcode = 'P0001'; end if;
    if (it->>'sale_id')::bigint = any (v_seen) then
      raise exception 'Item repetido na devolução' using errcode = 'P0001';
    end if;
    v_seen := v_seen || (it->>'sale_id')::bigint;
    select s.id, s.sku, s.qtd, s.preco_vendido into v_sale
      from public.sales s where s.id = (it->>'sale_id')::bigint and s.nota_id = p_nota for update;
    if v_sale.id is null then raise exception 'Item não é desta nota' using errcode = 'P0001'; end if;
    select s.qtd - coalesce((
             select sum(i.qtd) from public.devolucao_proposta_item i
               join public.devolucao_proposta d on d.id = i.proposta_id
              where i.sale_id = s.id and d.status = 'proposta'), 0)
      into v_left
      from public.sales s where s.id = v_sale.id;
    if v_need > v_left then
      raise exception 'Quantidade maior que a vendida (%): pedido %, disponível %', v_sale.sku, v_need, v_left
        using errcode = 'P0001';
    end if;
    v_merc := v_merc + round(v_need * v_sale.preco_vendido, 2);
  end loop;
  if v_merc <= 0 then raise exception 'Informe a quantidade' using errcode = 'P0001'; end if;
  insert into public.devolucao_proposta(chave, nota_id, user_id, motivo, mercadoria, pedido)
  values (v_chave, p_nota, auth.uid(), v_motivo, v_merc, v_pedido)
  returning id into v_id;
  for it in select * from jsonb_array_elements(p_itens) loop
    v_need := coalesce((it->>'qtd')::int, 0);
    if v_need = 0 then continue; end if;
    insert into public.devolucao_proposta_item(proposta_id, sale_id, sku, qtd, preco_vendido)
    select v_id, s.id, s.sku, v_need, s.preco_vendido
      from public.sales s where s.id = (it->>'sale_id')::bigint and s.nota_id = p_nota;
  end loop;
  return jsonb_build_object(
    'proposta_id', v_id, 'nota_id', p_nota, 'mercadoria', v_merc, 'idempotente', false,
    'status', 'proposta', 'confirmacao_habilitada', false, 'estoque_aplicado', false,
    'caixa_aplicado', false, 'credito_aplicado', false, 'divida_aplicada', false,
    'acerto', 'pendente', 'perguntas', public._devolucao_perguntas());
end $$;

create or replace function public.retirar_proposta_devolucao(p_id bigint, p_motivo text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare d record; v_motivo text := trim(coalesce(p_motivo, ''));
begin
  perform public._devolucao_admin();
  if length(v_motivo) < 3 then raise exception 'Informe o motivo' using errcode = 'P0001'; end if;
  select * into d from public.devolucao_proposta where id = p_id for update;
  if d.id is null then raise exception 'Proposta não encontrada' using errcode = 'P0001'; end if;
  if d.status = 'retirada' then
    return jsonb_build_object('proposta_id', d.id, 'status', 'retirada', 'ja_retirada', true);
  end if;
  update public.devolucao_proposta
     set status = 'retirada', retirada_em = now(), retirada_por = auth.uid(), motivo_retirada = left(v_motivo, 300)
   where id = d.id;
  return jsonb_build_object('proposta_id', d.id, 'status', 'retirada', 'estoque_aplicado', false, 'acerto', 'pendente');
end $$;

create or replace function public.confirmar_devolucao_nota(p_proposta bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public._devolucao_admin();
  raise exception 'Acerto financeiro pendente — a proposta não confirma estoque nem dinheiro'
    using errcode = 'P0001';
end $$;

revoke all on function public.consultar_devolucao_nota(bigint),
  public.propor_devolucao_nota(bigint, jsonb, text, text),
  public.retirar_proposta_devolucao(bigint, text),
  public.confirmar_devolucao_nota(bigint) from public, anon;
grant execute on function public.consultar_devolucao_nota(bigint),
  public.propor_devolucao_nota(bigint, jsonb, text, text),
  public.retirar_proposta_devolucao(bigint, text),
  public.confirmar_devolucao_nota(bigint) to authenticated;

notify pgrst, 'reload schema';
select 'devolucao nota proposta ok' as status;
