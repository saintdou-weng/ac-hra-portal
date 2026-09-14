/* v69: employee details in welfare notices; no approval workflow. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.HRAWelfareReport=api;})(typeof window!=='undefined'?window:this,function(){
  'use strict';
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
    return {id:eid||(matches[0]?id(matches[0]):''),name:nm||field(['name','employeeName','englishName','nameEn','khmerName','nameKh']),department:dept,section:section,position:field(['position','jobTitle']),joinDate:field(['joinDate','hireDate','dateOfJoining','joiningDate','startDate']),anonymous:!eid&&!nm};
  }
  var words={
    zh:{title:'AC HRA 福利／意見箱摘要',period:'期間',id:'工號',name:'姓名',dept:'部門',group:'組別',join:'入職日',transport:'交通車／住宿',union:'工會費',suggestion:'意見箱',none:'沒有資料',missing:'未提供',anon:'匿名',unionJoin:'入會日',amount:'金額',driver:'司機／車牌',status:'狀態',checked:'檢查人',responsible:'負責人',reply:'處理／回覆',bus:'交通車',room:'住宿',movement:'加入／停止交通及住宿異動',new:'新建',reviewing:'審查中',action:'處理中',closed:'結案',rejected:'不採納',paid:'已付',unpaid:'未付',active:'有效',stopped:'停止',transport_apply:'加入交通',transport_stop:'停止交通',dorm_in:'入住',dorm_out:'搬出'},
    en:{title:'AC HRA Welfare / Suggestion Summary',period:'Period',id:'ID',name:'Name',dept:'Department',group:'Group',join:'Employment join date',transport:'Transport / Accommodation',union:'Union dues',suggestion:'Suggestion box',none:'No records',missing:'Not provided',anon:'Anonymous',unionJoin:'Union join date',amount:'Amount',driver:'Driver / Plate',status:'Status',checked:'Checked by',responsible:'Responsible',reply:'Action / Reply',bus:'Transport',room:'Accommodation',movement:'Transport / Accommodation changes',new:'New',reviewing:'Reviewing',action:'In action',closed:'Closed',rejected:'Rejected',paid:'Paid',unpaid:'Unpaid',active:'Active',stopped:'Stopped',transport_apply:'Join transport',transport_stop:'Stop transport',dorm_in:'Move in',dorm_out:'Move out'},
    km:{title:'AC HRA សុខុមាលភាព / ប្រអប់យោបល់',period:'រយៈពេល',id:'អត្តលេខ',name:'ឈ្មោះ',dept:'ផ្នែក',group:'ក្រុម',join:'ថ្ងៃចូលធ្វើការ',transport:'ដឹកជញ្ជូន / ស្នាក់នៅ',union:'ថ្លៃសហជីព',suggestion:'ប្រអប់យោបល់',none:'គ្មានទិន្នន័យ',missing:'មិនបានផ្តល់',anon:'អនាមិក',unionJoin:'ថ្ងៃចូលសហជីព',amount:'ចំនួនប្រាក់',driver:'អ្នកបើកបរ / ផ្លាកលេខ',status:'ស្ថានភាព',checked:'អ្នកពិនិត្យ',responsible:'អ្នកទទួលខុសត្រូវ',reply:'សកម្មភាព / ចម្លើយ',bus:'ដឹកជញ្ជូន',room:'ស្នាក់នៅ',movement:'ការផ្លាស់ប្តូរដឹកជញ្ជូន / ស្នាក់នៅ',new:'ថ្មី',reviewing:'កំពុងពិនិត្យ',action:'កំពុងអនុវត្ត',closed:'បិទ',rejected:'មិនទទួល',paid:'បានបង់',unpaid:'មិនបានបង់',active:'សកម្ម',stopped:'បញ្ឈប់',transport_apply:'ចូលដឹកជញ្ជូន',transport_stop:'ឈប់ដឹកជញ្ជូន',dorm_in:'ចូលស្នាក់នៅ',dorm_out:'ចាកចេញ'}
  };
  function format(options){
    var o=options||{},w=words[o.lang]||words.zh,s=o.stats,type=o.type||'all',ctx=o.context||function(r){return resolve(r,[]);},out=['📊 '+w.title,w.period+'：'+o.period];
    function value(v){return text(v)||w.missing;}
    function employee(r){var c=ctx(r);if(c.anonymous)return w.anon;return w.group+' '+value(c.section)+'｜'+w.id+' '+value(c.id)+'｜'+w.name+' '+value(c.name)+'\n'+w.dept+' '+value(c.department)+'｜'+w.join+' '+value(c.joinDate);}
    function status(r){return w[r.status]||r.status||w.missing;}
    if(type==='all'||type==='transport'){
      out.push('🚌 '+w.transport+' · '+s.members.length);
      s.members.forEach(function(r,i){out.push('#'+(i+1)+' '+employee(r)+'\n'+[r.transport?w.bus:'',r.accommodation?w.room:''].filter(Boolean).join(' / ')+'｜'+w.driver+' '+value(r.driver)+'｜'+w.status+' '+status(r));});
      if(!s.members.length)out.push(w.none);
      if(s.mov&&s.mov.length){out.push(w.movement);s.mov.forEach(function(r,i){out.push('#'+(i+1)+' '+value(r.date)+' '+(w[r.action]||r.action)+'\n'+employee(r));});}
    }
    if(type==='all'||type==='union'){
      out.push('🤝 '+w.union+' · '+s.union.length+' · USD '+Number(s.unionAmount||0).toFixed(2));
      s.union.forEach(function(r,i){out.push('#'+(i+1)+' '+employee(r)+'\n'+w.unionJoin+' '+value(r.unionJoinDate)+'｜USD '+Number(r.amount||0).toFixed(2)+'｜'+status(r)+(r.remark?'｜'+r.remark:''));});
      if(!s.union.length)out.push(w.none);
    }
    if(type==='all'||type==='suggestion'){
      out.push('💬 '+w.suggestion+' · '+s.sugs.length);
      s.sugs.forEach(function(r,i){out.push('#'+(i+1)+' '+value(r.date)+'｜'+status(r)+'\n'+employee(r)+'\n'+value(r.grievance)+'\n'+w.checked+' '+value(r.checkedBy)+'｜'+w.responsible+' '+value(r.responsible)+(r.actionTaken?'\n'+w.reply+' '+r.actionTaken:''));});
      if(!s.sugs.length)out.push(w.none);
    }
    out.push('🏭 Vantage River Textiles');return out.join('\n\n');
  }
  // Plain text only: never cut HTML markup or an employee away from their details.
  function split(message,limit){
    limit=limit||3400;var chunks=[],chunk='';
    function flush(){if(chunk){chunks.push(chunk);chunk='';}}
    text(message).split('\n\n').forEach(function(block){
      if(block.length>limit){flush();while(block.length>limit){var n=block.lastIndexOf('\n',limit);if(n<limit/2)n=limit;if(/[\uD800-\uDBFF]/.test(block[n-1]))n--;chunks.push(block.slice(0,n));block=block.slice(n).replace(/^\n/,'');}chunk=block;}
      else if((chunk?chunk.length+2:0)+block.length>limit){flush();chunk=block;}
      else chunk+=(chunk?'\n\n':'')+block;
    });flush();return chunks;
  }
  function delivered(result){var d=result&&result.data||result||{}, ids=[d.messageId,d.message_id,d.result&&d.result.message_id].concat(d.messageIds||[]);return ids.filter(function(x){return typeof x==='number'?x>0:/^\d+$/.test(String(x||''));});}
  return {resolve:resolve,format:format,split:split,delivered:delivered};
});
