# Sistema BAGDA STORES — /loja/ (setup)

Sistema **separado** do quiosque (/sistema). Projeto Supabase próprio: **bagda-loja**
(`https://xvsxnicmpkvzzhkkqgam.supabase.co`, região sa-east-1). Frontend: `loja/` (GitHub Pages, bgdstores.com/loja/).
`loja/config.js` tem só a chave **publishable** — nunca a service_role.

## Papéis
| Papel | Pode |
|---|---|
| admin | tudo: Nova nota, Notas (cancelar), Estoque completo, Caixa, Relatório, Compras, Produtos/custos, Usuários |
| vendedor | Nova nota (escolhe pagamento), Minhas notas, Estoque consulta (sem custo/preço), 2FA |
| financeiro | só Caixa (saldos, extrato, abertura/fechamento, entradas/saídas), 2FA |

Garantido no banco (RLS + RPCs), não só na tela. Para mudar, edite `public.role_perms`
(perms: `admin`, `vendas`, `caixa`), ex.: `insert into public.role_perms values ('financeiro','vendas');`.
Helpers no mesmo padrão do /sistema: `mfa_ok()`, `is_active_staff()`, `is_admin()`, `has_perm()`, `can()`.

## SQL — rodar no SQL Editor do projeto bagda-loja, nesta ordem
1. `supabase-loja/schema.sql` — tabelas, RLS, RPCs (`criar_nota`, `cancelar_nota`, `caixa_abrir`, `caixa_fechar`), views e os 3 caixas. Idempotente.
2. Convide/crie os usuários em **Authentication → Users** (convite por e-mail, ou nome@loja.bgdstores.local com Auto Confirm + senha forte).
3. Troque os e-mails placeholder em `supabase-loja/users.sql` e rode-o (idempotente; pode rodar de novo após novos convites).

Produtos: a loja começa **sem produtos** — cadastre em Produtos (admin) e dê entrada em Compras.

## Caixa
- Caixas: **Caixa Dinheiro** (dinheiro), **Caixa PIX (HX)** (pix), **Máquina Loja** (cartão).
- Cada nota tem 1–3 pagamentos (dividido permitido) que precisam somar o total; `criar_nota` lança os movimentos `venda` no caixa certo na mesma transação.
- Cancelar nota (admin, com motivo): devolve estoque e lança `estorno` nos caixas.
- Entradas/saídas manuais exigem motivo; movimentos não podem ser editados nem apagados.
- Abertura/fechamento diário por caixa: valor contado; o fechamento grava saldo do sistema e diferença.
- Extrato do dia: Caixa → "Imprimir extrato (A4)".

## Auth
Sign-ups desligado, regra de senha forte, Site URL / Redirect URLs: `https://bgdstores.com/loja/` e `https://bgdstores.com/loja/**`.
Login aceita nome (vira `nome@loja.bgdstores.local`) ou e-mail. Convite/recuperação abre "Criar sua senha".

## Testes
`supabase-loja/tests/rls-test.mjs` (PGlite, auth simulado): `npm i @electric-sql/pglite && node supabase-loja/tests/rls-test.mjs`.
Demo sem banco: `bgdstores.com/loja/?mock=admin&auto=1` (ou `mock=vendedor` / `mock=financeiro`).
