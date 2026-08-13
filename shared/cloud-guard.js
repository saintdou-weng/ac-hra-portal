/* AC HRA Cloud Guard v1.0
 * Every module uses the same server response when a smaller/older local
 * snapshot would replace a more complete cloud snapshot.
 */
(function (w) {
  'use strict';

  function fmt(c) {
    c = c || {};
    var oldCount = c.oldCount == null ? '—' : c.oldCount;
    var newCount = c.newCount == null ? '—' : c.newCount;
    var oldDate = c.oldLatestDate || '—';
    var newDate = c.newLatestDate || '—';
    return { oldCount: oldCount, newCount: newCount, oldDate: oldDate, newDate: newDate };
  }

  function ask(conflict, lang) {
    var x = fmt(conflict);
    var zh = '⚠️ 雲端已有較完整或較新的資料。\n\n' +
      '雲端：' + x.oldCount + ' 筆，最新日期 ' + x.oldDate + '\n' +
      '本機：' + x.newCount + ' 筆，最新日期 ' + x.newDate + '\n\n' +
      '若繼續，會先備份目前雲端資料，再以本機資料覆蓋。\n' +
      '這通常只在確認本機資料確實正確時使用。\n\n確定要覆蓋雲端嗎？';
    var en = 'The cloud has a more complete or newer snapshot.\n\n' +
      'Cloud: ' + x.oldCount + ' records, latest ' + x.oldDate + '\n' +
      'Local: ' + x.newCount + ' records, latest ' + x.newDate + '\n\n' +
      'If you continue, the current cloud data will be backed up first, then replaced.\n\nReplace cloud data?';
    var km = 'Cloud មានទិន្នន័យពេញលេញ ឬថ្មីជាង។\n\nCloud: ' + x.oldCount + ' / Local: ' + x.newCount +
      '\n\nទិន្នន័យ Cloud នឹងត្រូវបាន Backup មុនពេលជំនួស។\nតើបន្តជំនួសទេ?';
    var message = lang === 'en' ? en : (lang === 'km' ? km : zh);
    return typeof w.confirm === 'function' ? w.confirm(message) : false;
  }

  function stableValue(v) {
    if (Array.isArray(v)) return v.map(stableValue);
    if (v && typeof v === 'object') {
      var o = {};
      Object.keys(v).sort().forEach(function (k) {
        if (k === 'updatedAt' || k === 'sourceFiles' || k === 'sources' || k === '_legacyIndex') return;
        o[k] = stableValue(v[k]);
      });
      return o;
    }
    return v;
  }
  function fingerprint(v) { return JSON.stringify(stableValue(v)); }
  function stateKey(key) { return 'ac_hra_cloud_state_' + String(key || 'default'); }
  function readState(key) {
    try { return JSON.parse(localStorage.getItem(stateKey(key)) || '{}') || {}; } catch (e) { return {}; }
  }
  function writeState(key, value) {
    try { localStorage.setItem(stateKey(key), JSON.stringify(value)); } catch (e) {}
  }
  function recordId(r) { return String((r && (r._k || r.key || r.id || r.employeeId || r.empId || r.idNo)) || JSON.stringify(r || {})); }

  w.HRACloudGuard = {
    coverage(records, source) {
      var dates = [];
      function walk(v, depth) {
        if (depth > 6 || v == null) return;
        if (Array.isArray(v)) { v.forEach(function(x){ walk(x, depth + 1); }); return; }
        if (typeof v !== 'object') return;
        Object.keys(v).forEach(function(k){
          var x = v[k], key = String(k).toLowerCase();
          var isDate = /(^|_)(date|month|period|day|year)$/.test(key) ||
            /(attdate|attendance|snapshot|register|join|resign|settle|effective|start|end|expiry|expire|due|closed)/.test(key);
          if (isDate && (typeof x === 'string' || typeof x === 'number')) {
            var m = String(x).match(/(20\d{2})[-/.](\d{1,2})(?:[-/.](\d{1,2}))?/);
            if (m) dates.push(m[1]+'-'+('0'+m[2]).slice(-2)+'-'+('0'+(m[3]||'01')).slice(-2));
          }
          if (x && typeof x === 'object') walk(x, depth + 1);
        });
      }
      walk(records, 0); dates.sort();
      return {firstDate:dates[0]||'', latestDate:dates[dates.length-1]||'', source:source||'web'};
    },
    fingerprint: fingerprint,
    stateChanged(key, value) { return readState(key).fingerprint !== fingerprint(value); },
    markState(key, value) { writeState(key, { fingerprint:fingerprint(value), updatedAt:new Date().toISOString() }); },
    deltaRecords(key, records) {
      var old = readState(key), map = old.records || {};
      return (records || []).filter(function (r) { return map[recordId(r)] !== fingerprint(r); });
    },
    markRecords(key, records) {
      var old = readState(key), map = old.records || {};
      (records || []).forEach(function (r) { map[recordId(r)] = fingerprint(r); });
      writeState(key, { records:map, updatedAt:new Date().toISOString() });
    },
    /* send(payload) must return the parsed GAS JSON response. */
    async push(payload, send, lang) {
      var result = await send(payload);
      /* GAS wraps responses as {ok:true,data:{...}}.  Older pages returned
         the guard object at the top level, so accept both shapes. */
      var guard = result && result.needsConfirmation ? result
        : result && result.data && result.data.needsConfirmation ? result.data : null;
      if (guard) {
        if (!ask(guard.conflict, lang)) return Object.assign({}, result, { cancelled: true });
        return send(Object.assign({}, payload, { force: true, overwriteConfirmed: true }));
      }
      return result;
    },
    ask: ask,
  };
})(window);
