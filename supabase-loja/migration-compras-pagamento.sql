-- DRAFT — NÃO APLICAR em produção até o dono (MB) dizer "publica".
-- Não rodar no SQL Editor do projeto xvsxnicmpkvzzhkkqgam antes disso.
-- Loja /main apenas. Não mexe no quiosque.
--
-- Compras (fornecedor): ao salvar, a forma de pagamento é obrigatória na RPC nova.
--   agora  = sai o total de um caixa (saída em caixa_movimentos, motivo com o número
--            da compra e o fornecedor). Saldo insuficiente desfaz a compra inteira.
--   depois = fica a pagar. Vencimento é opcional. Nenhum movimento de caixa.
--   divida = só admin. Saída no caixa somente_admin (ex.: PAGAMENTO PRODUTOS),
--            sem conferir saldo: o saldo pode ficar negativo e é a dívida.
-- Compras já gravadas ficam com pagamento NULL: legado, não entram em contas a pagar
-- e não aceitam baixa por aqui.
-- Custo unitário continua só para admin nas RPCs de compras/IMEI. Esta lista devolve
-- só o valor devido da compra (o que o financeiro precisa para pagar), sem custo por SKU.
-- Caixa com somente_admin (ex.: PAGAMENTO PRODUTOS id 17) só aparece e só aceita
-- lançamento de admin. O financeiro vê o valor pago, sem o nome desse caixa.
-- RLS: chamadas de auth/permissão dentro de (select ...), no padrão já usado em caixas.

alter table public.caixas add column if not exists somente_admin boolean not null default false;

alter table public.compras add column if not exists pagamento text;
alter table public.compras drop constraint if exists compras_pagamento_check;
alter table public.compras add constraint compras_pagamento_check
  check (pagamento is null or pagamento in ('agora', 'depois', 'divida'));
alter table public.compras add column if not exists vencimento date;
create index if not exists compras_pagamento_idx on public.compras (pagamento) where pagamento is not null;

create table if not exists public.compra_pagamentos (
  id         bigint generated always as identity primary key,
  compra_id  bigint not null references public.compras(id),
  valor      numeric(12,2) not null check (valor > 0),
  data       date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  caixa_id   smallint not null references public.caixas(id),
  mov_id     bigint references public.caixa_movimentos(id),
  user_id    uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists compra_pag_compra_idx on public.compra_pagamentos (compra_id);

alter table public.compra_pagamentos enable row level security;
alter table public.compra_pagamentos force row level security;
revoke all on public.compra_pagamentos from anon, public, authenticated;
grant select on public.compra_pagamentos to authenticated;

-- Mesma regra já em produção: caixa somente_admin só para quem tem perm admin.
create or replace function public.caixa_permitido(p_caixa smallint)
returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.caixas where id = p_caixa and somente_admin)
      or public.has_perm('admin');
$$;
revoke all on function public.caixa_permitido(smallint) from public, anon;
grant execute on function public.caixa_permitido(smallint) to authenticated;

create or replace function public.compra_pag_visivel(p_caixa smallint)
returns boolean
language sql stable security definer set search_path = '' as $$
  select (select public.has_perm('admin'))
      or not exists (
        select 1 from public.caixas c
        where c.id = p_caixa and c.somente_admin
      );
$$;
revoke all on function public.compra_pag_visivel(smallint) from public, anon;
grant execute on function public.compra_pag_visivel(smallint) to authenticated;

drop policy if exists compra_pag_ler on public.compra_pagamentos;
create policy compra_pag_ler on public.compra_pagamentos
  for select to authenticated
  using (
    (select public.can('financas'))
    and (select public.compra_pag_visivel(caixa_id))
  );

do $$ begin
  if to_regclass('public.security_events') is not null then
    alter table public.security_events drop constraint if exists security_events_kind_check;
    alter table public.security_events add constraint security_events_kind_check check (kind in (
      'failed_login','role_change','admin_added','profile_added','profile_removed','lock','unlock','signout_all',
      'fin_pagamento','fin_recebimento','fin_alteracao',
      'credito_entrada','credito_uso','credito_excedente','nota_lancada',
      'estorno_recebimento','estorno_credito',
      'dep_esp_entrada','dep_esp_ajuste','dep_esp_transferencia',
      'nota_prazo_lancada','nota_dispensada','nota_dispensa_desfeita',
      'nota_cancelada_financas','nota_pag_corrigido',
      'compra_imei_registrado','compra_imei_removido',
      'caixa_mov_estornado',
      'caixa_hx_config',
      'compra_imei_baixado','compra_item_recebido',
      'compra_pagamento')) not valid;
  end if;
end $$;

-- Saída no caixa + linha de pagamento. Trava o mesmo advisory lock de transferir_caixa.
create or replace function public.compra_lancar_saida(p_compra bigint, p_caixa smallint, p_valor numeric, p_divida boolean default false)
returns jsonb
language plpgsql security definer set search_path = '' as $fn$
declare
  c record;
  v_val numeric := round(coalesce(p_valor, 0), 2);
  v_pago numeric;
  v_tot numeric;
  v_rest numeric;
  v_cx smallint;
  v_nome text;
  v_saldo numeric;
  v_mov bigint;
  v_id bigint;
  v_num text;
  v_forn text;
  v_forma text;
  v_so boolean := false;
begin
  if not (public.can('financas') and public.caixa_acesso()) then
    raise exception 'Sem permissão (financeiro/admin)' using errcode = '42501';
  end if;
  if auth.uid() is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  if v_val <= 0 then
    raise exception 'Valor inválido' using errcode = 'P0001';
  end if;
  select * into c from public.compras where id = p_compra for update;
  if not found or c.pagamento is null or c.pagamento not in ('agora', 'depois', 'divida') then
    raise exception 'Compra antiga sem controle de pagamento' using errcode = 'P0001';
  end if;
  select round(coalesce(sum(p.qtd * p.custo_unit), 0), 2) into v_tot
    from public.purchases p where p.compra_id = c.id;
  select round(coalesce(sum(pg.valor), 0), 2) into v_pago
    from public.compra_pagamentos pg where pg.compra_id = c.id;
  v_rest := round(v_tot - v_pago, 2);
  if v_val > v_rest then
    raise exception 'Pagamento maior que o saldo da compra (R$ %)',
      replace(to_char(v_rest, 'FM999999990.00'), '.', ',') using errcode = 'P0001';
  end if;
  if p_caixa is null then
    raise exception 'Escolha o caixa' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(892341, p_caixa::int);
  select id, nome, metodo::text, somente_admin into v_cx, v_nome, v_forma, v_so
    from public.caixas
    where id = p_caixa and ativo and public.caixa_permitido(p_caixa);
  if v_cx is null then
    raise exception 'Caixa inválido' using errcode = 'P0001';
  end if;
  v_saldo := round(public.caixa_saldo_calc(v_cx), 2);
  if coalesce(p_divida, false) then
    if not public.has_perm('admin') then
      raise exception 'Só admin lança dívida no caixa especial' using errcode = '42501';
    end if;
    if not coalesce(v_so, false) then
      raise exception 'Dívida só no caixa especial' using errcode = 'P0001';
    end if;
  elsif v_val > v_saldo then
    raise exception 'Saldo insuficiente no caixa (R$ %)',
      replace(to_char(v_saldo, 'FM999999990.00'), '.', ',') using errcode = 'P0001';
  end if;
  v_num := public.compra_numero(c.id);
  v_forn := coalesce(nullif(btrim(c.fornecedor), ''), 'fornecedor');
  insert into public.caixa_movimentos(caixa_id, tipo, valor, motivo, user_id, forma)
  values (v_cx, 'saida', v_val, left((case when coalesce(p_divida, false) then 'Dívida ' else '' end) || 'Compra ' || v_num || ' — ' || v_forn, 300), auth.uid(), v_forma)
  returning id into v_mov;
  insert into public.compra_pagamentos(compra_id, valor, data, caixa_id, mov_id, user_id)
  values (c.id, v_val, (now() at time zone 'America/Sao_Paulo')::date, v_cx, v_mov, auth.uid())
  returning id into v_id;
  if to_regprocedure('public.fin_log(text,jsonb)') is not null then
    perform public.fin_log('fin_pagamento', jsonb_build_object(
      'compra_id', c.id, 'numero', v_num, 'valor', v_val, 'caixa', v_cx, 'pagamento_id', v_id));
  end if;
  if to_regclass('public.security_events') is not null then
    insert into public.security_events(kind, actor, detail)
    values ('compra_pagamento', auth.uid(), jsonb_build_object(
      'compra_id', c.id, 'numero', v_num, 'valor', v_val, 'caixa', v_cx, 'fornecedor', c.fornecedor));
  end if;
  return jsonb_build_object(
    'pagamento_id', v_id, 'mov_id', v_mov, 'valor', v_val,
    'restante', round(v_rest - v_val, 2), 'saldo_caixa', public.caixa_saldo_calc(v_cx),
    'caixa', v_nome);
end
$fn$;
revoke all on function public.compra_lancar_saida(bigint, smallint, numeric, boolean) from public, anon, authenticated;

-- Mesmo corpo de migration-origem-dolar.sql, mais a forma de pagamento no cabeçalho.
-- Sem o campo pagamento, a compra fica legado (clientes antigos e chamadas sem a tela nova).
create or replace function public.registrar_compra_lote(p_header jsonb, p_itens jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare v_lote uuid := gen_random_uuid(); it jsonb; n int := 0; v_tot numeric := 0; v_cid bigint;
  v_forn text := nullif(btrim(regexp_replace(coalesce(p_header->>'fornecedor', ''), '\s+', ' ', 'g')), '');
  v_obs text := nullif(btrim(coalesce(p_header->>'observacao', '')), '');
  v_data date := coalesce(nullif(p_header->>'data', '')::date, (now() at time zone 'America/Sao_Paulo')::date);
  v_taxa numeric := nullif(p_header->>'taxa_dolar', '')::numeric;
  v_origem text; v_cusd numeric; v_custo numeric;
  v_pag text; v_venc date; v_cx smallint;
begin
  if not (public.can('admin')) then raise exception 'Só admin registra compra' using errcode = '42501'; end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then raise exception 'Nenhum item' using errcode = 'P0001'; end if;
  if jsonb_array_length(p_itens) > 200 then raise exception 'Máximo 200 itens por compra' using errcode = 'P0001'; end if;
  if v_data > (now() at time zone 'America/Sao_Paulo')::date then raise exception 'Data no futuro' using errcode = 'P0001'; end if;
  if length(v_forn) > 120 or length(v_obs) > 500 then raise exception 'Fornecedor/observação longos demais' using errcode = 'P0001'; end if;
  if v_taxa is not null and (v_taxa <= 0 or v_taxa > 999 or v_taxa <> round(v_taxa, 4)) then raise exception 'Taxa do dólar inválida' using errcode = 'P0001'; end if;
  for it in select * from jsonb_array_elements(p_itens) loop
    n := n + 1;
    v_origem := nullif(btrim(coalesce(it->>'origem', '')), '');
    v_cusd := nullif(it->>'custo_usd', '')::numeric;
    if not exists (select 1 from public.products where sku = it->>'sku') then raise exception 'Item %: SKU % não existe', n, it->>'sku' using errcode = 'P0001'; end if;
    if coalesce((it->>'qtd')::int, 0) <= 0 then raise exception 'Item %: quantidade inválida', n using errcode = 'P0001'; end if;
    if v_origem is not null and v_origem not in ('Nacional', 'Importado') then raise exception 'Item %: origem inválida', n using errcode = 'P0001'; end if;
    if v_origem = 'Importado' and v_taxa is null then raise exception 'Item %: informe a taxa do dólar desta compra', n using errcode = 'P0001'; end if;
    if v_origem = 'Importado' and (v_cusd is null or v_cusd < 0) then raise exception 'Item %: informe o custo em US$', n using errcode = 'P0001'; end if;
    if v_origem is distinct from 'Importado' and coalesce((it->>'custo_unit')::numeric, -1) < 0 then raise exception 'Item %: custo inválido', n using errcode = 'P0001'; end if;
    v_custo := case when v_origem = 'Importado' then round(v_cusd * v_taxa, 2) else round((it->>'custo_unit')::numeric, 2) end;
    insert into public.purchases (data, sku, fornecedor, qtd, custo_unit, observacao, compra_lote, origem, preco_usd, custo_usd, taxa_dolar)
    values (v_data, it->>'sku', v_forn, (it->>'qtd')::int, v_custo, v_obs, v_lote,
            v_origem, null,
            case when v_origem = 'Importado' then round(v_cusd, 2) end,
            case when v_origem = 'Importado' then round(v_taxa, 4) end);
    v_tot := v_tot + (it->>'qtd')::int * v_custo;
  end loop;
  if v_forn is not null and length(v_forn) >= 2 and not exists (select 1 from public.fornecedores f where lower(btrim(f.nome)) = lower(v_forn)) then
    insert into public.fornecedores (nome) values (v_forn);
  end if;
  select id into v_cid from public.compras where lote = v_lote;
  if v_cid is null then raise exception 'Compra não numerada' using errcode = 'P0001'; end if;
  v_pag := nullif(lower(btrim(coalesce(p_header->>'pagamento', ''))), '');
  if v_pag is not null then
    if v_pag not in ('agora', 'depois', 'divida') then
      raise exception 'Escolha a forma de pagamento' using errcode = 'P0001';
    end if;
    if v_pag = 'divida' and not public.has_perm('admin') then
      raise exception 'Só admin lança dívida no caixa especial' using errcode = '42501';
    end if;
    v_venc := null;
    if v_pag = 'depois' and nullif(btrim(coalesce(p_header->>'vencimento', '')), '') is not null then
      begin
        v_venc := (p_header->>'vencimento')::date;
      exception when others then
        raise exception 'Vencimento inválido' using errcode = 'P0001';
      end;
    end if;
    update public.compras
       set pagamento = v_pag,
           vencimento = case when v_pag = 'depois' then v_venc end
     where id = v_cid;
    if v_pag in ('agora', 'divida') and round(v_tot, 2) > 0 then
      begin
        v_cx := nullif(btrim(coalesce(p_header->>'caixa_id', '')), '')::smallint;
      exception when others then
        raise exception 'Caixa inválido' using errcode = 'P0001';
      end;
      if v_cx is null then raise exception 'Escolha o caixa' using errcode = 'P0001'; end if;
      perform public.compra_lancar_saida(v_cid, v_cx, round(v_tot, 2), v_pag = 'divida');
    end if;
  end if;
  return jsonb_build_object(
    'lote', v_lote, 'itens', n, 'total', round(v_tot, 2), 'compra_id', v_cid,
    'numero', public.compra_numero(v_cid), 'origem_ok', true,
    'pagamento', v_pag, 'pagamento_ok', v_pag is not null);
end
$fn$;

create or replace function public.registrar_compra_origem(p_header jsonb, p_itens jsonb)
returns jsonb language sql security definer set search_path = '' as $fn$
  select public.registrar_compra_lote(p_header, p_itens);
$fn$;

create or replace function public.registrar_compra_pagamento(p_header jsonb, p_itens jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
begin
  if nullif(lower(btrim(coalesce(p_header->>'pagamento', ''))), '') is null then
    raise exception 'Escolha a forma de pagamento' using errcode = 'P0001';
  end if;
  return public.registrar_compra_lote(p_header, p_itens);
end
$fn$;

create or replace function public.compra_pagar(p_compra bigint, p_valor numeric, p_caixa smallint)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
begin
  if not public.can('financas') then
    raise exception 'Sem permissão (financeiro/admin)' using errcode = '42501';
  end if;
  return public.compra_lancar_saida(p_compra, p_caixa, p_valor);
end
$fn$;

create or replace function public.compras_caixas_pagamento()
returns jsonb language plpgsql stable security definer set search_path = '' as $fn$
declare r jsonb;
begin
  if not (public.can('financas') and public.caixa_acesso()) then
    raise exception 'Sem permissão (financeiro/admin)' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'caixa_id', c.id, 'nome', c.nome, 'metodo', c.metodo::text,
           'somente_admin', c.somente_admin, 'saldo', round(public.caixa_saldo_calc(c.id), 2)
         ) order by c.id), '[]'::jsonb) into r
    from public.caixas c
   where c.ativo and public.caixa_permitido(c.id);
  return r;
end
$fn$;

create or replace function public.compras_pendentes()
returns jsonb language plpgsql stable security definer set search_path = '' as $fn$
declare
  v_admin boolean := public.has_perm('admin');
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_grupos jsonb;
  v_pagas jsonb;
begin
  if not public.can('financas') then
    raise exception 'Sem permissão (financeiro/admin)' using errcode = '42501';
  end if;
  with linhas as (
    select c.id,
           public.compra_numero(c.id) as numero,
           c.data,
           nullif(btrim(c.fornecedor), '') as fornecedor,
           c.vencimento,
           c.pagamento,
           round(coalesce((select sum(p.qtd * p.custo_unit) from public.purchases p where p.compra_id = c.id), 0), 2) as total,
           round(coalesce((select sum(pg.valor) from public.compra_pagamentos pg where pg.compra_id = c.id), 0), 2) as pago
      from public.compras c
     where c.pagamento in ('agora', 'depois', 'divida')
  ),
  calc as (
    select l.*,
           round(l.total - l.pago, 2) as restante,
           (l.vencimento is not null and l.vencimento < v_hoje and round(l.total - l.pago, 2) > 0) as atrasada
      from linhas l
  ),
  objs as (
    select c.*,
           jsonb_build_object(
             'id', c.id, 'numero', c.numero, 'data', c.data,
             'fornecedor', coalesce(c.fornecedor, 'Sem fornecedor'),
             'vencimento', c.vencimento, 'pagamento', c.pagamento,
             'total', c.total, 'pago', c.pago, 'restante', c.restante, 'atrasada', c.atrasada,
             'pagamentos', coalesce((
               select jsonb_agg(jsonb_build_object(
                        'id', pg.id, 'valor', pg.valor, 'data', pg.data,
                        'caixa', case when cx.somente_admin and not v_admin then null else cx.nome end,
                        'caixa_id', case when cx.somente_admin and not v_admin then null else cx.id end,
                        'caixa_oculto', cx.somente_admin and not v_admin
                      ) order by pg.id)
                 from public.compra_pagamentos pg
                 join public.caixas cx on cx.id = pg.caixa_id
                where pg.compra_id = c.id
             ), '[]'::jsonb)
           ) as obj
      from calc c
  )
  select coalesce((
           select jsonb_agg(jsonb_build_object(
                    'fornecedor', g.fornecedor, 'total_devido', g.total_devido, 'compras', g.compras
                  ) order by g.fornecedor)
             from (
               select coalesce(fornecedor, 'Sem fornecedor') as fornecedor,
                      round(sum(restante), 2) as total_devido,
                      jsonb_agg(obj order by atrasada desc, vencimento nulls last, data, id) as compras
                 from objs
                where restante > 0
                group by coalesce(fornecedor, 'Sem fornecedor')
             ) g
         ), '[]'::jsonb),
         coalesce((
           select jsonb_agg(obj order by id desc)
             from (select obj, id from objs where restante <= 0 order by id desc limit 40) s
         ), '[]'::jsonb)
    into v_grupos, v_pagas;
  return jsonb_build_object('grupos', v_grupos, 'pagas', v_pagas);
end
$fn$;

revoke all on function public.registrar_compra_lote(jsonb, jsonb),
  public.registrar_compra_origem(jsonb, jsonb),
  public.registrar_compra_pagamento(jsonb, jsonb),
  public.compra_pagar(bigint, numeric, smallint),
  public.compras_caixas_pagamento(),
  public.compras_pendentes() from public, anon;
grant execute on function public.registrar_compra_lote(jsonb, jsonb),
  public.registrar_compra_origem(jsonb, jsonb),
  public.registrar_compra_pagamento(jsonb, jsonb),
  public.compra_pagar(bigint, numeric, smallint),
  public.compras_caixas_pagamento(),
  public.compras_pendentes() to authenticated;

notify pgrst, 'reload schema';
select 'compras-pagamento draft' as status;
