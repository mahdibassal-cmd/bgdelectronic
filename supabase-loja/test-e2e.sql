-- =====================================================================
-- BAGDA STORES (bagda-loja, ref xvsxnicmpkvzzhkkqgam) — TESTE PONTA A PONTA (dados TEST permanentes)
-- Rode no SQL Editor (role postgres), arquivo inteiro, de uma vez.
-- Pré-requisitos: schema → users → security → migration-clientes → migration-caixa-resumo → migration-usuarios → migration-tentativas.
-- O que faz: cria produto/fornecedor/cliente TEST, compra (entrada de estoque), conta a pagar + pagamento parcial,
--   1 nota por forma de pagamento com caixa + 1 nota "Paga Depois", recebimento do cliente no caixa, e confere tudo.
-- Simula um ADMIN existente (escolhido por consulta, sem e-mail fixo) via request.jwt.claims + role authenticated,
--   então as RPCs e a RLS reais são exercitadas. Admin nunca é bloqueado pelo horário.
-- Se algum check falhar: RAISE EXCEPTION com a lista => TUDO é desfeito (nada fica gravado).
-- Se passar: COMMIT; os dados TEST ficam e o SELECT final mostra PASS por check.
-- Rodar de novo: recusa se já houver dados TEST — rode test-cleanup.sql antes.
-- Marcas: SKU 'TEST-E2E', marca 'TEST', fornecedor 'TEST Fornecedor E2E', cliente 'TEST Cliente E2E',
--   observações 'TEST E2E'. NÃO abre/fecha sessão de caixa (não mexe na abertura real do dia).
-- =====================================================================
begin;

drop table if exists pg_temp.e2e_check;
create temp table e2e_check (n serial, check_name text not null, ok boolean not null, detalhe text);
grant all on e2e_check to authenticated;
grant usage on sequence e2e_check_n_seq to authenticated;

-- ---------- 0) Pré-checagens + escolha do admin (como postgres) ----------
do $$
declare v_admin uuid; v_nome text;
begin
  if exists (select 1 from public.products where sku = 'TEST-E2E')
     or exists (select 1 from public.fornecedores where nome = 'TEST Fornecedor E2E')
     or exists (select 1 from public.clientes where nome = 'TEST Cliente E2E') then
    raise exception 'Dados TEST já existem. Rode supabase-loja/test-cleanup.sql primeiro e depois este arquivo de novo.';
  end if;
  if to_regclass('public.recebimento_notas') is null or to_regclass('public.acesso_tentativas') is null then
    raise exception 'Migrations faltando: rode migration-caixa-resumo.sql, migration-usuarios.sql e migration-tentativas.sql antes.';
  end if;
  if coalesce((select locked from public.system_settings where id = 1), false) then
    raise exception 'Sistema está com a TRAVA de emergência ligada (system_settings.locked). Destrave antes de testar.';
  end if;
  select p.id, p.nome into v_admin, v_nome from public.profiles p join auth.users u on u.id = p.id
   where p.role = 'admin' and p.ativo and p.tipo = 'staff' order by p.created_at, p.id limit 1;
  if v_admin is null then
    raise exception 'Nenhum perfil ADMIN ativo (role=admin, ativo, tipo=staff) encontrado em public.profiles. Crie um admin antes de testar.';
  end if;
  -- aal2 = sessão com 2FA ok (o admin pode ter fator TOTP verificado). Local à transação.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('e2e.admin', v_admin::text, true);
  insert into e2e_check(check_name, ok, detalhe) values ('admin simulado', true, v_nome);
end $$;

set local role authenticated;

-- ---------- 1..3) Fluxo + checks (como admin, via RPCs/RLS reais) ----------
do $$
declare
  c_sku constant text := 'TEST-E2E'; c_forn constant text := 'TEST Fornecedor E2E'; c_cli constant text := 'TEST Cliente E2E';
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_admin uuid := current_setting('e2e.admin')::uuid;
  v_forn bigint; v_cli bigint; v_conta bigint; v_cpag bigint; v_rec bigint; v_nota bigint; v_prazo bigint;
  v_cx_din smallint; v_cx_pix smallint; v_cx smallint; v_n int := 0; m text; r jsonb; x jsonb; v numeric; v2 numeric; v3 numeric; ok boolean;
  v_notas jsonb := '{}'; v_tested smallint[] := '{}';
begin
  -- pré: permissões efetivas do admin simulado
  insert into e2e_check(check_name, ok, detalhe) values ('admin tem vendas/caixa/financas/admin (2FA ok)',
    public.can('vendas') and public.can('caixa') and public.can('financas') and public.can('admin'), null);

  -- 1) Cadastros + compra + conta a pagar com pagamento parcial
  insert into public.products(sku, marca, produto, tamanho, fornecedor, preco_venda, estoque, estoque_minimo, notas)
  values (c_sku, 'TEST', 'Produto TEST E2E', null, c_forn, 100.00, 0, 0, 'TEST E2E — apagar com test-cleanup.sql');
  insert into public.fornecedores(nome, obs) values (c_forn, 'TEST E2E') returning id into v_forn;
  v_cli := public.criar_cliente(c_cli, '11 90000-0000', null, null, null, 'TEST E2E');
  insert into public.purchases(sku, fornecedor, qtd, custo_unit, observacao) values (c_sku, c_forn, 10, 60.00, 'TEST E2E');
  insert into public.contas_pagar(fornecedor_id, valor, vencimento, descricao)
  values (v_forn, 600.00, v_today + 30, 'TEST E2E compra 10x TEST-E2E') returning id into v_conta;

  select id into v_cx_din from public.caixas where metodo::text = 'dinheiro' and ativo;
  select id into v_cx_pix from public.caixas where metodo::text = 'pix' and ativo;
  if v_cx_din is null or v_cx_pix is null then raise exception 'Caixa Dinheiro ou Caixa PIX inexistente/inativo'; end if;
  v_cpag := public.pagar_conta(v_conta, 250.00, v_cx_din, 'dinheiro', null);

  insert into e2e_check(check_name, ok, detalhe)
  select 'compra: estoque 10 e custo 60', p.estoque = 10 and c.custo = 60, 'estoque=' || p.estoque || ' custo=' || c.custo
    from public.products p join public.product_costs c on c.sku = p.sku where p.sku = c_sku;

  -- 2) Uma nota por forma de pagamento com caixa (lida do enum pay_method) + Paga Depois
  for m in select e.enumlabel from pg_enum e join pg_type t on t.oid = e.enumtypid join pg_namespace s on s.oid = t.typnamespace
            where s.nspname = 'public' and t.typname = 'pay_method' and e.enumlabel <> 'prazo' order by e.enumsortorder loop
    select id into v_cx from public.caixas where metodo::text = m and ativo;
    if v_cx is null then
      insert into e2e_check(check_name, ok, detalhe) values ('caixa ativo para forma ' || m, false, 'sem caixa ativo'); continue;
    end if;
    v_nota := public.criar_nota(jsonb_build_array(jsonb_build_object('sku', c_sku, 'qtd', 1, 'preco_vendido', 100)),
                                jsonb_build_array(jsonb_build_object('metodo', m, 'valor', 100)), null, v_cli);
    v_notas := v_notas || jsonb_build_object(m, v_nota); v_n := v_n + 1; v_tested := v_tested || v_cx;
  end loop;
  v_prazo := public.criar_nota(jsonb_build_array(jsonb_build_object('sku', c_sku, 'qtd', 2, 'preco_vendido', 100)),
                               '[{"metodo":"prazo","valor":200}]'::jsonb, null, v_cli);
  v_rec := public.registrar_recebimento(v_cli, 150.00, v_cx_pix, 'pix', null, 'TEST E2E');
  insert into e2e_check(check_name, ok, detalhe) values ('notas criadas (formas com caixa + prazo)', v_n >= 3,
    v_notas::text || ' prazo=' || v_prazo);

  -- 3) Asserções
  -- estoque
  select estoque into v from public.products where sku = c_sku;
  insert into e2e_check values (default, 'estoque = 10 - vendidos', v = 10 - v_n - 2, 'estoque=' || v || ' esperado=' || (10 - v_n - 2));
  select count(*) filter (where sc.custo_unit = 60), count(*) into v, v2
    from public.sales s join public.sale_costs sc on sc.sale_id = s.id where s.sku = c_sku;
  insert into e2e_check values (default, 'custo congelado nas vendas (60)', v = v2 and v2 = v_n + 1, v || '/' || v2);
  -- notas: total, pagamentos, vínculo cliente/vendedor
  select bool_and(n.total = (select sum(np.valor) from public.nota_pagamentos np where np.nota_id = n.id)
                  and n.cliente_id = v_cli and n.cliente = c_cli and n.seller_id = v_admin and n.status = 'ativa'), count(*)
    into ok, v from public.notas n where n.cliente_id = v_cli;
  insert into e2e_check values (default, 'notas: total = pagamentos, cliente e vendedor', coalesce(ok, false) and v = v_n + 1, v || ' notas');
  insert into e2e_check values (default, 'Paga Depois não gera movimento de caixa',
    not exists (select 1 from public.caixa_movimentos where nota_id = v_prazo), null);
  -- cliente
  select saldo, total_fiado, total_recebido into v, v2, v3 from public.v_clientes_saldo where id = v_cli;
  insert into e2e_check values (default, 'saldo cliente = 200 - 150 = 50', coalesce(v = 50 and v2 = 200 and v3 = 150, false),
    'saldo=' || coalesce(v::text, 'null') || ' fiado=' || coalesce(v2::text, 'null') || ' recebido=' || coalesce(v3::text, 'null'));
  insert into e2e_check values (default, 'recebimento alocado na nota Paga Depois (150)',
    exists (select 1 from public.recebimento_notas where recebimento_id = v_rec and nota_id = v_prazo and valor = 150)
    and (select count(*) from public.recebimento_notas where recebimento_id = v_rec) = 1, 'nota ' || v_prazo);
  insert into e2e_check values (default, 'recebimento: movimento entrada PIX 150 forma pix',
    exists (select 1 from public.cliente_recebimentos cr join public.caixa_movimentos cm on cm.id = cr.mov_id
             where cr.id = v_rec and cm.caixa_id = v_cx_pix and cm.tipo = 'entrada' and cm.valor = 150 and cm.forma = 'pix' and cm.user_id = v_admin), null);
  -- fornecedor
  insert into e2e_check(check_name, ok, detalhe) select 'conta a pagar: 600, pago 250, restante 350, parcial',
    valor = 600 and pago = 250 and restante = 350 and status = 'parcial', 'pago=' || pago || ' restante=' || restante || ' status=' || status
    from public.v_contas_pagar where id = v_conta;
  insert into e2e_check values (default, 'pagamento fornecedor: saída 250 no Caixa Dinheiro',
    exists (select 1 from public.conta_pagamentos cp join public.caixa_movimentos cm on cm.id = cp.mov_id
             where cp.id = v_cpag and cm.caixa_id = v_cx_din and cm.tipo = 'saida' and cm.valor = 250 and cm.forma = 'dinheiro'), null);

  -- caixa_resumo de hoje, por caixa testado (+ PIX e Dinheiro)
  for v_cx in select distinct u from unnest(v_tested || v_cx_pix || v_cx_din) u loop
    r := public.caixa_resumo(v_cx, v_today);
    -- cada venda TEST deste caixa aparece ligada à nota, cliente, usuário e forma
    for m, v_nota in select key, value::bigint from jsonb_each_text(v_notas) loop
      if (select id from public.caixas where metodo::text = m) = v_cx then
        insert into e2e_check values (default, 'resumo ' || (r->>'caixa') || ': venda ligada à nota ' || lpad(v_nota::text, 6, '0'),
          exists (select 1 from jsonb_array_elements(r->'movimentos') e where e->>'tipo' = 'venda' and e->>'nota' = lpad(v_nota::text, 6, '0')
                   and e->>'cliente' = c_cli and e->>'forma' = m and (e->>'valor')::numeric = 100
                   and e->>'usuario' = (select nome from public.profiles where id = v_admin)), null);
      end if;
    end loop;
    if v_cx = v_cx_pix then
      insert into e2e_check values (default, 'resumo ' || (r->>'caixa') || ': recebimento ligado à nota ' || lpad(v_prazo::text, 6, '0'),
        exists (select 1 from jsonb_array_elements(r->'movimentos') e where e->>'tipo' = 'entrada' and e->>'cliente' = c_cli
                 and e->>'forma' = 'pix' and (e->>'valor')::numeric = 150
                 and e->>'nota' like '%' || lpad(v_prazo::text, 6, '0') || ' (R$ 150.00)%'), null);
    end if;
    if v_cx = v_cx_din then
      insert into e2e_check values (default, 'resumo ' || (r->>'caixa') || ': pagamento ao fornecedor TEST (-250)',
        exists (select 1 from jsonb_array_elements(r->'movimentos') e where e->>'tipo' = 'saida' and e->>'cliente' = c_forn
                 and (e->>'assinado')::numeric = -250 and e->>'forma' = 'dinheiro'), null);
    end if;
    -- totais por forma = soma direta dos movimentos do dia (inclui movimentos reais de hoje, se houver)
    select coalesce(jsonb_object_agg(f, t), '{}') into x from (
      select coalesce(forma, '-') f, sum(case when tipo in ('venda','entrada') then valor else -valor end) t
        from public.caixa_movimentos where caixa_id = v_cx and data = v_today group by coalesce(forma, '-')) z;
    insert into e2e_check values (default, 'resumo ' || (r->>'caixa') || ': totais por forma', r->'por_forma' = x,
      'resumo=' || (r->>'por_forma') || ' direto=' || x::text);
    -- fechamento: inicial + entradas - saídas = final = saldo do sistema (o que caixa_fechar usaria)
    select coalesce(sum(case when tipo in ('venda','entrada') then valor else -valor end), 0) into v
      from public.caixa_movimentos where caixa_id = v_cx and data <= v_today;
    insert into e2e_check values (default, 'resumo ' || (r->>'caixa') || ': fechamento (inicial+entradas-saídas = final = sistema)',
      (r->>'saldo_inicial')::numeric + (r->>'entradas')::numeric - (r->>'saidas')::numeric = (r->>'saldo_final')::numeric
      and (r->>'saldo_final')::numeric = v,
      'ini=' || (r->>'saldo_inicial') || ' ent=' || (r->>'entradas') || ' sai=' || (r->>'saidas') || ' fim=' || (r->>'saldo_final') || ' sistema=' || v);
  end loop;
  -- contribuição TEST por caixa/forma
  select coalesce(sum(case when tipo in ('venda','entrada') then valor else -valor end), 0) into v
    from public.caixa_movimentos where caixa_id = v_cx_pix and data = v_today
     and (nota_id in (select id from public.notas where cliente_id = v_cli) or id in (select mov_id from public.cliente_recebimentos where cliente_id = v_cli));
  insert into e2e_check values (default, 'TEST no Caixa PIX hoje = ' || case when v_notas ? 'pix' then '100 + 150' else '150' end,
    v = case when v_notas ? 'pix' then 250 else 150 end, 'v=' || v);
  select coalesce(sum(case when tipo in ('venda','entrada') then valor else -valor end), 0) into v
    from public.caixa_movimentos where caixa_id = v_cx_din and data = v_today
     and (nota_id in (select id from public.notas where cliente_id = v_cli) or id in (select mov_id from public.conta_pagamentos where conta_id = v_conta));
  insert into e2e_check values (default, 'TEST no Caixa Dinheiro hoje = ' || case when v_notas ? 'dinheiro' then '100 - 250' else '-250' end,
    v = case when v_notas ? 'dinheiro' then -150 else -250 end, 'v=' || v);
end $$;

reset role;

-- ---------- Resultado: qualquer FAIL desfaz tudo ----------
do $$
declare f text;
begin
  select string_agg(n || '. ' || check_name || coalesce(' [' || detalhe || ']', ''), E'\n' order by n) into f from e2e_check where not ok;
  if f is not null then raise exception E'TESTE E2E FALHOU — nada foi gravado. Checks com FAIL:\n%', f; end if;
end $$;

commit;

select n as "#", case when ok then 'PASS' else 'FAIL' end as resultado, check_name as "check", detalhe from e2e_check order by n;
