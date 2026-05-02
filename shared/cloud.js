/* ═══════════════════════════════════════════════════════════════
   AC HRA Cloud Sync Module  shared/cloud.js  v1.1
   ─────────────────────────────────────────────────────────────
   CORS FIX (v1.1):
   - POST uses Content-Type: 'text/plain'  ← prevents preflight
   - fetch with redirect: 'follow'         ← handles GAS redirect
   - GET uses plain URL params             ← always worked
═══════════════════════════════════════════════════════════════ */
(function(global){
  'use strict';
  const KEY     = 'ac_hra_';
  const CHUNK   = 200;
  const TIMEOUT = 28000;

  const Cloud = {
    gasUrl: '',

    init() {
      this.gasUrl = localStorage.getItem(KEY + 'gas_url') || '';
    },

    setUrl(url) {
      this.gasUrl = (url || '').trim();
      localStorage.setItem(KEY + 'gas_url', this.gasUrl);
    },

    getUrl() {
      return this.gasUrl || localStorage.getItem(KEY + 'gas_url') || '';
    },

    // ── Heartbeat ──────────────────────────────────────────
    async heartbeat() {
      const url = this.getUrl();
      if (!url) return { ok: false, error: 'No GAS URL' };
      try {
        const r = await this._get(url + '?action=heartbeat');
        return r.ok ? { ok: true, data: r.data } : { ok: false, error: r.error };
      } catch(e) {
        return { ok: false, error: e.message };
      }
    },

    // ── Status (all tools) ─────────────────────────────────
    async status() {
      const url = this.getUrl();
      if (!url) return { ok: false, error: 'No GAS URL' };
      try {
        const r = await this._get(url + '?action=status');
        if (!r.ok) return { ok: false, error: r.error };
        return { ok: true, ...r.data };
      } catch(e) {
        return { ok: false, error: e.message };
      }
    },

    // ── Push to cloud ──────────────────────────────────────
    async push(tool, records, summary, onProgress) {
      const url = this.getUrl();
      if (!url) return { ok: false, error: 'No GAS URL' };

      const recArr   = Array.isArray(records) ? records : [records];
      const total    = Math.ceil(recArr.length / CHUNK) || 1;
      const isSingle = recArr.length <= CHUNK;

      try {
        if (isSingle) {
          if (onProgress) onProgress(50, 1, 1);
          const r = await this._post(url, {
            action: 'push', tool,
            records: recArr,
            recordCount: recArr.length,
            totalChunks: 1, chunk: 0,
            summary: summary || {},
            version: '1.0',
            updatedAt: new Date().toISOString(),
            device: navigator.userAgent.slice(0, 60),
          });
          if (onProgress) onProgress(100, 1, 1);
          if (r.ok) this._saveSnap(tool, { recordCount: recArr.length, timestamp: new Date().toISOString(), summary });
          return r;
        }

        // Chunked
        for (let i = 0; i < total; i++) {
          const chunk = recArr.slice(i * CHUNK, (i + 1) * CHUNK);
          if (onProgress) onProgress(Math.round(i / total * 90), i + 1, total);
          const r = await this._post(url, {
            action: 'push', tool,
            records: chunk,
            recordCount: recArr.length,
            totalChunks: total, chunk: i,
            summary: i === total - 1 ? (summary || {}) : {},
            version: '1.0',
            updatedAt: new Date().toISOString(),
            device: navigator.userAgent.slice(0, 60),
          });
          if (!r.ok) return r;
          await this._yield();
        }
        if (onProgress) onProgress(100, total, total);
        this._saveSnap(tool, { recordCount: recArr.length, timestamp: new Date().toISOString(), summary });
        return { ok: true, recordCount: recArr.length };
      } catch(e) {
        return { ok: false, error: e.message };
      }
    },

    // ── Pull from cloud ────────────────────────────────────
    async pull(tool, onProgress) {
      const url = this.getUrl();
      if (!url) return { ok: false, error: 'No GAS URL' };
      try {
        if (onProgress) onProgress(10);
        const meta = await this._get(`${url}?action=pull&tool=${tool}&meta=1`);
        if (!meta.ok) return { ok: false, error: meta.error };
        const d = meta.data;
        if (d.data === null) return { ok: true, data: null, message: '尚無雲端資料' };

        if (!d.chunked) {
          if (onProgress) onProgress(100);
          return { ok: true, records: d.records || d.data?.records || [], data: d.data };
        }

        // Chunked pull
        const chunks = d.meta?.totalChunks || 1;
        const all = [];
        for (let i = 0; i < chunks; i++) {
          if (onProgress) onProgress(Math.round(10 + i / chunks * 80));
          const r = await this._get(`${url}?action=pull&tool=${tool}&chunk=${i}`);
          if (!r.ok) return { ok: false, error: r.error };
          all.push(...(r.data?.records || []));
          await this._yield();
        }
        if (onProgress) onProgress(100);
        return { ok: true, records: all, meta: d.meta };
      } catch(e) {
        return { ok: false, error: e.message };
      }
    },

    // ── Telegram via GAS proxy ─────────────────────────────
    async sendTelegram(text) {
      const url = this.getUrl();
      if (!url) return false;
      try {
        const r = await this._post(url, { action: 'telegram', text });
        return r.ok && r.data?.sent === true;
      } catch(e) { return false; }
    },

    // ── Snapshot ──────────────────────────────────────────
    _saveSnap(tool, snap) {
      try { localStorage.setItem(KEY + 'snap_' + tool, JSON.stringify({ ...snap, tool })); } catch(e) {}
    },
    getSnap(tool) {
      try { return JSON.parse(localStorage.getItem(KEY + 'snap_' + tool) || 'null'); }
      catch(e) { return null; }
    },

    // ── HTTP GET (no preflight) ────────────────────────────
    async _get(url) {
      const r = await Promise.race([
        fetch(url, { redirect: 'follow' }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout')), TIMEOUT)),
      ]);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    },

    // ── HTTP POST — KEY FIX: text/plain prevents CORS preflight
    async _post(url, body) {
      const r = await Promise.race([
        fetch(url, {
          method  : 'POST',
          redirect: 'follow',
          // ↓ 'text/plain' = simple request = no OPTIONS preflight
          // GAS receives via e.postData.contents — JSON.parse works fine
          headers : { 'Content-Type': 'text/plain' },
          body    : JSON.stringify(body),
        }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout')), TIMEOUT)),
      ]);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    },

    _yield() { return new Promise(r => setTimeout(r, 0)); },
  };

  global.HRA = global.HRA || {};
  global.HRA.Cloud = Cloud;
  Cloud.init();

})(window);
