/* 通用「聰明」KPI 大字卡 v1.2（2026-11-25 Paul：其他頁照入離職的方式——一張卡不要只有一個數；要名單、要分布圖、要走勢、每一條都能點、點人看員工卡）
   頁面沒有自己的大字卡內容時（沒有 acKeynoteCard），row-keynote 會先問這支：
   · 找這張 KPI 同一區塊裡最大的明細表（畫面上那張表）
   · 卡片名稱剛好是表裡某一欄的值（例：「離職」「Expired」「錄取」）→ 只看那些列；卡片名稱是某個數字欄（例：「金額合計」）→ 用那一欄加總
   · 👥 名單：每一列（點了打開那一列的大字卡，有工號會帶出員工照片卡）
   · 🏢 分布：每個分類欄（部門、類型、狀態、組別…）一組長條，每一條點了展開那些列
   · 📈 走勢：表裡有日期欄 → 近 12 個月筆數（有金額就加總）
   · 📊 圖表：同一區塊的圖（轉成圖片）
   只讀畫面上的表，不改資料。 */
(function(){
  'use strict';
  if(window.acSmartCard)return;
  function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function txt(e){return String(e&&(e.innerText||e.textContent)||'').replace(/\s+/g,' ').trim();}
  function num(s){var t=String(s).replace(/[,\s$＄]/g,'');if(!/^[-+−]?\d+(\.\d+)?(%|人|人次|項|天|筆|d|ppl|kg|趟)?$/.test(t))return null;var v=parseFloat(t.replace('−','-'));return isFinite(v)?v:null;}
  function nz(x){return String(x==null?'':x).toLowerCase().replace(/[\s\/／()（）._:：-]+/g,'');}
  function fmt(v){var a=Math.abs(v);return (Math.round(v*100)/100).toLocaleString('en-US',{maximumFractionDigits:a>=100?0:2});}
  function heads(t){var r=t.tHead&&t.tHead.rows.length?t.tHead.rows[t.tHead.rows.length-1]:(t.rows[0]&&t.rows[0].querySelector('th')?t.rows[0]:null),o=[];if(!r)return o;[].forEach.call(r.cells,function(c){for(var k=0;k<(c.colSpan||1);k++)o.push(txt(c).replace(/\s*[▲▼↕⇅]\s*$/,''));});return o;}
  function dataRows(t){return [].filter.call(t.tBodies.length?t.querySelectorAll('tbody > tr'):t.rows,function(r){return r.cells.length>=2&&!r.querySelector('th')&&(t.offsetParent===null?r.style.display!=='none':r.offsetParent!==null)&&!(r.cells[0].colSpan>2)&&!/^(合計|總計|小計|total|sum)/i.test(txt(r.cells[0]));});}
  var DATE_RE=/日期|date|到期|入職|離職|生效|月份|month|期間|period|ថ្ងៃ|time|時間/i,SKIP_RE=/姓名|name|工號|編號|^id$|^no\.?$|^#$|電話|phone|備註|note|remark|說明|desc|地址|address|email|照片|photo|操作|action|ឈ្មោះ/i,AMT_RE=/金額|usd|\$|薪|salary|pay|amount|費|cost|合計|total|riel|khr|價|kg|公斤|趟|trip/i;
  function isDate(v){return /\b20\d{2}[-\/.]\d{1,2}([-\/.]\d{1,2})?\b/.test(v)||/^\d{1,2}[-\/]\d{1,2}[-\/]20\d{2}$/.test(v);}
  function mKey(v){var m=String(v).match(/(20\d{2})[-\/.年](\d{1,2})/);if(m)return m[1]+'-'+('0'+m[2]).slice(-2);m=String(v).match(/(\d{1,2})[-\/.](\d{1,2})[-\/.](20\d{2})/);return m?m[3]+'-'+('0'+m[2]).slice(-2):'';}
  function bg(x){x=nz(x).replace(/[0-9]+/g,'');var o={};for(var i=0;i<x.length-1;i++)o[x.substr(i,2)]=1;if(x.length===1)o[x]=1;return o;}
  function ov(a,b){var n=0;for(var k in a)if(b[k])n++;return n;}
  function secHead(t){var p=t.parentElement;for(var i=0;i<6&&p&&p!==document.body;i++,p=p.parentElement){var h=[].filter.call(p.querySelectorAll('h1,h2,h3,h4,.ct,.card-title,.title,[class*="title"]'),function(x){return !t.contains(x)&&!x.contains(t);})[0];if(h)return txt(h)+' '+(p.id||'');}return '';}
  /* v1.1 KPI 常在「總覽」，明細表在別的分頁（隱藏中）→ 全頁的表都看，依「同區塊、標題／欄名／值跟卡片字的重疊」打分 */
  function bestTable(el,label,extra){var near=null,p=el.parentElement;for(var i=0;i<8&&p&&p!==document.body;i++,p=p.parentElement){if([].some.call(p.querySelectorAll('table'),function(t){return !el.contains(t)&&t.offsetParent!==null;})){near=p;break;}}
    var LB=bg(label),EB=bg(extra||''),best=null,bs=0,big=null,bigN=0;
    [].forEach.call((el.ownerDocument||document).querySelectorAll('table'),function(t){if(el.contains(t)||t.closest('#kn-mask,[data-keynote="off"],.pkn-box'))return;var R=dataRows(t);if(R.length<2)return;
      var sc=0,H=heads(t).join(' '),hb=bg(secHead(t)+' '+H);sc+=ov(LB,hb)*2+ov(EB,hb);
      var L0=nz(label);if(L0.length>=2){var hit=R.filter(function(r){return nz(txt(r)).indexOf(L0)>=0;}).length;if(hit&&hit<R.length)sc+=4;}
      if(near&&near.contains(t)&&t.offsetParent!==null)sc+=5;
      sc+=Math.min(2,R.length/20);
      if(sc>bs){bs=sc;best=t;}if(R.length>bigN){bigN=R.length;big=t;}});
    /* v1.3：對不到就用本頁最大的那張明細表（至少有名單／分布可看，不再只剩一個數字） */
    return bs>=2.5?best:(bigN>=3?big:null);}
  function model(t){var H=heads(t),R=dataRows(t),cols=H.map(function(h,i){var vals=R.map(function(r){return r.cells[i]?txt(r.cells[i]):'';}),ne=vals.filter(Boolean),nn=ne.filter(function(v){return num(v)!==null;}).length,dd=ne.filter(isDate).length,uniq={};ne.forEach(function(v){uniq[v]=1;});var u=Object.keys(uniq).length;
      return {h:h,i:i,vals:vals,date:ne.length&&(dd>=ne.length*.6||(DATE_RE.test(h)&&dd>0)),num:ne.length&&nn>=ne.length*.7,cat:ne.length>=2&&nn<ne.length*.5&&dd<ne.length*.5&&u>=2&&!DATE_RE.test(h)&&!/^[—\-–\s]*$/.test(ne[0]||'')&&u<=Math.max(2,Math.min(30,R.length*.85))&&!SKIP_RE.test(h),u:u};});
    return {H:H,R:R,cols:cols};}
  var REG=[];
  function rowItem(r,M,ac){var ri=REG.push(r)-1,k=M.R.indexOf(r),cs=M.cols.filter(function(c){return !c.num&&!c.date&&c.vals[k]&&!/^[—\-–]$/.test(c.vals[k]);}),tc=cs.slice().sort(function(a,b){return b.u-a.u;})[0],cells=(tc?[tc]:[]).concat(cs.filter(function(c){return c!==tc;})).slice(0,4).map(function(c){return c.vals[k];}),v=ac?ac.vals[M.R.indexOf(r)]:'';
    return '<div class="skn-r kn-rtr" data-skr="'+ri+'"><span>'+esc(cells[0]||'')+(cells.length>1?'<small>'+esc(cells.slice(1).join(' · '))+'</small>':'')+'</span><span class="v">'+esc(v)+' ›</span></div>';}
  function rowList(rows,M,ac,max){max=max||60;return '<div class="skn-tb">'+rows.slice(0,max).map(function(r){return rowItem(r,M,ac);}).join('')+'</div>'+(rows.length>max?'<div class="skn-note">'+rows.length+' 筆，先列 '+max+' 筆</div>':'');}
  function bars(list,M,ac,color){if(!list.length)return '';var mx=Math.max.apply(null,list.map(function(x){return Math.abs(x.v);}))||1;
    return list.map(function(x){var bi=REG.push({rows:x.rows,M:M,ac:ac})-1;return '<div class="skn-br skn-bk" data-skb="'+bi+'"><span class="n"><i class="skn-ar">▸</i>'+esc(x.n)+'<small>'+x.rows.length+' 筆</small></span><span class="t"><i style="width:'+Math.max(3,Math.round(Math.abs(x.v)/mx*100))+'%;background:'+(color||'#60a5fa')+'"></i></span><span class="v">'+esc(x.vt)+'</span></div>';}).join('');}
  function chart(items,title,color){var vs=items.map(function(x){return x.v;});if(!vs.some(function(v){return v;}))return '';var W=340,H=120,pt=16,pb=20,mx=Math.max.apply(null,vs)*1.12||1,bw=W/items.length,o='';
    items.forEach(function(x,i){var X=i*bw+bw*.15,h=Math.max(1,(H-pt-pb)*x.v/mx),Y=H-pb-h;o+='<rect x="'+X.toFixed(1)+'" y="'+Y.toFixed(1)+'" width="'+(bw*.7).toFixed(1)+'" height="'+h.toFixed(1)+'" rx="2" fill="'+(x.cur?'#4f46e5':(color||'#60a5fa'))+'"/><text x="'+(X+bw*.35).toFixed(1)+'" y="'+(Y-2).toFixed(1)+'" font-size="7.5" text-anchor="middle" fill="currentColor" opacity=".8">'+esc(x.t!=null?x.t:x.v)+'</text><text x="'+(X+bw*.35).toFixed(1)+'" y="'+(H-6)+'" font-size="8" text-anchor="middle" fill="currentColor" opacity=".6">'+esc(x.k)+'</text>';});
    return '<div class="skn-ch"><div class="skn-st">'+esc(title)+'</div><svg viewBox="0 0 '+W+' '+H+'" width="100%" preserveAspectRatio="none" style="display:block;height:'+H+'px">'+o+'</svg></div>';}
  function addM(m,k){var y=+m.slice(0,4),mm=+m.slice(5)+k;while(mm<1){mm+=12;y--;}while(mm>12){mm-=12;y++;}return y+'-'+('0'+mm).slice(-2);}
  window.acSmartCard=function(el,label,val,chartsHtml,extra){try{
    var t=bestTable(el,label,extra);if(!t)return null;var M=model(t);if(M.R.length<2)return null;
    var L0=nz(label),fc=null,rows=M.R;
    /* 卡片名稱＝某個分類欄的值 → 只看那些列 */
    /* v1.2：先找「完全一樣」（男≠女、Male≠Female），找不到才用「包含」；男/女/M/F/Male/Female/ប្រុស/ស្រី 視為同義 */
    var CAN=function(x){x=nz(x);if(/^(女|f|female|women|woman|ស្រី|女性)$/.test(x)||/^女/.test(x)&&x.length<=3)return '#F';if(/^(男|m|male|men|man|ប្រុស|男性)$/.test(x)||/^男/.test(x)&&x.length<=3)return '#M';return x;},LC=CAN(label);
    if(L0)[1,2].forEach(function(pass){if(fc)return;M.cols.forEach(function(c){if(fc||!c.cat&&!(c.u<=12))return;var hit=M.R.filter(function(r){var raw=c.vals[M.R.indexOf(r)],v=nz(raw),cv=CAN(raw);if(!v)return false;if(pass===1)return cv===LC||v===L0;if(LC.charAt(0)==='#'||cv.charAt(0)==='#')return false;return (v.length>1&&L0.indexOf(v)>=0&&v.length>=L0.length*.5)||(L0.length>1&&v.indexOf(L0)>=0);});if(hit.length&&hit.length<M.R.length){fc=c;rows=hit;}});});
    var ac=M.cols.filter(function(c){return c.num&&L0&&nz(c.h)&&(nz(c.h)===L0||L0.indexOf(nz(c.h))>=0||nz(c.h).indexOf(L0)>=0);})[0]||M.cols.filter(function(c){return c.num&&AMT_RE.test(c.h)&&!SKIP_RE.test(c.h);})[0]||null;
    var dcs=M.cols.filter(function(c){return c.date;}),LX=bg(label+' '+(extra||'')+(/到期|逾期|expir|due/i.test(label+extra)?' 到期expiry':'')),dc=dcs.slice().sort(function(a,b){return ov(bg(b.h),LX)-ov(bg(a.h),LX);})[0]||null;
    var sumOf=function(rs){return ac?rs.reduce(function(s,r){var v=num(ac.vals[M.R.indexOf(r)]);return s+(v||0);},0):null;};
    var cap=(function(){var c=t.closest('.card,section,.panel,.box,[class*="card"]'),h=c&&c.querySelector('h2,h3,h4,.ct,.ch,[class*="title"]');return h&&!t.contains(h)?txt(h).slice(0,40):'';})();
    /* 走勢 */
    var tr='';if(dc){var mk=rows.map(function(r){return mKey(dc.vals[M.R.indexOf(r)]);}).filter(Boolean).sort(),last=mk[mk.length-1];
      if(last){var MS=[];for(var i=11;i>=0;i--)MS.push(addM(last,-i));var by={};rows.forEach(function(r){var k=mKey(dc.vals[M.R.indexOf(r)]);if(!k)return;(by[k]=by[k]||[]).push(r);});
        tr=chart(MS.map(function(m){return {k:String(+m.slice(5))+'月',v:(by[m]||[]).length,cur:m===last};}),'📈 近 12 個月筆數（依「'+dc.h+'」）')+(ac?chart(MS.map(function(m){var s=sumOf(by[m]||[]);return {k:String(+m.slice(5))+'月',v:s,t:s>=1000?(s/1000).toFixed(1)+'k':fmt(s),cur:m===last};}),'💵 近 12 個月 '+ac.h+' 合計','#34d399'):'')+
          '<div class="skn-st">🗒 每月（點了看那個月的列）</div>'+bars(MS.slice().reverse().filter(function(m){return by[m];}).map(function(m){var rs=by[m];return {n:m,v:ac?sumOf(rs):rs.length,vt:ac?fmt(sumOf(rs)):rs.length+' 筆',rows:rs};}),M,ac,'#a5b4fc');}}
    /* 分布 */
    var cats=M.cols.filter(function(c){return c.cat&&c!==fc&&c!==dc;}).sort(function(a,b){return a.u-b.u;}).slice(0,5),grp='';
    cats.forEach(function(c,ci){var g={},ord=[];rows.forEach(function(r){var v=c.vals[M.R.indexOf(r)]||'（空白）';if(!g[v]){g[v]=[];ord.push(v);}g[v].push(r);});if(ord.length<1)return;
      var list=ord.map(function(k){var rs=g[k],s=sumOf(rs);return {n:k,v:ac?s:rs.length,vt:ac?fmt(s):rs.length+' 筆',rows:rs};}).sort(function(a,b){return b.v-a.v;}).slice(0,25);
      grp+='<div class="skn-st">'+['🏢','🏷','🚦','🧵','📁'][ci%5]+' 依「'+esc(c.h)+'」</div>'+bars(list,M,ac,['#60a5fa','#a78bfa','#34d399','#fb923c','#f472b6'][ci%5]);});
    if(!grp)grp='<div class="skn-note">這張表沒有可以分類的欄位</div>';
    var sum=sumOf(rows),top='<div class="skn"><div class="skn-hero"><div class="skn-big">'+esc(val)+'</div><div class="skn-l">'+esc(label)+(cap?' · '+esc(cap):'')+'</div>'+
      '<div class="skn-kv"><div><b>'+rows.length+'</b><span>筆'+(fc?'（'+esc(fc.h)+'＝'+esc(label)+'）':'')+'</span></div>'+(ac?'<div><b>'+fmt(sum)+'</b><span>'+esc(ac.h)+' 合計</span></div><div><b>'+(rows.length?fmt(sum/rows.length):'—')+'</b><span>平均每筆</span></div>':'')+'</div>'+
      '<div class="skn-note">📋 資料來自本頁「'+esc(cap||'明細表')+'」，共 '+M.R.length+' 筆'+(fc?'，這張卡只算其中 '+rows.length+' 筆':'')+'；每一條、每一列都可以點</div></div></div>';
    var P=[['ppl','👥 名單','<div class="skn">'+rowList(rows,M,ac)+'</div>'],['grp','🏢 分布','<div class="skn">'+grp+'</div>']];
    if(tr)P.push(['num','📈 走勢','<div class="skn">'+tr+'</div>']);
    if(chartsHtml)P.push(['cht','📊 圖表','<div class="skn">'+chartsHtml+'</div>']);
    return {top:top,panes:P,filtered:!!fc};}catch(e){try{console.warn('smart-kn',e);}catch(_){}return null;}};
  document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('.skn-bk');if(!b)return;e.stopPropagation();var nx=b.nextElementSibling;if(nx&&nx.classList.contains('skn-bx')){nx.remove();b.classList.remove('open');return;}var it=REG[+b.getAttribute('data-skb')];if(!it)return;var d=document.createElement('div');d.className='skn-bx';d.innerHTML=rowList(it.rows,it.M,it.ac,40);b.classList.add('open');b.parentNode.insertBefore(d,b.nextSibling);},true);
  window.acSmartRow=function(i){return REG[i];};
  var css='.skn{padding:10px 14px 14px;color:#0f172a}.skn-hero{border:1px solid #e2e8f0;border-radius:14px;padding:12px 14px;background:#f8fafc}.skn-big{font-size:34px;font-weight:800;line-height:1.1}.skn-l{font-size:13px;color:#475569;font-weight:600;margin-top:3px}'
   +'.skn-kv{display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:8px}.skn-kv div{display:flex;flex-direction:column}.skn-kv b{font-size:17px}.skn-kv span{font-size:11px;color:#64748b}.skn-note{font-size:11.5px;color:#64748b;margin-top:6px;line-height:1.5}'
   +'.skn-st{font-size:13px;font-weight:700;margin:12px 0 6px;color:#1e293b}.skn-ch{border:1px solid #e2e8f0;border-radius:12px;padding:4px 8px 6px;margin:8px 0;background:#fff}'
   +'.skn-br{display:grid;grid-template-columns:minmax(90px,40%) 1fr auto;gap:8px;align-items:center;padding:5px 4px;border-bottom:1px solid #f1f5f9;font-size:13px}.skn-br .n{font-weight:600;word-break:break-word}.skn-br .n small{display:block;font-weight:400;color:#64748b;font-size:10.5px}.skn-br .t{height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden}.skn-br .t i{display:block;height:100%;border-radius:4px}.skn-br .v{font-weight:700;text-align:right;min-width:48px}'
   +'.skn-bk{cursor:pointer;border-radius:8px}.skn-bk:hover{background:#f1f5f9}.skn-ar{font-style:normal;color:#6366f1;margin-right:4px;display:inline-block;transition:transform .15s}.skn-bk.open .skn-ar{transform:rotate(90deg)}.skn-bx{border-left:3px solid #c7d2fe;margin:2px 0 8px 6px;padding-left:6px}'
   +'.pkn-box .skn{color:var(--i)}.pkn-box .skn-hero,.pkn-box .skn-ch{background:var(--s);border-color:var(--l)}.pkn-box .skn-l,.pkn-box .skn-note,.pkn-box .skn-r small,.pkn-box .skn-br .n small,.pkn-box .skn-kv span{color:var(--m)}.pkn-box .skn-st{color:var(--i)}.pkn-box .skn-br .t{background:var(--l)}.pkn-box .skn-bk:hover,.pkn-box .skn-r:hover{background:var(--a)}.pkn-box .skn-br,.pkn-box .skn-r{border-color:var(--l)}.pkn-box .skn-bx{border-color:var(--ab)}'
   +'.skn-tb .skn-r{display:flex;justify-content:space-between;gap:10px;padding:7px 4px;border-bottom:1px solid #f1f5f9;font-size:13px;cursor:pointer;align-items:center}.skn-r:hover{background:#f8fafc}.skn-r small{display:block;color:#64748b;font-size:10.5px}.skn-r .v{font-weight:700;white-space:nowrap}';
  try{var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);}catch(e){}
})();
