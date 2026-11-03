/* BAGDA: modo claro/escuro. Carregar no <head> (síncrono) para não piscar. Impressão sempre clara (regras dark só em @media screen). */
(function(){
  var K="bagda-theme",d=document.documentElement,mq=window.matchMedia&&matchMedia("(prefers-color-scheme: dark)");
  function saved(){try{return localStorage.getItem(K)}catch(e){return null}}
  function cur(){var s=saved();return s==="dark"||s==="light"?s:(mq&&mq.matches?"dark":"light")}
  function apply(t){d.setAttribute("data-theme",t);d.style.colorScheme=t;var b=document.getElementById("theme-tg");if(b){b.textContent=t==="dark"?"☀":"☾";b.title=b.ariaLabel=t==="dark"?"Modo claro":"Modo escuro";b.setAttribute("aria-pressed",t==="dark")}}
  apply(cur());
  if(mq&&mq.addEventListener)mq.addEventListener("change",function(){if(!saved())apply(cur())});
  function btn(){if(document.getElementById("theme-tg"))return;var b=document.createElement("button");b.id="theme-tg";b.type="button";b.className="noprint";
    b.onclick=function(){var t=d.getAttribute("data-theme")==="dark"?"light":"dark";try{localStorage.setItem(K,t)}catch(e){}apply(t)};
    document.body.appendChild(b);apply(cur())}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",btn);else btn();
  /* garante papel claro no diálogo de impressão mesmo em navegadores que ignoram @media */
  window.addEventListener("beforeprint",function(){d.setAttribute("data-print","1")});
  window.addEventListener("afterprint",function(){d.removeAttribute("data-print")});
})();
