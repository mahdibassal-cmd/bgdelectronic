/* Nome de cliente para a loja /main: mesma chave na tela e no banco.
   trim, espaços internos viram um só, sem acento, minúsculas.
   Telefone e CPF/CNPJ entram só pelos dígitos. Vazio não é duplicata. */
(function (root) {
  "use strict";
  function key(nome) {
    return String(nome ?? "")
      .replace(/[\u00a0\u2007\u202f]/g, " ")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
  }
  function docKey(doc) {
    const d = String(doc ?? "").replace(/\D/g, "");
    return d || "";
  }
  function telKey(tel) {
    const d = String(tel ?? "").replace(/\D/g, "");
    return d || "";
  }
  function sameId(a, exceptId) {
    return exceptId != null && String(a) === String(exceptId);
  }
  function prefer(list) {
    return [...list].sort((a, b) => ((a.ativo === false) - (b.ativo === false)) || (Number(a.id) - Number(b.id)))[0] || null;
  }
  function findNome(list, nome, exceptId) {
    const want = key(nome);
    if (want.length < 2) return null;
    return prefer((list || []).filter(c => c && !sameId(c.id, exceptId) && key(c.nome) === want));
  }
  function findDoc(list, doc, exceptId) {
    const want = docKey(doc);
    if (!want) return null;
    return prefer((list || []).filter(c => c && !sameId(c.id, exceptId) && docKey(c.doc) === want));
  }
  function findTel(list, tel, exceptId) {
    const want = telKey(tel);
    if (!want) return null;
    return prefer((list || []).filter(c => c && !sameId(c.id, exceptId) && telKey(c.telefone) === want));
  }
  function duplicata(list, c, exceptId) {
    if (!c) return null;
    const nome = findNome(list, c.nome, exceptId);
    if (nome) return { ...nome, motivo: "nome" };
    const doc = findDoc(list, c.doc, exceptId);
    if (doc) return { ...doc, motivo: "doc" };
    const tel = findTel(list, c.telefone, exceptId);
    if (tel) return { ...tel, motivo: "tel" };
    return null;
  }
  function mensagem(dup) {
    const nome = dup && dup.nome != null ? dup.nome : "";
    const id = dup && dup.id != null ? dup.id : "";
    if (dup && dup.motivo === "doc") return `Já existe um cliente com esse CPF/CNPJ: ${nome} (#${id}). Use o cadastro existente.`;
    if (dup && dup.motivo === "tel") return `Já existe um cliente com esse telefone: ${nome} (#${id}). Use o cadastro existente.`;
    return `Já existe um cliente com esse nome: ${nome} (#${id}). Use o cadastro existente.`;
  }
  function limparErro(raw) {
    const s = String(raw ?? "");
    const m = s.match(/Já existe um cliente com esse (?:nome|CPF\/CNPJ|telefone): .+ \(#\d+\)\. Use o cadastro existente\./);
    if (m) return m[0].replace(/\s+/g, " ").trim();
    return s.replace(/^ERROR:\s*/i, "").split("\n")[0].replace(/\s*CONTEXT:[\s\S]*$/i, "").trim();
  }
  function parseErro(raw) {
    const s = limparErro(raw);
    const m = s.match(/^Já existe um cliente com esse (nome|CPF\/CNPJ|telefone): (.+) \(#(\d+)\)\. Use o cadastro existente\.$/);
    if (!m) return null;
    const motivo = m[1] === "CPF/CNPJ" ? "doc" : m[1] === "telefone" ? "tel" : "nome";
    return { motivo, nome: m[2], id: Number(m[3]) };
  }
  /* Buscas parciais para o RPC atual (lower + like), antes do cliente_por_nome existir. */
  function consultas(nome) {
    const full = String(nome ?? "").replace(/[\u00a0\u2007\u202f]/g, " ").trim().replace(/\s+/g, " ");
    const out = [];
    if (full.length >= 2) out.push(full);
    for (const w of key(nome).split(" ")) {
      if (w.length >= 3 && !out.some(q => key(q) === w)) out.push(w);
    }
    return out.slice(0, 4);
  }
  root.BAGDA_CLIENTE_NOME = { key, docKey, telKey, findNome, findDoc, findTel, duplicata, mensagem, limparErro, parseErro, consultas };
})(typeof globalThis !== "undefined" ? globalThis : this);
