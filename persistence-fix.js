/* BRINKY FIESTA SUITE · Persistent local mirror / startup recovery v2.3.0 */
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
  let timer=0,writing=false;
  function openDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE)};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
  async function readMirror(){try{const db=await openDb();return await new Promise((resolve,reject)=>{const t=db.transaction(STORE,'readonly'),r=t.objectStore(STORE).get(SNAP);r.onsuccess=()=>{db.close();resolve(r.result||null)};r.onerror=()=>{db.close();reject(r.error)}})}catch{return null}}
  async function writeMirror(){if(writing)return;writing=true;try{const payload={savedAt:new Date().toISOString(),keys:{}};for(const k of KEYS){const v=localStorage.getItem(k);if(v!==null)payload.keys[k]=v}if(!Object.keys(payload.keys).length)return;const db=await openDb();await new Promise((resolve,reject)=>{const t=db.transaction(STORE,'readwrite');t.objectStore(STORE).put(payload,SNAP);t.oncomplete=resolve;t.onerror=()=>reject(t.error)});db.close()}catch{}finally{writing=false}}
  function hasData(){try{return ['brinky_contracts_only_v1','brinky_quotes_v1','brinky_loyalty_v2','brinky_expenses_v1'].some(k=>{const v=JSON.parse(localStorage.getItem(k)||'[]');return Array.isArray(v)&&v.length>0})}catch{return false}}
  function restoreMirror(m){if(!m?.keys)return false;let changed=false;for(const [k,v] of Object.entries(m.keys)){if(localStorage.getItem(k)===null&&v!==null){localStorage.setItem(k,v);changed=true}}return changed}
  function refreshUi(){try{window.renderDashboard?.();window.renderSaved?.();window.renderQuotes?.();window.renderLoyalty?.();window.updateServiceAvailability?.();if(document.getElementById('reportMonth'))window.renderReports?.();window.updateBackupUi?.()}catch{}}
  async function boot(){const mirror=await readMirror();if(!hasData()&&mirror?.keys){restoreMirror(mirror);refreshUi()}await new Promise(r=>setTimeout(r,900));try{if(typeof window.synchronizeCloudFirst==='function'&&typeof window.cloudIsConnected==='function'&&window.cloudIsConnected()){await window.synchronizeCloudFirst({showAlert:false});refreshUi()}}catch{}await writeMirror();clearInterval(timer);timer=setInterval(writeMirror,5000)}
  const originalSet=Storage.prototype.setItem;
  Storage.prototype.setItem=function(k,v){const r=originalSet.call(this,k,v);if(this===localStorage&&KEYS.includes(k)){clearTimeout(window.__brinkyPersistTimer);window.__brinkyPersistTimer=setTimeout(writeMirror,250)}return r};
  window.addEventListener('pagehide',()=>{writeMirror()});
  window.addEventListener('beforeunload',()=>{writeMirror()});
  window.addEventListener('online',()=>setTimeout(()=>{if(window.cloudIsConnected?.())window.synchronizeCloudFirst?.({showAlert:false}).catch(()=>{});writeMirror()},500));
  boot();
})();
/* deployment trigger */
