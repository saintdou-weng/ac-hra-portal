/* AC HRA Attendance — independent employee leave register v1.0
 *
 * Records are synchronized under the dedicated `attendance_leave` tool.
 * Evidence files live in Drive through HRAAttachments; records contain only
 * links/metadata so mobile incremental sync remains small and reliable.
 */
(function (g) {
  'use strict';
  if (g.AttendanceLeave) return;

  var KEY = 'ac_hra_attendance_leave_v1';
  var TOOL = 'attendance_leave';
  var rows = readRows();
  var mode = 'month';
  var focus = localDate(new Date()).slice(0, 7);
  var editing = '';
  var autoTimer = 0;
  var ready = false;
  var uiLang = '';

  var LEAVE_TYPES = [
    ['annual','年假','Annual leave','ការឈប់សម្រាកប្រចាំឆ្នាំ'],
    ['sick','病假','Sick leave','ច្បាប់ឈឺ'],
    ['medical','有薪醫療假','Paid medical leave','ច្បាប់ពេទ្យមានប្រាក់ឈ្នួល'],
    ['personal','事假','Personal leave','ច្បាប់ផ្ទាល់ខ្លួន'],
    ['maternity','產假','Maternity leave','ច្បាប់សម្ភព'],
    ['injury','工傷假','Work-injury leave','ច្បាប់របួសការងារ'],
    ['marriage','婚假','Marriage leave','ច្បាប់អាពាហ៍ពិពាហ៍'],
    ['funeral','喪假','Funeral leave','ច្បាប់បុណ្យសព'],
    ['business','公假／出差','Official leave / Business trip','ច្បាប់ការងារ / បេសកកម្ម'],
    ['unpaid','無薪假','Unpaid leave','ច្បាប់គ្មានប្រាក់ឈ្នួល'],
    ['absent','曠工','Absent without leave','អវត្តមានគ្មានច្បាប់'],
    ['other','其他','Other','ផ្សេងៗ']
  ];

  function language() {
    try { if (typeof LANG !== 'undefined' && /^(zh|en|km)$/.test(LANG)) return LANG; } catch (_) {}
    try { return localStorage.getItem('vrt_att_v5_lang') || localStorage.getItem('ac_hra_lang') || 'zh'; } catch (_) { return 'zh'; }
  }
  function L(zh, en, km) { var x = language(); return x === 'km' ? (km || en) : x === 'en' ? en : zh; }
  function esc(v) { return String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function tgEsc(v) { return String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function notify(msg, type) { try { if (typeof toast === 'function') return toast(msg, type || 'info'); } catch (_) {} alert(msg); }
  function uid() { return 'LV-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7); }
  function p2(n) { return n < 10 ? '0' + n : String(n); }
  function localDate(d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
  function nowIso() { return new Date().toISOString(); }
  function parseDate(v) {
    if (!v && v !== 0) return '';
    if (typeof v === 'number' && isFinite(v) && g.XLSX && XLSX.SSF && XLSX.SSF.parse_date_code) {
      var dc = XLSX.SSF.parse_date_code(v); if (dc) return dc.y + '-' + p2(dc.m) + '-' + p2(dc.d);
    }
    if (v instanceof Date && !isNaN(v)) return localDate(v);
    var s = String(v).trim(), m = s.match(/(20\d{2})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
    if (m) return m[1] + '-' + p2(+m[2]) + '-' + p2(+m[3]);
    m = s.match(/(\d{1,2})[-\/.](\d{1,2})[-\/.](20\d{2})/);
    if (m) return m[3] + '-' + p2(+m[2]) + '-' + p2(+m[1]);
    var d = new Date(s); return isNaN(d) ? '' : localDate(d);
  }
  function readRows() { try { var a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (_) { return []; } }
  function saveRows(noAuto) {
    try { localStorage.setItem(KEY, JSON.stringify(rows)); } catch (e) { notify(L('本機儲存失敗：','Local save failed: ','រក្សាទុកក្នុងម៉ាស៊ីនបរាជ័យ៖ ') + e.message, 'err'); }
    if (!noAuto) schedulePush();
  }
  function gasUrl() {
    try {
      if (typeof GAS_URL !== 'undefined' && GAS_URL) return String(GAS_URL).trim();
      return String(localStorage.getItem('vrt_att_cloud_v1_url') || localStorage.getItem('ac_hra_gas_url') || '').trim();
    } catch (_) { return ''; }
  }
  function typeDef(code) { return LEAVE_TYPES.filter(function (x) { return x[0] === code; })[0] || LEAVE_TYPES[LEAVE_TYPES.length - 1]; }
  function typeName(code, lang) { var x = typeDef(code), l = lang || language(); return l === 'km' ? x[3] : l === 'en' ? x[2] : x[1]; }
  function typeOptions(selected) { return LEAVE_TYPES.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === selected ? ' selected' : '') + '>' + esc(typeName(x[0])) + '</option>'; }).join(''); }
  function statusName(s) {
    var d = { draft:[L('草稿','Draft','ព្រាង'),'bi'], pending:[L('待核可','Pending','រង់ចាំអនុម័ត'),'bw'], approved:[L('已核可','Approved','បានអនុម័ត'),'bg'], rejected:[L('已退件','Rejected','បានបដិសេធ'),'bb'], returned:[L('已退回','Returned','បានត្រឡប់'),'bb'], waived:[L('免核可','Waived','លើកលែង'),'bi'] };
    return d[s] || d.draft;
  }
  function daysBetween(start, end, part) {
    var a = new Date(start + 'T00:00:00'), b = new Date(end + 'T00:00:00');
    if (!start || !end || isNaN(a) || isNaN(b) || b < a) return 0;
    var n = Math.round((b - a) / 86400000) + 1;
    if (n === 1 && (part === 'am' || part === 'pm')) return 0.5;
    return n;
  }
  function calcHours(startTime, endTime) {
    if (!startTime || !endTime) return 0;
    var a = startTime.split(':').map(Number), b = endTime.split(':').map(Number), n = (b[0] * 60 + b[1]) - (a[0] * 60 + a[1]);
    return n > 0 ? Math.round(n / 6) / 10 : 0;
  }
  function overlaps(a1, a2, b1, b2) { return a1 && a2 && b1 && b2 && a1 <= b2 && b1 <= a2; }
  function duplicate(rec, skip) {
    var id = String(rec.empId || '').trim().toUpperCase();
    return rows.filter(function (r) { return r._k !== skip && String(r.empId || '').trim().toUpperCase() === id && overlaps(rec.startDate, rec.endDate, r.startDate, r.endDate); })[0] || null;
  }
  function startOfWeek(v) {
    var d = new Date((v.length >= 10 ? v : localDate(new Date())) + 'T00:00:00'), day = d.getDay() || 7;
    d.setDate(d.getDate() - day + 1); return localDate(d);
  }
  function addDays(v, n) { var d = new Date(v + 'T00:00:00'); d.setDate(d.getDate() + n); return localDate(d); }
  function addMonths(v, n) { var d = new Date(v.slice(0,7) + '-01T00:00:00'); d.setMonth(d.getMonth() + n); return localDate(d).slice(0,7); }
  function periodRange() {
    if (mode === 'day') return [focus, focus];
    if (mode === 'week') { var w = startOfWeek(focus); return [w, addDays(w, 6)]; }
    if (mode === 'year') return [focus.slice(0,4) + '-01-01', focus.slice(0,4) + '-12-31'];
    var m = focus.slice(0,7), d = new Date(+m.slice(0,4), +m.slice(5,7), 0); return [m + '-01', localDate(d)];
  }
  function periodLabel() { var r = periodRange(); return mode === 'day' ? r[0] : mode === 'week' ? r[0] + ' — ' + r[1] : mode === 'year' ? focus.slice(0,4) : focus.slice(0,7); }
  function filtered() {
    var range = periodRange(), q = String(value('al-search') || '').trim().toLowerCase(), dept = value('al-dept'), typ = value('al-type'), stat = value('al-status');
    return rows.filter(function (r) {
      if (!overlaps(r.startDate, r.endDate, range[0], range[1])) return false;
      if (dept && r.dept !== dept) return false;
      if (typ && r.leaveType !== typ) return false;
      if (stat && r.status !== stat) return false;
      if (q && [r.empId,r.name,r.dept,r.section,r.position,r.reason,r.note].join(' ').toLowerCase().indexOf(q) < 0) return false;
      return true;
    }).sort(function (a,b) { return String(b.startDate).localeCompare(String(a.startDate)) || String(a.empId).localeCompare(String(b.empId)); });
  }
  function value(id) { var e = document.getElementById(id); return e ? e.value : ''; }
  function setValue(id, v) { var e = document.getElementById(id); if (e) e.value = v == null ? '' : v; }
  function evidenceHtml(items) {
    var links = g.HRAAttachments ? HRAAttachments.links(items || []) : [];
    if (!links.length) return '—';
    return links.map(function (u, i) { return '<a href="' + esc(u) + '" target="_blank" rel="noopener" title="Evidence">📎' + (i + 1) + '</a>'; }).join(' ');
  }
  function approvalFingerprint(r) {
    r = r || {};
    return JSON.stringify({ empId:r.empId||'', name:r.name||'', dept:r.dept||'', section:r.section||'', position:r.position||'',
      leaveType:r.leaveType||'', startDate:r.startDate||'', endDate:r.endDate||'', dayPart:r.dayPart||'', startTime:r.startTime||'', endTime:r.endTime||'',
      reason:r.reason||'', note:r.note||'', substitute:r.substitute||'', supervisor:r.supervisor||'', factoryDirector:r.factoryDirector||'', hrReviewer:r.hrReviewer||'', adminManager:r.adminManager||'',
      annualApplied:Number(r.annualApplied||0), annualAccrued:Number(r.annualAccrued||0), annualBalance:Number(r.annualBalance||0),
      evidence:(r.evidence||[]).map(function(a){return a && (a.id||a.url||a.name)||'';}) });
  }

  function injectStyle() {
    if (document.getElementById('attendance-leave-style')) return;
    var s = document.createElement('style'); s.id = 'attendance-leave-style';
    s.textContent = '.al-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.al-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.al-field{display:flex;flex-direction:column;gap:4px}.al-field label{font-size:10px;font-weight:700;color:#64748b}.al-field input,.al-field select,.al-field textarea{width:100%;border:1px solid #d0d5e8;border-radius:7px;padding:8px;font:inherit;background:#fff}.al-field textarea{min-height:70px;resize:vertical}.al-wide{grid-column:1/-1}.al-modal{display:none;position:fixed;inset:0;background:rgba(15,23,42,.58);z-index:850;align-items:center;justify-content:center;padding:12px}.al-modal.on{display:flex}.al-dialog{background:#fff;border-radius:13px;width:720px;max-width:100%;max-height:94vh;overflow:auto;padding:18px;box-shadow:0 18px 45px rgba(15,23,42,.28)}.al-dialog-lg{width:1050px}.al-title{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:14px}.al-close{border:0;background:transparent;font-size:22px;cursor:pointer}.al-batch td{padding:4px}.al-batch input,.al-batch select{min-width:100px;width:100%;padding:6px;border:1px solid #d0d5e8;border-radius:5px}.al-actions{display:flex;gap:5px;justify-content:center}.al-mini{border:1px solid #cbd5e1;background:#fff;border-radius:5px;padding:4px 7px;cursor:pointer}.al-mini.danger{color:#be123c;border-color:#fecdd3}.al-period button.on{background:#1a6e5c;color:#fff}.al-sync{font-size:10px;color:#64748b;min-width:160px}@media(max-width:680px){.al-grid{grid-template-columns:1fr}.al-wide{grid-column:auto}.al-dialog{padding:13px}.al-toolbar .btn{padding:7px 10px}.al-batch{min-width:980px}}';
    document.head.appendChild(s);
  }
  function initUI() {
    var root = document.getElementById('sec-leave'); if (!root) return;
    injectStyle();
    root.innerHTML = '<div class="card"><div class="al-toolbar al-period">' +
      '<button class="btn btn-g" data-mode="day" onclick="AttendanceLeave.setMode(\'day\')">' + L('日','Day','ថ្ងៃ') + '</button>' +
      '<button class="btn btn-g" data-mode="week" onclick="AttendanceLeave.setMode(\'week\')">' + L('週','Week','សប្ដាហ៍') + '</button>' +
      '<button class="btn btn-g" data-mode="month" onclick="AttendanceLeave.setMode(\'month\')">' + L('月','Month','ខែ') + '</button>' +
      '<button class="btn btn-g" data-mode="year" onclick="AttendanceLeave.setMode(\'year\')">' + L('年','Year','ឆ្នាំ') + '</button>' +
      '<button class="btn btn-g" onclick="AttendanceLeave.nav(-1)">◀</button><span id="al-period-input"></span><button class="btn btn-g" onclick="AttendanceLeave.nav(1)">▶</button>' +
      '<span id="al-period-label" style="font:700 12px monospace;color:#64748b"></span></div></div>' +
      '<div class="card"><div class="al-toolbar">' +
      '<button class="btn btn-p" onclick="AttendanceLeave.open()">＋ ' + L('新增','Add','បន្ថែម') + '</button>' +
      '<button class="btn btn-g" onclick="AttendanceLeave.openBatch()">☷ ' + L('列表新增','List entry','បញ្ចូលជាបញ្ជី') + '</button>' +
      '<button class="btn btn-t" onclick="AttendanceLeave.openTelegram()">✈ ' + L('Telegram 摘要／核可','Telegram summary / approval','សង្ខេប / អនុម័ត Telegram') + '</button>' +
      '<button class="btn btn-g" onclick="AttendanceLeave.cloudPush(false)">☁↑ ' + L('上傳','Upload','ផ្ទុកឡើង') + '</button>' +
      '<button class="btn btn-g" onclick="AttendanceLeave.cloudPull()">☁↓ ' + L('下載','Download','ទាញយក') + '</button>' +
      '<label class="btn btn-g" style="cursor:pointer">📥 ' + L('匯入','Import','នាំចូល') + '<input id="al-import" type="file" accept=".xlsx,.xls,.csv,.json" hidden onchange="AttendanceLeave.importFile(this.files[0]);this.value=\'\'"></label>' +
      '<button class="btn btn-g" onclick="AttendanceLeave.exportXlsx()">⬇ XLSX</button>' +
      '<button class="btn btn-g" onclick="AttendanceLeave.syncApproval()">↻ ' + L('同步核可','Sync approvals','ធ្វើសមកាលកម្មអនុម័ត') + '</button><span class="al-sync" id="al-sync"></span></div></div>' +
      '<div id="al-kpis" class="kpi-strip"></div>' +
      '<div class="card"><div class="al-toolbar" style="margin-bottom:12px">' +
      '<input id="al-search" oninput="AttendanceLeave.refresh()" placeholder="' + esc(L('搜尋工號／姓名／部門／職位','Search ID / name / dept / position','ស្វែងរក ID / ឈ្មោះ / ផ្នែក / មុខតំណែង')) + '" style="flex:1;min-width:210px;border:1px solid #d0d5e8;border-radius:7px;padding:8px">' +
      '<select id="al-dept" onchange="AttendanceLeave.refresh()"></select><select id="al-type" onchange="AttendanceLeave.refresh()"></select><select id="al-status" onchange="AttendanceLeave.refresh()"></select><span id="al-count" style="color:#64748b;font:11px monospace"></span></div>' +
      '<div class="twrap"><table class="dtbl" style="min-width:1120px"><thead><tr><th>#</th><th>' + L('工號／姓名','ID / Name','ID / ឈ្មោះ') + '</th><th>' + L('部門／組別／職位','Dept / Section / Position','ផ្នែក / ក្រុម / មុខតំណែង') + '</th><th>' + L('請假別','Leave type','ប្រភេទច្បាប់') + '</th><th>' + L('日期','Dates','កាលបរិច្ឆេទ') + '</th><th>' + L('天數','Days','ថ្ងៃ') + '</th><th>' + L('原因／備註','Reason / Note','មូលហេតុ / កំណត់សម្គាល់') + '</th><th>' + L('佐證','Evidence','ភស្តុតាង') + '</th><th>' + L('狀態','Status','ស្ថានភាព') + '</th><th>' + L('操作','Actions','សកម្មភាព') + '</th></tr></thead><tbody id="al-body"></tbody></table></div></div>' +
      modalHtml() + batchHtml() + telegramHtml();
    ready = true;
    uiLang = language();
  }
  function modalHtml() {
    return '<div class="al-modal" id="al-modal"><div class="al-dialog"><div class="al-title"><h3 id="al-modal-title"></h3><button class="al-close" onclick="AttendanceLeave.close(\'al-modal\')">×</button></div><div class="al-grid">' +
      field('al-id',L('工號','Employee ID','លេខសម្គាល់'),'text') + field('al-name',L('姓名','Name','ឈ្មោះ'),'text') +
      field('al-department',L('部門','Department','ផ្នែក'),'text') + field('al-section',L('組別','Section / Line','ក្រុម / ខ្សែ'),'text') + field('al-position',L('職位','Position','មុខតំណែង'),'text') +
      '<div class="al-field"><label>' + L('請假別','Leave type','ប្រភេទច្បាប់') + '</label><select id="al-leave-type">' + typeOptions('annual') + '</select></div>' +
      field('al-start',L('開始日期','Start date','ថ្ងៃចាប់ផ្ដើម'),'date') + field('al-end',L('結束日期','End date','ថ្ងៃបញ្ចប់'),'date') +
      '<div class="al-field"><label>' + L('全天／半天','Full / Half day','ពេញថ្ងៃ / កន្លះថ្ងៃ') + '</label><select id="al-part" onchange="AttendanceLeave.calc()"><option value="full">' + L('全天','Full day','ពេញថ្ងៃ') + '</option><option value="am">' + L('上午半天','AM half-day','ព្រឹកកន្លះថ្ងៃ') + '</option><option value="pm">' + L('下午半天','PM half-day','រសៀលកន្លះថ្ងៃ') + '</option></select></div>' +
      '<div class="al-field"><label>' + L('自動計算天數','Auto-calculated days','ចំនួនថ្ងៃគណនាស្វ័យប្រវត្តិ') + '</label><input id="al-days" readonly></div>' +
      field('al-start-time',L('開始時間（選填）','Start time (optional)','ម៉ោងចាប់ផ្ដើម (ជាជម្រើស)'),'time') + field('al-end-time',L('結束時間（選填）','End time (optional)','ម៉ោងបញ្ចប់ (ជាជម្រើស)'),'time') +
      field('al-annual-applied',L('年假使用（天）','Annual leave used (days)','ថ្ងៃឈប់ប្រចាំឆ្នាំបានប្រើ'),'number') + field('al-annual-accrued',L('年假累計（天）','Annual leave accrued (days)','ថ្ងៃឈប់ប្រចាំឆ្នាំសរុប'),'number') + field('al-annual-balance',L('年假剩餘（天）','Annual leave balance (days)','ថ្ងៃឈប់ប្រចាំឆ្នាំនៅសល់'),'number') +
      field('al-substitute',L('代理人','Substitute','អ្នកជំនួស'),'text') + field('al-supervisor',L('主管','Supervisor','អ្នកគ្រប់គ្រង'),'text') + field('al-factory-director',L('廠長','Factory director','នាយករោងចក្រ'),'text') + field('al-hr-reviewer',L('人事確認','HR confirmation','ការបញ្ជាក់ពី HR'),'text') + field('al-admin-manager',L('管理部經理','Administration manager','អ្នកគ្រប់គ្រងរដ្ឋបាល'),'text') +
      '<div class="al-field al-wide"><label>' + L('請假原因','Reason','មូលហេតុ') + '</label><textarea id="al-reason"></textarea></div><div class="al-field al-wide"><label>' + L('備註','Note','កំណត់សម្គាល់') + '</label><textarea id="al-note"></textarea></div>' +
      '<div class="al-field al-wide"><label>' + L('假單／照片／PDF 佐證','Leave form / photo / PDF evidence','លិខិតច្បាប់ / រូបភាព / PDF') + '</label><div id="al-evidence"></div></div></div>' +
      '<div class="al-toolbar" style="justify-content:flex-end;margin-top:14px"><button class="btn btn-g" onclick="AttendanceLeave.close(\'al-modal\')">' + L('取消','Cancel','បោះបង់') + '</button><button class="btn btn-p" onclick="AttendanceLeave.save()">💾 ' + L('儲存','Save','រក្សាទុក') + '</button></div></div></div>';
  }
  function field(id, label, type) { return '<div class="al-field"><label>' + label + '</label><input id="' + id + '" type="' + type + '"></div>'; }
  function batchHtml() {
    return '<div class="al-modal" id="al-batch-modal"><div class="al-dialog al-dialog-lg"><div class="al-title"><h3>☷ ' + L('列表新增請假人員','List entry — leave employees','បញ្ចូលបុគ្គលិកសុំច្បាប់ជាបញ្ជី') + '</h3><button class="al-close" onclick="AttendanceLeave.close(\'al-batch-modal\')">×</button></div><div class="twrap"><table class="dtbl al-batch"><thead><tr><th>' + L('工號','ID','ID') + '</th><th>' + L('姓名','Name','ឈ្មោះ') + '</th><th>' + L('部門','Dept','ផ្នែក') + '</th><th>' + L('組別','Section','ក្រុម') + '</th><th>' + L('職位','Position','មុខតំណែង') + '</th><th>' + L('假別','Type','ប្រភេទ') + '</th><th>' + L('開始','Start','ចាប់ផ្ដើម') + '</th><th>' + L('結束','End','បញ្ចប់') + '</th><th></th></tr></thead><tbody id="al-batch-body"></tbody></table></div><div class="al-toolbar" style="margin-top:12px"><button class="btn btn-g" onclick="AttendanceLeave.addBatchRow()">＋ ' + L('增加一列','Add row','បន្ថែមជួរ') + '</button><span style="flex:1"></span><button class="btn btn-g" onclick="AttendanceLeave.close(\'al-batch-modal\')">' + L('取消','Cancel','បោះបង់') + '</button><button class="btn btn-p" onclick="AttendanceLeave.saveBatch()">💾 ' + L('儲存全部','Save all','រក្សាទុកទាំងអស់') + '</button></div></div></div>';
  }
  function telegramHtml() {
    return '<div class="al-modal" id="al-tg-modal"><div class="al-dialog"><div class="al-title"><h3>✈ ' + L('Telegram 請假通知','Telegram leave notice','ការជូនដំណឹងច្បាប់តាម Telegram') + '</h3><button class="al-close" onclick="AttendanceLeave.close(\'al-tg-modal\')">×</button></div><div class="al-grid">' +
      '<div class="al-field"><label>' + L('傳送模式','Send mode','របៀបផ្ញើ') + '</label><select id="al-tg-kind" onchange="AttendanceLeave.previewTelegram()"><option value="summary">' + L('摘要通知','Summary notice','សេចក្ដីសង្ខេប') + '</option><option value="approval">' + L('送群組核可','Group approval','ផ្ញើសុំអនុម័តក្រុម') + '</option></select></div>' +
      '<div class="al-field"><label>' + L('語言','Language','ភាសា') + '</label><select id="al-tg-lang" onchange="AttendanceLeave.previewTelegram()"><option value="tri">中文 + English + ខ្មែរ</option><option value="zh">中文</option><option value="en">English</option><option value="km">ខ្មែរ</option></select></div></div>' +
      '<div style="font-size:11px;color:#64748b;margin:10px 0">' + L('依目前日／週／月／年與篩選條件傳送；已送核或已核可資料不會重複送核。','Uses the current day/week/month/year and filters. Pending or approved records cannot be resubmitted.','ផ្ញើតាមរយៈពេល និងតម្រងបច្ចុប្បន្ន។ កំណត់ត្រារង់ចាំ ឬបានអនុម័ត មិនអាចផ្ញើម្ដងទៀត។') + '</div><pre id="al-tg-preview" style="white-space:pre-wrap;background:#182238;color:#edf2f7;border-radius:9px;padding:13px;max-height:420px;overflow:auto;font:12px/1.6 monospace"></pre><div class="al-toolbar" style="justify-content:flex-end;margin-top:12px"><button class="btn btn-g" onclick="AttendanceLeave.close(\'al-tg-modal\')">' + L('取消','Cancel','បោះបង់') + '</button><button id="al-tg-send" class="btn btn-t" onclick="AttendanceLeave.sendTelegram()">📤 ' + L('發送','Send','ផ្ញើ') + '</button></div></div></div>';
  }

  function render() {
    if (uiLang !== language()) ready = false;
    if (!ready || !document.getElementById('al-body')) { ready = false; initUI(); }
    if (!ready) return;
    document.querySelectorAll('#sec-leave [data-mode]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-mode') === mode); });
    renderPeriodInput(); renderFilters(); refresh();
  }
  function renderPeriodInput() {
    var host = document.getElementById('al-period-input'); if (!host) return;
    var typ = mode === 'month' ? 'month' : mode === 'year' ? 'number' : 'date';
    var val = mode === 'year' ? focus.slice(0,4) : mode === 'month' ? focus.slice(0,7) : focus.slice(0,10);
    host.innerHTML = '<input id="al-period" type="' + typ + '" value="' + esc(val) + '"' + (mode === 'year' ? ' min="2000" max="2100"' : '') + ' onchange="AttendanceLeave.setPeriod(this.value)" style="border:1px solid #d0d5e8;border-radius:7px;padding:8px;font:12px monospace">';
    document.getElementById('al-period-label').textContent = periodLabel();
  }
  function renderFilters() {
    var dept = value('al-dept'), typ = value('al-type'), stat = value('al-status');
    var depts = Array.from(new Set(rows.map(function (r) { return r.dept; }).filter(Boolean))).sort();
    document.getElementById('al-dept').innerHTML = '<option value="">' + L('全部部門','All departments','គ្រប់ផ្នែក') + '</option>' + depts.map(function (x) { return '<option' + (x === dept ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('');
    document.getElementById('al-type').innerHTML = '<option value="">' + L('全部假別','All leave types','គ្រប់ប្រភេទច្បាប់') + '</option>' + LEAVE_TYPES.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === typ ? ' selected' : '') + '>' + esc(typeName(x[0])) + '</option>'; }).join('');
    var ss = ['draft','pending','approved','rejected','returned','waived'];
    document.getElementById('al-status').innerHTML = '<option value="">' + L('全部狀態','All statuses','គ្រប់ស្ថានភាព') + '</option>' + ss.map(function (x) { return '<option value="' + x + '"' + (x === stat ? ' selected' : '') + '>' + esc(statusName(x)[0]) + '</option>'; }).join('');
  }
  function refresh() {
    if (!ready) return;
    var a = filtered(), staff = new Set(a.map(function (r) { return r.empId || r.name; })).size, days = a.reduce(function (n,r) { return n + Number(r.days || 0); },0), pending = a.filter(function (r) { return r.status === 'pending'; }).length, approved = a.filter(function (r) { return r.status === 'approved' || r.status === 'waived'; }).length;
    document.getElementById('al-kpis').innerHTML = kpi(staff,L('請假人數','Employees','ចំនួនបុគ្គលិក'),'good') + kpi(a.length,L('請假筆數','Leave records','កំណត់ត្រាច្បាប់'),'') + kpi(days,L('請假天數','Leave days','ចំនួនថ្ងៃច្បាប់'),'warn') + kpi(pending,L('待核可','Pending','រង់ចាំ'),'warn') + kpi(approved,L('已核可／免核可','Approved / waived','បានអនុម័ត / លើកលែង'),'good');
    document.getElementById('al-count').textContent = a.length + ' ' + L('筆','records','កំណត់ត្រា');
    document.getElementById('al-body').innerHTML = a.map(function (r,i) {
      var st = statusName(r.status), dates = r.startDate + (r.endDate && r.endDate !== r.startDate ? ' → ' + r.endDate : '') + (r.dayPart && r.dayPart !== 'full' ? ' · ' + (r.dayPart === 'am' ? 'AM' : 'PM') : '');
      return '<tr><td>' + (i+1) + '</td><td style="text-align:left"><b>' + esc(r.empId) + '</b><br>' + esc(r.name) + '</td><td style="text-align:left">' + esc([r.dept,r.section,r.position].filter(Boolean).join(' / ')) + '</td><td>' + esc(typeName(r.leaveType)) + '</td><td>' + esc(dates) + '</td><td><b>' + Number(r.days || 0) + '</b></td><td style="text-align:left;white-space:normal;min-width:160px">' + esc([r.reason,r.note].filter(Boolean).join(' · ')) + '</td><td>' + evidenceHtml(r.evidence) + '</td><td><span class="badge ' + st[1] + '">' + esc(st[0]) + '</span>' + (r.batchId ? '<br><small>' + esc(r.batchId) + '</small>' : '') + '</td><td><div class="al-actions"><button class="al-mini" onclick="AttendanceLeave.open(\'' + esc(r._k) + '\')">✎</button><button class="al-mini danger" onclick="AttendanceLeave.remove(\'' + esc(r._k) + '\')">🗑</button></div></td></tr>';
    }).join('') || '<tr><td colspan="10" style="padding:25px;color:#94a3b8">' + L('此期間沒有請假資料','No leave records in this period','គ្មានទិន្នន័យច្បាប់ក្នុងរយៈពេលនេះ') + '</td></tr>';
  }
  function kpi(n, label, cls) { return '<div class="kpi ' + cls + '"><div class="kpi-n">' + n + '</div><div class="kpi-l">' + label + '</div></div>'; }
  function setMode(m) {
    mode = m;
    var today = localDate(new Date());
    if (m === 'day' || m === 'week') focus = focus.length >= 10 ? focus.slice(0,10) : (focus.slice(0,7) + '-01');
    else if (m === 'month') focus = focus.slice(0,7) || today.slice(0,7);
    else focus = focus.slice(0,4) || today.slice(0,4);
    render();
  }
  function setPeriod(v) {
    if (!v) return;
    focus = mode === 'year' ? String(v).slice(0,4) : mode === 'month' ? String(v).slice(0,7) : parseDate(v);
    render();
  }
  function nav(n) {
    if (mode === 'month') focus = addMonths(focus,n);
    else if (mode === 'year') focus = String((+focus.slice(0,4) || new Date().getFullYear()) + n);
    else focus = addDays(focus,n * (mode === 'week' ? 7 : 1));
    render();
  }

  function open(key) {
    editing = key || '';
    var r = rows.filter(function (x) { return x._k === editing; })[0] || { leaveType:'annual', startDate:periodRange()[0], endDate:periodRange()[0], dayPart:'full', evidence:[] };
    document.getElementById('al-modal-title').textContent = editing ? L('修改請假資料','Edit leave record','កែប្រែកំណត់ត្រាច្បាប់') : L('新增請假資料','Add leave record','បន្ថែមកំណត់ត្រាច្បាប់');
    setValue('al-id',r.empId); setValue('al-name',r.name); setValue('al-department',r.dept); setValue('al-section',r.section); setValue('al-position',r.position); setValue('al-leave-type',r.leaveType || 'annual'); setValue('al-start',r.startDate); setValue('al-end',r.endDate || r.startDate); setValue('al-part',r.dayPart || 'full'); setValue('al-start-time',r.startTime); setValue('al-end-time',r.endTime); setValue('al-annual-applied',r.annualApplied); setValue('al-annual-accrued',r.annualAccrued); setValue('al-annual-balance',r.annualBalance); setValue('al-substitute',r.substitute); setValue('al-supervisor',r.supervisor); setValue('al-factory-director',r.factoryDirector); setValue('al-hr-reviewer',r.hrReviewer); setValue('al-admin-manager',r.adminManager); setValue('al-reason',r.reason); setValue('al-note',r.note);
    ['al-start','al-end','al-part'].forEach(function (id) { var e = document.getElementById(id); if (e) e.onchange = calc; }); calc();
    document.getElementById('al-modal').classList.add('on');
    if (g.HRAAttachments) HRAAttachments.mount('al-evidence', { module:TOOL, items:r.evidence || [], recordKey:function () { return editing || value('al-id') || 'new-leave'; }, period:function () { return String(value('al-start') || focus).slice(0,7); }, onError:function(e){notify(e.message,'err');} });
  }
  function calc() { setValue('al-days',daysBetween(value('al-start'),value('al-end'),value('al-part'))); }
  function save() {
    var old = rows.filter(function (x) { return x._k === editing; })[0];
    var rec = { _k:editing || uid(), empId:value('al-id').trim(), name:value('al-name').trim(), dept:value('al-department').trim(), section:value('al-section').trim(), position:value('al-position').trim(), leaveType:value('al-leave-type'), startDate:parseDate(value('al-start')), endDate:parseDate(value('al-end')), dayPart:value('al-part') || 'full', startTime:value('al-start-time'), endTime:value('al-end-time'), annualApplied:Number(value('al-annual-applied'))||0, annualAccrued:Number(value('al-annual-accrued'))||0, annualBalance:Number(value('al-annual-balance'))||0, substitute:value('al-substitute').trim(), supervisor:value('al-supervisor').trim(), factoryDirector:value('al-factory-director').trim(), hrReviewer:value('al-hr-reviewer').trim(), adminManager:value('al-admin-manager').trim(), reason:value('al-reason').trim(), note:value('al-note').trim(), evidence:g.HRAAttachments ? HRAAttachments.get('al-evidence') : ((old && old.evidence) || []), source:(old && old.source) || 'online', createdAt:(old && old.createdAt) || nowIso(), updatedAt:nowIso(), batchId:(old && old.batchId) || '', status:(old && old.status) || 'draft' };
    rec.days = daysBetween(rec.startDate,rec.endDate,rec.dayPart); rec.hours = calcHours(rec.startTime,rec.endTime);
    if (!rec.empId || !rec.name || !rec.dept || !rec.position || !rec.startDate || !rec.endDate || !rec.leaveType) { notify(L('請填寫工號、姓名、部門、職位、假別及日期。','Complete ID, name, department, position, leave type and dates.','សូមបំពេញ ID ឈ្មោះ ផ្នែក មុខតំណែង ប្រភេទច្បាប់ និងកាលបរិច្ឆេទ។'),'err'); return; }
    if (!rec.days) { notify(L('結束日期不可早於開始日期。','End date cannot be before start date.','ថ្ងៃបញ្ចប់មិនអាចមុនថ្ងៃចាប់ផ្ដើម។'),'err'); return; }
    var dup = duplicate(rec,editing); if (dup) { notify(L('同一工號已有日期重疊的請假：','This employee already has overlapping leave: ','បុគ្គលិកនេះមានច្បាប់ត្រួតគ្នា៖ ') + dup.startDate + ' — ' + dup.endDate,'err'); return; }
    /* Any material edit invalidates the previous decision.  The operator is
       told explicitly, then the revised record becomes a new draft. */
    if (old && approvalFingerprint(old) !== approvalFingerprint(rec) && ['pending','approved','waived'].indexOf(old.status) >= 0) {
      if (!confirm(L('此筆已送核或已核可。修改後舊核可將失效，並改回草稿重新送核，確定？','This record is pending/approved. Editing invalidates the old decision and returns it to draft. Continue?','កំណត់ត្រានេះកំពុងរង់ចាំ/បានអនុម័ត។ ការកែប្រែនឹងធ្វើឱ្យការអនុម័តចាស់អស់សុពលភាព ហើយត្រឡប់ទៅព្រាង។ បន្ត?'))) return;
      rec.status='draft'; rec.batchId=''; rec.decisionNote=''; rec.decidedAt=''; rec.revision=Number(old.revision||0)+1;
    }
    if (old && (old.status === 'rejected' || old.status === 'returned')) { rec.status = 'draft'; rec.batchId = ''; rec.revision = Number(old.revision || 0) + 1; }
    if (old) rows[rows.indexOf(old)] = rec; else rows.push(rec);
    saveRows(); close('al-modal'); render(); notify(L('✅ 已儲存請假資料','✅ Leave record saved','✅ បានរក្សាទុកទិន្នន័យច្បាប់'),'ok');
  }
  function remove(key) {
    var r = rows.filter(function (x) { return x._k === key; })[0]; if (!r) return;
    if (!confirm(L('確定刪除此筆請假？附件仍保留在 Drive，可復原。','Delete this leave record? Evidence remains recoverable in Drive.','លុបកំណត់ត្រាច្បាប់នេះ? ឯកសារនៅតែអាចស្ដារពី Drive។'))) return;
    rows = rows.filter(function (x) { return x._k !== key; }); saveRows(); render();
  }
  function close(id) { var e=document.getElementById(id); if(e)e.classList.remove('on'); }

  function batchRowHtml() {
    var d = periodRange()[0];
    return '<tr><td><input data-f="empId"></td><td><input data-f="name"></td><td><input data-f="dept"></td><td><input data-f="section"></td><td><input data-f="position"></td><td><select data-f="leaveType">' + typeOptions('annual') + '</select></td><td><input data-f="startDate" type="date" value="' + d + '"></td><td><input data-f="endDate" type="date" value="' + d + '"></td><td><button class="al-mini danger" onclick="this.closest(\'tr\').remove()">×</button></td></tr>';
  }
  function openBatch() { document.getElementById('al-batch-body').innerHTML = batchRowHtml() + batchRowHtml() + batchRowHtml(); document.getElementById('al-batch-modal').classList.add('on'); }
  function addBatchRow() { document.getElementById('al-batch-body').insertAdjacentHTML('beforeend',batchRowHtml()); }
  function saveBatch() {
    var added=0, skipped=0;
    document.querySelectorAll('#al-batch-body tr').forEach(function (tr) {
      var x={};tr.querySelectorAll('[data-f]').forEach(function(e){x[e.getAttribute('data-f')]=String(e.value||'').trim();});
      if(!x.empId&&!x.name)return;
      var rec={_k:uid(),empId:x.empId,name:x.name,dept:x.dept,section:x.section,position:x.position,leaveType:x.leaveType,startDate:parseDate(x.startDate),endDate:parseDate(x.endDate),dayPart:'full',days:daysBetween(parseDate(x.startDate),parseDate(x.endDate),'full'),hours:0,reason:'',note:'',evidence:[],status:'draft',batchId:'',source:'online-list',createdAt:nowIso(),updatedAt:nowIso()};
      if(!rec.empId||!rec.name||!rec.dept||!rec.position||!rec.days||duplicate(rec,'')){skipped++;return;} rows.push(rec);added++;
    });
    if(added){saveRows();close('al-batch-modal');render();notify('✅ '+added+' '+L('筆已新增','record(s) added','កំណត់ត្រាបានបន្ថែម'),'ok');}
    if(skipped)notify('⚠️ '+skipped+' '+L('筆資料不完整或日期重疊，已跳過','incomplete/overlapping record(s) skipped','កំណត់ត្រាមិនពេញលេញ/ត្រួតគ្នា ត្រូវបានរំលង'),'err');
  }

  function headerMap(obj) {
    var out={};Object.keys(obj||{}).forEach(function(k){out[String(k).toLowerCase().replace(/[\s_\-\/（）()]+/g,'')]=obj[k];});return out;
  }
  function pick(o,names){for(var i=0;i<names.length;i++){var k=names[i].toLowerCase().replace(/[\s_\-\/（）()]+/g,'');if(o[k]!==undefined&&o[k]!==null&&o[k]!=='')return o[k];}return'';}
  function importRecord(raw,index) {
    var o=headerMap(raw), typeRaw=String(pick(o,['leave type','type','假別','請假別','ប្រភេទច្បាប់'])).toLowerCase(), lt='other';
    LEAVE_TYPES.some(function(x){if([x[0],x[1].toLowerCase(),x[2].toLowerCase(),x[3].toLowerCase()].indexOf(typeRaw)>=0){lt=x[0];return true;}return false;});
    var start=parseDate(pick(o,['start date','from','開始日期','起始日期','ថ្ងៃចាប់ផ្ដើម'])),end=parseDate(pick(o,['end date','to','結束日期','ថ្ងៃបញ្ចប់']))||start,part=String(pick(o,['day part','半天','時段'])).toLowerCase();part=/am|上午|ព្រឹក/.test(part)?'am':/pm|下午|រសៀល/.test(part)?'pm':'full';
    return {_k:String(pick(o,['_k','key','record id']))||uid(),empId:String(pick(o,['employee id','emp id','id','工號','員工編號','លេខសម្គាល់'])).trim(),name:String(pick(o,['name','employee name','姓名','ឈ្មោះ'])).trim(),dept:String(pick(o,['department','dept','部門','ផ្នែក'])).trim(),section:String(pick(o,['section','line','group','組別','線別','ក្រុម'])).trim(),position:String(pick(o,['position','title','職位','មុខតំណែង'])).trim(),leaveType:lt,startDate:start,endDate:end,dayPart:part,days:daysBetween(start,end,part),hours:Number(pick(o,['hours','時數']))||0,annualApplied:Number(pick(o,['annual used','al apply','年假使用']))||0,annualAccrued:Number(pick(o,['annual accrued','al accum','年假累計']))||0,annualBalance:Number(pick(o,['annual balance','al balance','年假剩餘']))||0,substitute:String(pick(o,['substitute','代理人'])).trim(),supervisor:String(pick(o,['supervisor','主管'])).trim(),factoryDirector:String(pick(o,['factory director','廠長'])).trim(),hrReviewer:String(pick(o,['hr','hr confirmation','人事'])).trim(),adminManager:String(pick(o,['administration manager','admin manager','管理部經理'])).trim(),reason:String(pick(o,['reason','請假原因','原因','មូលហេតុ'])).trim(),note:String(pick(o,['note','remark','備註','កំណត់សម្គាល់'])).trim(),evidence:[],status:'draft',batchId:'',source:'excel',createdAt:nowIso(),updatedAt:nowIso(),importRow:index+2};
  }
  function importFile(file) {
    if(!file)return;
    var ext=String(file.name||'').split('.').pop().toLowerCase(),reader=new FileReader();
    reader.onload=function(){try{var rawRows=[];if(ext==='json'){var j=JSON.parse(String(reader.result||'[]'));rawRows=Array.isArray(j)?j:(j.records||[]);}else{if(!g.XLSX)throw new Error('XLSX library unavailable');var wb=XLSX.read(reader.result,{type:ext==='csv'?'string':'array',cellDates:true});wb.SheetNames.forEach(function(n){rawRows=rawRows.concat(XLSX.utils.sheet_to_json(wb.Sheets[n],{defval:''}));});}var added=0,updated=0,skipped=0;rawRows.forEach(function(x,i){var r=importRecord(x,i);if(!r.empId||!r.name||!r.startDate||!r.days){skipped++;return;}var dup=duplicate(r,'');if(dup){/* exact natural-key import updates the existing record; an overlapping but different leave is skipped. */if(dup.startDate===r.startDate&&dup.endDate===r.endDate&&dup.leaveType===r.leaveType){var pos=rows.indexOf(dup);rows[pos]=Object.assign({},dup,r,{_k:dup._k,evidence:dup.evidence||[],status:dup.status||'draft',batchId:dup.batchId||'',createdAt:dup.createdAt||r.createdAt,updatedAt:nowIso()});updated++;}else skipped++;return;}rows.push(r);added++;});saveRows();render();notify('✅ '+L('匯入完成','Import complete','នាំចូលបានបញ្ចប់')+' · +'+added+' / ↻'+updated+(skipped?' / ⚠'+skipped:''),'ok');}catch(e){notify(L('匯入失敗：','Import failed: ','នាំចូលបរាជ័យ៖ ')+e.message,'err');}};
    if(ext==='json'||ext==='csv')reader.readAsText(file);else reader.readAsArrayBuffer(file);
  }
  function exportXlsx() {
    var data=rows.map(function(r){return{ID:r.empId,Name:r.name,Department:r.dept,Section:r.section,Position:r.position,'Leave Type':typeName(r.leaveType,'en'),'開始日期 Start':r.startDate,'結束日期 End':r.endDate,Days:r.days,Hours:r.hours||'','Annual Used':r.annualApplied||'','Annual Accrued':r.annualAccrued||'','Annual Balance':r.annualBalance||'',Substitute:r.substitute||'',Supervisor:r.supervisor||'','Factory Director':r.factoryDirector||'',HR:r.hrReviewer||'','Administration Manager':r.adminManager||'',Reason:r.reason,Note:r.note,Status:r.status,'Evidence URLs':(g.HRAAttachments?HRAAttachments.links(r.evidence||[]):[]).join(' '),Updated:r.updatedAt};});
    if(!g.XLSX){notify('XLSX library unavailable','err');return;}var wb=XLSX.utils.book_new(),ws=XLSX.utils.json_to_sheet(data);XLSX.utils.book_append_sheet(wb,ws,'Employee Leave');XLSX.writeFile(wb,'Attendance_Employee_Leave_'+localDate(new Date())+'.xlsx');
  }

  function openTelegram(){if(!filtered().length){notify(L('目前期間沒有可傳送資料','No records for the current period','គ្មានទិន្នន័យក្នុងរយៈពេលបច្ចុប្បន្ន'),'err');return;}document.getElementById('al-tg-modal').classList.add('on');previewTelegram();}
  function tgLine(r,lang,index){var links=g.HRAAttachments?HRAAttachments.links(r.evidence||[]):[];return '⌛ '+(index+1)+'. '+tgEsc(r.name)+' ('+tgEsc(r.empId)+')\n   '+tgEsc([r.dept,r.section,r.position].filter(Boolean).join(' / '))+'\n   '+tgEsc(typeName(r.leaveType,lang))+' · '+tgEsc(r.startDate)+(r.endDate!==r.startDate?' → '+tgEsc(r.endDate):'')+' · '+tgEsc(r.days)+' '+(lang==='zh'?'天':lang==='km'?'ថ្ងៃ':'day(s)')+(r.reason?'\n   '+(lang==='zh'?'原因':lang==='km'?'មូលហេតុ':'Reason')+': '+tgEsc(r.reason):'')+(links.length?'\n   📎 '+links.slice(0,2).map(tgEsc).join(' '):'');}
  function oneMessage(list,lang,kind){var title=lang==='zh'?'員工請假'+(kind==='approval'?'核可':'摘要'):lang==='km'?(kind==='approval'?'សំណើអនុម័តច្បាប់បុគ្គលិក':'សង្ខេបច្បាប់បុគ្គលិក'):'Employee Leave '+(kind==='approval'?'Approval':'Summary'),sum=list.reduce(function(n,r){return n+Number(r.days||0);},0);return '📝 '+title+'\n📅 '+(lang==='zh'?'期間':lang==='km'?'រយៈពេល':'Period')+': '+tgEsc(periodLabel())+'\n👥 '+(lang==='zh'?'人數':lang==='km'?'ចំនួនបុគ្គលិក':'Employees')+': '+new Set(list.map(function(r){return r.empId||r.name;})).size+' · '+(lang==='zh'?'筆數':lang==='km'?'កំណត់ត្រា':'Records')+' '+list.length+' · '+(lang==='zh'?'天數':lang==='km'?'ថ្ងៃ':'Days')+' '+sum+'\n────────────\n'+list.map(function(r,i){return tgLine(r,lang,i);}).join('\n')+'\n────────────\n✅ '+(lang==='zh'?'姓名、工號、部門、職位、假別及日期已列明':lang==='km'?'បានបង្ហាញឈ្មោះ ID ផ្នែក មុខតំណែង ប្រភេទច្បាប់ និងកាលបរិច្ឆេទ':'Name, ID, department, position, leave type and dates are listed');}
  function messageText(){var list=filtered(),kind=value('al-tg-kind')||'summary',lg=value('al-tg-lang')||'tri',langs=lg==='tri'?['zh','en','km']:[lg];return langs.map(function(x){return oneMessage(list,x,kind);}).join('\n\n════════════\n\n');}
  function previewTelegram(){var e=document.getElementById('al-tg-preview');if(e)e.textContent=messageText();}
  function post(payload){var url=gasUrl();if(!url)return Promise.reject(new Error(L('請先設定 GAS 網址','Configure the GAS URL first','សូមកំណត់ GAS URL ជាមុន')));return fetch(url,{method:'POST',redirect:'follow',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)}).then(function(r){return r.text();}).then(function(t){var j;try{j=JSON.parse(t);}catch(_){throw new Error('Cloud returned non-JSON');}if(!j||j.ok===false)throw new Error(j&&j.error||'Cloud request failed');return j.data||j;});}
  function sendTelegram(){var list=filtered(),kind=value('al-tg-kind')||'summary',btn=document.getElementById('al-tg-send');if(!list.length)return;btn.disabled=true;btn.textContent=L('傳送中…','Sending…','កំពុងផ្ញើ…');var task;
    if(kind==='approval'){
      var eligible=list.filter(function(r){return ['draft','rejected','returned'].indexOf(r.status||'draft')>=0;});
      if(!eligible.length){btn.disabled=false;btn.textContent=L('發送','Send','ផ្ញើ');notify(L('沒有新的或修改後的資料可送核；待核／已核資料不會重發。','No new or revised records to submit; pending/approved records are not resent.','គ្មានទិន្នន័យថ្មី ឬកែប្រែសម្រាប់សុំអនុម័ត។'),'err');return;}
      if(!g.HRA_APPR){btn.disabled=false;notify('approval.js unavailable','err');return;}
      var period=periodRange()[0].slice(0,7),batch='LV-'+period.replace('-','')+'-'+Date.now().toString(36);
      task=HRA_APPR.submit({module:TOOL,period:period,batch:batch,title:'Employee Leave / 員工請假',lang:value('al-tg-lang')==='tri'?'zh':value('al-tg-lang'),items:eligible.map(function(r){return{key:r._k,id:r.empId,name:r.name,dept:r.dept,group:r.section,amount:0,period:String(r.startDate).slice(0,7),kind:typeName(r.leaveType,'en'),info:[r.position,r.startDate+(r.endDate!==r.startDate?' → '+r.endDate:''),r.days+' day(s)',r.reason].filter(Boolean).join(' · ')};})}).then(function(res){eligible.forEach(function(r){r.batchId=res.batchId||batch;r.status=res.allWaived?'waived':'pending';r.updatedAt=nowIso();});saveRows(true);render();return res;});
    }else task=post({action:'telegram',tool:TOOL,module:TOOL,lang:value('al-tg-lang')==='tri'?'zh':value('al-tg-lang'),text:messageText()}).then(function(d){if(!d.messageId||d.sentToGroup===false)throw new Error(d.error||'Telegram message_id was not returned');return d;});
    task.then(function(){close('al-tg-modal');notify(L('✅ 群組已收到通知','✅ Notification delivered to group','✅ ក្រុមបានទទួលការជូនដំណឹង'),'ok');return cloudPush(true);}).catch(function(e){notify(L('傳送失敗：','Send failed: ','ផ្ញើបរាជ័យ៖ ')+e.message,'err');}).finally(function(){btn.disabled=false;btn.textContent=L('📤 發送','📤 Send','📤 ផ្ញើ');});
  }

  function setSync(msg,type){var e=document.getElementById('al-sync');if(e){e.textContent=msg;e.style.color=type==='err'?'#be123c':type==='ok'?'#047857':'#64748b';}}
  function cloudPush(auto){var url=gasUrl();if(!url){if(!auto)notify(L('請先設定 GAS 網址','Configure GAS URL first','សូមកំណត់ GAS URL'),'err');return Promise.resolve({ok:false});}if(!g.HRASmartSync)return Promise.reject(new Error('Smart sync unavailable'));setSync(L('比對雲端差異…','Comparing cloud changes…','កំពុងប្រៀបធៀប Cloud…'));
    return HRASmartSync.push({url:url,tool:TOOL,records:rows,allowDeletes:true,autoMerge:true,meta:{module:TOOL,updatedAt:nowIso(),recordCount:rows.length},summary:{period:periodLabel(),recordCount:rows.length},onStatus:function(m,t){setSync(m,t==='ok'?'ok':t==='warn'?'err':'');}}).then(function(d){if(d&&d.needsPull)throw new Error(L('雲端有較新資料，請先下載合併。','Cloud has newer data; download and merge first.','Cloud មានទិន្នន័យថ្មីជាង សូមទាញយកសិន។'));if(!auto)notify(d&&d.skipped?L('雲端已是最新，不需重傳','Cloud already up to date','Cloud មានទិន្នន័យថ្មីបំផុត'):L('✅ 增量上傳完成','✅ Incremental upload complete','✅ ផ្ទុកឡើងការផ្លាស់ប្ដូរបានបញ្ចប់'),'ok');return d;}).catch(function(e){setSync(e.message,'err');if(!auto)notify(L('上傳失敗：','Upload failed: ','ផ្ទុកឡើងបរាជ័យ៖ ')+e.message,'err');throw e;});
  }
  function merge(local,remote){var map={},order=[];(local||[]).concat(remote||[]).forEach(function(r){var k=r&&r._k||uid();if(!map[k])order.push(k);var a=map[k],an=a&&new Date(a.updatedAt||0).getTime()||0,bn=new Date(r.updatedAt||0).getTime()||0;if(!a||bn>=an)map[k]=r;});return order.map(function(k){return map[k];});}
  function cloudPull(){var url=gasUrl();if(!url){notify(L('請先設定 GAS 網址','Configure GAS URL first','សូមកំណត់ GAS URL'),'err');return;}if(!g.HRASmartSync){notify('Smart sync unavailable','err');return;}setSync(L('比對下載差異…','Comparing download changes…','កំពុងប្រៀបធៀបទាញយក…'));
    HRASmartSync.pull({url:url,tool:TOOL,localRecords:rows,mergeRecords:merge,apply:function(all){rows=all||[];saveRows(true);render();},onStatus:function(m,t){setSync(m,t==='ok'?'ok':t==='warn'?'err':'');}}).then(function(d){if(d&&d.noCloud)notify(L('雲端尚無請假資料','No leave data in cloud','គ្មានទិន្នន័យច្បាប់នៅ Cloud'),'info');else notify(d&&d.downloaded?L('✅ 已下載新增／變更資料','✅ New/changed data downloaded','✅ បានទាញយកទិន្នន័យថ្មី/កែប្រែ'):L('雲端與本機已一致，不需重複下載','Cloud and local data already match','Cloud និងម៉ាស៊ីនដូចគ្នា មិនចាំបាច់ទាញយកម្ដងទៀត'),'ok');}).catch(function(e){setSync(e.message,'err');notify(L('下載失敗：','Download failed: ','ទាញយកបរាជ័យ៖ ')+e.message,'err');});
  }
  function schedulePush(){clearTimeout(autoTimer);autoTimer=setTimeout(function(){if(gasUrl())cloudPush(true).catch(function(){});},1500);}
  function syncApproval(){var batches=Array.from(new Set(rows.map(function(r){return r.batchId;}).filter(Boolean)));if(!batches.length){notify(L('沒有待同步的核可批次','No approval batches to sync','គ្មានបាច់អនុម័តត្រូវធ្វើសមកាលកម្ម'),'info');return;}if(!g.HRA_APPR){notify('approval.js unavailable','err');return;}setSync(L('同步核可狀態…','Syncing approvals…','កំពុងធ្វើសមកាលកម្មអនុម័ត…'));var changed=0;var chain=Promise.resolve();batches.forEach(function(b){chain=chain.then(function(){return HRA_APPR.status(b).then(function(d){var itemMap={};(d.items||[]).forEach(function(x){itemMap[x.itemId]=x;});rows.forEach(function(r){if(r.batchId!==b||!itemMap[r._k])return;var s=itemMap[r._k].status;if(s&&s!==r.status){r.status=s;r.decisionNote=itemMap[r._k].note||'';r.decidedAt=itemMap[r._k].decidedAt||'';r.updatedAt=nowIso();changed++;}});});});});chain.then(function(){if(changed){saveRows();render();}setSync(L('核可狀態已同步','Approval status synchronized','ស្ថានភាពអនុម័តបានធ្វើសមកាលកម្ម'),'ok');notify('✅ '+changed+' '+L('筆狀態更新','record(s) updated','កំណត់ត្រាបានធ្វើបច្ចុប្បន្នភាព'),'ok');}).catch(function(e){setSync(e.message,'err');notify(L('核可同步失敗：','Approval sync failed: ','សមកាលកម្មអនុម័តបរាជ័យ៖ ')+e.message,'err');});}

  g.AttendanceLeave = { render:render,refresh:refresh,setMode:setMode,setPeriod:setPeriod,nav:nav,open:open,save:save,remove:remove,close:close,calc:calc,openBatch:openBatch,addBatchRow:addBatchRow,saveBatch:saveBatch,importFile:importFile,exportXlsx:exportXlsx,openTelegram:openTelegram,previewTelegram:previewTelegram,sendTelegram:sendTelegram,cloudPush:cloudPush,cloudPull:cloudPull,syncApproval:syncApproval,records:function(){return rows.slice();},version:'1.0' };
})(window);
