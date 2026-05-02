/* ═══════════════════════════════════════════════════
   AC HRA Shared Modules Bundle
   Includes: I18N · Logger · Settings · UI · Upload · Charts
   shared/hra-modules.js v1.0
═══════════════════════════════════════════════════ */
(function(global){
  'use strict';
  global.HRA = global.HRA || {};

  // ══════════════════════════════════════════════
  // I18N — Common strings shared by all tools
  // Each tool extends with: HRA.I18N.extend(module, {zh:{},en:{},km:{}})
  // ══════════════════════════════════════════════
  const I18N = {
    _dict: {
      zh: {
        // Common UI
        save:'儲存', cancel:'取消', edit:'編輯', delete:'刪除', add:'新增',
        confirm:'確認', close:'關閉', print:'列印', export:'匯出', import:'匯入',
        search:'搜尋', filter:'篩選', reset:'重置', refresh:'刷新',
        loading:'載入中…', noData:'無資料', all:'全部',
        // Cloud
        cloudPush:'上傳雲端', cloudPull:'從雲端拉取', cloudSync:'雲端同步',
        cloudSynced:'已同步', cloudSyncing:'同步中…', cloudFailed:'同步失敗',
        cloudOffline:'離線', cloudConflict:'資料衝突',
        cloudNoData:'雲端尚無資料', cloudSet:'GAS 已設定', cloudNotSet:'雲端未設定',
        pushSuccess:'上傳成功', pullSuccess:'拉取完成', syncError:'同步失敗',
        // Settings
        settingsTitle:'系統設定', gasUrl:'GAS 部署 URL', tgEnable:'啟用 Telegram',
        autoSync:'自動同步', autoPull:'自動拉取', syncInterval:'同步間隔（分鐘）',
        language:'語言', backup:'備份', exportData:'匯出資料',
        resetCache:'清除快取', version:'版本', debugMode:'偵錯模式',
        testTg:'測試 Telegram', saveSettings:'儲存設定',
        // Upload
        dropHere:'拖放檔案到這裡', dropExcel:'支援 .xlsx .xls .eml .msg',
        parsing:'解析中…', parseSuccess:'解析成功', parseFail:'解析失敗',
        importConfirm:'確認匯入', cancelImport:'取消',
        // Status
        active:'在職', terminated:'離職', pending:'待處理',
        approved:'已核准', rejected:'已拒絕',
        // Nav
        dashboard:'儀表板', records:'記錄', reports:'報表', settings:'設定',
        // Date
        today:'今天', thisWeek:'本週', thisMonth:'本月', thisYear:'本年度',
        prev:'上一個', next:'下一個',
        // Telegram
        sendReport:'發送報表', reportType:'報表類型',
        daily:'日報', weekly:'週報', monthly:'月報', yearly:'年報',
        tgSent:'已發送至 Telegram', tgFail:'Telegram 發送失敗',
        // Backup
        backupJson:'備份 JSON', restoreJson:'還原 JSON', clearAll:'清除所有資料',
      },
      en: {
        save:'Save', cancel:'Cancel', edit:'Edit', delete:'Delete', add:'Add',
        confirm:'Confirm', close:'Close', print:'Print', export:'Export', import:'Import',
        search:'Search', filter:'Filter', reset:'Reset', refresh:'Refresh',
        loading:'Loading…', noData:'No data', all:'All',
        cloudPush:'Push to Cloud', cloudPull:'Pull from Cloud', cloudSync:'Cloud Sync',
        cloudSynced:'Synced', cloudSyncing:'Syncing…', cloudFailed:'Sync Failed',
        cloudOffline:'Offline', cloudConflict:'Data Conflict',
        cloudNoData:'No cloud data yet', cloudSet:'GAS configured', cloudNotSet:'Not configured',
        pushSuccess:'Upload success', pullSuccess:'Pull complete', syncError:'Sync error',
        settingsTitle:'System Settings', gasUrl:'GAS Deployment URL', tgEnable:'Enable Telegram',
        autoSync:'Auto Sync', autoPull:'Auto Pull', syncInterval:'Sync interval (min)',
        language:'Language', backup:'Backup', exportData:'Export Data',
        resetCache:'Reset Cache', version:'Version', debugMode:'Debug Mode',
        testTg:'Test Telegram', saveSettings:'Save Settings',
        dropHere:'Drop files here', dropExcel:'Supports .xlsx .xls .eml .msg',
        parsing:'Parsing…', parseSuccess:'Parse success', parseFail:'Parse failed',
        importConfirm:'Confirm Import', cancelImport:'Cancel',
        active:'Active', terminated:'Terminated', pending:'Pending',
        approved:'Approved', rejected:'Rejected',
        dashboard:'Dashboard', records:'Records', reports:'Reports', settings:'Settings',
        today:'Today', thisWeek:'This Week', thisMonth:'This Month', thisYear:'This Year',
        prev:'Previous', next:'Next',
        sendReport:'Send Report', reportType:'Report Type',
        daily:'Daily', weekly:'Weekly', monthly:'Monthly', yearly:'Yearly',
        tgSent:'Sent to Telegram', tgFail:'Telegram send failed',
        backupJson:'Backup JSON', restoreJson:'Restore JSON', clearAll:'Clear All Data',
      },
      km: {
        save:'រក្សាទុក', cancel:'បោះបង់', edit:'កែ', delete:'លុប', add:'បន្ថែម',
        confirm:'បញ្ជាក់', close:'បិទ', print:'បោះពុម្ព', export:'នាំចេញ', import:'នាំចូល',
        search:'ស្វែងរក', filter:'ច្រោះ', reset:'កំណត់ឡើងវិញ', refresh:'ធ្វើឱ្យស្រស់',
        loading:'កំពុងផ្ទុក…', noData:'គ្មានទិន្នន័យ', all:'ទាំងអស់',
        cloudPush:'បញ្ចូលទៅ Cloud', cloudPull:'ទាញចេញពី Cloud', cloudSync:'ធ្វើសម្រួល Cloud',
        cloudSynced:'បានធ្វើសម្រួល', cloudSyncing:'កំពុងធ្វើសម្រួល…', cloudFailed:'ការធ្វើសម្រួលបានបរាជ័យ',
        cloudOffline:'គ្មានអ៊ីនធឺណិត', cloudConflict:'ទិន្នន័យខុសគ្នា',
        cloudNoData:'មិនទាន់មានទិន្នន័យ Cloud', cloudSet:'GAS បានកំណត់', cloudNotSet:'មិនទាន់កំណត់',
        pushSuccess:'បានបញ្ចូលដោយជោគជ័យ', pullSuccess:'ការទាញចេញបានជោគជ័យ', syncError:'ការធ្វើសម្រួលបានបរាជ័យ',
        settingsTitle:'ការកំណត់ប្រព័ន្ធ', gasUrl:'GAS URL', tgEnable:'បើក Telegram',
        autoSync:'ធ្វើសម្រួលស្វ័យប្រវត្តិ', autoPull:'ទាញចេញស្វ័យប្រវត្តិ', syncInterval:'រយៈពេលធ្វើសម្រួល (នាទី)',
        language:'ភាសា', backup:'ការបម្រុង', exportData:'នាំចេញទិន្នន័យ',
        resetCache:'សំអាតទិន្នន័យ', version:'កំណែ', debugMode:'របៀប Debug',
        testTg:'ស្ទង់ Telegram', saveSettings:'រក្សាទុកការកំណត់',
        dropHere:'ទម្លាក់ឯកសារទីនេះ', dropExcel:'គាំទ្រ .xlsx .xls .eml .msg',
        parsing:'កំពុងញែក…', parseSuccess:'ការញែកបានជោគជ័យ', parseFail:'ការញែកបានបរាជ័យ',
        importConfirm:'បញ្ជាក់ការនាំចូល', cancelImport:'បោះបង់',
        active:'កំពុងធ្វើការ', terminated:'បញ្ឈប់', pending:'រង់ចាំ',
        approved:'បានអនុម័ត', rejected:'បានបដិសេធ',
        dashboard:'ផ្ទាំងសង្ខេប', records:'កំណត់ត្រា', reports:'របាយការណ៍', settings:'ការកំណត់',
        today:'ថ្ងៃនេះ', thisWeek:'សប្តាហ៍នេះ', thisMonth:'ខែនេះ', thisYear:'ឆ្នាំនេះ',
        prev:'មុន', next:'បន្ទាប់',
        sendReport:'ផ្ញើរបាយការណ៍', reportType:'ប្រភេទ',
        daily:'ប្រចាំថ្ងៃ', weekly:'ប្រចាំសប្តាហ៍', monthly:'ប្រចាំខែ', yearly:'ប្រចាំឆ្នាំ',
        tgSent:'បានផ្ញើទៅ Telegram', tgFail:'ការផ្ញើ Telegram បានបរាជ័យ',
        backupJson:'បម្រុង JSON', restoreJson:'ស្ដារ JSON', clearAll:'លុបទិន្នន័យទាំងអស់',
      },
    },
    _current: 'zh',

    extend(/*module, */dict) {
      ['zh','en','km'].forEach(l => {
        if (dict[l]) Object.assign(this._dict[l], dict[l]);
      });
    },

    setLang(l) {
      this._current = l;
      localStorage.setItem('ac_hra_lang', l);
      this._apply();
    },

    getLang() {
      return this._current;
    },

    t(key) {
      return this._dict[this._current]?.[key] || this._dict.zh?.[key] || key;
    },

    _apply() {
      document.querySelectorAll('[data-i18n]').forEach(el => {
        const v = this.t(el.dataset.i18n);
        if (v) el.textContent = v;
      });
      document.querySelectorAll('[data-i18n-ph]').forEach(el => {
        const v = this.t(el.dataset.i18nPh);
        if (v) el.placeholder = v;
      });
    },

    init() {
      const saved = localStorage.getItem('ac_hra_lang') || 'zh';
      this._current = saved;
    },
  };

  // ══════════════════════════════════════════════
  // LOGGER
  // ══════════════════════════════════════════════
  const Logger = {
    _logs: [],
    MAX: 100,

    log(type, msg, level) {
      const entry = { type, msg, level: level || 'info', ts: new Date().toISOString() };
      this._logs.unshift(entry);
      if (this._logs.length > this.MAX) this._logs.pop();
      // Persist last 20 to localStorage
      try { localStorage.setItem('ac_hra_log', JSON.stringify(this._logs.slice(0, 20))); } catch(e) {}
      this._updateUI(entry);
    },

    getLogs() { return this._logs; },

    init() {
      try {
        const saved = JSON.parse(localStorage.getItem('ac_hra_log') || '[]');
        this._logs = saved;
      } catch(e) {}
    },

    _updateUI(entry) {
      const el = document.getElementById('hra-event-log');
      if (!el) return;
      const cls = entry.level === 'err' ? 'err' : entry.level === 'warn' ? 'warn'
                : entry.type.includes('TG') ? 'info' : entry.type.includes('PUSH') || entry.type.includes('PULL') ? 'ok' : '';
      const ts = entry.ts.slice(11, 16);
      const line = document.createElement('div');
      line.className = 'll ' + cls;
      line.textContent = `${ts} [${entry.type}] ${entry.msg}`;
      el.prepend(line);
      while (el.children.length > 20) el.removeChild(el.lastChild);
    },
  };

  // ══════════════════════════════════════════════
  // SETTINGS
  // ══════════════════════════════════════════════
  const Settings = {
    KEY: 'ac_hra_settings',
    _defaults: {
      autoSync: true, autoPull: true, syncInterval: 30,
      tgEnable: true, debug: false, theme: 'light',
    },
    _data: {},

    init() {
      try { this._data = { ...this._defaults, ...JSON.parse(localStorage.getItem(this.KEY) || '{}') }; }
      catch(e) { this._data = { ...this._defaults }; }
    },

    get(key) { return this._data[key] ?? this._defaults[key]; },

    set(key, val) {
      this._data[key] = val;
      this._save();
    },

    setAll(obj) {
      this._data = { ...this._data, ...obj };
      this._save();
    },

    _save() {
      try { localStorage.setItem(this.KEY, JSON.stringify(this._data)); } catch(e) {}
    },

    // Render settings form into an element
    renderForm(containerId) {
      const el = document.getElementById(containerId);
      if (!el) return;
      const t = key => HRA.I18N.t(key);
      el.innerHTML = `
      <div class="form-grid" style="margin-bottom:14px">
        <div class="form-group full">
          <label class="form-label">GAS URL</label>
          <input class="form-input" id="cfg-gas-url" type="text" style="font-family:var(--f-mono)" value="${HRA.Cloud.getUrl()}" placeholder="https://script.google.com/macros/s/…/exec">
        </div>
        <div class="form-group">
          <label class="form-label">Bot Token (Telegram)</label>
          <input class="form-input" id="cfg-tg-token" type="password" value="${HRA.TG.cfg.token}">
        </div>
        <div class="form-group">
          <label class="form-label">Chat ID</label>
          <input class="form-input" id="cfg-tg-chatid" value="${HRA.TG.cfg.chatId}">
        </div>
        <div class="form-group">
          <label class="form-label">${t('syncInterval')} (min)</label>
          <input class="form-input" id="cfg-sync-int" type="number" min="5" max="120" value="${this.get('syncInterval')}">
        </div>
        <div class="form-group">
          <label class="form-label">${t('language')}</label>
          <select class="form-input" id="cfg-lang">
            <option value="zh" ${HRA.I18N.getLang()==='zh'?'selected':''}>中文</option>
            <option value="en" ${HRA.I18N.getLang()==='en'?'selected':''}>English</option>
            <option value="km" ${HRA.I18N.getLang()==='km'?'selected':''}>ខ្មែរ</option>
          </select>
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
          <input type="checkbox" id="cfg-auto-sync" ${this.get('autoSync')?'checked':''}> ${t('autoSync')}
        </label>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
          <input type="checkbox" id="cfg-auto-pull" ${this.get('autoPull')?'checked':''}> ${t('autoPull')}
        </label>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
          <input type="checkbox" id="cfg-tg-enable" ${this.get('tgEnable')?'checked':''}> ${t('tgEnable')}
        </label>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
          <input type="checkbox" id="cfg-debug" ${this.get('debug')?'checked':''}> ${t('debugMode')}
        </label>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" onclick="HRA.Settings.saveForm()">💾 ${t('saveSettings')}</button>
        <button class="btn btn-ghost btn-sm" onclick="HRA.TG.test().then(ok=>HRA.UI.toast(ok?'✅ Telegram OK':'❌ Telegram 失敗',ok?'ok':'err'))">📱 ${t('testTg')}</button>
        <button class="btn btn-ghost btn-sm" onclick="HRA.Cloud.heartbeat().then(r=>HRA.UI.toast(r.ok?'✅ GAS OK':'❌ '+r.error,r.ok?'ok':'err'))">🔌 Test GAS</button>
      </div>`;
    },

    saveForm() {
      const gasUrl = document.getElementById('cfg-gas-url')?.value.trim();
      const token  = document.getElementById('cfg-tg-token')?.value.trim();
      const chatId = document.getElementById('cfg-tg-chatid')?.value.trim();
      const lang   = document.getElementById('cfg-lang')?.value;
      if (gasUrl && gasUrl.startsWith('https://')) HRA.Cloud.setUrl(gasUrl);
      if (token && chatId) HRA.TG.setConfig(token, chatId);
      if (lang) HRA.I18N.setLang(lang);
      this.setAll({
        syncInterval: parseInt(document.getElementById('cfg-sync-int')?.value) || 30,
        autoSync    : document.getElementById('cfg-auto-sync')?.checked,
        autoPull    : document.getElementById('cfg-auto-pull')?.checked,
        tgEnable    : document.getElementById('cfg-tg-enable')?.checked,
        debug       : document.getElementById('cfg-debug')?.checked,
      });
      HRA.TG.cfg.enabled = this.get('tgEnable');
      HRA.UI.toast('✅ 設定已儲存', 'ok');
      // Refresh UI sync indicator
      HRA.UI.syncStatus('idle', '');
      Logger.log('SETTINGS', 'Settings saved');
    },
  };

  // ══════════════════════════════════════════════
  // UI — toast, sync indicator, progress, modal
  // ══════════════════════════════════════════════
  const UI = {
    // Ensure toast container
    _ensureContainer() {
      if (!document.getElementById('hra-toasts')) {
        const d = document.createElement('div');
        d.id = 'hra-toasts';
        document.body.appendChild(d);
      }
    },

    toast(msg, type, duration) {
      this._ensureContainer();
      const el = document.createElement('div');
      el.className = 'hra-toast ' + (type || 'info');
      el.textContent = msg;
      document.getElementById('hra-toasts').appendChild(el);
      setTimeout(() => el.remove(), duration || 4000);
    },

    // Sync indicator (updates .sync-dot + text)
    syncStatus(state, label) {
      const dots = document.querySelectorAll('.sync-dot');
      const lbls = document.querySelectorAll('.sync-lbl');
      const stateMap = {
        idle    : HRA.Cloud.getUrl() ? HRA.I18N.t('cloudSet') : HRA.I18N.t('cloudNotSet'),
        syncing : HRA.I18N.t('cloudSyncing'),
        synced  : HRA.I18N.t('cloudSynced'),
        failed  : HRA.I18N.t('cloudFailed'),
        offline : HRA.I18N.t('cloudOffline'),
        conflict: HRA.I18N.t('cloudConflict'),
      };
      dots.forEach(d => { d.className = 'sync-dot ' + state; });
      lbls.forEach(l => { l.textContent = label || stateMap[state] || state; });
      // Also update sidebar dot
      const sbDot = document.getElementById('sb-gas-dot');
      const sbLbl = document.getElementById('sb-gas-lbl');
      if (sbDot) sbDot.className = 'sb-gas-dot ' + (state === 'synced' ? 'ok' : state === 'failed' ? 'err' : '');
      if (sbLbl) sbLbl.textContent = label || stateMap[state] || '';
    },

    // Progress bar
    progress(pct, show, barId) {
      const bar  = document.getElementById(barId || 'hra-prog');
      const fill = document.getElementById((barId || 'hra-prog') + '-fill');
      if (!bar) return;
      if (show !== undefined) bar.classList[show ? 'add' : 'remove']('active');
      if (fill) fill.style.width = pct + '%';
    },

    // Format timestamp
    fmtTs(ts, short) {
      if (!ts) return '—';
      try {
        const opts = short
          ? { timeZone:'Asia/Phnom_Penh', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }
          : { timeZone:'Asia/Phnom_Penh', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' };
        return new Date(ts).toLocaleString('zh-TW', opts);
      } catch(e) { return ts.slice(0, 16); }
    },

    // Days until date
    daysUntil(dateStr) {
      if (!dateStr) return null;
      return Math.ceil((new Date(dateStr) - new Date(new Date().toDateString())) / 86400000);
    },

    // Confirm dialog
    confirm(msg) { return window.confirm(msg); },

    // Modal open/close
    openModal(id) { const m = document.getElementById(id); if (m) m.classList.add('open'); },
    closeModal(id) { const m = document.getElementById(id); if (m) m.classList.remove('open'); },
  };

  // ══════════════════════════════════════════════
  // UPLOAD ENGINE
  // Handles .xlsx .xls .eml .msg via drag/drop
  // ══════════════════════════════════════════════
  const Upload = {
    _files: [],
    _callbacks: {},

    // Initialize a drop zone
    init(dropId, listId, callbacks) {
      this._callbacks[dropId] = callbacks || {};
      const dz = document.getElementById(dropId);
      if (!dz) return;
      dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag'); });
      dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
      dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('drag'); this.addFiles(dropId, listId, e.dataTransfer.files); });
      const inp = dz.querySelector('input[type=file]');
      if (inp) inp.addEventListener('change', e => this.addFiles(dropId, listId, e.target.files));
    },

    addFiles(dropId, listId, files) {
      Array.from(files).forEach(f => {
        if (!this._files.find(x => x.name === f.name && x.size === f.size)) {
          this._files.push({ file: f, status: 'pending', dropId });
        }
      });
      this._renderList(listId);
      const cb = this._callbacks[dropId];
      if (cb && cb.onAdd) cb.onAdd(this._files.filter(x => x.dropId === dropId));
    },

    clear(dropId, listId) {
      this._files = this._files.filter(x => x.dropId !== dropId);
      this._renderList(listId);
    },

    _renderList(listId) {
      const el = document.getElementById(listId);
      if (!el) return;
      el.innerHTML = this._files.map((f, i) => {
        const isEmail = /\.(eml|msg)$/i.test(f.file.name);
        const icon = f.status === 'done' ? '✅' : f.status === 'fail' ? '❌' : isEmail ? '📧' : '📊';
        const cls  = f.status === 'done' ? 'ok' : f.status === 'fail' ? 'err' : '';
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid var(--c-border2);font-size:12px">
          <span>${icon} <span style="color:${cls==='ok'?'#059669':cls==='err'?'#dc2626':'#374151'}">${f.file.name}</span> <span style="color:var(--c-light);font-size:10px">(${(f.file.size/1024).toFixed(0)}KB)</span></span>
          <button onclick="HRA.Upload._removeFile(${i},'${listId}')" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:16px;line-height:1">×</button>
        </div>`;
      }).join('');
    },

    _removeFile(i, listId) {
      this._files.splice(i, 1);
      this._renderList(listId);
    },

    getFiles(dropId) {
      return this._files.filter(x => x.dropId === dropId).map(x => x.file);
    },

    setStatus(filename, status, listId) {
      const f = this._files.find(x => x.file.name === filename);
      if (f) f.status = status;
      if (listId) this._renderList(listId);
    },

    // Parse Excel → [{col:val}, …]
    async parseExcel(file, headerRow) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => {
          try {
            const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
            const hdrIdx = headerRow != null ? headerRow : 0;
            const headers = data[hdrIdx] || [];
            const rows = data.slice(hdrIdx + 1).filter(r => r.some(c => c !== ''));
            resolve({ headers, rows, wb, ws });
          } catch(err) { reject(err); }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      });
    },

    // Extract Excel from .eml
    async extractFromEml(file) {
      const text = await file.text();
      const results = [];
      const bRe = /boundary=["]?([^"\r\n;\s]+)["]?/gi;
      const bs = []; let bm;
      while ((bm = bRe.exec(text)) !== null) bs.push(bm[1]);
      for (const b of [...new Set(bs)]) {
        for (const part of text.split('--' + b)) {
          if (!/filename[^"\r\n]*\.xlsx?/i.test(part)) continue;
          let fn = 'file.xlsx';
          const fm = part.match(/filename[^"\r\n;]*?["]?([^"\r\n;]+\.xlsx?)["]?/i);
          if (fm) fn = fm[1].trim();
          const bmp = part.match(/\r?\n\r?\n([\s\S]+?)(?:--|[\s]*$)/);
          if (!bmp) continue;
          const b64 = bmp[1].replace(/[\r\n\s]/g, '');
          if (b64.length < 100) continue;
          try {
            const bin = atob(b64);
            const by = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) by[i] = bin.charCodeAt(i);
            if (by[0] === 0x50 && by[1] === 0x4B) results.push({ name: fn, data: by });
          } catch(e) {}
        }
      }
      return results;
    },
  };

  // ══════════════════════════════════════════════
  // CHARTS — destroy/recreate wrapper
  // ══════════════════════════════════════════════
  const Charts = {
    _instances: {},

    make(id, config) {
      if (this._instances[id]) { try { this._instances[id].destroy(); } catch(e) {} }
      const el = document.getElementById(id);
      if (!el) return null;
      const chart = new Chart(el, config);
      this._instances[id] = chart;
      return chart;
    },

    destroy(id) {
      if (this._instances[id]) {
        try { this._instances[id].destroy(); } catch(e) {}
        delete this._instances[id];
      }
    },

    destroyAll() {
      Object.keys(this._instances).forEach(id => this.destroy(id));
    },

    // Common chart options
    lineOpts(yLabel, minY) {
      return {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { font: { size: 10 } } } },
        scales: {
          y: { min: minY, ticks: { callback: v => yLabel ? v + yLabel : v, font: { size: 10 } } },
          x: { ticks: { font: { size: 10 } } },
        },
      };
    },

    barOpts(horizontal) {
      return {
        indexAxis: horizontal ? 'y' : 'x',
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { ticks: { font: { size: 10 } } }, y: { ticks: { font: { size: 10 } } } },
      };
    },

    doughnutOpts() {
      return {
        cutout: '55%', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { font: { size: 10 } } } },
      };
    },
  };

  // ══════════════════════════════════════════════
  // SYNC MANAGER — auto-push/pull with indicator
  // ══════════════════════════════════════════════
  const Sync = {
    _tool: '',
    _timer: null,
    _getDataFn: null,
    _onPullFn: null,

    init(tool, getDataFn, onPullFn) {
      this._tool = tool;
      this._getDataFn = getDataFn;
      this._onPullFn = onPullFn;
      // Auto-pull on load if GAS configured and no local data
      if (HRA.Cloud.getUrl() && Settings.get('autoPull')) {
        setTimeout(() => this.pull(true), 1500);
      }
      // Check cloud version
      if (HRA.Cloud.getUrl()) {
        setTimeout(() => this._checkVersion(), 3000);
      }
    },

    schedPush() {
      clearTimeout(this._timer);
      if (!HRA.Cloud.getUrl() || !Settings.get('autoSync')) return;
      const ms = Settings.get('syncInterval') * 60 * 1000;
      this._timer = setTimeout(() => this.push(), Math.min(ms, 45000));
    },

    async push() {
      if (!HRA.Cloud.getUrl()) { HRA.UI.toast(HRA.I18N.t('cloudNotSet'), 'warn'); return; }
      const { records, summary } = this._getDataFn();
      UI.syncStatus('syncing', '');
      UI.progress(0, true);
      const r = await HRA.Cloud.push(this._tool, records, summary, pct => UI.progress(pct));
      UI.progress(100);
      setTimeout(() => UI.progress(0, false), 2000);
      if (r.ok) {
        UI.syncStatus('synced', UI.fmtTs(new Date().toISOString(), true));
        UI.toast('✅ ' + HRA.I18N.t('pushSuccess') + ' — ' + records.length + ' 筆', 'ok');
        Logger.log('PUSH', `${this._tool}: ${records.length} records`);
        HRA.TG.push(`✅ AC HRA ${this._tool} 上傳成功\\n📋 ${records.length} 筆\\n⏱ ${UI.fmtTs(new Date().toISOString(), true)}`);
      } else {
        UI.syncStatus('failed', '');
        UI.toast('❌ ' + HRA.I18N.t('syncError') + ': ' + (r.error || ''), 'err');
        Logger.log('PUSH', `${this._tool} failed: ` + r.error, 'err');
      }
    },

    async pull(silent) {
      if (!HRA.Cloud.getUrl()) { if (!silent) UI.toast(HRA.I18N.t('cloudNotSet'), 'warn'); return; }
      UI.syncStatus('syncing', '');
      UI.progress(0, true);
      const r = await HRA.Cloud.pull(this._tool, pct => UI.progress(pct));
      UI.progress(100);
      setTimeout(() => UI.progress(0, false), 2000);
      if (!r.ok) {
        if (!silent) { UI.syncStatus('failed', ''); UI.toast('❌ ' + r.error, 'err'); }
        return;
      }
      if (r.data === null || (!r.records && !r.data)) {
        UI.syncStatus('idle', '');
        if (!silent) UI.toast('☁️ ' + HRA.I18N.t('cloudNoData'), 'info');
        return;
      }
      const records = r.records || r.data?.records || r.data || [];
      if (this._onPullFn) this._onPullFn(records, r.meta);
      UI.syncStatus('synced', UI.fmtTs(new Date().toISOString(), true));
      if (!silent) UI.toast('✅ ' + HRA.I18N.t('pullSuccess'), 'ok');
      Logger.log('PULL', `${this._tool}: received data`);
    },

    async _checkVersion() {
      const r = await HRA.Cloud.status();
      if (!r.ok || !r[this._tool]) return;
      const snap = r[this._tool];
      UI.syncStatus('synced', UI.fmtTs(snap.timestamp, true));
    },
  };

  // Assign to global
  global.HRA.I18N     = I18N;
  global.HRA.Logger   = Logger;
  global.HRA.Settings = Settings;
  global.HRA.UI       = UI;
  global.HRA.Upload   = Upload;
  global.HRA.Charts   = Charts;
  global.HRA.Sync     = Sync;

  // Init all
  I18N.init();
  Logger.init();
  Settings.init();

})(window);
