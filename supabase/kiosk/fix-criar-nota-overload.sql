-- =====================================================================
-- fix-criar-nota-overload.sql — Kiosk. NÃO executar até o catálogo
-- ao vivo confirmar as duas assinaturas abaixo. Sem CASCADE.
--
-- O erro do PostgREST cita exatamente:
--   criar_nota(pay_method, jsonb, text)
--   criar_nota(pay_method, jsonb, text, numeric, numeric)
-- A segunda tem default 0 em p_frete e p_caxinha_natal. Uma chamada só
-- com p_forma, p_items e p_cliente cabe nas duas.
-- migration-caxinha-natal-kiosk.sql remove a de 4 argumentos e não
-- remove a de 3. Este arquivo remove só a de 3, e só se a de 5 existir.
-- Não mexe em criar_nota_local nem nas assinaturas da loja.
-- =====================================================================

do $$ begin
  if to_regprocedure('public.criar_nota(public.pay_method, jsonb, text, numeric, numeric)') is null then
    raise exception 'Parar: criar_nota Frete+Caxinha não está presente. Não remover a assinatura curta.';
  end if;
end $$;

drop function if exists public.criar_nota(public.pay_method, jsonb, text);

notify pgrst, 'reload schema';
select 'kiosk criar_nota overload guard ok' as status;
