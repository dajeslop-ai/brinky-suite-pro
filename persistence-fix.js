/* BRINKY FIESTA SUITE · Persistent local mirror / startup recovery v2.3.1 */
(()=>{
  'use strict';
  const DB_NAME='brinky_fiesta_suite_persistence_v230';
  const STORE='snapshots';
  const SNAP='latest';
  const KEYS=[
    'brinky_contracts_only_v1','brinky_quotes_v1','brinky_folio_state_v1',
    'brinky_loyalty_v2','brinky_loyalty_settings_v2','brinky_loyalty_folio_v2',
    'brinky_expenses_v1','brinky_whatsapp_messages_v1','brinky_club_message_templates_v2',
    'brinky_deleted_items_v222','brinky_cloud_backup_config_v1','brinky_cloud_backup_session_v1',
    'brinky_cloud_sync_meta_v222','brinky_club_cloud_pending_v2','brinky_contracts_capture_preferences_v1'
  ];
  const ARRAY_KEYS=new Set(['brinky_contracts_only_v1','brinky_quotes_v1','brinky_loyalty_v2','brinky_expenses_v1']);
  let timer=0,writing=false;
  function openDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE)};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
  async function readMirror(){try{const db=await openDb();return await new Promise((resolve,reject)=>{const t=db.transaction(STORE,'readonly'),r=t.objectStore(STORE).get(SNAP);r.onsuccess=()=>{db.close();resolve(r.result||null)};r.onerror=()=>{db.close();reject(r.error)}})}catch{return null}}
  async function writeMirror(){if(writing)return;writing=true;try{const payload={savedAt:new Date().toISOString(),keys:{}};for(const k of KEYS){const v=localStorage.getItem(k);if(v!==null)payload.keys[k]=v}if(!Object.keys(payload.keys).length)return;const db=await openDb();await new Promise((resolve,reject)=>{const t=db.transaction(STORE,'readwrite');t.objectStore(STORE).put(payload,SNAP);t.oncomplete=resolve;t.onerror=()=>reject(t.error)});db.close()}catch{}finally{writing=false}}
  function stamp(v){return Date.parse(v?.updatedAt||v?.createdAt||'')||0}
  function mergeArray(localRaw,mirrorRaw,key){
    let local=[],remote=[];try{local=JSON.parse(localRaw||'[]');if(!Array.isArray(local))local=[]}catch{}try{remote=JSON.parse(mirrorRaw||'[]');if(!Array.isArray(remote))remote=[]}catch{}
    if(!remote.length)return local;
    const out=[...local],index=new Map();
    const identity=x=>String(x?.id||x?.code||x?.phone||'');
    out.forEach((x,i)=>{const id=identity(x);if(id)index.set(id,i)});
    for(const r of remote){const id=identity(r);if(!id){out.push(r);continue}const i=index.get(id);if(i===undefined){index.set(id,out.length);out.push(r);continue}if(stamp(r)>stamp(out[i]))out[i]=r}
    return out;
  }
  function mergeObject(key,localRaw,mirrorRaw){
    if(mirrorRaw===null||mirrorRaw===undefined)return localRaw;
    if(localRaw===null||localRaw===undefined)return mirrorRaw;
    if(key==='brinky_folio_state_v1'){
      try{const a=JSON.parse(localRaw||'{}'),b=JSON.parse(mirrorRaw||'{}');for(const type of ['contracts','quotes']){a[type]=a[type]||{};for(const [y,n] of Object.entries(b[type]||{}))a[type][y]=Math.max(Number(a[type][y]||0),Number(n||0))}return JSON.stringify(a)}catch{return localRaw}
    }
    if(key==='brinky_deleted_items_v222'){
      try{const a=JSON.parse(localRaw||'{}'),b=JSON.parse(mirrorRaw||'{}');for(const type of ['documents','members','expenses']){const arr=[...(a[type]||[])];const seen=new Set(arr.map(x=>JSON.stringify(x)));for(const x of (b[type]||[])){const s=JSON.stringify(x);if(!seen.has(s)){arr.push(x);seen.add(s)}}a[type]=arr}return JSON.stringify(a)}catch{return localRaw}
    }
    return localRaw;
  }
  function restoreMirror(m){
    if(!m?.keys)return false;let changed=false;
    for(const k of KEYS){const remote=m.keys[k];if(remote===undefined||remote===null)continue;const local=localStorage.getItem(k);
      if(ARRAY_KEYS.has(k)){const merged=mergeArray(local,remote,k),raw=JSON.stringify(merged);if(raw!==local){localStorage.setItem(k,raw);changed=true}continue}
      const merged=mergeObject(k,local,remote);
      if(local===null){localStorage.setItem(k,remote);changed=true}else if(merged!==local){localStorage.setItem(k,merged);changed=true}
    }
    return changed;
  }
  function refreshUi(){try{window.renderDashboard?.();window.renderSaved?.();window.renderQuotes?.();window.renderLoyalty?.();window.updateServiceAvailability?.();if(document.getElementById('reportMonth'))window.renderReports?.();window.updateBackupUi?.()}catch{}}
  async function boot(){
    const mirror=await readMirror();
    if(mirror?.keys){if(restoreMirror(mirror))refreshUi()}
    await new Promise(r=>setTimeout(r,900));
    try{if(typeof window.synchronizeCloudFirst==='function'&&typeof window.cloudIsConnected==='function'&&window.cloudIsConnected()){await window.synchronizeCloudFirst({showAlert:false});refreshUi()}}catch{}
    await writeMirror();clearInterval(timer);timer=setInterval(writeMirror,5000);
  }
  const originalSet=Storage.prototype.setItem;
  Storage.prototype.setItem=function(k,v){const r=originalSet.call(this,k,v);if(this===localStorage&&KEYS.includes(k)){clearTimeout(window.__brinkyPersistTimer);window.__brinkyPersistTimer=setTimeout(writeMirror,250)}return r};
  window.addEventListener('pagehide',()=>{writeMirror()});
  window.addEventListener('beforeunload',()=>{writeMirror()});
  window.addEventListener('online',()=>setTimeout(()=>{if(window.cloudIsConnected?.())window.synchronizeCloudFirst?.({showAlert:false}).catch(()=>{});writeMirror()},500));
  boot();
})();
/* deployment trigger v2.3.1 */
