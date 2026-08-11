/* ═══════════════════════════════════════════════════
   AC HRA Telegram Queue — shared/telegram.js v1.0
   All messages route through GAS to avoid CORS.
   Fallback: direct Telegram API.
   Usage:
     HRA.TG.push(text)
     HRA.TG.init()
     HRA.TG.setConfig(token, chatId)
═══════════════════════════════════════════════════ */
(function(global){
  'use strict';
  const TG_KEY     = 'ac_hra_tg';
  const RATE_MS    = 2500;   // min ms between sends
  const MAX_RETRY  = 3;
  const DEDUP_MS   = 60000;  // 60s dedup window
  const MAX_QUEUE  = 30;
  const TG_API     = 'https://api.telegram.org/bot';

  // Default VRT config (overridden by localStorage)
  const DEFAULTS = {
    token  : '8752977449:AAHOhEM0IWsFU5cTXRkwV4pgp68cYQh-1Sg',
    chatId : '-5233667043',
    enabled: true,
  };

  const TG = {
    queue   : [],
    sending : false,
    lastSent: 0,
    seen    : new Map(), // hash → timestamp
    cfg     : { ...DEFAULTS },

    init() {
      try {
        const saved = JSON.parse(localStorage.getItem(TG_KEY) || '{}');
        this.cfg = { ...DEFAULTS, ...saved };
      } catch(e) {}
    },

    setConfig(token, chatId, enabled) {
      this.cfg = { token: token || DEFAULTS.token, chatId: chatId || DEFAULTS.chatId, enabled: enabled !== false };
      localStorage.setItem(TG_KEY, JSON.stringify(this.cfg));
    },

    getConfig() { return { ...this.cfg }; },

    // ── Push a message to the queue ──
    push(text, opts) {
      if (!text || !this.cfg.enabled) return;
      const h = this._hash(text);
      // Deduplicate: skip if same content sent within DEDUP_MS
      const lastSeen = this.seen.get(h);
      if (lastSeen && Date.now() - lastSeen < DEDUP_MS) {
        HRA.Logger && HRA.Logger.log('TG', 'DEDUP skip: ' + text.slice(0, 40));
        return;
      }
      if (this.queue.length >= MAX_QUEUE) this.queue.shift();
      this.queue.push({ text, attempts: 0, id: h, ts: Date.now(), ...opts });
      this._schedFlush();
    },

    // ── Schedule flush ──
    _schedFlush() {
      if (this.sending) return;
      const delay = Math.max(0, RATE_MS - (Date.now() - this.lastSent));
      setTimeout(() => this._flush(), delay);
    },

    // ── Flush next item from queue ──
    async _flush() {
      if (this.sending || !this.queue.length) return;
      this.sending = true;
      const item = this.queue[0];

      const sent = await this._send(item.text);

      if (sent) {
        this.seen.set(item.id, Date.now());
        this.queue.shift();
        this.lastSent = Date.now();
        HRA.Logger && HRA.Logger.log('TG', 'SENT: ' + item.text.slice(0, 40));
      } else {
        item.attempts++;
        if (item.attempts >= MAX_RETRY) {
          this.queue.shift();
          HRA.Logger && HRA.Logger.log('TG', 'FAILED (max retry): ' + item.text.slice(0, 40), 'err');
        }
      }

      this.sending = false;
      if (this.queue.length) setTimeout(() => this._flush(), RATE_MS);
    },

    // ── Send one message (GAS proxy preferred) ──
    async _send(text) {
      // Try via GAS first (avoids CORS issues)
      const gasUrl = HRA.Cloud && HRA.Cloud.getUrl();
      if (gasUrl) {
        try {
          const r = await fetch(gasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'telegram', text }),
          });
          const d = await r.json();
          if (d.ok) return true;
        } catch(e) {}
      }
      // Fallback: direct API
      try {
        const r = await fetch(`${TG_API}${this.cfg.token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: this.cfg.chatId, text, parse_mode: 'HTML' }),
        });
        const d = await r.json();
        return d.ok === true;
      } catch(e) {
        return false;
      }
    },

    // ── Simple hash ──
    _hash(str) {
      let h = 0;
      for (let i = 0; i < Math.min(str.length, 120); i++) {
        h = Math.imul(31, h) + str.charCodeAt(i) | 0;
      }
      return h.toString(36);
    },

    // ── Queue status ──
    status() {
      return { queueLen: this.queue.length, sending: this.sending, enabled: this.cfg.enabled };
    },

    // ── Clear queue ──
    clear() { this.queue = []; this.sending = false; },

    // ── Test connection ──
    async test() {
      const txt = '✅ AC HRA 系統 — Telegram 連線測試\n🏭 Vantage River Textiles Co., Ltd.\n📅 ' + new Date().toLocaleString('zh-TW',{timeZone:'Asia/Phnom_Penh'});
      return this._send(txt);
    },
  };

  global.HRA = global.HRA || {};
  global.HRA.TG = TG;
  TG.init();

})(window);
