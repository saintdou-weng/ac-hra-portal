/* Contract / probation business revisions. Shared by the page and GAS v54. */
var HRAContractModel = (function () {
  'use strict';
  var CUTOFF = '2026-09-01';
  function clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
  function stable(v) {
    if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().filter(function(k){return v[k]!==undefined;}).map(function(k){return JSON.stringify(k)+':'+stable(v[k]);}).join(',') + '}';
    return JSON.stringify(v);
  }
  function hash(v) {
    var s=typeof v==='string'?v:stable(v),a=2166136261,b=5381;
    for(var i=0;i<s.length;i++){a=Math.imul(a^s.charCodeAt(i),16777619);b=Math.imul(b,33)^s.charCodeAt(i);}
    return (a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0');
  }
  function text(v){return String(v==null?'':v).trim();}
  function kind(r,k){return /prob/.test(k||r._kind||r.kind||'')?'prob':'cont';}
  function name(r){return [r.khmerSurname,r.khmerName].map(text).filter(Boolean).join(' ')||text(r.name||r.englishName)||[r.surname,r.given].map(text).filter(Boolean).join(' ');}
  function result(r){
    var s=text(r.result||r.status||'pending').toLowerCase().replace(/[\s_-]+/g,'');
    if(/^(statuspass|pass|passed|approved|ok|通過)$/.test(s))return 'passed';
    if(/^(statusfail|fail|failed|rejected|notpass|未通過)$/.test(s))return 'failed';
    if(/extend/.test(s))return 'extended';
    if(/^(pending|待評估)$/.test(s))return 'pending';
    return s;
  }
  function settlementSnapshot(r){var out={};['factoryId','name','dept','section','position','joinDate','payoutMonth','settleDate','averageSalary','avgSalary','totalSalary','severance5','annualDay','annualPaid','netPay'].forEach(function(k){if(r&&r[k]!==undefined&&r[k]!==null&&r[k]!=='')out[k]=r[k];});return out;}
  function snapshot(r,k){
    k=kind(r,k);
    var out={kind:k,employeeId:text(r.factoryId||r.empId||r.employeeId),name:name(r),department:text(r.dept||r.department),section:text(r.section||r.group),position:text(r.position),joinDate:text(r.joinDate||r.entryDate||r.startDate),deleted:!!r._deleted};
    if(k==='prob')Object.assign(out,{endDate:text(r.probEnd||r.endDate),evaluationDate:text(r.evalDate||r.evaluationDate),evaluator:text(r.evaluator),score:r.score==null||r.score===''?null:r.score,result:result(r),notes:text(r.remarks||r.notes)});
    else Object.assign(out,{contractStart:text(r.contractStart||r.startDate||r.entryDate),endDate:text(r.endDate||r.contractEnd),contractType:text(r.contractType),result:text(r.status||'active'),terminationDate:text(r.terminationDate),notes:text(r.notes||r.remarks),settlements:(r.settlements||[]).map(settlementSnapshot).sort(function(a,b){return stable(a).localeCompare(stable(b));})});
    if(k==='cont')['payoutMonth','latestSettlementMonth','averageSalary','avgSalary','totalSalary','severance5','annualDay','annualPaid','netPay'].forEach(function(f){if(r[f]!==undefined&&r[f]!==null&&r[f]!=='')out[f]=r[f];});
    return out;
  }
  function semantic(r,k){var s=snapshot(r,k);return [s.kind,s.employeeId,s.joinDate,s.contractType||'',s.endDate].join('|');}
  function identity(r,k){return text(r._cloudKey||r._k)||(r.id?(kind(r,k)==='prob'?'DP|':'DC|')+text(r.id):semantic(r,k));}
  function ensure(r,k){
    var out=clone(r)||{};k=kind(out,k);
    if(!out.id){out.id='legacy_'+hash(text(out._cloudKey||out._k)||semantic(out,k));out._derivedId=true;}
    if(!out._wf)out._wf={schema:73,base:snapshot(out,k),history:[],receipts:[]};
    return out;
  }
  function latest(r){var h=r._wf&&r._wf.history||[],current=r._wf&&r._wf.current;return (current&&h.find(function(x){return x.id===current;}))||(h.length?h[h.length-1]:null);}
  function revision(r,k){var h=latest(r);return h?h.id:'base-'+hash(snapshot(r,k));}
  function requestKey(r,k){return 'HRC73:'+kind(r,k)+':'+hash(identity(r,k))+':'+revision(r,k);}
  function edit(before,next,k,at,op){
    at=at||new Date().toISOString();k=kind(next,k);
    var prior=before?ensure(before,k):null,out=ensure(Object.assign({},before||{},next),k);
    if(!out._cloudKey)out._cloudKey=identity(out,k);
    out._deleted=!!out._deleted;
    if(prior)out._wf=clone(prior._wf);
    var a=prior?snapshot(prior,k):null,b=snapshot(out,k);
    if(prior&&stable(a)===stable(b)){out.updatedAt=prior.updatedAt;return out;}
    var parent=prior?revision(prior,k):'',change={at:at,operation:op||(b.deleted?'delete':prior?'edit':'add'),parent:parent,before:a,after:b};
    change.id=hash([identity(out,k),parent,at,a,b]);
    out._wf.history.push(change);out._wf.current=change.id;out.updatedAt=at;
    return out;
  }
  function union(a,b){var m={};(a||[]).concat(b||[]).forEach(function(v){if(!v||!v.id)return;var old=m[v.id];if(old&&/^(approved|rejected)$/.test(old.state||'')&&!/^(approved|rejected)$/.test(v.state||''))return;m[v.id]=clone(v);});return Object.keys(m).map(function(k){return m[k];}).sort(function(x,y){return text(x.at).localeCompare(text(y.at))||text(x.id).localeCompare(text(y.id));});}
  function mergeRow(a,b){
    var ar=latest(a),br=latest(b),at=text(ar&&ar.at||a.updatedAt||a.createdAt),bt=text(br&&br.at||b.updatedAt||b.createdAt);
    var newer=ar&&!br?a:br&&!ar?b:bt>at?b:at>bt?a:stable(a)>stable(b)?a:b,older=newer===a?b:a;
    var out=Object.assign({},clone(older),clone(newer));
    if(latest(newer))out._deleted=!!latest(newer).after.deleted;
    if(a._wf||b._wf){out._wf=clone(newer._wf||older._wf);out._wf.current=latest(newer)&&latest(newer).id||'';out._wf.history=union(a._wf&&a._wf.history,b._wf&&b._wf.history);out._wf.receipts=union(a._wf&&a._wf.receipts,b._wf&&b._wf.receipts);}
    return out;
  }
  function merge(a,b,k){
    var out=[],ids={},sems={};
    (a||[]).concat(b||[]).filter(Boolean).forEach(function(raw){
      var r=clone(raw),kk=k||r._kind||'',id=text(r._cloudKey||r._k||r.id),sem=semantic(r,kk),idkey=kk+'|'+id;
      var ix=ids[idkey];
      if(ix===undefined&&r.id)ix=ids[kk+'|id:'+r.id];
      if(ix===undefined)ix=sems[kk+'|'+sem];
      if(ix===undefined){ix=out.length;out.push(r);}else out[ix]=mergeRow(out[ix],r);
      ids[idkey]=ix;if(r.id)ids[kk+'|id:'+r.id]=ix;sems[kk+'|'+sem]=ix;
    });return out;
  }
  function historical(r,k){var s=snapshot(r,k);return !!s.endDate&&s.endDate<CUTOFF&&/^(passed|failed|pass|fail|approved|rejected|renewed|terminated)$/.test(s.result)&&!latest(r);}
  function receipts(r,mode,k){var key=requestKey(r,k);return (r._wf&&r._wf.receipts||[]).filter(function(x){return x.key===key&&x.mode===mode;});}
  function eligible(r,mode,k,ledger,request){
    if(historical(r,k))return {ok:false,reason:'historical'};
    if(mode==='approval'){
      var record=snapshot(r,k);
      if(!record.employeeId||!record.name)return {ok:false,reason:'incomplete'};
      if(record.kind==='prob'&&!/^(passed|failed|pending|extended)$/.test(record.result))return {ok:false,reason:'invalid_result'};
    }
    var key=request&&request.key||requestKey(r,k),receipt=(r._wf&&r._wf.receipts||[]).filter(function(x){return x.mode===mode&&x.key===key;}).slice(-1)[0],decision=(ledger||{})[key];
    if(mode==='approval'&&decision&&/^(approved|rejected|ok|no)$/.test(decision.s||decision.d||''))return {ok:false,reason:decision.s==='rejected'?'rejected':'approved'};
    if(receipt)return {ok:false,reason:mode==='summary'?'sent':receipt.state||'pending'};
    if((request?request.operation==='confirm':!latest(r))&&mode==='approval'){
      var s=snapshot(r,k),legacy=[(s.kind==='prob'?'PROB':'CONT')+'|'+s.employeeId+'|'+(s.kind==='prob'?s.endDate:s.endDate.slice(0,7)),(s.kind==='prob'?'PROB':'CONT')+'|'+s.employeeId];
      if(request&&request.settlement)legacy.push('CONT5|'+s.employeeId+'|'+String(request.settlement.payoutMonth||'').slice(0,7));
      if(legacy.some(function(x){return (ledger||{})[x];}))return {ok:false,reason:'decided'};
    }
    return {ok:true,reason:latest(r)?latest(r).operation:'new'};
  }
  function request(r,k,period,settlement){
    r=ensure(r,k);var s=snapshot(r,k),h=latest(r),rev=revision(r,k);
    if(settlement)settlement=settlementSnapshot(settlement);
    if(settlement){
      var month=String(settlement.payoutMonth||'').slice(0,7);
      function scope(v,fallback){
        if(!v)return null;var core={};['kind','employeeId','name','department','section','position','joinDate','contractStart','endDate','contractType','result','notes','deleted'].forEach(function(f){if(v[f]!==undefined)core[f]=v[f];});
        var values=(v.settlements||[]).filter(function(x){return String(x.payoutMonth||'').slice(0,7)===month;});
        if(!values.length&&String(v.latestSettlementMonth||v.payoutMonth||'').slice(0,7)===month)values=[v];
        if(!values.length&&fallback)values=[fallback];
        core.payment=values.map(function(x){var out={payoutMonth:month};['averageSalary','avgSalary','totalSalary','severance5','annualDay','annualPaid','netPay'].forEach(function(f){if(x[f]!==undefined)out[f]=x[f];});return out;}).sort(function(a,b){return stable(a).localeCompare(stable(b));});return core;
      }
      var chain=[],cursor=latest(r);while(cursor){chain.unshift(cursor);var parent=cursor.parent;cursor=r._wf.history.find(function(x){return x.id===parent;});}
      var relevant=chain.filter(function(change){return stable(scope(change.before))!==stable(scope(change.after));});
      h=relevant.length?relevant[relevant.length-1]:null;rev=h?h.id:'base-'+hash(scope(s,settlement));
    }
    return {schema:'contract-request-v1',key:'HRC73:'+s.kind+':'+hash(identity(r,k))+':'+rev+(settlement?':S:'+hash(settlement):''),recordId:r.id,recordKey:identity(r,k),revision:rev,kind:s.kind,operation:h?h.operation:'confirm',period:period,at:h&&h.at||'',original:r._wf.base,before:h&&h.before||null,after:s,settlement:clone(settlement)||null,sourceFile:text(r.sourceFile),sourceSheet:text(r.sourceSheet)};
  }
  function l(lang,z,e,km){return lang==='en'?e:lang==='km'?(km||e):lang==='both'?z+' / '+e:lang==='all3'?z+' / '+e+' / '+(km||e):z;}
  function pairs(d,lang){
    var s=d.after||{},out=[],L=function(z,e,k){return l(lang,z,e,k);},add=function(label,v){out.push([label,v===null||v===undefined||v===''?'—':String(v)]);};
    add(L('工號','Employee ID','លេខបុគ្គលិក'),s.employeeId);add(L('姓名','Name','ឈ្មោះ'),s.name);
    add(L('部門／組別','Department / Section','ផ្នែក / ក្រុម'),[s.department||'—',s.section||'—'].join(' / '));add(L('職位','Position','មុខតំណែង'),s.position);add(L('加入日','Join date','ថ្ងៃចូលធ្វើការ'),s.joinDate);
    if(s.kind==='prob'){add(L('試用到期','Probation end','បញ្ចប់សាកល្បង'),s.endDate);add(L('評估日／評估人','Evaluation date / Evaluator','ថ្ងៃវាយតម្លៃ / អ្នកវាយតម្លៃ'),[s.evaluationDate||'—',s.evaluator||'—'].join(' / '));add(L('分數','Score','ពិន្ទុ'),s.score);}
    else {add(L('合約類型','Contract type','ប្រភេទកិច្ចសន្យា'),s.contractType);add(L('合約開始／到期','Contract start / End','ចាប់ផ្តើម / បញ្ចប់កិច្ចសន្យា'),[s.contractStart||'—',s.endDate||'—'].join(' / '));if(s.terminationDate)add(L('終止日','Termination date','ថ្ងៃបញ្ចប់'),s.terminationDate);}
    add(L('資料結果','Recorded result','លទ្ធផលកត់ត្រា'),status(s.result,lang));add(L('備註','Remarks','កំណត់សម្គាល់'),s.notes);
    var st=d.settlement;
    if(st){[['payoutMonth','結算月份','Settlement month','ខែទូទាត់'],['averageSalary','平均薪資','Average salary','ប្រាក់ខែមធ្យម'],['severance5','5% 金額','5% amount','ទឹកប្រាក់ 5%'],['annualDay','年假天數','Annual leave days','ថ្ងៃឈប់សម្រាក'],['annualPaid','年假金額','Annual leave pay','ប្រាក់ថ្ងៃឈប់'],['netPay','應付金額','Net payable','ប្រាក់ត្រូវបើក']].forEach(function(x){var v=st[x[0]];if(v!=null&&v!==''&&/Salary|Paid|Pay|severance/.test(x[0])&&isFinite(Number(v)))v='$'+Number(v).toFixed(2);add(L(x[1],x[2],x[3]),v);});}
    add(L('本次動作','Action','សកម្មភាព'),status(d.operation,lang));
    if(d.before){
      Object.keys(s).filter(function(k){return stable(d.before[k])!==stable(s[k]);}).forEach(function(k){
        var titles={name:L('姓名','Name','ឈ្មោះ'),employeeId:L('工號','ID','លេខបុគ្គលិក'),endDate:L('到期日','End','ថ្ងៃបញ្ចប់'),joinDate:L('加入日','Join','ថ្ងៃចូល'),result:L('結果','Result','លទ្ធផល'),score:L('分數','Score','ពិន្ទុ'),notes:L('備註','Remarks','កំណត់សម្គាល់'),deleted:L('刪除','Deleted','លុប'),department:L('部門','Department','ផ្នែក'),section:L('組別','Section','ក្រុម'),evaluationDate:L('評估日','Evaluation','ថ្ងៃវាយតម្លៃ'),settlements:L('結算','Settlements','ការទូទាត់')};
        Object.assign(titles,{kind:L('類型','Type','ប្រភេទ'),position:L('職位','Position','មុខតំណែង'),evaluator:L('評估人','Evaluator','អ្នកវាយតម្លៃ'),contractStart:L('合約開始','Contract start','ចាប់ផ្តើមកិច្ចសន្យា'),contractType:L('合約類型','Contract type','ប្រភេទកិច្ចសន្យា'),terminationDate:L('終止日','Termination','ថ្ងៃបញ្ចប់'),payoutMonth:L('結算月份','Settlement month','ខែទូទាត់'),latestSettlementMonth:L('結算月份','Settlement month','ខែទូទាត់'),averageSalary:L('平均薪資','Average salary','ប្រាក់ខែមធ្យម'),avgSalary:L('平均薪資','Average salary','ប្រាក់ខែមធ្យម'),totalSalary:L('薪資合計','Total salary','ប្រាក់ខែសរុប'),severance5:L('5% 金額','5% amount','ទឹកប្រាក់ 5%'),annualDay:L('年假天數','Annual leave days','ថ្ងៃឈប់សម្រាក'),annualPaid:L('年假金額','Annual leave pay','ប្រាក់ថ្ងៃឈប់'),netPay:L('應付金額','Net payable','ប្រាក់ត្រូវបើក')});
        var fmt=function(v){if(v==null||v==='')return '—';if(Array.isArray(v))return v.map(function(st){return [st.payoutMonth||'—','5% '+(st.severance5==null?'—':'$'+Number(st.severance5).toFixed(2)),L('年假','Annual leave','ឈប់សម្រាក')+' '+(st.annualPaid==null?'—':'$'+Number(st.annualPaid).toFixed(2)),L('應付','Net','សរុប')+' '+(st.netPay==null?'—':'$'+Number(st.netPay).toFixed(2))].join(' · ');}).join('\n');return String(v);};
        add(L('異動','Change','ការផ្លាស់ប្តូរ')+' · '+(titles[k]||k),fmt(d.before[k])+' → '+fmt(s[k]));
      });
      if(d.original)add(L('最初結果','Original result','លទ្ធផលដើម'),status(d.original.result,lang));
    }
    if(d.sourceFile)add(L('來源','Source','ប្រភព'),[d.sourceFile,d.sourceSheet].filter(Boolean).join(' / '));
    return out;
  }
  function status(s,lang){var m={passed:['通過','Passed','ជាប់'],failed:['未通過','Failed','ធ្លាក់'],pending:['待評估','Pending evaluation','រង់ចាំវាយតម្លៃ'],extended:['延長','Extended','ពន្យារ'],approved:['已核可','Approved','បានអនុម័ត'],rejected:['已退回','Rejected','បានបដិសេធ'],active:['生效中','Active','មានសុពលភាព'],expired:['已到期','Expired','ផុតកំណត់'],renewed:['已續約','Renewed','បានបន្ត'],terminated:['已終止','Terminated','បានបញ្ចប់'],add:['新增','Add','បន្ថែម'],edit:['修改','Edit','កែប្រែ'],delete:['刪除','Delete','លុប'],confirm:['確認資料','Confirm record','បញ្ជាក់ទិន្នន័យ'],restore:['恢復','Restore','ស្ដារឡើងវិញ']};return m[s]?l(lang,m[s][0],m[s][1],m[s][2]):text(s)||'—';}
  function chunks(lines,limit){var out=[],cur='';limit=limit||2700;(lines||[]).forEach(function(line){var left=String(line);while(left.length){var room=limit-cur.length-(cur?1:0);if(room<1){out.push(cur);cur='';continue;}var take=left.slice(0,room);if(/[\uD800-\uDBFF]$/.test(take))take=take.slice(0,-1);if(!take){out.push(cur);cur='';continue;}cur+=(cur?'\n':'')+take;left=left.slice(take.length);if(left){out.push(cur);cur='';}}});if(cur)out.push(cur);return out;}
  function summaryHeader(docs,period,lang){
    var L=function(z,e,k){return l(lang,z,e,k);},out=[L('試用期／合約摘要','Probation / Contract Summary','សង្ខេបសាកល្បង / កិច្ចសន្យា'),L('期間','Period','រយៈពេល')+'：'+period,L('筆數','Records','កំណត់ត្រា')+'：'+docs.length],p=docs.filter(function(d){return d.kind==='prob';}),c=docs.filter(function(d){return d.kind==='cont';}),dept={},money=docs.filter(function(d){return d.settlement&&d.settlement.netPay!=null;});
    if(p.length)out.push(L('試用期','Probation','សាកល្បង')+' '+p.length+' · '+['passed','failed','pending','extended'].map(function(s){return status(s,lang)+' '+p.filter(function(d){return d.after.result===s;}).length;}).join(' · '));
    if(c.length)out.push(L('合約','Contracts','កិច្ចសន្យា')+' '+c.length);
    if(money.length)out.push(L('結算筆數','Settlement records','កំណត់ត្រាទូទាត់')+' '+money.length+' · '+L('應付合計','Total payable','ទឹកប្រាក់សរុប')+' $'+money.reduce(function(n,d){return n+Number(d.settlement.netPay);},0).toFixed(2));
    docs.forEach(function(d){var dep=d.after.department||'—';dept[dep]=(dept[dep]||0)+1;});Object.keys(dept).sort().forEach(function(dep){out.push(L('部門','Department','ផ្នែក')+' '+dep+'：'+dept[dep]);});return out;
  }
  return {cutoff:CUTOFF,clone:clone,stable:stable,hash:hash,kind:kind,name:name,result:result,snapshot:snapshot,semantic:semantic,identity:identity,ensure:ensure,latest:latest,revision:revision,requestKey:requestKey,edit:edit,merge:merge,mergeRow:mergeRow,historical:historical,receipts:receipts,eligible:eligible,request:request,l:l,pairs:pairs,status:status,chunks:chunks,union:union,summaryHeader:summaryHeader};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=HRAContractModel;
