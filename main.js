/* BAGDA STORES / BAGDA PERFUMES: lógica do site (não precisa editar).
   Produtos e preços: data.js · WhatsApp, endereço e contatos: config.js */
(function () {
  'use strict';
  var C = SITE_CONFIG;
  var LOAD = /[?&]eager\b/.test(location.search) ? 'eager' : 'lazy'; // ?eager só para gerar prints
  var ICONS = {
    console: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10v4M5 12h4"/><circle cx="16" cy="11" r=".6"/><circle cx="18" cy="13" r=".6"/>',
    dish: '<path d="M5 4h14l-2 11H7z"/><path d="M12 15v4M8 21h8"/>',
    gamepad: '<path d="M6.5 7h11a4 4 0 0 1 4 4.3l-.4 4.6a2.6 2.6 0 0 1-4.6 1.4L15 15.5H9l-1.5 1.8a2.6 2.6 0 0 1-4.6-1.4l-.4-4.6A4 4 0 0 1 6.5 7Z"/><path d="M7.5 10v3M6 11.5h3"/>',
    speaker: '<rect x="2" y="7" width="20" height="11" rx="5.5"/><circle cx="7.5" cy="12.5" r="2.5"/><circle cx="16.5" cy="12.5" r="2.5"/><path d="M8 7V5h8v2"/>',
    tag: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v2"/>',
    ring: '<ellipse cx="12" cy="13" rx="8" ry="7"/><ellipse cx="12" cy="13" rx="5" ry="4.2"/>',
    watch: '<rect x="6" y="6" width="12" height="12" rx="3"/><path d="M9 6l1-4h4l1 4M9 18l1 4h4l1-4M12 9.5V12l1.5 1.5"/>',
    cable: '<path d="M7 3v5M11 3v5M5 8h8v3a4 4 0 0 1-8 0V8ZM9 15v2a4 4 0 0 0 4 4h2a4 4 0 0 0 4-4V6"/>',
    keyboard: '<rect x="2" y="7" width="20" height="10" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
    fryer: '<path d="M5 6a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3Z"/><path d="M5 11h14M9 15h6"/>',
    bottle: '<path d="M10 2h4v3h-4zM9 5h6l1 3H8z"/><rect x="5" y="8" width="14" height="14" rx="3"/><path d="M9 14h6"/>'
  };
  var EL_CATS = ['Consoles','Starlink','Acessórios Gaming','Áudio & Som','Smart & Tech','Wearables','Smartwatches','Apple & Acessórios','Notebooks & Periféricos','Cozinha & Casa'];
  var SOON = ['Robôs & Casa Inteligente']; // categorias sem produtos ainda (aparecem como "em breve")

  function wa(msg) { return 'https://wa.me/' + String(WHATSAPP_NUMBER).replace(/\D/g, '') + '?text=' + encodeURIComponent(msg); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(id) { return document.getElementById(id); }
  function svg(name) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || ICONS.tag) + '</svg>'; }

  document.querySelectorAll('.js-wa').forEach(function (a) { a.href = wa(C.storesMessage); });
  document.querySelectorAll('.js-wa-pf').forEach(function (a) { a.href = wa(C.perfumesMessage); });

  // Loja / contato
  $('addr').textContent = C.address;
  $('cep').textContent = C.cep;
  $('hours').textContent = C.hours;
  $('pay').textContent = C.payment;
  $('delivery').textContent = C.delivery;
  $('ig-stores').textContent = '@' + C.instagramStores; $('ig-stores').href = 'https://instagram.com/' + C.instagramStores;
  $('ig-perfumes').textContent = '@' + C.instagramPerfumes; $('ig-perfumes').href = 'https://instagram.com/' + C.instagramPerfumes;
  $('ml').innerHTML = C.mercadoLivreUrl ? '<a href="' + esc(C.mercadoLivreUrl) + '" target="_blank" rel="noopener">Loja BGD Electronics</a>' : 'Loja BGD Electronics · link em breve';
  if (C.email) { $('email-row').hidden = false; $('email').textContent = C.email; $('email').href = 'mailto:' + C.email; }
  $('maps').href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(C.mapsQuery);
  $('year').textContent = new Date().getFullYear();
  $('stat-count').textContent = PRODUCTS.length;
  var jbl = PRODUCTS.filter(function (p) { return /JBL Boombox 4/.test(p.name); })[0];
  $('hero-jbl-price').textContent = jbl ? (jbl.promo ? '🔥 ' : '') + jbl.price : '';

  function chips(el, list, counts, onPick) {
    el.innerHTML = '<button class="chip is-on" data-f="Todos">Todos</button>' + list.map(function (c) {
      return '<button class="chip" data-f="' + esc(c) + '">' + esc(c) + ' <small>' + counts[c] + '</small></button>';
    }).join('') + (onPick.soon || []).map(function (c) {
      return '<span class="chip chip-soon" title="Em breve">' + esc(c) + ' <small>em breve</small></span>';
    }).join('');
    el.addEventListener('click', function (e) {
      var b = e.target.closest('button.chip'); if (!b) return;
      el.querySelectorAll('button.chip').forEach(function (x) { x.classList.toggle('is-on', x === b); });
      onPick(b.dataset.f);
    });
  }
  function buyMsg(p) { return C.storesProduct.replace('{produto}', p.name).replace('{preco}', p.price); }
  function count(list, key) { var o = {}; list.forEach(function (p) { o[p[key]] = (o[p[key]] || 0) + 1; }); return o; }

  // Eletrônicos
  function renderEl(f) {
    var list = PRODUCTS.filter(function (p) { return f === 'Todos' || p.category === f; });
    $('el-grid').innerHTML = list.map(function (p) {
      var vis = p.image ? '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + '" loading="' + LOAD + '" decoding="async">'
        : '<div class="ph">' + svg(p.icon) + '<span class="mono">Foto em breve</span></div>';
      var i = PRODUCTS.indexOf(p);
      return '<article class="pcard">' +
        '<button class="pvisual pv-open' + (p.image ? '' : ' is-ph') + '" type="button" data-pv="' + i + '" aria-label="Ver ' + esc(p.name) + ' e calcular frete">' + vis + '</button>' +
        '<p class="label mono">' + esc(p.category) + '</p>' +
        (p.promo ? '<span class="fire-promo">🔥 ' + esc(p.promo) + '</span>' : '') +
        '<h3><button class="pv-open pv-name" type="button" data-pv="' + i + '">' + esc(p.name) + '</button></h3>' +
        '<div class="prow"><span class="price">' + esc(p.price) + '</span>' +
        '<a class="btn btn-sm mono" target="_blank" rel="noopener" href="' + wa(buyMsg(p)) + '">Pedir no WhatsApp</a></div>' +
        '<button class="pv-open pv-frete mono" type="button" data-pv="' + i + '">Frete e entrega →</button>' +
        '</article>';
    }).join('');
    $('el-count').textContent = list.length + ' itens';
  }
  var elCounts = count(PRODUCTS, 'category');
  var elCats = EL_CATS.filter(function (c) { return elCounts[c]; });
  renderEl.soon = SOON;
  chips($('el-filters'), elCats, elCounts, renderEl);
  renderEl('Todos');

  // Perfumes: teaser com destaques do catálogo /perfumes/ (preços do próprio catálogo, já com +10%)
  function teaser() {
    var D = window.BAGDA_DATA; if (!D) return;
    var byId = {}; D.perfumes.forEach(function (p) { byId[p.id] = p; });
    var list = FEATURED_PERFUMES.map(function (id) { return byId[id]; }).filter(Boolean);
    $('pf-count').textContent = D.perfumes.length + ' perfumes no catálogo';
    $('stat-count').textContent = PRODUCTS.length + D.perfumes.length;
    $('pf-grid').innerHTML = list.map(function (p) {
      var full = p.brand + ' ' + p.name + ' ' + p.size;
      return '<article class="pcard pf' + (p.soldOut ? ' is-out' : '') + '">' +
        '<a class="pvisual" href="perfumes/"><img src="perfumes/' + esc(p.photo) + '" alt="' + esc(full) + '" loading="' + LOAD + '" decoding="async"></a>' +
        '<p class="label mono">' + esc(p.brand) + ' · ' + esc(p.size) + '</p>' +
        '<h3>' + esc(p.name) + '</h3>' +
        '<div class="prow"><span class="price">' + esc(p.soldOut ? 'Esgotado' : p.priceLabel) + '</span>' +
        '<a class="btn btn-sm btn-gold mono" target="_blank" rel="noopener" href="' + wa(C.perfumesProduct.replace('{produto}', full).replace('{preco}', p.priceLabel)) + '">Pedir</a></div>' +
        '</article>';
    }).join('');
  }
  if (window.BAGDA_DATA) teaser(); else window.addEventListener('load', teaser);

  // Entregas: CEP → WhatsApp (frete.js) + vista do produto
  var F = window.BagdaFrete;
  if (F && $('ent-calc')) $('ent-calc').innerHTML = F.box({ id: 'home' });
  if ($('ent-maps')) $('ent-maps').href = $('maps').href;
  var pv = $('pv'), lastFocus = null;
  function payLink(p) {
    var k = ((p.image || '').match(/eletronicos\/([^\/]+)\.\w+$/) || [])[1];
    var u = (typeof PAY_LINKS !== 'undefined' && k) ? PAY_LINKS[k] : '';
    return /^https:\/\//.test(u || '') ? u : '';
  }
  function openPV(i) {
    var p = PRODUCTS[i]; if (!p || !pv) return;
    var pay = payLink(p);
    var vis = p.image ? '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + '" decoding="async">' : '<div class="ph">' + svg(p.icon) + '<span class="mono">Foto em breve</span></div>';
    $('pv-body').innerHTML = '<div class="pv-grid"><div class="pv-pic' + (p.image ? '' : ' is-ph') + '">' + vis + '</div><div class="pv-txt">' +
      '<p class="label mono">' + esc(p.category) + '</p><h3 class="pv-h">' + esc(p.name) + '</h3>' +
      (p.promo ? '<span class="fire-promo">🔥 ' + esc(p.promo) + '</span>' : '') + '<p class="pv-price">' + esc(p.price) + '</p><p class="pv-pay muted">' + esc(C.payment) + '. Loja física no Brás · 08:00–17:30.</p>' +
      '<a class="btn btn-wa mono" target="_blank" rel="noopener" href="' + wa(buyMsg(p)) + '"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-wa"/></svg>Pedir no WhatsApp</a>' +
      (window.BagdaCart ? BagdaCart.button({ key: 'el:' + (((p.image || '').match(/eletronicos\/([^\/]+)\.\w+$/) || [])[1] || p.name), name: p.name, variant: '', price: parseFloat(String(p.price).replace(/[^\d,]/g, '').replace(',', '.')), payLink: pay, img: p.image ? (/^(\/|https?:)/.test(p.image) ? p.image : '/' + p.image) : '' }) : '') +
      (pay ? '<a class="btn btn-gold btn-pay mono" target="_blank" rel="noopener" href="' + esc(pay) + '">Pagar · PIX ou cartão</a><p class="pv-paynote mono">PIX, débito ou crédito em até 12x · Frete combinado no WhatsApp</p>' : '') +
      '<ul class="pv-dlv"><li><b>Fast Entrega</b> · moto no mesmo dia em São Paulo</li><li><b>Retire grátis</b> na loja · Brás · 08:00–17:30</li><li><b>SEDEX para SP e todo o Brasil</b> · frete calculado no WhatsApp</li></ul>' +
      (F ? F.box({ id: 'p' + i, item: p.name, price: p.price }) : '') +
      '<p class="pv-note mono">Preço de varejo do site. Estoque confirmado no WhatsApp.</p></div></div>';
    lastFocus = document.activeElement;
    pv.classList.add('open'); pv.setAttribute('aria-hidden', 'false'); document.body.classList.add('pv-lock');
    pv.querySelector('.pv-box').scrollTop = 0; setTimeout(function () { pv.querySelector('.pv-x').focus(); }, 60);
  }
  function closePV() {
    if (!pv || !pv.classList.contains('open')) return;
    pv.classList.remove('open'); pv.setAttribute('aria-hidden', 'true'); document.body.classList.remove('pv-lock');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  document.addEventListener('click', function (e) {
    var o = e.target.closest('[data-pv]'); if (o) { openPV(+o.dataset.pv); return; }
    if (e.target.closest('[data-pvclose]')) closePV();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePV(); });
})();
