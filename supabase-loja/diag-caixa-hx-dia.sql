-- diag-caixa-hx-dia.sql — Loja. SOMENTE LEITURA (só SELECT). Mostra como o Caixa HX é identificado,
-- policies das tabelas de caixa, views (security_invoker?) e funções security definer que leem caixa.
-- 1) Caixas
select id, nome, metodo, ativo, (nome ilike '%HX%') as nome_tem_hx from public.caixas order by id;
-- 2) Movimentos do HX por dia (últimos 10 dias)
select c.nome, m.data, count(*) movs, sum(case when m.tipo in ('venda','entrada') then m.valor else -m.valor end) liquido
from public.caixa_movimentos m join public.caixas c on c.id = m.caixa_id
where c.nome ilike '%HX%' or c.metodo::text = 'pix' group by c.nome, m.data order by m.data desc limit 10;
-- 3) Policies
select tablename, policyname, cmd, roles, qual, with_check from pg_policies
where schemaname = 'public' and tablename in ('caixas','caixa_movimentos','caixa_sessoes','cliente_recebimentos','conta_pagamentos','notas','recebimento_notas')
order by tablename, policyname;
-- 4) RLS ligada?
select relname, relrowsecurity, relforcerowsecurity from pg_class
where relnamespace = 'public'::regnamespace and relname in ('caixas','caixa_movimentos','caixa_sessoes','cliente_recebimentos','conta_pagamentos');
-- 5) Views e security_invoker
select c.relname view, coalesce(array_to_string(c.reloptions, ','), '(sem opções => owner/bypass RLS!)') opcoes
from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'v' order by 1;
-- 6) Funções que tocam caixa (security definer?)
select p.proname, pg_get_function_identity_arguments(p.oid) args, p.prosecdef security_definer
from pg_proc p where p.pronamespace = 'public'::regnamespace
  and (p.prosrc ilike '%caixa_movimentos%' or p.prosrc ilike '%caixa_sessoes%' or p.prosrc ilike '%v_caixa%' or p.prosrc ilike '%cliente_recebimentos%' or p.prosrc ilike '%conta_pagamentos%')
order by 1;
-- 7) Já migrado?
select to_regprocedure('public.caixa_dia_visivel(smallint,date)') is not null as hx_migration_ja_rodou;
