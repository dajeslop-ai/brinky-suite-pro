function getContractPromoDefaults(){
  return {
    enabled:true,
    showImage:true,
    title:'¿Disfrutaste nuestro servicio?',
    text:'Tu recomendación nos ayuda a que más familias conozcan Brinky Fiesta. Visita nuestra página Brincolines Brinky Fiesta para conocer promociones, nuevos servicios y novedades.',
    buttonText:'Abrir nuestra página de Facebook',
    url:'https://www.facebook.com/profile.php?id=61578868178582',
    image:''
  };
}

function getContractPromoSettings(){
  try{return Object.assign({},getContractPromoDefaults(),JSON.parse(localStorage.getItem('brinky_contract_promo_v1')||'{}'));}
  catch(e){return getContractPromoDefaults();}
}

function setContractPromoSettings(value,opts){
  opts=opts||{};
  const next=Object.assign({},getContractPromoDefaults(),value||{});
  try{localStorage.setItem('brinky_contract_promo_v1',JSON.stringify(next));}
  catch(e){throw new Error('No se pudo guardar la imagen. Prueba con una imagen más pequeña.');}
  if(opts.sync!==false){
    try{localStorage.setItem(CLUB_CLOUD_PENDING_KEY,'1');}catch(e){}
    try{scheduleClubCloudBackup(250);}catch(e){}
    try{scheduleMasterSnapshot(350);}catch(e){}
  }
  return next;
}

function contractPromoPreviewHtml(){
  const p=getContractPromoSettings();
  if(!p.enabled)return '';
  const src=p.image||'assets/facebook-banner.jpg';
  const img=p.showImage!==false?'<img src="'+escapeHtml(src)+'" alt="Publicidad Brinky Fiesta">':'';
  return '<section class="facebook-cta">'+img+'<div class="facebook-cta-copy"><h3>'+escapeHtml(p.title)+'</h3><p>'+escapeHtml(p.text)+'</p><a href="'+escapeHtml(p.url)+'" target="_blank" rel="noopener">'+escapeHtml(p.buttonText)+'</a></div></section>';
}

;(()=>{
  if(window.__BRINKY_FIX6__)return;
  window.__BRINKY_FIX6__=true;

  // Recuperación segura de documentos: una marca de borrado antigua no oculta
  // un documento que fue guardado nuevamente después de esa eliminación.
  try{
    const clearDocTombstone=(type,id)=>{
      if(!id)return;
      const d=getDeletedItems();
      const before=(d.documents||[]).length;
      d.documents=(d.documents||[]).filter(x=>!(x.type===type&&String(x.id)===String(id)));
      if(d.documents.length!==before)setDeletedItems(d);
    };

    mergeDocuments=function(localItems,remoteEntries,type){
      const state=getDeletedItems();
      const tombs=(state.documents||[]).filter(x=>x.type===type);
      const tmap=new Map(tombs.map(x=>[String(x.id),x]));
      const revived=new Set();
      const live=(doc,fallback)=>{
        if(!doc||!doc.id)return false;
        const t=tmap.get(String(doc.id));
        if(!t)return true;
        const docTs=timeMs(doc.updatedAt||doc.createdAt||fallback||'');
        const delTs=timeMs(t.deletedAt);
        if(docTs>delTs+1000){revived.add(String(doc.id));return true;}
        return false;
      };
      const out=(localItems||[]).filter(x=>live(x));
      const idx=new Map(out.map((x,i)=>[String(x.id),i]));
      let added=0,updated=0;
      for(const entry of remoteEntries||[]){
        const r=entry&&entry.payload?entry.payload:entry;
        if(!r||!r.id||!live(r,entry&&entry.updated_at))continue;
        const k=String(r.id),i=idx.get(k);
        if(i===undefined){
          out.push(Object.assign({},r,{updatedAt:r.updatedAt||(entry&&entry.updated_at)||r.createdAt}));
          idx.set(k,out.length-1);added++;continue;
        }
        const l=out[i],rt=documentStamp(r,entry&&entry.updated_at),lt=documentStamp(l);
        if(rt>lt+1000){out[i]=Object.assign({},r,{updatedAt:r.updatedAt||(entry&&entry.updated_at)||r.createdAt});updated++;}
      }
      if(revived.size){
        state.documents=(state.documents||[]).filter(x=>!(x.type===type&&revived.has(String(x.id))));
        setDeletedItems(state);
      }
      return{items:out,added,updated};
    };

    const originalSaveContract=saveContract;
    saveContract=function(data){clearDocTombstone('contract',data&&data.id);return originalSaveContract(data);};
    const originalSaveQuote=saveQuote;
    saveQuote=function(data){clearDocTombstone('quote',data&&data.id);return originalSaveQuote(data);};

    const originalApplyFullSnapshot=applyFullSnapshot;
    applyFullSnapshot=function(snap,opts){
      try{
        for(const c of (snap&&snap.contracts)||[])clearDocTombstone('contract',c&&c.id);
        for(const q of (snap&&snap.quotes)||[])clearDocTombstone('quote',q&&q.id);
      }catch(e){}
      const result=originalApplyFullSnapshot(snap,opts||{});
      if(snap&&snap.contractPromoSettings){try{setContractPromoSettings(snap.contractPromoSettings,{sync:false});}catch(e){}}
      return result;
    };

    async function rescueCloudDeletedDocs(){
      if(!cloudIsConnected()){alert('Conecta primero Supabase.');return;}
      try{
        const r=await cloudFetch('/rest/v1/brinky_document_backups?select=document_id,document_type,payload,updated_at&order=updated_at.asc');
        const rows=await r.json();
        let state=getDeletedItems();
        const hidden=(rows||[]).filter(row=>(state.documents||[]).some(t=>t.type===row.document_type&&String(t.id)===String(row.document_id)));
        if(!hidden.length){alert('No encontré documentos de la nube marcados como eliminados.');return;}
        let restored=0;
        for(const row of hidden){
          const d=row.payload||{};
          const kind=row.document_type==='quote'?'cotización':'contrato';
          const who=d.clientName||'Sin nombre';
          const when=d.eventDate?(' · '+d.eventDate):'';
          if(!confirm('Encontré en la nube un '+kind+' marcado como eliminado:\n\n'+(d.id||row.document_id)+' · '+who+when+'\n\n¿Quieres restaurarlo?'))continue;
          state.documents=(state.documents||[]).filter(t=>!(t.type===row.document_type&&String(t.id)===String(row.document_id)));
          setDeletedItems(state);
          if(row.document_type==='contract'){
            const items=getContracts(),i=items.findIndex(x=>String(x.id)===String(d.id));
            if(i>=0)items[i]=Object.assign({},items[i],d,{updatedAt:d.updatedAt||row.updated_at||d.createdAt});
            else items.unshift(Object.assign({},d,{updatedAt:d.updatedAt||row.updated_at||d.createdAt}));
            localStorage.setItem(STORAGE_KEY,JSON.stringify(items));
          }else{
            const items=getQuotes(),i=items.findIndex(x=>String(x.id)===String(d.id));
            if(i>=0)items[i]=Object.assign({},items[i],d,{updatedAt:d.updatedAt||row.updated_at||d.createdAt});
            else items.unshift(Object.assign({},d,{updatedAt:d.updatedAt||row.updated_at||d.createdAt}));
            localStorage.setItem(QUOTES_KEY,JSON.stringify(items));
          }
          restored++;
        }
        if(restored){
          syncFolioHistory();renderDashboard();renderSaved();renderQuotes();updateServiceAvailability();
          queueAllCurrentDocuments(true);await processBackupQueue();
          localStorage.setItem(CLUB_CLOUD_PENDING_KEY,'1');await backupClubToCloud({allowBeforeBootstrap:true}).catch(()=>{});
          await writeMasterSnapshotToFolder().catch(()=>{});updateBackupUi();
          alert('Recuperación terminada. Documentos restaurados: '+restored);
        }else alert('No se restauró ningún documento.');
      }catch(err){alert('No se pudo revisar la nube: '+((err&&err.message)||err));}
    }
    window.__rescueCloudDeletedDocs=rescueCloudDeletedDocs;
  }catch(e){console.error('BRINKY SAFE SYNC',e);}

  // Vista previa HTML del contrato.
  try{
    const originalRenderPreview=renderPreview;
    renderPreview=function(d){
      const result=originalRenderPreview(d);
      try{
        const section=document.querySelector('#previewModal .facebook-cta');
        const p=getContractPromoSettings();
        if(section){
          section.style.display=p.enabled?'':'none';
          const img=section.querySelector('img');
          if(img){img.src=p.image||'assets/facebook-banner.jpg';img.style.display=p.showImage!==false?'':'none';}
          const h=section.querySelector('h3');if(h)h.textContent=p.title;
          const copy=section.querySelector('p');if(copy)copy.textContent=p.text;
          const a=section.querySelector('a');if(a){a.textContent=p.buttonText;a.href=p.url;}
        }
      }catch(e){}
      return result;
    };
  }catch(e){console.error('BRINKY PREVIEW PATCH',e);}

  function promoEditorStyle(){
    if(document.getElementById('contractPromoEditorStyle'))return;
    const style=document.createElement('style');
    style.id='contractPromoEditorStyle';
    style.textContent='.contract-promo-settings{margin-top:18px}.promo-switch{display:flex;align-items:center;gap:10px;font-weight:900;margin:12px 0 18px}.promo-switch input{width:22px;height:22px}.promo-editor-text{min-height:120px;resize:vertical}.promo-image-preview{display:grid;grid-template-columns:minmax(220px,42%) 1fr;gap:18px;align-items:center;border:1px solid #dfe5ea;border-radius:16px;padding:14px;background:#f5fff8;margin-top:12px}.promo-image-preview img{width:100%;max-height:190px;object-fit:cover;border-radius:12px}.promo-image-copy h3{color:#08752f;margin:0 0 8px}.promo-image-copy p{color:#465467;line-height:1.5}.promo-image-copy a{display:inline-block;background:#1877f2;color:#fff;padding:10px 14px;border-radius:10px;font-weight:900;text-decoration:none}.promo-editor-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}.promo-editor-actions .btn{min-width:180px}@media(max-width:720px){.promo-image-preview{grid-template-columns:1fr}.promo-editor-actions .btn{width:100%;min-width:0}}';
    document.head.appendChild(style);
  }

  function updatePromoEditorPreview(){
    const box=document.getElementById('contractPromoLivePreview');if(!box)return;
    const enabled=document.getElementById('contractPromoEnabled');
    const showImage=document.getElementById('contractPromoShowImage');
    const title=document.getElementById('contractPromoTitle');
    const text=document.getElementById('contractPromoText');
    const button=document.getElementById('contractPromoButtonText');
    const url=document.getElementById('contractPromoUrl');
    const img=document.getElementById('contractPromoPreviewImage');
    box.style.opacity=enabled&&enabled.checked?'1':'.38';
    if(img){img.src=window.__contractPromoDraftImage||'assets/facebook-banner.jpg';img.style.display=showImage&&showImage.checked?'':'none';}
    const h=box.querySelector('h3');if(h)h.textContent=title?title.value:'';
    const p=box.querySelector('p');if(p)p.textContent=text?text.value:'';
    const a=box.querySelector('a');if(a){a.textContent=button?button.value:'';a.href=url&&url.value?url.value:'#';}
  }

  function fillPromoEditor(){
    if(!document.getElementById('contractPromoSettingsCard'))return;
    const p=getContractPromoSettings();
    window.__contractPromoDraftImage=p.image||'';
    document.getElementById('contractPromoEnabled').checked=p.enabled!==false;
    document.getElementById('contractPromoShowImage').checked=p.showImage!==false;
    document.getElementById('contractPromoTitle').value=p.title||'';
    document.getElementById('contractPromoText').value=p.text||'';
    document.getElementById('contractPromoButtonText').value=p.buttonText||'';
    document.getElementById('contractPromoUrl').value=p.url||'';
    updatePromoEditorPreview();
  }

  function renderContractPromoEditor(){
    const view=document.getElementById('settingsView');if(!view)return;
    promoEditorStyle();
    let card=document.getElementById('contractPromoSettingsCard');
    if(!card){
      card=document.createElement('section');
      card.id='contractPromoSettingsCard';
      card.className='card contract-promo-settings';
      card.innerHTML='<div class="section-head"><div><span class="badge">Contrato</span><h3>Publicidad final del contrato</h3><p>Personaliza el bloque que aparece al final de la vista previa y del PDF.</p></div></div><label class="promo-switch"><input id="contractPromoEnabled" type="checkbox"> Mostrar esta sección en los contratos</label><div class="grid two"><label>Título<input id="contractPromoTitle" type="text" maxlength="90"></label><label>Texto del botón<input id="contractPromoButtonText" type="text" maxlength="80"></label><label class="full">Texto<textarea id="contractPromoText" class="promo-editor-text" maxlength="650"></textarea></label><label class="full">Enlace del botón<input id="contractPromoUrl" type="url" placeholder="https://..."></label><label class="full">Imagen / banner<input id="contractPromoImageFile" type="file" accept="image/png,image/jpeg,image/webp"><small class="field-help">La imagen se optimiza antes de guardarse y se incluye en el respaldo.</small></label></div><label class="promo-switch"><input id="contractPromoShowImage" type="checkbox"> Mostrar imagen en esta sección</label><div id="contractPromoLivePreview" class="promo-image-preview"><img id="contractPromoPreviewImage" src="assets/facebook-banner.jpg" alt="Vista previa"><div class="promo-image-copy"><h3></h3><p></p><a href="#" target="_blank" rel="noopener"></a></div></div><div class="promo-editor-actions"><button type="button" id="saveContractPromo" class="btn btn-primary">Guardar cambios</button><button type="button" id="defaultContractPromoImage" class="btn btn-light">Usar imagen predeterminada</button><button type="button" id="resetContractPromo" class="btn btn-light">Restaurar todo</button></div><div id="contractPromoMessage" class="app-note hidden"></div>';
      view.appendChild(card);

      card.querySelectorAll('input[type="text"],input[type="url"],textarea,input[type="checkbox"]').forEach(el=>el.addEventListener('input',updatePromoEditorPreview));

      document.getElementById('contractPromoImageFile').addEventListener('change',async e=>{
        const file=e.target.files&&e.target.files[0];if(!file)return;
        if(file.size>8000000){alert('La imagen es demasiado grande. Usa una imagen menor de 8 MB.');e.target.value='';return;}
        try{
          const data=await new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(fr.result);fr.onerror=reject;fr.readAsDataURL(file);});
          const image=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=data;});
          const maxW=1200,maxH=800,scale=Math.min(1,maxW/image.width,maxH/image.height),canvas=document.createElement('canvas');
          canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
          canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
          window.__contractPromoDraftImage=canvas.toDataURL('image/jpeg',.86);
          updatePromoEditorPreview();
        }catch(err){alert('No se pudo preparar esta imagen.');}
      });

      document.getElementById('defaultContractPromoImage').addEventListener('click',()=>{
        window.__contractPromoDraftImage='';
        document.getElementById('contractPromoImageFile').value='';
        updatePromoEditorPreview();
      });

      document.getElementById('saveContractPromo').addEventListener('click',()=>{
        try{
          const next={
            enabled:document.getElementById('contractPromoEnabled').checked,
            showImage:document.getElementById('contractPromoShowImage').checked,
            title:document.getElementById('contractPromoTitle').value.trim(),
            text:document.getElementById('contractPromoText').value.trim(),
            buttonText:document.getElementById('contractPromoButtonText').value.trim(),
            url:document.getElementById('contractPromoUrl').value.trim(),
            image:window.__contractPromoDraftImage||''
          };
          if(!next.title||!next.text||!next.buttonText||!next.url){alert('Completa título, texto, botón y enlace.');return;}
          setContractPromoSettings(next);
          const msg=document.getElementById('contractPromoMessage');
          msg.textContent='✓ Publicidad del contrato guardada. También quedará incluida en la sincronización.';
          msg.className='app-note backup-ok';
        }catch(err){alert((err&&err.message)||err);}
      });

      document.getElementById('resetContractPromo').addEventListener('click',()=>{
        if(!confirm('¿Restaurar la publicidad original de Brinky Fiesta?'))return;
        setContractPromoSettings(getContractPromoDefaults());
        window.__contractPromoDraftImage='';
        fillPromoEditor();
      });
    }
    fillPromoEditor();
  }

  try{
    const originalRenderWhatsappSettings=renderWhatsappSettings;
    renderWhatsappSettings=function(){const r=originalRenderWhatsappSettings();setTimeout(renderContractPromoEditor,0);return r;};
  }catch(e){}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(renderContractPromoEditor,0),{once:true});
  else setTimeout(renderContractPromoEditor,0);

  // Panel de respaldo simplificado: tres controles de uso normal.
  function simplifyBackupControls(){
    const card=document.getElementById('backupCard');
    if(!card||document.getElementById('backupSimpleControls'))return;
    const oldActions=card.querySelector('.backup-actions');
    const cloudDetails=document.getElementById('cloudConfigDetails');
    if(!oldActions||!cloudDetails)return;

    if(!document.getElementById('backupSimpleStyle')){
      const style=document.createElement('style');style.id='backupSimpleStyle';
      style.textContent='.backup-simple-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:14px 0}.backup-simple-actions>.btn,.backup-tool-details>summary{min-height:58px;display:flex;align-items:center;justify-content:center;text-align:center;border-radius:16px;font-weight:900;font-size:1rem;box-sizing:border-box}.backup-tool-details{margin:0}.backup-tool-details>summary{list-style:none;cursor:pointer;border:1px solid #d8ccff;background:#fff;color:#4c1d95;padding:12px 16px}.backup-tool-details>summary::-webkit-details-marker{display:none}.backup-tool-details[open]>summary{background:#f4efff}.backup-simple-panel{grid-column:1/-1;margin-top:10px;padding:14px;border:1px solid #e4e7ec;border-radius:16px;background:#fff}.backup-simple-panel .btn{margin:5px;min-width:210px}.backup-legacy-actions{display:none!important}@media(max-width:760px){.backup-simple-actions{grid-template-columns:1fr}.backup-simple-panel .btn{width:100%;margin:5px 0;min-width:0}}';
      document.head.appendChild(style);
    }

    if(window.__rescueCloudDeletedDocs&&!document.getElementById('rescueCloudDeletedDocs')){
      const b=document.createElement('button');
      b.type='button';b.id='rescueCloudDeletedDocs';b.className='btn btn-light';b.textContent='Recuperar eliminados de nube';
      b.addEventListener('click',window.__rescueCloudDeletedDocs);oldActions.appendChild(b);
    }

    const simple=document.createElement('div');
    simple.id='backupSimpleControls';simple.className='backup-simple-actions';
    const sync=document.getElementById('cloudRecoverBtn');
    if(sync){sync.textContent='🔄 Sincronizar ahora';sync.className='btn btn-blue';simple.appendChild(sync);}

    const makeDetails=(id,label)=>{
      const d=document.createElement('details');d.id=id;d.className='backup-tool-details';
      const s=document.createElement('summary');s.textContent=label;
      const p=document.createElement('div');p.className='backup-simple-panel';
      d.appendChild(s);d.appendChild(p);simple.appendChild(d);return p;
    };

    const recovery=makeDetails('backupRecoveryTools','🛟 Recuperar información');
    ['recoverLocalFolder','importFullBackup','rescueCloudDeletedDocs'].forEach(id=>{const el=document.getElementById(id);if(el)recovery.appendChild(el);});
    const importFile=document.getElementById('importFullBackupFile');if(importFile)recovery.appendChild(importFile);

    const options=makeDetails('backupOptionsTools','⚙️ Opciones de respaldo');
    const choose=document.getElementById('chooseBackupFolder');if(choose){choose.textContent='Cambiar carpeta local (PC)';options.appendChild(choose);}
    const retry=document.getElementById('retryBackups');if(retry){retry.textContent='Reintentar pendientes';options.appendChild(retry);}
    const all=document.getElementById('backupAllNow');if(all)options.appendChild(all);
    const exp=document.getElementById('exportFullBackup');if(exp)options.appendChild(exp);
    options.appendChild(cloudDetails);

    oldActions.parentNode.insertBefore(simple,oldActions);
    oldActions.classList.add('backup-legacy-actions');
    oldActions.innerHTML='';
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',simplifyBackupControls,{once:true});
  else setTimeout(simplifyBackupControls,0);
})();
