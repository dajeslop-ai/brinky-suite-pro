(function(){
  if(window.__BRINKY_LOCAL_FIRST_V8__) return;
  window.__BRINKY_LOCAL_FIRST_V8__=true;
  const DB='brinky_fiesta_local_vault_v1', STORE='state';
  let timer=null, restoring=false;
  function openDb(){return new Promise((resolve,reject)=>{try{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{try{r.result.createObjectStore(STORE)}catch{}};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)}catch(e){reject(e)}})}
  async function save(){if(restoring||typeof fullSnapshot!=='function')return;try{const db=await openDb();const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put({savedAt:new Date().toISOString(),data:fullSnapshot()},'current');await new Promise((res,rej)=>{tx.oncomplete=res;tx.onerror=()=>rej(tx.error)});db.close()}catch(e){console.warn('BRINKY bóveda local',e)}}
  function schedule(){clearTimeout(timer);timer=setTimeout(save,350)}
  async function restore(){if(typeof meaningfulLocalData!=='function'||typeof applyFullSnapshot!=='function')return;try{const db=await openDb();const snap=await new Promise((res,rej)=>{const tx=db.transaction(STORE,'readonly'),r=tx.objectStore(STORE).get('current');r.onsuccess=()=>res(r.result||null);r.onerror=()=>rej(r.error)});db.close();if(!snap?.data||meaningfulLocalData())return;restoring=true;applyFullSnapshot(snap.data,{preferImportedSettings:true});restoring=false;renderDashboard?.();renderSaved?.();renderQuotes?.();renderLoyalty?.();updateServiceAvailability?.();updateBackupUi?.();}catch(e){restoring=false;console.warn('BRINKY recuperación local',e)}}
  const originalSet=Storage.prototype.setItem;
  Storage.prototype.setItem=function(k,v){originalSet.call(this,k,v);if(this===localStorage && !String(k).includes('local_vault'))schedule()};
  window.addEventListener('online',schedule);
  window.addEventListener('pagehide',schedule);
  setTimeout(()=>restore(),150);
  setTimeout(()=>save(),1200);
  setInterval(()=>{if(document.visibilityState==='visible')schedule()},15000);
})();
