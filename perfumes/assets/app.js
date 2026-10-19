/* BAGDA PERFUMES — catálogo interativo (JS puro, sem dependências) */
(function(){
"use strict";
var WA="5511992873509";
var $=function(s,r){return (r||document).querySelector(s)}, $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
var norm=function(s){return (s||"").toString().normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()};
var esc=function(s){return (s==null?"":String(s)).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})};
var money=function(v){return "R$ "+v.toFixed(2).replace(".",",").replace(/\B(?=(\d{3})+(?!\d))/g,".")};
var ICON={
  spark:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.2 6.8L21 11l-6.8 2.2L12 20l-2.2-6.8L3 11l6.8-2.2z"/></svg>',
  cmp:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3v18M16 3v18M3 8h5M16 16h5"/></svg>',
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12l5 5L20 7"/></svg>',
  wa:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.5 2 2 6.46 2 11.96c0 1.76.47 3.48 1.35 4.99L2 22l5.2-1.36a10.1 10.1 0 004.84 1.23C17.58 21.87 22 17.41 22 11.91 22 6.46 17.58 2 12.04 2zm5.83 14.1c-.25.69-1.44 1.33-2 1.41-.51.08-1.15.11-1.86-.12a17 17 0 01-1.68-.62c-2.96-1.27-4.89-4.25-5.04-4.45-.15-.2-1.2-1.6-1.2-3.05 0-1.45.76-2.16 1.03-2.46.27-.3.59-.37.79-.37h.57c.18 0 .43-.07.67.51.25.6.84 2.06.92 2.21.07.15.12.32.02.52-.1.2-.15.32-.3.5-.15.17-.31.39-.45.52-.15.15-.3.31-.13.61.17.3.77 1.27 1.66 2.06 1.14 1.01 2.1 1.33 2.4 1.48.3.15.47.12.65-.07.17-.2.74-.86.94-1.16.2-.3.4-.25.67-.15.27.1 1.73.81 2.03.96.3.15.5.22.57.35.08.12.08.71-.17 1.4z"/></svg>'
};

var DATA=window.BAGDA_DATA, P=[], META={};
var X=window.BAGDA_EXTRAS||{}; X.installments=X.installments||{max:12,noInterest:false}; X.products=X.products||{}; X.decants=X.decants||[]; X.bestSellers=X.bestSellers||[]; X.lowStockAt=X.lowStockAt||3;
function ext(p){ return X.products[p.id]||{}; }
function payLink(p){ var u=ext(p).payLink||ext(p).mpLink||p.payLink||""; return /^https:\/\//.test(u)?u:""; }
function lowStock(p){ var st=ext(p).stock; if(st==null) st=p.stock; return !p.soldOut&&typeof st==="number"&&st>0&&st<=X.lowStockAt; }
function instText(p,long){ var n=X.installments.max||12; if(X.installments.noInterest) return (long?'ou ':'')+n+'x de '+money(p.price/n)+' sem juros'; return long?'ou em até '+n+'x no cartão':'em até '+n+'x no cartão'; }
var OFFB='<span class="offb">✦ Distribuidor oficial</span>';
function boot(d){
  DATA=d; META=d.meta; P=d.perfumes;
  P.forEach(function(p,i){
    p._i=i;
    p.house=houseOf(p.inspiredBy);
    var notes=[].concat(p.notes.top||[],p.notes.heart||[],p.notes.base||[]);
    p._hay=norm([p.brand,p.name,p.inspiredBy,p.family,p.familyGroup,p.gender,notes.join(" "),(p.accords||[]).map(function(a){return a.name}).join(" ")].join(" | "));
    p._acc={}; (p.accords||[]).forEach(function(a){p._acc[a.key]=a.w});
  });
  init();
}
var HOUSES=["Tom Ford","Creed","Jean Paul Gaultier","Carolina Herrera","Yves Saint Laurent","Kayali","Narciso Rodriguez","Xerjoff","Dior","Kilian","By Kilian","Parfums de Marly","Louis Vuitton","Armani Privé","Giorgio Armani","Stéphane Humbert Lucas","Orto Parisi","Gucci","Born To Stand Out","Chanel","Paco Rabanne","Nishane","Byredo","Azzaro","Maison Crivelli","Les Liquides Imaginaires","Giardini di Toscana","Viktor&Rolf","Lorenzo Pazzaglia","Brompton","Sospiro"];
function houseOf(s){ if(!s) return null; for(var i=0;i<HOUSES.length;i++){ if(s.indexOf(HOUSES[i])===0) return HOUSES[i]==="By Kilian"?"Kilian":HOUSES[i]; } return null; }

/* ---------- state ---------- */
var S={q:"",brand:[],gender:[],family:[],price:[],house:[],insp:false,avail:false,max:0,sort:"featured"};
var MAXES=[150,200,300];
var CMP=[];
var PRICE=[{k:"a",l:"Até R$ 150",t:function(v){return v<=150}},{k:"b",l:"R$ 150 – 250",t:function(v){return v>150&&v<=250}},{k:"c",l:"Acima de R$ 250",t:function(v){return v>250}}];
var BRAND_ORDER=["Arabiyat Prestige","Armaf","Ferassa","MPF","French Avenue","Ibraheem Al Qurashi","Al Wataniah","Rayhaan","Rasasi"];
var OFFICIAL={"Arabiyat Prestige":1,"Armaf":1,"Ferassa":1};

function count(fn){return P.filter(fn).length}
function uniq(a){return a.filter(function(v,i){return v&&a.indexOf(v)===i})}

/* ---------- filters UI ---------- */
function chipHTML(group,val,label,n){
  var on=group==="insp"?S.insp:(group==="avail"?S.avail:(group==="max"?S.max===+val:S[group].indexOf(val)>-1));
  return '<button class="chip'+(on?' on':'')+'" data-g="'+group+'" data-v="'+esc(val)+'" aria-pressed="'+on+'">'+esc(label)+(n!=null?'<small>'+n+'</small>':'')+'</button>';
}
function buildPanel(){
  var brands=BRAND_ORDER.filter(function(b){return P.some(function(p){return p.brand===b})});
  var fams=uniq(P.map(function(p){return p.familyGroup})).sort(function(a,b){return count(function(p){return p.familyGroup===b})-count(function(p){return p.familyGroup===a})});
  var houses=uniq(P.map(function(p){return p.house})).sort(function(a,b){return count(function(p){return p.house===b})-count(function(p){return p.house===a})||a.localeCompare(b)});
  var h='';
  h+='<div class="fgroup"><h4>Disponibilidade</h4><div class="chips">'+chipHTML("avail","1","Somente disponíveis",count(function(p){return !p.soldOut}))+chipHTML("insp","1","Com inspiração olfativa",count(function(p){return p.inspiredBy}))+'</div></div>';
  h+='<div class="fgroup"><h4>Marca</h4><div class="chips">'+brands.map(function(b){return chipHTML("brand",b,b,count(function(p){return p.brand===b}))}).join("")+'</div></div>';
  h+='<div class="fgroup"><h4>Para quem</h4><div class="chips">'+["Masculino","Feminino","Unissex"].map(function(g){return chipHTML("gender",g,g,count(function(p){return p.gender===g}))}).join("")+'</div></div>';
  h+='<div class="fgroup"><h4>Família olfativa</h4><div class="chips">'+fams.map(function(f){return chipHTML("family",f,f,count(function(p){return p.familyGroup===f}))}).join("")+'</div></div>';
  h+='<div class="fgroup"><h4>Faixa de preço</h4><div class="chips">'+PRICE.map(function(r){return chipHTML("price",r.k,r.l,count(function(p){return r.t(p.price)}))}).join("")+'</div></div>';
  h+='<div class="fgroup"><h4>Inspirado em</h4><input type="text" id="inspq" placeholder="Ex.: Sauvage, Aventus, Delina…" autocomplete="off"><div class="chips">'+houses.map(function(x){return chipHTML("house",x,x,count(function(p){return p.house===x}))}).join("")+'</div></div>';
  $("#panelBody").innerHTML=h;
  $("#inspq").value=S.q;
  $("#inspq").addEventListener("input",function(e){setQ(e.target.value)});
}
function quickChips(){
  var h=chipHTML("avail","1","Disponíveis")+chipHTML("insp","1","Com inspiração");
  ["Masculino","Feminino","Unissex"].forEach(function(g){h+=chipHTML("gender",g,g)});
  ["Arabiyat Prestige","Armaf","Ferassa","MPF"].forEach(function(b){h+=chipHTML("brand",b,b)});
  MAXES.forEach(function(m){h+=chipHTML("max",String(m),"Até R$ "+m)});
  ["Oriental & Âmbar","Amadeirado","Floral","Gourmand","Cítrico"].forEach(function(f){h+=chipHTML("family",f,f)});
  $("#quick").innerHTML=h;
}
document.addEventListener("click",function(e){
  var c=e.target.closest(".chip[data-g]"); if(!c) return;
  var g=c.dataset.g,v=c.dataset.v;
  if(g==="insp") S.insp=!S.insp; else if(g==="avail") S.avail=!S.avail; else if(g==="max") S.max=(S.max===+v?0:+v);
  else { var i=S[g].indexOf(v); if(i>-1) S[g].splice(i,1); else S[g].push(v); }
  refresh();
});
function setQ(v){S.q=v; $("#q").value=v; var iq=$("#inspq"); if(iq&&iq!==document.activeElement) iq.value=v; $(".search").classList.toggle("has",!!v); render();}
function refresh(){ buildPanel(); quickChips(); render(); }
function activeCount(){return S.brand.length+S.gender.length+S.family.length+S.price.length+S.house.length+(S.insp?1:0)+(S.avail?1:0)+(S.max?1:0)+(S.q?1:0)}

/* ---------- filtering ---------- */
function filtered(){
  var terms=norm(S.q).split(/\s+/).filter(Boolean);
  var out=P.filter(function(p){
    if(S.brand.length&&S.brand.indexOf(p.brand)<0) return false;
    if(S.gender.length&&S.gender.indexOf(p.gender)<0) return false;
    if(S.family.length&&S.family.indexOf(p.familyGroup)<0) return false;
    if(S.house.length&&S.house.indexOf(p.house)<0) return false;
    if(S.price.length&&!PRICE.some(function(r){return S.price.indexOf(r.k)>-1&&r.t(p.price)})) return false;
    if(S.insp&&!p.inspiredBy) return false;
    if(S.avail&&p.soldOut) return false;
    if(S.max&&p.price>S.max) return false;
    for(var i=0;i<terms.length;i++) if(p._hay.indexOf(terms[i])<0) return false;
    return true;
  });
  var s=S.sort;
  out.sort(function(a,b){
    if(s!=="featured"&&a.soldOut!==b.soldOut) return a.soldOut?1:-1;
    if(s==="price-asc") return a.price-b.price;
    if(s==="price-desc") return b.price-a.price;
    if(s==="name") return a.name.localeCompare(b.name,"pt");
    if(s==="brand") return a.brand.localeCompare(b.brand)||a.name.localeCompare(b.name,"pt");
    // destaque: marcas oficiais primeiro, com inspiração, disponíveis
    var fa=(a.soldOut?10:0)+(OFFICIAL[a.brand]?0:2)+(a.inspiredBy?0:1), fb=(b.soldOut?10:0)+(OFFICIAL[b.brand]?0:2)+(b.inspiredBy?0:1);
    return fa-fb||a._i-b._i;
  });
  return out;
}

/* ---------- cards ---------- */
function inspTag(p){
  if(p.inspiredBy) return '<span class="insp">'+ICON.spark+'<span>Inspirado em '+esc(p.inspiredBy)+'</span></span>';
  if(p.originalCreation) return '<span class="insp orig">'+ICON.spark+'<span>Criação original</span></span>';
  return '';
}
function priceHTML(p){
  if(p.soldOut) return '<div class="price">Esgotado</div>';
  return '<div class="price">'+(p.priceFromLabel?'<s>De '+esc(p.priceFromLabel)+'</s>':'')+esc(p.priceLabel)+'</div>';
}
function soldWA(p,cls){ return '<a class="soldwa'+(cls?' '+cls:'')+'" href="'+waSold(p)+'" target="_blank" rel="noopener">'+ICON.wa+'<span>Esgotado · avise-me no WhatsApp</span></a>'; }
function card(p,extra,cls){
  var on=CMP.indexOf(p.id)>-1;
  return '<article class="card'+(p.soldOut?' sold':'')+(cls?' '+cls:'')+'" data-id="'+p.id+'" tabindex="0" aria-label="'+esc(p.brand+' '+p.name)+'">'+
   '<div class="ph"><img loading="lazy" decoding="async" src="'+p.photo+'" alt="'+esc(p.brand+' '+p.name+' '+p.size)+'" width="640" height="800">'+
   (p.familyGroup?'<span class="badge">'+esc(p.familyGroup)+'</span>':'')+
   '<button class="cmpbox'+(on?' on':'')+'" data-cmp="'+p.id+'" aria-label="Comparar" title="Comparar">'+(on?ICON.check:ICON.cmp)+'</button>'+
   (lowStock(p)?'<span class="lowb">Últimas unidades</span>':'')+(OFFICIAL[p.brand]?OFFB:'')+
   (p.soldOut?'<span class="sold-tag">ESGOTADO</span>':'')+(extra||'')+'</div>'+
   '<div class="info"><span class="brand">'+esc(p.brand)+'</span><h3>'+esc(p.name)+'</h3>'+inspTag(p)+
   '<div class="bottom">'+priceHTML(p)+'<span class="ml">'+p.ml+' ml</span></div>'+
   (p.soldOut?soldWA(p):'<div class="inst">'+instText(p)+'</div>')+'</div></article>';
}
var io=("IntersectionObserver" in window)?new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target)}})},{rootMargin:"0px 0px -5% 0px"}):null;
function observe(root){ $$(".card:not(.in),.reveal:not(.in)",root).forEach(function(el,i){ if(io){ el.style.transitionDelay=(el.classList.contains("card")?Math.min(i%8,7)*45:0)+"ms"; io.observe(el);} else el.classList.add("in"); }); }
function render(){
  var list=filtered();
  $("#grid").innerHTML=list.length?list.map(function(p){return card(p)}).join(""):'<div class="empty" style="grid-column:1/-1"><h3>Nenhum perfume encontrado</h3><p>Tente outro nome, nota ou inspiração — ou limpe os filtros.</p><p><button class="btn sm" data-clear>Limpar filtros</button></p></div>';
  var n=activeCount();
  $("#count").innerHTML='<b>'+list.length+'</b> de '+P.length+' perfumes'+(S.q?' para “'+esc(S.q)+'”':'');
  $("#clearAll").style.display=n?"":"none";
  $("#fcount").textContent=n?"("+n+")":"";
  $("#applyN").textContent=list.length;
  observe($("#grid"));
}

/* ---------- modal ---------- */
var lastFocus=null;
function openModal(html,cls){
  lastFocus=document.activeElement;
  var m=$("#modal"); $("#mbody").innerHTML=html; m.className="modal open "+(cls||""); m.setAttribute("aria-hidden","false");
  document.body.classList.add("lock"); $(".box",m).scrollTop=0; setTimeout(function(){$(".x",m).focus()},60);
}
function closeModal(){ var m=$("#modal"); m.className="modal"; m.setAttribute("aria-hidden","true"); document.body.classList.remove("lock"); if(location.hash.indexOf("#p=")===0) history.replaceState(null,"",location.pathname+location.search); if(lastFocus&&lastFocus.focus) lastFocus.focus(); }
function waLink(p){ if(p.soldOut) return waSold(p); return "https://wa.me/"+WA+"?text="+encodeURIComponent("Olá! Quero comprar o perfume "+p.brand+" "+p.name+" ("+p.ml+" ml) de "+p.priceLabel+", que vi no site. Entrega ou retirada na loja?"); }
function waSold(p){ return "https://wa.me/"+WA+"?text="+encodeURIComponent("Olá! O perfume "+p.brand+" "+p.name+" ("+p.ml+" ml) está esgotado no site. Pode me avisar quando chegar?"); }
function related(p){
  var L=P.filter(function(x){return x.id!==p.id&&!x.soldOut&&p.familyGroup&&x.familyGroup===p.familyGroup});
  L.sort(function(a,b){ var da=Math.abs(a.price-p.price)/p.price+(a.gender===p.gender||a.gender==="Unissex"?0:.6)+(OFFICIAL[a.brand]?0:.15), db=Math.abs(b.price-p.price)/p.price+(b.gender===p.gender||b.gender==="Unissex"?0:.6)+(OFFICIAL[b.brand]?0:.15); return da-db; });
  return L.slice(0,4);
}
function tier(cls,label,arr){ if(!arr||!arr.length) return ''; return '<div class="tier '+cls+'"><span class="lv">'+label+'</span><div class="ns">'+arr.map(function(n){return '<span>'+esc(n)+'</span>'}).join("")+'</div></div>'; }
function srcLink(s){ return s.url?'<a href="'+esc(s.url)+'" target="_blank" rel="noopener nofollow">'+esc(s.label||s.url)+'</a>':esc(s.label||s.ref||""); }
function detail(p){
  var hasNotes=p.notes&&((p.notes.top||[]).length+(p.notes.heart||[]).length+(p.notes.base||[]).length)>0;
  var acc=(p.accords||[]).slice(0,6);
  var h='<div class="pd"><div class="pic"><img src="'+p.photo+'" alt="'+esc(p.brand+' '+p.name)+'">'+(p.soldOut?'<span class="sold-tag">ESGOTADO</span>':'')+'</div><div class="txt">';
  h+='<span class="kicker">'+esc(p.brand)+'</span>'+(OFFICIAL[p.brand]?'<span class="offb inl">✦ Distribuidor oficial</span>':'')+'<h2>'+esc(p.name)+'</h2>';
  h+='<div class="tags">'+(p.familyGroup?'<span class="tag g">'+esc(p.familyGroup)+'</span>':'')+(p.gender?'<span class="tag">'+esc(p.gender)+'</span>':'')+'<span class="tag">'+p.ml+' ml</span>'+(p.soldOut?'<span class="tag">Esgotado</span>':'')+'</div>';
  if(p.inspiredBy) h+='<div class="inspbox"><div class="k">Inspiração olfativa</div><div class="v">'+esc(p.inspiredBy)+'</div></div>';
  else if(p.originalCreation) h+='<div class="inspbox"><div class="k">Assinatura própria</div><div class="v">Criação original '+esc(p.brand)+'</div></div>';
  if(p.soldOut){
    h+='<div class="buy"><div class="price" style="color:var(--dim)">Esgotado</div>'+soldWA(p,'big')+'</div>';
  } else {
    var mp=payLink(p);
    h+='<div class="buy"><div><div class="price">'+(p.priceFromLabel?'<s>De '+esc(p.priceFromLabel)+'</s>':'')+esc(p.priceLabel)+'</div><div class="inst lg">'+instText(p,true)+'</div>'+(lowStock(p)?'<div class="lowline">Últimas unidades em estoque</div>':'')+'</div>'+
       '<div class="buybtns"><a class="btn wa" href="'+waLink(p)+'" target="_blank" rel="noopener">'+ICON.wa+'Comprar pelo WhatsApp</a>'+
       (mp?'<a class="btn gold mp" href="'+esc(mp)+'" target="_blank" rel="noopener">Pagar · PIX ou cartão</a>':'')+'</div>'+(mp?'<div class="paynote">PIX, débito ou crédito em até 12x · Frete combinado no WhatsApp</div>':'')+'</div>';
  }
  h+='<div class="payline">PIX, dinheiro, débito ou crédito em até '+(X.installments.max||12)+'x'+(X.installments.noInterest?' sem juros':'')+'. Loja física no Brás · 08:00–17:30.</div>';
  h+='<ul class="pdlv"><li><b>Fast Entrega</b> · moto no mesmo dia em São Paulo</li><li><b>Retire grátis</b> na loja · Brás · 08:00–17:30</li><li><b>SEDEX para SP e todo o Brasil</b> · frete calculado no WhatsApp</li></ul>';
  if(!p.soldOut) h+=freteBox(p.id);
  if(hasNotes) h+='<div class="pyr"><h4>Pirâmide olfativa</h4>'+tier("t1","Notas de topo",p.notes.top)+tier("t2","Notas de coração",p.notes.heart)+tier("t3","Notas de fundo",p.notes.base)+'</div>';
  if(acc.length) h+='<div class="acc"><h4>Acordes principais</h4>'+acc.map(function(a){return '<div class="bar"><span>'+esc(a.name)+'</span><i style="--w:'+(a.w/100)+'"></i></div>'}).join("")+'</div>';
  h+='<div class="facts">'+
     '<div class="fact"><small>Família</small><b>'+esc(p.family||p.familyGroup||"—")+'</b></div>'+
     '<div class="fact"><small>Gênero</small><b>'+esc(p.gender||"—")+'</b></div>'+
     '<div class="fact"><small>Volume</small><b>'+esc(p.size)+'</b></div>'+
     '<div class="fact"><small>Marca</small><b>'+esc(p.brand)+'</b></div></div>';
  h+='<button class="btn sm" data-cmp="'+p.id+'">'+(CMP.indexOf(p.id)>-1?'✓ Na comparação':'+ Adicionar à comparação')+'</button>';
  var src=[];
  if(p.notesSource) src.push('Notas, acordes e família: <a href="'+esc(p.notesSource)+'" target="_blank" rel="noopener nofollow">'+(p.notesSource.indexOf("fragrantica")>-1?'Fragrantica':esc(p.notesSource.replace(/^https?:\/\/(www\.)?/,'').split('/')[0]))+'</a>');
  if((p.inspiredSources||[]).length) src.push((p.originalCreation?'Criação original':'Inspiração')+': '+p.inspiredSources.map(srcLink).join(' · '));
  var rel=related(p);
  if(rel.length) h+='<div class="rel"><h4>Você também pode gostar</h4><div class="relgrid">'+rel.map(function(r){return card(r,'','in mini')}).join("")+'</div></div>';
  h+='<div class="srcs">'+(src.length?'Fontes — '+src.join('<br>'):'')+(p.inspiredBy?'<div class="disc">'+esc(META.disclaimer)+'</div>':'')+'</div>';
  h+='</div></div>';
  return h;
}
function openProduct(id){ var p=P.filter(function(x){return x.id===id})[0]; if(!p) return; openModal(detail(p),"prod"); history.replaceState(null,"","#p="+id); }

/* ---------- compare ---------- */
function toggleCmp(id){
  var i=CMP.indexOf(id);
  if(i>-1) CMP.splice(i,1);
  else { if(CMP.length>=3){ toast("Compare até 3 perfumes por vez"); return; } CMP.push(id); }
  $$('[data-cmp="'+id+'"]').forEach(function(b){ var on=CMP.indexOf(id)>-1; b.classList.toggle("on",on); if(b.classList.contains("cmpbox")) b.innerHTML=on?ICON.check:ICON.cmp; else b.textContent=on?"✓ Na comparação":"+ Adicionar à comparação"; });
  tray();
}
function byId(id){return P.filter(function(p){return p.id===id})[0]}
function tray(){
  var t=$("#tray"), h='';
  for(var i=0;i<3;i++){ var p=byId(CMP[i]); h+=p?'<div class="it"><img src="'+p.photo+'" alt=""><button data-rm="'+p.id+'" aria-label="Remover">×</button></div>':'<div class="it ph">+</div>'; }
  $(".its",t).innerHTML=h;
  $("#cmpGo").disabled=CMP.length<2; $("#cmpGo").style.opacity=CMP.length<2?.5:1;
  t.classList.toggle("on",CMP.length>0); document.body.classList.toggle("tray-on",CMP.length>0);
  $("#navCmp").innerHTML=CMP.length;
}
function compareView(){
  var L=CMP.map(byId), n=L.length;
  var row=function(label,fn,hl){ var vals=L.map(fn); var same=hl&&vals.every(function(v){return v&&v===vals[0]}); return '<div class="rh">'+label+'</div>'+vals.map(function(v){return '<div class="'+(same?'same':'')+'">'+(v||'<span style="color:var(--dim)">—</span>')+'</div>'}).join(""); };
  var nl=function(a){return a&&a.length?'<span class="nl">'+a.map(esc).join(", ")+'</span>':''};
  var h='<div class="txt" style="padding:28px 20px 30px"><span class="kicker">Comparar</span><h2 style="font-family:var(--serif);font-weight:500;font-size:34px;margin:6px 0 20px">Lado a lado</h2><div class="ctable"><div class="ccols" style="--n:'+n+'">';
  h+='<div class="rh"></div>'+L.map(function(p){return '<div class="hd"><img src="'+p.photo+'" alt=""><span class="kicker" style="font-size:9.5px">'+esc(p.brand)+'</span><h3>'+esc(p.name)+'</h3></div>'}).join("");
  h+=row("Preço",function(p){return p.soldOut?'Esgotado':'<b style="color:var(--gold2);font-family:var(--serif);font-size:20px">'+esc(p.priceLabel)+'</b>'});
  h+=row("Volume",function(p){return esc(p.size)},true);
  h+=row("Inspiração",function(p){return p.inspiredBy?esc(p.inspiredBy):(p.originalCreation?'Criação original':'')});
  h+=row("Família",function(p){return esc(p.familyGroup||"")},true);
  h+=row("Gênero",function(p){return esc(p.gender||"")},true);
  h+=row("Topo",function(p){return nl(p.notes.top)});
  h+=row("Coração",function(p){return nl(p.notes.heart)});
  h+=row("Fundo",function(p){return nl(p.notes.base)});
  h+=row("Acordes",function(p){return nl((p.accords||[]).slice(0,4).map(function(a){return a.name}))});
  h+=row("",function(p){return '<a class="btn wa sm" href="'+waLink(p)+'" target="_blank" rel="noopener">'+ICON.wa+'WhatsApp</a>'});
  h+='</div></div></div>';
  openModal(h,"cmp");
}

/* ---------- quiz ---------- */
var QZ=[
 {k:"occ",q:"Para qual momento é o perfume?",o:[
   {v:"dia",ic:"☀️",t:"Dia a dia e trabalho",s:"Leve, limpo, agradável de perto"},
   {v:"noite",ic:"🌙",t:"Noite e encontros",s:"Marcante, sensual, com rastro"},
   {v:"evento",ic:"🥂",t:"Eventos especiais",s:"Sofisticado, elegante, memorável"},
   {v:"verao",ic:"🌊",t:"Calor e fim de semana",s:"Fresco, solar, revigorante"}]},
 {k:"fam",q:"Qual estilo de aroma te atrai mais?",o:[
   {v:"doce",ic:"🍯",t:"Doce e gourmand",s:"Baunilha, caramelo, frutas"},
   {v:"amadeirado",ic:"🪵",t:"Amadeirado e intenso",s:"Madeiras, oud, couro, tabaco"},
   {v:"floral",ic:"🌸",t:"Floral e delicado",s:"Rosa, jasmim, flores brancas"},
   {v:"fresco",ic:"🍋",t:"Fresco e cítrico",s:"Bergamota, aquático, aromático"}]},
 {k:"gen",q:"Para quem é?",o:[
   {v:"Masculino",ic:"🧔",t:"Para ele",s:"Perfis masculinos e unissex"},
   {v:"Feminino",ic:"👩",t:"Para ela",s:"Perfis femininos e unissex"},
   {v:"any",ic:"✨",t:"Tanto faz",s:"Quero o melhor match"}]},
 {k:"bud",q:"Quanto você quer investir?",o:[
   {v:"a",ic:"💛",t:"Até R$ 150",s:"Ótimo custo-benefício"},
   {v:"b",ic:"💎",t:"R$ 150 a R$ 250",s:"O equilíbrio ideal"},
   {v:"c",ic:"👑",t:"Acima de R$ 250",s:"Linha premium"},
   {v:"any",ic:"🔓",t:"Sem limite",s:"Mostre o que combina mais"}]}
];
var FAMK={
 doce:{sweet:1,vanilla:1,caramel:1,gourmand:1,fruity:.6,cacao:1,coconut:.7,nutty:.8,honey:1,cherry:.7,amber:.4},
 amadeirado:{woody:1,oud:1.2,leather:1.1,tobacco:1.1,smoky:1,amber:.6,"warm+spicy":.6,patchouli:.8,balsamic:.6,mossy:.6},
 floral:{floral:1,"white+floral":1,rose:1,"yellow+floral":1,iris:.9,violet:.9,tuberose:1,powdery:.6,musky:.4},
 fresco:{citrus:1,fresh:1,aquatic:1.2,marine:1.2,ozonic:1,green:.8,aromatic:.8,"fresh+spicy":.6,lavender:.7,herbal:.7}
};
var OCCK={
 dia:{citrus:.6,fresh:.6,musky:.5,aromatic:.5,green:.4,powdery:.4,floral:.3},
 noite:{sweet:.5,vanilla:.5,amber:.6,oud:.5,leather:.5,tobacco:.5,"warm+spicy":.5,animalic:.4},
 evento:{amber:.5,woody:.5,oud:.6,rose:.4,powdery:.4,iris:.5,leather:.4,balsamic:.4},
 verao:{citrus:.7,aquatic:.8,fresh:.7,tropical:.6,ozonic:.6,green:.4,coconut:.4}
};
var QA={}, QI=0;
function quizRender(){
  var box=$("#quizBody");
  var prog='<div class="qprog">'+QZ.map(function(_,i){return '<i class="'+(i<=QI?'on':'')+'"></i>'}).join("")+'<i class="'+(QI>=QZ.length?'on':'')+'"></i></div>';
  if(QI<QZ.length){
    var s=QZ[QI];
    box.innerHTML=prog+'<div class="qstep"><span class="kicker">Pergunta '+(QI+1)+' de '+QZ.length+'</span><h3>'+s.q+'</h3><div class="opts">'+s.o.map(function(o){return '<button class="opt" data-qa="'+o.v+'"><span class="ic" aria-hidden="true">'+o.ic+'</span><span><b>'+o.t+'</b><span>'+o.s+'</span></span></button>'}).join("")+'</div>'+
      '<div class="qnav">'+(QI?'<button class="linkbtn" data-qback>← Voltar</button>':'<span></span>')+'</div></div>';
  } else {
    var res=quizScore().slice(0,4);
    box.innerHTML=prog+'<div class="qstep"><span class="kicker">Seu resultado</span><h3>Encontramos estes para você</h3><p style="color:var(--muted);margin:-8px 0 0">Combinação calculada pelos acordes, ocasião, público e orçamento. Toque para ver as notas.</p>'+
      '<div class="qres-grid">'+res.map(function(r){return card(r.p,'<span class="match">'+r.pct+'% match</span>')}).join("")+'</div>'+
      '<div class="qnav"><button class="linkbtn" data-qreset>↺ Refazer o quiz</button><a class="btn gold sm" href="https://wa.me/'+WA+'?text='+encodeURIComponent("Olá! Fiz o quiz do site e gostei de: "+res.map(function(r){return r.p.brand+" "+r.p.name}).join(", ")+". Pode me ajudar?")+'" target="_blank" rel="noopener">Falar com a loja</a></div></div>';
    observe(box);
  }
}
function quizScore(){
  var fk=FAMK[QA.fam]||{}, ok=OCCK[QA.occ]||{};
  var rng=PRICE.filter(function(r){return r.k===QA.bud})[0];
  var L=P.filter(function(p){return !p.soldOut&&(p.accords||[]).length}).map(function(p){
    var s=0,max=0;
    for(var k in p._acc){ var w=p._acc[k]/100; s+=(fk[k]||0)*w*1.4+(ok[k]||0)*w; }
    if(QA.gen!=="any"){ if(p.gender===QA.gen) s+=1.2; else if(p.gender==="Unissex") s+=.7; else s-=3; }
    if(rng){ if(rng.t(p.price)) s+=1; else s-=1.5; }
    if(p.inspiredBy) s+=.15;
    return {p:p,s:s};
  }).sort(function(a,b){return b.s-a.s});
  var top=L[0]?L[0].s:1;
  return L.map(function(r){ r.pct=Math.max(60,Math.min(98,Math.round(98*r.s/top))); return r; });
}
document.addEventListener("click",function(e){
  var t;
  if((t=e.target.closest("[data-qa]"))){ QA[QZ[QI].k]=t.dataset.qa; QI++; quizRender(); $("#quiz").scrollIntoView({behavior:"smooth",block:"start"}); return; }
  if(e.target.closest("[data-qback]")){ QI=Math.max(0,QI-1); quizRender(); return; }
  if(e.target.closest("[data-qreset]")){ QI=0; QA={}; quizRender(); return; }
});

/* ---------- entregas / frete pelo WhatsApp ---------- */
function fmtCep(c){ return c.slice(0,5)+"-"+c.slice(5); }
function wa(t){ return "https://wa.me/"+WA+"?text="+encodeURIComponent(t); }
function freteBox(pid){
  var k=pid||'home';
  return '<form class="frete" data-frete="'+(pid||'')+'" novalidate><label for="cep_'+k+'">Calcular frete</label><div class="frow">'+
    '<input id="cep_'+k+'" class="cepin" inputmode="numeric" autocomplete="postal-code" placeholder="Seu CEP · 00000-000" maxlength="9" aria-describedby="cepmsg_'+k+'">'+
    '<button class="btn wa" type="submit">'+ICON.wa+'Calcular frete no WhatsApp</button></div><div class="fres" id="cepmsg_'+k+'" aria-live="polite"></div>'+
    '<a class="nocep" href="https://buscacepinter.correios.com.br/app/endereco/index.php" target="_blank" rel="noopener">Não sei meu CEP</a></form>';
}
function freteMsg(pid,c){
  var p=pid?byId(pid):null, info=CEPCACHE[c], where=info&&info.state?(info.city?info.city+"/":"")+info.state:"";
  return "Olá! "+(p?"Quero o "+p.brand+" "+p.name+" ("+p.ml+" ml) de "+p.priceLabel+". ":"")+"Meu CEP é "+fmtCep(c)+(where?" ("+where+")":"")+". Quanto fica o frete e o prazo?";
}
var CEPCACHE={};
function cepLookup(c){ /* só enriquece a mensagem se já tiver resposta; nunca bloqueia o envio */
  if(CEPCACHE[c]!==undefined) return; CEPCACHE[c]=null;
  fetch("https://brasilapi.com.br/api/cep/v1/"+c).then(function(r){return r.ok?r.json():null}).then(function(d){ if(d&&d.state) CEPCACHE[c]={state:d.state,city:d.city}; }).catch(function(){});
}
document.addEventListener("input",function(e){ if(!e.target.classList.contains("cepin")) return; var v=e.target.value.replace(/\D/g,"").slice(0,8); e.target.value=v.length>5?v.slice(0,5)+"-"+v.slice(5):v; if(v.length===8) cepLookup(v); });
document.addEventListener("submit",function(e){
  var form=e.target.closest("form.frete"); if(!form) return; e.preventDefault();
  var c=$(".cepin",form).value.replace(/\D/g,""), out=$(".fres",form);
  if(c.length!==8){ out.innerHTML='<div class="ferr">Digite um CEP com 8 números (ex.: 03010-000).</div>'; $(".cepin",form).focus(); return; }
  var url=wa(freteMsg(form.dataset.frete,c)), w=window.open(url,"_blank"); if(w){ try{ w.opener=null; }catch(_){} }
  out.innerHTML='<div class="fok">Abrimos o WhatsApp com o seu CEP <b>'+fmtCep(c)+'</b>. Nossa equipe confirma o frete e o prazo. <a href="'+url+'" target="_blank" rel="noopener">Não abriu? Toque aqui</a></div>';
  if(!w){ try{ location.href=url; }catch(_){} }
});

/* ---------- vitrines: famílias, faixas de preço, mais vendidos, decants ---------- */
var FAMT=[
 {l:"Orientais & Âmbar",s:"Calorosos, envolventes",f:["Oriental & Âmbar"]},
 {l:"Amadeirados",s:"Madeiras, oud e couro",f:["Amadeirado","Couro","Chipre"]},
 {l:"Florais",s:"Rosa, jasmim, flores brancas",f:["Floral","Frutado"]},
 {l:"Doces",s:"Baunilha, caramelo, gourmand",f:["Gourmand"]},
 {l:"Cítricos",s:"Luminosos e solares",f:["Cítrico"]},
 {l:"Frescos & Aromáticos",s:"Aquáticos, ervas, fougère",f:["Aromático & Fougère","Fresco & Aquático"]}
];
function goCatalog(){ $("#catalogo").scrollIntoView({behavior:"smooth"}); }
function vitrines(){
  var fh=FAMT.map(function(t,i){
    var L=P.filter(function(p){return t.f.indexOf(p.familyGroup)>-1}); if(!L.length) return '';
    var pic=(L.filter(function(p){return !p.soldOut&&OFFICIAL[p.brand]})[0]||L[0]).photo;
    return '<button class="ftile" data-fam="'+i+'"><img loading="lazy" decoding="async" src="'+pic+'" alt="" width="640" height="800"><span class="ft"><b>'+esc(t.l)+'</b><small>'+esc(t.s)+'</small><em>'+L.length+' perfumes →</em></span></button>';
  }).join("");
  $("#famTiles").innerHTML=fh;
  $("#priceCuts").innerHTML=MAXES.map(function(m){ return '<button class="pcut" data-max="'+m+'"><small>Até</small><b>R$ '+m+'</b><span>'+count(function(p){return !p.soldOut&&p.price<=m})+' perfumes</span></button>'; }).join("");
  var bs=X.bestSellers.map(byId).filter(Boolean);
  $("#bestStrip").innerHTML=bs.map(function(p,i){return card(p,'<span class="rank">'+(i+1)+'</span>','in')}).join("");
  $("#bestWrap").style.display=bs.length?"":"none";
  var D=X.decants.map(function(d){ var p=byId(d.perfumeId); return p?{d:d,p:p}:null; }).filter(Boolean);
  var dh;
  if(!D.length){
    dh=[1,2,3,4].map(function(){return '<div class="dcard soon"><span class="vial" aria-hidden="true"></span><b>10 ml</b><small>Em breve</small></div>'}).join("");
  } else {
    dh=D.map(function(o){ var d=o.d,p=o.p, av=d.available!==false&&typeof d.price==="number";
      var msg=av?"Olá! Quero o decant "+(d.ml||10)+" ml de "+p.brand+" "+p.name+" ("+money(d.price)+"), que vi no site.":"Olá! Quero ser avisado quando o decant de "+p.brand+" "+p.name+" chegar.";
      var dl=d.payLink||d.mpLink||""; var mp=/^https:\/\//.test(dl)?dl:"";
      return '<div class="dcard"><img loading="lazy" src="'+p.photo+'" alt="'+esc(p.brand+' '+p.name)+'"><span class="kicker">'+esc(p.brand)+'</span><b>'+esc(p.name)+'</b><small>Decant '+(d.ml||10)+' ml</small>'+
        '<div class="dprice">'+(av?money(d.price):'Em breve')+'</div><a class="btn wa sm" href="https://wa.me/'+WA+'?text='+encodeURIComponent(msg)+'" target="_blank" rel="noopener">'+ICON.wa+(av?'Pedir':'Avise-me')+'</a>'+(av&&mp?'<a class="btn gold sm" href="'+esc(mp)+'" target="_blank" rel="noopener">Comprar</a>':'')+'</div>'; }).join("");
  }
  $("#decGrid").innerHTML=dh;
  $("#decSoon").style.display=D.some(function(o){return o.d.available!==false&&typeof o.d.price==="number"})?"none":"";
}
document.addEventListener("click",function(e){
  var t;
  if((t=e.target.closest("[data-fam]"))){ var ft=FAMT[+t.dataset.fam]; S.family=ft.f.slice(); S.max=0; S.price=[]; setQ(""); refresh(); goCatalog(); return; }
  if((t=e.target.closest("[data-max]"))){ S.max=+t.dataset.max; S.avail=true; S.price=[]; S.family=[]; setQ(""); refresh(); goCatalog(); return; }
});

/* ---------- toast ---------- */
var tt; function toast(m){ var t=$("#toast"); t.textContent=m; t.classList.add("on"); clearTimeout(tt); tt=setTimeout(function(){t.classList.remove("on")},2200); }

/* ---------- init ---------- */
function init(){
  $("#statN").textContent=P.length;
  $("#statI").textContent=P.filter(function(p){return p.inspiredBy}).length;
  $("#statB").textContent=uniq(P.map(function(p){return p.brand})).length;
  $("#disc").textContent=META.disclaimer;
  buildPanel(); quickChips(); render(); quizRender(); tray(); vitrines(); var ec=$("#entCalc"); if(ec) ec.innerHTML=freteBox(""); observe(document);

  var q=$("#q"), deb;
  q.addEventListener("input",function(){ clearTimeout(deb); var v=q.value; deb=setTimeout(function(){setQ(v)},120); });
  $(".search .clr").addEventListener("click",function(){ setQ(""); q.focus(); });
  $("#sort").addEventListener("change",function(e){S.sort=e.target.value; render();});
  var clear=function(){ S.brand=[];S.gender=[];S.family=[];S.price=[];S.house=[];S.insp=false;S.avail=false;S.max=0; setQ(""); refresh(); };
  $("#clearAll").addEventListener("click",clear);
  $("#panelClear").addEventListener("click",clear);
  document.addEventListener("click",function(e){ if(e.target.closest("[data-clear]")) clear(); });
  var openP=function(o){ $("#panel").classList.toggle("open",o); $("#scrim").classList.toggle("on",o); document.body.classList.toggle("lock",o); };
  $("#filtersBtn").addEventListener("click",function(){openP(true)});
  $("#scrim").addEventListener("click",function(){openP(false)});
  $("#panelX").addEventListener("click",function(){openP(false)});
  $("#panelApply").addEventListener("click",function(){openP(false); $("#catalogo").scrollIntoView({behavior:"smooth"});});

  document.addEventListener("click",function(e){
    var b=e.target.closest("[data-cmp]"); if(b){ e.stopPropagation(); e.preventDefault(); toggleCmp(b.dataset.cmp); return; }
    var rm=e.target.closest("[data-rm]"); if(rm){ toggleCmp(rm.dataset.rm); return; }
    var c=e.target.closest(".card"); if(c&&!e.target.closest("a")){ openProduct(c.dataset.id); return; }
    if(e.target.closest("[data-close]")) closeModal();
    var ins=e.target.closest("[data-insp]"); if(ins){ e.preventDefault(); setQ(ins.dataset.insp); $("#catalogo").scrollIntoView({behavior:"smooth"}); }
  });
  document.addEventListener("keydown",function(e){
    if(e.key==="Escape"){ if($("#modal").classList.contains("open")) closeModal(); else { $("#panel").classList.remove("open"); $("#scrim").classList.remove("on"); document.body.classList.remove("lock"); } }
    if(e.key==="Enter"&&e.target.classList&&e.target.classList.contains("card")) openProduct(e.target.dataset.id);
  });
  $("#cmpGo").addEventListener("click",function(){ if(CMP.length>=2) compareView(); });
  $("#cmpClear").addEventListener("click",function(){ CMP.slice().forEach(toggleCmp); });
  $("#navCmpBtn").addEventListener("click",function(e){ e.preventDefault(); if(CMP.length>=2) compareView(); else toast("Toque em ⇆ nos cards para comparar até 3 perfumes"); });

  var top=$(".top"); var onS=function(){ top.classList.toggle("solid",scrollY>40); }; onS(); addEventListener("scroll",onS,{passive:true});
  var m=location.hash.match(/^#p=([\w-]+)/); if(m) openProduct(m[1]);
  var qs=new URLSearchParams(location.search); if(qs.get("q")) setQ(qs.get("q"));
}
if(DATA) boot(DATA);
else fetch("data.json").then(function(r){return r.json()}).then(boot);
})();
