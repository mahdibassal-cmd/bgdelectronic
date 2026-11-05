-- =====================================================================
-- BAGDA STORES — Sistema da Loja (eletrônicos) — Supabase / Postgres
-- Projeto Supabase SEPARADO do quiosque (BAGDA PERFUMES / /sistema).
-- Rode inteiro no SQL Editor. Idempotente: pode rodar de novo.
-- IMPORTANTE: copie do arquivo RAW (UTF-8), não de um editor que troque acentos:
--   https://raw.githubusercontent.com/mahdibassal-cmd/bgdelectronic/main/supabase-loja/schema.sql
--   depois: https://raw.githubusercontent.com/mahdibassal-cmd/bgdelectronic/main/supabase-loja/security.sql
--   depois: https://raw.githubusercontent.com/mahdibassal-cmd/bgdelectronic/main/supabase-loja/migration-clientes.sql
-- Segurança: RLS em TODAS as tabelas; custo só admin; caixa só admin/financeiro;
-- notas/estoque só admin/vendedor. Permissões por papel ficam em public.role_perms (fácil de mudar).
-- =====================================================================

-- ---------- Tipos ----------
do $$ begin create type public.app_role as enum ('admin','vendedor','financeiro');
exception when duplicate_object then null; end $$;
do $$ begin create type public.pay_method as enum ('dinheiro','pix','cartao');
exception when duplicate_object then null; end $$;
do $$ begin create type public.mov_tipo as enum ('venda','entrada','saida','estorno');
exception when duplicate_object then null; end $$;

-- ---------- Perfis ----------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  handle     text unique not null check (handle ~ '^@[a-z0-9_]{2,20}$'),
  nome       text not null,
  role       public.app_role not null default 'vendedor',
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- Permissões por papel (mude aqui, sem mexer em policies) ----------
-- perms: 'admin' (tudo/gestão), 'vendas' (nova nota, notas próprias, estoque consulta), 'caixa' (módulo Caixa)
create table if not exists public.role_perms (
  role public.app_role not null,
  perm text not null check (perm in ('admin','vendas','caixa')),
  primary key (role, perm)
);
insert into public.role_perms values
  ('admin','admin'), ('admin','vendas'), ('admin','caixa'),
  ('vendedor','vendas'),
  ('financeiro','caixa')
on conflict do nothing;

-- ---------- Produtos (sem custo) ----------
create table if not exists public.products (
  sku            text primary key check (sku ~ '^[A-Z0-9-]{3,20}$'),
  marca          text not null,
  produto        text not null,
  tamanho        text,
  fornecedor     text,
  preco_venda    numeric(10,2) not null check (preco_venda >= 0),
  estoque        integer not null default 0 check (estoque >= 0),
  estoque_minimo integer not null default 2 check (estoque_minimo >= 0),
  notas          text,
  ativo          boolean not null default true,
  updated_at     timestamptz not null default now()
);
create table if not exists public.product_costs (
  sku   text primary key references public.products(sku) on update cascade on delete cascade,
  custo numeric(10,2) not null check (custo >= 0),
  updated_at timestamptz not null default now()
);
create table if not exists public.purchases (
  id          bigint generated always as identity primary key,
  data        date not null default (now() at time zone 'America/Sao_Paulo')::date,
  sku         text not null references public.products(sku) on update cascade,
  fornecedor  text,
  qtd         integer not null check (qtd > 0),
  custo_unit  numeric(10,2) not null check (custo_unit >= 0),
  total       numeric(12,2) generated always as (qtd * custo_unit) stored,
  observacao  text,
  created_by  uuid not null default auth.uid() references auth.users(id),
  created_at  timestamptz not null default now()
);

-- ---------- Notas, itens e pagamentos ----------
create table if not exists public.notas (
  id           bigint generated always as identity primary key,
  data         date not null default (now() at time zone 'America/Sao_Paulo')::date,
  seller_id    uuid not null default auth.uid() references public.profiles(id),
  cliente      text check (length(cliente) <= 120),
  total        numeric(12,2) not null default 0,
  status       text not null default 'ativa' check (status in ('ativa','cancelada')),
  cancelada_em timestamptz,
  cancelada_por uuid references public.profiles(id),
  motivo_cancel text check (length(motivo_cancel) <= 300),
  created_at   timestamptz not null default now()
);
create index if not exists notas_seller_idx on public.notas(seller_id);
create index if not exists notas_created_idx on public.notas(created_at desc);

create table if not exists public.sales (
  id            bigint generated always as identity primary key,
  nota_id       bigint not null references public.notas(id) on delete cascade,
  data          date not null default (now() at time zone 'America/Sao_Paulo')::date,
  sku           text not null references public.products(sku) on update cascade,
  qtd           integer not null check (qtd > 0),
  preco_tabela  numeric(10,2),
  preco_vendido numeric(10,2) not null check (preco_vendido > 0),
  seller_id     uuid not null default auth.uid() references public.profiles(id),
  total         numeric(12,2) generated always as (qtd * preco_vendido) stored,
  created_at    timestamptz not null default now()
);
create index if not exists sales_nota_idx on public.sales(nota_id);
create index if not exists sales_seller_idx on public.sales(seller_id);

create table if not exists public.sale_costs (
  sale_id    bigint primary key references public.sales(id) on delete cascade,
  custo_unit numeric(10,2) not null default 0
);

create table if not exists public.nota_pagamentos (
  id      bigint generated always as identity primary key,
  nota_id bigint not null references public.notas(id) on delete cascade,
  metodo  public.pay_method not null,
  valor   numeric(12,2) not null check (valor > 0)
);
create index if not exists nota_pag_idx on public.nota_pagamentos(nota_id);

-- ---------- Caixa ----------
create table if not exists public.caixas (
  id     smallint generated by default as identity primary key,
  nome   text unique not null,
  metodo public.pay_method unique,          -- forma de pagamento que cai neste caixa
  ativo  boolean not null default true
);
insert into public.caixas(nome, metodo) values
  ('Caixa Dinheiro','dinheiro'), ('Caixa PIX (HX)','pix'), ('Máquina Loja','cartao')
on conflict (metodo) do update set nome = excluded.nome;  -- chave = metodo (renomear caixa não quebra re-run)

create table if not exists public.caixa_movimentos (
  id         bigint generated always as identity primary key,
  caixa_id   smallint not null references public.caixas(id),
  tipo       public.mov_tipo not null,
  valor      numeric(12,2) not null check (valor > 0),   -- sempre positivo; sinal vem do tipo
  motivo     text check (length(motivo) <= 300),
  nota_id    bigint references public.notas(id),
  user_id    uuid not null default auth.uid() references public.profiles(id),
  data       date not null default (now() at time zone 'America/Sao_Paulo')::date,
  created_at timestamptz not null default now(),
  constraint mov_motivo_manual check (tipo not in ('entrada','saida') or length(trim(coalesce(motivo,''))) >= 3),
  constraint mov_nota_venda check (tipo not in ('venda','estorno') or nota_id is not null)
);
create index if not exists mov_caixa_data_idx on public.caixa_movimentos(caixa_id, data);

create table if not exists public.caixa_sessoes (
  id                 bigint generated always as identity primary key,
  caixa_id           smallint not null references public.caixas(id),
  data               date not null default (now() at time zone 'America/Sao_Paulo')::date,
  abertura_valor     numeric(12,2) not null check (abertura_valor >= 0),
  abertura_sistema   numeric(12,2) not null,
  aberto_por         uuid not null references public.profiles(id),
  aberto_em          timestamptz not null default now(),
  fechamento_contado numeric(12,2),
  fechamento_sistema numeric(12,2),
  diferenca          numeric(12,2),
  fechado_por        uuid references public.profiles(id),
  fechado_em         timestamptz,
  obs                text check (length(obs) <= 300),
  unique (caixa_id, data)
);

-- ---------- Helpers ----------
create or replace function public.has_perm(p text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles pr join public.role_perms rp on rp.role = pr.role
                 where pr.id = auth.uid() and pr.ativo and rp.perm = p);
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$ select public.has_perm('admin') $$;
create or replace function public.is_active_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.ativo);
$$;
create or replace function public.mfa_ok() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt()->>'aal','') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified');
$$;
create or replace function public.can(p text) returns boolean
language sql stable security definer set search_path = '' as $$ select public.mfa_ok() and public.has_perm(p) $$;
revoke all on function public.has_perm(text), public.is_admin(), public.is_active_staff(), public.mfa_ok(), public.can(text) from public, anon;
grant execute on function public.has_perm(text), public.is_admin(), public.is_active_staff(), public.mfa_ok(), public.can(text) to authenticated;

-- Saldo de um caixa (soma assinada dos movimentos).
create or replace function public.caixa_saldo_calc(p_caixa smallint) returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(case when tipo in ('venda','entrada') then valor else -valor end), 0)
  from public.caixa_movimentos where caixa_id = p_caixa;
$$;
revoke all on function public.caixa_saldo_calc(smallint) from public, anon, authenticated;

-- ---------- Triggers ----------
create or replace function public.tg_sale_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_preco numeric;
begin
  update public.products set estoque = estoque - new.qtd, updated_at = now()
   where sku = new.sku and ativo and estoque >= new.qtd
  returning preco_venda into v_preco;
  if not found then raise exception 'Estoque insuficiente ou produto inativo (%)', new.sku using errcode = 'P0001'; end if;
  new.preco_tabela := v_preco;
  return new;
end $$;
create or replace function public.tg_sale_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.sale_costs(sale_id, custo_unit)
  values (new.id, coalesce((select custo from public.product_costs where sku = new.sku), 0));
  return null;
end $$;
create or replace function public.tg_purchase_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.products set estoque = estoque + new.qtd, updated_at = now() where sku = new.sku;
  insert into public.product_costs(sku, custo) values (new.sku, new.custo_unit)
  on conflict (sku) do update set custo = excluded.custo, updated_at = now();
  return null;
end $$;
create or replace function public.tg_purchase_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.products set estoque = greatest(estoque - old.qtd, 0), updated_at = now() where sku = old.sku;
  return old;
end $$;
-- Movimento manual: usuário e data sempre do servidor.
create or replace function public.tg_mov_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.user_id := coalesce(auth.uid(), new.user_id);
  new.data := (now() at time zone 'America/Sao_Paulo')::date;
  new.created_at := now();
  return new;
end $$;
revoke all on function public.tg_sale_insert(), public.tg_sale_after_insert(), public.tg_purchase_insert(),
  public.tg_purchase_delete(), public.tg_mov_insert() from public, anon, authenticated;

drop trigger if exists sale_bi on public.sales;
create trigger sale_bi before insert on public.sales for each row execute function public.tg_sale_insert();
drop trigger if exists sale_ai on public.sales;
create trigger sale_ai after insert on public.sales for each row execute function public.tg_sale_after_insert();
drop trigger if exists purchase_ai on public.purchases;
create trigger purchase_ai after insert on public.purchases for each row execute function public.tg_purchase_insert();
drop trigger if exists purchase_bd on public.purchases;
create trigger purchase_bd before delete on public.purchases for each row execute function public.tg_purchase_delete();
drop trigger if exists mov_bi on public.caixa_movimentos;
create trigger mov_bi before insert on public.caixa_movimentos for each row execute function public.tg_mov_insert();

-- ---------- RLS ----------
do $$ declare t text; begin
  foreach t in array array['profiles','role_perms','products','product_costs','purchases','notas','sales','sale_costs',
                           'nota_pagamentos','caixas','caixa_movimentos','caixa_sessoes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, public, authenticated', t);
  end loop;
end $$;

-- Privilégios mínimos (RLS filtra as linhas). Notas/itens/pagamentos/movimentos de venda só via RPC.
grant select on public.profiles, public.role_perms to authenticated;
grant update (nome, handle, role, ativo) on public.profiles to authenticated;
grant select, insert, update, delete on public.products, public.product_costs, public.purchases to authenticated;
grant select on public.notas, public.sales, public.nota_pagamentos, public.sale_costs to authenticated;
grant select on public.caixas, public.caixa_sessoes to authenticated;
grant select, insert on public.caixa_movimentos to authenticated;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (public.mfa_ok() and (id = auth.uid() or public.has_perm('admin') or public.has_perm('caixa')));
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles for update to authenticated
  using (public.can('admin')) with check (public.can('admin'));
drop policy if exists role_perms_read on public.role_perms;
create policy role_perms_read on public.role_perms for select to authenticated using (public.is_active_staff());

drop policy if exists products_read on public.products;
create policy products_read on public.products for select to authenticated using (public.can('vendas'));
drop policy if exists products_admin_all on public.products;
create policy products_admin_all on public.products for all to authenticated
  using (public.can('admin')) with check (public.can('admin'));
drop policy if exists costs_admin on public.product_costs;
create policy costs_admin on public.product_costs for all to authenticated
  using (public.can('admin')) with check (public.can('admin'));
drop policy if exists purchases_admin on public.purchases;
create policy purchases_admin on public.purchases for all to authenticated
  using (public.can('admin')) with check (public.can('admin'));
drop policy if exists sale_costs_admin on public.sale_costs;
create policy sale_costs_admin on public.sale_costs for select to authenticated using (public.can('admin'));

drop policy if exists notas_read on public.notas;
create policy notas_read on public.notas for select to authenticated
  using (public.can('vendas') and (seller_id = auth.uid() or public.has_perm('admin')));
drop policy if exists sales_read on public.sales;
create policy sales_read on public.sales for select to authenticated
  using (public.can('vendas') and (seller_id = auth.uid() or public.has_perm('admin')));
drop policy if exists nota_pag_read on public.nota_pagamentos;
create policy nota_pag_read on public.nota_pagamentos for select to authenticated
  using (exists (select 1 from public.notas n where n.id = nota_id));   -- herda a RLS de notas

drop policy if exists caixas_read on public.caixas;
create policy caixas_read on public.caixas for select to authenticated using (public.can('caixa'));
drop policy if exists mov_read on public.caixa_movimentos;
create policy mov_read on public.caixa_movimentos for select to authenticated using (public.can('caixa'));
drop policy if exists mov_manual_insert on public.caixa_movimentos;
create policy mov_manual_insert on public.caixa_movimentos for insert to authenticated
  with check (public.can('caixa') and tipo in ('entrada','saida') and nota_id is null);
drop policy if exists sessoes_read on public.caixa_sessoes;
create policy sessoes_read on public.caixa_sessoes for select to authenticated using (public.can('caixa'));

-- ---------- RPCs ----------
-- criar_nota: atômica. Itens + pagamentos (dividido permitido, soma = total) + movimentos no caixa.
-- p_items: [{"sku":"X","qtd":1,"preco_vendido":100}]  p_pagamentos: [{"metodo":"pix","valor":60},{"metodo":"dinheiro","valor":40}]
drop function if exists public.criar_nota(jsonb, jsonb, text);
drop function if exists public.criar_nota(jsonb, jsonb, text, bigint);  -- versão com cliente: recriada por migration-clientes.sql (rode de novo depois)
create or replace function public.criar_nota(p_items jsonb, p_pagamentos jsonb, p_cliente text default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint; it jsonb; pg jsonb; v_tot numeric := 0; v_pag numeric := 0; v_cx smallint;
begin
  if not public.can('vendas') then raise exception 'Sem permissão para criar nota' using errcode = '42501'; end if;
  -- Sem teto de linhas (MB 05/11/2026): não recolocar "> 30" aqui.
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Nota sem itens' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_pagamentos) is distinct from 'array' or jsonb_array_length(p_pagamentos) = 0 or jsonb_array_length(p_pagamentos) > 5 then
    raise exception 'Informe a forma de pagamento' using errcode = 'P0001'; end if;
  insert into public.notas(seller_id, cliente) values (auth.uid(), nullif(trim(p_cliente), '')) returning id into v_id;
  for it in select * from jsonb_array_elements(p_items) loop
    insert into public.sales(nota_id, sku, qtd, preco_vendido, seller_id)
    values (v_id, it->>'sku', (it->>'qtd')::int, (it->>'preco_vendido')::numeric, auth.uid());
    v_tot := v_tot + (it->>'qtd')::int * (it->>'preco_vendido')::numeric;
  end loop;
  for pg in select * from jsonb_array_elements(p_pagamentos) loop
    if coalesce((pg->>'valor')::numeric, 0) <= 0 then raise exception 'Valor de pagamento inválido' using errcode = 'P0001'; end if;
    select id into v_cx from public.caixas where metodo = (pg->>'metodo')::public.pay_method and ativo;
    if v_cx is null then raise exception 'Sem caixa para %', pg->>'metodo' using errcode = 'P0001'; end if;
    insert into public.nota_pagamentos(nota_id, metodo, valor) values (v_id, (pg->>'metodo')::public.pay_method, (pg->>'valor')::numeric);
    insert into public.caixa_movimentos(caixa_id, tipo, valor, motivo, nota_id, user_id)
    values (v_cx, 'venda', (pg->>'valor')::numeric, 'Nota ' || lpad(v_id::text, 6, '0'), v_id, auth.uid());
    v_pag := v_pag + (pg->>'valor')::numeric;
  end loop;
  if round(v_pag, 2) <> round(v_tot, 2) then
    raise exception 'Pagamentos (%) diferentes do total (%)', round(v_pag, 2), round(v_tot, 2) using errcode = 'P0001'; end if;
  update public.notas set total = v_tot where id = v_id;
  return v_id;
end $$;
revoke all on function public.criar_nota(jsonb, jsonb, text) from public, anon;
grant execute on function public.criar_nota(jsonb, jsonb, text) to authenticated;

-- cancelar_nota (admin): devolve estoque e lança estornos nos caixas.
create or replace function public.cancelar_nota(p_id bigint, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare n record; pg record;
begin
  if not public.can('admin') then raise exception 'Só admin cancela nota' using errcode = '42501'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Informe o motivo' using errcode = 'P0001'; end if;
  select * into n from public.notas where id = p_id for update;
  if not found then raise exception 'Nota não encontrada' using errcode = 'P0001'; end if;
  if n.status = 'cancelada' then raise exception 'Nota já cancelada' using errcode = 'P0001'; end if;
  update public.products p set estoque = p.estoque + s.qtd, updated_at = now()
    from (select sku, sum(qtd) qtd from public.sales where nota_id = p_id group by sku) s where p.sku = s.sku;
  for pg in select np.metodo, np.valor, c.id caixa_id from public.nota_pagamentos np join public.caixas c on c.metodo = np.metodo where np.nota_id = p_id loop
    insert into public.caixa_movimentos(caixa_id, tipo, valor, motivo, nota_id, user_id)
    values (pg.caixa_id, 'estorno', pg.valor, 'Cancelamento nota ' || lpad(p_id::text, 6, '0') || ': ' || trim(p_motivo), p_id, auth.uid());
  end loop;
  update public.notas set status = 'cancelada', cancelada_em = now(), cancelada_por = auth.uid(), motivo_cancel = trim(p_motivo) where id = p_id;
end $$;
revoke all on function public.cancelar_nota(bigint, text) from public, anon;
grant execute on function public.cancelar_nota(bigint, text) to authenticated;

-- Abertura / fechamento diário do caixa (admin/financeiro).
create or replace function public.caixa_abrir(p_caixa smallint, p_valor numeric, p_obs text default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint;
begin
  if not public.can('caixa') then raise exception 'Sem permissão de caixa' using errcode = '42501'; end if;
  insert into public.caixa_sessoes(caixa_id, abertura_valor, abertura_sistema, aberto_por, obs)
  values (p_caixa, p_valor, public.caixa_saldo_calc(p_caixa), auth.uid(), p_obs) returning id into v_id;
  return v_id;
exception when unique_violation then raise exception 'Caixa já aberto hoje' using errcode = 'P0001';
end $$;
create or replace function public.caixa_fechar(p_caixa smallint, p_contado numeric, p_obs text default null)
returns numeric language plpgsql security definer set search_path = '' as $$
declare v_sis numeric; v_dif numeric;
begin
  if not public.can('caixa') then raise exception 'Sem permissão de caixa' using errcode = '42501'; end if;
  v_sis := public.caixa_saldo_calc(p_caixa); v_dif := p_contado - v_sis;
  update public.caixa_sessoes set fechamento_contado = p_contado, fechamento_sistema = v_sis, diferenca = v_dif,
         fechado_por = auth.uid(), fechado_em = now(), obs = coalesce(p_obs, obs)
   where caixa_id = p_caixa and data = (now() at time zone 'America/Sao_Paulo')::date and fechado_em is null;
  if not found then raise exception 'Caixa não está aberto hoje (ou já foi fechado)' using errcode = 'P0001'; end if;
  return v_dif;
end $$;
revoke all on function public.caixa_abrir(smallint, numeric, text), public.caixa_fechar(smallint, numeric, text) from public, anon;
grant execute on function public.caixa_abrir(smallint, numeric, text), public.caixa_fechar(smallint, numeric, text) to authenticated;

-- ---------- Views (security_invoker => RLS de quem consulta) ----------
create or replace view public.v_nota_itens with (security_invoker = true) as
select n.id as nota_id, n.data, n.created_at, n.cliente, n.status, n.total as nota_total, pr.handle, pr.nome,
       s.sku, p.marca, p.produto, p.tamanho, s.qtd, s.preco_vendido, s.total
from public.notas n join public.sales s on s.nota_id = n.id join public.products p on p.sku = s.sku
left join public.profiles pr on pr.id = n.seller_id;

create or replace view public.v_notas with (security_invoker = true) as
select n.id as nota_id, n.data, n.created_at, n.cliente, n.status, n.total, pr.handle, pr.nome,
       (select string_agg(np.metodo::text, '+' order by np.id) from public.nota_pagamentos np where np.nota_id = n.id) as pagamento
from public.notas n left join public.profiles pr on pr.id = n.seller_id;

create or replace view public.estoque_vendedor with (security_invoker = true) as
select p.sku, p.marca, p.produto, p.tamanho, p.estoque from public.products p where p.ativo and public.can('vendas');

create or replace view public.v_report_seller with (security_invoker = true) as
select n.data, pr.handle, pr.nome, count(distinct n.id) as vendas, sum(s.qtd) as itens, sum(s.total) as faturamento
from public.notas n join public.sales s on s.nota_id = n.id left join public.profiles pr on pr.id = n.seller_id
where n.status = 'ativa' and public.has_perm('admin') group by n.data, pr.handle, pr.nome;

create or replace view public.v_report_payment with (security_invoker = true) as
select n.data, np.metodo as forma_pagamento, count(distinct n.id) as vendas, sum(np.valor) as faturamento
from public.notas n join public.nota_pagamentos np on np.nota_id = n.id
where n.status = 'ativa' and public.has_perm('admin') group by n.data, np.metodo;

create or replace view public.v_report_profit with (security_invoker = true) as
select n.data, pr.handle, sum(s.total) as faturamento, sum(s.qtd * c.custo_unit) as custo, sum(s.total - s.qtd * c.custo_unit) as lucro
from public.notas n join public.sales s on s.nota_id = n.id join public.sale_costs c on c.sale_id = s.id
left join public.profiles pr on pr.id = n.seller_id where n.status = 'ativa' group by n.data, pr.handle;

create or replace view public.v_admin_products with (security_invoker = true) as
select p.sku, p.marca, p.produto, p.tamanho, p.fornecedor, c.custo, p.preco_venda,
       case when c.custo > 0 and p.preco_venda > 0 then round((p.preco_venda - c.custo) / p.preco_venda * 100, 1) end as margem_pct,
       p.estoque, p.estoque_minimo, p.ativo, p.notas
from public.products p left join public.product_costs c on c.sku = p.sku where public.can('admin');

create or replace view public.v_caixa_saldo with (security_invoker = true) as
select c.id as caixa_id, c.nome, c.metodo,
       coalesce(sum(case when m.tipo in ('venda','entrada') then m.valor else -m.valor end), 0) as saldo,
       coalesce(sum(case when m.data = (now() at time zone 'America/Sao_Paulo')::date then case when m.tipo in ('venda','entrada') then m.valor else -m.valor end end), 0) as movimento_hoje
from public.caixas c left join public.caixa_movimentos m on m.caixa_id = c.id
where c.ativo group by c.id, c.nome, c.metodo;

create or replace view public.v_caixa_extrato with (security_invoker = true) as
select m.id, m.data, m.created_at, m.caixa_id, c.nome as caixa, m.tipo, m.valor,
       case when m.tipo in ('venda','entrada') then m.valor else -m.valor end as valor_assinado,
       m.motivo, m.nota_id, pr.handle, pr.nome
from public.caixa_movimentos m join public.caixas c on c.id = m.caixa_id left join public.profiles pr on pr.id = m.user_id;

do $$ declare v text; begin
  foreach v in array array['v_nota_itens','v_notas','estoque_vendedor','v_report_seller','v_report_payment','v_report_profit',
                           'v_admin_products','v_caixa_saldo','v_caixa_extrato'] loop
    execute format('revoke all on public.%I from anon, public', v);
    execute format('grant select on public.%I to authenticated', v);
  end loop;
end $$;
