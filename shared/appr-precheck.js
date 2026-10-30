/* shared/appr-precheck.js — 送核可前先查（2026-10-30，Paul：nursing fee 說發不出去）
   原因：那期的項目早就核可過了，GAS 依規則不會再發一張卡，使用者只看到「沒送出」以為壞了。
   現在打開核可視窗就先問雲端：哪些已核可／退回、哪些已在待核單、哪些是新的。
   全部都不用送時，直接在視窗裡講清楚並把送出鈕關掉；部分要送時寫明這次只送幾筆。
   比對規則跟 GAS createApprovalBatch 一樣：先比完整 key，再比前兩段（舊版入離職 key）。 */
(function (g) {
  'use strict';
  var DEFAULT_GAS = 'https://script.google.com/macros/s/AKfycbya4jZG7YixRmumt9vKA-5Cv92jP8fi_o4toiU-8J2exQCYBhBsLOtN4kX9hoKqzp12/exec';
  function gasUrl() { try { return (localStorage.getItem('vrt_att_cloud_v1_url') || localStorage.getItem('ac_hra_gas_url') || '').trim() || DEFAULT_GAS; } catch (e) { return DEFAULT_GAS; } }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function L(lang, zh, en, km) { return lang === 'en' ? en : lang === 'km' ? (km || en) : zh; }
  function post(body) {
    return fetch(gasUrl(), { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); }).then(function (d) { if (!d || d.ok === false) throw new Error((d && d.error) || 'GAS'); return d.data || d; });
  }
  var CACHE = {};
  function load(module) {
    var c = CACHE[module]; if (c && Date.now() - c.at < 20000) return c.p;
    var p = Promise.all([post({ action: 'approvalLedger', module: module }), post({ action: 'pendingItemKeys', module: module })])
      .then(function (x) { return { led: (x[0] && x[0].decisions) || {}, pend: (x[1] && x[1].keys) || {} }; });
    CACHE[module] = { at: Date.now(), p: p };
    p.catch(function () { delete CACHE[module]; });
    return p;
  }
  function st(v) { var s = String((v && typeof v === 'object') ? (v.d || v.s || v.status || '') : v || '').toLowerCase(); return /^(ok|approve|approved|a)$/.test(s) ? 'approved' : /^(no|reject|rejected|r|t)$/.test(s) ? 'rejected' : ''; }
  function hit(led, k) {
    if (led[k] && st(led[k])) return led[k];
    if (k.indexOf('HRC73:') === 0) return null;
    var p = k.split('|'); if (p.length >= 2) { var b = p[0] + '|' + p[1]; if (led[b] && st(led[b])) return led[b]; }
    return null;
  }
  function day(s) { return String(s || '').slice(0, 10); }
  /* 回傳 {fresh, approved:[], rejected:[], pending:[]} */
  function check(module, items) {
    return load(module).then(function (d) {
      var r = { fresh: 0, approved: [], rejected: [], pending: [], total: (items || []).length };
      (items || []).forEach(function (it) {
        var k = String(it.itemId || it.key || ''), v = hit(d.led, k);
        if (v) { (st(v) === 'approved' ? r.approved : r.rejected).push({ name: it.name || k, at: v.at || '', b: v.b || '' }); return; }
        if (d.pend[k]) { r.pending.push({ name: it.name || k, b: d.pend[k] }); return; }
        r.fresh++;
      });
      return r;
    });
  }
  function uniq(a, f) { var o = []; a.forEach(function (x) { var v = f(x); if (v && o.indexOf(v) < 0) o.push(v); }); return o; }
  function message(r, lang) {
    var A = r.approved.length, R = r.rejected.length, P = r.pending.length, N = r.fresh, T = r.total;
    if (!T || (!A && !R && !P)) return null;
    var aWhen = uniq(r.approved, function (x) { return day(x.at); }).slice(0, 2).join(', '), aBatch = uniq(r.approved, function (x) { return x.b; }).slice(0, 2).join(', ');
    var pBatch = uniq(r.pending, function (x) { return x.b; }).slice(0, 2).join(', ');
    var parts = [];
    if (A) parts.push(L(lang, A + ' 筆已核可' + (aWhen ? '（' + aWhen + (aBatch ? ' · ' + aBatch : '') + '）' : ''), A + ' already approved' + (aWhen ? ' (' + aWhen + (aBatch ? ' · ' + aBatch : '') + ')' : ''), A + ' បានអនុម័តរួច' + (aWhen ? ' (' + aWhen + ')' : '')));
    if (R) parts.push(L(lang, R + ' 筆之前被退回（要重送請按「↻ 重送已退回」）', R + ' rejected before (use "↻ Resubmit rejected" to send again)', R + ' ត្រូវបានបដិសេធពីមុន'));
    if (P) parts.push(L(lang, P + ' 筆已在群組待核單' + (pBatch ? '（' + pBatch + '）' : '') + '，請到群組審查／核可', P + ' already waiting in a group approval card' + (pBatch ? ' (' + pBatch + ')' : '') + ' — review/approve it in the group', P + ' កំពុងរង់ចាំក្នុងក្រុម' + (pBatch ? ' (' + pBatch + ')' : '')));
    var sep = lang === 'zh' ? '；' : '; ';
    if (!N) return { block: true, text: L(lang, (T > 1 ? '這 ' + T + ' 筆都' : '這筆') + '不用再送：', 'Nothing new to send for these ' + T + ' item(s): ', 'មិនចាំបាច់ផ្ញើទៀតទេ (' + T + '): ') + parts.join(sep) + L(lang, '。', '.', '') };
    return { block: false, text: L(lang, T + ' 筆中 ', 'Of ' + T + ' item(s): ', 'ក្នុងចំណោម ' + T + ': ') + parts.join(sep) + L(lang, '。這次只會送出 ' + N + ' 筆新的。', '. Only ' + N + ' new item(s) will be sent.', ' · នឹងផ្ញើតែ ' + N + ' ថ្មី') };
  }
  var TOKEN = 0;
  /* o: {box, btn, module, items, lang, disabledClass} */
  function run(o) {
    var box = typeof o.box === 'string' ? document.getElementById(o.box) : o.box, btn = typeof o.btn === 'string' ? document.getElementById(o.btn) : o.btn, lang = o.lang || 'zh';
    if (!box) return Promise.resolve(null);
    var my = ++TOKEN;
    box.style.display = ''; box.className = 'text-[11px] leading-relaxed text-slate-500'; box.textContent = '⏳ ' + L(lang, '正在查雲端核可紀錄…', 'Checking approval records…', 'កំពុងពិនិត្យ…');
    return check(o.module, o.items).then(function (r) {
      if (my !== TOKEN) return r;
      var m = message(r, lang);
      if (!m) { box.className = 'text-[11px] leading-relaxed text-emerald-700'; box.textContent = '✔ ' + L(lang, (r.total > 1 ? r.total + ' 筆都是新的' : '這筆是新的') + '，可以送出。', (r.total > 1 ? 'All ' + r.total + ' items are' : 'This item is') + ' new and can be sent.', 'ធាតុ ' + r.total + ' ថ្មី អាចផ្ញើបាន'); return r; }
      box.className = 'text-[11px] leading-relaxed font-semibold rounded-lg px-3 py-2 ' + (m.block ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-sky-50 text-sky-800 border border-sky-200');
      box.innerHTML = (m.block ? '🛈 ' : 'ℹ️ ') + esc(m.text);
      if (m.block && btn) { btn.disabled = true; btn.className = o.disabledClass || 'flex-1 text-xs font-bold px-3 py-2.5 rounded-lg bg-slate-200 text-slate-400 cursor-not-allowed'; }
      return r;
    }).catch(function () {
      if (my !== TOKEN) return null;
      box.className = 'text-[11px] leading-relaxed text-slate-400'; box.textContent = L(lang, '（查不到雲端核可紀錄，送出時由雲端判斷）', '(Could not check approval records; the cloud will decide on send)', '(មិនអាចពិនិត្យបាន)');
      return null;
    });
  }
  function clear(box) { box = typeof box === 'string' ? document.getElementById(box) : box; if (box) { TOKEN++; box.textContent = ''; box.style.display = 'none'; } }
  g.HRAApprCheck = { version: '1.0', check: check, message: message, run: run, clear: clear };
})(typeof window !== 'undefined' ? window : this);
