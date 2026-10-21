/* AC HRA Portal — 參考報告（Word）v1.0 · 2026-10-21
 * 每個模組頁多一顆「📄 報告」：把目前畫面的期間、重點數字、表格、圖表整理成 .docx 下載。
 * 只給人看、存檔用，不發 Telegram、不上傳雲端。語言：中英 ／ 英柬 ／ 目前語言。
 * 做法：依序切換頁面語言 → 擷取畫面（.kpi、可見表格、Chart 畫布）→ 還原語言 → docx（shared/docx.iife.js）。
 * 不改任何模組的資料或同步邏輯；任何一步失敗只顯示訊息，不影響頁面。 */
(function (g) {
  'use strict';
  if (g.HRAReport) return;
  var doc = g.document; if (!doc) return;
  var MODULE = (function () {
    var p = (location.pathname.split('/').pop() || '').replace(/\.html.*$/, '');
    var map = { ac_hra_attendance_v1:['出勤','Attendance','វត្តមាន'], ac_hra_employee_leave_v1:['員工請假','Employee Leave','ច្បាប់ឈប់សម្រាក'],
      ac_hra_onboarding_v3:['新進／離職','Onboarding & Turnover','ចូល / ចេញការងារ'], ac_hra_contract_v2:['試用期／合約','Probation & Contract','សាកល្បង / កិច្ចសន្យា'],
      ac_hra_maternity_v1:['產假／員工健康','Maternity & Employee Health','មាតុភាព / សុខភាព'], ac_hra_calendar_v2:['行事曆','Calendar','ប្រតិទិន'],
      ac_hra_manpower_v1:['人力規劃','Manpower & Recruitment','កម្លាំងពលកម្ម'], ac_hra_certificate_visa_v1:['證書／簽證','Certificate & Visa','វិញ្ញាបនបត្រ / ទិដ្ឋាការ'],
      ac_hra_welfare_suggestion_v1:['福利／意見箱','Welfare & Suggestion','សុខុមាលភាព'], ac_hra_salary_v1:['薪資架構／職等','Salary Structure & Grades','រចនាសម្ព័ន្ធប្រាក់ខែ'],
      ac_hra_complete_v2:['整合分析','Integrated Analytics','វិភាគរួម'] };
    return { id: p, name: map[p] || [doc.title, doc.title, doc.title] };
  })();
  var L = function (lang, zh, en, km) { return lang === 'en' ? en : lang === 'km' ? (km || en) : zh; };
  function now() { var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }
  function text(el) { return String(el && el.textContent || '').replace(/\s+/g, ' ').trim(); }
  function visible(el) { if (!el || !el.offsetParent) return false; var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }
  function currentLang() {
    /* 各模組的 LANG 多半是 let，不在 window 上；以 <html lang>、語言按鈕的 active 狀態、localStorage 依序判斷 */
    try { var hl = String(doc.documentElement.lang || '').toLowerCase(); if (/^zh/.test(hl)) return 'zh'; if (/^en/.test(hl)) return 'en'; if (/^km/.test(hl)) return 'km'; } catch (_) {}
    try { var on = doc.querySelector('.lang button.on, .lang .on, [data-lang].active, [data-lang].on, .lb.on'); if (on) { var dl = on.getAttribute('data-lang'); if (dl) return dl; var tx = text(on); if (/^(中|繁中|中文)$/.test(tx)) return 'zh'; if (/^EN|English/i.test(tx)) return 'en'; if (/^(ក|ខ្មែរ)$/.test(tx)) return 'km'; } } catch (_) {}
    try { if (typeof g.LANG === 'string') return g.LANG; } catch (_) {}
    try { var s = localStorage.getItem('ac_hra_lang'); if (s) return s; } catch (_) {}
    return 'zh';
  }
  function switchLang(l) {
    try { if (typeof g.setLang === 'function') { g.setLang(l); return true; } } catch (_) {}
    try { if (typeof g.setL === 'function') { g.setL(l); return true; } } catch (_) {}
    try { var b = doc.querySelector('[data-lang="' + l + '"]'); if (b) { b.click(); return true; } } catch (_) {}
    try {
      var want = { zh: /^(中|繁中|中文)$/, en: /^(EN|English)$/i, km: /^(ក|ខ្មែរ)$/ }[l];
      var btns = Array.prototype.slice.call(doc.querySelectorAll('button')), hit = btns.filter(function (x) { return want.test(text(x)); })[0];
      if (hit) { hit.click(); return true; }
    } catch (_) {}
    return false;
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* ── 擷取畫面 ── */
  function sectionTitleFor(el) {
    var n = el, hops = 0;
    while (n && hops < 6) {
      var head = n.querySelector && (n.querySelector('.panel-head h2, .panel-head h3, h2, h3, .card-title, .sec-title'));
      if (head && visible(head) && head.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) return text(head);
      n = n.parentElement; hops++;
    }
    var prev = el.previousElementSibling; while (prev) { if (/^H[1-4]$/.test(prev.tagName) || /panel-head|card-head/.test(prev.className || '')) return text(prev); prev = prev.previousElementSibling; }
    return '';
  }
  function capture() {
    var out = { kpis: [], tables: [], charts: [], period: '' };
    /* 期間 */
    var pEl = doc.querySelector('#periodLabel, #dashPeriod, #periodText, #scPeriodLabel, .period-label');
    if (pEl && visible(pEl)) out.period = text(pEl);
    if (!out.period) { var bar = doc.querySelector('.period-bar'); if (bar) { var sel = bar.querySelector('select[id*="eriod"], select[id*="icker"], select[id*="sel"], select[id*="month"], select[id*="date"]'); var inp = bar.querySelector('input[type=date], input[type=month], input[type=week]'); out.period = (inp && inp.value) || text(sel && sel.selectedOptions && sel.selectedOptions[0]) || ''; } }
    if (!out.period) { var anyDate = doc.querySelector('input[type=date]:not([id^="f"]):not([id^="o"]):not([id^="b"])'); if (anyDate && visible(anyDate) && anyDate.value) out.period = anyDate.value; }
    /* 重點數字 */
    Array.prototype.forEach.call(doc.querySelectorAll('.kpi, .stat-item, .kpi-card, .metric'), function (k) {
      if (!visible(k)) return;
      var label = text(k.querySelector('.label, .kpi-l, .stat-l, .kpi-label, .metric-label')), value = text(k.querySelector('.value, .kpi-n, .stat-v, .kpi-value, .metric-value')), sub = text(k.querySelector('.sub, .kpi-sub'));
      if (!label && !value) { var parts = text(k).split(' '); value = parts[0]; label = parts.slice(1).join(' '); }
      if (label || value) out.kpis.push({ label: label, value: value, sub: sub });
    });
    /* 表格（只取可見、有內容的） */
    Array.prototype.forEach.call(doc.querySelectorAll('table'), function (t) {
      if (!visible(t)) return;
      var rows = Array.prototype.slice.call(t.querySelectorAll('tr')).filter(visible);
      if (rows.length < 2) return;
      var grid = rows.slice(0, 80).map(function (r) { return Array.prototype.slice.call(r.querySelectorAll('th,td')).filter(visible).slice(0, 14).map(function (c) {
        var inp = c.querySelector('input,select'); if (inp && !c.querySelector('button')) return inp.tagName === 'SELECT' ? text(inp.selectedOptions[0]) : String(inp.value || '');
        return text(c).replace(/\b(編輯|Edit|刪除|Delete|×)\b/g, '').trim(); }); });
      grid = grid.filter(function (r) { return r.some(function (x) { return x; }); });
      if (grid.length < 2) return;
      var w = Math.max.apply(null, grid.map(function (r) { return r.length; }));
      grid = grid.map(function (r) { while (r.length < w) r.push(''); return r; });
      out.tables.push({ title: sectionTitleFor(t), grid: grid, truncated: rows.length > 80 });
    });
    /* 圖表 */
    Array.prototype.forEach.call(doc.querySelectorAll('canvas'), function (c) {
      if (!visible(c) || c.width < 120 || c.height < 60) return;
      try { var url = c.toDataURL('image/png'); if (url && url.length > 2000) out.charts.push({ title: sectionTitleFor(c), dataUrl: url, w: c.width, h: c.height }); } catch (_) {}
    });
    return out;
  }
  async function captureLangs(langs) {
    var orig = currentLang(), snaps = [], switched = false;
    for (var i = 0; i < langs.length; i++) {
      var l = langs[i];
      if (l !== (switched ? langs[i - 1] : orig)) { if (!switchLang(l)) { snaps.push({ lang: l, data: capture(), note: 'same-lang' }); continue; } switched = true; await wait(450); }
      snaps.push({ lang: l, data: capture(), note: currentLang() !== l ? 'same-lang' : '' });
    }
    if (switched && langs[langs.length - 1] !== orig) { switchLang(orig); await wait(200); }
    return snaps;
  }

  /* ── 產生 docx ── */
  function b64bytes(dataUrl) { var b = atob(dataUrl.split(',')[1]), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function build(opts, snaps) {
    var D = g.docx; if (!D) throw new Error('docx library not loaded');
    var font = { ascii: 'Calibri', hAnsi: 'Calibri', eastAsia: 'Microsoft JhengHei', cs: 'Khmer OS Battambang' };
    var run = function (t, o) { return new D.TextRun(Object.assign({ text: String(t == null ? '' : t), font: font, size: 20 }, o || {})); };
    var para = function (t, o) { o = o || {}; return new D.Paragraph(Object.assign({ children: [run(t, o.run)], spacing: { after: 80 } }, o.p || {})); };
    var h = function (t, lvl) { return new D.Paragraph({ heading: lvl === 1 ? D.HeadingLevel.HEADING_1 : lvl === 2 ? D.HeadingLevel.HEADING_2 : D.HeadingLevel.HEADING_3, spacing: { before: 200, after: 100 }, children: [run(t, { bold: true, color: '173C60', size: lvl === 1 ? 30 : lvl === 2 ? 26 : 22 })] }); };
    var cell = function (t, o) { o = o || {}; return new D.TableCell({ width: o.width ? { size: o.width, type: D.WidthType.PERCENTAGE } : undefined, shading: o.head ? { fill: 'E8F4F6' } : (o.fill ? { fill: o.fill } : undefined), margins: { top: 40, bottom: 40, left: 80, right: 80 }, children: [new D.Paragraph({ alignment: o.right ? D.AlignmentType.RIGHT : D.AlignmentType.LEFT, children: [run(t, { bold: !!o.head, size: 18 })] })] }); };
    var border = { style: D.BorderStyle.SINGLE, size: 4, color: 'D8E3EC' };
    var tableOf = function (grid) {
      return new D.Table({ width: { size: 100, type: D.WidthType.PERCENTAGE }, borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
        rows: grid.map(function (r, i) { return new D.TableRow({ tableHeader: i === 0, children: r.map(function (c) { return cell(c, { head: i === 0, right: i > 0 && /^[-+$]?[\d,.]+%?$/.test(c) }); }) }); }) });
    };
    var children = [];
    var names = MODULE.name, lang0 = opts.langs[0];
    /* 封面 */
    children.push(new D.Paragraph({ spacing: { after: 60 }, children: [run('Vantage River Textiles · AC HRA Portal', { color: '6D7D8F', size: 18 })] }));
    children.push(new D.Paragraph({ spacing: { after: 120 }, children: [run((opts.title || names[0] + ' ' + L(lang0, '參考報告', 'Reference Report', 'របាយការណ៍')), { bold: true, size: 40, color: '173C60' })] }));
    var meta = [[L(lang0, '模組', 'Module', 'ម៉ូឌុល'), opts.langs.map(function (l) { return L(l, names[0], names[1], names[2]); }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(' / ')],
      [L(lang0, '期間', 'Period', 'រយៈពេល'), opts.period || (snaps[0] && snaps[0].data.period) || '—'],
      [L(lang0, '語言', 'Languages', 'ភាសា'), opts.langs.map(function (l) { return { zh: '中文', en: 'English', km: 'ខ្មែរ' }[l]; }).join(' + ')],
      [L(lang0, '產生時間', 'Generated', 'បង្កើត'), now()],
      [L(lang0, '性質', 'Type', 'ប្រភេទ'), L(lang0, '內部參考，不作為核可或發送用', 'Internal reference only; not an approval or group message', 'សម្រាប់យោងផ្ទៃក្នុង')]];
    children.push(new D.Table({ width: { size: 100, type: D.WidthType.PERCENTAGE }, borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border }, rows: meta.map(function (r) { return new D.TableRow({ children: [cell(r[0], { head: true, width: 22 }), cell(r[1], { width: 78 })] }); }) }));
    if (opts.notes) { children.push(h(L(lang0, '說明', 'Notes', 'កំណត់ចំណាំ'), 2)); opts.notes.split('\n').forEach(function (ln) { children.push(para(ln)); }); }
    /* 各語言區段 */
    snaps.forEach(function (s, si) {
      var l = s.lang, d = s.data;
      if (si > 0) children.push(new D.Paragraph({ children: [new D.PageBreak()] }));
      children.push(h({ zh: '中文版', en: 'English', km: 'ភាសាខ្មែរ' }[l] + ' · ' + L(l, names[0], names[1], names[2]) + (d.period ? ' · ' + d.period : ''), 1));
      if (s.note === 'same-lang') children.push(para(L(l, '（此模組沒有這個語言的介面，以目前語言顯示）', '(This module has no UI in this language; shown in the current language.)', '(ម៉ូឌុលនេះគ្មានភាសានេះ)'), { run: { color: '8592A0', size: 16 } }));
      if (opts.kpi && d.kpis.length) {
        children.push(h(L(l, '重點數字', 'Key figures', 'តួលេខសំខាន់'), 2));
        var rows = [], cur = [];
        d.kpis.forEach(function (k) { cur.push(k); if (cur.length === 3) { rows.push(cur); cur = []; } }); if (cur.length) rows.push(cur);
        children.push(new D.Table({ width: { size: 100, type: D.WidthType.PERCENTAGE }, borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
          rows: rows.map(function (r) { while (r.length < 3) r.push(null); return new D.TableRow({ children: r.map(function (k) { return new D.TableCell({ width: { size: 33, type: D.WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 100, right: 100 }, shading: { fill: 'F6FBFC' }, children: k ? [new D.Paragraph({ children: [run(k.label, { color: '68798B', size: 17 })] }), new D.Paragraph({ children: [run(k.value, { bold: true, size: 30, color: '0B7B7B' })] }), new D.Paragraph({ children: [run(k.sub, { color: '8592A0', size: 15 })] })] : [new D.Paragraph({ children: [run('')] })] }); }) }); }) }));
      }
      if (opts.charts && d.charts.length) {
        children.push(h(L(l, '圖表', 'Charts', 'ក្រាហ្វ'), 2));
        d.charts.slice(0, 8).forEach(function (c) {
          var W = 600, H = Math.max(120, Math.min(360, Math.round(W * c.h / c.w)));
          if (c.title) children.push(para(c.title, { run: { bold: true, color: '315B67' } }));
          try { children.push(new D.Paragraph({ spacing: { after: 160 }, children: [new D.ImageRun({ data: b64bytes(c.dataUrl), transformation: { width: W, height: H } })] })); } catch (e) { children.push(para('[chart unavailable]')); }
        });
      }
      if (opts.tables && d.tables.length) {
        children.push(h(L(l, '明細表', 'Tables', 'តារាង'), 2));
        d.tables.slice(0, 12).forEach(function (t) {
          if (t.title) children.push(para(t.title, { run: { bold: true, color: '315B67' } }));
          children.push(tableOf(t.grid));
          if (t.truncated) children.push(para(L(l, '（僅列前 80 列）', '(first 80 rows only)', '(80 ជួរដំបូង)'), { run: { color: '8592A0', size: 16 } }));
          children.push(para(''));
        });
      }
      if (!d.kpis.length && !d.tables.length && !d.charts.length) children.push(para(L(l, '此畫面沒有可擷取的內容，請先切到有資料的分頁。', 'Nothing to capture on this view; switch to a tab with data first.', 'គ្មានទិន្នន័យ')));
    });
    children.push(new D.Paragraph({ spacing: { before: 300 }, children: [run(L(lang0, '資料來源：AC HRA Portal 畫面擷取 · ', 'Source: AC HRA Portal screen capture · ', 'ប្រភព: AC HRA Portal · ') + now(), { color: '8592A0', size: 16 })] }));
    return new D.Document({ creator: 'AC HRA Portal', title: opts.title || names[1], styles: { default: { document: { run: { font: font, size: 20 } } } },
      sections: [{ properties: { page: { margin: { top: 900, bottom: 900, left: 1000, right: 1000 } } }, children: children }] });
  }
  async function generate(opts) {
    await ensureDocx();
    var snaps = await captureLangs(opts.langs);
    var d = build(opts, snaps), blob = await g.docx.Packer.toBlob(d);
    var safe = function (s) { return String(s || '').replace(/[\\/:*?"<>|&]+/g, '-').replace(/\s*-\s*/g, '-').replace(/\s+/g, '_').replace(/^[-_]+|[-_]+$/g, '').slice(0, 60); };
    var today = now().slice(0, 10);
    var per = opts.period && safe(opts.period) !== today ? '_' + safe(opts.period) : '';
    var name = 'VRT_' + safe(MODULE.name[1]) + per + '_' + today + '.docx';
    var a = doc.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; doc.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800);
    return name;
  }
  var docxLoading = null;
  function ensureDocx() {
    if (g.docx) return Promise.resolve();
    if (docxLoading) return docxLoading;
    docxLoading = new Promise(function (res, rej) {
      var s = doc.createElement('script'); s.src = 'shared/docx.iife.js?v=1'; s.onload = function () { g.docx ? res() : rej(new Error('docx not available')); }; s.onerror = function () { rej(new Error('cannot load shared/docx.iife.js')); }; doc.head.appendChild(s);
    });
    return docxLoading;
  }

  /* ── UI ── */
  var CSS = '.hrr-ov{position:fixed;inset:0;background:rgba(7,23,35,.6);z-index:9000;display:flex;align-items:center;justify-content:center;padding:16px}' +
    '.hrr-dlg{width:min(560px,100%);background:#fff;border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.35);font:14px/1.5 Inter,"Noto Sans TC","Segoe UI",system-ui,sans-serif;color:#17283b;overflow:hidden}' +
    '.hrr-h{display:flex;align-items:center;gap:10px;padding:13px 16px;border-bottom:1px solid #d8e3ec;font-weight:800}.hrr-h span{flex:1}.hrr-x{border:0;background:#eef3f6;border-radius:8px;width:32px;height:32px;font-size:18px;cursor:pointer}' +
    '.hrr-b{padding:14px 16px;display:grid;gap:10px}.hrr-f{display:grid;gap:4px}.hrr-f label{font-size:12px;font-weight:800;color:#4d5f70}.hrr-f input,.hrr-f select,.hrr-f textarea{border:1px solid #b9cad4;border-radius:8px;padding:8px 10px;font:inherit}' +
    '.hrr-row{display:flex;gap:14px;flex-wrap:wrap;font-size:13px}.hrr-row label{display:flex;gap:5px;align-items:center;cursor:pointer}.hrr-note{font-size:12px;color:#285d69;background:#eefafb;border:1px solid #b8dde3;border-radius:9px;padding:8px 10px}' +
    '.hrr-ft{display:flex;gap:8px;justify-content:flex-end;padding:12px 16px;border-top:1px solid #d8e3ec}.hrr-btn{border:1px solid #aec1cc;border-radius:9px;background:#fff;padding:8px 14px;font-weight:800;cursor:pointer}.hrr-btn.p{background:#0b7b7b;border-color:#0b7b7b;color:#fff}.hrr-btn:disabled{opacity:.5;cursor:wait}' +
    '.hrr-st{font-size:12px;color:#6d7d8f;flex:1;align-self:center}' +
    '#hrr-fab{position:fixed;right:14px;bottom:72px;z-index:800;border:0;border-radius:999px;background:#173c60;color:#fff;font:800 13px Inter,"Noto Sans TC",system-ui,sans-serif;padding:10px 14px;box-shadow:0 6px 18px rgba(0,0,0,.25);cursor:pointer}';
  function injectCss() { if (doc.getElementById('hrr-css')) return; var s = doc.createElement('style'); s.id = 'hrr-css'; s.textContent = CSS; doc.head.appendChild(s); }
  function open() {
    injectCss(); var lang = currentLang();
    var ov = doc.createElement('div'); ov.className = 'hrr-ov';
    var periodGuess = (function () { var c = capture(); return c.period; })();
    ov.innerHTML = '<div class="hrr-dlg" role="dialog"><div class="hrr-h">📄 <span>' + L(lang, '產生參考報告（Word）', 'Generate reference report (Word)', 'បង្កើតរបាយការណ៍ (Word)') + '</span><button class="hrr-x" type="button">×</button></div>' +
      '<div class="hrr-b"><div class="hrr-note">' + L(lang, '依目前畫面的期間與分頁擷取：重點數字、表格、圖表。先在頁面上切好日／週／月／年與分頁，再按產生。只下載到本機，不發 Telegram、不上傳。', 'Captures the current view (period and tab): key figures, tables and charts. Pick day/week/month/year and the tab on the page first. Downloads only — no Telegram, no cloud upload.', 'ចាប់យកទិដ្ឋភាពបច្ចុប្បន្ន។ ទាញយកតែប៉ុណ្ណោះ។') + '</div>' +
      '<div class="hrr-f"><label>' + L(lang, '報告標題', 'Title', 'ចំណងជើង') + '</label><input id="hrr-title" value="' + (MODULE.name[0] + ' ' + MODULE.name[1] + ' — ' + L(lang, '參考報告', 'Reference Report', 'របាយការណ៍')).replace(/"/g, '&quot;') + '"></div>' +
      '<div class="hrr-f"><label>' + L(lang, '期間（可改）', 'Period (editable)', 'រយៈពេល') + '</label><input id="hrr-period" value="' + String(periodGuess || '').replace(/"/g, '&quot;') + '" placeholder="2026-10 / 2026-10-13 ~ 10-19"></div>' +
      '<div class="hrr-f"><label>' + L(lang, '語言', 'Languages', 'ភាសា') + '</label><select id="hrr-lang"><option value="zh,en">中文 + English</option><option value="en,km">English + ខ្មែរ</option><option value="zh,en,km">中文 + English + ខ្មែរ</option><option value="cur">' + L(lang, '只用目前語言', 'Current language only', 'ភាសាបច្ចុប្បន្ន') + '</option></select></div>' +
      '<div class="hrr-row"><label><input type="checkbox" id="hrr-kpi" checked> ' + L(lang, '重點數字', 'Key figures', 'តួលេខ') + '</label><label><input type="checkbox" id="hrr-charts" checked> ' + L(lang, '圖表', 'Charts', 'ក្រាហ្វ') + '</label><label><input type="checkbox" id="hrr-tables" checked> ' + L(lang, '明細表', 'Tables', 'តារាង') + '</label></div>' +
      '<div class="hrr-f"><label>' + L(lang, '說明／備註（選填）', 'Notes (optional)', 'កំណត់ចំណាំ') + '</label><textarea id="hrr-notes" rows="3" placeholder="' + L(lang, '例：10 月第 2 週；假期影響出勤', 'e.g. Week 2 of October; holiday impact on attendance', '') + '"></textarea></div></div>' +
      '<div class="hrr-ft"><span class="hrr-st" id="hrr-st"></span><button class="hrr-btn" type="button" id="hrr-cancel">' + L(lang, '取消', 'Cancel', 'បោះបង់') + '</button><button class="hrr-btn p" type="button" id="hrr-go">📄 ' + L(lang, '產生並下載', 'Generate & download', 'បង្កើត') + '</button></div></div>';
    doc.body.appendChild(ov);
    var close = function () { ov.remove(); };
    ov.querySelector('.hrr-x').onclick = close; ov.querySelector('#hrr-cancel').onclick = close; ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    try { var pref = localStorage.getItem('ac_hra_report_lang'); if (pref) ov.querySelector('#hrr-lang').value = pref; } catch (_) {}
    ov.querySelector('#hrr-go').onclick = async function () {
      var btn = this, st = ov.querySelector('#hrr-st'); btn.disabled = true;
      var lv = ov.querySelector('#hrr-lang').value, langs = lv === 'cur' ? [currentLang()] : lv.split(',');
      try { localStorage.setItem('ac_hra_report_lang', lv); } catch (_) {}
      try {
        st.textContent = L(lang, '載入元件…', 'Loading…', 'កំពុងផ្ទុក…'); await ensureDocx();
        st.textContent = L(lang, '擷取畫面中（會短暫切換語言）…', 'Capturing (language will switch briefly)…', 'កំពុងចាប់យក…');
        var name = await generate({ title: ov.querySelector('#hrr-title').value.trim(), period: ov.querySelector('#hrr-period').value.trim(), langs: langs, kpi: ov.querySelector('#hrr-kpi').checked, charts: ov.querySelector('#hrr-charts').checked, tables: ov.querySelector('#hrr-tables').checked, notes: ov.querySelector('#hrr-notes').value.trim() });
        st.textContent = '✅ ' + name; setTimeout(close, 1200);
      } catch (e) { st.textContent = '❌ ' + (e && e.message || e); btn.disabled = false; }
    };
  }
  var mountTries = 0;
  function mountButton() {
    if (doc.getElementById('hrr-btn') || doc.getElementById('hrr-fab')) return;
    /* 模組腳本可能在 ac-storage 之後才載入：找不到錨點就等一下再試，最多 8 秒 */
    var anchorNow = doc.querySelector('button[onclick*="exportExcel"], button[onclick*="exportXlsx"], button[onclick*="cloudPull"], button[onclick*="pullCloud"], button[onclick*="cloudPush"], button[onclick*="pushCloud"], button[onclick*="syncToGas"]');
    if (!anchorNow && mountTries++ < 16) { setTimeout(mountButton, 500); return; }
    var anchor = doc.querySelector('button[onclick*="exportExcel"], button[onclick*="exportXlsx"], button[onclick*="cloudPull"], button[onclick*="pullCloud"], button[onclick*="cloudPush"], button[onclick*="pushCloud"], button[onclick*="syncToGas"]');
    var lang = currentLang(), label = '📄 ' + L(lang, '報告', 'Report', 'របាយការណ៍');
    if (anchor && anchor.parentNode) {
      var b = anchor.cloneNode(false); b.id = 'hrr-btn'; b.removeAttribute('onclick'); b.removeAttribute('disabled'); b.removeAttribute('id'); b.id = 'hrr-btn'; b.title = L(lang, '產生參考報告（Word）', 'Generate reference report (Word)', 'បង្កើតរបាយការណ៍');
      b.innerHTML = anchor.querySelector('span,b') ? '<span>📄</span><b>' + L(lang, '報告', 'Report', 'របាយការណ៍') + '</b>' : label;
      b.onclick = open; anchor.parentNode.insertBefore(b, anchor.nextSibling); return;
    }
    var fab = doc.createElement('button'); fab.id = 'hrr-fab'; fab.type = 'button'; fab.textContent = label; fab.onclick = open; injectCss(); doc.body.appendChild(fab);
  }
  g.HRAReport = { version: '1.0', open: open, capture: capture, generate: generate, module: MODULE };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', function () { setTimeout(mountButton, 300); }); else setTimeout(mountButton, 300);
})(window);
