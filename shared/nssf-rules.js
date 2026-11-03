/* shared/nssf-rules.js — NSSF 依計薪月份生效的上下限（HRA Portal 用；規則和 AC-HRA-PAY shared/hrpay-nssf-rules.js 相同）
   NSSF 第 3135/26 號通知：2026-11 計薪月起繳費工資 600,000–1,500,000៛（之前 400,000–1,200,000៛，不回溯）；
   員工退休金 2%（2027-10 起推估 4%）。離職／產假結算單的 NSSF 照表上數字，這裡只做防呆：
   2026-11 以後的結算，NSSF 扣款剛好等於舊下限／舊上限的金額，或低於新下限、高於新上限，就提醒核對。 */
(function(g){'use strict';
var BANDS=[{from:'2000-01',min:400000,max:1200000,pen:.02},{from:'2026-11',min:600000,max:1500000,pen:.02},{from:'2027-10',min:600000,max:1500000,pen:.04,proj:true}];
function bandAt(p){p=String(p||'').slice(0,7);var b=BANDS[0];for(var i=0;i<BANDS.length;i++)if(p&&BANDS[i].from<=p)b=BANDS[i];return b;}
function fx(){try{var v=+JSON.parse(localStorage.getItem('hrpay_nssf_fx')||'0');return v>0?v:4050;}catch(e){return 4050;}}
function settleCheck(d,ym){ym=String(ym||'').slice(0,7);if(!d||!/^\d{4}-\d{2}$/.test(ym)||ym<'2026-11')return null;var v=+d.nssf;if(!(v<0))return null;var n=Math.abs(v),r=fx(),b=bandAt(ym),o=BANDS[0];
  var nf=b.min*b.pen/r,nc=b.max*b.pen/r,of=o.min*o.pen/r,oc=o.max*o.pen/r,f=function(x){return '$'+(Math.round(x*100)/100).toFixed(2);};
  if(Math.abs(n-of)<=0.06||Math.abs(n-oc)<=0.06)return {zh:'NSSF '+f(n)+' 等於舊下限／上限的扣款；'+ym+' 起是 '+f(nf)+'～'+f(nc)+'，請核對',en:'NSSF '+f(n)+' equals the old floor/ceiling amount; from '+ym+' it is '+f(nf)+'–'+f(nc)+' — please check'};
  if(n<nf-0.06)return {zh:'NSSF '+f(n)+' 低於 '+ym+' 新下限 '+f(nf)+'，請核對',en:'NSSF '+f(n)+' is below the '+ym+' floor '+f(nf)+' — please check'};
  if(n>nc+0.06)return {zh:'NSSF '+f(n)+' 高於 '+ym+' 新上限 '+f(nc)+'，請核對',en:'NSSF '+f(n)+' is above the '+ym+' ceiling '+f(nc)+' — please check'};
  return null;}
g.HRANssf={BANDS:BANDS,bandAt:bandAt,fx:fx,settleCheck:settleCheck};
})(typeof window!=='undefined'?window:this);
