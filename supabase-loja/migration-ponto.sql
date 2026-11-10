-- DRAFT — não aplicar em produção até revisão e OK explícito do MB ("publica").
-- Módulo de ponto eletrônico com biometria facial (LGPD).
-- Não substitui funções nem tabelas existentes da loja.
-- Horário do registro: now() no banco (fuso da sessão / timestamptz). Nunca o relógio do cliente.


do $$ begin
  create type public.ponto_tipo as enum ('entrada','saida_almoco','volta_almoco','saida');
exception when duplicate_object then null;
end $$;

create table if not exists public.ponto_params (
  chave text primary key,
  valor numeric not null
);
insert into public.ponto_params(chave, valor) values
  ('limiar', 0.55),
  ('tolerancia_minutos', 10)
on conflict (chave) do nothing;

create table if not exists public.ponto_jornadas (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  entrada time not null default '08:00',
  saida time not null default '18:00',
  almoco_minutos integer not null default 60 check (almoco_minutos >= 0 and almoco_minutos <= 240),
  dias_semana integer[] not null default '{1,2,3,4,5}',
  tolerancia_minutos integer not null default 10 check (tolerancia_minutos >= 0 and tolerancia_minutos <= 120),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table if not exists public.ponto_totens (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  nome text,
  created_at timestamptz not null default now(),
  created_by uuid
);

create table if not exists public.ponto_faces (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  descriptor double precision[] not null,
  foto_path text,
  consentimento_em timestamptz not null,
  consentimento_texto text not null,
  cadastrado_em timestamptz not null default now(),
  cadastrado_por uuid,
  constraint ponto_faces_desc_len check (array_length(descriptor, 1) = 128)
);

create table if not exists public.ponto_registros (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id),
  tipo public.ponto_tipo not null,
  registrado_em timestamptz not null default now(),
  data_sp date not null,
  foto_path text,
  score numeric,
  match_ok boolean not null default true,
  user_agent text,
  latitude numeric,
  longitude numeric,
  origem text not null default 'app' check (origem in ('app','totem')),
  excluido boolean not null default false,
  criado_em timestamptz not null default now()
);

create table if not exists public.ponto_falhas (
  id bigint generated always as identity primary key,
  user_id uuid,
  tipo public.ponto_tipo,
  foto_path text,
  score numeric,
  motivo text not null,
  user_agent text,
  latitude numeric,
  longitude numeric,
  origem text not null default 'app',
  criado_em timestamptz not null default now(),
  criado_por uuid
);

create table if not exists public.ponto_auditoria (
  id bigint generated always as identity primary key,
  registro_id bigint,
  acao text not null check (acao in ('editar','excluir','restaurar')),
  motivo text not null,
  antes jsonb,
  depois jsonb,
  user_id uuid,
  at timestamptz not null default now()
);

create index if not exists ponto_registros_user_data_idx
  on public.ponto_registros (user_id, data_sp) where not excluido;
create index if not exists ponto_falhas_em_idx on public.ponto_falhas (criado_em desc);

alter table public.ponto_params enable row level security;
alter table public.ponto_jornadas enable row level security;
alter table public.ponto_totens enable row level security;
alter table public.ponto_faces enable row level security;
alter table public.ponto_registros enable row level security;
alter table public.ponto_falhas enable row level security;
alter table public.ponto_auditoria enable row level security;

alter table public.ponto_params force row level security;
alter table public.ponto_jornadas force row level security;
alter table public.ponto_totens force row level security;
alter table public.ponto_faces force row level security;
alter table public.ponto_registros force row level security;
alter table public.ponto_falhas force row level security;
alter table public.ponto_auditoria force row level security;

revoke all on public.ponto_params, public.ponto_jornadas, public.ponto_totens,
  public.ponto_faces, public.ponto_registros, public.ponto_falhas, public.ponto_auditoria
  from public, anon;
grant select on public.ponto_params, public.ponto_jornadas, public.ponto_totens,
  public.ponto_faces, public.ponto_registros, public.ponto_falhas, public.ponto_auditoria
  to authenticated;

create or replace function public.ponto_e_totem() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_active_staff() and (
    public.is_admin()
    or exists (select 1 from public.ponto_totens t where t.user_id = auth.uid())
  );
$$;
revoke all on function public.ponto_e_totem() from public, anon;
grant execute on function public.ponto_e_totem() to authenticated;

drop policy if exists ponto_params_read on public.ponto_params;
create policy ponto_params_read on public.ponto_params for select to authenticated
  using (public.is_active_staff());

drop policy if exists ponto_jornadas_read on public.ponto_jornadas;
create policy ponto_jornadas_read on public.ponto_jornadas for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists ponto_totens_read on public.ponto_totens;
create policy ponto_totens_read on public.ponto_totens for select to authenticated
  using (public.is_admin() or user_id = auth.uid());

drop policy if exists ponto_faces_read on public.ponto_faces;
create policy ponto_faces_read on public.ponto_faces for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists ponto_registros_read on public.ponto_registros;
create policy ponto_registros_read on public.ponto_registros for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists ponto_falhas_read on public.ponto_falhas;
create policy ponto_falhas_read on public.ponto_falhas for select to authenticated
  using (public.is_admin() or criado_por = auth.uid() or user_id = auth.uid());

drop policy if exists ponto_auditoria_read on public.ponto_auditoria;
create policy ponto_auditoria_read on public.ponto_auditoria for select to authenticated
  using (public.is_admin());

-- Distância euclidiana entre descritores faciais (128 dimensões).
create or replace function public.ponto_distancia(a double precision[], b double precision[])
returns numeric
language sql immutable strict set search_path = '' as $$
  select case
    when a is null or b is null or array_length(a, 1) is distinct from array_length(b, 1) then null
    else round(sqrt(coalesce((select sum((x - y) * (x - y)) from unnest(a, b) as t(x, y)), 0))::numeric, 4)
  end;
$$;
revoke all on function public.ponto_distancia(double precision[], double precision[]) from public, anon;
grant execute on function public.ponto_distancia(double precision[], double precision[]) to authenticated;

create or replace function public.ponto_parse_descriptor(p jsonb)
returns double precision[]
language plpgsql immutable set search_path = '' as $$
declare v double precision[];
begin
  if p is null or jsonb_typeof(p) is distinct from 'array' or jsonb_array_length(p) is distinct from 128 then
    raise exception 'Descritor facial inválido' using errcode = 'P0001';
  end if;
  select array_agg(x::double precision) into v
  from jsonb_array_elements_text(p) as t(x);
  if array_length(v, 1) is distinct from 128 then
    raise exception 'Descritor facial inválido' using errcode = 'P0001';
  end if;
  return v;
end;
$$;
revoke all on function public.ponto_parse_descriptor(jsonb) from public, anon;

create or replace function public.ponto_proximo_tipo(p_user uuid, p_data date)
returns public.ponto_tipo
language sql stable security definer set search_path = '' as $$
  select case (
    select count(*) from public.ponto_registros r
    where r.user_id = p_user and r.data_sp = p_data and not r.excluido
  )
    when 0 then 'entrada'::public.ponto_tipo
    when 1 then 'saida_almoco'::public.ponto_tipo
    when 2 then 'volta_almoco'::public.ponto_tipo
    else 'saida'::public.ponto_tipo
  end;
$$;
revoke all on function public.ponto_proximo_tipo(uuid, date) from public, anon;
grant execute on function public.ponto_proximo_tipo(uuid, date) to authenticated;

create or replace function public.ponto_limiar()
returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce((select valor from public.ponto_params where chave = 'limiar'), 0.55);
$$;

create or replace function public.tg_ponto_registros_bi() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- relógio do servidor; o cliente não escolhe a hora
  new.registrado_em := now();
  new.data_sp := (now() at time zone 'America/Sao_Paulo')::date;
  new.criado_em := now();
  return new;
end;
$$;
drop trigger if exists ponto_registros_bi on public.ponto_registros;
create trigger ponto_registros_bi before insert on public.ponto_registros
  for each row execute function public.tg_ponto_registros_bi();

create or replace function public.ponto_cadastrar_face(
  p_descriptor jsonb,
  p_foto_path text,
  p_consentimento boolean,
  p_consentimento_texto text,
  p_user_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_alvo uuid := coalesce(p_user_id, auth.uid());
  v_desc double precision[];
  v_txt text := left(trim(coalesce(p_consentimento_texto, '')), 2000);
begin
  if v_uid is null or not public.is_active_staff() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  if v_alvo is distinct from v_uid and not public.is_admin() then
    raise exception 'Só o administrador cadastra o rosto de outra pessoa' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_alvo and p.ativo) then
    raise exception 'Usuário inválido' using errcode = 'P0001';
  end if;
  if p_consentimento is not true or length(v_txt) < 20 then
    raise exception 'É preciso aceitar o termo de consentimento (LGPD)' using errcode = 'P0001';
  end if;
  if p_foto_path is null or length(trim(p_foto_path)) < 3 then
    raise exception 'Envie a foto de referência' using errcode = 'P0001';
  end if;
  v_desc := public.ponto_parse_descriptor(p_descriptor);
  insert into public.ponto_faces(user_id, descriptor, foto_path, consentimento_em, consentimento_texto, cadastrado_em, cadastrado_por)
  values (v_alvo, v_desc, left(trim(p_foto_path), 300), now(), v_txt, now(), v_uid)
  on conflict (user_id) do update set
    descriptor = excluded.descriptor,
    foto_path = excluded.foto_path,
    consentimento_em = excluded.consentimento_em,
    consentimento_texto = excluded.consentimento_texto,
    cadastrado_em = excluded.cadastrado_em,
    cadastrado_por = excluded.cadastrado_por;
  return jsonb_build_object('ok', true, 'user_id', v_alvo);
end;
$$;

create or replace function public.ponto_excluir_face(p_user_id uuid, p_motivo text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_alvo uuid := coalesce(p_user_id, auth.uid());
  v_mot text := left(trim(coalesce(p_motivo, '')), 300);
begin
  if v_uid is null or not public.is_active_staff() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  if v_alvo is distinct from v_uid and not public.is_admin() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  if length(v_mot) < 3 then
    raise exception 'Informe o motivo' using errcode = 'P0001';
  end if;
  delete from public.ponto_faces where user_id = v_alvo;
  insert into public.ponto_auditoria(registro_id, acao, motivo, antes, user_id)
  values (null, 'excluir', 'Cadastro facial: ' || v_mot, jsonb_build_object('face_user_id', v_alvo), v_uid);
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.registrar_ponto(
  p_tipo text,
  p_descriptor jsonb,
  p_foto_path text,
  p_user_agent text default null,
  p_lat numeric default null,
  p_lng numeric default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_tipo public.ponto_tipo;
  v_desc double precision[];
  v_face public.ponto_faces%rowtype;
  v_score numeric;
  v_limiar numeric := public.ponto_limiar();
  v_data date := (now() at time zone 'America/Sao_Paulo')::date;
  v_id bigint;
  v_ja int;
begin
  if v_uid is null or not public.is_active_staff() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  if public.ponto_e_totem() and not public.is_admin() and exists (select 1 from public.ponto_totens t where t.user_id = v_uid) then
    raise exception 'No totem, use registrar_ponto_totem' using errcode = 'P0001';
  end if;
  begin
    v_tipo := p_tipo::public.ponto_tipo;
  exception when invalid_text_representation then
    raise exception 'Tipo de ponto inválido' using errcode = 'P0001';
  end;
  select * into v_face from public.ponto_faces f where f.user_id = v_uid;
  if not found then
    raise exception 'Cadastre seu rosto antes de bater ponto' using errcode = 'P0001';
  end if;
  v_desc := public.ponto_parse_descriptor(p_descriptor);
  v_score := public.ponto_distancia(v_desc, v_face.descriptor);
  if v_score is null or v_score > v_limiar then
    insert into public.ponto_falhas(user_id, tipo, foto_path, score, motivo, user_agent, latitude, longitude, origem, criado_por)
    values (v_uid, v_tipo, left(trim(coalesce(p_foto_path, '')), 300), v_score,
            'Rosto não confere com o cadastro (score ' || coalesce(v_score::text, '?') || ', limiar ' || v_limiar || ')',
            left(coalesce(p_user_agent, ''), 400), p_lat, p_lng, 'app', v_uid);
    return jsonb_build_object('ok', false, 'motivo', 'Rosto não confere com o cadastro. O ponto não foi registrado.', 'score', v_score);
  end if;
  select count(*) into v_ja from public.ponto_registros
   where user_id = v_uid and data_sp = v_data and tipo = v_tipo and not excluido;
  if v_ja > 0 then
    raise exception 'Este tipo de ponto já foi registrado hoje' using errcode = 'P0001';
  end if;
  insert into public.ponto_registros(user_id, tipo, foto_path, score, match_ok, user_agent, latitude, longitude, origem)
  values (v_uid, v_tipo, left(trim(coalesce(p_foto_path, '')), 300), v_score, true,
          left(coalesce(p_user_agent, ''), 400), p_lat, p_lng, 'app')
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'tipo', v_tipo, 'score', v_score, 'registrado_em', now());
end;
$$;

create or replace function public.registrar_ponto_totem(
  p_tipo text,
  p_descriptor jsonb,
  p_foto_path text,
  p_user_agent text default null,
  p_lat numeric default null,
  p_lng numeric default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_tipo public.ponto_tipo;
  v_desc double precision[];
  v_best uuid;
  v_score numeric;
  v_limiar numeric := public.ponto_limiar();
  v_data date := (now() at time zone 'America/Sao_Paulo')::date;
  v_id bigint;
  v_ja int;
  v_nome text;
begin
  if v_uid is null or not public.ponto_e_totem() then
    raise exception 'Sem permissão de totem' using errcode = '42501';
  end if;
  begin
    v_tipo := p_tipo::public.ponto_tipo;
  exception when invalid_text_representation then
    raise exception 'Tipo de ponto inválido' using errcode = 'P0001';
  end;
  v_desc := public.ponto_parse_descriptor(p_descriptor);
  select f.user_id, public.ponto_distancia(v_desc, f.descriptor)
    into v_best, v_score
  from public.ponto_faces f
  join public.profiles p on p.id = f.user_id and p.ativo
  order by 2 asc
  limit 1;
  if v_best is null or v_score is null or v_score > v_limiar then
    insert into public.ponto_falhas(user_id, tipo, foto_path, score, motivo, user_agent, latitude, longitude, origem, criado_por)
    values (v_best, v_tipo, left(trim(coalesce(p_foto_path, '')), 300), v_score,
            'Nenhum rosto cadastrado conferiu (score ' || coalesce(v_score::text, '?') || ', limiar ' || v_limiar || ')',
            left(coalesce(p_user_agent, ''), 400), p_lat, p_lng, 'totem', v_uid);
    return jsonb_build_object('ok', false, 'motivo', 'Rosto não reconhecido. O ponto não foi registrado.', 'score', v_score);
  end if;
  select count(*) into v_ja from public.ponto_registros
   where user_id = v_best and data_sp = v_data and tipo = v_tipo and not excluido;
  if v_ja > 0 then
    raise exception 'Este tipo de ponto já foi registrado hoje para esta pessoa' using errcode = 'P0001';
  end if;
  insert into public.ponto_registros(user_id, tipo, foto_path, score, match_ok, user_agent, latitude, longitude, origem)
  values (v_best, v_tipo, left(trim(coalesce(p_foto_path, '')), 300), v_score, true,
          left(coalesce(p_user_agent, ''), 400), p_lat, p_lng, 'totem')
  returning id into v_id;
  select nome into v_nome from public.profiles where id = v_best;
  return jsonb_build_object('ok', true, 'id', v_id, 'user_id', v_best, 'nome', v_nome,
                            'tipo', v_tipo, 'score', v_score, 'registrado_em', now());
end;
$$;

create or replace function public.ponto_editar_registro(p_id bigint, p_tipo text, p_motivo text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_mot text := left(trim(coalesce(p_motivo, '')), 300);
  v_tipo public.ponto_tipo;
  v_antes public.ponto_registros%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Só o administrador altera um ponto' using errcode = '42501';
  end if;
  if length(v_mot) < 3 then
    raise exception 'Informe o motivo' using errcode = 'P0001';
  end if;
  begin
    v_tipo := p_tipo::public.ponto_tipo;
  exception when invalid_text_representation then
    raise exception 'Tipo de ponto inválido' using errcode = 'P0001';
  end;
  select * into v_antes from public.ponto_registros where id = p_id and not excluido;
  if not found then
    raise exception 'Registro não encontrado' using errcode = 'P0001';
  end if;
  -- registrado_em permanece o horário original do servidor
  update public.ponto_registros set tipo = v_tipo where id = p_id;
  insert into public.ponto_auditoria(registro_id, acao, motivo, antes, depois, user_id)
  values (p_id, 'editar', v_mot,
          jsonb_build_object('tipo', v_antes.tipo, 'registrado_em', v_antes.registrado_em),
          jsonb_build_object('tipo', v_tipo, 'registrado_em', v_antes.registrado_em),
          v_uid);
  return jsonb_build_object('ok', true, 'id', p_id);
end;
$$;

create or replace function public.ponto_excluir_registro(p_id bigint, p_motivo text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_mot text := left(trim(coalesce(p_motivo, '')), 300);
  v_antes public.ponto_registros%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Só o administrador exclui um ponto' using errcode = '42501';
  end if;
  if length(v_mot) < 3 then
    raise exception 'Informe o motivo' using errcode = 'P0001';
  end if;
  select * into v_antes from public.ponto_registros where id = p_id and not excluido;
  if not found then
    raise exception 'Registro não encontrado' using errcode = 'P0001';
  end if;
  update public.ponto_registros set excluido = true where id = p_id;
  insert into public.ponto_auditoria(registro_id, acao, motivo, antes, user_id)
  values (p_id, 'excluir', v_mot,
          jsonb_build_object('tipo', v_antes.tipo, 'user_id', v_antes.user_id, 'registrado_em', v_antes.registrado_em),
          v_uid);
  return jsonb_build_object('ok', true, 'id', p_id);
end;
$$;

create or replace function public.ponto_set_jornada(
  p_user_id uuid, p_entrada time, p_saida time, p_almoco_minutos integer,
  p_dias_semana integer[] default '{1,2,3,4,5}', p_tolerancia_minutos integer default 10
) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Só o administrador define a jornada' using errcode = '42501';
  end if;
  if p_user_id is null or p_entrada is null or p_saida is null or p_saida <= p_entrada then
    raise exception 'Jornada inválida' using errcode = 'P0001';
  end if;
  insert into public.ponto_jornadas(user_id, entrada, saida, almoco_minutos, dias_semana, tolerancia_minutos, updated_at, updated_by)
  values (p_user_id, p_entrada, p_saida, coalesce(p_almoco_minutos, 60), coalesce(p_dias_semana, '{1,2,3,4,5}'), coalesce(p_tolerancia_minutos, 10), now(), auth.uid())
  on conflict (user_id) do update set
    entrada = excluded.entrada, saida = excluded.saida, almoco_minutos = excluded.almoco_minutos,
    dias_semana = excluded.dias_semana, tolerancia_minutos = excluded.tolerancia_minutos,
    updated_at = now(), updated_by = auth.uid();
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.ponto_set_totem(p_user_id uuid, p_on boolean, p_nome text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Só o administrador define o totem' using errcode = '42501';
  end if;
  if p_on then
    insert into public.ponto_totens(user_id, nome, created_by)
    values (p_user_id, nullif(trim(coalesce(p_nome, '')), ''), auth.uid())
    on conflict (user_id) do update set nome = excluded.nome;
  else
    delete from public.ponto_totens where user_id = p_user_id;
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace view public.v_ponto_registros
  with (security_invoker = true) as
select r.id, r.user_id, p.handle, p.nome, r.tipo, r.registrado_em, r.data_sp,
       r.foto_path, r.score, r.match_ok, r.user_agent, r.latitude, r.longitude,
       r.origem, r.excluido
from public.ponto_registros r
join public.profiles p on p.id = r.user_id;

revoke all on public.v_ponto_registros from public, anon;
grant select on public.v_ponto_registros to authenticated;

revoke all on function public.ponto_cadastrar_face(jsonb, text, boolean, text, uuid) from public, anon;
revoke all on function public.ponto_excluir_face(uuid, text) from public, anon;
revoke all on function public.registrar_ponto(text, jsonb, text, text, numeric, numeric) from public, anon;
revoke all on function public.registrar_ponto_totem(text, jsonb, text, text, numeric, numeric) from public, anon;
revoke all on function public.ponto_editar_registro(bigint, text, text) from public, anon;
revoke all on function public.ponto_excluir_registro(bigint, text) from public, anon;
revoke all on function public.ponto_set_jornada(uuid, time, time, integer, integer[], integer) from public, anon;
revoke all on function public.ponto_set_totem(uuid, boolean, text) from public, anon;
revoke all on function public.ponto_limiar() from public, anon;

grant execute on function public.ponto_cadastrar_face(jsonb, text, boolean, text, uuid) to authenticated;
grant execute on function public.ponto_excluir_face(uuid, text) to authenticated;
grant execute on function public.registrar_ponto(text, jsonb, text, text, numeric, numeric) to authenticated;
grant execute on function public.registrar_ponto_totem(text, jsonb, text, text, numeric, numeric) to authenticated;
grant execute on function public.ponto_editar_registro(bigint, text, text) to authenticated;
grant execute on function public.ponto_excluir_registro(bigint, text) to authenticated;
grant execute on function public.ponto_set_jornada(uuid, time, time, integer, integer[], integer) to authenticated;
grant execute on function public.ponto_set_totem(uuid, boolean, text) to authenticated;
grant execute on function public.ponto_limiar() to authenticated;

-- Bucket privado (só se o schema storage existir; PGlite de teste pode não ter).
do $$
begin
  if to_regclass('storage.buckets') is null then
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('ponto', 'ponto', false, 5242880, array['image/jpeg','image/png','image/webp'])
  on conflict (id) do update set
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
  execute 'drop policy if exists ponto_storage_select on storage.objects';
  execute 'drop policy if exists ponto_storage_insert on storage.objects';
  execute 'drop policy if exists ponto_storage_update on storage.objects';
  execute 'drop policy if exists ponto_storage_delete on storage.objects';
  execute $p$
    create policy ponto_storage_select on storage.objects for select to authenticated
    using (
      bucket_id = 'ponto' and (
        public.is_admin()
        or split_part(name, '/', 1) = auth.uid()::text
      )
    )
  $p$;
  execute $p$
    create policy ponto_storage_insert on storage.objects for insert to authenticated
    with check (
      bucket_id = 'ponto' and (
        public.is_admin()
        or public.ponto_e_totem()
        or split_part(name, '/', 1) = auth.uid()::text
      )
    )
  $p$;
  execute $p$
    create policy ponto_storage_update on storage.objects for update to authenticated
    using (bucket_id = 'ponto' and public.is_admin())
    with check (bucket_id = 'ponto' and public.is_admin())
  $p$;
  execute $p$
    create policy ponto_storage_delete on storage.objects for delete to authenticated
    using (bucket_id = 'ponto' and public.is_admin())
  $p$;
end;
$$;

notify pgrst, 'reload schema';
select 'ponto draft' as status;
