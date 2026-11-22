/* AC HRA 列表 Keynote v1（2026-11-22，Paul）
   任何列表點一列 → 跳出一張大字卡：這一列的每個欄位（標題：值），數字欄另外附「同表合計／平均／排名」和比例條供參考。
   手機上欄位被擠成直排也能看清楚。只讀畫面上的表格，不動資料、不取代原本點列的功能（原本會切換期間的照樣切換）。
   不會跳出的情況：點到按鈕／連結／輸入框／勾選框、正在選取文字、表格標 data-keynote="off"。
   另外：第一欄的短代碼（工號、期間 2026-09）不再被折成一個字一行。 */
(function(){
  'use strict';
  if(window.__acKeynote)return;window.__acKeynote=1;
  var css='#kn-mask{position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:9990;display:none;align-items:flex-end;justify-content:center;-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}'
   +'#kn-mask.on{display:flex}@media(min-width:720px){#kn-mask{align-items:center}}'
   +'#kn-box{background:#fff;color:#0f172a;width:min(680px,100%);max-height:86vh;overflow:auto;border-radius:18px 18px 0 0;box-shadow:0 -8px 40px rgba(0,0,0,.3);font-family:inherit;animation:knUp .22s ease-out}'
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
   +'tbody tr.kn-able{cursor:pointer}';
  var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
  var mask,box,curRow=null;
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function txt(el){return (el.innerText||el.textContent||'').replace(/\s*\n\s*/g,' ').replace(/\s+/g,' ').trim();}
  function num(s){var t=String(s).replace(/[,\s$＄]/g,'');if(!/^[-+−]?\d+(\.\d+)?(%|人|人次|項|天|筆|d|ppl)?$/.test(t))return null;var v=parseFloat(t.replace('−','-'));return isFinite(v)?v:null;}
  function fmt(v){var a=Math.abs(v);return (Math.round(v*100)/100).toLocaleString('en-US',{maximumFractionDigits:a>=100?0:2});}
  function heads(table){
    var rows=table.tHead?[].slice.call(table.tHead.rows):[];if(!rows.length){var f=table.rows[0];if(f&&f.querySelector('th'))rows=[f];}
    if(!rows.length)return [];
    var out=[];rows.forEach(function(r,ri){var c=0;[].forEach.call(r.cells,function(th){var span=th.colSpan||1,t=txt(th);while(out[c]&&out[c].lock)c++;for(var k=0;k<span;k++){out[c+k]=out[c+k]||{t:''};if(span===1||ri===rows.length-1){out[c+k].t=(out[c+k].t&&span===1&&ri>0?out[c+k].t+' · ':ri>0?'':out[c+k].t)+t;}else out[c+k].t=t;if((th.rowSpan||1)>1)out[c+k].lock=1;}c+=span;});});
    return out.map(function(x){return x?x.t:'';});
  }
  function dataRows(table){return [].filter.call(table.tBodies.length?table.querySelectorAll('tbody > tr'):table.rows,function(r){return r.cells.length>=2&&!r.querySelector('th')&&r.offsetParent!==null&&!(r.cells.length===1||r.cells[0].colSpan>2);});}
  function show(row){
    var table=row.closest('table');if(!table)return;
    var H=heads(table),rows=dataRows(table),cells=[].slice.call(row.cells);
    var card=table.closest('.card,.sect,section,.panel,.box,[class*="card"]'),capEl=card&&card.querySelector('.ct,.ch,h2,h3,h4,.sect-title,.title,[class*="title"]'),cap=capEl&&!table.contains(capEl)?txt(capEl).slice(0,60):'';
    var items=cells.map(function(td,i){return {l:H[i]||('#'+(i+1)),v:txt(td),n:num(txt(td)),i:i};}).filter(function(x){return x.v!==''&&!/^[—–-]$/.test(x.v)||x.n!==null;}).filter(function(x){return x.v!=='';});
    var ids=items.filter(function(x){return x.n===null||x.i===0||/工號|id|no\.?$|^#$|編號|期|date|日/i.test(x.l);});
    var title=items.slice(0,3).filter(function(x){return x.n===null||x.i<2;}).map(function(x){return x.v;}).slice(0,2).join(' · ')||items[0]&&items[0].v||'';
    var numsHtml='',rowsHtml='';
    items.forEach(function(x){
      var isId=x.i===0||/工號|factory id|emp|^id$|^#$|^no\.?$|編號|電話|phone|年$|year|期間|period/i.test(x.l);
      if(x.n!==null&&!isId){
        var col=rows.map(function(r){return r.cells[x.i]?num(txt(r.cells[x.i])):null;}).filter(function(v){return v!==null;});
        var ref='',bar='';
        if(col.length>=3){var sum=col.reduce(function(a,b){return a+b;},0),max=Math.max.apply(null,col.map(Math.abs))||1,rank=col.filter(function(v){return v>x.n;}).length+1,pct=/%$/.test(x.v);
          bar='<div class="kn-bar"><i style="width:'+Math.max(3,Math.round(Math.abs(x.n)/max*100))+'%"></i></div>';
          ref='<div class="kn-ref">'+(pct?'':'合計 Total '+fmt(sum)+' · ')+'平均 Avg '+fmt(sum/col.length)+'<br>排名 Rank '+rank+' / '+col.length+(pct||sum<=0||x.n<0?'':' · 佔 '+Math.round(x.n/sum*100)+'%')+'</div>';}
        numsHtml+='<div class="kn-n'+(x.n<0?' kn-neg':'')+'"><div class="kn-nl">'+esc(x.l)+'</div><div class="kn-nv">'+esc(x.v)+'</div>'+bar+ref+'</div>';
      }else rowsHtml+='<div class="kn-r"><div class="kn-rl">'+esc(x.l)+'</div><div class="kn-rv">'+esc(x.v)+'</div></div>';
    });
    var idx=rows.indexOf(row);
    box.innerHTML='<div id="kn-head"><div id="kn-title">'+esc(title)+'<div id="kn-sub">'+esc(cap)+(idx>=0?(cap?' · ':'')+(idx+1)+' / '+rows.length:'')+'</div></div><div id="kn-nav"><button type="button" data-d="-1" aria-label="prev">‹</button><button type="button" data-d="1" aria-label="next">›</button></div><button type="button" id="kn-x" aria-label="close">✕</button></div>'
      +(numsHtml?'<div id="kn-nums">'+numsHtml+'</div>':'')+(rowsHtml?'<div id="kn-rows">'+rowsHtml+'</div>':'');
    curRow=row;mask.classList.add('on');box.scrollTop=0;
  }
  function hide(){mask.classList.remove('on');curRow=null;}
  function init(){
    mask=document.createElement('div');mask.id='kn-mask';box=document.createElement('div');box.id='kn-box';mask.appendChild(box);document.body.appendChild(mask);
    mask.addEventListener('click',function(e){
      if(e.target===mask||e.target.id==='kn-x'){hide();return;}
      var b=e.target.closest('#kn-nav button');if(b&&curRow){var t=curRow.closest('table'),rs=t?dataRows(t):[],i=rs.indexOf(curRow)+(+b.dataset.d);if(i>=0&&i<rs.length)show(rs[i]);}
    });
    document.addEventListener('keydown',function(e){if(e.key==='Escape'&&mask.classList.contains('on'))hide();});
    document.addEventListener('click',function(e){
      var t=e.target;if(!t||!t.closest||t.closest('#kn-mask'))return;
      if(t.closest('button,a,input,select,textarea,label,summary,[contenteditable="true"],[role="button"],[data-keynote="off"]'))return;
      var row=t.closest('tr');if(!row||row.closest('thead')||row.querySelector('th')||row.cells.length<2)return;
      var table=row.closest('table');if(!table||table.dataset.keynote==='off'||table.rows.length<2)return;
      if(row.querySelector('input:not([type=checkbox]):not([type=radio]),select,textarea'))return;          /* 線上輸入列不跳 */
      var sel=window.getSelection&&String(window.getSelection());if(sel&&sel.length>1)return;
      setTimeout(function(){if(document.body.contains(row))show(row);},0);                                   /* 讓原本的點列功能先跑 */
    });
    /* 第一欄短代碼不折行；可點的列顯示手型 */
    var tm=null;function tidy(){tm=null;var n=0;[].forEach.call(document.querySelectorAll('table'),function(tb){if(n>4000)return;[].forEach.call(tb.rows,function(r){n++;var c=r.cells[0];if(c&&!c.__kn){c.__kn=1;var s=txt(c);if(s&&s.length<=12&&!/\s/.test(s)&&!c.querySelector('input,button'))c.style.whiteSpace='nowrap';}if(r.parentElement&&r.parentElement.tagName==='TBODY'&&r.cells.length>=2)r.classList.add('kn-able');});});}
    tidy();try{new MutationObserver(function(){if(!tm)tm=setTimeout(tidy,600);}).observe(document.body,{childList:true,subtree:true});}catch(e){}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
