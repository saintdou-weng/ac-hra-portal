/* ═══════════════════════════════════════════════════════════════════════
   AC-HRA-PAY BOT — 統一 GAS 後端 v2.3（2026-08-04）
   Platform : AC-HRA-PAY（Excel Driven HR & Payroll Analysis Platform）
   Bot      : @psjweng_bot  │ Group : AI HR Pay relate (-5289931698)
   Pages    : https://saintdou-weng.github.io/ac-hra-pay/
   ─────────────────────────────────────────────────────────────────────
   v2.0 新增（v1.0 全部功能原封不動保留）
   A. 所有摘要／通知底部自動附「平台概況 Dashboard」
   B. 兩關核可（全模組通用）
        👀 審查通過 / ↩ 退回 — 群組第一關
        ✅ 核可 / ❌ 退件 — 只有 Paul（第二關）
        全程留在群組，不私訊 Paul、不允許略過審查
   C. 核可通過自動產生 Google Sheet，回貼 Excel／PDF／線上檢視 三個連結
   D. 異常報告：超預算 / 逾期未核 / 異常調薪 / 高頻異動
        指令 /anomaly、每日自動推送 dailyAnomaly、POST {type:'anomalyReport'}
   E. 新指令 /dashboard、/pending
   ─────────────────────────────────────────────────────────────────────
   ★ 部署步驟
   1. 建立獨立 GAS 專案，命名 AC_HRA_PAY_BOT，貼上本檔（單一檔案，不需其他檔）
   2. 修改下方 SETUP_TOKEN 為 @psjweng_bot 的 Bot Token
   3. 執行一次 setupAll()（寫入 Script Properties＋刪 webhook＋建輪詢觸發器
      ＋註冊 Bot 指令選單＋初始化 Sheets＋建每日異常觸發）
   4. 部署 → 網頁應用程式 → 以我身分執行 / 任何人可存取 → 複製 /exec URL
   5. 將 /exec URL 貼到各 HTML 的 GAS URL 設定
   ★ 每次「重新部署」後：只需重新部署即可（輪詢觸發器不受影響，
      不像 webhook 需要重綁）。若觸發器消失，重跑 ensureTrigger()。
   ★ 從 v1.0 升級：直接整支覆蓋即可。Approvals 分頁會自動補上新欄位，
      舊資料不受影響。
═══════════════════════════════════════════════════════════════════════ */

/* ─── 一次性設定：先填 Token，再執行 setupAll() ─── */
/* Keep the bot token in Script Properties, never in a delivered source file.
   Existing deployments retain their BOT_TOKEN property. */
const SETUP_TOKEN = '';

function setupAll() {
  const props = PropertiesService.getScriptProperties();
  if (SETUP_TOKEN && SETUP_TOKEN.indexOf('PASTE_') !== 0) {
    props.setProperty('BOT_TOKEN', SETUP_TOKEN);
  }
  props.setProperties({
    BOT_USERNAME : 'psjweng_bot',
    GROUP_ID     : '-5289931698',
    PROJECT_NAME : 'AC-HRA-PAY',
    BASE_URL     : 'https://saintdou-weng.github.io/ac-hra-pay',
    ADMIN_ID     : '5026942575',          // Paul — 唯一核可人
    WARN_TERMINATE_COUNT : '3',
    WARN_MONTHS_Verbal  : '3',
    WARN_MONTHS_Small   : '6',
    WARN_MONTHS_Medium  : '6',
    WARN_MONTHS_Big     : '12',
    WARN_MONTHS_Final   : '12',
    WARN_MONTHS_Suspend : '12',
    HRA_PORTAL_GAS_URL : HRA_PORTAL_GAS_FALLBACK,
  });
  try { UrlFetchApp.fetch(TG() + '/deleteWebhook', { muteHttpExceptions: true }); } catch (e) {}
  ensureTrigger();
  ensureAnomalyTrigger();
  ensureMonthlyCompletenessTrigger();
  registerBotCommands();
  initSheets();
  tgSend(CFG().GROUP_ID, '✅ <b>AC-HRA-PAY Bot v2.9 已啟動</b>\n輸入 /hrpay 開啟控制面板' + dashboardBlock());
  console.log('setupAll 完成');
}

/* ─── 設定讀取 ─── */
function CFG() {
  const p = PropertiesService.getScriptProperties();
  return {
    BOT_TOKEN : p.getProperty('BOT_TOKEN') || SETUP_TOKEN || '',
    GROUP_ID  : p.getProperty('GROUP_ID')  || '-5289931698',
    BASE_URL  : p.getProperty('BASE_URL')  || 'https://saintdou-weng.github.io/ac-hra-pay',
    ADMIN_ID  : p.getProperty('ADMIN_ID')  || '5026942575',
    TZ        : 'Asia/Phnom_Penh',
    FOLDER    : 'AC_HRA_PAY_Data',
    SS_NAME   : 'AC-HRA-PAY 資料庫',
  };
}
const TG = () => 'https://api.telegram.org/bot' + CFG().BOT_TOKEN;

/* ─── v2 參數（要調門檻改這裡就好）─── */
const V2 = {
  REVIEW_OPEN      : true,   // true = 群組任何人都能按「審查通過」
  APPEND_DASHBOARD : true,   // 摘要底部是否自動附平台概況
  AUTO_DOC         : true,   // 核可通過是否自動產生可下載文件
  OVERDUE_DAYS     : 3,      // 送核超過幾天算逾期未核
  ADJ_ALERT        : 100,    // 單筆調薪超過此金額算異常（USD）
  ADJ_PCT          : 0.5,    // 或調幅超過 50%
  MOVE_ALERT       : 3,      // 同一員工在觀察窗內異動幾次算高頻
  MOVE_WINDOW      : 180,    // 觀察窗天數
};

/* 平台模組 */
const MODULES = [
  { key:'payroll',  file:'payroll.html',        icon:'💵', tc:'薪資 Payroll' },
  { key:'meal',     file:'meal_fee.html',       icon:'🍱', tc:'餐費 Meal Fee' },
  { key:'advance',  file:'advance_pay.html',    icon:'💰', tc:'預支 Advance' },
  { key:'transfer', file:'transfer.html',       icon:'🔄', tc:'職位異動 Transfer' },
  { key:'employee', file:'employee_hr.html',    icon:'👥', tc:'員工 HR' },
  { key:'shutdown', file:'shutdown.html',       icon:'🛑', tc:'停工 Shutdown' },
  { key:'otbonus',  file:'ot_bonus.html',       icon:'⏱', tc:'OT & Bonus' },
  { key:'summary',  file:'summary_center.html', icon:'📊', tc:'總覽 Summary' },
  { key:'warning',  file:'warning.html',        icon:'⚠️', tc:'警告 Warning' },
];
const SYNC_TOOLS = ['payroll','meal','advance','hr','transfer','employee','shutdown','otbonus','summary','warning'];

/* ═══════════════════════════════════════════════════════════════════════
   v2.9 人員標示：所有網頁摘要必須有檢查人；所有核可必須有申請人
   中英文固定同時顯示，避免切換語言後 Telegram 缺一種語言。
═══════════════════════════════════════════════════════════════════════ */
function actorLine(kind, name) {
  name = escapeHtml(String(name || '').trim());
  if (!name) return '';
  return kind === 'applicant'
    ? '📝 <b>申請人 Applicant：</b>' + name
    : '🔎 <b>檢查人 Checked by：</b>' + name;
}
function ensureActorLine(text, kind, name) {
  text = String(text || '');
  name = String(name || '').trim();
  if (!name) return text;
  const token = kind === 'applicant' ? '申請人 Applicant' : '檢查人 Checked by';
  if (text.indexOf(token) >= 0) return text;
  return text + '\n\n' + actorLine(kind, name);
}

/* ═══════════════════════════════════════════════════════════════════════
   doPost — JSON（text/plain）與 urlencoded（shutdown）雙協定
═══════════════════════════════════════════════════════════════════════ */
function doPost(e) {
  try {
    const raw = (e && e.postData && e.postData.contents) || '';
    let payload = null;
    try { payload = JSON.parse(raw); } catch (jsonErr) { payload = null; }

    /* ── A. JSON 協定 ── */
    if (payload && typeof payload === 'object') {

      // A1. Transfer 單筆同步（transfer.html syncTransferToGAS）
      if (payload.type === 'hrSync' && payload.record) return handleHrSync(payload.record);
      if (payload.type === 'hrDelete')                 return handleHrDelete(payload.id, payload.deletedBy);

      // A2. 通用 Telegram 通知（v2：底部自動附 Dashboard）
      if (payload.type === 'notify' || payload.type === 'tgSummary') {
        let body = String(payload.text || (payload.data && payload.data.text) || '');
        const checker = String(payload.checker || payload.inspector || '').trim();
        if (!checker) return failCors('請填檢查人 Checked by');
        body = ensureActorLine(body, 'checker', checker);
        const noDash = String(payload.noDashboard || '') === 'true';
        const targetChat = payload.chatId || CFG().GROUP_ID;
        const tg = tgSend(targetChat, body + (noDash ? '' : dashboardBlock()));
        if (!tg || tg.ok !== true) {
          const why = (tg && (tg.description || tg.error)) ? (tg.description || tg.error) : 'Telegram sendMessage failed';
          return failCors('Telegram 群組發送失敗: ' + why + ' | chat=' + targetChat);
        }
        const rptMod = payNormalizeModule(payload.module || payload.tool || '', body);
        const rptYm = payInferPeriod(payload, body);
        if (rptMod && rptYm) payTrack('summary', rptMod, rptYm, { checker:checker, text:String(body).slice(0,120) });
        return okCors({ sent: true, chatId: String(targetChat), messageId: String(tg.result && tg.result.message_id || ''), dashboard: !noDash && V2.APPEND_DASHBOARD });
      }

      // A3. Projection 契約 v4
      if (payload.type === 'projection') return handleProjectionPush(payload);

      // A3b. 通用核可請求（全模組共用，v2 雙軌）
      if (payload.type === 'approvalRequest') return handleApprovalRequest(payload);

      // A3c. 異常報告（v2）
      if (payload.type === 'anomalyReport') {
        const a = computeAnomalies();
        tgSend(payload.chatId || CFG().GROUP_ID, anomalyText(a));
        return okCors({ sent: true, counts: anomalyCounts(a) });
      }
      if (payload.type === 'dashboard') return okCors(computeDashboard());

      // A4. 通用工具推送
      if (payload.tool) return handleToolPush(payload);
    }

    /* ── B. urlencoded 協定（shutdown.html 的 api()）── */
    const q = parseQueryBody(raw);
    if (q.action) return handleShutdownAction(q);

    return failCors('Unknown POST payload');
  } catch (err) {
    return failCors(err.toString());
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   doGet — status / pull / pullProjection / warning / v2 系列
═══════════════════════════════════════════════════════════════════════ */
function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    const action = p.action || 'status';

    /* Warning 模組（warning.html 全部走 GET） */
    if (action.indexOf('warn') === 0) return handleWarningAction(action, p);
    if (action === 'approvalStatus') return okCors(approvalList(p.module, p.period));

    /* v2 新端點 */
    if (action === 'v2status')  return okCors(approvalList(p.module, p.period).records);
    if (action === 'dashboard') return okCors(computeDashboard());
    if (action === 'anomalies') return okCors(computeAnomalies());

    if (action === 'status') {
      const result = {};
      const props = PropertiesService.getScriptProperties();
      SYNC_TOOLS.forEach(t => {
        const raw = props.getProperty('snap_' + t);
        result[t] = raw ? JSON.parse(raw) : null;
      });
      return okCors(result);
    }

    if (action === 'pull') {
      const tool = p.tool;
      if (!tool) return failCors('Missing tool param');
      if (p.chunk !== undefined) {
        const rawC = loadFromDrive('chunk_' + tool + '_' + p.chunk + '.json');
        return okCors({ tool, chunk: p.chunk, records: rawC ? JSON.parse(rawC) : [] });
      }
      const metaRaw = loadFromDrive('chunk_' + tool + '_meta.json');
      if (metaRaw) return okCors({ tool, chunked: true, meta: JSON.parse(metaRaw) });
      const json = loadFromDrive(tool + '.json');
      if (!json) return okCors(null);
      return okCors(Object.assign({ tool: tool, chunked: false }, JSON.parse(json)));
    }

    if (action === 'pullProjection') {
      const mod = p.module;
      if (!mod) return failCors('Missing module param');
      const raw = loadFromDrive('hrpay_result_' + mod + '.json');
      return okCors({ module: mod, data: raw ? JSON.parse(raw) : null });
    }

    return okCors({ message: 'AC-HRA-PAY GAS v2.9', time: nowStr() });
  } catch (err) {
    return failCors(err.toString());
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   通用工具推送 / Projection
═══════════════════════════════════════════════════════════════════════ */
function handleToolPush(payload) {
  const tool = String(payload.tool);
  if (payload.totalChunks && payload.totalChunks > 1) {
    saveToDrive('chunk_' + tool + '_' + payload.chunk + '.json', JSON.stringify(payload.records || []));
    if (payload.chunk === payload.totalChunks - 1) {
      const metaDoc = {
        tool, timestamp: new Date().toISOString(),
        recordCount: payload.recordCount || 0,
        totalChunks: payload.totalChunks,
        summary: payload.summary || {},
      };
      saveToDrive('chunk_' + tool + '_meta.json', JSON.stringify(metaDoc));
      setSnap(tool, metaDoc.recordCount, metaDoc.summary);
      payMarkCloud(tool, Object.assign({}, payload, {records:payload.records||[]}));
      return okCors({ saved: tool, recordCount: metaDoc.recordCount, chunk: 'final' });
    }
    return okCors({ saved: tool, chunk: payload.chunk, pending: true });
  }
  saveToDrive(tool + '.json', JSON.stringify(payload));
  const count = payload.recordCount ||
    (payload.transfers ? payload.transfers.length : 0) ||
    (payload.records ? payload.records.length : 0) || 0;
  setSnap(tool, count, payload.summary || {});
  payMarkCloud(tool, payload);
  return okCors({ saved: tool, recordCount: count, timestamp: new Date().toISOString() });
}

function handleProjectionPush(payload) {
  const mod = String(payload.module || '').trim();
  if (!mod) return failCors('projection missing module');
  const fname = 'hrpay_result_' + mod + '.json';
  let store = {};
  try { store = JSON.parse(loadFromDrive(fname) || '{}'); } catch (e) { store = {}; }
  if (!store.items) store.items = {};
  let key = String(payload.period || 'NA');
  if (payload.payPhase)  key += ':' + payload.payPhase;
  if (payload.mealBatch) key += ':B' + payload.mealBatch;
  store.items[key] = {
    period    : payload.period || '',
    payPhase  : payload.payPhase || '',
    mealBatch : payload.mealBatch || '',
    totals    : payload.totals || {},
    rowCount  : (payload.rows || []).length,
    rows      : payload.rows || [],
    sourceFile: payload.sourceFile || '',
    updatedAt : new Date().toISOString(),
  };
  store.module = mod;
  store.updatedAt = new Date().toISOString();
  saveToDrive(fname, JSON.stringify(store));
  setSnap(mod, Object.keys(store.items).length, { latestKey: key, totals: payload.totals || {} });
  const pym=payReportYm(payload.period); if(pym) payTrack('cloud',payNormalizeModule(mod,''),pym,{source:'projection',key:key});
  return okCors({ saved: 'projection:' + mod, key });
}

function setSnap(tool, count, summary) {
  PropertiesService.getScriptProperties().setProperty('snap_' + tool, JSON.stringify({
    tool, timestamp: new Date().toISOString(), recordCount: count || 0, summary: summary || {}
  }));
}
function getSnap(tool) {
  const raw = PropertiesService.getScriptProperties().getProperty('snap_' + tool);
  return raw ? JSON.parse(raw) : null;
}


/* ═══════════════════════════════════════════════════════════════════════
   v3.1 每月 5 日「上月報告完整性」— AC-HRA-PAY 自己的群組
   規則：每個應交月報必須同時具備
     ① ☁ 已上傳雲端 Cloud uploaded
     ② 📨 已發 Telegram 摘要 或 已送核可 Summary OR approval sent
   PAY 只檢查 PAY 自己的模組；AC HRA Portal 由 Portal 自己的群組獨立發送。
═══════════════════════════════════════════════════════════════════════ */
const HRA_PORTAL_GAS_FALLBACK = 'https://script.google.com/macros/s/AKfycbya4jZG7YixRmumt9vKA-5Cv92jP8fi_o4toiU-8J2exQCYBhBsLOtN4kX9hoKqzp12/exec';
const PAY_MONTHLY_REPORTS = [
  {key:'payroll',  required:true,  zh:'薪資',     en:'Payroll',       km:'ប្រាក់ខែ'},
  {key:'advance',  required:true,  zh:'預支薪資', en:'Advance Pay',   km:'ប្រាក់បើកមុន'},
  {key:'meal',     required:true,  zh:'餐費',     en:'Meal Fee',      km:'ថ្លៃអាហារ'},
  {key:'otbonus',  required:true,  zh:'加班/獎金', en:'OT & Bonus',    km:'OT និងប្រាក់រង្វាន់'},
  {key:'employee', required:true,  zh:'員工資料', en:'Employee HR',   km:'ទិន្នន័យបុគ្គលិក'},
  {key:'transfer', required:false, zh:'職位異動', en:'Transfer',      km:'ផ្លាស់ប្តូរតួនាទី'},
  {key:'shutdown', required:false, zh:'停工',     en:'Shutdown',      km:'ផ្អាកការងារ'},
  {key:'warning',  required:false, zh:'警告',     en:'Warning',       km:'ព្រមាន'}
];
function payReportYm(v) {
  if (v instanceof Date && !isNaN(v)) return Utilities.formatDate(v, CFG().TZ, 'yyyy-MM');
  v=String(v==null?'':v).trim();
  let m=v.match(/\b(20\d{2})[-\/.](0?[1-9]|1[0-2])\b/); if(m)return m[1]+'-'+('0'+m[2]).slice(-2);
  m=v.match(/\b(20\d{2})\s*年\s*(0?[1-9]|1[0-2])\s*月/); if(m)return m[1]+'-'+('0'+m[2]).slice(-2);
  m=v.match(/\b(0?[1-9]|1[0-2])[-\/](20\d{2})\b/); if(m)return m[2]+'-'+('0'+m[1]).slice(-2);
  const mn={jan:1,january:1,feb:2,february:2,mar:3,march:3,apr:4,april:4,may:5,jun:6,june:6,jul:7,july:7,aug:8,august:8,sep:9,september:9,sept:9,oct:10,october:10,nov:11,november:11,dec:12,december:12};
  m=v.toLowerCase().match(/\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)\s*[,\- ]+\s*(20\d{2})\b/);
  if(m)return m[2]+'-'+('0'+mn[m[1]]).slice(-2);
  return '';
}
function payNormalizeModule(mod, text) {
  mod=String(mod||'').toLowerCase().trim();
  const map={hrpay_payroll:'payroll',meal_fee:'meal',hrpay_meal:'meal',advance_pay:'advance',hrpay_advance:'advance',ot_bonus:'otbonus',hrpay_ot_bonus:'otbonus',hrpay_employee:'employee',hrpay_transfer:'transfer',hr:'transfer',hrpay_shutdown:'shutdown',hrpay_warning:'warning'};
  if(map[mod])return map[mod]; if(PAY_MONTHLY_REPORTS.some(function(x){return x.key===mod;}))return mod;
  text=String(text||'').toLowerCase();
  if(/meal fee|餐費|ថ្លៃអាហារ/.test(text))return 'meal';
  if(/advance pay|預支|ប្រាក់បើកមុន/.test(text))return 'advance';
  if(/payroll|薪資|ប្រាក់ខែ/.test(text))return 'payroll';
  if(/ot\s*&?\s*bonus|加班|獎金|ប្រាក់រង្វាន់/.test(text))return 'otbonus';
  if(/transfer|職位異動|ផ្លាស់ប្តូរ/.test(text))return 'transfer';
  if(/shutdown|停工|ផ្អាកការងារ/.test(text))return 'shutdown';
  if(/warning|警告|ព្រមាន/.test(text))return 'warning';
  if(/employee hr|員工資料|employee profile/.test(text))return 'employee';
  return mod;
}
function payCollectYms(obj,out,depth){
  out=out||{};depth=depth||0;if(depth>5||obj==null)return out;
  if(Array.isArray(obj)){obj.forEach(function(x){payCollectYms(x,out,depth+1);});return out;}
  if(typeof obj!=='object'){const ym=payReportYm(obj);if(ym)out[ym]=1;return out;}
  if(obj.year&&obj.month){const y=Number(obj.year),mo=Number(obj.month);if(y>=2000&&y<=2100&&mo>=1&&mo<=12)out[y+'-'+('0'+mo).slice(-2)]=1;}
  Object.keys(obj).forEach(function(k){const v=obj[k];
    if(/^(period|periodKey|payMonth|month|date|workDate|joinDate|resignDate|effDate|effectiveDate|incidentDate|start|end|start_date|end_date|key)$/i.test(k)){const ym=payReportYm(v);if(ym)out[ym]=1;}
    if(Array.isArray(v)||(v&&typeof v==='object'))payCollectYms(v,out,depth+1);
  });return out;
}
function payActProp(mod,ym){return 'reportact_'+String(mod).replace(/[^a-z0-9_\-]/gi,'_')+'_'+ym;}
function payTrack(kind,mod,ym,meta){mod=payNormalizeModule(mod,meta&&meta.text);ym=payReportYm(ym);if(!mod||!ym)return;const k=payActProp(mod,ym);let a={};try{a=JSON.parse(PropertiesService.getScriptProperties().getProperty(k)||'{}');}catch(e){a={};}a[kind]=new Date().toISOString();if(meta){a.meta=a.meta||{};Object.keys(meta).forEach(function(x){if(meta[x]!==undefined)a.meta[x]=meta[x];});}PropertiesService.getScriptProperties().setProperty(k,JSON.stringify(a));}
function payActivity(mod,ym){try{return JSON.parse(PropertiesService.getScriptProperties().getProperty(payActProp(mod,ym))||'{}');}catch(e){return{};}}
function payInferPeriod(payload,text){let ym=payReportYm(payload&&payload.period)||payReportYm(payload&&payload.payMonth);if(ym)return ym;return payReportYm(text||payload&&payload.text||'');}
function payMarkCloud(tool,payload){const mod=payNormalizeModule(tool,'');const yms=payCollectYms(payload);Object.keys(yms).forEach(function(ym){payTrack('cloud',mod,ym,{tool:String(tool||'')});});}
function payDeadlineSnapOk(ts,ym){if(!ts||!ym)return false;const d=new Date(ts);if(isNaN(d))return false;const dym=Utilities.formatDate(d,CFG().TZ,'yyyy-MM');if(dym===ym)return true;const p=ym.split('-'),n=new Date(Number(p[0]),Number(p[1]),1),nym=Utilities.formatDate(n,CFG().TZ,'yyyy-MM'),day=Number(Utilities.formatDate(d,CFG().TZ,'d'));return dym===nym&&day<=5;}
function payProjectionHasMonth(mod,ym){try{const r=JSON.parse(loadFromDrive('hrpay_result_'+mod+'.json')||'{}');const its=r.items||{};return Object.keys(its).some(function(k){return payReportYm((its[k]&&its[k].period)||k)===ym;});}catch(e){return false;}}
function payRawHasMonth(mod,ym){
  if(mod==='payroll'||mod==='advance'||mod==='meal')return payProjectionHasMonth(mod,ym);
  if(mod==='warning')return warnAll().some(function(r){return payReportYm(r.incidentDate)===ym;});
  const files={otbonus:'hrpay_ot_bonus.json',employee:'hrpay_employee.json',transfer:'hrpay_transfer.json',shutdown:'hrpay_shutdown.json'};
  const f=files[mod];if(!f)return false;try{const d=JSON.parse(loadFromDrive(f)||'{}');const ys=payCollectYms(d);return !!ys[ym];}catch(e){return false;}
}
function payApprovalHasMonth(mod,ym){
  if(mod==='warning')return warnAll().some(function(r){return payReportYm(r.incidentDate)===ym && !!(r.messageId||r.chatId||r.reviewer||r.approver);});
  return sheetObjects(approvalSheet(),APPROVAL_HEADERS).some(function(r){return payNormalizeModule(r.module,'')===mod && payReportYm(r.period)===ym;});
}
function payModuleStatus(def,ym){const a=payActivity(def.key,ym),data=payRawHasMonth(def.key,ym),snap=getSnap(def.key);const cloud=!!(a.cloud||data||(snap&&payDeadlineSnapOk(snap.timestamp,ym)));const approval=!!(a.approval||payApprovalHasMonth(def.key,ym));const summary=!!a.summary;const hasAny=cloud||approval||summary||data;const expected=!!def.required||hasAny;return {key:def.key,zh:def.zh,en:def.en,km:def.km,required:!!def.required,expected:expected,hasData:data,cloud:cloud,summary:summary,approval:approval,sent:(summary||approval)};}
function payMonthlyCompletenessStatus(ym){ym=payReportYm(ym);if(!ym){const d=new Date();d.setMonth(d.getMonth()-1);ym=Utilities.formatDate(d,CFG().TZ,'yyyy-MM');}return {platform:'AC-HRA-PAY',period:ym,items:PAY_MONTHLY_REPORTS.map(function(d){return payModuleStatus(d,ym);}),generatedAt:new Date().toISOString()};}
function fetchPortalMonthlyStatus(ym){
  const url=PropertiesService.getScriptProperties().getProperty('HRA_PORTAL_GAS_URL')||HRA_PORTAL_GAS_FALLBACK;
  try{const r=UrlFetchApp.fetch(url+'?action=monthlyCompletenessStatus&period='+encodeURIComponent(ym),{muteHttpExceptions:true,followRedirects:true});const d=JSON.parse(r.getContentText());if(d&&d.ok&&d.data&&Array.isArray(d.data.items))return d.data;return {platform:'AC HRA Portal',period:ym,error:'monthlyCompletenessStatus endpoint unavailable',items:[]};}catch(e){return {platform:'AC HRA Portal',period:ym,error:String(e),items:[]};}
}
function triStatusLine(x){
  const cloud=x.cloud?'✅':'❌', sent=x.sent?'✅':'❌'; let via=x.approval?'Approval 核可':x.summary?'Summary 摘要':'—';
  return (x.cloud&&x.sent?'✅ ':'⚠️ ')+'<b>'+escapeHtml(x.zh)+' / '+escapeHtml(x.en)+' / '+escapeHtml(x.km)+'</b>\n' +
    '   ☁ Cloud 雲端 / ពពក：'+cloud+'　📨 Summary/Approval 摘要/核可 / សង្ខេប/អនុម័ត：'+sent+(x.sent?' ('+via+')':'');
}
function monthlyCompletenessText(ym,paySt){
  const all=(paySt&&Array.isArray(paySt.items))?paySt.items:[];
  const shown=all.filter(function(x){return x.expected;}); const miss=shown.filter(function(x){return !x.cloud||!x.sent;});
  let s='📋 <b>AC-HRA-PAY 上月報告完整性檢查 / Previous Month Report Completion / របាយការណ៍ពិនិត្យភាពពេញលេញខែមុន</b>\n';
  s+='📅 期間 Period / រយៈពេល：<b>'+escapeHtml(ym)+'</b>\n';
  s+='⏰ 截止 Deadline / កាលកំណត់：每月5日 / Day 5 / ថ្ងៃទី 5\n━━━━━━━━━━━━━━━━\n';
  if(!miss.length){s+='✅ <b>全部完成 / All required reports complete / របាយការណ៍ចាំបាច់បានបញ្ចប់ទាំងអស់</b>\n';}
  else{
    s+='⚠️ <b>缺漏 Missing / ខ្វះ：'+miss.length+'</b>\n';
    miss.forEach(function(x){s+=triStatusLine(x)+'\n';});
  }
  const ok=shown.filter(function(x){return x.cloud&&x.sent;});
  if(ok.length){s+='━━━━━━━━━━━━━━━━\n✅ 完成 Complete / បានបញ្ចប់：'+ok.map(function(x){return escapeHtml(x.en);}).join(' · ')+'\n';}
  s+='━━━━━━━━━━━━━━━━\n';
  s+='判定規則 / Rule / ច្បាប់：☁ 雲端上傳 + 📨 摘要或送核，兩項都要完成。\nCloud upload AND Summary/Approval are both required.\nត្រូវមានទាំងការផ្ទុកឡើង Cloud និងការផ្ញើ Summary/Approval។\n';
  s+='🕐 '+nowStr(); return s+dashboardBlock();
}
function monthlyCompletenessJob(){
  const d=new Date();d.setMonth(d.getMonth()-1);const ym=Utilities.formatDate(d,CFG().TZ,'yyyy-MM');const p=PropertiesService.getScriptProperties(),guard='monthly_completeness_sent_'+ym;if(p.getProperty(guard)){console.log('[PAY MONTHLY COMPLETENESS] already sent '+ym);return;}
  const paySt=payMonthlyCompletenessStatus(ym),txt=monthlyCompletenessText(ym,paySt),r=tgSend(CFG().GROUP_ID,txt);
  if(r&&r.ok===true)p.setProperty(guard,new Date().toISOString()); else throw new Error('PAY monthly completeness Telegram send failed');
}
function ensureMonthlyCompletenessTrigger(){
  const name='monthlyCompletenessJob';let has=false;ScriptApp.getProjectTriggers().forEach(function(t){if(t.getHandlerFunction()===name)has=true;});
  if(!has)ScriptApp.newTrigger(name).timeBased().onMonthDay(5).atHour(17).inTimezone(CFG().TZ).create();
  console.log('monthlyCompletenessJob：'+(has?'已存在':'已建立（每月5日約17:00）'));
}
function installMonthlyCompletenessTrigger(){ensureMonthlyCompletenessTrigger();return '✅ 每月5日上月報告完整性檢查已安裝';}
function runMonthlyCompletenessNow(){PropertiesService.getScriptProperties().deleteProperty('monthly_completeness_sent_'+Utilities.formatDate(new Date(new Date().getFullYear(),new Date().getMonth()-1,1),CFG().TZ,'yyyy-MM'));return monthlyCompletenessJob();}
function previewMonthlyCompleteness(){const d=new Date();d.setMonth(d.getMonth()-1);const ym=Utilities.formatDate(d,CFG().TZ,'yyyy-MM'),txt=monthlyCompletenessText(ym,payMonthlyCompletenessStatus(ym));Logger.log(txt);return txt;}


/* ═══════════════════════════════════════════════════════════════════════
   TRANSFER — 申請 → 待核可(Paul) → 核可/退件
═══════════════════════════════════════════════════════════════════════ */
function handleHrSync(record) {
  if (record.status === 'pending_review') record.status = 'reviewed';
  let st = {};
  try { st = JSON.parse(loadFromDrive('hr.json') || '{}'); } catch (e) { st = {}; }
  if (!Array.isArray(st.transfers)) st.transfers = [];
  const idx = st.transfers.findIndex(x => x.id === record.id);
  if (idx >= 0) st.transfers[idx] = record; else st.transfers.push(record);
  st.pushedAt = new Date().toISOString();
  saveToDrive('hr.json', JSON.stringify(st));
  setSnap('hr', st.transfers.length, { pending: st.transfers.filter(x => (x.status||'reviewed') === 'reviewed').length });
  const hym=payReportYm(record.effDate||record.effectiveDate||record.date); if(hym)payTrack('cloud','transfer',hym,{source:'hrSync'});
  notifyTransfer(record, record._action || 'update');
  return okCors({ saved: 'hrSync', id: record.id, status: record.status });
}

function handleHrDelete(id, by) {
  let st = {};
  try { st = JSON.parse(loadFromDrive('hr.json') || '{}'); } catch (e) { st = {}; }
  if (Array.isArray(st.transfers)) {
    st.transfers = st.transfers.filter(x => x.id !== id);
    saveToDrive('hr.json', JSON.stringify(st));
    setSnap('hr', st.transfers.length, {});
  }
  return okCors({ deleted: id, by: by || '' });
}

function notifyTransfer(r, action) {
  const H = escapeHtml;
  const before = num(r.origBasic) + num(r.origPosAdd) + num(r.origSkill) + num(r.origLang);
  const after  = num(r.newBasic)  + num(r.newPosAdd)  + num(r.newSkill)  + num(r.newLang);
  const diff   = after - before;
  const diffStr = diff > 0 ? '+$' + N(diff) : (diff < 0 ? '-$' + N(Math.abs(diff)) : '±$0');
  const stMap = {
    reviewed : '⏳ 待 Paul 核可 Pending Approval',
    approved : '✅ 已核可 Approved',
    rejected : '❌ 已退件 Rejected',
  };
  const head = action === 'new' ? '🆕 <b>職位異動新申請</b>' : '🔄 <b>職位異動狀態更新</b>';
  const lines = [
    head,
    '狀態：' + (stMap[r.status] || H(r.status || '')),
    '員工：' + H(r.empName) + ' #' + H(r.empId),
    '申請人：' + H(r.applicant || '—'),
    '異動：' + H(r.reason || '') + (r.reasonDetail ? ' — ' + H(r.reasonDetail) : ''),
    '生效：' + H(r.effectiveDate || ''),
    '前：' + H(r.origDept || '') + ' ' + H(r.origPos || '') + ' $' + N(before),
    '後：' + H(r.newDept || '') + ' ' + H(r.newPos || '') + ' $' + N(after),
    '薪差：' + diffStr,
  ];
  if (r.approveNote) lines.push('Paul 備註：' + H(r.approveNote));
  if (action === 'new' || r.status === 'reviewed') lines.push('\n👉 請 Paul 開啟系統核可');
  tgSend(CFG().GROUP_ID, lines.join('\n'), {
    reply_markup: JSON.stringify({ inline_keyboard: [
      [{ text: '🔄 開啟職位異動系統', url: CFG().BASE_URL + '/transfer.html' }]
    ]})
  });
}

/* ═══════════════════════════════════════════════════════════════════════
   SHUTDOWN — Sheet 後端（shutdown.html 的 urlencoded api）
═══════════════════════════════════════════════════════════════════════ */
const SHUT_EV_HEADERS = ['id','event_no','start_date','end_date','shutdown_days','ttl_lines',
  'shutdown_lines','shutdown_line_pct','total_ppl','shutdown_ppl','remain_ppl','shutdown_ppl_pct','notes','updated_at'];
const SHUT_LS_HEADERS = ['event_id','line_code','name_tc','name_en','dept_code','headcount','shutdown_ppl','remain_ppl','shutdown_pct'];
const LINES_HEADERS   = ['line_code','name_tc','name_en','dept_code','headcount'];

function handleShutdownAction(q) {
  const a = q.action;
  if (a === 'init')        { initSheets(); return okCors({ init: true }); }
  if (a === 'getStats')    return okCors(shutGetStats());
  if (a === 'getEvents')   return okCors(shutGetEvents(q.year));
  if (a === 'getEvent')    return okCors(shutGetEvent(q.id));
  if (a === 'getLines')    return okCors(shutGetLines());
  if (a === 'saveEvent')   return okCors(shutSaveEvent(q));
  if (a === 'deleteEvent') return okCors(shutDeleteEvent(q.id));
  if (a === 'batchImport') return shutBatchImport(q);
  if (a === 'sendTg') {
    const res = tgSend(CFG().GROUP_ID, String(q.message || '') + dashboardBlock());
    return rawJson({ ok: true, tg: res });
  }
  return failCors('Unknown shutdown action: ' + a);
}

function sheetObjects(sh, headers) {
  const last = sh.getLastRow();
  if (last < 2) return [];
  const width = Math.max(headers.length, sh.getLastColumn());
  const vals = sh.getRange(2, 1, last - 1, width).getValues();
  return vals.map((row, i) => {
    const o = { _row: i + 2 };
    headers.forEach((h, c) => { o[h] = row[c]; });
    return o;
  }).filter(o => String(o[headers[0]]) !== '');
}

function shutEventsSheet() { return getOrCreateSheet(getSS(), 'Shutdown_Events', SHUT_EV_HEADERS); }
function shutLinesSheet()  { return getOrCreateSheet(getSS(), 'Shutdown_LineStats', SHUT_LS_HEADERS); }
function linesMaster()     { return getOrCreateSheet(getSS(), 'Lines', LINES_HEADERS); }

function normDate(v) {
  if (v instanceof Date) return Utilities.formatDate(v, CFG().TZ, 'yyyy-MM-dd');
  return String(v || '').slice(0, 10);
}

function shutAllEvents() {
  return sheetObjects(shutEventsSheet(), SHUT_EV_HEADERS).map(ev => {
    ev.start_date = normDate(ev.start_date);
    ev.end_date   = normDate(ev.end_date);
    ev.shutdown_days = num(ev.shutdown_days);
    return ev;
  });
}

function shutGetStats() {
  const evs = shutAllEvents();
  const byYear = {};
  evs.forEach(ev => {
    const d = ev.start_date;
    const y = parseInt(d.slice(0, 4), 10);
    const m = parseInt(d.slice(5, 7), 10);
    if (!y) return;
    if (!byYear[y]) byYear[y] = { year: y, count: 0, totalDays: 0, byMonth: {} };
    byYear[y].count += 1;
    byYear[y].totalDays += ev.shutdown_days;
    byYear[y].byMonth[m] = (byYear[y].byMonth[m] || 0) + ev.shutdown_days;
  });
  return Object.keys(byYear).sort().map(y => byYear[y]);
}

function shutGetEvents(year) {
  let evs = shutAllEvents();
  if (year) evs = evs.filter(ev => ev.start_date.slice(0, 4) === String(year));
  evs.sort((a, b) => b.start_date.localeCompare(a.start_date));
  return evs;
}

function shutGetEvent(id) {
  const ev = shutAllEvents().find(x => String(x.id) === String(id));
  if (!ev) throw new Error('Event not found: ' + id);
  const lineStats = sheetObjects(shutLinesSheet(), SHUT_LS_HEADERS)
    .filter(x => String(x.event_id) === String(id));
  return { event: ev, lineStats };
}

function shutGetLines() {
  const sh = linesMaster();
  let lines = sheetObjects(sh, LINES_HEADERS);
  if (!lines.length) {
    const seed = [];
    for (let i = 1; i <= 11; i++) seed.push(['LINE_' + i, '車縫 ' + i + ' 線', 'Sewing Line ' + i, 'SEWING', 0]);
    seed.push(['CUTTING', '裁剪組', 'Cutting', 'CUTTING', 0]);
    seed.push(['PACKING', '包裝組', 'Packing', 'PACKING', 0]);
    seed.push(['QC', '品管組', 'QC', 'QC', 0]);
    seed.push(['ADMIN', '行政/後勤', 'Admin & Support', 'ADMIN', 0]);
    sh.getRange(2, 1, seed.length, LINES_HEADERS.length).setValues(seed);
    lines = sheetObjects(sh, LINES_HEADERS);
  }
  return lines;
}

function shutSaveEvent(q) {
  const sh = shutEventsSheet();
  const id = q.id && String(q.id) !== 'null' && String(q.id) !== '' ? String(q.id) : String(Date.now());
  const row = [
    id, q.event_no || '', normDate(q.start_date), normDate(q.end_date), num(q.shutdown_days),
    num(q.ttl_lines), num(q.shutdown_lines), num(q.shutdown_line_pct),
    num(q.total_ppl), num(q.shutdown_ppl), num(q.remain_ppl), num(q.shutdown_ppl_pct),
    q.notes || '', nowStr()
  ];
  const existing = sheetObjects(sh, SHUT_EV_HEADERS).find(x => String(x.id) === id);
  if (existing) sh.getRange(existing._row, 1, 1, SHUT_EV_HEADERS.length).setValues([row]);
  else sh.appendRow(row);

  let stats = [];
  try { stats = JSON.parse(q.line_stats || '[]'); } catch (e) { stats = []; }
  const ls = shutLinesSheet();
  const old = sheetObjects(ls, SHUT_LS_HEADERS).filter(x => String(x.event_id) === id);
  for (let i = old.length - 1; i >= 0; i--) ls.deleteRow(old[i]._row);
  stats.forEach(s => ls.appendRow([id, s.line_code || '', s.name_tc || '', s.name_en || '',
    s.dept_code || '', num(s.headcount), num(s.shutdown_ppl), num(s.remain_ppl), num(s.shutdown_pct)]));

  updateShutdownSnap();
  return { id };
}

function shutDeleteEvent(id) {
  const sh = shutEventsSheet();
  const ev = sheetObjects(sh, SHUT_EV_HEADERS).find(x => String(x.id) === String(id));
  if (ev) sh.deleteRow(ev._row);
  const ls = shutLinesSheet();
  const old = sheetObjects(ls, SHUT_LS_HEADERS).filter(x => String(x.event_id) === String(id));
  for (let i = old.length - 1; i >= 0; i--) ls.deleteRow(old[i]._row);
  updateShutdownSnap();
  return { deleted: id };
}

function shutBatchImport(q) {
  let events = [];
  try { events = JSON.parse(q.events || '[]'); } catch (e) { return failCors('events JSON 解析失敗'); }
  const sh = shutEventsSheet();
  const existing = shutAllEvents();
  const seen = new Set(existing.map(x => String(x.event_no) + '_' + x.start_date));
  let imported = 0, skipped = 0;
  const rows = [];
  events.forEach(ev => {
    const key = String(ev.event_no) + '_' + normDate(ev.start_date);
    if (seen.has(key)) { skipped++; return; }
    seen.add(key);
    rows.push([String(Date.now()) + '_' + imported, ev.event_no || '', normDate(ev.start_date),
      normDate(ev.end_date), num(ev.shutdown_days), num(ev.ttl_lines), num(ev.shutdown_lines),
      0, num(ev.total_ppl), num(ev.shutdown_ppl), num(ev.remain_ppl), 0, ev.notes || '', nowStr()]);
    imported++;
  });
  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, SHUT_EV_HEADERS.length).setValues(rows);
  updateShutdownSnap();
  return rawJson({ ok: true, imported, skipped });
}

function updateShutdownSnap() {
  const evs = shutAllEvents();
  const cy = String(new Date().getFullYear());
  const cyDays = evs.filter(e => e.start_date.slice(0, 4) === cy)
                    .reduce((a, b) => a + b.shutdown_days, 0);
  setSnap('shutdown', evs.length, { thisYearDays: cyDays });
}

/* ═══════════════════════════════════════════════════════════════════════
   WARNING — Sheet 後端＋失效規則＋Telegram 核可
═══════════════════════════════════════════════════════════════════════ */
const WARN_HEADERS = ['id','timestamp','applicant','appDept','empName','empId','empDept','empPos',
  'level','reason','incidentDate','remark','is7Day','status','approver','approveTs','expireDate',
  'reviewer','reviewedAt','chatId','messageId','deletedAt','deletedBy'];

/* 警告狀態：待審核 → 待核可（審查通過）→ 已核可 / 已退件 / 已退回 */
const W_PENDING  = '待審核';
const W_VERIFIED = '待核可';
const W_APPROVED = '已核可';
const W_REJECTED = '已退件';
const W_RETURNED = '已退回';
const W_DELETED  = '已刪除';

function warnSheet() {
  const sh = getOrCreateSheet(getSS(), 'Warning', WARN_HEADERS);
  // v1.0 升級：自動補上 reviewer / reviewedAt，不動舊資料
  const lastCol = Math.max(sh.getLastColumn(), 1);
  const hdr = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || '').trim());
  let col = lastCol;
  WARN_HEADERS.forEach(h => {
    if (hdr.indexOf(h) < 0) {
      col++;
      sh.getRange(1, col).setValue(h).setFontWeight('bold')
        .setBackground('#1A2540').setFontColor('#FFFFFF');
      hdr.push(h);
    }
  });
  return sh;
}

function warnValidMonths(level) {
  const p = PropertiesService.getScriptProperties();
  return num(p.getProperty('WARN_MONTHS_' + level)) || 6;
}
function warnExpireDate(incidentDate, level) {
  const d = new Date(normDate(incidentDate) + 'T00:00:00');
  if (isNaN(d)) return '';
  d.setMonth(d.getMonth() + warnValidMonths(level));
  return Utilities.formatDate(d, CFG().TZ, 'yyyy-MM-dd');
}
function warnIsExpired(rec) {
  if (!rec.expireDate) return false;
  return normDate(rec.expireDate) < Utilities.formatDate(new Date(), CFG().TZ, 'yyyy-MM-dd');
}

function warnAll(includeDeleted) {
  const recs = sheetObjects(warnSheet(), WARN_HEADERS).map(r => {
    r.incidentDate = normDate(r.incidentDate);
    r.expireDate   = normDate(r.expireDate);
    r.row = r._row;
    r.expired = warnIsExpired(r);
    return r;
  });
  // v2.8：刪除採 soft-delete，不真的 deleteRow，避免 Telegram callback 以 row 定位時全部錯位。
  return includeDeleted ? recs : recs.filter(r => String(r.status || '') !== W_DELETED);
}

function warnBigFinalCount(empName, empId) {
  return warnAll().filter(r =>
    !r.expired &&
    r.status !== W_REJECTED && r.status !== W_RETURNED &&
    (r.level === 'Big' || r.level === 'Final') &&
    ((empId && String(r.empId) === String(empId)) ||
     (!empId && empName && String(r.empName).trim() === String(empName).trim()))
  ).length;
}

function handleWarningAction(action, p) {
  const cfg = CFG();
  const isAdmin = String(p.adminCode || '') === '1111'; // Warning 網頁管理碼；Telegram 最終核可仍用 cfg.ADMIN_ID
  const parseData = () => {
    let s = String(p.data || '');
    try { s = decodeURIComponent(s); } catch (e) {}
    return JSON.parse(s);
  };
  const terminateAt = num(PropertiesService.getScriptProperties().getProperty('WARN_TERMINATE_COUNT')) || 3;

  if (action === 'warnCheck') {
    const cnt = warnBigFinalCount(p.empName, p.empId);
    const willBe = cnt + ((p.level === 'Big' || p.level === 'Final') ? 1 : 0);
    return rawJson({ ok: true, bigFinalCount: cnt, terminate: willBe >= terminateAt });
  }

  if (action === 'warnSubmit') {
    const d = parseData();
    const id = 'W' + Date.now();
    const expire = warnExpireDate(d.incidentDate, d.level);
    warnSheet().appendRow([id, d.timestamp || nowStr(), d.applicant || '', d.applicantDept || '',
      d.empName || '', d.empId || '', d.empDept || '', d.empPos || '', d.level || '', d.reason || '',
      normDate(d.incidentDate), d.remark || '', d.is7Day ? 'Y' : '', W_PENDING, '', '', expire, '', '', '', '', '', '']);
    const cnt = warnBigFinalCount(d.empName, d.empId);
    const terminate = cnt >= terminateAt || !!d.is7Day;
    warnNotifySubmit(d, id, cnt, terminate);
    setSnap('warning', warnAll().length, { pending: warnAll().filter(r => r.status === '待審核').length });
    return rawJson({ ok: true, id, terminate, bigFinalCount: cnt });
  }

  if (action === 'warnList') {
    let recs = warnAll();
    if (p.year)  recs = recs.filter(r => r.incidentDate.slice(0, 4) === String(p.year));
    if (p.month) recs = recs.filter(r => parseInt(r.incidentDate.slice(5, 7), 10) === parseInt(p.month, 10));
    if (p.dept)  recs = recs.filter(r => String(r.empDept).indexOf(p.dept) >= 0);
    if (p.level) recs = recs.filter(r => r.level === p.level);
    if (p.status) recs = recs.filter(r => r.status === p.status);
    if (p.empName) recs = recs.filter(r => String(r.empName).indexOf(p.empName) >= 0);
    if (p.empId)   recs = recs.filter(r => String(r.empId) === String(p.empId));
    if (p.hideExpired === '1' || p.hideExpired === 'true') recs = recs.filter(r => !r.expired);
    recs.sort((a, b) => b.incidentDate.localeCompare(a.incidentDate));
    return rawJson({ ok: true, records: recs });
  }

  if (action === 'warnStats') {
    const recs = warnAll();
    const s = { total: recs.length, active: 0, pending: 0, expired: 0, byLevel: {}, byDept: {}, byMonth: {} };
    recs.forEach(r => {
      if (r.expired) s.expired++;
      else if (r.status === W_APPROVED) s.active++;
      if (r.status === W_PENDING || r.status === W_VERIFIED) s.pending++;
      s.byLevel[r.level] = (s.byLevel[r.level] || 0) + 1;
      if (r.empDept) s.byDept[r.empDept] = (s.byDept[r.empDept] || 0) + 1;
      const mo = r.incidentDate.slice(0, 7);
      if (mo) s.byMonth[mo] = (s.byMonth[mo] || 0) + 1;
    });
    return rawJson({ ok: true, stats: s });
  }

  if (action === 'warnEdit') {
    if (!isAdmin) return rawJson({ ok: false, error: '無管理權限 adminCode' });
    const d = parseData();
    const sh = warnSheet();
    const row = parseInt(d.row, 10);
    if (!row || row < 2) return rawJson({ ok: false, error: 'row 無效' });
    const cur = sh.getRange(row, 1, 1, WARN_HEADERS.length).getValues()[0];
    const rec = {}; WARN_HEADERS.forEach((h, i) => rec[h] = cur[i]);
    ['empName','empDept','empPos','level','reason','status','remark','reviewer'].forEach(k => {
      if (d[k] !== undefined) rec[k] = d[k];
    });
    if (d.reviewer !== undefined && !rec.reviewedAt) rec.reviewedAt = nowStr();
    if (d.incidentDate !== undefined) {
      rec.incidentDate = normDate(d.incidentDate);
      rec.expireDate = warnExpireDate(rec.incidentDate, rec.level);
    }
    if (d.status === W_APPROVED && !rec.approver) { rec.approver = 'Paul'; rec.approveTs = nowStr(); }
    sh.getRange(row, 1, 1, WARN_HEADERS.length).setValues([WARN_HEADERS.map(h => rec[h])]);
    // 若在網頁上完成第一關審查，第二關也只送群組，不私訊 Paul。
    if (d.status === W_VERIFIED) warnSendTelegramByRow(row);
    return rawJson({ ok: true, row });
  }

  if (action === 'warnSendTelegram') {
    const row = parseInt(p.row, 10);
    if (!row || row < 2) return rawJson({ ok: false, error: 'row 無效' });
    const res = warnSendTelegramByRow(row);
    return rawJson(res);
  }

  if (action === 'warnDelete') {
    if (!isAdmin) return rawJson({ ok: false, error: '無管理權限 adminCode' });
    const row = parseInt(p.row, 10);
    const sh = warnSheet();
    if (!row || row < 2 || row > sh.getLastRow()) return rawJson({ ok: false, error: 'row 無效' });
    const cur = sh.getRange(row, 1, 1, WARN_HEADERS.length).getValues()[0];
    const rec = {}; WARN_HEADERS.forEach((h, i) => rec[h] = cur[i]);
    if (String(rec.status || '') === W_DELETED) return rawJson({ ok: true, deleted: row, already: true });

    // ★ 不 deleteRow：Telegram Warning callback 使用 row 當 token，實體刪列會讓後面所有舊按鈕指到錯人。
    rec.status = W_DELETED;
    rec.deletedAt = nowStr();
    rec.deletedBy = 'Paul';
    const oldRemark = String(rec.remark || '').trim();
    rec.remark = (oldRemark ? oldRemark + ' | ' : '') + '[Deleted ' + rec.deletedAt + ' by Paul]';
    sh.getRange(row, 1, 1, WARN_HEADERS.length).setValues([WARN_HEADERS.map(h => rec[h] === undefined ? '' : rec[h])]);

    // 如果這筆曾送到 Telegram，把原訊息同步標記已刪除並移除所有核可按鈕。
    if (rec.chatId && rec.messageId) {
      const deletedText = '🗑 <b>警告記錄已刪除 Warning Deleted</b>\n' +
        '員工：' + escapeHtml(rec.empName || '') + (rec.empId ? ' #' + escapeHtml(rec.empId) : '') + '\n' +
        '發生日：' + escapeHtml(normDate(rec.incidentDate)) + '\n' +
        '原等級：' + escapeHtml(rec.level || '') + '\n' +
        '刪除人：Paul　' + rec.deletedAt;
      tgEdit(rec.chatId, rec.messageId, deletedText, { inline_keyboard: [] });
    }
    setSnap('warning', warnAll().length, { pending: warnAll().filter(r => r.status === W_PENDING || r.status === W_VERIFIED).length });
    return rawJson({ ok: true, deleted: row, softDeleted: true });
  }

  if (action === 'warnImport') {
    if (!isAdmin) return rawJson({ ok: false, error: '無管理權限 adminCode' });
    const arr = parseData();
    const sh = warnSheet();
    const seen = new Set(warnAll().map(r => r.empName + '_' + r.incidentDate + '_' + r.level));
    let imported = 0, skipped = 0;
    const rows = [];
    arr.forEach(d => {
      const key = (d.empName || '') + '_' + normDate(d.incidentDate) + '_' + (d.level || '');
      if (seen.has(key)) { skipped++; return; }
      seen.add(key);
      rows.push(['W' + Date.now() + '_' + imported, d.timestamp || nowStr(), d.applicant || 'Import', '',
        d.empName || '', d.empId || '', d.empDept || '', d.empPos || '', d.level || '', d.reason || '',
        normDate(d.incidentDate), d.remark || '', '', d.status || W_APPROVED, 'Import', nowStr(),
        warnExpireDate(d.incidentDate, d.level), 'Import', nowStr(), '', '', '', '']);
      imported++;
    });
    if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, WARN_HEADERS.length).setValues(rows);
    const wym={}; arr.forEach(function(x){const y=payReportYm(x.incidentDate);if(y)wym[y]=1;}); Object.keys(wym).forEach(function(y){payTrack('cloud','warning',y,{source:'warnImport'});});
    return rawJson({ ok: true, imported, skipped });
  }

  return rawJson({ ok: false, error: 'Unknown warning action: ' + action });
}

function warnReviewKb(row) {
  return { inline_keyboard: [
    [{ text: '👀 審查通過 Verify', callback_data: 'wV:' + row },
     { text: '↩ 退回 Return',      callback_data: 'wX:' + row }],
    [{ text: '⚠️ 開啟警告系統', url: CFG().BASE_URL + '/warning.html' }]
  ]};
}
function warnApproveKb(row) {
  return { inline_keyboard: [
    [{ text: '✅ 核可 Approve', callback_data: 'wA:' + row },
     { text: '❌ 退件 Reject',  callback_data: 'wR:' + row }],
    [{ text: '⚠️ 開啟警告系統', url: CFG().BASE_URL + '/warning.html' }]
  ]};
}
function warnRecordText(rec, stage, actor) {
  const H = escapeHtml;
  const bigCnt = warnBigFinalCount(rec.empName, rec.empId);
  const terminateAt = num(PropertiesService.getScriptProperties().getProperty('WARN_TERMINATE_COUNT')) || 3;
  const terminate = bigCnt >= terminateAt || String(rec.is7Day || '') === 'Y';
  const lines = [
    '⚠️ <b>員工警告 Employee Warning</b>' + (terminate ? '　🚨 <b>建議終止合約 Recommend Termination</b>' : ''),
    '員工 Employee：' + H(rec.empName || '') + (rec.empId ? ' #' + H(rec.empId) : ''),
    '部門 Dept：' + H(rec.empDept || '—') + '　職位 Position：' + H(rec.empPos || '—'),
    '等級 Level：' + H(rec.level || '') + '　發生日 Incident Date：' + H(normDate(rec.incidentDate)),
    '事由 Reason：' + H(rec.reason || ''),
    '📝 <b>申請人 Applicant：</b>' + H(rec.applicant || '—') + (rec.appDept ? '（' + H(rec.appDept) + '）' : ''),
    '有效大過/最後警告累計 Active Big/Final Warnings：' + bigCnt + ' 次 / time(s)'
  ];
  if (String(rec.is7Day || '') === 'Y') lines.push('❗ 連續曠工 ≥ 7 天');
  lines.push('━━━━━━━━━━━━━━━━');
  if (stage === W_PENDING) {
    lines.push('① ⏳ 等待審查 Awaiting Review（群組任何人可按 / anyone in group may review）');
    lines.push('② ⚪ 尚未輪到 Paul 核可 Paul Approval Not Yet Available');
  } else if (stage === W_VERIFIED) {
    lines.push('① ✅ 已審查 Reviewed by：' + H(actor || rec.reviewer || ''));
    lines.push('② ⏳ 等待 Paul 核可 Awaiting Paul Approval');
  } else if (stage === W_RETURNED) {
    lines.push('↩ <b>已退回 Returned</b>　審查人 Reviewer：' + H(actor || rec.reviewer || ''));
  } else if (stage === W_APPROVED) {
    lines.push('① ✅ 已審查 Reviewed by：' + H(rec.reviewer || ''));
    lines.push('② ✅ <b>已核可 Approved</b>　核可人 Approver：' + H(actor || rec.approver || 'Paul'));
  } else if (stage === W_REJECTED) {
    lines.push('① ✅ 已審查：' + H(rec.reviewer || ''));
    lines.push('② ❌ <b>已退件 Rejected</b>　處理人 Decided by：' + H(actor || rec.approver || 'Paul'));
  }
  lines.push('🕐 ' + nowStr());
  return lines.join('\n') + dashboardBlock();
}
function warnSendTelegramByRow(row) {
  const sh = warnSheet();
  if (row < 2 || row > sh.getLastRow()) return { ok: false, sent: false, error: 'row 不存在' };
  const cur = sh.getRange(row, 1, 1, WARN_HEADERS.length).getValues()[0];
  const rec = {}; WARN_HEADERS.forEach((h, i) => rec[h] = cur[i]);
  const st = String(rec.status || W_PENDING);
  if (st !== W_PENDING && st !== W_VERIFIED) return { ok: false, sent: false, error: '此筆已結案或已退回：' + st };
  const kb = st === W_VERIFIED ? warnApproveKb(row) : warnReviewKb(row);
  const text = warnRecordText(rec, st, rec.reviewer);
  let res = null;

  // v2.8：已有 Telegram messageId 就更新原訊息；沒有才新送。避免網頁審查後另長一則新訊息。
  if (rec.chatId && rec.messageId) {
    res = tgEdit(rec.chatId, rec.messageId, text, kb);
    if (res && res.ok) {
      const wym=payReportYm(rec.incidentDate); if(wym)payTrack('approval','warning',wym,{messageId:String(rec.messageId),edited:true});
      return { ok: true, sent: true, edited: true, row: row, messageId: String(rec.messageId) };
    }
  }

  res = tgSend(CFG().GROUP_ID, text, { reply_markup: JSON.stringify(kb) });
  if (res && res.ok && res.result) {
    rec.chatId = String(CFG().GROUP_ID);
    rec.messageId = String(res.result.message_id || '');
    sh.getRange(row, 1, 1, WARN_HEADERS.length).setValues([WARN_HEADERS.map(h => rec[h] === undefined ? '' : rec[h])]);
    const wym=payReportYm(rec.incidentDate); if(wym)payTrack('approval','warning',wym,{messageId:rec.messageId});
  }
  return { ok: !!(res && res.ok), sent: !!(res && res.ok), row: row,
    messageId: (res && res.result) ? String(res.result.message_id || '') : String(rec.messageId || ''),
    error: (res && !res.ok) ? (res.description || res.error || 'Telegram send failed') : '' };
}
function warnNotifySubmit(d, id, bigFinalCount, terminate) {
  const row = warnSheet().getLastRow();
  // 新申請固定先走群組審查，不提供 Paul 直接跳關。
  return warnSendTelegramByRow(row);
}

function warnVerifyByRow(row, pass, who) {
  const sh = warnSheet();
  if (row < 2 || row > sh.getLastRow()) return null;
  const cur = sh.getRange(row, 1, 1, WARN_HEADERS.length).getValues()[0];
  const rec = {}; WARN_HEADERS.forEach((h, i) => rec[h] = cur[i]);
  const st = String(rec.status || '');
  if (st === W_APPROVED || st === W_REJECTED || st === W_DELETED) return { already: true, rec: rec };
  rec.status = pass ? W_VERIFIED : W_RETURNED;
  rec.reviewer = who || '';
  rec.reviewedAt = nowStr();
  sh.getRange(row, 1, 1, WARN_HEADERS.length).setValues([WARN_HEADERS.map(h => rec[h])]);
  return { already: false, rec: rec };
}
function warnApproveByRow(row, approve, approverName) {
  const sh = warnSheet();
  if (row < 2 || row > sh.getLastRow()) return null;
  const cur = sh.getRange(row, 1, 1, WARN_HEADERS.length).getValues()[0];
  const rec = {}; WARN_HEADERS.forEach((h, i) => rec[h] = cur[i]);
  const st = String(rec.status || '');
  if (st === W_DELETED || st === W_APPROVED || st === W_REJECTED) return null;
  rec.status = approve ? '已核可' : '已退件';
  rec.approver = approverName || 'Paul';
  rec.approveTs = nowStr();
  sh.getRange(row, 1, 1, WARN_HEADERS.length).setValues([WARN_HEADERS.map(h => rec[h])]);
  return rec;
}

/* ═══════════════════════════════════════════════════════════════════════
   APPROVAL v2.1 — 全模組通用群組兩關核可
   前端 POST {type:'approvalRequest', module, period, title, text,
              amount, headcount, route?, items?}
     不論前端 route 為何，一律送群組：第一關審查，第二關 Paul 核可
   第一關按鈕：👀 審查通過（群組任何人）/ ↩ 退回
   第二關按鈕：✅ 核可 / ❌ 退件（僅 Paul）
   ★ 全程只在群組內更新同一則訊息，不私訊 Paul、不允許略過審查
   決議寫入 Sheet「Approvals」，?action=approvalStatus 照舊可查
═══════════════════════════════════════════════════════════════════════ */
const APPROVAL_HEADERS = ['key','module','period','title','amount','headcount',
  'requestedBy','applicant','checker','requestedAt','status','decidedBy','decidedAt','note',
  'route','reviewer','reviewedAt','chatId','messageId','docUrl','items','bodyText',
  'xlsxUrl','pdfUrl','docMessageId'];

/* 狀態文字（Sheet 存中文，API 另外附英文 code 給前端判斷） */
const ST_PENDING  = '待審查';
const ST_VERIFIED = '待核可';
const ST_APPROVED = '已核可';
const ST_REJECTED = '已退件';
const ST_RETURNED = '已退回';
function statusCode(s) {
  s = String(s || '');
  if (s === ST_APPROVED) return 'approved';
  if (s === ST_REJECTED) return 'rejected';
  if (s === ST_VERIFIED) return 'verified';
  if (s === ST_RETURNED) return 'returned';
  return 'pending';
}
function isSettled(s) { return s === ST_APPROVED || s === ST_REJECTED; }

function approvalSheet() {
  const sh = getOrCreateSheet(getSS(), 'Approvals', APPROVAL_HEADERS);
  // v1.0 升級：自動補上新欄位，不動舊資料
  const lastCol = Math.max(sh.getLastColumn(), 1);
  const hdr = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || '').trim());
  let col = lastCol;
  APPROVAL_HEADERS.forEach(h => {
    if (hdr.indexOf(h) < 0) {
      col++;
      sh.getRange(1, col).setValue(h).setFontWeight('bold')
        .setBackground('#1A2540').setFontColor('#FFFFFF');
      hdr.push(h);
    }
  });
  return sh;
}
function moduleLabel(mod) {
  const m = { payroll:'💵 薪資 Payroll', advance:'💰 預支 Advance', advance_pay:'💰 預支 Advance',
              meal:'🍱 餐費 Meal Fee', meal_fee:'🍱 餐費 Meal Fee',
              ot_bonus:'⏱ OT & Bonus', otbonus:'⏱ OT & Bonus', shutdown:'🛑 停工 Shutdown',
              transfer:'🔄 職位異動 Transfer', employee:'👥 員工 HR', warning:'⚠️ 警告 Warning',
              contract:'📄 合約 Contract', maternity:'🤰 產假 Maternity',
              nursing:'🍼 哺乳 Nursing', join:'🆕 入職 Onboarding',
              resign:'👋 離職 Resignation', onboarding:'🆕 入職 Onboarding' };
  return m[mod] || mod;
}
function approvalKey(mod, period) { return String(mod) + '|' + String(period); }
function approvalFind(mod, period) {
  const key = approvalKey(mod, period);
  return sheetObjects(approvalSheet(), APPROVAL_HEADERS).find(r => String(r.key) === key) || null;
}
function approvalWrite(rec) {
  const sh = approvalSheet();
  const vals = APPROVAL_HEADERS.map(h => rec[h] === undefined ? '' : rec[h]);
  if (rec._row) sh.getRange(rec._row, 1, 1, APPROVAL_HEADERS.length).setValues([vals]);
  else sh.appendRow(vals);
}

/* ─── 按鈕 ─── */
function kbReview(mod, period) {
  return { inline_keyboard: [
    [{ text: '👀 審查通過 Verify', callback_data: 'av:' + mod + ':' + period + ':V' },
     { text: '↩ 退回 Return',      callback_data: 'av:' + mod + ':' + period + ':X' }],
    [{ text: '🌐 開啟平台', url: CFG().BASE_URL + '/index.html' }]
  ]};
}
function kbApprove(mod, period) {
  return { inline_keyboard: [
    [{ text: '✅ 核可 Approve', callback_data: 'ap:' + mod + ':' + period + ':A' },
     { text: '❌ 退件 Reject',  callback_data: 'ap:' + mod + ':' + period + ':R' }],
    [{ text: '🌐 開啟平台', url: CFG().BASE_URL + '/index.html' }]
  ]};
}
function stageLine(route, stage, reviewer) {
  const L = '\n━━━━━━━━━━━━━━━━\n';
  return L + '🔀 <b>兩關核可 Two-stage Approval · Review → Approve</b>\n' +
    (stage === ST_PENDING ? '① ⏳ 等待審查 Awaiting Review（群組任何人可按 / anyone in group may review）'
                          : '① ✅ 已審查 Reviewed by：' + escapeHtml(reviewer || '')) + '\n' +
    (stage === ST_VERIFIED ? '② ⏳ 等待 Paul 核可 Awaiting Paul Approval'
     : stage === ST_PENDING ? '② ⚪ 尚未輪到核可 Approval Not Yet Available'
     : '② ✅ 已核可 Approved');
}

function handleApprovalRequest(p) {
  const mod = String(p.module || '').trim();
  const period = String(p.period || '').trim();
  if (!mod || !period) return failCors('approvalRequest missing module/period');

  // v2.1：一律走群組兩關核可；即使前端傳 direct 也轉為 review
  const route = 'review';
  const key = approvalKey(mod, period);
  const existing = approvalFind(mod, period);

  // 冪等：已結案不可重送
  if (existing && isSettled(String(existing.status))) {
    return okCors({ requested: key, status: existing.status, alreadySettled: true, sentToGroup: false,
      note: '此期間已完成核可，未重複送出' });
  }

  const applicant = String(p.applicant || p.requestedBy || '').trim();
  if (!applicant || applicant === 'Web') return failCors('請填申請人 Applicant');
  const checker = String(p.checker || p.inspector || '').trim();
  let body = String(p.text || '');
  body = ensureActorLine(body, 'applicant', applicant);
  const title = String(p.title || (moduleLabel(mod) + ' ' + period));
  const head = '📋 <b>' + escapeHtml(moduleLabel(mod)) + ' — 待審查 Awaiting Review</b>';
  const html = approvalTelegramText(head, body, stageLine(route, ST_PENDING, '') + '\n🕐 ' + nowStr());

  const target = CFG().GROUP_ID;
  const kb = kbReview(mod, period);

  let chatId = String(target), messageId = '', migratedToGroup = false;
  const existingIsGroup = existing && String(existing.chatId || '') === String(target) && existing.messageId;

  if (existingIsGroup) {
    // 只有原訊息本來就在群組，才允許 edit。
    // 舊版可能把 review 記錄綁在 Paul 私聊；那種情況絕不能再 edit 私聊。
    const er = tgEdit(target, existing.messageId, html, kb);
    if (er && er.ok === true) {
      messageId = String(existing.messageId);
    } else {
      // 群組原訊息已被刪除/失效時，重新發一則群組訊息。
      const res = tgSend(target, html, { reply_markup: JSON.stringify(kb) });
      if (!res || res.ok !== true) {
        const why = (res && (res.description || res.error)) ? (res.description || res.error) : 'Telegram sendMessage failed';
        return failCors('Telegram 群組發送失敗: ' + why + ' | chat=' + target);
      }
      messageId = String(res.result && res.result.message_id || '');
    }
  } else {
    // ★ v2.2 關鍵修正：舊 Approvals 若 chatId 是 Paul 私聊，直接遷移到群組。
    // 不再沿用舊 private chatId/messageId。
    const res = tgSend(target, html, { reply_markup: JSON.stringify(kb) });
    if (!res || res.ok !== true) {
      const why = (res && (res.description || res.error)) ? (res.description || res.error) : 'Telegram sendMessage failed';
      return failCors('Telegram 群組發送失敗: ' + why + ' | chat=' + target);
    }
    messageId = String(res.result && res.result.message_id || '');
    migratedToGroup = !!(existing && existing.chatId && String(existing.chatId) !== String(target));
  }

  approvalWrite({
    _row: existing ? existing._row : 0,
    key: key, module: mod, period: period, title: title,
    amount: num(p.amount), headcount: num(p.headcount),
    requestedBy: applicant, applicant: applicant, checker: checker, requestedAt: nowStr(),
    status: ST_PENDING, decidedBy: '', decidedAt: '', note: p.note || '',
    route: route, reviewer: '', reviewedAt: '',
    chatId: chatId, messageId: messageId, docUrl: '',
    items: JSON.stringify(p.items || []).slice(0, 45000),
    // v2.5：保存原始 Telegram 詳細內容。Review 後仍顯示完整明細，不再只剩標題。
    bodyText: body
  });

  const aym=payReportYm(period); if(aym)payTrack('approval',payNormalizeModule(mod,''),aym,{applicant:applicant,messageId:messageId});
  setSnap('approval', sheetObjects(approvalSheet(), APPROVAL_HEADERS).length, { latest: key });
  return okCors({ requested: key, status: ST_PENDING, route: route, sentToGroup: true, chatId: chatId, messageId: messageId, migratedToGroup: migratedToGroup });
}

/* v2.8：核可訊息完整內容保護。
   新送審用 bodyText；舊 Pending 若是 v2.5 前建立、沒有 bodyText，至少由 items 重建可核對摘要。 */
function approvalStoredDetail(rec) {
  const body = String(rec && rec.bodyText || '').trim();
  const applicant = String(rec && (rec.applicant || rec.requestedBy) || '').trim();
  if (body) return ensureActorLine(body, 'applicant', applicant);
  let items = [];
  try { items = JSON.parse(String(rec && rec.items || '[]')); } catch (e) { items = []; }
  const mod = String(rec && rec.module || '');
  if (!items.length) {
    return escapeHtml(String(rec && rec.title || moduleLabel(mod) + ' ' + String(rec && rec.period || '')));
  }
  const sum = (k) => items.reduce((s, x) => s + num(x && x[k]), 0);
  const dept = {};
  items.forEach(x => {
    const d = String(x && x.dept || 'Other');
    if (!dept[d]) dept[d] = { n:0, amount:0 };
    dept[d].n++;
    dept[d].amount += num(x && (x.netPay !== undefined ? x.netPay : x.amount));
  });
  let lines = [];
  if (mod === 'payroll') {
    lines.push('💵 <b>正式薪資發放 Payroll</b>');
    lines.push('📅 期間 Period：' + escapeHtml(String(rec.period || '')));
    lines.push('👥 總人數 Headcount：' + items.length + '　🏭 部門 Depts：' + Object.keys(dept).length);
    lines.push('💵 <b>發放總額 Total Paid：$' + N(sum('netPay') || rec.amount) + '</b>');
    lines.push('固定薪 Base：$' + N(sum('basic')) + '　OT：$' + N(sum('ot')));
    lines.push('獎勵 Bonus/Incentive：$' + N(sum('bonus')) + '　扣項 Deduction：$' + N(sum('deduction')));
  } else if (mod === 'advance' || mod === 'advance_pay') {
    lines.push('💰 <b>預付薪資 Advance Pay</b>');
    lines.push('📅 期間 Period：' + escapeHtml(String(rec.period || '')));
    lines.push('👥 總人數 Headcount：' + items.length + '　💵 <b>總額：$' + N(sum('amount') || rec.amount) + '</b>');
  } else {
    lines.push(escapeHtml(String(rec.title || moduleLabel(mod) + ' ' + String(rec.period || ''))));
    lines.push('👥 人數 Headcount：' + (num(rec.headcount) || items.length));
    if (num(rec.amount)) lines.push('💵 金額 Amount：$' + N(rec.amount));
  }
  const ds = Object.keys(dept).sort((a,b) => dept[b].amount - dept[a].amount);
  if (ds.length) {
    lines.push('— — — — — — — — — —');
    lines.push('<b>各部門明細 By Department</b>');
    ds.slice(0, 35).forEach(d => lines.push(escapeHtml(d) + '：' + dept[d].n + ' 人 · $' + N(dept[d].amount)));
    if (ds.length > 35) lines.push('… +' + (ds.length - 35) + ' departments');
  }
  return ensureActorLine(lines.join('\n'), 'applicant', applicant);
}
function approvalTelegramText(head, detail, tail) {
  head = String(head || ''); detail = String(detail || ''); tail = String(tail || '');
  const MAX = 4050;
  const fixed = head + '\n' + tail;
  const room = Math.max(300, MAX - fixed.length - 20);
  if (detail.length > room) detail = detail.slice(0, room - 38) + '\n…（明細過長，後段已截斷）';
  return head + '\n' + detail + tail;
}

/* ─── 第一關：審查（任何人）─── */
function approvalVerify(mod, period, pass, who) {
  const rec = approvalFind(mod, period);
  if (!rec) return null;
  if (isSettled(String(rec.status))) return { already: true, rec: rec };
  rec.status = pass ? ST_VERIFIED : ST_RETURNED;
  rec.reviewer = who || '';
  rec.reviewedAt = nowStr();

  const detail = approvalStoredDetail(rec);
  // 舊批次沒有 bodyText 時，第一次 Review 就順便回填重建內容，後續最終核可也能繼續保留。
  if (!String(rec.bodyText || '').trim()) rec.bodyText = detail;
  approvalWrite(rec);

  const head = pass
    ? '📋 <b>' + escapeHtml(moduleLabel(mod)) + ' — 待核可 Awaiting Approval</b>'
    : '📋 <b>' + escapeHtml(moduleLabel(mod)) + '</b>';
  const tail = pass
    ? stageLine(String(rec.route || 'review'), ST_VERIFIED, who) + '\n🕐 ' + nowStr()
    : '\n━━━━━━━━━━━━━━━━\n↩ <b>已退回 Returned</b> — 審查人 Reviewer：' + escapeHtml(who || '') + '\n🕐 ' + nowStr();
  const bodyHtml = approvalTelegramText(head, detail, tail);
  if (rec.chatId && rec.messageId) {
    const er = tgEdit(rec.chatId, rec.messageId, bodyHtml, pass ? kbApprove(mod, period) : { inline_keyboard: [] });
    if (!er || er.ok !== true) {
      // edit 失敗時不要靜默；另送群組一則完整狀態，避免只看到縮掉/舊內容。
      tgSend(CFG().GROUP_ID, bodyHtml, { reply_markup: JSON.stringify(pass ? kbApprove(mod, period) : { inline_keyboard: [] }) });
    }
  }
  return { already: false, rec: rec };
}

/* ─── 第二關：核可（僅 Paul）─── */
function approvalDecide(mod, period, approve, who) {
  const rec = approvalFind(mod, period);
  if (!rec) return null;
  rec.status = approve ? ST_APPROVED : ST_REJECTED;
  rec.decidedBy = who || 'Paul';
  rec.decidedAt = nowStr();

  let docs = null;
  if (approve && V2.AUTO_DOC) {
    let items = [];
    try { items = JSON.parse(String(rec.items || '[]')); } catch (e) { items = []; }
    docs = generateApprovalDoc(rec, items);
    if (docs) {
      rec.docUrl = docs.url || '';
      rec.xlsxUrl = docs.xlsxUrl || '';
      rec.pdfUrl = docs.pdfUrl || '';
    }
  }
  approvalWrite(rec);
  rec._docs = docs;
  return rec;
}

/* ═══════════════════════════════════════════════════════════════════════
   核可通過 → 產生 Google Sheet（知道連結即可讀）→ 回貼三個連結
═══════════════════════════════════════════════════════════════════════ */
const DOC_FIELD_ORDER = [
  ['empId','工號 ID'], ['name','姓名 Name'], ['empName','姓名 Name'],
  ['joinDate','到職日 Join'], ['dept','部門 Dept'], ['position','職務 Position'],
  ['origDept','原部門 From'], ['origPos','原職務 From Pos'],
  ['newDept','新部門 To'], ['newPos','新職務 To Pos'],
  ['reason','原因 Reason'], ['effDate','生效日 Effective'], ['effectiveDate','生效日 Effective'],
  ['startDate','開始日 Start'], ['endDate','結束日 End'], ['days','天數 Days'],
  ['qty','數量 Qty'], ['rate','費率 Rate'], ['hours','時數 Hours'],
  ['beforeTotal','調整前 Before'], ['afterTotal','調整後 After'], ['diff','差額 Diff'],
  ['basic','基本薪資 Basic'], ['ot','加班 OT'], ['bonus','獎金 Bonus'],
  ['deduction','扣款 Deduction'], ['netPay','實發 Net'], ['amount','金額 Amount'],
  ['status','狀態 Status'], ['note','備註 Remark'], ['remark','備註 Remark']
];
function flattenItem(r) {
  const o = {};
  Object.keys(r || {}).forEach(k => {
    const v = r[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      let sum = 0, has = false;
      Object.keys(v).forEach(k2 => {
        o[k + '.' + k2] = v[k2];
        if (typeof v[k2] === 'number') { sum += v[k2]; has = true; }
      });
      if (has) o[k + 'Total'] = Math.round(sum * 100) / 100;
    } else if (!Array.isArray(v)) o[k] = v;
  });
  if (o.beforeTotal != null && o.afterTotal != null && o.diff == null) {
    o.diff = Math.round((o.afterTotal - o.beforeTotal) * 100) / 100;
  }
  return o;
}
function approvalFileCode(mod) {
  const m = {
    payroll:'Payroll', advance:'Advance_Pay', advance_pay:'Advance_Pay',
    meal:'Meal_Fee', meal_fee:'Meal_Fee', ot_bonus:'OT_Bonus', otbonus:'OT_Bonus',
    shutdown:'Shutdown', transfer:'Transfer', employee:'Employee_HR', warning:'Warning',
    contract:'Contract', maternity:'Maternity', nursing:'Nursing',
    join:'Onboarding', resign:'Resignation', onboarding:'Onboarding'
  };
  return m[String(mod || '')] || String(mod || 'Report').replace(/[^A-Za-z0-9_-]/g, '_');
}
function approvalReportFolder() {
  const root = getOrCreateFolder();
  const name = 'Approved_Reports';
  const it = root.getFoldersByName(name);
  return it.hasNext() ? it.next() : root.createFolder(name);
}
function exportSpreadsheetBlob(id, format, filename) {
  let url = 'https://docs.google.com/spreadsheets/d/' + id + '/export?format=' + encodeURIComponent(format);
  if (format === 'pdf') {
    url += '&portrait=true&fitw=true&gridlines=false&printtitle=false&sheetnames=false&pagenumbers=false&fzr=true';
  }
  const res = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  if (code < 200 || code >= 300) throw new Error('export ' + format + ' HTTP ' + code + ': ' + res.getContentText().slice(0, 300));
  return res.getBlob().setName(filename);
}
function generateApprovalDoc(rec, items) {
  try {
    const mod = String(rec.module || ''), period = String(rec.period || '');
    const stamp = Utilities.formatDate(new Date(), CFG().TZ, 'yyyyMMdd_HHmmss');
    const safePeriod = period.replace(/[^\w\-]/g, '-');
    const base = 'AC-HRA-PAY_' + approvalFileCode(mod) + '_' + safePeriod + '_Approved_' + stamp;
    const ss = SpreadsheetApp.create(base);
    const sh = ss.getActiveSheet();
    sh.setName('Approved');

    sh.appendRow(['核可文件 Approval Document']);
    sh.appendRow(['平台 Platform', 'AC-HRA-PAY · Vantage River Textiles']);
    sh.appendRow(['模組 Module', moduleLabel(mod)]);
    sh.appendRow(['期間 Period', period]);
    sh.appendRow(['標題 Title', String(rec.title || '')]);
    sh.appendRow(['申請人 Applicant', String(rec.applicant || rec.requestedBy || '')]);
    sh.appendRow(['檢查人 Checked by', String(rec.checker || '')]);
    sh.appendRow(['人數 Headcount', num(rec.headcount)]);
    sh.appendRow(['金額 Amount', num(rec.amount)]);
    sh.appendRow(['核可路徑 Route', '兩關核可 Review → Approve']);
    sh.appendRow(['審查人 Reviewer', String(rec.reviewer || '')]);
    sh.appendRow(['核可人 Approver', String(rec.decidedBy || 'Paul')]);
    sh.appendRow(['核可時間 Time', String(rec.decidedAt || nowStr())]);
    sh.appendRow(['批次鍵 Key', String(rec.key || '')]);
    sh.appendRow([]);

    const flat = (items || []).map(flattenItem);
    if (flat.length) {
      const seen = {}, cols = [], labels = [];
      DOC_FIELD_ORDER.forEach(pair => {
        if (seen[pair[0]]) return;
        for (let i = 0; i < flat.length; i++) {
          if (flat[i][pair[0]] !== undefined) { cols.push(pair[0]); labels.push(pair[1]); seen[pair[0]] = 1; break; }
        }
      });
      flat.forEach(r => Object.keys(r).forEach(k => {
        if (seen[k]) return;
        if (/^(id|src|kindLock|batchKey|updatedAt|file|sheet|_bk|_diff|kind|_row)$/.test(k)) return;
        seen[k] = 1; cols.push(k); labels.push(k);
      }));
      const hdrRow = sh.getLastRow() + 1;
      sh.appendRow(['#'].concat(labels));
      const body = flat.map((r, i) => [i + 1].concat(cols.map(c => {
        const v = r[c]; return (v === undefined || v === null) ? '' : v;
      })));
      if (body.length) sh.getRange(sh.getLastRow() + 1, 1, body.length, cols.length + 1).setValues(body);

      const totals = ['', '總計 Total'];
      for (let c = 1; c < cols.length; c++) {
        let total = 0, isNum = false;
        flat.forEach(r => {
          const v = Number(r[cols[c]]);
          if (isFinite(v) && r[cols[c]] !== '' && r[cols[c]] != null) { total += v; isNum = true; }
        });
        totals.push(isNum && /amount|diff|total|qty|days|rate|pay|bonus|ot|hours|basic|deduction/i.test(cols[c])
          ? Math.round(total * 100) / 100 : '');
      }
      sh.appendRow([]);
      sh.appendRow(totals);
      sh.getRange(hdrRow, 1, 1, cols.length + 1).setFontWeight('bold')
        .setBackground('#1A2540').setFontColor('#FFFFFF');
      sh.getRange(sh.getLastRow(), 1, 1, cols.length + 1).setFontWeight('bold').setBackground('#EEF2FF');
      sh.setFrozenRows(hdrRow);
    } else {
      sh.appendRow(['摘要 Summary']);
      const plain = String(rec.bodyText || rec.title || '').replace(/<[^>]*>/g, '');
      plain.split('\n').forEach(ln => { if (ln.trim()) sh.appendRow([ln]); });
      sh.appendRow(['（此模組尚未傳送明細 items，故保存核可摘要）']);
    }
    sh.getRange(1, 1).setFontWeight('bold').setFontSize(14);
    sh.getRange(1, 1, 13, 1).setFontWeight('bold');
    try { sh.autoResizeColumns(1, Math.min(sh.getLastColumn(), 26)); } catch (e) {}
    SpreadsheetApp.flush();

    const sheetFile = DriveApp.getFileById(ss.getId());
    const folder = approvalReportFolder();
    try { sheetFile.moveTo(folder); } catch (e) {}
    sheetFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    const id = ss.getId();
    const xlsxBlob = exportSpreadsheetBlob(id, 'xlsx', base + '.xlsx');
    const pdfBlob  = exportSpreadsheetBlob(id, 'pdf',  base + '.pdf');
    const xlsxFile = folder.createFile(xlsxBlob);
    const pdfFile  = folder.createFile(pdfBlob);
    xlsxFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return {
      url: ss.getUrl(),
      xlsxUrl: 'https://drive.google.com/uc?export=download&id=' + xlsxFile.getId(),
      pdfUrl : 'https://drive.google.com/uc?export=download&id=' + pdfFile.getId(),
      xlsxViewUrl: xlsxFile.getUrl(),
      pdfViewUrl: pdfFile.getUrl(),
      xlsxFileId: xlsxFile.getId(),
      pdfFileId: pdfFile.getId(),
      xlsxBlob: xlsxBlob,
      filename: base + '.xlsx'
    };
  } catch (e) {
    console.error('generateApprovalDoc: ' + e);
    return null;
  }
}

/* v3.2：核可完成後把正式核可檔直接送到 Telegram 群組，並附永久下載連結。 */
function tgSendDocument(chatId, blob, caption, keyboard) {
  try {
    const payload = {
      chat_id: String(chatId),
      document: blob,
      caption: String(caption || '').substring(0, 1000),
      parse_mode: 'HTML'
    };
    if (keyboard) payload.reply_markup = JSON.stringify(keyboard);
    const res = UrlFetchApp.fetch(TG() + '/sendDocument', {
      method: 'post', payload: payload, muteHttpExceptions: true
    });
    return JSON.parse(res.getContentText());
  } catch (e) { return { ok:false, error:String(e) }; }
}
function approvalDocKeyboard(docs) {
  const rows = [];
  if (docs && docs.xlsxUrl) rows.push([{ text:'📥 Excel 下載 Download', url:docs.xlsxUrl }]);
  if (docs && docs.pdfUrl)  rows.push([{ text:'📄 PDF 下載 Download', url:docs.pdfUrl }]);
  if (docs && docs.url)     rows.push([{ text:'🌐 線上檢視 Online', url:docs.url }]);
  rows.push([{ text:'📊 AC-HRA-PAY Dashboard', url:CFG().BASE_URL + '/index.html' }]);
  return { inline_keyboard: rows };
}
function sendApprovedReportToGroup(rec, docs) {
  if (!rec || !docs) return null;
  const caption = '📎 <b>核可報告 Approved Report</b>\n' +
    '模組 Module：' + escapeHtml(moduleLabel(rec.module)) + '\n' +
    '期間 Period：' + escapeHtml(String(rec.period || '')) + '\n' +
    (num(rec.headcount) ? '人數 Headcount：' + N(rec.headcount) + '\n' : '') +
    (num(rec.amount) ? '金額 Amount：$' + N(rec.amount) + '\n' : '') +
    '申請人 Applicant：' + escapeHtml(String(rec.applicant || rec.requestedBy || '')) + '\n' +
    (rec.reviewer ? '審查人 Reviewer：' + escapeHtml(String(rec.reviewer)) + '\n' : '') +
    '核可人 Approver：' + escapeHtml(String(rec.decidedBy || 'Paul')) + '\n' +
    '核可時間 Approved at：' + escapeHtml(String(rec.decidedAt || nowStr()));
  let res = null;
  if (docs.xlsxBlob) {
    res = tgSendDocument(CFG().GROUP_ID, docs.xlsxBlob, caption, approvalDocKeyboard(docs));
  }
  if (!res || res.ok !== true) {
    // 附件若因 Telegram/大小限制失敗，仍保證群組有可點擊下載連結。
    res = tgSend(CFG().GROUP_ID, caption + '\n\n📄 <b>核可文件 Approved Files</b>', {
      reply_markup: JSON.stringify(approvalDocKeyboard(docs))
    });
  }
  if (res && res.ok === true && res.result && res.result.message_id) {
    rec.docMessageId = String(res.result.message_id);
    approvalWrite(rec);
  }
  return res;
}

function approvalList(mod, period) {
  let list = sheetObjects(approvalSheet(), APPROVAL_HEADERS);
  if (mod)    list = list.filter(r => String(r.module) === String(mod));
  if (period) list = list.filter(r => String(r.period) === String(period));
  list.sort((a, b) => String(b.requestedAt).localeCompare(String(a.requestedAt)));
  return { records: list.map(r => {
    const o = {};
    APPROVAL_HEADERS.forEach(h => { if (h !== 'items') o[h] = r[h]; });
    o.code = statusCode(r.status);          // 前端用這個判斷比較穩
    return o;
  })};
}

function approvalTxt() {
  const list = sheetObjects(approvalSheet(), APPROVAL_HEADERS);
  if (!list.length) return '📋 尚無核可請求' + dashboardBlock();
  const wait = list.filter(r => String(r.status) === ST_PENDING);
  const appr = list.filter(r => String(r.status) === ST_VERIFIED);
  const lines = ['📋 <b>核可狀態 Approvals</b>',
    '待審查：' + N(wait.length) + '　待核可：' + N(appr.length) + '　總計：' + N(list.length)];
  if (wait.length) {
    lines.push('\n👀 <b>等待審查</b>（群組任何人可按）');
    wait.slice(0, 6).forEach(r => lines.push('▪ ' + escapeHtml(moduleLabel(r.module)) + '　' +
      escapeHtml(String(r.period)) + (r.amount ? '　$' + N(r.amount) : '')));
  }
  if (appr.length) {
    lines.push('\n✅ <b>等待 Paul 核可</b>');
    appr.slice(0, 6).forEach(r => lines.push('▪ ' + escapeHtml(moduleLabel(r.module)) + '　' +
      escapeHtml(String(r.period)) + (r.amount ? '　$' + N(r.amount) : '')));
  }
  return lines.join('\n') + dashboardBlock();
}

/* ═══════════════════════════════════════════════════════════════════════
   DASHBOARD — 每則摘要底部自動附上
═══════════════════════════════════════════════════════════════════════ */
function computeDashboard() {
  const out = { ts: nowStr(), month: Utilities.formatDate(new Date(), CFG().TZ, 'yyyy-MM'),
                approval: { pending: 0, verified: 0, approved: 0, rejected: 0, overdue: 0 },
                modules: [], amount: 0, headcount: 0, sync: {} };
  try {
    const list = sheetObjects(approvalSheet(), APPROVAL_HEADERS);
    const now = new Date(), modSet = {};
    list.forEach(r => {
      const st = String(r.status || ''), mod = String(r.module || '');
      if (mod) modSet[mod] = (modSet[mod] || 0) + 1;
      if (st === ST_PENDING)  out.approval.pending++;
      else if (st === ST_VERIFIED) out.approval.verified++;
      else if (st === ST_APPROVED) out.approval.approved++;
      else if (st === ST_REJECTED) out.approval.rejected++;
      if (st === ST_PENDING || st === ST_VERIFIED) {
        const c = new Date(r.requestedAt);
        if (!isNaN(c) && (now - c) / 86400000 > V2.OVERDUE_DAYS) out.approval.overdue++;
      }
      if (String(r.period).indexOf(out.month) >= 0) {
        out.amount += num(r.amount); out.headcount += num(r.headcount);
      }
    });
    out.modules = Object.keys(modSet).map(k => ({ name: k, n: modSet[k] }))
      .sort((a, b) => b.n - a.n);
  } catch (e) { out.error = String(e); }
  try {
    SYNC_TOOLS.forEach(t => { const m = getSnap(t); if (m) out.sync[t] = m.recordCount; });
  } catch (e) {}
  return out;
}
function dashboardBlock() {
  if (!V2.APPEND_DASHBOARD) return '';
  try {
    const d = computeDashboard();
    let s = '\n━━━━━━━━━━━━━━━━\n📊 <b>平台概況 Dashboard</b>\n';
    s += '👀 待審 ' + d.approval.pending + '　✅ 待核 ' + d.approval.verified +
         '　✔ 已核 ' + d.approval.approved + '　❌ 退件 ' + d.approval.rejected + '\n';
    if (d.approval.overdue) {
      s += '⏰ <b>逾期未處理 ' + d.approval.overdue + ' 件</b>（超過 ' + V2.OVERDUE_DAYS + ' 天）\n';
    }
    s += '📅 ' + d.month + '：' + N(d.headcount) + ' 人次';
    if (d.amount) s += '　$' + N(Math.round(d.amount));
    s += '\n';
    if (d.modules.length) {
      s += '📦 ' + d.modules.slice(0, 6).map(m => escapeHtml(m.name) + ' ' + m.n).join('　') + '\n';
    }
    s += '🏠 ' + CFG().BASE_URL + '/index.html';
    return s;
  } catch (e) { return ''; }
}

/* ═══════════════════════════════════════════════════════════════════════
   ANOMALY — 四種異常：超預算 / 逾期未核 / 異常調薪 / 高頻異動
═══════════════════════════════════════════════════════════════════════ */
const BUDGET_HEADERS = ['module','month','budget','note'];
function budgetSheet() {
  const sh = getOrCreateSheet(getSS(), 'Budget', BUDGET_HEADERS);
  if (sh.getLastRow() <= 1) {
    sh.getRange(2, 1, 8, 4).setValues([
      ['payroll',  '', 0, '填 0 = 不檢查；填金額才會納入超預算判斷。月份留空 = 每月適用'],
      ['meal',     '', 0, ''],
      ['advance',  '', 0, ''],
      ['ot_bonus', '', 0, ''],
      ['transfer', '', 0, ''],
      ['contract', '', 0, ''],
      ['maternity','', 0, ''],
      ['resign',   '', 0, ''],
    ]);
  }
  return sh;
}
function computeAnomalies() {
  const out = { overBudget: [], overdue: [], abnormalAdj: [], frequentMove: [], generatedAt: nowStr() };
  try {
    const list = sheetObjects(approvalSheet(), APPROVAL_HEADERS);
    const now = new Date();
    const thisMonth = Utilities.formatDate(new Date(), CFG().TZ, 'yyyy-MM');

    /* ① 超預算 */
    const budgets = {};
    sheetObjects(budgetSheet(), BUDGET_HEADERS).forEach(b => {
      const mod = String(b.module || '').trim(); if (!mod) return;
      const amt = num(b.budget); if (amt <= 0) return;
      budgets[mod + '|' + (String(b.month || '').trim() || '*')] = amt;
    });
    const spent = {};
    list.forEach(r => {
      const st = String(r.status || '');
      if (st === ST_REJECTED || st === ST_RETURNED) return;
      if (String(r.period).indexOf(thisMonth) < 0) return;
      const mod = String(r.module || '');
      spent[mod] = (spent[mod] || 0) + num(r.amount);
    });
    Object.keys(spent).forEach(mod => {
      const b = budgets[mod + '|' + thisMonth] || budgets[mod + '|*'] || 0;
      if (b > 0 && spent[mod] > b) {
        out.overBudget.push({ module: mod, month: thisMonth, budget: b,
          spent: Math.round(spent[mod]), over: Math.round(spent[mod] - b),
          pct: Math.round((spent[mod] / b - 1) * 100) });
      }
    });

    /* ② 逾期未核 */
    list.forEach(r => {
      const st = String(r.status || '');
      if (st !== ST_PENDING && st !== ST_VERIFIED) return;
      const c = new Date(r.requestedAt);
      if (isNaN(c)) return;
      const days = Math.floor((now - c) / 86400000);
      if (days > V2.OVERDUE_DAYS) {
        out.overdue.push({ module: String(r.module), period: String(r.period), days: days,
          who: st === ST_VERIFIED ? 'Paul（待核可）' : '群組（待審查）' });
      }
    });

    /* ③ 異常調薪 */
    list.forEach(r => {
      const st = String(r.status || '');
      if (st === ST_REJECTED || st === ST_RETURNED) return;
      let items = [];
      try { items = JSON.parse(String(r.items || '[]')); } catch (e) { return; }
      (items || []).forEach(it => {
        const f = flattenItem(it);
        const d = Number(f.diff);
        if (!isFinite(d) || d === 0) return;
        const base = Number(f.beforeTotal) || 0;
        const pct = base > 0 ? Math.abs(d) / base : 0;
        if (Math.abs(d) >= V2.ADJ_ALERT || pct >= V2.ADJ_PCT) {
          out.abnormalAdj.push({ module: String(r.module), period: String(r.period),
            empId: f.empId || '', name: f.name || f.empName || '',
            diff: Math.round(d * 100) / 100, before: base,
            pct: base > 0 ? Math.round(pct * 100) : null });
        }
      });
    });

    /* ④ 高頻異動 */
    const moves = {};
    list.forEach(r => {
      if (String(r.module).indexOf('transfer') < 0) return;
      let items = [];
      try { items = JSON.parse(String(r.items || '[]')); } catch (e) { return; }
      (items || []).forEach(it => {
        const f = flattenItem(it);
        const id = String(f.empId || '').toUpperCase(); if (!id) return;
        const dt = String(f.effDate || f.effectiveDate || '');
        if (!moves[id]) moves[id] = { name: f.name || f.empName || '', dates: {} };
        if (dt) moves[id].dates[dt] = 1;
      });
    });
    Object.keys(moves).forEach(id => {
      const ds = Object.keys(moves[id].dates).sort();
      if (ds.length < V2.MOVE_ALERT) return;
      for (let i = 0; i + V2.MOVE_ALERT - 1 < ds.length; i++) {
        const a = new Date(ds[i] + 'T00:00:00'), b = new Date(ds[i + V2.MOVE_ALERT - 1] + 'T00:00:00');
        if (isNaN(a) || isNaN(b)) continue;
        if ((b - a) / 86400000 <= V2.MOVE_WINDOW) {
          out.frequentMove.push({ empId: id, name: moves[id].name, times: ds.length,
            from: ds[i], to: ds[i + V2.MOVE_ALERT - 1] });
          break;
        }
      }
    });
  } catch (e) { out.error = String(e); }
  return out;
}
function anomalyCounts(a) {
  return { overBudget: a.overBudget.length, overdue: a.overdue.length,
           abnormalAdj: a.abnormalAdj.length, frequentMove: a.frequentMove.length };
}
function anomalyText(a) {
  const L = '━━━━━━━━━━━━━━━━';
  let s = '⚠️ <b>AC-HRA-PAY 異常報告 Anomaly Report</b>\n' + L + '\n';
  let any = false;
  if (a.overBudget.length) { any = true;
    s += '\n💰 <b>超預算 Over Budget</b>（' + a.overBudget.length + '）\n';
    a.overBudget.slice(0, 10).forEach(x => {
      s += '• ' + escapeHtml(moduleLabel(x.module)) + ' ' + x.month + '：$' + N(x.spent) +
           ' / 預算 $' + N(x.budget) + '（超 $' + N(x.over) + '　+' + x.pct + '%）\n';
    });
  }
  if (a.overdue.length) { any = true;
    s += '\n⏰ <b>逾期未處理 Overdue</b>（' + a.overdue.length + '　>' + V2.OVERDUE_DAYS + ' 天）\n';
    a.overdue.slice(0, 10).forEach(x => {
      s += '• ' + escapeHtml(moduleLabel(x.module)) + ' ' + escapeHtml(x.period) +
           '：' + x.days + ' 天　卡在 ' + escapeHtml(x.who) + '\n';
    });
  }
  if (a.abnormalAdj.length) { any = true;
    s += '\n📈 <b>異常調薪 Abnormal Adjustment</b>（' + a.abnormalAdj.length + '）\n';
    a.abnormalAdj.slice(0, 10).forEach(x => {
      s += '• ' + escapeHtml(String(x.empId)) + ' ' + escapeHtml(String(x.name)) + '：' +
           (x.diff > 0 ? '+' : '') + x.diff +
           (x.pct != null ? '（' + (x.diff > 0 ? '+' : '-') + x.pct + '%）' : '') + '\n';
    });
  }
  if (a.frequentMove.length) { any = true;
    s += '\n🔁 <b>高頻異動 Frequent Movement</b>（' + a.frequentMove.length + '）\n';
    a.frequentMove.slice(0, 10).forEach(x => {
      s += '• ' + escapeHtml(String(x.empId)) + ' ' + escapeHtml(String(x.name)) +
           '：' + x.times + ' 次（' + x.from + ' ~ ' + x.to + '）\n';
    });
  }
  if (!any) s += '\n✅ 目前無異常 No anomalies detected\n';
  return s + L + '\n🕐 ' + a.generatedAt + dashboardBlock();
}
/* 每日觸發：沒異常就不發訊息，不洗版 */
function dailyAnomaly() {
  const a = computeAnomalies();
  const c = anomalyCounts(a);
  if (!(c.overBudget + c.overdue + c.abnormalAdj + c.frequentMove)) return;
  tgSend(CFG().GROUP_ID, anomalyText(a));
}
function ensureAnomalyTrigger() {
  const has = ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'dailyAnomaly');
  if (!has) ScriptApp.newTrigger('dailyAnomaly').timeBased().atHour(8).everyDays(1).create();
  console.log('dailyAnomaly 觸發器：' + (has ? '已存在' : '已建立'));
}

/* 待處理清單 */
function pendingTxt() {
  const list = sheetObjects(approvalSheet(), APPROVAL_HEADERS);
  const wait = list.filter(r => String(r.status) === ST_PENDING);
  const appr = list.filter(r => String(r.status) === ST_VERIFIED);
  const L = '━━━━━━━━━━━━━━━━';
  let s = '📋 <b>待處理清單 Pending</b>\n' + L;
  if (!wait.length && !appr.length) return s + '\n\n✅ 沒有待處理項目 All clear' + dashboardBlock();
  if (wait.length) {
    s += '\n\n👀 <b>等待審查</b>（' + wait.length + '　群組任何人可按）\n';
    wait.slice(0, 12).forEach(r => s += '• ' + escapeHtml(moduleLabel(r.module)) + '　' +
      escapeHtml(String(r.period)) + '　' + escapeHtml(String(r.title || '').slice(0, 36)) + '\n');
  }
  if (appr.length) {
    s += '\n✅ <b>等待 Paul 核可</b>（' + appr.length + '）\n';
    appr.slice(0, 12).forEach(r => s += '• ' + escapeHtml(moduleLabel(r.module)) + '　' +
      escapeHtml(String(r.period)) + '　審查人 ' + escapeHtml(String(r.reviewer || '')) + '\n');
  }
  return s + dashboardBlock();
}

/* ═══════════════════════════════════════════════════════════════════════
   TELEGRAM — 輪詢 / 指令 / 控制面板
═══════════════════════════════════════════════════════════════════════ */
function ensureTrigger() {
  const has = ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'pollTelegram');
  if (!has) ScriptApp.newTrigger('pollTelegram').timeBased().everyMinutes(1).create();
  console.log('pollTelegram 觸發器：' + (has ? '已存在' : '已建立'));
}

function registerBotCommands() {
  const cmds = [
    { command: 'hrpay',     description: 'AC-HRA-PAY 控制面板' },
    { command: 'dashboard', description: '📊 平台概況 Dashboard' },
    { command: 'anomaly',   description: '⚠️ 異常報告 Anomaly' },
    { command: 'pending',   description: '📋 待處理清單' },
    { command: 'payroll',   description: '薪資摘要 Payroll' },
    { command: 'meal',      description: '餐費摘要 Meal Fee' },
    { command: 'advance',   description: '預支摘要 Advance' },
    { command: 'transfer',  description: '職位異動 Transfer' },
    { command: 'shutdown',  description: '停工摘要 Shutdown' },
    { command: 'ot',        description: 'OT & Bonus 摘要' },
    { command: 'warning',   description: '警告摘要 Warning' },
    { command: 'summary',   description: '總覽 Summary' },
    { command: 'hrreport',  description: '完整 HR 報告' },
    { command: 'approve',   description: '待核可清單 Approvals' },
    { command: 'status',    description: '雲端同步狀態' },
    { command: 'settings',  description: '設定資訊' },
    { command: 'help',      description: '指令說明' },
  ];
  UrlFetchApp.fetch(TG() + '/setMyCommands', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    payload: JSON.stringify({ commands: cmds })
  });
}

function pollTelegram() {
  const props = PropertiesService.getScriptProperties();
  let offset = parseInt(props.getProperty('tg_offset') || '0', 10);
  try {
    const res = UrlFetchApp.fetch(TG() + '/getUpdates?offset=' + offset + '&timeout=0', { muteHttpExceptions: true });
    const data = JSON.parse(res.getContentText());
    if (!data.ok) return;
    for (const upd of data.result) {
      offset = upd.update_id + 1;
      try {
        if (upd.message)        handleTelegramMessage(upd.message);
        if (upd.callback_query) handleCallbackQuery(upd.callback_query);
      } catch (e) { console.error(e); }
    }
    props.setProperty('tg_offset', String(offset));
  } catch (e) { console.error(e); }
}

function handleTelegramMessage(msg) {
  const text = (msg.text || '').trim();
  if (!text) return;
  const chatId = String(msg.chat.id);
  const fromName = (((msg.from && msg.from.first_name) || '') + ' ' + ((msg.from && msg.from.last_name) || '')).trim() ||
                   ((msg.from && msg.from.username) ? '@' + msg.from.username : String((msg.from && msg.from.id) || 'Telegram'));
  const checkedSummary = s => ensureActorLine(String(s || ''), 'checker', fromName);
  const cmd = text.split(/[\s@]/)[0].toLowerCase();

  switch (cmd) {
    case '/start':
    case '/help':
      tgSend(chatId,
        '🤖 <b>AC-HRA-PAY Bot v2.9</b>\n\n' +
        '/hrpay — 控制面板（開啟平台各模組）\n' +
        '/dashboard — 📊 平台概況\n' +
        '/anomaly — ⚠️ 異常報告（超預算／逾期／異常調薪／高頻異動）\n' +
        '/pending — 📋 待處理清單\n' +
        '/approve — 核可狀態\n' +
        '/payroll /meal /advance — 薪資/餐費/預支摘要\n' +
        '/transfer — 職位異動待核可清單\n' +
        '/shutdown /ot /warning — 停工/OT/警告摘要\n' +
        '/summary — 交叉核對總覽\n' +
        '/hrreport — 完整 HR 報告\n' +
        '/status — 雲端同步狀態\n' +
        '/settings — 設定資訊\n\n' +
        '<b>核可流程</b>\n' +
        '👀 審查通過 — 群組任何人都能按（第一關）\n' +
        '✅ 核可 / ❌ 退件 — 只有 Paul（第二關）\n' +
        '全程在群組完成，不私訊、不跳過第一關。\n' +
        '核可通過會自動附上 Excel／PDF／線上檢視 三個連結。');
      break;
    case '/hrpay':
    case '/pay':
    case '/hrpay_menu':
      buildHRPayMenu(chatId);
      break;
    case '/dashboard':
    case '/db':       tgSend(chatId, '📊 <b>AC-HRA-PAY</b>' + dashboardBlock()); break;
    case '/anomaly':
    case '/alert':    tgSend(chatId, anomalyText(computeAnomalies())); break;
    case '/pending':  tgSend(chatId, pendingTxt()); break;
    case '/payroll':  tgSend(chatId, checkedSummary(payTxt()) + dashboardBlock());   break;
    case '/meal':     tgSend(chatId, checkedSummary(mealTxt()) + dashboardBlock());  break;
    case '/advance':  tgSend(chatId, checkedSummary(advTxt()) + dashboardBlock());   break;
    case '/transfer': tgSend(chatId, checkedSummary(hrTxt()) + dashboardBlock());    break;
    case '/shutdown': tgSend(chatId, checkedSummary(shutTxt()) + dashboardBlock());  break;
    case '/ot':       tgSend(chatId, checkedSummary(otTxt()) + dashboardBlock());    break;
    case '/warning':  tgSend(chatId, checkedSummary(warnTxt()) + dashboardBlock());  break;
    case '/summary':  tgSend(chatId, checkedSummary(sumTxt()) + dashboardBlock());   break;
    case '/hrreport': tgSend(chatId, checkedSummary(hrReportTxt()) + dashboardBlock()); break;
    case '/approve':  tgSend(chatId, approvalTxt()); break;
    case '/status':   tgSend(chatId, statusTxt() + dashboardBlock()); break;
    case '/settings': tgSend(chatId, settingsTxt()); break;
  }
}

function buildHRPayMenu(chatId) {
  const cfg = CFG();
  const today = Utilities.formatDate(new Date(), cfg.TZ, 'MM/dd');
  const kb = [];
  kb.push([{ text: '🌐 開啟平台 Open Platform', url: cfg.BASE_URL + '/index.html' }]);
  for (let i = 0; i < MODULES.length; i += 2) {
    const row = [{ text: MODULES[i].icon + ' ' + MODULES[i].tc, url: cfg.BASE_URL + '/' + MODULES[i].file }];
    if (MODULES[i + 1]) row.push({ text: MODULES[i + 1].icon + ' ' + MODULES[i + 1].tc, url: cfg.BASE_URL + '/' + MODULES[i + 1].file });
    kb.push(row);
  }
  kb.push([{ text: '💵 薪資摘要', callback_data: 'q:pay' },
           { text: '🍱 餐費摘要', callback_data: 'q:meal' },
           { text: '💰 預支摘要', callback_data: 'q:adv' }]);
  kb.push([{ text: '🛑 停工摘要', callback_data: 'q:shut' },
           { text: '⏱ OT 摘要',  callback_data: 'q:ot' },
           { text: '⚠️ 警告摘要', callback_data: 'q:warn' }]);
  kb.push([{ text: '🔄 異動待核可', callback_data: 'q:hr' },
           { text: '📊 總覽',       callback_data: 'q:sum' },
           { text: '🔄 同步狀態',   callback_data: 'q:stat' }]);
  kb.push([{ text: '📋 待處理清單', callback_data: 'q:pend' },
           { text: '📊 平台概況',   callback_data: 'q:dash' },
           { text: '⚠️ 異常報告',   callback_data: 'q:anom' }]);
  kb.push([{ text: '✅ 核可狀態', callback_data: 'q:appr' },
           { text: '⚙ 設定', callback_data: 'q:set' }]);
  tgSend(chatId, '💼 <b>AC-HRA-PAY Control Panel</b> — ' + today + '\n選擇要開啟的模組或查詢摘要：',
    { reply_markup: JSON.stringify({ inline_keyboard: kb }) });
}

/* callback_data 解析：ap:<module>:<period>:A|R　av:<module>:<period>:V|X
   ⚠ 期間本身可能含冒號（餐費 2026-07:1、批次鍵 G_2026-08-01_L12），
     因此旗標從「最後一段」取，模組從「第一段」取，中間全部視為期間。 */
function parseApprovalData(body) {
  const li = body.lastIndexOf(':');
  if (li < 0) return null;
  const flag = body.slice(li + 1);
  const rest = body.slice(0, li);
  const fi = rest.indexOf(':');
  if (fi < 0) return null;
  return { mod: rest.slice(0, fi), period: rest.slice(fi + 1), flag: flag };
}

function handleCallbackQuery(cbq) {
  const data = String(cbq.data || '');
  const chatId = String(cbq.message.chat.id);
  const fromId = String(cbq.from.id);
  const fromName = ((cbq.from.first_name || '') + ' ' + (cbq.from.last_name || '')).trim() ||
                   (cbq.from.username ? '@' + cbq.from.username : fromId);
  const ack = (t) => UrlFetchApp.fetch(TG() + '/answerCallbackQuery', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    payload: JSON.stringify({ callback_query_id: cbq.id, text: t || '' })
  });

  /* Warning 第一關：審查（群組任何人可按） */
  if (data.indexOf('wV:') === 0 || data.indexOf('wX:') === 0) {
    if (!V2.REVIEW_OPEN && fromId !== String(CFG().ADMIN_ID)) { ack('❌ 無審查權限'); return; }
    const row = parseInt(data.slice(3), 10);
    const pass = data.indexOf('wV:') === 0;
    const r = warnVerifyByRow(row, pass, fromName);
    if (!r) { ack('⚠️ 找不到紀錄'); return; }
    if (r.already) { ack('ℹ️ 此筆已處理完畢'); return; }
    ack(pass ? '✅ 審查通過' : '↩ 已退回');
    const rec = r.rec;
    // 全程留在同一個群組訊息：審查通過後直接換成 Paul 的核可按鈕，不私訊。
    if (pass) {
      tgEdit(chatId, cbq.message.message_id, warnRecordText(rec, W_VERIFIED, fromName), warnApproveKb(row));
    } else {
      tgEdit(chatId, cbq.message.message_id, warnRecordText(rec, W_RETURNED, fromName), { inline_keyboard: [] });
    }
    return;
  }

  /* Warning 第二關：核可/退件（僅 Paul） */
  if (data.indexOf('wA:') === 0 || data.indexOf('wR:') === 0) {
    if (fromId !== String(CFG().ADMIN_ID)) { ack('⛔ 僅 Paul 可核可警告'); return; }
    const row = parseInt(data.slice(3), 10);
    const approve = data.indexOf('wA:') === 0;
    const rec = warnApproveByRow(row, approve, cbq.from.first_name || 'Paul');
    if (!rec) { ack('⚠️ 找不到該筆警告紀錄'); return; }
    ack(approve ? '✅ 已核可' : '❌ 已退件');
    tgEdit(chatId, cbq.message.message_id,
      warnRecordText(rec, approve ? W_APPROVED : W_REJECTED, cbq.from.first_name || 'Paul'),
      { inline_keyboard: [] });
    return;
  }

  /* ── 第一關：審查（任何人可按）av:<mod>:<period>:V|X ── */
  if (data.indexOf('av:') === 0) {
    const p = parseApprovalData(data.slice(3));
    if (!p) { ack('⚠️ 指令格式錯誤'); return; }
    if (!V2.REVIEW_OPEN && fromId !== String(CFG().ADMIN_ID)) { ack('❌ 無審查權限'); return; }
    const r = approvalVerify(p.mod, p.period, p.flag === 'V', fromName);
    if (!r) { ack('⚠️ 找不到請求'); return; }
    if (r.already) { ack('ℹ️ 此筆已處理完畢'); return; }
    ack(p.flag === 'V' ? '✅ 審查通過' : '↩ 已退回');
    return;
  }

  /* ── 第二關：核可（僅 Paul）ap:<mod>:<period>:A|R ── */
  if (data.indexOf('ap:') === 0) {
    const p = parseApprovalData(data.slice(3));
    if (!p) { ack('⚠️ 指令格式錯誤'); return; }
    if (fromId !== String(CFG().ADMIN_ID)) { ack('⛔ 僅 Paul 可核可'); return; }

    const prev = approvalFind(p.mod, p.period);
    if (!prev) { ack('⚠️ 找不到請求'); tgSend(chatId, '⚠️ 找不到對應的核可請求：' + escapeHtml(p.mod + ' / ' + p.period)); return; }
    if (isSettled(String(prev.status))) {
      ack('ℹ️ 此筆已處理');
      tgSend(chatId, 'ℹ️ 此筆已於 ' + escapeHtml(String(prev.decidedAt)) + ' 由 ' +
        escapeHtml(String(prev.decidedBy)) + ' 標記為 <b>' + escapeHtml(String(prev.status)) + '</b>，未重複處理。');
      return;
    }

    const approve = (p.flag === 'A');
    const rec = approvalDecide(p.mod, p.period, approve, cbq.from.first_name || 'Paul');
    if (!rec) { ack('⚠️ 找不到請求'); return; }
    ack(approve ? '✅ 已核可' : '❌ 已退件');

    const detail = approvalStoredDetail(rec);
    let tail = '\n━━━━━━━━━━━━━━━━\n' +
      (approve ? '✅ <b>已核可 Approved</b>' : '❌ <b>已退件 Rejected</b>') +
      '\n模組 Module：' + escapeHtml(moduleLabel(p.mod)) +
      '\n期間 Period：' + escapeHtml(p.period) +
      (num(rec.amount) ? '\n金額 Amount：$' + N(rec.amount) : '') +
      (num(rec.headcount) ? '\n人數 Headcount：' + N(rec.headcount) : '') +
      (rec.reviewer ? '\n審查人 Reviewer：' + escapeHtml(String(rec.reviewer)) : '') +
      '\n核可人 Approver：' + escapeHtml(cbq.from.first_name || 'Paul') + '　' + nowStr();
    if (approve && rec._docs) {
      tail += '\n\n📄 <b>可下載文件 Document</b>' +
        '\n• <a href="' + rec._docs.xlsxUrl + '">Excel 下載</a>' +
        '\n• <a href="' + rec._docs.pdfUrl  + '">PDF 下載</a>' +
        '\n• <a href="' + rec._docs.url     + '">線上檢視</a>';
    }
    const out = approvalTelegramText('📋 <b>' + escapeHtml(moduleLabel(p.mod)) + '</b>', detail, tail);
    // 更新原訊息並移除按鈕
    if (rec.chatId && rec.messageId) tgEdit(rec.chatId, rec.messageId, out, { inline_keyboard: [] });
    // 直送模式：群組也讓大家看到結果
    if (String(rec.chatId) !== String(CFG().GROUP_ID)) tgSend(CFG().GROUP_ID, out);
    // v3.2：核可通過後，另送一份正式 Excel 核可檔 + Excel/PDF/Online/Dashboard 連結。
    // 這一則獨立於原核可訊息，避免長明細把文件連結擠掉。
    if (approve && rec._docs) sendApprovedReportToGroup(rec, rec._docs);
    else if (approve && V2.AUTO_DOC && !rec._docs) {
      tgSend(CFG().GROUP_ID, '⚠️ <b>核可已完成，但核可報告檔生成失敗</b>\nApproval completed, but report file generation failed.\n模組 Module：' + escapeHtml(moduleLabel(p.mod)) + '\n期間 Period：' + escapeHtml(p.period));
    }
    return;
  }

  ack();
  const map = { 'q:pay': payTxt, 'q:meal': mealTxt, 'q:adv': advTxt, 'q:shut': shutTxt,
                'q:ot': otTxt, 'q:warn': warnTxt, 'q:hr': hrTxt, 'q:sum': sumTxt,
                'q:stat': statusTxt, 'q:set': settingsTxt, 'q:appr': approvalTxt,
                'q:pend': pendingTxt, 'q:anom': () => anomalyText(computeAnomalies()),
                'q:dash': () => '📊 <b>AC-HRA-PAY</b>' };
  const fn = map[data];
  if (fn) {
    let text = fn();
    if (['q:pay','q:meal','q:adv','q:shut','q:ot','q:warn','q:hr','q:sum'].indexOf(data) >= 0) {
      text = ensureActorLine(text, 'checker', fromName);
    }
    tgSend(chatId, text + (data === 'q:anom' ? '' : dashboardBlock()) + '\n\n👆 /hrpay');
  }
}

/* ─── 摘要文字（讀 Projection / snap / Sheet）─── */
function loadProjection(mod) {
  try { return JSON.parse(loadFromDrive('hrpay_result_' + mod + '.json') || 'null'); }
  catch (e) { return null; }
}
function projItemsSorted(mod) {
  const p = loadProjection(mod);
  if (!p || !p.items) return [];
  return Object.keys(p.items).sort().reverse().map(k => Object.assign({ key: k }, p.items[k]));
}

function payTxt() {
  const items = projItemsSorted('payroll');
  if (!items.length) {
    const m = getSnap('payroll');
    return m ? '💵 <b>Payroll</b> ' + fmtT(m.timestamp) + '\n共 ' + N(m.recordCount) + ' 筆（尚無 Projection）'
             : '⚠️ Payroll 尚未同步';
  }
  const lines = ['💵 <b>Payroll 薪資摘要</b>'];
  items.slice(0, 4).forEach(it => {
    const t = it.totals || {};
    const phase = it.payPhase === 'advance' ? '首期 Advance' : it.payPhase === 'final' ? '月結 Final' : '';
    lines.push('▪ ' + it.period + (phase ? '（' + phase + '）' : '') +
      '：Net $' + N(t.netPay) + '　' + N(it.rowCount) + ' 人' + fmtT2(it.updatedAt));
  });
  return lines.join('\n');
}
function mealTxt() {
  const items = projItemsSorted('meal');
  if (!items.length) {
    const m = getSnap('meal');
    return m ? '🍱 <b>Meal Fee</b> ' + fmtT(m.timestamp) + '\n共 ' + N(m.recordCount) + ' 筆（尚無 Projection）'
             : '⚠️ Meal Fee 尚未同步';
  }
  const lines = ['🍱 <b>Meal Fee 餐費摘要</b>（每月分 2 次發放）'];
  items.slice(0, 4).forEach(it => {
    const t = it.totals || {};
    const batch = it.mealBatch ? '第 ' + it.mealBatch + ' 次' : '';
    lines.push('▪ ' + it.period + (batch ? '（' + batch + '）' : '') +
      '：$' + N(t.mealFee) + '　' + N(it.rowCount) + ' 人' + fmtT2(it.updatedAt));
  });
  return lines.join('\n');
}
function advTxt() {
  const items = projItemsSorted('advance');
  if (!items.length) {
    const m = getSnap('advance');
    return m ? '💰 <b>Advance</b> ' + fmtT(m.timestamp) + '\n共 ' + N(m.recordCount) + ' 筆（尚無 Projection）'
             : '⚠️ Advance 尚未同步';
  }
  const lines = ['💰 <b>Advance Pay 預支摘要</b>'];
  items.slice(0, 4).forEach(it => {
    const t = it.totals || {};
    lines.push('▪ ' + it.period + '：$' + N(t.advanceAmount) + '　' + N(it.rowCount) + ' 人' + fmtT2(it.updatedAt));
  });
  return lines.join('\n');
}
function otTxt() {
  const items = projItemsSorted('otbonus');
  if (!items.length) {
    const m = getSnap('otbonus');
    return m ? '⏱ <b>OT & Bonus</b> ' + fmtT(m.timestamp) + '\n共 ' + N(m.recordCount) + ' 筆（尚無 Projection）'
             : '⚠️ OT & Bonus 尚未同步';
  }
  const lines = ['⏱ <b>OT & Bonus 摘要</b>'];
  items.slice(0, 4).forEach(it => {
    const t = it.totals || {};
    lines.push('▪ ' + it.period + '：OT $' + N(t.otPay) + '　Bonus $' + N(t.bonus) + fmtT2(it.updatedAt));
  });
  return lines.join('\n');
}
function shutTxt() {
  const stats = shutGetStats();
  if (!stats.length) return '⚠️ 尚無停工紀錄';
  const evs = shutGetEvents();
  const latest = evs[0];
  const cy = stats.find(s => s.year === new Date().getFullYear());
  return '🛑 <b>Shutdown 停工摘要</b>\n' +
    '總停工次數：' + N(stats.reduce((a, b) => a + b.count, 0)) + '\n' +
    '本年度停工天數：' + N(cy ? cy.totalDays : 0) + ' 天\n' +
    (latest ? '最近停工：' + escapeHtml(latest.start_date) + ' ~ ' + escapeHtml(latest.end_date) +
      '（' + N(latest.shutdown_days) + ' 天，' + N(latest.shutdown_ppl) + ' 人）' : '');
}
function warnTxt() {
  const recs = warnAll();
  if (!recs.length) return '⚠️ 尚無警告紀錄';
  const pending = recs.filter(r => r.status === W_PENDING).length;
  const verified = recs.filter(r => r.status === W_VERIFIED).length;
  const active = recs.filter(r => !r.expired && r.status === W_APPROVED).length;
  const thisMo = Utilities.formatDate(new Date(), CFG().TZ, 'yyyy-MM');
  const moCnt = recs.filter(r => r.incidentDate.slice(0, 7) === thisMo).length;
  return '⚠️ <b>Warning 警告摘要</b>\n' +
    '待審查：' + N(pending) + '　待核可：' + N(verified) + '　有效：' + N(active) + '\n' +
    '本月新增：' + N(moCnt) + '　總紀錄：' + N(recs.length);
}
function hrTxt() {
  let st = {};
  try { st = JSON.parse(loadFromDrive('hr.json') || '{}'); } catch (e) { st = {}; }
  const list = st.transfers || [];
  if (!list.length) return '⚠️ 職位異動尚未同步';
  const pend = list.filter(x => (x.status || 'reviewed') === 'reviewed' || x.status === 'pending_review');
  const lines = ['🔄 <b>職位異動 Transfer</b>\n待核可：' + N(pend.length) + ' 件　總計：' + N(list.length) + ' 件'];
  pend.slice(0, 5).forEach(r => {
    lines.push('▪ ' + escapeHtml(r.empName) + ' #' + escapeHtml(r.empId) + ' — ' +
      escapeHtml(r.reason || '') + '（' + escapeHtml(r.effectiveDate || '') + '）');
  });
  if (pend.length > 5) lines.push('…另有 ' + (pend.length - 5) + ' 件');
  return lines.join('\n');
}
function sumTxt() {
  const parts = ['📊 <b>Summary 總覽</b>（各模組最新 Projection）'];
  [['payroll','💵 Payroll'], ['meal','🍱 Meal'], ['advance','💰 Advance'],
   ['otbonus','⏱ OT&Bonus'], ['shutdown','🛑 Shutdown'], ['warning','⚠️ Warning']].forEach(pair => {
    const m = getSnap(pair[0]);
    parts.push(pair[1] + '：' + (m ? fmtT(m.timestamp) + '（' + N(m.recordCount) + '）' : '未同步'));
  });
  parts.push('\n👉 開啟 summary_center.html 進行交叉核對');
  return parts.join('\n');
}
function hrReportTxt() {
  return [payTxt(), mealTxt(), advTxt(), otTxt(), shutTxt(), warnTxt(), hrTxt()].join('\n\n━━━━━━━━━━━━\n\n');
}
function statusTxt() {
  const labels = { payroll:'💵 Payroll', meal:'🍱 Meal', advance:'💰 Advance', hr:'🔄 Transfer',
                   transfer:'🔄 Transfer(整包)', employee:'👥 Employee', shutdown:'🛑 Shutdown',
                   otbonus:'⏱ OT&Bonus', summary:'📊 Summary', warning:'⚠️ Warning' };
  return '🔄 <b>雲端同步狀態</b>\n\n' + SYNC_TOOLS.map(t => {
    const m = getSnap(t);
    return (labels[t] || t) + '：' + (m ? fmtT(m.timestamp) + '（' + N(m.recordCount) + ' 筆）' : '未同步');
  }).join('\n');
}
function settingsTxt() {
  const cfg = CFG();
  const ssUrl = PropertiesService.getScriptProperties().getProperty('achra_pay_ss_url') || '（尚未建立）';
  return '⚙ <b>AC-HRA-PAY 設定 v2.0</b>\n' +
    'Bot：@psjweng_bot\nGroup：' + escapeHtml(cfg.GROUP_ID) + '\n' +
    'Platform：' + escapeHtml(cfg.BASE_URL) + '/index.html\n' +
    'Sheets：' + escapeHtml(ssUrl) + '\n\n' +
    '<b>核可設定</b>\n' +
    '審查權限：' + (V2.REVIEW_OPEN ? '群組任何人可按 👀 審查通過' : '僅限名單') + '\n' +
    '核可權限：僅 Paul（' + escapeHtml(cfg.ADMIN_ID) + '）\n' +
    '核可後產生文件：' + (V2.AUTO_DOC ? '是' : '否') + '\n' +
    '逾期門檻：' + V2.OVERDUE_DAYS + ' 天　異常調薪：$' + V2.ADJ_ALERT + ' 或 ' + (V2.ADJ_PCT * 100) + '%\n' +
    '高頻異動：' + V2.MOVE_WINDOW + ' 天內 ' + V2.MOVE_ALERT + ' 次\n' +
    '（預算門檻請至 Sheet「Budget」分頁設定，填 0 = 不檢查）\n\n' +
    '警告終止門檻：大過/最後警告 ' +
    (PropertiesService.getScriptProperties().getProperty('WARN_TERMINATE_COUNT') || '3') + ' 次';
}

/* ═══════════════════════════════════════════════════════════════════════
   GOOGLE SHEETS / DRIVE
═══════════════════════════════════════════════════════════════════════ */
function getSS() {
  const props = PropertiesService.getScriptProperties();
  let ssId = props.getProperty('achra_pay_ss_id');
  if (ssId) { try { return SpreadsheetApp.openById(ssId); } catch (e) { ssId = null; } }
  const ss = SpreadsheetApp.create(CFG().SS_NAME);
  props.setProperty('achra_pay_ss_id', ss.getId());
  props.setProperty('achra_pay_ss_url', ss.getUrl());
  DriveApp.getFileById(ss.getId()).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return ss;
}
function getOrCreateSheet(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight('bold').setBackground('#1A2540').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
  }
  return sh;
}
function initSheets() {
  shutEventsSheet(); shutLinesSheet(); linesMaster(); warnSheet(); approvalSheet(); budgetSheet();
  const ss = getSS();
  const def = ss.getSheetByName('工作表1') || ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1) { try { ss.deleteSheet(def); } catch (e) {} }
  return true;
}
function getOrCreateFolder() {
  const folders = DriveApp.getFoldersByName(CFG().FOLDER);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(CFG().FOLDER);
}
function saveToDrive(filename, content) {
  const folder = getOrCreateFolder();
  const files = folder.getFilesByName(filename);
  let newest = null; const extras = [];
  while (files.hasNext()) {
    const f = files.next();
    if (!newest) { newest = f; continue; }
    if (f.getLastUpdated() > newest.getLastUpdated()) { extras.push(newest); newest = f; }
    else extras.push(f);
  }
  extras.forEach(f => f.setTrashed(true));
  if (newest) newest.setContent(content);
  else folder.createFile(filename, content, MimeType.PLAIN_TEXT);
}
function loadFromDrive(filename) {
  const folder = getOrCreateFolder();
  const files = folder.getFilesByName(filename);
  let newest = null;
  while (files.hasNext()) {
    const f = files.next();
    if (!newest || f.getLastUpdated() > newest.getLastUpdated()) newest = f;
  }
  return newest ? newest.getBlob().getDataAsString() : null;
}

/* ═══════════════════════════════════════════════════════════════════════
   UTILS
═══════════════════════════════════════════════════════════════════════ */
function tgSend(chatId, text, extra) {
  try {
    const res = UrlFetchApp.fetch(TG() + '/sendMessage', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      payload: JSON.stringify(Object.assign({
        chat_id: String(chatId), text: String(text).substring(0, 4090),
        parse_mode: 'HTML', disable_web_page_preview: true
      }, extra || {}))
    });
    return JSON.parse(res.getContentText());
  } catch (e) { return { ok: false, error: String(e) }; }
}
function tgEdit(chatId, messageId, text, keyboard) {
  if (!chatId || !messageId) return null;
  try {
    const res = UrlFetchApp.fetch(TG() + '/editMessageText', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      payload: JSON.stringify({
        chat_id: String(chatId), message_id: Number(messageId),
        text: String(text).substring(0, 4090), parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: JSON.stringify(keyboard || { inline_keyboard: [] })
      })
    });
    return JSON.parse(res.getContentText());
  } catch (e) { return null; }
}
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function parseQueryBody(raw) {
  const out = {};
  String(raw || '').split('&').forEach(pair => {
    const i = pair.indexOf('=');
    if (i < 0) return;
    try {
      out[decodeURIComponent(pair.slice(0, i).replace(/\+/g, ' '))] =
        decodeURIComponent(pair.slice(i + 1).replace(/\+/g, ' '));
    } catch (e) {}
  });
  return out;
}
function num(v) { const n = Number(v); return isNaN(n) ? 0 : n; }
function N(n) { return Number(n || 0).toLocaleString(); }
function nowStr() { return Utilities.formatDate(new Date(), CFG().TZ, 'yyyy-MM-dd HH:mm:ss'); }
function fmtT(iso) { try { return Utilities.formatDate(new Date(iso), CFG().TZ, 'MM/dd HH:mm'); } catch (e) { return '--'; } }
function fmtT2(iso) { try { return '　<i>' + Utilities.formatDate(new Date(iso), CFG().TZ, 'MM/dd HH:mm') + '</i>'; } catch (e) { return ''; } }
function okCors(data) { return ContentService.createTextOutput(JSON.stringify({ ok: true, data })).setMimeType(ContentService.MimeType.JSON); }
function rawJson(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function failCors(error) { return ContentService.createTextOutput(JSON.stringify({ ok: false, error })).setMimeType(ContentService.MimeType.JSON); }


/* ─── Telegram 只讀健檢：不會送訊息 ─── */
function telegramCheck() {
  const cfg = CFG();
  const out = { tokenSet: !!cfg.BOT_TOKEN, groupId: String(cfg.GROUP_ID), bot: null, group: null };
  try {
    const r1 = UrlFetchApp.fetch(TG() + '/getMe', { muteHttpExceptions: true });
    out.bot = JSON.parse(r1.getContentText());
  } catch (e) { out.bot = { ok:false, error:String(e) }; }
  try {
    const r2 = UrlFetchApp.fetch(TG() + '/getChat?chat_id=' + encodeURIComponent(String(cfg.GROUP_ID)), { muteHttpExceptions: true });
    out.group = JSON.parse(r2.getContentText());
  } catch (e) { out.group = { ok:false, error:String(e) }; }
  Logger.log(JSON.stringify(out, null, 2));
  return out;
}

/* ═══════════════════════════════════════════════════════════════════════
   健檢 — 隨時可執行，只讀不寫
═══════════════════════════════════════════════════════════════════════ */
function selfCheck() {
  const r = ['══════ AC-HRA-PAY v2.0 健檢 ══════'];
  const cfg = CFG();
  r.push(cfg.BOT_TOKEN ? '✅ BOT_TOKEN 已設定' : '❌ BOT_TOKEN 未設定 → 執行 setupAll()');
  r.push('✅ 群組 ' + cfg.GROUP_ID);
  r.push('✅ 核可人 ' + cfg.ADMIN_ID + '（只有這個 ID 能按核可）');
  r.push(V2.REVIEW_OPEN ? '✅ 審查開放：群組任何人都能按「👀 審查通過」' : '⚠️ 審查限定 Admin');
  try {
    const ss = getSS();
    r.push('✅ 試算表：' + ss.getUrl());
    const sh = approvalSheet();
    const hdr = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map(String);
    const miss = APPROVAL_HEADERS.filter(h => hdr.indexOf(h) < 0);
    r.push(miss.length ? '❌ Approvals 缺欄位：' + miss.join(',') : '✅ Approvals 欄位齊全（' + hdr.length + ' 欄）');
    r.push('✅ Budget 分頁就緒（填 0 = 不檢查該模組）');
  } catch (e) { r.push('❌ 試算表：' + e); }
  const trg = ScriptApp.getProjectTriggers().map(t => t.getHandlerFunction());
  r.push(trg.indexOf('pollTelegram') >= 0 ? '✅ Telegram 輪詢觸發器正常' : '❌ 缺 pollTelegram → 執行 ensureTrigger()');
  r.push(trg.indexOf('dailyAnomaly') >= 0 ? '✅ 每日異常報告觸發器正常' : '⚠️ 缺 dailyAnomaly → 執行 ensureAnomalyTrigger()');
  const a = computeAnomalies();
  const c = anomalyCounts(a);
  r.push('📊 目前異常：超預算 ' + c.overBudget + '　逾期 ' + c.overdue +
         '　異常調薪 ' + c.abnormalAdj + '　高頻異動 ' + c.frequentMove);
  const d = computeDashboard();
  r.push('📋 核可狀態：待審 ' + d.approval.pending + '　待核 ' + d.approval.verified +
         '　已核 ' + d.approval.approved + '　退件 ' + d.approval.rejected);
  const out = r.join('\n');
  Logger.log(out);
  return out;
}
