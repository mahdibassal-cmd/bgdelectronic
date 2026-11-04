// BAGDA — Edge Function "admin-users" (mesmo código para bagda-loja e bagda-sistema).
// Só admin ativo (verificado no banco com o JWT de quem chama) pode usar.
// A SERVICE_ROLE key é injetada automaticamente pelo Supabase (SUPABASE_SERVICE_ROLE_KEY) e NUNCA vai ao front/repo.
// Senhas só passam para o Supabase Auth; não são gravadas nem logadas em nenhum outro lugar.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const ORIGIN = "https://bgdstores.com";
const URL_ = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// bagda-sistema (kiosk) usa o enum ('admin','seller'); bagda-loja usa ('admin','vendedor','financeiro').
const KIOSK = URL_.includes("zoapljfhebbvbsrebtjt");
const STORE = KIOSK ? "Kiosk" : "BAGDA STORES";
const UI_ROLES = KIOSK ? ["vendedor", "admin"] : ["vendedor", "financeiro", "estoque", "admin"];
const toDb = (r: string) => (KIOSK && r === "vendedor" ? "seller" : r);
const toUi = (r: string) => (KIOSK && r === "seller" ? "vendedor" : r);
const BAN = "876000h"; // ~100 anos

const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const H = { ...cors(origin), "Content-Type": "application/json" };
  const out = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: H });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (origin !== ORIGIN) return out(403, { error: "Origem não permitida" });
  if (req.method !== "POST") return out(405, { error: "Método não permitido" });

  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return out(401, { error: "Faça login de novo" });
  const caller = createClient(URL_, ANON, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: who, error: whoErr } = await caller.auth.getUser();
  if (whoErr || !who?.user) return out(401, { error: "Sessão inválida — faça login de novo" });
  const me = who.user.id;
  // Checagem com o JWT de quem chama: is_admin() (perfil ativo + role admin + sistema destravado) e mfa_ok() (2FA se cadastrado).
  const [{ data: isAdm }, { data: mfa }] = await Promise.all([caller.rpc("is_admin"), caller.rpc("mfa_ok")]);
  if (isAdm !== true) return out(403, { error: "Só admin pode gerenciar usuários" });
  if (mfa !== true) return out(403, { error: "Confirme o 2FA (código do app) antes de gerenciar usuários" });

  const adm = createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return out(400, { error: "Requisição inválida" }); }
  const s = (k: string, max = 200) => (typeof b[k] === "string" ? (b[k] as string).trim().slice(0, max) : "");
  const action = s("action", 20);
  const uuidOk = (v: string) => /^[0-9a-f-]{36}$/i.test(v);
  const pwOk = (p: unknown) => typeof p === "string" && p.length >= 8 && p.length <= 72;
  const log = async (kind: string, detail: Record<string, unknown>) => {
    try { await adm.from("security_events").insert({ kind, actor: me, email: (who.user.email || "").slice(0, 160), detail }); } catch { /* log é opcional */ }
  };

  try {
    if (action === "list") {
      const { data: profs, error } = await adm.from("profiles").select("id,handle,nome,role,ativo,created_at").order("nome");
      if (error) throw error;
      const emails: Record<string, { email?: string; banned_until?: string }> = {};
      for (let page = 1; page < 20; page++) {
        const { data, error: e } = await adm.auth.admin.listUsers({ page, perPage: 1000 });
        if (e) throw e;
        for (const u of data.users) emails[u.id] = { email: u.email, banned_until: (u as { banned_until?: string }).banned_until };
        if (data.users.length < 1000) break;
      }
      return out(200, { store: STORE, users: (profs || []).map((p) => ({ ...p, role: toUi(p.role), email: emails[p.id]?.email || "", banned_until: emails[p.id]?.banned_until || null })) });
    }

    if (action === "create") {
      const nome = s("nome", 60), email = s("email", 160).toLowerCase(), role = s("role", 20);
      if (nome.length < 2) return out(400, { error: "Informe o nome" });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return out(400, { error: "E-mail inválido" });
      if (!pwOk(b.password)) return out(400, { error: "Senha precisa de 8 a 72 caracteres" });
      if (!UI_ROLES.includes(role)) return out(400, { error: KIOSK ? "No Kiosk a função é Vendedor(a) ou Admin" : "Função inválida" });
      if (b.store && b.store !== STORE) return out(400, { error: `Este sistema é ${STORE}. Troque de loja no seletor para criar lá.` });
      // handle único: @primeironome (+número se já existir)
      const base = ("@" + nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9_]/g, "")).slice(0, 18) || "@user";
      let handle = base.length >= 3 ? base : base + "_u";
      for (let i = 2; i < 100; i++) {
        const { data: ex } = await adm.from("profiles").select("id").eq("handle", handle).maybeSingle();
        if (!ex) break; handle = (base + i).slice(0, 21);
      }
      const { data: cu, error: ce } = await adm.auth.admin.createUser({ email, password: b.password as string, email_confirm: true, user_metadata: { nome } });
      if (ce) return out(400, { error: /already|registered|exists/i.test(ce.message) ? "Já existe um usuário com esse e-mail" : ce.message });
      const { error: pe } = await adm.from("profiles").upsert({ id: cu.user.id, handle, nome, role: toDb(role), ativo: true }, { onConflict: "id" });
      if (pe) { await adm.auth.admin.deleteUser(cu.user.id); return out(400, { error: "Não deu para criar o perfil: " + pe.message }); }
      await log("profile_added", { id: cu.user.id, handle, role });
      return out(200, { ok: true, id: cu.user.id, handle });
    }

    const id = s("id", 40);
    if (!uuidOk(id)) return out(400, { error: "Usuário inválido" });
    const { data: target } = await adm.from("profiles").select("id,role,ativo").eq("id", id).maybeSingle();
    if (!target) return out(404, { error: "Usuário não encontrado" });

    if (action === "reset_password") {
      if (!pwOk(b.password)) return out(400, { error: "Senha precisa de 8 a 72 caracteres" });
      const { error } = await adm.auth.admin.updateUserById(id, { password: b.password as string });
      if (error) throw error;
      await log("role_change", { id, change: "password_reset" });
      return out(200, { ok: true });
    }
    if (action === "set_role") {
      const role = s("role", 20);
      if (!UI_ROLES.includes(role)) return out(400, { error: "Função inválida" });
      if (id === me) return out(400, { error: "Você não pode mudar a própria função" });
      const { error } = await adm.from("profiles").update({ role: toDb(role) }).eq("id", id);
      if (error) throw error;
      await log(role === "admin" ? "admin_added" : "role_change", { id, from: toUi(target.role), to: role });
      return out(200, { ok: true });
    }
    if (action === "set_active") {
      if (typeof b.ativo !== "boolean") return out(400, { error: "Valor inválido" });
      if (id === me) return out(400, { error: "Você não pode se desativar" });
      const { error: ue } = await adm.auth.admin.updateUserById(id, { ban_duration: b.ativo ? "none" : BAN });
      if (ue) throw ue;
      const { error } = await adm.from("profiles").update({ ativo: b.ativo }).eq("id", id);
      if (error) throw error;
      await log(b.ativo ? "profile_added" : "profile_removed", { id, ativo: b.ativo });
      return out(200, { ok: true });
    }
    return out(400, { error: "Ação desconhecida" });
  } catch (e) {
    return out(500, { error: (e as Error).message || "Erro no servidor" });
  }
});
