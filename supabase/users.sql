-- Rode DEPOIS de criar os 8 usuários em Authentication > Users (Add user, Auto Confirm).
-- Idempotente: pode rodar de novo a qualquer momento.
insert into public.profiles (id, handle, nome, role)
select u.id, v.handle, v.nome, v.role::public.app_role
from (values
  ('mahdibassal@icloud.com',            '@mb',       'MB',       'admin'),
  ('kaio@sistema.bgdstores.local',      '@kaio',     'Kaio',     'seller'),
  ('suelen@sistema.bgdstores.local',    '@suelen',   'Suelen',   'seller'),
  ('leticia@sistema.bgdstores.local',   '@leticia',  'Leticia',  'seller'),
  ('bianca@sistema.bgdstores.local',    '@bianca',   'Bianca',   'seller'),
  ('fernanda@sistema.bgdstores.local',  '@fernanda', 'Fernanda', 'seller'),
  ('pamela@sistema.bgdstores.local',    '@pamela',   'Pamela',   'seller'),
  ('abdo@sistema.bgdstores.local',      '@abdo',     'Abdo',     'seller'),
  ('bassalhadi36@gmail.com',            '@hadi',     'Hadi',     'seller')   -- vendedor com e-mail real (convite)
) as v(email, handle, nome, role)
join auth.users u on lower(u.email) = v.email
on conflict (id) do update set handle = excluded.handle, nome = excluded.nome, role = excluded.role, ativo = true;

-- Conferência: deve listar 9 linhas (quem ainda não foi criado em Auth não aparece).
select p.handle, p.role, u.email from public.profiles p join auth.users u on u.id = p.id order by p.role, p.handle;
