/* Probation workbook parsing and one import entry point, v74. */
var ContractImporter = (function () {
  'use strict';
  const txt=v=>String(v==null?'':v).trim(), norm=v=>txt(v).toLowerCase().replace(/[\s_.\/-]+/g,'');
  const labels={id:['factoryid','employeeid','empid','id','vrtcode','工號'],name:['name','employeename','khmername','姓名'],surname:['surname','khmersurname','familyname','姓'],given:['givenname','firstname','名'],join:['joindate','joiningdate','dateofjoining','入職日','加入日'],end:['probationdate','probationend','probationenddate','endprobation','試用到期','enddate'],eval:['evaluationdate','evaldate','assessmentdate','評估日'],score:['score','marks','point','分數'],result:['result','probationresult','status','結果'],dept:['linedept','dept','department','deparment','部門'],section:['section','line','group','組別'],position:['position','jobtitle','職位'],remarks:['remark','remarks','note','notes','備註']};
  const L=(z,e,k)=>HRAContractModel.l(LANG,z,e,k);
  let importing=false;
  function date(v,wb){
    if(v===''||v==null)return '';
    if(typeof v==='number'){const d=XLSX.SSF.parse_date_code(v,{date1904:!!wb.Workbook?.WBProps?.date1904});return d?d.y+'-'+String(d.m).padStart(2,'0')+'-'+String(d.d).padStart(2,'0'):'';}
    if(Object.prototype.toString.call(v)==='[object Date]')return normalizeDate(v);
    return normalizeDate(v);
  }
  function parse(wb,fileName){
    const records=[],sheets=[],warnings=[];
    for(const sheetName of wb.SheetNames){
      if(/chart|graph/i.test(sheetName))continue;
      const sheet=wb.Sheets[sheetName],rows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:true});
      let hi=-1,map,split=false;
      for(let i=0;i<Math.min(rows.length,40);i++){
        const top=rows[i]||[],sub=rows[i+1]||[],h=top.map(norm);
        if(!h.some(x=>labels.id.includes(x))||!h.some(x=>labels.join.includes(x)))continue;
        const m={},headerSub=sub.map(norm);Object.keys(labels).forEach(k=>{m[k]=h.findIndex(x=>labels[k].includes(x));if(m[k]<0)m[k]=headerSub.findIndex(x=>labels[k].includes(x));});
        if(m.end<0||m.result<0||(!top.concat(sub).some(v=>/probation|試用/i.test(txt(v)))&&m.score<0))continue;
        hi=i;map=m;
        split=m.name>=0&&m.name+2===m.join&&!txt(top[m.name+1])&&!txt(sub[m.name+1]);
        break;
      }
      if(hi<0)continue;
      let count=0;
      for(let i=hi+1;i<rows.length;i++){
        const row=rows[i],id=txt(row[map.id]).replace(/\.0$/,'');
        if(!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id)||labels.id.includes(norm(id)))continue;
        const join=date(row[map.join],wb),end=date(row[map.end],wb);
        if(!join&&!end){if(/^\d+$/.test(id))warnings.push(sheetName+' #'+(i+1)+': '+id+' missing dates');continue;}
        const r={factoryId:id,joinDate:join,probEnd:end,source:'excel',sourceFile:fileName,sourceSheet:sheetName,sourceRow:i+1};
        if(split){r.khmerSurname=txt(row[map.name]);r.khmerName=txt(row[map.name+1]);r.name=[r.khmerSurname,r.khmerName].filter(Boolean).join(' ');}
        else if(map.surname>=0||map.given>=0){r.khmerSurname=txt(row[map.surname]);r.khmerName=txt(row[map.given]);r.name=[r.khmerSurname,r.khmerName].filter(Boolean).join(' ')||txt(row[map.name]);}
        else if(map.name>=0){r.name=txt(row[map.name]);r.khmerSurname='';r.khmerName=r.name;}
        if(map.eval>=0)r.evalDate=date(row[map.eval],wb);
        if(map.score>=0){const score=txt(row[map.score]);r.score=score!==''&&Number.isFinite(Number(score))?Number(score):null;}
        r.result=HRAContractModel.result({result:txt(row[map.result])||'pending'});
        for(const f of ['dept','section','position','remarks'])if(map[f]>=0)r[f]=txt(row[map[f]]);
        if(!HRAContractModel.name(r))warnings.push(sheetName+' #'+(i+1)+': '+id+' missing name');
        records.push(r);count++;
      }
      sheets.push({name:sheetName,count});
    }
    return {records,sheets,warnings};
  }
  async function apply(parsed){
    let added=0,updated=0,unchanged=0,conflicts=0;
    for(const source of parsed.records){
      const same=DASH_PROBS.concat(ContractWorkflow.archive().filter(r=>HRAContractModel.kind(r)==='prob')).filter(r=>String(r.factoryId||'')===source.factoryId);
      let matches=same.filter(r=>String(r.joinDate||'')===source.joinDate);
      if(!matches.length)matches=same.filter(r=>!r.joinDate);
      if(!matches.length)matches=same.filter(r=>{
        const offsets=['joinDate','probEnd','evalDate'].filter(k=>r[k]&&source[k]).map(k=>(Date.parse(source[k]+'T00:00:00Z')-Date.parse(r[k]+'T00:00:00Z'))/86400000);
        return offsets.length>=2&&Math.abs(offsets[0])===1&&offsets.every(d=>d===offsets[0]);
      });
      if(matches.length>1){conflicts++;parsed.warnings.push(source.sourceSheet+': '+source.factoryId+' has multiple matching records');continue;}
      const old=matches[0],now=new Date().toISOString();
      if(old?._deleted){conflicts++;parsed.warnings.push(source.factoryId+': '+L('本機已刪除；未自動恢復','Deleted locally; not restored automatically','បានលុប; មិនស្ដារដោយស្វ័យប្រវត្តិ'));continue;}
      let r={...old,...source,id:old?.id||uid('dp'),createdAt:old?.createdAt||now,updatedAt:now,importedAt:now};
      if(old&&HRAContractModel.stable(HRAContractModel.snapshot(old,'prob'))===HRAContractModel.stable(HRAContractModel.snapshot(r,'prob'))){unchanged++;continue;}
      await dbPut('dashProbs',r);
      if(old){DASH_PROBS[DASH_PROBS.findIndex(x=>x.id===old.id)]=r;updated++;}else{DASH_PROBS.push(r);added++;}
    }
    return {added,updated,unchanged,conflicts};
  }
  async function importFiles(evt){
    const files=Array.from(evt?.target?.files||evt?.dataTransfer?.files||[]);if(!files.length||importing)return;
    importing=true;open();
    const result=document.getElementById('contractImportDetail'),brief=document.getElementById('contractSmartImportResult');
    result.removeAttribute('data-ct-label');brief.removeAttribute('data-ct-label');
    result.textContent=L('正在讀取 Excel…','Reading Excel…','កំពុងអាន Excel…');
    const outcomes=[];let total=0,prob=false,cont=false;
    try{
      await ContractWorkflow.batch(async()=>{
        for(const f of files){
          if(!/\.(xlsx|xls)$/i.test(f.name))throw new Error(L('請選擇 Excel 檔案','Select an Excel workbook','សូមជ្រើសឯកសារ Excel'));
          const wb=XLSX.read(await f.arrayBuffer(),{type:'array',cellDates:false}),p=parse(wb,f.name);
          if(p.records.length){const n=await apply(p);prob=true;total+=p.records.length;outcomes.push(f.name+'\n'+L('試用期','Probation','សាកល្បង')+' '+p.records.length+' · '+L('新增','Added','បន្ថែម')+' '+n.added+' / '+L('更新','Updated','កែប្រែ')+' '+n.updated+' / '+L('未變','Unchanged','មិនផ្លាស់ប្តូរ')+' '+n.unchanged+' / '+L('待確認','Review','ពិនិត្យ')+' '+n.conflicts+'\n'+p.sheets.map(s=>s.name+' '+s.count).join(' · ')+(p.warnings.length?'\n'+p.warnings.join('\n'):''));}
          const m=await contractImportMasterFromWorkbook(wb,f.name),st=contractSettlementRowsFromWorkbook(wb,f.name);
          if(st.length)await contractApplySettlementRows(st);
          const count=m.added+m.updated+st.length;
          if(count){cont=true;total+=count;outcomes.push(f.name+'\n'+L('合約','Contract','កិច្ចសន្យា')+' '+(m.added+m.updated)+' · 5% '+st.length);}
          if(!p.records.length&&!count)outcomes.push(f.name+'\n'+L('未找到可匯入的試用期、合約或 5% 明細，沒有更新資料。','No supported probation, contract or 5% rows found. No data changed.','មិនមានទិន្នន័យសាកល្បង កិច្ចសន្យា ឬ 5%។'));
        }
      });
      ContractWorkflow.prepareLoaded();
      if(prob){setInitialDashPivot('prob');renderDashProb();}
      if(cont){rebuildDashPeriods('cont');renderDashCont();}
      rebuildOverviewPeriods();renderDashboard();
      result.textContent=outcomes.join('\n\n');brief.textContent=L('本次讀取','Read','អាន')+' '+total+' '+L('筆；明細請開啟匯入視窗','rows; open Import for details','កំណត់ត្រា');
      if(total){document.querySelector('nav button[data-page="'+(prob?'probation':'contracts')+'"]').click();toast(L('匯入已儲存，正在同步','Import saved; syncing','បានរក្សាទុក; កំពុងធ្វើសមកាលកម្ម'),'success');}
      else toast(L('沒有匯入資料，請查看說明','Nothing imported; see details','មិនបាននាំចូល; មើលព័ត៌មាន'),'warning');
      return {total,outcomes};
    }catch(e){result.textContent=outcomes.join('\n\n')+'\n'+L('匯入未完成：','Import incomplete: ','ការនាំចូលមិនទាន់ចប់៖ ')+e.message;toast(e.message,'danger');return {error:e.message,total};}
    finally{importing=false;if(evt?.target)evt.target.value='';}
  }
  function localize(){
    const labels={upload:['上傳','Upload','ផ្ទុកឡើង'],download:['下載','Download','ទាញយក'],backup:['備份','Backup','បម្រុងទុក'],smartImport:['智慧匯入','Smart Import','នាំចូលឆ្លាតវៃ'],importHelp:['可同時選擇試用期、合約、5% 結算 Excel；依表頭辨識並合併。','Select probation, contract and 5% settlement workbooks together; rows are matched by their headers.','ជ្រើស Excel សាកល្បង កិច្ចសន្យា និង 5% រួមគ្នា; ស្គាល់តាមក្បាលតារាង។'],chooseExcel:['📂 選擇 Excel','📂 Choose Excel','📂 ជ្រើស Excel'],noFiles:['尚未匯入','No files imported','មិនទាន់នាំចូលឯកសារ'],close:['關閉','Close','បិទ'],importDrop:['可選多個檔案，或將 Excel 拖到此處。','Select workbooks or drop them here.','ជ្រើសឯកសារ ឬអូស Excel មកទីនេះ។']};
    document.querySelectorAll('[data-ct-label]').forEach(node=>{const values=labels[node.dataset.ctLabel];if(values)node.textContent=L(...values);});
  }
  function open(){localize();document.getElementById('contractImportModal')?.classList.add('show');}
  function close(){if(!importing)document.getElementById('contractImportModal')?.classList.remove('show');}
  function install(){
    smartImportContractFiles=importFiles;importProbDash=importFiles;
    const div=document.createElement('div');div.id='contractImportModal';div.className='modal-bg ct-import';
    div.innerHTML='<div class="modal" role="dialog" aria-modal="true" aria-labelledby="ciTitle"><h3 id="ciTitle" data-ct-label="smartImport">智慧匯入</h3><p>Probation List · Contract Master · 5% Finish Contract</p><button type="button" class="btn" id="ciChoose" data-ct-label="chooseExcel">選擇 Excel</button><pre id="contractImportDetail" role="status" data-ct-label="importDrop">可選多個檔案，或將 Excel 拖到此處。</pre><footer><button class="btn ghost" id="ciClose" data-ct-label="close">關閉</button></footer></div>';
    document.body.appendChild(div);document.getElementById('ciChoose').onclick=()=>document.getElementById('contractSmartFiles').click();document.getElementById('ciClose').onclick=close;
    div.ondragover=e=>{e.preventDefault();};div.ondrop=e=>{e.preventDefault();importFiles(e);};
  }
  return {parse,apply,importFiles,open,close,install,localize};
})();
