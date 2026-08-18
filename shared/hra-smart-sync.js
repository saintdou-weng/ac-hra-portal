/* AC HRA Portal Smart Sync v1.6
 * Bucket-level incremental sync for the HRA Portal.
 *
 * The existing attendance page has its own date-shard protocol and keeps using
 * that protocol.  This helper is for the other Portal modules: onboarding,
 * contract, maternity, manpower, welfare, certificate and calendar.
 * It never deletes a cloud-only bucket during a normal push.  A first push
 * against a legacy snapshot performs a one-time merge, then creates the smart
 * manifest.  Later pushes and pulls exchange only changed buckets.
 */
(function (g) {
  'use strict';
  if (g.HRASmartSync) return;

  var VERSION = '1.6';
  var STATE_PREFIX = 'ac_hra_smart_sync_v2_';
  var FULL_CACHE_DB = 'AC_HRA_FullCloudCache_v1', FULL_CACHE_STORE = 'snapshots';
  var nativeFetch = g.fetch ? g.fetch.bind(g) : null;

  function now() { return new Date().toISOString(); }
  function enc(v) { return encodeURIComponent(String(v == null ? '' : v)); }
  function text(v) { return String(v == null ? '' : v); }
  function callStatus(fn, value, type) { try { if (fn) fn(value, type || 'busy'); } catch (_) {} }
  /* Mobile Chrome/WebViews and a few proxy layers cache the GET response from
     an Apps Script Web App.  AC GASCheck always adds a cache-buster to its
     cloud GETs; Portal must do the same or a phone can keep receiving the old
     empty manifest/bucket while a desktop already sees the new data. */
  function noCache(url) {
    return url + (url.indexOf('?') >= 0 ? '&' : '?') + '_t=' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  /* The four portal pages have used a few tool ids over their lifetime.  A
     phone may therefore be talking to a deployment that stores the same
     portal under an older id.  Keep local state keyed by the page's id, but
     try the canonical and legacy network ids automatically. */
  var TOOL_ALIASES = {
    welfare_suggestion:'welfare', welfare_suggestions:'welfare',
    certificate:'certificate_visa', visa:'certificate_visa',
    hr_complete:'manpower', join:'onboarding', resign:'onboarding'
  };
  function canonicalTool(v) {
    var raw = text(v).trim().toLowerCase().replace(/\s+/g, '_');
    return TOOL_ALIASES[raw] || raw || 'tool';
  }
  function toolCandidates(v) {
    var raw = text(v).trim().toLowerCase().replace(/\s+/g, '_'), c = canonicalTool(raw), out = [];
    function add(x) { if (x && out.indexOf(x) < 0) out.push(x); }
    add(c); add(raw);
    Object.keys(TOOL_ALIASES).forEach(function (k) { if (TOOL_ALIASES[k] === c) add(k); });
    return out.length ? out : ['tool'];
  }

  function stable(v) {
    if (v === null || v === undefined) return 'null';
    if (typeof v === 'number' || typeof v === 'boolean') return JSON.stringify(v);
    if (typeof v === 'string') return JSON.stringify(v);
    if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
    if (typeof v === 'object') {
      return '{' + Object.keys(v).sort().filter(function (k) {
        return !/^_smart/.test(k) && !/^(updatedAt|createdAt|savedAt|timestamp|cloudUpdatedAt|lastCloudUpdatedAt)$/.test(k);
      }).map(function (k) { return JSON.stringify(k) + ':' + stable(v[k]); }).join(',') + '}';
    }
    return JSON.stringify(text(v));
  }
  function fnv(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ('00000000' + (h >>> 0).toString(16)).slice(-8);
  }
  function hash(str) {
    try {
      if (g.crypto && g.crypto.subtle && g.TextEncoder) {
        return g.crypto.subtle.digest('SHA-256', new g.TextEncoder().encode(str)).then(function (b) {
          return Array.prototype.map.call(new Uint8Array(b), function (x) { return x.toString(16).padStart(2, '0'); }).join('').slice(0, 24);
        });
      }
    } catch (_) {}
    return Promise.resolve(fnv(str) + '_' + str.length.toString(36));
  }
  function normDate(v) {
    if (!v) return '';
    var s = text(v).trim(), m = s.match(/(20\d{2})[-\/.](\d{1,2})(?:[-\/.](\d{1,2}))?/);
    if (m) return m[1] + '-' + ('0' + (+m[2])).slice(-2) + (m[3] ? '-' + ('0' + (+m[3])).slice(-2) : '');
    m = s.match(/(\d{1,2})[-\/.](\d{1,2})[-\/.](20\d{2})/);
    return m ? m[3] + '-' + ('0' + (+m[1])).slice(-2) + '-' + ('0' + (+m[2])).slice(-2) : '';
  }
  var DATE_FIELDS = ['date','recordDate','reportDate','effectiveDate','startDate','endDate','joinDate','resignDate','settleDate','expiry','contractEnd','probEnd','period','payMonth','month','snapshotDate','updatedAt'];
  var KEY_FIELDS = ['id','uuid','recordId','employeeId','empId','factoryId','idNo','key','_k','sourceKey','file','number','lineNo','line','section','dept','department','position','type','kind'];
  function recordDate(r) {
    for (var i = 0; i < DATE_FIELDS.length; i++) { var d = normDate(r && r[DATE_FIELDS[i]]); if (d) return d; }
    return '';
  }
  function semanticKey(r) {
    if (!r || typeof r !== 'object') return stable(r);
    for (var i = 0; i < ['_k','id','uuid','recordId','employeeId','empId','factoryId','idNo'].length; i++) {
      var k = ['_k','id','uuid','recordId','employeeId','empId','factoryId','idNo'][i];
      if (r[k] !== undefined && r[k] !== null && r[k] !== '') return k + ':' + text(r[k]) + '|' + text(r._kind || r.kind || '');
    }
    var parts = [];
    KEY_FIELDS.forEach(function (k) { if (r[k] !== undefined && r[k] !== null && r[k] !== '') parts.push(k + '=' + text(r[k])); });
    return parts.length ? parts.join('|') : stable(r);
  }
  function bucketKey(r) {
    if (r && (r.kind === 'snapshot' || r.kind === 'calendarSnapshot')) return 's:snapshot';
    var d = recordDate(r); if (d) return 'm:' + d.slice(0, 7);
    return 'h:' + ('0' + (parseInt(fnv(semanticKey(r)), 16) % 32).toString(16)).slice(-2);
  }
  function newer(a, b) {
    function stamp(x) {
      for (var i = 0; i < ['updatedAt','savedAt','modifiedAt','createdAt','timestamp','date','effectiveDate'].length; i++) {
        var d = x && x[['updatedAt','savedAt','modifiedAt','createdAt','timestamp','date','effectiveDate'][i]];
        if (d) { var n = new Date(d).getTime(); if (!isNaN(n)) return n; }
      }
      return 0;
    }
    var aa = stamp(a), bb = stamp(b); if (aa !== bb) return aa > bb ? a : b;
    return stable(a).length >= stable(b).length ? a : b;
  }
  function mergeRows(a, b) {
    var map = {}, order = [];
    (a || []).concat(b || []).forEach(function (r) {
      var k = semanticKey(r);
      if (!Object.prototype.hasOwnProperty.call(map, k)) order.push(k);
      map[k] = map[k] ? newer(map[k], r) : r;
    });
    return order.map(function (k) { return map[k]; });
  }
  function sortRows(rows) {
    return (rows || []).slice().sort(function (a, b) {
      var ka = semanticKey(a), kb = semanticKey(b);
      return ka < kb ? -1 : ka > kb ? 1 : stable(a) < stable(b) ? -1 : 1;
    });
  }
  function buildBuckets(records) {
    var groups = {};
    (records || []).forEach(function (r) { var k = bucketKey(r); (groups[k] || (groups[k] = [])).push(r); });
    var keys = Object.keys(groups).sort(), out = {}, jobs = keys.map(function (k) {
      var rows = sortRows(groups[k]);
      return hash(stable(rows)).then(function (h) { out[k] = { key:k, records:rows, count:rows.length, hash:h }; });
    });
    return Promise.all(jobs).then(function () { return out; });
  }
  function readState(tool) {
    try { return JSON.parse(localStorage.getItem(STATE_PREFIX + tool) || 'null'); } catch (_) { return null; }
  }
  function writeState(tool, v) { try { localStorage.setItem(STATE_PREFIX + tool, JSON.stringify(v)); } catch (_) {} }
  /* Sewing keeps the complete downloaded dataset in IndexedDB.  Do the same
     for the four snapshot portals: mobile localStorage is too small for
     photos/rosters and a WebView may be destroyed between two chunk reads. */
  function openFullCache() {
    return new Promise(function (resolve, reject) {
      if (!g.indexedDB) { reject(new Error('IndexedDB unavailable')); return; }
      var q = indexedDB.open(FULL_CACHE_DB, 1);
      q.onupgradeneeded = function () { if (!q.result.objectStoreNames.contains(FULL_CACHE_STORE)) q.result.createObjectStore(FULL_CACHE_STORE); };
      q.onsuccess = function () { resolve(q.result); };
      q.onerror = function () { reject(q.error || new Error('IndexedDB open failed')); };
    });
  }
  function fullCachePut(tool, value) {
    return openFullCache().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(FULL_CACHE_STORE, 'readwrite');
        tx.objectStore(FULL_CACHE_STORE).put(value, canonicalTool(tool));
        tx.oncomplete = function () { db.close(); resolve(value); };
        tx.onerror = function () { db.close(); reject(tx.error || new Error('IndexedDB save failed')); };
      });
    }).catch(function () { return value; });
  }
  function fullCacheGet(tool) {
    return openFullCache().then(function (db) {
      return new Promise(function (resolve, reject) {
        var q = db.transaction(FULL_CACHE_STORE, 'readonly').objectStore(FULL_CACHE_STORE).get(canonicalTool(tool));
        q.onsuccess = function () { db.close(); resolve(q.result || null); };
        q.onerror = function () { db.close(); reject(q.error || new Error('IndexedDB read failed')); };
      });
    }).catch(function () { return null; });
  }
  function jsonFetch(url, opts) {
    if (!nativeFetch) return Promise.reject(new Error('Browser fetch unavailable'));
    var request = Object.assign({ cache:'no-store' }, opts || {});
    return nativeFetch(url, request).then(function (r) {
      return r.text().then(function (raw) {
        var j; try { j = JSON.parse(raw); } catch (_) { throw new Error('Cloud returned non-JSON: ' + raw.slice(0, 100)); }
        if (!r.ok || (j && j.ok === false)) throw new Error((j && j.error) || ('HTTP ' + r.status));
        return j;
      });
    });
  }
  function dataOf(j) { return (j && j.data !== undefined) ? j.data : j; }
  /* Older deployments use the generic response "Unsupported smart sync tool"
     instead of exposing smartManifest/smartBucket/smartCommit.  Treat all
     known forms as one compatibility signal so a phone can fall back to the
     safe merge endpoint without making the user retry a large upload. */
  function isUnsupportedSmartError(err) {
    var s = text(err && err.message || err);
    return /unsupported\s+smart\s+(sync\s+)?tool/i.test(s) ||
      /smart\s+sync.*(unsupported|not supported|not implemented)/i.test(s) ||
      /unknown action\s*:\s*smart(manifest|bucket|commit)/i.test(s) ||
      /smart(manifest|bucket|commit).*(unsupported|not found|not implemented)/i.test(s) ||
      /unknown\s+(tool|portal)\b/i.test(s) || /tool\s+(id\s+)?not\s+found/i.test(s);
  }
  function isUnsupportedSmartManifestError(err) { return isUnsupportedSmartError(err); }
  /* Older HRA pages did not all save a flat records[] array.  Welfare and
     Certificate saved section arrays, while early Manpower saved reqs/recruit
     plus joins/resigns.  Normalize those shapes before the compatibility
     migration; otherwise a first phone download can see zero rows and then
     accidentally create an empty smart manifest over the old snapshot. */
  function legacyArray(v) { return Array.isArray(v) ? v : []; }
  function legacyNorm(v) { return text(v).trim().toUpperCase().replace(/[\s_\-–—\/]+/g, ''); }
  function legacyRowKey(tool, section, row, index) {
    row = row || {};
    var c = canonicalTool(tool), eid = text(row.employeeId || row.empId || row.idNo || ''), date = text(row.date || row.period || row.joinDate || row.resignDate || row.expiryDate || row.dueDate || '');
    if (c === 'welfare') {
      var wk = '';
      if (section === 'members' || section === 'unionDues') wk = [row.period || '', eid || row.id || row.name || ''].join('|');
      else if (section === 'movements') wk = [row.action || '', row.date || '', eid || row.name || ''].join('|');
      else if (section === 'suggestions') wk = row.sourceKey || [row.date || row.period || '', row.number || '', row.department || '', row.grievance || '', row.id || ''].join('|');
      else if (section === 'summaries') wk = String(row.period || row.id || '');
      else wk = String(row.id || row.file || row.sourceFile || stable(row));
      return 'welfare|' + section + '|' + wk;
    }
    if (c === 'certificate_visa') {
      var s = legacyNorm;
      if (section === 'certificates') return ['certificate', s(row.category || ''), s(row.name || '')].join('|');
      if (section === 'people') {
        var pass = s(row.passport), name = s(row.nameEn || row.nameKh || row.nickname || row.name), dob = s(row.dob);
        return ['person', s(eid) || pass || (name + '|' + dob)].join('|');
      }
      if (section === 'requests') {
        var items = legacyArray(row.items).map(function (i) { return s(i && (i.id || i.employeeId || i.passport || i.name || i.title)); }).sort().join(',');
        return ['request', s(row.number) || (s(row.title) + '|' + s(row.type) + '|' + s(row.dueDate) + '|' + items)].join('|');
      }
      if (section === 'imports') return ['import', s(row.file || row.sourceFile || row.summary || row.id)].join('|');
      return ['certificate_visa', section, s(row.id || row.number || row.name || stable(row))].join('|');
    }
    if (c === 'manpower') {
      var mpKind = section === 'reqs' || section === 'plans' ? 'plan' : section === 'recruit' || section === 'candidates' ? 'candidate' : section === 'joins' ? 'join' : section === 'resigns' ? 'resign' : section === 'daily' ? 'daily' : '';
      if (mpKind === 'plan') return row._k || ['P', date.slice(0, 7), row.dept || '', row.section || '', row.position || row.title || ''].join('|');
      if (mpKind === 'candidate') return row._k || ['C', date.slice(0, 10), row.name || '', row.phone || row.empId || index].join('|');
      if (mpKind === 'join') return row._k || ['J', eid || row.name || index, date.slice(0, 10)].join('|');
      if (mpKind === 'resign') return row._k || ['R', eid || row.name || index, date.slice(0, 10)].join('|');
      return row._k || [c, section, eid || row.id || row.name || index, date].join('|');
    }
    return row._k || [c, section, eid || row.id || row.number || row.name || index, date].join('|');
  }
  function legacyWrapRows(tool, section, values) {
    return legacyArray(values).map(function (row, index) {
      var x = Object.assign({}, row || {}), c = canonicalTool(tool);
      if (!x._k) x._k = legacyRowKey(tool, section, x, index);
      if (c === 'welfare') x._hraSection = section;
      if (c === 'certificate_visa') x._hraSection = section;
      if (c === 'manpower') {
        var k = section === 'reqs' || section === 'plans' ? 'plan' : section === 'recruit' || section === 'candidates' ? 'candidate' : section === 'joins' ? 'join' : section === 'resigns' ? 'resign' : section === 'daily' ? 'daily' : '';
        if (k) x._kind = x._kind || k;
      }
      if (c === 'maternity') {
        /* The first Maternity versions saved one complete state object
           instead of a flat records[] list.  Give every recovered section a
           stable type so the page can restore amounts and headcounts. */
        var mt = section === 'employees' || section === 'pregnant' || section === 'maternity' ? (x.type || x.status || (section === 'maternity' ? 'maternity' : 'pregnant'))
          : ['nursing','nursingFees','nursingFee','nursingRecords','nurFees'].indexOf(section) >= 0 ? 'nursing'
          : ['healthFees','healthFee','healthFeeRecords','healthCheckFees','healthCheckPay','healthRecords','health_fee'].indexOf(section) >= 0 ? 'health_fee'
          : ['medicalPurchase','medicalPurchases','medical','medicalRecords','medicinePurchases','purchaseOrders'].indexOf(section) >= 0 ? 'medical_purchase'
          : section === 'clinic' || section === 'clinics' || section === 'clinicRecords'
            ? (x.type || (x.visitCount !== undefined || x.medicalFee !== undefined || x.departmentCounts !== undefined ? 'clinic_summary' : 'clinic_visit'))
          : section === 'salaryRecords' || section === 'salary' ? 'salary'
          : x.type || '';
        if (mt) x.type = mt;
      }
      return x;
    });
  }
  function legacyRecordsFor(tool, payload) {
    var p = payload || {};
    if (p.data && typeof p.data === 'object' && !Array.isArray(p.data) && !Array.isArray(p.records)) p = p.data;
    var direct = p.records || (p.idbStore && p.idbStore.records) || (p.idbData && (p.idbData.records || p.idbData.po_lines));
    var c = canonicalTool(tool), out = [], sections;
    if (c === 'welfare') sections = ['members','movements','unionDues','suggestions','summaries','imports'];
    else if (c === 'certificate_visa') sections = ['certificates','people','requests','imports'];
    else if (c === 'manpower') sections = ['reqs','recruit','plans','candidates','joins','resigns','daily'];
    else if (c === 'maternity') sections = ['employees','pregnant','maternity','nursing','nursingFees','nursingFee','nursingRecords','nurFees','healthFees','healthFee','healthFeeRecords','healthCheckFees','healthCheckPay','healthRecords','health_fee','medicalPurchase','medicalPurchases','medical','medicalRecords','medicinePurchases','purchaseOrders','clinic','clinics','clinicRecords','salaryRecords','salary'];
    else return Array.isArray(direct) ? direct : [];
    /* Some legacy snapshots contain both records[] (usually the registry)
       and named fee/roster arrays.  Returning records[] immediately discards
       all amounts.  Preserve the flat rows and append every named section. */
    if (Array.isArray(direct)) out = direct.slice();
    sections.forEach(function (section) { out = out.concat(legacyWrapRows(tool, section, p[section])); });
    if ((c === 'welfare' || c === 'certificate_visa') && p.settings && typeof p.settings === 'object') {
      out.push({ _hraSection:'settings', _k:c + '|settings', payload:p.settings });
    }
    if (c === 'maternity' && p.lsKeys && typeof p.lsKeys === 'object') {
      function parsedKey(k, fallback) { try { var v = p.lsKeys[k]; return typeof v === 'string' ? JSON.parse(v) : (v || fallback); } catch (_) { return fallback; } }
      var matState = parsedKey('vrt_maternity_v1', {});
      out = out.concat(legacyWrapRows(tool, 'employees', matState.employees));
      out = out.concat(legacyWrapRows(tool, 'salaryRecords', matState.salaryRecords));
      out = out.concat(legacyWrapRows(tool, 'nursing', parsedKey('vrt_nursing_fees_v2', [])));
      out = out.concat(legacyWrapRows(tool, 'healthFees', parsedKey('vrt_health_fees_v1', [])));
      out = out.concat(legacyWrapRows(tool, 'medicalPurchase', parsedKey('ac_hra_maternity_medical_purchase_v1', [])));
      out = out.concat(legacyWrapRows(tool, 'clinic', parsedKey('ac_hra_maternity_clinic_v1', [])));
    }
    /* Some exports wrap the old state in payload/state instead of data.  A
       wrapper may coexist with records[], so append it instead of consulting
       it only when the outer shell is empty. */
    var nested = p.payload || p.state;
    if (nested && typeof nested === 'object' && nested !== p) out = out.concat(legacyRecordsFor(tool, nested));
    if (c === 'maternity') {
      var mm = {}, mo = [];
      out.forEach(function (r, index) {
        r = r || {};
        var t = text(r.type || r.status || '').toLowerCase(), id = text(r.employeeId || r.empId || r.idNo || r.cardId || r.factoryId || ''),
          period = text(r.period || r.payMonth || r.month || r.date || r.leaveStart || r.applyDate || ''), key;
        if (t === 'health_fee' || t === 'health') key = 'HF|' + (id || r.name || index) + '|' + period.slice(0, 7);
        else if (t === 'nursing') key = 'N|' + (id || r.name || index) + '|' + period.slice(0, 7);
        else if (t === 'medical_purchase' || t === 'medical') key = 'MED|' + period.slice(0, 7) + '|' + text(r.item || r.productName || r.name || r.rowNo || index);
        else if (t.indexOf('clinic') === 0) key = 'CLINIC|' + t + '|' + period + '|' + (id || r.name || r.diagnosis || r.rowNo || index);
        else if (t === 'salary') key = 'SAL|' + (id || r.name || index) + '|' + period.slice(0, 7);
        else key = 'E|' + (id || r.name || r.id || index);
        if (!mm[key]) { mm[key] = Object.assign({}, r); mo.push(key); }
        else Object.keys(r).forEach(function (k) { if (r[k] !== undefined && r[k] !== null && r[k] !== '') mm[key][k] = r[k]; });
      });
      return mo.map(function (k) { return mm[k]; });
    }
    return mergeRows([], out);
  }
  function getManifest(url, tool) {
    var endpoint = noCache(url + (url.indexOf('?') >= 0 ? '&' : '?') + 'action=smartManifest&tool=' + enc(tool));
    function fallback(reason) {
      return { exists:false, legacy:true, compatibilityFallback:true,
        reason:text(reason || 'smartManifest unsupported') };
    }
    function validManifest(d) { return d && (d.exists !== undefined || d.hashes || d.version); }
    function tryPostManifest(reason) {
      /* A few mobile WebViews/proxies mishandle GET query actions.  The v31
         GAS accepts the same manifest request through POST; if the deployed
         endpoint is older, fall back to the legacy protocol. */
      return post(url, { action:'smartManifest', tool:tool }).then(function (j) {
        var d = dataOf(j) || {};
        return validManifest(d) ? d : fallback(reason);
      }).catch(function () { return fallback(reason); });
    }
    return jsonFetch(endpoint).then(function (j) {
      var d = dataOf(j) || {};
      /* Some older GAS deployments return a generic heartbeat object instead
         of an error for an unknown GET action.  Treat that exactly like the
         explicit error case below, then use the legacy merge protocol. */
      if (d.exists === undefined && !d.hashes && !d.version) return tryPostManifest('smartManifest unsupported');
      return d;
    }).catch(function (err) {
      /* Mobile WebViews sometimes return a non-JSON redirect/login page for
         a GET action without using the server's explicit "unsupported"
         wording.  POST is the same endpoint but is much more reliable on
         phones, so try it for every GET failure before giving up. */
      return tryPostManifest(err.message || err).then(function (d) {
        if (d && d.compatibilityFallback && !isUnsupportedSmartManifestError(err)) {
          d.reason = text(err.message || err);
        }
        return d;
      });
    });
  }
  function legacyPull(url, tool, onStatus, forceLegacy) {
    var candidates = toolCandidates(tool);
    function compatError(err) { return isUnsupportedSmartError(err); }
    function metaRequest(candidate) {
      var getUrl = noCache(url + (url.indexOf('?') >= 0 ? '&' : '?') + 'action=pull&meta=1&tool=' + enc(candidate) + (forceLegacy ? '&legacy=1' : ''));
      return jsonFetch(getUrl).catch(function (err) {
        /* Some deployed Web Apps and mobile WebViews accept legacy actions
           only through POST.  Preserve the original error only if POST also
           fails, so the caller still sees the useful server response. */
        return post(url, { action:'pull', meta:1, tool:candidate, legacy:!!forceLegacy }).catch(function (postErr) {
          throw postErr || err;
        });
      });
    }
    function chunkRequest(candidate, idx, meta) {
      var getUrl = noCache(url + (url.indexOf('?') >= 0 ? '&' : '?') + 'action=pull&tool=' + enc(candidate) + '&chunk=' + idx + (meta.uploadId ? '&uploadId=' + enc(meta.uploadId) : '') + (forceLegacy ? '&legacy=1' : ''));
      return jsonFetch(getUrl).catch(function (err) {
        return post(url, { action:'pull', tool:candidate, chunk:idx, uploadId:meta.uploadId || '', legacy:!!forceLegacy }).catch(function (postErr) {
          throw postErr || err;
        });
      });
    }
    function one(candidate) {
      return metaRequest(candidate).then(function (j) {
        var env = dataOf(j) || {}, meta = env.meta || {}, records = [];
        if (env.chunked && meta) {
          var n = Number(meta.totalChunks) || 0, chain = Promise.resolve();
          for (var i = 0; i < n; i++) (function (idx) {
            chain = chain.then(function () {
              callStatus(onStatus, '首次基準拉取 ' + (idx + 1) + '/' + n, 'busy');
              return chunkRequest(candidate, idx, meta).then(function (cj) {
                var cd = dataOf(cj) || {}; records = records.concat(legacyRecordsFor(candidate, cd));
              });
            });
          })(i);
          return chain.then(function () { return { records:records, meta:meta, tool:candidate }; });
        }
        var p = env.data || env; records = legacyRecordsFor(candidate, p);
        return { records:Array.isArray(records) ? records : [], meta:p || {}, tool:candidate };
      });
    }
    function tryCandidate(idx, last) {
      if (idx >= candidates.length) throw (last || new Error('Legacy cloud download failed'));
      return one(candidates[idx]).catch(function (err) {
        if (compatError(err) && idx + 1 < candidates.length) {
          callStatus(onStatus, '切換相容雲端識別碼：' + candidates[idx + 1], 'warn');
          return tryCandidate(idx + 1, err);
        }
        throw err;
      });
    }
    return tryCandidate(0, null);
  }
  function post(url, body) {
    return jsonFetch(url, { method:'POST', redirect:'follow', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify(body) }).then(dataOf);
  }
  function smartBucketRead(url, tool, bucket, index, expectedCount, onStatus) {
    var endpoint = noCache(url + (url.indexOf('?') >= 0 ? '&' : '?') + 'action=smartBucket&tool=' + enc(tool) + '&bucket=' + enc(bucket));
    var fallback = function (reason) {
      callStatus(onStatus, '手機相容下載：改用 POST 分段 ' + (Number(index) + 1), 'warn');
      return post(url, { action:'pull', tool:tool, chunk:Number(index) }).then(function (d) {
        return dataOf(d) || {};
      }).catch(function (postErr) {
        throw postErr || reason;
      });
    };
    return jsonFetch(endpoint).then(function (j) {
      var d = dataOf(j) || {}, rows = Array.isArray(d.records) ? d.records : [];
      /* A proxy can return a valid empty JSON shell while dropping the actual
         body.  The manifest count lets us distinguish that from a real empty
         bucket. */
      if (Number(expectedCount) > 0 && !rows.length) return fallback(new Error('Empty smart bucket response'));
      return d;
    }).catch(function (err) {
      return fallback(err);
    });
  }

  /* GASCHECK-compatible full pull.  This is deliberately POST-first: mobile
     WebViews are more reliable with text/plain POST than with a redirected
     Apps Script GET, and the GAS pull endpoint already knows how to expose
     both legacy JSON and the current smart buckets by chunk index.  It is a
     recovery path only; normal downloads still use manifest/bucket deltas. */
  function directPull(url, tool, onStatus) {
    var candidates = toolCandidates(tool);
    function getMeta(candidate) {
      return post(url, { action:'pull', tool:candidate, meta:1 }).catch(function (err) {
        var endpoint = noCache(url + (url.indexOf('?') >= 0 ? '&' : '?') + 'action=pull&meta=1&tool=' + enc(candidate));
        return jsonFetch(endpoint).catch(function () { throw err; });
      });
    }
    function getChunk(candidate, idx, meta) {
      return post(url, { action:'pull', tool:candidate, chunk:Number(idx), uploadId:meta && meta.uploadId || '' }).catch(function (err) {
        var endpoint = noCache(url + (url.indexOf('?') >= 0 ? '&' : '?') + 'action=pull&tool=' + enc(candidate) + '&chunk=' + Number(idx) + (meta && meta.uploadId ? '&uploadId=' + enc(meta.uploadId) : ''));
        return jsonFetch(endpoint).catch(function () { throw err; });
      });
    }
    function rowsFrom(value, candidate) {
      var p = dataOf(value) || {};
      if (Array.isArray(p)) return p;
      return legacyRecordsFor(candidate, p);
    }
    function one(candidate) {
      return getMeta(candidate).then(function (j) {
        var env = dataOf(j) || {}, meta = env.meta || {}, total = Number(meta.totalChunks || env.totalChunks || 0), rows = [];
        if ((env.chunked || total) && total > 0) {
          var chain = Promise.resolve();
          for (var i = 0; i < total; i++) (function (idx) {
            chain = chain.then(function () {
              callStatus(onStatus, '手機相容下載 ' + (idx + 1) + '/' + total, 'busy');
              return getChunk(candidate, idx, meta).then(function (cj) {
                rows = rows.concat(rowsFrom(cj, candidate));
              });
            });
          })(i);
          return chain.then(function () {
            return { records:rows, meta:meta, tool:candidate, direct:true,
              remoteRecordCount:Math.max(Number(meta.recordCount) || 0, rows.length) };
          });
        }
        var payload = env.data !== undefined ? env.data : env;
        rows = rowsFrom(payload, candidate);
        return { records:Array.isArray(rows) ? rows : [], meta:payload || {}, tool:candidate, direct:true,
          remoteRecordCount:Math.max(Number(payload && payload.recordCount) || 0, rows.length) };
      });
    }
    /* Never stop at the first syntactically valid empty response.  Older GAS
       deployments did not canonicalise tool ids, so for example `welfare`
       can be empty while `welfare_suggestion` contains the real dataset.
       Read every compatible id, merge the non-empty results and keep the
       largest server count.  This is the main desktop-vs-phone zero-row fix. */
    var found = [], errors = [], chain = Promise.resolve();
    candidates.forEach(function (candidate, idx) {
      chain = chain.then(function () {
        callStatus(onStatus, '完整下載來源 ' + (idx + 1) + '/' + candidates.length + ' · ' + candidate, 'busy');
        return one(candidate).then(function (r) { found.push(r); }).catch(function (err) { errors.push(err); });
      });
    });
    return chain.then(function () {
      var useful = found.filter(function (r) { return (r.records || []).length || Number(r.remoteRecordCount) > 0; });
      if (!useful.length) {
        if (!found.length && errors.length) throw errors[errors.length - 1];
        return found[0] || { records:[], meta:{}, tool:canonicalTool(tool), direct:true, remoteRecordCount:0 };
      }
      var rows = [], best = useful[0];
      useful.forEach(function (r) {
        rows = mergeRows(rows, r.records || []);
        if (Number(r.remoteRecordCount) > Number(best.remoteRecordCount)) best = r;
      });
      return Object.assign({}, best, { records:sortRows(rows), direct:true,
        sourceTools:useful.map(function (r) { return r.tool; }),
        remoteRecordCount:Math.max.apply(Math, useful.map(function (r) { return Number(r.remoteRecordCount) || (r.records || []).length; }).concat([rows.length])) });
    });
  }

  function pullReliable(opts) {
    opts = opts || {};
    var tool = opts.tool, isRecoveryTool = ['welfare','certificate_visa','manpower','maternity'].indexOf(canonicalTool(tool)) >= 0;
    function useDirect(base, reason) {
      return directPull(text(opts.url).trim(), tool, opts.onStatus).then(function (direct) {
        if (direct && (direct.records || []).length) {
          callStatus(opts.onStatus, '完成｜手機相容完整下載並合併', 'warn');
          return Object.assign({}, base || {}, direct, { ok:true, noCloud:false, directFallback:true, fallbackReason:text(reason || '') });
        }
        return base;
      });
    }
    /* Manual download for the affected portals follows Sewing's complete
       pull first, then writes one atomic IndexedDB snapshot.  Smart pull is
       still retained as the fallback and for normal incremental uploads. */
    if (isRecoveryTool) {
      return directPull(text(opts.url).trim(), tool, opts.onStatus).then(function (direct) {
        var remoteRows = direct && Array.isArray(direct.records) ? direct.records : [];
        if (!remoteRows.length && !Number(direct && direct.remoteRecordCount)) {
          return fullCacheGet(tool).then(function (cached) {
            if (cached && Array.isArray(cached.records) && cached.records.length) {
              callStatus(opts.onStatus, '雲端暫時為空，使用上次完整下載快取', 'warn');
              return Object.assign({}, direct, { ok:true, noCloud:false, records:cached.records,
                remoteRecords:cached.records, meta:cached.meta || {}, downloaded:0, cached:true,
                remoteRecordCount:cached.records.length });
            }
            return pull(opts);
          });
        }
        return fullCachePut(tool, { records:remoteRows, meta:direct.meta || {}, sourceTools:direct.sourceTools || [direct.tool], savedAt:now() }).then(function () {
          callStatus(opts.onStatus, '完成｜完整下載 ' + remoteRows.length.toLocaleString() + ' 筆並保存', 'ok');
          return Object.assign({}, direct, { ok:true, noCloud:false, remoteRecords:remoteRows,
            downloaded:remoteRows.length, remoteRecordCount:Math.max(Number(direct.remoteRecordCount) || 0, remoteRows.length) });
        });
      }).catch(function (directErr) {
        return pull(opts).catch(function () {
          return fullCacheGet(tool).then(function (cached) {
            if (cached && Array.isArray(cached.records) && cached.records.length) {
              callStatus(opts.onStatus, '網路下載失敗，使用上次完整下載快取', 'warn');
              return { ok:true, noCloud:false, records:cached.records, remoteRecords:cached.records,
                meta:cached.meta || {}, downloaded:0, cached:true, remoteRecordCount:cached.records.length };
            }
            throw directErr;
          });
        });
      });
    }
    return pull(opts).then(function (base) {
      if (!isRecoveryTool || !base || base.cancelled) return base;
      var rows = Array.isArray(base.records) ? base.records.length : 0;
      var remoteCount = Number(base.remoteRecordCount) || (Array.isArray(base.remoteRecords) ? base.remoteRecords.length : 0);
      /* A one-row old snapshot can represent many people/fees.  Let the page
         normalize it first, but use the direct path when the response is
         plainly empty or much smaller than the server count. */
      if (!rows || (remoteCount > 1 && remoteCount > rows)) return useDirect(base, 'empty-or-short-mobile-response');
      return base;
    }).catch(function (err) {
      if (!isRecoveryTool) throw err;
      return useDirect(null, err.message || err).then(function (r) { if (r) return r; throw err; }).catch(function () { throw err; });
    });
  }
  function conflictConfirm(tool, buckets) {
    if (!buckets.length || typeof g.confirm !== 'function') return true;
    return g.confirm('雲端與本機同時有變更：' + buckets.join(', ') + '\n\n先合併較新的欄位並保留雙方資料？');
  }
  function mergeSnapshots(opts, localRows, remoteRows) {
    if (typeof opts.mergeRecords === 'function') return opts.mergeRecords(localRows, remoteRows);
    return mergeRows(localRows, remoteRows);
  }

  function compatibilityPull(opts, localRows, status, reason) {
    return legacyPull(text(opts.url).trim(), opts.tool, status).then(function (legacy) {
      var merged = mergeSnapshots(opts, localRows, legacy.records || []);
      var applied = opts.apply ? Promise.resolve(opts.apply(merged, legacy.meta || {})) : Promise.resolve();
      return applied.then(function () {
        callStatus(status, '完成｜舊版 GAS 相容下載與合併｜保留雙方資料', 'warn');
        return { ok:true, records:merged, remoteRecords:legacy.records || [],
          meta:legacy.meta || {}, migrated:false, compatibilityFallback:true,
          downloaded:(legacy.records || []).length,
          remoteRecordCount:Number(legacy.meta && legacy.meta.recordCount) || (legacy.records || []).length,
          fallbackReason:text(reason || '') };
      });
    });
  }

  /* Compatibility path for a GAS Web App that has not yet been redeployed
     with smartManifest/smartBucket/smartCommit.  The old push endpoint still
     merges by business key and never deletes cloud-only rows, so it is safe to
     use while the user is moving from the old deployment to the new one. */
  function legacyPush(opts, records, status) {
    /* Keep the page's original id on the legacy endpoint.  Current GAS
       canonicalizes it server-side; older GAS deployments may have stored
       welfare_suggestion/certificate under that exact filename. */
    var url = text(opts.url).trim(), tool = text(opts.tool).trim() || canonicalTool(opts.tool), rows = sortRows(records || []);
    var size = Number(opts.legacyChunkSize) || 120;
    var total = Math.max(1, Math.ceil(rows.length / size));
    var syncId = 'compat_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    var summary = opts.summary || {};
    var meta = opts.meta || {};
    var decisions = opts.decisions || meta.decisions || null;
    var sent = 0, chain = Promise.resolve(), lastResult = null;
    for (var i = 0; i < total; i++) (function (idx) {
      chain = chain.then(function () {
        var slice = rows.slice(idx * size, (idx + 1) * size);
        var body = {
          action:'push', tool:tool, records:slice, recordCount:rows.length,
          totalChunks:total, chunk:idx, syncId:syncId, mode:'merge',
          summary:summary, coverage:meta.coverage || opts.coverage || {},
          updatedAt:now(), version:'compat-1.0'
        };
        if (decisions) body.decisions = decisions;
        if (opts.importLog) body.importLog = opts.importLog;
        callStatus(status, '相容同步：上傳 ' + (idx + 1) + '/' + total, 'busy');
        var sender = function (p) { return post(url, p); };
        var request = idx === total - 1 && g.HRACloudGuard && g.HRACloudGuard.push
          ? g.HRACloudGuard.push(body, sender, opts.lang || 'zh') : sender(body);
        return request.then(function (d) {
          lastResult = d || {};
          if (lastResult && lastResult.cancelled) return lastResult;
          if (lastResult && lastResult.ok === false) throw new Error(lastResult.error || 'Legacy cloud upload failed');
          sent += slice.length;
          return lastResult;
        });
      });
    })(i);
    return chain.then(function () {
      if (lastResult && lastResult.cancelled) return lastResult;
      var out = Object.assign({}, lastResult || {}, { ok:true, compatibilityFallback:true,
        fallback:'legacy', recordCount:rows.length, uploaded:sent,
        unchanged:0, changedBuckets:0, timestamp:now() });
      callStatus(status, '完成｜舊版 GAS 相容合併｜上傳 ' + sent.toLocaleString() + '｜保留雲端資料', 'warn');
      return out;
    });
  }

  function smartPushWithFallback(opts, records, remote, status, migrated) {
    return smartPush(opts, records, remote, status, migrated).catch(function (err) {
      if (!isUnsupportedSmartError(err)) throw err;
      callStatus(status, '智慧同步工具未部署，改用相容合併上傳…', 'warn');
      return legacyPush(opts, records, status);
    });
  }

  function push(opts) {
    opts = opts || {};
    var url = text(opts.url).trim(), tool = opts.tool, records = sortRows(opts.records || []), status = opts.onStatus;
    if (!url) return Promise.reject(new Error('GAS URL missing'));
    callStatus(status, '智慧同步：比對雲端差異…', 'busy');
    return getManifest(url, tool).then(function (remote) {
      remote = remote || {};
      if (remote.compatibilityFallback) {
        return legacyPush(opts, records, status);
      }
      if (!remote.exists && remote.legacy) {
        /* Legacy data is merged once before the smart manifest is created. */
        callStatus(status, '首次升級：合併既有雲端資料…', 'busy');
        return legacyPull(url, tool, status).then(function (legacy) {
          var merged = mergeSnapshots(opts, records, legacy.records || []);
          return smartPushWithFallback(opts, merged, remote, status, true);
        });
      }
      /* A v34 phone may already have committed an empty smart manifest while
         the legacy section snapshot still contains the real data.  Recover
         that baseline before any upload as well; otherwise the first upload
         from an empty phone could hide the older cloud rows. */
      if (remote.exists && !Number(remote.recordCount) && ['welfare','certificate_visa','manpower','maternity'].indexOf(canonicalTool(tool)) >= 0) {
        return legacyPull(url, tool, status, true).then(function (legacy) {
          var oldRows = legacy.records || [];
          if (!oldRows.length) return smartPushWithFallback(opts, records, remote, status, false);
          var merged = mergeSnapshots(opts, records, oldRows);
          return smartPushWithFallback(opts, merged, remote, status, true);
        }).catch(function () { return smartPushWithFallback(opts, records, remote, status, false); });
      }
      return smartPushWithFallback(opts, records, remote, status, false).then(function (result) {
        /* A summary/approval may be the first action on a device that has no
           local sync baseline.  Pull and merge the remote changed buckets
           automatically, then commit the union; only a real conflict asks
           the user for confirmation inside pull(). */
        if (!result || !result.needsPull || opts.autoMerge === false) return result;
        return pull({ url:url, tool:tool, localRecords:records, mergeRecords:opts.mergeRecords, onStatus:status }).then(function (p) {
          if (!p || p.cancelled || !p.ok) return p;
          return getManifest(url, tool).then(function (fresh) { return smartPushWithFallback(Object.assign({}, opts, { records:p.records }), p.records, fresh || {}, status, false); });
        });
      });
    }).catch(function (err) {
      if (!isUnsupportedSmartError(err)) throw err;
      callStatus(status, '智慧同步工具未部署，改用相容合併上傳…', 'warn');
      return legacyPush(opts, records, status);
    });
  }
  function smartPush(opts, records, remote, status, migrated) {
    var tool = opts.tool, url = text(opts.url).trim();
    return Promise.all([buildBuckets(records), hash(stable(opts.meta || {}))]).then(function (parts) {
      var local = parts[0], metaHash = parts[1], last = readState(tool) || {}, lastH = last.hashes || {}, remoteH = remote.hashes || {}, remoteMetaHash = remote.metaHash || '', changed = [], conflicts = [], remoteChanged = [];
      if (migrated) { remoteH = {}; lastH = {}; remoteMetaHash = ''; }
      var keys = {}; Object.keys(local).concat(Object.keys(remoteH)).forEach(function (k) { keys[k] = true; });
      Object.keys(keys).forEach(function (k) {
        var lh = local[k] && local[k].hash || '', rh = remoteH[k] || '', bh = lastH[k] || '';
        if (lh && rh && lh === rh) return;
        if (!bh) {
          if (lh && !rh) { changed.push(k); return; }
          if (!lh && rh) { remoteChanged.push(k); return; }
          if (lh && rh && lh !== rh) { conflicts.push(k); return; }
        }
        var lc = lh !== bh, rc = rh !== bh;
        if (lc && !rc) { if (lh) changed.push(k); }
        else if (!lc && rc) remoteChanged.push(k);
        else if (lc && rc && lh !== rh) conflicts.push(k);
      });
      if (!migrated && (remoteChanged.length || conflicts.length)) {
        var msg = '雲端有新變更 ' + remoteChanged.length + ' 區，衝突 ' + conflicts.length + ' 區；先下載合併';
        callStatus(status, msg, 'warn');
        return { ok:false, needsPull:true, remoteChanged:remoteChanged, conflicts:conflicts, recordCount:records.length };
      }
      var uploadId = 'hra_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8), sent = 0;
      var chain = Promise.resolve();
      changed.forEach(function (k, idx) {
        chain = chain.then(function () {
          var b = local[k];
          callStatus(status, '上傳變更 ' + (idx + 1) + '/' + changed.length + ' · ' + k, 'busy');
          return post(url, { action:'smartBucket', tool:tool, uploadId:uploadId, bucket:k, hash:b.hash, count:b.count, records:b.records }).then(function () { sent += b.count; });
        });
      });
      return chain.then(function () {
        var hashes = {}, counts = {}; Object.keys(local).forEach(function (k) { hashes[k] = local[k].hash; counts[k] = local[k].count; });
        /* Remote-only buckets are intentionally retained. They are merged on the next pull. */
        Object.keys(remoteH).forEach(function (k) { if (!hashes[k]) { hashes[k] = remoteH[k]; counts[k] = Number((remote.counts || {})[k]) || 0; } });
        var recordCount = Math.max(Number(opts.recordCount) || 0, Object.keys(counts).reduce(function (n, k) { return n + (Number(counts[k]) || 0); }, 0));
        var meta = Object.assign({}, opts.meta || {}, { _smartMetaHash:metaHash });
        var metaChanged = metaHash !== remoteMetaHash || migrated || changed.length;
        if (!metaChanged && !changed.length) {
          writeState(tool, { hashes:remoteH, counts:remote.counts || {}, metaHash:remoteMetaHash, updatedAt:now() });
          callStatus(status, '雲端已是最新，沒有需要上傳的變更', 'ok');
          return { ok:true, skipped:true, unchanged:records.length, migrated:false };
        }
        return post(url, { action:'smartCommit', tool:tool, uploadId:uploadId, hashes:hashes, counts:counts, recordCount:recordCount, meta:meta, summary:opts.summary || {} }).then(function (d) {
          var out = { ok:true, recordCount:recordCount, uploaded:sent, unchanged:Math.max(0, records.length - sent), changedBuckets:changed.length, migrated:!!migrated, timestamp:(d && (d.timestamp || d.updatedAt)) || now() };
          writeState(tool, { hashes:hashes, counts:counts, metaHash:metaHash, updatedAt:out.timestamp });
          callStatus(status, '完成｜本機 ' + records.length.toLocaleString() + '｜上傳 ' + sent.toLocaleString() + '｜保留雲端既有資料', 'ok');
          return out;
        });
      });
    });
  }

  function pull(opts) {
    opts = opts || {};
    var url = text(opts.url).trim(), tool = opts.tool, localRows = sortRows(opts.localRecords || []), status = opts.onStatus;
    if (!url) return Promise.reject(new Error('GAS URL missing'));
    callStatus(status, '智慧拉取：比對雲端差異…', 'busy');
    return getManifest(url, tool).then(function (remote) {
      remote = remote || {};
      if (!remote.exists && remote.legacy) {
        return legacyPull(url, tool, status).then(function (legacy) {
          var merged = mergeSnapshots(opts, localRows, legacy.records || []);
          var applied = opts.apply ? Promise.resolve(opts.apply(merged, legacy.meta || {})) : Promise.resolve();
          return applied.then(function () {
            if (remote.compatibilityFallback) {
              callStatus(status, '完成｜舊版 GAS 相容下載與合併', 'warn');
              return { ok:true, records:merged, remoteRecords:legacy.records || [],
                meta:legacy.meta || {}, migrated:false, compatibilityFallback:true,
                downloaded:(legacy.records || []).length,
                remoteRecordCount:Number(legacy.meta && legacy.meta.recordCount) || (legacy.records || []).length };
            }
            /* Match Prod: turn the old full snapshot into a smart manifest
               during this one-time baseline pull, without user setup work. */
            return smartPushWithFallback(opts, merged, remote, status, true).then(function (migrated) {
              return { ok:true, records:merged, remoteRecords:legacy.records || [], meta:legacy.meta || {}, migrated:true, downloaded:(legacy.records || []).length,
                remoteRecordCount:Number(legacy.meta && legacy.meta.recordCount) || (legacy.records || []).length, pushResult:migrated };
            });
          });
        });
      }
      if (!remote.exists) { callStatus(status, '雲端尚無資料', 'warn'); return { ok:false, noCloud:true, records:localRows, meta:{} }; }
      /* If an earlier phone created an empty smart manifest before it could
         understand the old section-based snapshot, read the legacy file once
         with the smart pointer bypassed, then rebuild the manifest from the
         recovered rows.  This is the key repair for Welfare/Certificate and
         early Manpower data that otherwise appears empty forever. */
      var legacyRecoveryTool = ['welfare','certificate_visa','manpower','maternity'].indexOf(canonicalTool(tool)) >= 0;
      var continueSmartPull = function () { return buildBuckets(localRows).then(function (local) {
        var last = readState(tool) || {}, lastH = last.hashes || {}, remoteH = remote.hashes || {}, out = {}, remoteRows = [], downloaded = 0, unchanged = 0, pending = 0, conflictKeys = [], keys = {};
        Object.keys(remoteH).concat(Object.keys(local)).forEach(function (k) { keys[k] = true; });
        var list = Object.keys(keys).sort(), chain = Promise.resolve();
        list.forEach(function (k, idx) {
          chain = chain.then(function () {
            var lb = local[k], rh = remoteH[k] || '', bh = lastH[k] || '';
            if (lb && rh && lb.hash === rh) { out[k] = lb.records; unchanged += lb.count; return; }
            if (lb && !rh) { out[k] = lb.records; pending += lb.count; return; }
            if (lb && bh && lb.hash !== bh && rh !== bh && lb.hash !== rh) conflictKeys.push(k);
            if (!rh) return;
            callStatus(status, '下載變更 ' + (idx + 1) + '/' + list.length + ' · ' + k, 'busy');
            return smartBucketRead(url, tool, k, idx, Number((remote.counts || {})[k]) || 0, status).then(function (bj) {
              var bd = dataOf(bj) || {}, rows = bd.records || [];
              remoteRows = remoteRows.concat(rows);
              downloaded += rows.length;
              out[k] = (lb && lb.hash !== rh) ? mergeSnapshots(opts, lb.records, rows) : rows;
            });
          });
        });
        return chain.then(function () {
          if (conflictKeys.length && !conflictConfirm(tool, conflictKeys)) return { ok:false, cancelled:true, conflicts:conflictKeys, records:localRows, meta:remote.meta || {} };
          var merged = sortRows(Object.keys(out).reduce(function (a, k) { return a.concat(out[k] || []); }, []));
          /* Last-resort recovery for a phone/proxy that returned empty smart
             buckets.  The POST legacy pull understands the same smart
             manifest and reads the chunks by index, so this does not require
             a new file format or any user action. */
          var recover = Number(remote.recordCount) > 0 && !merged.length && !localRows.length
            ? legacyPull(url, tool, status, legacyRecoveryTool).then(function (legacy) {
                var recovered = legacy.records || [];
                if (recovered.length) {
                  remoteRows = recovered;
                  downloaded = recovered.length;
                  return sortRows(recovered);
                }
                return merged;
              }).catch(function () { return merged; })
            : Promise.resolve(merged);
          return recover.then(function (finalRows) {
            if (opts.apply) return Promise.resolve(opts.apply(finalRows, remote.meta || {})).then(function () { return finishPull(finalRows); });
            return finishPull(finalRows);
          });
          function finishPull(finalRows) {
            writeState(tool, { hashes:remoteH, counts:remote.counts || {}, metaHash:remote.metaHash || '', updatedAt:now() });
            callStatus(status, '完成｜下載 ' + downloaded.toLocaleString() + '｜未變 ' + unchanged.toLocaleString() + (pending ? '｜本機待上傳 ' + pending : ''), conflictKeys.length ? 'warn' : 'ok');
            var manifestCount = Number(remote.recordCount) || Object.keys(remote.counts || {}).reduce(function (n, k) { return n + (Number(remote.counts[k]) || 0); }, 0);
            return { ok:true, records:finalRows, remoteRecords:remoteRows, meta:remote.meta || {}, downloaded:downloaded, unchanged:unchanged, pendingUpload:pending, conflicts:conflictKeys,
              remoteRecordCount:Math.max(manifestCount, remoteRows.length) };
          }
        });
      }); };
      if (!Number(remote.recordCount) && legacyRecoveryTool) {
        return legacyPull(url, tool, status, true).then(function (legacy) {
          var legacyRows = legacy.records || [];
          if (!legacyRows.length) return continueSmartPull();
          var merged = sortRows(mergeSnapshots(opts, localRows, legacyRows));
          var applied = opts.apply ? Promise.resolve(opts.apply(merged, legacy.meta || {})) : Promise.resolve();
          return applied.then(function () {
            return smartPushWithFallback(opts, merged, remote, status, true).then(function (migrated) {
              return { ok:true, records:merged, remoteRecords:legacyRows, meta:legacy.meta || {}, migrated:true,
                downloaded:legacyRows.length, remoteRecordCount:Number(legacy.meta && legacy.meta.recordCount) || legacyRows.length,
                pushResult:migrated, recoveredLegacy:true };
            });
          });
        }).catch(function () { return continueSmartPull(); });
      }
      return continueSmartPull();
    }).catch(function (err) {
      if (!isUnsupportedSmartError(err)) throw err;
      callStatus(status, '智慧同步工具未部署，改用相容合併下載…', 'warn');
      return compatibilityPull(opts, localRows, status, err.message || err);
    });
  }

  g.HRASmartSync = { version:VERSION, push:push, pull:pull, pullReliable:pullReliable, pullDirect:directPull,
    fullCacheGet:fullCacheGet, fullCachePut:fullCachePut,
    buildBuckets:buildBuckets, mergeRows:mergeRows, semanticKey:semanticKey, bucketKey:bucketKey, stable:stable };
})(window);
