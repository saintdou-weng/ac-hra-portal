/* AC HRA Cloud Guard v1.1 (2026-10-09)
 * Every module uses the same server response when a smaller/older local
 * snapshot would replace a more complete cloud snapshot.
 * v1.1: the "last uploaded" state keeps a 16-character hash per record instead of the whole record text
 *       (ac_hra_cloud_state_* was 600–700K each). Old full-text states still compare correctly and are
 *       compacted on the next save. With shared/ac-storage.js the state itself lives in IndexedDB.
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
  // two FNV-1a 32-bit passes → 16 hex chars; enough to detect a changed record
  function h16(str) {
    var a = 0x811c9dc5, b = 0x01000193 ^ 0x9e3779b9;
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      a ^= c; a = Math.imul(a, 0x01000193) >>> 0;
      b ^= c; b = Math.imul(b, 0x01000193) >>> 0; b ^= b >>> 13;
    }
    return ('0000000' + a.toString(16)).slice(-8) + ('0000000' + (b >>> 0).toString(16)).slice(-8);
  }
  function compact(v) { return 'h:' + h16(fingerprint(v)); }
  function same(stored, v) {               // stored = new compact hash or an old full fingerprint
    if (stored == null) return false;
    stored = String(stored);
    return stored.indexOf('h:') === 0 && stored.length === 18 ? stored === compact(v) : stored === fingerprint(v);
  }
  function stateKey(key) { return 'ac_hra_cloud_state_' + String(key || 'default'); }
  function readState(key) {
    try { return JSON.parse(localStorage.getItem(stateKey(key)) || '{}') || {}; } catch (e) { return {}; }
  }
  function writeState(key, value) {
    try { localStorage.setItem(stateKey(key), JSON.stringify(value)); } catch (e) {}
  }
  function recordId(r) { return String((r && (r._k || r.key || r.id || r.employeeId || r.empId || r.idNo)) || JSON.stringify(r || {})); }
  function shortId(id) { id = String(id); return id.length > 64 ? 'j:' + h16(id) : id; }      // v1.1: no whole records as keys
  function lookup(map, r) { var id = recordId(r); return Object.prototype.hasOwnProperty.call(map, id) ? map[id] : map[shortId(id)]; }

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
    stateChanged(key, value) { return !same(readState(key).fingerprint, value); },
    markState(key, value) { writeState(key, { fingerprint:compact(value), updatedAt:new Date().toISOString() }); },
    deltaRecords(key, records) {
      var old = readState(key), map = old.records || {};
      return (records || []).filter(function (r) { return !same(lookup(map, r), r); });
    },
    markRecords(key, records) {
      var old = readState(key), map = old.records || {}, out = {};
      Object.keys(map).forEach(function (id) {   // compact old full-text entries (keep their meaning: "uploaded as this text")
        var v = String(map[id] == null ? '' : map[id]);
        out[shortId(id)] = (v.indexOf('h:') === 0 && v.length === 18) ? v : 'h:' + h16(v);
      });
      (records || []).forEach(function (r) { out[shortId(recordId(r))] = compact(r); });
      writeState(key, { records:out, updatedAt:new Date().toISOString() });
    },
    hash: h16,
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
