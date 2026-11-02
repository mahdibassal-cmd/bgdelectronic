# Sistema da Loja — configuração do Supabase (plano gratuito, $0)

Página: `https://bgdstores.com/sistema/` (noindex, sem link no site público).
Enquanto `sistema/config.js` tiver os placeholders, a página roda em **modo demonstração** (dados fictícios).

## 1. Criar conta e projeto (MB faz o login — ninguém mais)
1. Acesse https://supabase.com → **Start your project** → entre com GitHub ou e-mail. Plano **Free** (não cadastre cartão).
2. **New project**: nome `bagda-sistema`, região **South America (São Paulo)**, gere uma senha forte de banco e guarde no seu gerenciador de senhas (não mande em chat).
   - Obs.: projetos Free pausam após ~7 dias sem uso; basta abrir o painel e clicar *Restore*.

## 2. Bloquear cadastro público
**Authentication → Sign In / Providers**:
- **Allow new users to sign up: DESLIGADO**.
- Provider **Email**: ligado; **Confirm email**: ligado.
- Desligue todos os outros provedores (Google, GitHub, Magic link/OTP se não for usar, anonymous sign-ins OFF).

## 3. Senhas, limites e 2FA
- **Authentication → Policies/Passwords** (ou *Sign In / Providers → Email*): mínimo **12** caracteres, exigir letras maiúsculas, minúsculas, números e símbolos; ligar **Leaked password protection** se disponível no plano.
- **Authentication → Rate Limits**: deixe o padrão ou reduza — ex.: *sign-in/sign-up* **10 por 5 min por IP**, *token refresh* padrão, *verify (OTP/MFA)* **10 por 5 min**.
- **Authentication → Multi-Factor**: **TOTP habilitado** (padrão). Cada pessoa ativa o seu em *Sistema → 2FA*. Recomendado: MB ativa no primeiro login.
- Sessão: *Authentication → Sessions* → **Time-box** 12 h e **Inactivity timeout** 2 h (se disponível no Free; senão, ok pular).

## 4. URLs
**Authentication → URL Configuration**:
- **Site URL**: `https://bgdstores.com/sistema/`
- **Redirect URLs**: `https://bgdstores.com/sistema/**` (só isso).

## 5. Rodar o banco (SQL Editor → New query, nesta ordem)
**Projeto que JÁ rodou o schema antigo** (caso atual):
1. `supabase/migration-002.sql` — notas/recibos, relatórios e custo só admin, export. Pode rodar de novo sem problema.

**Instalação nova do zero:**
1. `supabase/schema.sql` (já inclui a 002)
2. `supabase/seed-produtos.sql` (112 produtos da planilha; estoque começa 0)

Depois: Table Editor → todas as tabelas com **RLS enabled**; Database → Advisors → **Security Advisor** sem alertas.

## 6. Criar os 8 usuários (só o MB)
**Authentication → Users → Add user → Create new user**, marque **Auto Confirm User** em todos.
Senhas fortes (12+ caracteres) definidas pelo MB, geradas num gerenciador de senhas; entregue a cada vendedor pessoalmente — nunca por chat aberto.

| Login na tela (campo "Nome") | E-mail para criar no Supabase | Papel |
|---|---|---|
| mahdibassal@icloud.com | `mahdibassal@icloud.com` | admin |
| Kaio | `kaio@sistema.bgdstores.local` | vendedor |
| Suelen | `suelen@sistema.bgdstores.local` | vendedor |
| Leticia | `leticia@sistema.bgdstores.local` | vendedor |
| Bianca | `bianca@sistema.bgdstores.local` | vendedor |
| Fernanda | `fernanda@sistema.bgdstores.local` | vendedor |
| Pamela | `pamela@sistema.bgdstores.local` | vendedor |
| Abdo | `abdo@sistema.bgdstores.local` | vendedor |

Os vendedores digitam só o **nome** (sem acento/maiúscula importa: "Letícia" = "leticia") + senha. Os e-mails `.local` não existem de verdade — por isso **Auto Confirm** é obrigatório e "esqueci a senha" não funciona para eles (o MB redefine em Users → ⋯ → *Reset password*/editar).
O MB entra digitando o e-mail completo.

Depois rode `supabase/users.sql` (já tem os 8 e-mails; idempotente). A última consulta deve listar **8 linhas** (1 admin + 7 vendedores). Quem não tiver perfil não vê nada.

Para desativar alguém: `update public.profiles set ativo = false where handle = '@fulano';` (e em Users → *Ban user*).

## O que cada um vê
- **Vendedor:** só *Nova nota* (produto, qtd, preço vendido, pagamento) → recibo para imprimir/salvar PDF, e *Notas* (as próprias). Vê nome, preço e quantidade disponível dos produtos. **Nunca** vê custo, compras, relatórios ou export — bloqueado no banco (RLS), não só na tela.
- **Admin:** tudo + Estoque, Relatório, Compras, Produtos com custo e **Exportar CSV**.
- Cada item da nota baixa o estoque automaticamente; se faltar estoque a nota inteira é recusada.

## 7. Ligar o site ao projeto
**Project Settings → API**: copie **Project URL** e a chave **anon / publishable**.
⚠️ **Nunca** use a chave `service_role` / `secret` no site.
(Já configurado em `sistema/config.js`.) A chave publishable é pública por design; a segurança vem do RLS.

## 8. Teste final (antes de entregar à equipe)
- Entrar como vendedor (ex.: `Kaio`): só Nova nota e Notas; gerar uma nota e imprimir.
- Conferir que o estoque baixou; tentar vender mais do que tem → recusado.
- Entrar como MB: vê tudo, lucro e margem; Produtos → Exportar CSV.
- Testes automáticos do SQL (opcional): `cd /tmp/pgt && node supabase/tests/rls-test.mjs` (PGlite).
- Tentar criar conta pela API pública → deve falhar (signup desligado).
