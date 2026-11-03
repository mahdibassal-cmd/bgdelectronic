-- Compras numeradas (C-000001) + IMEI por unidade (cadastrado DEPOIS da compra) + busca por IMEI.
-- Idempotente (pode rodar mais de uma vez). RLS em todas as tabelas novas; escrita só via RPC.
-- Admin cadastra IMEI; admin e financeiro consultam. NÃO rodar sem o "yes" do MB.
-- Não usar "Run without RLS".

-- 0) Log: lista completa de tipos + novos compra_imei_*
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
      'compra_imei_registrado','compra_imei_removido')) not valid;
  end if;
end $$;

-- 1) Cabeçalho da compra (número sequencial)
create table if not exists public.compras (
  id         bigint generated always as identity primary key,
  lote       uuid unique,
  data       date not null default (now() at time zone 'America/Sao_Paulo')::date,
  fornecedor text,
  observacao text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.purchases add column if not exists compra_lote uuid;
alter table public.purchases add column if not exists compra_id bigint references public.compras(id);
create index if not exists purchases_compra_lote_idx on public.purchases (compra_lote) where compra_lote is not null;
create index if not exists purchases_compra_id_idx on public.purchases (compra_id);

create or replace function public.compra_numero(p_id bigint) returns text
language sql immutable set search_path = '' as $$ select 'C-' || lpad(p_id::text, 6, '0') $$;

-- 2) Toda linha nova em purchases ganha compra (mesmo compra_lote = mesma compra)
create or replace function public.purchase_compra_bi() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v bigint;
begin
  if new.compra_id is null then
    if new.compra_lote is not null then
      select id into v from public.compras where lote = new.compra_lote;
      if v is null then
        insert into public.compras (lote, data, fornecedor, observacao, created_by)
        values (new.compra_lote, new.data, new.fornecedor, new.observacao, coalesce(new.created_by, auth.uid()))
        on conflict (lote) do nothing returning id into v;
        if v is null then select id into v from public.compras where lote = new.compra_lote; end if;
      end if;
    else
      insert into public.compras (lote, data, fornecedor, observacao, created_by)
      values (gen_random_uuid(), new.data, new.fornecedor, new.observacao, coalesce(new.created_by, auth.uid())) returning id into v;
    end if;
    new.compra_id := v;
  end if;
  return new;
end $$;
revoke all on function public.purchase_compra_bi() from public, anon, authenticated;
drop trigger if exists purchase_compra_bi on public.purchases;
create trigger purchase_compra_bi before insert on public.purchases for each row execute function public.purchase_compra_bi();

-- 3) Backfill das compras antigas (em ordem cronológica; só linhas ainda sem compra)
do $$ declare r record; v bigint; begin
  for r in select compra_lote, min(id) mid, min(data) d, min(fornecedor) f, min(observacao) o, min(created_by::text)::uuid cb, min(created_at) ca
           from public.purchases where compra_id is null and compra_lote is not null group by compra_lote
           union all
           select null, id, data, fornecedor, observacao, created_by, created_at from public.purchases where compra_id is null and compra_lote is null
           order by mid loop
    insert into public.compras (lote, data, fornecedor, observacao, created_by, created_at)
    values (coalesce(r.compra_lote, gen_random_uuid()), r.d, r.f, r.o, r.cb, r.ca)
    on conflict (lote) do update set lote = excluded.lote returning id into v;
    if r.compra_lote is not null then update public.purchases set compra_id = v where compra_lote = r.compra_lote and compra_id is null;
    else update public.purchases set compra_id = v where id = r.mid; end if;
  end loop;
end $$;

-- 4) IMEIs (1 linha por unidade; slot 1..qtd)
create table if not exists public.compra_imeis (
  id          bigint generated always as identity primary key,
  purchase_id bigint not null references public.purchases(id) on delete restrict,
  slot        integer not null check (slot >= 1),
  imei1       text not null unique check (imei1 ~ '^\d{15}$'),
  imei2       text unique check (imei2 is null or imei2 ~ '^\d{15}$'),
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (purchase_id, slot),
  check (imei2 is null or imei2 <> imei1)
);
create index if not exists compra_imeis_imei2_idx on public.compra_imeis (imei2) where imei2 is not null;

-- 5) RLS (escrita só por RPC security definer)
alter table public.compras enable row level security;
alter table public.compra_imeis enable row level security;
revoke all on public.compras, public.compra_imeis from anon;
revoke insert, update, delete on public.compras, public.compra_imeis from authenticated;
grant select on public.compras, public.compra_imeis to authenticated;
drop policy if exists compras_ler on public.compras;
create policy compras_ler on public.compras for select to authenticated using (public.can('admin') or public.can('financas'));
drop policy if exists compra_imeis_ler on public.compra_imeis;
create policy compra_imeis_ler on public.compra_imeis for select to authenticated using (public.can('admin') or public.can('financas'));

-- 6) Lista de compras
create or replace function public.compras_listar(p_q text default null, p_limit int default 100)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare q text := nullif(lower(btrim(coalesce(p_q, ''))), ''); r jsonb;
begin
  if not (public.can('admin') or public.can('financas')) then raise exception 'Sem permissão' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(x order by x.id desc), '[]') into r from (
    select c.id, public.compra_numero(c.id) numero, c.data, c.fornecedor, c.observacao,
           count(p.id) itens, coalesce(sum(p.qtd), 0) unidades, coalesce(sum(p.total), 0) total,
           (select count(*) from public.compra_imeis i join public.purchases p2 on p2.id = i.purchase_id where p2.compra_id = c.id) imeis
    from public.compras c join public.purchases p on p.compra_id = c.id
    where q is null or lower(public.compra_numero(c.id)) like '%' || q || '%' or lower(coalesce(c.fornecedor, '')) like '%' || q || '%'
          or exists (select 1 from public.purchases p3 join public.products pr on pr.sku = p3.sku where p3.compra_id = c.id and lower(pr.sku || ' ' || pr.marca || ' ' || pr.produto) like '%' || q || '%')
    group by c.id order by c.id desc limit least(greatest(coalesce(p_limit, 100), 1), 500)) x;
  return r;
end $$;

-- 7) Detalhe de uma compra (por número "C-000012", "12" ou id)
create or replace function public.compra_detalhe(p_numero text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v bigint := nullif(regexp_replace(coalesce(p_numero, ''), '\D', '', 'g'), '')::bigint; c record;
begin
  if not (public.can('admin') or public.can('financas')) then raise exception 'Sem permissão' using errcode = '42501'; end if;
  select * into c from public.compras where id = v;
  if not found then raise exception 'Compra % não encontrada', p_numero using errcode = 'P0001'; end if;
  return jsonb_build_object('id', c.id, 'numero', public.compra_numero(c.id), 'data', c.data, 'fornecedor', c.fornecedor, 'observacao', c.observacao,
    'itens', coalesce((select jsonb_agg(jsonb_build_object('purchase_id', p.id, 'sku', p.sku, 'marca', pr.marca, 'produto', pr.produto, 'tamanho', pr.tamanho,
        'qtd', p.qtd, 'custo_unit', p.custo_unit, 'total', p.total,
        'imeis', coalesce((select jsonb_agg(jsonb_build_object('slot', i.slot, 'imei1', i.imei1, 'imei2', i.imei2) order by i.slot) from public.compra_imeis i where i.purchase_id = p.id), '[]'))
      order by p.id) from public.purchases p join public.products pr on pr.sku = p.sku where p.compra_id = c.id), '[]'));
end $$;

-- 8) Salvar IMEIs de um item (admin). p_slots = [{slot, imei1, imei2}] ; imei1 vazio = apaga o slot
create or replace function public.compra_imei_salvar(p_purchase_id bigint, p_slots jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare pu record; s jsonb; v_slot int; v1 text; v2 text; o record; n_ok int := 0; n_rm int := 0;
begin
  if not public.can('admin') then raise exception 'Só admin cadastra IMEI' using errcode = '42501'; end if;
  select * into pu from public.purchases where id = p_purchase_id;
  if not found then raise exception 'Item de compra não encontrado' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_slots) <> 'array' then raise exception 'Formato inválido' using errcode = 'P0001'; end if;
  for s in select * from jsonb_array_elements(p_slots) loop
    v_slot := (s->>'slot')::int;
    v1 := nullif(regexp_replace(coalesce(s->>'imei1', ''), '\D', '', 'g'), '');
    v2 := nullif(regexp_replace(coalesce(s->>'imei2', ''), '\D', '', 'g'), '');
    if v_slot is null or v_slot < 1 or v_slot > pu.qtd then raise exception 'Unidade % fora da quantidade comprada (%)', v_slot, pu.qtd using errcode = 'P0001'; end if;
    if v1 is null then
      if v2 is not null then raise exception 'Unidade %: IMEI 1 é obrigatório', v_slot using errcode = 'P0001'; end if;
      delete from public.compra_imeis where purchase_id = pu.id and slot = v_slot returning * into o;
      if found then n_rm := n_rm + 1;
        insert into public.security_events (kind, actor, detail) values ('compra_imei_removido', auth.uid(),
          jsonb_build_object('compra', public.compra_numero(pu.compra_id), 'purchase_id', pu.id, 'sku', pu.sku, 'slot', v_slot, 'imei1', o.imei1, 'imei2', o.imei2));
      end if;
      continue;
    end if;
    if v1 !~ '^\d{15}$' then raise exception 'Unidade %: IMEI 1 precisa ter 15 dígitos', v_slot using errcode = 'P0001'; end if;
    if v2 is not null and v2 !~ '^\d{15}$' then raise exception 'Unidade %: IMEI 2 precisa ter 15 dígitos', v_slot using errcode = 'P0001'; end if;
    if v1 = v2 then raise exception 'Unidade %: IMEI 1 e IMEI 2 iguais', v_slot using errcode = 'P0001'; end if;
    select i.*, public.compra_numero(p.compra_id) num into o from public.compra_imeis i join public.purchases p on p.id = i.purchase_id
      where (i.imei1 in (v1, v2) or i.imei2 in (v1, v2)) and not (i.purchase_id = pu.id and i.slot = v_slot) limit 1;
    if found then raise exception 'IMEI já cadastrado na compra % (unidade %)', o.num, o.slot using errcode = '23505'; end if;
    insert into public.compra_imeis (purchase_id, slot, imei1, imei2) values (pu.id, v_slot, v1, v2)
      on conflict (purchase_id, slot) do update set imei1 = excluded.imei1, imei2 = excluded.imei2, updated_at = now();
    n_ok := n_ok + 1;
    insert into public.security_events (kind, actor, detail) values ('compra_imei_registrado', auth.uid(),
      jsonb_build_object('compra', public.compra_numero(pu.compra_id), 'purchase_id', pu.id, 'sku', pu.sku, 'slot', v_slot, 'imei1', v1, 'imei2', v2));
  end loop;
  return jsonb_build_object('salvos', n_ok, 'removidos', n_rm);
end $$;

-- 9) Buscar IMEI (parcial, mín. 4 dígitos)
create or replace function public.imei_buscar(p_q text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare q text := regexp_replace(coalesce(p_q, ''), '\D', '', 'g'); r jsonb;
begin
  if not (public.can('admin') or public.can('financas')) then raise exception 'Sem permissão' using errcode = '42501'; end if;
  if length(q) < 4 then raise exception 'Digite pelo menos 4 dígitos do IMEI' using errcode = 'P0001'; end if;
  select coalesce(jsonb_agg(x), '[]') into r from (
    select i.imei1, i.imei2, i.slot, public.compra_numero(c.id) numero, c.id compra_id, c.data, c.fornecedor,
           p.sku, pr.marca, pr.produto, pr.tamanho, p.custo_unit, p.qtd
    from public.compra_imeis i join public.purchases p on p.id = i.purchase_id join public.compras c on c.id = p.compra_id
    join public.products pr on pr.sku = p.sku
    where i.imei1 like '%' || q || '%' or i.imei2 like '%' || q || '%'
    order by (i.imei1 = q or i.imei2 = q) desc, c.id desc limit 50) x;
  return r;
end $$;

-- 10) registrar_compra_lote passa a devolver o número da compra (corpo igual ao migration-compra-lote + numero)
create or replace function public.registrar_compra_lote(p_header jsonb, p_itens jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_lote uuid := gen_random_uuid(); it jsonb; n int := 0; v_tot numeric := 0; v_cid bigint;
  v_forn text := nullif(btrim(regexp_replace(coalesce(p_header->>'fornecedor', ''), '\s+', ' ', 'g')), '');
  v_obs text := nullif(btrim(coalesce(p_header->>'observacao', '')), '');
  v_data date := coalesce(nullif(p_header->>'data', '')::date, (now() at time zone 'America/Sao_Paulo')::date);
begin
  if not (public.can('admin')) then raise exception 'Só admin registra compra' using errcode = '42501'; end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then raise exception 'Nenhum item' using errcode = 'P0001'; end if;
  if jsonb_array_length(p_itens) > 200 then raise exception 'Máximo 200 itens por compra' using errcode = 'P0001'; end if;
  if v_data > (now() at time zone 'America/Sao_Paulo')::date then raise exception 'Data no futuro' using errcode = 'P0001'; end if;
  if length(v_forn) > 120 or length(v_obs) > 500 then raise exception 'Fornecedor/observação longos demais' using errcode = 'P0001'; end if;
  for it in select * from jsonb_array_elements(p_itens) loop
    n := n + 1;
    if not exists (select 1 from public.products where sku = it->>'sku') then raise exception 'Item %: SKU % não existe', n, it->>'sku' using errcode = 'P0001'; end if;
    if coalesce((it->>'qtd')::int, 0) <= 0 then raise exception 'Item %: quantidade inválida', n using errcode = 'P0001'; end if;
    if coalesce((it->>'custo_unit')::numeric, -1) < 0 then raise exception 'Item %: custo inválido', n using errcode = 'P0001'; end if;
    insert into public.purchases (data, sku, fornecedor, qtd, custo_unit, observacao, compra_lote)
    values (v_data, it->>'sku', v_forn, (it->>'qtd')::int, round((it->>'custo_unit')::numeric, 2), v_obs, v_lote);
    v_tot := v_tot + (it->>'qtd')::int * round((it->>'custo_unit')::numeric, 2);
  end loop;
  if v_forn is not null and length(v_forn) >= 2 and not exists (select 1 from public.fornecedores f where lower(btrim(f.nome)) = lower(v_forn)) then
    insert into public.fornecedores (nome) values (v_forn);
  end if;
  select id into v_cid from public.compras where lote = v_lote;
  return jsonb_build_object('lote', v_lote, 'itens', n, 'total', v_tot, 'compra_id', v_cid, 'numero', public.compra_numero(v_cid));
end $$;

revoke all on function public.compras_listar(text, int), public.compra_detalhe(text), public.compra_imei_salvar(bigint, jsonb),
  public.imei_buscar(text), public.registrar_compra_lote(jsonb, jsonb) from public, anon;
grant execute on function public.compras_listar(text, int), public.compra_detalhe(text), public.compra_imei_salvar(bigint, jsonb),
  public.imei_buscar(text), public.registrar_compra_lote(jsonb, jsonb), public.compra_numero(bigint) to authenticated;
notify pgrst, 'reload schema';
select 'compras+imei ok' as status, (select count(*) from public.compras) compras, (select count(*) from public.purchases where compra_id is null) sem_compra;
