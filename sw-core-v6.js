const CACHE='brinky-fiesta-suite-v2-2-7-folios-80-fix6';
const ASSETS=['./','./index.html','./styles.css?v=2.2.3','./app.js?v=2.2.3','./runtime-patch-v6.js','./runtime-patch-v7.js','./manifest.json','./icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png','./assets/facebook-banner.jpg'];

// El historial de folios nunca baja al eliminar un documento.
const FOLIO_BOOTSTRAP="(()=>{try{const k='brinky_folio_state_v1',y=String(new Date().getFullYear()),s=JSON.parse(localStorage.getItem(k)||'{}');s.contracts=s.contracts||{};s.quotes=s.quotes||{};s.contracts[y]=Math.max(Number(s.contracts[y]||0),79);s.quotes[y]=Math.max(Number(s.quotes[y]||0),79);localStorage.setItem(k,JSON.stringify(s));}catch(e){}})();\n";

function patchAppSource(text){
  // PDF: sustituir el bloque publicitario fijo por la configuración editable.
  text=text.replace(
    "const ctaTop=Math.max(y,H-300);g.fillStyle='#eefcf4';g.fillRect(L,ctaTop,R-L,220);",
    "const promoSettings=getContractPromoSettings(),ctaTop=Math.max(y,H-300);if(promoSettings.enabled){g.fillStyle='#eefcf4';g.fillRect(L,ctaTop,R-L,220);"
  );
  text=text.replace(
    "if(includePromoImage){try{const banner=new Image();banner.src=FACEBOOK_BANNER_DATA_URL;await banner.decode();g.drawImage(banner,L+18,ctaTop+18,390,184)}catch{}}",
    "if(includePromoImage&&promoSettings.showImage!==false){try{const banner=new Image();banner.src=promoSettings.image||FACEBOOK_BANNER_DATA_URL;await banner.decode();g.drawImage(banner,L+18,ctaTop+18,390,184)}catch{}}"
  );
  text=text.replace(
    "g.fillStyle='#08752f';g.font='bold 23px Arial';g.fillText('¿Disfrutaste nuestro servicio?',L+445,ctaTop+48);",
    "g.fillStyle='#08752f';g.font='bold 23px Arial';g.fillText(promoSettings.title||'¿Disfrutaste nuestro servicio?',L+445,ctaTop+48);"
  );
  text=text.replace(
    "drawWrappedText(g,DEFAULT_PDF_PROMO,L+445,ctaTop+82,R-(L+445)-20,22,5);",
    "drawWrappedText(g,promoSettings.text||DEFAULT_PDF_PROMO,L+445,ctaTop+82,R-(L+445)-20,22,5);"
  );
  text=text.replace(
    "g.fillStyle='#1877f2';g.font='bold 18px Arial';g.fillText('Facebook: Brincolines Brinky Fiesta',L+445,ctaTop+190);",
    "g.fillStyle='#1877f2';g.font='bold 18px Arial';g.fillText(promoSettings.buttonText||'Abrir nuestra página de Facebook',L+445,ctaTop+190);}"
  );

  // Incluir la configuración del contrato en respaldo completo y Supabase.
  const oldSettings="clubTemplates:getClubMessageTemplates(),deletedItems:getDeletedItems()";
  const newSettings="clubTemplates:getClubMessageTemplates(),contractPromoSettings:getContractPromoSettings(),deletedItems:getDeletedItems()";
  text=text.split(oldSettings).join(newSettings);

  // Recuperarla al leer el estado general de Supabase.
  text=text.replace(
    "const localMembers=getLoyalty(),localExpenses=getExpenses(),fresh=!meaningfulLocalData()",
    "if(remote.contractPromoSettings)setContractPromoSettings(remote.contractPromoSettings,{sync:false});const localMembers=getLoyalty(),localExpenses=getExpenses(),fresh=!meaningfulLocalData()"
  );
  return text;
}

function moveBackupToEnd(html){
  try{
    const startMarker='<section class="card backup-card" id="backupCard">';
    const start=html.indexOf(startMarker);if(start<0)return html;
    const close=html.indexOf('</section>',start);if(close<0)return html;
    const end=close+'</section>'.length,block=html.slice(start,end);
    let rest=html.slice(0,start)+html.slice(end);
    const homeEnd='\n  </section>\n\n  <section id="newView"',anchor=rest.indexOf(homeEnd);if(anchor<0)return html;
    return rest.slice(0,anchor)+'\n    '+block.trim()+'\n'+rest.slice(anchor);
  }catch(e){return html;}
}

async function runtimePatchText(){
  try{
    const r=await fetch('./runtime-patch-v6.js',{cache:'no-store'});
    if(r.ok){
      const base=await r.text();
      try{const r2=await fetch('./runtime-patch-v7.js',{cache:'no-store'});if(r2.ok)return base+'\n'+await r2.text();}catch(e){}
      return base;
    }
  }catch(e){}
  const cached=await caches.match('./runtime-patch-v6.js');
  return cached?await cached.text():'';
}

self.addEventListener('install',e=>e.waitUntil((async()=>{
  const c=await caches.open(CACHE);
  for(const url of ASSETS){
    try{const r=await fetch(url,{cache:'reload'});if(r.ok)await c.put(url,r.clone());}catch(e){}
  }
  await self.skipWaiting();
})()));

self.addEventListener('activate',e=>e.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
  await self.clients.claim();
})()));

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);

  if(u.origin===self.location.origin&&(e.request.mode==='navigate'||/\/index\.html$/.test(u.pathname)||u.pathname.endsWith('/brinky-suite-pro/'))){
    e.respondWith((async()=>{
      try{
        const r=await fetch(e.request,{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);
        const text=moveBackupToEnd(await r.text()),headers=new Headers(r.headers);headers.set('content-type','text/html; charset=utf-8');
        const patched=new Response(text,{status:r.status,statusText:r.statusText,headers});
        const c=await caches.open(CACHE);await c.put('./index.html',patched.clone());return patched;
      }catch(err){
        const cached=(await caches.match('./index.html'))||(await caches.match(e.request));if(!cached)throw err;
        const text=moveBackupToEnd(await cached.text()),headers=new Headers(cached.headers);headers.set('content-type','text/html; charset=utf-8');
        return new Response(text,{status:200,headers});
      }
    })());return;
  }

  if(u.origin===self.location.origin&&/\/app\.js$/.test(u.pathname)){
    e.respondWith((async()=>{
      try{
        const r=await fetch(e.request,{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);
        const base=patchAppSource(await r.text()),patch=await runtimePatchText(),headers=new Headers(r.headers);headers.set('content-type','application/javascript; charset=utf-8');
        const patched=new Response(FOLIO_BOOTSTRAP+base+'\n'+patch,{status:r.status,statusText:r.statusText,headers});
        const c=await caches.open(CACHE);await c.put(e.request,patched.clone());return patched;
      }catch(err){
        const cached=await caches.match('./app.js?v=2.2.3')||await caches.match(e.request);if(!cached)throw err;
        const base=patchAppSource(await cached.text()),patch=await runtimePatchText(),headers=new Headers(cached.headers);headers.set('content-type','application/javascript; charset=utf-8');
        return new Response(FOLIO_BOOTSTRAP+base+'\n'+patch,{status:200,headers});
      }
    })());return;
  }

  e.respondWith((async()=>{
    try{const r=await fetch(e.request,{cache:'no-store'});if(r.ok){const c=await caches.open(CACHE);await c.put(e.request,r.clone());}return r;}
    catch(err){return(await caches.match(e.request))||(await caches.match('./index.html'));}
  })());
});
