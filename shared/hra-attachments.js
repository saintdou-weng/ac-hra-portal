/* AC HRA Portal — shared Drive attachment helper v1.0
 *
 * Photos/PDFs are uploaded to GAS immediately.  Portal records keep only
 * small metadata objects, never base64 payloads, so smart cloud sync stays
 * fast on phones.  Removing an item from a record unlinks it but deliberately
 * leaves the Drive file recoverable.
 */
(function (g) {
  'use strict';
  if (g.HRAAttachments) return;

  var mounts = Object.create(null);
  var MAX_BYTES = 10 * 1024 * 1024;
  var GAS_KEYS = ['vrt_att_cloud_v1_url', 'ac_hra_gas_url'];

  function lang() {
    try {
      if (typeof g.LANG !== 'undefined' && /^(zh|en|km)$/.test(String(g.LANG))) return String(g.LANG);
      return localStorage.getItem('vrt_att_v5_lang') || localStorage.getItem('ac_hra_lang') || localStorage.getItem('ac_hra_att_lang') || 'zh';
    }
    catch (_) { return 'zh'; }
  }
  function L(zh, en, km) { var x = lang(); return x === 'km' ? (km || en) : x === 'en' ? en : zh; }
  function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function gasUrl() {
    try {
      for (var i = 0; i < GAS_KEYS.length; i++) {
        var v = String(localStorage.getItem(GAS_KEYS[i]) || '').trim();
        if (v) return v;
      }
    } catch (_) {}
    return '';
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function ext(name) { var m = String(name || '').match(/\.([A-Za-z0-9]{1,8})$/); return m ? '.' + m[1].toLowerCase() : ''; }
  function cleanName(name) { return String(name || 'attachment').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').slice(0, 120) || 'attachment'; }
  function dataUrl(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader(); r.onload = function () { resolve(String(r.result || '')); };
      r.onerror = function () { reject(r.error || new Error('File read failed')); }; r.readAsDataURL(file);
    });
  }
  function compressImage(file) {
    return dataUrl(file).then(function (src) {
      return new Promise(function (resolve, reject) {
        var im = new Image();
        im.onload = function () {
          var max = 1600, scale = Math.min(1, max / Math.max(im.naturalWidth || 1, im.naturalHeight || 1));
          var w = Math.max(1, Math.round(im.naturalWidth * scale)), h = Math.max(1, Math.round(im.naturalHeight * scale));
          var c = document.createElement('canvas'); c.width = w; c.height = h;
          var ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(im, 0, 0, w, h);
          var out = c.toDataURL('image/jpeg', 0.78);
          resolve({ dataUrl:out, mimeType:'image/jpeg', fileName:cleanName(String(file.name || 'photo').replace(/\.[^.]+$/, '')) + '.jpg', width:w, height:h });
        };
        im.onerror = function () { reject(new Error('Image decode failed')); }; im.src = src;
      });
    });
  }
  function prepare(file) {
    if (!file) return Promise.reject(new Error('No file selected'));
    if (file.size > MAX_BYTES) return Promise.reject(new Error(L('檔案超過 10 MB，請縮小後再試。', 'File exceeds 10 MB. Please reduce it and retry.', 'ឯកសារលើស 10 MB។')));
    if (/^image\//i.test(file.type || '')) return compressImage(file);
    if (!/pdf/i.test(file.type || '') && !/\.pdf$/i.test(file.name || '')) {
      return Promise.reject(new Error(L('只接受照片或 PDF。', 'Only images or PDF files are accepted.', 'ទទួលយកតែរូបភាព ឬ PDF។')));
    }
    return dataUrl(file).then(function (src) { return { dataUrl:src, mimeType:file.type || 'application/pdf', fileName:cleanName(file.name || ('document' + ext(file.name))) }; });
  }
  function post(payload) {
    var url = gasUrl();
    if (!url) return Promise.reject(new Error(L('請先設定 GAS 網址。', 'Please configure the GAS URL first.', 'សូមកំណត់ GAS URL ជាមុន។')));
    return fetch(url, { method:'POST', redirect:'follow', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify(payload) })
      .then(function (r) { return r.text(); }).then(function (raw) {
        var j; try { j = JSON.parse(raw); } catch (_) { throw new Error('Cloud returned non-JSON'); }
        if (!j || j.ok === false) throw new Error((j && j.error) || 'Attachment upload failed');
        return j.data || j;
      });
  }
  function upload(file, opts) {
    opts = opts || {};
    return prepare(file).then(function (p) {
      var base64 = String(p.dataUrl || '').split(',')[1] || '';
      if (!base64) throw new Error('Attachment is empty');
      return post({ action:'uploadAttachment', module:opts.module || 'portal', recordKey:typeof opts.recordKey === 'function' ? opts.recordKey() : (opts.recordKey || ''),
        period:typeof opts.period === 'function' ? opts.period() : (opts.period || ''), fileName:p.fileName, mimeType:p.mimeType,
        dataBase64:base64, width:p.width || 0, height:p.height || 0, source:'hra-portal' });
    });
  }
  function render(id) {
    var s = mounts[id], root = document.getElementById(id); if (!s || !root) return;
    var list = s.items || [];
    var rows = list.map(function (a, i) {
      var image = /^image\//i.test(a.mimeType || '');
      return '<div class="hra-att-item" style="display:flex;align-items:center;gap:7px;padding:6px 0;border-top:1px solid #eef2f7">' +
        (image && (a.previewUrl || a.url) ? '<img src="' + esc(a.previewUrl || a.url) + '" alt="" style="width:38px;height:38px;object-fit:cover;border-radius:6px;border:1px solid #dbe3ec">' : '<span style="font-size:20px">' + (/pdf/i.test(a.mimeType || '') ? '📄' : '📎') + '</span>') +
        '<a href="' + esc(a.url || a.downloadUrl || '#') + '" target="_blank" rel="noopener" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#1671a6;font-size:11px">' + esc(a.name || a.fileName || L('佐證檔', 'Evidence', 'ភស្តុតាង')) + '</a>' +
        '<button type="button" data-remove="' + i + '" style="border:0;background:#fff1f2;color:#be123c;border-radius:6px;padding:4px 7px;cursor:pointer" title="' + esc(L('解除連結', 'Unlink', 'ផ្ដាច់តំណ')) + '">×</button></div>';
    }).join('');
    root.innerHTML = '<div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap">' +
      '<button type="button" data-pick style="border:1px solid #cbd5e1;background:#fff;border-radius:7px;padding:7px 10px;font-size:11px;cursor:pointer">📎 ' + esc(L('照片／PDF', 'Photo / PDF', 'រូបភាព / PDF')) + '</button>' +
      '<button type="button" data-camera style="border:1px solid #cbd5e1;background:#fff;border-radius:7px;padding:7px 10px;font-size:11px;cursor:pointer">📷 ' + esc(L('直接拍照', 'Take photo', 'ថតរូប')) + '</button>' +
      '<span data-status style="font-size:10px;color:#64748b"></span></div>' +
      '<input data-file type="file" accept="image/*,application/pdf,.pdf" multiple hidden><input data-cam type="file" accept="image/*" capture="environment" hidden>' +
      '<div data-list>' + rows + '</div>';
    var pick = root.querySelector('[data-pick]'), cam = root.querySelector('[data-camera]'), fi = root.querySelector('[data-file]'), ci = root.querySelector('[data-cam]');
    pick.onclick = function () { fi.click(); }; cam.onclick = function () { ci.click(); };
    function selected(input) { var files = Array.prototype.slice.call(input.files || []); input.value = ''; files.reduce(function (p, f) { return p.then(function () { return addFile(id, f); }); }, Promise.resolve()); }
    fi.onchange = function () { selected(fi); }; ci.onchange = function () { selected(ci); };
    root.querySelectorAll('[data-remove]').forEach(function (b) { b.onclick = function () {
      s.items.splice(Number(b.getAttribute('data-remove')), 1); render(id); changed(s);
    }; });
  }
  function changed(s) { try { if (typeof s.opts.onChange === 'function') s.opts.onChange((s.items || []).slice()); } catch (_) {} }
  function addFile(id, file) {
    var s = mounts[id], root = document.getElementById(id); if (!s || !root) return Promise.resolve();
    var st = root.querySelector('[data-status]'); if (st) st.textContent = L('上傳中…', 'Uploading…', 'កំពុងផ្ទុកឡើង…');
    root.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
    return upload(file, s.opts).then(function (meta) {
      s.items.push(meta); render(id); changed(s);
    }).catch(function (e) {
      if (st) st.textContent = '❌ ' + e.message;
      if (typeof s.opts.onError === 'function') s.opts.onError(e); else if (g.console) console.error('[HRAAttachments]', e);
      root.querySelectorAll('button').forEach(function (b) { b.disabled = false; });
    });
  }
  function mount(id, opts) {
    mounts[id] = { opts:opts || {}, items:Array.isArray(opts && opts.items) ? opts.items.slice() : [] };
    render(id); return api(id);
  }
  function set(id, items) { if (!mounts[id]) return; mounts[id].items = Array.isArray(items) ? items.slice() : []; render(id); }
  function get(id) { return mounts[id] ? (mounts[id].items || []).slice() : []; }
  function api(id) { return { get:function () { return get(id); }, set:function (v) { set(id, v); }, upload:function (f) { return addFile(id, f); } }; }
  function links(items) { return (items || []).map(function (a) { return a && (a.url || a.downloadUrl); }).filter(Boolean); }
  function badge(items) { var n = (items || []).length; return n ? '📎 ' + n : ''; }

  g.HRAAttachments = { mount:mount, set:set, get:get, upload:upload, links:links, badge:badge, gasUrl:gasUrl, version:'1.0' };
})(typeof window !== 'undefined' ? window : this);
