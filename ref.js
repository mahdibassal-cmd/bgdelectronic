/* Código de indicação: campo opcional ao lado dos botões de compra e em todo contato via WhatsApp. */
(function(){
  var KEY='bgd_ref_code', NUM=(typeof WHATSAPP_NUMBER!=='undefined'?String(WHATSAPP_NUMBER):'5511992873509').replace(/\D/g,'');
  function get(){try{return (localStorage.getItem(KEY)||'').trim()}catch(e){return ''}}
  function set(v){try{localStorage.setItem(KEY,v.trim())}catch(e){}}
  function tag(t){var c=get();return c&&!/Código de indicação/.test(t)?t+'\nCódigo de indicação: '+c:t;}
  window.BGDRef={get:get,tag:tag};
  var st=document.createElement('style');st.textContent='.refbox{width:100%;margin:4px 0 6px;flex:0 0 auto}.refbox input[type=text]{display:block;width:100%;box-sizing:border-box;height:38px;margin:0;padding:0 12px;text-overflow:ellipsis;background:transparent;color:inherit;font:inherit;font-size:13px;letter-spacing:.02em;text-align:inherit;border:1px solid var(--line2,var(--line,rgba(0,0,0,.14)));border-radius:var(--ref-r,999px);box-shadow:none;outline:none;transition:border-color .2s,box-shadow .2s}.refbox input[type=text]::placeholder{color:var(--muted,var(--dim,#8a8a8a));opacity:.85;letter-spacing:0}.refbox input[type=text]:focus{border-color:var(--gold,currentColor);box-shadow:0 0 0 3px color-mix(in srgb,var(--gold,#888) 14%,transparent)}.refbox.solo{max-width:420px;margin:18px auto;padding:0 16px}';
  document.head.appendChild(st);
  function box(cls){var w=document.createElement('div');w.className='refbox'+(cls?' '+cls:'');
    w.innerHTML='<input type="text" maxlength="30" autocomplete="off" aria-label="Código de indicação (opcional)" placeholder="Código de indicação (opcional)">';
    var i=w.firstChild;i.value=get();
    i.addEventListener('input',function(){set(i.value);document.querySelectorAll('.refbox input').forEach(function(o){if(o!==i)o.value=i.value})});
    i.addEventListener('click',function(e){e.stopPropagation()});return w;}
  function isBuy(a){var h=a.getAttribute('href')||'',t=a.textContent||'';
    return /pag\.getnet\.com\.br/.test(h)||(/wa\.me\//.test(h)&&/Comprar|Pedir|Pagar|Avise/i.test(t));}
  function prod(el){var c=el.closest('article,.dcard,.pd,.modal,[role="dialog"],[class*="card"]');
    var h=c&&c.querySelector('h1,h2,h3,b,strong');return h?h.textContent.trim():'um produto';}
  function decorate(){
    document.querySelectorAll('a[href]').forEach(function(a){
      if(!isBuy(a))return;var p=a.parentNode;if(!p||p.querySelector(':scope > .refbox'))return;
      var cs=getComputedStyle(p),b=box(),r=getComputedStyle(a).borderRadius;if(r&&r!=='0px')b.style.setProperty('--ref-r',r);var first=p.querySelector(':scope > a[href]')||a;p.insertBefore(b,first);if(cs.display.indexOf('flex')>-1&&cs.flexDirection.indexOf('row')===0){b.style.flexBasis='100%';p.style.flexWrap='wrap';}});
    document.querySelectorAll('[data-refbox]:not([data-refdone])').forEach(function(el){el.setAttribute('data-refdone','');el.appendChild(box('solo'));});
    if(!document.querySelector('.refbox')&&document.querySelector('a[href*="wa.me/"]')&&!document.querySelector('.refbox.solo')){
      var f=document.querySelector('footer');var b=box('solo');f?f.parentNode.insertBefore(b,f):document.body.appendChild(b);}
  }
  document.addEventListener('click',function(e){
    var a=e.target.closest&&e.target.closest('a[href]');if(!a)return;var code=get();if(!code)return;
    var h=a.getAttribute('href')||'';
    if(/wa\.me\//.test(h)&&!/C%C3%B3digo%20de%20indica/.test(h)){
      var u=h.split('?text='),t=u[1]?decodeURIComponent(u[1]):'Olá!';
      a.setAttribute('href',u[0]+'?text='+encodeURIComponent(tag(t)));
    } else if(/pag\.getnet\.com\.br/.test(h)){
      var msg='Olá! Comprei '+prod(a)+' e usei o código de indicação: '+code;
      setTimeout(function(){window.open('https://wa.me/'+NUM+'?text='+encodeURIComponent(msg),'_blank')},400);
    }
  },true);
  function fit(){document.querySelectorAll('.refbox input').forEach(function(i){var w=i.offsetWidth;if(w)i.placeholder=w<130?'Código':w<230?'Cód. indicação':'Código de indicação (opcional)'})}
  function run(){decorate();fit();setTimeout(fit,800);addEventListener('resize',fit);var q;new MutationObserver(function(){clearTimeout(q);q=setTimeout(function(){decorate();fit()},50)}).observe(document.body,{childList:true,subtree:true});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();
})();
