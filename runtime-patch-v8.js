(function(){
  if(window.__BRINKY_LOCAL_FIRST_V9__) return;
  window.__BRINKY_LOCAL_FIRST_V9__=true;
  const DB='brinky_fiesta_local_vault_v2',STATE='state',AUTH='auth';
  let timer=null,authTimer=null,restoring=false,authRestoring=false;
  function openDb(){return new Promise((resolve,reject)=>{try{const r=indexedDB.open(DB,2);r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains(STATE))db.createObjectStore(STATE);if(!db.objectStoreNames.contains(AUTH))db.createObjectStore(AUTH)};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)}catch(e){reject(e)}})}
  async function put(store,key,value){const db=await openDb();await new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value,key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close()}
  async function get(store,key){const db=await openDb();const value=await new Promise((resolve,reject)=>{const tx=db.transaction(store,'readonly'),r=tx.objectStore(store).get(key);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error)});db.close();return value}
  async function del(store,key){try{const db=await openDb();await new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).delete(key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close()}catch(e){console.warn('BRINKY sesión local delete',e)}}
  async function save(){if(restoring||typeof fullSnapshot!=='function')return;try{await put(STATE,'current',{savedAt:new Date().toISOString(),data:fullSnapshot()});const session=typeof getCloudSession==='function'?getCloudSession():null;if(session?.refresh_token)await put(AUTH,'session',{savedAt:new Date().toISOString(),data:session})}catch(e){console.warn('BRINKY bóveda local',e)}}
  async function saveAuth(){if(authRestoring)return;try{const session=typeof getCloudSession==='function'?getCloudSession():null;if(session?.refresh_token)await put(AUTH,'session',{savedAt:new Date().toISOString(),data:session});else await del(AUTH,'session')}catch(e){console.warn('BRINKY sesión local',e)}}
  function schedule(){clearTimeout(timer);timer=setTimeout(save,350)}
  function scheduleAuth(){clearTimeout(authTimer);authTimer=setTimeout(saveAuth,250)}
  async function restore(){
    try{
      if(typeof meaningfulLocalData==='function'&&typeof applyFullSnapshot==='function'){
        const snap=await get(STATE,'current');
        if(snap?.data&&!meaningfulLocalData()){
          restoring=true;applyFullSnapshot(snap.data,{preferImportedSettings:true});restoring=false;
          renderDashboard?.();renderSaved?.();renderQuotes?.();renderLoyalty?.();updateServiceAvailability?.();updateBackupUi?.();
        }
      }
      if(typeof getCloudSession==='function'&&typeof setCloudSession==='function'){
        const current=getCloudSession(),saved=await get(AUTH,'session');
        if(!current?.refresh_token&&saved?.data?.refresh_token){
          authRestoring=true;setCloudSession(saved.data);authRestoring=false;updateBackupUi?.();
          setTimeout(()=>{try{if(typeof cloudIsConnected==='function'&&cloudIsConnected()&&typeof synchronizeCloudFirst==='function')synchronizeCloudFirst({showAlert:false}).catch(()=>{})}catch{}},250);
        }
      }
    }catch(e){restoring=false;authRestoring=false;console.warn('BRINKY recuperación local',e)}
  }
  const originalSet=Storage.prototype.setItem;
  Storage.prototype.setItem=function(k,v){originalSet.call(this,k,v);if(this===localStorage){if(String(k)==='brinky_cloud_backup_session_v1')scheduleAuth();else if(!String(k).includes('local_vault'))schedule()}};
  const originalRemove=Storage.prototype.removeItem;
  Storage.prototype.removeItem=function(k){originalRemove.call(this,k);if(this===localStorage&&String(k)==='brinky_cloud_backup_session_v1')scheduleAuth()};
  window.addEventListener('online',()=>{schedule();try{if(typeof cloudIsConnected==='function'&&typeof synchronizeCloudFirst==='function')synchronizeCloudFirst({showAlert:false}).catch(()=>{})}catch{}});
  window.addEventListener('pagehide',()=>{save();saveAuth()});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){save();saveAuth()}});
  setTimeout(restore,180);setTimeout(save,1200);setTimeout(saveAuth,1500);
  setInterval(()=>{if(document.visibilityState==='visible'){schedule();scheduleAuth()}},15000);
})();
