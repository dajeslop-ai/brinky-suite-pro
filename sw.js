const CACHE='brinky-fiesta-suite-v2-2-3-folios-80-fix3';
const ASSETS=['./','./index.html','./styles.css?v=2.2.3','./app.js?v=2.2.3','./manifest.json','./icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png','./assets/facebook-banner.jpg','./CONFIGURAR_RESPALDO_NUBE.sql','./LEEME_RESPALDO_SEGURO.txt','./LEEME_V2_ANDROID_CLUB.txt','./ACTUALIZAR_SUPABASE_CLUB_BRINKY.sql','./LEEME_V2_2_2_SINCRONIZACION_SEGURA.txt','./LEEME_V2_2_3_FOLIOS_80.txt'];

// Protección de migración: incluso si el navegador conserva un app.js anterior,
// el historial del año actual queda como mínimo en 79 para que el siguiente
// contrato y la siguiente cotización sean 80.
const FOLIO_BOOTSTRAP=`(()=>{try{const k='brinky_folio_state_v1',y=String(new Date().getFullYear()),s=JSON.parse(localStorage.getItem(k)||'{}');s.contracts=s.contracts||{};s.quotes=s.quotes||{};s.contracts[y]=Math.max(Number(s.contracts[y]||0),79);s.quotes[y]=Math.max(Number(s.quotes[y]||0),79);localStorage.setItem(k,JSON.stringify(s));}catch(e){}})();\n`;

// Parche de seguridad v2.2.3 fix3:
// 1) Un borrado antiguo ya no puede ocultar para siempre un documento nuevo con el mismo folio.
// 2) Guardar de nuevo un contrato/cotización limpia cualquier marca de borrado antigua del mismo folio.
// 3) Importar/recuperar un respaldo es una acción explícita de restauración y elimina la marca de borrado del documento importado.
// 4) Añade una herramienta manual para rescatar de Supabase documentos que sigan allí pero estén marcados como eliminados.
const SAFE_SYNC_PATCH=`\n;(()=>{\n  try{\n    const clearDocTombstone=(type,id)=>{\n      if(!id)return;\n      const d=getDeletedItems();\n      const before=(d.documents||[]).length;\n      d.documents=(d.documents||[]).filter(x=>!(x.type===type&&String(x.id)===String(id)));\n      if(d.documents.length!==before)setDeletedItems(d);\n    };\n\n    mergeDocuments=function(localItems,remoteEntries,type){\n      const state=getDeletedItems();\n      const tombs=(state.documents||[]).filter(x=>x.type===type);\n      const tmap=new Map(tombs.map(x=>[String(x.id),x]));\n      const revived=new Set();\n      const live=(doc,fallback='')=>{\n        if(!doc?.id)return false;\n        const t=tmap.get(String(doc.id));\n        if(!t)return true;\n        const docTs=timeMs(doc.updatedAt||doc.createdAt||fallback);\n        const delTs=timeMs(t.deletedAt);\n        if(docTs>delTs+1000){revived.add(String(doc.id));return true;}\n        return false;\n      };\n      const out=(localItems||[]).filter(x=>live(x));\n      const idx=new Map(out.map((x,i)=>[String(x.id),i]));\n      let added=0,updated=0;\n      for(const entry of remoteEntries||[]){\n        const r=entry?.payload||entry;\n        if(!r?.id||!live(r,entry?.updated_at))continue;\n        const k=String(r.id),i=idx.get(k);\n        if(i===undefined){out.push({...r,updatedAt:r.updatedAt||entry?.updated_at||r.createdAt});idx.set(k,out.length-1);added++;continue;}\n        const l=out[i],rt=documentStamp(r,entry?.updated_at),lt=documentStamp(l);\n        if(rt>lt+1000){out[i]={...r,updatedAt:r.updatedAt||entry?.updated_at||r.createdAt};updated++;}\n      }\n      if(revived.size){\n        state.documents=(state.documents||[]).filter(x=>!(x.type===type&&revived.has(String(x.id))));\n        setDeletedItems(state);\n      }\n      return{items:out,added,updated};\n    };\n\n    const _saveContract=saveContract;\n    saveContract=function(data){clearDocTombstone('contract',data?.id);return _saveContract(data);};\n    const _saveQuote=saveQuote;\n    saveQuote=function(data){clearDocTombstone('quote',data?.id);return _saveQuote(data);};\n\n    const _applyFullSnapshot=applyFullSnapshot;\n    applyFullSnapshot=function(snap,opts={}){\n      try{\n        for(const c of snap?.contracts||[])clearDocTombstone('contract',c?.id);\n        for(const q of snap?.quotes||[])clearDocTombstone('quote',q?.id);\n      }catch(e){}\n      return _applyFullSnapshot(snap,opts);\n    };\n\n    async function rescueCloudDeletedDocs(){\n      if(!cloudIsConnected()){alert('Conecta primero Supabase.');return;}\n      try{\n        const r=await cloudFetch('/rest/v1/brinky_document_backups?select=document_id,document_type,payload,updated_at&order=updated_at.asc');\n        const rows=await r.json();\n        let state=getDeletedItems();\n        const hidden=(rows||[]).filter(row=>(state.documents||[]).some(t=>t.type===row.document_type&&String(t.id)===String(row.document_id)));\n        if(!hidden.length){alert('No encontré documentos de la nube marcados como eliminados.');return;}\n        let restored=0;\n        for(const row of hidden){\n          const d=row.payload||{};\n          const kind=row.document_type==='quote'?'cotización':'contrato';\n          const who=d.clientName||'Sin nombre';\n          const when=d.eventDate?(' · '+d.eventDate):'';\n          if(!confirm('Encontré en la nube un '+kind+' marcado como eliminado:\\n\\n'+(d.id||row.document_id)+' · '+who+when+'\\n\\n¿Quieres restaurarlo?'))continue;\n          state.documents=(state.documents||[]).filter(t=>!(t.type===row.document_type&&String(t.id)===String(row.document_id)));\n          setDeletedItems(state);\n          if(row.document_type==='contract'){\n            const items=getContracts(),i=items.findIndex(x=>String(x.id)===String(d.id));\n            if(i>=0)items[i]={...items[i],...d,updatedAt:d.updatedAt||row.updated_at||d.createdAt};else items.unshift({...d,updatedAt:d.updatedAt||row.updated_at||d.createdAt});\n            localStorage.setItem(STORAGE_KEY,JSON.stringify(items));\n          }else if(row.document_type==='quote'){\n            const items=getQuotes(),i=items.findIndex(x=>String(x.id)===String(d.id));\n            if(i>=0)items[i]={...items[i],...d,updatedAt:d.updatedAt||row.updated_at||d.createdAt};else items.unshift({...d,updatedAt:d.updatedAt||row.updated_at||d.createdAt});\n            localStorage.setItem(QUOTES_KEY,JSON.stringify(items));\n          }\n          restored++;\n        }\n        if(restored){\n          syncFolioHistory();renderDashboard();renderSaved();renderQuotes();updateServiceAvailability();\n          queueAllCurrentDocuments(true);await processBackupQueue();\n          localStorage.setItem(CLUB_CLOUD_PENDING_KEY,'1');await backupClubToCloud({allowBeforeBootstrap:true}).catch(()=>{});\n          await writeMasterSnapshotToFolder().catch(()=>{});\n          updateBackupUi();\n          alert('Recuperación terminada. Documentos restaurados: '+restored);\n        }else alert('No se restauró ningún documento.');\n      }catch(err){alert('No se pudo revisar la nube: '+(err?.message||err));}\n    }\n\n    const actions=document.querySelector('#backupCard .backup-actions');\n    if(actions&&!document.getElementById('rescueCloudDeletedDocs')){\n      const b=document.createElement('button');\n      b.type='button';b.id='rescueCloudDeletedDocs';b.className='btn btn-light';b.textContent='Recuperar eliminados de nube';\n      b.addEventListener('click',rescueCloudDeletedDocs);\n      actions.appendChild(b);\n    }\n  }catch(e){console.error('SAFE_SYNC_PATCH',e);}\n})();\n`;

function moveBackupToEnd(html){
  try{
    const startMarker='<section class="card backup-card" id="backupCard">';
    const start=html.indexOf(startMarker);
    if(start<0)return html;
    const close=html.indexOf('</section>',start);
    if(close<0)return html;
    const end=close+'</section>'.length;
    const block=html.slice(start,end);
    let rest=html.slice(0,start)+html.slice(end);
    const homeEnd='\n  </section>\n\n  <section id="newView"';
    const anchor=rest.indexOf(homeEnd);
    if(anchor<0)return html;
    return rest.slice(0,anchor)+'\n    '+block.trim()+'\n'+rest.slice(anchor);
  }catch(e){return html}
}

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

  // En Inicio, el bloque de respaldo se presenta al final de la pantalla.
  if(u.origin===self.location.origin && (e.request.mode==='navigate'||/\/index\.html$/.test(u.pathname)||u.pathname.endsWith('/brinky-suite-pro/'))){
    e.respondWith((async()=>{
      try{
        const r=await fetch(e.request,{cache:'no-store'});
        if(!r.ok)throw new Error('HTTP '+r.status);
        const text=moveBackupToEnd(await r.text());
        const headers=new Headers(r.headers);
        headers.set('content-type','text/html; charset=utf-8');
        const patched=new Response(text,{status:r.status,statusText:r.statusText,headers});
        const c=await caches.open(CACHE);
        await c.put('./index.html',patched.clone());
        return patched;
      }catch(err){
        const cached=(await caches.match('./index.html'))||(await caches.match(e.request));
        if(!cached)throw err;
        const text=moveBackupToEnd(await cached.text());
        const headers=new Headers(cached.headers);
        headers.set('content-type','text/html; charset=utf-8');
        return new Response(text,{status:200,headers});
      }
    })());
    return;
  }

  // app.js se pide siempre sin caché HTTP y se añaden las protecciones de folios y sincronización.
  if(u.origin===self.location.origin && /\/app\.js$/.test(u.pathname)){
    e.respondWith((async()=>{
      try{
        const r=await fetch(e.request,{cache:'no-store'});
        if(!r.ok)throw new Error('HTTP '+r.status);
        const text=await r.text();
        const headers=new Headers(r.headers);
        headers.set('content-type','application/javascript; charset=utf-8');
        const patched=new Response(FOLIO_BOOTSTRAP+text+SAFE_SYNC_PATCH,{status:r.status,statusText:r.statusText,headers});
        const c=await caches.open(CACHE);
        await c.put(e.request,patched.clone());
        return patched;
      }catch(err){
        const cached=await caches.match(e.request)||await caches.match('./app.js?v=2.2.3');
        if(!cached)throw err;
        const text=await cached.text();
        const headers=new Headers(cached.headers);
        headers.set('content-type','application/javascript; charset=utf-8');
        return new Response(FOLIO_BOOTSTRAP+text+SAFE_SYNC_PATCH,{status:200,headers});
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
