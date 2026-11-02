-- Depois de criar os usuários em Authentication > Users (Add user, "Auto confirm"),
-- troque os e-mails abaixo pelos reais e rode. Ninguém se cadastra sozinho.
insert into public.profiles (id, handle, nome, role)
select u.id, v.handle, v.nome, v.role::public.app_role
from (values
  ('EMAIL_DO_MB',       '@mb',       'MB',       'admin'),
  ('EMAIL_DA_KAIO',     '@kaio',     'Kaio',     'seller'),
  ('EMAIL_DA_SUELEN',   '@suelen',   'Suelen',   'seller'),
  ('EMAIL_DA_LETICIA',  '@leticia',  'Leticia',  'seller'),
  ('EMAIL_DA_BIANCA',   '@bianca',   'Bianca',   'seller'),
  ('EMAIL_DA_FERNANDA', '@fernanda', 'Fernanda', 'seller'),
  ('EMAIL_DA_PAMELA',   '@pamela',   'Pamela',   'seller'),
  ('EMAIL_DO_ABDO',     '@abdo',     'Abdo',     'seller')
) as v(email, handle, nome, role)
join auth.users u on lower(u.email) = lower(v.email)
on conflict (id) do update set handle = excluded.handle, nome = excluded.nome, role = excluded.role;
