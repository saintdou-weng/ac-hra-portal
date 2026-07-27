/* ═══════════════════════════════════════════════════════════════════════
   AC HRA Portal — shared/hra-core.js  v1.0
   全平台共用核心：三語 i18n + 匯入欄位統一 + 期間工具
   ───────────────────────────────────────────────────────────────────────
   解決三件事：
   ① 三語（繁中 / English / ខ្មែរ）一次補齊，各模組只要加 data-i18n
   ② 匯入欄位統一：empId 為唯一標準工號欄，各模組舊名自動對映
      （入離職 empId／產假 idNo·cardId／證件 employeeId → 全部正規化為 empId）
   ③ 期間工具與 payroll 式列表共用，不必每個模組各寫一份
   ───────────────────────────────────────────────────────────────────────
   掛法（放在各 HTML 的 </body> 前，approval.js 之前）：
     <script src="./shared/hra-core.js"></script>
     <script src="./shared/approval.js"></script>
   ═══════════════════════════════════════════════════════════════════════ */
(function (G) {
'use strict';

var K_LANG = 'ac_hra_lang';

/* ═══════════ ① 三語字典 ═══════════ */
var DICT = {
zh: {
  /* 通用動作 */
  save:'儲存', cancel:'取消', edit:'編輯', del:'刪除', add:'新增', confirm:'確認',
  close:'關閉', search:'搜尋', reset:'重置', refresh:'重新整理', open:'開啟',
  upload:'上傳', download:'下載', export:'匯出', import:'匯入', restore:'還原',
  submit:'送出', preview:'預覽', send:'傳送', print:'列印', all:'全部',
  /* 期間 */
  day:'日', week:'週', month:'月', year:'年', period:'期間', today:'今天',
  prev:'上一個', next:'下一個', periodReport:'期間報表', clickRow:'點選任一列可切換期間',
  /* 欄位 */
  empId:'工號', name:'姓名', engName:'英文名', dept:'部門', line:'線別', group:'組別',
  position:'職務', gender:'性別', male:'男', female:'女', age:'年齡', birthday:'生日',
  phone:'電話', address:'地址', remark:'備註', status:'狀態', amount:'金額',
  count:'人數', rows:'筆', total:'合計', pct:'佔比', date:'日期', avg:'平均',
  /* 狀態 */
  active:'在職', resigned:'離職', pending:'待核可', approved:'已核可',
  rejected:'已退件', returned:'已退回', waived:'免核可', done:'已完成',
  applied:'已申請', expired:'已過期', expiring:'即將到期', renewed:'已續期',
  /* 雲端 / TG */
  cloud:'雲端', cloudUp:'上傳至雲端', cloudDown:'從雲端下載', cloudNone:'雲端尚無資料',
  syncing:'同步中…', synced:'已同步', syncFail:'同步失敗',
  tgSummary:'摘要', tgApproval:'核可', bilingual:'雙語', content:'內容來源',
  /* 匯入 */
  smartImport:'智慧匯入', dropHint:'拖放或點選檔案，系統自動判斷類型',
  importReport:'匯入報告', added:'新增', updated:'更新', skipped:'略過', invalid:'無效',
  dedupBy:'依工號去重，重複匯入不會新增重複資料',
  /* 線上操作 */
  onlineNew:'線上新增', onlineEdit:'線上編輯', submitAppr:'送出核可', selectFirst:'請先勾選項目',
  /* 訊息 */
  noData:'無資料', noRecord:'此期間沒有記錄', saved:'已儲存', deleted:'已刪除',
  required:'必填', confirmDelete:'確定刪除？', loading:'載入中…'
},
en: {
  save:'Save', cancel:'Cancel', edit:'Edit', del:'Delete', add:'Add', confirm:'Confirm',
  close:'Close', search:'Search', reset:'Reset', refresh:'Refresh', open:'Open',
  upload:'Upload', download:'Download', export:'Export', import:'Import', restore:'Restore',
  submit:'Submit', preview:'Preview', send:'Send', print:'Print', all:'All',
  day:'Day', week:'Week', month:'Month', year:'Year', period:'Period', today:'Today',
  prev:'Prev', next:'Next', periodReport:'Period Report', clickRow:'Click a row to switch period',
  empId:'ID', name:'Name', engName:'English Name', dept:'Dept', line:'Line', group:'Group',
  position:'Position', gender:'Gender', male:'Male', female:'Female', age:'Age', birthday:'Birthday',
  phone:'Phone', address:'Address', remark:'Remark', status:'Status', amount:'Amount',
  count:'Count', rows:'rows', total:'Total', pct:'%', date:'Date', avg:'Avg',
  active:'Active', resigned:'Resigned', pending:'Pending', approved:'Approved',
  rejected:'Rejected', returned:'Returned', waived:'Waived', done:'Done',
  applied:'Applied', expired:'Expired', expiring:'Expiring', renewed:'Renewed',
  cloud:'Cloud', cloudUp:'Upload to cloud', cloudDown:'Download from cloud', cloudNone:'No cloud data',
  syncing:'Syncing…', synced:'Synced', syncFail:'Sync failed',
  tgSummary:'Summary', tgApproval:'Approval', bilingual:'Bilingual', content:'Content',
  smartImport:'Smart Import', dropHint:'Drag & drop or click — type auto-detected',
  importReport:'Import Report', added:'New', updated:'Updated', skipped:'Skipped', invalid:'Invalid',
  dedupBy:'De-duplicated by employee ID — re-importing will not create duplicates',
  onlineNew:'New Entry', onlineEdit:'Edit', submitAppr:'Submit for Approval', selectFirst:'Select items first',
  noData:'No data', noRecord:'No records in this period', saved:'Saved', deleted:'Deleted',
  required:'Required', confirmDelete:'Delete this?', loading:'Loading…'
},
km: {
  save:'រក្សាទុក', cancel:'បោះបង់', edit:'កែ', del:'លុប', add:'បន្ថែម', confirm:'បញ្ជាក់',
  close:'បិទ', search:'ស្វែងរក', reset:'កំណត់ឡើងវិញ', refresh:'ផ្ទុកឡើងវិញ', open:'បើក',
  upload:'ផ្ទុកឡើង', download:'ទាញយក', export:'នាំចេញ', import:'នាំចូល', restore:'ស្តារ',
  submit:'ដាក់ស្នើ', preview:'មើលជាមុន', send:'ផ្ញើ', print:'បោះពុម្ព', all:'ទាំងអស់',
  day:'ថ្ងៃ', week:'សប្តាហ៍', month:'ខែ', year:'ឆ្នាំ', period:'ដំណាក់កាល', today:'ថ្ងៃនេះ',
  prev:'មុន', next:'បន្ទាប់', periodReport:'របាយការណ៍', clickRow:'ចុចជួរដើម្បីប្តូរ',
  empId:'លេខសម្គាល់', name:'ឈ្មោះ', engName:'ឈ្មោះអង់គ្លេស', dept:'ផ្នែក', line:'ខ្សែ', group:'ក្រុម',
  position:'តំណែង', gender:'ភេទ', male:'ប្រុស', female:'ស្រី', age:'អាយុ', birthday:'ថ្ងៃកំណើត',
  phone:'ទូរស័ព្ទ', address:'អាសយដ្ឋាន', remark:'កំណត់សម្គាល់', status:'ស្ថានភាព', amount:'ចំនួនទឹកប្រាក់',
  count:'ចំនួន', rows:'ជួរ', total:'សរុប', pct:'ភាគរយ', date:'កាលបរិច្ឆេទ', avg:'មធ្យម',
  active:'កំពុងធ្វើការ', resigned:'ចេញ', pending:'រង់ចាំ', approved:'អនុម័ត',
  rejected:'បដិសេធ', returned:'ត្រឡប់', waived:'លើកលែង', done:'រួចរាល់',
  applied:'បានដាក់ពាក្យ', expired:'ផុតកំណត់', expiring:'ជិតផុតកំណត់', renewed:'បានបន្ត',
  cloud:'ពពក', cloudUp:'ផ្ទុកឡើងពពក', cloudDown:'ទាញពីពពក', cloudNone:'គ្មានទិន្នន័យ',
  syncing:'កំពុងធ្វើសមកាលកម្ម…', synced:'បានធ្វើសមកាលកម្ម', syncFail:'បរាជ័យ',
  tgSummary:'សេចក្តីសង្ខេប', tgApproval:'អនុម័ត', bilingual:'ពីរភាសា', content:'ប្រភពខ្លឹមសារ',
  smartImport:'នាំចូលឆ្លាតវៃ', dropHint:'អូសទម្លាក់ ឬចុចដើម្បីជ្រើសឯកសារ',
  importReport:'របាយការណ៍នាំចូល', added:'ថ្មី', updated:'បានកែ', skipped:'រំលង', invalid:'មិនត្រឹមត្រូវ',
  dedupBy:'ដកស្ទួនតាមលេខសម្គាល់បុគ្គលិក',
  onlineNew:'បញ្ចូលថ្មី', onlineEdit:'កែ', submitAppr:'ដាក់ស្នើអនុម័ត', selectFirst:'សូមជ្រើសរើសជាមុន',
  noData:'គ្មានទិន្នន័យ', noRecord:'គ្មានកំណត់ត្រា', saved:'បានរក្សាទុក', deleted:'បានលុប',
  required:'ត្រូវការ', confirmDelete:'លុបមែនទេ?', loading:'កំពុងផ្ទុក…'
}
};

var _lang = 'zh';
try { _lang = localStorage.getItem(K_LANG) || 'zh'; } catch (e) {}

function t(k) { var d = DICT[_lang] || DICT.zh; return d[k] !== undefined ? d[k] : (DICT.zh[k] || k); }
/* 三語自由取值：L('中','en','km') 或 L('中','en') */
function L(zh, en, km) { return _lang === 'en' ? en : _lang === 'km' ? (km || en) : zh; }
function lang() { return _lang; }
function setLang(v) {
  _lang = (['zh','en','km'].indexOf(v) >= 0) ? v : 'zh';
  try { localStorage.setItem(K_LANG, _lang); } catch (e) {}
  apply();
  if (typeof G.onLangChange === 'function') { try { G.onLangChange(_lang); } catch (e) {} }
  if (typeof G.renderAll === 'function')    { try { G.renderAll(); } catch (e) {} }
}
/* 套用到 DOM：data-i18n / data-i18n-ph / data-i18n-title */
function apply(root) {
  var r = root || (typeof document !== 'undefined' ? document : null);
  if (!r || typeof r.querySelectorAll !== 'function') return;   /* 無 DOM 環境安全略過 */
  r.querySelectorAll('[data-i18n]').forEach(function (n) {
    var v = t(n.getAttribute('data-i18n')); if (v != null) n.textContent = v;
  });
  r.querySelectorAll('[data-i18n-ph]').forEach(function (n) {
    var v = t(n.getAttribute('data-i18n-ph')); if (v != null) n.placeholder = v;
  });
  r.querySelectorAll('[data-i18n-title]').forEach(function (n) {
    var v = t(n.getAttribute('data-i18n-title')); if (v != null) n.title = v;
  });
  r.querySelectorAll('[data-lang-btn]').forEach(function (n) {
    n.classList.toggle('on', n.getAttribute('data-lang-btn') === _lang);
  });
}
/* 語言切換鈕 HTML */
function toggleHTML() {
  return ['zh','en','km'].map(function (lg) {
    var lbl = lg === 'zh' ? '繁中' : lg === 'en' ? 'EN' : 'ខ្មែរ';
    return '<button data-lang-btn="' + lg + '" onclick="HRA.setLang(\'' + lg + '\')" ' +
           'class="hra-lb' + (_lang === lg ? ' on' : '') + '">' + lbl + '</button>';
  }).join('');
}
/* 允許模組補自己的字典 */
function extend(more) {
  ['zh','en','km'].forEach(function (lg) {
    if (more[lg]) Object.keys(more[lg]).forEach(function (k) { DICT[lg][k] = more[lg][k]; });
  });
}

/* ═══════════════════════════════════════════════════════════════════════
   ② 匯入欄位統一
   標準欄名（canonical）：所有模組一律使用這組，舊名自動對映
   ═══════════════════════════════════════════════════════════════════════ */
var FIELD_ALIAS = {
  /* ★ 工號：全平台統一為 empId（原 idNo / cardId / employeeId / card / staffId 都吃） */
  empId      : ['empid','idno','id no','id_no','cardid','card id','card','employeeid','employee id',
                'staffid','staff id','工號','工号','編號','员工号','emp no','emp id'],
  name       : ['name','fullname','full name','姓名','employee name','emp name','staff name'],
  engName    : ['engname','english name','eng name','英文名','latin name'],
  dept       : ['dept','department','部門','部门','section','division'],
  line       : ['line','sewing line','線別','线别','production line'],
  group      : ['group','team','組別','组别','grp'],
  position   : ['position','title','job title','職務','职务','post','designation'],
  gender     : ['gender','sex','性別','性别'],
  birthday   : ['birthday','birth date','date of birth','dob','生日','出生日期'],
  age        : ['age','年齡','年龄'],
  phone      : ['phone','tel','telephone','mobile','contact','電話','电话','聯絡電話'],
  address    : ['address','addr','地址'],
  joinDate   : ['joindate','join date','entry date','hire date','入職日','入职日','date joined','start date'],
  resignDate : ['resigndate','resign date','leave date','last day','離職日','离职日','date left'],
  amount     : ['amount','total','net','netpay','net pay','金額','金额','pay','salary amount'],
  nssfNo     : ['nssf','nssf no','nssfno','nssf number','社保號'],
  passportNo : ['passport','passport no','passportno','護照','护照','passport number'],
  expiryDate : ['expiry','expiry date','expire date','valid until','到期日','有效期至','exp date'],
  remark     : ['remark','remarks','note','notes','comment','備註','备注','說明']
};

/* 反查表：alias → canonical */
var _rev = {};
Object.keys(FIELD_ALIAS).forEach(function (canon) {
  _rev[canon.toLowerCase()] = canon;
  FIELD_ALIAS[canon].forEach(function (a) { _rev[String(a).toLowerCase()] = canon; });
});

var SERIAL_HDR = ['no','no.','#','seq','item','序','序號','序号','編號no'];
function normKey(h) {
  var s = String(h == null ? '' : h).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!s) return null;
  /* 列序號欄一律不當成工號（否則工號會被填成 1,2,3…） */
  if (SERIAL_HDR.indexOf(s) >= 0) return null;
  if (_rev[s]) return _rev[s];
  /* 去掉尾端標點再試一次：'ID No.' → 'id no' */
  var s2 = s.replace(/[.．:：、,，;；]+$/, '').trim();
  if (s2 !== s && _rev[s2]) return _rev[s2];
  return null;
}
/* 表頭陣列 → { canonicalField: columnIndex } */
function mapHeader(headerRow) {
  var map = {};
  (headerRow || []).forEach(function (h, i) {
    var c = normKey(h);
    if (c && map[c] === undefined) map[c] = i;
  });
  return map;
}
/* 任一物件 → 正規化為標準欄名（保留原欄位，另加標準欄） */
function normalizeRow(row) {
  if (!row || typeof row !== 'object') return row;
  var out = {}, k;
  for (k in row) if (Object.prototype.hasOwnProperty.call(row, k)) out[k] = row[k];
  for (k in row) {
    if (!Object.prototype.hasOwnProperty.call(row, k)) continue;
    var c = normKey(k);
    if (c && (out[c] === undefined || out[c] === '')) out[c] = row[k];
  }
  /* 工號一律轉字串、去小數尾 */
  if (out.empId != null) out.empId = String(out.empId).trim().replace(/\.0+$/, '');
  return out;
}
/* 標準工號取值：吃任何舊欄名 */
function empIdOf(r) {
  if (!r) return '';
  var v = r.empId || r.idNo || r.cardId || r.employeeId || r.staffId || r.id || '';
  var s = String(v).trim().replace(/\.0+$/, '').replace(/\s+/g, '');
  return /^\d{2,6}$/.test(s) ? s : '';
}

/* ═══════════ ③ 期間工具（各模組共用） ═══════════ */
function p2(n) { return (n < 10 ? '0' : '') + n; }
function lds(d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
function addMonths(d, n) {
  var y = d.getFullYear(), m = d.getMonth() + n, day = d.getDate();
  var last = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(day, last));
}
/* Excel 序號 → YYYY-MM-DD（時區安全，禁 toISOString） */
function xdate(v) {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number' && isFinite(v)) {
    if (v < 20 || v > 80000) return '';
    var d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    return d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate());
  }
  if (v instanceof Date) return isNaN(v.getTime()) ? '' : lds(v);
  var s = String(v).trim(); if (!s || /^#/.test(s)) return '';
  var m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
  if (m) return m[1] + '-' + p2(+m[2]) + '-' + p2(+m[3]);
  m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})$/);
  if (m) { var y = +m[3]; if (y < 100) y += 2000; return y + '-' + p2(+m[2]) + '-' + p2(+m[1]); }
  var n = Number(s);
  return (isFinite(n) && n > 20 && n < 80000) ? xdate(n) : '';
}
function dayDiff(a, b) {
  if (!a || !b) return null;
  return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
}
function today() { return lds(new Date()); }

/* ═══════════ ④ 到期狀態（證件 / 簽證 / 合約共用）
   規則：不再無止盡列出未來到期日；改用「狀態 + 備註」呈現
     已完成/已續期 → done      （顯示完成日）
     已申請中      → applied   （顯示備註）
     ≤ 45 天       → expiring  （提醒）
     已過期        → expired
     其餘（含 2027 以後）→ future，列表預設不顯示，只在備註欄註記
   ═══════════ */
function expiryState(expiry, opts) {
  opts = opts || {};
  var horizon = opts.horizonDays || 365;      /* 預設只看一年內 */
  if (opts.completed) return { key:'done',    label:t('done'),     cls:'ok'   };
  if (opts.applied)   return { key:'applied', label:t('applied'),  cls:'info' };
  if (!expiry)        return { key:'none',    label:'—',           cls:'mute' };
  var d = dayDiff(today(), expiry);
  if (d === null)     return { key:'none',    label:'—',           cls:'mute' };
  if (d < 0)          return { key:'expired', label:t('expired'),  cls:'bad',  days:d };
  if (d <= 45)        return { key:'expiring',label:t('expiring'), cls:'warn', days:d };
  if (d > horizon)    return { key:'future',  label:'',            cls:'mute', days:d, hide:true };
  return { key:'ok', label:'', cls:'ok', days:d };
}

G.HRA = {
  /* i18n */
  t:t, L:L, lang:lang, setLang:setLang, apply:apply, toggleHTML:toggleHTML, extend:extend, DICT:DICT,
  /* 欄位統一 */
  FIELD_ALIAS:FIELD_ALIAS, normKey:normKey, mapHeader:mapHeader, normalizeRow:normalizeRow, empIdOf:empIdOf,
  /* 期間 / 日期 */
  p2:p2, lds:lds, addMonths:addMonths, xdate:xdate, dayDiff:dayDiff, today:today,
  /* 到期 */
  expiryState:expiryState
};
/* 舊碼相容：HRA.I18N.xxx 仍可用 */
G.HRA.I18N = { t:t, apply:apply, setLang:setLang, toggleHTML:toggleHTML, get _lang(){ return _lang; } };

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { apply(); });
  else apply();
}

})(typeof window !== 'undefined' ? window : this);
