/* AC HRA 列表 Keynote v1（2026-11-22，Paul）
   任何列表點一列 → 跳出一張大字卡：這一列的每個欄位（標題：值），數字欄另外附「同表合計／平均／排名」和比例條供參考。
   手機上欄位被擠成直排也能看清楚。只讀畫面上的表格，不動資料、不取代原本點列的功能（原本會切換期間的照樣切換）。
   不會跳出的情況：點到按鈕／連結／輸入框／勾選框、正在選取文字、表格標 data-keynote="off"。
   另外：第一欄的短代碼（工號、期間 2026-09）不再被折成一個字一行。 */
/* v2（2026-11-22 Paul）：分頁（📊 重點／📋 全部資料／📈 比較），欄位加小圖示（日期、部門、請假種類、男女…），
   比較分頁可點長條直接跳到那一筆；有輸入框的列也能開；視窗內左右滑不會讓後面頁面換分頁（data-noswipe）。 */
/* v3（2026-11-23 Paul）：版面照 SEC 貨櫃頁的物品頁（.gip-ov）重排——
   最上面一條＝第幾筆／共幾筆＋‹ › ✕；表頭＝圖示（列裡有照片就用照片）＋編號＋名稱＋重點 chips（部門、職位、狀態、日期…）；
   表頭固定、只捲內容；資料一律兩欄「標籤在上、值在下」；重點小卡的橫條寫明意思（＝這一筆 ÷ 表內最高那一筆）。
   只改畫面，資料、點列原本的功能、acKeynoteTop／Extra／Label 掛點都不變。 */
/* v4（2026-11-23 Paul）：往下滑要「無縫接下一筆」（像 SEC 摩托車那種一張接一張），不要閃一下換整張；卡片也不要縮在畫面下方。
   · 卡片改成從上面開始、佔滿高度（電腦是置中的大視窗）。最上面一條（第幾筆／‹ ›／✕）＋分頁固定不動。
   · 下面是一張一張接起來的卡：捲到快到底就自動接下一筆，上面的「3 / 46」跟著變；‹ › 是捲到上一筆／下一筆。
   · 原本底部那排膠囊和「上一筆／下一筆」大按鈕拿掉（用捲的就好，畫面留給資料）。KPI 小卡的重點卡同一套。 */
(function(){
  'use strict';
  if(window.__acKeynote)return;window.__acKeynote=1;
  /* 柬文補齊（km-fill.js）跟著大字卡一起載入 */
  try{var me=document.currentScript&&document.currentScript.src;if(me&&!document.querySelector('script[src*="km-fill.js"]')){var ks=document.createElement('script');ks.src=me.replace(/row-keynote\.js.*$/,'km-fill.js?v=2');ks.defer=true;document.head.appendChild(ks);}}catch(e){}
  var css='#kn-mask{position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:9990;display:none;align-items:flex-end;justify-content:center;-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}'
   +'#kn-mask.on{display:flex}@media(min-width:720px){#kn-mask{align-items:center}}'
   +'#kn-box{background:#fff;color:#0f172a;width:min(900px,100%);max-height:92vh;overflow:auto;overscroll-behavior:contain;border-radius:18px 18px 0 0;box-shadow:0 -8px 40px rgba(0,0,0,.3);font-family:inherit;animation:knUp .22s ease-out}'
   +'@media(min-width:720px){#kn-box{border-radius:18px}}@keyframes knUp{from{transform:translateY(24px);opacity:0}to{transform:none;opacity:1}}'
   +'#kn-head{position:sticky;top:0;background:#fff;color:#0f172a;border-bottom:1px solid #e2e8f0;padding:14px 16px;display:flex;gap:10px;align-items:center;z-index:1}'
   +'#kn-title{font-size:17px;font-weight:700;line-height:1.3;flex:1;word-break:break-word}#kn-sub{font-size:11px;opacity:.7;font-weight:400;margin-top:2px}'
   +'#kn-x{border:1px solid #e2e8f0;background:#f8fafc;color:#0f172a;width:34px;height:34px;border-radius:50%;font-size:18px;cursor:pointer;flex:none}'
   +'#kn-nav{display:flex;gap:6px}#kn-nav button{border:1px solid #e2e8f0;background:#f8fafc;color:#0f172a;width:34px;height:34px;border-radius:50%;font-size:15px;cursor:pointer}'
   +'#kn-nums{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;padding:14px 16px 4px}'
   +'.kn-n{border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;background:#f8fafc}.kn-nl{font-size:11px;color:#64748b;margin-bottom:2px}.kn-nv{font-size:22px;font-weight:700;line-height:1.15;word-break:break-word}'
   +'.kn-bar{height:5px;border-radius:3px;background:#e2e8f0;margin:6px 0 4px;overflow:hidden}.kn-bar i{display:block;height:100%;border-radius:3px;background:#0ea5e9}'
   +'.kn-ref{font-size:10.5px;color:#64748b;line-height:1.45}.kn-neg .kn-nv{color:#dc2626}.kn-neg .kn-bar i{background:#ef4444}'
   +'#kn-rows{padding:8px 16px 18px}.kn-r{display:flex;gap:12px;padding:9px 0;border-bottom:1px solid #f1f5f9;font-size:14px}.kn-r:last-child{border-bottom:0}.kn-rl{flex:0 0 38%;color:#64748b;font-size:12.5px}.kn-rv{flex:1;font-weight:600;word-break:break-word;white-space:pre-wrap}'
   +'#kn-foot{position:sticky;bottom:0;display:flex;align-items:center;gap:8px;padding:10px 12px;background:#fff;border-top:1px solid #e2e8f0}'
   +'#kn-foot button{flex:1;border-radius:10px;padding:11px 8px;font-size:14px;font-weight:700;background:#f8fafc;color:#0f172a;border:1px solid #cbd5e1;cursor:pointer}#kn-foot button:disabled{opacity:.3}'
   +'#kn-pos{flex:0 0 auto;font-size:12px;color:#475569;text-align:center;min-width:64px;line-height:1.3}#kn-hint{font-size:10px;color:#94a3b8}'
   +'@keyframes knNext{from{transform:translateY(28px);opacity:.3}to{transform:none;opacity:1}}@keyframes knPrev{from{transform:translateY(-28px);opacity:.3}to{transform:none;opacity:1}}'
   +'.kn-n{border-left-width:4px}.kn-n:nth-child(4n+1){border-left-color:#60a5fa}.kn-n:nth-child(4n+2){border-left-color:#34d399}.kn-n:nth-child(4n+3){border-left-color:#f472b6}.kn-n:nth-child(4n+4){border-left-color:#fb923c}'
   +'#kn-chips{position:sticky;bottom:58px;display:flex;gap:8px;overflow-x:auto;padding:8px 12px;background:#fff;border-top:1px solid #e2e8f0;scrollbar-width:none;-webkit-overflow-scrolling:touch}#kn-chips::-webkit-scrollbar{display:none}'
   +'.kn-chip{flex:none;border:1px solid #cbd5e1;background:#fff;color:#0f172a;border-radius:999px;padding:7px 14px;font-size:13px;white-space:nowrap;cursor:pointer;max-width:180px;overflow:hidden;text-overflow:ellipsis}.kn-chip.on{background:#4f46e5;border-color:#4f46e5;color:#fff;font-weight:700}'
   +'@media(min-width:560px){#kn-rows{display:grid;grid-template-columns:1fr 1fr;column-gap:28px}.kn-r{flex-direction:column;gap:2px;border-bottom:0;padding:8px 0}.kn-rl{flex:none;font-size:12.5px}.kn-rv{font-size:16px;font-weight:700}}'
   +'#kn-box{background:#f4f7fb;box-shadow:0 24px 60px rgba(15,23,42,.34),0 2px 8px rgba(15,23,42,.12)}#kn-head,#kn-tabs,#kn-foot,#kn-chips{background:#fff}.kn-n{background:#fff;box-shadow:0 3px 10px rgba(15,23,42,.09);border-color:#dfe6ee}#kn-rows{margin:12px 16px 16px;padding:6px 16px;background:#fff;border:1px solid #dfe6ee;border-radius:14px;box-shadow:0 3px 10px rgba(15,23,42,.08)}'
   +'.kn-sumbtn{display:block;margin:4px 0 6px auto;border:1px solid #c9d5e2;background:#fff;color:#14233a;font:700 12.5px/1 inherit;padding:7px 12px;border-radius:8px;cursor:pointer}'
   +'tbody tr.kn-able{cursor:pointer}tbody tr.kn-able>td:first-child{color:#1e40af;font-weight:700}'
   +'#kn-tabs{position:sticky;top:62px;z-index:1;display:flex;background:#fff;border-bottom:1px solid #e2e8f0;overflow-x:auto;scrollbar-width:none}#kn-tabs::-webkit-scrollbar{display:none}'
   +'#kn-tabs button{flex:1;border:0;background:none;padding:11px 8px;font-size:13.5px;font-weight:600;color:#64748b;white-space:nowrap;cursor:pointer;border-bottom:3px solid transparent}#kn-tabs button.on{color:#4338ca;border-bottom-color:#4f46e5}'
   +'.kn-pane{display:none}.kn-pane.on{display:block}.kn-ic{margin-right:4px}'
   +'#kn-cmp{padding:12px 16px 16px}.kn-cc{display:flex;gap:6px;overflow-x:auto;padding-bottom:8px;scrollbar-width:none}.kn-cc::-webkit-scrollbar{display:none}'
   +'.kn-cc button{flex:none;border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:6px 12px;font-size:12.5px;cursor:pointer;white-space:nowrap}.kn-cc button.on{background:#0f172a;border-color:#0f172a;color:#fff}'
   +'.kn-st{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:6px 0 10px}.kn-st div{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:6px 8px;font-size:11px;color:#64748b}.kn-st b{display:block;font-size:15px;color:#0f172a;word-break:break-all}'
   +'.kn-br{display:grid;grid-template-columns:minmax(70px,36%) 1fr 74px;gap:8px;align-items:center;width:100%;border:0;background:none;padding:6px 4px;border-radius:8px;font:inherit;font-size:12.5px;text-align:left;cursor:pointer;color:inherit}.kn-br:active,.kn-br.on{background:#eef2ff}'
   +'.kn-br .n{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.kn-br .t{height:10px;background:#e2e8f0;border-radius:6px;overflow:hidden}.kn-br .t i{display:block;height:100%;background:#38bdf8;border-radius:6px}.kn-br.on .t i{background:#4f46e5}.kn-br .v{text-align:right;font-weight:700;white-space:nowrap}';
  css+='#kn-head{display:block;padding:0;border-bottom:1px solid #dde5ee}'
   +'#kn-bar{display:flex;align-items:center;gap:8px;padding:7px 12px;border-bottom:1px solid #edf1f5}'
   +'#kn-sub{flex:1;min-width:0;margin:0;font-size:12.5px;font-weight:700;color:#5b6b7c;opacity:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#kn-sub b{color:#1d2b3a}'
   +'#kn-nav button,#kn-x{width:42px;height:36px;border-radius:10px;border:1px solid #c9d5e2;background:#fff;color:#1d2b3a;font-size:16px;touch-action:manipulation}'
   +'#kn-hd{display:flex;gap:12px;align-items:flex-start;padding:11px 14px 12px}'
   +'.kn-ph{width:64px;height:64px;border-radius:14px;flex:none;object-fit:cover;border:1px solid #d6e0ea;background:linear-gradient(150deg,#ffffff,#e9eff5);display:flex;align-items:center;justify-content:center;font-size:30px;line-height:1;box-shadow:inset 0 1px 0 #fff,0 3px 8px rgba(15,23,42,.10)}'
   +'.kn-hm{flex:1;min-width:0}.kn-code{font-family:ui-monospace,"IBM Plex Mono",Consolas,monospace;font-weight:800;font-size:12.5px;color:#4338ca;letter-spacing:.4px}'
   +'#kn-title{flex:none;font-size:18px;font-weight:800;line-height:1.25;margin:1px 0 6px;word-break:break-word}'
   +'.kn-hchips{display:flex;flex-wrap:wrap;gap:5px}.kn-hc{font-size:12px;font-weight:700;padding:3px 9px;border-radius:999px;background:#eef3f8;color:#36506a;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}'
   +'.kn-hc.g{background:#dcfce7;color:#15803d}.kn-hc.y{background:#fef3c7;color:#a16207}.kn-hc.r{background:#fee2e2;color:#b91c1c}'
   /* 資料：一律兩欄，標籤在上、值在下；太長的值佔整列 */
   +'#kn-rows{display:grid;grid-template-columns:1fr 1fr;column-gap:20px}.kn-r{flex-direction:column;gap:1px;border-bottom:0;padding:7px 0;min-width:0}.kn-rl{flex:none;font-size:11.5px;font-weight:600}.kn-rv{font-size:15px;font-weight:700;line-height:1.35}.kn-r.full{grid-column:1/-1}'
   +'.kn-leg{grid-column:1/-1;font-size:11px;color:#64748b;display:flex;align-items:center;gap:6px;padding:0 2px}.kn-leg i{display:inline-block;width:26px;height:5px;border-radius:3px;background:#0ea5e9}'
   +'@media(max-width:520px){.kn-ph{width:54px;height:54px;font-size:26px;border-radius:12px}#kn-title{font-size:16.5px}#kn-nums{grid-template-columns:1fr 1fr}.kn-st{grid-template-columns:1fr 1fr}}';
  css+='#kn-mask{align-items:stretch}@media(min-width:720px){#kn-mask{align-items:center}}'
   +'#kn-box{display:flex;flex-direction:column;height:100%;max-height:100%;overflow:hidden;border-radius:0;animation:knUp .2s ease-out}@media(min-width:720px){#kn-box{height:min(92vh,980px);border-radius:18px}}'
   +'#kn-head{position:static;flex:none}#kn-tabs{position:static}#kn-tabs:empty{display:none}'
   +'#kn-scroll{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:10px 10px 8px}'
   +'.kn-sec{background:#fff;border:1px solid #dfe6ee;border-radius:16px;margin:0 0 12px;overflow:hidden;box-shadow:0 3px 10px rgba(15,23,42,.08)}'
   +'.kn-sec #kn-hd{border-bottom:1px solid #edf1f5}.kn-no{flex:none;align-self:flex-start;font-size:12px;font-weight:700;background:#eef3f8;color:#5b6b7c;border-radius:999px;padding:3px 10px;white-space:nowrap}.kn-no b{color:#1d2b3a}'
   +'.kn-sec .kn-top{border-bottom:1px solid #edf1f5}.kn-sec #kn-rows{margin:10px 12px 12px;box-shadow:none}'
   +'.kn-end{text-align:center;color:#94a3b8;font-size:12px;padding:6px 0 26px}';
  /* v5（2026-11-23 Paul：字不一定全黑，但一頁最好不超過 3 種）：深色＝標題和一般的值；灰＝標籤和說明；藍＝重點數字、代號、目前選到的。負數的紅字保留（那是警示）。 */
  css+='#kn-box{color:#1d2b3a}.kn-nv,.kn-code,.kn-no b,#kn-sub b,#kn-tabs button.on,.kn-br.on .v,.kn-st b{color:#1e40af}.kn-neg .kn-nv{color:#dc2626}'
   +'#kn-tabs button.on{border-bottom-color:#1e40af}.kn-br.on .t i{background:#1e40af}.kn-cc button.on,.kn-chip.on{background:#1e40af;border-color:#1e40af;color:#fff}'
   +'.kn-rl,.kn-nl,.kn-ref,#kn-sub,.kn-no,#kn-tabs button,.kn-leg,#kn-pos,#kn-hint,.kn-end{color:#64748b}.kn-rv,#kn-title,#kn-nav button,#kn-x{color:#1d2b3a}'
   +'.kn-hc,.kn-hc.g,.kn-hc.y,.kn-hc.r{color:#1d2b3a}';
  /* v6（2026-11-23 Paul：放得下 2、3 張就並排，不要一張佔一整列）：寬螢幕外框放寬，卡片自動排 2～3 欄；窄螢幕照舊一欄 */
  css+='@media(min-width:1000px){#kn-box{width:min(1560px,96vw)}#kn-scroll.one{display:block}#kn-scroll.one .kn-sec{max-width:900px;margin:0 auto 12px}#kn-scroll:not(.one){display:grid;grid-template-columns:repeat(auto-fit,minmax(440px,1fr));gap:12px;grid-auto-rows:max-content;align-items:start;align-content:start}.kn-sec{margin:0}.kn-end{grid-column:1/-1}}';
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
  var KN_TAB='num',KN_COL='',curCard=null;
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
  /* v3 表頭：最上面一條（位置＋換筆＋關閉）＋ 圖示／照片＋編號＋名稱＋chips */
  var CHIP_RE=/部門|dept|department|職位|職稱|position|title|狀態|status|性別|gender|sex|組別|組$|line|section|種類|類別|類型|type|category|日期|date|期間|period|班別|shift/i;
  function chipCls(l,v){if(/狀態|status|結果|result/i.test(l)){if(/核可|approved|完成|done|ok|正常|通過|pass/i.test(v))return ' g';if(/退|reject|錯|fail|逾期|overdue|異常/i.test(v))return ' r';if(/待|pending|審|review/i.test(v))return ' y';}return '';}
  function headHtml(o){
    var ph=o.photo?'<img class="kn-ph" src="'+esc(o.photo)+'" alt="">':'<div class="kn-ph" aria-hidden="true">'+(o.icon||'📋')+'</div>';
    return '<div id="kn-hd">'+(o.noPhoto?'':ph)+'<div class="kn-hm">'+(o.code?'<div class="kn-code">'+esc(o.code)+'</div>':'')+'<div id="kn-title">'+esc(o.title||'—')+'</div>'+(o.chips&&o.chips.length?'<div class="kn-hchips">'+o.chips.join('')+'</div>':'')+'</div>'+(o.pos?'<span class="kn-no">'+o.pos+'</span>':'')+'</div>';
  }
  function rowHead(row,items,title,cap,idx,total){
    var img=row.querySelector('img[src]'),photo=img&&img.getAttribute('src')&&(img.naturalWidth||0)!==1?img.src:'';
    var codeIt=items.filter(function(x){return /工號|factory id|emp|staff ?(#|no|id)|^id$|^no\.?$|編號|代碼|code/i.test(x.l)&&x.v.length<=20;})[0],code=codeIt&&codeIt.v!==title?codeIt.v:'';
    if(code&&title.indexOf(code)===0){var t2=title.slice(code.length).replace(/^\s*[·\-–]\s*/,'');if(t2)title=t2;}   /* 編號已經獨立一行，名稱裡不再重複 */
    var chips=items.filter(function(x){return x.n===null&&x!==codeIt&&x.v.length<=22&&CHIP_RE.test(x.l)&&title.indexOf(x.v)<0;}).slice(0,4).map(function(x){return '<span class="kn-hc'+chipCls(x.l,x.v)+'">'+(valIc(x.l,x.v)||((icOf(x.l)||'')+' '))+esc(x.v)+'</span>';});
    var ic='';for(var i=0;i<items.length&&!ic;i++)ic=icOf(items[i].l);if(cap){var m=cap.match(/^\s*([^\w\s一-鿿]{1,3})/);if(m)ic=m[1];}
    var top=KN_HASTOP;   /* 頁面自己在上面放了照片區塊（acKeynoteTop）時，表頭不再重複放圖示 */
    return headHtml({photo:photo,icon:ic,code:code,title:title,chips:chips,cap:cap,pos:idx>=0?'<b>'+(idx+1)+'</b> / '+total:'',noPhoto:!!top&&!photo});
  }
  var KN_ROW=null,KN_HASTOP=false,KN_T=[];
  function rowSec(row,rows0){KN_ROW=row;
    var table=row.closest('table');if(!table)return null;
    var H=heads(table),rows=rows0||dataRows(table),cells=[].slice.call(row.cells);
    var card=table.closest('.card,.sect,section,.panel,.box,[class*="card"]'),capEl=card&&card.querySelector('.ct,.ch,h2,h3,h4,.sect-title,.title,[class*="title"]'),cap=capEl&&!table.contains(capEl)?txt(capEl).slice(0,60):'';
    var items=cells.map(function(td,i){return {l:H[i]||('#'+(i+1)),v:txt(td),n:num(txt(td)),i:i};}).filter(function(x){return x.v!==''&&!/^[—–-]$/.test(x.v)||x.n!==null;}).filter(function(x){return x.v!=='';});
    var ids=items.filter(function(x){return x.n===null||x.i===0||/工號|id|no\.?$|^#$|編號|期|date|日/i.test(x.l);});
    var cl=function(v){return String(v).replace(/^[◀▶►◄▸▹•\s]+|[◀▶►◄\s]+$/g,'');};
    var title=items.slice(0,3).filter(function(x,k){return k===0||x.n===null;}).map(function(x){return cl(x.v);}).slice(0,2).join(' · ');
    title=lab(row)||title;
    var numsHtml='',rowsHtml='',hasBar=false,fullCls=function(v){v=String(v);return v.length+(v.match(/[\u3000-\u9fff\uff00-\uffef]/g)||[]).length>26?' full':'';};   /* 中文字算兩格寬 */
    items.forEach(function(x){
      var isId=x.i===0||/工號|factory id|emp|^id$|^#$|^no\.?$|編號|電話|phone|年$|year|期間|period/i.test(x.l);
      if(x.n!==null&&!isId){
        var col=rows.map(function(r){return r.cells[x.i]?num(txt(r.cells[x.i])):null;}).filter(function(v){return v!==null;});
        var ref='',bar='';
        if(col.length>=3){var sum=col.reduce(function(a,b){return a+b;},0),max=Math.max.apply(null,col.map(Math.abs))||1,rank=col.filter(function(v){return v>x.n;}).length+1,pct=/%$/.test(x.v);
          var pctMax=Math.round(Math.abs(x.n)/max*100);hasBar=true;
          bar='<div class="kn-bar"><i style="width:'+Math.max(3,pctMax)+'%"></i></div>';
          ref='<div class="kn-ref">'+(pctMax>=100?'★ 這張表最高 highest':'最高值的 '+pctMax+'% of highest')+'<br>'+vsAvg(x.n,sum/col.length)+'</div>';}
        numsHtml+='<div class="kn-n'+(x.n<0?' kn-neg':'')+'" data-c="'+x.i+'"><div class="kn-nl"><span class="kn-ic">'+icOf(x.l)+'</span>'+esc(x.l)+'</div><div class="kn-nv">'+esc(x.v)+'</div>'+bar+ref+'</div>';
      }else rowsHtml+='<div class="kn-r'+fullCls(x.v)+'"><div class="kn-rl"><span class="kn-ic">'+icOf(x.l)+'</span>'+esc(x.l)+'</div><div class="kn-rv">'+valIc(x.l,x.v)+esc(x.v)+'</div></div>';
    });
    if(hasBar)numsHtml+='<div class="kn-leg"><i></i>橫條＝這一筆 ÷ 這張表最高的那一筆 · Bar = this row ÷ highest in the list</div>';
    var idx=rows.indexOf(row);
    var allHtml=items.map(function(x){return '<div class="kn-r'+fullCls(x.v)+'"><div class="kn-rl"><span class="kn-ic">'+icOf(x.l)+'</span>'+esc(x.l)+'</div><div class="kn-rv">'+valIc(x.l,x.v)+esc(x.v)+'</div></div>';}).join('');
    var cmpHtml=compareHtml(items,rows,row);
    var tabsH=tabsHtml(numsHtml,rowsHtml,allHtml,cmpHtml);   /* 先算（裡面會呼叫 acKeynoteTop 一次），表頭才知道頁面有沒有自己放照片 */
    return {hd:rowHead(row,items,title,cap,idx,rows.length),body:tabsH,T:KN_T,title:title,cap:cap};
  }
  /* ── v4 外框：上面固定一條＋分頁；下面一張接一張 ── */
  var SRC=null,IDX=0,NEXT=0,FIRST=0,sc=null;
  function secEl(i){return sc?sc.querySelector('.kn-sec[data-i="'+i+'"]'):null;}
  function append(){
    if(!SRC||NEXT>=SRC.n)return false;var o=null;try{o=SRC.build(NEXT);}catch(e){}
    var el=document.createElement('section');el.className='kn-sec';el.setAttribute('data-i',NEXT);
    el.innerHTML=o?o.hd+o.body:'';el.__T=o?o.T:[];el.__title=o?o.title:'';el.__cap=o?o.cap:'';
    var end=sc.querySelector('.kn-end');if(end)sc.insertBefore(el,end);else sc.appendChild(el);
    showPane(el);NEXT++;
    if(NEXT>=SRC.n&&!sc.querySelector('.kn-end')){var p=document.createElement('p');p.className='kn-end';p.textContent='— 最後一筆 End of list —';sc.appendChild(p);}
    return true;
  }
  function fill(){var g=0;while(sc&&sc.scrollTop+sc.clientHeight>=sc.scrollHeight-600&&g++<5&&append()){}}
  function showPane(el){var ps=el.querySelectorAll('.kn-pane'),hit=false;[].forEach.call(ps,function(p){var on=p.dataset.p===KN_TAB;p.classList.toggle('on',on);if(on)hit=true;});if(!hit&&ps[0])ps[0].classList.add('on');}
  function paintTop(){
    if(!SRC||!box)return;var el=secEl(IDX),sub=box.querySelector('#kn-sub'),tb=box.querySelector('#kn-tabs'),nv=box.querySelectorAll('#kn-nav button');
    if(sub)sub.innerHTML=(SRC.n>1?'<b>'+(IDX+1)+'</b> / '+SRC.n+' · ':'')+esc((el&&el.__title)||'')+((el&&el.__cap)?' · '+esc(el.__cap):'');
    var T=(el&&el.__T)||[];if(tb){if(T.length&&!T.some(function(t){return t[0]===KN_TAB;})){}tb.innerHTML=T.length>1?T.map(function(t){var has=el&&el.querySelector('.kn-pane.on[data-p="'+t[0]+'"]');return '<button type="button" data-tab="'+t[0]+'" class="'+(has?'on':'')+'">'+t[1]+'</button>';}).join(''):'';}
    if(nv[0])nv[0].disabled=IDX<=0;if(nv[1])nv[1].disabled=IDX>=SRC.n-1;
    curRow=SRC.kind==='row'?SRC.els[IDX]:null;curCard=SRC.kind==='card'?SRC.els[IDX]:null;
    if(curRow){try{curKey=nk(txt(curRow.cells[0]));}catch(e){}}
  }
  function openAt(src,i){
    SRC=src;i=Math.max(0,Math.min(src.n-1,i));IDX=FIRST=NEXT=i;
    box.innerHTML='<div id="kn-head"><div id="kn-bar"><div id="kn-sub"></div><div id="kn-nav"><button type="button" data-d="-1" aria-label="prev">‹</button><button type="button" data-d="1" aria-label="next">›</button></div><button type="button" id="kn-x" aria-label="close">✕</button></div><div id="kn-tabs"></div></div><div id="kn-scroll"></div>';
    sc=box.querySelector('#kn-scroll');if(src.n===1)sc.classList.add('one');mask.classList.add('on');append();fill();sc.scrollTop=0;paintTop();
    var tk=0;sc.addEventListener('scroll',function(){if(tk)return;tk=requestAnimationFrame(function(){tk=0;fill();
      var line=sc.scrollTop+sc.clientHeight*0.3,k=IDX,e2;
      while(k<NEXT-1&&(e2=secEl(k+1))&&e2.offsetTop-sc.offsetTop<=line)k++;
      while(k>FIRST&&(e2=secEl(k))&&e2.offsetTop-sc.offsetTop>line)k--;
      if(k!==IDX){IDX=k;paintTop();}});},{passive:true});
  }
  function show(row){
    var table=row.closest('table');if(!table)return;var rows=dataRows(table),i=rows.indexOf(row);if(i<0){rows=[row];i=0;}
    curT=[].indexOf.call(document.querySelectorAll('table'),table);
    openAt({kind:'row',n:rows.length,els:rows,build:function(k){return rowSec(rows[k],rows);}},i);
  }
  /* ── v7（2026-11-23 Paul）列表旁邊加「📊 圖表」：依部門／組別的人數（或金額）長條＋總和、每月合計；
        點月份 → 那個月依部門的統計；點部門 → 那些人的名單；點人 → 他的重點卡。只看畫面上這張表，不動資料。 ── */
  var GRP_RE=/部門|組別|^組$|單位|車間|dept|department|section|^line$|team|group|ផ្នែក/i,GRP2_RE=/類型|類別|種類|狀態|項目|type|category|status|item/i,AMT_RE=/金額|usd|\$|薪|salary|pay|amount|費|cost|合計|total|riel|khr/i,DATE_RE=/日期|date|到期|入職|離職|月份|month|期間|ថ្ងៃ/i;
  function sumInfo(table){var H=heads(table),g=-1,g2=-1,d=-1,am=[],gs=[],ds=[];H.forEach(function(h,i){h=String(h||'');if(GRP_RE.test(h)){if(g<0)g=i;gs.push(i);}else if(GRP2_RE.test(h)||/職位|職稱|position|title|性別|gender|廠別|factory$|customer|客戶|buyer/i.test(h)){if(g2<0)g2=i;gs.push(i);}if(DATE_RE.test(h)||/^end$|^start$|expiry|expire/i.test(h)){if(d<0)d=i;ds.push(i);}});
    var rows=dataRows(table);if(rows.length<(table.getAttribute('data-kn-min')?+table.getAttribute('data-kn-min'):4))return null;
    H.forEach(function(h,i){if(i===g||i===d)return;if(!AMT_RE.test(String(h||'')))return;var ok=0;for(var k=0;k<rows.length&&k<30;k++){if(rows[k].cells[i]&&num(txt(rows[k].cells[i]))!==null)ok++;}if(ok>=Math.min(rows.length,30)*.6)am.push(i);});
    if(g<0)g=g2;if(g<0&&d<0)return null;return {H:H,g:g,d:d,gs:gs.slice(0,5),ds:ds,am:am.slice(0,2),rows:rows};}
  function mKey(s){var m=String(s).match(/(20\d{2})[-\/.年](\d{1,2})/);if(m)return m[1]+'-'+('0'+m[2]).slice(-2);m=String(s).match(/(\d{1,2})[-\/.](\d{1,2})[-\/.](20\d{2})/);return m?m[3]+'-'+('0'+m[2]).slice(-2):'';}
  function tally(rows,ci,fn,am){var o={},ord=[];rows.forEach(function(r){var k=r.cells[ci]?fn(txt(r.cells[ci])):'';if(!k)k='（未填 —）';if(!o[k]){o[k]={k:k,n:0,a:0,rows:[]};ord.push(k);}o[k].n++;o[k].rows.push(r);if(am!=null&&r.cells[am]){var v=num(txt(r.cells[am]));if(v!==null)o[k].a+=v;}});return ord.map(function(k){return o[k];});}
  function barsHtml(list,attr,useAmt,unit){var mx=Math.max.apply(null,list.map(function(x){return Math.abs(useAmt?x.a:x.n);}))||1;
    return list.map(function(x){var v=useAmt?x.a:x.n;return '<button type="button" class="kn-br" data-'+attr+'="'+esc(x.k)+'"><span class="n">'+esc(x.lab||x.k)+'</span><span class="t"><i style="width:'+Math.max(3,Math.round(Math.abs(v)/mx*100))+'%"></i></span><span class="v">'+(useAmt?'$'+fmt(v):v+(unit||''))+'</span></button>';}).join('');}
  function sumSec(inf,rows,title,cap){KN_ROW=null;var am=inf.am.length?inf.am[0]:null,tot=0;if(am!=null)rows.forEach(function(r){var v=r.cells[am]?num(txt(r.cells[am])):null;if(v!==null)tot+=v;});
    var nums='<div class="kn-n" style="grid-column:'+(am!=null?'auto':'1/-1')+'"><div class="kn-nl"><span class="kn-ic">👥</span>筆數／人數 Count</div><div class="kn-nv" style="font-size:30px">'+rows.length+'</div></div>'+(am!=null?'<div class="kn-n"><div class="kn-nl"><span class="kn-ic">💵</span>'+esc(inf.H[am])+' 合計 Total</div><div class="kn-nv" style="font-size:30px">$'+fmt(tot)+'</div></div>':'');
    /* 每個分組欄（部門、職位、類型、狀態…）各一組長條；只有一種值的那一欄排到後面 */
    var blocks=(inf.gs||[]).map(function(ci){return {ci:ci,list:tally(rows,ci,function(x){return x.length>26?x.slice(0,26)+'…':x;},am).sort(function(a,b){return b.n-a.n;})};}).filter(function(o){return o.list.length>=1&&o.list.length<=24;}).sort(function(a,b){return (a.list.length<2)-(b.list.length<2);});
    var byG={};blocks.forEach(function(o){o.list.forEach(function(x){byG[o.ci+'|'+x.k]=x;});});
    var byM=[];(inf.ds||[]).some(function(ci){var l=tally(rows,ci,mKey,am).filter(function(x){return /^20/.test(x.k);}).sort(function(a,b){return a.k<b.k?1:-1;});if(l.length>1){byM=l;inf.d=ci;return true;}return false;});
    var gH=blocks.length?'<div id="kn-cmp">'+blocks.map(function(o,bi){var L=o.list.map(function(x){return {k:o.ci+'|'+x.k,lab:x.k,n:x.n,a:x.a};});
      return '<div class="kn-ref" style="margin:'+(bi?'12px':'0')+' 0 6px;font-weight:700">依「'+esc(inf.H[o.ci])+'」'+(bi?'':' · 點一條看名單 Tap a bar for the list')+'</div>'+barsHtml(L,'g',false,'')+(am!=null&&!bi?'<div class="kn-ref" style="margin:10px 0 6px">'+esc(inf.H[am])+'</div>'+barsHtml(L.slice().sort(function(a,b){return b.a-a.a;}),'g',true):'');}).join('')
      +'<div class="kn-br on" style="cursor:default;margin-top:8px"><span class="n">合計 Total</span><span class="t"></span><span class="v">'+rows.length+(am!=null?' · $'+fmt(tot):'')+'</span></div></div>':'';
    var mH=byM.length>1?'<div id="kn-cmp"><div class="kn-ref" style="margin-bottom:6px">每月合計（依「'+esc(inf.H[inf.d])+'」）· 點月份看那個月 Tap a month</div>'+barsHtml(byM,'m',am!=null&&!blocks.length,'')+'</div>':'';
    var T=[];if(gH)T.push(['num','📊 依部門 By group']);if(mH)T.push(['all','📅 每月 By month']);if(!T.length)T.push(['num','📊 統計']);
    if(!T.some(function(t){return t[0]===KN_TAB;}))KN_TAB=T[0][0];KN_T=T;KN_HASTOP=false;
    var body='<div class="kn-pane'+(KN_TAB==='num'?' on':'')+'" data-p="num"><div id="kn-nums">'+nums+'</div>'+(gH||(!T.some(function(t){return t[0]==='all';})?mH:''))+'</div>'+(mH&&gH?'<div class="kn-pane'+(KN_TAB==='all'?' on':'')+'" data-p="all"><div id="kn-nums">'+nums+'</div>'+mH+'</div>':(mH&&!gH?'':''));
    return {hd:headHtml({icon:'📊',title:title,pos:'',chips:['<span class="kn-hc">'+rows.length+' 筆</span>']}),body:body,T:T,title:title,cap:cap,byG:byG,byM:byM};}
  function showSum(table,rows,title,opt){var inf=sumInfo(table);if(!inf)return;if(opt&&opt.group!=null){var gi=-1;inf.H.forEach(function(h,i){if(gi<0&&String(h).indexOf(opt.group)>=0)gi=i;});if(gi>=0){inf.gs=[gi];inf.g=gi;}}if(opt&&opt.noMonth)inf.ds=[];if(opt&&opt.noAmt)inf.am=[];rows=rows||inf.rows;var cap=capOf(table)||'';title=title||(cap||'統計 Summary');var last=null;
    openAt({kind:'sum',n:1,els:[table],inf:inf,rows:rows,table:table,title:title,build:function(){last=sumSec(inf,rows,title,cap);this.last=last;return last;}},0);}
  function sumClick(c){if(!SRC||SRC.kind!=='sum'||!SRC.last)return false;var g=c.getAttribute('data-g'),m=c.getAttribute('data-m'),S=SRC;
    if(m!=null){var hm=S.last.byM.filter(function(x){return x.k===m;})[0];if(hm){KN_TAB='num';showSum(S.table,hm.rows,m+' · '+S.title.replace(/^20\d\d-\d\d · /,''));}return true;}
    if(g!=null){var hg=S.last.byG[g];if(hg){var sub=hg.rows;KN_TAB='num';openAt({kind:'row',n:sub.length,els:sub,build:function(k){return rowSec(sub[k],sub);}},0);}return true;}
    return false;}
  try{window.acKeynoteSummary=function(t,o){KN_TAB='num';showSum(t,null,o&&o.title,o);};}catch(e){}
  /* v8（2026-11-23）通用長條卡 acKeynoteBars：頁面自己給「標題＋大數字＋每一條的名稱／數值」；某一條有帶 rows（表格列）時，點它 → 那幾列的明細卡。
     給考勤這種「沒有名單、只有各組數字」的月卡用。只畫畫面。 */
  try{window.acKeynoteBars=function(o){o=o||{};KN_TAB='num';var blocks=o.blocks||[],byG={};
    var nums=(o.nums||[]).map(function(x){return '<div class="kn-n"><div class="kn-nl"><span class="kn-ic">'+(x.icon||'📊')+'</span>'+esc(x.label)+'</div><div class="kn-nv" style="font-size:28px">'+esc(x.value)+'</div></div>';}).join('');
    var bh=blocks.map(function(b,bi){var mx=Math.max.apply(null,b.items.map(function(x){return Math.abs(+x.v||0);}).concat([0]))||1;
      return '<div class="kn-ref" style="margin:'+(bi?'12px':'0')+' 0 6px;font-weight:700">'+esc(b.label||'')+'</div>'+b.items.map(function(x,i){var key=bi+'|'+i,has=x.rows&&x.rows.length;byG[key]={rows:x.rows||[]};
        return '<button type="button" class="kn-br" '+(has?'data-g="'+key+'"':'style="cursor:default"')+'><span class="n">'+esc(x.k)+'</span><span class="t"><i style="width:'+Math.max(3,Math.round(Math.abs(+x.v||0)/mx*100))+'%'+(x.color?';background:'+esc(x.color):'')+'"></i></span><span class="v">'+esc(x.text!=null?x.text:x.v)+'</span></button>';}).join('')+
        (b.total!=null?'<div class="kn-br on" style="cursor:default;margin-top:8px"><span class="n">'+esc(b.totalLabel||'合計 Total')+'</span><span class="t"></span><span class="v">'+esc(b.total)+'</span></div>':'');}).join('');
    var T=[['num','📊 '+(o.tab||'統計')]];
    openAt({kind:'sum',n:1,els:[document.body],title:o.title||'',table:null,build:function(){KN_ROW=null;KN_T=T;KN_HASTOP=false;
      var r={hd:headHtml({icon:o.icon||'📊',title:o.title||'',pos:'',chips:(o.chips||[]).map(function(c){return '<span class="kn-hc">'+esc(c)+'</span>';})}),body:'<div class="kn-pane on" data-p="num">'+(nums?'<div id="kn-nums">'+nums+'</div>':'')+'<div id="kn-cmp">'+bh+'</div></div>',T:T,title:o.title||'',cap:'',byG:byG,byM:[]};this.last=r;return r;}},0);};}catch(e){}
  function hide(){mask.classList.remove('on');curRow=null;curCard=null;SRC=null;}
  /* ── v2.1 儀表板卡片 Keynote（2026-11-22 Paul：各分頁儀表板的小卡按了沒反應）──
     KPI 小卡、統計格、長條列（同一排／同一組有 2 張以上長得一樣的）點了 → 跳出大字卡：
     這張的數字＋說明；「全部」列出同組每一張；「比較」同組數字排名，點了直接換那一張；◀ ▶／左右滑換下一張。
     原本點了就有功能的卡（onclick、按鈕、連結）照舊，不攔。 */
  var C_NOGO='#kn-mask,nav,header,thead,table,[role=tablist],[role=dialog],dialog,.hp-mask,#hp-pcards,[data-keynote="off"],[class*="modal" i],[class*="toast" i],canvas,svg';
  var C_SEL='.kpi,.stat,.stat-card,.stat-item,.kcard,.metric,.kpi-card,.sum-card,.hstat,.card,.chart-row,[class*="kpi" i],[class*="stat" i]';
  function sibsOf(el){var p=el.parentElement;if(!p)return [];var k=el.tagName+'|'+(el.getAttribute('class')||'').replace(/\b(anim(-\d)?|act|on|active|selected|fx-\S+|hp-tint|kn-\S+)\b/g,'').trim();
    return [].filter.call(p.children,function(x){return x.tagName+'|'+(x.getAttribute('class')||'').replace(/\b(anim(-\d)?|act|on|active|selected|fx-\S+|hp-tint|kn-\S+)\b/g,'').trim()===k&&x.offsetParent!==null;});}
  function cardish(el){
    if(!el||el.nodeType!==1||el===document.body||el.closest(C_NOGO))return false;
    if(el.matches('button,a,input,select,textarea,label,[onclick],[role=button]')||el.querySelector('button,a[href],input,select,textarea,[onclick],canvas,table'))return false;
    var t=txt(el);if(t.length<1||t.length>240||!/\d/.test(t))return false;
    var r=el.getBoundingClientRect();if(r.height>360||r.width<40||r.height<18)return false;
    var NUMRE=/^[-+−$＄៛]?\s?[\d,]+(\.\d+)?\s?(%|人|件|項|次|天|筆|h|hr|hrs|d|ppl|k|K|M)?$/,hasNum=String(el.innerText||el.textContent||'').split(/\n+/).some(function(x){x=x.replace(/\s+/g,' ').trim();return x.length<=24&&NUMRE.test(x);})||[].some.call(el.querySelectorAll('*'),function(n){return !n.children.length&&NUMRE.test(txt(n));});if(!hasNum)return false;
    return sibsOf(el).length>=2||el.matches(C_SEL);
  }
  function cardOf(t){var el=t;for(var i=0;i<6&&el&&el!==document.body;i++,el=el.parentElement){if(cardish(el))return el;}return null;}
  try{window.acKnCardOf=function(t){return cardOf(t);};}catch(e){}
  function cardParts(el){
    var best=null,bs=0;[].forEach.call(el.querySelectorAll('*'),function(n){if(n.children.length)return;var tx=txt(n);if(!/\d/.test(tx)||tx.length>30)return;var fs=parseFloat(getComputedStyle(n).fontSize)||0;if(fs>bs){bs=fs;best=n;}});
    var val=best?txt(best):((txt(el).match(/[-+$＄]?[\d,]+(\.\d+)?%?/)||[''])[0]);
    var lines=String(el.innerText||el.textContent||'').split(/\n+/).map(function(x){return x.replace(/\s+/g,' ').trim();}).filter(Boolean);
    var rest=lines.filter(function(x){return x!==val;});
    var label=rest.filter(function(x){return !/^[-+$＄]?[\d,.\s%]+$/.test(x);})[0]||rest[0]||val;
    if(lines.length===1){var m1=label.match(/^(.*?[^\d\s,.$＄])\s+[-+$＄]?[\d,.\s%]+$/);if(m1)label=m1[1];}
    return {val:val,label:label,lines:rest.filter(function(x){return x!==label;}),n:num(val)};
  }
  function capOf(el){var c=el.parentElement;for(var i=0;i<5&&c;i++,c=c.parentElement){var h=c.querySelector('h1,h2,h3,h4,.ct,.ch,.sect-title,[class*="title"]');if(h&&!el.contains(h)&&!h.contains(el))return txt(h).slice(0,60);}return '';}
  function cardSec(el,sib){KN_ROW=null;
    var idx=sib.indexOf(el),P=cardParts(el),all=sib.map(cardParts),cap=capOf(el);
    var numsHtml='<div class="kn-n" style="grid-column:1/-1"><div class="kn-nl"><span class="kn-ic">'+icOf(P.label)+'</span>'+esc(P.label)+'</div><div class="kn-nv" style="font-size:34px">'+esc(P.val)+'</div>';
    var nums=all.filter(function(x){return x.n!==null;});
    if(P.n!==null&&nums.length>=2){var mx=Math.max.apply(null,nums.map(function(x){return Math.abs(x.n);}))||1,rank=nums.filter(function(x){return x.n>P.n;}).length+1,sum=nums.reduce(function(a,x){return a+x.n;},0);
      numsHtml+='<div class="kn-bar"><i style="width:'+Math.max(3,Math.round(Math.abs(P.n)/mx*100))+'%"></i></div><div class="kn-ref">'+vsAvg(P.n,sum/nums.length)+'</div>';}
    numsHtml+='</div>';   /* 外面 tabsHtml 會包一層 #kn-nums；這張大數字卡佔整列 */
    var rowsHtml=P.lines.map(function(x){var m=x.match(/^(.{1,30}?)[：:]\s*(.+)$/);if(m&&/[：:|｜]/.test(m[2]))m=null;return '<div class="kn-r'+((!m||P.lines.length===1)?' full':'')+'"><div class="kn-rl"><span class="kn-ic">'+(m?icOf(m[1]):'🗒')+'</span>'+esc(m?m[1]:'說明')+'</div><div class="kn-rv">'+esc(m?m[2]:x)+'</div></div>';}).join('');
    var allHtml=all.map(function(x,i){return '<button type="button" class="kn-br'+(i===idx?' on':'')+'" data-i="'+i+'" style="grid-template-columns:1fr auto"><span class="n">'+(i===idx?'▶ ':'')+'<span class="kn-ic">'+icOf(x.label)+'</span>'+esc(x.label)+'</span><span class="v">'+esc(x.val)+'</span></button>';}).join('');
    var cmpHtml='';
    if(nums.length>=2){var srt=all.map(function(x,i){return {x:x,i:i};}).filter(function(o){return o.x.n!==null;}).sort(function(a,b){return b.x.n-a.x.n;}),mx2=Math.max.apply(null,srt.map(function(o){return Math.abs(o.x.n);}))||1;
      cmpHtml=srt.map(function(o,k){var on=o.i===idx;return '<button type="button" class="kn-br'+(on?' on':'')+'" data-i="'+o.i+'"><span class="n">'+(on?'▶ ':'')+(k+1)+'. '+esc(o.x.label)+'</span><span class="t"><i style="width:'+Math.max(3,Math.round(Math.abs(o.x.n)/mx2*100))+'%"></i></span><span class="v">'+esc(o.x.val)+'</span></button>';}).join('')+'<div class="kn-ref" style="margin-top:6px">點任一條直接換到那一張</div>';}
    var body=tabsHtml(numsHtml,rowsHtml,'<div id="kn-cmp">'+allHtml+'</div>',cmpHtml).replace('<div id="kn-rows"><div id="kn-cmp">','<div><div id="kn-cmp">');
    return {hd:headHtml({icon:icOf(P.label)||'📊',title:P.label,pos:sib.length>1?'<b>'+(idx+1)+'</b> / '+sib.length:'',chips:P.val?['<span class="kn-hc">'+esc(P.val)+'</span>']:[]}),body:body,T:KN_T,title:P.label,cap:cap};
  }
  function showCard(el){var sib=sibsOf(el);if(sib.indexOf(el)<0)sib=[el];
    openAt({kind:'card',n:sib.length,els:sib,build:function(k){return cardSec(sib[k],sib);}},sib.indexOf(el));}
  /* 分頁：重點（數字＋文字重點）／全部資料／比較 */
  function tabsHtml(nums,rowsH,all,cmp){
    var T=[];if(nums||rowsH)T.push(['num','📊 重點 Key']);T.push(['all','📋 全部資料 All']);if(cmp)T.push(['cmp','📈 比較 Compare']);
    if(!T.some(function(t){return t[0]===KN_TAB;}))KN_TAB=T[0][0];
    /* 頁面自訂內容：window.acKeynoteTop／acKeynoteExtra(row,table) 回傳 HTML（照片、相關記錄、按鈕）。
       Top 放在分頁列的上面（不管看哪個分頁都看得到，2026-11-22 Paul：停在「全部資料」時看不到員工照片）；Extra 放在「重點」分頁最下面 */
    var hk=function(n){try{return typeof window[n]==='function'&&KN_ROW?(window[n](KN_ROW,KN_ROW.closest('table'))||''):'';}catch(e){return '';}},hTop=hk('acKeynoteTop'),hEx=hk('acKeynoteExtra');
    if(hEx&&!T.some(function(t){return t[0]==='num';})){T.unshift(['num','📊 重點 Key']);}
    KN_HASTOP=!!hTop;KN_T=T;
    return (hTop?'<div class="kn-top">'+hTop+'</div>':'')
      +'<div class="kn-pane'+(KN_TAB==='num'?' on':'')+'" data-p="num">'+(nums?'<div id="kn-nums">'+nums+'</div>':'')+(rowsH?'<div id="kn-rows">'+rowsH+'</div>':'')+hEx+'</div>'
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
  function lab(r){try{var v=typeof window.acKeynoteLabel==='function'?window.acKeynoteLabel(r,r.closest('table')):'';return v?String(v):'';}catch(e){return '';}}   /* 頁面可自訂每筆的名稱（標題、膠囊） */
  function chipOf(r){var L0=lab(r);if(L0)return L0.slice(0,22);var a=nk(txt(r.cells[0])),b=r.cells[1]?txt(r.cells[1]):'';return ((/^\d{1,3}$/.test(a)||!a)&&b?b:a+(b&&num(b)===null&&/^\d+$/.test(a)?' '+b:'')).slice(0,22)||'—';}
  function jump(i){if(SRC)openAt(SRC,i);}
  /* 上一筆／下一筆：按鈕、鍵盤方向鍵、手指上下或左右滑、滑鼠滾輪滾到底再滾 */
  /* 2026-11-23 Paul：重點卡的參考字要白話——不寫「第 N 名／共 79 筆」，只說平均多少、這一筆比平均多還是少 */
  function vsAvg(n,avg){var d=n-avg,same=Math.abs(d)<Math.max(0.005,Math.abs(avg)*0.005);
    return '平均 Avg '+fmt(avg)+'<br>'+(same?'＝ 跟平均一樣 same as average':(d>0?'▲ 比平均多 above avg ':'▼ 比平均少 below avg ')+fmt(Math.abs(d)));}
  function kfn(){var f=window.vrtFx;if(!f){try{f=window.top.vrtFx;}catch(e){}}return f;}
  function kfx(d,o,ax,sn){try{var f=kfn();if(f&&box)f(box,d,o,ax,sn);else if(sn&&sn.parentNode)sn.parentNode.removeChild(sn);}catch(e){}}   /* 2026-11-23 翻頁特效（music.js 的 vrtFx；沒載就什麼都不做） */
  function step(d){
    if(!SRC||!sc)return false;var i=IDX+d;if(i<0||i>=SRC.n)return false;
    if(i<FIRST){openAt(SRC,i);return true;}                       /* 往回超過目前畫出來的第一張：從那一張重新接 */
    while(NEXT<=i&&append()){}
    var el=secEl(i);if(!el)return false;sc.scrollTo({top:el.offsetTop-sc.offsetTop-2,behavior:'smooth'});
    try{if(SRC.kind==='row'&&document.body.contains(SRC.els[i]))SRC.els[i].scrollIntoView({block:'nearest'});}catch(e){}
    return true;
  }
  function init(){
    mask=document.createElement('div');mask.id='kn-mask';mask.setAttribute('data-noswipe','');box=document.createElement('div');box.id='kn-box';mask.appendChild(box);document.body.appendChild(mask);
    mask.addEventListener('click',function(e){
      if(e.target===mask||e.target.id==='kn-x'){hide();return;}
      var b=e.target.closest('#kn-nav button');if(b){step(+b.dataset.d);return;}
      var c=e.target.closest('.kn-br');if(c){if(c.hasAttribute('data-g')||c.hasAttribute('data-m')){sumClick(c);return;}if(c.dataset.i==null)return;jump(+c.dataset.i);return;}
      var tb=e.target.closest('#kn-tabs button');if(tb){KN_TAB=tb.dataset.tab;[].forEach.call(sc.querySelectorAll('.kn-sec'),showPane);paintTop();var e0=secEl(IDX);if(e0)sc.scrollTop=e0.offsetTop-sc.offsetTop-2;return;}
      var sec=e.target.closest('.kn-sec'),si=sec?+sec.getAttribute('data-i'):IDX,rw=SRC&&SRC.kind==='row'?SRC.els[si]:null;
      var cc=e.target.closest('.kn-cc button');if(cc&&rw){KN_COL=cc.dataset.col;openAt(SRC,si);return;}
      var nc=e.target.closest('.kn-n[data-c]');if(nc&&rw){var lb=nc.querySelector('.kn-nl');KN_COL=lb?lb.textContent.replace(/^\S*\s?/,'').trim():'';try{KN_COL=(heads(rw.closest('table'))[+nc.dataset.c])||KN_COL;}catch(_){}KN_TAB='cmp';openAt(SRC,si);}
    });
    document.addEventListener('keydown',function(e){if(!mask.classList.contains('on'))return;if(e.key==='Escape')hide();else if(e.key==='ArrowRight'||e.key==='PageDown'){e.preventDefault();step(1);}else if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();step(-1);}});
    /* 左右滑＝上一筆／下一筆；上下就是一般的捲動（會自己接下一筆） */
    var tx=0,ty=0,tt=0;
    box.addEventListener('touchstart',function(e){if(e.touches.length!==1){tt=0;return;}var p=e.touches[0];tx=p.clientX;ty=p.clientY;tt=Date.now();},{passive:true});
    box.addEventListener('touchend',function(e){if(!tt)return;var p=e.changedTouches[0],dx=p.clientX-tx,dy=p.clientY-ty,dt=Date.now()-tt;tt=0;
      if(dt<700&&Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.8&&!(e.target.closest&&e.target.closest('.kn-cc,[data-noswipe-x]')))step(dx<0?1:-1);},{passive:true});
    document.addEventListener('click',function(e){
      var t=e.target;if(!t||!t.closest||t.closest('#kn-mask'))return;
      if(t.closest('button,a,input,select,textarea,label,summary,[contenteditable="true"],[role="button"],[data-keynote="off"]'))return;
      var oc=t.closest('[onclick]');if(oc&&oc.tagName!=='TR'&&oc.closest('tr'))return;            /* 列裡面自己有功能的小格（例如點月份切換狀態）不跳 */
      var row=t.closest('tr');if(!row){var cd=cardOf(t);if(cd){var s0=window.getSelection&&String(window.getSelection());if(!(s0&&s0.length>1))setTimeout(function(){if(document.body.contains(cd))showCard(cd);},60);}return;}
      if(row.closest('thead')||row.querySelector('th')||row.cells.length<2)return;
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
    function sumBtns(){try{[].forEach.call(document.querySelectorAll('table'),function(tb){if(tb.__knS||tb.dataset.keynote==='off'||tb.closest('#kn-mask')||tb.offsetParent===null)return;if(tb.__knSc===tb.rows.length)return;tb.__knSc=tb.rows.length;var inf=null;try{inf=sumInfo(tb);}catch(e){}if(!inf||inf.rows.length<5)return;tb.__knS=1;
        var host=tb.parentElement&&/auto|scroll/.test(getComputedStyle(tb.parentElement).overflowX)?tb.parentElement:tb,pv=host.previousElementSibling,b=pv&&pv.classList&&pv.classList.contains('kn-sumbtn')?pv:null;   /* 表格被頁面重畫時沿用原本那顆，不要越疊越多 */
        if(!b){b=document.createElement('button');b.type='button';b.className='kn-sumbtn';b.setAttribute('data-keynote','off');b.textContent='📊 圖表 Chart';host.parentElement.insertBefore(b,host);}
        b.onclick=function(ev){ev.stopPropagation();KN_TAB='num';showSum(tb);};});}catch(e){}}
    var tidy0=tidy;tidy=function(){tidy0();sumBtns();};
    tidy();try{new MutationObserver(function(){if(!tm)tm=setTimeout(tidy,600);}).observe(document.body,{childList:true,subtree:true});}catch(e){}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
