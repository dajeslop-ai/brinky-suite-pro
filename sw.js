const CACHE='brinky-fiesta-suite-v2-2-1-whatsapp-mensajes';
const ASSETS=['./','./index.html','./styles.css?v=2.2','./app.js?v=2.2','./manifest.json','./icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png','./assets/facebook-banner.jpg','./CONFIGURAR_RESPALDO_NUBE.sql','./LEEME_RESPALDO_SEGURO.txt','./LEEME_V2_ANDROID_CLUB.txt','./ACTUALIZAR_SUPABASE_CLUB_BRINKY.sql'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))))});
