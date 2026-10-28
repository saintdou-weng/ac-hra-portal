/* shared/settle-parse.js — 離職結算工作簿（Summery「Salary Resigned on Mon-YYYY」＋月份明細分頁）解析
   2026-10-28：產假頁要匯入「產假未結薪資」（同一種結算工作簿），解析規則必須和入離職頁完全一樣，
   所以下面的函式是從 ac_hra_onboarding_v3.html 原樣複製（含 NSSF 照表上正負號的修正）。
   改入離職頁的解析時，這裡要一起改。
   用法：HRASettleParse.isSettlementWorkbook(wb) / HRASettleParse.parseWorkbook(wb, XLSX, LANG)
   → { titleYM, rows:[{empId,name,settleDate,amount,position,dept,remarks,srcSheet,joinDate,gender,detail,calc,verified}], warn:[] } */
(function(g){
'use strict';
var LANG='zh';
function L(zh,en,km){ return LANG==='km'?(km||en):LANG==='en'?en:zh; }
function p2(n){return(n<10?'0':'')+n;}
function _xlSnap(d){/* v72: SheetJS cellDates in Asia/Phnom_Penh gives 23:59:5x of the previous day → snap to next midnight */var s=d.getHours()*3600+d.getMinutes()*60+d.getSeconds();return s>=86280?new Date(d.getTime()+(86400-s)*1000):d}
function lds(d){return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate());}
function N(v){var n=parseFloat(String(v==null?'':v).replace(/[^0-9.\-]/g,''));return isFinite(n)?n:0;}
function uid(){return Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-4);}
function xdate(v){
  if(v===null||v===undefined||v==='')return '';
  if(typeof v==='number'&&isFinite(v)){
    if(v<20||v>80000)return '';
    var ms=Date.UTC(1899,11,30)+Math.round(v)*86400000, d=new Date(ms);
    return d.getUTCFullYear()+'-'+p2(d.getUTCMonth()+1)+'-'+p2(d.getUTCDate());
  }
  if(v instanceof Date){ if(isNaN(v.getTime()))return ''; return lds(_xlSnap(v)); }
  var s=String(v).trim(); if(!s)return '';
  if(/^#(REF|N\/A|VALUE|NAME)/i.test(s))return '';
  var m=s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
  if(m) return m[1]+'-'+p2(+m[2])+'-'+p2(+m[3]);
  m=s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
  if(m) return m[3]+'-'+p2(+m[2])+'-'+p2(+m[1]);   /* DD/MM/YYYY */
  var n=Number(s);
  if(isFinite(n)&&n>20&&n<80000) return xdate(n);
  return '';
}
function cs(v){
  if(v===null||v===undefined)return '';
  if(v instanceof Date)return isNaN(v.getTime())?'':lds(_xlSnap(v));
  var s=String(v).trim();
  if(/^#(REF|N\/A|VALUE|NAME|DIV)/i.test(s))return '';
  return s.replace(/\s+/g,' ');
}
function empIdOf(v){
  if(v===null||v===undefined)return '';
  var s=String(v).trim().replace(/\.0+$/,'').replace(/\s+/g,'');
  if(/^#/.test(s))return '';
  return /^\d{2,6}$/.test(s) ? s : '';
}
function hdrRowOf(rows,tests,maxScan){
  var lim=Math.min(maxScan||14,rows.length);
  for(var i=0;i<lim;i++){
    var joined=(rows[i]||[]).map(function(c){
      return String(c==null?'':c).replace(/[\r\n]+/g,' ').replace(/\s+/g,' ').toLowerCase();
    }).join('\u2502');
    var ok=true;
    for(var t=0;t<tests.length;t++){ if(!tests[t].test(joined)){ok=false;break;} }
    if(ok)return i;
  }
  return -1;
}
function hdrMap(row){
  return (row||[]).map(function(c){
    return String(c==null?'':c).replace(/[\r\n]+/g,' ').replace(/\s+/g,' ').trim().toLowerCase();
  });
}
function cIdx(hdr){
  for(var a=1;a<arguments.length;a++){
    var p=arguments[a];
    for(var i=0;i<hdr.length;i++){ if(hdr[i]&&p.test(hdr[i])) return i; }
  }
  return -1;
}
function sniffSettleLayout(rows){
  /* ① 找錨點：某一格是工號、右邊一格是姓名，且下一列同一欄也是工號（連續兩列才算資料區） */
  var A=null;
  for(var i=0;i<Math.min(rows.length,40)&&!A;i++){
    var r=rows[i]||[];
    for(var c=0;c<Math.min(r.length,6);c++){
      if(!empIdOf(r[c])) continue;
      var nm=cs(r[c+1]);
      if(!nm||!/[A-Za-z\u1780-\u17FF\u4E00-\u9FFF]/.test(nm)) continue;
      if(!empIdOf((rows[i+1]||[])[c])) continue;
      A={start:i, cId:c, cName:c+1, cNo:(c-1>=0?c-1:-1)};
      break;
    }
  }
  if(!A) return null;

  /* ② 收資料列（工號欄有值才算，Total / 簽核列自動被排除） */
  var body=[], maxc=0;
  for(var j=A.start;j<rows.length;j++){
    var rw=rows[j]||[];
    if(empIdOf(rw[A.cId])){ body.push(rw); if(rw.length>maxc)maxc=rw.length; }
  }
  if(!body.length) return null;

  /* ③ 逐欄看整區資料的長相決定用途；整欄都是 #REF! 的直接跳過 */
  var cAmt=-1,cDate=-1,cRmk=-1,texts=[];
  for(var c2=A.cName+1;c2<maxc;c2++){
    var seen=0,nDate=0,nNum=0,nTxt=0,nRes=0;
    body.forEach(function(r){
      var v=r[c2], s=cs(v);
      if(v===null||v===undefined||s==='') return;
      seen++;
      if(looksDateCell(v)) nDate++;
      else if(typeof v==='number'||/^-?[\d,]+(\.\d+)?$/.test(s)) nNum++;
      else { nTxt++; if(/resign|terminat|辭|離職/i.test(s)) nRes++; }
    });
    if(!seen) continue;
    if(nDate>=seen*0.6){ if(cDate<0)cDate=c2; }
    else if(nRes>=seen*0.6){ if(cRmk<0)cRmk=c2; }
    else if(nNum>=seen*0.6){ if(cAmt<0)cAmt=c2; }        /* 第一個數值欄 = 結算金額 */
    else if(nTxt>=seen*0.6) texts.push(c2);
  }
  A.cAmt=cAmt; A.cDate=cDate; A.cRmk=cRmk;
  A.cPos = texts.length>0?texts[0]:-1;
  A.cDept= texts.length>1?texts[1]:-1;
  A.cSal=-1; A.cMeal=-1; A.cAL=-1; A.cTr=-1;
  return A;
}
function parseSettleSheet(rows,sheetName){
  var out=[], warn=[], M=null, start=0;
  var h=hdrRowOf(rows,[/id no/,/amount/],16);
  if(h>=0){
    var hdr=hdrMap(rows[h]);
    M={ cNo:cIdx(hdr,/^no\.?$/), cId:cIdx(hdr,/id no/), cName:cIdx(hdr,/^name$/),
        cAmt:cIdx(hdr,/amount/), cSal:cIdx(hdr,/^salary$/), cMeal:cIdx(hdr,/meal/),
        cAL:cIdx(hdr,/annual\s*leave/), cTr:cIdx(hdr,/transport/), cRmk:cIdx(hdr,/remark/),
        cDate:cIdx(hdr,/^date$/), cPos:cIdx(hdr,/position/), cDept:cIdx(hdr,/dapartment|department/) };
    start=h+1;
    if(M.cId<0) M=null;
  }
  if(!M){
    M=sniffSettleLayout(rows);
    if(!M) return {rows:out,warn:['['+sheetName+'] '+L('找不到結算表頭，也認不出資料列格式','no settlement header and layout not recognised')]};
    start=M.start;
    warn.push('['+sheetName+'] '+L('表頭是 #REF!，已改用欄位格式自動辨識','header is #REF! — columns detected from the data')+
      '（'+L('工號','ID')+'=' +colL(M.cId)+' · '+L('姓名','Name')+'='+colL(M.cName)+
      (M.cAmt>=0?(' · '+L('金額','Amount')+'='+colL(M.cAmt)):'')+
      (M.cDate>=0?(' · '+L('日期','Date')+'='+colL(M.cDate)):'')+'）');
  }
  /* v73: 標題「Salary Resigned on Oct-2026」決定本檔月份；HR 的 Summery 常留著上個月的舊區塊
     （#REF!／#N/A 名字、金額 0、或日期是別的月份）。這些不匯入，但在報告裡列出來。 */
  var titleYM='', MON={jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};
  for(var ti=0;ti<Math.min(rows.length,6);ti++){ var tj=(rows[ti]||[]).map(function(c){return cs(c);}).join(' '); var tm=tj.match(/resigned\s*on\s*([a-z]{3})[a-z]*[\s\-\/]*(\d{4})/i); if(tm&&MON[tm[1].toLowerCase()]){titleYM=tm[2]+'-'+MON[tm[1].toLowerCase()];break;} }
  var skippedBad=[], skippedStale=[];
  for(var i=start;i<rows.length;i++){
    var row=rows[i]||[];
    var nm=cs(row[M.cName]);
    if(/^(total|合計|approved by|check by|prepared by|hr manager)$/i.test(nm))continue;  /* 跳過 Total / 簽核列 */
    var empId=empIdOf(row[M.cId]); if(!empId)continue;                                   /* 跳過 #N/A、空白、非數字 */
    var dt=M.cDate>=0?xdate(row[M.cDate]):'';
    if(!nm||/^#(ref|n\/a|value)/i.test(nm)){ skippedBad.push(empId); continue; }
    if(titleYM&&dt&&dt.slice(0,7)!==titleYM){ skippedStale.push(empId+' '+nm+' ('+dt+')'); continue; }
    var rmk=M.cRmk>=0?cs(row[M.cRmk]):'';
    var isResign = !rmk || /resign|辭|離職/i.test(rmk);
    out.push({ _k:'S|'+empId+'|'+(dt||'-'), id:'s_'+uid(), empId:empId, name:nm,
      settleDate:dt, amount:N(row[M.cAmt]), settleSalary:N(row[M.cSal]), meals:N(row[M.cMeal]),
      annualLeave:N(row[M.cAL]), transport:N(row[M.cTr]),
      remarks:rmk, position:M.cPos>=0?cs(row[M.cPos]):'', dept:M.cDept>=0?cs(row[M.cDept]):'',
      isResign:isResign, matchedTo:'', srcSheet:sheetName });
  }
  if(skippedBad.length) warn.push('['+sheetName+'] '+L('略過無姓名／#REF! 列','skipped rows with no name / #REF!')+'：'+skippedBad.join(', '));
  if(skippedStale.length) warn.push('['+sheetName+'] '+L('略過非本月（'+titleYM+'）的舊區塊','skipped stale blocks outside '+titleYM)+'：'+skippedStale.join('、'));
  if(!out.length) warn.push('['+sheetName+'] '+L('認得表頭但沒有讀到任何有效工號列','header found but no valid ID rows'));
  return {rows:out,warn:warn};
}
function parseSettleDetailSheet(rows,sheetName){
  var out={}, n=rows.length;
  function num(v){ return (v===null||v===undefined||v==='')?null:(isFinite(+v)?+v:N(v)); }
  function H(row){ return hdrMap(row); }
  for(var i=0;i<n;i++){
    var hdr=H(rows[i]||[]);
    var cGrand=cIdx(hdr,/grand\s*total/); if(cGrand<0)continue;
    var cId=cIdx(hdr,/^id$/,/^id\b/), cName=cIdx(hdr,/នាម|name/), cSex=cIdx(hdr,/ភេទ|^sex$|gender/),
        cBasic=cIdx(hdr,/ប្រាក់ប្រចាំខែ|basic/), cWd=cIdx(hdr,/working\s*day/), cPay=cIdx(hdr,/salary\s*pay/), cMeal=cIdx(hdr,/meal/),
        cAnnDay=cIdx(hdr,/annual\s*day/), cAnnPay=cIdx(hdr,/annual\s*pay/), cAdv=cIdx(hdr,/ប្រាក់បុរេប្រទាន|advance/),
        cTravel=cIdx(hdr,/travel/), cAtt=cIdx(hdr,/attend/), cNight=cIdx(hdr,/night\s*shift\s*work/), cHoli=cIdx(hdr,/holiday\s*work/),
        cOtTot=cIdx(hdr,/total\s*work\s*overtime/), cGood=cIdx(hdr,/good\s*working/), cNoOt=cIdx(hdr,/total\s*without\s*ot/),
        cNssf=cIdx(hdr,/បង់វិភាគទាន|nssf|ប ស ស/), cTax=cIdx(hdr,/salary\s*tax/), cLeave=cIdx(hdr,/take\s*leave/), cAbs=cIdx(hdr,/absent/);
    if(cId<0||cPay<0)continue;
    var r1=rows[i+2]||[], r2=rows[i+3]||[], jr=rows[i+1]||[];
    var empId=empIdOf(r1[cId]); if(!empId){ r1=rows[i+1]||[]; r2=rows[i+2]||[]; jr=[]; empId=empIdOf(r1[cId]); if(!empId)continue; }
    var joinDate=''; for(var c=0;c<Math.min(jr.length,8);c++){ var d=xdate(jr[c]); if(d){joinDate=d;break;} }
    var sexRaw=cs(r1[cSex]).toLowerCase(), gender=/^(ស|s|f|female|ស្រី)/.test(sexRaw)?'F':(/^(ប|b|m|male|ប្រុស)/.test(sexRaw)?'M':'');
    var d={ sheet:sheetName, joinDate:joinDate, nameKh:cs(r1[cName]), nameEn:cs(r2[cName]), gender:gender,
      basic:num(r1[cBasic]), stdDays:num(r1[cWd]), workDays:num(r2[cWd]), salaryPay:num(r2[cPay]), meal:num(r2[cMeal]),
      annualBalance:num(r1[cAnnDay]), annualUsed:cAnnDay>=0?num(r1[cAnnDay+1]):null, annualDays:num(r2[cAnnDay]), annualPay:num(r2[cAnnPay]),
      advance:num(r2[cAdv]), travel:num(r2[cTravel]), attBonus:num(r2[cAtt]), nightShift:num(r2[cNight]), holiday:num(r2[cHoli]),
      otTotal:num(r2[cOtTot]), goodWorking:num(r2[cGood]), totalNoOt:num(r2[cNoOt]), nssf:num(r2[cNssf]), tax:num(r2[cTax]),
      leave:num(r2[cLeave]), absent:num(r2[cAbs]), grandTotal:num(r2[cGrand]), avgSalary:null, tenure:'', probation:'' };
    /* 右側延伸欄：年資文字、試用結果 */
    r2.forEach(function(v){ var s=cs(v); if(/\d+\s*years?\s*\d+\s*months?\s*\d+\s*days?/i.test(s))d.tenure=s; else if(/^(pass|fail)/i.test(s))d.probation=s; });
    /* 下方「Average =」 */
    for(var k=i+4;k<Math.min(n,i+24);k++){ var rk=rows[k]||[]; var hk=H(rk); if(cIdx(hk,/grand\s*total/)>=0)break; var ai=hk.indexOf('average'); if(ai>=0){ for(var c2=ai+1;c2<rk.length;c2++){ if(rk[c2]!==null&&rk[c2]!==''&&isFinite(+rk[c2])){d.avgSalary=+rk[c2];break;} } break; } }
    /* 重算：薪資＋餐費＋年假＋交通＋全勤＋夜班＋假日＋OT＋good working ＝ 小計；小計 − 預支 ± NSSF − 稅 ＝ 應付
       2026-10-28 Paul 決定 NSSF「照表上正負號」：表上是負數＝扣款，正數＝退還／加回（例：5807 的 +5.90）。
       舊版一律當扣款，正數會算成 − 5.90 → 標成不符。 */
    var plus=[d.salaryPay,d.meal,d.annualPay,d.travel,d.attBonus,d.nightShift,d.holiday,d.otTotal,d.goodWorking].map(function(v){return +v||0;});
    var gross=plus.reduce(function(a,b){return a+b;},0);
    var ded=(+d.advance||0)+Math.abs(+d.leave||0)+Math.abs(+d.absent||0);
    var nssf=+d.nssf||0, tax=+d.tax||0;
    var net=gross-ded+nssf-Math.abs(tax);
    d.recomputed=Math.round(net*100)/100;
    d.verified=(d.grandTotal!==null&&Math.abs(d.recomputed-d.grandTotal)<=0.05)&&(d.totalNoOt===null||Math.abs((gross-(+d.otTotal||0)-(+d.goodWorking||0))-d.totalNoOt)<=0.05);
    var f=function(v){return (Math.round((+v||0)*100)/100).toString();};
    var parts=[f(d.salaryPay)]; if(d.meal)parts.push(f(d.meal)+' '+L('餐','meal','អាហារ')); if(d.annualPay)parts.push(f(d.annualPay)+' '+L('年假','AL','ឈប់')+(d.annualDays?' '+f(d.annualDays)+'d':'')); if(d.travel)parts.push(f(d.travel)+' '+L('交通','travel','ធ្វើដំណើរ')); if(d.attBonus)parts.push(f(d.attBonus)+' '+L('全勤','attend.','វត្តមាន')); if(d.otTotal)parts.push(f(d.otTotal)+' OT'); if(d.nightShift)parts.push(f(d.nightShift)+' '+L('夜班','night','យប់')); if(d.holiday)parts.push(f(d.holiday)+' '+L('假日','holiday','បុណ្យ'));
    var calc=parts.join(' + ')+' = '+f(gross); if(d.advance)calc+=' − '+f(d.advance)+' '+L('預支','advance','បុរេប្រទាន'); if(nssf)calc+=(nssf<0?' − ':' + ')+f(Math.abs(nssf))+' NSSF'; if(tax)calc+=' − '+f(Math.abs(tax))+' '+L('稅','tax','ពន្ធ'); if(d.leave||d.absent)calc+=' − '+f(Math.abs(+d.leave||0)+Math.abs(+d.absent||0))+' '+L('缺勤','absent','អវត្តមាន');
    calc+=' = '+f(d.recomputed)+(d.verified?' ✔':' ≠ '+f(d.grandTotal));
    if(d.workDays!==null&&d.stdDays!==null)calc+=' · '+f(d.workDays)+'/'+f(d.stdDays)+'d';
    if(d.avgSalary!==null)calc+=' · '+L('平均','avg','មធ្យម')+' '+f(d.avgSalary);
    d.calc=calc;
    out[empId]=d;
  }
  return out;
}

function isSettlementWorkbook(wb){
  var names=wb&&wb.SheetNames||[];
  for(var i=0;i<names.length;i++){
    var sn=names[i]; if(!/^summ?ery$|^summary$/i.test(sn))continue;
    var raw=g.XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,defval:null,raw:true});
    for(var r=0;r<Math.min(8,raw.length);r++){
      var line=(raw[r]||[]).map(function(c){return String(c==null?'':c);}).join(' ').replace(/\u200b/g,'');
      if(/salary\s*resigned/i.test(line))return true;
    }
    if(hdrRowOf(raw,[/id no/,/amount/],14)>=0&&hdrRowOf(raw,[/date maternity/],14)<0)return true;
  }
  return false;
}
function parseWorkbook(wb,XLSXlib,lang){
  LANG=lang||'zh'; var X=XLSXlib||g.XLSX, inS=[], warns=[], detailMap={}, titleYM='';
  wb.SheetNames.forEach(function(sn){
    var isSum=/^summ?ery$|^summary$/i.test(sn);
    if(!isSum&&!/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|sheet\d*|\d{1,2}月|salary|payroll)/i.test(sn))return;
    var rows=X.utils.sheet_to_json(wb.Sheets[sn],{header:1,defval:null,raw:true});
    if(isSum){
      var a=parseSettleSheet(rows,sn); inS=inS.concat(a.rows); warns=warns.concat(a.warn);
      for(var ti=0;ti<Math.min(rows.length,6)&&!titleYM;ti++){var tj=(rows[ti]||[]).map(function(c){return cs(c);}).join(' '),tm=tj.match(/resigned\s*on\s*([a-z]{3})[a-z]*[\s\-\/]*(\d{4})/i),MON={jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};if(tm&&MON[tm[1].toLowerCase()])titleYM=tm[2]+'-'+MON[tm[1].toLowerCase()];}
    }else{ try{ var dm=parseSettleDetailSheet(rows,sn); Object.keys(dm).forEach(function(k){ if(!detailMap[k])detailMap[k]=dm[k]; }); }catch(e){ console.warn('[settle detail]',sn,e); } }
  });
  inS.forEach(function(r){
    var d=detailMap[r.empId]; if(!d)return;
    r.joinDate=d.joinDate||''; r.gender=d.gender||''; r.detail=d; r.calc=d.calc; r.verified=!!d.verified;
    if(d.grandTotal!==null&&r.amount&&Math.abs(d.grandTotal-r.amount)>0.05){ r.verified=false; r.calc+=' · '+L('Summery 金額 ','Summery amount ')+r.amount+' ≠ '+d.grandTotal; }
  });
  return {titleYM:titleYM,rows:inS,detail:detailMap,warn:warns};
}
/* 產假未結薪資列（產假頁、入離職頁轉送都用這個格式，雲端 key 一致才不會重複） */
function toMatSalary(s,o){
  o=o||{}; var d=s.detail||null, ym=String(s.settleDate||o.titleYM||'').slice(0,7);
  return { _k:'MS|'+s.empId+'|'+(ym||'-'), id:'ms_'+uid(), type:'mat_salary', idNo:String(s.empId), name:s.name||(d&&d.nameEn)||'',
    nameKh:d&&d.nameKh||'', gender:(d&&d.gender)||'F', dept:o.dept||s.dept||'', position:o.position||'', section:o.section||'',
    joinDate:s.joinDate||(d&&d.joinDate)||'', period:ym, settleDate:s.settleDate||'', amount:Math.round((+s.amount||0)*100)/100,
    calc:s.calc||'', verified:!!s.verified, detail:d, remarks:s.remarks||'', srcSheet:s.srcSheet||'',
    sourceFile:o.sourceFile||s.sourceFile||'', importedAt:o.importedAt||'', source:o.source||'settlement', updatedAt:o.importedAt||'' };
}
g.HRASettleParse={version:'1.0',toMatSalary:toMatSalary,isSettlementWorkbook:isSettlementWorkbook,parseWorkbook:parseWorkbook,parseSummary:function(rows,sn,lang){LANG=lang||'zh';return parseSettleSheet(rows,sn);},parseDetail:function(rows,sn,lang){LANG=lang||'zh';return parseSettleDetailSheet(rows,sn);}};
})(typeof window!=='undefined'?window:this);
