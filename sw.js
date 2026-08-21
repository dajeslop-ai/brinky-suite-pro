const CACHE='brinky-fiesta-suite-v2-2-3-folios-80-fix1';
const ASSETS=['./','./index.html','./styles.css?v=2.2.3','./app.js?v=2.2.3','./manifest.json','./icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png','./assets/facebook-banner.jpg','./CONFIGURAR_RESPALDO_NUBE.sql','./LEEME_RESPALDO_SEGURO.txt','./LEEME_V2_ANDROID_CLUB.txt','./ACTUALIZAR_SUPABASE_CLUB_BRINKY.sql','./LEEME_V2_2_2_SINCRONIZACION_SEGURA.txt','./LEEME_V2_2_3_FOLIOS_80.txt'];

// Protección de migración: incluso si el navegador conserva un app.js anterior,
// el historial del año actual queda como mínimo en 79 para que el siguiente
// contrato y la siguiente cotización sean 80.
const FOLIO_BOOTSTRAP=`(()=>{try{const k='brinky_folio_state_v1',y=String(new Date().getFullYear()),s=JSON.parse(localStorage.getItem(k)||'{}');s.contracts=s.contracts||{};s.quotes=s.quotes||{};s.contracts[y]=Math.max(Number(s.contracts[y]||0),79);s.quotes[y]=Math.max(Number(s.quotes[y]||0),79);localStorage.setItem(k,JSON.stringify(s));}catch(e){}})();\n`;

self.addEventListener('install',e=>e.waitUntil((async()=>{
  const c=await caches.open(CACHE);
  for(const url of ASSETS){
    try{
      const r=await fetch(url,{cache:'reload'});
      if(r.ok)await c.put(url,r.clone());
    }catch(e){}
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

  // app.js se pide siempre sin caché HTTP y se antepone la protección de folios.
  if(u.origin===self.location.origin && /\/app\.js$/.test(u.pathname)){
    e.respondWith((async()=>{
      try{
        const r=await fetch(e.request,{cache:'no-store'});
        if(!r.ok)throw new Error('HTTP '+r.status);
        const text=await r.text();
        const headers=new Headers(r.headers);
        headers.set('content-type','application/javascript; charset=utf-8');
        const patched=new Response(FOLIO_BOOTSTRAP+text,{status:r.status,statusText:r.statusText,headers});
        const c=await caches.open(CACHE);
        await c.put(e.request,patched.clone());
        return patched;
      }catch(err){
        const cached=await caches.match(e.request)||await caches.match('./app.js?v=2.2.3');
        if(!cached)throw err;
        const text=await cached.text();
        const headers=new Headers(cached.headers);
        headers.set('content-type','application/javascript; charset=utf-8');
        return new Response(FOLIO_BOOTSTRAP+text,{status:200,headers});
      }
    })());
    return;
  }

  // Para la app instalada se prioriza siempre la versión publicada más reciente.
  e.respondWith((async()=>{
    try{
      const r=await fetch(e.request,{cache:'no-store'});
      if(r.ok){const c=await caches.open(CACHE);await c.put(e.request,r.clone());}
      return r;
    }catch(err){
      return (await caches.match(e.request))||(await caches.match('./index.html'));
    }
  })());
});
