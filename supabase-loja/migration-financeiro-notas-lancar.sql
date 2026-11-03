-- Financeiro: tela "Notas p/ lançar" (bgdstores.com/main).
-- Problema: v_notas_lancar é security_invoker, então lê public.notas / nota_pagamentos com a RLS
-- de quem consulta. notas_read exige can('vendas') -> o financeiro (caixa, financas) recebia ZERO linhas.
-- Correção (mínimo privilégio): RPC security definer, gate can('financas'), devolve só as colunas
-- de v_notas_lancar (sem itens/custos). RLS de notas/nota_pagamentos NÃO é alterada.
-- Idempotente. Rodar depois de migration-caixa-geral.sql.
create or replace function public.notas_lancar_financas(p_limit int default 300)
returns setof public.v_notas_lancar
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.can('financas') then
    raise exception 'Sem permissão (financeiro/admin)' using errcode = '42501';
  end if;
  return query select v.* from public.v_notas_lancar v
    order by v.created_at desc limit least(greatest(coalesce(p_limit, 300), 1), 1000);
end $$;
revoke all on function public.notas_lancar_financas(int) from public, anon;
grant execute on function public.notas_lancar_financas(int) to authenticated;

select 'notas_lancar_financas ok' as status;
