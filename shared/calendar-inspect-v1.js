/* 政府檢查／稽核／健檢 — 歷年紀錄與下次預估（不含個資）。
   Additive: records are added by id once; anything HR deletes stays deleted.
   Every upcoming 'inspect' record also gets a '⏰ 一週前提醒' record 7 days earlier. */
var HRAInspectSeed=(function(){
  function e(id,date,zh,en,note,opt){return Object.assign({id:'insp-'+id,date:date,enddate:'',type:'inspect',days:1,zh:zh,en:en,km:zh,note:note,refdate:'',source:'Admin Center email record',countsAsHoliday:false,sourceRevision:'inspect-v1'},opt||{});}
  function h(id,date,zh,en,note,opt){return e(id,date,zh,en,note,Object.assign({type:'history'},opt||{}));}
  var list=[
    // ── 員工健檢（勞工部安排；2021 起每 2 年一次）
    h('hc-2018','2018-07-12','員工健檢（499 人）','Worker health check (499)','勞工部安排診所到廠；本地 7$/人。'),
    h('hc-2019','2019-10-09','員工健檢（564 人）','Worker health check (564)','勞工部安排診所到廠。'),
    h('hc-2021','2021-02-15','員工健檢（653 人，2 天）','Worker health check (653, 2 days)','2021 起改每 2 年一次；10$/人（5$ 診所＋5$ 勞工部）。外籍幹部每年辦健康證明（工作證用），不用到廠檢查。',{enddate:'2021-02-16',days:2}),
    h('hc-2023','2023-03-30','員工健檢（390 人）','Worker health check (390)','10$/人；項目：耳鼻喉、身高、三圍、體重、血壓。'),
    h('hc-2025','2025-04-28','員工健檢（443 人）','Worker health check (443)','約 4,430$；診所自帶身高體重計，一天完成。下次預計 2027 年 3 月。'),
    e('hc-2027','2027-03-15','員工健檢（預估，每 2 年）','Worker health check (estimated, every 2 years)','預估日期，等勞工部通知再改正確日期。準備：通知生產分批、管理部人員協助、確認診所帶齊設備（身高體重計／視力表）、外籍健康證明另辦。'),
    // ── 政府部門來訪／檢查
    h('mlvt-2022-08-13','2022-08-13','勞工部突擊檢查（疫苗資料系統）','MLVT surprise inspection (vaccine data)','檢查疫苗資料是否上傳系統，並和職安衛委員談話。'),
    h('moe-2022-08-19','2022-08-19','環境部檢查（廢棄物分類、廠區清潔）','MOE inspection (waste sorting & cleanliness)','無不符合事項。'),
    h('misti-2022-08-20','2022-08-20','工業部來訪（營運與資金詢問）','MISTI visit (operation & funding questions)','臨時通知；詢問薪資來源、資金與投資金額。'),
    h('fw-2022-10-03','2022-10-03','勞工部＋警察聯合檢查外籍人員文件','MLVT + police check of foreign staff documents','檢查護照／簽證／工作證，無異常。'),
    h('nssf-2022-10-21','2022-10-21','NSSF 檢查員工身分證（45 人補辦）','NSSF ID-card check (45 to renew)','為實施養老金先核對身分證；45 人過期或損壞，當天上午補辦（僅此一次，以後用事假／年假自辦）。'),
    h('imm-2024-10-22','2024-10-22','移民局警察檢查外籍簽證','Immigration police check of expat visas','外籍幹部簽證檢查。'),
    h('moe-emp-2024-12-20','2024-12-20','環境部 EMP 報告完成（環境證書轉管理部）','MOE EMP report issued','環境相關證書由管理部接手管理。'),
    h('fw-2026-11-17','2026-11-17','外籍員工聯合檢查（內政部＋勞工部）15:00','Joint inspection of foreign workers (MOI + MLVT) 15:00','依 Prakas 719/2018，沒有固定週期。要準備 10 項文件：公司章程、登記證、員工申報、異動申報、外籍配額、高棉文合約、護照＋4×6 照片 2 張、簽證、工作證／就業卡、勞工法及移民法影本。人事負責對帳。'),
    // ── 跨部會聯合檢查（勞工＋工業＋環境，每 2 年）
    h('imi-2024','2024-12-01','跨部會工業聯合檢查（第 1 次，日期待補）','Inter-ministerial industrial inspection (1st, date TBC)','2024 年第一次；正確日期待人事補上。'),
    e('imi-2026','2026-12-03','跨部會工業聯合檢查（第 2 次）08:30','Inter-ministerial industrial inspection (2nd) 08:30','勞工＋工業＋環境聯合檢查（Joint Prakas 073/20），每 2 年一次。管理部負責、生產協助，至少 3 位代表出席；通知附件 14 頁清單要逐項備好。'),
    e('imi-2028','2028-12-01','跨部會工業聯合檢查（預估第 3 次）','Inter-ministerial industrial inspection (estimated 3rd)','每 2 年一次的預估日期，收到通知再改。'),
    // ── 勞動監察自我申報（自動化系統，每年 6 月、12 月）
    h('lsd-2022','2022-06-01','勞動監察自我申報開始實施（通知 022）','Labour inspection self-declaration starts (Notif. 022)','經 GMAC／TAFTAC 轉發，改用自動化系統申報。'),
    h('lsd-2025-06','2025-06-01','勞動監察自我申報（6 月，通知 018/25）','Labour inspection self-declaration (June)','TAFTAC 轉發；本月內在系統完成申報。'),
    h('lsd-2025-12','2025-12-01','勞動監察自我申報（12 月，通知 035）','Labour inspection self-declaration (December)','TAFTAC 轉發；本月內在系統完成申報。'),
    e('lsd-2026-12','2026-12-01','勞動監察自我申報（12 月）','Labour inspection self-declaration (December)','每年 6 月、12 月各一次；等 TAFTAC 通知確認截止日，人事在系統完成並截圖存檔。'),
    e('lsd-2027-06','2027-06-01','勞動監察自我申報（6 月）','Labour inspection self-declaration (June)','每年 6 月、12 月各一次；本月內完成並截圖存檔。'),
    e('lsd-2027-12','2027-12-01','勞動監察自我申報（12 月）','Labour inspection self-declaration (December)','每年 6 月、12 月各一次；本月內完成並截圖存檔。'),
    // ── 消防演習（每年 6 月、12 月）與消防證書（每 2 年）
    h('fd-2021-12','2021-12-18','消防演習＋證書','Fire drill & certificate',''),
    h('fd-2022-12','2022-12-17','消防演習','Fire drill',''),
    e('fd-2026-12','2026-12-20','消防演習（12 月）','Fire drill (December)','每年 6 月、12 月各一次；記錄人數、疏散時間並拍照，結果填到「安全／員工關係 → 消防演習」。'),
    e('fd-2027-06','2027-06-19','消防演習（6 月，預估）','Fire drill (June, estimated)','每年 6 月、12 月各一次；日期確定後再改。'),
    e('fd-2027-12','2027-12-18','消防演習（12 月，預估）','Fire drill (December, estimated)','每年 6 月、12 月各一次；日期確定後再改。'),
    h('fc-2024','2024-01-10','消防證書生效（2 年有效）','Fire certificate effective (2 years)','2024 起規定每 2 年更新；驗廠和勞工部都會查。'),
    h('fc-2026','2026-01-10','消防證書到期／更新','Fire certificate renewal','上次 2024-01-10 生效；更新後請在此備註新證書有效日期。'),
    e('fc-2027-quote','2027-11-01','消防證書更新：先報價、報台北','Fire certificate: get quote & report to Taipei','證書約 2028-01 到期（以實際證書為準）；提前 2 個月詢價議價並報台北。'),
    e('fc-2028','2028-01-10','消防證書到期（預估）','Fire certificate expiry (estimated)','以實際證書日期為準。'),
    // ── WRAP 驗廠（每年）
    h('wrap-2024','2024-03-28','WRAP 驗廠通過（第 4 張 Gold）','WRAP audit passed (4th Gold)',''),
    h('wrap-2025','2025-02-14','WRAP 續證驗廠完成','WRAP renewal audit done',''),
    h('wrap-2026','2026-01-12','WRAP 驗廠窗口開始','WRAP audit window opens','12 月先報價、網站指派驗廠公司、付款後才排窗口。'),
    e('wrap-2026-quote','2026-12-14','WRAP 續證：報價／指派驗廠公司／付款','WRAP renewal: quote, appoint auditor, pay','每年 12 月中先辦，驗廠窗口約隔年 1 月中開始。'),
    e('wrap-2027','2027-01-11','WRAP 驗廠窗口（預估）','WRAP audit window (estimated)','以驗廠公司確認日期為準；先做自我評估、整理逃生通道。'),
    // ── 法規生效／截止（詳細在 PSJHR「法規與重大通知」；這幾筆提醒由 PSJHR 那邊私訊，行事曆只顯示）
    h('law-pension-2022','2022-10-01','📜 NSSF 退休金開始（公司 2%＋員工 2%）','NSSF pension starts (2% + 2%)','Prakas 170；11/10 發 10 月薪時第一次扣繳。'),
    h('law-allow-2026','2026-04-01','📜 交通／住宿津貼 +2.5 美元（7 → 9.5）','Transport / housing +US$2.50 (7 → 9.5)','直到政府公告停止；2027 繼續，獨立 pay code。'),
    h('law-nssf-2026-11','2026-11-01','📜 NSSF 繳費工資上下限 60 萬～150 萬瑞爾生效','NSSF wage band KHR 600k–1.5M effective','通知 3135/26；費率不變 7.4%；每月約多 1,829 美元。'),
    e('law-mw-switch','2026-12-01','📜 2027 最低工資：Payroll／合約／系統切換 212／210','2027 minimum wage: switch payroll / contracts / system','12 月前完成切換；US$2.50 補助獨立 pay code 不可重複。'),
    e('law-nssf-file','2026-12-10','📜 NSSF 新上下限第一次申報（11 月份）','First NSSF filing with the new band (November)','申報前四類人各抽 2–3 人跟 NSSF 系統核對；HRA 審查 → 廠協理核可。'),
    e('law-mw-2027','2027-01-01','📜 2027 最低工資生效：正式 212／試用 210','2027 minimum wage effective: 212 / 210','既有人員職務未變只 +2。'),
    e('law-pension-2027','2027-10-01','📜 退休金第二階段 4% → 8%（預估）','Pension phase 2: 4% → 8% (expected)','等官方公告確認；每月約再多 6,555 美元。'),
    // ── 工人代表、工會
    e('rep-2028','2028-05-28','工人代表任期到期／改選（每 2 年 6 月）','Worker representative term ends / election','每 2 年 6 月改選；結果填到「安全／員工關係 → 委員會」。'),
    h('union-2018','2018-01-01','原有工會成立（2018）','Existing trade union since 2018','現存會員約 12 人；會費名單在「福利／意見箱 → 工會費」。'),
    h('union-2026-11-06','2026-11-06','新工會發出成立選舉通知信','New union: notice of founding election','Independent Free Trade Union at VRT；副本給客戶、CCC、FUFI。'),
    h('union-2026-11-08','2026-11-08','新工會成立選舉（18 人，未註冊）','New union founding election (18 members, unregistered)','上級聯盟 FUFI；選出主席、副主席、秘書、財務。詳見「安全／員工關係 → 委員會 → 工會」。')
  ];
  function addDays(iso,n){var d=new Date(iso+'T00:00:00');d.setDate(d.getDate()+n);var m=String(d.getMonth()+1).padStart(2,'0'),dd=String(d.getDate()).padStart(2,'0');return d.getFullYear()+'-'+m+'-'+dd;}
  return {list:list,addDays:addDays};
})();
function applyInspectSeed(){
  if(typeof DB==='undefined'||!window.HRAInspectSeed)return false;
  var removed=new Set([].concat(CAL_SETTINGS.sourceCalendarRemoved76||[],CAL_SETTINGS.inspectRemoved||[],CHANGE_LOG.filter(function(x){return x.action==='delete'}).map(function(x){return x.recordId})));
  var changed=false,has=function(y,id){return (DB[y]||[]).some(function(x){return x.id===id})};
  HRAInspectSeed.list.forEach(function(r){var y=r.date.slice(0,4);if(removed.has(r.id)||has(y,r.id))return;DB[y]=DB[y]||[];DB[y].push(JSON.parse(JSON.stringify(r)));changed=true;});
  // ⏰ 一週前提醒：每筆檢查／稽核（type inspect）自動加一筆
  Object.keys(DB).forEach(function(y){(DB[y]||[]).slice().forEach(function(r){
    if(r.type!=='inspect'||!r.date)return;var rid=r.id+'-r7',rd=HRAInspectSeed.addDays(r.date,-7),ry=rd.slice(0,4);if(removed.has(rid))return;
    var all=[];Object.keys(DB).forEach(function(k){all=all.concat(DB[k]||[])});var cur=all.find(function(x){return x.id===rid});
    var zh='⏰ 一週後：'+r.zh,en='⏰ In 1 week: '+(r.en||r.zh);
    if(cur){if(cur.date!==rd||cur.zh!==zh){Object.keys(DB).forEach(function(k){DB[k]=(DB[k]||[]).filter(function(x){return x.id!==rid})});cur=null;}else return;}
    DB[ry]=DB[ry]||[];DB[ry].push({id:rid,date:rd,enddate:'',type:'remind',days:1,zh:zh,en:en,km:zh,note:'提醒：'+r.date+' '+r.zh+(r.note?'\n'+r.note:''),refdate:r.date,source:'auto 7-day reminder',countsAsHoliday:false,sourceRevision:'inspect-v1'});changed=true;
  })});
  // 原本的檢查已刪掉 → 對應提醒也拿掉
  var ids=new Set();Object.keys(DB).forEach(function(k){(DB[k]||[]).forEach(function(x){ids.add(x.id)})});
  Object.keys(DB).forEach(function(k){var n=(DB[k]||[]).length;DB[k]=(DB[k]||[]).filter(function(x){return x.type!=='remind'||!/-r7$/.test(x.id)||ids.has(x.id.slice(0,-3))});if(DB[k].length!==n)changed=true;});
  if(changed){try{LAST_SAVED_DB=clone(DB);saveDB(false);}catch(e){}}
  return changed;
}
