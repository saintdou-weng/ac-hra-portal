/* Calendar dates and holiday notices. v69, 2026-09-13.
 * Pure helpers shared by calendar display, notice preview and approval payload.
 * Employee reporting fields do not belong in this model.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HRACalendarModel = api;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  var offTypes = new Set(['legal','regular','substitute','annual','makeup','halfpay','vrt','stopwork']);
  function date(value) {
    var s = String(value || ''), m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    var d = new Date(+m[1], +m[2]-1, +m[3]);
    return iso(d) === s ? d : null;
  }
  function iso(d) { return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  function add(s, n) { var d=date(s); if(!d)return ''; d.setDate(d.getDate()+n); return iso(d); }
  function days(start, end) {
    var a=date(start), b=date(end || start), out=[];
    if(!a || !b || a>b)return out;
    for(var d=new Date(a); d<=b; d.setDate(d.getDate()+1))out.push(iso(d));
    return out;
  }
  function recordDays(r) { return days(r.date,r.enddate || r.date); }
  function holidayDates(rows) {
    var off=new Set(), work=new Set();
    (rows||[]).forEach(function(r){
      if(offTypes.has(r.type))recordDays(r).forEach(function(d){off.add(d);});
      if(r.type==='workday')recordDays(r).forEach(function(d){work.add(d);});
    });
    work.forEach(function(d){off.delete(d);});
    return off;
  }
  function ranges(values) {
    var out=[];
    Array.from(new Set(values)).sort().forEach(function(d){
      var prev=out[out.length-1];
      if(prev && add(prev.end,1)===d){prev.end=d;prev.days++;}
      else out.push({start:d,end:d,days:1});
    });
    return out;
  }
  function span(r) { return r.start===r.end ? r.start : r.start+'～'+r.end; }
  function validate(r) {
    if(!date(r.date))return 'invalidStart';
    if(r.enddate && (!date(r.enddate) || r.enddate<r.date))return 'invalidEnd';
    if(r.refdate && (!date(r.refdate) || r.refdate===r.date))return 'invalidReference';
    if(r.type==='substitute' && (!r.refdate || !String(r.note||'').trim()))return 'missingSwap';
    if(r.type==='substitute' && r.enddate && r.enddate!==r.date)return 'singleSwap';
    return '';
  }
  // Narrow repair of the exact confirmed corrupted record, not a general reset.
  // Preserve record IDs, other years, other holidays and all approval history.
  function repairKnownSwap(db, now) {
    var rows=db && db['2026']; if(!Array.isArray(rows))return [];
    var r=rows.find(function(x){return x.id==='26-12' && x.date==='2026-10-09' && x.enddate==='2026-10-29' && x.refdate==='2026-10-29' && /10\/9.*休假/.test(x.note||'') && /10\/29.*正常上班/.test(x.note||'');});
    if(!r)return [];
    var pair=rows.find(function(x){return x.date==='2026-10-29' && x.type==='workday' && /10\/9|Oct 9/i.test(x.note||'');});
    if(!pair)return [];
    var before=[JSON.parse(JSON.stringify(r)),JSON.parse(JSON.stringify(pair))], swapId='SWAP-26-12-20261009-20261029';
    Object.assign(r,{enddate:'',days:1,type:'substitute',swapId:swapId,swapRole:'normal_to_holiday',updatedAt:now,repairVersion:'calendar-v69'});
    Object.assign(pair,{refdate:'2026-10-09',swapId:swapId,swapRole:'original_to_workday',updatedAt:now,repairVersion:'calendar-v69'});
    return before.map(function(b,i){return {before:b,after:JSON.parse(JSON.stringify(i?pair:r))};});
  }
  function plan(rows, start, end) {
    var all=rows||[], off=holidayDates(all), inRange=function(d){return d>=start && d<=end;}, selected=all.filter(function(r){return recordDays(r).some(inRange);});
    var swaps=[], seen=new Set();
    selected.forEach(function(r){
      if(r.type!=='substitute' || !r.refdate)return;
      var key=r.refdate+'|'+r.date;
      if(!seen.has(key)){seen.add(key);swaps.push({holidayDate:r.date,workDate:r.refdate,nameZh:r.zh||'',nameEn:r.en||'',nameKm:r.km||''});}
    });
    var leaveDates=selected.filter(function(r){return r.type==='annual';}).flatMap(recordDays).filter(function(d){return inRange(d)&&off.has(d);});
    var legal=selected.filter(function(r){return r.type==='legal';}).map(function(r){return {start:r.date,end:r.enddate||r.date,nameZh:r.zh||'',nameEn:r.en||'',nameKm:r.km||''};});
    var work=selected.filter(function(r){return r.type==='workday';}), resume=work.filter(function(r){return /恢復上班|復工|resume work/i.test([r.zh,r.en].join(' '));}).map(function(r){return r.date;});
    return {schema:'calendar-plan-v1',start:start,end:end,closures:ranges(Array.from(off).filter(inRange)),swaps:swaps,leave:ranges(leaveDates),legal:legal,resumeDates:Array.from(new Set(resume)).sort(),workDates:Array.from(new Set(work.flatMap(recordDays))).sort(),holidayDays:Array.from(off).filter(inRange).length};
  }
  var words={
    zh:{title:'VRT 假期安排',period:'月份／期間',closure:'放假期間',days:'天',swap:'調假',holiday:'休假',work:'正常上班',legal:'節日',leave:'員工年假／事假',resume:'恢復上班',none:'此期間沒有休假安排',leaveNote:'年假或事假由人事依員工申請確認。'},
    en:{title:'VRT Holiday Arrangement',period:'Period',closure:'Factory closure',days:'days',swap:'Holiday swap',holiday:'holiday',work:'normal work',legal:'Holiday',leave:'Employee annual / personal leave',resume:'Resume work',none:'No holiday arrangement in this period',leaveNote:'HR confirms annual or personal leave from individual applications.'},
    km:{title:'VRT ការរៀបចំថ្ងៃឈប់សម្រាក',period:'រយៈពេល',closure:'រោងចក្រឈប់សម្រាក',days:'ថ្ងៃ',swap:'ប្តូរថ្ងៃឈប់',holiday:'ឈប់សម្រាក',work:'ធ្វើការធម្មតា',legal:'បុណ្យ',leave:'ច្បាប់ប្រចាំឆ្នាំ / ច្បាប់ផ្ទាល់ខ្លួន',resume:'ចូលធ្វើការវិញ',none:'គ្មានការឈប់សម្រាកក្នុងរយៈពេលនេះ',leaveNote:'HR បញ្ជាក់ប្រភេទច្បាប់តាមពាក្យសុំរបស់បុគ្គលិក។'}
  };
  function format(p, code) {
    function one(c){
      var w=words[c]||words.zh, out=['📅 '+w.title, w.period+'：'+(p.start.slice(0,7)===p.end.slice(0,7)?p.start.slice(0,7):p.start+'～'+p.end)];
      if(!p.closures.length)out.push(w.none);
      p.closures.forEach(function(r){out.push('🏖 '+w.closure+'：'+span(r)+'（'+r.days+' '+w.days+'）');});
      p.swaps.forEach(function(r){out.push('🔄 '+w.swap+'：'+r.holidayDate+' '+w.holiday+' ↔ '+r.workDate+' '+w.work);});
      p.legal.forEach(function(r){out.push('• '+span(r)+' '+(c==='zh'?r.nameZh||r.nameEn:c==='km'?r.nameKm||r.nameEn||r.nameZh:r.nameEn||r.nameZh));});
      p.leave.forEach(function(r){out.push('📝 '+w.leave+'：'+span(r));});
      if(p.resumeDates.length)out.push('🟢 '+w.resume+'：'+p.resumeDates.join('、'));
      var other=p.workDates.filter(function(d){return !p.resumeDates.includes(d) && !p.swaps.some(function(s){return s.workDate===d;});});
      if(other.length)out.push('🟢 '+w.work+'：'+other.join('、'));
      if(p.leave.length)out.push(w.leaveNote);
      return out.join('\n');
    }
    return code==='both'?one('zh')+'\n\n'+one('en'):one(code||'zh');
  }
  return {date:date,iso:iso,add:add,days:days,recordDays:recordDays,holidayDates:holidayDates,ranges:ranges,validate:validate,repairKnownSwap:repairKnownSwap,plan:plan,format:format,offTypes:offTypes};
});
