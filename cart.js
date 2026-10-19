/* BAGDA · carrinho compartilhado (eletrônicos + perfumes), salvo no navegador (localStorage).
   Uso: BagdaCart.button({key, name, variant, price:Number, payLink, img}) → HTML do botão "Adicionar ao carrinho". */
(function () {
  'use strict';
  var KEY = 'bagda_cart_v1', NUM = '5511992873509', MAX = 99;
  var items = load(), cepInfo = {}, root;
  function load() { try { var a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a.filter(function (i) { return i && i.key && i.price > 0; }) : []; } catch (_) { return []; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (_) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) { return 'R$ ' + (Math.round(n * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function clampQ(q) { q = parseInt(q, 10); return isNaN(q) || q < 1 ? 1 : (q > MAX ? MAX : q); }
  function count() { return items.reduce(function (s, i) { return s + i.qty; }, 0); }
  function subtotal() { return items.reduce(function (s, i) { return s + i.qty * i.price; }, 0); }
  function label(i) { return i.name + (i.variant ? ' (' + i.variant + ')' : ''); }
  function find(k) { for (var j = 0; j < items.length; j++) if (items[j].key === k) return items[j]; return null; }
  function add(it) {
    if (!it || !it.key || !(it.price > 0)) return;
    var ex = find(it.key);
    if (ex) ex.qty = clampQ(ex.qty + 1); else items.push({ key: it.key, name: it.name, variant: it.variant || '', price: +it.price, payLink: it.payLink || '', img: it.img || '', qty: 1 });
    save(); render(); toast('Adicionado ao carrinho');
  }
  function setQty(k, q) { var i = find(k); if (i) { i.qty = clampQ(q); save(); render(true); } }
  function remove(k) { items = items.filter(function (i) { return i.key !== k; }); save(); render(); }
  function clear() { items = []; save(); render(); }
  function cepDigits() { var el = root && root.querySelector('.bc-cep'); return el ? el.value.replace(/\D/g, '') : ''; }
  function message() {
    var L = ['Olá! Vim pelo site da BAGDA e quero fazer este pedido:', ''];
    items.forEach(function (i) { L.push(i.qty + ' x ' + label(i) + ' — ' + money(i.price) + ' = ' + money(i.qty * i.price)); });
    L.push('', 'Subtotal: ' + money(subtotal()) + ' (sem frete)');
    var c = cepDigits();
    if (c.length === 8) { var w = cepInfo[c]; L.push('CEP: ' + c.slice(0, 5) + '-' + c.slice(5) + (w ? ' (' + (w.city ? w.city + '/' : '') + w.state + ')' : '')); }
    L.push('Código do pedido: ' + txid());
    L.push('Pagamento: PIX, débito ou crédito em até 12x — aguardo o link/frete');
    return L.join('\n');
  }

  /* ---------- PIX (BR Code estático, Manual de Padrões para Iniciação do Pix · Banco Central) ---------- */
  var PIX = { key: '44696038000116', name: 'BGD ELECTRONICS', city: 'SAO PAULO' };
  function tlv(id, v) { v = String(v); return id + (v.length < 10 ? '0' : '') + v.length + v; }
  function crc16(str) { /* CRC16-CCITT-FALSE: poly 0x1021, init 0xFFFF */
    var c = 0xFFFF;
    for (var i = 0; i < str.length; i++) { c ^= str.charCodeAt(i) << 8; for (var b = 0; b < 8; b++) c = (c & 0x8000) ? ((c << 1) ^ 0x1021) & 0xFFFF : (c << 1) & 0xFFFF; }
    return ('000' + c.toString(16).toUpperCase()).slice(-4);
  }
  function pixPayload(amount, txid) {
    var p = tlv('00', '01') + tlv('26', tlv('00', 'br.gov.bcb.pix') + tlv('01', PIX.key)) + tlv('52', '0000') + tlv('53', '986') +
      tlv('54', amount.toFixed(2)) + tlv('58', 'BR') + tlv('59', PIX.name.slice(0, 25)) + tlv('60', PIX.city.slice(0, 15)) + tlv('62', tlv('05', txid)) + '6304';
    return p + crc16(p);
  }
  var TX = null; /* código do pedido: muda quando o carrinho muda */
  function sig() { return items.map(function (i) { return i.key + ':' + i.qty; }).join('|'); }
  function txid() {
    var s = sig(); if (TX && TX.sig === s) return TX.id;
    var d = new Date(), z = function (n) { return ('0' + n).slice(-2); }, A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', r = '';
    for (var k = 0; k < 2; k++) r += A.charAt(Math.floor(Math.random() * A.length));
    TX = { sig: s, id: 'BGD' + z(d.getFullYear() % 100) + z(d.getMonth() + 1) + z(d.getDate()) + z(d.getHours()) + z(d.getMinutes()) + r };
    return TX.id;
  }
  function qrSVG(text) {
    if (typeof qrcode !== 'function') return '';
    var q = qrcode(0, 'M'); q.addData(text); q.make();
    return q.createSvgTag({ cellSize: 4, margin: 3, scalable: true });
  }
  function copyText(t, btn) {
    function ok() { btn.textContent = 'Código copiado ✓'; setTimeout(function () { btn.textContent = 'Copiar código'; }, 2200); }
    function fb() { var ta = root.querySelector('.bc-pixcode'); ta.removeAttribute('readonly'); ta.select(); ta.setSelectionRange(0, 9999); try { document.execCommand('copy'); ok(); } catch (_) { toast('Selecione e copie o código'); } ta.setAttribute('readonly', ''); }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).then(ok, fb); else fb();
  }
  var pixOpen = false;
  function pixHTML() {
    var tot = subtotal(), id = txid(), code = pixPayload(tot, id);
    return '<button type="button" class="bc-pixbtn" aria-expanded="' + pixOpen + '">' + PIXICO + 'Pagar com PIX · ' + money(tot) + '</button>' +
      (pixOpen ? '<div class="bc-pixbox"><div class="bc-qr" role="img" aria-label="QR Code PIX">' + qrSVG(code) + '</div>' +
      '<div class="bc-pixid">Pedido <b>' + id + '</b> · ' + money(tot) + '</div>' +
      '<label class="bc-cl">Pix Copia e Cola</label><textarea class="bc-pixcode" readonly rows="3">' + esc(code) + '</textarea>' +
      '<button type="button" class="bc-copy">Copiar código</button>' +
      '<p class="bc-small">O valor é dos produtos (sem frete). Após pagar, envie o comprovante no WhatsApp.</p>' +
      '<a class="bc-go bc-proof" target="_blank" rel="noopener" href="' + waProofUrl() + '">Enviar comprovante no WhatsApp</a></div>' : '');
  }
  function waProofUrl() { return 'https://wa.me/' + NUM + '?text=' + encodeURIComponent(message() + '\n\nPago via PIX · código do pedido ' + txid() + ' · ' + money(subtotal())); }
  var PIXICO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.6 7.6 7a2.2 2.2 0 0 1 1.6.7L12 10.5l2.8-2.8a2.2 2.2 0 0 1 1.6-.7L12 2.6Zm-6.3 6L2.6 12l3.1 3.4h1.8c.4 0 .8-.2 1.1-.5l2.5-2.5a1.3 1.3 0 0 1 1.8 0l2.5 2.5c.3.3.7.5 1.1.5h1.8l3.1-3.4-3.1-3.4h-1.8c-.4 0-.8.2-1.1.5l-2.5 2.5a1.3 1.3 0 0 1-1.8 0L8.6 9.1c-.3-.3-.7-.5-1.1-.5H5.7ZM12 13.5l-2.8 2.8a2.2 2.2 0 0 1-1.6.7L12 21.4l4.4-4.4a2.2 2.2 0 0 1-1.6-.7L12 13.5Z"/></svg>';
  function waUrl() { return 'https://wa.me/' + NUM + '?text=' + encodeURIComponent(message()); }
  var BAG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M5 8h14l-1.2 12H6.2z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>';
  function button(it, cls) {
    return '<button type="button" class="bc-add ' + (cls || '') + '" data-bc=\'' + esc(JSON.stringify(it)) + '\'>' + BAG + '<span>Adicionar ao carrinho</span></button>';
  }
  function build() {
    root = document.createElement('div'); root.className = 'bc';
    root.innerHTML = '<button class="bc-fab" type="button" aria-label="Abrir carrinho">' + BAG + '<b class="bc-n">0</b></button>' +
      '<div class="bc-panel" role="dialog" aria-modal="true" aria-label="Carrinho" aria-hidden="true"><div class="bc-bd" data-bcclose></div>' +
      '<aside class="bc-box"><header class="bc-top"><span>Seu carrinho</span><button class="bc-x" type="button" data-bcclose aria-label="Fechar carrinho">×</button></header>' +
      '<div class="bc-body"></div></aside></div><div class="bc-toast" role="status"></div>';
    document.body.appendChild(root);
    root.addEventListener('click', function (e) {
      var t = e.target;
      if (t.closest('.bc-fab')) return open();
      if (t.closest('[data-bcclose]')) return close();
      var b = t.closest('[data-bq]'); if (b) { var i = find(b.dataset.k); if (i) setQty(i.key, i.qty + (+b.dataset.bq)); render(); return; }
      var r = t.closest('[data-brm]'); if (r) return remove(r.dataset.brm);
      if (t.closest('.bc-pixbtn')) { pixOpen = !pixOpen; render(true); return; }
      if (t.closest('.bc-copy')) { copyText(root.querySelector('.bc-pixcode').value, t.closest('.bc-copy')); return; }
      if (t.closest('.bc-clear')) { if (confirm('Limpar o carrinho?')) clear(); return; }
    });
    root.addEventListener('change', function (e) { if (e.target.classList.contains('bc-q')) { setQty(e.target.dataset.k, e.target.value); render(); } });
    root.addEventListener('input', function (e) {
      if (e.target.classList.contains('bc-q')) { var v = e.target.value.replace(/\D/g, '').slice(0, 2); e.target.value = v; if (v) setQty(e.target.dataset.k, v); }
      if (e.target.classList.contains('bc-cep')) {
        var c = e.target.value.replace(/\D/g, '').slice(0, 8); e.target.value = c.length > 5 ? c.slice(0, 5) + '-' + c.slice(5) : c;
        if (c.length === 8 && !cepInfo[c] && window.fetch) fetch('https://brasilapi.com.br/api/cep/v1/' + c).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { if (d && d.state) { cepInfo[c] = { city: d.city, state: d.state }; render(true); } }).catch(function () {});
        render(true);
      }
    });
  }
  function open() { root.querySelector('.bc-panel').classList.add('open'); root.querySelector('.bc-panel').setAttribute('aria-hidden', 'false'); document.documentElement.classList.add('bc-lock'); render(); }
  function close() { root.querySelector('.bc-panel').classList.remove('open'); root.querySelector('.bc-panel').setAttribute('aria-hidden', 'true'); document.documentElement.classList.remove('bc-lock'); }
  function render(light) {
    if (!root) return;
    var n = count(); root.querySelector('.bc-n').textContent = n; root.classList.toggle('has', n > 0);
    var body = root.querySelector('.bc-body');
    var single = items.length === 1 && items[0].qty === 1 && /^https:\/\//.test(items[0].payLink || '');
    if (light && body.querySelector('.bc-sub')) { /* só atualiza números, mantém o foco no campo */
      body.querySelector('.bc-sub b').textContent = money(subtotal());
      items.forEach(function (i) { var r = body.querySelector('[data-row="' + CSS.escape(i.key) + '"]'); if (r) { r.querySelector('.bc-line').textContent = money(i.qty * i.price); var q = r.querySelector('.bc-q'); if (document.activeElement !== q) q.value = i.qty; } });
      var c = cepDigits(), w = cepInfo[c]; body.querySelector('.bc-where').textContent = c.length === 8 && w ? (w.city ? w.city + '/' : '') + w.state : '';
      body.querySelector('.bc-fin').href = waUrl();
      var px = body.querySelector('.bc-pix'); if (px && px.dataset.s !== sig() + '|' + pixOpen) { px.innerHTML = pixHTML(); px.dataset.s = sig() + '|' + pixOpen; } else if (px) { var pr = px.querySelector('.bc-proof'); if (pr) pr.href = waProofUrl(); }
      var pay = body.querySelector('.bc-paybox'); if (pay) pay.innerHTML = payHTML(single);
      return;
    }
    if (!items.length) { body.innerHTML = '<div class="bc-empty">Seu carrinho está vazio.<br><small>Toque em “Adicionar ao carrinho” em qualquer produto.</small></div>'; return; }
    var cep = cepDigits();
    body.innerHTML = '<ul class="bc-list">' + items.map(function (i) {
      return '<li class="bc-it" data-row="' + esc(i.key) + '">' + (i.img ? '<img src="' + esc(i.img) + '" alt="">' : '<span class="bc-ph"></span>') +
        '<div class="bc-info"><div class="bc-name">' + esc(i.name) + '</div>' + (i.variant ? '<div class="bc-var">' + esc(i.variant) + '</div>' : '') +
        '<div class="bc-unit">' + money(i.price) + ' / un.</div>' +
        '<div class="bc-row"><div class="bc-qty"><button type="button" data-bq="-1" data-k="' + esc(i.key) + '" aria-label="Menos"' + (i.qty <= 1 ? ' disabled' : '') + '>−</button>' +
        '<input class="bc-q" data-k="' + esc(i.key) + '" inputmode="numeric" value="' + i.qty + '" aria-label="Quantidade">' +
        '<button type="button" data-bq="1" data-k="' + esc(i.key) + '" aria-label="Mais"' + (i.qty >= MAX ? ' disabled' : '') + '>+</button></div>' +
        '<b class="bc-line">' + money(i.qty * i.price) + '</b></div></div>' +
        '<button class="bc-rm" type="button" data-brm="' + esc(i.key) + '" aria-label="Remover ' + esc(i.name) + '">×</button></li>';
    }).join('') + '</ul>' +
      '<div class="bc-foot"><div class="bc-sub"><span>Subtotal</span><b>' + money(subtotal()) + '</b></div>' +
      '<div class="bc-pix">' + pixHTML() + '</div>' +
      '<p class="bc-note">Frete combinado no WhatsApp · Fast Entrega moto em SP · Retirada grátis no Brás · SEDEX para todo o Brasil</p>' +
      '<label class="bc-cl">CEP (opcional) <span class="bc-where"></span></label><input class="bc-cep" inputmode="numeric" autocomplete="postal-code" maxlength="9" placeholder="00000-000" value="' + (cep.length > 5 ? cep.slice(0, 5) + '-' + cep.slice(5) : cep) + '">' +
      '<a class="bc-go bc-fin" target="_blank" rel="noopener" href="' + waUrl() + '">Finalizar no WhatsApp</a>' +
      '<div class="bc-paybox">' + payHTML(single) + '</div>' +
      '<button class="bc-clear" type="button">Limpar carrinho</button></div>';
    render(true);
  }
  function payHTML(single) {
    return single ? '<a class="bc-pay" target="_blank" rel="noopener" href="' + esc(items[0].payLink) + '">Pagar · PIX ou cartão</a><p class="bc-small">PIX, débito ou crédito em até 12x · Frete combinado no WhatsApp</p>'
      : '<p class="bc-small">Cartão em até 12x: enviamos o link Getnet com o total pelo WhatsApp.</p>';
  }
  var tt;
  function toast(m) { var t = root.querySelector('.bc-toast'); t.textContent = m; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(function () { t.classList.remove('on'); }, 1800); }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.bc-add'); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    try { add(JSON.parse(b.getAttribute('data-bc'))); } catch (_) {}
  }, true);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && root && root.querySelector('.bc-panel.open')) close(); });
  window.addEventListener('storage', function (e) { if (e.key === KEY) { items = load(); render(); } });
  function init() { build(); render(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.BagdaCart = { pix: function () { return pixPayload(subtotal(), txid()); }, pixPayload: pixPayload, crc16: crc16, add: add, button: button, items: function () { return items.slice(); }, message: message, url: waUrl, open: open, close: close, clear: clear, setQty: setQty, remove: remove };
})();
