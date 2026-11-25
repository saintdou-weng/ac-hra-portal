/* 合約／試用 KPI 大字卡 v1（2026-11-25 Paul：卡片要先列人數或各別人數、金額，再看相關歷史和圖表；一張卡幾個分頁）
   ac_hra_contract_v2.html 合約那排 KPI（總數／有效／過期／即將到期／FDC／UDC／5% 筆數／應付總額／今年累計）：
   · 上方：數字＋跟上期比＋怎麼算
   · 👥 名單：這張卡算到的人（工號、姓名、部門、合約類型、到期日／剩幾天、5% 金額）——在 VRT HR 裡會帶出員工照片（點列看員工頁）
   · 🏢 分布：各部門、各合約類型、各職位
   · 📈 走勢：近 12 個月同一個數字
   只讀頁面資料（DASH_CONTS、contractSettlementEntriesForPeriod…），不改資料。 */
(function(){
  'use strict';
  if(window.__contKn)return;window.__contKn=1;
  function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function n(v){v=Number(v);return isFinite(v)?v:0;}
  function $m(v){return '$'+n(v).toFixed(2);}
  function L(zh,en,km){var l=(typeof LANG!=='undefined'?LANG:window.LANG)||'zh';return l==='en'?en:l==='km'?(km||en):zh;}
  function today(){try{return window.todayISO();}catch(e){return new Date().toISOString().slice(0,10);}}
  function stat(r){var st=r.status||'active';if(st==='active'&&r.endDate&&r.contractType&&r.contractType!=='UDC'&&r.endDate<today())st='expired';return st;}
  function days(r){try{return window.daysFromToday(r.endDate);}catch(e){return null;}}
  function soonD(){try{return (window.SETTINGS&&SETTINGS.reminderDays)||15;}catch(e){return 15;}}
  var F=[
    {k:'total',ic:'📋',f:function(){return true;}},
    {k:'active',ic:'✅',f:function(r){return stat(r)==='active';}},
    {k:'expired',ic:'⛔',f:function(r){return stat(r)==='expired';}},
    {k:'soon',ic:'⏰',f:function(r){if(r.contractType==='UDC'||stat(r)!=='active')return false;var d=days(r);return d!==null&&d>=0&&d<=soonD();}},
    {k:'fdc',ic:'📄',f:function(r){return /^FDC/i.test(String(r.contractType||''));}},
    {k:'udc',ic:'📘',f:function(r){return String(r.contractType||'').toUpperCase()==='UDC';}},
    {k:'pay5n',ic:'💜',pay:1},{k:'pay5',ic:'💵',pay:1,amt:1},{k:'ytd',ic:'📆',pay:1,amt:1,ytd:1}];
  function D(){try{return DASH_CONTS||[];}catch(e){return [];}}
  function mode(){try{return contMode;}catch(e){return 'month';}}
  function curKey(){try{return window.currentDashKey('cont');}catch(e){return '';}}
  function inMonth(r,m){try{return window.periodKey(window.getContDate(r),'month')===m;}catch(e){return false;}}
  function months(){var s={};D().forEach(function(r){try{var k=window.periodKey(window.getContDate(r),'month');if(k)s[k]=1;}catch(e){}});return Object.keys(s).sort();}
  function settle(p){try{return window.contractSettlementEntriesForPeriod(p).filter(function(x){return n(x.settlement&&x.settlement.netPay)>0;});}catch(e){return [];}}
  function listFor(def,m){if(def.pay)return null;return D().filter(function(r){return (m==='ALL'||inMonth(r,m))&&def.f(r);});}
  function valFor(def,m){if(def.pay){if(def.ytd){var y=m.slice(0,4),mm=+m.slice(5),a=0;for(var i=1;i<=mm;i++)a+=settle(y+'-'+('0'+i).slice(-2)).reduce(function(s,x){return s+n(x.settlement.netPay);},0);return a;}var rs=settle(m);return def.amt?rs.reduce(function(s,x){return s+n(x.settlement.netPay);},0):rs.length;}return listFor(def,m).length;}
  function fmt(def,v){return def.amt?$m(v):String(Math.round(v));}
  function chart(items,o){o=o||{};var vs=items.map(function(x){return x.v;}).filter(function(v){return v!=null;});if(!vs.length)return '';var W=340,H=o.h||120,pt=18,pb=20,mx=Math.max.apply(null,vs)*1.12||1,bw=W/items.length,out='';
    items.forEach(function(x,i){if(x.v==null)return;var X=i*bw+bw*.15,h=Math.max(1,(H-pt-pb)*x.v/mx),Y=H-pb-h;out+='<rect x="'+X.toFixed(1)+'" y="'+Y.toFixed(1)+'" width="'+(bw*.7).toFixed(1)+'" height="'+h.toFixed(1)+'" rx="2" fill="'+(x.cur?'#4f46e5':(o.c||'#60a5fa'))+'"/><text x="'+(X+bw*.35).toFixed(1)+'" y="'+(Y-3).toFixed(1)+'" font-size="'+(x.cur?9:7.5)+'" text-anchor="middle" fill="#475569" font-weight="'+(x.cur?700:400)+'">'+esc(x.t!=null?x.t:x.v)+'</text><text x="'+(X+bw*.35).toFixed(1)+'" y="'+(H-6)+'" font-size="8" text-anchor="middle" fill="#64748b">'+esc(x.k)+'</text>';});
    return '<div class="ckn-ch"><div class="ckn-st">'+esc(o.title||'')+'</div><svg viewBox="0 0 '+W+' '+H+'" width="100%" preserveAspectRatio="none" style="display:block;height:'+H+'px">'+out+'</svg></div>';}
  function bars(list,o){o=o||{};if(!list.length)return '<div class="ckn-note">'+L('沒有資料','No data')+'</div>';var mx=Math.max.apply(null,list.map(function(x){return x.v;}))||1;return list.map(function(x){return '<div class="ckn-br"><span class="n">'+esc(x.n)+(x.s?'<small>'+esc(x.s)+'</small>':'')+'</span><span class="t"><i style="width:'+Math.max(3,Math.round(x.v/mx*100))+'%;background:'+(x.c||o.c||'#60a5fa')+'"></i></span><span class="v">'+esc(x.vt!=null?x.vt:x.v)+'</span></div>';}).join('')+(o.total?'<div class="ckn-br ckn-tot"><span class="n">'+esc(o.total[0])+'</span><span class="t"></span><span class="v">'+esc(o.total[1])+'</span></div>':'');}
  function tally(rows,key){var g={};rows.forEach(function(r){var k=String(key(r)||'—').trim()||'—';g[k]=(g[k]||0)+1;});return Object.keys(g).map(function(k){return {n:k,v:g[k]};}).sort(function(a,b){return b.v-a.v;});}
  function build(el){
    var k=el.closest('#contKpiStrip .kpi');if(!k||!window.contractSettlementEntriesForPeriod)return null;var i=[].indexOf.call(k.parentElement.children,k),def=F[i];if(!def)return null;
    var label=(k.querySelector('.kpi-l')||{}).textContent||'',shown=(k.querySelector('.kpi-n')||{}).textContent||'';
    var allMode=mode()==='all',m=allMode?'ALL':curKey();if(!allMode&&!/^\d{4}-\d{2}$/.test(m))m=String(m).slice(0,7);
    var ms=months(),mi=ms.indexOf(m),prev=!allMode&&mi>0?ms[mi-1]:null;
    var v=allMode&&def.pay&&!def.ytd?valFor(def,'ALL'):valFor(def,allMode&&def.ytd?(ms[ms.length-1]||''):m),pv=prev?valFor(def,prev):null;
    /* 名單 */
    var rows=[];if(def.pay){var sr=def.ytd?(function(){var y=(allMode?(ms[ms.length-1]||''):m).slice(0,4),mm=+(allMode?(ms[ms.length-1]||''):m).slice(5),o=[];for(var j=1;j<=mm;j++)o=o.concat(settle(y+'-'+('0'+j).slice(-2)));return o;})():settle(allMode?'ALL':m);
      rows=sr.map(function(x){var r=x.record||{};return {id:r.factoryId||r.employeeId||'',name:r.name||'',dept:r.dept||'',pos:r.position||'',type:r.contractType||'',end:r.endDate||'',amt:n(x.settlement.netPay),pm:String(x.settlement.payoutMonth||'').slice(0,7)};});}
    else rows=listFor(def,m).map(function(r){return {id:r.factoryId||'',name:r.name||'',dept:r.dept||'',pos:r.position||'',type:r.contractType||'',end:r.endDate||'',d:r.contractType==='UDC'?null:days(r),st:stat(r)};});
    rows.sort(function(a,b){return def.pay?b.amt-a.amt:String(a.end||'9').localeCompare(String(b.end||'9'));});
    var how={total:L('這段期間的合約總數（依到期日／生效月份算期間）','All contracts in this period'),active:L('狀態有效、還沒過期','Active and not past end date'),expired:L('不是 UDC，而且到期日已過','Non-UDC with end date passed'),soon:L('有效、不是 UDC，'+soonD()+' 天內到期','Active non-UDC ending within '+soonD()+' days'),fdc:L('定期合約（FDC-3M／6M／1Y…）','Fixed-duration contracts'),udc:L('不定期合約','Undetermined-duration contracts'),pay5n:L('這個月要付 5% 合約結算的人數','People with 5% settlement payable this month'),pay5:L('5% 合約結算金額加總','Total 5% settlement amount'),ytd:L('今年 1 月到這個月的 5% 結算累計','5% settlement year-to-date')}[def.k];
    var sum=rows.reduce(function(s,x){return s+(x.amt||0);},0);
    var top='<div class="ckn"><div class="ckn-hero"><div class="ckn-big" style="color:'+(k.querySelector('.kpi-n')&&k.querySelector('.kpi-n').style.color||'#0f172a')+'">'+esc(shown)+'</div><div class="ckn-l">'+esc(label)+' · '+esc(allMode?L('全部','All'):m)+'</div>'+
      '<div class="ckn-kv"><div><b>'+rows.length+'</b><span>'+L('人','people')+'</span></div>'+(def.amt?'<div><b>'+(rows.length?$m(sum/rows.length):'—')+'</b><span>'+L('平均每人','avg / person')+'</span></div>':'')+(prev?'<div><b>'+fmt(def,pv)+'</b><span>'+L('上月 ','prev ')+prev+'</span></div>':'')+'</div>'+
      (prev&&pv!=null?'<div class="ckn-cmp">'+L('跟上月比：','vs prev month: ')+(v-pv===0?'＝':(v>pv?'▲ +':'▼ −')+fmt(def,Math.abs(v-pv)))+'</div>':'')+
      (def.amt&&rows.length?'<div class="ckn-ok '+(Math.abs(sum-v)>0.5&&!def.ytd?'bad':'')+'">'+(Math.abs(sum-v)>0.5&&!def.ytd?'🔴 '+L('名單加總 ','List total ')+$m(sum)+L(' 跟卡片差 ',' differs by ')+$m(Math.abs(sum-v)):'✅ '+L('經計算核對正確：名單加總＝','Verified: list total = ')+$m(sum))+'</div>':'')+
      '<div class="ckn-note">🧮 '+esc(how)+'</div></div></div>';
    var ppl='<div class="ckn"><div class="ckn-st">👥 '+L('名單','List')+'（'+rows.length+'）'+(rows.length>60?L('・先列 60 位','・first 60'):'')+'</div><div class="ckn-tb">'+rows.slice(0,60).map(function(x){var dd=x.d==null?'':x.d<0?'<b style="color:#dc2626">'+L('過期 ','over ')+(-x.d)+L(' 天',' d')+'</b>':x.d<=soonD()?'<b style="color:#d97706">'+L('剩 ','')+x.d+L(' 天',' d left')+'</b>':'<span>'+L('剩 ','')+x.d+L(' 天',' d')+'</span>';
      return '<div><span><b>'+esc(x.id)+'</b> '+esc(x.name)+'<small>'+esc([x.dept,x.pos].filter(Boolean).join(' · '))+'</small></span><span class="r">'+esc(x.type)+(x.end?'<small>'+esc(x.end)+'</small>':'')+'</span><span class="r">'+(def.pay?'<b>'+$m(x.amt)+'</b>'+(def.ytd?'<small>'+esc(x.pm)+'</small>':''):dd)+'</span></div>';}).join('')+'</div>'+
      '<div class="ckn-note">'+L('要看照片和完整員工資料：在下面合約列表點那一列（在 VRT HR 裡打開會帶出員工照片和分頁）','Tap the row in the contract list below for the full employee card')+'</div></div>';
    var grp='<div class="ckn"><div class="ckn-st">🏢 '+L('各部門','By department')+'</div>'+bars(tally(rows,function(x){return x.dept;}).slice(0,20).map(function(x){return def.amt?(function(){var a=rows.filter(function(r){return (r.dept||'—')===x.n;}).reduce(function(s,r){return s+r.amt;},0);return {n:x.n,s:x.v+L(' 人',' ppl'),v:a,vt:$m(a)};})():{n:x.n,v:x.v,vt:x.v+L(' 人','')};}),{total:[L('合計','Total'),def.amt?$m(sum):rows.length+L(' 人','')]})+
      '<div class="ckn-st">📄 '+L('合約類型','Contract type')+'</div>'+bars(tally(rows,function(x){return x.type;}).map(function(x){return {n:x.n,v:x.v,vt:x.v+L(' 人',''),c:'#a78bfa'};}))+
      '<div class="ckn-st">🪪 '+L('職位（前 10）','Position (top 10)')+'</div>'+bars(tally(rows,function(x){return x.pos;}).slice(0,10).map(function(x){return {n:x.n,v:x.v,vt:x.v+L(' 人',''),c:'#34d399'};}))+'</div>';
    var span=allMode?ms.slice(-12):ms.slice(Math.max(0,mi-11),mi+1);
    var ser=span.map(function(x){return {m:x,v:valFor(def,x)};});
    var tr='<div class="ckn">'+chart(ser.map(function(x){return {k:String(+x.m.slice(5))+L('月','M'),v:x.v,t:def.amt?(x.v>=1000?(x.v/1000).toFixed(1)+'k':Math.round(x.v)):x.v,cur:x.m===m};}),{title:'📈 '+L('近 12 個月','Last 12 months')+'：'+label})+
      '<div class="ckn-st">🗒 '+L('最近幾期','Recent periods')+'</div><div class="ckn-tb">'+ser.slice().reverse().map(function(x,j,a){var p=a[j+1];return '<div class="'+(x.m===m?'on':'')+'"><span>'+esc(x.m)+'</span><span class="r"><b>'+fmt(def,x.v)+'</b></span><span class="r">'+(p?(x.v===p.v?'＝':(x.v>p.v?'▲ +':'▼ −')+fmt(def,Math.abs(x.v-p.v))):'')+'</span></div>';}).join('')+'</div></div>';
    return {icon:def.ic,title:label,chips:[allMode?L('全部','All'):m,shown],top:top,panes:[['ppl','👥 '+L('名單','List'),ppl],['grp','🏢 '+L('分布','Breakdown'),grp],['num','📈 '+L('走勢','Trend'),tr]]};
  }
  var css='.ckn{padding:10px 14px 14px;color:#0f172a}.ckn-hero{border:1px solid #e2e8f0;border-radius:14px;padding:12px 14px;background:#f8fafc}.ckn-big{font-size:36px;font-weight:800;line-height:1.1}.ckn-l{font-size:13px;color:#475569;font-weight:600;margin-top:3px}'
   +'.ckn-kv{display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:8px}.ckn-kv div{display:flex;flex-direction:column}.ckn-kv b{font-size:17px}.ckn-kv span{font-size:11px;color:#64748b}.ckn-cmp{font-size:13px;margin-top:6px;font-weight:600}'
   +'.ckn-ok{margin-top:8px;font-size:12.5px;font-weight:700;color:#047857;background:#ecfdf5;border-radius:8px;padding:6px 9px}.ckn-ok.bad{color:#991b1b;background:#fef2f2}.ckn-note{font-size:11.5px;color:#64748b;margin-top:6px;line-height:1.5}'
   +'.ckn-st{font-size:13px;font-weight:700;margin:12px 0 6px;color:#1e293b}.ckn-ch{border:1px solid #e2e8f0;border-radius:12px;padding:4px 8px 6px;margin:8px 0;background:#fff}'
   +'.ckn-br{display:grid;grid-template-columns:minmax(90px,40%) 1fr auto;gap:8px;align-items:center;padding:5px 0;border-bottom:1px solid #f1f5f9;font-size:13px}.ckn-br .n{font-weight:600;line-height:1.2;word-break:break-word}.ckn-br .n small{display:block;font-weight:400;color:#64748b;font-size:10.5px}.ckn-br .t{height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden}.ckn-br .t i{display:block;height:100%;border-radius:4px}.ckn-br .v{font-weight:700;text-align:right;min-width:52px}.ckn-tot{border-top:2px solid #cbd5e1;border-bottom:0}.ckn-tot .n,.ckn-tot .v{color:#4f46e5}'
   +'.ckn-tb>div{display:grid;grid-template-columns:1fr auto auto;gap:10px;padding:6px 4px;border-bottom:1px solid #f1f5f9;font-size:13px;align-items:center}.ckn-tb>div.on{background:#eef2ff;border-radius:8px}.ckn-tb small{display:block;color:#64748b;font-size:10.5px}.ckn-tb .r{text-align:right}';
  try{var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);}catch(e){}
  window.acKeynoteCardEl=function(el){try{return el.closest('#contKpiStrip .kpi');}catch(e){return null;}};
  window.acKeynoteCard=function(el){try{return build(el);}catch(e){try{console.warn('cont-kn',e);}catch(_){}return null;}};
})();
