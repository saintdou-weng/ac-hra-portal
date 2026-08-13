/* AC HRA shared inspector/checker bridge
 * Adds one bilingual inspector value to every GAS Telegram summary or
 * approval request sent from the portal pages. The name is kept locally
 * per site and is requested only the first time a message is sent.
 */
(function (G) {
  'use strict';
  var KEY = 'ac_hra_inspector_name';
  var originalFetch = G.fetch;

  function saved() {
    try { return String(localStorage.getItem(KEY) || '').trim(); } catch (e) { return ''; }
  }
  function ensure() {
    var v = saved();
    if (!v) {
      v = window.prompt('請輸入檢查人姓名 / Inspector name\n此姓名會顯示在摘要與核可訊息中。', '') || '';
      v = String(v).trim();
      if (v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
    }
    /* 空白就是空白；不要把「未填寫」當成檢查人寫進摘要。 */
    return v;
  }
  function target(body) {
    if (!body || typeof body !== 'object') return false;
    return body.action === 'telegram' || body.action === 'approvalRequest' ||
      body.type === 'telegram' || body.type === 'notify' ||
      body.type === 'tgSummary' || body.type === 'approvalRequest';
  }
  if (typeof originalFetch === 'function') {
    G.fetch = function (input, init) {
      try {
        if (init && typeof init.body === 'string') {
          var body = JSON.parse(init.body);
          if (target(body)) {
            var name = ensure();
            /* 明確傳空字串，讓 GAS 知道本次不落款；不要沿用舊的假檢查人。 */
            if (body.inspector === undefined) body.inspector = name;
            if (body.checker === undefined) body.checker = name;
            body.bilingual = true;
            init = Object.assign({}, init, { body: JSON.stringify(body) });
          }
        }
      } catch (e) {}
      return originalFetch.call(this, input, init);
    };
  }
  G.HRAInspector = {
    get: saved,
    ensure: ensure,
    set: function (v) { try { localStorage.setItem(KEY, String(v || '').trim()); } catch (e) {} },
    clear: function () { try { localStorage.removeItem(KEY); } catch (e) {} }
  };
})(window);
