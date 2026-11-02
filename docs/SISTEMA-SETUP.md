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

## 5. Rodar o banco
**SQL Editor → New query**, cole e rode **nesta ordem**:
1. `supabase/schema.sql` (tabelas, RLS, triggers, views)
2. `supabase/seed-produtos.sql` (112 produtos da planilha; estoque começa 0)

Depois, no **Table Editor**, confirme que todas as tabelas mostram **RLS enabled**.
Em **Database → Advisors → Security Advisor**, rode e verifique que não há alertas.

## 6. Criar os usuários (só o MB)
**Authentication → Users → Add user → Create new user**, marque **Auto Confirm User**, um para cada:
MB (admin), Kaio, Suelen, Leticia, Bianca, Fernanda, Pamela, Abdo.
Use e-mails reais de cada um e senhas fortes geradas (cada pessoa troca depois, se quiser). Não mande senhas por chat aberto.

Depois edite `supabase/users.sql`, troque `EMAIL_DO_MB`, `EMAIL_DA_KAIO`… pelos e-mails reais e rode no SQL Editor.
Isso cria os perfis com handle e **define o MB como admin**. Quem não tiver perfil não vê nada.

Para desativar alguém: `update public.profiles set ativo = false where handle = '@fulano';` (e em Users → *Ban user*).

## 7. Ligar o site ao projeto
**Project Settings → API**: copie **Project URL** e a chave **anon / publishable**.
⚠️ **Nunca** use a chave `service_role` / `secret` no site.
Passe os dois valores ao GODaddy Covers (a chave anon é pública por design; a segurança vem do RLS), que coloca em `sistema/config.js` e publica após seu OK.

## 8. Teste final (antes de entregar à equipe)
- Entrar como vendedor: vê só as próprias vendas, não vê Compras/Produtos/custo/lucro.
- Registrar uma venda: estoque baixa 1; venda abaixo da tabela mostra aviso.
- Entrar como MB: vê tudo, lucro e margem.
- Tentar criar conta pela API pública → deve falhar (signup desligado).
