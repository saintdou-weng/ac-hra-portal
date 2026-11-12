/* v76 (2026-11-12)：男女不用人像（🚺 女／🚹 男）；Line1 寫 L1；每台車部門列改等寬對齊、依組別順序。
   v73 (2026-11-12)：交通車每台車載客色標——15–25 🟢；26–30、10–14 🟡；>30、<10 🔴；加全廠部門／職位總覽與每台車職位。
   v72 (2026-11-06)：交通車改成每台車一段（部門各幾人、男女、年資列表）；柬文一律英柬並列。
   v71 (2026-11-06): 總覽在前（人數／車數／部門／比例條），名單不逐人列，只列新增・停止・未付；車輛用顏色點區分。
   v70: welfare Telegram cards rebuilt — union dues / transport / accommodation / suggestion box as separate cards,
   totals first (people, amount, paid/unpaid with reasons, per-vehicle counts, department share), colour status lights,
   one short line per person (department shown once), bilingual labels inline, verified line; no approval workflow.
   Based on v69 employee context resolution. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.HRAWelfareReport=api;})(typeof window!=='undefined'?window:this,function(){
  'use strict';
  var B1='\u0001',B2='\u0002',C1='\u0003',C2='\u0004';   /* C1/C2＝等寬字（表格對齊用） */
  function text(v){return String(v==null?'':v).trim();}
  function first(row,keys){for(var k of keys){if(text(row[k]))return text(row[k]);}return '';}
  function id(row){return first(row,['employeeId','empId','idNo','factoryId','vrtCode','cardId','工號']);}
  function idKey(value){var s=text(value).toUpperCase();return /^\d+$/.test(s)?s.replace(/^0+(?=\d)/,''):s;}
  function name(row){return first(row,['name','employeeName','englishName','nameEn','khmerName','nameKh','submittedBy']);}
  function nameKey(s){return text(s).toLocaleLowerCase().replace(/\s+/g,' ');}
  function resolve(row,candidates){
    row=row||{};var eid=id(row),nm=name(row),anon=row.anonymous===true||row.isAnonymous===true||/^(anonymous|匿名|អនាមិក)$/i.test(nm);
    if(anon)return {id:'',name:'',department:row.department||row.dept||'',section:'',joinDate:'',anonymous:true};
    var all=(candidates||[]).filter(function(r){return r&&typeof r==='object';}),matches=[];
    if(eid)matches=all.filter(function(r){return idKey(id(r))===idKey(eid);});
    else if(nm){
      var found=all.filter(function(r){return nameKey(name(r))===nameKey(nm);}),identities=new Set(found.map(id).filter(Boolean).map(idKey));
      if(identities.size===1)matches=found.filter(function(r){return identities.has(idKey(id(r)));});
    }
    // Preserve the historical roster: only use dated snapshots at or before its month.
    if(row.period)matches=matches.filter(function(r){return !r.period||String(r.period).slice(0,7)<=String(row.period).slice(0,7);});
    matches.sort(function(a,b){return String(b.period||'').localeCompare(String(a.period||''))||String(b.updatedAt||'').localeCompare(String(a.updatedAt||''));});
    function field(keys){var own=first(row,keys);if(own)return own;for(var r of matches){var v=first(r,keys);if(v)return v;}return '';}
    var dept=field(['department','dept','departmentName']),section=field(['section','group','line','team','sewingLine','groupName','組別']);
    if(!section){var m=dept.match(/(?:^|\s)(?:L|LINE|GROUP|車縫|車組|組別)\s*[-:]?\s*(\d{1,2})(?:\b|$)/i);if(m)section='L'+m[1];}
    return {id:eid||(matches[0]?id(matches[0]):''),name:nm||field(['name','employeeName','englishName','nameEn','khmerName','nameKh']),department:dept,section:section,position:field(['position','jobTitle']),joinDate:field(['joinDate','hireDate','dateOfJoining','joiningDate','startDate']),gender:field(['gender','sex']),anonymous:!eid&&!nm};
  }
  /* 「組別」與「部門」同一個地方（L10 ＝ Line 10）就只寫一次 */
  function placeKey(v){return text(v).toUpperCase().replace(/\s+/g,'').replace(/^LINE/,'L').replace(/[^A-Z0-9ក-៿一-鿿]/g,'');}
  /* 同一組寫法不一（Line 4／Line4／LINE 04）併成一個：Line4 */
  function tidy(v){return text(v).replace(/\b(?:line|l)\s*0*(\d{1,2})\b/gi,'L$1');}   /* Paul 11/12：Line1 直接寫 L1 */
  function place(c){var d=tidy(c.department),s=tidy(c.section);if(!d)return s;if(!s)return d;return placeKey(d)===placeKey(s)?d:d+'/'+s;}
  function pct(n,total){return total?Math.round(n/total*100)+'%':'0%';}
  function usd(v){return 'USD '+Number(v||0).toFixed(2);}
  function mmdd(d){d=text(d);return /^\d{4}-\d{2}-\d{2}/.test(d)?d.slice(5,10):d;}
  function L(lang,z,e,k){if(lang==='en')return e;if(lang==='km')return k&&k!==e?e+' / '+k:e;  /* 柬文＝英柬並列，不單獨柬文 */if(lang==='zh')return z;return z===e?z:z+' '+e;}
  function bold(s){return B1+s+B2;}
  function escapeHtml(s){return String(s).replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c];});}
  function plain(s){return String(s).split(B1).join('').split(B2).join('').split(C1).join('').split(C2).join('');}
  function toHtml(s){return escapeHtml(String(s)).split(B1).join('<b>').split(B2).join('</b>').split(C1).join('<code>').split(C2).join('</code>');}
  function mono(s){return C1+s+C2;}
  /* 等寬對齊：中文字算 2 格 */
  function wlen(s){var n=0;String(s).split('').forEach(function(c){n+=/[\u1100-\uffdc]/.test(c)?2:1;});return n;}
  function padR(s,w){s=String(s);var k=w-wlen(s);return s+(k>0?new Array(k+1).join(' '):'');}
  function padL(s,w){s=String(s);var k=w-wlen(s);return (k>0?new Array(k+1).join(' '):'')+s;}
  function lineSort(a,b){var x=/^L(\d+)$/.exec(a),y=/^L(\d+)$/.exec(b);if(x&&y)return x[1]-y[1];if(x)return -1;if(y)return 1;return a.localeCompare(b,undefined,{numeric:true});}
  function statusWord(lang,s){var m={new:['新建','New','ថ្មី'],reviewing:['審查中','Reviewing','កំពុងពិនិត្យ'],action:['處理中','In action','កំពុងអនុវត្ត'],closed:['結案','Closed','បិទ'],rejected:['不採納','Rejected','មិនទទួល'],paid:['已付','Paid','បានបង់'],unpaid:['未付','Unpaid','មិនបានបង់'],active:['有效','Active','សកម្ម'],stopped:['停止','Stopped','បញ្ឈប់'],transport_apply:['加入交通','Join transport','ចូលដឹកជញ្ជូន'],transport_stop:['停止交通','Stop transport','ឈប់ដឹកជញ្ជូន'],dorm_in:['入住','Move in','ចូលស្នាក់នៅ'],dorm_out:['搬出','Move out','ចាកចេញ']};return m[s]?L(lang,m[s][0],m[s][1],m[s][2]):text(s);}
  function deptShare(lang,rows,ctx){
    var dm={};rows.forEach(function(r){var k=place(ctx(r))||'—';dm[k]=(dm[k]||0)+1;});
    var keys=Object.keys(dm).sort(function(a,b){return dm[b]-dm[a];});if(!keys.length||(keys.length===1&&keys[0]==='—'))return '';
    return '🏢 '+keys.slice(0,8).map(function(k){return k+' '+bold(dm[k])+' '+pct(dm[k],rows.length);}).join(' │ ')+(keys.length>8?' │ …+'+(keys.length-8):'');
  }
  function who(c,n){var seg=[];if(c.anonymous)return (n?'#'+n+' ':'')+'🙈';if(c.id)seg.push(c.id);seg.push(bold(c.name||'—'));var p=place(c);if(p)seg.push(p);return (n?'#'+n+' ':'')+seg.join(' · ');}
  function verify(lang,rows,ctx,extra){
    var issues=[],noId=0,noName=0,seen={},dup=0;
    rows.forEach(function(r){var c=ctx(r);if(c.anonymous)return;if(!c.id)noId++;if(!c.name)noName++;var k=idKey(c.id);if(k){if(seen[k])dup++;seen[k]=1;}});
    if(noId)issues.push(L(lang,'缺工號','missing ID','គ្មានអត្តលេខ')+' '+noId);if(noName)issues.push(L(lang,'缺姓名','missing name','គ្មានឈ្មោះ')+' '+noName);if(dup)issues.push(L(lang,'工號重複','duplicate ID','អត្តលេខស្ទួន')+' '+dup);
    (extra||[]).forEach(function(x){if(x)issues.push(x);});
    return issues.length?'⚠ '+L(lang,'需確認','Check','ពិនិត្យ')+'：'+issues.join(' · '):'🔎 '+bold(L(lang,'已核對清楚沒問題','Verified — all correct','បានផ្ទៀងផ្ទាត់ត្រឹមត្រូវ'))+' ✓ · '+rows.length+' '+L(lang,'人','people','នាក់');
  }
  function sortRows(rows,ctx){return rows.slice().sort(function(a,b){var x=ctx(a),y=ctx(b);return String(x.id||'').localeCompare(String(y.id||''),undefined,{numeric:true})||String(x.name||'').localeCompare(String(y.name||''));});}
  function header(icon,title,period){return [icon+' '+bold(title)+' · '+period,'━━━━━━━━━━━━'].join('\n');}
  /* ── 2026-11-06 Paul：摘要先總覽（人數、車數、部門、比例條），名單不逐人列；只列新增／停止／未付 ── */
  var DOT=['🔵','🟢','🟠','🟣','🔴','🟡','🟤','⚫'],SQ=['🟦','🟩','🟧','🟪','🟥','🟨','🟫','⬛'],CAR=['🚌','🚐','🚎','🚙','🛻','🚕','🚗','🚚'];
  function bar(v,total,w,sq){w=w||10;total=Number(total)||0;v=Number(v)||0;if(total<=0)return '';var r=Math.max(0,Math.min(1,v/total)),n=Math.round(r*w),b=sq||(r>=0.9?'🟩':r>=0.7?'🟨':'🟥'),o='';for(var i=0;i<w;i++)o+=i<n?b:'⬜';return o+' '+Math.round(r*100)+'%';}
  /* Paul 11/12 第二次定：15–25 🟢；26–30、10–14 🟡；>30、<10 🔴 */
  function capTone(n){return (n>30||n<10)?'🔴':(n>25||n<15)?'🟡':'🟢';}
  function capWord(lang,n){return n>30?L(lang,'超載 +'+(n-30),'over by '+(n-30),'លើស '+(n-30)):n<10?L(lang,'太少（未滿 10）','too few (under 10)','តិចពេក (<10)'):n>25?L(lang,'接近滿載','near full','ជិតពេញ'):n<15?L(lang,'偏少（未滿 15）','low (under 15)','តិច (<15)'):L(lang,'正常','OK','ធម្មតា');}
  function capBar(n){var t=capTone(n),sq=t==='🔴'?'🟥':t==='🟡'?'🟨':'🟩',k=Math.max(1,Math.min(10,Math.round(n/30*10))),o='';for(var i=0;i<10;i++)o+=i<k?sq:'⬜';return o+' '+Math.round(n/30*100)+'%';}
  function sec(icon,title){return '━━ '+icon+' '+bold(title)+' ━━';}
  function countBy(rows,fn){var m={};rows.forEach(function(r){var k=fn(r);m[k]=(m[k]||0)+1;});return m;}
  function sortedKeys(m){return Object.keys(m).sort(function(a,b){return m[b]-m[a]||a.localeCompare(b,undefined,{numeric:true});});}
  /* 同一部門的列：「Line9 · 9 人 13% · 🔵5 🟢3 🟠1」 */
  function deptLines(lang,rows,ctx,extra,max){
    max=max||14;var dm=countBy(rows,function(r){return place(ctx(r))||'—';}),keys=sortedKeys(dm),out=[];
    keys.slice(0,max).forEach(function(k){var mine=rows.filter(function(r){return (place(ctx(r))||'—')===k;});out.push('▸ '+bold(k)+' · '+bold(dm[k])+' '+L(lang,'人','ppl','នាក់')+' '+pct(dm[k],rows.length)+(extra?' · '+extra(mine):''));});
    if(keys.length>max){var rest=keys.slice(max).reduce(function(n,k){return n+dm[k];},0);out.push('▸ '+L(lang,'其他','Others','ផ្សេងៗ')+' '+(keys.length-max)+' · '+bold(rest)+' '+L(lang,'人','ppl','នាក់'));}
    return out;
  }
  function moveLine(r,ctx,tail){var c=ctx(r);return mmdd(r.date)+' · '+(c.id||'—')+' '+bold(c.name||'—')+(place(c)?' · '+place(c):'')+(tail?' · '+tail:'')+(text(r.remark)?' · '+text(r.remark):'');}
  /* ── 工會費 Union dues ───────────────────────────────────────────────── */
  function unionCard(lang,s,period,ctx){
    var rows=sortRows(s.union||[],ctx),unpaid=rows.filter(function(r){return r.status==='unpaid'||!(Number(r.amount)>0);}),paid=rows.length-unpaid.length,total=rows.reduce(function(n,r){return n+(Number(r.amount)||0);},0);
    var out=[header('🤝',L(lang,'工會費','Union dues','ថ្លៃសហជីព'),period)];
    out.push((unpaid.length?'🟠 ':'🟢 ')+bold(unpaid.length?L(lang,'未付 '+unpaid.length+' 人','Unpaid '+unpaid.length,'មិនបានបង់ '+unpaid.length):L(lang,'全部已付','All paid','បានបង់ទាំងអស់')));
    out.push('👥 '+L(lang,'人數','People','ចំនួន')+' '+bold(rows.length)+' · 💵 '+bold(usd(total))+' · 🏢 '+L(lang,'部門','Depts','ផ្នែក')+' '+bold(Object.keys(countBy(rows,function(r){return place(ctx(r))||'—';})).length));
    if(rows.length)out.push('🟢 '+L(lang,'已付','Paid','បានបង់')+' '+bold(paid)+' · 🔴 '+L(lang,'未付','Unpaid','មិនបានបង់')+' '+bold(unpaid.length)+'\n'+bar(paid,rows.length));
    out.push(verify(lang,rows,ctx,[Math.abs(total-Number(s.unionAmount||0))>0.005?L(lang,'金額合計不符','amount total mismatch','ចំនួនមិនត្រូវ'):'']));
    if(rows.length)out.push(sec('🏢',L(lang,'部門','Departments','ផ្នែក'))+'\n'+deptLines(lang,rows,ctx,function(m){return '$'+m.reduce(function(n,r){return n+(Number(r.amount)||0);},0).toFixed(2);}).join('\n'));
    if(unpaid.length)out.push(sec('🔴',L(lang,'未付','Unpaid','មិនបានបង់')+' · '+unpaid.length)+'\n'+unpaid.map(function(r){var c=ctx(r);return '🔴 '+(c.id||'—')+' '+bold(c.name||'—')+(place(c)?' · '+place(c):'')+' · '+(text(r.remark)||L(lang,'未註明原因','no reason given','មិនបានបញ្ជាក់'));}).join('\n'));
    if(!rows.length)out.push(L(lang,'沒有資料','No records','គ្មានទិន្នន័យ'));
    return out.join('\n');
  }
  /* ── 交通車 Transport ────────────────────────────────────────────────── */
  function transportCard(lang,s,period,ctx){
    var rows=sortRows((s.members||[]).filter(function(r){return r.transport&&r.status!=='stopped';}),ctx),mov=s.mov||[],added=mov.filter(function(r){return r.action==='transport_apply';}),stopped=mov.filter(function(r){return r.action==='transport_stop';});
    var none=L(lang,'未填車輛','No vehicle','គ្មានយានយន្ត'),veh=function(r){return text(r.driver)||none;},vm=countBy(rows.concat(added),veh),vk=sortedKeys(countBy(rows,veh)),ix={};
    /* 顏色照車名排序固定（每個月同一台車同一個顏色） */
    Object.keys(vm).filter(function(k){return k!==none;}).sort(function(a,b){return a.localeCompare(b,undefined,{numeric:true});}).forEach(function(k,i){ix[k]=i;});vm=countBy(rows,veh);
    var dot=function(k){var i=ix[k];return i==null?'⚪':DOT[i%DOT.length];},icon=function(k){var i=ix[k];return i==null?'🚐':CAR[i%CAR.length];};
    var out=[header('🚌',L(lang,'交通車','Transport','ដឹកជញ្ជូន'),period)];
    out.push('👥 '+L(lang,'人數','People','ចំនួន')+' '+bold(rows.length)+' · 🚐 '+L(lang,'車輛','Vehicles','ឡាន')+' '+bold(vk.filter(function(k){return k!==none;}).length)+' · 🆕 '+bold('+'+added.length)+' · ⛔ '+bold('−'+stopped.length));
    if(s.transport!==undefined&&Number(s.transport)!==rows.length)out.push('📑 '+L(lang,'月摘要寫','Monthly summary says','សង្ខេបខែ')+' '+bold(s.transport)+' · '+L(lang,'名單','roster','បញ្ជី')+' '+bold(rows.length));
    {var real=vk.filter(function(k){return k!==none;}),red=real.filter(function(k){return capTone(vm[k])==='🔴';}),yel=real.filter(function(k){return capTone(vm[k])==='🟡';}),nm=function(l){return l.length?'（'+l.map(function(k){return k+' '+vm[k];}).join('、')+'）':'';};
     if(real.length)out.push('🚦 '+L(lang,'載客','Load','ចំនួនអ្នកជិះ')+'：🟢 '+bold(real.length-red.length-yel.length)+' · 🟡 '+bold(yel.length)+nm(yel)+' · 🔴 '+bold(red.length)+nm(red)+'\n   '+L(lang,'15–25 綠 · 26–30／10–14 黃 · 超過 30／不到 10 紅','15–25 green · 26–30 / 10–14 yellow · over 30 / under 10 red','15–25 បៃតង · 26–30 / 10–14 លឿង · >30 / <10 ក្រហម'));}
    out.push(verify(lang,rows,ctx));
    /* 2026-11-06 Paul：每台車列出坐哪些部門各幾人、男女、年資（列表式，不列員工名字） */
    var ref=/^\d{4}-\d{2}$/.test(period)?new Date(+period.slice(0,4),+period.slice(5,7),0):/^\d{4}$/.test(period)?new Date(+period,11,31):new Date();
    var sex=function(r){var g=text(ctx(r).gender).toUpperCase();return /^(M|MALE|男|ប្រុស)/.test(g)?'M':/^(F|FEMALE|女|ស្រី)/.test(g)?'F':'';};
    var yrs=function(r){var j=text(ctx(r).joinDate).slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(j))return null;return (ref-new Date(j+'T00:00:00'))/31557600000;};
    var TEN=[[0,1,'<1y'],[1,3,'1–3y'],[3,5,'3–5y'],[5,99,'5y+']];
    var FW=L(lang,'女','F','ស្រី'),MW=L(lang,'男','M','ប្រុស');if(lang==='both'){FW='女';MW='男';}
    function mfn(m){var f=m.filter(function(r){return sex(r)==='F';}).length,ma=m.filter(function(r){return sex(r)==='M';}).length;return [f,ma,m.length-f-ma];}
    function mf(m){var x=mfn(m);return '🚺 '+FW+' '+x[0]+' · 🚹 '+MW+' '+x[1]+(x[2]?' · ❔'+x[2]:'');}
    function tenure(m){var t=TEN.map(function(x){return [x[2],m.filter(function(r){var y=yrs(r);return y!=null&&y>=x[0]&&y<x[1];}).length];}),u=m.filter(function(r){return yrs(r)==null;}).length;return t.filter(function(x){return x[1];}).map(function(x){return x[0]+' '+x[1];}).join(' · ')+(u?' · ❔'+u:'');}
    if(rows.length)out.push('🚺 '+L(lang,'女','Female','ស្រី')+' '+bold(rows.filter(function(r){return sex(r)==='F';}).length)+' · 🚹 '+L(lang,'男','Male','ប្រុស')+' '+bold(rows.filter(function(r){return sex(r)==='M';}).length)+' · ⏳ '+L(lang,'年資','Tenure','អតីតភាព')+' '+tenure(rows));
    var posOf=function(r){var p=text(ctx(r).position).replace(/\s+/g,' ');return /^[\x00-\x7f]+$/.test(p)?p.split(' ').map(function(w){return w.length<=3&&w===w.toUpperCase()?w:w.charAt(0).toUpperCase()+w.slice(1).toLowerCase();}).join(' '):p;},posLine=function(m,max){var pm=countBy(m.filter(posOf),posOf),pk=sortedKeys(pm);if(!pk.length)return '';return pk.slice(0,max).map(function(p){return p+' '+pm[p];}).join(' · ')+(pk.length>max?' · +'+(pk.length-max):'');};
    if(rows.length){var adm=countBy(rows,function(r){return place(ctx(r))||'—';}),adk=Object.keys(adm).sort(lineSort);
      out.push('🏢 '+L(lang,'部門','Depts','ផ្នែក')+' '+bold(adk.length)+'：'+adk.slice(0,16).map(function(d){return d+' '+adm[d];}).join(' · ')+(adk.length>16?' · +'+(adk.length-16):''));
      var apl=posLine(rows,8),noPos=rows.filter(function(r){return !posOf(r);}).length;if(apl)out.push('💼 '+L(lang,'職位','Positions','មុខតំណែង')+'：'+apl+(noPos?' · '+L(lang,'未填','blank','ទទេ')+' '+noPos:''));}
    vk.forEach(function(k){
      var m=rows.filter(function(r){return veh(r)===k;}),dm=countBy(m,function(r){return place(ctx(r))||'—';}),dk=sortedKeys(dm);
      /* 2026-11-12 Paul：每台車載客色標（15–25 綠；26–30、10–14 黃；>30、<10 紅） */
      var cap=k===none?null:capTone(m.length),capTxt=cap==null?'':' · '+cap+' '+capWord(lang,m.length);
      var blk=[dot(k)+icon(k)+' '+bold(k)+' · '+bold(m.length)+' '+L(lang,'人','ppl','នាក់')+(k===none?'':' / 30')+capTxt+'\n'+(k===none?bar(m.length,rows.length,10,'⬜'):capBar(m.length)),
        '   '+mf(m)+' · ⏳ '+tenure(m)];
      var pl=posLine(m,6);if(pl)blk.push('   💼 '+pl);
      dk=dk.slice().sort(lineSort);var w=Math.min(14,Math.max.apply(null,dk.map(wlen).concat([4])));
      dk.forEach(function(d){var dd=m.filter(function(r){return (place(ctx(r))||'—')===d;}),x=mfn(dd);blk.push(mono(' '+padR(d.length>14?d.slice(0,14):d,w)+' '+padL(dm[d],3)+'  '+FW+padL(x[0],3)+'  '+MW+padL(x[1],3)));});
      out.push(blk.join('\n'));
    });
    if(added.length)out.push(sec('🆕',L(lang,'新增','New','ថ្មី')+' · '+added.length)+'\n'+added.map(function(r){return '🆕 '+moveLine(r,ctx,text(r.driver)?dot(text(r.driver))+' '+text(r.driver):'');}).join('\n'));
    if(stopped.length)out.push(sec('⛔',L(lang,'停止','Stopped','បញ្ឈប់')+' · '+stopped.length)+'\n'+stopped.map(function(r){return '⛔ '+moveLine(r,ctx,'');}).join('\n'));
    if(!rows.length)out.push(L(lang,'沒有資料','No records','គ្មានទិន្នន័យ'));
    return out.join('\n');
  }
  /* ── 住宿 Accommodation ──────────────────────────────────────────────── */
  function accommodationCard(lang,s,period,ctx){
    var rows=sortRows((s.members||[]).filter(function(r){return r.accommodation&&r.status!=='stopped';}),ctx),mov=s.mov||[],moveIn=mov.filter(function(r){return r.action==='dorm_in';}),moveOut=mov.filter(function(r){return r.action==='dorm_out';});
    var expat=rows.filter(function(r){return r.accommodationType==='expat';}).length,local=rows.length-expat;
    var out=[header('🏠',L(lang,'住宿','Accommodation','ស្នាក់នៅ'),period)];
    out.push('👥 '+L(lang,'人數','People','ចំនួន')+' '+bold(rows.length)+' · 🆕 '+bold('+'+moveIn.length)+' · ⛔ '+bold('−'+moveOut.length));
    if(rows.length)out.push('🏘 '+L(lang,'本地','Local','ក្នុងស្រុក')+' '+bold(local)+' · 🌏 '+L(lang,'外籍','Expat','បរទេស')+' '+bold(expat)+'\n'+bar(local,rows.length,10,'🟦'));
    if(s.accommodation!==undefined&&Number(s.accommodation)!==rows.length)out.push('📑 '+L(lang,'月摘要寫','Monthly summary says','សង្ខេបខែ')+' '+bold(s.accommodation)+(Number(s.expat)?' ('+L(lang,'外籍','expat','បរទេស')+' '+s.expat+')':'')+' · '+L(lang,'名單','roster','បញ្ជី')+' '+bold(rows.length));
    out.push(verify(lang,rows,ctx));
    if(rows.length)out.push(sec('🏢',L(lang,'部門','Departments','ផ្នែក'))+'\n'+deptLines(lang,rows,ctx,function(m){var e=m.filter(function(r){return r.accommodationType==='expat';}).length,t=m.filter(function(r){return r.transport;}).length;return [(m.length-e)?'🏘'+(m.length-e):'',e?'🌏'+e:''].filter(Boolean).join(' ')+(t?' · 🚌'+t:'');}).join('\n'));
    if(moveIn.length)out.push(sec('🆕',L(lang,'入住','Move-in','ចូលស្នាក់នៅ')+' · '+moveIn.length)+'\n'+moveIn.map(function(r){return '🆕 '+moveLine(r,ctx,'');}).join('\n'));
    if(moveOut.length)out.push(sec('⛔',L(lang,'搬出','Move-out','ចាកចេញ')+' · '+moveOut.length)+'\n'+moveOut.map(function(r){return '⛔ '+moveLine(r,ctx,'');}).join('\n'));
    if(!rows.length)out.push(L(lang,'沒有資料','No records','គ្មានទិន្នន័យ'));
    return out.join('\n');
  }
  /* ── 意見箱 Suggestion box ───────────────────────────────────────────── */
  function suggestionCard(lang,s,period,ctx){
    var rows=(s.sugs||[]).slice().sort(function(a,b){return String(a.date||'').localeCompare(String(b.date||''));}),closed=rows.filter(function(r){return r.status==='closed';}).length,open=rows.length-closed,photos=rows.reduce(function(n,r){return n+((r.photos||[]).length);},0);
    var out=[header('💬',L(lang,'意見箱','Suggestion box','ប្រអប់យោបល់'),period)];
    out.push('📨 '+L(lang,'案件','Cases','ករណី')+' '+bold(rows.length)+' · 🟢 '+L(lang,'結案','Closed','បិទ')+' '+bold(closed)+' · 🟠 '+L(lang,'處理中','Open','កំពុង')+' '+bold(open)+' · 📷 '+L(lang,'照片','Photos','រូបថត')+' '+bold(photos));
    var ds=deptShare(lang,rows,function(r){return {department:r.department||'',section:''};});if(ds)out.push(ds);
    out.push(rows.length?'🔎 '+bold(L(lang,'已核對清楚沒問題','Verified — all correct','បានផ្ទៀងផ្ទាត់'))+' ✓':L(lang,'沒有資料','No records','គ្មានទិន្នន័យ'));
    if(rows.length)out.push('━━━━━━━━━━━━');
    rows.forEach(function(r,i){var c=ctx(r),light=r.status==='closed'?'🟢':r.status==='rejected'?'⚪':'🟠';
      out.push(light+' #'+(i+1)+' '+mmdd(r.date)+' · '+statusWord(lang,r.status||'new')+' · '+(c.anonymous?L(lang,'匿名','Anonymous','អនាមិក'):who(c))+'\n'+bold(text(r.grievance)||'n/a')+(text(r.checkedBy)?'\n'+L(lang,'檢查人','Checked by','អ្នកពិនិត្យ')+' '+text(r.checkedBy):'')+(text(r.responsible)?' · '+L(lang,'負責人','Responsible','អ្នកទទួលខុសត្រូវ')+' '+text(r.responsible):'')+(text(r.actionTaken)?'\n↩ '+text(r.actionTaken):''));});
    return out.join('\n');
  }
  function build(options){
    var o=options||{},lang=o.lang||'both',s=o.stats||{},type=o.type||'all',period=text(o.period)||'—',ctx=o.context||function(r){return resolve(r,[]);},cards=[];
    if(type==='all'||type==='transport')cards.push(transportCard(lang,s,period,ctx));
    if(type==='all'||type==='accommodation')cards.push(accommodationCard(lang,s,period,ctx));
    if(type==='all'||type==='union')cards.push(unionCard(lang,s,period,ctx));
    if(type==='all'||type==='suggestion')cards.push(suggestionCard(lang,s,period,ctx));
    cards.push('🏭 Vantage River Textiles · AC HRA');
    return cards.join('\n\n');
  }
  function format(options){return plain(build(options));}
  function html(options){return toHtml(build(options));}
  /* 送 Telegram 用：先切頁（不切斷一行），每頁轉成 HTML（粗體保留） */
  function htmlParts(options,limit){return split(build(options),limit).map(toHtml);}
  // Split on blank lines, then on single lines; never cut inside a line (bold tags live within one line).
  function split(message,limit){
    limit=limit||3400;var chunks=[],chunk='';
    function flush(){if(chunk){chunks.push(chunk);chunk='';}}
    text(message).split('\n\n').forEach(function(block){
      if(block.length>limit){flush();var lines=block.split('\n'),cur='';lines.forEach(function(line){if(cur&&cur.length+1+line.length>limit){chunks.push(cur);cur=line;}else cur+=(cur?'\n':'')+line;});chunk=cur;}
      else if((chunk?chunk.length+2:0)+block.length>limit){flush();chunk=block;}
      else chunk+=(chunk?'\n\n':'')+block;
    });flush();return chunks;
  }
  function delivered(result){var d=result&&result.data||result||{}, ids=[d.messageId,d.message_id,d.result&&d.result.message_id].concat(d.messageIds||[]);return ids.filter(function(x){return typeof x==='number'?x>0:/^\d+$/.test(String(x||''));});}
  return {resolve:resolve,format:format,html:html,htmlParts:htmlParts,bar:bar,split:split,delivered:delivered,place:place};
});
