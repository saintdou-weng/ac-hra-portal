/* ═══════════════════════════════════════════════════════════════════════
   AC HRA Portal — shared/approval.js  v1.0
   五個模組（入離職 / 產假 / 合約 / 試用期 / 薪資）共用的送審客戶端
   搭配 AC_HRA_CloudSync GAS v2.0
   ───────────────────────────────────────────────────────────────────────
   硬性規則：
   · GAS POST 一律 Content-Type: text/plain;charset=utf-8（免 CORS preflight）
   · 日期一律 local getters，禁 toISOString
   · 核可人 ID 只存 localStorage，畫面一律遮蔽顯示
   · 2026-07 之前的期間前端就標「免核可」，不送審
   用法：
     HRA_APPR.submit({ module:'maternity', period:'2026-07', items:[...] })
   ═══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var CUTOFF   = '2026-07';                    /* 此年月之前免核可 */
  var K_GAS    = 'vrt_att_cloud_v1_url';
  var K_GAS2   = 'ac_hra_gas_url';
  var K_APPR   = 'ac_hra_approver_id';         /* 核可人 ID：只存本機，不出現在畫面 */
  var K_LANG   = 'ac_hra_lang';
  var K_BATCH  = 'ac_hra_batches';             /* 送出過的批次，供回讀狀態 */

  /* ── 三語 ── */
  var T = {
    zh: { sending:'送審中…', sent:'已送出核可請求', failed:'送審失敗', noItems:'沒有可送審的項目',
          allWaived:'所選項目都在 2026-07 之前，免核可', waived:'免核可', pending:'待核可',
          approved:'已核可', returned:'已退回', rejected:'已退件', noGas:'請先在設定填入 GAS 網址',
          confirmN:'將送出 {n} 筆給核可人，確定？', statusFail:'查詢核可狀態失敗' },
    en: { sending:'Submitting…', sent:'Approval request sent', failed:'Submit failed', noItems:'No items to submit',
          allWaived:'All selected items are before 2026-07 — approval waived', waived:'Waived', pending:'Pending',
          approved:'Approved', returned:'Returned', rejected:'Rejected', noGas:'Please set the GAS URL in Settings',
          confirmN:'Send {n} item(s) for approval?', statusFail:'Failed to fetch approval status' },
    km: { sending:'កំពុងដាក់ស្នើ…', sent:'បានផ្ញើសំណើអនុម័ត', failed:'ដាក់ស្នើបរាជ័យ', noItems:'គ្មានធាតុ',
          allWaived:'ធាតុទាំងអស់មុន 2026-07 — លើកលែងការអនុម័ត', waived:'លើកលែង', pending:'រង់ចាំ',
          approved:'អនុម័ត', returned:'ត្រឡប់', rejected:'បដិសេធ', noGas:'សូមកំណត់ GAS URL',
          confirmN:'ផ្ញើ {n} ធាតុដើម្បីអនុម័ត?', statusFail:'បរាជ័យ' }
  };
  function lang() { try { return localStorage.getItem(K_LANG) || 'zh'; } catch (e) { return 'zh'; } }
  function t(k) { var d = T[lang()] || T.zh; return d[k] !== undefined ? d[k] : (T.zh[k] || k); }

  /* ── 工具 ── */
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function lds(d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
  function nowStamp() {
    var d = new Date();
    return lds(d) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds());
  }
  function gasUrl() {
    try { return (localStorage.getItem(K_GAS) || localStorage.getItem(K_GAS2) || '').trim(); }
    catch (e) { return ''; }
  }
  function approverId() { try { return (localStorage.getItem(K_APPR) || '').trim(); } catch (e) { return ''; } }
  function setApproverId(v) { try { localStorage.setItem(K_APPR, String(v || '').trim()); } catch (e) {} }
  /* 畫面一律遮蔽：5026942575 → 502•••575 */
  function maskId(v) {
    var s = String(v || '').trim();
    if (!s) return '—';
    if (s.length <= 6) return s.slice(0, 2) + '•••';
    return s.slice(0, 3) + '•••' + s.slice(-3);
  }

  /* ── 免核可判定（與 GAS 同一條線） ── */
  function isWaived(period) {
    var p = String(period || '').slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(p)) return false;
    return p < CUTOFF;
  }

  /* ── GAS POST（text/plain 免 preflight） ── */
  function post(payload) {
    var url = gasUrl();
    if (!url) return Promise.reject(new Error(t('noGas')));
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow'
    }).then(function (r) { return r.text(); })
      .then(function (txt) {
        try { return JSON.parse(txt); }
        catch (e) { return { ok: /success|ok|true/i.test(txt), raw: txt }; }
      });
  }

  /* ═══════════ 送出核可批次 ═══════════
     opts = {
       module : 'maternity' | 'onboarding' | 'contract' | 'probation' | 'payroll',
       period : '2026-07',
       batch  : 'MAT-A-202607'   (可省略，GAS 會自動產生)
       title  : '產假給付核可'    (可省略)
       items  : [{ key, id, name, dept, group, amount, period, kind, info }]
       lang   : 'zh' | 'en' | 'km'  (可省略，取介面語言)
     }
     回傳 Promise<{ ok, batchId, sent, waived, skipped }>                */
  function submit(opts) {
    opts = opts || {};
    var items = (opts.items || []).slice();
    if (!items.length) return Promise.reject(new Error(t('noItems')));

    /* 前端先分流：免核可的不送 */
    var live = [], waived = [];
    items.forEach(function (it) {
      var per = it.period || it.payMonth || (it.date ? String(it.date).slice(0, 7) : (opts.period || ''));
      (isWaived(per) ? waived : live).push(it);
    });
    if (!live.length) return Promise.resolve({ ok: true, sent: 0, waived: waived.length, allWaived: true, message: t('allWaived') });

    var payload = {
      action         : 'approvalRequest',
      schemaVersion  : 2,
      module         : opts.module || 'unknown',
      period         : opts.period || '',
      batch          : opts.batch || '',
      title          : opts.title || '',
      lang           : opts.lang || lang(),
      approverId     : approverId(),           /* 不顯示於畫面，但要送給 GAS 比對 */
      items          : live,
      count          : live.length,
      requestedBy    : opts.requestedBy || (opts.module || 'web'),
      requestedAt    : nowStamp(),
      requestId      : 'req_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      idempotencyKey : [opts.module, opts.batch || '', opts.period || '', live.length,
                        live.map(function (x) { return x.key || x.id; }).sort().join(',')].join('|')
    };

    return post(payload).then(function (res) {
      var d = (res && res.data) ? res.data : res;
      var batchId = d && d.batchId;
      var closed = !!(d && d.closed);
      var delivered = !!(d && d.messageId) && d.sentToGroup !== false;
      /* 批次建立成功不代表群組真的收到。只接受 Telegram message_id
         作為送達證據；失敗時保留批次，下一次可由 GAS 補發。 */
      if (!closed && !delivered) {
        throw new Error(t('failed') + ': Telegram message_id was not returned');
      }
      if (batchId) rememberBatch({ batchId: batchId, module: payload.module, period: payload.period,
                                   count: live.length, at: nowStamp() });
      return { ok: !!(res && (res.ok || batchId)), batchId: batchId,
               sent: delivered ? live.length : 0, waived: waived.length,
               reused: !!(d && d.reused), closed: closed, messageId: d && d.messageId || null };
    });
  }

  /* ═══════════ 回讀核可狀態 ═══════════ */
  function status(batchId) {
    return post({ action: 'approvalStatus', batchId: batchId }).then(function (res) {
      var d = (res && res.data) ? res.data : res;
      if (!d || !d.batchId) throw new Error(t('statusFail'));
      return d;   /* { batchId, status, counts:{approved,returned,rejected,pending,waived}, items:[...] } */
    });
  }
  /* 把回讀結果套回本機決定表 DEC（各模組的 _k → {d:'ok'|'no'} ） */
  function applyToLocal(batchId, decKey, onDone) {
    return status(batchId).then(function (d) {
      var DEC = {};
      try { DEC = JSON.parse(localStorage.getItem(decKey) || '{}'); } catch (e) { DEC = {}; }
      (d.items || []).forEach(function (it) {
        if (it.status === 'approved')      DEC[it.itemId] = { d: 'ok', at: it.decidedAt || '' };
        else if (it.status === 'rejected') DEC[it.itemId] = { d: 'no', note: it.note || '', at: it.decidedAt || '' };
        else if (it.status === 'returned') DEC[it.itemId] = { d: 'no', ret: 1, note: it.note || '', at: it.decidedAt || '' };
      });
      try { localStorage.setItem(decKey, JSON.stringify(DEC)); } catch (e) {}
      if (typeof onDone === 'function') onDone(d, DEC);
      return d;
    });
  }

  /* ── 送出過的批次記錄 ── */
  function rememberBatch(rec) {
    var list = listBatches();
    list.unshift(rec);
    if (list.length > 40) list.splice(40);
    try { localStorage.setItem(K_BATCH, JSON.stringify(list)); } catch (e) {}
  }
  function listBatches() {
    try { return JSON.parse(localStorage.getItem(K_BATCH) || '[]'); } catch (e) { return []; }
  }

  global.HRA_APPR = {
    submit: submit, status: status, applyToLocal: applyToLocal,
    isWaived: isWaived, CUTOFF: CUTOFF,
    approverId: approverId, setApproverId: setApproverId, maskId: maskId,
    listBatches: listBatches, gasUrl: gasUrl,
    t: t, lang: lang, nowStamp: nowStamp
  };
})(typeof window !== 'undefined' ? window : this);
