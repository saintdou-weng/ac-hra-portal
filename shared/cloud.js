/* ═══════════════════════════════════════════════════════
   AC HRA Cloud Sync  shared/cloud.js  v1.2
   ─────────────────────────────────────────────────────
   CORS fix: POST must use 'text/plain;charset=utf-8'
   Any other Content-Type triggers preflight → GAS fails
   GET uses plain URL + redirect:'follow' only
═══════════════════════════════════════════════════════ */
(function(G){
'use strict';
const KEY = 'ac_hra_';
const CHUNK = 200;
const TIMEOUT = 28000;

const Cloud = {
  gasUrl: '',

  init() { this.gasUrl = localStorage.getItem(KEY+'gas_url') || ''; },
  setUrl(u) { this.gasUrl = (u||'').trim(); localStorage.setItem(KEY+'gas_url', this.gasUrl); },
  getUrl() { return this.gasUrl || localStorage.getItem(KEY+'gas_url') || ''; },

  async heartbeat() {
    const url = this.getUrl();
    if (!url) return {ok:false,error:'No GAS URL'};
    try {
      // GET only — no preflight issue
      const r = await this._get(url + '?action=heartbeat');
      return r.ok ? {ok:true} : {ok:false,error:r.error};
    } catch(e) { return {ok:false,error:e.message}; }
  },

  async status() {
    const url = this.getUrl();
    if (!url) return {ok:false,error:'No GAS URL'};
    try {
      const r = await this._get(url + '?action=status');
      if (!r.ok) return {ok:false,error:r.error};
      return {ok:true, ...r.data};
    } catch(e) { return {ok:false,error:e.message}; }
  },

  async push(tool, records, summary, onProgress) {
    const url = this.getUrl();
    if (!url) return {ok:false,error:'No GAS URL'};
    const arr   = Array.isArray(records) ? records : [records];
    const total = Math.ceil(arr.length / CHUNK) || 1;
    try {
      if (arr.length <= CHUNK) {
        if (onProgress) onProgress(50,1,1);
        const r = await this._post(url, {
          action:'push', tool, records:arr,
          recordCount:arr.length, totalChunks:1, chunk:0,
          summary:summary||{}, version:'1.0',
          updatedAt:new Date().toISOString(),
        });
        if (onProgress) onProgress(100,1,1);
        if (r.ok) this._saveSnap(tool,{recordCount:arr.length,timestamp:new Date().toISOString(),summary});
        return r;
      }
      // Chunked
      for (let i=0;i<total;i++) {
        const slice = arr.slice(i*CHUNK,(i+1)*CHUNK);
        if (onProgress) onProgress(Math.round(i/total*90),i+1,total);
        const r = await this._post(url, {
          action:'push', tool, records:slice,
          recordCount:arr.length, totalChunks:total, chunk:i,
          summary:i===total-1?(summary||{}):{}, version:'1.0',
          updatedAt:new Date().toISOString(),
        });
        if (!r.ok) return r;
        await this._tick();
      }
      if (onProgress) onProgress(100,total,total);
      this._saveSnap(tool,{recordCount:arr.length,timestamp:new Date().toISOString(),summary});
      return {ok:true,recordCount:arr.length};
    } catch(e) { return {ok:false,error:e.message}; }
  },

  async pull(tool, onProgress) {
    const url = this.getUrl();
    if (!url) return {ok:false,error:'No GAS URL'};
    try {
      if (onProgress) onProgress(10);
      const meta = await this._get(url + '?action=pull&tool=' + tool + '&meta=1');
      if (!meta.ok) return {ok:false,error:meta.error};
      const d = meta.data;
      if (d.data === null) return {ok:true,data:null,message:'尚無雲端資料'};
      if (!d.chunked) {
        if (onProgress) onProgress(100);
        return {ok:true, records:d.records||d.data?.records||[], data:d.data};
      }
      const chunks = d.meta?.totalChunks||1;
      const all = [];
      for (let i=0;i<chunks;i++) {
        if (onProgress) onProgress(Math.round(10+i/chunks*80));
        const r = await this._get(url + '?action=pull&tool=' + tool + '&chunk=' + i);
        if (!r.ok) return {ok:false,error:r.error};
        all.push(...(r.data?.records||[]));
        await this._tick();
      }
      if (onProgress) onProgress(100);
      return {ok:true, records:all, meta:d.meta};
    } catch(e) { return {ok:false,error:e.message}; }
  },

  // Send Telegram via GAS proxy
  async sendTG(text) {
    const url = this.getUrl();
    if (!url) return false;
    try {
      const r = await this._post(url, {action:'telegram', text});
      return r.ok && r.data?.sent;
    } catch(e) { return false; }
  },

  _saveSnap(tool,snap) { try{localStorage.setItem(KEY+'snap_'+tool,JSON.stringify({...snap,tool}));}catch(e){} },
  getSnap(tool) { try{return JSON.parse(localStorage.getItem(KEY+'snap_'+tool)||'null');}catch(e){return null;} },

  // GET — no preflight
  async _get(url) {
    const r = await Promise.race([
      fetch(url, { method:'GET', redirect:'follow' }),
      new Promise((_,rej)=>setTimeout(()=>rej(new Error('Timeout')),TIMEOUT)),
    ]);
    if (!r.ok) throw new Error('HTTP '+r.status);
    return r.json();
  },

  // POST — MUST use text/plain;charset=utf-8 to avoid OPTIONS preflight
  async _post(url, body) {
    const r = await Promise.race([
      fetch(url, {
        method  : 'POST',
        redirect: 'follow',
        headers : { 'Content-Type': 'text/plain;charset=utf-8' },
        body    : JSON.stringify(body),
      }),
      new Promise((_,rej)=>setTimeout(()=>rej(new Error('Timeout')),TIMEOUT)),
    ]);
    if (!r.ok) throw new Error('HTTP '+r.status);
    return r.json();
  },

  _tick() { return new Promise(r=>setTimeout(r,0)); },
};

G.HRA = G.HRA||{};
G.HRA.Cloud = Cloud;
Cloud.init();
})(window);
