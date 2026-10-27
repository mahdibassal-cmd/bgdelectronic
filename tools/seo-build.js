#!/usr/bin/env node
/* SEO build: head tags, JSON-LD (Product + Store), sitemap.xml, robots.txt, Google Merchant feed.
   Run from repo root:  node tools/seo-build.js
   Only RETAIL prices are used (perfumes/data.json, data.js, beleza/assets/beauty.js). Atacado data is never read.
   Search Console: paste MB's verification meta tag content into tools/gsc-verification.txt (just the content="..." value) and re-run. */
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..'),R=f=>fs.readFileSync(path.join(ROOT,f),'utf8'),W=(f,s)=>fs.writeFileSync(path.join(ROOT,f),s);
const SITE='https://bgdstores.com',TODAY=new Date().toISOString().slice(0,10);
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const brl=s=>typeof s==='number'?s:parseFloat(String(s).replace(/[^\d,]/g,'').replace(',','.'));
const abs=u=>/^https?:/.test(u)?u:SITE+'/'+u.replace(/^\//,'').split('?')[0];
// ---------- data ----------
const PF=JSON.parse(R('perfumes/data.json')).perfumes;
const ctx={};new Function('ctx',R('data.js').replace(/^const (\w+)/mg,'ctx.$1')+'')(ctx);
const EL=ctx.PRODUCTS;
const win={};new Function('window',R('beleza/assets/beauty.js').replace(/\(function\(\)\{[\s\S]*$/,''))(win);
const BE=win.BAGDA_BEAUTY||[];
const ELBRAND=[[/^Nintendo/,'Nintendo'],[/^Starlink/,'Starlink'],[/^Hori/,'HORI'],[/^JBL/,'JBL'],[/^Hopestar/,'Hopestar'],[/^JOOG/,'JOOG'],[/^Oura/,'Oura'],[/^Google/,'Google'],[/^Garmin/,'Garmin'],[/^Huawei/,'Huawei'],[/Apple original|^iPhone Pocket/,'Apple'],[/^Logitech/,'Logitech'],[/Ninja/,'Ninja']];
const ELCAT={'Consoles':'Electronics > Video Game Consoles','Starlink':'Electronics > Communications','Acessórios Gaming':'Electronics > Video Game Console Accessories','Áudio & Som':'Electronics > Audio > Audio Components > Speakers','Smart & Tech':'Electronics','Wearables':'Electronics','Smartwatches':'Electronics > Electronics Accessories','Apple & Acessórios':'Electronics > Electronics Accessories','Notebooks & Periféricos':'Electronics > Electronics Accessories > Computer Components > Input Devices','Cozinha & Casa':'Home & Garden > Kitchen & Dining > Kitchen Appliances'};
const slug=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const items=[];
for(const p of PF){ if(!(p.price>0)) continue;
  const full=p.brand+' '+p.name+(p.size?' '+p.size:'');
  items.push({id:p.id,page:'perfumes',title:'Perfume '+full,desc:'Perfume '+full+(p.gender?' · '+p.gender:'')+'. Original, na BAGDA PERFUMES (Mega Polo Brás, São Paulo). Retire na loja ou receba em todo o Brasil.',
    link:SITE+'/perfumes/#p='+p.id,image:abs('perfumes/'+p.photo),price:p.price,brand:p.brand,inStock:!p.soldOut,gcat:'479',ident:true});}
for(const p of BE){ const v=brl(p.price); if(!(v>0)) continue;
  items.push({id:'beleza-'+p.img,page:'beleza',title:p.name,desc:(p.desc||p.name)+' Original, na BAGDA PERFUMES (Brás, São Paulo).',link:SITE+'/beleza/',image:abs('perfumes/img/beauty/'+p.img+'.jpg'),price:v,brand:p.brand,inStock:true,
    gcat:p.category==='Cabelo'?'486':'567',ident:true});}
for(const p of EL){ const v=brl(p.price); if(!(v>0)||!p.image) continue; const b=(ELBRAND.find(x=>x[0].test(p.name))||[0,null])[1];
  items.push({id:'el-'+slug(p.name),page:'home',title:p.name,desc:p.name+' · '+p.category+'. Na BAGDA STORES (Mega Polo Brás, São Paulo). Retire na loja ou receba em SP.',link:SITE+'/#eletronicos',image:abs(p.image),price:v,brand:b||'Genérico',inStock:true,gcat:ELCAT[p.category]||'Electronics',ident:!!b});}
// ---------- JSON-LD ----------
const STORE=(name,url)=>({"@context":"https://schema.org","@type":"Store","name":name,"url":url,"image":SITE+'/img/brand/'+(name==='BAGDA STORES'?'bagda-stores':'bagda-perfumes')+'.jpg',
  "telephone":"+55 11 99287-3509","address":{"@type":"PostalAddress","streetAddress":"Rua Barão de Ladário, 670 — Mega Polo Brás, Loja 357, 3º andar","addressLocality":"São Paulo","addressRegion":"SP","addressCountry":"BR"},
  "openingHours":"Mo-Sa 08:00-17:30","sameAs":["https://www.instagram.com/bagda.perfumes/"],"contactPoint":{"@type":"ContactPoint","telephone":"+55 11 99287-3509","contactType":"sales","url":"https://wa.me/5511992873509","availableLanguage":"pt-BR"}});
const PROD=i=>({"@context":"https://schema.org","@type":"Product","name":i.title,"image":i.image,"description":i.desc,"sku":i.id,...(i.ident?{"brand":{"@type":"Brand","name":i.brand}}:{}),
  "offers":{"@type":"Offer","url":i.link,"priceCurrency":"BRL","price":i.price.toFixed(2),"availability":"https://schema.org/"+(i.inStock?'InStock':'OutOfStock'),"itemCondition":"https://schema.org/NewCondition","seller":{"@type":"Organization","name":i.page==='home'?'BAGDA STORES':'BAGDA PERFUMES'}}});
const ld=objs=>objs.map(o=>'<script type="application/ld+json">'+JSON.stringify(o).replace(/</g,'\\u003c')+'</script>').join('\n');
// ---------- pages ----------
const GSC=fs.existsSync(path.join(ROOT,'tools/gsc-verification.txt'))?R('tools/gsc-verification.txt').trim():'';
const PAGES=[
 {f:'index.html',url:'/',title:'BAGDA STORES | Eletrônicos, Games e Tecnologia no Brás, São Paulo',desc:'BAGDA STORES no Mega Polo Brás (Loja 357): consoles, JBL, Oura Ring, smartwatches, Starlink e acessórios. Preço na tela, pedido pelo WhatsApp (11) 99287-3509.',img:'img/og/og-home.jpg',site:'BAGDA STORES',ld:[STORE('BAGDA STORES',SITE+'/'),STORE('BAGDA PERFUMES',SITE+'/perfumes/')],prod:'home',gsc:true},
 {f:'perfumes/index.html',url:'/perfumes/',title:'Perfumes Árabes Originais em São Paulo | BAGDA PERFUMES',desc:'Perfumes árabes originais Arabiyat Prestige, Armaf, Ferassa, French Avenue, Paris Corner, MPF e mais. Loja no Mega Polo Brás, SP. Compre pelo WhatsApp ou pague por PIX e cartão.',img:'img/og/og-perfumes.jpg',site:'BAGDA PERFUMES',ld:[STORE('BAGDA PERFUMES',SITE+'/perfumes/')],prod:'perfumes'},
 {f:'beleza/index.html',url:'/beleza/',title:'Beleza & Cosméticos Coreanos e Japoneses em São Paulo | BAGDA PERFUMES',desc:'Skincare coreano Celimax e cuidados com cabelo Fino (Shiseido), originais. Loja no Mega Polo Brás, SP. Compre pelo WhatsApp (11) 99287-3509 ou pague por PIX e cartão.',img:'img/og/og-beleza.jpg',site:'BAGDA PERFUMES',ld:[STORE('BAGDA PERFUMES',SITE+'/beleza/')],prod:'beleza'},
 {f:'sorteio/index.html',url:'/sorteio/',title:'Sorteio Semanal de Perfumes | BAGDA PERFUMES',desc:'Cadastre-se no sorteio semanal da BAGDA PERFUMES e concorra a perfumes árabes originais. Resultado ao vivo no Instagram @bagda.perfumes.',img:'img/og/og-perfumes.jpg',site:'BAGDA PERFUMES',ld:[]},
 {f:'sorteio/historico/index.html',url:'/sorteio/historico/',title:'Histórico de Sorteios e Ganhadores | BAGDA PERFUMES',desc:'Ganhadores de cada sorteio semanal da BAGDA PERFUMES, com os perfumes sorteados.',img:'img/og/og-perfumes.jpg',site:'BAGDA PERFUMES',ld:[]},
];
const STRIP=[/<title>[\s\S]*?<\/title>\s*/,/<meta\s+name="description"[^>]*>\s*/g,/<link\s+rel="canonical"[^>]*>\s*/g,/<meta\s+(property|name)="(og|twitter):[^"]*"[^>]*>\s*/g,/<meta\s+name="robots"[^>]*>\s*/g,
  /<script type="application\/ld\+json">\{"@context":"https:\/\/schema.org","@type":"Store"[\s\S]*?<\/script>\s*/g,/<!-- SEO:BEGIN -->[\s\S]*?<!-- SEO:END -->\s*/g,/<!-- LD:BEGIN -->[\s\S]*?<!-- LD:END -->\s*/g,/<meta name="google-site-verification"[^>]*>\s*/g];
for(const P of PAGES){ let s=R(P.f); for(const r of STRIP) s=s.replace(r,'');
  const u=SITE+P.url,img=SITE+'/'+P.img;
  const head=`<!-- SEO:BEGIN -->
<title>${esc(P.title)}</title>
<meta name="description" content="${esc(P.desc)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${u}">
<meta property="og:type" content="website"><meta property="og:locale" content="pt_BR"><meta property="og:site_name" content="${P.site}">
<meta property="og:title" content="${esc(P.title)}"><meta property="og:description" content="${esc(P.desc)}"><meta property="og:url" content="${u}">
<meta property="og:image" content="${img}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(P.title)}"><meta name="twitter:description" content="${esc(P.desc)}"><meta name="twitter:image" content="${img}">
${P.gsc&&GSC?`<meta name="google-site-verification" content="${esc(GSC)}">\n`:''}<!-- SEO:END -->
`;
  s=s.replace(/(<meta\s+name="viewport"[^>]*>)\s*/,'$1\n'+head);
  const L=P.ld.concat(P.prod?items.filter(i=>i.page===P.prod).map(PROD):[]);
  if(L.length) s=s.replace(/<\/body>/,'<!-- LD:BEGIN -->\n'+ld(L)+'\n<!-- LD:END -->\n</body>');
  W(P.f,s);}
// noindex pages
for(const f of ['atacado/index.html','sorteio/ganhadores/index.html']){ let s=R(f).replace(/<meta\s+name="robots"[^>]*>\s*/g,'').replace(/<link\s+rel="canonical"[^>]*>\s*/g,'');
  s=s.replace(/(<meta\s+name="viewport"[^>]*>)\s*/,'$1\n<meta name="robots" content="noindex,nofollow">\n'); W(f,s);}
// sitemap + robots
W('sitemap.xml','<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+PAGES.map(P=>`  <url><loc>${SITE+P.url}</loc><lastmod>${TODAY}</lastmod></url>`).join('\n')+'\n</urlset>\n');
W('robots.txt',`User-agent: *\nAllow: /\nDisallow: /atacado/\nDisallow: /sorteio/ganhadores/\n\nSitemap: ${SITE}/sitemap.xml\n`);
// Merchant feed
const x=s=>esc(s).replace(/'/g,'&apos;');
fs.mkdirSync(path.join(ROOT,'feeds'),{recursive:true});
W('feeds/google-merchant.xml','<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n<channel>\n<title>BAGDA PERFUMES e BAGDA STORES</title>\n<link>'+SITE+'/</link>\n<description>Produtos de varejo bgdstores.com</description>\n'+
 items.map(i=>`<item>
  <g:id>${x(i.id)}</g:id>
  <g:title>${x(i.title.slice(0,150))}</g:title>
  <g:description>${x(i.desc)}</g:description>
  <g:link>${x(i.link)}</g:link>
  <g:image_link>${x(i.image)}</g:image_link>
  <g:availability>${i.inStock?'in_stock':'out_of_stock'}</g:availability>
  <g:price>${i.price.toFixed(2)} BRL</g:price>
  <g:brand>${x(i.brand)}</g:brand>
  <g:condition>new</g:condition>
  <g:google_product_category>${x(i.gcat)}</g:google_product_category>
${i.ident?'':'  <g:identifier_exists>no</g:identifier_exists>\n'}</item>`).join('\n')+'\n</channel>\n</rss>\n');
console.log('feed items',items.length,{perfumes:items.filter(i=>i.page==='perfumes').length,beleza:items.filter(i=>i.page==='beleza').length,eletronicos:items.filter(i=>i.page==='home').length,outOfStock:items.filter(i=>!i.inStock).length});
