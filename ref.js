/* Código de indicação: campo opcional ao lado dos botões de compra e em todo contato via WhatsApp. */
(function(){
  var KEY='bgd_ref_code', NUM=(typeof WHATSAPP_NUMBER!=='undefined'?String(WHATSAPP_NUMBER):'5511992873509').replace(/\D/g,'');
  function get(){try{return (localStorage.getItem(KEY)||'').trim()}catch(e){return ''}}
  function set(v){try{localStorage.setItem(KEY,v.trim())}catch(e){}}
  function tag(t){var c=get();return c&&!/Código de indicação/.test(t)?t+'\nCódigo de indicação: '+c:t;}
  window.BGDRef={get:get,tag:tag};
  var st=document.createElement('style');st.textContent='.refbox{width:100%;margin:6px 0;flex:0 0 auto}.refbox.solo{max-width:420px;margin:18px auto;padding:0 16px}.refbox input{width:100%;box-sizing:border-box;background:#0b0b0b;color:#e8c977;border:1px solid #b8933a;border-radius:10px;padding:9px 12px;font:inherit;font-size:14px;letter-spacing:.04em;text-transform:uppercase}.refbox input::placeholder{color:#8c7a4f;text-transform:none;letter-spacing:0}.refbox input:focus{outline:none;border-color:#e8c977;box-shadow:0 0 0 2px rgba(232,201,119,.25)}';
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
      var cs=getComputedStyle(p),b=box(),first=p.querySelector(':scope > a[href]')||a;p.insertBefore(b,first);if(cs.display.indexOf('flex')>-1&&cs.flexDirection.indexOf('row')===0){b.style.flexBasis='100%';p.style.flexWrap='wrap';}});
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
  function run(){decorate();var q;new MutationObserver(function(){clearTimeout(q);q=setTimeout(decorate,50)}).observe(document.body,{childList:true,subtree:true});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();
})();
