const WA='5511992873509',f=document.getElementById('f'),w=document.getElementById('w'),err=document.getElementById('e');
w.oninput=()=>{let d=w.value.replace(/\D/g,'').slice(0,11),r=d;if(d.length>2)r='('+d.slice(0,2)+') '+d.slice(2);if(d.length>6)r='('+d.slice(0,2)+') '+d.slice(2,d.length-4)+'-'+d.slice(-4);w.value=r};
function buildUrl(nome,tel,ig){let t='Olá! Quero me cadastrar no sorteio da Bagda Perfumes.\nNome: '+nome+'\nWhatsApp: '+tel;if(ig)t+='\nInstagram: '+(ig[0]=='@'?ig:'@'+ig);return 'https://wa.me/'+WA+'?text='+encodeURIComponent(t)}
f.onsubmit=e=>{e.preventDefault();const nome=f.nome.value.trim(),tel=w.value.trim(),ig=f.instagram.value.trim().replace(/\s/g,''),dig=tel.replace(/\D/g,'');
if(nome.length<2)return err.textContent='Informe seu nome.';if(dig.length<10||dig.length>11)return err.textContent='Informe um WhatsApp válido com DDD.';if(!document.getElementById('lgpd').checked)return err.textContent='Marque a concordância com a LGPD.';
err.textContent='';location.href=buildUrl(nome,tel,ig)};
const LIVE_AT=Date.parse('2026-10-26T16:30:00-03:00');
function liveState(now){const ms=LIVE_AT-now;if(ms<=0)return{on:true,text:'ESTAMOS AO VIVO AGORA',cd:''};const t=Math.floor(ms/1000),p=n=>String(n).padStart(2,'0');return{on:false,text:'AO VIVO NO INSTAGRAM HOJE ÀS 16:30',cd:p(Math.floor(t/3600))+':'+p(Math.floor(t%3600/60))+':'+p(t%60)}}
function tick(){const s=liveState(Date.now()),el=document.getElementById('live');if(!el)return;document.getElementById('lt').textContent=s.text;document.getElementById('cd').textContent=s.cd;el.classList.toggle('on',s.on);if(s.on)clearInterval(ti)}
const ti=setInterval(tick,1000);tick();
