/* Source migration is additive for custom entries and preserves an audit of corrections. */
function applyCalendarSource76(){
  const source=HRACalendarSource76,before=clone(DB),removed=new Set([...(CAL_SETTINGS.sourceCalendarRemoved76||[]),...CHANGE_LOG.filter(x=>x.action==='delete').map(x=>x.recordId)]);
  function equivalent(a,b){return ['date','enddate','type','zh','en','km','days','note','refdate','countsAsHoliday','appliesTo','swapId'].every(k=>String(a[k]||'')===String(b[k]||''));}
  for(const [year,records] of Object.entries(source.years)){
    DB[year]=DB[year]||[];
    if(Number(year)<2026){
      const seeds=source.seed[year]||[];
      DB[year]=DB[year].filter(r=>{
        const seed=seeds.find(x=>x.id===r.id);
        return !seed||!/^\d{2}-\d{2}(?:-orig)?$/.test(r.id)||!equivalent(r,seed);
      });
      DB[year].forEach(r=>{
        if(/-vrt-kny$/.test(r.id)){r.countsAsHoliday=false;r.type='history';}
        if(/^(21-stop|22-stop[12])$/.test(r.id)){r.countsAsHoliday=false;r.appliesTo='partial';}
      });
    }
    records.forEach(r=>{if(!removed.has(r.id)&&!DB[year].some(x=>x.id===r.id))DB[year].push(clone(r));});
  }
  // Management's later 2026 plan supersedes the unadjusted workbook for these exact records.
  DB[2026]=DB[2026]||[];
  source.confirmed2026.forEach(rec=>{
    const idx=DB[2026].findIndex(r=>r.id===rec.id),old=DB[2026][idx];
    if(removed.has(rec.id))return;
    if(old&&old.sourceRevision==='calendar-source-76')return;
    if(old&&String(old.updatedAt||'')>'2026-09-13T23:59:59Z'&&old.repairVersion!=='calendar-v69')return;
    const next={...clone(rec),sourceRevision:'calendar-source-76'};
    if(idx>=0)DB[2026][idx]={...old,...next};else DB[2026].push(next);
  });
  for(let m=1;m<=12;m++){const id='cal76-pay-2027-'+m;if(!removed.has(id)&&!DB[2027].some(x=>x.id===id))DB[2027].push({id,date:'2027-'+String(m).padStart(2,'0')+'-10',enddate:'',type:'payday',days:1,zh:'發薪日',en:'Salary day',km:'ថ្ងៃបើកប្រាក់ខែ',note:'每月10日；如遇假日請提前安排。Every 10th; arrange in advance when it falls on a day off.',source:'2027_Cambodia_Taiwan_Malaysia_Holiday_Calendar(1).html',sourceRevision:'calendar-source-76'});}
  TW_DB[2027]=clone(source.tw);MY_DB[2027]=clone(source.my);
  CAL_SETTINGS.sourceCalendar76=true;
  CAL_SETTINGS.sourceCalendarRemoved76=[...removed];
  const changed=JSON.stringify(before)!==JSON.stringify(DB);
  if(changed){logDbDiff(before,DB);CHANGE_LOG.forEach(x=>{if(!x.reason&&x.at&&x.at.slice(0,10)===new Date().toISOString().slice(0,10))x.reason='Calendar source reconciliation v76';});LAST_SAVED_DB=clone(DB);saveDB(false);}
  return changed;
}
function calendarLunar2027(ds){
  const list=HRACalendarSource76.lunarStarts.filter(x=>x.d<=ds),s=list[list.length-1];if(!s)return null;
  const day=Math.round((Date.parse(ds+'T00:00:00Z')-Date.parse(s.d+'T00:00:00Z'))/86400000)+1;
  const monName=LUNAR_MON_NAMES[s.m-1],dayName=LUNAR_DAY_NAMES[day-1],fest=LUNAR_FESTIVALS[s.m+'-'+day]||'';
  return {term:HRACalendarSource76.solarTerms[ds]?.[lang]||HRACalendarSource76.solarTerms[ds]?.zh||'',year:s.y,yn:s.y===2027?'丁未':'丙午',za:s.y===2027?'羊':'馬',mon:s.m,day,monName,dayName,fest:day===s.len&&s.m===12?'除夕':s.m===12&&fest==='除夕'?'':fest,str:monName+'·'+dayName};
}
function renderCalendarSourceNote76(){
  let el=document.getElementById('calendar-source-note');if(!el){el=document.createElement('div');el.id='calendar-source-note';el.style.cssText='padding:12px 18px;background:#e8f3ff;color:#164970;border-bottom:1px solid #a6c6df;font-size:13px;line-height:1.6';document.getElementById('calendar-wrap')?.before(el);if(!el.isConnected)document.getElementById('ribbon')?.after(el);if(!el.isConnected)document.body.appendChild(el);}
  const issues=HRACalendarSource76.issues.filter(x=>Number(x.year)===Number(curYear));
  const text=curYear===2026?(lang==='en'?'Factory plan: work Sep 24, holiday Sep 26; closed Oct 9–15, employee annual/personal leave Oct 13–14, resume Oct 16; work Oct 29.':'工廠安排：9/24上班、9/26休假；10/9～10/15連休，10/13～14為員工年假／事假，10/16復工、10/29上班。'):curYear===2027?(lang==='en'?'2027 calendar added from the supplied file. Cambodia: 22 public holiday dates. Taiwan and Malaysia are available as comparison layers.':'已加入附件2027行事曆；柬埔寨法定假日22天，台灣與馬來西亞可由上方比較圖層切換。'):(lang==='en'?'Factory calendar checked against the supplied 2019–2026 workbook, including swapped days, annual leave and half-pay shutdowns.':'已依附件2019～2026年工廠月曆核對調換假、年假及半薪停工標記。');
  el.textContent=text+(issues.length?' '+(lang==='en'?'Source colours without a legend (no swap inferred): ':'原檔以下日期顏色未在圖例定義，未擅自推定交換日期：')+issues.map(x=>x.date.slice(5)+' ['+x.cell+']').join('、'):'');
}
