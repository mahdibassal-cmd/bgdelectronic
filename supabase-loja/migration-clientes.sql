-- =====================================================================
-- BAGDA STORES (bagda-loja) — Clientes, Fornecedores, Contas a pagar, Contas a receber, "Paga Depois".
-- Ordem: schema.sql -> users.sql -> security.sql -> ESTE ARQUIVO. Idempotente: pode rodar de novo.
-- Sempre que rodar schema.sql de novo, rode security.sql e depois este arquivo de novo.
-- Copie do RAW (UTF-8):
--   https://raw.githubusercontent.com/mahdibassal-cmd/bgdelectronic/main/supabase-loja/migration-clientes.sql
-- Permissões: perm 'financas' (admin + financeiro) = clientes/saldos, fornecedores, contas a pagar/receber.
--             vendedor ('vendas') só busca/cria cliente (nome, telefone, CPF/CNPJ) via RPC; não vê saldos nem contas.
-- Saldo do cliente = soma dos pagamentos "Paga Depois" de notas ativas - recebimentos. Calculado (nunca dessincroniza).
-- =====================================================================

-- ---------- Forma de pagamento "Paga Depois" (valor interno 'prazo'; sem caixa) ----------
alter type public.pay_method add value if not exists 'prazo';

-- ---------- Nova permissão 'financas' ----------
alter table public.role_perms drop constraint if exists role_perms_perm_check;
alter table public.role_perms add constraint role_perms_perm_check check (perm in ('admin','vendas','caixa','financas'));
insert into public.role_perms values ('admin','financas'), ('financeiro','financas') on conflict do nothing;

-- ---------- Validação CPF/CNPJ (só dígitos; dígitos verificadores) ----------
create or replace function public.doc_valido(p text) returns boolean
language plpgsql immutable set search_path = '' as $$
declare d text := regexp_replace(coalesce(p,''), '\D', '', 'g'); s int; r int; i int; w int[];
begin
  if d = '' then return true; end if;
  if length(d) = 11 then
    if d ~ '^(\d)\1{10}$' then return false; end if;
    s := 0; for i in 1..9 loop s := s + substr(d,i,1)::int * (11 - i); end loop;
    r := (s * 10) % 11; if r = 10 then r := 0; end if; if r <> substr(d,10,1)::int then return false; end if;
    s := 0; for i in 1..10 loop s := s + substr(d,i,1)::int * (12 - i); end loop;
    r := (s * 10) % 11; if r = 10 then r := 0; end if; return r = substr(d,11,1)::int;
  elsif length(d) = 14 then
    if d ~ '^(\d)\1{13}$' then return false; end if;
    w := array[5,4,3,2,9,8,7,6,5,4,3,2]; s := 0;
    for i in 1..12 loop s := s + substr(d,i,1)::int * w[i]; end loop;
    r := s % 11; r := case when r < 2 then 0 else 11 - r end; if r <> substr(d,13,1)::int then return false; end if;
    w := array[6,5,4,3,2,9,8,7,6,5,4,3,2]; s := 0;
    for i in 1..13 loop s := s + substr(d,i,1)::int * w[i]; end loop;
    r := s % 11; r := case when r < 2 then 0 else 11 - r end; return r = substr(d,14,1)::int;
  end if;
  return false;
end $$;

-- ---------- Tabelas ----------
create table if not exists public.clientes (
  id         bigint generated always as identity primary key,
  nome       text not null check (length(trim(nome)) between 2 and 120),
  doc        text check (doc is null or (doc ~ '^\d{11}$|^\d{14}$' and public.doc_valido(doc))),   -- CPF/CNPJ só dígitos
  telefone   text check (length(telefone) <= 30),
  email      text check (length(email) <= 160),
  endereco   text check (length(endereco) <= 300),
  obs        text check (length(obs) <= 500),
  ativo      boolean not null default true,
  created_by uuid default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now()
);
create unique index if not exists clientes_doc_uq on public.clientes(doc) where doc is not null;

create table if not exists public.fornecedores (
  id         bigint generated always as identity primary key,
  nome       text not null check (length(trim(nome)) between 2 and 120),
  cnpj       text check (cnpj is null or (cnpj ~ '^\d{11}$|^\d{14}$' and public.doc_valido(cnpj))),
  contato    text check (length(contato) <= 120),
  telefone   text check (length(telefone) <= 30),
  email      text check (length(email) <= 160),
  obs        text check (length(obs) <= 500),
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists fornecedores_cnpj_uq on public.fornecedores(cnpj) where cnpj is not null;

create table if not exists public.contas_pagar (
  id            bigint generated always as identity primary key,
  fornecedor_id bigint not null references public.fornecedores(id),
  valor         numeric(12,2) not null check (valor > 0),
  vencimento    date not null,
  descricao     text check (length(descricao) <= 300),
  created_by    uuid default auth.uid() references public.profiles(id),
  created_at    timestamptz not null default now()
);
create index if not exists contas_pagar_forn_idx on public.contas_pagar(fornecedor_id);

create table if not exists public.conta_pagamentos (          -- pagamentos feitos a fornecedores (saída do caixa)
  id         bigint generated always as identity primary key,
  conta_id   bigint not null references public.contas_pagar(id),
  valor      numeric(12,2) not null check (valor > 0),
  data       date not null,
  forma      text not null check (forma in ('dinheiro','pix','cartao','boleto','transferencia')),
  caixa_id   smallint not null references public.caixas(id),
  mov_id     bigint references public.caixa_movimentos(id),
  user_id    uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists conta_pag_conta_idx on public.conta_pagamentos(conta_id);

create table if not exists public.cliente_recebimentos (      -- cliente pagou (entrada no caixa, baixa no saldo)
  id         bigint generated always as identity primary key,
  cliente_id bigint not null references public.clientes(id),
  valor      numeric(12,2) not null check (valor > 0),
  data       date not null,
  forma      text not null check (forma in ('dinheiro','pix','cartao','transferencia')),
  caixa_id   smallint not null references public.caixas(id),
  obs        text check (length(obs) <= 300),
  mov_id     bigint references public.caixa_movimentos(id),
  user_id    uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists cli_rec_cli_idx on public.cliente_recebimentos(cliente_id);

alter table public.notas add column if not exists cliente_id bigint references public.clientes(id);
create index if not exists notas_cliente_idx on public.notas(cliente_id);

-- ---------- RLS + privilégios mínimos ----------
do $$ declare t text; begin
  foreach t in array array['clientes','fornecedores','contas_pagar','conta_pagamentos','cliente_recebimentos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, public, authenticated', t);
  end loop;
end $$;
grant select, insert, update on public.clientes, public.fornecedores to authenticated;
grant select, insert, update, delete on public.contas_pagar to authenticated;
grant select on public.conta_pagamentos, public.cliente_recebimentos to authenticated;   -- gravação só via RPC

drop policy if exists clientes_fin on public.clientes;
create policy clientes_fin on public.clientes for all to authenticated
  using (public.can('financas')) with check (public.can('financas'));
drop policy if exists fornecedores_fin on public.fornecedores;
create policy fornecedores_fin on public.fornecedores for all to authenticated
  using (public.can('financas')) with check (public.can('financas'));
drop policy if exists contas_pagar_fin on public.contas_pagar;
create policy contas_pagar_fin on public.contas_pagar for all to authenticated
  using (public.can('financas')) with check (public.can('financas'));
drop policy if exists conta_pag_fin on public.conta_pagamentos;
create policy conta_pag_fin on public.conta_pagamentos for select to authenticated using (public.can('financas'));
drop policy if exists cli_rec_fin on public.cliente_recebimentos;
create policy cli_rec_fin on public.cliente_recebimentos for select to authenticated using (public.can('financas'));

-- ---------- Log de segurança: novos tipos ----------
do $$ begin
  if to_regclass('public.security_events') is not null then
    alter table public.security_events drop constraint if exists security_events_kind_check;
    alter table public.security_events add constraint security_events_kind_check check (kind in ('failed_login','role_change','admin_added',
      'profile_added','profile_removed','lock','unlock','signout_all','fin_pagamento','fin_recebimento','fin_alteracao'));
  end if;
end $$;
create or replace function public.fin_log(p_kind text, p_detail jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if to_regclass('public.security_events') is not null then
    execute 'insert into public.security_events(kind, actor, detail) values ($1, $2, $3)' using p_kind, auth.uid(), p_detail;
  end if;
end $$;
-- alterações/remoções de cadastros financeiros ficam no log
create or replace function public.tg_fin_audit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    perform public.fin_log('fin_alteracao', jsonb_build_object('tabela', tg_table_name, 'op', tg_op, 'id', old.id));
    return old;
  end if;
  perform public.fin_log('fin_alteracao', jsonb_build_object('tabela', tg_table_name, 'op', tg_op, 'id', new.id));
  return new;
end $$;
revoke all on function public.fin_log(text, jsonb), public.tg_fin_audit() from public, anon, authenticated;
drop trigger if exists fin_audit on public.fornecedores;
create trigger fin_audit after update or delete on public.fornecedores for each row execute function public.tg_fin_audit();
drop trigger if exists fin_audit on public.contas_pagar;
create trigger fin_audit after update or delete on public.contas_pagar for each row execute function public.tg_fin_audit();
drop trigger if exists fin_audit on public.clientes;
create trigger fin_audit after update or delete on public.clientes for each row execute function public.tg_fin_audit();

-- conta com pagamento não pode ter valor reduzido abaixo do pago nem ser apagada
create or replace function public.tg_conta_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_pago numeric;
begin
  select coalesce(sum(valor),0) into v_pago from public.conta_pagamentos where conta_id = old.id;
  if tg_op = 'DELETE' then
    if v_pago > 0 then raise exception 'Conta com pagamento registrado não pode ser apagada' using errcode = 'P0001'; end if;
    return old;
  end if;
  if new.valor < v_pago then raise exception 'Valor menor que o já pago (%)', v_pago using errcode = 'P0001'; end if;
  return new;
end $$;
revoke all on function public.tg_conta_guard() from public, anon, authenticated;
drop trigger if exists conta_guard on public.contas_pagar;
create trigger conta_guard before update or delete on public.contas_pagar for each row execute function public.tg_conta_guard();

-- ---------- Vendedor: buscar / criar cliente (só nome, telefone, CPF/CNPJ) ----------
create or replace function public.buscar_clientes(p_q text)
returns table(id bigint, nome text, telefone text, doc text)
language plpgsql stable security definer set search_path = '' as $$
declare q text := lower(trim(coalesce(p_q,''))); dq text := regexp_replace(coalesce(p_q,''), '\D', '', 'g');
begin
  if not (public.can('vendas') or public.can('financas')) then raise exception 'Sem permissão' using errcode = '42501'; end if;
  if length(q) < 2 then return; end if;
  return query select c.id, c.nome, c.telefone, c.doc from public.clientes c
   where c.ativo and (lower(c.nome) like '%' || q || '%'
         or (length(dq) >= 3 and (c.doc like '%' || dq || '%' or regexp_replace(coalesce(c.telefone,''), '\D', '', 'g') like '%' || dq || '%')))
   order by c.nome limit 15;
end $$;

create or replace function public.criar_cliente(p_nome text, p_telefone text default null, p_doc text default null,
  p_email text default null, p_endereco text default null, p_obs text default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint; d text := nullif(regexp_replace(coalesce(p_doc,''), '\D', '', 'g'), '');
begin
  if not (public.can('vendas') or public.can('financas')) then raise exception 'Sem permissão' using errcode = '42501'; end if;
  if length(trim(coalesce(p_nome,''))) < 2 then raise exception 'Informe o nome do cliente' using errcode = 'P0001'; end if;
  if d is not null and not (length(d) in (11,14) and public.doc_valido(d)) then raise exception 'CPF/CNPJ inválido' using errcode = 'P0001'; end if;
  if d is not null then
    select id into v_id from public.clientes where doc = d;
    if v_id is not null then return v_id; end if;   -- já cadastrado: reaproveita
  end if;
  insert into public.clientes(nome, telefone, doc, email, endereco, obs)
  values (trim(p_nome), nullif(trim(p_telefone),''), d,
          case when public.can('financas') then nullif(trim(p_email),'') end,
          case when public.can('financas') then nullif(trim(p_endereco),'') end,
          case when public.can('financas') then nullif(trim(p_obs),'') end)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.buscar_clientes(text), public.criar_cliente(text,text,text,text,text,text) from public, anon;
grant execute on function public.buscar_clientes(text), public.criar_cliente(text,text,text,text,text,text) to authenticated;

-- ---------- criar_nota com cliente e "Paga Depois" ----------
drop function if exists public.criar_nota(jsonb, jsonb, text);
create or replace function public.criar_nota(p_items jsonb, p_pagamentos jsonb, p_cliente text default null, p_cliente_id bigint default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint; it jsonb; pg jsonb; v_tot numeric := 0; v_pag numeric := 0; v_cx smallint; v_nome text; v_prazo boolean := false;
begin
  if not public.can('vendas') then raise exception 'Sem permissão para criar nota' using errcode = '42501'; end if;
  -- Sem teto de linhas (MB 05/11/2026): não recolocar "> 30" aqui.
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Nota sem itens' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_pagamentos) is distinct from 'array' or jsonb_array_length(p_pagamentos) = 0 or jsonb_array_length(p_pagamentos) > 5 then
    raise exception 'Informe a forma de pagamento' using errcode = 'P0001'; end if;
  select bool_or(x->>'metodo' = 'prazo') into v_prazo from jsonb_array_elements(p_pagamentos) x;
  if p_cliente_id is not null then
    select nome into v_nome from public.clientes where id = p_cliente_id and ativo;
    if v_nome is null then raise exception 'Cliente não encontrado' using errcode = 'P0001'; end if;
  end if;
  if v_prazo and p_cliente_id is null then
    raise exception 'Paga Depois exige cliente cadastrado' using errcode = 'P0001'; end if;
  insert into public.notas(seller_id, cliente, cliente_id)
  values (auth.uid(), coalesce(v_nome, nullif(trim(p_cliente), '')), p_cliente_id) returning id into v_id;
  for it in select * from jsonb_array_elements(p_items) loop
    insert into public.sales(nota_id, sku, qtd, preco_vendido, seller_id)
    values (v_id, it->>'sku', (it->>'qtd')::int, (it->>'preco_vendido')::numeric, auth.uid());
    v_tot := v_tot + (it->>'qtd')::int * (it->>'preco_vendido')::numeric;
  end loop;
  for pg in select * from jsonb_array_elements(p_pagamentos) loop
    if coalesce((pg->>'valor')::numeric, 0) <= 0 then raise exception 'Valor de pagamento inválido' using errcode = 'P0001'; end if;
    insert into public.nota_pagamentos(nota_id, metodo, valor) values (v_id, (pg->>'metodo')::public.pay_method, (pg->>'valor')::numeric);
    if pg->>'metodo' <> 'prazo' then          -- Paga Depois: vai para o saldo do cliente, sem entrada no caixa
      select id into v_cx from public.caixas where metodo = (pg->>'metodo')::public.pay_method and ativo;
      if v_cx is null then raise exception 'Sem caixa para %', pg->>'metodo' using errcode = 'P0001'; end if;
      insert into public.caixa_movimentos(caixa_id, tipo, valor, motivo, nota_id, user_id)
      values (v_cx, 'venda', (pg->>'valor')::numeric, 'Nota ' || lpad(v_id::text, 6, '0'), v_id, auth.uid());
    end if;
    v_pag := v_pag + (pg->>'valor')::numeric;
  end loop;
  if round(v_pag, 2) <> round(v_tot, 2) then
    raise exception 'Pagamentos (%) diferentes do total (%)', round(v_pag, 2), round(v_tot, 2) using errcode = 'P0001'; end if;
  update public.notas set total = v_tot where id = v_id;
  return v_id;
end $$;
revoke all on function public.criar_nota(jsonb, jsonb, text, bigint) from public, anon;
grant execute on function public.criar_nota(jsonb, jsonb, text, bigint) to authenticated;
-- cancelar_nota (schema.sql) já ignora 'prazo' (não há caixa com esse método) e a nota cancelada sai do saldo.

-- ---------- Saldo do cliente ----------
create or replace function public.cliente_saldo_calc(p_cliente bigint) returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce((select sum(np.valor) from public.nota_pagamentos np join public.notas n on n.id = np.nota_id
                    where n.cliente_id = p_cliente and n.status = 'ativa' and np.metodo::text = 'prazo'), 0)
       - coalesce((select sum(r.valor) from public.cliente_recebimentos r where r.cliente_id = p_cliente), 0);
$$;
revoke all on function public.cliente_saldo_calc(bigint) from public, anon, authenticated;

-- ---------- Contas a receber: financeiro registra pagamento do cliente ----------
create or replace function public.registrar_recebimento(p_cliente bigint, p_valor numeric, p_caixa smallint,
  p_forma text default null, p_data date default null, p_obs text default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint; v_mov bigint; v_nome text; v_saldo numeric; v_met text; v_forma text;
begin
  if not public.can('financas') then raise exception 'Sem permissão (financeiro/admin)' using errcode = '42501'; end if;
  if coalesce(p_valor, 0) <= 0 then raise exception 'Valor inválido' using errcode = 'P0001'; end if;
  select nome into v_nome from public.clientes where id = p_cliente for update;   -- trava o cliente (pagamentos simultâneos)
  if v_nome is null then raise exception 'Cliente não encontrado' using errcode = 'P0001'; end if;
  select metodo::text into v_met from public.caixas where id = p_caixa and ativo;
  if v_met is null then raise exception 'Caixa inválido' using errcode = 'P0001'; end if;
  v_forma := coalesce(nullif(p_forma, ''), v_met);
  v_saldo := public.cliente_saldo_calc(p_cliente);
  if round(p_valor, 2) > round(v_saldo, 2) then
    raise exception 'Valor (%) maior que o saldo do cliente (%)', round(p_valor, 2), round(v_saldo, 2) using errcode = 'P0001'; end if;
  insert into public.caixa_movimentos(caixa_id, tipo, valor, motivo, user_id)
  values (p_caixa, 'entrada', round(p_valor, 2), left('Recebimento cliente ' || v_nome, 300), auth.uid()) returning id into v_mov;
  insert into public.cliente_recebimentos(cliente_id, valor, data, forma, caixa_id, obs, mov_id, user_id)
  values (p_cliente, round(p_valor, 2), coalesce(p_data, (now() at time zone 'America/Sao_Paulo')::date), v_forma, p_caixa,
          nullif(trim(p_obs), ''), v_mov, auth.uid()) returning id into v_id;
  perform public.fin_log('fin_recebimento', jsonb_build_object('cliente_id', p_cliente, 'valor', p_valor, 'caixa', p_caixa));
  return v_id;
end $$;

-- ---------- Contas a pagar: registrar pagamento ao fornecedor (saída do caixa) ----------
create or replace function public.pagar_conta(p_conta bigint, p_valor numeric, p_caixa smallint,
  p_forma text default null, p_data date default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare c record; v_pago numeric; v_id bigint; v_mov bigint; v_met text; v_forn text;
begin
  if not public.can('financas') then raise exception 'Sem permissão (financeiro/admin)' using errcode = '42501'; end if;
  if coalesce(p_valor, 0) <= 0 then raise exception 'Valor inválido' using errcode = 'P0001'; end if;
  select * into c from public.contas_pagar where id = p_conta for update;
  if not found then raise exception 'Conta não encontrada' using errcode = 'P0001'; end if;
  select coalesce(sum(valor), 0) into v_pago from public.conta_pagamentos where conta_id = p_conta;
  if round(v_pago + p_valor, 2) > round(c.valor, 2) then
    raise exception 'Pagamento maior que o saldo da conta (%)', round(c.valor - v_pago, 2) using errcode = 'P0001'; end if;
  select metodo::text into v_met from public.caixas where id = p_caixa and ativo;
  if v_met is null then raise exception 'Caixa inválido' using errcode = 'P0001'; end if;
  select nome into v_forn from public.fornecedores where id = c.fornecedor_id;
  insert into public.caixa_movimentos(caixa_id, tipo, valor, motivo, user_id)
  values (p_caixa, 'saida', round(p_valor, 2), left('Pagamento fornecedor ' || coalesce(v_forn, '') || ' — conta ' || p_conta, 300), auth.uid())
  returning id into v_mov;
  insert into public.conta_pagamentos(conta_id, valor, data, forma, caixa_id, mov_id, user_id)
  values (p_conta, round(p_valor, 2), coalesce(p_data, (now() at time zone 'America/Sao_Paulo')::date), coalesce(nullif(p_forma, ''), v_met),
          p_caixa, v_mov, auth.uid()) returning id into v_id;
  perform public.fin_log('fin_pagamento', jsonb_build_object('conta_id', p_conta, 'valor', p_valor, 'caixa', p_caixa));
  return v_id;
end $$;
revoke all on function public.registrar_recebimento(bigint, numeric, smallint, text, date, text),
  public.pagar_conta(bigint, numeric, smallint, text, date) from public, anon;
grant execute on function public.registrar_recebimento(bigint, numeric, smallint, text, date, text),
  public.pagar_conta(bigint, numeric, smallint, text, date) to authenticated;

-- Fiado por cliente (financeiro não lê notas pela RLS; esta função só responde para 'financas').
create or replace function public.clientes_fiado() returns table(cliente_id bigint, fiado numeric)
language sql stable security definer set search_path = '' as $$
  select n.cliente_id, sum(np.valor) from public.notas n join public.nota_pagamentos np on np.nota_id = n.id
   where public.can('financas') and n.status = 'ativa' and n.cliente_id is not null and np.metodo::text = 'prazo' group by n.cliente_id;
$$;
revoke all on function public.clientes_fiado() from public, anon;
grant execute on function public.clientes_fiado() to authenticated;

-- ---------- Views (security_invoker + filtro financas) ----------
create or replace view public.v_clientes_saldo with (security_invoker = true) as
select c.id, c.nome, c.doc, c.telefone, c.email, c.endereco, c.obs, c.ativo,
       coalesce(f.fiado, 0) as total_fiado, coalesce(r.recebido, 0) as total_recebido,
       coalesce(f.fiado, 0) - coalesce(r.recebido, 0) as saldo
from public.clientes c
left join public.clientes_fiado() f on f.cliente_id = c.id
left join (select cliente_id, sum(valor) recebido from public.cliente_recebimentos group by cliente_id) r on r.cliente_id = c.id
where public.can('financas');

create or replace view public.v_contas_pagar with (security_invoker = true) as
select cp.id, cp.fornecedor_id, f.nome as fornecedor, cp.valor, cp.vencimento, cp.descricao, cp.created_at,
       coalesce(p.pago, 0) as pago, cp.valor - coalesce(p.pago, 0) as restante,
       case when coalesce(p.pago, 0) >= cp.valor then 'paga'
            when cp.vencimento < (now() at time zone 'America/Sao_Paulo')::date then 'vencida'
            when coalesce(p.pago, 0) > 0 then 'parcial' else 'aberta' end as status
from public.contas_pagar cp join public.fornecedores f on f.id = cp.fornecedor_id
left join (select conta_id, sum(valor) pago from public.conta_pagamentos group by conta_id) p on p.conta_id = cp.id
where public.can('financas');

create or replace view public.v_recebimentos with (security_invoker = true) as
select r.id, r.cliente_id, c.nome as cliente, r.valor, r.data, r.forma, r.caixa_id, cx.nome as caixa, r.obs, pr.handle, r.created_at
from public.cliente_recebimentos r join public.clientes c on c.id = r.cliente_id join public.caixas cx on cx.id = r.caixa_id
left join public.profiles pr on pr.id = r.user_id where public.can('financas');

do $$ declare v text; begin
  foreach v in array array['v_clientes_saldo','v_contas_pagar','v_recebimentos'] loop
    execute format('revoke all on public.%I from anon, public', v);
    execute format('grant select on public.%I to authenticated', v);
  end loop;
end $$;
