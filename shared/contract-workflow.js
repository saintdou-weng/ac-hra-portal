/* v73: selected Telegram requests, immutable revisions and deletion history. */
var contractDeleteDuplicatePhysical = dbDel;
var ContractWorkflow = (function () {
  'use strict';
  const M=HRAContractModel, selected={prob:new Set(),cont:new Set()};
  let archive=[],ledger={},modal=null,busy=false,syncTail=Promise.resolve(),ready=false,capUrl='';
  const ACTOR='ac_hra_contract_actor_v73',OUTBOX='ac_hra_contract_outbox_v73';
  const el=id=>document.getElementById(id), esc=s=>escapeHtml(String(s==null?'':s));
  const L=(z,e,k)=>M.l(LANG,z,e,k), rows=k=>k==='prob'?DASH_PROBS:DASH_CONTS;
  const storeKind=s=>s==='dashProbs'?'prob':s==='dashConts'?'cont':'';
  const storage=k=>k==='prob'?'dashProbs':'dashConts';
  const allRows=()=>DASH_PROBS.map(r=>({r,k:'prob'})).concat(DASH_CONTS.map(r=>({r,k:'cont'})),archive.map(r=>({r,k:M.kind(r)})));
  function reason(s){const m={incomplete:['請先補工號／姓名','Complete employee ID / name first','សូមបំពេញលេខបុគ្គលិក / ឈ្មោះ'],invalid_result:['請先修正試用結果','Correct the probation result first','សូមកែលទ្ធផលសាកល្បង'],historical:['舊紀錄已結案，不重送','Historical result; excluded','លទ្ធផលចាស់; មិនផ្ញើម្ដងទៀត'],sent:['此版本已發摘要','Summary sent for this version','បានផ្ញើសង្ខេប'],pending:['此版本待核可','This version awaits approval','កំណែនេះរង់ចាំអនុម័ត'],approved:['此版本已核可','This version approved','កំណែនេះបានអនុម័ត'],rejected:['此版本已退回','This version rejected','កំណែនេះបានបដិសេធ'],decided:['原核可已結案','Previous approval completed','ការអនុម័តបានបញ្ចប់']};return m[s]?L(...m[s]):M.status(s,LANG);}
  function rawPut(store,obj){return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(obj);tx.oncomplete=()=>resolve();tx.onerror=tx.onabort=()=>reject(tx.error||new Error('Save failed'));});}
  async function put(store,obj){
    const k=storeKind(store);
    if(k){const old=obj.id?await dbGet(store,obj.id):null;Object.assign(obj,!old&&obj.source==='excel'&&M.historical(obj,k)?M.ensure(obj,k):M.edit(old,obj,k));}
    await rawPut(store,obj);
    if(!_contractCloudApplying&&['employees','probations','contracts','dashProbs','dashConts'].includes(store))scheduleContractSync('save');
  }
  async function remove(store,id){
    const k=storeKind(store);if(!k)return contractDeleteDuplicatePhysical(store,id);
    const old=await dbGet(store,id);if(!old)return;
    const r=M.edit(old,{...old,_deleted:true},k,undefined,'delete');r._kind=k==='prob'?'dash_probation':'dash_contract';
    await rawPut(store,r);archive=M.merge(archive,[r],r._kind);selected[k].delete(id);scheduleContractSync('delete');
  }
  const oldClear=dbClear,oldLoad=loadAll,oldFlat=contractFlat,oldPersist=contractPersistAll,oldApply=contractApply,oldReconcile=contractReconcileLegacyToDash;
  async function clear(store){const k=storeKind(store);if(!k)return oldClear(store);for(const r of rows(k).slice())await remove(store,r.id);}
  function prepareLoaded(){
    const split=(list,k)=>M.merge([],list,k==='prob'?'dash_probation':'dash_contract').map(r=>M.ensure({...r,_kind:k==='prob'?'dash_probation':'dash_contract'},k));
    const p=split(DASH_PROBS.concat(archive.filter(r=>M.kind(r)==='prob')),'prob'),c=split(DASH_CONTS.concat(archive.filter(r=>M.kind(r)==='cont')),'cont');
    archive=p.concat(c).filter(r=>r._deleted);
    DASH_PROBS=p.filter(r=>!r._deleted);DASH_CONTS=c.filter(r=>!r._deleted);
  }
  async function load(){await oldLoad();prepareLoaded();}
  function mergeFlat(a,b){
    const groups={};(a||[]).concat(b||[]).forEach(r=>{const k=r._kind||'';(groups[k]||(groups[k]=[])).push(r);});
    return Object.keys(groups).reduce((out,k)=>out.concat(M.merge([],groups[k],k)),[]);
  }
  function apply(records){
    // Keep local edits made while the request was in flight, including tombstones.
    const merged=mergeFlat(flat(),records||[]);archive=[];DASH_PROBS=[];DASH_CONTS=[];
    oldApply(merged);prepareLoaded();
  }
  function flat(){return oldFlat().concat(archive.map(r=>contractCloudRow(r,r._kind,M.kind(r)==='prob'?'DP':'DC'))).map(r=>{
    if(r._wf&&!r._wf.history.length&&!r._wf.receipts.length)delete r._wf;
    if(r._derivedId&&!r._wf)delete r.id;delete r._derivedId;return r;
  });}
  async function persist(){
    prepareLoaded();
    _contractCloudApplying=true;
    try{await Promise.all([dbReplaceAllFast('employees',EMPLOYEES),dbReplaceAllFast('probations',PROBATIONS),dbReplaceAllFast('contracts',CONTRACTS),dbReplaceAllFast('dashProbs',DASH_PROBS.concat(archive.filter(r=>M.kind(r)==='prob'))),dbReplaceAllFast('dashConts',DASH_CONTS.concat(archive.filter(r=>M.kind(r)==='cont')))]);}finally{_contractCloudApplying=false;}
  }
  function reconcile(){
    const p=DASH_PROBS,c=DASH_CONTS;
    archive=M.merge(archive,p.concat(c).filter(r=>r._deleted));
    DASH_PROBS=p.concat(archive.filter(r=>M.kind(r)==='prob'));DASH_CONTS=c.concat(archive.filter(r=>M.kind(r)==='cont'));
    const changed=oldReconcile();DASH_PROBS=DASH_PROBS.filter(r=>!r._deleted);DASH_CONTS=DASH_CONTS.filter(r=>!r._deleted);prepareLoaded();return changed;
  }
  function decorate(k){
    document.querySelectorAll('.'+k+'-cb').forEach(cb=>{cb.checked=selected[k].has(cb.dataset.id);const r=rows(k).find(x=>String(x.id)===cb.dataset.id);if(!r)return;
      const state=M.eligible(r,'approval',k,ledger),cell=cb.closest('tr').querySelector('.actions-cell');
      if(cell){const tag=document.createElement('small');tag.className='ct-record-state';tag.textContent=reason(state.reason);cell.appendChild(tag);}
    });const cbs=[...document.querySelectorAll('.'+k+'-cb')],all=el(k+'SelAll');
    if(all){all.checked=!!cbs.length&&cbs.every(c=>c.checked);all.indeterminate=cbs.some(c=>c.checked)&&!all.checked;}
  }
  function toggle(k,on){document.querySelectorAll('.'+k+'-cb').forEach(c=>{c.checked=on;on?selected[k].add(c.dataset.id):selected[k].delete(c.dataset.id);});decorate(k);}
  function installUI(){
    const style=document.createElement('style');style.textContent=`.ct-record-state{display:block;max-width:180px;white-space:normal;color:#60708a;font-size:11px;margin-top:5px}.ct-tg .modal{width:min(840px,96vw);max-height:92dvh;display:flex;flex-direction:column;padding:0}.ct-tg h3,.ct-tg footer{margin:0;padding:18px 22px}.ct-tg main{padding:4px 22px 18px;overflow:auto}.ct-tg .ct-fields{display:grid;grid-template-columns:1fr 1fr;gap:14px}.ct-tg label{font-size:13px;display:block}.ct-tg select,.ct-tg input[type=text]{width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:6px}.ct-tg .ct-wide{grid-column:1/-1}.ct-tg .ct-picker{max-height:230px;overflow:auto;border:1px solid #e2e8f0;border-radius:8px;margin:8px 0}.ct-tg .ct-pick{display:flex;align-items:flex-start;gap:10px;padding:9px;border-bottom:1px solid #eee}.ct-tg .ct-pick input{margin-top:4px}.ct-tg .ct-pick small{display:block;color:#63718c}.ct-tg pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f3f6fa;border-radius:8px;padding:14px;font:13px/1.6 system-ui}.ct-tg footer{display:flex;gap:10px;justify-content:flex-end;border-top:1px solid #ddd}.ct-tg .ct-info{color:#64748b;font-size:13px;margin:8px 0}@media(max-width:540px){.ct-tg .ct-fields{grid-template-columns:1fr}.ct-tg main{padding:4px 12px 12px}.ct-tg h3,.ct-tg footer{padding:12px}.ct-tg footer button{flex:1}}`;
    document.head.appendChild(style);
    const div=document.createElement('div');div.id='contractTelegramModal';div.className='modal-bg ct-tg';div.innerHTML=`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="ctTitle"><h3 id="ctTitle">✈️ Telegram</h3><main><div class="ct-fields"><label><span id="ctModeLabel"></span><select id="ctMode"><option value="summary">📄 摘要 / Summary / សង្ខេប</option><option value="approval">✅ 核可 / Approval / អនុម័ត</option></select></label><label><span id="ctSourceLabel"></span><select id="ctScope"><option value="prob">📝 試用期 / Probation / សាកល្បង</option><option value="cont">📄 合約 / Contract / កិច្ចសន្យា</option><option value="both">兩者 / Both / ទាំងពីរ</option></select></label><label><span id="ctBasisLabel"></span><select id="ctBasis"><option value="end">到期日 / End date / ថ្ងៃបញ្ចប់</option><option value="join">加入日 / Join date / ថ្ងៃចូល</option><option value="change">異動日 / Change date / ថ្ងៃកែប្រែ</option><option value="settle">結算月份 / Settlement month / ខែទូទាត់</option></select></label><label><span id="ctTypeLabel"></span><select id="ctType"><option value="selected">已勾選 / Selected / បានជ្រើស</option><option value="all">全部期間 / All periods / គ្រប់ពេល</option><option value="day">日 / Day / ថ្ងៃ</option><option value="week">週 / Week / សប្ដាហ៍</option><option value="month">月 / Month / ខែ</option><option value="year">年 / Year / ឆ្នាំ</option></select></label><label><span id="ctPeriodLabel"></span><select id="ctPeriod"></select></label><label><span id="ctLangLabel"></span><select id="ctLang"><option value="both">中英 / 中文 + English</option><option value="zh">繁中</option><option value="en">English</option><option value="km">ខ្មែរ</option><option value="all3">中英柬 / 中文 + English + ខ្មែរ</option></select></label><label class="ct-wide"><span id="ctActorLabel"></span><input type="text" id="ctActor" maxlength="100" required autocomplete="name"></label></div><p id="ctHelp" class="ct-info"></p><label><input type="checkbox" id="ctSelectAll"> <span id="ctSelectLabel"></span></label><div id="ctPicker" class="ct-picker"></div><p id="ctCounts" class="ct-info" aria-live="polite"></p><h4 id="ctPreviewTitle"></h4><pre id="ctPreview"></pre><p id="ctResult" role="status"></p></main><footer><button class="btn ghost" id="ctCancel"></button><button class="btn gold" id="ctSend"></button></footer></div>`;
    document.body.appendChild(div);
    ['ctMode','ctScope','ctBasis','ctType'].forEach(id=>el(id).onchange=()=>refill());el('ctPeriod').onchange=()=>pick(true);el('ctLang').onchange=preview;el('ctActor').oninput=preview;
    el('ctSelectAll').onchange=()=>{modal.chosen=new Set(el('ctSelectAll').checked?modal.candidates.filter(x=>x.state.ok).map(x=>x.token):[]);pick(false);};
    el('ctCancel').onclick=()=>{if(!busy){div.classList.remove('show');modal=null;}};el('ctSend').onclick=send;
    document.addEventListener('change',e=>{const cb=e.target;if(!cb.matches('.prob-cb,.cont-cb'))return;const k=cb.classList.contains('prob-cb')?'prob':'cont';cb.checked?selected[k].add(cb.dataset.id):selected[k].delete(cb.dataset.id);decorate(k);});
    ['prob','cont'].forEach(k=>{const actions=el(k==='prob'?'probSummaryBtn':'contSummaryBtn').parentElement;
      const save=actions.querySelector('button[onclick^="export"]');if(save){save.onclick=()=>saveNow();const exportBtn=document.createElement('button');exportBtn.className='btn small ghost';exportBtn.textContent='↓ Excel';exportBtn.onclick=k==='prob'?exportProbationExcel:exportContractExcel;actions.insertBefore(exportBtn,save.nextSibling);}
      const changes=document.createElement('button');changes.className='btn small ghost';changes.textContent='🕘 異動 / Changes';changes.onclick=()=>open(k,'approval',true);actions.appendChild(changes);
    });
  }
  function dateFor(x){const b=el('ctBasis').value,r=x.r;return b==='change'?(M.latest(r)?.at||'').slice(0,10):b==='join'?M.snapshot(r,x.k).joinDate:b==='settle'?(r.latestSettlementMonth||r.payoutMonth||r.period||'').slice(0,7)+'-01':M.snapshot(r,x.k).endDate;}
  function datesFor(x){if(el('ctBasis').value!=='settle')return [dateFor(x)];return [...new Set((x.r.settlements||[]).map(s=>s.payoutMonth).concat(x.r.latestSettlementMonth||x.r.payoutMonth||x.r.period||''))].filter(v=>/^\d{4}-\d{2}/.test(v||'')).map(v=>v.slice(0,7)+'-01');}
  function candidates(){const scope=el('ctScope').value,type=el('ctType').value,p=el('ctPeriod').value;
    return allRows().filter(x=>scope==='both'||x.k===scope).filter(x=>type==='selected'?selected[x.k].has(String(x.r.id)):type==='all'?true:datesFor(x).some(d=>periodKey(d,type)===p)).map(x=>({...x,token:x.k+':'+x.r.id,state:M.eligible(x.r,el('ctMode').value,x.k,ledger,requestFor(x))}));
  }
  function refill(){
    if(!modal||busy)return;if(el('ctBasis').value==='settle'&&!['month','selected'].includes(el('ctType').value))el('ctType').value='month';const type=el('ctType').value,scope=el('ctScope').value,cur=el('ctPeriod').value,periods=new Set();
    if(type==='all'||type==='selected'){el('ctPeriod').innerHTML='<option value="ALL">—</option>';el('ctPeriod').disabled=true;}
    else {el('ctPeriod').disabled=false;allRows().filter(x=>scope==='both'||scope===x.k).forEach(x=>datesFor(x).forEach(d=>{const key=periodKey(d,type);if(key)periods.add(key);}));const rawPeriod=modal.initialPeriod||cur||todayISO(),date=firstValidDate(rawPeriod)||(/^\d{4}$/.test(rawPeriod)?rawPeriod+'-01-01':todayISO()),desired=periodKey(date,type);periods.add(desired);el('ctPeriod').innerHTML=[...periods].filter(Boolean).sort().reverse().map(p=>'<option value="'+esc(p)+'">'+esc(periodLabel(p,type))+'</option>').join('');el('ctPeriod').value=desired;}
    modal.initialPeriod='';pick(true);
  }
  function pick(reset){
    if(!modal)return;modal.candidates=candidates();if(reset)modal.chosen=new Set(modal.candidates.filter(x=>x.state.ok).map(x=>x.token));
    const box=el('ctPicker');box.innerHTML='';modal.candidates.forEach(x=>{const label=document.createElement('label');label.className='ct-pick';const input=document.createElement('input');input.type='checkbox';input.disabled=!x.state.ok||busy;input.checked=modal.chosen.has(x.token)&&x.state.ok;input.onchange=()=>{input.checked?modal.chosen.add(x.token):modal.chosen.delete(x.token);preview();};const span=document.createElement('span');span.textContent=(x.k==='prob'?'📝 ':'📄 ')+(x.r.factoryId||'—')+' · '+(M.name(x.r)||'—');const small=document.createElement('small');small.textContent=[x.r.dept||'—',dateFor(x)||'—',reason(x.state.reason)].join(' · ');span.appendChild(small);label.append(input,span);box.appendChild(label);});preview();
  }
  function chosen(){return (modal?.candidates||[]).filter(x=>x.state.ok&&modal.chosen.has(x.token));}
  function requestFor(x){
    const type=el('ctType').value,period=type==='all'||type==='selected'?'ALL':el('ctPeriod').value;
    let st=null;
    // Settlement mode explicitly chooses its payout month; no unrelated workers are added.
    if(x.k==='cont'&&el('ctBasis').value==='settle'&&!x.r._deleted){const moneyPeriod=period==='ALL'?(x.r.latestSettlementMonth||x.r.payoutMonth||(x.r.settlements||[]).map(s=>s.payoutMonth||'').sort().at(-1)||''):period;if(/^\d{4}-\d{2}/.test(moneyPeriod))st=contractSettlementForPeriod(x.r,moneyPeriod);}
    return M.request(x.r,x.k,period,st);
  }
  function preview(){
    if(!modal)return;const list=chosen(),lang=el('ctLang').value,mode=el('ctMode').value;
    el('ctCounts').textContent=L('選取','Selected','បានជ្រើស')+' '+list.length+' / '+modal.candidates.length+' · '+L('已略過','Excluded','បានរំលង')+' '+modal.candidates.filter(x=>!x.state.ok).length;
    const requests=list.map(requestFor),lines=M.summaryHeader(requests,requests[0]?.period||el('ctPeriod').value,lang);
    if(mode==='approval')lines[0]=M.l(lang,'試用期／合約核可','Probation / Contract Approval','អនុម័តសាកល្បង / កិច្ចសន្យា');
    lines.push(L('申請人／檢查人','Applicant / Inspector','អ្នកស្នើ / អ្នកត្រួតពិនិត្យ')+'：'+(el('ctActor').value.trim()||'—'));
    list.forEach((x,i)=>{const d=requestFor(x);lines.push('\n#'+(i+1)+' '+(x.k==='prob'?M.l(lang,'試用期','Probation','សាកល្បង'):M.l(lang,'合約','Contract','កិច្ចសន្យា')));M.pairs(d,lang).forEach(p=>lines.push(p.join('：')));});
    el('ctPreview').textContent=lines.join('\n');el('ctSend').textContent=mode==='approval'?L('送出核可請求','Send for Approval','ផ្ញើសុំអនុម័ត'):L('傳送摘要','Send Summary','ផ្ញើសង្ខេប');el('ctSend').disabled=busy||!list.length||!el('ctActor').value.trim();
    const available=modal.candidates.filter(x=>x.state.ok);el('ctSelectAll').checked=!!available.length&&list.length===available.length;el('ctSelectAll').indeterminate=list.length>0&&list.length<available.length;
  }
  function open(k,mode,changes){
    if(busy)return;modal={chosen:new Set(),candidates:[],initialPeriod:changes?todayISO().slice(0,7):contractCurrentPeriod(k)};
    el('ctTitle').textContent='✈️ '+L('傳送至 Telegram 群組','Send to Telegram group','ផ្ញើទៅក្រុម Telegram');
    const labels={ctModeLabel:L('傳送模式','Mode','របៀបផ្ញើ'),ctSourceLabel:L('內容來源','Content','មាតិកា'),ctBasisLabel:L('日期基準','Date basis','មូលដ្ឋានកាលបរិច្ឆេទ'),ctTypeLabel:L('期間類型','Period type','ប្រភេទពេល'),ctPeriodLabel:L('期間','Period','រយៈពេល'),ctLangLabel:L('訊息語言','Message language','ភាសាសារ'),ctActorLabel:L('申請人／檢查人 *','Applicant / Inspector *','អ្នកស្នើ / អ្នកត្រួតពិនិត្យ *'),ctSelectLabel:L('全選可發送項目','Select all eligible records','ជ្រើសធាតុដែលអាចផ្ញើ'),ctPreviewTitle:L('完整訊息預覽','Full message preview','មើលសារពេញ'),ctCancel:L('取消','Cancel','បោះបង់')};Object.keys(labels).forEach(id=>el(id).textContent=labels[id]);
    el('ctMode').value=mode;el('ctScope').value=k;el('ctBasis').value=changes?'change':k==='cont'&&DASH_CONTS.some(r=>(r.settlements||[]).length||r.latestSettlementMonth)?'settle':'end';el('ctType').value=changes?'month':selected[k].size?'selected':k==='prob'?probMode:contMode;el('ctLang').value=LANG==='km'?'km':'both';el('ctActor').value=localStorage.getItem(ACTOR)||'';
    el('ctHelp').textContent=L('2026/9/1 前到期且已通過／未通過的舊紀錄不重送；新增、修改及刪除會另送本次異動。資料結果與 Telegram 核可結果分開保存。','Decided records ending before 1 Sep 2026 are excluded. Additions, edits and deletions are sent as new revisions. Recorded results and Telegram decisions are saved separately.','មិនផ្ញើលទ្ធផលចាស់ដែលបញ្ចប់មុន 1 កញ្ញា 2026។ ការបន្ថែម កែ និងលុប ជាកំណែថ្មី។ លទ្ធផលទិន្នន័យនិងការអនុម័តរក្សាដាច់ដោយឡែក។');
    el('ctResult').textContent='';el('contractTelegramModal').classList.add('show');refill();
    refreshLedger().then(()=>{if(modal&&!busy)pick(false);}).catch(e=>{if(modal)el('ctResult').textContent=e.message;});
  }
  async function capabilities(){const url=contractGasUrl();if(capUrl===url)return;let r;try{r=await contractGasPost({action:'contractCapabilities'});}catch(e){if(!/unknown action|unsupported|not implemented/i.test(e.message))throw e;}if(!r||r.approvalSchema!=='contract-request-v1')throw new Error(L('請更新原 GAS 部署至 v54','Update the existing GAS deployment to v54','សូមដំឡើង GAS v54'));capUrl=url;}
  async function refreshLedger(){
    if(!contractGasUrl())return;const r=await contractGasPost({action:'approvalLedger',module:'contract'});ledger=r.decisions||{};let changed=false;
    for(const x of allRows()){
      const receipts=x.r._wf?.receipts||[];let dirty=false;
      receipts.forEach(rec=>{const decision=ledger[rec.key];if(rec.mode==='approval'&&decision&&['approved','rejected'].includes(decision.s)&&rec.state!==decision.s){Object.assign(rec,{state:decision.s,decidedAt:decision.at||'',decidedBy:decision.by||'',batchId:decision.b||rec.batchId});dirty=true;}});
      if(dirty){await rawPut(storage(x.k),x.r);changed=true;}
    }
    if(changed)scheduleContractSync('approval-result');decorate('prob');decorate('cont');
  }
  async function receipt(d,mode,value){
    const entry=allRows().find(x=>x.r.id===d.recordId&&x.k===d.kind);if(!entry)return;
    const r=M.ensure(entry.r,entry.k),rec={id:mode+':'+d.key,key:d.key,mode,at:new Date().toISOString(),...value};r._wf.receipts=M.union(r._wf.receipts,[rec]);
    await rawPut(storage(entry.k),r);Object.assign(entry.r,r);scheduleContractSync('receipt');
  }
  function lock(on){busy=on;el('contractTelegramModal').querySelectorAll('select,input,button').forEach(x=>x.disabled=on);if(!on)pick(false);}
  async function send(){
    if(busy||!modal||!chosen().length)return false;
    const actor=el('ctActor').value.trim();if(!actor)return false;
    const mode=el('ctMode').value,lang=el('ctLang').value,docs=chosen().map(requestFor),period=docs[0].period;
    lock(true);localStorage.setItem(ACTOR,actor);el('ctResult').textContent=L('正在發送…','Sending…','កំពុងផ្ញើ…');
    try{
      await capabilities();
      if(mode==='approval'){
        const items=docs.map(d=>({key:d.key,empId:d.after.employeeId,name:d.after.name,dept:d.after.department,group:d.after.section,position:d.after.position,period:d.period,kind:d.kind==='prob'?'probation':'contract_record',amount:d.settlement&&d.settlement.netPay!=null?Number(d.settlement.netPay):0,contractRequest:d}));
        const result=await contractGasPost({action:'approvalRequest',module:'contract',scope:el('ctScope').value,contractSchema:73,period,title:M.l(lang,'試用期／合約確認','Probation / Contract Review','ពិនិត្យសាកល្បង / កិច្ចសន្យា'),route:'review',lang,items,inspector:actor,requestedBy:actor,idempotencyKey:'ct73-'+M.hash(items.map(x=>x.key).sort()),batch:'CT73-'+M.hash(items.map(x=>x.key).sort())});
        if(!result.messageId&&!result.alreadyDecided&&!result.closed)throw new Error(L('Telegram 尚未確認送達，請重試','Telegram delivery not confirmed; retry','Telegram មិនទាន់បញ្ជាក់ការផ្ញើ; សូមព្យាយាមម្ដងទៀត'));
        for(const d of docs){const state=(result.itemStates||{})[d.key];if(state)await receipt(d,mode,state);}
        el('ctResult').textContent=result.alreadyDecided?L('所選版本已結案，沒有重送','Selected versions already completed; no resend','កំណែដែលជ្រើសបានបញ្ចប់; មិនផ្ញើឡើងវិញ'):L('核可請求已送達；待審查／核可','Approval request delivered; awaiting review / approval','បានផ្ញើសំណើ; រង់ចាំពិនិត្យ / អនុម័ត');
      }else{
        const key='summary-'+M.hash([docs.map(d=>d.key).sort(),lang,actor]),saved=JSON.parse(localStorage.getItem(OUTBOX)||'{}');
        let job=saved[key];
        if(!job){const lines=M.summaryHeader(docs,period,lang);docs.forEach((d,i)=>{lines.push('\n#'+(i+1));M.pairs(d,lang).forEach(p=>lines.push(p.join('：')));});job={docs:M.clone(docs),parts:M.chunks(lines,2600),sent:{},at:new Date().toISOString()};saved[key]=job;localStorage.setItem(OUTBOX,JSON.stringify(saved));}
        for(let i=0;i<job.parts.length;i++){
          if(job.sent[i])continue;
          el('ctResult').textContent=L('發送摘要','Sending summary','ផ្ញើសង្ខេប')+' '+(i+1)+' / '+job.parts.length;
          const r=await contractGasPost({action:'contractSummary',tool:'contract',module:'contract',messageType:'summary',period,lang,inspector:actor,deliveryKey:key+':'+i,text:'<b>'+esc(M.l(lang,'摘要','Summary','សង្ខេប'))+' '+(i+1)+'/'+job.parts.length+'</b>\n'+esc(job.parts[i])});
          if(!r.messageId)throw new Error('Telegram delivery not confirmed');
          job.sent[i]={messageId:r.messageId,at:new Date().toISOString()};saved[key]=job;localStorage.setItem(OUTBOX,JSON.stringify(saved));
          if(i+1<job.parts.length)await new Promise(resolve=>setTimeout(resolve,1200));
        }
        for(const d of job.docs)await receipt(d,'summary',{state:'sent',deliveryKey:key,messageIds:Object.values(job.sent).map(x=>x.messageId)});
        delete saved[key];localStorage.setItem(OUTBOX,JSON.stringify(saved));el('ctResult').textContent=L('完整摘要已送達','Full summary delivered','បានផ្ញើសង្ខេបពេញ');
      }
      await refreshLedger().catch(()=>{});return true;
    }catch(e){el('ctResult').textContent=L('發送未完成：','Send incomplete: ','ការផ្ញើមិនទាន់បញ្ចប់៖ ')+e.message;return false;}
    finally{lock(false);decorate('prob');decorate('cont');}
  }
  function queue(fn){const next=syncTail.then(fn,fn);syncTail=next.catch(()=>{});return next;}
  function progress(msg,type){const badge=el('hra-auto-sync-state-contract');if(badge)badge.textContent=msg;contractSetCloudDot(type==='ok'?'synced':type==='warn'?'retry':'syncing');}
  async function push(options={}){return queue(async()=>{
    if(!ready||!contractGasUrl())return false;contractSetCloudDot('syncing');
    try{const recs=flat(),r=await HRASmartSync.push({url:contractGasUrl(),tool:'contract',records:recs,recordCount:recs.length,allowDeletes:false,autoConfirmConflicts:true,mergeRecords:mergeFlat,readBatch:true,onStatus:progress,summary:{employees:EMPLOYEES.length,probation:DASH_PROBS.length,contracts:DASH_CONTS.length}});
      if(!r||r===false||r.ok===false||r.cancelled||r.needsPull)throw new Error('Cloud sync incomplete');
      if(r.records){apply(r.records);await persist();refreshAll();}contractSyncMetaWrite('push',r.uploaded||0);return r;
    }catch(e){progress(L('同步未完成：','Sync incomplete: ','សមកាលកម្មមិនទាន់ចប់៖ ')+e.message,'warn');if(!options.silent)toast(e.message,'danger');return false;}
  });}
  async function pull(options={}){return queue(async()=>{
    if(!ready||!contractGasUrl())return false;contractSetCloudDot('syncing');
    try{const r=await HRASmartSync.pullReliable({url:contractGasUrl(),tool:'contract',localRecords:flat(),mergeRecords:mergeFlat,autoConfirmConflicts:true,readBatch:true,onStatus:progress});if(!r||r.ok===false||r.cancelled)throw new Error('Cloud download incomplete');
      if(Array.isArray(r.records)){apply(r.records);reconcile();await persist();contractPublishMirrors();refreshAll();}await refreshLedger().catch(()=>{});contractSyncMetaWrite('pull',r.downloaded||0);progress(L('下載完成','Download complete','ទាញយករួច'),'ok');return r;
    }catch(e){progress(L('下載未完成：','Download incomplete: ','ទាញយកមិនទាន់ចប់៖ ')+e.message,'warn');if(!options.silent)toast(e.message,'danger');return false;}
  });}
  async function saveNow(){await persist();toast(L('本機已儲存，正在同步','Saved locally; syncing','បានរក្សាទុក; កំពុងធ្វើសមកាលកម្ម'),'success');return window.HRAAutoSync?HRAAutoSync.run('contract','save'):push({manual:true});}
  function install(){
    dbPut=put;dbDel=remove;dbClear=clear;loadAll=load;contractFlat=flat;contractApply=apply;contractPersistAll=persist;contractReconcileLegacyToDash=reconcile;
    contractMergeRows=(a,b,k)=>M.merge(a,b.map(contractStripCloud),k).map(r=>/dash_/.test(k)?M.ensure(r,k):r);normalizeProbResult=M.result;
    const rp=renderDashProb,rc=renderDashCont;renderDashProb=()=>{rp();decorate('prob');};renderDashCont=()=>{rc();decorate('cont');};toggleSelect=toggle;
    sendContractPeriodSummary=k=>open(k,'summary');sendContractPeriodApproval=k=>open(k,'approval');sendTelegramSummary=()=>{open('prob','summary');el('ctScope').value='both';refill();};syncToGas=push;pullFromGas=pull;
    contractGasPost=async payload=>{const url=contractGasUrl();if(!url)throw new Error(L('請先設定 GAS 網址','Configure the GAS URL','សូមកំណត់ GAS URL'));const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);try{const response=await fetch(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload),signal:controller.signal});const data=await response.json();if(!response.ok||data.ok===false)throw new Error(data.error||'GAS HTTP '+response.status);return data.data||data;}catch(e){if(e.name==='AbortError')throw new Error(L('連線逾時，可重試；不會標記為已送達','Connection timed out; retry. Delivery is unconfirmed.','ការតភ្ជាប់អស់ពេល; សូមព្យាយាមម្ដងទៀត'));throw e;}finally{clearTimeout(timer);}};
    installUI();
  }
  async function start(){install();await init();ready=true;if(window.HRAAutoSync)HRAAutoSync.install({key:'contract',push:async o=>{const startup=/startup|resume|pageshow|network-restored/.test(o.reason||'');if(startup){const r=await pull(o);if(r===false)return false;}return push(o);},canSync:()=>ready&&!!contractGasUrl()&&typeof HRASmartSync!=='undefined',startDelay:100});else scheduleContractSync('startup');}
  return {start,open,send,refill,pick,preview,requestFor,save:saveNow,mergeFlat,prepareLoaded,refreshLedger,selected,archive:()=>archive,allRows,eligible:M.eligible};
})();
ContractWorkflow.start().catch(e=>{console.error(e);toast('初始化錯誤 / Initialization error: '+e.message,'danger');});
