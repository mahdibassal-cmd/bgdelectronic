-- DRAFT — não aplicar em produção até o dono pedir. Não apaga nem funde cadastro.
-- BAGDA STORES /main (bagda-loja, projeto xvsxnicmpkvzzhkkqgam).
-- Impede criar ou renomear um cliente para um nome que já existe.
-- Comparação: trim, espaços internos colapsados, sem acento, sem diferença de maiúsculas.
-- CPF/CNPJ (coluna doc) e telefone, quando preenchidos, também não podem repetir
-- (só os dígitos; vazio não conta).
--
-- Por que TRIGGER e não índice único na expressão normalizada:
-- Já existe duplicata real: 'brenda apple' é o cliente #49 e o #50.
-- CREATE UNIQUE INDEX nessa chave abortaria a migração por causa dessas duas linhas.
-- 'tiago belmonts' #87 está sendo removido à parte (em 2026-11-12 só restava o #43).
-- Este arquivo não apaga o #87 e não exige que ele já tenha saído: linhas antigas
-- repetidas continuam lá. O trigger só dispara em INSERT e em UPDATE de nome, doc
-- ou telefone, então aplicar este SQL não falha nos dados que já estão gravados
-- e não impede editar e-mail/endereço/obs de um cadastro repetido.
-- Não há índice único de telefone pelo mesmo motivo: se aparecer duplicata de
-- telefone antes de rodar, um índice único quebraria a migração. doc já tem
-- clientes_doc_uq; o trigger só troca o erro genérico por uma frase em português.
--
-- unaccent não está instalado neste projeto. O bloco abaixo tenta criar a extensão
-- (schema extensions, como no Supabase, e depois public). Se não houver permissão
-- ou o módulo não existir, a comparação usa translate dos acentos do português.
-- Rodar como postgres no SQL editor (o dono da função precisa de BYPASSRLS para
-- o trigger enxergar todos os clientes com FORCE ROW LEVEL SECURITY).
-- Idempotente.

do $$
begin
  begin
    execute 'create extension if not exists unaccent with schema extensions';
  exception when others then
    begin
      execute 'create extension if not exists unaccent';
    exception when others then
      raise notice 'unaccent indisponível (%). Nomes são comparados por tradução de acentos.', sqlerrm;
    end;
  end;
end $$;

create or replace function public.cliente_nome_norm(p text)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  s text := replace(replace(replace(coalesce(p, ''), chr(160), ' '), chr(9), ' '), chr(10), ' ');
  fn regprocedure;
begin
  s := regexp_replace(btrim(s), '[[:space:]]+', ' ', 'g');
  if s = '' then
    return '';
  end if;
  fn := coalesce(
    pg_catalog.to_regprocedure('extensions.unaccent(text)'),
    pg_catalog.to_regprocedure('public.unaccent(text)')
  );
  if fn is not null then
    begin
      execute format('select %s($1)', fn::text) into s using s;
    exception when undefined_function then
      fn := null;
    end;
  end if;
  if fn is null then
    s := translate(s,
      'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñÝýÿ',
      'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNnYyy');
  end if;
  return lower(s);
end $$;

revoke all on function public.cliente_nome_norm(text) from public, anon, authenticated;

create or replace function public.tg_clientes_sem_duplicata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nome text := public.cliente_nome_norm(new.nome);
  v_doc text := nullif(regexp_replace(coalesce(new.doc, ''), '\D', '', 'g'), '');
  v_tel text := nullif(regexp_replace(coalesce(new.telefone, ''), '\D', '', 'g'), '');
  v_old_nome text := case when tg_op = 'UPDATE' then public.cliente_nome_norm(old.nome) else null end;
  v_old_doc text := case when tg_op = 'UPDATE' then nullif(regexp_replace(coalesce(old.doc, ''), '\D', '', 'g'), '') else null end;
  v_old_tel text := case when tg_op = 'UPDATE' then nullif(regexp_replace(coalesce(old.telefone, ''), '\D', '', 'g'), '') else null end;
  v_id bigint;
  v_ex text;
begin
  -- E-mail, endereço e obs não passam por aqui (UPDATE OF). Se o nome/doc/telefone
  -- normalizado não mudou, deixa gravar — inclusive numa duplicata que já existe.
  if tg_op = 'UPDATE'
     and v_nome is not distinct from v_old_nome
     and v_doc is not distinct from v_old_doc
     and v_tel is not distinct from v_old_tel
  then
    return new;
  end if;

  if tg_op = 'INSERT' or v_nome is distinct from v_old_nome then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('bagda.cliente.nome.' || v_nome));
    select c.id, c.nome into v_id, v_ex
      from public.clientes c
     where c.id is distinct from new.id
       and public.cliente_nome_norm(c.nome) = v_nome
     order by c.ativo desc, c.id
     limit 1;
    if v_id is not null then
      raise exception 'Já existe um cliente com esse nome: % (#%). Use o cadastro existente.', v_ex, v_id
        using errcode = 'P0001';
    end if;
  end if;

  if v_doc is not null and (tg_op = 'INSERT' or v_doc is distinct from v_old_doc) then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('bagda.cliente.doc.' || v_doc));
    select c.id, c.nome into v_id, v_ex
      from public.clientes c
     where c.id is distinct from new.id
       and nullif(regexp_replace(coalesce(c.doc, ''), '\D', '', 'g'), '') = v_doc
     order by c.ativo desc, c.id
     limit 1;
    if v_id is not null then
      raise exception 'Já existe um cliente com esse CPF/CNPJ: % (#%). Use o cadastro existente.', v_ex, v_id
        using errcode = 'P0001';
    end if;
  end if;

  if v_tel is not null and (tg_op = 'INSERT' or v_tel is distinct from v_old_tel) then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('bagda.cliente.tel.' || v_tel));
    select c.id, c.nome into v_id, v_ex
      from public.clientes c
     where c.id is distinct from new.id
       and nullif(regexp_replace(coalesce(c.telefone, ''), '\D', '', 'g'), '') = v_tel
     order by c.ativo desc, c.id
     limit 1;
    if v_id is not null then
      raise exception 'Já existe um cliente com esse telefone: % (#%). Use o cadastro existente.', v_ex, v_id
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end $$;

revoke all on function public.tg_clientes_sem_duplicata() from public, anon;
-- O financeiro grava em clientes direto (RLS). Sem EXECUTE o UPDATE/INSERT dispara
-- "permission denied for function". A função só roda como trigger.
grant execute on function public.tg_clientes_sem_duplicata() to authenticated;

drop trigger if exists clientes_sem_duplicata on public.clientes;
create trigger clientes_sem_duplicata
  before insert or update of nome, doc, telefone on public.clientes
  for each row execute function public.tg_clientes_sem_duplicata();

-- Vendedor não lê a tabela (RLS de financas). Esta RPC devolve o cadastro existente
-- pela mesma chave do trigger, para a tela oferecer "usar este cliente" antes do insert.
create or replace function public.cliente_por_nome(p_nome text)
returns table(id bigint, nome text, telefone text, doc text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare k text := public.cliente_nome_norm(p_nome);
begin
  if not (public.can('vendas') or public.can('financas')) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  if length(k) < 2 then
    return;
  end if;
  return query
    select c.id, c.nome, c.telefone, c.doc
      from public.clientes c
     where public.cliente_nome_norm(c.nome) = k
     order by c.ativo desc, c.id
     limit 1;
end $$;

revoke all on function public.cliente_por_nome(text) from public, anon;
grant execute on function public.cliente_por_nome(text) to authenticated;

notify pgrst, 'reload schema';
