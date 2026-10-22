/* AC HRA Portal — 智慧匯入 Smart Import v1.0 · 2026-10-22
 * 首頁一個入口：檔案丟進來 → 依「檔名」為主（再看分頁名、前幾列標題）判斷要進哪個模組（可手動改）→
 * 在隱藏框架裡開該模組頁，呼叫「模組自己的匯入功能」（去重、日期規則、詢問視窗都和在模組頁上一模一樣）→
 * 再叫該模組的自動同步把新資料上傳，等雲端確認才算完成。
 * 有更才更、有下才下：同一個檔（內容相同）匯過就標示「已匯入過」且預設不勾，不會重複匯入；
 * 模組本身也會依工號／日期去重，只上傳有變動的部分。
 * 不發摘要、不發核可、不發 Telegram — 匯完要發，按結果列的「開啟」到模組頁再發。
 */
(function (g) {
  'use strict';
  if (g.HRAImportHub) return;
  var doc = g.document;
  var LOG_KEY = 'ac_hra_import_log_v1', XLSX_SRC = 'shared/xlsx.full.min.js?v=0.18.5';
  var DEST = {
    attendance: { ico: '🕐', page: 'ac_hra_attendance_v1.html', key: 'attendance', zh: '出勤（每日考勤）', en: 'Attendance (daily)', km: 'វត្តមាន' },
    onboarding: { ico: '🚪', page: 'ac_hra_onboarding_v3.html', key: 'onboarding', zh: '入離職／離職結算', en: 'Join / Resign / Settlement', km: 'ចូល / ចេញការងារ' },
    contract: { ico: '📋', page: 'ac_hra_contract_v2.html', key: 'contract', zh: '試用期／合約／5%', en: 'Probation / Contract / 5%', km: 'សាកល្បង / កិច្ចសន្យា' },
    maternity: { ico: '🤱', page: 'ac_hra_maternity_v1.html', key: 'maternity', zh: '產假／護理費／健檢／醫療', en: 'Maternity / Nursing / Health', km: 'មាតុភាព / សុខភាព' },
    manpower: { ico: '👷', page: 'ac_hra_manpower_v1.html', key: 'manpower', zh: '人力規劃／招募', en: 'Manpower / Recruitment', km: 'កម្លាំងពលកម្ម' },
    certificate: { ico: '🛂', page: 'ac_hra_certificate_visa_v1.html', key: 'certificate_visa', zh: '證書／簽證／工作證', en: 'Certificate / Visa / Work permit', km: 'វិញ្ញាបនបត្រ / ទិដ្ឋាការ' },
    welfare: { ico: '🤝', page: 'ac_hra_welfare_suggestion_v1.html', key: 'welfare', zh: '福利（交通住宿／工會費／意見箱）', en: 'Welfare (transport / union / suggestion)', km: 'សុខុមាលភាព' },
    salary: { ico: '💵', page: 'ac_hra_salary_v1.html', key: 'salary', zh: '薪資架構／職等', en: 'Salary structure / grades', km: 'ប្រាក់ខែ' },
    leave: { ico: '📝', page: 'ac_hra_employee_leave_v1.html', key: 'attendance_leave', zh: '員工資料（請假模組名冊）', en: 'Employee list (Leave)', km: 'បញ្ជីបុគ្គលិក' },
    calendar: { ico: '📅', page: 'ac_hra_calendar_v2.html', key: 'calendar', zh: '行事曆／假日', en: 'Calendar / holidays', km: 'ប្រតិទិន' }
  };
  var ORDER = ['attendance', 'leave', 'onboarding', 'contract', 'maternity', 'manpower', 'certificate', 'welfare', 'salary', 'calendar'];
  var items = [], busy = false, root = null, seq = 0;

  function lang() {
    try { var on = doc.querySelector('.lb.on'); if (on) { var i = Array.prototype.indexOf.call(doc.querySelectorAll('.lb'), on); return ['zh', 'en', 'km'][i] || 'zh'; } } catch (_) {}
    try { var l = localStorage.getItem('ac_hra_lang'); if (l) return l; } catch (_) {}
    return 'zh';
  }
  function L(zh, en, km) { var l = lang(); return l === 'en' ? en : l === 'km' ? (km || en) : zh; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function readJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (_) { return d; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }
  function destName(k) { var d = DEST[k]; return d ? L(d.zh, d.en, d.km) : L('（不匯入）', '(skip)', '(skip)'); }
  function when(t) { var d = new Date(t), p = function (n) { return ('0' + n).slice(-2); }; return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }
  function kb(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function txt(el) { return String(el && (el.innerText || el.textContent) || '').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim(); }

  function loadXLSX() {
    if (g.XLSX) return Promise.resolve();
    return new Promise(function (resolve, reject) { var s = doc.createElement('script'); s.src = XLSX_SRC; s.onload = resolve; s.onerror = function () { reject(new Error('xlsx')); }; doc.head.appendChild(s); });
  }
  async function hashOf(buf) {
    try { var d = await crypto.subtle.digest('SHA-256', buf); return Array.prototype.map.call(new Uint8Array(d), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); } catch (_) { return ''; }
  }

  /* ── 判斷要進哪個模組：檔名最重要（×3），其次分頁名（×2）、前幾列標題（×1） ── */
  var RULES = {
    attendance: { name: /daily ?att|attendance|考勤|出勤|daily ?report|manpower ?daily/, sheet: /^(\d{1,2}([-./]\d{1,2})?|\d{1,2} ?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*|(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* ?\d{1,2})$/, text: /\bpresent\b|\babsent\b|attendance|出勤|考勤/ },
    onboarding: { name: /join|jion|resign|入職|離職|turnover|新進/, sheet: /resign ?\(\d+\)|jion|join ?\(\d+\)|^summ?ery$/, text: /離職人員明細表|入職統計明細表|salary resigned|resigned on/ },
    contract: { name: /contract|probation|試用|合約|合同|5 ?%|seniority|severance/, sheet: /probation|contract|5 ?%/, text: /probation|contract (end|expir|start)|試用期|合約到期|5 ?% ?(payment|settlement)/ },
    maternity: { name: /maternity|pregnan|nursing|health ?(check|fee)|medical|medicine|clinic|產假|孕婦|護理|健檢|醫療/, sheet: /nursing|maternity|pregnan|clinic|medical/, text: /nursing|maternity|pregnan|預產期|\bedd\b|health check|clinic/ },
    manpower: { name: /manpower|recruit|requisition|demand|招募|招聘|人力/, sheet: /^(manpower|manpower demand|requisition|manpower requisition|recruit list|joining list|vrt)$/, text: /manpower report|recruit record|招聘統計|request reason|需求原因/ },
    certificate: { name: /certif|visa|work ?permit|passport|disab|證書|簽證|工作證|護照/, sheet: /visa|permit|passport|certif|disab/, text: /passport|visa|work permit|certificate|disability/ },
    welfare: { name: /transport|accommodation|housing|union|dues|suggestion|grievance|welfare|福利|工會|住宿|交通|意見/, sheet: /union|suggestion|grievance|transport|accommodation/, text: /union|suggestion|grievance|accommodation|transportation/ },
    salary: { name: /salary ?structure|pay ?grade|grade|職等|薪資架構|wage structure/, sheet: /basic wage|title|職稱/, text: /basic wage|job allowance|skill allowance|職等/ },
    leave: { name: /employee ?(list|data|info|master)|staff ?(list|data)|員工資料|員工名冊|leave/, sheet: /employee|staff/, text: /factory ?id/ },
    calendar: { name: /holiday|calendar|假日|行事曆|假期/, sheet: /holiday|calendar|假日/, text: /public holiday|holiday|國定假日/ }
  };
  function classify(name, wb) {
    var n = String(name || '').toLowerCase();
    if (/\.(msg|eml)$/i.test(n)) return { dest: 'attendance', why: L('郵件檔 → 出勤', 'email file → attendance', 'email') };
    var sheets = (wb && wb.SheetNames || []).map(function (s) { return String(s).trim().toLowerCase(); }), text = '';
    if (wb) wb.SheetNames.slice(0, 4).forEach(function (sn) {
      try { var rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '', raw: true }).slice(0, 10); text += ' ' + rows.map(function (r) { return r.slice(0, 16).join(' '); }).join(' '); } catch (_) {}
    });
    text = text.toLowerCase();
    /* 明確的格式先判斷（和模組自己的判斷一致） */
    if (sheets.some(function (s) { return /resign ?\(\d+\)|^jion|join ?\(\d+\)/.test(s); }) || /離職人員明細表|入職統計明細表/.test(text)) return { dest: 'onboarding', why: L('分頁 Join(n)/Resign(n)', 'Join(n)/Resign(n) sheets', '') };
    if (sheets.indexOf('vrt') >= 0 && (sheets.indexOf('join') >= 0 || sheets.indexOf('resigned') >= 0)) return { dest: 'manpower', why: L('分頁 VRT／Join／Resigned', 'VRT / Join / Resigned sheets', '') };
    if (sheets.some(function (s) { return /basic wage/.test(s); })) return { dest: 'salary', why: 'Basic Wage' };
    var best = '', score = 0, second = 0, why = '';
    Object.keys(RULES).forEach(function (k) {
      var r = RULES[k], s = 0, w = [];
      if (r.name.test(n)) { s += 3; w.push(L('檔名', 'file name', 'name')); }
      if (sheets.some(function (x) { return r.sheet.test(x); })) { s += 2; w.push(L('分頁', 'sheets', 'sheets')); }
      if (r.text.test(text)) { s += 1; w.push(L('標題', 'headers', 'headers')); }
      if (k === 'attendance' && sheets.filter(function (x) { return r.sheet.test(x); }).length >= 3) s += 2;
      if (s > score) { second = score; score = s; best = k; why = w.join('＋'); } else if (s > second) second = s;
    });
    if (!best || score < 2 || score === second) return { dest: '', why: '' };
    return { dest: best, why: why };
  }
  async function addFiles(fileList) {
    var log = readJSON(LOG_KEY, {});
    for (var i = 0; i < fileList.length; i++) {
      var f = fileList[i], it = { id: ++seq, file: f, name: f.name, size: f.size, dest: '', on: true, state: 'detect', msg: '' };
      items.push(it); render();
      try {
        if (/\.(pdf|jpe?g|png|heic|webp|gif)$/i.test(f.name)) { it.on = false; it.state = 'later'; it.msg = L('PDF／照片匯入下一階段提供；證據照片請在該筆資料上附加', 'PDF / photo import comes next; attach evidence photos on the record itself', 'PDF/រូបថត ដំណាក់កាលបន្ទាប់'); render(); continue; }
        var buf = await f.arrayBuffer(); it.hash = await hashOf(buf);
        var c = { dest: '', why: '' };
        if (/\.(msg|eml)$/i.test(f.name)) c = classify(f.name, null);
        else { await loadXLSX(); var wb = XLSX.read(buf, { type: 'array', cellDates: false, raw: true, sheetRows: 12 }); c = classify(f.name, wb); }
        it.dest = c.dest; it.why = c.why;
        var prev = it.hash && log[it.hash];
        if (prev) { it.on = false; it.state = 'done-before'; it.msg = L('此檔 ' + when(prev.at) + ' 已匯入過（' + destName(prev.dest) + '），不重複匯入；確定要再匯就勾選', 'Already imported ' + when(prev.at) + ' — tick to import again', 'បាននាំចូលរួច'); if (!it.dest) it.dest = prev.dest; }
        else if (it.dest) { it.state = 'ready'; it.msg = L('依' + it.why + '判斷', 'by ' + it.why, '') ; }
        else { it.state = 'pick'; it.on = false; it.msg = L('認不出是哪個模組，請在右邊選擇', 'Cannot tell the module — please choose', 'ជ្រើសម៉ូឌុល'); }
      } catch (e) { it.on = false; it.state = 'err'; it.msg = L('讀不到檔案：', 'Cannot read: ', 'អានមិនបាន: ') + (e && e.message || e); }
      render();
    }
  }

  /* ── 在隱藏框架開模組頁 ── */
  function openFrame(dest, host) {
    return new Promise(function (resolve, reject) {
      var f = doc.createElement('iframe'), d = DEST[dest];
      f.setAttribute('aria-hidden', 'true'); f.tabIndex = -1;
      f.style.cssText = 'position:fixed;left:-20000px;top:0;width:1280px;height:900px;border:0;opacity:0;pointer-events:none';
      var to = setTimeout(function () { try { f.remove(); } catch (_) {} reject(new Error(L('模組頁開啟逾時', 'Module page timed out', 'Timeout'))); }, 90000);
      f.onload = function () {
        clearTimeout(to);
        var w = f.contentWindow, tag = '［' + destName(dest) + '］\n';
        /* 模組的詢問交給使用者；訊息收集起來當結果 */
        try { w.confirm = function (m) { return g.confirm(tag + m); }; w.alert = function (m) { host.notes.push(String(m)); }; w.prompt = function (m, v) { return g.prompt(tag + m, v); }; } catch (_) {}
        try { var ot = w.toast; if (typeof ot === 'function') w.toast = function (m) { try { host.notes.push(String(m)); } catch (_) {} return ot.apply(this, arguments); }; } catch (_) {}
        resolve({ frame: f, win: w });
      };
      f.src = d.page + '?hubImport=1&_t=' + Date.now();
      doc.body.appendChild(f);
    });
  }
  async function waitFor(fn, ms, step) { var t0 = Date.now(); while (Date.now() - t0 < (ms || 60000)) { try { if (await fn()) return true; } catch (_) {} await sleep(step || 400); } return false; }
  function aState(w, key) { try { return w.HRAAutoSync && w.HRAAutoSync.state(key); } catch (_) { return null; } }
  /* 模組開啟時會先自己做一次雲端對帳；等它做完再匯入，避免互相覆蓋 */
  async function waitStartup(w, key) {
    await waitFor(function () { var s = aState(w, key); return s && s.lastRun > 0 && !/^(syncing|idle)$/.test(s.state); }, 45000, 500);
  }
  async function upload(w, key) {
    if (!w.HRAAutoSync) return { ok: false, msg: L('模組沒有雲端同步', 'no cloud sync in module', '') };
    await waitFor(function () { var s = aState(w, key); return !s || s.state !== 'syncing'; }, 120000, 500);
    var t0 = Date.now(), r = false;
    try { r = await w.HRAAutoSync.run(key, 'import'); } catch (_) {}
    await waitFor(function () { var s = aState(w, key); return s && s.lastRun >= t0 && !/^(syncing|dirty)$/.test(s.state); }, 150000, 600);
    var s = aState(w, key) || {};
    if (r || /^(synced|checked)$/.test(s.state)) return { ok: true, msg: L('已上傳雲端', 'uploaded', 'uploaded') };
    return { ok: false, msg: s.state === 'offline' ? L('離線，連線後模組會自動上傳', 'offline — will upload when back online', 'offline') : L('雲端尚未確認，開啟模組時會自動重試', 'cloud not confirmed yet; the module retries automatically', 'retry') };
  }
  /* 模組頁的函式與 Excel 元件要先載好；等不到就明講，不要硬跑 */
  async function ready(w, fn) {
    if (await waitFor(fn, 45000, 300)) return true;
    throw new Error(L('模組頁沒有載入完成（網路慢或 Excel 元件載不到），請稍後再試', 'Module page did not finish loading (slow network or Excel library missing) — try again', 'Module not ready'));
  }
  function lastNote(host, re) { var a = host.notes.filter(function (m) { return !re || re.test(m); }); return a[a.length - 1] || ''; }
  var RUN = {
    attendance: async function (w, files, host) {
      await ready(w, function () { return w.addFiles && w.doImport && w.XLSX; });
      w.addFiles(files); await w.doImport();
      return txt(w.document.getElementById('importMsg')) || lastNote(host);
    },
    leave: async function (w, files, host) {
      await ready(w, function () { return w.importExcel && w.XLSX; });
      var out = [];
      for (var i = 0; i < files.length; i++) { var n0 = host.notes.length; w.importExcel(files[i]); await waitFor(function () { return host.notes.length > n0; }, 60000); out.push(host.notes.slice(n0).join(' ')); }
      return out.join(' · ');
    },
    contract: async function (w, files) {
      await ready(w, function () { return w.smartImportContractFiles && w.XLSX; });
      await w.smartImportContractFiles({ target: { files: files, value: '' } });
      return txt(w.document.getElementById('contractSmartImportResult'));
    },
    onboarding: async function (w, files) { return reportStyle(w, files); },
    maternity: async function (w, files) { return reportStyle(w, files); },
    manpower: async function (w, files) {
      await ready(w, function () { return w.smartImport && w.XLSX; });
      await w.smartImport(files);
      return txt(w.document.getElementById('importReport'));
    },
    certificate: async function (w, files) {
      await ready(w, function () { return w.importFiles && w.XLSX; });
      await w.importFiles(files);
      return txt(w.document.getElementById('importPreview'));
    },
    welfare: async function (w, files, host) {
      await ready(w, function () { return w.importFiles && w.XLSX; });
      await w.importFiles(files);
      return txt(w.document.getElementById('importLog')) || lastNote(host);
    },
    salary: async function (w, files, host) {
      await ready(w, function () { return w.importFile && w.importApply && w.XLSX; });
      for (var i = 0; i < files.length; i++) {
        await w.importFile(files[i]);
        var m = w.document.getElementById('importModal');
        if (m && m.classList.contains('open')) { var sum = txt(w.document.getElementById('importSummary')); await w.importApply(); host.notes.push(sum); }
      }
      return lastNote(host);
    },
    calendar: async function (w, files) {
      await ready(w, function () { return w.importCalendarExcel && (w.XLSXStyle || w.XLSX); });
      var st = w.document.getElementById('imp-status'), out = [];
      for (var i = 0; i < files.length; i++) {
        if (st) st.innerHTML = '';
        w.importCalendarExcel({ target: { files: [files[i]], value: '' } });
        await waitFor(function () { return /✅|❌/.test(txt(st)); }, 60000);
        out.push(txt(st));
      }
      return out.join(' · ');
    }
  };
  async function reportStyle(w, files) {
    await ready(w, function () { return w.onFiles && w.XLSX; });
    var rep = w.document.getElementById('import-report');
    w.onFiles(files);
    await waitFor(function () { return rep && /📋/.test(rep.textContent || ''); }, 90000);
    var lines = txt(rep).split('\n').filter(Boolean);
    return lines.slice(1).join(' · ');
  }
  async function importBatch(dest, list) {
    var host = { notes: [] };
    list.forEach(function (it) { it.state = 'run'; it.msg = L('開啟模組、匯入中…', 'Opening module, importing…', '…'); }); render();
    var fr = null, res = '', ok = true, up = null;
    try {
      fr = await openFrame(dest, host); var w = fr.win;
      /* 交給模組「它自己視窗」的 File 物件（各頁的 Excel 讀取器會檢查型別） */
      var files = [];
      for (var fi = 0; fi < list.length; fi++) {
        var src = list[fi].file, ab = await src.arrayBuffer(), u8 = new w.Uint8Array(ab.byteLength); u8.set(new Uint8Array(ab));
        files.push(new w.File([u8], src.name, { type: src.type || '', lastModified: src.lastModified || Date.now() }));
      }
      await waitStartup(w, DEST[dest].key);
      res = String(await RUN[dest](w, files, host) || '').replace(/\s+/g, ' ').trim();
      if (!res) res = lastNote(host) || L('已處理', 'Done', 'Done');
      if (/❌|⛔|失敗|failed|error|無法判斷|undetected|unrecognized|找不到標題/i.test(res) && !/✅|新增|added|\+\d/i.test(res)) ok = false;
      if (ok) { list.forEach(function (it) { it.msg = L('上傳雲端中…', 'Uploading…', '…'); }); render(); up = await upload(w, DEST[dest].key); res += ' · ' + up.msg; if (!up.ok) ok = false; }
    } catch (e) { ok = false; res = (res ? res + ' · ' : '') + ((e && e.message) || String(e)); }
    finally { if (fr) setTimeout(function () { try { fr.frame.src = 'about:blank'; fr.frame.remove(); } catch (_) {} }, 600); }
    var log = readJSON(LOG_KEY, {});
    var imported = ok || (up && !up.ok);   /* 匯入成功但雲端待重試：模組會自己補傳，檔案不必再匯 */
    list.forEach(function (it) {
      it.state = ok ? 'ok' : 'err'; it.msg = res.slice(0, 400); it.on = false; it.doneDest = dest;
      if (imported && it.hash) log[it.hash] = { name: it.name, dest: dest, at: Date.now(), result: res.slice(0, 200) };
    });
    var keys = Object.keys(log); if (keys.length > 500) keys.sort(function (a, b) { return log[a].at - log[b].at; }).slice(0, keys.length - 500).forEach(function (k) { delete log[k]; });
    writeJSON(LOG_KEY, log); render();
    return ok;
  }
  async function run() {
    if (busy) return;
    var todo = items.filter(function (it) { return it.on && it.dest && DEST[it.dest]; });
    if (!todo.length) { say(L('沒有勾選要匯入的檔案', 'Nothing ticked to import', 'គ្មានឯកសារ')); return; }
    if (g.HomeSync && HomeSync.running && HomeSync.running()) { say(L('雲端同步進行中，完成後再匯入', 'Cloud sync is running — import after it finishes', '…')); return; }
    busy = true; say(''); render();
    var bad = 0, done = 0;
    for (var i = 0; i < ORDER.length; i++) {
      var list = todo.filter(function (it) { return it.dest === ORDER[i]; });
      if (!list.length) continue;
      if (!(await importBatch(ORDER[i], list))) bad++; else done++;
    }
    busy = false; render();
    say(bad ? '⚠️ ' + L('匯入完成：' + done + ' 個模組成功、' + bad + ' 個需注意（看紅字）', 'Done: ' + done + ' OK, ' + bad + ' need attention', 'Done') : '✅ ' + L('匯入並上傳完成；要發摘要或核可，按「開啟 ↗」到模組頁', 'Imported and uploaded. To send a summary or approval, tap “Open ↗”.', 'Done'));
  }
  function say(m) { var e = root && root.querySelector('#ihr-sum'); if (e) { e.textContent = m; e.style.display = m ? '' : 'none'; } }

  /* ── UI（配合首頁深綠玻璃風格） ── */
  function css() {
    if (doc.getElementById('ihr-css')) return;
    var s = doc.createElement('style'); s.id = 'ihr-css';
    s.textContent = '.ihr{border-radius:14px;padding:14px 16px;margin:14px 0 0;font-size:13px;line-height:1.45;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);color:#e2e8f0}' +
      '.ihr-title{font-weight:700;font-size:14px;margin-bottom:8px;display:flex;gap:6px;align-items:baseline;flex-wrap:wrap}.ihr-title small{font-weight:400;color:rgba(226,232,240,.75);font-size:11.5px}' +
      '.ihr-drop{border:2px dashed rgba(255,255,255,.35);background:rgba(255,255,255,.07);border-radius:12px;padding:14px;text-align:center;cursor:pointer;transition:.15s}' +
      '.ihr-drop:hover,.ihr-drop.over{border-color:#fde68a;background:rgba(255,255,255,.13)}.ihr-drop b{color:#fff;font-size:14px}.ihr-drop small{display:block;color:rgba(226,232,240,.8);margin-top:4px;font-size:11.5px}' +
      '.ihr-list{margin-top:10px;display:flex;flex-direction:column;gap:7px}' +
      '.ihr-row{display:flex;align-items:center;gap:8px;border:1px solid rgba(255,255,255,.16);background:rgba(0,0,0,.12);border-radius:10px;padding:8px 10px;flex-wrap:wrap}' +
      '.ihr-row input[type=checkbox]{width:18px;height:18px;accent-color:#3b82f6;flex:none}' +
      '.ihr-name{flex:1;min-width:140px;font-size:13px;font-weight:700;color:#fff;word-break:break-all}.ihr-name small{display:block;font-weight:400;color:rgba(226,232,240,.7);font-size:11px}' +
      '.ihr-row select{border:1px solid rgba(255,255,255,.3);border-radius:8px;padding:6px 8px;font-size:12.5px;min-height:34px;max-width:100%;background:#123c27;color:#fff}' +
      '.ihr-msg{flex-basis:100%;font-size:11.5px;color:rgba(226,232,240,.8);padding-left:26px;word-break:break-word}.ihr-msg.ok{color:#86efac}.ihr-msg.err{color:#fca5a5}.ihr-msg.run{color:#93c5fd}' +
      '.ihr-msg a{color:#fde68a;margin-left:6px;font-weight:700;text-decoration:none;white-space:nowrap}' +
      '.ihr-bar{display:flex;gap:8px;justify-content:flex-end;margin-top:10px;flex-wrap:wrap}' +
      '.ihr-btn{border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.1);color:#fff;border-radius:10px;padding:8px 14px;font-weight:700;font-size:13px;cursor:pointer}.ihr-btn.p{background:#2563eb;border-color:#2563eb}.ihr-btn:disabled{opacity:.5;cursor:wait}' +
      '.ihr-sum{margin-top:8px;font-size:12px;color:#fde68a}';
    doc.head.appendChild(s);
  }
  function render() {
    if (!root) return;
    var html = '<div class="ihr-title">📥 ' + L('智慧匯入', 'Smart Import', 'នាំចូលឆ្លាតវៃ') + ' <small>· ' + L('一個入口，自動分到各模組', 'one place, routed to each module', 'កន្លែងតែមួយ') + '</small></div>' +
      '<div class="ihr-drop" id="ihr-drop" role="button" tabindex="0"><b>📥 ' + L('把檔案拖進來，或點這裡選檔', 'Drop files here or tap to choose', 'ទម្លាក់ឯកសារ ឬចុចជ្រើស') + '</b>' +
      '<small>' + L('Excel／每日出勤 .msg 依檔名自動判斷模組（可以改），匯入後自動上傳雲端；匯過的檔不會重複匯入。', 'Excel / daily attendance .msg are routed by file name (you can change it) and uploaded; files already imported are skipped.', 'Excel នឹងទៅម៉ូឌុលត្រឹមត្រូវ') + '</small></div>' +
      '<input type="file" id="ihr-file" multiple accept=".xlsx,.xls,.xlsm,.csv,.msg,.eml,.pdf,image/*" style="display:none">';
    if (items.length) {
      html += '<div class="ihr-list">' + items.map(function (it) {
        var dis = busy || it.state === 'later' || it.state === 'detect' || it.state === 'run' ? ' disabled' : '';
        var opts = '<option value="">' + esc(L('（不匯入）', '(skip)', '(skip)')) + '</option>' + ORDER.map(function (k) { return '<option value="' + k + '"' + (it.dest === k ? ' selected' : '') + '>' + DEST[k].ico + ' ' + esc(destName(k)) + '</option>'; }).join('');
        var cls = it.state === 'ok' ? 'ok' : it.state === 'err' || it.state === 'pick' ? 'err' : it.state === 'run' || it.state === 'detect' ? 'run' : '';
        var msg = it.state === 'detect' ? L('判斷中…', 'Checking…', '…') : it.state === 'ok' ? '✓ ' + it.msg : it.state === 'err' ? '⚠ ' + it.msg : it.msg;
        var link = (it.state === 'ok' || it.state === 'err') && it.doneDest ? '<a href="' + DEST[it.doneDest].page + '" target="_self">' + L('開啟', 'Open', 'បើក') + ' ↗</a>' : '';
        return '<div class="ihr-row"><input type="checkbox" data-i="' + it.id + '"' + (it.on ? ' checked' : '') + dis + '>' +
          '<span class="ihr-name">' + esc(it.name) + '<small>' + kb(it.size) + '</small></span>' +
          '<select data-d="' + it.id + '"' + dis + '>' + opts + '</select>' +
          (msg || link ? '<div class="ihr-msg ' + cls + '">' + esc(msg) + link + '</div>' : '') + '</div>';
      }).join('') + '</div><div class="ihr-bar">' +
        '<button class="ihr-btn" type="button" id="ihr-clear"' + (busy ? ' disabled' : '') + '>🧹 ' + L('清除清單', 'Clear list', 'សម្អាត') + '</button>' +
        '<button class="ihr-btn p" type="button" id="ihr-run"' + (busy ? ' disabled' : '') + '>' + (busy ? '◐ ' + L('匯入中…', 'Importing…', '…') : '⬆️ ' + L('匯入並上傳', 'Import & upload', 'នាំចូល') + ' (' + items.filter(function (it) { return it.on && it.dest; }).length + ')') + '</button></div>';
    }
    html += '<div class="ihr-sum" id="ihr-sum" style="display:none"></div>';
    var keep = root.querySelector('#ihr-sum'), keepTxt = keep ? keep.textContent : '';
    root.innerHTML = html; if (keepTxt) say(keepTxt);
    var drop = root.querySelector('#ihr-drop'), inp = root.querySelector('#ihr-file');
    drop.onclick = function () { if (!busy) { inp.value = ''; inp.click(); } };
    drop.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); drop.onclick(); } };
    drop.ondragover = function (e) { e.preventDefault(); drop.classList.add('over'); };
    drop.ondragleave = function () { drop.classList.remove('over'); };
    drop.ondrop = function (e) { e.preventDefault(); drop.classList.remove('over'); if (!busy && e.dataTransfer && e.dataTransfer.files.length) addFiles(Array.prototype.slice.call(e.dataTransfer.files)); };
    inp.onchange = function () { if (inp.files.length) addFiles(Array.prototype.slice.call(inp.files)); };
    root.querySelectorAll('input[data-i]').forEach(function (b) { b.onchange = function () { var it = items.filter(function (x) { return x.id === +b.dataset.i; })[0]; if (it) { it.on = b.checked && !!it.dest; render(); } }; });
    root.querySelectorAll('select[data-d]').forEach(function (s) { s.onchange = function () { var it = items.filter(function (x) { return x.id === +s.dataset.d; })[0]; if (it) { it.dest = s.value; it.on = !!s.value; if ((it.state === 'pick' || it.state === 'ready') && s.value) { it.state = 'ready'; it.msg = L('手動指定', 'chosen manually', ''); } render(); } }; });
    var rb = root.querySelector('#ihr-run'); if (rb) rb.onclick = run;
    var cb = root.querySelector('#ihr-clear'); if (cb) cb.onclick = function () { items = []; say(''); render(); };
  }
  function mount(host) {
    css();
    host = typeof host === 'string' ? doc.querySelector(host) : host;
    if (!host) { var hs = doc.getElementById('home-sync'); if (!hs) return; host = doc.createElement('div'); hs.parentNode.insertBefore(host, hs); }
    host.id = 'hra-import-hub'; host.className = 'ihr'; root = host; render();
    doc.querySelectorAll('.lb').forEach(function (b) { b.addEventListener('click', function () { setTimeout(render, 30); }); });
    /* 匯入中離開頁面要提醒 */
    g.addEventListener('beforeunload', function (e) { if (busy) { e.preventDefault(); e.returnValue = ''; } });
  }
  g.HRAImportHub = { version: '1.0', mount: mount, classify: classify, addFiles: addFiles, run: run, items: function () { return items; } };
  function auto() { if (doc.getElementById('home-sync') && !root) mount(doc.getElementById('hra-import-hub')); }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', auto); else auto();
})(window);
