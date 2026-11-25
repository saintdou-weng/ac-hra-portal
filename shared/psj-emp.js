/* 員工小卡（照片＋重點資料）共用 v1（2026-11-25 Paul：HRA Portal 點了有員工資料，但少了照片和員工頁）
   · 在 VRT HR（PSJHR）裡打開：用 VRT HR 自己的 psjEmpHTML（照片、資料、四個分頁鈕）。
   · 單獨打開 HRA Portal／HRA-PAY：同一個網站，直接讀這台裝置上 VRT HR 存的員工資料和照片（IndexedDB psjhr：db_v1、photo|工號），
     只讀不寫；再給一個「開 VRT HR 員工頁」按鈕（psjhr/#empno-工號）。這台裝置沒開過 VRT HR 就只顯示按鈕。
   window.vrtEmpBlock(工號, 姓名, 補充{dept,position,join,leave}) → Promise<HTML>
   另外：HRA Portal 的列表大字卡（row-keynote）有工號欄時，最上面自動放這張小卡（頁面自己有 acKeynoteTop 時不蓋掉）。 */
(function(){
  'use strict';
  if(window.vrtEmpBlock)return;
  function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  var DBP=null,PH={};
  function hasPsjhr(){try{if(indexedDB.databases)return indexedDB.databases().then(function(l){return (l||[]).some(function(d){return d.name==='psjhr';});});}catch(e){}return Promise.resolve(true);}
  function idb(key){return hasPsjhr().then(function(ok){if(!ok)return null;return new Promise(function(res){try{var rq=indexedDB.open('psjhr');rq.onupgradeneeded=function(){try{rq.transaction.abort();}catch(e){}res(null);};rq.onerror=function(){res(null);};rq.onsuccess=function(){var db=rq.result;try{if(!db.objectStoreNames.contains('kv')){db.close();return res(null);}var r=db.transaction('kv').objectStore('kv').get(key);r.onsuccess=function(){res(r.result||null);db.close();};r.onerror=function(){res(null);db.close();};}catch(e){res(null);}};}catch(e){res(null);}});});}
  function emps(){if(!DBP)DBP=idb('db_v1').then(function(d){var m={};try{(d&&d.emp||[]).forEach(function(r){m[String(r.emp_no)]=r;});(d&&d.joinleave||[]).forEach(function(r){var e=m[String(r.emp_no)];if(e&&r.leave_date&&!e.leave_date)e.leave_date=r.leave_date;});}catch(e){}return m;});return DBP;}
  function photo(id){if(PH[id]!==undefined)return Promise.resolve(PH[id]);return idb('photo|'+id).then(function(d){PH[id]=d&&/^data:image\//.test(String(d))?d:null;return PH[id];});}
  function lang(){try{return (typeof LANG!=='undefined'?LANG:localStorage.getItem('hrpay_lang'))||'zh';}catch(e){return 'zh';}}
  function T(zh,en){var l=lang();return l==='en'||l==='km'?en:zh;}
  function tenure(j,l){var a=new Date(String(j||'').slice(0,10)+'T00:00:00'),b=l?new Date(String(l).slice(0,10)+'T00:00:00'):new Date();if(isNaN(a)||isNaN(b))return '';var m=(b.getFullYear()-a.getFullYear())*12+(b.getMonth()-a.getMonth());if(b.getDate()<a.getDate())m--;if(m<0)return '';return T(Math.floor(m/12)+' 年 '+(m%12)+' 個月',Math.floor(m/12)+'y '+(m%12)+'m');}
  var URL0='https://saintdou-weng.github.io/psjhr/#empno-';
  window.vrtEmpBlock=function(id,name,x){x=x||{};id=String(id||'').replace(/\D/g,'').replace(/^0+(?=\d)/,'');
    try{var P=window.parent!==window?window.parent:null;if(P&&typeof P.psjEmpHTML==='function'){var h=P.psjEmpHTML(id,name,document);if(h)return Promise.resolve(h);}}catch(e){}
    return Promise.all([emps(),id?photo(id):Promise.resolve(null)]).then(function(a){var m=a[0]||{},e=m[id]||null,ph=a[1];
      var nm=(e&&e.name)||name||'',st=e&&e.status||'',stc=st==='在職'?['#dcfce7','#166534',T('在職','Active')]:st==='離職'?['#fee2e2','#991b1b',T('離職','Left')]:st?['#fef3c7','#92400e',st]:null;
      var facts=[[T('部門','Dept'),x.dept],[T('職位','Position'),x.position],[T('到職日','Joined'),(e&&e.join_date)||x.join],[T('年資','Seniority'),tenure((e&&e.join_date)||x.join,(e&&e.leave_date)||x.leave)],[T('性別','Sex'),e&&e.sex],[T('離職日','Left on'),(e&&e.leave_date)||x.leave]].filter(function(f){return f[1];});
      return '<div style="border:1px solid #e2e8f0;border-radius:14px;padding:12px;background:#f8fafc;color:#0f172a;font-size:13px;line-height:1.5;margin:6px 0">'+
        '<div style="display:flex;gap:12px;align-items:center"><div style="width:76px;height:76px;border-radius:14px;background:#e2e8f0;display:grid;place-items:center;font-weight:700;font-size:22px;color:#475569;overflow:hidden;flex:none">'+(ph?'<img src="'+ph+'" alt="" style="width:100%;height:100%;object-fit:cover">':esc(String(nm||'?').slice(0,2)))+'</div>'+
        '<div style="min-width:0;flex:1"><div style="font-size:16px;font-weight:700;word-break:break-word">'+esc(nm||'—')+' <span style="font:12px ui-monospace,monospace;color:#64748b">'+esc(id)+'</span></div>'+(stc?'<span style="display:inline-block;margin-top:3px;background:'+stc[0]+';color:'+stc[1]+';border-radius:999px;padding:1px 9px;font-size:11.5px;font-weight:700">'+esc(stc[2])+'</span>':'')+'</div></div>'+
        (facts.length?'<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:4px 14px;margin-top:10px">'+facts.map(function(f){return '<div><span style="color:#64748b;font-size:11px">'+esc(f[0])+'</span><br><b style="font-weight:600">'+esc(f[1])+'</b></div>';}).join('')+'</div>':'')+
        (id?'<a href="'+URL0+encodeURIComponent(id)+'" target="_top" style="display:block;margin-top:10px;text-align:center;border:1px solid #c7d2fe;background:#eef2ff;color:#3730a3;border-radius:10px;padding:9px;font-weight:700;text-decoration:none">👤 '+T('開 VRT HR 員工頁（照片、出勤、請假、薪資、合約…）','Open full profile in VRT HR')+' ›</a>':'')+
        (!e?'<div style="color:#94a3b8;font-size:11px;margin-top:6px">'+T('這台裝置還沒有 VRT HR 的員工資料（開過一次 VRT HR 後這裡就會有照片）','No VRT HR data on this device yet — open VRT HR once to get photos here')+'</div>':'')+'</div>';});};
  /* 列表大字卡：有工號欄 → 最上面放員工小卡 */
  var EMPCOL=/工號|員工編號|員工號|emp(loyee)?[ ._-]*(no|id|#|code)|staff[ ._-]*(#|no|id)|factory[ ._-]*id|អត្តលេខ/i;
  function headsOf(t){var r=t&&t.tHead&&t.tHead.rows.length?t.tHead.rows[t.tHead.rows.length-1]:null,o=[];if(!r)return o;[].forEach.call(r.cells,function(c){for(var k=0;k<(c.colSpan||1);k++)o.push((c.innerText||c.textContent||'').trim());});return o;}
  function install(){if(window.__psjEmpTop)return;window.__psjEmpTop=1;var own=typeof window.acKeynoteTop==='function'?window.acKeynoteTop:null;
    window.acKeynoteTop=function(row,table){var o='';try{o=own?(own.call(window,row,table)||''):'';}catch(e){}
      try{if(window.parent!==window&&window.parent.hookEmpTop)return o;   /* 在 VRT HR 裡：VRT HR 自己會加 */
        var tr=row&&row.closest?(row.closest('tr')||row):row;if(!tr||!tr.cells)return o;var H=headsOf(table||tr.closest('table')),id='',nm='',dp='',po='';
        H.forEach(function(h,i){var v=tr.cells[i]?(tr.cells[i].innerText||tr.cells[i].textContent||'').trim().split(/\s/)[0]:'';if(!id&&EMPCOL.test(h)&&/^\d{2,6}$/.test(v))id=v;if(!nm&&/姓名|^name|ឈ្មោះ/i.test(h))nm=(tr.cells[i].innerText||'').trim().split('\n')[0];if(!dp&&/部門|dept|組別|section/i.test(h))dp=(tr.cells[i].innerText||'').trim();if(!po&&/職位|職稱|position|title/i.test(h))po=(tr.cells[i].innerText||'').trim();});
        if(!id)return o;var key='pe'+Math.random().toString(36).slice(2,8);
        setTimeout(function(){window.vrtEmpBlock(id,nm,{dept:dp,position:po}).then(function(h){var el=document.getElementById(key);if(el)el.innerHTML=h;});},0);
        return '<div id="'+key+'" style="margin:10px 16px 0"></div>'+o;}catch(e){return o;}};}
  if(document.readyState==='complete')install();else window.addEventListener('load',function(){setTimeout(install,400);});
  /* 先在背景把員工資料讀好，點人時就不會卡一下才出來 */
  setTimeout(function(){try{emps();}catch(e){}},1800);
})();
