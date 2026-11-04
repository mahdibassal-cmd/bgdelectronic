-- BAGDA LOJA — papel "estoque" (estoquista, NÃO comprador) + baixa de IMEIs por compra.
-- NÃO rodar sem o "yes" do MB. Idempotente (pode rodar de novo).
-- Independe de c5e4dcd (migration-caixa-hx-dia) e f694640 (credito-uso-recebimento): roda antes ou depois deles.
--   A lista de kinds abaixo já inclui 'caixa_hx_config' (inofensivo se c5e4dcd ainda não rodou).
-- Requer as migrações já rodadas: deposito-especial, dep-esp-lote, compras-imei (88c6846).
--
-- O que faz:
--  1) enum app_role ganha 'estoque' (em transação própria — o BEGIN/COMMIT abaixo é proposital).
--  2) perm nova 'estoque'; papel estoque só pode ter a perm 'estoque' (sem caixa, vendas, finanças, admin).
--  3) estoque lê Estoque da loja (products/estoque_vendedor) e Depósito Especial (RPCs sem custo);
--     pode ajustar e transferir no Depósito Especial (entrada = compra, continua só admin).
--  4) Compras & IMEI: estoque lista compras, abre, cadastra/edita IMEIs e dá baixa (recebimento) por item.
--     Custos (custo_unit/total) só voltam para ADMIN em compras_listar/compra_detalhe/imei_buscar
--     (financeiro também deixa de ver custo nessas telas — regra "só admin vê custo").
--  5) Recebimento: purchases.recebido_sem_imei (itens sem IMEI) + IMEIs cadastrados = recebidos; status pendente/completo.
--  6) security_events: +'compra_imei_baixado', +'compra_item_recebido' (lista completa = 31).
--  Usuário estoque é criado em Usuários (edge function admin-users precisa ser republicada com 'estoque').

-- ---------- 1) enum (commit separado: valor novo de enum não pode ser usado na mesma transação) ----------
begin;
alter type public.app_role add value if not exists 'estoque';
commit;

-- ---------- 2) security_events: lista completa ----------
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
      'compra_imei_baixado','compra_item_recebido')) not valid;
  end if;
end $$;

-- ---------- 3) perms ----------
alter table public.role_perms drop constraint if exists role_perms_perm_check;
alter table public.role_perms add constraint role_perms_perm_check check (perm in ('admin','vendas','caixa','financas','estoque'));
delete from public.role_perms where role::text = 'estoque' and perm <> 'estoque';
insert into public.role_perms (role, perm) values ('estoque'::public.app_role, 'estoque'), ('admin'::public.app_role, 'estoque') on conflict do nothing;
alter table public.role_perms drop constraint if exists role_perms_estoque_so_estoque;
alter table public.role_perms add constraint role_perms_estoque_so_estoque check (role::text <> 'estoque' or perm = 'estoque');

-- ---------- 4) Estoque da loja (products não tem custo; custo fica em product_costs, só admin) ----------
drop policy if exists products_read_estoque on public.products;
create policy products_read_estoque on public.products for select to authenticated using (public.can('estoque'));
create or replace view public.estoque_vendedor with (security_invoker = true) as
select p.sku, p.marca, p.produto, p.tamanho, p.estoque from public.products p where p.ativo and (public.can('vendas') or public.can('estoque'));

-- ---------- 5) Depósito Especial ----------
create or replace function public.dep_esp_lista()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare a boolean := public.can('admin'); r jsonb;
begin
  if not (a or public.can('estoque')) then raise exception 'Sem permissão' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('sku', d.sku, 'marca', p.marca, 'produto', p.produto, 'tamanho', p.tamanho, 'qtd', d.qtd,
      'custo', case when a then d.custo end, 'total', case when a then round(d.qtd * d.custo, 2) end,
      'estoque_loja', p.estoque, 'updated_at', d.updated_at) order by d.sku), '[]') into r
  from public.deposito_especial d join public.products p on p.sku = d.sku;
  return r;
end $$;

create or replace function public.dep_esp_movs(p_limit int default 100)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare a boolean := public.can('admin'); r jsonb;
begin
  if not (a or public.can('estoque')) then raise exception 'Sem permissão' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(x order by x.id desc), '[]') into r from (
    select m.id, m.sku, p.marca, p.produto, m.tipo, m.qtd, m.qtd_antes, m.qtd_depois, case when a then m.custo_unit end custo_unit,
           m.motivo, pr.handle, m.created_at
    from public.deposito_especial_mov m join public.products p on p.sku = m.sku left join public.profiles pr on pr.id = m.created_by
    order by m.id desc limit least(greatest(coalesce(p_limit, 100), 1), 500)) x;
  return r;
end $$;

create or replace function public.dep_esp_ajuste(p_sku text, p_nova integer, p_motivo text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_mot text := left(trim(coalesce(p_motivo, '')), 200); d record;
begin
  if not (public.can('admin') or public.can('estoque')) then raise exception 'Sem permissão' using errcode = '42501'; end if;
  if length(v_mot) < 3 then raise exception 'Informe o motivo' using errcode = 'P0001'; end if;
  if p_nova is null or p_nova < 0 then raise exception 'Quantidade inválida' using errcode = 'P0001'; end if;
  select * into d from public.deposito_especial where sku = p_sku for update;
  if d.sku is null then raise exception 'Produto não está no Depósito Especial' using errcode = 'P0001'; end if;
  if p_nova = d.qtd then return jsonb_build_object('sku', p_sku, 'qtd', d.qtd, 'sem_mudanca', true); end if;
  update public.deposito_especial set qtd = p_nova, updated_at = now() where sku = p_sku;
  insert into public.deposito_especial_mov(sku, tipo, qtd, qtd_antes, qtd_depois, custo_unit, motivo)
  values (p_sku, 'ajuste', p_nova - d.qtd, d.qtd, p_nova, d.custo, v_mot);
  insert into public.security_events(kind, actor, detail) values ('dep_esp_ajuste', auth.uid(),
    jsonb_build_object('sku', p_sku, 'antes', d.qtd, 'depois', p_nova, 'motivo', v_mot));
  return jsonb_build_object('sku', p_sku, 'qtd', p_nova);
end $$;

create or replace function public.dep_esp_transferir(p_sku text, p_qtd integer, p_direcao text, p_motivo text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_mot text := left(trim(coalesce(p_motivo, '')), 200); d record; pr record; v_new integer; v_custo numeric; v_cl numeric;
begin
  if not (public.can('admin') or public.can('estoque')) then raise exception 'Sem permissão' using errcode = '42501'; end if;
  if coalesce(p_qtd, 0) <= 0 then raise exception 'Quantidade deve ser maior que zero' using errcode = 'P0001'; end if;
  if p_direcao not in ('para_loja','da_loja') then raise exception 'Direção inválida' using errcode = 'P0001'; end if;
  if v_mot = '' then v_mot := case when p_direcao = 'para_loja' then 'Transferência para a loja' else 'Transferência da loja' end; end if;
  select * into pr from public.products where sku = p_sku for update;
  if pr.sku is null then raise exception 'Produto não encontrado (%)', p_sku using errcode = 'P0001'; end if;
  insert into public.deposito_especial(sku) values (p_sku) on conflict (sku) do nothing;
  select * into d from public.deposito_especial where sku = p_sku for update;
  select custo into v_cl from public.product_costs where sku = p_sku;
  if p_direcao = 'para_loja' then
    if d.qtd < p_qtd then raise exception 'Depósito Especial só tem % un.', d.qtd using errcode = 'P0001'; end if;
    v_new := d.qtd - p_qtd; v_custo := d.custo;
    update public.deposito_especial set qtd = v_new, updated_at = now() where sku = p_sku;
    update public.products set estoque = estoque + p_qtd, updated_at = now() where sku = p_sku;
    insert into public.product_costs(sku, custo) values (p_sku, d.custo)
    on conflict (sku) do update set custo = round((greatest(pr.estoque, 0) * public.product_costs.custo + p_qtd * d.custo) / (greatest(pr.estoque, 0) + p_qtd), 2), updated_at = now();
  else
    if pr.estoque < p_qtd then raise exception 'Loja só tem % un.', pr.estoque using errcode = 'P0001'; end if;
    v_new := d.qtd + p_qtd; v_custo := round((d.qtd * d.custo + p_qtd * coalesce(v_cl, d.custo)) / v_new, 2);
    update public.products set estoque = estoque - p_qtd, updated_at = now() where sku = p_sku;
    update public.deposito_especial set qtd = v_new, custo = v_custo, updated_at = now() where sku = p_sku;
  end if;
  insert into public.deposito_especial_mov(sku, tipo, qtd, qtd_antes, qtd_depois, custo_unit, motivo)
  values (p_sku, p_direcao, case when p_direcao = 'para_loja' then -p_qtd else p_qtd end, d.qtd, v_new,
          case when p_direcao = 'para_loja' then d.custo else coalesce(v_cl, d.custo) end, v_mot);
  insert into public.security_events(kind, actor, detail) values ('dep_esp_transferencia', auth.uid(),
    jsonb_build_object('sku', p_sku, 'qtd', p_qtd, 'direcao', p_direcao, 'especial_antes', d.qtd, 'especial_depois', v_new,
                       'loja_antes', pr.estoque, 'loja_depois', pr.estoque + case when p_direcao = 'para_loja' then p_qtd else -p_qtd end, 'motivo', v_mot));
  return jsonb_build_object('sku', p_sku, 'especial', v_new, 'loja', pr.estoque + case when p_direcao = 'para_loja' then p_qtd else -p_qtd end);
end $$;

-- ---------- 6) Compras: recebimento ----------
alter table public.purchases add column if not exists recebido_sem_imei integer not null default 0;
alter table public.purchases drop constraint if exists purchases_recebido_sem_imei_check;
alter table public.purchases add constraint purchases_recebido_sem_imei_check check (recebido_sem_imei >= 0) not valid;

create or replace function public.compra_item_recebidos(p_purchase_id bigint) returns integer
language sql stable security definer set search_path = '' as $$
  select least(p.qtd, p.recebido_sem_imei + (select count(*)::int from public.compra_imeis i where i.purchase_id = p.id))
  from public.purchases p where p.id = p_purchase_id
$$;
revoke all on function public.compra_item_recebidos(bigint) from public, anon, authenticated;

drop policy if exists compras_ler on public.compras;
create policy compras_ler on public.compras for select to authenticated using (public.can('admin') or public.can('financas') or public.can('estoque'));
drop policy if exists compra_imeis_ler on public.compra_imeis;
create policy compra_imeis_ler on public.compra_imeis for select to authenticated using (public.can('admin') or public.can('financas') or public.can('estoque'));

create or replace function public.compras_listar(p_q text default null, p_limit int default 100)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare q text := nullif(lower(btrim(coalesce(p_q, ''))), ''); r jsonb; a boolean := public.can('admin');
begin
  if not (a or public.can('financas') or public.can('estoque')) then raise exception 'Sem permissão' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(x order by x.id desc), '[]') into r from (
    select y.*, case when y.recebidos >= y.unidades then 'completo' else 'pendente' end status from (
    select c.id, public.compra_numero(c.id) numero, c.data, c.fornecedor, c.observacao,
           count(p.id) itens, coalesce(sum(p.qtd), 0) unidades, case when a then coalesce(sum(p.total), 0) end total,
           (select count(*) from public.compra_imeis i join public.purchases p2 on p2.id = i.purchase_id where p2.compra_id = c.id) imeis,
           coalesce(sum(public.compra_item_recebidos(p.id)), 0) recebidos
    from public.compras c join public.purchases p on p.compra_id = c.id
    where q is null or lower(public.compra_numero(c.id)) like '%' || q || '%' or lower(coalesce(c.fornecedor, '')) like '%' || q || '%'
          or exists (select 1 from public.purchases p3 join public.products pr on pr.sku = p3.sku where p3.compra_id = c.id and lower(pr.sku || ' ' || pr.marca || ' ' || pr.produto) like '%' || q || '%')
    group by c.id order by c.id desc limit least(greatest(coalesce(p_limit, 100), 1), 500)) y) x;
  return r;
end $$;

create or replace function public.compra_detalhe(p_numero text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v bigint := nullif(regexp_replace(coalesce(p_numero, ''), '\D', '', 'g'), '')::bigint; c record; a boolean := public.can('admin'); its jsonb;
begin
  if not (a or public.can('financas') or public.can('estoque')) then raise exception 'Sem permissão' using errcode = '42501'; end if;
  select * into c from public.compras where id = v;
  if not found then raise exception 'Compra % não encontrada', p_numero using errcode = 'P0001'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('purchase_id', p.id, 'sku', p.sku, 'marca', pr.marca, 'produto', pr.produto, 'tamanho', pr.tamanho,
        'qtd', p.qtd, 'custo_unit', case when a then p.custo_unit end, 'total', case when a then p.total end,
        'recebido_sem_imei', p.recebido_sem_imei, 'recebidos', public.compra_item_recebidos(p.id),
        'status', case when public.compra_item_recebidos(p.id) >= p.qtd then 'completo' else 'pendente' end,
        'imeis', coalesce((select jsonb_agg(jsonb_build_object('slot', i.slot, 'imei1', i.imei1, 'imei2', i.imei2) order by i.slot) from public.compra_imeis i where i.purchase_id = p.id), '[]'))
      order by p.id), '[]') into its
  from public.purchases p join public.products pr on pr.sku = p.sku where p.compra_id = c.id;
  return jsonb_build_object('id', c.id, 'numero', public.compra_numero(c.id), 'data', c.data, 'created_at', c.created_at, 'fornecedor', c.fornecedor, 'observacao', c.observacao,
    'total', case when a then (select coalesce(sum(total), 0) from public.purchases where compra_id = c.id) end,
    'status', case when exists (select 1 from jsonb_array_elements(its) e where e->>'status' = 'pendente') then 'pendente' else 'completo' end,
    'itens', its);
end $$;

-- compra_imei_salvar: mesmo corpo de 88c6846, liberado também para estoque
create or replace function public.compra_imei_salvar(p_purchase_id bigint, p_slots jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare pu record; s jsonb; v_slot int; v1 text; v2 text; o record; n_ok int := 0; n_rm int := 0;
begin
  if not (public.can('admin') or public.can('estoque')) then raise exception 'Só admin ou estoque cadastra IMEI' using errcode = '42501'; end if;
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

-- Baixa de IMEI: bipa um IMEI contra uma linha da compra; vai para a próxima unidade livre.
create or replace function public.compra_imei_baixar(p_purchase_id bigint, p_imei1 text, p_imei2 text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare pu record; v1 text := nullif(regexp_replace(coalesce(p_imei1, ''), '\D', '', 'g'), '');
  v2 text := nullif(regexp_replace(coalesce(p_imei2, ''), '\D', '', 'g'), ''); v_slot int; o record; v_rec int;
begin
  if not (public.can('admin') or public.can('estoque')) then raise exception 'Sem permissão' using errcode = '42501'; end if;
  select * into pu from public.purchases where id = p_purchase_id for update;
  if not found then raise exception 'Item de compra não encontrado' using errcode = 'P0001'; end if;
  if v1 is null or v1 !~ '^\d{15}$' then raise exception 'IMEI 1 precisa ter 15 dígitos' using errcode = 'P0001'; end if;
  if v2 is not null and v2 !~ '^\d{15}$' then raise exception 'IMEI 2 precisa ter 15 dígitos' using errcode = 'P0001'; end if;
  if v1 = v2 then raise exception 'IMEI 1 e IMEI 2 iguais' using errcode = 'P0001'; end if;
  select i.*, public.compra_numero(p.compra_id) num into o from public.compra_imeis i join public.purchases p on p.id = i.purchase_id
    where i.imei1 in (v1, v2) or i.imei2 in (v1, v2) limit 1;
  if found then raise exception 'IMEI já cadastrado na compra % (unidade %)', o.num, o.slot using errcode = '23505'; end if;
  if public.compra_item_recebidos(pu.id) >= pu.qtd then raise exception 'Item já completo (% de %)', pu.qtd, pu.qtd using errcode = 'P0001'; end if;
  select min(g) into v_slot from generate_series(1, pu.qtd) g where not exists (select 1 from public.compra_imeis i where i.purchase_id = pu.id and i.slot = g);
  if v_slot is null then raise exception 'Todas as unidades já têm IMEI' using errcode = 'P0001'; end if;
  insert into public.compra_imeis (purchase_id, slot, imei1, imei2) values (pu.id, v_slot, v1, v2);
  v_rec := public.compra_item_recebidos(pu.id);
  insert into public.security_events (kind, actor, detail) values ('compra_imei_baixado', auth.uid(),
    jsonb_build_object('compra', public.compra_numero(pu.compra_id), 'purchase_id', pu.id, 'sku', pu.sku, 'slot', v_slot, 'imei1', v1, 'imei2', v2, 'recebidos', v_rec, 'qtd', pu.qtd));
  return jsonb_build_object('purchase_id', pu.id, 'slot', v_slot, 'recebidos', v_rec, 'qtd', pu.qtd,
    'status', case when v_rec >= pu.qtd then 'completo' else 'pendente' end);
end $$;

-- Recebimento de item SEM IMEI (acessórios etc.): define quantas unidades sem IMEI chegaram.
create or replace function public.compra_item_receber(p_purchase_id bigint, p_qtd integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare pu record; n_imei int; v_rec int;
begin
  if not (public.can('admin') or public.can('estoque')) then raise exception 'Sem permissão' using errcode = '42501'; end if;
  select * into pu from public.purchases where id = p_purchase_id for update;
  if not found then raise exception 'Item de compra não encontrado' using errcode = 'P0001'; end if;
  select count(*)::int into n_imei from public.compra_imeis where purchase_id = pu.id;
  if p_qtd is null or p_qtd < 0 or p_qtd + n_imei > pu.qtd then
    raise exception 'Quantidade inválida (comprado %, já com IMEI %)', pu.qtd, n_imei using errcode = 'P0001'; end if;
  if p_qtd = pu.recebido_sem_imei then return jsonb_build_object('purchase_id', pu.id, 'sem_mudanca', true); end if;
  update public.purchases set recebido_sem_imei = p_qtd where id = pu.id;
  v_rec := public.compra_item_recebidos(pu.id);
  insert into public.security_events (kind, actor, detail) values ('compra_item_recebido', auth.uid(),
    jsonb_build_object('compra', public.compra_numero(pu.compra_id), 'purchase_id', pu.id, 'sku', pu.sku, 'antes', pu.recebido_sem_imei, 'depois', p_qtd, 'recebidos', v_rec, 'qtd', pu.qtd));
  return jsonb_build_object('purchase_id', pu.id, 'recebidos', v_rec, 'qtd', pu.qtd, 'status', case when v_rec >= pu.qtd then 'completo' else 'pendente' end);
end $$;

create or replace function public.imei_buscar(p_q text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare q text := regexp_replace(coalesce(p_q, ''), '\D', '', 'g'); r jsonb; a boolean := public.can('admin');
begin
  if not (a or public.can('financas') or public.can('estoque')) then raise exception 'Sem permissão' using errcode = '42501'; end if;
  if length(q) < 4 then raise exception 'Digite pelo menos 4 dígitos do IMEI' using errcode = 'P0001'; end if;
  select coalesce(jsonb_agg(x), '[]') into r from (
    select i.imei1, i.imei2, i.slot, public.compra_numero(c.id) numero, c.id compra_id, c.data, c.fornecedor,
           p.sku, pr.marca, pr.produto, pr.tamanho, case when a then p.custo_unit end custo_unit, p.qtd
    from public.compra_imeis i join public.purchases p on p.id = i.purchase_id join public.compras c on c.id = p.compra_id
    join public.products pr on pr.sku = p.sku
    where i.imei1 like '%' || q || '%' or i.imei2 like '%' || q || '%'
    order by (i.imei1 = q or i.imei2 = q) desc, c.id desc limit 50) x;
  return r;
end $$;

revoke all on function public.dep_esp_lista(), public.dep_esp_movs(int), public.dep_esp_ajuste(text, integer, text), public.dep_esp_transferir(text, integer, text, text),
  public.compras_listar(text, int), public.compra_detalhe(text), public.compra_imei_salvar(bigint, jsonb), public.compra_imei_baixar(bigint, text, text),
  public.compra_item_receber(bigint, integer), public.imei_buscar(text) from public, anon;
grant execute on function public.dep_esp_lista(), public.dep_esp_movs(int), public.dep_esp_ajuste(text, integer, text), public.dep_esp_transferir(text, integer, text, text),
  public.compras_listar(text, int), public.compra_detalhe(text), public.compra_imei_salvar(bigint, jsonb), public.compra_imei_baixar(bigint, text, text),
  public.compra_item_receber(bigint, integer), public.imei_buscar(text) to authenticated;

notify pgrst, 'reload schema';
select 'estoque role ok' as status;
