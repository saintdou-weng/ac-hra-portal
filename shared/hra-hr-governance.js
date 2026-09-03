(function(g){
'use strict';
var KEY='ac_hra_hr_conflicts_v1';
function now(){return new Date().toISOString()}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function read(){try{return JSON.parse(localStorage.getItem(KEY)||'[]')||[]}catch(e){return[]}}
function write(a){try{localStorage.setItem(KEY,JSON.stringify(a||[]))}catch(e){}}
function same(a,b){return String(a==null?'':a).trim()===String(b==null?'':b).trim()}
function stampConflict(x){var a=read(),id='C'+Date.now()+Math.random().toString(36).slice(2,7);a.unshift(Object.assign({id:id,at:now(),resolved:false},x||{}));a=a.slice(0,500);write(a);return id}
function list(module,unresolved){return read().filter(function(x){return (!module||x.module===module)&&(!unresolved||!x.resolved)})}
function resolve(id){var a=read();a.forEach(function(x){if(x.id===id){x.resolved=true;x.resolvedAt=now()}});write(a)}
function safeMerge(existing,incoming,opt){
  opt=opt||{};var out=Object.assign({},existing||{}), conflicts=[];
  var critical=opt.criticalFields||[], approved=!!opt.approved;
  Object.keys(incoming||{}).forEach(function(k){
    var v=incoming[k]; if(v===undefined||v===null||v==='')return;
    if(['id','_k','createdAt'].indexOf(k)>=0)return;
    var old=out[k];
    if(old!==undefined&&old!==null&&old!==''&&!same(old,v) && (approved||critical.indexOf(k)>=0)){
      var c={module:opt.module||'',recordKey:opt.recordKey||out._k||out.id||'',employeeId:opt.employeeId||out.empId||out.factoryId||out.idNo||'',field:k,systemValue:old,importValue:v,sourceFile:opt.sourceFile||incoming.sourceFile||'',reason:approved?'approved-record-locked':'business-field-mismatch'};
      c.id=stampConflict(c);conflicts.push(c);return;
    }
    out[k]=v;
  });
  out.sourceFiles=Array.from(new Set([].concat(existing&&existing.sourceFiles||[],incoming&&incoming.sourceFiles||[],incoming&&incoming.sourceFile||[]).filter(Boolean)));
  if(incoming&&incoming.sourceFile)out.lastImportFile=incoming.sourceFile;
  if(incoming&&incoming.importedAt)out.lastImportedAt=incoming.importedAt;
  out.updatedAt=now();
  if(conflicts.length){out._conflictCount=(out._conflictCount||0)+conflicts.length;out._lastConflictAt=now();}
  return {record:out,conflicts:conflicts};
}
function openConflictCenter(module,title){
  var rows=list(module,true),w=window.open('','_blank'); if(!w)return;
  var html='<!doctype html><meta charset="utf-8"><title>'+esc(title||'HR Data Conflicts')+'</title><style>body{font:13px Arial;margin:20px;color:#1f2937}h1{font-size:20px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #d1d5db;padding:7px;vertical-align:top}th{background:#eef2f7}code{font-size:11px}.muted{color:#64748b}.bad{color:#b91c1c;font-weight:700}button{padding:5px 9px}</style><h1>⚠ '+esc(title||'HR Data Conflict Review')+'</h1><p class="muted">Excel / system dates are never silently overwritten when a protected business field differs. Edit the source record in the module, then mark the conflict resolved.</p>';
  if(!rows.length)html+='<p>✅ No unresolved conflicts.</p>'; else {html+='<table><thead><tr><th>Employee / Key</th><th>Field</th><th>System / confirmed</th><th>Excel proposed</th><th>Source</th><th>Action</th></tr></thead><tbody>';rows.forEach(function(x){html+='<tr><td><b>'+esc(x.employeeId||'—')+'</b><br><code>'+esc(x.recordKey||'')+'</code></td><td>'+esc(x.field)+'</td><td class="bad">'+esc(x.systemValue)+'</td><td>'+esc(x.importValue)+'</td><td>'+esc(x.sourceFile||'—')+'<br><span class="muted">'+esc(x.at||'')+'</span></td><td><button onclick="window.opener.HRAHRGovernance.resolveConflict(\''+esc(x.id)+'\');this.closest(\'tr\').remove()">Mark resolved</button></td></tr>'});html+='</tbody></table>'}
  w.document.write(html);w.document.close();
}
function openPrint(opt){
  opt=opt||{};var rows=opt.rows||[],cols=opt.columns||[],w=window.open('','_blank'); if(!w)return;
  var css='@page{size:A4 landscape;margin:9mm}body{font:10px Arial;color:#111}h1{font-size:18px;margin:0 0 4px}.meta{font-size:10px;color:#555;margin-bottom:8px}.box{border:1px solid #999;padding:7px;margin:6px 0}table{border-collapse:collapse;width:100%;table-layout:auto}th,td{border:1px solid #999;padding:4px 5px;vertical-align:top}th{background:#e9eef5;-webkit-print-color-adjust:exact;print-color-adjust:exact}thead{display:table-header-group}tr{page-break-inside:avoid}.sign{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:18px}.sign div{border-top:1px solid #555;padding-top:5px;text-align:center}.small{font-size:9px;color:#555}';
  var h='<!doctype html><meta charset="utf-8"><title>'+esc(opt.title||'HR Application')+'</title><style>'+css+'</style><h1>'+esc(opt.title||'HR Application')+'</h1><div class="meta">VANTAGE RIVER TEXTILES CO., LTD · '+esc(opt.subtitle||'')+' · Printed '+esc(new Date().toLocaleString())+'</div>';
  if(opt.note)h+='<div class="box">'+esc(opt.note)+'</div>';
  h+='<table><thead><tr>'+cols.map(function(c){return '<th>'+esc(c.label)+'</th>'}).join('')+'</tr></thead><tbody>';
  rows.forEach(function(r){h+='<tr>'+cols.map(function(c){var v=typeof c.value==='function'?c.value(r):r[c.key];return '<td>'+esc(v==null?'':v)+'</td>'}).join('')+'</tr>'});
  h+='</tbody></table><div class="small">Records: '+rows.length+'</div><div class="sign"><div>Prepared by / 製表</div><div>Checked by / 審核</div><div>Approved by / 核准</div></div><script>window.onload=function(){setTimeout(function(){window.print()},200)}<\/script>';
  w.document.write(h);w.document.close();
}
g.HRAHRGovernance={safeMerge:safeMerge,logConflict:stampConflict,listConflicts:list,resolveConflict:resolve,openConflictCenter:openConflictCenter,openPrint:openPrint};
})(window);
