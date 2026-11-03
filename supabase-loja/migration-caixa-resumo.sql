-- BAGDA STORES — Resumo do dia por caixa + vínculo de cada movimento à nota que ele paga.
-- Idempotente. Rodar DEPOIS de migration-clientes.sql (ordem: schema → users → security → migration-clientes → migration-caixa-resumo).
-- Raw: https://raw.githubusercontent.com/mahdibassal-cmd/bgdelectronic/main/supabase-loja/migration-caixa-resumo.sql

-- Recebimento "Paga Depois" -> notas que ele quita (mais antiga primeiro).
create table if not exists public.recebimento_notas (
  recebimento_id bigint not null references public.cliente_recebimentos(id) on delete cascade,
  nota_id        bigint not null references public.notas(id),
  valor          numeric(12,2) not null check (valor > 0),
  primary key (recebimento_id, nota_id)
);
create index if not exists rec_notas_nota_idx on public.recebimento_notas(nota_id);
alter table public.recebimento_notas enable row level security;
alter table public.recebimento_notas force row level security;
revoke all on public.recebimento_notas from anon, authenticated;
grant select on public.recebimento_notas to authenticated;
drop policy if exists rec_notas_read on public.recebimento_notas;
create policy rec_notas_read on public.recebimento_notas for select to authenticated using (public.can('financas') or public.can('caixa'));

-- Forma do movimento (dinheiro/pix/cartao/transferencia/boleto). Backfill abaixo.
alter table public.caixa_movimentos add column if not exists forma text;

create or replace function public.alocar_recebimento(p_rec bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare r record; n record; v_rest numeric; v_open numeric; v_a numeric;
begin
  select * into r from public.cliente_recebimentos where id = p_rec;
  if r.id is null then return; end if;
  v_rest := r.valor - coalesce((select sum(valor) from public.recebimento_notas where recebimento_id = p_rec), 0);
  for n in
    select x.id, sum(np.valor) prazo from public.notas x
      join public.nota_pagamentos np on np.nota_id = x.id and np.metodo::text = 'prazo'
     where x.cliente_id = r.cliente_id and x.status = 'ativa'
     group by x.id, x.created_at order by x.created_at, x.id
  loop
    exit when v_rest <= 0;
    v_open := n.prazo - coalesce((select sum(valor) from public.recebimento_notas where nota_id = n.id), 0);
    continue when v_open <= 0;
    v_a := least(v_open, v_rest);
    insert into public.recebimento_notas(recebimento_id, nota_id, valor) values (p_rec, n.id, v_a)
      on conflict (recebimento_id, nota_id) do update set valor = public.recebimento_notas.valor + excluded.valor;
    v_rest := v_rest - v_a;
  end loop;
end $$;
revoke all on function public.alocar_recebimento(bigint) from public, anon, authenticated;

create or replace function public.tg_rec_alocar() returns trigger
language plpgsql security definer set search_path = '' as $$
begin perform public.alocar_recebimento(new.id); return null; end $$;
revoke all on function public.tg_rec_alocar() from public, anon, authenticated;
drop trigger if exists rec_alocar on public.cliente_recebimentos;
create trigger rec_alocar after insert on public.cliente_recebimentos for each row execute function public.tg_rec_alocar();

-- Forma automática em todo movimento novo (venda/estorno = método do caixa; recebimento/pagamento atualizam depois).
create or replace function public.tg_mov_forma() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.forma is null then select metodo::text into new.forma from public.caixas where id = new.caixa_id; end if;
  return new;
end $$;
revoke all on function public.tg_mov_forma() from public, anon, authenticated;
drop trigger if exists mov_forma on public.caixa_movimentos;
create trigger mov_forma before insert on public.caixa_movimentos for each row execute function public.tg_mov_forma();

create or replace function public.tg_link_forma() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.mov_id is not null then update public.caixa_movimentos set forma = new.forma where id = new.mov_id; end if;
  return null;
end $$;
revoke all on function public.tg_link_forma() from public, anon, authenticated;
drop trigger if exists rec_forma on public.cliente_recebimentos;
create trigger rec_forma after insert on public.cliente_recebimentos for each row execute function public.tg_link_forma();
drop trigger if exists cpag_forma on public.conta_pagamentos;
create trigger cpag_forma after insert on public.conta_pagamentos for each row execute function public.tg_link_forma();

-- Backfill (idempotente).
update public.caixa_movimentos m set forma = r.forma from public.cliente_recebimentos r where r.mov_id = m.id and m.forma is null;
update public.caixa_movimentos m set forma = p.forma from public.conta_pagamentos p where p.mov_id = m.id and m.forma is null;
update public.caixa_movimentos m set forma = c.metodo::text from public.caixas c where c.id = m.caixa_id and m.forma is null;
do $$ declare r record; begin
  for r in select id from public.cliente_recebimentos x
            where not exists (select 1 from public.recebimento_notas y where y.recebimento_id = x.id) order by created_at, id
  loop perform public.alocar_recebimento(r.id); end loop;
end $$;

-- Resumo do dia (admin/financeiro). Datas em America/Sao_Paulo.
create or replace function public.caixa_resumo(p_caixa smallint, p_data date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v jsonb; v_ini numeric; v_fim numeric;
begin
  if not (public.can('caixa') and (public.has_perm('admin') or public.has_perm('financas'))) then
    raise exception 'Sem permissão (admin/financeiro)' using errcode = '42501'; end if;
  select coalesce(sum(case when tipo in ('venda','entrada') then valor else -valor end), 0) into v_ini
    from public.caixa_movimentos where caixa_id = p_caixa and data < p_data;
  select coalesce(sum(case when tipo in ('venda','entrada') then valor else -valor end), 0) + v_ini into v_fim
    from public.caixa_movimentos where caixa_id = p_caixa and data = p_data;
  with mv as (
    select m.id, m.tipo::text tipo, m.valor, case when m.tipo in ('venda','entrada') then m.valor else -m.valor end assinado,
           m.forma, m.motivo, m.created_at,
           to_char(m.created_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') hora,
           p.nome usuario, r.id rec_id, cp.id cpag_id,
           coalesce(n.cliente, cl.nome, f.nome) cliente,
           case when m.nota_id is not null then lpad(m.nota_id::text, 6, '0')
                when r.id is not null then (select string_agg(lpad(rn.nota_id::text, 6, '0') || ' (R$ ' || to_char(rn.valor, 'FM999999990.00') || ')', ', ' order by rn.nota_id)
                                              from public.recebimento_notas rn where rn.recebimento_id = r.id) end notas
      from public.caixa_movimentos m
      left join public.profiles p on p.id = m.user_id
      left join public.notas n on n.id = m.nota_id
      left join public.cliente_recebimentos r on r.mov_id = m.id
      left join public.clientes cl on cl.id = r.cliente_id
      left join public.conta_pagamentos cp on cp.mov_id = m.id
      left join public.contas_pagar ct on ct.id = cp.conta_id
      left join public.fornecedores f on f.id = ct.fornecedor_id
     where m.caixa_id = p_caixa and m.data = p_data)
  select jsonb_build_object(
    'caixa', (select nome from public.caixas where id = p_caixa), 'data', p_data,
    'saldo_inicial', v_ini, 'saldo_final', v_fim,
    'sessao', (select jsonb_build_object('abertura_valor', s.abertura_valor, 'aberto_por', pa.nome,
                 'aberto_em', to_char(s.aberto_em at time zone 'America/Sao_Paulo', 'HH24:MI'),
                 'fechamento_contado', s.fechamento_contado, 'fechamento_sistema', s.fechamento_sistema, 'diferenca', s.diferenca,
                 'fechado_por', pf.nome, 'fechado_em', to_char(s.fechado_em at time zone 'America/Sao_Paulo', 'HH24:MI'))
                 from public.caixa_sessoes s left join public.profiles pa on pa.id = s.aberto_por left join public.profiles pf on pf.id = s.fechado_por
                where s.caixa_id = p_caixa and s.data = p_data),
    'movimentos', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'hora', hora, 'tipo', tipo, 'valor', valor, 'assinado', assinado,
                 'forma', forma, 'nota', notas, 'cliente', cliente, 'usuario', usuario, 'motivo', motivo) order by created_at, id) from mv), '[]'),
    'por_forma', coalesce((select jsonb_object_agg(coalesce(forma, '-'), t) from (select forma, sum(assinado) t from mv group by forma) z), '{}'),
    'entradas', (select coalesce(sum(valor), 0) from mv where assinado > 0),
    'saidas',   (select coalesce(sum(valor), 0) from mv where assinado < 0)
  ) into v;
  return v;
end $$;
revoke all on function public.caixa_resumo(smallint, date) from public, anon;
grant execute on function public.caixa_resumo(smallint, date) to authenticated;
