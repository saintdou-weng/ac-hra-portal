/* shared/hra-unsent.js — 未送核可提醒（2026-10-29，Paul）
   規則：資料填了 Pending、可以送核可，但從來沒送出（沒有核可卡、也沒有結果），超過 3 天 → 提醒。
   · 頁面上：在指定位置顯示紅色提醒框＋清單（每筆可直接按 ✈️）
   · 每天 08:00：GAS（AC_HRA_CloudSync v67）把各頁送來的清單彙總發一則到群組
   各頁只要算出清單後呼叫 HRAUnsent.update({module,label,platform,items,box,lang,onSend})。
   item: {key, name, detail, date, since, days, warn}  （days = 從填寫／匯入到今天的天數） */
(function (g) {
  'use strict';
  var DAYS = 3, DATE_GAP = 40;
  var DEFAULT_GAS = 'https://script.google.com/macros/s/AKfycbya4jZG7YixRmumt9vKA-5Cv92jP8fi_o4toiU-8J2exQCYBhBsLOtN4kX9hoKqzp12/exec';
  function gasUrl() { try { return (localStorage.getItem('vrt_att_cloud_v1_url') || localStorage.getItem('ac_hra_gas_url') || '').trim() || DEFAULT_GAS; } catch (e) { return DEFAULT_GAS; } }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function toMs(v) { if (!v) return 0; var s = String(v).trim().replace(' ', 'T'); var t = Date.parse(s); if (isNaN(t) && /^\d{4}-\d{2}-\d{2}$/.test(s)) t = Date.parse(s + 'T00:00:00'); return isNaN(t) ? 0 : t; }
  function daysSince(v) { var t = toMs(v); return t ? Math.floor((Date.now() - t) / 86400000) : 0; }
  function dayDiff(a, b) { var x = toMs(String(a).slice(0, 10)), y = toMs(String(b).slice(0, 10)); return x && y ? Math.round((y - x) / 86400000) : null; }
  /* 生效日和填寫日相差超過 40 天 → 可能月／日顛倒 */
  function dateGapWarn(effDate, enteredAt, lang) {
    var d = dayDiff(enteredAt, effDate); if (d == null || Math.abs(d) <= DATE_GAP) return '';
    return lang === 'en' ? 'effective date is ' + Math.abs(d) + ' days ' + (d < 0 ? 'before' : 'after') + ' entry — check day/month'
         : lang === 'km' ? 'ថ្ងៃចូលជាធរមានខុសគ្នា ' + Math.abs(d) + ' ថ្ងៃ'
         : '生效日比填寫日' + (d < 0 ? '早 ' : '晚 ') + Math.abs(d) + ' 天，請確認月／日沒有顛倒';
  }
  var PK = {};
  /* 已送出、還在群組待核卡片裡的項目 key（Portal 模組用） */
  function pendingKeys(module) {
    var c = PK[module]; if (c && Date.now() - c.at < 300000) return Promise.resolve(c.keys);
    return fetch(gasUrl(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'pendingItemKeys', module: module }) })
      .then(function (r) { return r.json(); }).then(function (d) { var keys = ((d && (d.data || d)) || {}).keys || {}; PK[module] = { at: Date.now(), keys: keys }; return keys; })
      .catch(function () { return (c && c.keys) || {}; });
  }
  /* 沒有建立時間的資料：第一次看到就記下日期，從那天起算 */
  function firstSeen(module, key) {
    var k = 'hra_unsent_seen_' + module, m = {};
    try { m = JSON.parse(localStorage.getItem(k) || '{}') || {}; } catch (e) {}
    if (!m[key]) { m[key] = new Date().toISOString(); try { localStorage.setItem(k, JSON.stringify(m)); } catch (e) {} }
    return m[key];
  }
  /* HRA-PAY：從 PAY GAS 取已送出的期間（不論待審、待核、已核、退回） */
  var PP = {};
  function payPeriods(url, module) {
    var c = PP[module]; if (c && Date.now() - c.at < 300000) return Promise.resolve(c.set);
    if (!url) return Promise.resolve(null);
    return fetch(url + (url.indexOf('?') >= 0 ? '&' : '?') + 'action=approvalStatus&module=' + encodeURIComponent(module))
      .then(function (r) { return r.json(); }).then(function (d) {
        var x = (d && (d.data || d)) || {}, rows = x.records || x.rows || x.list || (Array.isArray(x) ? x : []), set = {};
        rows.forEach(function (r) { var p = r && (r.period || r.Period); if (p) set[String(p)] = r.status || r.code || 'sent'; });
        PP[module] = { at: Date.now(), set: set }; return set;
      }).catch(function () { return null; });   /* 查不到就不判斷，免得把已送的也提醒 */
  }
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
  /* 送給 GAS：內容有變或超過 6 小時才送，避免每次重繪都打雲端 */
  function report(o) {
    var items = (o.items || []).filter(function (x) { return (x.days || 0) >= DAYS; });
    var body = { action: 'unsentReport', module: o.module, label: o.label, platform: o.platform || 'portal', page: o.page || location.pathname.split('/').pop(), items: items, by: o.by || '' };
    var sig = hash(JSON.stringify(items.map(function (x) { return [x.key, x.days, x.warn]; }))), k = 'hra_unsent_sig_' + o.module, old = null;
    try { old = JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) {}
    if (old && old.sig === sig && Date.now() - old.at < 6 * 3600000) return Promise.resolve({ skipped: true });
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.resolve({ offline: true });
    return fetch(gasUrl(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); }).then(function (d) { if (d && d.ok !== false) { try { localStorage.setItem(k, JSON.stringify({ sig: sig, at: Date.now() })); } catch (e) {} } return d; })
      .catch(function (e) { console.warn('[unsent report]', e); return { ok: false }; });
  }
  function L(lang, zh, en, km) { return lang === 'en' ? en : lang === 'km' ? (km || en) : zh; }
  /* 紅色提醒框 */
  function render(box, items, lang, onSend) {
    if (typeof box === 'string') box = document.getElementById(box);
    if (!box) return;
    var late = (items || []).filter(function (x) { return (x.days || 0) >= DAYS; }).sort(function (a, b) { return b.days - a.days; });
    var warnOnly = (items || []).filter(function (x) { return (x.days || 0) < DAYS && x.warn; });
    if (!late.length && !warnOnly.length) { box.innerHTML = ''; box.style.display = 'none'; return; }
    box.style.display = '';
    var row = function (x, i) {
      return '<li style="margin:3px 0;display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span style="font-weight:600">' + esc(x.name || x.key) + '</span>' +
        (x.detail ? '<span style="color:#64748b">' + esc(x.detail) + '</span>' : '') + (x.date ? '<span style="font-family:ui-monospace,monospace">' + esc(x.date) + '</span>' : '') +
        ((x.days || 0) >= DAYS ? '<b style="color:#b91c1c">' + x.days + ' ' + esc(L(lang, '天未送', 'days unsent', 'ថ្ងៃ')) + '</b>' : '') +
        (x.warn ? '<span style="color:#b45309">⚠️ ' + esc(x.warn) + '</span>' : '') +
        (onSend ? '<button type="button" data-unsent-i="' + i + '" style="margin-left:auto;font-size:12px;padding:2px 10px;border-radius:8px;border:1px solid #c7d2fe;background:#eef2ff;color:#4338ca;cursor:pointer">✈️ ' + esc(L(lang, '送核可', 'Send', 'ផ្ញើ')) + '</button>' : '') + '</li>';
    };
    var all = late.concat(warnOnly);
    box.innerHTML = '<div style="border:1px solid #fecaca;background:#fef2f2;border-radius:12px;padding:10px 14px;margin:8px 0;font-size:13px;color:#7f1d1d">' +
      (late.length ? '<div style="font-weight:700">⏰ ' + esc(L(lang, '有 ' + late.length + ' 筆填了 Pending，超過 3 天還沒送出審查／核可', late.length + ' item(s) are Pending and have not been sent for approval for 3+ days', 'មាន ' + late.length + ' មិនទាន់ផ្ញើលើស 3 ថ្ងៃ')) + '</div>' : '') +
      (warnOnly.length ? '<div style="font-weight:700;color:#92400e">⚠️ ' + esc(L(lang, warnOnly.length + ' 筆日期請再確認', warnOnly.length + ' date(s) to double-check', 'ពិនិត្យថ្ងៃ ' + warnOnly.length)) + '</div>' : '') +
      '<ul style="margin:6px 0 2px;padding-left:2px;list-style:none">' + all.slice(0, 20).map(row).join('') + '</ul>' +
      (all.length > 20 ? '<div>… +' + (all.length - 20) + '</div>' : '') +
      '<div style="color:#991b1b;font-size:11px;margin-top:4px">' + esc(L(lang, '每天早上 8 點也會在群組提醒一次，送出後就會消失。', 'A reminder is also posted to the group every morning at 08:00; items disappear once sent.', 'ក៏នឹងរំលឹកក្នុងក្រុមរៀងរាល់ព្រឹក')) + '</div></div>';
    if (onSend) Array.prototype.forEach.call(box.querySelectorAll('[data-unsent-i]'), function (b) { b.onclick = function () { onSend(all[+b.getAttribute('data-unsent-i')]); }; });
  }
  function update(o) {
    render(o.box, o.items, o.lang || 'zh', o.onSend);
    return report(o);
  }
  g.HRAUnsent = { version: '1.0', firstSeen: firstSeen, payPeriods: payPeriods, DAYS: DAYS, DATE_GAP: DATE_GAP, daysSince: daysSince, dayDiff: dayDiff, dateGapWarn: dateGapWarn, pendingKeys: pendingKeys, report: report, render: render, update: update };
})(typeof window !== 'undefined' ? window : this);
