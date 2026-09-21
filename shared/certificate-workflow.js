/* Certificate month views and explicit Telegram submission and file receipts, v75. */
var certificateExtraLabels={
  zh:{retryFiles:'補發未完成附件',mixedDecision:'已完成（含退件）',importScope:'匯入範圍',importComplete:'完整最新清單（當月起生效）',importPartial:'局部更新（其他項目保留）',currentList:'該月清單',historicalList:'該月已移出／舊項目',documentType:'證件類型',submittedReadOnly:'已送核的內容保留原版本；請在 Telegram 查看或處理。',telegramDecisionsOnly:'請使用 Telegram 的審查／核可按鈕。',refreshApproval:'更新核可結果',localWorkflowHint:'先儲存待核可申請，再送群組審查及核可。',historicalReadOnly:'歷史月份保留原資料；請切回本月新增或修改。',latestRule:'以匯入當月生效，往後沿用；前月資料保留。完整清單未列的人員／證書從當月移出。',dedupHint:'同項目更新、新增項目加入；保留前月及核可版本。',sendApproval:'送群組核可'},
  en:{retryFiles:'Retry missing files',mixedDecision:'Completed (includes rejected)',importScope:'Import scope',importComplete:'Complete list (effective this month)',importPartial:'Partial update (keep other items)',currentList:'List for this month',historicalList:'Removed / older items',documentType:'Document type',submittedReadOnly:'Submitted details are frozen. View or decide in Telegram.',telegramDecisionsOnly:'Use the review / approval buttons in Telegram.',refreshApproval:'Refresh approval',localWorkflowHint:'Save a pending request, then send it for group review and approval.',historicalReadOnly:'Past months are retained. Switch to this month to add or edit.',latestRule:'Imports take effect this month and carry forward. Earlier months remain unchanged. Missing entries leave the current list.',dedupHint:'Update matching items and add new items. Earlier months and approval snapshots are retained.',sendApproval:'Send group approval'}
};
function certificateL(lang,zh,en,km){return lang==='en'?en:lang==='km'?(km||en):zh;}
function certificateViewMonth(){return HRACertificateModel.monthAt(PERIOD_ANCHOR);}
function certificateMonthView(month){return HRACertificateModel.asOf(STATE,month||certificateViewMonth());}
function certificatesForMonth(month){return certificateMonthView(month).certificates||[];}
function peopleForMonth(month){return certificateMonthView(month).people||[];}
function certificateInView(c){const scope=document.getElementById('certScope')?.value||'current',on=HRACertificateModel.current(c);return scope==='all'||(scope==='history'?!on:on);}
function certificateCanEdit(){if(certificateViewMonth()<HRACertificateModel.monthAt()){toast(tr('historicalReadOnly'));return false;}return true;}
function saveCertificateRevision(reason){HRACertificateModel.saveRevision(STATE,{file:reason||'Online entry'});}
function certificateRowHighlighted(ws,row){
  if(!ws||!window.XLSX)return false;
  for(let c=1;c<10;c++){const s=ws[XLSX.utils.encode_cell({r:row,c})]?.s,color=String(s?.fgColor?.rgb||'').replace(/^FF(?=.{6}$)/,'').toUpperCase();if(s?.patternType==='solid'&&['FFFF00','FFF2CC','FFEB9C'].includes(color))return true;}
  return false;
}
function certificateCost(raw){
  const text=String(raw==null?'':raw).trim(),isRate=/\/|\bper\b/i.test(text);
  return {amount:isRate?null:(text===''?null:num(raw)),text,isRate};
}
function certificateParseFlatPeople(rows,file,sheet){
  const hi=rows.findIndex(row=>row.some(c=>/^English Name$/i.test(String(c)))&&row.some(c=>/^Passport No\.?$/i.test(String(c)))&&row.some(c=>/^Employee ID$/i.test(String(c))));
  if(hi<0)return null;
  const headers=rows[hi].map(c=>String(c).trim().toUpperCase()),value=(r,h)=>r[headers.indexOf(h.toUpperCase())]??'',records=[];
  const mapping={employeeId:'Employee ID',nameEn:'English Name',nameKh:'Khmer Name',nickname:'Nickname',department:'Department',status:'Status',sex:'Sex',nationality:'Nationality',dob:'DOB',joinDate:'Join Date',passport:'Passport No.',passportExpiry:'Passport Expiry',visaExpiry:'Visa Expiry',visaApplyDate:'Visa Apply',visaReceivedDate:'Visa Received',visaNumber:'Visa No.',visaExpense:'Visa Expense',workPermitExpiry:'Work Permit Expiry',workPermitApplyDate:'Work Permit Apply',workPermitReceivedDate:'Work Permit Received',workPermitNumber:'Work Permit No.',workPermitExpense:'Work Permit Expense',residenceExpiry:'Residence Expiry',phone:'Phone',remark:'Remark'};
  const year=yearFrom(file,sheet),rank=year*100;
  rows.slice(hi+1).forEach(r=>{
    if(!value(r,'English Name')||!value(r,'Passport No.'))return;
    const p={};Object.entries(mapping).forEach(([key,header])=>{const v=value(r,header);p[key]=/Expiry|Date|^dob$/.test(key)?isoDate(v):/Expense$/.test(key)?num(v):clean(v);});
    Object.assign(p,{status:p.status||'active',rosterManaged:true,source:'excel',sourceFile:file,sourceSheet:sheet,sourceYear:year,sourceRank:rank,explicitExpiryFields:['workPermitExpiry','residenceExpiry']});records.push(p);
  });
  return {file,sheet,year,rank,records};
}
function certificateNextDate(c){return [c.renewalDate,c.expiryDate].filter(Boolean).sort()[0]||'';}
function certificateEventLabel(e,lang){
  if(e.kind==='certificate'&&e.renewalDate===e.date&&(!e.expiryDate||e.date<e.expiryDate))return certificateL(lang,e.days<0?'續期日已過':'續期提醒',e.days<0?'Renewal overdue':'Renewal reminder','រំលឹកការបន្តសុពលភាព');
  return certificateL(lang,e.days<0?'已過期':'到期提醒',e.days<0?'Expired':'Expiry reminder','រំលឹកថ្ងៃផុតកំណត់');
}
function certificatePeriodEvents(mode,anchor){
  const range=periodRange(mode||PERIOD_MODE,anchor||PERIOD_ANCHOR),out=[],seen=new Set();
  for(let d=new Date(range.start.getFullYear(),range.start.getMonth(),1);d<range.end;d.setMonth(d.getMonth()+1)){
    const m=HRACertificateModel.monthAt(d);
    allEvents(m).forEach(e=>{const date=dateObj(e.date);if(date>=range.start&&date<range.end&&e.date.slice(0,7)===m&&!seen.has(e.id)){seen.add(e.id);out.push(e);}});
  }
  return out.sort((a,b)=>a.date.localeCompare(b.date));
}
function certificateHistoryEvents(){
  const months=new Set();
  [STATE,...(STATE.monthlySnapshots||[])].forEach(s=>{
    (s.certificates||[]).forEach(c=>{const d=certificateNextDate(c);if(d)months.add(d.slice(0,7));});
    (s.people||[]).forEach(p=>['passportExpiry','visaExpiry','workPermitExpiry','residenceExpiry'].forEach(k=>{if(p[k])months.add(p[k].slice(0,7));}));
  });
  return [...months].sort().flatMap(m=>allEvents(m).filter(e=>e.date.slice(0,7)===m));
}
function certificateRequestItem(item,due,documentType){
  const kind=item.kind==='certificate'?'certificate':'person',type=kind==='certificate'?'certificate':documentType||item.documentType||'visa';
  const rec=(kind==='certificate'?certificatesForMonth():peopleForMonth()).find(x=>x.id===item.id);
  if(!rec||!HRACertificateModel.current(rec)||(kind==='person'&&rec.status!=='active'))throw new Error('Item is not in the selected month: '+item.name);
  const targetDate=due||(kind==='certificate'?certificateNextDate(rec):rec[type+'Expiry'])||todayISO();
  const doc={schema:'certificate-request-v1',recordId:rec.id,documentType:type,effectiveMonth:certificateViewMonth(),name:kind==='certificate'?rec.name:[rec.nickname,rec.nameEn].filter(Boolean).join(' / '),category:rec.category||rec.department||'',employeeId:rec.employeeId||'',passport:kind==='person'?rec.passport||'':'',startDate:kind==='certificate'?rec.startDate||'':rec[type+'ReceivedDate']||'',expiryDate:kind==='certificate'?rec.expiryDate||'':rec[type+'Expiry']||'',renewalDate:kind==='certificate'?rec.renewalDate||'':'',targetDate,costText:kind==='certificate'?(rec.costText||String(rec.cost??'')):String(rec[type+'Expense']??''),costIsRate:!!rec.costIsRate,amount:rec.costIsRate?null:kind==='certificate'?rec.cost??null:rec[type+'Expense']??null,remark:rec.remark||'',sourceFile:rec.sourceFile||'',sourceSheet:rec.sourceSheet||'',sourceRow:rec.sourceRow||'',evidence:JSON.parse(JSON.stringify(CertificateEvidence.evidence(rec).filter(a=>kind==='certificate'||!a.documentType||a.documentType===type)))};
  return {kind,id:rec.id,name:doc.name,documentType:type,targetDate,approvalKey:'CV|'+HRACertificateModel.hash([rec.id,type,targetDate,doc.expiryDate,doc.renewalDate].concat(rec.evidenceRevisionAt||doc.evidence.length?[rec.evidenceRevisionAt||'',doc.evidence.map(a=>a.id||a.url||'')]:[])),documentRequest:doc};
}
function certificatePendingRequests(){return STATE.requests.filter(r=>r.status==='pending'&&(r.period||r.createdAt?.slice(0,7)||certificateViewMonth())===certificateViewMonth());}
function certificateApprovalPayload(r,actor,lang){
  if(!r.items?.length)throw new Error(tr('selectItems'));
  if(!r.applicant?.trim())throw new Error(certificateL(LANG,'請填申請人','Applicant is required'));
  const items=r.items.map(i=>{
    if(!i.documentRequest){const old=certificateRequestItem(i,i.targetDate||r.dueDate,i.documentType);Object.assign(i,old);}
    const d=i.documentRequest;
    return {key:i.approvalKey,name:d.name,empId:d.employeeId,dept:d.category,amount:d.costIsRate?0:Number(d.amount)||0,kind:d.documentType,period:r.period||d.effectiveMonth,info:r.remark||'',documentRequest:JSON.parse(JSON.stringify(d))};
  });
  const signature=HRACertificateModel.hash(items),period=r.period||items[0].documentRequest.effectiveMonth;
  return {action:'approvalRequest',module:'certificate_visa',tool:'certificate_visa',scope:'document_request',reportKind:'certificate_request',schemaVersion:3,batch:'CV-'+period.replace('-','')+'-'+HRACertificateModel.hash(r.id)+'-'+signature,period,lang:lang||'both',route:'review',title:r.title,items,inspector:actor||r.applicant,checker:actor||r.applicant,requestedBy:r.applicant,idempotencyKey:'certificate-request|'+r.id+'|'+signature,attachments:items.flatMap(i=>(i.documentRequest.evidence||[]).map(a=>({...a,fileName:a.originalName||a.fileName||a.name,label:i.documentRequest.name,recordKey:i.documentRequest.recordId})))};
}
async function refreshCertificateApprovals(options={}){
  if(!gasUrl()||!STATE.requests.some(r=>r.batchId||r.items?.some(i=>i.approvalKey)))return false;
  try{
    const raw=await postGas({action:'approvalLedger',module:TOOL_ID}),d=raw.data||raw,ledger=d.decisions||{};let changed=false;
    for(const r of STATE.requests.filter(r=>r.batchId||r.items?.some(i=>i.approvalKey))){
      for(const i of r.items||[]){const v=ledger[i.approvalKey],st=v&&(v.s||v.status);if(['approved','rejected'].includes(st)&&i.approvalStatus!==st){i.approvalStatus=st;i.decidedAt=v.at||'';i.decidedBy=v.by||'';if(!r.batchId&&v.b)r.batchId=v.b;changed=true;}}
      const items=r.items||[],states=items.map(i=>i.approvalStatus||'pending'),next=states.includes('pending')?'pending':states.every(s=>s==='approved')?'approved':states.every(s=>s==='rejected')?'rejected':'mixed';
      if(r.status!==next){r.status=next;r.decidedAt=items.map(i=>i.decidedAt||'').sort().pop();r.updatedAt=new Date().toISOString();changed=true;}
    }
    if(changed){await persist('approval-result');renderAll();}return true;
  }catch(e){if(!options.silent)toast('❌ '+e.message,5000);return false;}
}
var certificateSendBusy=false;
var certificateApprovalBackendUrl='';
async function ensureCertificateApprovalBackend(){
  if(certificateApprovalBackendUrl===gasUrl()&&gasUrl())return;
  const versionError=()=>new Error(certificateL(LANG,'請先將共用 GAS 更新並部署為 v56，再送出證書核可。','Update and deploy the shared GAS v56 before sending certificate approvals.'));
  let r;
  try{
    r=await postGas({action:'certificateCapabilities',module:TOOL_ID});
  }catch(e){if(/unknown action|unsupported|certificateCapabilities/i.test(String(e.message)))throw versionError();throw e;}
  const d=r.data||r;if(d.approvalSchema!=='certificate-request-v1')throw versionError();
  certificateApprovalBackendUrl=gasUrl();
}
async function submitCertificateRequest(r,actor,lang){
  const expected=new Set((r.items||[]).flatMap(i=>(i.documentRequest?.evidence||[]).map(a=>a.id||a.fileId||a.url||a.downloadUrl))).size;
  if(r.batchId){
    if(expected){await ensureCertificateEvidenceBackend();const response=await postGas({action:'certificateApprovalEvidence',batchId:r.batchId}),d=response.data||response;r.evidenceStats=d.evidence;await persist('attachment-delivery');checkCertificateEvidence(d,expected);}
    await refreshCertificateApprovals();return {reused:true,batchId:r.batchId};
  }
  if(expected)await ensureCertificateEvidenceBackend();
  await ensureCertificateApprovalBackend();
  const payload=certificateApprovalPayload(r,actor,lang);r.period=payload.period;
  // Persist the exact frozen request before the network call so retries use identical keys.
  await persist('approval-prepared');
  const response=await postGas(payload),d=response.data||response;
  if(d.alreadyDecided){await refreshCertificateApprovals();if(r.status!=='pending')return d;throw new Error(certificateL(LANG,'此項目已有核可結果，請更新核可紀錄。','These items already have decisions. Refresh the approval records.'));}
  if(!d.batchId||!(d.messageId||d.alreadyPending&&d.sentToGroup))throw new Error('Telegram approval delivery was not confirmed');
  r.batchId=d.batchId;r.messageId=d.messageId||'';r.submittedAt=new Date().toISOString();r.updatedAt=r.submittedAt;r.status='pending';
  r.evidenceStats=d.evidence||null;await persist('approval-submitted');checkCertificateEvidence(d,expected);return d;
}
async function sendCertificateRequest(id){
  if(certificateSendBusy)return;const r=STATE.requests.find(r=>r.id===id);if(!r)return;
  certificateSendBusy=true;showLoading(tr('sendApproval'));
  try{const pendingFiles=r.evidenceStats?.pending,result=await submitCertificateRequest(r,localStorage.getItem('ac_hra_cert_tg_actor')||r.applicant,'both');renderAll();toast('✅ '+(pendingFiles?certificateL(LANG,'附件已完成補發','Missing files delivered','បានផ្ញើឯកសារដែលខ្វះ'):tr(result.reused?'refreshApproval':'telegramSent')));}catch(e){toast('❌ '+e.message,6000);}finally{certificateSendBusy=false;hideLoading();}
}
function certificateChangeText(lang){
  const month=certificateViewMonth(),snap=certificateMonthView(month),out=[];
  if(snap.baseline||!snap.effectiveFrom)return out;
  out.push(certificateL(lang,'版本生效月份','Version effective month','ខែចាប់ផ្តើមប្រើ')+'：'+snap.effectiveFrom);
  if(snap.effectiveFrom!==month){out.push(certificateL(lang,'沿用前次清單','Carried forward from the previous import','បន្តប្រើបញ្ជីមុន'));return out;}
  for(const [kind,label] of [['certificates',certificateL(lang,'公司證書','Certificates','វិញ្ញាបនបត្រ')],['people',certificateL(lang,'外幹','Expats','បុគ្គលិកបរទេស')]]){
    const changes=snap.changes?.[kind];if(!changes)continue;
    for(const [key,title] of [['added',certificateL(lang,'新增','Added','បន្ថែម')],['removed',certificateL(lang,'移出當月清單','Removed from this month','ដកចេញពីបញ្ជីខែនេះ')],['updated',certificateL(lang,'更新','Updated','កែប្រែ')]]){
      const rows=changes[key]||[];out.push(label+' '+title+'：'+rows.length);
      rows.forEach(r=>out.push('• '+r.name+(r.expiryDate?' | '+certificateL(lang,'到期','Expiry','ផុតកំណត់')+' '+(r.before?.expiryDate&&r.before.expiryDate!==r.expiryDate?r.before.expiryDate+' → ':'')+r.expiryDate:'')));
    }
  }
  return out;
}
function tgSummaryText(lang,mode){
  const c=certificatesForMonth().filter(HRACertificateModel.current),p=peopleForMonth().filter(p=>p.status==='active'&&!p.notInLatest),ev=certificatePeriodEvents(mode),actor=document.getElementById('tgActor')?.value||'';
  const out=['📄 '+certificateL(lang,'證書／簽證摘要','Certificate / Visa Summary','សង្ខេបវិញ្ញាបនបត្រ / ទិដ្ឋាការ'),certificateL(lang,'期間','Period','រយៈពេល')+'：'+periodLabel(mode),certificateL(lang,'公司清單','Certificate list','បញ្ជីវិញ្ញាបនបត្រ')+'：'+c.length+'（'+certificateL(lang,'停止','Stopped','បានបញ្ឈប់')+' '+c.filter(x=>x.status==='stopped').length+'）',certificateL(lang,'有效外幹','Active expats','បុគ្គលិកបរទេសសកម្ម')+'：'+p.length,p.map(x=>x.nickname||x.nameEn).join('、'),certificateL(lang,'期間到期／續期','Expiry / renewal in period','ផុតកំណត់ / បន្តក្នុងរយៈពេល')+'：'+ev.length,certificateL(lang,'待核可申請','Pending approval requests','សំណើរង់ចាំអនុម័ត')+'：'+certificatePendingRequests().length,certificateL(lang,'檢查人','Inspector','អ្នកត្រួតពិនិត្យ')+'：'+actor,...certificateChangeText(lang)];
  ev.forEach(e=>out.push('• '+e.date+' | '+e.name+' | '+certificateEventLabel(e,lang)));
  return out.join('\n');
}
function tgApprovalText(lang){
  const requests=CertificateEvidence.requests(),out=['✅ '+certificateL(lang,'證書／證件核可申請','Certificate / Document Approval','សំណើអនុម័តឯកសារ'),certificateL(lang,'資料月份','Source month','ខែទិន្នន័យ')+'：'+certificateViewMonth()];
  requests.forEach(r=>{out.push(r.number+' | '+r.title,certificateL(lang,'申請人','Applicant','អ្នកស្នើសុំ')+'：'+r.applicant);(r.items||[]).forEach(i=>{const d=i.documentRequest||{};out.push('• '+i.name,certificateL(lang,'到期日','Expiry','ផុតកំណត់')+'：'+(d.expiryDate||'—')+' | '+certificateL(lang,'續期日','Renewal','បន្តសុពលភាព')+'：'+(d.renewalDate||'—'),certificateL(lang,'費用／單位','Fee / basis','ថ្លៃ / ឯកតា')+'：'+(d.costText||'—'));});});
  if(!requests.length)out.push(certificateL(lang,'請先勾選公司證書或外幹，儲存一筆「待核可」申請。','Select certificates or expats and save a pending request first.','សូមជ្រើសឯកសារ និងរក្សាទុកសំណើរង់ចាំអនុម័តជាមុន។'));
  return out.join('\n');
}
function tgReminderText(lang){
  const rows=allEvents().filter(e=>!e.completed&&e.days<=Number(STATE.settings.reminderDays||45));
  return ['🔔 '+certificateL(lang,'證書／證件提醒','Document reminders','រំលឹកឯកសារ'),certificateL(lang,'資料月份','Source month','ខែទិន្នន័យ')+'：'+certificateViewMonth(),...rows.map(e=>e.date+' | '+e.name+' | '+certificateEventLabel(e,lang)+(e.expiryDate?' | '+certificateL(lang,'證書到期','Certificate expiry','វិញ្ញាបនបត្រផុតកំណត់')+' '+e.expiryDate:''))].join('\n');
}
function certificateTextChunks(text,max=3000){
  const out=[];let part='';for(const line of String(text).split('\n')){for(const char of line+'\n'){if(esc(part+char).length>max){out.push(part);part='';}part+=char;}}if(part)out.push(part);return out;
}
async function sendCertificateTelegram(){
  if(certificateSendBusy)return;const actor=val('tgActor');if(!actor){toast(certificateL(LANG,'請填寫發送人／檢查人','Enter the sender / inspector'));return;}
  certificateSendBusy=true;document.getElementById('tgDeliveryStatus').textContent=certificateL(LANG,'正在發送…','Sending…','កំពុងផ្ញើ…');showLoading(tr('manualSend'));
  try{
    const type=val('tgType'),lang=val('tgLang'),mode=val('tgPeriod');CertificateEvidence.assertSelection();
    if(type==='approval'){
      const requests=CertificateEvidence.requests();if(!requests.length)throw new Error(certificateL(LANG,'請先建立待核可申請','Create a pending request first'));
      for(const r of requests)await submitCertificateRequest(r,actor,lang);
    }else{
      const message=buildTgText(),chunks=certificateTextChunks(message),files=certificateTgAttachments(type,mode),key='ac_hra_cert_send_'+HRACertificateModel.hash([todayISO(),type,mode,certificateViewMonth(),lang,actor,message,files]);
      if(files.length)await ensureCertificateEvidenceBackend();
      let done=Number(localStorage.getItem(key)||0);
      for(let i=done;i<chunks.length;i++){
        const attachments=i===chunks.length-1?files:[];
        const r=await postGas({action:attachments.length?'certificateDispatch':'telegram',idempotencyKey:key+'|'+i,lang,tool:TOOL_ID,module:TOOL_ID,text:esc(chunks[i])+(chunks.length>1?'\n'+(i+1)+'/'+chunks.length:''),period:certificateViewMonth(),periodType:mode,messageType:type,attachments,applicant:actor,inspector:actor,checker:actor}),d=r.data||r;
        if(d.ok===false||!(d.messageId||d.message_id||d.sent===true||d.result?.message_id))throw new Error('Telegram delivery was not confirmed');
        checkCertificateEvidence(d,attachments.length);localStorage.setItem(key,String(i+1));if(i<chunks.length-1)await new Promise(resolve=>setTimeout(resolve,1500));
      }
    }
    toast('✅ '+tr('telegramSent'));closeModal('telegramModal');renderAll();
  }catch(e){document.getElementById('tgDeliveryStatus').textContent='❌ '+e.message;toast('❌ '+e.message,6000);}finally{certificateSendBusy=false;hideLoading();}
}

var certificateEvidenceBackendUrl='';
async function ensureCertificateEvidenceBackend(){
  if(certificateEvidenceBackendUrl===gasUrl()&&gasUrl())return;
  const response=await postGas({action:'certificateCapabilities',module:TOOL_ID}),d=response.data||response;
  if(Number(d.evidenceSchema)<56||!d.evidenceSchema)throw new Error(certificateL(LANG,'請將原 GAS 更新並重新部署為 v56，才能確認照片／PDF 送達。','Update and redeploy the existing GAS to v56 for photo / PDF delivery receipts.','សូមដំឡើង GAS v56 ដើម្បីផ្ញើរូបភាព / PDF។'));
  certificateEvidenceBackendUrl=gasUrl();
}
function checkCertificateEvidence(result,expected){
  if(!expected)return;
  const s=result.evidence;
  if(!s||s.requested!==expected||s.sent!==expected||s.failed||s.pending||s.complete===false){
    const details=(s?.missing||[]).map(x=>x.name+(x.error?' · '+x.error:'')).join('; ');
    throw new Error(certificateL(LANG,'文字已發出；附件 '+(s?.sent||0)+'/'+expected+'，請重試未完成的附件。','Text sent; files '+(s?.sent||0)+'/'+expected+'. Retry the missing files.','បានផ្ញើអត្ថបទ; ឯកសារ '+(s?.sent||0)+'/'+expected+'។ សូមព្យាយាមម្ដងទៀត។')+(details?' '+details:''));
  }
}
