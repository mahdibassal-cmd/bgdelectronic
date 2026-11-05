-- =====================================================================
-- migration-receber-caixa-especial.sql — Loja /main (bagda-loja). Idempotente.
-- NÃO executa sozinho em produção: rode no SQL Editor quando for aplicar.
--
-- Pré-requisitos, nesta ordem (funções que este arquivo reaproveita, sem recriá-las do zero):
--   schema.sql → users.sql → security.sql → migration-clientes.sql
--   → migration-caixa-resumo.sql (alocar_recebimento)
--   → fix-security-events-kinds.sql
--   → migration-caixa-geral.sql (cliente_creditos, _credito_saldo, lancar_nota_caixa base)
--   → migration-receber-credito.sql → migration-estornos.sql
--   → migration-caixa-metodo-null.sql (LARANJIHA/GETNET continuam caixas normais; este arquivo não as altera)
--   → migration-paga-depois-caixa-geral.sql (prazo_lancada_*; dívida Paga Depois já existe, não é recriada)
--   → migration-notas-dispensar.sql e migration-caixa-hx-dia.sql se já rodaram
--     (este arquivo recria v_notas_lancar / notas_lancar_financas / lancar_nota_caixa /
--      cancelar_nota / cancelar_nota_financas preservando o filtro do HX quando caixa_hx_restrito existe).
--     Se uma migration antiga desses objetos for rodada DEPOIS, rode ESTE arquivo de novo.
--
-- NÃO depende de migration-frete.sql (não aplicada em produção) nem de migration-caxinha-natal.sql.
-- NÃO substitui criar_nota nem criar_nota_local. NÃO lê nem grava notas.frete nem notas.caxinha_natal.
-- A Nova nota que já está no ar (com ou sem a assinatura p_frete / p_caxinha_natal) permanece como está.
--
-- 1) Contas a receber → Registrar pagamento → Entra no caixa = CAIXA SPECIAL.
--    Credita o ledger JÁ SEPARADO public.caixa_especial_mov (tela Caixa Especial / cxesp).
-- NÃO insere linha em public.caixas. NÃO mexe em LARANJIHA (King Bot) nem GETNET.
-- Um recebimento = exatamente UMA entrada cxesp (dívida + excedente no mesmo valor).
-- A parte da dívida usa o recebimento normal (trigger aloca nas notas, mais antiga primeiro).
-- O que passar da dívida vira crédito do cliente na Caixa Geral (cliente_creditos entrada).
-- Estorno (admin) grava UMA saída ligada (estorno_de) e desfaz o crédito do excedente.
-- Não lança em caixa_movimentos. Não estorna duas vezes.
-- Só admin de verdade (profiles.role = 'admin' e ativo, com can('admin'): 2FA e trava).
-- Financeiro, vendedor e anon são recusados no servidor.
-- Chave idempotente + trava da transação: repetir a mesma chave não gera outra entrada.
-- RLS continua: ledger só leitura admin; idempotência sem grant para anon/authenticated.
-- =====================================================================

do $$ begin
  if to_regclass('public.cliente_creditos') is null
     or to_regprocedure('public._credito_saldo(bigint)') is null then
    raise exception 'Rode migration-caixa-geral.sql antes';
  end if;
  if to_regprocedure('public.alocar_recebimento(bigint)') is null then
    raise exception 'Rode migration-caixa-resumo.sql antes';
  end if;
  if to_regprocedure('public.estornar_recebimento(bigint,text)') is null then
    raise exception 'Rode migration-estornos.sql antes';
  end if;
end $$;

-- ---------- Ledger existente (não é public.caixas) ----------
create table if not exists public.caixa_especial_mov (
  id            bigint generated always as identity primary key,
  tipo          text not null check (tipo in ('entrada','saida')),
  valor         numeric(12,2) not null check (valor > 0),
  motivo        text check (motivo is null or length(motivo) <= 300),
  cliente_id    bigint references public.clientes(id),
  credito_id    bigint references public.cliente_creditos(id),
  estorno_de    bigint references public.caixa_especial_mov(id),
  recebimento_id bigint,
  excedente_credito_id bigint references public.cliente_creditos(id),
  created_by    uuid default auth.uid() references public.profiles(id),
  created_at    timestamptz not null default now()
);

alter table public.caixa_especial_mov add column if not exists cliente_id bigint;
alter table public.caixa_especial_mov add column if not exists credito_id bigint;
alter table public.caixa_especial_mov add column if not exists estorno_de bigint;
alter table public.caixa_especial_mov add column if not exists recebimento_id bigint;
alter table public.caixa_especial_mov add column if not exists excedente_credito_id bigint;
alter table public.caixa_especial_mov add column if not exists created_by uuid;
alter table public.caixa_especial_mov add column if not exists created_at timestamptz not null default now();

do $$ begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'caixa_especial_mov' and column_name = 'tipo')
     or not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'caixa_especial_mov' and column_name = 'valor')
     or not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'caixa_especial_mov' and column_name = 'motivo') then
    raise exception 'caixa_especial_mov sem colunas tipo/valor/motivo';
  end if;
  if not exists (
    select 1 from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.conrelid = 'public.caixa_especial_mov'::regclass and c.contype = 'f' and a.attname = 'estorno_de'
  ) then
    alter table public.caixa_especial_mov
      add constraint caixa_especial_mov_estorno_de_fkey
      foreign key (estorno_de) references public.caixa_especial_mov(id);
  end if;
end $$;

create unique index if not exists cxesp_estorno_de_uq
  on public.caixa_especial_mov(estorno_de) where estorno_de is not null;
create index if not exists cxesp_recebimento_idx on public.caixa_especial_mov(recebimento_id);

alter table public.caixa_especial_mov enable row level security;
alter table public.caixa_especial_mov force row level security;
revoke all on public.caixa_especial_mov from anon, public;
revoke insert, update, delete, truncate on public.caixa_especial_mov from authenticated;
grant select on public.caixa_especial_mov to authenticated;
drop policy if exists cxesp_admin_read on public.caixa_especial_mov;
create policy cxesp_admin_read on public.caixa_especial_mov
  for select to authenticated using (public.can('admin'));

-- ---------- Idempotência (sem acesso pela API) ----------
create table if not exists public.recebimento_cxesp_idem (
  chave      text primary key check (chave ~ '^[A-Za-z0-9._:-]{8,80}$'),
  user_id    uuid not null,
  cliente_id bigint not null,
  valor      numeric(12,2) not null,
  forma      text not null,
  resultado  jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.recebimento_cxesp_idem enable row level security;
alter table public.recebimento_cxesp_idem force row level security;
revoke all on public.recebimento_cxesp_idem from anon, public, authenticated;

-- ---------- Recebimento ligado ao ledger, sem caixa do dia ----------
alter table public.cliente_recebimentos add column if not exists cxesp_id bigint;
alter table public.cliente_recebimentos add column if not exists cxesp_excedente_id bigint;

do $$ begin
  if not exists (
    select 1 from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.conrelid = 'public.cliente_recebimentos'::regclass and c.contype = 'f' and a.attname = 'cxesp_id'
  ) then
    alter table public.cliente_recebimentos
      add constraint cli_rec_cxesp_fk foreign key (cxesp_id) references public.caixa_especial_mov(id);
  end if;
end $$;
create unique index if not exists cli_rec_cxesp_uq
  on public.cliente_recebimentos(cxesp_id) where cxesp_id is not null;

alter table public.cliente_recebimentos drop constraint if exists cli_rec_caixa_ou_credito;
alter table public.cliente_recebimentos add constraint cli_rec_caixa_ou_credito check (
  (forma = 'credito' and caixa_id is null and mov_id is null and cxesp_id is null)
  or (cxesp_id is not null and caixa_id is null and mov_id is null and forma <> 'credito')
  or (cxesp_id is null and forma <> 'credito' and caixa_id is not null)
);

-- ---------- Uma linha no ledger (trava o extrato inteiro nesta transação) ----------
create or replace function public._cxesp_inserir(
  p_tipo text, p_valor numeric, p_motivo text,
  p_estorno_de bigint default null, p_cliente bigint default null, p_credito bigint default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint;
begin
  if p_tipo not in ('entrada','saida') then raise exception 'Tipo inválido' using errcode = 'P0001'; end if;
  if coalesce(p_valor, 0) <= 0 then raise exception 'Valor inválido' using errcode = 'P0001'; end if;
  perform pg_advisory_xact_lock(87234001, 1);
  insert into public.caixa_especial_mov(tipo, valor, motivo, estorno_de, cliente_id, credito_id, created_by)
  values (p_tipo, round(p_valor, 2), left(coalesce(p_motivo, ''), 300), p_estorno_de, p_cliente, p_credito, auth.uid())
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public._cxesp_inserir(text, numeric, text, bigint, bigint, bigint) from public, anon, authenticated;

-- Saída ligada à entrada. Segunda chamada devolve a mesma saída (não duplica nem reverte o crédito de novo).
create or replace function public._cxesp_estornar_entrada(
  p_mov bigint, p_rec bigint, p_motivo text, p_excedente bigint, p_cliente bigint)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_ent record; v_saida bigint; v_ex record; v_mot text := left(trim(coalesce(p_motivo, '')), 200);
begin
  perform set_config('bagda.cxesp_estorno_ok', '1', true);
  select * into v_ent from public.caixa_especial_mov where id = p_mov for update;
  if v_ent.id is null then raise exception 'Lançamento da Caixa Especial não encontrado' using errcode = 'P0001'; end if;
  if v_ent.tipo <> 'entrada' then raise exception 'Lançamento da Caixa Especial não é entrada' using errcode = 'P0001'; end if;
  select e.id into v_saida from public.caixa_especial_mov e where e.estorno_de = v_ent.id;
  if v_saida is not null then return v_saida; end if;
  if p_excedente is not null then
    perform 1 from public.clientes where id = p_cliente for update;
    select * into v_ex from public.cliente_creditos where id = p_excedente for update;
    if v_ex.id is not null and not exists (select 1 from public.cliente_creditos z where z.estorno_de = v_ex.id) then
      if round(v_ex.valor, 2) > round(public._credito_saldo(p_cliente), 2) then
        raise exception 'Crédito do excedente já foi usado (saldo R$ %)',
          replace(to_char(public._credito_saldo(p_cliente), 'FM999999990.00'), '.', ',') using errcode = 'P0001';
      end if;
      insert into public.cliente_creditos(cliente_id, tipo, valor, obs, estorno_de)
      values (p_cliente, 'uso', v_ex.valor,
              left('Estorno excedente recebimento #' || coalesce(p_rec::text, '') || ': ' || v_mot, 300), v_ex.id);
    end if;
  end if;
  v_saida := public._cxesp_inserir(
    'saida', v_ent.valor,
    left('Estorno recebimento #' || coalesce(p_rec::text, '') || ' ' ||
         coalesce((select nome from public.clientes where id = p_cliente), '') || ': ' || v_mot, 300),
    v_ent.id, p_cliente, null);
  return v_saida;
end $$;
revoke all on function public._cxesp_estornar_entrada(bigint, bigint, text, bigint, bigint) from public, anon, authenticated;

-- Estorno pelo extrato (cx_esp_estornar) não desfaz a dívida. Manda estornar em Contas a receber.
create or replace function public.tg_cxesp_bloqueia_estorno_recibo()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.estorno_de is not null
     and coalesce(current_setting('bagda.cxesp_estorno_ok', true), '') is distinct from '1'
     and exists (select 1 from public.cliente_recebimentos r where r.cxesp_id = new.estorno_de) then
    raise exception 'Entrada ligada a um recebimento: estorne em Contas a receber' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function public.tg_cxesp_bloqueia_estorno_recibo() from public, anon, authenticated;
drop trigger if exists cxesp_bloqueia_estorno_recibo on public.caixa_especial_mov;
create trigger cxesp_bloqueia_estorno_recibo
  before insert on public.caixa_especial_mov
  for each row execute function public.tg_cxesp_bloqueia_estorno_recibo();

-- Se um estornar_recebimento antigo só apagar a linha, a saída cxesp ainda nasce aqui (uma vez).
create or replace function public.tg_rec_cxesp_estorno()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.cxesp_id is not null then
    perform public._cxesp_estornar_entrada(old.cxesp_id, old.id, 'estorno', old.cxesp_excedente_id, old.cliente_id);
  end if;
  return old;
end $$;
revoke all on function public.tg_rec_cxesp_estorno() from public, anon, authenticated;
drop trigger if exists rec_cxesp_estorno on public.cliente_recebimentos;
create trigger rec_cxesp_estorno
  before delete on public.cliente_recebimentos
  for each row execute function public.tg_rec_cxesp_estorno();

-- ---------- Registrar: admin real, uma entrada, alocação, excedente, chave ----------
create or replace function public.registrar_recebimento_cxesp(
  p_cliente bigint, p_valor numeric, p_forma text,
  p_data date default null, p_obs text default null, p_chave text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_chave text := trim(coalesce(p_chave, ''));
  v_forma text := trim(coalesce(p_forma, ''));
  v_val numeric := round(coalesce(p_valor, 0), 2);
  v_nome text; v_div numeric; v_quit numeric; v_exc numeric := 0;
  v_cxesp bigint; v_rec bigint; v_nota bigint; v_cred bigint;
  v_idem record; v_out jsonb; v_cons text; v_prev jsonb;
  v_uid uuid; v_cli bigint; v_valor numeric; v_forma_idem text;
begin
  if not (public.can('admin') and exists (
        select 1 from public.profiles p
         where p.id = auth.uid() and p.role::text = 'admin' and p.ativo)) then
    raise exception 'Somente admin' using errcode = '42501';
  end if;
  if v_chave !~ '^[A-Za-z0-9._:-]{8,80}$' then
    raise exception 'Informe a chave do recebimento' using errcode = 'P0001';
  end if;
  if v_val <= 0 then raise exception 'Valor inválido' using errcode = 'P0001'; end if;
  if v_forma not in ('dinheiro','pix','cartao','transferencia') then
    raise exception 'Forma de pagamento inválida' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(87234001, hashtext(v_chave));
  select * into v_idem from public.recebimento_cxesp_idem where chave = v_chave;
  if found then
    if v_idem.user_id is distinct from auth.uid() or v_idem.cliente_id is distinct from p_cliente
       or v_idem.valor is distinct from v_val or v_idem.forma is distinct from v_forma then
      raise exception 'Chave já usada em outro recebimento' using errcode = 'P0001';
    end if;
    return v_idem.resultado || jsonb_build_object('idempotente', true);
  end if;

  begin
    select nome into v_nome from public.clientes where id = p_cliente for update;
    if v_nome is null then raise exception 'Cliente não encontrado' using errcode = 'P0001'; end if;
    v_div := greatest(round(public.cliente_saldo_calc(p_cliente), 2), 0);
    v_quit := least(v_val, v_div);
    v_exc := round(v_val - v_quit, 2);
    v_cxesp := public._cxesp_inserir('entrada', v_val, left('Recebimento cliente ' || v_nome, 300), null, p_cliente, null);
    if v_quit > 0 then
      insert into public.cliente_recebimentos(cliente_id, valor, data, forma, caixa_id, obs, mov_id, user_id, cxesp_id)
      values (p_cliente, v_quit, coalesce(p_data, (now() at time zone 'America/Sao_Paulo')::date), v_forma, null,
              nullif(left(trim(coalesce(p_obs, '')), 300), ''), null, auth.uid(), v_cxesp)
      returning id into v_rec;
      select max(nota_id) into v_nota from public.recebimento_notas where recebimento_id = v_rec;
    end if;
    if v_exc > 0 then
      insert into public.cliente_creditos(cliente_id, tipo, valor, obs)
      values (p_cliente, 'entrada', v_exc,
              case when v_nota is not null then 'Excedente pagamento nota ' || lpad(v_nota::text, 6, '0')
                   else 'Excedente pagamento (sem dívida em aberto)' end)
      returning id into v_cred;
      if v_rec is not null then
        update public.cliente_recebimentos set cxesp_excedente_id = v_cred where id = v_rec;
      end if;
      perform public.fin_log('credito_excedente', jsonb_build_object(
        'cliente_id', p_cliente, 'valor', v_exc, 'recebimento_id', v_rec, 'destino', 'cxesp', 'cxesp_id', v_cxesp));
    end if;
    update public.caixa_especial_mov
       set recebimento_id = v_rec, excedente_credito_id = v_cred
     where id = v_cxesp;
    v_out := jsonb_build_object(
      'recebimento_id', v_rec, 'quitado', v_quit, 'credito', v_exc, 'credito_id', v_cred,
      'cxesp_id', v_cxesp, 'destino', 'cxesp', 'idempotente', false);
    insert into public.recebimento_cxesp_idem(chave, user_id, cliente_id, valor, forma, resultado)
    values (v_chave, auth.uid(), p_cliente, v_val, v_forma, v_out);
    perform public.fin_log('fin_recebimento', jsonb_build_object(
      'cliente_id', p_cliente, 'valor', v_val, 'quitado', v_quit, 'credito', v_exc,
      'forma', v_forma, 'destino', 'cxesp', 'cxesp_id', v_cxesp, 'recebimento_id', v_rec, 'chave', v_chave));
    return v_out;
  exception when unique_violation then
    get stacked diagnostics v_cons = constraint_name;
    if v_cons is distinct from 'recebimento_cxesp_idem_pkey' then raise; end if;
    select resultado, user_id, cliente_id, valor, forma
      into v_prev, v_uid, v_cli, v_valor, v_forma_idem
      from public.recebimento_cxesp_idem where chave = v_chave;
    if v_prev is null
       or v_uid is distinct from auth.uid() or v_cli is distinct from p_cliente
       or v_valor is distinct from v_val or v_forma_idem is distinct from v_forma then
      raise exception 'Chave já usada em outro recebimento' using errcode = 'P0001';
    end if;
    return v_prev || jsonb_build_object('idempotente', true);
  end;
end $$;
revoke all on function public.registrar_recebimento_cxesp(bigint, numeric, text, date, text, text) from public, anon;
grant execute on function public.registrar_recebimento_cxesp(bigint, numeric, text, date, text, text) to authenticated;

-- ---------- Estorno: ramo cxesp antes do caixa do dia. Crédito e caixa normal iguais ao que já era. ----------
create or replace function public.estornar_recebimento(p_rec bigint, p_motivo text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare rc record; v_mot text := left(trim(coalesce(p_motivo, '')), 200); v_saida bigint; v_uso record; v_dev bigint; v_cli text; v_notas text;
        v_cxesp_saida bigint;
begin
  if not public.can('admin') then raise exception 'Somente admin pode estornar' using errcode = '42501'; end if;
  if length(v_mot) < 3 then raise exception 'Informe o motivo do estorno' using errcode = 'P0001'; end if;
  select * into rc from public.cliente_recebimentos where id = p_rec for update;
  if rc.id is null then
    if exists (select 1 from public.security_events se where se.kind = 'estorno_recebimento' and (se.detail->>'recebimento_id')::bigint = p_rec) then
      return jsonb_build_object('ja_estornado', true, 'recebimento_id', p_rec); end if;
    raise exception 'Recebimento não encontrado' using errcode = 'P0001'; end if;
  select nome into v_cli from public.clientes where id = rc.cliente_id for update;
  select string_agg(lpad(rn.nota_id::text, 6, '0'), ', ' order by rn.nota_id) into v_notas
    from public.recebimento_notas rn where rn.recebimento_id = rc.id;
  if rc.cxesp_id is not null then
    if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role::text = 'admin' and p.ativo) then
      raise exception 'Somente admin' using errcode = '42501';
    end if;
    v_cxesp_saida := public._cxesp_estornar_entrada(rc.cxesp_id, rc.id, v_mot, rc.cxesp_excedente_id, rc.cliente_id);
  elsif rc.forma = 'credito' then
    select * into v_uso from public.cliente_creditos kk
     where kk.recebimento_id = rc.id and kk.tipo = 'uso' and kk.cliente_id = rc.cliente_id order by kk.id limit 1;
    if v_uso.id is not null and not exists (select 1 from public.cliente_creditos e where e.estorno_de = v_uso.id) then
      insert into public.cliente_creditos(cliente_id, tipo, valor, obs, estorno_de)
      values (rc.cliente_id, 'entrada', v_uso.valor, left('Estorno recebimento #' || rc.id || coalesce(' nota ' || v_notas, '') || ': ' || v_mot, 300), v_uso.id)
      returning id into v_dev;
    elsif v_uso.id is null then
      insert into public.cliente_creditos(cliente_id, tipo, valor, obs)
      values (rc.cliente_id, 'entrada', rc.valor, left('Estorno recebimento #' || rc.id || coalesce(' nota ' || v_notas, '') || ': ' || v_mot, 300))
      returning id into v_dev;
    end if;
  elsif rc.caixa_id is not null then
    insert into public.caixa_movimentos(caixa_id, tipo, valor, motivo, user_id, forma)
    values (rc.caixa_id, 'saida', rc.valor, left('Estorno recebimento #' || rc.id || ' ' || coalesce(v_cli, '') || coalesce(' nota ' || v_notas, '') || ': ' || v_mot, 300),
            auth.uid(), rc.forma) returning id into v_saida;
  end if;
  delete from public.cliente_recebimentos where id = rc.id;   -- recebimento_notas sai por cascade
  insert into public.security_events(kind, actor, detail) values ('estorno_recebimento', auth.uid(),
    jsonb_build_object('recebimento_id', rc.id, 'cliente_id', rc.cliente_id, 'valor', rc.valor, 'forma', rc.forma, 'caixa', rc.caixa_id,
                       'mov_entrada', rc.mov_id, 'mov_saida', v_saida, 'cxesp_entrada', rc.cxesp_id, 'cxesp_saida', v_cxesp_saida,
                       'credito_devolvido_id', v_dev, 'notas', v_notas, 'motivo', v_mot));
  perform public.fin_log('fin_alteracao', jsonb_build_object('acao', 'estorno_recebimento', 'recebimento_id', rc.id, 'valor', rc.valor));
  return jsonb_build_object('recebimento_id', rc.id, 'valor', rc.valor, 'mov_saida', v_saida, 'cxesp_saida', v_cxesp_saida,
                            'credito_devolvido_id', v_dev, 'notas', v_notas);
end $$;
revoke all on function public.estornar_recebimento(bigint, text) from public, anon;
grant execute on function public.estornar_recebimento(bigint, text) to authenticated;

create or replace view public.v_recebimentos with (security_invoker = true) as
select r.id, r.cliente_id, c.nome as cliente, r.valor, r.data, r.forma, r.caixa_id,
       case when r.cxesp_id is not null then 'CAIXA SPECIAL'
            else coalesce(cx.nome, 'Caixa Geral (crédito)') end as caixa,
       r.obs, pr.handle, r.created_at
from public.cliente_recebimentos r
join public.clientes c on c.id = r.cliente_id
left join public.caixas cx on cx.id = r.caixa_id
left join public.profiles pr on pr.id = r.user_id
where public.can('financas');
revoke all on public.v_recebimentos from anon, public;
grant select on public.v_recebimentos to authenticated;

-- =====================================================================
-- 2) Notas a lançar → CAIXA SPECIAL (admin).
-- O valor para caixa (pagamentos que NÃO são Paga Depois nem crédito) vira UMA entrada cxesp.
-- Paga Depois continua dívida do cliente (cliente_saldo_calc) e só é "lançada" por lancar_nota_caixa_geral,
-- que não cria dinheiro. Crédito da Caixa Geral não entra aqui.
-- Não grava recebimento: quitação da dívida segue em Contas a receber, sem contar duas vezes.
-- Repetir o lançamento na Caixa Especial não cria outra entrada (igual ao mesmo caixa).
-- Mover para um caixa normal (lancar_nota_caixa, quem já pode lançar) estorna essa entrada (uma saída ligada)
-- e lança no caixa escolhido. Cancelar a nota estorna a entrada ligada.
-- =====================================================================

alter table public.notas add column if not exists prazo_lancada_em timestamptz;
alter table public.notas add column if not exists prazo_lancada_por uuid;
alter table public.notas add column if not exists cxesp_lancada_em timestamptz;
alter table public.notas add column if not exists cxesp_lancada_por uuid;
alter table public.notas add column if not exists cxesp_mov_id bigint;
alter table public.caixa_especial_mov add column if not exists nota_id bigint;
create index if not exists cxesp_nota_idx on public.caixa_especial_mov(nota_id);

do $$ begin
  if not exists (
    select 1 from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.conrelid = 'public.caixa_especial_mov'::regclass and c.contype = 'f' and a.attname = 'nota_id'
  ) then
    alter table public.caixa_especial_mov
      add constraint caixa_especial_mov_nota_fk foreign key (nota_id) references public.notas(id);
  end if;
  if not exists (
    select 1 from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.conrelid = 'public.notas'::regclass and c.contype = 'f' and a.attname = 'cxesp_mov_id'
  ) then
    alter table public.notas
      add constraint notas_cxesp_mov_fk foreign key (cxesp_mov_id) references public.caixa_especial_mov(id);
  end if;
end $$;

-- Estorna a entrada aberta da nota (uma saída). Segunda chamada não faz nada.
create or replace function public._cxesp_estornar_nota(p_nota bigint, p_motivo text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare n record; v_ent record; v_saida bigint;
begin
  select cxesp_mov_id into n from public.notas where id = p_nota for update;
  if n.cxesp_mov_id is null then return null; end if;
  select * into v_ent from public.caixa_especial_mov where id = n.cxesp_mov_id for update;
  if v_ent.id is null then
    update public.notas set cxesp_lancada_em = null, cxesp_lancada_por = null, cxesp_mov_id = null where id = p_nota;
    return null;
  end if;
  select e.id into v_saida from public.caixa_especial_mov e where e.estorno_de = v_ent.id;
  if v_saida is null then
    perform set_config('bagda.cxesp_estorno_ok', '1', true);
    v_saida := public._cxesp_inserir('saida', v_ent.valor, left(coalesce(p_motivo, 'Estorno nota'), 300), v_ent.id, null, null);
    update public.caixa_especial_mov set nota_id = p_nota where id = v_saida;
  end if;
  update public.notas set cxesp_lancada_em = null, cxesp_lancada_por = null, cxesp_mov_id = null where id = p_nota;
  return v_saida;
end $$;
revoke all on function public._cxesp_estornar_nota(bigint, text) from public, anon, authenticated;

create or replace function public.lancar_nota_cxesp(p_nota bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare n record; r record; v_val numeric := 0; v_nn text := lpad(p_nota::text, 6, '0'); v_id bigint; v_aberta boolean;
begin
  if not (public.can('admin') and exists (
        select 1 from public.profiles p where p.id = auth.uid() and p.role::text = 'admin' and p.ativo)) then
    raise exception 'Somente admin' using errcode = '42501';
  end if;
  select * into n from public.notas where id = p_nota for update;
  if not found then raise exception 'Nota não encontrada' using errcode = 'P0001'; end if;
  if n.status <> 'ativa' then raise exception 'Nota cancelada não pode ser lançada' using errcode = 'P0001'; end if;
  select coalesce(sum(valor), 0) into v_val from public.nota_pagamentos
   where nota_id = p_nota and metodo::text not in ('prazo','credito');
  if v_val <= 0 then raise exception 'Nota sem valor para caixa (Paga Depois / Caixa Geral)' using errcode = 'P0001'; end if;
  v_aberta := n.cxesp_mov_id is not null
    and not exists (select 1 from public.caixa_especial_mov e where e.estorno_de = n.cxesp_mov_id);
  if v_aberta then
    return jsonb_build_object('nota_id', p_nota, 'cxesp_id', n.cxesp_mov_id, 'valor', v_val, 'destino', 'cxesp', 'mudou', false);
  end if;
  for r in select caixa_id, sum(case when tipo = 'venda' then valor when tipo = 'estorno' then -valor else 0 end) liq
             from public.caixa_movimentos where nota_id = p_nota group by caixa_id loop
    if r.liq > 0 then
      insert into public.caixa_movimentos(caixa_id, tipo, valor, motivo, nota_id, user_id)
      values (r.caixa_id, 'estorno', r.liq, left('Nota ' || v_nn || ' transferida para CAIXA SPECIAL', 300), p_nota, auth.uid());
    end if;
  end loop;
  v_id := public._cxesp_inserir('entrada', v_val, 'Nota ' || v_nn, null, n.cliente_id, null);
  update public.caixa_especial_mov set nota_id = p_nota where id = v_id;
  update public.notas set caixa_lancada_id = null, lancada_em = now(), lancada_por = auth.uid(),
         cxesp_lancada_em = now(), cxesp_lancada_por = auth.uid(), cxesp_mov_id = v_id
   where id = p_nota;
  perform public.fin_log('nota_lancada', jsonb_build_object('nota_id', p_nota, 'destino', 'cxesp', 'cxesp_id', v_id, 'valor', v_val, 'antes', n.caixa_lancada_id));
  return jsonb_build_object('nota_id', p_nota, 'cxesp_id', v_id, 'valor', v_val, 'destino', 'cxesp', 'mudou', true);
end $$;
revoke all on function public.lancar_nota_cxesp(bigint) from public, anon;
grant execute on function public.lancar_nota_cxesp(bigint) to authenticated;

-- Mover para um caixa normal: estorna a Caixa Especial (uma saída) e segue o lançamento de sempre.
create or replace function public.lancar_nota_caixa(p_nota bigint, p_caixa smallint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare n record; v_cx text; r record; pg record; v_val numeric := 0; v_nn text := lpad(p_nota::text, 6, '0');
begin
  if not public.can('financas') then raise exception 'Sem permissão (financeiro/admin)' using errcode = '42501'; end if;
  select * into n from public.notas where id = p_nota for update;
  if not found then raise exception 'Nota não encontrada' using errcode = 'P0001'; end if;
  if n.status <> 'ativa' then raise exception 'Nota cancelada não pode ser lançada' using errcode = 'P0001'; end if;
  select nome into v_cx from public.caixas where id = p_caixa and ativo;
  if v_cx is null then raise exception 'Caixa inválido' using errcode = 'P0001'; end if;
  select coalesce(sum(valor), 0) into v_val from public.nota_pagamentos where nota_id = p_nota and metodo::text not in ('prazo','credito');
  if v_val <= 0 then raise exception 'Nota sem valor para caixa (Paga Depois / Caixa Geral)' using errcode = 'P0001'; end if;
  if n.caixa_lancada_id = p_caixa and n.cxesp_mov_id is null then
    return jsonb_build_object('nota_id', p_nota, 'caixa_id', p_caixa, 'valor', v_val, 'mudou', false); end if;
  perform public._cxesp_estornar_nota(p_nota, left('Nota ' || v_nn || ' transferida para ' || v_cx, 300));
  for r in select caixa_id, sum(case when tipo = 'venda' then valor when tipo = 'estorno' then -valor else 0 end) liq
             from public.caixa_movimentos where nota_id = p_nota group by caixa_id loop
    if r.liq > 0 then
      insert into public.caixa_movimentos(caixa_id, tipo, valor, motivo, nota_id, user_id)
      values (r.caixa_id, 'estorno', r.liq, left('Nota ' || v_nn || ' transferida para ' || v_cx, 300), p_nota, auth.uid());
    end if;
  end loop;
  for pg in select metodo::text m, valor from public.nota_pagamentos where nota_id = p_nota and metodo::text not in ('prazo','credito') order by id loop
    insert into public.caixa_movimentos(caixa_id, tipo, valor, motivo, nota_id, user_id, forma)
    values (p_caixa, 'venda', pg.valor, 'Nota ' || v_nn, p_nota, auth.uid(), pg.m);
  end loop;
  update public.notas set caixa_lancada_id = p_caixa, lancada_em = now(), lancada_por = auth.uid(),
         cxesp_lancada_em = null, cxesp_lancada_por = null, cxesp_mov_id = null
   where id = p_nota;
  perform public.fin_log('nota_lancada', jsonb_build_object('nota_id', p_nota, 'caixa', p_caixa, 'valor', v_val, 'antes', n.caixa_lancada_id));
  return jsonb_build_object('nota_id', p_nota, 'caixa_id', p_caixa, 'valor', v_val, 'mudou', true);
end $$;
revoke all on function public.lancar_nota_caixa(bigint, smallint) from public, anon;
grant execute on function public.lancar_nota_caixa(bigint, smallint) to authenticated;

create or replace function public.cancelar_nota_financas(p_nota bigint, p_motivo text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare n record; r record; v_nn text := lpad(p_nota::text, 6, '0'); v_est numeric := 0; v_rec numeric; v_cxesp bigint;
begin
  if not public.can('financas') then raise exception 'Sem permissão (financeiro/admin)' using errcode = '42501'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Informe o motivo' using errcode = 'P0001'; end if;
  select * into n from public.notas where id = p_nota for update;
  if not found then raise exception 'Nota não encontrada' using errcode = 'P0001'; end if;
  if n.status = 'cancelada' then raise exception 'Nota já cancelada' using errcode = 'P0001'; end if;
  select coalesce(sum(valor), 0) into v_rec from public.recebimento_notas where nota_id = p_nota;
  if v_rec > 0 then
    raise exception 'Nota % tem recebimento de R$ % em Contas a receber — estorne o recebimento antes de cancelar', v_nn,
      replace(to_char(v_rec, 'FM999999990.00'), '.', ',') using errcode = 'P0001'; end if;
  update public.products p set estoque = p.estoque + s.qtd, updated_at = now()
    from (select sku, sum(qtd) qtd from public.sales where nota_id = p_nota group by sku) s where p.sku = s.sku;
  for r in select caixa_id, forma, sum(case when tipo = 'venda' then valor when tipo = 'estorno' then -valor else 0 end) liq
             from public.caixa_movimentos where nota_id = p_nota group by caixa_id, forma loop
    if r.liq > 0 then
      insert into public.caixa_movimentos(caixa_id, tipo, valor, motivo, nota_id, user_id, forma)
      values (r.caixa_id, 'estorno', r.liq, left('Cancelamento nota ' || v_nn || ': ' || trim(p_motivo), 300), p_nota, auth.uid(), r.forma);
      v_est := v_est + r.liq;
    end if;
  end loop;
  v_cxesp := public._cxesp_estornar_nota(p_nota, left('Cancelamento nota ' || v_nn || ': ' || trim(p_motivo), 300));
  update public.notas set status = 'cancelada', cancelada_em = now(), cancelada_por = auth.uid(), motivo_cancel = left(trim(p_motivo), 300),
         caixa_lancada_id = null, lancada_em = null, lancada_por = null, prazo_lancada_em = null, prazo_lancada_por = null,
         cxesp_lancada_em = null, cxesp_lancada_por = null, cxesp_mov_id = null
   where id = p_nota;
  perform public.fin_log('nota_cancelada_financas', jsonb_build_object('nota_id', p_nota, 'motivo', trim(p_motivo), 'total', n.total,
    'estornado_caixa', v_est, 'cxesp_saida', v_cxesp, 'caixa_antes', n.caixa_lancada_id, 'cliente_id', n.cliente_id));
  return jsonb_build_object('nota_id', p_nota, 'estornado_caixa', v_est, 'cxesp_saida', v_cxesp, 'cancelada', true);
end $$;
revoke all on function public.cancelar_nota_financas(bigint, text) from public, anon;
grant execute on function public.cancelar_nota_financas(bigint, text) to authenticated;

create or replace function public.cancelar_nota(p_id bigint, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare n record; r record;
begin
  if not public.can('admin') then raise exception 'Só admin cancela nota' using errcode = '42501'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Informe o motivo' using errcode = 'P0001'; end if;
  select * into n from public.notas where id = p_id for update;
  if not found then raise exception 'Nota não encontrada' using errcode = 'P0001'; end if;
  if n.status = 'cancelada' then raise exception 'Nota já cancelada' using errcode = 'P0001'; end if;
  update public.products p set estoque = p.estoque + s.qtd, updated_at = now()
    from (select sku, sum(qtd) qtd from public.sales where nota_id = p_id group by sku) s where p.sku = s.sku;
  for r in select caixa_id, sum(case when tipo = 'venda' then valor when tipo = 'estorno' then -valor else 0 end) liq
             from public.caixa_movimentos where nota_id = p_id group by caixa_id loop
    if r.liq > 0 then
      insert into public.caixa_movimentos(caixa_id, tipo, valor, motivo, nota_id, user_id)
      values (r.caixa_id, 'estorno', r.liq, left('Cancelamento nota ' || lpad(p_id::text, 6, '0') || ': ' || trim(p_motivo), 300), p_id, auth.uid());
    end if;
  end loop;
  perform public._cxesp_estornar_nota(p_id, left('Cancelamento nota ' || lpad(p_id::text, 6, '0') || ': ' || trim(p_motivo), 300));
  update public.notas set status = 'cancelada', cancelada_em = now(), cancelada_por = auth.uid(), motivo_cancel = trim(p_motivo),
         cxesp_lancada_em = null, cxesp_lancada_por = null, cxesp_mov_id = null
   where id = p_id;
end $$;
revoke all on function public.cancelar_nota(bigint, text) from public, anon;
grant execute on function public.cancelar_nota(bigint, text) to authenticated;

create or replace function public.corrigir_pagamento_nota(p_nota bigint, p_pagamentos jsonb, p_cliente_id bigint, p_motivo text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare n record; g jsonb; v_soma numeric := 0; v_prazo boolean := false; v_agora boolean := false; v_nome text; v_antes jsonb; v_cli bigint;
begin
  if not public.can('financas') then raise exception 'Sem permissão (financeiro/admin)' using errcode = '42501'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Informe o motivo' using errcode = 'P0001'; end if;
  select * into n from public.notas where id = p_nota for update;
  if not found then raise exception 'Nota não encontrada' using errcode = 'P0001'; end if;
  if n.status <> 'ativa' then raise exception 'Nota cancelada' using errcode = 'P0001'; end if;
  if n.caixa_lancada_id is not null or n.cxesp_lancada_em is not null
     or exists (select 1 from public.caixa_movimentos where nota_id = p_nota) then
    raise exception 'Nota já lançada em caixa — não dá para corrigir; cancele e refaça' using errcode = 'P0001'; end if;
  if exists (select 1 from public.recebimento_notas where nota_id = p_nota) then
    raise exception 'Nota tem recebimento em Contas a receber — estorne antes' using errcode = 'P0001'; end if;
  if exists (select 1 from public.nota_pagamentos where nota_id = p_nota and metodo::text = 'credito')
     or exists (select 1 from public.cliente_creditos where nota_id = p_nota) then
    raise exception 'Nota paga com crédito da Caixa Geral — cancele e refaça' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_pagamentos) is distinct from 'array' or jsonb_array_length(p_pagamentos) = 0 or jsonb_array_length(p_pagamentos) > 5 then
    raise exception 'Informe a forma de pagamento' using errcode = 'P0001'; end if;
  for g in select * from jsonb_array_elements(p_pagamentos) loop
    if coalesce(g->>'metodo', '') not in ('dinheiro','pix','cartao','prazo') then raise exception 'Forma inválida: %', g->>'metodo' using errcode = 'P0001'; end if;
    if coalesce(nullif(g->>'valor', '')::numeric, 0) <= 0 then raise exception 'Valor de pagamento inválido' using errcode = 'P0001'; end if;
    v_soma := v_soma + round((g->>'valor')::numeric, 2);
    if g->>'metodo' = 'prazo' then v_prazo := true; else v_agora := true; end if;
  end loop;
  if round(v_soma, 2) <> round(n.total, 2) then
    raise exception 'Pagamentos (%) diferentes do total da nota (%)', round(v_soma, 2), round(n.total, 2) using errcode = 'P0001'; end if;
  v_cli := coalesce(p_cliente_id, n.cliente_id);
  if v_cli is not null then
    select nome into v_nome from public.clientes where id = v_cli and ativo;
    if v_nome is null then raise exception 'Cliente não encontrado' using errcode = 'P0001'; end if;
  end if;
  if v_prazo and v_cli is null then raise exception 'Paga Depois exige cliente cadastrado' using errcode = 'P0001'; end if;
  select jsonb_agg(jsonb_build_object('metodo', metodo::text, 'valor', valor) order by id) into v_antes from public.nota_pagamentos where nota_id = p_nota;
  delete from public.nota_pagamentos where nota_id = p_nota;
  for g in select * from jsonb_array_elements(p_pagamentos) loop
    insert into public.nota_pagamentos(nota_id, metodo, valor) values (p_nota, (g->>'metodo')::public.pay_method, round((g->>'valor')::numeric, 2));
  end loop;
  update public.notas set cliente_id = v_cli, cliente = coalesce(v_nome, cliente),
         local_pagamento = case when v_agora then local_pagamento end, prazo_lancada_em = null, prazo_lancada_por = null
   where id = p_nota;
  perform public.fin_log('nota_pag_corrigido', jsonb_build_object('nota_id', p_nota, 'motivo', trim(p_motivo), 'antes', v_antes,
    'depois', p_pagamentos, 'cliente_antes', n.cliente_id, 'cliente_depois', v_cli));
  return jsonb_build_object('nota_id', p_nota, 'cliente_id', v_cli, 'divida_cliente', case when v_cli is not null then public.cliente_saldo_calc(v_cli) end);
end $$;
revoke all on function public.corrigir_pagamento_nota(bigint, jsonb, bigint, text) from public, anon;
grant execute on function public.corrigir_pagamento_nota(bigint, jsonb, bigint, text) to authenticated;

-- Lista: coluna nova no fim. Caixa Especial conta como lançada, sem virar movimento de caixa do dia.
do $view$ begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='notas' and column_name='dispensada_em') then
    execute $v$
      create or replace view public.v_notas_lancar with (security_invoker = true) as
      select n.id as nota_id, n.data, n.created_at, n.cliente, n.local_pagamento, n.obs_pagamento, pr.handle, n.total,
             (select coalesce(sum(valor), 0) from public.nota_pagamentos g where g.nota_id = n.id and g.metodo::text not in ('prazo','credito')) as valor_caixa,
             (select string_agg(g.metodo::text || ':' || g.valor, '+' order by g.id) from public.nota_pagamentos g where g.nota_id = n.id) as pagamentos,
             n.caixa_lancada_id, n.lancada_em,
             exists (select 1 from public.caixa_movimentos m where m.nota_id = n.id) as tem_movimento,
             nullif(concat_ws(', ', case when n.cxesp_lancada_em is not null then 'CAIXA SPECIAL' end,
               (select string_agg(x.nome, ', ') from (select c.nome from public.caixa_movimentos m join public.caixas c on c.id = m.caixa_id
                  where m.nota_id = n.id group by c.nome having sum(case when m.tipo = 'venda' then m.valor when m.tipo = 'estorno' then -m.valor else 0 end) > 0) x)), '') as caixas_mov,
             n.cliente_id, cl.nome as cliente_nome,
             (select coalesce(sum(valor), 0) from public.nota_pagamentos g where g.nota_id = n.id and g.metodo::text = 'prazo') as valor_prazo,
             n.prazo_lancada_em, n.dispensada_em, n.dispensa_motivo, pd.handle as dispensada_por,
             (n.cxesp_lancada_em is not null) as cxesp_lancada
      from public.notas n left join public.profiles pr on pr.id = n.seller_id
      left join public.clientes cl on cl.id = n.cliente_id
      left join public.profiles pd on pd.id = n.dispensada_por
      where public.can('financas') and n.status = 'ativa'
    $v$;
  elsif exists (select 1 from information_schema.columns where table_schema='public' and table_name='notas' and column_name='prazo_lancada_em') then
    execute $v$
      create or replace view public.v_notas_lancar with (security_invoker = true) as
      select n.id as nota_id, n.data, n.created_at, n.cliente, n.local_pagamento, n.obs_pagamento, pr.handle, n.total,
             (select coalesce(sum(valor), 0) from public.nota_pagamentos g where g.nota_id = n.id and g.metodo::text not in ('prazo','credito')) as valor_caixa,
             (select string_agg(g.metodo::text || ':' || g.valor, '+' order by g.id) from public.nota_pagamentos g where g.nota_id = n.id) as pagamentos,
             n.caixa_lancada_id, n.lancada_em,
             exists (select 1 from public.caixa_movimentos m where m.nota_id = n.id) as tem_movimento,
             nullif(concat_ws(', ', case when n.cxesp_lancada_em is not null then 'CAIXA SPECIAL' end,
               (select string_agg(x.nome, ', ') from (select c.nome from public.caixa_movimentos m join public.caixas c on c.id = m.caixa_id
                  where m.nota_id = n.id group by c.nome having sum(case when m.tipo = 'venda' then m.valor when m.tipo = 'estorno' then -m.valor else 0 end) > 0) x)), '') as caixas_mov,
             n.cliente_id, cl.nome as cliente_nome,
             (select coalesce(sum(valor), 0) from public.nota_pagamentos g where g.nota_id = n.id and g.metodo::text = 'prazo') as valor_prazo,
             n.prazo_lancada_em,
             (n.cxesp_lancada_em is not null) as cxesp_lancada
      from public.notas n left join public.profiles pr on pr.id = n.seller_id
      left join public.clientes cl on cl.id = n.cliente_id
      where public.can('financas') and n.status = 'ativa'
    $v$;
  else
    execute $v$
      create or replace view public.v_notas_lancar with (security_invoker = true) as
      select n.id as nota_id, n.data, n.created_at, n.cliente, n.local_pagamento, n.obs_pagamento, pr.handle, n.total,
             (select coalesce(sum(valor), 0) from public.nota_pagamentos g where g.nota_id = n.id and g.metodo::text not in ('prazo','credito')) as valor_caixa,
             (select string_agg(g.metodo::text || ':' || g.valor, '+' order by g.id) from public.nota_pagamentos g where g.nota_id = n.id) as pagamentos,
             n.caixa_lancada_id, n.lancada_em,
             exists (select 1 from public.caixa_movimentos m where m.nota_id = n.id) as tem_movimento,
             nullif(concat_ws(', ', case when n.cxesp_lancada_em is not null then 'CAIXA SPECIAL' end,
               (select string_agg(x.nome, ', ') from (select c.nome from public.caixa_movimentos m join public.caixas c on c.id = m.caixa_id
                  where m.nota_id = n.id group by c.nome having sum(case when m.tipo = 'venda' then m.valor when m.tipo = 'estorno' then -m.valor else 0 end) > 0) x)), '') as caixas_mov,
             (n.cxesp_lancada_em is not null) as cxesp_lancada
      from public.notas n left join public.profiles pr on pr.id = n.seller_id
      where public.can('financas') and n.status = 'ativa'
    $v$;
  end if;
end $view$;
revoke all on public.v_notas_lancar from anon, public;
grant select on public.v_notas_lancar to authenticated;

create or replace function public.notas_lancar_financas(p_limit int default 300)
returns setof public.v_notas_lancar
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.can('financas') then raise exception 'Sem permissão (financeiro/admin)' using errcode = '42501'; end if;
  if to_regprocedure('public.caixa_hx_restrito(smallint)') is not null then
    return query select v.* from public.v_notas_lancar v
      where not (v.caixa_lancada_id is not null and public.caixa_hx_restrito(v.caixa_lancada_id)
                 and (v.lancada_em at time zone 'America/Sao_Paulo')::date < (now() at time zone 'America/Sao_Paulo')::date)
      order by v.created_at desc limit least(greatest(coalesce(p_limit, 300), 1), 1000);
  else
    return query select v.* from public.v_notas_lancar v
      order by v.created_at desc limit least(greatest(coalesce(p_limit, 300), 1), 1000);
  end if;
end $$;
revoke all on function public.notas_lancar_financas(int) from public, anon;
grant execute on function public.notas_lancar_financas(int) to authenticated;

notify pgrst, 'reload schema';
select 'receber_caixa_especial ok' as status;
