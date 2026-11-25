/* 考勤 KPI 大字卡 v1（2026-11-25 Paul：「出勤率 94% 點進去只顯示 94%，等於按假的」）
   每張 KPI 小卡點進去，給真正有用的內容，可以一路往下滑看下一張 KPI：
   · 大數字＋跟前一天／前一週／前一月／前一年比（↑↓）＋跟近期平均比
   · 走勢圖：近 20 個上班日、近 10 週、近 12 個月（年度卡：各月＋歷年）
   · 各部門／各組：每組的數字＋長條，最下面加總＝全廠（出勤率＝出勤 ÷ 應到）
   · 車縫各組（出勤率、缺勤、人數、入離職）
   · 缺勤卡另外有假別分布；男女卡有各部門男女；人車比卡有各車縫組人數
   只讀頁面上的考勤資料（grandForDate／rowsForDate…），不改任何資料。 */
(function(){
  'use strict';
  if(window.__attKn)return;window.__attKn=1;
  var A=function(){return window.HRAAttTg||{};};
  function n(v){return Number(v)||0;}
  function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function t(zh,en,km){try{return window.T?window.T(zh,en,km):zh;}catch(e){return zh;}}
  var LVK=[['al','AL',t('年假','Annual','')],['pl','PL',t('事假','Personal','')],['sl','SL',t('病假','Sick','')],['np','NP',t('曠職','No-pay','')],['bus','Bus',t('公假','Business','')],['fl','FL',t('喪婚假','Family','')],['ml','ML',t('產假','Maternity','')]];
  function ttl(r){return n(r.m)+n(r.f);}
  function absent(r){return LVK.reduce(function(s,x){return s+n(r[x[0]]);},0);}
  function report(r){return ttl(r)-n(r.resign)+n(r.join)+n(r.ti)-n(r.to);}
  function pc(v,d){return v==null||!isFinite(v)?'—':(v*100).toFixed(d==null?1:d)+'%';}
  function f1(v){return v==null||!isFinite(v)?'—':(Math.round(v*10)/10).toLocaleString('en-US');}
  function f0(v){return v==null||!isFinite(v)?'—':Math.round(v).toLocaleString('en-US');}
  function rc(r){return r==null?'#94a3b8':r>=0.92?'#10b981':r>=0.88?'#f59e0b':'#ef4444';}
  function idx(){return window.ensureDataIndex();}
  function grand(d){return window.grandForDate(d);}
  function rows(d){return window.rowsForDate(d)||[];}

  /* ── 指標定義 ── */
  var M={
    rate:{zh:'出勤率',en:'Attendance rate',ic:'✅',pct:1,good:1,tgt:0.92},
    hc:{zh:'在職人數',en:'Headcount',ic:'👥'},
    abs:{zh:'缺勤（日均）',en:'Absence (per day)',ic:'🚫',bad:1},
    join:{zh:'新進',en:'Joins',ic:'🆕',sum:1},
    resign:{zh:'離職',en:'Resigns',ic:'🚪',sum:1,bad:1},
    turn:{zh:'流失率',en:'Turnover',ic:'📉',pct:1,bad:1},
    idle:{zh:'停工（日均）',en:'Shutdown (per day)',ic:'⏸',bad:1},
    fem:{zh:'女性比例',en:'Female share',ic:'⚧',pct:1},
    sew:{zh:'車工比例',en:'Sewing share',ic:'🧵',pct:1},
    days:{zh:'資料天數',en:'Data days',ic:'📅',sum:1}
  };
  function metricOf(label){var s=String(label||'');
    if(/流失|turnover|ចាកចេញ/i.test(s))return 'turn';
    if(/出勤率|attendance rate|អត្រាវត្តមាន/i.test(s))return 'rate';
    if(/男女|male|ប្រុស/i.test(s))return 'fem';
    if(/車工\s*[:：]|sewing\s*:|ដេរ\s*:/i.test(s))return 'sew';
    if(/缺勤|absence|អវត្តមាន/i.test(s))return 'abs';
    if(/離職|resign|លាឈប់/i.test(s))return 'resign';
    if(/新進|join|ចូលថ្មី/i.test(s))return 'join';
    if(/停工|idle|shutdown|ផ្អាក/i.test(s))return 'idle';
    if(/天數|days/i.test(s))return 'days';
    if(/在職|headcount|បុគ្គលិក/i.test(s))return 'hc';
    return null;}

  /* 一段日期的全廠數字 */
  function aggG(ds){var o={days:0,m:0,f:0,att:0,rep:0,abs:0,join:0,resign:0,idle:0,sewHC:0,sewDays:0,lv:{}};LVK.forEach(function(x){o.lv[x[0]]=0;});
    ds.forEach(function(d){var g=grand(d);if(!g)return;o.days++;o.m+=n(g.m);o.f+=n(g.f);o.att+=n(g.att);o.rep+=report(g);o.abs+=absent(g);o.join+=n(g.join);o.resign+=n(g.resign);o.idle+=n(g.idle);LVK.forEach(function(x){o.lv[x[0]]+=n(g[x[0]]);});
      var sw=rows(d).filter(A().isSewingLine||function(){return false;});if(sw.length){o.sewDays++;o.sewHC+=sw.reduce(function(s,r){return s+ttl(r);},0);o.sewTot=(o.sewTot||0)+ttl(g);}});
    return o;}
  function val(k,o){if(!o||!o.days)return null;var hc=(o.m+o.f)/o.days;
    switch(k){case 'rate':return o.rep>0?o.att/o.rep:null;case 'hc':return hc;case 'abs':return o.abs/o.days;case 'join':return o.join;case 'resign':return o.resign;
      case 'turn':return hc>0?o.resign/hc:null;case 'idle':return o.idle/o.days;case 'fem':return (o.m+o.f)>0?o.f/(o.m+o.f):null;case 'sew':return o.sewTot>0?o.sewHC/o.sewTot:null;case 'days':return o.days;}return null;}
  function fmtV(k,v){var m=M[k];if(v==null)return '—';if(m.pct)return pc(v,k==='turn'?2:1);if(m.sum||k==='hc')return f0(v);return f1(v);}
  function delta(k,a,b){if(a==null||b==null)return '';var m=M[k],d=a-b;if(Math.abs(d)<1e-9)return '<span style="color:#64748b">＝ '+t('持平','same')+'</span>';
    var up=d>0,good=m.good?up:m.bad?!up:null,col=good==null?'#475569':good?'#059669':'#dc2626',txt=m.pct?((d>0?'+':'')+(d*100).toFixed(k==='turn'?2:1)+' pt'):((d>0?'+':'')+(m.sum||k==='hc'?f0(d):f1(d)));
    return '<span style="color:'+col+';font-weight:700">'+(up?'▲ ':'▼ ')+txt+'</span>';}

  /* ── 期間 ── */
  function ctxOf(el){var box=el.closest('[id$="Kpi"]'),id=box?box.id:'',v=function(i){var e=document.getElementById(i);return e?e.value:'';};
    if(id==='dayKpi')return {mode:'day',key:v('dsel')};if(id==='weekKpi')return {mode:'week',key:v('wsel')};if(id==='monthKpi')return {mode:'month',key:v('msel')};if(id==='yearKpi')return {mode:'year',key:v('ysel')};return null;}
  function keysOf(mode){var I=idx();if(mode==='day')return [].concat(I.dates||[]).sort();var mp=mode==='week'?I.weekDates:mode==='month'?I.monthDates:I.yearDates;return mp?Array.from(mp.keys()).sort():[];}
  function datesOf(mode,key){return window.periodDates(mode,key)||[];}
  function capOf(mode,key){if(mode==='day')return key;if(mode==='week'){var ds=datesOf('week',key);return t('週','Week')+' '+(ds[0]||key).slice(5)+'～'+(ds[ds.length-1]||'').slice(5);}if(mode==='month')return key;return key+t(' 年','');}
  function shortLab(mode,key){if(mode==='day')return key.slice(8);if(mode==='week'){var ds=datesOf('week',key);return (ds[0]||key).slice(5).replace('-','/');}if(mode==='month')return String(+key.slice(5))+t('月','');return key;}

  /* ── 長條圖（SVG）── */
  function chart(items,k,o){o=o||{};if(!items.length)return '';var W=340,H=o.h||132,pl=6,pr=6,pt=18,pb=20,m=M[k];
    var vs=items.map(function(x){return x.v;}).filter(function(v){return v!=null;});if(!vs.length)return '';
    var mx=Math.max.apply(null,vs),mn=k==='rate'?Math.max(0.5,Math.min(Math.min.apply(null,vs),m.tgt||1)-0.03):0;if(m.tgt)mx=Math.max(mx,m.tgt);if(mx<=mn)mx=mn+1;mx=mx+(mx-mn)*0.08;
    var bw=(W-pl-pr)/items.length,y=function(v){return pt+(H-pt-pb)*(1-(v-mn)/(mx-mn));},showV=items.length<=14,out='';
    items.forEach(function(x,i){if(x.v==null)return;var X=pl+i*bw+bw*0.15,Y=y(x.v),h=Math.max(1,H-pb-Y),col=x.cur?'#4f46e5':(k==='rate'?rc(x.v):'#60a5fa');
      out+='<rect x="'+X.toFixed(1)+'" y="'+Y.toFixed(1)+'" width="'+(bw*0.7).toFixed(1)+'" height="'+h.toFixed(1)+'" rx="2" fill="'+col+'" opacity="'+(x.cur?1:0.85)+'"/>';
      if(showV||x.cur)out+='<text x="'+(X+bw*0.35).toFixed(1)+'" y="'+(Y-3).toFixed(1)+'" font-size="'+(x.cur?9.5:8)+'" text-anchor="middle" fill="'+(x.cur?'#312e81':'#475569')+'" font-weight="'+(x.cur?700:400)+'">'+esc(m.pct?(x.v*100).toFixed(k==='turn'?1:0):(m.sum||k==='hc'?Math.round(x.v):f1(x.v)))+'</text>';
      if(items.length<=16||i%Math.ceil(items.length/12)===0||x.cur)out+='<text x="'+(X+bw*0.35).toFixed(1)+'" y="'+(H-6)+'" font-size="8" text-anchor="middle" fill="'+(x.cur?'#312e81':'#64748b')+'" font-weight="'+(x.cur?700:400)+'">'+esc(x.k)+'</text>';});
    if(m.tgt){var ty=y(m.tgt);out+='<line x1="0" x2="'+W+'" y1="'+ty.toFixed(1)+'" y2="'+ty.toFixed(1)+'" stroke="#ef4444" stroke-dasharray="4 3" stroke-width="1"/><text x="2" y="'+(ty+9).toFixed(1)+'" font-size="8" text-anchor="start" fill="#ef4444">'+t('目標','Target')+' 92%</text>';}
    return '<div class="akn-ch"><div class="akn-st">'+esc(o.title||'')+'</div><svg viewBox="0 0 '+W+' '+H+'" width="100%" preserveAspectRatio="none" style="display:block;height:'+H+'px">'+out+'</svg></div>';}

  /* 一串期間（目前這一段往前數 N 段）的數值 */
  function series(mode,key,k,N){var ks=keysOf(mode),i=ks.indexOf(key);if(i<0){ks.push(key);ks.sort();i=ks.indexOf(key);}var s=ks.slice(Math.max(0,i-N+1),i+1);
    return s.map(function(x){return {k:shortLab(mode,x),key:x,v:val(k,aggG(datesOf(mode,x))),cur:x===key};});}

  /* ── 各部門／各組 ── */
  function groupAgg(ds){var by={},ord=[];ds.forEach(function(d){var rs=rows(d);if(!rs.length||!A().groupsForDay)return;var gr=A().groupsForDay(rs);(gr.groups||[]).forEach(function(g){var nm=g.name;if(!by[nm]){by[nm]={name:nm,days:0,m:0,f:0,att:0,rep:0,abs:0,join:0,resign:0,idle:0};ord.push(nm);}var o=by[nm];o.days++;o.m+=n(g.m);o.f+=n(g.f);o.att+=n(g.att);o.rep+=report(g);o.abs+=absent(g);o.join+=n(g.join);o.resign+=n(g.resign);o.idle+=n(g.idle);});});
    return ord.map(function(k){return by[k];});}
  function lineAgg(ds){var by={},ord=[],sw=A().isSewingLine,ln=A().lineName;if(!sw)return [];ds.forEach(function(d){rows(d).filter(sw).forEach(function(r){var nm=ln?ln(r):(r.line||'—');if(!by[nm]){by[nm]={name:nm,days:0,m:0,f:0,att:0,rep:0,abs:0,join:0,resign:0,idle:0};ord.push(nm);}var o=by[nm];o.days++;o.m+=n(r.m);o.f+=n(r.f);o.att+=n(r.att);o.rep+=report(r);o.abs+=absent(r);o.join+=n(r.join);o.resign+=n(r.resign);o.idle+=n(r.idle);});});
    return ord.map(function(k){return by[k];}).sort(function(a,b){return String(a.name).localeCompare(String(b.name),'en',{numeric:true});});}
  function gval(k,o){var days=Math.max(1,o.days),hc=(o.m+o.f)/days;switch(k){case 'rate':return o.rep>0?o.att/o.rep:null;case 'hc':case 'sew':case 'days':return hc;case 'abs':return o.abs/days;case 'join':return o.join;case 'resign':return o.resign;case 'turn':return hc>0?o.resign/hc:null;case 'idle':return o.idle/days;case 'fem':return (o.m+o.f)>0?o.f/(o.m+o.f):null;}return null;}
  function gname(nm){try{return A().gname?A().gname(nm,(window.LANG||'zh')):nm;}catch(e){return nm;}}
  function bars(list,k,o){o=o||{};var kk=(k==='sew'||k==='days')?'hc':k,m=M[kk];var it=list.map(function(g){return {g:g,v:gval(kk,g)};}).filter(function(x){return x.v!=null&&(x.v>0||kk==='rate');});if(!it.length)return '';
    if(o.sort)it.sort(function(a,b){return m.good||kk==='hc'?b.v-a.v:b.v-a.v;});
    var mx=Math.max.apply(null,it.map(function(x){return Math.abs(x.v);}))||1,mn=kk==='rate'?Math.max(0,Math.min.apply(null,it.map(function(x){return x.v;}))-0.05):0;
    var h=it.map(function(x){var w=kk==='rate'?Math.max(4,Math.round((x.v-mn)/((mx-mn)||1)*100)):Math.max(3,Math.round(Math.abs(x.v)/mx*100)),g=x.g,days=Math.max(1,g.days);
      var sub=kk==='rate'?(f0(g.att/days)+' / '+f0(g.rep/days)+(o.multi?' '+t('日均','avg/day'):'')):kk==='abs'?LVK.filter(function(z){return false;}).join(''):kk==='fem'?(t('男','M')+' '+f0(g.m/days)+' · '+t('女','F')+' '+f0(g.f/days)):kk==='hc'?(t('出勤','att')+' '+f0(g.att/days)):'';
      return '<div class="akn-br"><span class="n">'+esc(gname(g.name))+(sub?'<small>'+esc(sub)+'</small>':'')+'</span><span class="t"><i style="width:'+w+'%;background:'+(kk==='rate'?rc(x.v):m.bad?'#f87171':'#60a5fa')+'"></i></span><span class="v">'+fmtV(kk,x.v)+'</span></div>';}).join('');
    return '<div class="akn-st">'+esc(o.title||'')+'</div>'+h+(o.total?'<div class="akn-br akn-tot"><span class="n">'+esc(o.total[0])+'</span><span class="t"></span><span class="v">'+esc(o.total[1])+'</span></div>':'')+(o.note?'<div class="akn-note">'+o.note+'</div>':'');}

  /* ── 一張 KPI 的完整內容 ── */
  function build(el){
    var kpi=el.closest('.kpi')||el,lb=kpi.querySelector('.kpi-l'),label=lb?lb.textContent.trim():'',k=metricOf(label),C=ctxOf(kpi);
    if(!k||!C||!C.key||!window.ensureDataIndex)return null;
    var ds=datesOf(C.mode,C.key);if(!ds.length)return null;
    var kv=kpi.querySelector('.kpi-n'),shown=kv?kv.textContent.trim():'',sub=(kpi.querySelector('.kpi-sub')||{}).textContent||'';
    var G=aggG(ds),v=val(k,G),multi=ds.length>1,mode=C.mode;
    var ks=keysOf(mode),i=ks.indexOf(C.key),prevKey=i>0?ks[i-1]:null,prevV=prevKey?val(k,aggG(datesOf(mode,prevKey))):null;
    var recent=ks.slice(Math.max(0,i-8),i).map(function(x){return val(k,aggG(datesOf(mode,x)));}).filter(function(x){return x!=null;}),avgR=recent.length?recent.reduce(function(a,b){return a+b;},0)/recent.length:null;
    var pre=k==='fem'?t('女性 ','Female '):'';var pName={day:t('前一天','prev day'),week:t('上週','last week'),month:t('上月','last month'),year:t('去年','last year')}[mode],aName={day:t('近 8 天平均','8-day avg'),week:t('近 8 週平均','8-week avg'),month:t('近 8 個月平均','8-month avg'),year:t('歷年平均','past years avg')}[mode];
    var h='';
    /* 大數字 */
    var big=(k==='fem')?shown:(k==='sew'?shown:(fmtV(k,v)));
    h+='<div class="akn-hero"><div class="akn-big" style="color:'+(k==='rate'?rc(v):'#0f172a')+'">'+esc(k==='days'?f0(v):big)+'</div><div class="akn-l">'+esc(label)+' · '+esc(capOf(mode,C.key))+'</div>'+(sub?'<div class="akn-sub">'+esc(sub)+'</div>':'')+
      '<div class="akn-cmp">'+(prevKey?'<div><b>'+pre+pName+'</b> '+fmtV(k,prevV)+' '+delta(k,v,prevV)+'</div>':'')+(avgR!=null?'<div><b>'+pre+aName+'</b> '+fmtV(k,avgR)+' '+delta(k,v,avgR)+'</div>':'')+'</div></div>';
    /* 怎麼算 */
    var how='';if(k==='rate')how=t('出勤率＝出勤 ÷ 應到','Rate = present ÷ expected')+'：'+f0(G.att)+' ÷ '+f0(G.rep)+' = '+pc(v)+(multi?t('（'+G.days+' 天加總）',' ('+G.days+' days summed)'):'')+'；'+t('應到＝在職 − 當天離職 ＋ 當天新進 ± 調動','expected = headcount − resigns + joins ± transfers');
    else if(k==='abs')how=t('缺勤＝各假別合計','Absence = all leave types')+(multi?t('，下面用每日平均',' (daily average below)'):'');
    else if(k==='turn')how=t('流失率＝離職人數 ÷ 平均在職','Turnover = resigns ÷ average headcount')+'：'+f0(G.resign)+' ÷ '+f0((G.m+G.f)/G.days)+' = '+pc(v,2);
    else if(k==='sew')how=t('車工＝在車縫線上的人；非車工＝全廠 − 車工','Sewing = people on sewing lines; non-sewing = factory − sewing');
    if(how)h+='<div class="akn-note">🧮 '+how+'</div>';
    var P1=h;h='';
    /* 走勢 */
    var cm=k==='days'?'hc':k;
    if(mode==='day'){h+=chart(series('day',C.key,cm,20),cm,{title:'📈 '+t('近 20 個上班日','Last 20 working days')});var wk=weekOf(C.key);if(wk)h+=chart(series('week',wk,cm,10),cm,{title:'📅 '+t('近 10 週（本週為紫色）','Last 10 weeks (this week = purple)')});}
    else if(mode==='week'){h+=chart(ds.map(function(d){return {k:d.slice(5).replace('-','/'),v:val(cm,aggG([d])),cur:false};}),cm,{title:'📆 '+t('本週每天','Each day this week')});h+=chart(series('week',C.key,cm,12),cm,{title:'📅 '+t('近 12 週','Last 12 weeks')});}
    else if(mode==='month'){h+=chart(ds.map(function(d){return {k:d.slice(8),v:val(cm,aggG([d]))};}),cm,{title:'📆 '+t('本月每天','Each day this month')});h+=chart(series('month',C.key,cm,12),cm,{title:'🗓 '+t('近 12 個月','Last 12 months')});}
    else {var ms=(window.allMonths?window.allMonths():[]).filter(function(x){return x.indexOf(C.key)===0;});h+=chart(ms.map(function(x){return {k:String(+x.slice(5)),v:val(cm,aggG(datesOf('month',x)))};}),cm,{title:'🗓 '+t('本年各月','Each month')});h+=chart(series('year',C.key,cm,6),cm,{title:'📊 '+t('歷年比較','Year by year')});}
    if(mode!=='day'&&mode!=='year'&&prevKey){h+=chart([{k:shortLab(mode,prevKey),v:prevV},{k:shortLab(mode,C.key),v:v,cur:true}],cm,{title:'⚖️ '+t('跟上一期比','vs previous period'),h:90});}
    /* 假別 */
    if(k==='abs'){var lv=LVK.map(function(x){return {name:x[1]+' '+x[2],v:G.lv[x[0]]/G.days};}).filter(function(x){return x.v>0;}).sort(function(a,b){return b.v-a.v;}),mx=Math.max.apply(null,lv.map(function(x){return x.v;}).concat([1]));
      h+='<div class="akn-st">🗂 '+t('假別分布','Leave types')+(multi?t('（日均）',' (per day)'):'')+'</div>'+lv.map(function(x){return '<div class="akn-br"><span class="n">'+esc(x.name)+'</span><span class="t"><i style="width:'+Math.max(3,Math.round(x.v/mx*100))+'%;background:#f59e0b"></i></span><span class="v">'+f1(x.v)+'</span></div>';}).join('');
      if(lv.length>1)h+=chart(series(mode,C.key,'abs',mode==='day'?20:12).map(function(x){return x;}),'abs',{title:'📈 '+t('缺勤走勢（日均）','Absence trend (per day)'),h:110}).replace(/^$/,'');}
    var P2=h;h='';
    /* 各部門 */
    var ga=groupAgg(ds),tot=null;
    if(k==='rate')tot=[t('合計＝全廠','Total = factory'),pc(v)];else if(k==='hc'||k==='days')tot=[t('合計＝全廠','Total = factory'),f0((G.m+G.f)/G.days)];else if(k==='abs')tot=[t('合計','Total'),f1(G.abs/G.days)];else if(k==='join'||k==='resign')tot=[t('合計','Total'),f0(k==='join'?G.join:G.resign)];
    var gk=k==='sew'?'hc':k;
    if(ga.length)h+=bars(ga,gk,{title:'🏢 '+t('各部門／各組','By department / section')+(multi&&(gk==='hc'||gk==='abs'||gk==='idle')?t('（日均）',' (per day)'):''),total:tot,multi:multi,sort:gk!=='rate'?true:false});
    /* 車縫各組 */
    var la=lineAgg(ds);if(la.length&&k!=='fem'){var lk=(k==='sew'||k==='days'||k==='turn')?'hc':k;h+=bars(la,lk,{title:'🧵 '+t('車縫各組','Sewing lines')+(multi&&(lk==='hc'||lk==='abs')?t('（日均）',' (per day)'):''),multi:multi,sort:lk==='rate'?false:true});
      if(k==='rate'){var low=la.map(function(g){return {g:g,v:gval('rate',g)};}).filter(function(x){return x.v!=null;}).sort(function(a,b){return a.v-b.v;}).slice(0,3);if(low.length)h+='<div class="akn-note">🔻 '+t('出勤率最低','Lowest')+'：'+low.map(function(x){return esc(x.g.name)+' '+pc(x.v);}).join('、')+'</div>';}}
    var P3=h;h='';
    /* 歷史清單（往前幾期的數字，方便對照） */
    var hist=ks.slice(Math.max(0,i-11),i+1).reverse();
    h+='<div class="akn-st">🗒 '+t('最近幾期','Recent periods')+'</div><div class="akn-tb">'+hist.map(function(x){var o=aggG(datesOf(mode,x)),vv=val(cm,o);return '<div class="'+(x===C.key?'on':'')+'"><span>'+esc(capOf(mode,x))+'</span><b style="color:'+(cm==='rate'?rc(vv):'inherit')+'">'+fmtV(cm,vv)+'</b><small>'+(cm==='rate'?f0(o.att)+'/'+f0(o.rep):t('在職','HC')+' '+f0(o.days?(o.m+o.f)/o.days:0))+'</small></div>';}).join('')+'</div>';
    var P4=h,W=function(x){return '<div class="akn">'+x+'</div>';};
    /* 分頁（像員工頁）：重點＝大數字＋走勢；各組＝部門／車縫各組；歷史＝最近幾期清單 */
    return {icon:M[k].ic,title:label,chips:[capOf(mode,C.key),shown],top:W(P1).replace('class="akn"','class="akn" style="padding-bottom:0"'),panes:[['num','📈 '+t('走勢','Trend'),W(P2)],['grp','🏢 '+t('各組','By group'),W(P3||'<div class="akn-note">'+t('這一項沒有分組資料','No group data')+'</div>')],['his','🗒 '+t('歷史','History'),W(P4)]],html:W(P1+P2+P3+P4)};
  }
  function weekOf(d){try{var I=idx(),w=null;I.weekDates.forEach(function(v,k){if(!w&&v.indexOf(d)>=0)w=k;});return w;}catch(e){return null;}}

  var css='.akn{padding:10px 14px 18px;color:#0f172a}.akn-hero{border:1px solid #e2e8f0;border-radius:14px;padding:12px 14px;background:#f8fafc;margin-bottom:10px}'
   +'.akn-big{font-size:40px;font-weight:800;line-height:1.05}.akn-l{font-size:13px;color:#475569;margin-top:4px;font-weight:600}.akn-sub{font-size:12px;color:#64748b;margin-top:2px}'
   +'.akn-cmp{display:flex;flex-wrap:wrap;gap:6px 16px;margin-top:8px;font-size:13px}.akn-cmp b{color:#64748b;font-weight:600;margin-right:4px}'
   +'.akn-note{font-size:12px;color:#475569;background:#f1f5f9;border-radius:10px;padding:8px 10px;margin:8px 0;line-height:1.5}'
   +'.akn-st{font-size:13px;font-weight:700;margin:14px 0 6px;color:#1e293b}.akn-ch{border:1px solid #e2e8f0;border-radius:12px;padding:4px 8px 6px;margin:8px 0;background:#fff}.akn-ch .akn-st{margin:4px 0 2px;font-size:12px}'
   +'.akn-br{display:grid;grid-template-columns:minmax(84px,38%) 1fr auto;gap:8px;align-items:center;padding:5px 0;border-bottom:1px solid #f1f5f9;font-size:13px}.akn-br .n{font-weight:600;line-height:1.2}.akn-br .n small{display:block;font-weight:400;color:#64748b;font-size:10.5px}'
   +'.akn-br .t{height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden}.akn-br .t i{display:block;height:100%;border-radius:4px}.akn-br .v{font-weight:700;min-width:52px;text-align:right}'
   +'.akn-tot{border-top:2px solid #cbd5e1;border-bottom:0;margin-top:2px}.akn-tot .n,.akn-tot .v{color:#4f46e5}'
   +'.akn-tb>div{display:grid;grid-template-columns:1fr auto auto;gap:10px;padding:6px 8px;border-bottom:1px solid #f1f5f9;font-size:13px;align-items:baseline}.akn-tb>div.on{background:#eef2ff;border-radius:8px}.akn-tb small{color:#64748b;font-size:11px;min-width:70px;text-align:right}';
  try{var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);}catch(e){}
  window.acKeynoteCardEl=function(el){try{return el.closest('#dayKpi .kpi,#weekKpi .kpi,#monthKpi .kpi,#yearKpi .kpi');}catch(e){return null;}};
  window.acKeynoteCard=function(el){try{return build(el);}catch(e){try{console.warn('att-kn',e);}catch(_){}return null;}};
})();
