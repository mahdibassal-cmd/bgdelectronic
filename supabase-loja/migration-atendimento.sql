-- BAGDA STORES (bagda-loja) — clientes.atendimento ("Atendimento número" no Novo cliente da Nova nota)
-- Seguro para rodar de novo. Não altera linhas existentes (coluna nullable).
alter table public.clientes add column if not exists atendimento text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'clientes_atendimento_chk') then
    alter table public.clientes add constraint clientes_atendimento_chk
      check (atendimento is null or atendimento in ('1','2','3','4','BAGDA OFFICIAL'));
  end if;
end $$;

create or replace function public.criar_cliente_atendimento(p_nome text, p_atendimento text default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint; a text := nullif(trim(coalesce(p_atendimento,'')), '');
begin
  if not (public.can('vendas') or public.can('financas')) then raise exception 'Sem permissão' using errcode = '42501'; end if;
  if length(trim(coalesce(p_nome,''))) < 2 then raise exception 'Informe o nome do cliente' using errcode = 'P0001'; end if;
  if a is not null and a not in ('1','2','3','4','BAGDA OFFICIAL') then raise exception 'Atendimento inválido' using errcode = 'P0001'; end if;
  insert into public.clientes(nome, atendimento) values (trim(p_nome), a) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.criar_cliente_atendimento(text, text) from public, anon;
grant execute on function public.criar_cliente_atendimento(text, text) to authenticated;
notify pgrst, 'reload schema';
