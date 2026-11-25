/* 入離職總覽 KPI 大字卡 v1（2026-11-25 Paul：先列人數、各別人數，再看相關歷史和圖表；排名那種沒用的不放）
   ac_hra_onboarding_v3.html 總覽那排（入職／離職／淨增減／期末在職／流動率／平均在職天數）＋本月／今年累計離職：
   · 上方：數字、車工／非車工、男／女、跟上一期比、怎麼算
   · 👥 名單：工號、姓名、部門／組別、職位、日期（離職另有做幾天、原因、結算金額）
   · 🏢 分布：各部門／組別、職位、男女、年資區間、離職原因
   · 📈 走勢：近 12 個月入職 vs 離職、期末在職、流動率
   只讀頁面資料（JOINS／RESIGNS／hcAt…），不改資料。 */
(function(){
  'use strict';
  if(window.__onbKn)return;window.__onbKn=1;
  function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function n(v){v=Number(v);return isFinite(v)?v:0;}
  function T(zh,en,km){try{return window.L?window.L(zh,en,km):zh;}catch(e){return zh;}}
  function J(){try{return JOINS||[];}catch(e){return [];}}
  function R(){try{return RESIGNS||[];}catch(e){return [];}}
  function grp(r){try{return window.normalizeGroup(r.section||r.dept)||r.dept||'—';}catch(e){return r.section||r.dept||'—';}}
  function sew(r){try{return window.isSewLine(window.normalizeGroup(r.section||r.dept));}catch(e){return false;}}
  function male(r){return /^(m|male|男|ប្រុស)/i.test(String(r.gender||''));}
  function female(r){return /^(f|female|女|ស្រី)/i.test(String(r.gender||''));}
  function ym(d){return String(d||'').slice(0,7);}
  function addM(m,k){var y=+m.slice(0,4),mm=+m.slice(5)+k;while(mm<1){mm+=12;y--;}while(mm>12){mm-=12;y++;}return y+'-'+('0'+mm).slice(-2);}
  function lastDay(m){var d=new Date(+m.slice(0,4),+m.slice(5),0);return m+'-'+('0'+d.getDate()).slice(-2);}
  function hc(d){try{var v=window.hcAt(d);return isFinite(v)?v:null;}catch(e){return null;}}
  function bounds(){try{return window.pBounds(NAV.ov);}catch(e){return null;}}
  function inB(d,b){d=String(d||'').slice(0,10);return !!d&&(!b||(d>=b.s&&d<=b.e));}
  function prevB(b){if(!b)return null;var s=new Date(b.s+'T00:00:00'),e=new Date(b.e+'T00:00:00'),len=Math.round((e-s)/864e5)+1,mode=(NAV.ov||{}).mode;
    if(mode==='month'){var m=addM(b.s.slice(0,7),-1);return {s:m+'-01',e:lastDay(m)};}if(mode==='year'){var y=+b.s.slice(0,4)-1;return {s:y+'-01-01',e:y+'-12-31'};}
    var ps=new Date(s.getTime()-len*864e5),pe=new Date(s.getTime()-864e5),f=function(x){return x.getFullYear()+'-'+('0'+(x.getMonth()+1)).slice(-2)+'-'+('0'+x.getDate()).slice(-2);};return {s:f(ps),e:f(pe)};}
  function tenure(d){d=n(d);return d<30?T('未滿 1 個月','<1 month'):d<90?T('1–3 個月','1–3 months'):d<180?T('3–6 個月','3–6 months'):d<365?T('6–12 個月','6–12 months'):d<1095?T('1–3 年','1–3 years'):T('3 年以上','3+ years');}
  var TEN_ORD=['未滿 1 個月','1–3 個月','3–6 個月','6–12 個月','1–3 年','3 年以上','<1 month','1–3 months','3–6 months','6–12 months','1–3 years','3+ years'];
  function tally(rows,f,ord){var g={};rows.forEach(function(r){var k=String(f(r)||'—').trim()||'—';g[k]=(g[k]||0)+1;});var a=Object.keys(g).map(function(k){return {n:k,v:g[k]};});if(ord)a.sort(function(x,y){return ord.indexOf(x.n)-ord.indexOf(y.n);});else a.sort(function(x,y){return y.v-x.v;});return a;}
  function bars(list,o){o=o||{};if(!list.length)return '<div class="okn-note">'+T('沒有資料','No data')+'</div>';var mx=Math.max.apply(null,list.map(function(x){return x.v;}))||1;
    return list.map(function(x){return '<div class="okn-br"><span class="n">'+esc(x.n)+'</span><span class="t"><i style="width:'+Math.max(3,Math.round(x.v/mx*100))+'%;background:'+(x.c||o.c||'#60a5fa')+'"></i></span><span class="v">'+esc(x.vt!=null?x.vt:x.v+T(' 人',''))+'</span></div>';}).join('')+(o.total?'<div class="okn-br okn-tot"><span class="n">'+esc(o.total[0])+'</span><span class="t"></span><span class="v">'+esc(o.total[1])+'</span></div>':'');}
  /* 兩組長條（入職綠、離職紅） */
  function chart2(items,o){o=o||{};var W=340,H=o.h||130,pt=16,pb=20,mx=1;items.forEach(function(x){mx=Math.max(mx,x.a||0,x.b||0);});mx*=1.15;var bw=W/items.length,out='';
    items.forEach(function(x,i){var X=i*bw+bw*.1,w=bw*.38;[[x.a,'#22c55e',0],[x.b,'#ef4444',1]].forEach(function(q){if(q[0]==null)return;var h=Math.max(1,(H-pt-pb)*q[0]/mx),Y=H-pb-h,xx=X+q[2]*(w+bw*.04);out+='<rect x="'+xx.toFixed(1)+'" y="'+Y.toFixed(1)+'" width="'+w.toFixed(1)+'" height="'+h.toFixed(1)+'" rx="2" fill="'+q[1]+'" opacity="'+(x.cur?1:.75)+'"/><text x="'+(xx+w/2).toFixed(1)+'" y="'+(Y-2).toFixed(1)+'" font-size="7" text-anchor="middle" fill="#475569">'+q[0]+'</text>';});
      out+='<text x="'+(X+bw*.4).toFixed(1)+'" y="'+(H-6)+'" font-size="8" text-anchor="middle" fill="'+(x.cur?'#312e81':'#64748b')+'" font-weight="'+(x.cur?700:400)+'">'+esc(x.k)+'</text>';});
    return '<div class="okn-ch"><div class="okn-st">'+esc(o.title||'')+' <small><i style="background:#22c55e"></i>'+T('入職','Join')+' <i style="background:#ef4444"></i>'+T('離職','Resign')+'</small></div><svg viewBox="0 0 '+W+' '+H+'" width="100%" preserveAspectRatio="none" style="display:block;height:'+H+'px">'+out+'</svg></div>';}
  function chart1(items,o){o=o||{};var vs=items.map(function(x){return x.v;}).filter(function(v){return v!=null;});if(!vs.length)return '';var W=340,H=o.h||115,pt=16,pb=20,mn=o.base?Math.min.apply(null,vs)*0.9:0,mx=Math.max.apply(null,vs)*1.08||1,bw=W/items.length,out='';
    items.forEach(function(x,i){if(x.v==null)return;var X=i*bw+bw*.15,h=Math.max(1,(H-pt-pb)*(x.v-mn)/((mx-mn)||1)),Y=H-pb-h;out+='<rect x="'+X.toFixed(1)+'" y="'+Y.toFixed(1)+'" width="'+(bw*.7).toFixed(1)+'" height="'+h.toFixed(1)+'" rx="2" fill="'+(x.cur?'#4f46e5':(o.c||'#60a5fa'))+'"/><text x="'+(X+bw*.35).toFixed(1)+'" y="'+(Y-2).toFixed(1)+'" font-size="7.5" text-anchor="middle" fill="#475569">'+esc(x.t!=null?x.t:x.v)+'</text><text x="'+(X+bw*.35).toFixed(1)+'" y="'+(H-6)+'" font-size="8" text-anchor="middle" fill="#64748b">'+esc(x.k)+'</text>';});
    return '<div class="okn-ch"><div class="okn-st">'+esc(o.title||'')+'</div><svg viewBox="0 0 '+W+' '+H+'" width="100%" preserveAspectRatio="none" style="display:block;height:'+H+'px">'+out+'</svg></div>';}
  var KEYS=['join','resign','net','hc','to','ten'];
  function build(el){
    var k=el.closest('#pn-ov .kpi');if(!k)return null;var cum=!!k.closest('#ov-cum');
    var key=cum?'resign':KEYS[[].indexOf.call(k.parentElement.children,k)];if(!key)return null;
    var label=((k.querySelector('.l')||{}).textContent||'').trim(),shown=((k.querySelector('.v')||{}).textContent||'').trim();
    var b=bounds();
    if(cum){var mm=(label.match(/(\d{4}-\d{2})(?!-)/)||[])[1],ytd=/～|year|ឆ្នាំ/i.test(label),y=(label.match(/(\d{4})-01～/)||[])[1];
      if(ytd&&y){var to=(label.match(/～(\d{2})/)||[])[1]||'12';b={s:y+'-01-01',e:lastDay(y+'-'+to)};}else if(mm)b={s:mm+'-01',e:lastDay(mm)};}
    var pb0=prevB(b);
    var js=J().filter(function(r){return inB(r.joinDate,b);}),rs=R().filter(function(r){return inB(r.resignDate,b);});
    var pj=pb0?J().filter(function(r){return inB(r.joinDate,pb0);}).length:null,pr=pb0?R().filter(function(r){return inB(r.resignDate,pb0);}).length:null;
    var list=key==='join'?js:(key==='resign'||key==='to'||key==='ten')?rs:js.concat(rs);
    var cap=b?(b.s===b.e?b.s:b.s+' ～ '+b.e):T('全部','All');
    var endM=b?b.e.slice(0,7):(R().concat(J()).map(function(r){return ym(r.resignDate||r.joinDate);}).sort().pop()||'');
    var M=[];for(var i=11;i>=0;i--)M.push(addM(endM,-i));
    var mj=M.map(function(m){return J().filter(function(r){return ym(r.joinDate)===m;}).length;}),mr=M.map(function(m){return R().filter(function(r){return ym(r.resignDate)===m;}).length;});
    var mh=M.map(function(m){return hc(lastDay(m));});
    var sw=list.filter(sew).length,ma=list.filter(male).length,fe=list.filter(female).length;
    var cmpV=key==='join'?[js.length,pj]:key==='resign'?[rs.length,pr]:key==='net'?[js.length-rs.length,pj==null?null:pj-pr]:null;
    var how={join:T('期間內入職日落在這段期間的人','Joined within the period'),resign:T('期間內離職日（結算到的最後一天）落在這段期間的人','Resign date (last paid day) within the period'),net:T('淨增減＝入職 − 離職','Net = joins − resigns')+'：'+js.length+' − '+rs.length+' = '+(js.length-rs.length),hc:T('期末在職＝考勤頁每天的在職人數（期間最後一天）','Headcount at period end (from attendance)'),to:T('流動率＝期間離職 ÷ 期間平均在職','Turnover = resigns ÷ average headcount'),ten:T('平均在職天數＝這段期間離職的人平均做了幾天','Average days worked by people who resigned')}[key];
    var top='<div class="okn"><div class="okn-hero"><div class="okn-big">'+esc(shown)+'</div><div class="okn-l">'+esc(label)+' · '+esc(cap)+'</div>'+
      (key!=='hc'?'<div class="okn-kv"><div><b>'+list.length+'</b><span>'+T('人','people')+'</span></div><div><b style="color:#d97706">'+sw+'</b><span>'+T('車工','Sewing')+'</span></div><div><b>'+(list.length-sw)+'</b><span>'+T('非車工','Non-sewing')+'</span></div><div><b style="color:#2563eb">♂ '+ma+'</b><span>'+T('男','M')+'</span></div><div><b style="color:#db2777">♀ '+fe+'</b><span>'+T('女','F')+'</span></div></div>':'')+
      (cmpV&&cmpV[1]!=null?'<div class="okn-cmp">'+T('跟上一期比（','vs previous (')+cmpV[1]+'）：'+(cmpV[0]===cmpV[1]?'＝':(cmpV[0]>cmpV[1]?'▲ +':'▼ −')+Math.abs(cmpV[0]-cmpV[1]))+'</div>':'')+
      '<div class="okn-note">🧮 '+esc(how)+'</div></div></div>';
    /* 名單 */
    var rows=list.slice().sort(function(a,b2){return String(b2.resignDate||b2.joinDate||'').localeCompare(String(a.resignDate||a.joinDate||''));});
    var ppl='<div class="okn"><div class="okn-st">👥 '+T('名單','List')+'（'+rows.length+'）'+(rows.length>80?T('・先列 80 位','・first 80'):'')+'</div><div class="okn-tb">'+rows.slice(0,80).map(function(r){var isR=!!r.resignDate&&list!==js&&rs.indexOf(r)>=0;
      return '<div><span><b>'+esc(r.empId||'')+'</b> '+esc(r.name||'')+'<small>'+esc([grp(r),r.position].filter(Boolean).join(' · '))+(female(r)?' <i style="color:#db2777">♀</i>':male(r)?' <i style="color:#2563eb">♂</i>':'')+'</small></span><span class="r">'+(isR?'<b style="color:#dc2626">'+T('離職','Out')+'</b><small>'+esc(String(r.resignDate).slice(0,10))+'</small>':'<b style="color:#16a34a">'+T('入職','In')+'</b><small>'+esc(String(r.joinDate||'').slice(0,10))+'</small>')+'</span><span class="r">'+(isR?(r.workingDays?'<span>'+n(r.workingDays)+T(' 天',' d')+'</span>':'')+(n(r.amount)>0?'<small>$'+n(r.amount).toFixed(2)+'</small>':'')+(r.reason?'<small>'+esc(String(r.reason).slice(0,18))+'</small>':''):'')+'</span></div>';}).join('')+'</div>'+
      '<div class="okn-note">'+T('要看照片和完整員工資料：在入職／離職列表點那一列（在 VRT HR 裡會帶出員工照片和分頁）','Tap the row in the join/resign list for the full employee card')+'</div></div>';
    /* 分布 */
    var g='<div class="okn">';
    if(key==='hc'){g+=bars(M.map(function(m,ix){return {n:m,v:mh[ix]||0,vt:mh[ix]==null?'—':mh[ix]+T(' 人',''),c:m===endM?'#4f46e5':'#94a3b8'};}).reverse());}
    else{g+='<div class="okn-st">🏢 '+T('各部門／組別','By dept / line')+'</div>'+bars(tally(list,grp).slice(0,25),{total:[T('合計','Total'),list.length+T(' 人','')]})+
      '<div class="okn-st">🪪 '+T('職位（前 10）','Position (top 10)')+'</div>'+bars(tally(list,function(r){return r.position;}).slice(0,10),{c:'#34d399'})+
      '<div class="okn-st">⚧ '+T('男女','Gender')+'</div>'+bars([{n:'♂ '+T('男','Male'),v:ma,c:'#60a5fa'},{n:'♀ '+T('女','Female'),v:fe,c:'#f472b6'}].concat(list.length-ma-fe?[{n:T('未填','Unknown'),v:list.length-ma-fe,c:'#cbd5e1'}]:[]));
      if(rs.length&&key!=='join'){g+='<div class="okn-st">⏳ '+T('離職者做了多久','Tenure of leavers')+'</div>'+bars(tally(rs,function(r){return tenure(r.workingDays);},TEN_ORD),{c:'#fb923c'});
        var rsn=tally(rs.filter(function(r){return r.reason;}),function(r){return String(r.reason).slice(0,30);}).slice(0,10);if(rsn.length)g+='<div class="okn-st">💬 '+T('離職原因','Reasons')+'</div>'+bars(rsn,{c:'#a78bfa'});}}
    g+='</div>';
    /* 走勢 */
    var tr='<div class="okn">'+chart2(M.map(function(m,ix){return {k:String(+m.slice(5))+T('月','M'),a:mj[ix],b:mr[ix],cur:m===endM};}),{title:'📈 '+T('近 12 個月入職 vs 離職','Joins vs resigns, last 12 months')})+
      chart1(M.map(function(m,ix){return {k:String(+m.slice(5))+T('月','M'),v:mh[ix],cur:m===endM};}),{title:'👥 '+T('每月月底在職','Headcount at month end'),c:'#94a3b8',base:1})+
      chart1(M.map(function(m,ix){var o=hc(lastDay(addM(m,-1))),c=mh[ix],den=(o!=null&&c!=null)?(o+c)/2:c;return {k:String(+m.slice(5))+T('月','M'),v:den?Math.round(mr[ix]/den*1000)/10:null,t:den?(mr[ix]/den*100).toFixed(1):'',cur:m===endM};}),{title:'📉 '+T('每月流動率 %','Monthly turnover %'),c:'#fb923c'})+
      '<div class="okn-st">🗒 '+T('每月','By month')+'</div><div class="okn-tb">'+M.slice().reverse().map(function(m){var ix=M.indexOf(m);return '<div class="'+(m===endM?'on':'')+'"><span>'+m+'</span><span class="r"><b style="color:#16a34a">+'+mj[ix]+'</b> <b style="color:#dc2626">−'+mr[ix]+'</b></span><span class="r">'+(mh[ix]==null?'':mh[ix]+T(' 人',''))+'</span></div>';}).join('')+'</div></div>';
    var panes=key==='hc'?[['num','📈 '+T('走勢','Trend'),tr],['grp','🗒 '+T('每月在職','Monthly HC'),g]]:[['ppl','👥 '+T('名單','List'),ppl],['grp','🏢 '+T('分布','Breakdown'),g],['num','📈 '+T('走勢','Trend'),tr]];
    return {icon:{join:'🟢',resign:'🔴',net:'⚖️',hc:'👥',to:'📉',ten:'⏳'}[key],title:label,chips:[cap,shown],top:top,panes:panes};
  }
  var css='.okn{padding:10px 14px 14px;color:#0f172a}.okn-hero{border:1px solid #e2e8f0;border-radius:14px;padding:12px 14px;background:#f8fafc}.okn-big{font-size:36px;font-weight:800;line-height:1.1}.okn-l{font-size:13px;color:#475569;font-weight:600;margin-top:3px}'
   +'.okn-kv{display:flex;flex-wrap:wrap;gap:8px 16px;margin-top:8px}.okn-kv div{display:flex;flex-direction:column}.okn-kv b{font-size:17px}.okn-kv span{font-size:11px;color:#64748b}.okn-cmp{font-size:13px;margin-top:6px;font-weight:600}.okn-note{font-size:11.5px;color:#64748b;margin-top:6px;line-height:1.5}'
   +'.okn-st{font-size:13px;font-weight:700;margin:12px 0 6px;color:#1e293b}.okn-st small{font-weight:400;color:#64748b;margin-left:6px}.okn-st small i{display:inline-block;width:8px;height:8px;border-radius:2px;margin:0 3px 0 6px}.okn-ch{border:1px solid #e2e8f0;border-radius:12px;padding:4px 8px 6px;margin:8px 0;background:#fff}'
   +'.okn-br{display:grid;grid-template-columns:minmax(90px,40%) 1fr auto;gap:8px;align-items:center;padding:5px 0;border-bottom:1px solid #f1f5f9;font-size:13px}.okn-br .n{font-weight:600;word-break:break-word}.okn-br .t{height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden}.okn-br .t i{display:block;height:100%;border-radius:4px}.okn-br .v{font-weight:700;text-align:right;min-width:48px}.okn-tot{border-top:2px solid #cbd5e1;border-bottom:0}.okn-tot .n,.okn-tot .v{color:#4f46e5}'
   +'.okn-tb>div{display:grid;grid-template-columns:1fr auto auto;gap:10px;padding:6px 4px;border-bottom:1px solid #f1f5f9;font-size:13px;align-items:center}.okn-tb>div.on{background:#eef2ff;border-radius:8px}.okn-tb small{display:block;color:#64748b;font-size:10.5px}.okn-tb .r{text-align:right}';
  try{var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);}catch(e){}
  window.acKeynoteCardEl=function(el){try{return el.closest('#pn-ov .kpi');}catch(e){return null;}};
  window.acKeynoteCard=function(el){try{return build(el);}catch(e){try{console.warn('onb-kn',e);}catch(_){}return null;}};
})();
