/* Novidades / Beleza & Cuidados — para adicionar um produto, copie um bloco abaixo.
   Campos: name, brand, origin, desc, img (arquivo em perfumes/img/beauty/, sem extensão; precisa .webp e .jpg), price (vazio = "Consulte o preço") */
window.BAGDA_BEAUTY = [
  { name: "Fino Premium Touch Hair Oil", brand: "Shiseido / Fine Today", origin: "Japão",
    desc: "Óleo capilar de tampa vermelha com fórmula rica para cabelos secos e danificados.",
    img: "fino-premium-touch", price: "" },
  { name: "Fino Premium Touch Hair Oil Serum Airy Smooth", brand: "Shiseido / Fine Today", origin: "Japão",
    desc: "Sérum capilar de fórmula leve e sedosa, na embalagem branca e rosa.",
    img: "fino-airy-smooth", price: "" },
  { name: "Celimax Retinal Shot Tightening Booster 15 ml", brand: "Celimax", origin: "Coreia",
    desc: "Booster com Retinal 0,1%, Pantenol 1% e Matrixyl 3000 3% para uma pele mais firme.",
    img: "celimax-retinal-shot", price: "" }
];
(function(){
  var g=document.getElementById('beautyGrid'); if(!g) return;
  var esc=function(s){return String(s||'').replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
  g.innerHTML=window.BAGDA_BEAUTY.map(function(p){
    var wa='https://wa.me/5511992873509?text='+encodeURIComponent('Olá! Quero saber o preço do '+p.name);
    var src='img/beauty/'+p.img;
    return '<article class="bcard"><div class="bimg"><picture><source srcset="'+src+'.webp" type="image/webp"><img src="'+src+'.jpg" alt="'+esc(p.name)+'" loading="lazy" width="600" height="800"></picture></div>'+
      '<div class="bbody"><span class="bmeta">'+esc(p.brand)+(p.origin?' · '+esc(p.origin):'')+'</span><h3>'+esc(p.name)+'</h3><p>'+esc(p.desc)+'</p>'+
      '<div class="bfoot"><span class="'+(p.price?'price':'bask')+'">'+(p.price?esc(p.price):'Consulte o preço')+'</span>'+
      '<a class="btn wa sm" href="'+wa+'" target="_blank" rel="noopener">WhatsApp</a></div></div></article>';
  }).join('');
})();
