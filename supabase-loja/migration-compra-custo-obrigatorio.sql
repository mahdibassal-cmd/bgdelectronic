-- =====================================================================
-- migration-compra-custo-obrigatorio.sql — Loja /main (xvsxnicmpkvzzhkkqgam). Idempotente.
-- MB 13/11/2026: "bloqueado, não pode comprar algo sem custo".
-- Compra (purchases) e entrada no Depósito Especial (deposito_especial_mov tipo 'entrada')
-- sem custo unitário, ou com custo 0, são RECUSADAS no servidor (não só aviso).
--
-- Não reescreve registrar_compra_lote, dep_esp_entrada nem nenhuma função de nota/caixa:
-- só triggers BEFORE INSERT/UPDATE nessas duas tabelas. O nome purchase_a_* faz o trigger rodar
-- antes de purchase_compra_bi, então compra recusada não gasta número de compra. Venda (criar_nota / criar_nota_local),
-- transferências e ajustes do Depósito Especial não passam por aqui.
-- Linhas antigas não são alteradas (o trigger só olha a linha nova).
-- Custo continua visível só para admin (RLS de purchases e deposito_especial_mov = admin).
-- Rollback: /workspace/loja-perf/rollback-compra-custo-obrigatorio.sql
-- =====================================================================

create or replace function public.tg_compra_custo_obrigatorio()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- Separate IFs: plpgsql would fail on purchases ("new" has no field "tipo") if combined.
  if tg_table_name = 'deposito_especial_mov' then
    if new.tipo is distinct from 'entrada' then
      return new;
    end if;
  end if;
  if new.custo_unit is null or new.custo_unit <= 0 then
    raise exception 'Informe o custo unitário (maior que zero). Compra sem custo não é aceita.'
      using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function public.tg_compra_custo_obrigatorio() from public, anon;
grant execute on function public.tg_compra_custo_obrigatorio() to authenticated, service_role;

drop trigger if exists purchase_a_custo_obrigatorio on public.purchases;
create trigger purchase_a_custo_obrigatorio
  before insert or update of custo_unit on public.purchases
  for each row execute function public.tg_compra_custo_obrigatorio();

drop trigger if exists dep_esp_mov_custo_obrigatorio on public.deposito_especial_mov;
create trigger dep_esp_mov_custo_obrigatorio
  before insert on public.deposito_especial_mov
  for each row execute function public.tg_compra_custo_obrigatorio();
