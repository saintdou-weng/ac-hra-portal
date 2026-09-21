/* v75: month-specific photo/PDF viewing, editing and explicit Telegram selection. */
var CertificateEvidence=(function(){
  'use strict';
  const E=id=>document.getElementById(id),clone=x=>JSON.parse(JSON.stringify(x)),L=(z,e,k)=>certificateL(LANG,z,e,k),M=HRACertificateModel;
  const sessions={};let saving=false,picker=null;
  const key=a=>String(a.id||a.fileId||a.url||a.downloadUrl||a.src||'');
  const name=a=>a.originalName||a.fileName||a.name||'Evidence';
  const url=a=>safe(a.url||a.downloadUrl||a.previewUrl||a.src||'');
  function safe(s){return /^(https?:\/\/|blob:|data:image\/(png|jpeg|webp|gif);base64,)/i.test(String(s))?String(s):'';}
  function evidence(r,month){
    if(!r)return [];
    return M.evidenceAt(r,month||certificateViewMonth());
  }
  function unique(xs){const out=new Map();xs.forEach(a=>out.set(key(a),a));return [...out.values()];}
  function image(a){return /^image\//i.test(a.mimeType||'');}
  function thumbnail(a){return image(a)?`<img src="${esc(safe(a.previewUrl||a.url||a.src))}" alt="${esc(name(a))}" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden>📷</span>`:'<span class="cv-pdf">PDF</span>';}
  function record(kind,id,month){const view=certificateMonthView(month);return (kind==='person'?view.people:view.certificates).find(r=>r.id===id);}
  function title(r){return r.name||[r.nickname,r.nameEn||r.nameKh].filter(Boolean).join(' / ')||r.id;}
  function dispose(s){(s?.pending||[]).forEach(p=>{if(p.preview&&URL.revokeObjectURL)URL.revokeObjectURL(p.preview);});}
  function session(slot,r,kind,month){dispose(sessions[slot]);return sessions[slot]={slot,id:r.id||uid('cert'),kind:kind||'certificate',month:month||certificateViewMonth(),items:clone(evidence(r,month)),pending:[],original:clone(evidence(r,month)),dirty:false};}
  function card(a,index,slot,removable){return `<div class="cv-file"><a href="${esc(url(a)||'#')}" target="_blank" rel="noopener">${thumbnail(a)}<span>${esc(name(a))}</span></a>${a.shareWarning?`<small>${esc(L('連結權限需確認；可由 GAS 發送原檔。','Check link permissions; GAS can send the file.','សូមពិនិត្យសិទ្ធិតំណ។'))}</small>`:''}${removable?`<button type="button" class="btn small red" data-cv-remove="${index}" data-slot="${slot}">${L('移除','Remove','ដកចេញ')}</button>`:''}</div>`;}
  function renderSession(slot){
    const s=sessions[slot],box=E(slot==='cert'?'certEvidenceList':'cvGalleryFiles');if(!s||!box)return;
    box.classList.add('cv-files');box.innerHTML=s.items.map((a,i)=>card(a,i,slot,!s.readonly)).join('')+s.pending.map((p,i)=>card(p.meta||{originalName:p.file.name,mimeType:p.file.type,previewUrl:p.preview,url:p.preview},s.items.length+i,slot,true).replace('</div>',`<small>${esc(p.error|| (p.meta?L('已上傳，待儲存至紀錄','Uploaded; save to link','បានផ្ទុក; រក្សាទុកដើម្បីភ្ជាប់'):L('待儲存／上傳','Not saved / uploaded yet','មិនទាន់រក្សាទុក')))}</small></div>`)).join('');
    if(!s.items.length&&!s.pending.length)box.textContent=L('尚無照片／PDF','No photos / PDFs','គ្មានរូបភាព / PDF');
    box.querySelectorAll('[data-cv-remove]').forEach(b=>{b.disabled=saving;b.onclick=()=>{if(saving)return;const n=Number(b.dataset.cvRemove);if(n<s.items.length)s.items.splice(n,1);else{const [p]=s.pending.splice(n-s.items.length,1);if(p?.preview&&URL.revokeObjectURL)URL.revokeObjectURL(p.preview);}s.dirty=true;renderSession(slot);};});
  }
  function startForm(r){session('cert',r,'certificate');renderSession('cert');const history=E('certVersionHistory');history.innerHTML=(r.versions||[]).slice().reverse().map(v=>`<div><b>${esc(v.effectiveFrom||'—')}</b> · ${esc(v.startDate||'—')} → ${esc(v.expiryDate||'—')}<div>${(v.evidence||[]).map(a=>`<a href="${esc(url(a)||'#')}" target="_blank" rel="noopener">📎 ${esc(name(a))}</a>`).join(' · ')||'—'}</div></div>`).join('')||'—';}
  function add(files,slot='cert'){
    const s=sessions[slot];if(!s||saving||s.readonly)return;
    const errors=[];Array.from(files||[]).forEach(f=>{
      if(f.size>10*1024*1024||(!/^image\//i.test(f.type)&&!/^application\/pdf$/i.test(f.type)&&!/\.pdf$/i.test(f.name))){errors.push(f.name+' · '+L('限照片／PDF，每檔 10 MB','Photo / PDF, up to 10 MB per file','រូបភាព / PDF មិនលើស 10 MB'));return;}
      if(s.pending.some(p=>p.file.name===f.name&&p.file.size===f.size&&p.file.lastModified===f.lastModified))return;
      s.pending.push({file:f,preview:URL.createObjectURL?URL.createObjectURL(f):'',documentType:s.kind==='person'?E('cvDocumentType').value:'certificate'});s.dirty=true;
    });renderSession(slot);if(errors.length)toast(errors.join('\n'),6000);
  }
  async function upload(s,month){
    for(const p of s.pending){if(p.meta)continue;p.error='';
      try{const a=await HRAAttachments.upload(p.file,{module:'certificate_visa',recordKey:s.id,period:month});if(!a||!key(a)||!url(a))throw new Error('Upload was not confirmed');p.meta={...a,originalName:p.file.name,documentType:p.documentType};}
      catch(e){p.error=p.file.name+': '+e.message;renderSession(s.slot);throw new Error(p.error);}
      renderSession(s.slot);
    }
    return unique(s.items.concat(s.pending.map(p=>p.meta)));
  }
  async function commit(kind,id,month,change,reason){
    const backup=clone(STATE);try{
      M.baseline(STATE,new Date().toISOString());const view=certificateMonthView(month);STATE.certificates=clone(view.certificates||[]);STATE.people=clone(view.people||[]);
      const list=kind==='person'?STATE.people:STATE.certificates,index=list.findIndex(r=>r.id===id),old=index>=0?list[index]:{},r={...old,...change,id,updatedAt:new Date().toISOString(),cvSchema:72,cvRevisionAt:new Date().toISOString()};
      if(M.hash(evidence(old))!==M.hash(M.fileList(change.evidence||[],month))){r.evidenceRevisionAt=r.updatedAt;r.evidenceEffectiveFrom=month;}
      if(kind==='certificate'){
        r.versions=clone(old.versions||[]);const v={effectiveFrom:month,startDate:r.startDate||'',expiryDate:r.expiryDate||'',renewalDate:r.renewalDate||'',cost:r.cost,costText:r.costText,costIsRate:r.costIsRate,remark:r.remark||'',evidence:clone(r.evidence||[]),evidenceRevisionAt:r.evidenceRevisionAt||'',updatedAt:r.updatedAt};
        const prev=r.versions.find(x=>x.effectiveFrom===month&&x.source!=='excel');if(prev)Object.assign(prev,v);else r.versions.push(v);
      }
      if(index>=0)list[index]=r;else list.push(r);
      if(!r.createdAt)r.createdAt=r.updatedAt;if(!r.source)r.source='online';
      M.saveRevision(STATE,{month,file:reason});M.reconcile(STATE);await persist('file-change');return r;
    }catch(e){STATE=backup;throw e;}
  }
  async function confirmCloud(){
    const result=window.HRAAutoSync?await HRAAutoSync.run('certificate_visa','file-change'):await cloudPush({silent:true});
    toast(result?'✅ '+L('證書與附件已同步至雲端','Certificate and files synced to cloud','ឯកសារបានធ្វើសមកាលកម្មហើយ'):'⏳ '+L('已儲存在本機；雲端尚未確認，請看同步狀態並重試上傳','Saved on this device; cloud not yet confirmed. Check sync status and retry upload.','បានរក្សាទុកក្នុងឧបករណ៍; សូមពិនិត្យការធ្វើសមកាលកម្ម។'),6000);return !!result;
  }
  async function recoverUploaded(){
    const s=sessions.gallery;if(!s||saving)return;
    const button=E('cvRecover'),box=E('cvRecovered');button.disabled=true;box.textContent=L('搜尋已上傳附件…','Looking for uploaded files…','កំពុងស្វែងរកឯកសារ…');
    try{
      const response=await postGas({action:'certificateAttachmentHistory',recordKey:s.id,period:s.month}),data=response.data||response;
      if(sessions.gallery!==s)return;
      const files=M.fileList(data.files,s.month).filter(a=>!s.items.some(b=>key(a)===key(b)));
      box.innerHTML=files.map((a,i)=>`<div class="cv-file-pick"><a href="${esc(url(a))}" target="_blank" rel="noopener">${esc(name(a))}</a><small>${esc(a.period||'')}</small>${s.readonly?'':`<button type="button" class="btn small" data-recover="${i}">${L('加入本月附件','Link to this month','ភ្ជាប់ក្នុងខែនេះ')}</button>`}</div>`).join('')||esc(L('此證書沒有其他已上傳附件。','No other uploaded files found for this record.','រកមិនឃើញឯកសារផ្សេងទៀត។'));
      box.querySelectorAll('[data-recover]').forEach(b=>b.onclick=()=>{const a=files[Number(b.dataset.recover)];if(!s.items.some(x=>key(x)===key(a)))s.items.push(a);s.dirty=true;b.disabled=true;renderSession('gallery');toast(L('已加入，請按儲存','Added; press Save','បានបន្ថែម; សូមរក្សាទុក'));});
    }catch(e){box.textContent=L('無法取得附件清單：','Unable to load uploaded files: ','មិនអាចទាញបញ្ជី៖ ')+e.message;}finally{button.disabled=false;}
  }
  async function saveCertificate(event){
    event.preventDefault();if(saving||!certificateCanEdit())return false;
    const s=sessions.cert,month=val('certEffectiveFrom')||certificateViewMonth();
    if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)||month<M.monthAt()){toast(tr('historicalReadOnly'));return false;}
    saving=true;showLoading(L('儲存證書與附件…','Saving certificate and files…','កំពុងរក្សាទុកវិញ្ញាបនបត្រ…'));
    try{
      const files=await upload(s,month),cost=certificateCost(val('certCost'));
      await commit('certificate',s.id,month,{category:val('certCategory'),name:val('certName'),department:val('certDepartment'),status:val('certStatus'),contact:val('certContact'),completedForDate:val('certCompletedFor'),startDate:val('certStart'),expiryDate:val('certExpiry'),renewalDate:val('certRenewal'),cost:cost.amount,costText:cost.text,costIsRate:cost.isRate,remark:val('certRemark'),evidence:files},'Certificate and attachments updated');
      dispose(s);delete sessions.cert;CERT_PENDING_FILES=[];saving=false;closeModal('certModal');renderAll();hideLoading();await confirmCloud();return true;
    }catch(e){toast('❌ '+L('未完成儲存，請重試：','Save incomplete; retry: ','រក្សាទុកមិនទាន់ចប់៖ ')+e.message,7000);return false;}finally{saving=false;hideLoading();renderSession('cert');}
  }
  function cell(r,kind){const files=evidence(r);return `<div class="cv-cell"><button class="btn small" type="button" data-cv-gallery="${esc(r.id)}" data-kind="${kind}">📎 ${L('附件','Files','ឯកសារ')} ${files.length}</button>${files.length?`<div class="cv-thumbs">${files.slice(0,2).map(a=>`<a href="${esc(url(a)||'#')}" target="_blank" rel="noopener" title="${esc(name(a))}">${thumbnail(a)}</a>`).join('')}</div>`:''}</div>`;}
  function openGallery(kind,id){
    const month=certificateViewMonth(),r=record(kind,id,month);if(!r)return;const s=session('gallery',r,kind,month);s.readonly=month<M.monthAt();
    E('cvGalleryTitle').textContent=title(r)+' · '+month;E('cvGalleryHelp').textContent=s.readonly?L('歷史附件可查看及發送；修改請切回本月。','View or send historical files; edit from the current month.','អាចមើល ឬផ្ញើឯកសារចាស់។'):L('新增照片會加入此月份，往後沿用；移除不影響之前月份。選檔後請按儲存。','Files carry forward from this month. Removing a file keeps earlier months. Save after choosing files.','ឯកសារបន្តពីខែនេះ; ខែមុននៅដដែល។ សូមចុចរក្សាទុក។');
    E('cvGalleryEdit').hidden=s.readonly;E('cvGallerySave').hidden=s.readonly;E('cvDocumentLabel').hidden=kind!=='person';E('cvDocumentType').value='visa';E('cvRecovered').textContent='';renderSession('gallery');openModal('cvGalleryModal');
  }
  async function saveGallery(){const s=sessions.gallery;if(!s||saving||s.readonly)return;saving=true;showLoading(L('儲存附件…','Saving files…','កំពុងរក្សាទុកឯកសារ…'));try{const files=await upload(s,s.month);await commit(s.kind,s.id,s.month,{evidence:files},'Attachments updated');session('gallery',record(s.kind,s.id,s.month),s.kind,s.month);renderSession('gallery');renderAll();hideLoading();await confirmCloud();return true;}catch(e){toast('❌ '+e.message,7000);return false;}finally{saving=false;hideLoading();renderSession('gallery');}}
  function sendGallery(){const s=sessions.gallery;if(!s)return;if(s.dirty){toast(L('請先儲存附件再發送','Save the files before sending','សូមរក្សាទុកមុនផ្ញើ'));return;}selectedCerts.clear();selectedPeople.clear();(s.kind==='person'?selectedPeople:selectedCerts).add(s.id);closeModal('cvGalleryModal');openSelected();}
  function openSelected(){if(!selectedCerts.size&&!selectedPeople.size){toast(tr('selectItems'));return;}openTelegram('summary');E('tgScope').value='selected';picker=null;refreshTgPreview();}
  function candidates(type,mode,scope){
    if(type==='approval')return certificatePendingRequests().map(r=>({token:'request:'+r.id,request:r,name:r.number+' · '+r.title,files:unique((r.items||[]).flatMap(i=>(i.documentRequest?.evidence||[]).map(a=>({...a,label:i.name,recordKey:i.id}))))}));
    const out=new Map();function add(r,kind,month){if(!r)return;const token=kind+':'+r.id+':'+month;out.set(token,{token,r,kind,month,name:title(r),files:evidence(r,month).map(a=>({...a,label:title(r)+' · '+month,recordKey:r.id}))});}
    if(scope==='period'){
      (type==='reminder'?reminderRows():eventsForMode(mode)).forEach(e=>{const kind=e.kind==='certificate'?'certificate':'person',month=e.snapshotMonth||certificateViewMonth();add(record(kind,e.recordId,month),kind,month);});
    }else{
      const month=certificateViewMonth();certificatesForMonth().filter(r=>scope==='selected'||M.current(r)).forEach(r=>{if(scope!=='selected'||selectedCerts.has(r.id))add(r,'certificate',month);});peopleForMonth().filter(r=>scope==='selected'||r.status==='active'&&!r.notInLatest).forEach(r=>{if(scope!=='selected'||selectedPeople.has(r.id))add(r,'person',month);});
    }return [...out.values()];
  }
  function renderPicker(){
    if(!E('tgRecords'))return;
    const type=val('tgType'),mode=val('tgPeriod'),scope=val('tgScope'),list=candidates(type,mode,scope),signature=[type,mode,scope,certificateViewMonth(),...list.map(x=>x.token)].join('|');
    if(!picker||picker.signature!==signature)picker={signature,type,scope,mode,chosen:new Set(list.map(x=>x.token)),omitted:new Set()};picker.list=list;
    E('tgScope').disabled=type==='approval';E('tgFileHelp').textContent=type==='approval'?L('核可會附上申請儲存時的附件；若要更換，請另建一筆申請。','Approval uses the files saved with the request. Create a new request to change them.','ការអនុម័តប្រើឯកសារដែលបានរក្សាទុកជាមួយសំណើ។'):L('勾選要發送的照片／PDF；已更新、尚未到期的證書也可發送。','Choose the photos / PDFs to send. Renewed certificates can be sent before expiry.','ជ្រើសរូបភាព / PDF ដើម្បីផ្ញើ ទោះមិនទាន់ផុតកំណត់។');E('tgRecords').innerHTML=list.map(x=>`<label class="cv-pick"><input type="checkbox" data-cv-record="${esc(x.token)}" ${picker.chosen.has(x.token)?'checked':''}><span>${esc(x.name)}<small>${esc(x.month||x.request.period||'')} · 📎 ${x.files.length}</small></span></label>`).join('')||esc(L('此範圍沒有項目；可改選「當月清單」，或先在表格勾選。','No items here. Choose the month list or select rows in the table.','គ្មានធាតុ; ជ្រើសបញ្ជីខែ ឬជ្រើសជួរ។'));
    E('tgRecords').querySelectorAll('[data-cv-record]').forEach(c=>c.onchange=()=>{c.checked?picker.chosen.add(c.dataset.cvRecord):picker.chosen.delete(c.dataset.cvRecord);refreshTgPreview();});
    const files=unique(list.filter(x=>picker.chosen.has(x.token)).flatMap(x=>x.files));
    E('tgFiles').innerHTML=files.map(a=>`<label class="cv-file-pick"><input type="checkbox" data-cv-file="${esc(key(a))}" ${!picker.omitted.has(key(a))?'checked':''} ${type==='approval'?'disabled':''}>${thumbnail(a)}<span>${esc(name(a))}<small>${esc(a.label||'')}</small></span><a href="${esc(url(a)||'#')}" target="_blank" rel="noopener">${L('查看','View','មើល')}</a></label>`).join('')||esc(L('沒有附件','No attachments','គ្មានឯកសារភ្ជាប់'));
    E('tgFiles').querySelectorAll('[data-cv-file]').forEach(c=>c.onchange=()=>{c.checked?picker.omitted.delete(c.dataset.cvFile):picker.omitted.add(c.dataset.cvFile);refreshTgPreview();});
    E('tgSelectionCount').textContent=L('選取項目','Selected items','ធាតុបានជ្រើស')+' '+list.filter(x=>picker.chosen.has(x.token)).length+' · '+L('附件','Files','ឯកសារ')+' '+files.filter(a=>!picker.omitted.has(key(a))).length;
  }
  function selected(type,mode){const active=picker&&picker.type===type&&picker.scope===val('tgScope')&&picker.mode===mode,list=active?picker.list:candidates(type,mode,val('tgScope')||'period');return active?list.filter(x=>picker.chosen.has(x.token)):list;}
  function attachments(type,mode){return unique(selected(type,mode).flatMap(x=>x.files)).filter(a=>type==='approval'||!picker?.omitted.has(key(a))).map(a=>({...a,fileName:name(a)}));}
  function requests(){return selected('approval',val('tgPeriod')).map(x=>x.request).filter(Boolean);}
  function summary(lang,mode,base){
    const list=selected(val('tgType'),mode),scope=val('tgScope')||'period',ll=(z,e,k)=>certificateL(lang,z,e,k);
    const whole=scope==='period'&&(!picker||list.length===picker.list.length);
    const out=whole?[base()]:['📄 '+ll('證書／證件及附件','Certificates / Documents and Files','វិញ្ញាបនបត្រ / ឯកសារ'),ll('資料月份','Source month','ខែទិន្នន័យ')+'：'+certificateViewMonth(),ll('選取項目','Selected items','ធាតុបានជ្រើស')+'：'+list.length,ll('檢查人','Inspector','អ្នកត្រួតពិនិត្យ')+'：'+val('tgActor')];
    list.forEach((x,i)=>{if(!x.r)return;const r=x.r;out.push('\n#'+(i+1)+' '+x.name,ll('分類／部門','Category / Department','ប្រភេទ / ផ្នែក')+'：'+(r.category||r.department||'—'));
      const fields=x.kind==='certificate'?[['開始日','Start','ចាប់ផ្ដើម',r.startDate],['到期日','Expiry','ផុតកំណត់',r.expiryDate],['續期日','Renewal','បន្ត',r.renewalDate]]:[['護照到期','Passport expiry','លិខិតឆ្លងដែន',r.passportExpiry],['簽證到期','Visa expiry','ទិដ្ឋាការ',r.visaExpiry],['工作證到期','Work permit expiry','ប័ណ្ណការងារ',r.workPermitExpiry]];
      fields.forEach(f=>out.push(ll(...f.slice(0,3))+'：'+(f[3]||'—')+(/Expiry|expiry/.test(f[1])&&f[3]&&f[3]<certificateReferenceDate(x.month)?' ⚠ '+ll('已過期','Expired','ផុតកំណត់'):'')));const files=x.files.filter(a=>!picker?.omitted.has(key(a)));out.push(ll('附件','Files','ឯកសារ')+'：'+files.length+(files.length?' · '+files.map(name).join(' / '):''));if(r.remark)out.push(r.remark);
    });return out.join('\n');
  }
  function resetPicker(){picker=null;E('tgScope').value=selectedCerts.size||selectedPeople.size?'selected':'period';}
  function assertSelection(){if(picker&&val('tgScope')!=='period'&&!selected(val('tgType'),val('tgPeriod')).length)throw new Error(tr('selectItems'));}
  function localize(){
    const labels={cvChoose:['📎 照片／PDF','📎 Photo / PDF','📎 រូបភាព / PDF'],cvCamera:['📷 拍照','📷 Camera','📷 ថតរូប'],cvGallerySave:['儲存','Save','រក្សាទុក'],cvRecover:['找回已上傳附件','Find uploaded files','ស្វែងរកឯកសារដែលបានផ្ទុក']};
    Object.entries(labels).forEach(([id,text])=>{if(E(id))E(id).textContent=L(...text);});
    const options=[['期間到期／提醒','Due / reminder in period','ផុតកំណត់ក្នុងរយៈពេល'],['表格所選項目','Selected table rows','ជួរដែលបានជ្រើស'],['當月清單（不限到期日）','Month list (any expiry)','បញ្ជីខែ (គ្រប់ថ្ងៃផុតកំណត់)']];
    if(E('tgScope'))Array.from(E('tgScope').options).forEach((o,i)=>o.textContent=L(...options[i]));
    [['tgScope',['發送範圍','Send scope','វិសាលភាពផ្ញើ']],['tgRecords',['選取項目','Select items','ជ្រើសធាតុ']],['tgFiles',['隨附照片／PDF','Photos / PDFs to send','រូបភាព / PDF ត្រូវផ្ញើ']]].forEach(([id,text])=>{const field=E(id)?.closest('.field');if(field)field.querySelector('label').textContent=L(...text);});
    document.querySelectorAll('[data-cv-text]').forEach(n=>{n.textContent=n.dataset.cvText==='files'?'📎 '+L('附件','Files','ឯកសារ'):'✈ '+L('所選項目／附件','Selected items / files','ធាតុ / ឯកសារបានជ្រើស');});
    if(E('cvDocumentLabel'))E('cvDocumentLabel').firstChild.textContent=L('證件類型 ','Document type ','ប្រភេទឯកសារ ');
    const close=E('cvGalleryModal')?.querySelector('.dialog-foot button:last-child');if(close)close.textContent=L('關閉','Close','បិទ');
  }
  function install(){
    const modal=document.createElement('div');modal.id='cvGalleryModal';modal.className='modal';modal.innerHTML=`<div class="dialog"><div class="dialog-head"><h3 id="cvGalleryTitle"></h3><button class="x" onclick="closeModal('cvGalleryModal')">×</button></div><div class="dialog-body"><p id="cvGalleryHelp"></p><div id="cvGalleryEdit" class="toolbar"><label id="cvDocumentLabel">${L('證件類型','Document type','ប្រភេទឯកសារ')} <select id="cvDocumentType"><option value="passport">Passport</option><option value="visa">Visa</option><option value="workPermit">Work Permit</option><option value="residence">Residence</option></select></label><button type="button" class="btn" id="cvChoose">📎 ${L('照片／PDF','Photo / PDF','រូបភាព / PDF')}</button><button type="button" class="btn" id="cvCamera">📷 ${L('拍照','Camera','ថតរូប')}</button><input id="cvFiles" type="file" accept="image/*,.pdf" multiple hidden><input id="cvCameraFiles" type="file" accept="image/*" capture="environment" hidden></div><button class="btn" type="button" id="cvRecover">${L('找回已上傳附件','Find uploaded files','ស្វែងរកឯកសារដែលបានផ្ទុក')}</button><div id="cvRecovered"></div><div id="cvGalleryFiles"></div></div><div class="dialog-foot"><button class="btn blue" id="cvGallerySave">${L('儲存','Save','រក្សាទុក')}</button><button class="btn" id="cvGallerySend">✈ Telegram</button><button class="btn" onclick="closeModal('cvGalleryModal')">${L('關閉','Close','បិទ')}</button></div></div>`;document.body.appendChild(modal);
    E('cvChoose').onclick=()=>E('cvFiles').click();E('cvCamera').onclick=()=>E('cvCameraFiles').click();['cvFiles','cvCameraFiles'].forEach(id=>E(id).onchange=e=>{add(e.target.files,'gallery');e.target.value='';});E('cvRecover').onclick=recoverUploaded;E('cvGallerySave').onclick=saveGallery;E('cvGallerySend').onclick=sendGallery;
    document.addEventListener('click',e=>{const b=e.target.closest('[data-cv-gallery]');if(b)openGallery(b.dataset.kind,b.dataset.cvGallery);});
    const originalApplyLang=applyLang;applyLang=()=>{originalApplyLang();localize();};
  }
  return {evidence,cell,startForm,add,saveCertificate,openGallery,saveGallery,sendGallery,openSelected,renderPicker,resetPicker,attachments,requests,summary,assertSelection,install,recoverUploaded,isSaving:()=>saving};
})();
