/* HRA Cards v1 (2026-11-17, Paul)
   手機上把寬表格改成精簡卡片清單；點卡片開「連續瀏覽」檢視器（像 PSJHR 員工頁）：
   上方 ◀ 6/32 ▶ ✕，照片＋全部欄位，往下捲自動接下一筆，捲到誰標頭就換成誰。
   日／週／月／年用不同分組：日＝不分組、週＝按日、月＝按週、年＝按月（每組有筆數與小計）。
   API:
     HRACards.list(host, items, cfg)   cfg = {id, L, title, sub, icon, photos, right, tone, fields, actions, group, groupSum, empty}
     HRACards.open(id, index)
     HRACards.periodGroup(unit, date, L)  → {k,label} | null
*/
(function (g) {
  'use strict';
  var REG = {}, CUR = null, IO = null;
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function Lz(cfg) { return cfg.L || function (z, e) { return z + ' ' + e; }; }
  function call(f, r, d) { try { return typeof f === 'function' ? f(r) : d; } catch (e) { console.warn('[HRACards]', e); return d; } }
  function safeUrl(s) { return /^(https?:\/\/|blob:|data:image\/)/i.test(String(s || '')) ? String(s) : ''; }

  var CSS = '' +
    '.hc-list{display:flex;flex-direction:column;gap:6px}' +
    '.hc-grp{display:flex;align-items:center;gap:6px;margin:8px 0 0;padding:5px 9px;border-radius:8px;background:#eef4fb;color:#1e3a5f;font-size:12px;font-weight:800}' +
    '.hc-grp:first-child{margin-top:0}.hc-grp .n{margin-left:auto;font-weight:700;color:#5b6b80;font-size:11px;font-family:ui-monospace,Menlo,monospace}' +
    '.hc-card{display:flex;align-items:center;gap:9px;padding:7px 9px;background:#fff;border:1px solid #e3e9f1;border-left:4px solid #cbd5e1;border-radius:10px;cursor:pointer;-webkit-tap-highlight-color:transparent}' +
    '.hc-card:active{background:#f4f8fc}.hc-card.red{border-left-color:#dc2626}.hc-card.amber{border-left-color:#e3a008}.hc-card.green{border-left-color:#16a34a}.hc-card.blue{border-left-color:#2b8fd0}' +
    '.hc-th{width:42px;height:42px;flex:0 0 42px;border-radius:9px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:20px;overflow:hidden}' +
    '.hc-th img{width:100%;height:100%;object-fit:cover}' +
    '.hc-mid{flex:1;min-width:0}.hc-t{font-size:13px;font-weight:800;color:#0f172a;line-height:1.25;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}' +
    '.hc-s{font-size:11px;color:#64748b;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.hc-r{flex:0 0 auto;text-align:right;font-size:12px;font-weight:800;font-family:ui-monospace,Menlo,monospace;color:#0f172a;max-width:42%}' +
    '.hc-r small{display:block;font-size:10px;font-weight:600;color:#64748b;font-family:inherit}' +
    '.hc-empty{padding:18px;text-align:center;color:#94a3b8;font-size:12px}' +
    '.hc-pill{display:inline-block;padding:1px 7px;border-radius:999px;font-size:10px;font-weight:800;font-family:system-ui,sans-serif}' +
    '.hc-pill.red{background:#fee2e2;color:#b91c1c}.hc-pill.amber{background:#fef3c7;color:#92400e}.hc-pill.green{background:#dcfce7;color:#166534}.hc-pill.blue{background:#e0f2fe;color:#075985}.hc-pill.gray{background:#f1f5f9;color:#475569}' +
    /* viewer */
    '#hc-view{position:fixed;inset:0;z-index:9000;background:rgba(15,23,42,.45);display:flex;justify-content:flex-end}' +
    '#hc-view .box{width:min(560px,100%);height:100%;background:#f6f8fb;display:flex;flex-direction:column;box-shadow:-8px 0 30px rgba(0,0,0,.2)}' +
    '#hc-view .hd{flex:0 0 auto;display:flex;align-items:center;gap:6px;padding:8px 10px;background:#fff;border-bottom:1px solid #e2e8f0}' +
    '#hc-view .hd .cnt{font-size:13px;color:#64748b;font-family:ui-monospace,Menlo,monospace;min-width:52px}' +
    '#hc-view .hd .ttl{flex:1;min-width:0;font-weight:800;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '#hc-view .hd button{width:38px;height:34px;border:1px solid #d6dee8;background:#fff;border-radius:9px;font-size:15px;cursor:pointer}' +
    '#hc-view .hd button:disabled{opacity:.35}' +
    '#hc-view .bd{flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:10px}' +
    '.hc-sec{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:10px;margin-bottom:12px}' +
    '.hc-sec+.hc-sec{border-top:3px solid #0f766e}' +
    '.hc-top{display:flex;gap:10px;align-items:center}' +
    '.hc-ph{width:76px;height:76px;flex:0 0 76px;border-radius:12px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:34px;overflow:hidden;cursor:pointer}' +
    '.hc-ph img{width:100%;height:100%;object-fit:cover}' +
    '.hc-top .t{font-size:15px;font-weight:850;line-height:1.25}.hc-top .s{font-size:12px;color:#64748b;margin-top:2px}' +
    '.hc-gal{display:flex;gap:6px;overflow-x:auto;margin-top:8px}.hc-gal a{flex:0 0 auto}.hc-gal img{height:120px;border-radius:9px;border:1px solid #e2e8f0}' +
    '.hc-gal .pdf{display:flex;align-items:center;justify-content:center;width:86px;height:120px;border-radius:9px;background:#fef2f2;color:#b91c1c;font-weight:800;font-size:12px;border:1px solid #fecaca}' +
    '.hc-kv{display:grid;grid-template-columns:1fr 1fr;gap:7px 12px;margin-top:10px}' +
    '.hc-kv div{min-width:0}.hc-kv dt{font-size:10.5px;color:#64748b}.hc-kv dd{margin:1px 0 0;font-size:13px;font-weight:700;color:#0f172a;word-break:break-word}' +
    '.hc-kv .w{grid-column:1/-1}' +
    '.hc-act{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.hc-act button{border:1px solid #cbd5e1;background:#fff;border-radius:8px;padding:6px 10px;font-size:12px;font-weight:700;cursor:pointer}' +
    '.hc-act button.pri{background:#0f766e;border-color:#0f766e;color:#fff}' +
    '.hc-more{text-align:center;color:#64748b;font-size:12px;padding:10px 0 30px}' +
    '#hc-zoom{position:fixed;inset:0;z-index:9100;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center}#hc-zoom img{max-width:96vw;max-height:90vh;border-radius:8px}' +
    '@media(max-width:760px){.hc-hide-m{display:none!important}}' +
    '@media(min-width:761px){.hc-m-only{display:none!important}}';
  function css() { if (document.getElementById('hc-css')) return; var s = document.createElement('style'); s.id = 'hc-css'; s.textContent = CSS; document.head.appendChild(s); }

  /* ── period grouping ───────────────────────────────────────────── */
  var WD = { zh: ['日', '一', '二', '三', '四', '五', '六'], en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] };
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function dOf(s) { var m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function isoWeek(d) { var t = new Date(d.getFullYear(), d.getMonth(), d.getDate()); t.setDate(t.getDate() + 3 - (t.getDay() + 6) % 7); var w1 = new Date(t.getFullYear(), 0, 4); return { y: t.getFullYear(), w: 1 + Math.round(((t - w1) / 864e5 - 3 + (w1.getDay() + 6) % 7) / 7) }; }
  function periodGroup(unit, date, L) {
    L = L || function (z) { return z; };
    var s = String(date || ''), d = dOf(s), ym = s.slice(0, 7), en = L('zh', 'en') === 'en';
    if (unit === 'day') return null;
    if (unit === 'week') { if (!d) return null; return { k: s.slice(0, 10), label: '📅 ' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' + (en ? WD.en[d.getDay()] : '週' + WD.zh[d.getDay()]) }; }
    if (unit === 'month') {
      if (!d) return null;
      var mon = new Date(d); mon.setDate(mon.getDate() - (mon.getDay() + 6) % 7); var sun = new Date(mon); sun.setDate(sun.getDate() + 6); var w = isoWeek(d);
      return { k: w.y + '-W' + p2(w.w), label: '🗓 W' + w.w + ' · ' + (mon.getMonth() + 1) + '/' + mon.getDate() + '–' + (sun.getMonth() + 1) + '/' + sun.getDate() };
    }
    if (!/^\d{4}-\d{2}/.test(ym)) return { k: '?', label: L('未填日期', 'No date') };
    var y = +ym.slice(0, 4), m = +ym.slice(5, 7);
    if (unit === 'all') return { k: String(y), label: '📆 ' + y };
    return { k: ym, label: '📆 ' + (en ? MON[m - 1] + ' ' + y : y + '年' + m + '月') };
  }

  /* ── list ─────────────────────────────────────────────────────── */
  function thumbHtml(cfg, r) {
    var ph = (call(cfg.photos, r, []) || []).filter(function (a) { return a && a.img && safeUrl(a.url); });
    return ph.length ? '<img src="' + esc(ph[0].url) + '" alt="" loading="lazy" onerror="this.remove()">' : esc(call(cfg.icon, r, '📄') || '📄');
  }
  function list(host, items, cfg) {
    css(); if (typeof host === 'string') host = document.getElementById(host); if (!host) return;
    cfg = cfg || {}; var id = cfg.id || host.id || ('hc' + Math.random().toString(36).slice(2, 7));
    items = (items || []).slice(); REG[id] = { items: items, cfg: cfg };
    host.classList.add('hc-list'); if (cfg.mobileOnly !== false) host.classList.add('hc-m-only');
    var L = Lz(cfg);
    if (!items.length) { host.innerHTML = '<div class="hc-empty">📭 ' + esc(cfg.empty || L('沒有資料', 'No records')) + '</div>'; return; }
    var h = '', last = null, groups = {};
    if (cfg.group) items.forEach(function (r) { var gr = call(cfg.group, r, null); if (gr) (groups[gr.k] = groups[gr.k] || []).push(r); });
    items.forEach(function (r, i) {
      if (cfg.group) {
        var gr = call(cfg.group, r, null);
        if (gr && gr.k !== last) { last = gr.k; var rs = groups[gr.k] || []; h += '<div class="hc-grp"><span>' + esc(gr.label) + '</span><span class="n">' + rs.length + ' ' + esc(L('筆', 'rows')) + (cfg.groupSum ? ' · ' + call(cfg.groupSum, rs, '') : '') + '</span></div>'; }
      }
      var tone = call(cfg.tone, r, '') || '';
      h += '<div class="hc-card ' + esc(tone) + '" onclick="HRACards.open(\'' + id + '\',' + i + ')">' +
        '<div class="hc-th">' + thumbHtml(cfg, r) + '</div>' +
        '<div class="hc-mid"><div class="hc-t">' + (call(cfg.title, r, '') || '—') + '</div><div class="hc-s">' + (call(cfg.sub, r, '') || '') + '</div></div>' +
        '<div class="hc-r">' + (call(cfg.right, r, '') || '') + '</div></div>';
    });
    host.innerHTML = h;
  }

  /* ── viewer ───────────────────────────────────────────────────── */
  function secHtml(id, i) {
    var R = REG[id], r = R.items[i], cfg = R.cfg, L = Lz(cfg);
    var ph = (call(cfg.photos, r, []) || []).filter(function (a) { return a && safeUrl(a.url); }), imgs = ph.filter(function (a) { return a.img; });
    var top = '<div class="hc-top"><div class="hc-ph" ' + (imgs.length ? 'onclick="HRACards.zoom(\'' + esc(imgs[0].url) + '\')"' : '') + '>' + (imgs.length ? '<img src="' + esc(imgs[0].url) + '" alt="" onerror="this.remove()">' : esc(call(cfg.icon, r, '📄') || '📄')) + '</div>' +
      '<div style="min-width:0;flex:1"><div class="t">' + (call(cfg.title, r, '') || '—') + '</div><div class="s">' + (call(cfg.sub, r, '') || '') + '</div><div style="margin-top:4px">' + (call(cfg.right, r, '') || '') + '</div></div></div>';
    var gal = ph.length > (imgs.length ? 1 : 0) ? '<div class="hc-gal">' + ph.map(function (a) { return a.img ? '<a href="javascript:void 0" onclick="HRACards.zoom(\'' + esc(a.url) + '\')"><img src="' + esc(a.url) + '" alt="" loading="lazy"></a>' : '<a href="' + esc(a.url) + '" target="_blank" rel="noopener"><span class="pdf">📄 PDF</span></a>'; }).join('') + '</div>' : '';
    var f = (call(cfg.fields, r, []) || []).filter(function (x) { return x && x[1] !== undefined && x[1] !== null && x[1] !== '' && String(x[1]).trim() !== '—' && String(x[1]).trim() !== '$0.00'; });
    var kv = f.length ? '<dl class="hc-kv">' + f.map(function (x) { return '<div' + (x[2] ? ' class="w"' : '') + '><dt>' + esc(x[0]) + '</dt><dd>' + x[1] + '</dd></div>'; }).join('') + '</dl>' : '';
    var act = (call(cfg.actions, r, []) || []);
    var ah = act.length ? '<div class="hc-act">' + act.map(function (a, k) { return '<button class="' + (a[2] || '') + '" onclick="HRACards.act(\'' + id + '\',' + i + ',' + k + ')">' + esc(a[0]) + '</button>'; }).join('') + '</div>' : '';
    if (!imgs.length && cfg.addPhoto) ah = ah || '<div class="hc-act"></div>', ah = ah.replace('<div class="hc-act">', '<div class="hc-act"><button onclick="HRACards.addPhoto(\'' + id + '\',' + i + ')">📷 ' + esc(L('加照片', 'Add photo')) + '</button>');
    return '<section class="hc-sec" data-i="' + i + '">' + top + gal + kv + ah + '</section>';
  }
  function head(id, i) {
    var R = REG[id], v = document.getElementById('hc-view'); if (!v) return; var n = R.items.length;
    v.querySelector('.cnt').textContent = (i + 1) + '/' + n;
    var t = document.createElement('div'); t.innerHTML = call(R.cfg.title, R.items[i], '') || ''; v.querySelector('.ttl').textContent = t.textContent;
    v.querySelector('[data-p]').disabled = i <= 0; v.querySelector('[data-n]').disabled = i >= n - 1;
  }
  function open(id, i) {
    css(); var R = REG[id]; if (!R || !R.items.length) return; i = Math.max(0, Math.min(R.items.length - 1, +i || 0));
    var L = Lz(R.cfg), v = document.getElementById('hc-view');
    if (!v) {
      v = document.createElement('div'); v.id = 'hc-view';
      v.innerHTML = '<div class="box"><div class="hd"><button data-p aria-label="prev">◀</button><button data-n aria-label="next">▶</button><span class="cnt"></span><span class="ttl"></span><button data-x aria-label="close">✕</button></div><div class="bd"></div></div>';
      document.body.appendChild(v);
      v.addEventListener('click', function (e) { if (e.target === v) close(); });
      v.querySelector('[data-x]').onclick = close;
      v.querySelector('[data-p]').onclick = function () { if (CUR) open(CUR.id, CUR.i - 1); };
      v.querySelector('[data-n]').onclick = function () { if (CUR) open(CUR.id, CUR.i + 1); };
      document.addEventListener('keydown', key);
      document.documentElement.style.overflow = 'hidden';
    }
    CUR = { id: id, i: i, first: i, last: i };
    var bd = v.querySelector('.bd'); bd.innerHTML = secHtml(id, i) + '<div class="hc-more"></div>'; bd.scrollTop = 0; head(id, i);
    var more = bd.querySelector('.hc-more');
    function label() { var nx = CUR.last + 1; more.innerHTML = nx < R.items.length ? '⬇ ' + esc(L('繼續往下捲：下一筆', 'Keep scrolling — next')) : esc(L('已經是最後一筆', 'That was the last one')); }
    function add() { var nx = CUR.last + 1; if (nx >= R.items.length) return false; more.insertAdjacentHTML('beforebegin', secHtml(id, nx)); CUR.last = nx; label(); return true; }
    function near() { return more.getBoundingClientRect().top < bd.getBoundingClientRect().bottom + 500; }
    function fill() { var k = 0; while (near() && k++ < 3 && add()); }
    label(); fill();
    if (IO) IO.disconnect(); IO = null;
    if (g.IntersectionObserver) { IO = new IntersectionObserver(function (es) { if (es.some(function (x) { return x.isIntersecting; })) fill(); }, { root: bd, rootMargin: '0px 0px 500px 0px' }); IO.observe(more); }
    var tk = 0; bd.onscroll = function () { if (tk) return; tk = setTimeout(function () { tk = 0; fill(); var cur = CUR.first, secs = bd.querySelectorAll('.hc-sec'); for (var k = 0; k < secs.length; k++) { if (secs[k].offsetTop <= bd.scrollTop + 60) cur = +secs[k].dataset.i; else break; } if (cur !== CUR.i) { CUR.i = cur; head(id, cur); } }, 80); };
  }
  function close() { var v = document.getElementById('hc-view'); if (v) v.remove(); if (IO) IO.disconnect(); IO = null; CUR = null; document.removeEventListener('keydown', key); document.documentElement.style.overflow = ''; }
  function key(e) { if (!CUR) return; if (e.key === 'Escape') close(); else if (e.key === 'ArrowLeft') open(CUR.id, CUR.i - 1); else if (e.key === 'ArrowRight') open(CUR.id, CUR.i + 1); }
  function act(id, i, k) { var R = REG[id]; if (!R) return; var a = (call(R.cfg.actions, R.items[i], []) || [])[k]; if (!a) return; if (a[3] !== false) close(); try { a[1](R.items[i]); } catch (e) { console.error('[HRACards act]', e); } }
  function addPhoto(id, i) { var R = REG[id]; if (!R || !R.cfg.addPhoto) return; close(); try { R.cfg.addPhoto(R.items[i]); } catch (e) { console.error(e); } }
  function zoom(u) { u = safeUrl(u); if (!u) return; var z = document.createElement('div'); z.id = 'hc-zoom'; z.innerHTML = '<img src="' + esc(u) + '" alt="">'; z.onclick = function () { z.remove(); }; document.body.appendChild(z); }
  function refresh() { if (!CUR) return; var c = CUR; open(c.id, Math.min(c.i, REG[c.id].items.length - 1)); }

  g.HRACards = { list: list, open: open, close: close, act: act, addPhoto: addPhoto, zoom: zoom, refresh: refresh, periodGroup: periodGroup, esc: esc, version: '1.0' };
})(window);
