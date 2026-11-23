/* AC HRA · 月／年列表「一次一張」共用小工具 v1（2026-11-23）
 * Paul 的規則：按的是哪一項就只看那一項。
 *   ① 列表：每個月（或每年）一列＝期間｜該項的總和｜一條長條。不列每天、不塞一堆欄位。
 *   ② 點一列 → 那一期的卡：人數依部門／組別列人數＋總和；金額依項目（或部門）列金額＋總和。
 *   ③ 卡片裡再點一條 → 名單；再點人 → 他的資料。（②③ 由 row-keynote.js 的 acKeynoteSummary 負責）
 * 只產生畫面，不動資料。各頁自己把資料整理好丟進來。
 *
 * ACPL.list({rows:[{k:'2026-10',v:18,sub:'6 人'}], cur:'2026-10', head:'離職人數', money:false, color:'#f43f5e', fn:'myCard', arg:'resign'})
 *      → 回傳表格 HTML；點一列會呼叫 window[fn](arg, k)
 * ACPL.card({title:'2026-10 · 離職 18 人', heads:['工號','姓名','部門',…], rows:[[…],[…]], group:'部門', amt:false})
 */
(function (g) {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function n0(v) { return (Math.round(v) || 0).toLocaleString('en-US'); }
  function n2(v) { return (+v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  var CSS = '.acpl-wrap{max-height:360px;overflow:auto;border-radius:10px}' +
    '.acpl{width:100%;border-collapse:collapse;table-layout:auto}' +
    '.acpl-wrap table.acpl th{position:sticky;top:0;z-index:1;text-align:left;font-size:12px!important;font-weight:700;padding:7px 10px!important;white-space:nowrap;background:#eef2f7!important;background-image:none!important;color:#475569!important;border:0!important;text-transform:none!important;letter-spacing:0!important}' +
    '.acpl-wrap table.acpl td{background-image:none}' +
    '.acpl td{padding:8px 10px;border-top:1px solid rgba(15,23,42,.08);vertical-align:middle}' +
    '.acpl tr.acpl-r{cursor:pointer}.acpl tr.acpl-r:hover td{background:rgba(30,64,175,.06)}' +
    '.acpl tr.acpl-cur td{background:rgba(30,64,175,.09)}' +
    '.acpl .acpl-k{white-space:nowrap;word-break:keep-all;font-weight:700;color:#1e40af;font-variant-numeric:tabular-nums;width:1%}' +
    '.acpl .acpl-v{white-space:nowrap;text-align:right;font-weight:700;font-variant-numeric:tabular-nums;width:1%}' +
    '.acpl .acpl-s{white-space:nowrap;text-align:right;font-size:11px;color:#64748b;width:1%}' +
    '.acpl .acpl-b{min-width:90px}.acpl .acpl-t{max-width:520px;height:12px;border-radius:6px;background:#e2e8f0;overflow:hidden}' +
    '.acpl .acpl-t i{display:block;height:100%;border-radius:6px}' +
    '.acpl-hint{font-size:11px;color:#64748b;padding:6px 10px}';
  function css() { if (document.getElementById('acpl-css')) return; var s = document.createElement('style'); s.id = 'acpl-css'; s.textContent = CSS; (document.head || document.documentElement).appendChild(s); }
  function list(o) {
    css(); o = o || {};
    var rows = o.rows || [], mx = Math.max.apply(null, rows.map(function (r) { return Math.abs(+r.v || 0); }).concat([0])) || 1;
    var col = o.color || '#3b82f6', hasSub = rows.some(function (r) { return r.sub != null && r.sub !== ''; });
    var h = '<div class="acpl-wrap"><table class="acpl" data-keynote="off"><thead><tr><th>' + esc(o.period || '期間 Period') + '</th><th style="text-align:right">' + esc(o.head || '') + '</th>' + (hasSub ? '<th style="text-align:right">' + esc(o.subHead || '') + '</th>' : '') + '<th>' + esc(o.chart || '圖表 Chart') + '</th></tr></thead><tbody>';
    if (!rows.length) h += '<tr><td colspan="' + (hasSub ? 4 : 3) + '" class="acpl-hint">' + esc(o.empty || '沒有資料 No data') + '</td></tr>';
    rows.forEach(function (r) {
      var on = r.k === o.cur, v = +r.v || 0, w = Math.max(v ? 3 : 0, Math.round(Math.abs(v) / mx * 100));
      h += '<tr class="acpl-r' + (on ? ' acpl-cur' : '') + '" onclick="ACPL.go(\'' + esc(o.fn || '') + '\',\'' + esc(o.arg == null ? '' : o.arg) + '\',\'' + esc(r.k) + '\')">' +
        '<td class="acpl-k">' + (on ? '&#9664; ' : '') + esc(r.k) + '</td>' +
        '<td class="acpl-v" style="color:' + esc(r.color || o.vcolor || '#0f172a') + '">' + (o.money ? '$' + n2(v) : n0(v)) + (o.unit ? '<span style="font-weight:400;font-size:11px;color:#64748b"> ' + esc(o.unit) + '</span>' : '') + '</td>' +
        (hasSub ? '<td class="acpl-s">' + esc(r.sub == null ? '' : r.sub) + '</td>' : '') +
        '<td class="acpl-b"><div class="acpl-t"><i style="width:' + w + '%;background:' + esc(r.color || col) + '"></i></div></td></tr>';
    });
    return h + '</tbody></table></div>';
  }
  function go(fn, arg, k) { try { if (typeof g[fn] === 'function') g[fn](arg, k); } catch (e) { try { console.error(e); } catch (_) { } } }
  function card(o) {
    o = o || {}; var rows = o.rows || [];
    if (!rows.length || typeof g.acKeynoteSummary !== 'function') return false;
    var hold = document.getElementById('acpl-hold');
    if (!hold) { hold = document.createElement('div'); hold.id = 'acpl-hold'; hold.style.cssText = 'position:absolute;left:-99999px;top:0;width:1100px;pointer-events:none'; document.body.appendChild(hold); }
    var h = '<table data-keynote="off" data-kn-min="1"><thead><tr>' + (o.heads || []).map(function (x) { return '<th>' + esc(x) + '</th>'; }).join('') + '</tr></thead><tbody>';
    rows.forEach(function (r) { h += '<tr>' + r.map(function (x) { return '<td>' + esc(x == null ? '' : x) + '</td>'; }).join('') + '</tr>'; });
    hold.innerHTML = h + '</tbody></table>';
    var opt = { title: o.title || '', noMonth: o.month ? false : true, noAmt: o.amt ? false : true };
    if (o.group != null) opt.group = o.group;
    g.acKeynoteSummary(hold.querySelector('table'), opt);
    return true;
  }
  g.ACPL = { list: list, card: card, go: go, n0: n0, n2: n2, version: 1 };
})(window);
