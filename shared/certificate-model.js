/* Certificate import and snapshot reconciliation. No network or storage side effects. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.HRACertificateModel=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const copy=x=>JSON.parse(JSON.stringify(x));
  const norm=x=>String(x==null?'':x).normalize('NFKC').toUpperCase().replace(/[^A-Z0-9\u1780-\u17FF]/g,'');
  function english(x){
    let s=String(x||'');while(/\([^()]*\)/.test(s))s=s.replace(/\([^()]*\)/g,'');
    return norm(s.replace(/\([^)]*$/,'').replace(/[\u1780-\u17FF\u200B-\u200D]/g,''));
  }
  const certIdentity=x=>norm(x.category)+'|'+norm(x.name);
  const certAlias=x=>english(x.category)+'|'+english(x.name);
  const personIdentity=x=>norm(x.employeeId)||norm(x.passport)||(norm(x.nameEn)+'|'+String(x.dob||''));
  const fields=['category','name','department','cost','costText','costIsRate','startDate','expiryDate','renewalDate','remark','contact','status','completedForDate','sourceFile','sourceSheet','sourceYear','sourceRank','sourceRow','highlighted','source','certificateManaged'];
  const personFields=['nameEn','nameKh','nickname','sex','dob','nationality','passport','passportExpiry','visaExpiry','joinDate','phone','visaApplyDate','visaReceivedDate','visaNumber','visaExpense','workPermitApplyDate','workPermitReceivedDate','workPermitNumber','workPermitExpense','residenceApplyDate','residenceReceivedDate','residenceExpense','residenceCertificateApplyDate','residenceCertificateExpense','status','remark','sourceFile','sourceSheet','sourceYear','sourceRank','rosterManaged','source'];
  function hash(x){let h=2166136261;for(const c of JSON.stringify(x)){h^=c.codePointAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(16);}
  function selected(x,ks){const o={};ks.forEach(k=>{if(x[k]!==undefined)o[k]=x[k];});return o;}
  function current(c){return !c.notInLatest&&c.status!=='not_in_latest'&&!c.supersededBy;}
  function managed(c,kind){return kind==='person'?!!c.rosterManaged:!!c.certificateManaged||c.source==='excel';}
  function archive(x,at){
    const row=selected(x,fields.concat(personFields,['id','employeeId','department','evidence','completedForDate','updatedAt']));
    x.importHistory=x.importHistory||[];
    if(!x.importHistory.some(h=>hash(h.record)===hash(row)))x.importHistory.push({at,record:copy(row)});
  }
  function pickCertificate(rows,c){
    const exact=rows.filter(x=>certIdentity(x)===certIdentity(c));
    const candidates=exact.length?exact:rows.filter(x=>certAlias(x)===certAlias(c));
    return candidates.slice().sort((a,b)=>(current(b)?1:0)-(current(a)?1:0)||String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')))[0];
  }
  function pickPerson(rows,p){
    return rows.find(x=>(p.employeeId&&norm(x.employeeId)===norm(p.employeeId))||(p.passport&&norm(x.passport)===norm(p.passport))||(p.nameEn&&p.dob&&norm(x.nameEn)===norm(p.nameEn)&&x.dob===p.dob));
  }
  function mergeRow(a,b){
    a=a||{};b=b||{};
    const newer=Number(a.cvSchema||0)!==Number(b.cvSchema||0)?(Number(a.cvSchema||0)>Number(b.cvSchema||0)?a:b):(String(a.updatedAt||'')>String(b.updatedAt||'')?a:b);
    const older=newer===a?b:a,o=Object.assign({},older,newer);
    // An explicit blank in a new import clears the old value, including N/A dates.
    if(!newer.cvSchema)Object.keys(older).forEach(k=>{if((o[k]==null||o[k]==='')&&older[k]!=null)o[k]=older[k];});
    ['versions','history','importHistory','evidence'].forEach(k=>{
      if(!Array.isArray(a[k])&&!Array.isArray(b[k]))return;
      const map=new Map();[].concat(older[k]||[],newer[k]||[]).forEach(v=>map.set(k==='versions'?(v.effectiveFrom||v.updatedAt||hash(v)):k==='evidence'?(v.id||v.url||hash(v)):hash(v),v));o[k]=[...map.values()];
    });
    return o;
  }
  function mergeSettings(a,b){
    const out=Object.assign({},b||{},a||{});
    ['certificateSnapshot','peopleSnapshot'].forEach(k=>{
      const x=a&&a[k],y=b&&b[k];out[k]=!x?y:!y?x:String(x.at)>=String(y.at)?x:y;
    });
    if(out.peopleSnapshot){out.latestRosterYear=out.peopleSnapshot.year;out.latestRosterRank=out.peopleSnapshot.rank;}
    return out;
  }
  function reconcileCurrent(state){
    ['certificate','person'].forEach(kind=>{
      const snap=state.settings[kind==='certificate'?'certificateSnapshot':'peopleSnapshot'];
      if(!snap||!Array.isArray(snap.entries))return;
      const rows=kind==='certificate'?state.certificates:state.people,ids=new Set();
      snap.entries.forEach(entry=>{
        let x=rows.find(r=>r.id===entry.id);
        if(!x){x=copy(entry);rows.push(x);}
        if(!x.cvSchema||String(x.cvRevisionAt||'')<String(snap.at))Object.assign(x,copy(entry));
        ids.add(x.id);
      });
      rows.forEach(x=>{
        if(ids.has(x.id)||(!snap.scopeAll&&!managed(x,kind)))return;
        // Records explicitly added by a later partial import retain their scope.
        if(x.cvSchema&&String(x.cvRevisionAt||'')>String(snap.at))return;
        x.notInLatest=true;
        if(kind==='person'&&x.status!=='resigned')x.status='not_in_latest';
        x.cvSchema=72;x.cvRevisionAt=snap.at;x.updatedAt=String(x.updatedAt||'')>String(snap.at)?x.updatedAt:snap.at;
      });
    });
    return state;
  }
  function applyCurrent(state,parsed,opt){
    opt=opt||{};const at=opt.at||new Date().toISOString(),id=opt.uid||((p)=>p+'_'+hash([at,Math.random()]));
    const stat={ca:0,cu:0,pa:0,pu:0,dupe:0,archived:0,missing:0};
    const incoming=parsed.certificates||[],year=incoming.reduce((n,c)=>Math.max(n,c.sourceYear||0),0),prev=state.settings.certificateSnapshot;
    const accept=!prev||!year||year>=prev.year;
    const entries=[];
    if(accept)incoming.forEach(raw=>{
      const c=copy(raw);c.certificateManaged=true;
      let x=pickCertificate(state.certificates,c);
      if(x){
        if(hash(selected(x,fields))===hash(selected(c,fields)))stat.dupe++;
        else{archive(x,at);stat.cu++;}
      }else{x={id:id('cert'),createdAt:at};state.certificates.push(x);stat.ca++;}
      Object.assign(x,selected(c,fields),{notInLatest:false,supersededBy:'',cvSchema:72,cvRevisionAt:at,updatedAt:at});
      // Keep prior evidence and online versions while making the imported dates current.
      const importedVersion=Object.assign(selected(x,['startDate','expiryDate','renewalDate','cost','costText','costIsRate','remark']),{effectiveFrom:String(x.startDate||at).slice(0,7),updatedAt:at,source:'excel',evidence:copy(x.evidence||[])});
      x.versions=x.versions||[];
      const v=x.versions.find(v=>v.effectiveFrom===importedVersion.effectiveFrom&&v.source==='excel');
      if(v)Object.assign(v,importedVersion);else x.versions.push(importedVersion);
      entries.push(Object.assign(selected(x,fields),{id:x.id,createdAt:x.createdAt,cvSchema:72,cvRevisionAt:at,updatedAt:at,notInLatest:false}));
    });
    if((entries.length||parsed.certificateScopeRecognized)&&opt.complete!==false){
      const before=state.certificates.filter(c=>current(c)).length;
      state.settings.certificateSnapshot={schema:1,id:hash(entries.map(x=>selected(x,fields))),at,year,file:opt.file||'',scopeAll:true,entries};
      reconcileCurrent(state);stat.archived=Math.max(0,before-state.certificates.filter(c=>current(c)).length);
    }
    const snaps=(parsed.snapshots||[]).filter(s=>Array.isArray(s.records)).slice().sort((a,b)=>b.rank-a.rank),s=snaps[0];
    if(s&&(!state.settings.peopleSnapshot||s.rank>=state.settings.peopleSnapshot.rank)){
      const pentries=[];
      s.records.forEach(raw=>{
        const p=copy(raw);let x=pickPerson(state.people,p);
        if(x){if(hash(selected(x,personFields))===hash(selected(p,personFields)))stat.dupe++;else{archive(x,at);stat.pu++;}}
        else{x={id:id('person'),department:state.settings.defaultDepartment||'',employeeId:'',createdAt:at,history:[]};state.people.push(x);stat.pa++;}
        Object.assign(x,selected(p,personFields),{lastSnapshotRank:s.rank,notInLatest:false,cvSchema:72,cvRevisionAt:at,updatedAt:at});
        (p.explicitExpiryFields||[]).forEach(k=>{if(['workPermitExpiry','residenceExpiry'].includes(k))x[k]=p[k]||'';});
        // Work permit issue/received dates do not establish its expiry date.
        pentries.push(Object.assign(selected(x,personFields.concat(['employeeId','department','workPermitExpiry','residenceExpiry'])),{id:x.id,createdAt:x.createdAt,cvSchema:72,cvRevisionAt:at,updatedAt:at,notInLatest:false,lastSnapshotRank:s.rank}));
      });
      if(opt.complete!==false){state.settings.peopleSnapshot={schema:1,id:hash(pentries.map(x=>selected(x,personFields))),at,year:s.year,rank:s.rank,file:opt.file||'',sheet:s.sheet,scopeAll:true,entries:pentries};}
      state.settings.latestRosterYear=s.year;state.settings.latestRosterRank=s.rank;
      reconcileCurrent(state);stat.missing=state.people.filter(p=>p.status==='not_in_latest').length;
    }
    return stat;
  }
  function monthAt(d){d=d||new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');}
  function asOf(state,month){
    const snaps=(state.monthlySnapshots||[]).filter(s=>s.effectiveFrom<=month).sort((a,b)=>String(a.effectiveFrom).localeCompare(String(b.effectiveFrom))||String(a.at).localeCompare(String(b.at))||Number(a.revisionSequence||0)-Number(b.revisionSequence||0)||String(a.id).localeCompare(String(b.id)));
    return snaps.length?snaps[snaps.length-1]:state;
  }
  function baseline(state,at){
    state.monthlySnapshots=state.monthlySnapshots||[];
    if(state.monthlySnapshots.length)return;
    state.monthlySnapshots.push({id:'cv-baseline-'+hash([state.certificates,state.people]),effectiveFrom:'0000-01',at,baseline:true,certificates:copy(state.certificates),people:copy(state.people)});
  }
  function changes(before,after,kind){
    const active=r=>kind==='person'?r.status==='active'&&!r.notInLatest:current(r);
    const keys=kind==='person'?personFields:fields;
    const a=new Map(before.filter(active).map(r=>[r.id,r])),b=new Map(after.filter(active).map(r=>[r.id,r]));
    const label=r=>({id:r.id,name:kind==='person'?(r.nickname||r.nameEn):r.name,category:r.category||r.department||'',expiryDate:r.expiryDate||r.visaExpiry||'',renewalDate:r.renewalDate||''});
    return {added:[...b].filter(([id])=>!a.has(id)).map(([,r])=>label(r)),removed:[...a].filter(([id])=>!b.has(id)).map(([,r])=>label(r)),updated:[...b].filter(([id,r])=>a.has(id)&&hash(selected(r,keys.filter(k=>!/^source|highlight/.test(k))))!==hash(selected(a.get(id),keys.filter(k=>!/^source|highlight/.test(k))))).map(([id,r])=>Object.assign(label(r),{before:label(a.get(id))}))};
  }
  function saveRevision(state,opt){
    opt=opt||{};const at=opt.at||new Date().toISOString(),month=opt.month||monthAt();baseline(state,at);
    const prior=opt.before||asOf(state,month),certificates=copy(state.certificates),people=copy(state.people);
    const parts=month.split('-').map(Number),previousMonth=monthAt(new Date(parts[0],parts[1]-2,1)),monthBefore=asOf(state,previousMonth);
    const diff={certificates:changes(monthBefore.certificates||[],certificates,'certificate'),people:changes(monthBefore.people||[],people,'person')};
    const importChanges={certificates:changes(prior.certificates||[],certificates,'certificate'),people:changes(prior.people||[],people,'person')};
    const revisionSequence=1+Math.max(0,...state.monthlySnapshots.map(s=>Number(s.revisionSequence||0)));
    const revision={id:'cv-'+month+'-'+hash([at,revisionSequence,certificates,people]),effectiveFrom:month,at,revisionSequence,sourceFile:opt.file||'',certificates,people,changes:diff,importChanges,cvSchema:72};
    state.monthlySnapshots.push(revision);return revision;
  }
  function reconcile(state){
    if(!(state.monthlySnapshots||[]).length)return reconcileCurrent(state);
    const snap=asOf(state,monthAt());
    if(snap!==state){state.certificates=copy(snap.certificates||[]);state.people=copy(snap.people||[]);}
    return state;
  }
  function apply(state,parsed,opt){
    opt=opt||{};const at=opt.at||new Date().toISOString(),month=opt.month||monthAt();baseline(state,at);
    const previous=asOf(state,month),work={certificates:copy(previous.certificates||[]),people:copy(previous.people||[]),settings:Object.assign({},state.settings,{certificateSnapshot:null,peopleSnapshot:null})};
    const stat=applyCurrent(work,parsed,opt);
    state.certificates=work.certificates;state.people=work.people;
    state.settings.latestRosterYear=work.settings.latestRosterYear;state.settings.latestRosterRank=work.settings.latestRosterRank;
    const revision=saveRevision(state,{at,month,file:opt.file,before:previous});
    stat.effectiveFrom=month;stat.revisionId=revision.id;
    reconcile(state);return stat;
  }
  return {hash,certIdentity,certAlias,personIdentity,pickCertificate,pickPerson,mergeRow,mergeSettings,reconcile,apply,current,asOf,saveRevision,baseline,monthAt};
});
