// Seletor de loja (só admin). Só conveniência de navegação: cada app verifica admin no próprio Supabase (RLS + profiles.role).
(function () {
  const ref = u => (String(u || "").match(/^https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1] || "x";
  const key = u => "bgd-auth-" + ref(u);
  const here = () => location.pathname.replace(/[^/]*$/, "");
  const hasSession = s => { try { const j = JSON.parse(sessionStorage.getItem(key(s.supabaseUrl)) || "null"); return !!(j && j.access_token && j.expires_at * 1000 > Date.now() + 30000); } catch { return false; } };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  window.BGDSwitch = {
    storageKey: key,
    async mount(me, email) {
      if (!me || me.role !== "admin") return;
      let L; try { L = await (await fetch("/stores.json", { cache: "no-store" })).json(); } catch { return; }
      if (!Array.isArray(L) || L.length < 2 || document.getElementById("bgdsw")) return;
      const cur = L.find(s => here() === s.url) || {};
      const sel = document.createElement("select");
      sel.id = "bgdsw"; sel.title = "Trocar de loja"; sel.style.cssText = "margin-left:8px;padding:4px 8px;border-radius:8px;width:auto;max-width:220px";
      sel.innerHTML = L.map((s, i) => `<option value="${i}" ${s.url === cur.url ? "selected" : ""}>${esc(s.nome)}</option>`).join("");
      sel.onchange = () => {
        const t = L[+sel.value]; if (!t || t.url === cur.url) return;
        const mock = new URLSearchParams(location.search).get("mock");
        if (mock) { location.href = t.url + "?mock=" + encodeURIComponent(mock) + "&auto=1"; return; }
        if (!hasSession(t)) sessionStorage.setItem("bgd-switch", JSON.stringify({ email: email || "", nome: t.nome, url: t.url }));
        location.href = t.url;
      };
      const w = document.getElementById("who"); w && w.after(sel);
    },
    prefill() {
      let j; try { j = JSON.parse(sessionStorage.getItem("bgd-switch") || "null"); } catch {}
      if (!j || j.url !== here()) return;
      sessionStorage.removeItem("bgd-switch");
      const h = document.querySelector(".login h2"), e = document.getElementById("e");
      if (h) h.textContent = "Entrar no " + j.nome;
      if (e && j.email) { e.value = j.email; const p = document.querySelector('.login input[type=password]'); p && p.focus(); }
    }
  };
})();
