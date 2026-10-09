/* AC Storage Shield v1.0 (2026-10-09)
 * One shared fix for the 5 MB localStorage of saintdou-weng.github.io (every platform on this domain shares it).
 *
 * Put it as the FIRST script in <head>:
 *   <script src="shared/ac-storage.js?v=1" data-offload="ac_hra_joins,ac_hra_cloud_state_*"></script>
 *
 * 1. Big keys listed in data-offload (exact names, or prefix*) are kept in IndexedDB ("ac_ls_offload").
 *    The page keeps using localStorage.getItem / setItem as before — the shield answers from an in-memory copy.
 *    Old copies still in localStorage are moved to IndexedDB automatically on first load, then removed.
 * 2. localStorage.setItem never fails because the storage is full: the value goes to IndexedDB instead.
 * 3. Page scripts marked  type="text/x-ac-after-storage"  run (in order) only after the IndexedDB copy is loaded,
 *    so the page never sees an empty value at start-up. DOMContentLoaded / load listeners still fire.
 * 4. Changes made in another tab arrive as normal "storage" events (BroadcastChannel).
 * If IndexedDB is unavailable (private mode / blocked), nothing is moved and localStorage works exactly as before.
 */
(function (w) {
  'use strict';
  if (w.ACStorage) return;
  var doc = w.document, me = doc && doc.currentScript;
  var DB = 'ac_ls_offload', ST = 'kv', VERSION = '1.0';
  var EXACT = Object.create(null), PREFIX = [], MIRROR = Object.create(null), has = Object.prototype.hasOwnProperty;
  var OK = false, db = null, chan = null;
  (String((me && me.getAttribute('data-offload')) || w.AC_STORAGE_OFFLOAD || '')).split(',').forEach(function (k) {
    k = k.trim(); if (!k) return;
    if (k.charAt(k.length - 1) === '*') PREFIX.push(k.slice(0, -1)); else EXACT[k] = 1;
  });
  function listed(k) {
    k = String(k);
    if (EXACT[k]) return true;
    for (var i = 0; i < PREFIX.length; i++) if (k.indexOf(PREFIX[i]) === 0) return true;
    return false;
  }

  var SP = w.Storage && w.Storage.prototype, LS = null;
  try { LS = w.localStorage; } catch (_) {}
  if (!SP || !LS) { w.ACStorage = { ready: Promise.resolve(false), version: VERSION }; return; }
  var nGet = SP.getItem, nSet = SP.setItem, nRem = SP.removeItem, nKey = SP.key, nClear = SP.clear;
  var lenDesc = Object.getOwnPropertyDescriptor(SP, 'length');
  function nLen() { try { return lenDesc.get.call(LS); } catch (_) { return 0; } }
  function nativeKeys() { var out = [], n = nLen(); for (var i = 0; i < n; i++) { var k = nKey.call(LS, i); if (k != null) out.push(k); } return out; }

  function tx(mode, fn) {
    return new Promise(function (res) {
      if (!db) return res(false);
      try {
        var t = db.transaction(ST, mode); fn(t.objectStore(ST));
        t.oncomplete = function () { res(true); };
        t.onerror = t.onabort = function () { res(false); };
      } catch (_) { res(false); }
    });
  }
  function put(k, v) { return tx('readwrite', function (s) { s.put(v, k); }); }
  function del(k) { return tx('readwrite', function (s) { s['delete'](k); }); }
  function announce(k, oldV, newV) { try { if (chan) chan.postMessage({ k: k, o: oldV, n: newV }); } catch (_) {} }
  function warn(m) { try { console.warn('[ACStorage] ' + m); } catch (_) {} }

  /* ── localStorage API patch ── */
  SP.getItem = function (k) {
    if (this === LS && OK && has.call(MIRROR, String(k))) return MIRROR[String(k)];
    return nGet.call(this, k);
  };
  SP.setItem = function (k, v) {
    k = String(k); v = String(v);
    if (this === LS && OK && (listed(k) || has.call(MIRROR, k))) {
      var old = has.call(MIRROR, k) ? MIRROR[k] : null;
      MIRROR[k] = v; put(k, v); try { nRem.call(LS, k); } catch (_) {}
      announce(k, old, v);
      return;
    }
    try { return nSet.call(this, k, v); }
    catch (e) {
      if (this !== LS || !OK) throw e;                 // no IndexedDB: keep the page's own error handling
      var o = nGet.call(LS, k);
      try { nRem.call(LS, k); } catch (_) {}
      MIRROR[k] = v; put(k, v); announce(k, o, v);
      warn('localStorage full → IndexedDB: ' + k + ' (' + Math.round(v.length / 1024) + 'K)');
    }
  };
  SP.removeItem = function (k) {
    k = String(k);
    if (this === LS && has.call(MIRROR, k)) { var old = MIRROR[k]; delete MIRROR[k]; del(k); announce(k, old, null); }
    return nRem.call(this, k);
  };
  SP.key = function (i) {
    if (this !== LS || !OK) return nKey.call(this, i);
    var ks = ACStorage.keys(); return i >= 0 && i < ks.length ? ks[i] : null;
  };
  SP.clear = function () {
    if (this === LS && OK) { Object.keys(MIRROR).forEach(function (k) { delete MIRROR[k]; }); tx('readwrite', function (s) { s.clear(); }); }
    return nClear.call(this);
  };
  try {
    Object.defineProperty(SP, 'length', { configurable: true, enumerable: true, get: function () {
      if (this !== LS || !OK) return lenDesc.get.call(this);
      return ACStorage.keys().length;
    } });
  } catch (_) {}

  /* ── boot: load the IndexedDB copy, move listed keys out of localStorage ── */
  function openDb() {
    return new Promise(function (res) {
      try {
        if (!w.indexedDB) return res(null);
        var rq = w.indexedDB.open(DB, 1);
        rq.onupgradeneeded = function () { var d = rq.result; if (!d.objectStoreNames.contains(ST)) d.createObjectStore(ST); };
        rq.onsuccess = function () { res(rq.result); };
        rq.onerror = rq.onblocked = function () { res(null); };
      } catch (_) { res(null); }
    });
  }
  function loadAll() {
    return new Promise(function (res) {
      try {
        var t = db.transaction(ST, 'readonly'), s = t.objectStore(ST), keys = null, vals = null;
        s.getAllKeys().onsuccess = function (e) { keys = e.target.result; };
        s.getAll().onsuccess = function (e) { vals = e.target.result; };
        t.oncomplete = function () { (keys || []).forEach(function (k, i) { MIRROR[String(k)] = String(vals[i]); }); res(true); };
        t.onerror = t.onabort = function () { res(false); };
      } catch (_) { res(false); }
    });
  }
  var boot = openDb().then(function (d) {
    db = d;
    if (!db) { warn('IndexedDB unavailable — localStorage used as before'); return false; }
    return loadAll().then(function (ok) {
      if (!ok) { db = null; return false; }
      // a listed key still in localStorage is the newest copy (first run, or written by a page without the shield)
      var move = nativeKeys().filter(listed);
      move.forEach(function (k) { MIRROR[k] = nGet.call(LS, k); });
      OK = true;
      if (!move.length) return true;
      return tx('readwrite', function (s) { move.forEach(function (k) { s.put(MIRROR[k], k); }); }).then(function (saved) {
        if (saved) move.forEach(function (k) { try { nRem.call(LS, k); } catch (_) {} });
        var kb = move.reduce(function (n, k) { return n + MIRROR[k].length; }, 0);
        warn('moved ' + move.length + ' key(s), ' + Math.round(kb / 1024) + 'K, from localStorage to IndexedDB');
        return true;
      });
    });
  }).then(function (ok) {
    try {
      if (ok && w.BroadcastChannel) {
        chan = new w.BroadcastChannel('ac-ls-offload');
        chan.onmessage = function (e) {
          var m = e.data || {}; if (!m.k) return;
          if (m.n == null) delete MIRROR[m.k]; else MIRROR[m.k] = m.n;
          try { w.dispatchEvent(new StorageEvent('storage', { key: m.k, oldValue: m.o, newValue: m.n, url: location.href, storageArea: LS })); } catch (_) {}
        };
      }
      // a page WITHOUT the shield wrote a listed key in another tab → take it over
      w.addEventListener('storage', function (e) {
        if (!OK || e.storageArea !== LS || !e.key || e.newValue == null || !listed(e.key)) return;
        if (nGet.call(LS, e.key) == null) return;
        MIRROR[e.key] = e.newValue; put(e.key, e.newValue).then(function (s) { if (s) try { nRem.call(LS, e.key); } catch (_) {} });
      });
    } catch (_) {}
    return ok;
  }, function () { return false; });

  /* ── run page scripts that must wait for the IndexedDB copy ── */
  var domReady = new Promise(function (res) {
    if (doc.readyState !== 'loading') res(); else doc.addEventListener('DOMContentLoaded', function () { res(); });
  });
  var fired = { DOMContentLoaded: false, load: false };
  doc.addEventListener('DOMContentLoaded', function () { fired.DOMContentLoaded = true; });
  w.addEventListener('load', function () { fired.load = true; });
  function patchLate(target) {
    var orig = target.addEventListener;
    target.addEventListener = function (type, fn, opt) {
      if ((type === 'DOMContentLoaded' && fired.DOMContentLoaded) || (type === 'load' && target === w && fired.load)) {
        var self = this; setTimeout(function () { try { typeof fn === 'function' ? fn.call(self, new Event(type)) : fn.handleEvent(new Event(type)); } catch (e) { setTimeout(function () { throw e; }); } }, 0);
        return;
      }
      return orig.call(this, type, fn, opt);
    };
    return function () { target.addEventListener = orig; };
  }
  function runDeferred() {
    var list = [].slice.call(doc.querySelectorAll('script[type="text/x-ac-after-storage"]'));
    if (!list.length) return Promise.resolve();
    var undoDoc = patchLate(doc), undoWin = patchLate(w);
    return list.reduce(function (p, old) {
      return p.then(function () {
        return new Promise(function (res) {
          var s = doc.createElement('script');
          for (var i = 0; i < old.attributes.length; i++) { var a = old.attributes[i]; if (a.name !== 'type') s.setAttribute(a.name, a.value); }
          if (old.hasAttribute('src')) {
            s.async = false;
            s.onload = s.onerror = function () { res(); };
            old.parentNode.replaceChild(s, old);
          } else {
            s.text = old.text;
            old.parentNode.replaceChild(s, old);     // inline: runs synchronously, in global scope
            res();
          }
        });
      });
    }, Promise.resolve()).then(function () {
      // keep late-listener support until load has fired, then restore the originals
      if (fired.load) { undoDoc(); undoWin(); } else w.addEventListener('load', function () { setTimeout(function () { undoDoc(); undoWin(); }, 0); });
    });
  }
  var ready = Promise.all([boot, domReady]).then(function (r) { return runDeferred().then(function () { return r[0]; }); });

  w.ACStorage = {
    version: VERSION,
    ready: ready,                         // resolves after the IndexedDB copy is loaded and waiting scripts ran
    keys: function () {                   // localStorage keys + keys kept in IndexedDB
      var seen = Object.create(null), out = [];
      nativeKeys().concat(Object.keys(MIRROR)).forEach(function (k) { if (!seen[k]) { seen[k] = 1; out.push(k); } });
      return out;
    },
    offloaded: function () { return OK ? Object.keys(MIRROR) : []; },
    active: function () { return OK; },
    usage: function () {                  // characters used in localStorage (native only) and in IndexedDB copy
      var ls = 0, idb = 0; nativeKeys().forEach(function (k) { ls += k.length + (nGet.call(LS, k) || '').length; });
      Object.keys(MIRROR).forEach(function (k) { idb += k.length + MIRROR[k].length; });
      return { localStorageChars: ls, indexedDbChars: idb };
    }
  };
})(window);
