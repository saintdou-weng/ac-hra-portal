/* AC HRA 列表 Keynote v1（2026-11-22，Paul）
   任何列表點一列 → 跳出一張大字卡：這一列的每個欄位（標題：值），數字欄另外附「同表合計／平均／排名」和比例條供參考。
   手機上欄位被擠成直排也能看清楚。只讀畫面上的表格，不動資料、不取代原本點列的功能（原本會切換期間的照樣切換）。
   不會跳出的情況：點到按鈕／連結／輸入框／勾選框、正在選取文字、表格標 data-keynote="off"。
   另外：第一欄的短代碼（工號、期間 2026-09）不再被折成一個字一行。 */
/* v2（2026-11-22 Paul）：分頁（📊 重點／📋 全部資料／📈 比較），欄位加小圖示（日期、部門、請假種類、男女…），
   比較分頁可點長條直接跳到那一筆；有輸入框的列也能開；視窗內左右滑不會讓後面頁面換分頁（data-noswipe）。 */
(function(){
  'use strict';
  if(window.__acKeynote)return;window.__acKeynote=1;
  var css='#kn-mask{position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:9990;display:none;align-items:flex-end;justify-content:center;-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}'
   +'#kn-mask.on{display:flex}@media(min-width:720px){#kn-mask{align-items:center}}'
   +'#kn-box{background:#fff;color:#0f172a;width:min(680px,100%);max-height:86vh;overflow:auto;overscroll-behavior:contain;border-radius:18px 18px 0 0;box-shadow:0 -8px 40px rgba(0,0,0,.3);font-family:inherit;animation:knUp .22s ease-out}'
   +'@media(min-width:720px){#kn-box{border-radius:18px}}@keyframes knUp{from{transform:translateY(24px);opacity:0}to{transform:none;opacity:1}}'
   +'#kn-head{position:sticky;top:0;background:#0f172a;color:#fff;padding:14px 16px;display:flex;gap:10px;align-items:center;z-index:1}'
   +'#kn-title{font-size:17px;font-weight:700;line-height:1.3;flex:1;word-break:break-word}#kn-sub{font-size:11px;opacity:.7;font-weight:400;margin-top:2px}'
   +'#kn-x{border:0;background:rgba(255,255,255,.15);color:#fff;width:34px;height:34px;border-radius:50%;font-size:18px;cursor:pointer;flex:none}'
   +'#kn-nav{display:flex;gap:6px}#kn-nav button{border:0;background:rgba(255,255,255,.15);color:#fff;width:34px;height:34px;border-radius:50%;font-size:15px;cursor:pointer}'
   +'#kn-nums{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;padding:14px 16px 4px}'
   +'.kn-n{border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;background:#f8fafc}.kn-nl{font-size:11px;color:#64748b;margin-bottom:2px}.kn-nv{font-size:22px;font-weight:700;line-height:1.15;word-break:break-word}'
   +'.kn-bar{height:5px;border-radius:3px;background:#e2e8f0;margin:6px 0 4px;overflow:hidden}.kn-bar i{display:block;height:100%;border-radius:3px;background:#0ea5e9}'
   +'.kn-ref{font-size:10.5px;color:#64748b;line-height:1.45}.kn-neg .kn-nv{color:#dc2626}.kn-neg .kn-bar i{background:#ef4444}'
   +'#kn-rows{padding:8px 16px 18px}.kn-r{display:flex;gap:12px;padding:9px 0;border-bottom:1px solid #f1f5f9;font-size:14px}.kn-r:last-child{border-bottom:0}.kn-rl{flex:0 0 38%;color:#64748b;font-size:12.5px}.kn-rv{flex:1;font-weight:600;word-break:break-word;white-space:pre-wrap}'
   +'#kn-foot{position:sticky;bottom:0;display:flex;align-items:center;gap:8px;padding:10px 12px;background:#f1f5f9;border-top:1px solid #e2e8f0}'
   +'#kn-foot button{flex:1;border:0;border-radius:10px;padding:11px 8px;font-size:14px;font-weight:700;background:#0f172a;color:#fff;cursor:pointer}#kn-foot button:disabled{opacity:.3}'
   +'#kn-pos{flex:0 0 auto;font-size:12px;color:#475569;text-align:center;min-width:64px;line-height:1.3}#kn-hint{font-size:10px;color:#94a3b8}'
   +'#kn-box.kn-next{animation:knNext .18s ease-out}#kn-box.kn-prev{animation:knPrev .18s ease-out}@keyframes knNext{from{transform:translateY(28px);opacity:.3}to{transform:none;opacity:1}}@keyframes knPrev{from{transform:translateY(-28px);opacity:.3}to{transform:none;opacity:1}}'
   +'.kn-n{border-left-width:4px}.kn-n:nth-child(4n+1){border-left-color:#60a5fa}.kn-n:nth-child(4n+2){border-left-color:#34d399}.kn-n:nth-child(4n+3){border-left-color:#f472b6}.kn-n:nth-child(4n+4){border-left-color:#fb923c}'
   +'#kn-chips{position:sticky;bottom:58px;display:flex;gap:8px;overflow-x:auto;padding:8px 12px;background:#fff;border-top:1px solid #e2e8f0;scrollbar-width:none;-webkit-overflow-scrolling:touch}#kn-chips::-webkit-scrollbar{display:none}'
   +'.kn-chip{flex:none;border:1px solid #cbd5e1;background:#fff;color:#0f172a;border-radius:999px;padding:7px 14px;font-size:13px;white-space:nowrap;cursor:pointer;max-width:180px;overflow:hidden;text-overflow:ellipsis}.kn-chip.on{background:#4f46e5;border-color:#4f46e5;color:#fff;font-weight:700}'
   +'tbody tr.kn-able{cursor:pointer}'
   +'#kn-tabs{position:sticky;top:62px;z-index:1;display:flex;background:#fff;border-bottom:1px solid #e2e8f0;overflow-x:auto;scrollbar-width:none}#kn-tabs::-webkit-scrollbar{display:none}'
   +'#kn-tabs button{flex:1;border:0;background:none;padding:11px 8px;font-size:13.5px;font-weight:600;color:#64748b;white-space:nowrap;cursor:pointer;border-bottom:3px solid transparent}#kn-tabs button.on{color:#4338ca;border-bottom-color:#4f46e5}'
   +'.kn-pane{display:none}.kn-pane.on{display:block}.kn-ic{margin-right:4px}'
   +'#kn-cmp{padding:12px 16px 16px}.kn-cc{display:flex;gap:6px;overflow-x:auto;padding-bottom:8px;scrollbar-width:none}.kn-cc::-webkit-scrollbar{display:none}'
   +'.kn-cc button{flex:none;border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:6px 12px;font-size:12.5px;cursor:pointer;white-space:nowrap}.kn-cc button.on{background:#0f172a;border-color:#0f172a;color:#fff}'
   +'.kn-st{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:6px 0 10px}.kn-st div{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:6px 8px;font-size:11px;color:#64748b}.kn-st b{display:block;font-size:15px;color:#0f172a;word-break:break-all}'
   +'.kn-br{display:grid;grid-template-columns:minmax(70px,36%) 1fr 74px;gap:8px;align-items:center;width:100%;border:0;background:none;padding:6px 4px;border-radius:8px;font:inherit;font-size:12.5px;text-align:left;cursor:pointer;color:inherit}.kn-br:active,.kn-br.on{background:#eef2ff}'
   +'.kn-br .n{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.kn-br .t{height:10px;background:#e2e8f0;border-radius:6px;overflow:hidden}.kn-br .t i{display:block;height:100%;background:#38bdf8;border-radius:6px}.kn-br.on .t i{background:#4f46e5}.kn-br .v{text-align:right;font-weight:700;white-space:nowrap}';
  var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
  var mask,box,curRow=null,curT=-1,curKey='';
  /* 欄位小圖示：看欄名（和值）挑一個 */
  var ICONS=[[/姓名|name|ឈ្មោះ/i,'👤'],[/工號|emp|staff ?(#|no|id)|^id$|^no\.?$|編號|factory id/i,'🪪'],[/性別|gender|sex/i,'🚻'],[/部門|dept|department/i,'🏭'],[/組|line|section|group/i,'🧵'],[/職位|職稱|position|title/i,'💼'],
    [/病假|sick/i,'🤒'],[/產假|maternity|懷孕|preg/i,'🤰'],[/年假|annual/i,'🌴'],[/事假|personal/i,'📝'],[/曠職|曠工|absent|缺勤|absence/i,'🚫'],[/遲到|late/i,'⏰'],[/請假|leave/i,'🏖'],[/出勤|attend|present/i,'✅'],
    [/加班|ot\b|overtime/i,'⏱'],[/入職|join|hire/i,'🟢'],[/離職|resign|quit/i,'🔴'],[/日期|date|日$|期間|period|month|月份/i,'📅'],[/天|day/i,'📆'],[/時|hour|hrs/i,'⏲'],
    [/人數|headcount|staff|ppl|人$/i,'👥'],[/率|rate|%/i,'📊'],[/金額|usd|\$|薪|salary|pay|amount|費|cost|total|合計|riel|khr/i,'💵'],[/原因|reason/i,'❓'],[/電話|phone/i,'📞'],[/備註|remark|note|說明/i,'🗒'],[/狀態|status/i,'🔖'],[/年資|senior|tenure/i,'🌿'],[/地址|address|province|籍貫/i,'🏠']];
  function icOf(l){for(var i=0;i<ICONS.length;i++)if(ICONS[i][0].test(l))return ICONS[i][1];return '';}
  function valIc(l,v){if(/性別|gender|sex/i.test(l)){if(/^(f|female|女|ស្រី)/i.test(v))return '🚺 ';if(/^(m|male|男|ប្រុស)/i.test(v))return '🚹 ';}
    if(/狀態|status/i.test(l)){if(/核可|approved|完成|done|ok|正常/i.test(v))return '✅ ';if(/退|reject|錯|fail/i.test(v))return '↩️ ';if(/待|pending/i.test(v))return '⏳ ';}return '';}
  var KN_TAB='num',KN_COL='';
  function nk(v){return String(v).replace(/[◀▶►◄▸▹•\s]/g,'');}
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function txt(el){
    if(el&&el.tagName==='TD'&&el.querySelector&&el.querySelector('button')&&!el.querySelector('input,select,textarea')){var c0=el.cloneNode(true);[].forEach.call(c0.querySelectorAll('button'),function(x){x.remove();});return (c0.textContent||'').replace(/\s+/g,' ').trim();}
    var f=el&&el.querySelector&&el.querySelector('input:not([type=checkbox]):not([type=radio]):not([type=hidden]),select,textarea');
    if(f&&el.tagName==='TD'){var v=f.tagName==='SELECT'?(f.options[f.selectedIndex]?f.options[f.selectedIndex].text:''):f.value;var c=el.cloneNode(true);[].forEach.call(c.querySelectorAll('input,select,textarea,button'),function(x){x.remove();});var rest=(c.textContent||'').replace(/\s+/g,' ').trim();return (String(v||'').trim()+(rest?' '+rest:'')).trim();}
    return (el.innerText||el.textContent||'').replace(/\s*\n\s*/g,' ').replace(/\s+/g,' ').trim();}
  function num(s){var t=String(s).replace(/[,\s$＄]/g,'');if(!/^[-+−]?\d+(\.\d+)?(%|人|人次|項|天|筆|d|ppl)?$/.test(t))return null;var v=parseFloat(t.replace('−','-'));return isFinite(v)?v:null;}
  function fmt(v){var a=Math.abs(v);return (Math.round(v*100)/100).toLocaleString('en-US',{maximumFractionDigits:a>=100?0:2});}
  function heads(table){
    var rows=table.tHead?[].slice.call(table.tHead.rows):[];if(!rows.length){var f=table.rows[0];if(f&&f.querySelector('th'))rows=[f];}
    if(!rows.length)return [];
    var out=[];rows.forEach(function(r,ri){var c=0;[].forEach.call(r.cells,function(th){var span=th.colSpan||1,t=txt(th);while(out[c]&&out[c].lock)c++;for(var k=0;k<span;k++){out[c+k]=out[c+k]||{t:''};if(span===1||ri===rows.length-1){out[c+k].t=(out[c+k].t&&span===1&&ri>0?out[c+k].t+' · ':ri>0?'':out[c+k].t)+t;}else out[c+k].t=t;if((th.rowSpan||1)>1)out[c+k].lock=1;}c+=span;});});
    return out.map(function(x){return x?x.t:'';});
  }
  function dataRows(table){return [].filter.call(table.tBodies.length?table.querySelectorAll('tbody > tr'):table.rows,function(r){return r.cells.length>=2&&!r.querySelector('th')&&r.offsetParent!==null&&!(r.cells.length===1||r.cells[0].colSpan>2);});}
  var KN_ROW=null;
  function show(row){KN_ROW=row;
    var table=row.closest('table');if(!table)return;
    var H=heads(table),rows=dataRows(table),cells=[].slice.call(row.cells);
    var card=table.closest('.card,.sect,section,.panel,.box,[class*="card"]'),capEl=card&&card.querySelector('.ct,.ch,h2,h3,h4,.sect-title,.title,[class*="title"]'),cap=capEl&&!table.contains(capEl)?txt(capEl).slice(0,60):'';
    var items=cells.map(function(td,i){return {l:H[i]||('#'+(i+1)),v:txt(td),n:num(txt(td)),i:i};}).filter(function(x){return x.v!==''&&!/^[—–-]$/.test(x.v)||x.n!==null;}).filter(function(x){return x.v!=='';});
    var ids=items.filter(function(x){return x.n===null||x.i===0||/工號|id|no\.?$|^#$|編號|期|date|日/i.test(x.l);});
    var cl=function(v){return String(v).replace(/^[◀▶►◄▸▹•\s]+|[◀▶►◄\s]+$/g,'');};
    var title=items.slice(0,3).filter(function(x,k){return k===0||x.n===null;}).map(function(x){return cl(x.v);}).slice(0,2).join(' · ');
    var numsHtml='',rowsHtml='';
    items.forEach(function(x){
      var isId=x.i===0||/工號|factory id|emp|^id$|^#$|^no\.?$|編號|電話|phone|年$|year|期間|period/i.test(x.l);
      if(x.n!==null&&!isId){
        var col=rows.map(function(r){return r.cells[x.i]?num(txt(r.cells[x.i])):null;}).filter(function(v){return v!==null;});
        var ref='',bar='';
        if(col.length>=3){var sum=col.reduce(function(a,b){return a+b;},0),max=Math.max.apply(null,col.map(Math.abs))||1,rank=col.filter(function(v){return v>x.n;}).length+1,pct=/%$/.test(x.v);
          bar='<div class="kn-bar"><i style="width:'+Math.max(3,Math.round(Math.abs(x.n)/max*100))+'%"></i></div>';
          ref='<div class="kn-ref">第 '+rank+' 名 / 共 '+col.length+' 筆 · 平均 '+fmt(sum/col.length)+'</div>';}
        numsHtml+='<div class="kn-n'+(x.n<0?' kn-neg':'')+'" data-c="'+x.i+'"><div class="kn-nl"><span class="kn-ic">'+icOf(x.l)+'</span>'+esc(x.l)+'</div><div class="kn-nv">'+esc(x.v)+'</div>'+bar+ref+'</div>';
      }else rowsHtml+='<div class="kn-r"><div class="kn-rl"><span class="kn-ic">'+icOf(x.l)+'</span>'+esc(x.l)+'</div><div class="kn-rv">'+valIc(x.l,x.v)+esc(x.v)+'</div></div>';
    });
    var idx=rows.indexOf(row);
    var allHtml=items.map(function(x){return '<div class="kn-r"><div class="kn-rl"><span class="kn-ic">'+icOf(x.l)+'</span>'+esc(x.l)+'</div><div class="kn-rv">'+valIc(x.l,x.v)+esc(x.v)+'</div></div>';}).join('');
    var cmpHtml=compareHtml(items,rows,row);
    box.innerHTML='<div id="kn-head"><div id="kn-title">'+esc(title)+'<div id="kn-sub">'+esc(cap)+(idx>=0?(cap?' · ':'')+(idx+1)+' / '+rows.length:'')+'</div></div><div id="kn-nav"><button type="button" data-d="-1" aria-label="prev">‹</button><button type="button" data-d="1" aria-label="next">›</button></div><button type="button" id="kn-x" aria-label="close">✕</button></div>'
      +tabsHtml(numsHtml,rowsHtml,allHtml,cmpHtml)
      +(rows.length>1&&idx>=0?'<div id="kn-chips">'+rows.slice(Math.max(0,idx-8),idx+9).map(function(r,k){var ri=Math.max(0,idx-8)+k;return '<button type="button" class="kn-chip'+(ri===idx?' on':'')+'" data-i="'+ri+'">'+esc(chipOf(r))+'</button>';}).join('')+'</div>':'')
      +(rows.length>1&&idx>=0?'<div id="kn-foot"><button type="button" data-d="-1"'+(idx<=0?' disabled':'')+'>▲ 上一筆 Prev</button><div id="kn-pos"><b>'+(idx+1)+'</b> / '+rows.length+'<div id="kn-hint">↕ 滑動 swipe</div></div><button type="button" data-d="1"'+(idx>=rows.length-1?' disabled':'')+'>下一筆 Next ▼</button></div>':'');
    setTimeout(function(){var on=box.querySelector('.kn-chip.on'),cs=on&&on.parentElement;if(cs)cs.scrollLeft=on.offsetLeft-cs.clientWidth/2+on.offsetWidth/2;var hd=box.querySelector('#kn-head'),tb=box.querySelector('#kn-tabs');if(hd&&tb)tb.style.top=hd.offsetHeight+'px';},0);
    curRow=row;curT=[].indexOf.call(document.querySelectorAll('table'),table);curKey=nk(txt(row.cells[0]));mask.classList.add('on');box.scrollTop=0;
  }
  function hide(){mask.classList.remove('on');curRow=null;}
  /* 分頁：重點（數字＋文字重點）／全部資料／比較 */
  function tabsHtml(nums,rowsH,all,cmp){
    var T=[];if(nums||rowsH)T.push(['num','📊 重點 Key']);T.push(['all','📋 全部資料 All']);if(cmp)T.push(['cmp','📈 比較 Compare']);
    if(!T.some(function(t){return t[0]===KN_TAB;}))KN_TAB=T[0][0];
    /* 頁面自訂內容：window.acKeynoteTop／acKeynoteExtra(row,table) 回傳 HTML（照片、相關記錄、按鈕），放在「重點」分頁的上方／下方 */
    var hk=function(n){try{return typeof window[n]==='function'&&KN_ROW?(window[n](KN_ROW,KN_ROW.closest('table'))||''):'';}catch(e){return '';}},hTop=hk('acKeynoteTop'),hEx=hk('acKeynoteExtra');
    if((hTop||hEx)&&!T.some(function(t){return t[0]==='num';})){T.unshift(['num','📊 重點 Key']);}
    return '<div id="kn-tabs">'+T.map(function(t){return '<button type="button" data-tab="'+t[0]+'" class="'+(KN_TAB===t[0]?'on':'')+'">'+t[1]+'</button>';}).join('')+'</div>'
      +'<div class="kn-pane'+(KN_TAB==='num'?' on':'')+'" data-p="num">'+hTop+(nums?'<div id="kn-nums">'+nums+'</div>':'')+(rowsH?'<div id="kn-rows">'+rowsH+'</div>':'')+hEx+'</div>'
      +'<div class="kn-pane'+(KN_TAB==='all'?' on':'')+'" data-p="all"><div id="kn-rows">'+all+'</div></div>'
      +(cmp?'<div class="kn-pane'+(KN_TAB==='cmp'?' on':'')+'" data-p="cmp"><div id="kn-cmp">'+cmp+'</div></div>':'');
  }
  /* 比較：選一個數字欄，看這一筆在全部裡排第幾；點長條直接跳到那一筆 */
  function compareHtml(items,rows,row){
    var numCols=items.filter(function(x){return x.n!==null&&!(x.i===0||/工號|factory id|emp|^id$|^#$|^no\.?$|編號|電話|phone|年$|year|期間|period/i.test(x.l));});
    if(!numCols.length||rows.length<3)return '';
    var c=numCols.filter(function(x){return x.l===KN_COL;})[0]||numCols[0];
    var vals=rows.map(function(r,ri){return {ri:ri,r:r,v:r.cells[c.i]?num(txt(r.cells[c.i])):null};}).filter(function(o){return o.v!==null;});
    if(vals.length<2)return '';
    var sorted=vals.slice().sort(function(a,b){return b.v-a.v;}),me=sorted.filter(function(o){return o.r===row;})[0],rank=me?sorted.indexOf(me)+1:0;
    var sum=vals.reduce(function(a,o){return a+o.v;},0),mx=Math.max.apply(null,vals.map(function(o){return Math.abs(o.v);}))||1;
    var nmI=items.filter(function(x){return /姓名|name|ឈ្មោះ/i.test(x.l);}).map(function(x){return x.i;})[0],lb=function(r){var a=nmI!=null&&r.cells[nmI]?txt(r.cells[nmI]):'';return a?a.slice(0,22):chipOf(r);};
    var show=sorted.slice(0,10);if(me&&show.indexOf(me)<0){show=show.slice(0,9);show.push(me);}
    return '<div class="kn-cc">'+numCols.map(function(x){return '<button type="button" data-col="'+esc(x.l)+'" class="'+(x===c?'on':'')+'">'+icOf(x.l)+' '+esc(x.l)+'</button>';}).join('')+'</div>'
      +'<div class="kn-st"><div>這一筆<b>'+esc(c.v)+'</b></div><div>排名<b>'+(rank||'—')+' / '+vals.length+'</b></div><div>平均<b>'+fmt(sum/vals.length)+'</b></div><div>最高<b>'+fmt(sorted[0].v)+'</b></div></div>'
      +show.map(function(o){var on=o.r===row;return '<button type="button" class="kn-br'+(on?' on':'')+'" data-i="'+o.ri+'"><span class="n">'+(on?'▶ ':'')+(sorted.indexOf(o)+1)+'. '+esc(lb(o.r))+'</span><span class="t"><i style="width:'+Math.max(3,Math.round(Math.abs(o.v)/mx*100))+'%"></i></span><span class="v">'+fmt(o.v)+'</span></button>';}).join('')
      +'<div class="kn-ref" style="margin-top:6px">點任一條直接跳到那一筆 · 前 10 名'+(me&&rank>10?'＋這一筆':'')+'</div>';
  }
  /* 底部一排膠囊＝前後幾筆（像生產平台），點了直接跳到那一筆 */
  function chipOf(r){var a=nk(txt(r.cells[0])),b=r.cells[1]?txt(r.cells[1]):'';return ((/^\d{1,3}$/.test(a)||!a)&&b?b:a+(b&&num(b)===null&&/^\d+$/.test(a)?' '+b:'')).slice(0,22)||'—';}
  function jump(i){var t=curRow&&document.body.contains(curRow)?curRow.closest('table'):document.querySelectorAll('table')[curT],rs=t?dataRows(t):[];if(rs[i]){var d=rs.indexOf(curRow);show(rs[i]);box.classList.remove('kn-next','kn-prev');void box.offsetWidth;box.classList.add(i>=d?'kn-next':'kn-prev');}}
  /* 上一筆／下一筆：按鈕、鍵盤方向鍵、手指上下或左右滑、滑鼠滾輪滾到底再滾 */
  function step(d){
    if(!curRow)return false;
    if(!document.body.contains(curRow)){   /* 頁面把表格重畫了（同步、切換期間）：用第幾張表＋第一欄文字找回目前這一列 */
      var t2=document.querySelectorAll('table')[curT],k=curKey,hit=t2?dataRows(t2).filter(function(r){return nk(txt(r.cells[0]))===k;})[0]:null;
      if(!hit)return false;curRow=hit;
    }
    var t=curRow.closest('table'),rs=t?dataRows(t):[],i=rs.indexOf(curRow)+d;
    if(i<0||i>=rs.length)return false;
    show(rs[i]);box.classList.remove('kn-next','kn-prev');void box.offsetWidth;box.classList.add(d>0?'kn-next':'kn-prev');
    try{rs[i].scrollIntoView({block:'nearest'});}catch(e){}
    return true;
  }
  function init(){
    mask=document.createElement('div');mask.id='kn-mask';mask.setAttribute('data-noswipe','');box=document.createElement('div');box.id='kn-box';mask.appendChild(box);document.body.appendChild(mask);
    mask.addEventListener('click',function(e){
      if(e.target===mask||e.target.id==='kn-x'){hide();return;}
      var b=e.target.closest('#kn-nav button,#kn-foot button');if(b)step(+b.dataset.d);
      var c=e.target.closest('.kn-chip,.kn-br');if(c){jump(+c.dataset.i);return;}
      var tb=e.target.closest('#kn-tabs button');if(tb){KN_TAB=tb.dataset.tab;[].forEach.call(box.querySelectorAll('#kn-tabs button'),function(x){x.classList.toggle('on',x===tb);});[].forEach.call(box.querySelectorAll('.kn-pane'),function(p){p.classList.toggle('on',p.dataset.p===KN_TAB);});return;}
      var cc=e.target.closest('.kn-cc button');if(cc&&curRow){KN_COL=cc.dataset.col;show(curRow);return;}
      var nc=e.target.closest('.kn-n[data-c]');if(nc&&curRow){var lb=nc.querySelector('.kn-nl');KN_COL=lb?lb.textContent.replace(/^\S*\s?/,'').trim():'';KN_COL=(heads(curRow.closest('table'))[+nc.dataset.c])||KN_COL;KN_TAB='cmp';show(curRow);}
    });
    document.addEventListener('keydown',function(e){if(!mask.classList.contains('on'))return;if(e.key==='Escape')hide();else if(e.key==='ArrowDown'||e.key==='ArrowRight'||e.key==='PageDown'){e.preventDefault();step(1);}else if(e.key==='ArrowUp'||e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();step(-1);}});
    var tx=0,ty=0,atTop=false,atEnd=false;
    box.addEventListener('touchstart',function(e){var p=e.touches[0];tx=p.clientX;ty=p.clientY;atTop=box.scrollTop<=1;atEnd=box.scrollTop+box.clientHeight>=box.scrollHeight-2;},{passive:true});
    box.addEventListener('touchend',function(e){var p=e.changedTouches[0],dx=p.clientX-tx,dy=p.clientY-ty;
      if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.5)step(dx<0?1:-1);
      else if(dy<-70&&atEnd&&Math.abs(dy)>Math.abs(dx)*1.5)step(1);          /* 已到底再往上滑＝下一筆（可一直滑下去） */
      else if(dy>70&&atTop&&Math.abs(dy)>Math.abs(dx)*1.5)step(-1);},{passive:true});
    var wl=0;box.addEventListener('wheel',function(e){var now=Date.now();if(now-wl<350)return;var end=box.scrollTop+box.clientHeight>=box.scrollHeight-2,top=box.scrollTop<=1;if(e.deltaY>30&&end){wl=now;step(1);}else if(e.deltaY<-30&&top){wl=now;step(-1);}},{passive:true});
    document.addEventListener('click',function(e){
      var t=e.target;if(!t||!t.closest||t.closest('#kn-mask'))return;
      if(t.closest('button,a,input,select,textarea,label,summary,[contenteditable="true"],[role="button"],[data-keynote="off"]'))return;
      var oc=t.closest('[onclick]');if(oc&&oc.tagName!=='TR'&&oc.closest('tr'))return;            /* 列裡面自己有功能的小格（例如點月份切換狀態）不跳 */
      var row=t.closest('tr');if(!row||row.closest('thead')||row.querySelector('th')||row.cells.length<2)return;
      var table=row.closest('table');if(!table||table.dataset.keynote==='off'||table.rows.length<2)return;
      var sel=window.getSelection&&String(window.getSelection());if(sel&&sel.length>1)return;
      /* 讓原本的點列功能先跑；如果它把表格重畫了（例如切換期間），用「第幾張表＋第一欄文字」找回同一列 */
      var tIdx=[].indexOf.call(document.querySelectorAll('table'),table),key=txt(row.cells[0]).replace(/[◀▶►◄▸▹•\s]/g,''),rIdx=row.sectionRowIndex;
      setTimeout(function(){
        if(document.body.contains(row)){show(row);return;}
        var t2=document.querySelectorAll('table')[tIdx];if(!t2)return;
        var rs=dataRows(t2),hit=rs.filter(function(r){return txt(r.cells[0]).replace(/[◀▶►◄▸▹•\s]/g,'')===key;})[0]||null;
        if(hit)show(hit);
      },60);
    },true);
    /* 第一欄短代碼不折行；可點的列顯示手型 */
    var tm=null;function tidy(){tm=null;var n=0;[].forEach.call(document.querySelectorAll('table'),function(tb){if(n>4000)return;[].forEach.call(tb.rows,function(r){n++;var c=r.cells[0];if(c&&!c.__kn){c.__kn=1;var s=txt(c);if(s&&s.length<=12&&!/\s/.test(s)&&!c.querySelector('input,button'))c.style.whiteSpace='nowrap';}if(r.parentElement&&r.parentElement.tagName==='TBODY'&&r.cells.length>=2)r.classList.add('kn-able');});});}
    tidy();try{new MutationObserver(function(){if(!tm)tm=setTimeout(tidy,600);}).observe(document.body,{childList:true,subtree:true});}catch(e){}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
