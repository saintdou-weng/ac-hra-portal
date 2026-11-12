/* AC HRA 考勤 Telegram 摘要 v1（2026-11-12）
   Paul：學生產摘要——短、色條、色點、假別只留簡寫（AL/PL/SL/NP/ML…），數字正確就寫「已核對正確」。
   人車比＝全廠人數 ÷ 車工（例 1.6 ＝ 每 1 個車工配 0.6 個間接人員）。
   部門分組不重疊：全廠總計 → 部門小計（加總要等於全廠）→ 其下各組小計 ＋ 其餘。
   純函式：頁面和 GAS 都可用。輸入 days=[{date, rows:[當天所有列]}]，輸出 Telegram HTML。 */
(function(root){
  'use strict';
  var LV=[['al','AL'],['pl','PL'],['sl','SL'],['np','NP'],['bus','Bus'],['fl','FL'],['ml','ML'],['idle','Idle']];
  var WD={zh:['日','一','二','三','四','五','六'],en:['Sun','Mon','Tue','Wed','Thu','Fri','Sat']};
  function n(v){return Number(v)||0;}
  function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  function lab(lang,zh,en){return lang==='zh'?zh:(lang==='en'||lang==='km')?en:zh+' '+en;}
  function ttl(r){return n(r.m)+n(r.f);}
  function report(r){return ttl(r)-n(r.resign)+n(r.join)+n(r.ti)-n(r.to);}
  function leave(r){return n(r.al)+n(r.pl)+n(r.sl)+n(r.bus)+n(r.fl)+n(r.ml);}
  function clean(s){return String(s||'').replace(/小計|subtotal/gi,'').replace(/\s+/g,' ').trim();}
  function dot(rate){return rate==null?'⚪':rate>=0.95?'🟢':rate>=0.90?'🟡':'🔴';}
  function sq(rate){return rate==null?'⬜':rate>=0.95?'🟩':rate>=0.90?'🟨':'🟥';}
  function bar(rate,w){w=w||10;if(rate==null)return '';var k=Math.round(Math.max(0,Math.min(1,rate))*w),o='';for(var i=0;i<w;i++)o+=i<k?sq(rate):'⬜';return o;}
  function pc(v,d){return v==null||!isFinite(v)?'—':(v*100).toFixed(d==null?1:d)+'%';}
  function r1(v){return Math.round(v*10)/10;}
  function isSewingLine(r){
    if(r.isSubtotal||r.isGrand)return false;
    var line=String(r.line||'').trim(),lo=line.toLowerCase(),sect=String(r.sect||'').toLowerCase();
    if(ttl(r)<1)return false;
    if(/cutting|裁剪|qc|品管|quality.control|packing|包裝|成品|finishing|warehouse|倉庫|mechanic|機修|sample|樣品|marker|馬克|supervisor|組長|班長|line.leader|team.leader|leader|inspector|檢驗|pc|生管|ie|admin|行政|hr|ga|electrician|工務|others|其它|其他|cutter/i.test(lo))return false;
    if(/cutting|裁剪|qc|packing|包裝|warehouse|倉庫|mechanic|機修|sample|樣品|marker|品管/i.test(sect))return false;
    if(/garment\s+(line\s*)?[a-z]?\d+/i.test(lo)||/^apron\s+[a-z]\d+/i.test(lo)||/^(成衣|圍裙)\s*\d+\s*組/.test(line))return true;
    var b=line.replace(/\s*[/／].*$/,'').trim();
    if(/^line\s*0*\d+$/i.test(b)||/^l\s*0*\d+$/i.test(b))return true;
    return /sewing|garment|apron|車縫|成衣|圍裙/i.test(sect)&&/\d/.test(line);
  }
  /* 一天的不重疊分組 */
  function groupsForDay(rows){
    var grand=rows.filter(function(r){return r.isGrand;})[0];
    var subs=rows.filter(function(r){return r.isSubtotal&&ttl(r)>0;});
    var top=subs.filter(function(r){return clean(r.dept);}),sec=subs.filter(function(r){return !clean(r.dept)&&clean(r.sect);});
    var G=grand?ttl(grand):0,pick=[];
    if(G&&top.length&&top.length<=14){   /* 找加總＝全廠的部門小計組合（項目多的優先） */
      var best=null;for(var mask=1;mask<(1<<top.length);mask++){var s=0,c=[];for(var i=0;i<top.length;i++)if(mask&(1<<i)){s+=ttl(top[i]);c.push(top[i]);}if(s===G&&(!best||c.length>best.length))best=c;}
      pick=best||[];
    }
    var out=[];
    function mk(name,src,list){var o={name:name,m:0,f:0,att:0,join:0,resign:0,ti:0,to:0};LV.forEach(function(x){o[x[0]]=0;});(list||[src]).forEach(function(r){['m','f','att','join','resign','ti','to'].concat(LV.map(function(x){return x[0];})).forEach(function(k){o[k]+=n(r[k]);});});return o;}
    function minus(name,a,list){var o=mk(name,a);list.forEach(function(r){Object.keys(o).forEach(function(k){if(k!=='name')o[k]-=n(r[k]);});});return o;}
    if(!pick.length){ /* 沒有可用的部門小計：用各組小計，不保證加總 */
      sec.forEach(function(r){out.push(mk(clean(r.sect),r));});return {groups:out,grand:grand,exact:false};
    }
    var usedSec=false;
    pick.slice().sort(function(a,b){return ttl(b)-ttl(a);}).forEach(function(T){
      var tn=clean(T.dept);
      var secSum=sec.reduce(function(s,r){return s+ttl(r);},0);
      if(!usedSec&&sec.length&&secSum<=ttl(T)){   /* 最大的部門拆成各組 */
        usedSec=true;sec.forEach(function(r){out.push(mk(clean(r.sect),r));});
        var rest=minus(tn,T,sec);
        if(ttl(rest)>0){var cut=rows.some(function(r){return !r.isSubtotal&&!r.isGrand&&/cut|裁/i.test(r.line||'')&&ttl(r)>0;});rest.name=cut?'裁剪等 Cutting etc.':tn+' 其他';out.push(rest);}
        return;
      }
      /* 名字被包含的較小部門小計（行政中心 ⊂ 行政中心+辦公室人員） */
      var kid=top.filter(function(r){return r!==T&&pick.indexOf(r)<0&&ttl(r)<ttl(T)&&tn.indexOf(clean(r.dept))>=0&&clean(r.dept);})[0];
      if(kid){out.push(mk(clean(kid.dept),kid));var rest2=minus(tn.replace(clean(kid.dept),'').replace(/^[+＋/／\s]+/,'')||tn,T,[kid]);if(ttl(rest2)>0)out.push(rest2);}
      else out.push(mk(tn,T));
    });
    return {groups:out,grand:grand,exact:true};
  }
  var EN={'車工':'Sewing','QC':'QC','包裝/成品':'Packing/FG','倉庫':'Warehouse','機修':'Mechanic','技術部':'Technical','行政中心':'Admin Center','辨公室人員':'Office','辦公室人員':'Office','生產部':'Production','裁剪等 Cutting etc.':'Cutting etc.'};
  function gname(nm,lang){var e=EN[nm];if(nm==='裁剪等 Cutting etc.')return lang==='zh'?'裁剪等':lang==='both'?nm:'Cutting etc.';if(!e)return nm;return lang==='zh'?nm:(lang==='en'||lang==='km')?e:(nm===e?nm:nm+' '+e);}
  function leaveCodes(o){return LV.filter(function(x){return n(o[x[0]])>0;}).map(function(x){return x[1]+' '+r1(n(o[x[0]]));}).join(' · ');}
  function sum(list,f){return list.reduce(function(s,x){return s+f(x);},0);}
  function build(opt){
    var lang=opt.lang||'both',mode=opt.mode||'daily',days=(opt.days||[]).filter(function(d){return (d.rows||[]).some(function(r){return r.isGrand;});});
    var title={daily:lab(lang,'考勤日報','Daily Attendance'),weekly:lab(lang,'考勤週報','Weekly Attendance'),monthly:lab(lang,'考勤月報','Monthly Attendance'),yearly:lab(lang,'考勤年報','Annual Attendance')}[mode];
    var L=[],W=WD[lang==='zh'?'zh':lang==='both'?'zh':'en'];
    var wd=function(d){return W[new Date(d+'T00:00:00Z').getUTCDay()];};
    var per=opt.periodLabel||opt.key||'';if(mode==='daily'&&days[0])per=days[0].date+'（'+wd(days[0].date)+'）';
    L.push('📊 <b>VRT '+esc(title)+'</b> · '+esc(per));
    L.push('━━━━━━━━━━━━');
    if(!days.length){L.push(lab(lang,'沒有資料','No data'));return L.join('\n');}
    var D=days.length,G=days.map(function(d){var g=d.rows.filter(function(r){return r.isGrand;})[0],sew=d.rows.filter(isSewingLine);return {date:d.date,g:g,sew:sum(sew,ttl),gr:groupsForDay(d.rows)};});
    var avg=function(f){return sum(G,f)/D;};
    var att=sum(G,function(x){return n(x.g.att);}),rep=sum(G,function(x){return report(x.g);}),rate=rep>0?att/rep:null;
    var hc=avg(function(x){return ttl(x.g);}),M=avg(function(x){return n(x.g.m);}),F=avg(function(x){return n(x.g.f);});
    var sewD=G.filter(function(x){return x.sew>0;}),S=sewD.length?sum(sewD,function(x){return x.sew;})/sewD.length:0,ST=sewD.length?sum(sewD,function(x){return ttl(x.g);})/sewD.length:0;
    var lv={};LV.forEach(function(x){lv[x[0]]=sum(G,function(y){return n(y.g[x[0]]);});});
    var join=sum(G,function(x){return n(x.g.join);}),res=sum(G,function(x){return n(x.g.resign);});
    var daily=mode==='daily',avgTag=daily?'':lab(lang,'日均','avg ');
    L.push(dot(rate)+' <b>'+lab(lang,'出勤率','Attendance')+' '+pc(rate)+'</b>');
    L.push(bar(rate));
    L.push('👥 '+avgTag+r1(hc)+' '+lab(lang,'人','ppl')+' · ✅ '+lab(lang,'出勤','att.')+' '+r1(att/D)+' · 📋 '+lab(lang,'請假','leave')+' '+r1(sum(G,function(x){return leave(x.g);})/D)+(lv.np?' · ⚠️ NP '+r1(lv.np/D):''));
    if(hc>0)L.push('👩 '+r1(F)+' ('+pc(F/hc,0)+') · 👨 '+r1(M)+' ('+pc(M/hc,0)+')');
    if(S>0)L.push('🧵 '+lab(lang,'車工','Sewers')+' '+r1(S)+' · '+lab(lang,'間接','Indirect')+' '+r1(ST-S)+' · <b>'+lab(lang,'人車比','Ratio')+' '+(ST/S).toFixed(2)+'</b>');
    L.push('🔄 '+lab(lang,'入','Join')+' '+join+' · '+lab(lang,'離','Resign')+' '+res+(hc>0?' · '+lab(lang,'流失','turnover')+' '+pc(res/hc,2):''));
    var lc=leaveCodes(lv);if(lc)L.push('📋 '+(daily?'':lab(lang,'人次 ','person-days '))+lc);
    /* 期間明細：週＝每天一行；月＝每週；年＝每月 */
    if(!daily){
      var buckets=[];
      if(mode==='weekly'||(mode==='monthly'&&D<=8))G.forEach(function(x){buckets.push({label:(mode==='weekly'?wd(x.date):x.date.slice(5)),items:[x]});});
      else{var key=mode==='yearly'?function(d){return d.slice(0,7);}:function(d){var t=new Date(d+'T00:00:00Z'),w=(t.getUTCDay()+6)%7;t.setUTCDate(t.getUTCDate()-w);return t.toISOString().slice(5,10);};var mp={};G.forEach(function(x){var k=key(x.date);(mp[k]=mp[k]||[]).push(x);});Object.keys(mp).sort().forEach(function(k){buckets.push({label:mode==='yearly'?k.slice(5):'W '+k,items:mp[k]});});}
      L.push('');L.push('📅 <b>'+(mode==='weekly'?lab(lang,'每天','Daily'):mode==='yearly'?lab(lang,'每月','Monthly'):lab(lang,'每週','Weekly'))+'</b>');
      buckets.forEach(function(b){var a=sum(b.items,function(x){return n(x.g.att);}),r=sum(b.items,function(x){return report(x.g);}),rt=r>0?a/r:null;L.push(esc(b.label)+' '+bar(rt,8)+' '+pc(rt)+' · '+Math.round(a/b.items.length));});
    }
    /* 部門（合併期間） */
    var gm={},order=[];G.forEach(function(x){x.gr.groups.forEach(function(g){if(!gm[g.name]){gm[g.name]={name:g.name,m:0,f:0,att:0,rep:0,join:0,resign:0,ti:0,to:0,days:0};LV.forEach(function(y){gm[g.name][y[0]]=0;});order.push(g.name);}var o=gm[g.name];o.days++;o.att+=n(g.att);o.rep+=report(g);o.m+=n(g.m);o.f+=n(g.f);LV.forEach(function(y){o[y[0]]+=n(g[y[0]]);});});});
    var gl=order.map(function(k){return gm[k];}).filter(function(o){return o.m+o.f>0;});
    if(gl.length){
      L.push('');L.push('🏢 <b>'+lab(lang,'各部門','By department')+'</b>（🟢≥95% 🟡≥90% 🔴&lt;90%）');
      gl.sort(function(a,b){return (b.m+b.f)-(a.m+a.f);}).forEach(function(o){var rt=o.rep>0?o.att/o.rep:null,c=leaveCodes(o);L.push(dot(rt)+' <b>'+esc(gname(o.name,lang))+'</b> '+r1((o.m+o.f)/o.days)+' · '+pc(rt)+(c?' · '+c:''));});
    }
    /* 核對 */
    var ok=G.every(function(x){if(!x.gr.exact)return false;var gs=x.gr.groups;return Math.abs(sum(gs,ttl)-ttl(x.g))<0.5&&Math.abs(sum(gs,function(g){return n(g.att);})-n(x.g.att))<0.5;});
    L.push('');
    L.push(ok?'🔎 ✅ '+lab(lang,'部門加總＝全廠（人數、出勤）· 出勤率＝','Departments = factory (headcount, attendance) · rate = ')+att+'÷'+rep+' · '+lab(lang,'已核對正確','verified')
             :'🔎 ⚠️ '+lab(lang,'部門加總與全廠不一致，請看平台','Department totals differ from factory — check the platform')+' · '+lab(lang,'出勤率＝','rate = ')+att+'÷'+rep);
    return L.join('\n');
  }
  var api={build:build,groupsForDay:groupsForDay,isSewingLine:isSewingLine};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HRAAttTg=api;
})(typeof window!=='undefined'?window:this);
