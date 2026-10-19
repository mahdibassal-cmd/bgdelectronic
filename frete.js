/* BAGDA · frete pelo WhatsApp (compartilhado). Sem preços no site: o cliente digita o CEP
   e abrimos o WhatsApp com a mensagem pronta; a equipe calcula frete e prazo.
   Uso: BagdaFrete.box({id:'x', item:'Produto', price:'R$ 1,00'}) → HTML do formulário. */
(function () {
  'use strict';
  var NUM = String(window.WHATSAPP_NUMBER || (typeof WHATSAPP_NUMBER !== 'undefined' ? WHATSAPP_NUMBER : '') || '5511992873509').replace(/\D/g, '');
  var CACHE = {};
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(c) { return c.slice(0, 5) + '-' + c.slice(5); }
  function wa(t) { return 'https://wa.me/' + NUM + '?text=' + encodeURIComponent(t); }
  function lookup(c) { /* só enriquece a mensagem se já respondeu; nunca bloqueia o envio */
    if (CACHE[c] !== undefined || !window.fetch) return; CACHE[c] = null;
    fetch('https://brasilapi.com.br/api/cep/v1/' + c).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (d && d.state) CACHE[c] = { state: d.state, city: d.city }; }).catch(function () {});
  }
  function msg(item, price, c) {
    var i = CACHE[c], where = i && i.state ? (i.city ? i.city + '/' : '') + i.state : '';
    return 'Olá! ' + (item ? 'Quero o ' + item + (price ? ' de ' + price : '') + '. ' : '') + 'Meu CEP é ' + fmt(c) + (where ? ' (' + where + ')' : '') + '. Quanto fica o frete e o prazo?';
  }
  var ICO = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.2.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z"/></svg>';
  function box(o) {
    o = o || {}; var k = 'bf_' + (o.id || 'home');
    return '<form class="bf-frete" novalidate data-item="' + esc(o.item || '') + '" data-price="' + esc(o.price || '') + '">' +
      '<label class="bf-lbl mono" for="' + k + '">Calcular frete</label>' +
      '<div class="bf-row"><input id="' + k + '" class="bf-cep" inputmode="numeric" autocomplete="postal-code" placeholder="Seu CEP · 00000-000" maxlength="9" aria-describedby="' + k + '_m">' +
      '<button class="btn bf-go mono" type="submit">' + ICO + 'Calcular frete no WhatsApp</button></div>' +
      '<div class="bf-out" id="' + k + '_m" aria-live="polite"></div>' +
      '<a class="bf-nocep" href="https://buscacepinter.correios.com.br/app/endereco/index.php" target="_blank" rel="noopener">Não sei meu CEP</a></form>';
  }
  document.addEventListener('input', function (e) {
    if (!e.target.classList || !e.target.classList.contains('bf-cep')) return;
    var v = e.target.value.replace(/\D/g, '').slice(0, 8);
    e.target.value = v.length > 5 ? v.slice(0, 5) + '-' + v.slice(5) : v;
    if (v.length === 8) lookup(v);
  });
  document.addEventListener('submit', function (e) {
    var f = e.target.closest && e.target.closest('form.bf-frete'); if (!f) return; e.preventDefault();
    var inp = f.querySelector('.bf-cep'), out = f.querySelector('.bf-out'), c = inp.value.replace(/\D/g, '');
    if (c.length !== 8) { out.innerHTML = '<div class="bf-err">Digite um CEP com 8 números (ex.: 03010-000).</div>'; inp.focus(); return; }
    var url = wa(msg(f.dataset.item, f.dataset.price, c)), w = window.open(url, '_blank');
    if (w) { try { w.opener = null; } catch (_) {} }
    out.innerHTML = '<div class="bf-ok">Abrimos o WhatsApp com o seu CEP <b>' + fmt(c) + '</b>. Nossa equipe confirma o frete e o prazo. <a href="' + url + '" target="_blank" rel="noopener">Não abriu? Toque aqui</a></div>';
    if (!w) { try { location.href = url; } catch (_) {} }
  });
  window.BagdaFrete = { box: box, message: msg, wa: wa };
})();
