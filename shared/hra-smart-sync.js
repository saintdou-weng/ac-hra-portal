/* AC HRA Portal Smart Sync v1.1
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

  var VERSION = '1.1';
  var STATE_PREFIX = 'ac_hra_smart_sync_v1_';
  var nativeFetch = g.fetch ? g.fetch.bind(g) : null;

  function now() { return new Date().toISOString(); }
  function enc(v) { return encodeURIComponent(String(v == null ? '' : v)); }
  function text(v) { return String(v == null ? '' : v); }
  function callStatus(fn, value, type) { try { if (fn) fn(value, type || 'busy'); } catch (_) {} }

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
  function jsonFetch(url, opts) {
    if (!nativeFetch) return Promise.reject(new Error('Browser fetch unavailable'));
    return nativeFetch(url, opts || {}).then(function (r) {
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
      /smart(manifest|bucket|commit).*(unsupported|not found|not implemented)/i.test(s);
  }
  function isUnsupportedSmartManifestError(err) { return isUnsupportedSmartError(err); }
  function getManifest(url, tool) {
    var endpoint = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'action=smartManifest&tool=' + enc(tool);
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
      if (isUnsupportedSmartManifestError(err)) return tryPostManifest(err.message || err);
      throw err;
    });
  }
  function legacyPull(url, tool, onStatus) {
    return jsonFetch(url + '?action=pull&meta=1&tool=' + enc(tool)).then(function (j) {
      var env = dataOf(j) || {}, meta = env.meta || {}, records = [];
      if (env.chunked && meta) {
        var n = Number(meta.totalChunks) || 0, chain = Promise.resolve();
        for (var i = 0; i < n; i++) (function (idx) {
          chain = chain.then(function () {
            callStatus(onStatus, '首次基準拉取 ' + (idx + 1) + '/' + n, 'busy');
            return jsonFetch(url + '?action=pull&tool=' + enc(tool) + '&chunk=' + idx + (meta.uploadId ? '&uploadId=' + enc(meta.uploadId) : '')).then(function (cj) {
              var cd = dataOf(cj) || {}; records = records.concat(cd.records || []);
            });
          });
        })(i);
        return chain.then(function () { return { records:records, meta:meta }; });
      }
      var p = env.data || env; records = p.records || (p.data && p.data.records) || [];
      return { records:Array.isArray(records) ? records : [], meta:p || {} };
    });
  }
  function post(url, body) {
    return jsonFetch(url, { method:'POST', redirect:'follow', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify(body) }).then(dataOf);
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
          downloaded:(legacy.records || []).length, fallbackReason:text(reason || '') };
      });
    });
  }

  /* Compatibility path for a GAS Web App that has not yet been redeployed
     with smartManifest/smartBucket/smartCommit.  The old push endpoint still
     merges by business key and never deletes cloud-only rows, so it is safe to
     use while the user is moving from the old deployment to the new one. */
  function legacyPush(opts, records, status) {
    var url = text(opts.url).trim(), tool = opts.tool, rows = sortRows(records || []);
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
                downloaded:(legacy.records || []).length };
            }
            /* Match Prod: turn the old full snapshot into a smart manifest
               during this one-time baseline pull, without user setup work. */
            return smartPushWithFallback(opts, merged, remote, status, true).then(function (migrated) {
              return { ok:true, records:merged, remoteRecords:legacy.records || [], meta:legacy.meta || {}, migrated:true, downloaded:(legacy.records || []).length, pushResult:migrated };
            });
          });
        });
      }
      if (!remote.exists) { callStatus(status, '雲端尚無資料', 'warn'); return { ok:false, noCloud:true, records:localRows, meta:{} }; }
      return buildBuckets(localRows).then(function (local) {
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
            return jsonFetch(url + '?action=smartBucket&tool=' + enc(tool) + '&bucket=' + enc(k)).then(function (bj) {
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
          if (opts.apply) return Promise.resolve(opts.apply(merged, remote.meta || {})).then(function () { return finishPull(); });
          return finishPull();
          function finishPull() {
            writeState(tool, { hashes:remoteH, counts:remote.counts || {}, metaHash:remote.metaHash || '', updatedAt:now() });
            callStatus(status, '完成｜下載 ' + downloaded.toLocaleString() + '｜未變 ' + unchanged.toLocaleString() + (pending ? '｜本機待上傳 ' + pending : ''), conflictKeys.length ? 'warn' : 'ok');
            return { ok:true, records:merged, remoteRecords:remoteRows, meta:remote.meta || {}, downloaded:downloaded, unchanged:unchanged, pendingUpload:pending, conflicts:conflictKeys };
          }
        });
      });
    }).catch(function (err) {
      if (!isUnsupportedSmartError(err)) throw err;
      callStatus(status, '智慧同步工具未部署，改用相容合併下載…', 'warn');
      return compatibilityPull(opts, localRows, status, err.message || err);
    });
  }

  g.HRASmartSync = { version:VERSION, push:push, pull:pull, buildBuckets:buildBuckets, mergeRows:mergeRows, semanticKey:semanticKey, bucketKey:bucketKey, stable:stable };
})(window);
