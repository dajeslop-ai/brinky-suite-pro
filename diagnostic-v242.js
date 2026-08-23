/* BRINKY FIESTA SUITE · diagnóstico de almacenamiento v2.4.2 */
(()=>{
  if(window.__brinkyDiagnosticLoaded)return; window.__brinkyDiagnosticLoaded=true;
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const looksJson=v=>{try{return JSON.parse(v)}catch{return null}};
  const classify=(k,v)=>{
    const s=(k+' '+v).toLowerCase();
    if(/contract|contrat|renta|folio/.test(s))return 'contrato/folio';
    if(/quote|cotiz/.test(s))return 'cotización';
    if(/loyal|club|socio|member|estrella|brk-/.test(s))return 'club/socio';
    if(/backup|respal|snapshot|cloud|nube|sync/.test(s))return 'respaldo/sincronización';
    return 'otro';
  };
  const btn=document.createElement('button');
  btn.id='brinkyDiagBtn'; btn.textContent='🔎 Diagnóstico';
  Object.assign(btn.style,{position:'fixed',right:'14px',bottom:'76px',zIndex:99999,border:'0',borderRadius:'999px',padding:'12px 16px',fontWeight:'900',fontSize:'14px',background:'#5b21b6',color:'#fff',boxShadow:'0 8px 25px rgba(0,0,0,.22)',cursor:'pointer'});
  document.body.appendChild(btn);
  const backdrop=document.createElement('div');
  backdrop.id='brinkyDiagModal';
  Object.assign(backdrop.style,{display:'none',position:'fixed',inset:'0',zIndex:100000,background:'rgba(10,15,25,.72)',padding:'14px',overflow:'auto'});
  backdrop.innerHTML=`<div style="max-width:720px;margin:20px auto;background:#fff;border-radius:22px;padding:18px;color:#172033;box-shadow:0 25px 80px rgba(0,0,0,.35);font-family:system-ui,sans-serif"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><div><h2 style="margin:0">🔎 Diagnóstico Brinky</h2><div id="brinkyDiagStatus" style="color:#667085;margin-top:4px">Preparando revisión…</div></div><button id="brinkyDiagClose" style="border:0;border-radius:50%;width:40px;height:40px;font-size:20px">×</button></div><div id="brinkyDiagBody" style="margin-top:14px"></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px"><button id="brinkyDiagCopy" style="flex:1;border:0;border-radius:12px;padding:12px;font-weight:900;background:#16a34a;color:#fff">📋 Copiar diagnóstico</button><button id="brinkyDiagRefresh" style="flex:1;border:1px solid #d9d0ff;border-radius:12px;padding:12px;font-weight:900;background:#fff;color:#5b21b6">🔄 Volver a revisar</button></div></div>`;
  document.body.appendChild(backdrop);
  const body=backdrop.querySelector('#brinkyDiagBody'),status=backdrop.querySelector('#brinkyDiagStatus');
  let report='';
  async function scanLocalStorage(){
    const out=[]; let classified={};
    try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);const v=localStorage.getItem(k)||'';const type=classify(k,v);classified[type]=(classified[type]||0)+1;out.push({key:k,bytes:v.length,type,json:!!looksJson(v)});}}catch(e){return {error:String(e),out:[],classified:{}}}
    return {out,classified};
  }
  async function scanSessionStorage(){const out=[];try{for(let i=0;i<sessionStorage.length;i++){const k=sessionStorage.key(i);out.push({key:k,bytes:(sessionStorage.getItem(k)||'').length});}}catch(e){}return out}
  function openDb(name){return new Promise((resolve,reject)=>{let r;try{r=indexedDB.open(name)}catch(e){reject(e);return}r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error||new Error('IndexedDB error'));r.onupgradeneeded=()=>{try{r.transaction.abort()}catch{}}})}
  async function scanIndexedDB(){
    if(!indexedDB.databases)return {supported:false,dbs:[]};
    let infos=[]; try{infos=await indexedDB.databases()}catch(e){return {supported:true,error:String(e),dbs:[]}}
    const dbs=[];
    for(const meta of infos){if(!meta?.name)continue;const d={name:meta.name,version:meta.version,stores:[]};try{const db=await openDb(meta.name);for(const store of Array.from(db.objectStoreNames)){const st={name:store,count:0,samples:[]};try{const tx=db.transaction(store,'readonly');const os=tx.objectStore(store);st.count=await new Promise((res,rej)=>{const q=os.count();q.onsuccess=()=>res(q.result||0);q.onerror=()=>rej(q.error)});await new Promise((resolve)=>{const q=os.openCursor();let n=0;q.onsuccess=()=>{const c=q.result;if(!c||n>=3){resolve();return}let val=c.value;let summary='';try{summary=JSON.stringify(val).slice(0,260)}catch{summary=String(val).slice(0,260)}st.samples.push({key:String(c.key).slice(0,100),value:summary});n++;c.continue()};q.onerror=()=>resolve()});}catch(e){st.error=String(e)}d.stores.push(st)}db.close()}catch(e){d.error=String(e)}dbs.push(d)}
    return {supported:true,dbs};
  }
  async function scanCaches(){const out=[];try{for(const name of await caches.keys()){let count=0;try{const c=await caches.open(name);count=(await c.keys()).length}catch{}out.push({name,count})}}catch(e){}return out}
  function render(x){
    const ls=x.localStorage, idb=x.indexedDB;
    const pills=Object.entries(ls.classified||{}).map(([k,v])=>`<span style="display:inline-block;background:#f1edff;color:#5b21b6;border-radius:999px;padding:5px 9px;margin:3px;font-weight:800">${esc(k)}: ${v}</span>`).join('');
    let idbHtml=''; if(!idb.supported)idbHtml='<p>⚠️ El navegador no expone <code>indexedDB.databases()</code>.</p>'; else if(idb.error)idbHtml='<p>⚠️ '+esc(idb.error)+'</p>'; else if(!idb.dbs.length)idbHtml='<p>❌ No se encontraron bases IndexedDB visibles para esta URL.</p>'; else idbHtml=idb.dbs.map(d=>`<details open style="border:1px solid #e5e7eb;border-radius:14px;padding:10px;margin:8px 0"><summary><b>🗄️ ${esc(d.name)}</b> · v${esc(d.version||'?')}</summary>${d.error?`<p>⚠️ ${esc(d.error)}</p>`:d.stores.map(s=>`<div style="margin:8px 0;padding:9px;background:#f8fafc;border-radius:10px"><b>${esc(s.name)}</b> · ${s.count} registros${s.error?' · ⚠️ '+esc(s.error):''}${s.samples?.length?`<div style="font-size:12px;color:#667085;margin-top:5px">${s.samples.map(a=>`clave: <code>${esc(a.key)}</code> · ${esc(a.value)}`).join('<br>')}</div>`:''}</div>`).join('')}</details>`).join('');
    const lsRows=ls.out.slice(0,80).map(a=>`<tr><td style="padding:5px;border-bottom:1px solid #eee"><code>${esc(a.key)}</code></td><td style="padding:5px;border-bottom:1px solid #eee">${esc(a.type)}</td><td style="padding:5px;border-bottom:1px solid #eee">${a.bytes}</td></tr>`).join('');
    const cacheHtml=x.caches.length?x.caches.map(c=>`<span style="display:inline-block;background:#eef7ff;color:#175cd3;border-radius:999px;padding:5px 9px;margin:3px;font-weight:800">${esc(c.name)} · ${c.count} recursos</span>`).join(''):'Ninguna';
    body.innerHTML=`<div style="background:#ecfdf3;border:1px solid #a7f3d0;border-radius:14px;padding:12px"><b>Origen:</b> ${esc(location.origin)}<br><b>URL:</b> ${esc(location.href)}<br><b>Service Worker:</b> ${navigator.serviceWorker?.controller?'activo':'no controlando esta página'}</div><h3>📦 localStorage · ${ls.out.length} claves</h3><div>${pills||'Sin claves'}</div><details style="margin-top:8px"><summary>Ver claves detectadas</summary><div style="max-height:240px;overflow:auto"><table style="width:100%;font-size:12px"><tr><th align="left">Clave</th><th align="left">Tipo</th><th align="left">Bytes</th></tr>${lsRows}</table></div></details><h3>🗄️ IndexedDB</h3>${idbHtml}<h3>🧊 Cachés PWA</h3><div>${cacheHtml}</div><h3>🧾 sessionStorage · ${x.session.length} claves</h3><h3>📊 Resumen de posibles datos</h3><p><b>Contratos/folios:</b> ${ls.classified['contrato/folio']||0} claves localStorage · revisa los almacenes IndexedDB arriba.</p><p><b>Club/socios:</b> ${ls.classified['club/socio']||0} claves localStorage.</p><p><b>Respaldo/nube:</b> ${ls.classified['respaldo/sincronización']||0} claves localStorage.</p>`;
    report=JSON.stringify(x,null,2);
    status.textContent='Revisión terminada · '+new Date().toLocaleTimeString();
  }
  async function run(){status.textContent='Escaneando almacenamiento…';body.innerHTML='<p>⏳ Revisando localStorage, IndexedDB y cachés. No se modifica ningún dato.</p>';const x={localStorage:await scanLocalStorage(),session:await scanSessionStorage(),indexedDB:await scanIndexedDB(),caches:await scanCaches(),time:new Date().toISOString()};render(x)}
  btn.onclick=()=>{backdrop.style.display='block';run()}; backdrop.querySelector('#brinkyDiagClose').onclick=()=>backdrop.style.display='none'; backdrop.querySelector('#brinkyDiagRefresh').onclick=run; backdrop.querySelector('#brinkyDiagCopy').onclick=async()=>{try{await navigator.clipboard.writeText(report);alert('Diagnóstico copiado.')}catch{prompt('Copia este diagnóstico:',report)}};
})();
