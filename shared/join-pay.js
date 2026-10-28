/* shared/join-pay.js — 新進員工起薪（2026-10-28，Paul：入職核可卡要附薪資，算式要寫清楚）
   資料來源：HRA-PAY「薪資架構」（同網域 IndexedDB ac_hra_salary_v1 ＋ 雲端 tool 'salary' 唯讀）。
   規則和 HRA-PAY 薪資架構頁 payFor() 相同：
     底薪 = 入職日當年度法定底薪（試用期用試用底薪＝正式 − $2）
     職務／技術加給 = 職稱對應的職等職級（試用期是否給，依架構設定 probAllowance）
     全勤、交通住宿 = 職等表；沒有對應時用架構預設值
     月固定 = 底薪 ＋ 職務 ＋ 技術 ＋ 全勤 ＋ 交通住宿 ＋ 臨時津貼
   有在 HRA-PAY 員工名單指定職等的，以指定為準；否則用職稱對應的預設職等。 */
(function (g) {
  'use strict';
  var STATE = null, LOADING = null, SOURCE = '';
  function num(v) { var n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isFinite(n) ? n : 0; }
  function live(a) { return (a || []).filter(function (r) { return r && !r.deleted; }); }
  function parseGrade(code) { var s = String(code || '').trim(), m = s.match(/^(\d)\s*[-–]\s*(\d{1,2})$/); if (m) return { rank: +m[1], level: ('0' + m[2]).slice(-2) }; m = s.match(/^(\d)$/); return m ? { rank: +m[1], level: '01' } : null; }
  function normTitle(s) { return String(s || '').toLowerCase().replace(/[\s_\-\/()（）.,]+/g, '').replace(/line\d+$/, ''); }
  function addMonths(d, n) { if (!d) return ''; var p = d.split('-').map(Number), dt = new Date(p[0], p[1] - 1 + n, p[2]); return dt.getFullYear() + '-' + ('0' + (dt.getMonth() + 1)).slice(-2) + '-' + ('0' + dt.getDate()).slice(-2); }
  function money(v) { return '$' + (Math.round(num(v) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  function readIdb() {
    return new Promise(function (res) {
      try {
        var r = indexedDB.open('ac_hra_salary_v1', 1);
        r.onupgradeneeded = function (e) { var d = e.target.result; if (!d.objectStoreNames.contains('snapshots')) d.createObjectStore('snapshots'); };
        r.onerror = function () { res(null); };
        r.onsuccess = function (e) {
          var db = e.target.result;
          try { var q = db.transaction('snapshots', 'readonly').objectStore('snapshots').get('main'); q.onsuccess = function () { db.close(); res(q.result || null); }; q.onerror = function () { db.close(); res(null); }; }
          catch (err) { db.close(); res(null); }
        };
      } catch (e) { res(null); }
    });
  }
  function fromRecords(recs) {
    var st = { basic: [], grades: [], titles: [], employees: [], assignments: [], overrides: [], settings: {} }, sAt = '';
    (recs || []).forEach(function (r) {
      if (!r || typeof r !== 'object') return;
      if (r._kind === 'settings') { if (String(r.updatedAt || '') >= sAt) { st.settings = Object.assign({}, r.settings || {}); sAt = String(r.updatedAt || ''); } return; }
      if (st[r._kind]) st[r._kind].push(r);
    });
    return st;
  }
  function merge(a, b) {
    if (!a) return b; if (!b) return a;
    var out = { settings: Object.assign({}, a.settings || {}, b.settings || {}) };
    ['basic', 'grades', 'titles', 'employees', 'assignments', 'overrides'].forEach(function (k) {
      var m = {}; (a[k] || []).concat(b[k] || []).forEach(function (r) { var cur = m[r._k]; if (!cur || String(r.updatedAt || '') >= String(cur.updatedAt || '')) m[r._k] = r; });
      out[k] = Object.keys(m).map(function (x) { return m[x]; });
    });
    return out;
  }
  function gasUrl() { try { return (localStorage.getItem('vrt_att_cloud_v1_url') || localStorage.getItem('ac_hra_gas_url') || '').trim(); } catch (e) { return ''; } }
  /* 先讀本機（快），雲端唯讀補上；雲端最多等 60 秒 */
  function load(force) {
    if (STATE && !force) return Promise.resolve(STATE);
    if (LOADING) return LOADING;
    LOADING = readIdb().then(function (local) {
      if (local) { STATE = local; SOURCE = 'local'; }
      var url = gasUrl();
      if (!g.HRASmartSync || !g.HRASmartSync.readRemote || !url || (typeof navigator !== 'undefined' && navigator.onLine === false)) return STATE;
      var cloud = g.HRASmartSync.readRemote({ url: url, tool: 'salary' }).then(function (rr) {
        var st = fromRecords(rr && rr.records); if (live(st.basic).length || live(st.titles).length) { STATE = merge(STATE, st); SOURCE = STATE === st ? 'cloud' : (local ? 'local+cloud' : 'cloud'); }
        return STATE;
      }).catch(function (e) { console.warn('[join-pay] salary cloud', e); return STATE; });
      return Promise.race([cloud, new Promise(function (r) { setTimeout(function () { r(STATE); }, 60000); })]);
    }).then(function (s) { LOADING = null; return s; }, function () { LOADING = null; return STATE; });
    return LOADING;
  }
  function titleFor(st, position) {
    var p = normTitle(position); if (!p) return null; var rows = live(st.titles);
    var hit = rows.find(function (t) { return normTitle(t.en) === p || normTitle(t.zh) === p; }); if (hit) return hit;
    hit = rows.find(function (t) { return (t.en && normTitle(t.en).length >= 6 && p.indexOf(normTitle(t.en)) >= 0) || (t.zh && normTitle(t.zh).length >= 2 && p.indexOf(normTitle(t.zh)) >= 0); }); if (hit) return hit;
    return rows.filter(function (t) { return t.en; }).sort(function (a, b) { return a.en.length - b.en.length; }).find(function (t) { return normTitle(t.en).indexOf(p) >= 0 && p.length >= 5; }) || null;
  }
  function basicRow(st, date) { var rows = live(st.basic).filter(function (b) { return b.effectiveFrom && b.effectiveFrom <= date; }).sort(function (a, b) { return a.effectiveFrom < b.effectiveFrom ? -1 : 1; }); return rows[rows.length - 1] || null; }
  function gradeRow(st, track, code) { var gg = parseGrade(code); if (!gg) return null; return live(st.grades).find(function (r) { return r.track === track && +r.rank === gg.rank && ('0' + r.level).slice(-2) === gg.level; }) || null; }
  function latest(rows, empId, date) { var r = live(rows).filter(function (a) { return String(a.empId) === String(empId) && (!a.effectiveFrom || a.effectiveFrom <= date); }).sort(function (a, b) { return String(a.effectiveFrom || '') < String(b.effectiveFrom || '') ? -1 : 1; }); return r[r.length - 1] || null; }

  /* 計算一位新進員工入職當月的月固定薪資。lang: zh / en / km */
  function forJoin(j, lang) {
    lang = lang || 'zh';
    function L(zh, en, km) { return lang === 'en' ? en : lang === 'km' ? (km || en) : zh; }
    var st = STATE;
    if (!st) return { ok: false, calc: L('薪資架構還沒載入（請先開過一次 HRA-PAY 薪資架構，或稍後再送）', 'Salary structure not loaded yet (open HRA-PAY Salary Structure once, or send again shortly)', 'មិនទាន់ផ្ទុករចនាសម្ព័ន្ធប្រាក់ខែ') };
    var date = String(j.joinDate || '').slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, calc: L('缺入職日，無法計算薪資', 'No join date — salary not computed', 'គ្មានថ្ងៃចូល') };
    var emp = live(st.employees).find(function (e) { return String(e.empId) === String(j.empId); }) || null;
    var t = titleFor(st, j.position || (emp && emp.position));
    var a = latest(st.assignments, j.empId, date), o = latest(st.overrides, j.empId, date); if (o && o.cleared) o = null;
    var track = (emp && emp.payTrack) || (t && t.payTrack) || 'prod';
    var grade = (a && a.grade) || (t && t.grade) || '';
    var gr = grade ? gradeRow(st, track, grade) : null;
    var b = basicRow(st, date), set = st.settings || {};
    if (!b) return { ok: false, calc: L('薪資架構沒有 ' + date.slice(0, 4) + ' 年法定底薪', 'Salary structure has no ' + date.slice(0, 4) + ' statutory basic wage', 'គ្មានប្រាក់គោល ' + date.slice(0, 4)) };
    var probMonths = (emp && emp.probMonths != null && emp.probMonths !== '') ? num(emp.probMonths) : (t && t.probMonths != null ? num(t.probMonths) : (track === 'prod' && (!parseGrade(grade) || parseGrade(grade).rank <= 1) ? num(set.probWorker || 2) : num(set.probStaff || 3)));
    var regular = num(b.regular), prob = (b.probation == null || b.probation === '') ? regular - 2 : num(b.probation);
    var basic = probMonths > 0 ? prob : regular;
    var probAllow = set.probAllowance !== false;
    var job = gr ? num(gr.job) : 0, skill = gr ? num(gr.skill) : 0;
    var att = gr ? num(gr.attendance) : (num(set.attendanceDefault) || 10), hous = gr ? num(gr.housing) : (num(set.housingDefault) || 7);
    if (probMonths > 0 && !probAllow) { job = 0; skill = 0; }
    var ov = false; if (o) { ['job', 'skill', 'attendance', 'housing'].forEach(function (k) { if (o[k] !== undefined && o[k] !== null && o[k] !== '') { ov = true; var v = num(o[k]); if (k === 'job') job = v; else if (k === 'skill') skill = v; else if (k === 'attendance') att = v; else hous = v; } }); }
    var temp = num(set.temp), total = Math.round((basic + job + skill + att + hous + temp) * 100) / 100;
    /* 逐項重算一次（和上面獨立加總），確認合計無誤 */
    var parts = [[probMonths > 0 ? L('試用底薪', 'Probation basic', 'ប្រាក់គោលសាកល្បង') : L('底薪', 'Basic', 'ប្រាក់គោល'), basic, probMonths > 0 && regular !== prob ? '(' + money(regular) + ' − ' + money(regular - prob) + ')' : '']];
    if (job) parts.push([L('職務', 'Job', 'មុខតំណែង'), job]);
    if (skill) parts.push([L('技術', 'Skill', 'ជំនាញ'), skill]);
    parts.push([L('全勤', 'Attendance', 'វត្តមាន'), att]);
    parts.push([L('交通住宿', 'Transport/Housing', 'ធ្វើដំណើរ/ស្នាក់នៅ'), hous]);
    if (temp) parts.push([L('臨時津貼', 'Temp allowance', 'ប្រាក់បណ្ដោះអាសន្ន'), temp]);
    var re = Math.round(parts.reduce(function (s, x) { return s + x[1]; }, 0) * 100) / 100, ok = Math.abs(re - total) < 0.005;
    var calc = parts.map(function (x) { return x[0] + ' ' + money(x[1]) + (x[2] ? ' ' + x[2] : ''); }).join(' + ') + ' = ' + money(re) + L('/月', '/mo', '/ខែ') + (ok ? ' ✔' : ' ≠ ' + money(total));
    calc += ' · ' + L('職等', 'Grade', 'កាំប្រាក់') + ' ' + (grade || '—') + (t ? ' ' + (lang === 'zh' ? (t.zh || t.en) : (t.en || t.zh)) : '');
    var probText = probMonths > 0 ? L('試用 ' + probMonths + ' 個月，' + addMonths(date, probMonths) + ' 轉正（底薪 ' + money(regular) + '）', probMonths + '-month probation, regular from ' + addMonths(date, probMonths) + ' (basic ' + money(regular) + ')', 'សាកល្បង ' + probMonths + ' ខែ ដល់ ' + addMonths(date, probMonths)) : '';
    if (a) calc += L('（員工名單指定）', ' (assigned in employee list)', ' (កំណត់ក្នុងបញ្ជី)');
    if (ov) calc += ' · ' + L('含個人加給調整', 'includes personal override', 'មានការកែប្រែផ្ទាល់ខ្លួន');
    var warn = '';
    if (!t && !a) warn = L('職稱「' + (j.position || '—') + '」不在薪資架構，加給用預設值', 'Title "' + (j.position || '—') + '" not in salary structure; default allowances', 'រកមិនឃើញមុខតំណែង');
    else if (grade && !gr) warn = L('職等 ' + grade + ' 在職等表沒有資料', 'Grade ' + grade + ' missing from the grade table', 'គ្មានកាំប្រាក់ ' + grade);
    if (warn) calc += ' · ⚠ ' + warn;
    return { ok: true, total: re, basic: basic, regular: regular, prob: prob, probMonths: probMonths, job: job, skill: skill, attendance: att, housing: hous, temp: temp, grade: grade, title: t, mapped: !warn, verified: ok && !warn ? true : undefined, calc: calc, probText: probText, warn: warn, source: SOURCE };
  }
  g.HRAJoinPay = { version: '1.0', load: load, forJoin: forJoin, ready: function () { return !!STATE; } };
})(typeof window !== 'undefined' ? window : this);
