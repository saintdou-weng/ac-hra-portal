/*
 * AC HRA monthly bridge
 *
 * This is intentionally a monthly comparison layer. It reads the
 * projections written by AC-HRA-PAY when both pages share the same origin,
 * and it also accepts a small, generic XLSX/JSON export. Missing fields stay
 * null and are shown as "—"; the bridge never invents hours or money.
 */
(function(root){
  'use strict';
  const STORE_KEY='ac_hra_pay_bridge_v1';
  const state={rows:[],pending:[],loaded:false};

  function el(id){return document.getElementById(id)}
  function T3(zh,en,km){return typeof root.T==='function'?root.T(zh,en,km):zh}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
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
  function month(v){
    if(v instanceof Date&&!isNaN(v))return `${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,'0')}`;
    const s=String(v==null?'':v).trim();if(!s)return '';
    let m=s.match(/(20\d{2})\D{0,3}(0?[1-9]|1[0-2])(?:\D|$)/);if(m)return `${m[1]}-${String(+m[2]).padStart(2,'0')}`;
    m=s.match(/^(0?[1-9]|1[0-2])\D+(20\d{2})$/);if(m)return `${m[2]}-${String(+m[1]).padStart(2,'0')}`;
    m=s.match(/^(20\d{2})(0[1-9]|1[0-2])$/);if(m)return `${s.slice(0,4)}-${s.slice(4)}`;
    return '';
  }
  function kindOf(o,fallback){
    const k=str(o,['kind','module','type','category']);
    if(/meal|餐|food/i.test(k))return 'meal';
    if(/advance|預支|預付/i.test(k))return 'advance';
    if(/payroll|salary|薪資|正式/i.test(k))return 'payroll';
    if(/att|attendance|考勤/i.test(k))return 'attendance';
    return fallback||'payroll';
  }
  function normalize(o,kind,period,index,source){
    if(!o||typeof o!=='object')return null;
    const k=kindOf(o,kind), ym=month(str(o,['period','periodKey','payMonth','month','月份','薪資月份'])||period);
    if(!ym)return null;
    const id=str(o,['employeeId','empId','employeeID','id','工號','工号','ID']);
    const dept=str(o,['dept','department','division','section','部門','部门','分區','分区'])||'';
    const sect=str(o,['sect','group','line','組別','組别','組','線別','lineName'])||'';
    const position=str(o,['position','job','title','職位','职位','職稱','职称'])||'';
    let normalHours=num(val(o,['normalHours','regularHours','workHours','ordinaryHours','平日工時','正常工時','工作時數']));
    let otHours=num(val(o,['otHours','overtimeHours','OTHours','加班工時','加班時數']));
    let totalHours=num(val(o,['totalHours','hoursWorked','attendanceHours','工時','總工時','总工时','hours']));
    if(totalHours==null&&normalHours!=null&&otHours!=null)totalHours=Math.round((normalHours+otHours)*100)/100;
    const mealFee=num(val(o,['mealFee','mealAmount','mealTotal','餐費','餐费','伙食費','伙食费']));
    let normalMeal=num(val(o,['normalMealFee','weekdayMealFee','regularMealFee','normalMeal','平日伙食費','平日餐費','正常餐費']));
    let otMeal=num(val(o,['overtimeMealFee','otMealFee','otMeal','加班伙食費','加班餐費','加班餐']));
    const advance=num(val(o,['advanceAmount','advance','prepaidSalary','預付薪資','預支薪資','預支','預付']));
    const netPay=num(val(o,['netPay','totalSalary','salary','薪資','實領','实领']));
    const workDays=num(val(o,['workDays','days','工作天數','工作天']));
    if(mealFee!=null&&normalMeal==null&&otMeal==null){normalMeal=null;otMeal=null}
    const identity=id||`${dept}|${sect}|${position}|${index}`;
    return{_key:`${k}|${ym}|${identity}`,kind:k,period:ym,employeeId:id,name:str(o,['name','nameLat','nameKh','姓名','名字']),dept,sect,position,
      normalHours,otHours,totalHours,workDays,advance,netPay,mealFee,normalMeal,otMeal,source:source||''};
  }
  function merge(a,b){
    const out=Object.assign({},a);Object.keys(b||{}).forEach(k=>{
      if(k==='_key'||b[k]===null||b[k]===undefined||b[k]==='')return;
      out[k]=b[k];
    });return out;
  }
  function save(){try{localStorage.setItem(STORE_KEY,JSON.stringify(state.rows))}catch(e){}}
  function load(){
    if(state.loaded)return;
    state.loaded=true;
    try{const x=JSON.parse(localStorage.getItem(STORE_KEY)||'[]');state.rows=Array.isArray(x)?x:[]}catch(e){state.rows=[]}
  }
  function upsert(rows){
    load();const map=new Map(state.rows.map(r=>[r._key,r]));
    (rows||[]).filter(Boolean).forEach(r=>map.set(r._key,map.has(r._key)?merge(map.get(r._key),r):r));
    state.rows=[...map.values()].sort((a,b)=>a.period.localeCompare(b.period)||a.kind.localeCompare(b.kind)||a._key.localeCompare(b._key));save();
  }
  function projectionRows(p,kind,source){
    if(!p||typeof p!=='object')return[];const out=[];
    const add=(arr,period)=>{(Array.isArray(arr)?arr:[]).forEach((r,i)=>{const x=normalize(r,kind,period,i,source);if(x)out.push(x)})};
    if(kind==='meal'&&Array.isArray(p.batches))p.batches.forEach(b=>add(b.rows||[],b.period||p.period));
    else add(p.rows||p.records||[],p.period||p.periodKey);
    return out;
  }
  function localProjections(){
    const out=[];
    [['hrpay:result:payroll','payroll'],['hrpay:result:advance','advance'],['hrpay:result:meal','meal']].forEach(([key,kind])=>{
      try{const p=JSON.parse(localStorage.getItem(key)||'null');out.push(...projectionRows(p,kind,'HRA Pay Projection'))}catch(e){}
    });
    return out;
  }
  function collectObject(o,fallback,period,source,out,depth){
    if(depth>4||o==null)return;
    if(Array.isArray(o)){o.forEach(x=>collectObject(x,fallback,period,source,out,depth+1));return}
    if(typeof o!=='object')return;
    const k=kindOf(o,fallback),p=month(str(o,['period','periodKey','payMonth','month'])||period)||period;
    if(Array.isArray(o.batches)){o.batches.forEach(b=>collectObject(b,'meal',b.period||p,source,out,depth+1));return}
    const arr=o.rows||o.records;
    if(Array.isArray(arr)){arr.forEach((r,i)=>{const x=normalize(r,k,p,i,source);if(x)out.push(x)});return}
    const x=normalize(o,k,p,0,source);if(x)out.push(x);
  }
  async function importFile(file){
    const out=[];const name=file.name||'file';
    if(/\.json$/i.test(name)){
      const o=JSON.parse(await file.text());collectObject(o,/meal|餐/i.test(name)?'meal':/advance|預支|預付/i.test(name)?'advance':'payroll','',name,out,0);
    }else{
      if(typeof XLSX==='undefined')throw new Error('XLSX library unavailable');
      const wb=XLSX.read(new Uint8Array(await file.arrayBuffer()),{type:'array',cellDates:true,raw:true});
      const fallback=/meal|餐|food/i.test(name)?'meal':/advance|預支|預付/i.test(name)?'advance':'payroll';
      for(const sn of wb.SheetNames){
        const rs=XLSX.utils.sheet_to_json(wb.Sheets[sn],{defval:null,raw:true});
        rs.forEach((r,i)=>{const x=normalize(r,fallback,month(name)||'',i,`${name} / ${sn}`);if(x)out.push(x)});
      }
    }
    return out;
  }
  function toast(m,type){if(typeof root.toast==='function')root.toast(m,type||'info');else alert(m)}
  function fmt(v,d){return v==null?'—':Number(v).toLocaleString(undefined,{minimumFractionDigits:d==null?2:d,maximumFractionDigits:d==null?2:d})}
  function sum(rows,k){let ok=false,total=0;(rows||[]).forEach(r=>{const v=num(r[k]);if(v!=null){ok=true;total+=v}});return ok?Math.round(total*100)/100:null}
  function attGroups(ym){
    const out={};if(typeof root.periodDates!=='function'||typeof root.hoursSourceRows!=='function')return out;
    const rows=root.hoursSourceRows(root.periodDates('month',ym));
    rows.forEach(r=>{const d=String(r.dept||'').trim()||'—';const x=out[d]||(out[d]={dept:d,section:r.sect||'',attendanceHours:0,attendanceKnown:false,attendance:0});
      const h=num(r.hours);if(h!=null&&h>0){x.attendanceHours+=h;x.attendanceKnown=true}x.attendance+=Number(r.att||0)||0;if(!x.section&&r.sect)x.section=r.sect;});
    return out;
  }
  function groups(ym){
    load();const by={};const add=(dept)=>{const d=dept||'—';return by[d]||(by[d]={dept:d,section:'',payroll:[],advance:[],meal:[],attendanceHours:null,attendanceKnown:false,attendance:0})};
    state.rows.filter(r=>r.period===ym).forEach(r=>{const x=add(r.dept);x[r.kind].push(r);if(!x.section&&r.sect)x.section=r.sect});
    Object.values(attGroups(ym)).forEach(a=>{const x=add(a.dept);x.attendanceHours=a.attendanceHours;x.attendanceKnown=a.attendanceKnown;x.attendance=a.attendance;if(!x.section)x.section=a.section});
    return Object.values(by).sort((a,b)=>a.dept.localeCompare(b.dept));
  }
  function rowStatus(x){
    if(!x.payroll.length&&!x.advance.length&&!x.meal.length)return T3('無 HRA Pay 資料','No HRA Pay data','គ្មានទិន្នន័យ HRA Pay');
    const ph=sum(x.payroll,'totalHours');
    if(!x.attendanceKnown&&!x.payroll.length)return T3('無考勤工時','No attendance hours','គ្មានម៉ោងវត្តមាន');
    if(ph==null&&x.payroll.length)return T3('Payroll 未提供工時','Payroll hours not provided','Payroll មិនមានម៉ោង');
    if(!x.attendanceKnown)return T3('考勤未提供工時','Attendance hours not provided','Attendance មិនមានម៉ោង');
    const diff=x.attendanceHours-ph;return Math.abs(diff)<=.01?T3('一致','Match','ត្រូវគ្នា'):T3('需核查','Check','ត្រូវពិនិត្យ');
  }
  function kpi(label,value,sub,cls){return`<div class="kpi ${cls||''}"><div class="kpi-n">${value}</div><div class="kpi-l">${label}</div>${sub?`<div class="kpi-sub">${sub}</div>`:''}</div>`}
  function populate(){
    load();const ms=new Set(state.rows.map(r=>r.period));if(typeof root.allMonths==='function')root.allMonths().forEach(m=>ms.add(m));
    const months=[...ms].filter(Boolean).sort().reverse(),sel=el('pbMonth'),old=sel?.value||'';if(sel){sel.innerHTML=months.map(m=>`<option value="${esc(m)}">${esc(m)}</option>`).join('');if(months.includes(old))sel.value=old}
    const ym=sel?.value||months[0]||'',ds=new Set(groups(ym).map(x=>x.dept)),dsel=el('pbDept'),od=dsel?.value||'';
    if(dsel){dsel.innerHTML=`<option value="">${esc(T3('全部部門','All departments','គ្រប់ផ្នែក'))}</option>`+[...ds].sort().map(d=>`<option value="${esc(d)}">${esc(d)}</option>`).join('');if([...ds].includes(od))dsel.value=od}
  }
  function render(){
    const rootEl=el('pbTable');if(!rootEl)return;load();populate();const ym=el('pbMonth')?.value||'',filter=el('pbDept')?.value||'';
    const gs=groups(ym).filter(x=>!filter||x.dept===filter);
    let att=0,attKnown=false,pay=0,payKnown=false,adv=0,meal=0,normalMeal=0,otMeal=0,normalKnown=false,otKnown=false,warn=0;
    gs.forEach(x=>{if(x.attendanceKnown){att+=x.attendanceHours;attKnown=true}const p=sum(x.payroll,'totalHours');if(p!=null){pay+=p;payKnown=true}const a=sum(x.advance,'advance');if(a!=null)adv+=a;const m=sum(x.meal,'mealFee');if(m!=null)meal+=m;const nm=sum(x.meal,'normalMeal');if(nm!=null){normalMeal+=nm;normalKnown=true}const om=sum(x.meal,'otMeal');if(om!=null){otMeal+=om;otKnown=true}const st=rowStatus(x);if(st===T3('需核查','Check','ត្រូវពិនិត្យ')||st==='Check')warn++});
    el('pbKpi').innerHTML=kpi(T3('考勤工時','Attendance Hours','ម៉ោងវត្តមាន'),attKnown?fmt(att):'—',ym)+kpi(T3('Payroll 總工時','Payroll Total Hours','ម៉ោង Payroll សរុប'),payKnown?fmt(pay):'—',payKnown?T3('可比對','Comparable','អាចប្រៀបធៀប'):T3('月表未提供','Not provided','មិនមាន'))+kpi(T3('預付薪資','Advance Pay','ប្រាក់បើកមុន'),adv?fmt(adv):'—',T3('僅顯示已匯入','Imported only','បង្ហាញតែបាននាំចូល'))+kpi(T3('Meal Fee 合計','Meal Fee Total','ថ្លៃអាហារសរុប'),meal?fmt(meal):'—',normalKnown||otKnown?T3('含分項','Split available','មានបែងចែក'):T3('未拆正常／加班','Not split','មិនបានបែងចែក'))+kpi(T3('需核查部門','Departments to check','ផ្នែកត្រូវពិនិត្យ'),warn,warn?'':'—',warn?'bad':'good');
    el('pbNote').innerHTML=T3('月度主對照：考勤工時與 HRA Pay Payroll 工時有提供才比較；預付與 Meal Fee 只彙總已匯入 Projection。若來源沒有工時／正常餐／加班餐欄位，顯示「—」，不補 0。日／週工時請到「考勤總時數」查看。','Monthly bridge: compare Attendance and HRA Pay Payroll hours only when both are supplied. Advance and Meal Fee show imported projections. Missing hours or normal/OT meal fields stay “—”; no zero is invented. Use Attendance Hours for day/week views.','ការប្រៀបធៀបប្រចាំខែ៖ ប្រៀបធៀបម៉ោង Attendance និង Payroll នៅពេលមានទាំងពីរ។ វាលខ្វះបង្ហាញ “—” មិនបំពេញជា 0។');
    const h=`<table class="dtbl"><thead><tr><th>${T3('部門','Department','ផ្នែក')}</th><th>${T3('組別／分區','Section / Group','ក្រុម')}</th><th>${T3('考勤工時','Attendance Hours','ម៉ោងវត្តមាន')}</th><th>${T3('Payroll 正常工時','Payroll Normal Hours','ម៉ោងធម្មតា')}</th><th>${T3('Payroll 加班工時','Payroll OT Hours','ម៉ោងបន្ថែម')}</th><th>${T3('Payroll 總工時','Payroll Total Hours','ម៉ោងសរុប')}</th><th>${T3('預付','Advance','ប្រាក់បើកមុន')}</th><th>${T3('平日餐費','Weekday Meal','អាហារថ្ងៃធម្មតា')}</th><th>${T3('加班餐費','OT Meal','អាហារបន្ថែម')}</th><th>${T3('Meal 合計','Meal Total','អាហារសរុប')}</th><th>${T3('差異／狀態','Diff / Status','ភាពខុសគ្នា / ស្ថានភាព')}</th></tr></thead><tbody>`;
    const body=gs.map(x=>{const p=sum(x.payroll,'totalHours'),nh=sum(x.payroll,'normalHours'),oh=sum(x.payroll,'otHours'),a=sum(x.advance,'advance'),nm=sum(x.meal,'normalMeal'),om=sum(x.meal,'otMeal'),mf=sum(x.meal,'mealFee');let diff='—';if(x.attendanceKnown&&p!=null)diff=fmt(x.attendanceHours-p);const st=rowStatus(x),cls=st===T3('一致','Match','ត្រូវគ្នា')?'rg':(st===T3('需核查','Check','ត្រូវពិនិត្យ')||st==='Check'?'rb':'rw');return`<tr><td class="dept-cell">${esc(x.dept)}</td><td>${esc(x.section||'—')}</td><td>${x.attendanceKnown?fmt(x.attendanceHours):'—'}</td><td>${fmt(nh)}</td><td>${fmt(oh)}</td><td>${fmt(p)}</td><td>${fmt(a)}</td><td>${fmt(nm)}</td><td>${fmt(om)}</td><td>${fmt(mf)}</td><td><b>${diff}</b><br><span class="${cls}">${esc(st)}</span></td></tr>`}).join('');
    rootEl.innerHTML=h+(body||`<tr><td colspan="11">${T3('尚無月度資料；請先按「讀取 HRA Pay」或匯入 Projection。','No monthly data. Load HRA Pay or import a projection first.','មិនមានទិន្នន័យប្រចាំខែ។')}</td></tr>`)+'</tbody></table>';
  }
  async function loadLocal(){const rows=localProjections();if(!rows.length){toast(T3('找不到 HRA Pay 的月度 Projection；請先在 HRA Pay 讀取／下載資料。','No HRA Pay monthly projection found. Load/download data in HRA Pay first.','រកមិនឃើញ Projection ប្រចាំខែ'));return}upsert(rows);populate();render();toast(T3(`✅ 已讀取 ${rows.length} 筆 HRA Pay 月度 Projection`,`✅ Loaded ${rows.length} HRA Pay projection rows`,`✅ បានអាន ${rows.length} ជួរ`),'ok')}
  async function importFiles(input){const files=[...(input?.files||[])];if(input)input.value='';if(!files.length)return;const out=[];for(const f of files){try{out.push(...await importFile(f))}catch(e){toast(`${f.name}: ${e.message}`,'err')}}if(out.length){upsert(out);populate();render();toast(T3(`✅ 已匯入 ${out.length} 筆月度資料`,`✅ Imported ${out.length} monthly rows`,`✅ បាននាំចូល ${out.length} ជួរ`),'ok')}else toast(T3('沒有辨識到月度資料','No monthly rows recognised','មិនស្គាល់ទិន្នន័យប្រចាំខែ'),'err')}
  function clear(){if(!confirm(T3('確定清除本機月度對照資料？不會刪除 Attendance 或 HRA Pay 原始資料。','Clear only the local monthly bridge? Attendance and HRA Pay source data will remain.','លុបទិន្នន័យប្រៀបធៀបប្រចាំខែតែប៉ុណ្ណោះ?')))return;state.rows=[];save();populate();render();toast(T3('已清除對照資料','Bridge data cleared','បានលុបទិន្នន័យប្រៀបធៀប'),'ok')}
  function exportCsv(){load();const ym=el('pbMonth')?.value||'';const gs=groups(ym);const rows=[['period','department','section','attendanceHours','payrollNormalHours','payrollOtHours','payrollTotalHours','advance','weekdayMeal','otMeal','mealTotal','status']];gs.forEach(x=>rows.push([ym,x.dept,x.section,x.attendanceKnown?x.attendanceHours:'',sum(x.payroll,'normalHours')??'',sum(x.payroll,'otHours')??'',sum(x.payroll,'totalHours')??'',sum(x.advance,'advance')??'',sum(x.meal,'normalMeal')??'',sum(x.meal,'otMeal')??'',sum(x.meal,'mealFee')??'',rowStatus(x)]));const csv='\uFEFF'+rows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download=`AC_HRA_Monthly_Bridge_${ym||'all'}.csv`;a.click();}
  function refresh(){load();populate();render()}
  root.payBridgeRefresh=refresh;root.payBridgeLoadLocal=loadLocal;root.payBridgeImportFiles=importFiles;root.payBridgeClear=clear;root.payBridgeExport=exportCsv;root.payBridgeMonthChange=render;root.payBridgeDeptChange=render;
  window.addEventListener('storage',e=>{if(/^hrpay:result:/.test(e.key||'')){state.loaded=false;refresh()}});
})(window);
