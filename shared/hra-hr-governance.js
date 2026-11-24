(function(g){
'use strict';
var KEY='ac_hra_hr_conflicts_v1';
function now(){return new Date().toISOString()}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function read(){try{return JSON.parse(localStorage.getItem(KEY)||'[]')||[]}catch(e){return[]}}
function write(a){try{localStorage.setItem(KEY,JSON.stringify(a||[]))}catch(e){}}
/* v2（2026-11-24 Paul：入／離職一直出現衝突要處理）
   · 比對前先正規化：日期只比 YYYY-MM-DD、數字比數值、英文不分大小寫、多餘空白不算 → 格式不同不再算衝突
   · 同一筆、同一欄、同一個 Excel 值，沒處理前只記一次（重複匯入不會一直增加）
   · 已核可的紀錄：只有關鍵欄位（日期）不同才算衝突；其他欄位保留系統值，不再每次都跳衝突
   · 衝突中心改在本頁開（不另開視窗），每一列可「保留系統值」或「採用 Excel 值」 */
function norm(v){var s=String(v==null?'':v).replace(/\s+/g,' ').trim();var m=s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})(?:[T ].*)?$/);if(m)return m[1]+'-'+('0'+m[2]).slice(-2)+'-'+('0'+m[3]).slice(-2);if(/^-?\d+(\.\d+)?$/.test(s))return String(+s);return s.toLowerCase()}
function same(a,b){return norm(a)===norm(b)}
function stampConflict(x){x=x||{};var a=read(),hit=null;a.some(function(c){if(!c.resolved&&c.module===x.module&&String(c.recordKey)===String(x.recordKey)&&c.field===x.field&&same(c.importValue,x.importValue)){hit=c;return true}return false});
  if(hit){hit.seen=(hit.seen||1)+1;hit.lastAt=now();if(x.systemValue!==undefined)hit.systemValue=x.systemValue;if(x.sourceFile)hit.sourceFile=x.sourceFile;write(a);return hit.id}
  var id='C'+Date.now()+Math.random().toString(36).slice(2,7);a.unshift(Object.assign({id:id,at:now(),resolved:false},x));a=a.slice(0,500);write(a);return id}
/* 清掉重複、或已經不成立的衝突（紀錄已等於 Excel 值／紀錄不見了）；getRecord(key) 由頁面提供 */
function cleanup(module,getRecord){var a=read(),seen={},n=0;a.forEach(function(c){if(c.resolved||(module&&c.module!==module))return;var sig=[c.module,c.recordKey,c.field,norm(c.importValue)].join('|');if(seen[sig]){c.resolved=true;c.resolvedAt=now();c.resolution='duplicate';n++;return}seen[sig]=1;
  if(typeof getRecord==='function'){var r=null;try{r=getRecord(c.recordKey,c)}catch(e){}if(r===null){c.resolved=true;c.resolvedAt=now();c.resolution='record-gone';n++}else if(r&&same(r[c.field],c.importValue)){c.resolved=true;c.resolvedAt=now();c.resolution='already-equal';n++}else if(r&&same(c.systemValue,c.importValue)){c.resolved=true;c.resolvedAt=now();c.resolution='no-diff';n++}}});if(n)write(a);return n}
function list(module,unresolved){return read().filter(function(x){return (!module||x.module===module)&&(!unresolved||!x.resolved)})}
function resolve(id,how){var a=read();a.forEach(function(x){if(x.id===id){x.resolved=true;x.resolvedAt=now();if(how)x.resolution=how}});write(a)}
function safeMerge(existing,incoming,opt){
  opt=opt||{};var out=Object.assign({},existing||{}), conflicts=[];
  var critical=opt.criticalFields||[], approved=!!opt.approved;
  Object.keys(incoming||{}).forEach(function(k){
    var v=incoming[k]; if(v===undefined||v===null||v==='')return;
    if(['id','_k','createdAt'].indexOf(k)>=0)return;
    var old=out[k];
    if(old!==undefined&&old!==null&&old!==''&&!same(old,v) && approved && critical.indexOf(k)<0)return;/* 已核可：非關鍵欄位保留系統值，不算衝突 */
    if(old!==undefined&&old!==null&&old!==''&&!same(old,v) && critical.indexOf(k)>=0){
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
var CC={};
function ccLang(){try{var l=localStorage.getItem('ac_hra_lang')||'zh';return /^en/.test(l)?'en':/^k/.test(l)?'km':'zh'}catch(e){return 'zh'}}
function T(zh,en,km){var l=ccLang();return l==='en'?en:l==='km'?(km||en):zh}
var FN={joinDate:['入職日','Join date','ថ្ងៃចូល'],resignDate:['離職日','Resign date','ថ្ងៃលាលែង'],settleDate:['結算日','Settlement date','ថ្ងៃទូទាត់']};
var RS={'approved-record-locked':['已核可紀錄','Approved record','កំណត់ត្រាអនុម័ត'],'business-field-mismatch':['日期不同','Date differs','កាលបរិច្ឆេទខុស'],'nearby-event-date-mismatch':['日期相近但不同','Nearby date differs','កាលបរិច្ឆេទជិតគ្នា']};
/* opts: {getRecord(key,c) → 紀錄／null, label(rec,c) → 姓名, useImport(c,rec) → 頁面打開編輯表單帶入 Excel 值（回傳 true 表示已處理）} */
function openConflictCenter(module,title,opts){
  opts=opts||CC[module]||{};if(opts.getRecord)cleanup(module,opts.getRecord);else cleanup(module);
  var rows=list(module,true),d=document,old=d.getElementById('hra-cc');if(old)old.remove();
  var m=d.createElement('div');m.id='hra-cc';m.style.cssText='position:fixed;inset:0;z-index:9998;background:rgba(15,23,42,.5);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:14px;font:13px system-ui,"Noto Sans TC",sans-serif';
  var h='<div style="background:#fff;border-radius:14px;width:min(980px,100%);padding:16px;color:#0f172a"><div style="display:flex;gap:8px;align-items:center;margin-bottom:6px"><b style="font-size:16px">⚠ '+esc(T('Excel／系統資料衝突','Excel / system conflicts','ការប៉ះទង្គិចទិន្នន័យ'))+'</b><span style="color:#64748b">'+rows.length+'</span><button data-cc="close" style="margin-left:auto;border:1px solid #cbd5e1;background:#fff;border-radius:8px;padding:5px 10px;cursor:pointer">✕</button></div>';
  h+='<p style="color:#64748b;font-size:12px;margin:0 0 10px">'+esc(T('Excel 的日期和系統（已確認）的日期不同時，不會自動覆蓋。每一列選一個：保留系統值，或採用 Excel 值（會打開那筆紀錄讓你確認後儲存）。重複的、或已經一致的會自動清掉。','When an Excel date differs from the confirmed system date it is never overwritten automatically. For each row choose: keep the system value, or use the Excel value (opens the record so you can confirm and save). Duplicates and rows that already match are cleared automatically.',''))+'</p>';
  if(!rows.length)h+='<div style="padding:24px;text-align:center;color:#16a34a;font-weight:700">✅ '+esc(T('沒有待處理的衝突','No conflicts to review','គ្មាន'))+'</div>';
  else{h+='<div style="display:flex;gap:6px;justify-content:flex-end;margin-bottom:6px"><button data-cc="keepall" style="border:1px solid #cbd5e1;background:#fff;border-radius:8px;padding:5px 10px;cursor:pointer">'+esc(T('全部保留系統值','Keep system value for all','រក្សាទាំងអស់'))+'</button></div><div style="overflow:auto;max-height:65vh"><table style="border-collapse:collapse;width:100%"><thead><tr>'+[T('員工','Employee','បុគ្គលិក'),T('欄位','Field','វាល'),T('系統（已確認）','System (confirmed)','ប្រព័ន្ធ'),T('Excel 值','Excel value','Excel'),T('來源','Source','ប្រភព'),''].map(function(t){return '<th style="background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:7px;text-align:left;font-size:12px;white-space:nowrap">'+esc(t)+'</th>'}).join('')+'</tr></thead><tbody>';
   rows.forEach(function(x){var rec=null;try{rec=opts.getRecord?opts.getRecord(x.recordKey,x):null}catch(e){}var nm='';try{nm=opts.label?opts.label(rec,x):''}catch(e){}var fn=FN[x.field],rs=RS[x.reason];
    h+='<tr data-id="'+esc(x.id)+'"><td style="padding:7px;border-bottom:1px solid #f1f5f9"><b>'+esc(x.employeeId||'—')+'</b> '+esc(nm||'')+'<div style="color:#94a3b8;font-size:11px">'+esc(rs?T(rs[0],rs[1],rs[2]):(x.reason||''))+(x.seen>1?' · ×'+x.seen:'')+'</div></td><td data-l="'+esc(T('欄位','Field','វាល'))+'" style="padding:7px;border-bottom:1px solid #f1f5f9">'+esc(fn?T(fn[0],fn[1],fn[2]):x.field)+'</td><td data-l="'+esc(T('系統','System','ប្រព័ន្ធ'))+'" style="padding:7px;border-bottom:1px solid #f1f5f9;color:#b91c1c;font-weight:700;font-family:ui-monospace,monospace">'+esc(rec&&rec[x.field]!=null?rec[x.field]:x.systemValue)+'</td><td data-l="Excel" style="padding:7px;border-bottom:1px solid #f1f5f9;font-family:ui-monospace,monospace">'+esc(x.importValue)+'</td><td style="padding:7px;border-bottom:1px solid #f1f5f9;font-size:11px;color:#64748b">'+esc(x.sourceFile||'—')+'<br>'+esc(String(x.lastAt||x.at||'').slice(0,16).replace('T',' '))+'</td><td style="padding:7px;border-bottom:1px solid #f1f5f9;white-space:nowrap"><button data-cc="keep" style="border:1px solid #cbd5e1;background:#fff;border-radius:8px;padding:5px 8px;cursor:pointer;font-size:12px">✔ '+esc(T('保留系統值','Keep system','រក្សា'))+'</button> '+(opts.useImport&&rec?'<button data-cc="use" style="border:1px solid #0f766e;background:#0f766e;color:#fff;border-radius:8px;padding:5px 8px;cursor:pointer;font-size:12px">✏ '+esc(T('採用 Excel 值','Use Excel value','ប្រើ Excel'))+'</button>':'')+'</td></tr>'});
   h+='</tbody></table></div>'}
  h+='</div>';h='<style>@media(max-width:700px){#hra-cc table,#hra-cc tbody,#hra-cc tr,#hra-cc td{display:block;width:auto}#hra-cc thead{display:none}#hra-cc td{border:0!important;padding:3px 8px!important}#hra-cc tr{border-bottom:1px solid #e2e8f0;padding:8px 0}#hra-cc td[data-l]:before{content:attr(data-l) "：";color:#64748b;font-weight:400;font-family:system-ui}}#hra-cc>div{box-sizing:border-box;max-width:100%}</style>'+h;m.innerHTML=h;d.body.appendChild(m);
  var done=function(){if(opts.onChange)try{opts.onChange()}catch(e){}};
  m.addEventListener('click',function(e){var b=e.target.closest?e.target.closest('[data-cc]'):null;if(e.target===m||(b&&b.getAttribute('data-cc')==='close')){m.remove();done();return}if(!b)return;var a=b.getAttribute('data-cc');
   if(a==='keepall'){if(!confirm(T('全部保留系統值？','Keep the system value for all?','?')))return;list(module,true).forEach(function(x){resolve(x.id,'keep-system')});m.remove();done();return}
   var tr=b.closest('tr'),id=tr&&tr.getAttribute('data-id'),c=read().filter(function(x){return x.id===id})[0];if(!c)return;
   if(a==='keep'){resolve(id,'keep-system');tr.remove();done()}
   else if(a==='use'){var rec=opts.getRecord?opts.getRecord(c.recordKey,c):null;if(!rec)return;m.remove();var ok=false;try{ok=opts.useImport(c,rec)}catch(err){console.error(err)}if(ok!==false){/* 存檔後 cleanup 會看到紀錄已等於 Excel 值而自動結案 */}done()}});
}
function register(module,opts){CC[module]=opts||{}}
function count(module,getRecord){try{cleanup(module,getRecord||(CC[module]&&CC[module].getRecord))}catch(e){}return list(module,true).length}
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
g.HRAHRGovernance={version:2,safeMerge:safeMerge,logConflict:stampConflict,listConflicts:list,resolveConflict:resolve,cleanupConflicts:cleanup,countConflicts:count,registerConflictCenter:register,openConflictCenter:openConflictCenter,openPrint:openPrint};
})(window);
