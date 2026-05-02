/* ═══════════════════════════════════════════════════════
   AC HRA i18n Patch  shared/hra-i18n-patch.js
   ─────────────────────────────────────────────────────
   使用方式：
   1. 每個 HTML 的按鈕/標題加上 data-i18n="key"
   2. 呼叫 I18N.apply() 就會全部替換
   3. 不動原本 HTML 結構

   data-i18n="save"     → 替換 textContent
   data-i18n-ph="search" → 替換 placeholder
   data-i18n-title="edit" → 替換 title 屬性
═══════════════════════════════════════════════════════ */
(function(G){
'use strict';

const DICT = {
  zh:{
    // Nav
    dashboard:'儀表板', records:'記錄', settings:'設定', reports:'報表通報',
    probation:'試用期', expiring:'到期預警', import:'匯入', export:'匯出',
    // Actions
    save:'儲存', cancel:'取消', edit:'編輯', delete:'刪除', add:'新增',
    confirm:'確認', close:'關閉', search:'搜尋', reset:'重置', refresh:'刷新',
    open:'開啟', push:'⬆ Push', pull:'⬇ Pull',
    // Cloud
    cloudNotSet:'雲端未設定', cloudSynced:'已同步', cloudSyncing:'同步中…',
    cloudFailed:'同步失敗', cloudNoData:'雲端尚無資料',
    // Status
    active:'在職', terminated:'離職', pending:'待處理', approved:'已核准', rejected:'已拒絕',
    // Date
    today:'今天', thisWeek:'本週', thisMonth:'本月', thisYear:'本年度',
    prev:'上個月', next:'下個月',
    // TG
    sendReport:'發送報表', tgSent:'已發送', tgFail:'發送失敗', testTg:'測試 Telegram',
    // Settings
    gasUrl:'GAS 部署 URL', syncInterval:'同步間隔（分鐘）', language:'語言',
    autoSync:'自動同步', autoPull:'自動拉取', saveSettings:'儲存設定',
    debugMode:'偵錯模式', tgEnable:'啟用 Telegram',
    // Upload
    dropHere:'拖放檔案到這裡', parsing:'解析中…', importConfirm:'確認匯入',
    // Loading
    loading:'載入中…', noData:'尚無資料',
    // Misc
    all:'全部', filter:'篩選',
  },
  en:{
    dashboard:'Dashboard', records:'Records', settings:'Settings', reports:'Reports',
    probation:'Probation', expiring:'Expiring', import:'Import', export:'Export',
    save:'Save', cancel:'Cancel', edit:'Edit', delete:'Delete', add:'Add',
    confirm:'Confirm', close:'Close', search:'Search', reset:'Reset', refresh:'Refresh',
    open:'Open', push:'⬆ Push', pull:'⬇ Pull',
    cloudNotSet:'Not configured', cloudSynced:'Synced', cloudSyncing:'Syncing…',
    cloudFailed:'Sync failed', cloudNoData:'No cloud data',
    active:'Active', terminated:'Terminated', pending:'Pending', approved:'Approved', rejected:'Rejected',
    today:'Today', thisWeek:'This Week', thisMonth:'This Month', thisYear:'This Year',
    prev:'Prev', next:'Next',
    sendReport:'Send Report', tgSent:'Sent', tgFail:'Send failed', testTg:'Test Telegram',
    gasUrl:'GAS Deployment URL', syncInterval:'Sync interval (min)', language:'Language',
    autoSync:'Auto Sync', autoPull:'Auto Pull', saveSettings:'Save Settings',
    debugMode:'Debug Mode', tgEnable:'Enable Telegram',
    dropHere:'Drop files here', parsing:'Parsing…', importConfirm:'Confirm Import',
    loading:'Loading…', noData:'No data',
    all:'All', filter:'Filter',
  },
  km:{
    dashboard:'ផ្ទាំងសង្ខេប', records:'កំណត់ត្រា', settings:'ការកំណត់', reports:'របាយការណ៍',
    probation:'សាកល្បង', expiring:'ជិតផុត', import:'នាំចូល', export:'នាំចេញ',
    save:'រក្សាទុក', cancel:'បោះបង់', edit:'កែ', delete:'លុប', add:'បន្ថែម',
    confirm:'បញ្ជាក់', close:'បិទ', search:'ស្វែងរក', reset:'កំណត់ឡើងវិញ', refresh:'ធ្វើឱ្យស្រស់',
    open:'បើក', push:'⬆ Push', pull:'⬇ Pull',
    cloudNotSet:'មិនទាន់កំណត់', cloudSynced:'បានធ្វើ Sync', cloudSyncing:'កំពុង Sync…',
    cloudFailed:'Sync បានបរាជ័យ', cloudNoData:'មិនទាន់មានទិន្នន័យ',
    active:'កំពុងធ្វើការ', terminated:'បញ្ឈប់', pending:'រង់ចាំ', approved:'បានអនុម័ត', rejected:'បានបដិសេធ',
    today:'ថ្ងៃនេះ', thisWeek:'សប្តាហ៍នេះ', thisMonth:'ខែនេះ', thisYear:'ឆ្នាំនេះ',
    prev:'មុន', next:'បន្ទាប់',
    sendReport:'ផ្ញើរបាយការណ៍', tgSent:'បានផ្ញើ', tgFail:'ផ្ញើបរាជ័យ', testTg:'ស្ទង់ Telegram',
    gasUrl:'GAS URL', syncInterval:'រយៈពេល Sync (នាទី)', language:'ភាសា',
    autoSync:'Auto Sync', autoPull:'Auto Pull', saveSettings:'រក្សាទុកការកំណត់',
    debugMode:'Debug Mode', tgEnable:'បើក Telegram',
    dropHere:'ទម្លាក់ឯកសារទីនេះ', parsing:'កំពុងញែក…', importConfirm:'បញ្ជាក់ការនាំចូល',
    loading:'កំពុងផ្ទុក…', noData:'គ្មានទិន្នន័យ',
    all:'ទាំងអស់', filter:'ច្រោះ',
  },
};

const I18N = {
  _lang: localStorage.getItem('ac_hra_lang') || 'zh',

  t(key) {
    return DICT[this._lang]?.[key] || DICT.zh?.[key] || key;
  },

  setLang(l) {
    this._lang = l;
    localStorage.setItem('ac_hra_lang', l);
    this.apply();
  },

  getLang() { return this._lang; },

  // Apply translations to all data-i18n elements
  apply() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const v = this.t(el.dataset.i18n);
      if (v) el.textContent = v;
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
      const v = this.t(el.dataset.i18nPh);
      if (v) el.placeholder = v;
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const v = this.t(el.dataset.i18nTitle);
      if (v) el.title = v;
    });
    // Update lang buttons
    document.querySelectorAll('[data-lang-btn]').forEach(el => {
      el.classList.toggle('on', el.dataset.langBtn === this._lang);
    });
    // Fire custom event so each tool can handle its own strings
    document.dispatchEvent(new CustomEvent('hra:langchange', { detail: this._lang }));
  },

  // Helper: generate lang toggle buttons HTML
  // Insert where you want the toggle:
  // container.innerHTML = I18N.toggleHTML();
  toggleHTML() {
    return `
      <button data-lang-btn="zh" onclick="HRA.I18N.setLang('zh')" class="hra-lb${this._lang==='zh'?' on':''}">中</button>
      <button data-lang-btn="en" onclick="HRA.I18N.setLang('en')" class="hra-lb${this._lang==='en'?' on':''}">EN</button>
      <button data-lang-btn="km" onclick="HRA.I18N.setLang('km')" class="hra-lb${this._lang==='km'?' on':''}">ខ្មែរ</button>
    `;
  },
};

// Init on load
document.addEventListener('DOMContentLoaded', () => I18N.apply());

G.HRA = G.HRA || {};
G.HRA.I18N = I18N;

})(window);
