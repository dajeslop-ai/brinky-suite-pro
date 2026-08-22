(function(){
  // ============================================================
  // BRINKY LOCAL-FIRST PERSISTENCE v2.2.5
  // Data and Supabase refresh session survive closing the app and
  // restarting Windows. Supabase is a background sync layer.
  // ============================================================
  if(!window.__BRINKY_LOCAL_FIRST_V9__){
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
    async function restore(){try{
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
    }catch(e){restoring=false;authRestoring=false;console.warn('BRINKY recuperación local',e)}}
    const originalSet=Storage.prototype.setItem;
    Storage.prototype.setItem=function(k,v){originalSet.call(this,k,v);if(this===localStorage){if(String(k)==='brinky_cloud_backup_session_v1')scheduleAuth();else if(!String(k).includes('local_vault'))schedule()}};
    const originalRemove=Storage.prototype.removeItem;
    Storage.prototype.removeItem=function(k){originalRemove.call(this,k);if(this===localStorage&&String(k)==='brinky_cloud_backup_session_v1')scheduleAuth()};
    window.addEventListener('online',()=>{schedule();try{if(typeof cloudIsConnected==='function'&&typeof synchronizeCloudFirst==='function')synchronizeCloudFirst({showAlert:false}).catch(()=>{})}catch{}});
    window.addEventListener('pagehide',()=>{save();saveAuth()});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){save();saveAuth()}});
    setTimeout(restore,180);setTimeout(save,1200);setTimeout(saveAuth,1500);
    setInterval(()=>{if(document.visibilityState==='visible'){schedule();scheduleAuth()}},15000);
  }

  // ============================================================
  // CLUB BRINKY PREMIUM CARD v1
  // ============================================================
  if(window.__BRINKY_CARD_PREMIUM_V1__) return;
  window.__BRINKY_CARD_PREMIUM_V1__=true;
  window.makeLoyaltyCardBlob=function(c){
    return (async function(){
      const W=1080,H=1350,cv=document.createElement('canvas');cv.width=W;cv.height=H;const g=cv.getContext('2d');
      const s=getLoyaltySettings(),stars=Math.max(0,Number(c.stamps||0)),meta=Math.max(1,Number(s.r2||8));
      const round=(x,y,w,h,r)=>{g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath()};
      const grad=g.createLinearGradient(0,0,W,H);grad.addColorStop(0,'#08a34a');grad.addColorStop(.58,'#087b3b');grad.addColorStop(1,'#064f2a');g.fillStyle=grad;g.fillRect(0,0,W,H);
      g.fillStyle='rgba(255,255,255,.10)';g.beginPath();g.arc(80,90,150,0,Math.PI*2);g.fill();g.fillStyle='rgba(255,216,77,.13)';g.beginPath();g.arc(1000,80,180,0,Math.PI*2);g.fill();
      g.fillStyle='#fff';g.textAlign='left';g.font='900 62px Arial';g.fillText('CLUB BRINKY',70,100);g.font='700 25px Arial';g.fillStyle='#dfffe9';g.fillText('MEMBRESÍA · BRINKY FIESTA',72,140);
      try{const img=new Image();img.src=BRINKY_ICON_DATA_URL;await img.decode();round(70,180,180,180,32);g.fillStyle='#fff';g.fill();g.drawImage(img,80,190,160,160)}catch{}
      g.fillStyle='#fff';g.font='900 48px Arial';g.fillText(String(c.name||'SOCIO').toUpperCase().slice(0,25),290,245);g.font='900 32px Arial';g.fillStyle='#dfffe9';g.fillText(c.code||'BRK-0000',290,292);g.font='700 24px Arial';g.fillStyle='rgba(255,255,255,.85)';g.fillText(c.phone||'',290,332);
      round(55,385,970,300,28);g.fillStyle='rgba(255,255,255,.14)';g.fill();
      g.textAlign='center';g.fillStyle='#fff';g.font='900 39px Arial';g.fillText(`${stars} de ${meta} Estrellas Brinky`,W/2,455);
      g.font='48px Arial';g.fillStyle='#ffd43b';const on='★'.repeat(Math.min(stars,meta)),off='☆'.repeat(Math.max(0,meta-stars));g.fillText(on+off,W/2,520);
      g.font='800 23px Arial';g.fillStyle='#fff';g.fillText(`${s.r1} ⭐ = ${s.n1}`,W/2,590);g.fillText(`${s.r2} ⭐ = ${s.n2}`,W/2,632);
      round(55,720,455,455,28);g.fillStyle='#fff';g.fill();
      let qrOk=false;try{const r=await fetch(qrUrl(c,700));if(r.ok){const blob=await r.blob(),bmp=await createImageBitmap(blob);g.drawImage(bmp,85,750,395,395);qrOk=true}}catch{}
      if(!qrOk){g.fillStyle='#f3f4f6';g.fillRect(85,750,395,395);g.fillStyle='#344054';g.font='900 28px Arial';g.fillText('QR disponible',282,925);g.fillText('con Internet',282,965);}
      g.fillStyle='#667085';g.font='800 20px Arial';g.fillText('ESCANEA · '+(c.code||''),282,1205);
      round(535,720,490,455,28);g.fillStyle='#fff7d6';g.fill();g.textAlign='left';g.fillStyle='#08752f';g.font='900 30px Arial';g.fillText('TU BENEFICIO',575,785);g.fillStyle='#172033';g.font='900 34px Arial';g.fillText('Comparte tu código',575,850);g.font='900 34px Arial';g.fillText(c.code||'',575,900);g.fillStyle='#08752f';g.font='800 24px Arial';g.fillText('Ambos ganan 1 Estrella',575,955);g.fillText('al completar una renta.',575,990);g.fillStyle='#475467';g.font='700 22px Arial';g.fillText('¡Gracias por elegir Brinky Fiesta!',575,1060);g.font='800 21px Arial';g.fillText(COMPANY.whatsapp,575,1100);
      return await new Promise((resolve,reject)=>cv.toBlob(b=>b?resolve(b):reject(new Error('No se pudo crear la tarjeta.')),'image/png'));
    })();
  };
})();
