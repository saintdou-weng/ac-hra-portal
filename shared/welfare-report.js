/* v70: welfare Telegram cards rebuilt — union dues / transport / accommodation / suggestion box as separate cards,
   totals first (people, amount, paid/unpaid with reasons, per-vehicle counts, department share), colour status lights,
   one short line per person (department shown once), bilingual labels inline, verified line; no approval workflow.
   Based on v69 employee context resolution. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.HRAWelfareReport=api;})(typeof window!=='undefined'?window:this,function(){
  'use strict';
  var B1='\u0001',B2='\u0002';
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
  function place(c){var d=text(c.department),s=text(c.section);if(!d)return s;if(!s)return d;return placeKey(d)===placeKey(s)?d:d+'/'+s;}
  function pct(n,total){return total?Math.round(n/total*100)+'%':'0%';}
  function usd(v){return 'USD '+Number(v||0).toFixed(2);}
  function mmdd(d){d=text(d);return /^\d{4}-\d{2}-\d{2}/.test(d)?d.slice(5,10):d;}
  function L(lang,z,e,k){if(lang==='en')return e;if(lang==='km')return k||e;if(lang==='zh')return z;return z===e?z:z+' '+e;}
  function bold(s){return B1+s+B2;}
  function escapeHtml(s){return String(s).replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c];});}
  function plain(s){return String(s).split(B1).join('').split(B2).join('');}
  function toHtml(s){return escapeHtml(String(s)).split(B1).join('<b>').split(B2).join('</b>');}
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
  /* ── 工會費 Union dues ───────────────────────────────────────────────── */
  function unionCard(lang,s,period,ctx){
    var rows=sortRows(s.union||[],ctx),paid=rows.filter(function(r){return r.status!=='unpaid'&&Number(r.amount)>0;}),unpaid=rows.filter(function(r){return r.status==='unpaid'||!(Number(r.amount)>0);}),total=rows.reduce(function(n,r){return n+(Number(r.amount)||0);},0);
    var out=[header('🤝',L(lang,'工會費','Union dues','ថ្លៃសហជីព'),period)];
    out.push('👥 '+L(lang,'人數','People','ចំនួន')+' '+bold(rows.length)+' · 💵 '+L(lang,'合計','Total','សរុប')+' '+bold(usd(total))+' · 🟢 '+L(lang,'已付','Paid','បានបង់')+' '+bold(paid.length)+' · 🔴 '+L(lang,'未付','Unpaid','មិនបានបង់')+' '+bold(unpaid.length)+(rows.length?' '+pct(unpaid.length,rows.length):''));
    var ds=deptShare(lang,rows,ctx);if(ds)out.push(ds);
    if(unpaid.length)out.push('🔴 '+L(lang,'未付名單／原因','Unpaid / reason','មិនបានបង់ / មូលហេតុ')+'：'+unpaid.slice(0,8).map(function(r){var c=ctx(r);return (c.id||'—')+' '+(c.name||'—')+(text(r.remark)?'（'+text(r.remark)+'）':'（'+L(lang,'未註明','no reason given','មិនបានបញ្ជាក់')+'）');}).join(' · ')+(unpaid.length>8?' · …+'+(unpaid.length-8):''));
    out.push(verify(lang,rows,ctx,[Math.abs(total-Number(s.unionAmount||0))>0.005?L(lang,'金額合計不符','amount total mismatch','ចំនួនមិនត្រូវ'):'']));
    out.push('━━━━━━━━━━━━\n📋 '+bold(L(lang,'名單','List','បញ្ជី')+' · '+rows.length));
    if(!rows.length)out.push(L(lang,'沒有資料','No records','គ្មានទិន្នន័យ'));
    rows.forEach(function(r,i){var c=ctx(r),un=unpaid.indexOf(r)>=0;out.push((un?'🔴':'🟢')+' '+who(c,i+1)+' · '+L(lang,'入會','since','ចូល')+' '+(text(r.unionJoinDate).slice(0,7)||'—')+' · $'+Number(r.amount||0).toFixed(2)+(un?' · '+statusWord(lang,'unpaid')+(text(r.remark)?' · '+text(r.remark):''):''));});
    return out.join('\n');
  }
  /* ── 交通車 Transport ────────────────────────────────────────────────── */
  function transportCard(lang,s,period,ctx){
    var active=(s.members||[]).filter(function(r){return r.transport&&r.status!=='stopped';}),rows=sortRows(active,ctx),mov=s.mov||[],added=mov.filter(function(r){return r.action==='transport_apply';}),stopped=mov.filter(function(r){return r.action==='transport_stop';});
    var out=[header('🚌',L(lang,'交通車','Transport','ដឹកជញ្ជូន'),period)];
    var head='👥 '+L(lang,'人數','People','ចំនួន')+' '+bold(rows.length)+' · 🆕 '+L(lang,'新增','New','ថ្មី')+' '+bold(added.length)+' · ⛔ '+L(lang,'停止','Stopped','បញ្ឈប់')+' '+bold(stopped.length);
    if(s.transport!==undefined&&Number(s.transport)!==rows.length)head+=' · 📑 '+L(lang,'月摘要','Monthly summary','សង្ខេបខែ')+' '+s.transport;
    out.push(head);
    var vm={};rows.forEach(function(r){var k=text(r.driver)||L(lang,'未填車輛','no vehicle','គ្មានយានយន្ត');vm[k]=(vm[k]||0)+1;});
    var vk=Object.keys(vm).sort(function(a,b){return vm[b]-vm[a];});
    if(vk.length)out.push('🚐 '+L(lang,'每車人數','Per vehicle','ក្នុងមួយឡាន')+' '+bold(vk.length)+' '+L(lang,'車','vehicles','ឡាន')+'：'+vk.slice(0,10).map(function(k){return k+' '+bold(vm[k]);}).join(' │ ')+(vk.length>10?' │ …+'+(vk.length-10):''));
    var ds=deptShare(lang,rows,ctx);if(ds)out.push(ds);
    out.push(verify(lang,rows,ctx));
    if(added.length)out.push('🆕 '+bold(L(lang,'新增','New','ថ្មី')+' · '+added.length)+'\n'+added.map(function(r){var c=ctx(r);return '🆕 '+mmdd(r.date)+' '+who(c)+(text(r.remark)?' · '+text(r.remark):'');}).join('\n'));
    if(stopped.length)out.push('⛔ '+bold(L(lang,'停止','Stopped','បញ្ឈប់')+' · '+stopped.length)+'\n'+stopped.map(function(r){var c=ctx(r);return '⛔ '+mmdd(r.date)+' '+who(c)+(text(r.remark)?' · '+text(r.remark):'');}).join('\n'));
    out.push('━━━━━━━━━━━━\n📋 '+bold(L(lang,'名單','List','បញ្ជី')+' · '+rows.length));
    if(!rows.length)out.push(L(lang,'沒有資料','No records','គ្មានទិន្នន័យ'));
    var byV=rows.slice().sort(function(a,b){return (vm[text(b.driver)]||0)-(vm[text(a.driver)]||0)||text(a.driver).localeCompare(text(b.driver))||String(ctx(a).id||'').localeCompare(String(ctx(b).id||''),undefined,{numeric:true});});
    byV.forEach(function(r,i){var c=ctx(r);out.push('🟢 '+who(c,i+1)+' · 🚐 '+(text(r.driver)||'—')+(r.accommodation?' · 🏠':''));});
    return out.join('\n');
  }
  /* ── 住宿 Accommodation ──────────────────────────────────────────────── */
  function accommodationCard(lang,s,period,ctx){
    var active=(s.members||[]).filter(function(r){return r.accommodation&&r.status!=='stopped';}),rows=sortRows(active,ctx),mov=s.mov||[],moveIn=mov.filter(function(r){return r.action==='dorm_in';}),moveOut=mov.filter(function(r){return r.action==='dorm_out';});
    var local=rows.filter(function(r){return r.accommodationType!=='expat';}).length,expat=rows.length-local;
    var out=[header('🏠',L(lang,'住宿','Accommodation','ស្នាក់នៅ'),period)];
    var head='👥 '+L(lang,'人數','People','ចំនួន')+' '+bold(rows.length)+' · 🏘 '+L(lang,'本地','Local','ក្នុងស្រុក')+' '+bold(local)+' · 🌏 '+L(lang,'外籍','Expat','បរទេស')+' '+bold(expat)+' · 🆕 '+L(lang,'入住','Move-in','ចូល')+' '+bold(moveIn.length)+' · ⛔ '+L(lang,'搬出','Move-out','ចេញ')+' '+bold(moveOut.length);
    if(s.accommodation!==undefined&&Number(s.accommodation)!==rows.length)head+=' · 📑 '+L(lang,'月摘要','Monthly summary','សង្ខេបខែ')+' '+s.accommodation+(Number(s.expat)?' ('+L(lang,'外籍','expat','បរទេស')+' '+s.expat+')':'');
    out.push(head);
    var ds=deptShare(lang,rows,ctx);if(ds)out.push(ds);
    out.push(verify(lang,rows,ctx));
    if(moveIn.length)out.push('🆕 '+bold(L(lang,'入住','Move-in','ចូលស្នាក់នៅ')+' · '+moveIn.length)+'\n'+moveIn.map(function(r){var c=ctx(r);return '🆕 '+mmdd(r.date)+' '+who(c)+(text(r.remark)?' · '+text(r.remark):'');}).join('\n'));
    if(moveOut.length)out.push('⛔ '+bold(L(lang,'搬出','Move-out','ចាកចេញ')+' · '+moveOut.length)+'\n'+moveOut.map(function(r){var c=ctx(r);return '⛔ '+mmdd(r.date)+' '+who(c)+(text(r.remark)?' · '+text(r.remark):'');}).join('\n'));
    out.push('━━━━━━━━━━━━\n📋 '+bold(L(lang,'名單','List','បញ្ជី')+' · '+rows.length));
    if(!rows.length)out.push(L(lang,'沒有資料','No records','គ្មានទិន្នន័យ'));
    rows.forEach(function(r,i){var c=ctx(r);out.push('🟢 '+who(c,i+1)+' · '+(r.accommodationType==='expat'?'🌏 '+L(lang,'外籍','Expat','បរទេស'):'🏘 '+L(lang,'本地','Local','ក្នុងស្រុក'))+(r.transport?' · 🚌':''));});
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
  return {resolve:resolve,format:format,html:html,split:split,delivered:delivered,place:place};
});
