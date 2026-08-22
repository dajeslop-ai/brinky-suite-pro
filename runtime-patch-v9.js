// BRINKY FIESTA SUITE v2.2.5 · PC session persistence + automatic background sync
(function(){
  if(window.__BRINKY_SESSION_V9__) return;
  window.__BRINKY_SESSION_V9__=true;
  const DB='brinky_fiesta_suite_auth_v1', STORE='session', KEY='current', LS='brinky_cloud_backup_session_v1';
  function openDb(){return new Promise((resolve,reject)=>{try{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{try{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE)}catch{}};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error||new Error('IndexedDB error'))}catch(e){reject(e)}})}
  async function readVault(){try{const db=await openDb();const v=await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),r=tx.objectStore(STORE).get(KEY);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error)});db.close();return v}catch{return null}}
  async function writeVault(v){try{const db=await openDb();await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(v,KEY);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close()}catch{}}
  async function clearVault(){try{const db=await openDb();await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(KEY);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close()}catch{}}
  function readSession(){try{return JSON.parse(localStorage.getItem(LS)||'null')}catch{return null}}
  function writeSession(v){try{localStorage.setItem(LS,JSON.stringify(v))}catch{}}
  let lastSession='';
  async function persistCurrentSession(){const s=readSession();if(s?.access_token){const sig=String(s.access_token)+'|'+String(s.refresh_token||'');if(sig!==lastSession){lastSession=sig;await writeVault(s)}}else if(lastSession){lastSession='';await clearVault()}}
  async function restoreSession(){const current=readSession();if(current?.access_token){lastSession=String(current.access_token)+'|'+String(current.refresh_token||'');return current}const saved=await readVault();if(saved?.access_token){writeSession(saved);lastSession=String(saved.access_token)+'|'+String(saved.refresh_token||'');return saved}return null}
  async function backgroundSync(){try{if(!navigator.onLine)return;const s=await restoreSession();if(!s)return; if(typeof window.synchronizeCloudFirst==='function'){await window.synchronizeCloudFirst({showAlert:false})}else if(typeof window.processBackupQueue==='function'){await window.processBackupQueue()}}catch{}}
  (async()=>{
    await restoreSession();
    await persistCurrentSession();
    setTimeout(backgroundSync,800);
    setTimeout(backgroundSync,3000);
  })();
  setInterval(async()=>{await persistCurrentSession();if(navigator.onLine)await backgroundSync()},15000);
  window.addEventListener('online',()=>setTimeout(backgroundSync,500));
})();
