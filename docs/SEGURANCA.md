# Segurança — Sistema BAGDA (/kiosk)

## Rodar no Supabase (bagda-sistema › SQL Editor), nesta ordem
1. `supabase/migration-004.sql` (idempotente; pode rodar de novo).
Até rodar, o site funciona normalmente; os botões de bloqueio/log mostram "ainda não ativados".

## Trava de emergência (kill switch)
- App: **Segurança › Bloquear sistema** (qualquer admin). Todos, exceto o dono (mahdibassal@icloud.com), veem "Sistema bloqueado" e o banco nega toda leitura/escrita (RLS + RPCs via `mfa_ok()/is_admin()/is_active_staff()` → `system_unlocked()`).
- Desbloquear: só o dono (app ou SQL).
- SQL Editor (one-liners):
  - Bloquear: `update public.system_settings set locked=true, locked_at=now(), reason='emergência' where id=1;`
  - Desbloquear: `update public.system_settings set locked=false, locked_at=null, reason=null where id=1;`
- Encerrar todas as sessões: app (dono) **Segurança › Encerrar todas as sessões** ou RPC `signout_all()`; SQL Editor: `delete from auth.refresh_tokens; delete from auth.sessions;`. Tokens já emitidos vencem em até 1 h (JWT expiry) — por isso **bloqueie primeiro**, depois encerre sessões. Para um usuário só: Dashboard › Authentication › Users › usuário › "Sign out user"/Ban.

## Log de segurança (`public.security_events`, só admin lê)
failed_login (enviado pelo navegador via `report_failed_login`, limite 5/min por e-mail e 60/min total), role_change / admin_added / profile_added / profile_removed (trigger em profiles), lock, unlock, signout_all.
Também: só o dono pode, pelo app/API, criar/remover/desativar admins (SQL Editor continua livre).

## Backups
- Automático: repo PRIVADO `mahdibassal-cmd/bagda-backups`, todo dia 18:30 (SP), sistema + loja, criptografado (age), 90 dias. Secrets e restauração no README de lá.
- Manual: **Segurança › Backup agora** (admin) baixa JSON com todas as tabelas (profiles, products, product_costs, purchases, notas, sales, sale_costs, security_events) usando a sessão do admin. Contém custos — guardar em local seguro.

## Auditoria (2026-11-02)
| # | Achado | Situação |
|---|---|---|
| 1 | RLS ligado e FORCE em todas as tabelas; anon sem acesso a tabelas | OK |
| 2 | Funções security definer com `search_path=''` | OK (todas, inclusive as novas) |
| 3 | Custos só em product_costs/sale_costs/purchases, admin-only | OK |
| 4 | Vendedor lê `products.preco_venda` (preço de venda, não custo) direto na API | Aceito: o app precisa para a nota e aviso "abaixo da tabela" |
| 5 | Funções novas no Postgres ganham EXECUTE para PUBLIC por padrão | Corrigido: `alter default privileges ... revoke execute ... from public, anon` |
| 6 | Views/sequências sem revoke explícito para anon/public (v_sales, v_report_profit…) | Corrigido |
| 7 | Um admin podia rebaixar/desativar o dono ou criar admins pela API | Corrigido: trigger `profiles_guard` (só o dono) + log |
| 8 | `profiles_admin_update` with check sem `mfa_ok()` | Corrigido |
| 9 | Nenhum log de login falho/mudança de função; sem trava | Corrigido (migration-004) |
| 10 | Sessão em sessionStorage, CSP restrita, frame-ancestors none, robots Disallow | OK |
| 11 | Recomendado no Dashboard: Auth › Rate limits (já), "Leaked password protection" ON, 2FA obrigatório para admins (ativar no app), JWT expiry 3600 s ou menos | Manual |

## Loja (bagda-loja)
Rodar `supabase-loja/security.sql` depois de `schema.sql`/`users.sql` — e de novo sempre que rodar `schema.sql`. Mesma trava, log e RPCs; o app /loja ainda não tem os botões (por SQL/RPC).

## URLs (nov/2026)
Apps em `/kiosk/` (quiosque) e `/main/` (BAGDA STORES). `/sistema/` e `/loja/` redirecionam mantendo ?query e #hash. Supabase: Site URL nova; manter as antigas em Redirect URLs.
