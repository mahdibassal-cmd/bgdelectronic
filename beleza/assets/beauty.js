/* BELEZA & COSMÉTICOS — lista única de produtos (usada em /beleza/ e no bloco Novidades de /perfumes/).
   COMO ADICIONAR UM PRODUTO:
   1) Coloque a foto em /perfumes/img/beauty/ em dois formatos: nome.webp e nome.jpg (ex.: 600x800).
   2) Copie um bloco { ... } abaixo, cole no fim da lista (com vírgula entre blocos) e edite:
      name     nome do produto
      brand    marca
      origin   país de origem (opcional)
      category "Cabelo" | "Pele/Skincare" | "Maquiagem" | "Corpo"
      desc     descrição curta em português
      img      nome do arquivo da foto, sem extensão
      price    ex. "R$ 99,99" (vazio "" = mostra "Consulte o preço")
      novo     true = aparece também em Novidades na página de perfumes
      getnet   link de pagamento Getnet (opcional) -> mostra o botão "Pagar · PIX ou cartão"
   Nada mais precisa mudar: filtros, busca e cards se atualizam sozinhos. */
window.BAGDA_BEAUTY = [
  { name: "Fino Premium Touch Hair Oil", brand: "Shiseido / Fine Today", origin: "Japão", category: "Cabelo",
    desc: "Óleo capilar de tampa vermelha com fórmula rica para cabelos secos e danificados.",
    img: "fino-premium-touch", price: "R$ 99,99", novo: true,
    getnet: "https://pag.getnet.com.br/l008yVJEa" },
  { name: "Fino Premium Touch Hair Oil Serum Airy Smooth", brand: "Shiseido / Fine Today", origin: "Japão", category: "Cabelo",
    desc: "Sérum capilar de fórmula leve e sedosa, na embalagem branca e rosa.",
    img: "fino-airy-smooth", price: "R$ 99,99", novo: true,
    getnet: "https://pag.getnet.com.br/5RnCiqv4z" },
  { name: "Celimax Retinal Shot Tightening Booster 15 ml", brand: "Celimax", origin: "Coreia", category: "Pele/Skincare",
    desc: "Booster com Retinal 0,1%, Pantenol 1% e Matrixyl 3000 3% para uma pele mais firme.",
    img: "celimax-retinal-shot", price: "R$ 99,99", novo: true,
    getnet: "https://pag.getnet.com.br/9_fhJVYkr" }
];
(function(){
  var L=window.BAGDA_BEAUTY, IMG='/perfumes/img/beauty/', CATS=['Cabelo','Pele/Skincare','Maquiagem','Corpo'];
  var esc=function(s){return String(s||'').replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
  var norm=function(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')};
  function card(p){
    var wa='https://wa.me/5511992873509?text='+encodeURIComponent(p.price?'Olá! Quero comprar o '+p.name+' ('+p.price+')':'Olá! Quero saber o preço do '+p.name);
    var src=IMG+p.img, v='?v=i3', mp=/^https:\/\//.test(p.getnet||'')?p.getnet:'';
    return '<article class="bcard"><div class="bimg"><picture><source srcset="'+src+'.webp'+v+'" type="image/webp"><img src="'+src+'.jpg'+v+'" alt="'+esc(p.name)+'" loading="lazy" width="600" height="800"></picture></div>'+
      '<div class="bbody"><span class="bmeta">'+esc(p.brand)+(p.origin?' · '+esc(p.origin):'')+'</span><h3>'+esc(p.name)+'</h3><p>'+esc(p.desc)+'</p>'+
      '<div class="bfoot"><span class="'+(p.price?'price':'bask')+'">'+(p.price?esc(p.price):'Consulte o preço')+'</span>'+
      '<a class="btn wa sm" href="'+wa+'" target="_blank" rel="noopener">Comprar pelo WhatsApp</a>'+
      (mp?'<a class="btn gold sm mp" href="'+esc(mp)+'" target="_blank" rel="noopener">Pagar · PIX ou cartão</a><div class="paynote">PIX, débito ou crédito em até 12x · Frete combinado no WhatsApp</div>':'')+'</div></div></article>';
  }
  var g=document.getElementById('beautyGrid');
  if(g){ var n=L.filter(function(p){return p.novo}); g.innerHTML=(n.length?n:L).slice(0,8).map(card).join(''); }
  var grid=document.getElementById('belezaGrid'); if(!grid) return;
  var chips=document.getElementById('belezaChips'), q=document.getElementById('belezaQ'), cnt=document.getElementById('belezaCount'), cur='Todos';
  var has=function(c){return L.some(function(p){return p.category===c})};
  chips.innerHTML=['Todos'].concat(CATS.filter(has)).map(function(c){return '<button type="button" class="chip'+(c==='Todos'?' on':'')+'" data-c="'+esc(c)+'">'+esc(c)+'</button>'}).join('');
  function draw(){
    var t=norm(q.value).trim();
    var r=L.filter(function(p){return (cur==='Todos'||p.category===cur)&&(!t||norm(p.name+' '+p.brand).indexOf(t)>-1)});
    grid.innerHTML=r.length?r.map(card).join(''):'<p class="bempty">Nenhum produto encontrado. Fale com a gente pelo WhatsApp que buscamos para você.</p>';
    cnt.textContent=r.length+(r.length===1?' produto':' produtos');
  }
  chips.addEventListener('click',function(e){var b=e.target.closest('.chip');if(!b)return;cur=b.dataset.c;[].forEach.call(chips.children,function(x){x.classList.toggle('on',x===b)});draw();});
  q.addEventListener('input',draw);
  var h=decodeURIComponent(location.hash.slice(1)); if(h&&has(h)){cur=h;[].forEach.call(chips.children,function(x){x.classList.toggle('on',x.dataset.c===h)});}
  draw();
})();
