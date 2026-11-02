-- BAGDA STORES — perfis da equipe. Rode DEPOIS de convidar/criar os usuários em Authentication > Users.
-- E-mails PENDENTES: troque os placeholders "@loja.bgdstores.local" pelos e-mails reais de quem recebe convite.
-- Quem entra só com o nome usa <nome>@loja.bgdstores.local (crie em Auth com Auto Confirm e senha forte).
-- Idempotente: pode rodar de novo; quem ainda não existe em Auth é ignorado.
insert into public.profiles (id, handle, nome, role)
select u.id, v.handle, v.nome, v.role::public.app_role
from (values
  ('mike@loja.bgdstores.local',    '@mike',    'Mike',    'admin'),       -- PENDENTE: e-mail real
  ('sam@loja.bgdstores.local',     '@sam',     'Sam',     'admin'),       -- PENDENTE: e-mail real
  ('hadi@loja.bgdstores.local',    '@hadi',    'Hadi',    'admin'),       -- PENDENTE: e-mail real
  ('kaio@loja.bgdstores.local',    '@kaio',    'Kaio',    'vendedor'),
  ('bianca@loja.bgdstores.local',  '@bianca',  'Bianca',  'vendedor'),
  ('suelen@loja.bgdstores.local',  '@suelen',  'Suelen',  'vendedor'),
  ('pamela@loja.bgdstores.local',  '@pamela',  'Pamela',  'financeiro'),
  ('leticia@loja.bgdstores.local', '@leticia', 'Leticia', 'financeiro')
) as v(email, handle, nome, role)
join auth.users u on lower(u.email) = v.email
on conflict (id) do update set handle = excluded.handle, nome = excluded.nome, role = excluded.role, ativo = true;

-- Conferência
select p.handle, p.role, u.email from public.profiles p join auth.users u on u.id = p.id order by p.role, p.handle;
