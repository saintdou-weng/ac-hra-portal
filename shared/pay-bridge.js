/*
 * AC HRA PAY -> Attendance automatic hours bridge
 *
 * Attendance never asks the user to import a Total Hours workbook or a
 * Payroll Projection. This background bridge reads the existing HRA Pay
 * projections (local cache first, then HRA Pay GAS) and exposes derived hours
 * to Attendance.
 *
 * Priority:
 *   1. Payroll total/normal/OT hours;
 *   2. Payroll work-days × 8 when the source has no hour fields;
 *   3. Meal Fee meal-days × 8 when Payroll has no usable hours.
 * Advance is read only as a source update signal and never counted as hours.
 * For day/week views, a monthly HRA Pay total is allocated by Attendance's
 * daily attendance count. No new file format or manual export is required.
 */
(function(root){
  'use strict';

  const STORE_KEY='ac_hra_pay_bridge_v2';
  const HRA_PAY_GAS_DEFAULT='https://script.google.com/macros/s/AKfycbwmmRduvOe5RdnR_iALwEIi_6lQaTq4SXH88jmoIjiHwTsTrW5qnlPTr8PSmOT7C2rdGg/exec';
  const state={rows:[],ready:false,promise:null};

  function keyOf(v){return String(v==null?'':v).toLowerCase().replace(/[\s_\-\/().:]+/g,'').replace(/[^a-z0-9\u3400-\u9fff]/g,'')}
  function num(v){
    if(v===null||v===undefined||v==='')return null;
    if(typeof v==='number')return isFinite(v)?Math.round(v*100)/100:null;
    const s=String(v).trim();if(!s||/^(—|-|n\/a|na|null|undefined)$/i.test(s))return null;
    const n=Number(s.replace(/[$,៛\s]/g,''));
    if(isFinite(n))return Math.round(n*100)/100;
    const m=s.replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);return m?Math.round(Number(m[0])*100)/100:null;
  }
  function val(o,names){
    if(!o||typeof o!=='object')return null;
    const map={};Object.keys(o).forEach(k=>{map[keyOf(k)]=o[k]});
    for(const n of names){const k=keyOf(n);if(Object.prototype.hasOwnProperty.call(map,k))return map[k]}
    return null;
  }
  function str(o,names){const v=val(o,names);return v==null?'':String(v).trim()}
  function round(v){return Math.round(Number(v||0)*100)/100}
  function month(v){
    if(v instanceof Date&&!isNaN(v))return `${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,'0')}`;
    const s=String(v==null?'':v).trim();if(!s)return '';
    let m=s.match(/(20\d{2})\D{0,3}(0?[1-9]|1[0-2])(?:\D|$)/);if(m)return `${m[1]}-${String(+m[2]).padStart(2,'0')}`;
    m=s.match(/^(0?[1-9]|1[0-2])\D+(20\d{2})$/);if(m)return `${m[2]}-${String(+m[1]).padStart(2,'0')}`;
    m=s.match(/^(20\d{2})(0[1-9]|1[0-2])$/);if(m)return `${s.slice(0,4)}-${s.slice(4)}`;
    return '';
  }
  function dateKey(v){
    if(v instanceof Date&&!isNaN(v))return `${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,'0')}-${String(v.getDate()).padStart(2,'0')}`;
    const s=String(v==null?'':v).trim();if(!s)return '';
    let m=s.match(/(20\d{2})[\/\-.](0?[1-9]|1[0-2])[\/\-.](0?[1-9]|[12]\d|3[01])/);
    if(m)return `${m[1]}-${String(+m[2]).padStart(2,'0')}-${String(+m[3]).padStart(2,'0')}`;
    m=s.match(/^(0?[1-9]|1[0-2])[\/\-.](0?[1-9]|[12]\d|3[01])[\/\-.](\d{2}|\d{4})$/);
    if(m){let y=+m[3];if(y<100)y+=y>=70?1900:2000;return `${y}-${String(+m[1]).padStart(2,'0')}-${String(+m[2]).padStart(2,'0')}`}
    return '';
  }
  function kindOf(o,fallback){
    const k=str(o,['kind','module','type','category']);
    if(/meal|餐|food/i.test(k))return 'meal';
    if(/advance|預支|預付/i.test(k))return 'advance';
    if(/payroll|salary|薪資|正式/i.test(k))return 'payroll';
    return fallback||'payroll';
  }

  function normalize(o,kind,period,index,source){
    if(!o||typeof o!=='object')return null;
    const k=kindOf(o,kind);
    const rawDate=dateKey(val(o,['date','workDate','workday','attendanceDate','出勤日期','日期','日']));
    const ym=month(str(o,['period','periodKey','payMonth','month','月份','薪資月份'])||period)||month(rawDate);
    if(!ym)return null;
    const id=str(o,['employeeId','empId','employeeID','id','工號','工号','ID']);
    const mealBatch=str(o,['mealBatch','batch','batchNo','批次']);
    const dept=str(o,['dept','department','division','section','部門','部门','分區','分区'])||'';
    const sect=str(o,['sect','group','line','組別','組别','組','線別','lineName'])||'';
    const position=str(o,['position','job','title','職位','职位','職稱','职称'])||'';
    const normalHours=num(val(o,['normalHours','regularHours','workHours','ordinaryHours','平日工時','正常工時','工作時數']));
    const otHours=num(val(o,['otHours','overtimeHours','OTHours','加班工時','加班時數']));
    const totalHours=num(val(o,['totalHours','hoursWorked','attendanceHours','工時','總工時','总工时','hours']));
    const workDays=num(val(o,['workDays','workedDays','daysWorked','工作天數','工作天']));
    let mealDays=num(val(o,['mealDays','mealDayCount','mealDaysCount','用餐天數','用餐日數','餐日']));
    const rawDays=Array.isArray(o.days)?o.days:[];
    const dayHours={};
    rawDays.forEach(d=>{
      const dk=dateKey(val(d,['date','day','workDate','日期']))||dateKey(d);
      const present=num(val(d,['present','出勤','att','count','人數']));
      if(dk&&present!=null&&present>0)dayHours[dk]=round((dayHours[dk]||0)+present*8);
    });
    if(mealDays==null&&rawDays.length)mealDays=Object.keys(dayHours).length;
    const mealFee=num(val(o,['mealFee','mealAmount','mealTotal','餐費','餐费','伙食費','伙食费']));
    const mealRiel=num(val(o,['mealRiel','riel','餐費瑞爾','餐费瑞尔']));
    const normalMeal=num(val(o,['normalMealFee','weekdayMealFee','regularMealFee','normalMeal','平日伙食費','平日餐費','正常餐費']));
    const otMeal=num(val(o,['overtimeMealFee','otMealFee','otMeal','加班伙食費','加班餐費','加班餐']));
    const advance=num(val(o,['advanceAmount','advance','prepaidSalary','預付薪資','預支薪資','預支','預付']));
    const netPay=num(val(o,['netPay','totalSalary','salary','薪資','實領','实领']));
    const identity=id||`${dept}|${sect}|${position}|${index}`;
    const batchKey=k==='meal'&&mealBatch?`|B${mealBatch}`:'';
    return{
      _key:`${k}|${ym}|${identity}${batchKey}`,
      kind:k,period:ym,date:rawDate,employeeId:id,name:str(o,['name','nameLat','nameKh','姓名','名字']),dept,sect,position,mealBatch,
      normalHours,otHours,totalHours,workDays,advance,netPay,mealFee,mealDays,mealRiel,normalMeal,otMeal,dayHours,source:source||'',
      explicitTotalHours:totalHours!=null,explicitNormalHours:normalHours!=null,explicitOtHours:otHours!=null
    };
  }
  function merge(a,b){
    const out=Object.assign({},a);Object.keys(b||{}).forEach(k=>{
      if(k==='_key'||b[k]===null||b[k]===undefined||b[k]==='')return;
      if(k==='dayHours')out[k]=Object.assign({},out[k]||{},b[k]||{});else out[k]=b[k];
    });return out;
  }
  function load(){
    if(state.rows.length)return;
    try{
      // Do not revive the old manual comparison cache. Only this automatic
      // bridge cache and the current HRA Pay projection stores are trusted.
      const raw=localStorage.getItem(STORE_KEY)||'[]';
      const rows=JSON.parse(raw);
      state.rows=(Array.isArray(rows)?rows:[]).map(r=>({...r,
        explicitTotalHours:r.explicitTotalHours===true||(r.explicitTotalHours==null&&r.totalHours!=null),
        explicitNormalHours:r.explicitNormalHours===true||(r.explicitNormalHours==null&&r.normalHours!=null),
        explicitOtHours:r.explicitOtHours===true||(r.explicitOtHours==null&&r.otHours!=null),
        dayHours:r.dayHours||{}
      }));
    }catch(e){state.rows=[]}
  }
  function save(){try{localStorage.setItem(STORE_KEY,JSON.stringify(state.rows))}catch(e){}}
  function upsert(rows){
    load();const map=new Map(state.rows.map(r=>[r._key,r]));
    const incoming=(rows||[]).filter(Boolean);
    const batchedMealIds=new Set(incoming.filter(r=>r.kind==='meal'&&r.mealBatch).map(r=>`${r.period}|${r.employeeId}`));
    [...map.values()].forEach(r=>{if(r.kind==='meal'&&!r.mealBatch&&batchedMealIds.has(`${r.period}|${r.employeeId}`))map.delete(r._key)});
    incoming.forEach(r=>map.set(r._key,map.has(r._key)?merge(map.get(r._key),r):r));
    state.rows=[...map.values()].sort((a,b)=>String(a.period).localeCompare(String(b.period))||String(a.kind).localeCompare(String(b.kind))||String(a._key).localeCompare(String(b._key)));
    save();
  }
  function projectionRows(p,kind,source){
    if(!p||typeof p!=='object')return[];const out=[];
    const add=(arr,period,extra)=>{(Array.isArray(arr)?arr:[]).forEach((r,i)=>{const x=normalize(Object.assign({},extra||{},r),kind,period,i,source);if(x)out.push(x)})};
    if(kind==='meal'&&Array.isArray(p.batches))p.batches.forEach(b=>add(b&&b.rows,b&&b.period||p.period,{mealBatch:b&&(b.mealBatch||b.batch||'')}));
    else add(p.rows||p.records||[],p.period||p.periodKey);
    return out;
  }
  function localProjections(){
    const out=[];
    [['hrpay:result:payroll','payroll'],['hrpay:result:advance','advance'],['hrpay:result:meal','meal']].forEach(([key,kind])=>{
      try{const p=JSON.parse(localStorage.getItem(key)||'null');out.push(...projectionRows(p,kind,'HRA Pay local projection'))}catch(e){}
    });
    return out;
  }
  function unwrapStore(d){
    const a=d&&d.data;
    if(a&&a.items)return a;
    if(a&&a.data&&a.data.items)return a.data;
    return null;
  }
  function cloudRows(d,kind,source){
    const data=d&&d.data||{},out=[];
    const store=unwrapStore(d);
    if(store){Object.values(store.items||{}).forEach(p=>out.push(...projectionRows(p,kind,source)));return out}
    if(kind==='meal'&&Array.isArray(data.batches))data.batches.forEach(b=>out.push(...projectionRows({period:b.period||data.period,batches:[b]},'meal',source)));
    if(kind==='payroll'&&Array.isArray(data.payroll))out.push(...projectionRows({period:data.period,rows:data.payroll},'payroll',source));
    if(kind==='advance'&&Array.isArray(data.advance))out.push(...projectionRows({period:data.period,rows:data.advance},'advance',source));
    return out;
  }
  async function loadCloudRows(){
    let url=HRA_PAY_GAS_DEFAULT;try{url=localStorage.getItem('hrpay_gas_url')||url}catch(e){}
    if(!url)return[];
    const jobs=[['payroll','payroll'],['advance','advance'],['meal','meal']];
    const results=await Promise.all(jobs.map(async([module,kind])=>{
      try{const r=await fetch(url+'?action=pullProjection&module='+encodeURIComponent(module),{redirect:'follow'});return cloudRows(await r.json(),kind,'HRA Pay cloud projection')}catch(e){return[]}
    }));
    const out=results.flat();
    if(out.length)return out;
    // Compatibility with older HRA Pay deployments.
    const old=await Promise.all([['hrpay_payroll','payroll'],['hrpay_meal','meal']].map(async([tool,kind])=>{
      try{const r=await fetch(url+'?action=pull&tool='+encodeURIComponent(tool),{redirect:'follow'});return cloudRows(await r.json(),kind,'HRA Pay cloud')}catch(e){return[]}
    }));
    return old.flat();
  }

  function hourValue(r){
    if(!r)return null;
    if(r.explicitTotalHours&&r.totalHours!=null)return{value:round(r.totalHours),source:'payroll'};
    const parts=[];
    if(r.explicitNormalHours&&r.normalHours!=null)parts.push(Number(r.normalHours)||0);
    if(r.explicitOtHours&&r.otHours!=null)parts.push(Number(r.otHours)||0);
    if(parts.length)return{value:round(parts.reduce((s,v)=>s+v,0)),source:'payroll'};
    // Payroll projections carry workDays even when hours are missing; zero
    // therefore cannot prove that a work-day source was available.
    if(r.kind==='payroll'&&r.workDays!=null&&Number(r.workDays)>0)return{value:round(Number(r.workDays)*8),source:'payroll'};
    if(r.kind==='meal'&&r.mealDays!=null&&Number(r.mealDays)>0)return{value:round(Number(r.mealDays)*8),source:'meal'};
    return null;
  }
  function rowsForMonth(ym){
    load();
    const pay=state.rows.filter(r=>r.kind==='payroll'&&r.period===ym),payHours=pay.map(r=>({r,h:hourValue(r)})).filter(x=>x.h);
    if(payHours.length)return{source:'payroll',items:payHours};
    const meal=state.rows.filter(r=>r.kind==='meal'&&r.period===ym),mealHours=meal.map(r=>({r,h:hourValue(r)})).filter(x=>x.h);
    if(mealHours.length)return{source:'meal',items:mealHours};
    return{source:'',items:[]};
  }
  function monthSummary(ym){
    const chosen=rowsForMonth(ym),groups={},dayHours={};let total=0,rows=0;
    chosen.items.forEach(({r,h})=>{
      total+=h.value;rows++;
      const key=[r.dept||'—',r.sect||'',r.position||''].join('¦');
      const g=groups[key]||(groups[key]={dept:r.dept||'—',sect:r.sect||'',position:r.position||'',hours:0,rows:0});
      g.hours+=h.value;g.rows++;
      Object.entries(r.dayHours||{}).forEach(([d,v])=>{dayHours[d]=(dayHours[d]||0)+Number(v||0)});
    });
    return{period:ym,known:chosen.items.length>0,source:chosen.source,sourceRows:chosen.items.length,total:chosen.items.length?round(total):null,rows,groups:Object.values(groups).map(g=>({...g,hours:round(g.hours)})),dayHours};
  }
  function attendanceRowsForDate(date){
    if(typeof root.rowsForDate!=='function')return[];
    const rows=root.rowsForDate(date)||[];
    const detail=rows.filter(r=>!r.isGrand&&!r.isSubtotal&&Number(r.att||0)>0);
    if(detail.length)return detail;
    return rows.filter(r=>r.isSubtotal&&!r.isGrand&&Number(r.att||0)>0);
  }
  function attendanceCount(date){
    const g=typeof root.grandForDate==='function'?root.grandForDate(date):null;
    if(g&&Number(g.att)>0)return Number(g.att);
    return attendanceRowsForDate(date).reduce((s,r)=>s+(Number(r.att)||0),0);
  }
  function dateAllocation(date,summary){
    const direct=Object.entries(summary.dayHours||{}).filter(([d])=>d===date);
    if(direct.length)return{known:true,total:round(direct.reduce((s,[,v])=>s+Number(v||0),0)),groups:[]};
    const dates=typeof root.periodDates==='function'?root.periodDates('month',summary.period):[];
    const counts=dates.map(d=>({d,count:attendanceCount(d)}));
    const base=counts.reduce((s,x)=>s+x.count,0),today=counts.find(x=>x.d===date)?.count||0;
    if(!base||!today)return{known:false,total:null,groups:[]};
    const ratio=today/base,rows=attendanceRowsForDate(date);
    const byDept={};rows.forEach(r=>{const key=[r.dept||'—',r.sect||''].join('¦');byDept[key]=(byDept[key]||0)+(Number(r.att)||0)});
    const deptBase={};dates.forEach(d=>attendanceRowsForDate(d).forEach(r=>{const key=[r.dept||'—',r.sect||''].join('¦');deptBase[key]=(deptBase[key]||0)+(Number(r.att)||0)}));
    const groups=summary.groups.map(g=>{
      const exact=[g.dept||'—',g.sect||''].join('¦');
      const c=byDept[exact]||byDept[g.dept||'—']||today;
      const b=deptBase[exact]||deptBase[g.dept||'—']||base;
      return{dept:g.dept,sect:g.sect,position:g.position,hours:round(g.hours*(c/b)),rows:g.rows};
    });
    return{known:true,total:round((summary.total||0)*ratio),groups};
  }
  function combineDaily(dates){
    const groups={},all=dates||[];let total=0,known=false,rows=0,source='';
    all.forEach(d=>{
      const s=monthSummary(String(d).slice(0,7));if(!s.known)return;
      const x=dateAllocation(d,s);if(!x.known)return;
      known=true;total+=x.total||0;rows+=s.rows;source=source||s.source;
      (x.groups.length?x.groups:[{dept:'—',sect:'',position:'',hours:x.total||0,rows:s.rows}]).forEach(g=>{
        const k=[g.dept||'—',g.sect||'',g.position||''].join('¦');
        const z=groups[k]||(groups[k]={dept:g.dept||'—',sect:g.sect||'',position:g.position||'',hours:0,rows:0});
        z.hours+=g.hours||0;z.rows+=g.rows||0;
      });
    });
    return{period:all[0]||'',known,total:known?round(total):null,source,rows,groups:Object.values(groups).map(g=>({...g,hours:round(g.hours)}))};
  }
  function monthsForYear(year){
    load();const set=new Set(state.rows.map(r=>r.period).filter(m=>String(m).startsWith(String(year))));
    if(typeof root.allMonths==='function')root.allMonths().filter(m=>String(m).startsWith(String(year))).forEach(m=>set.add(m));
    return[...set].sort();
  }
  function projectionHoursForPeriod(grain,key){
    if(!key)return{period:key,known:false,total:null,source:'',rows:0,groups:[]};
    if(grain==='month')return monthSummary(key);
    if(grain==='day')return combineDaily([key]);
    if(grain==='week'){
      const dates=typeof root.periodDates==='function'?root.periodDates('week',key):[];
      return combineDaily(dates);
    }
    const months=monthsForYear(key),all=months.map(monthSummary).filter(x=>x.known),groups={};let total=0,rows=0,source='';
    all.forEach(x=>{total+=x.total||0;rows+=x.rows;source=source||x.source;x.groups.forEach(g=>{const k=[g.dept||'—',g.sect||'',g.position||''].join('¦');const z=groups[k]||(groups[k]={dept:g.dept||'—',sect:g.sect||'',position:g.position||'',hours:0,rows:0});z.hours+=g.hours;z.rows+=g.rows})});
    return{period:key,known:all.length>0,total:all.length?round(total):null,source,rows,groups:Object.values(groups).map(g=>({...g,hours:round(g.hours)}))};
  }
  function mealForPeriod(grain,key){
    load();
    if(grain==='month'){
      const rows=state.rows.filter(r=>r.kind==='meal'&&r.period===key),ids=new Set(rows.map(r=>r.employeeId).filter(Boolean));
      return{period:key,known:rows.length>0,rows:rows.length,people:ids.size,days:sum(rows,'mealDays'),fee:sum(rows,'mealFee'),riel:sum(rows,'mealRiel')};
    }
    return{period:key,known:false,rows:0,people:0,days:null,fee:null,riel:null};
  }
  function sum(rows,k){let ok=false,total=0;(rows||[]).forEach(r=>{const v=num(r[k]);if(v!=null){ok=true;total+=v}});return ok?round(total):null}
  function hasHours(){return state.ready&&state.rows.some(r=>hourValue(r)!=null)}
  function notify(){
    const detail={available:hasHours(),ready:state.ready};
    try{
      if(typeof root.payBridgeOnUpdated==='function')root.payBridgeOnUpdated(detail.available);
      root.dispatchEvent(new CustomEvent('ac-hra-pay-updated',{detail}));
    }catch(e){}
  }
  async function autoSync(){
    if(state.promise)return state.promise;
    state.promise=(async()=>{
      load();
      const local=localProjections();if(local.length)upsert(local);
      try{const cloud=await loadCloudRows();if(cloud.length)upsert(cloud)}catch(e){console.warn('[pay-bridge] automatic HRA Pay read failed',e)}
      state.ready=true;notify();return state.rows;
    })().finally(()=>{state.promise=null});
    return state.promise;
  }
  function resetAndSync(){state.ready=false;return autoSync()}

  // Silent compatibility aliases for older cached HTML. The new Attendance
  // page has no visible HRA Pay import/export/compare controls.
  root.payBridgeAutoSync=autoSync;
  root.payBridgeLoadLocal=autoSync;
  root.payBridgeLoad=autoSync;
  root.payBridgeRefresh=resetAndSync;
  root.payBridgeHoursForPeriod=projectionHoursForPeriod;
  root.payBridgeMealForPeriod=mealForPeriod;
  root.payBridgeHasHours=hasHours;
  root.payBridgeReady=()=>state.ready;
  root.addEventListener('storage',e=>{if(/^hrpay:result:/.test(e.key||'')){state.ready=false;autoSync()}});
})(window);
