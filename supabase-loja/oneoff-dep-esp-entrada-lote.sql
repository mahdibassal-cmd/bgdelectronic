-- One-off: entradas no Depósito Especial (loja), equivalente a dep_esp_entrada.
-- Faz o mesmo que a função: saldo com custo médio, linha em deposito_especial_mov, log dep_esp_entrada.
-- Rodar no SQL Editor (role postgres). Tudo ou nada: qualquer erro desfaz tudo.
-- 1) Preencha v_handle com o handle do admin (ex.: 'mb') - vira created_by/actor.
-- 2) Preencha a lista VALUES (sku, qtd, custo_unit, motivo).
begin;

create temp table _itens(sku text, qtd integer, custo numeric, motivo text) on commit drop;
insert into _itens(sku, qtd, custo, motivo) values
  ('SKU-EXEMPLO-1', 1, 0.00, 'Entrada inicial')   -- <- substituir pelas linhas reais
;

do $$
declare
  v_handle text := 'PREENCHER_HANDLE_ADMIN';
  v_actor uuid; x record; d record; v_new integer; v_custo numeric; v_mot text; v_n int := 0;
begin
  select id into v_actor from public.profiles where handle = v_handle;
  if v_actor is null then raise exception 'Handle admin não encontrado: %', v_handle; end if;

  for x in select * from _itens loop
    if coalesce(x.qtd, 0) <= 0 then raise exception 'Quantidade inválida para %', x.sku; end if;
    if x.custo is null or x.custo < 0 then raise exception 'Custo inválido para %', x.sku; end if;
    perform 1 from public.products where sku = x.sku;
    if not found then raise exception 'Produto não encontrado (%)', x.sku; end if;
    v_mot := left(trim(coalesce(x.motivo, '')), 200); if v_mot = '' then v_mot := 'Entrada'; end if;

    insert into public.deposito_especial(sku) values (x.sku) on conflict (sku) do nothing;
    select * into d from public.deposito_especial where sku = x.sku for update;
    v_new := d.qtd + x.qtd;
    v_custo := round((d.qtd * d.custo + x.qtd * x.custo) / v_new, 2);
    update public.deposito_especial set qtd = v_new, custo = v_custo, updated_at = now() where sku = x.sku;
    insert into public.deposito_especial_mov(sku, tipo, qtd, qtd_antes, qtd_depois, custo_unit, motivo, created_by)
      values (x.sku, 'entrada', x.qtd, d.qtd, v_new, x.custo, v_mot, v_actor);
    insert into public.security_events(kind, actor, detail) values ('dep_esp_entrada', v_actor,
      jsonb_build_object('sku', x.sku, 'qtd', x.qtd, 'custo', x.custo, 'antes', d.qtd, 'depois', v_new,
                         'motivo', v_mot, 'via', 'oneoff-sql'));
    v_n := v_n + 1;
  end loop;
  raise notice 'Entradas gravadas: %', v_n;
end $$;

select d.sku, p.produto, d.qtd, d.custo from public.deposito_especial d
join public.products p on p.sku = d.sku where d.sku in (select sku from _itens) order by d.sku;

commit;
