/* ═══════════════════════════════════════════════════════════════════════
   VRT_HR_CloudSync — Google Apps Script 後端  v1.0
   
   建議 GAS 專案名稱：VRT_HR_CloudSync
   
   部署步驟：
   1. 新建獨立 GAS 專案（不要綁現有專案）
   2. 貼上此完整程式碼
   3. 部署 > 新增部署 > 類型：Web 應用程式
      執行身分：我 / 存取：任何人（包含匿名）
   4. 複製部署 URL → 貼到 attendance_cloud_v1.html 的 GAS URL 欄
   
   Telegram：
   Bot Token : 8752977449:AAHOhEM0IWsFU5cTXRkwV4pgp68cYQh-1Sg
   Chat ID   : -5233667043
   
   定時觸發（可選）：
   - 每日 07:00 → sendDailyReport
   - 每週一 08:00 → sendWeeklyReport
   - 每月1日 08:00 → sendMonthlyReport
═══════════════════════════════════════════════════════════════════════ */

const HR_CFG = {
  BOT_TOKEN   : '8752977449:AAHOhEM0IWsFU5cTXRkwV4pgp68cYQh-1Sg',
  CHAT_ID     : '-5233667043',
  TZ          : 'Asia/Phnom_Penh',
  FOLDER_NAME : 'VRT_HR_Data',
  VERSION     : 'VRT_HR_CloudSync_v1',
};

// ─────────────────────────────────────────────────────────────
// ENTRY: doPost
// Actions: push | telegram | backup
// ─────────────────────────────────────────────────────────────
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action  = payload.action || 'push';

    if (action === 'telegram') return handleTelegram(payload);
    if (action === 'push')     return handlePush(payload);
    if (action === 'backup')   return handleBackup(payload);

    return failCors('Unknown action: ' + action);
  } catch(err) {
    logEvent('ERROR', 'doPost: ' + err.toString());
    return failCors(err.toString());
  }
}

// ─────────────────────────────────────────────────────────────
// ENTRY: doGet
// Actions: status | pull | heartbeat | log
// ─────────────────────────────────────────────────────────────
function doGet(e) {
  try {
    const p      = e.parameter || {};
    const action = p.action || 'status';

    if (action === 'status')    return handleStatus();
    if (action === 'pull')      return handlePull(p);
    if (action === 'heartbeat') return handleHeartbeat();
    if (action === 'log')       return handleLog();

    return failCors('Unknown action: ' + action);
  } catch(err) {
    logEvent('ERROR', 'doGet: ' + err.toString());
    return failCors(err.toString());
  }
}

// ═══════════════════════════════════════════════════════════════
// PUSH — 接收前端資料，分批存 Drive
// ═══════════════════════════════════════════════════════════════
function handlePush(payload) {
  const tool = payload.tool || 'attendance';

  // ── 分批上傳模式 ──
  if (payload.totalChunks && payload.totalChunks > 1) {
    const chunkFile = `chunk_${tool}_${payload.chunk}.json`;
    saveToDrive(chunkFile, JSON.stringify(payload.records || []));

    if (payload.chunk === payload.totalChunks - 1) {
      const meta = buildMeta(tool, payload);
      saveToDrive(`chunk_${tool}_meta.json`, JSON.stringify(meta));
      setSnap(tool, meta);
      logEvent('PUSH', `${meta.recordCount} records / ${payload.totalChunks} chunks`);
      try { writeAttendanceSummary(meta.summary); } catch(e) {}
      return okCors({ saved: tool, recordCount: meta.recordCount, chunk: 'final', timestamp: meta.timestamp });
    }
    return okCors({ saved: tool, chunk: payload.chunk, pending: true });
  }

  // ── 單批上傳模式 ──
  saveToDrive(tool + '.json', JSON.stringify(payload));
  const meta = buildMeta(tool, payload);
  setSnap(tool, meta);
  logEvent('PUSH', `${meta.recordCount} records (single batch)`);
  try { writeAttendanceSummary(meta.summary); } catch(e) {}
  return okCors({ saved: tool, recordCount: meta.recordCount, timestamp: meta.timestamp });
}

function buildMeta(tool, payload) {
  return {
    tool,
    timestamp   : new Date().toISOString(),
    recordCount : payload.recordCount || 0,
    totalChunks : payload.totalChunks || 1,
    importLog   : payload.importLog || [],
    summary     : payload.summary || {},
    pushedBy    : payload.pushedBy || 'web',
  };
}

// ═══════════════════════════════════════════════════════════════
// PULL — 讀取 Drive 資料回傳給前端
// ═══════════════════════════════════════════════════════════════
function handlePull(p) {
  const tool  = p.tool || 'attendance';
  const chunk = p.chunk;

  // 單批拉取
  if (chunk !== undefined) {
    const raw = loadFromDrive(`chunk_${tool}_${chunk}.json`);
    if (!raw) return okCors({ tool, chunk, records: [], done: true });
    return okCors({ tool, chunk, records: JSON.parse(raw) });
  }

  // 拉取 meta（前端先問有幾批）
  if (p.meta === '1') {
    const metaRaw = loadFromDrive(`chunk_${tool}_meta.json`);
    if (metaRaw) return okCors({ tool, chunked: true, meta: JSON.parse(metaRaw) });
    const json = loadFromDrive(tool + '.json');
    if (!json) return okCors({ tool, data: null, message: '尚無雲端資料' });
    return okCors({ tool, chunked: false, data: JSON.parse(json) });
  }

  // 直接拉取（相容舊格式）
  const metaRaw = loadFromDrive(`chunk_${tool}_meta.json`);
  if (metaRaw) return okCors({ tool, chunked: true, meta: JSON.parse(metaRaw) });
  const json = loadFromDrive(tool + '.json');
  if (!json) return okCors({ tool, data: null, message: '尚無雲端資料' });
  return okCors({ tool, chunked: false, data: JSON.parse(json) });
}

// ═══════════════════════════════════════════════════════════════
// STATUS — 回傳雲端快照資訊
// ═══════════════════════════════════════════════════════════════
function handleStatus() {
  const props    = PropertiesService.getScriptProperties();
  const logRaw   = props.getProperty('event_log') || '[]';
  const recentLog= JSON.parse(logRaw).slice(0,10);
  // Return snap for all known tools
  const tools = ['attendance', 'maternity', 'contract', 'hr_report', 'onoff'];
  const snaps = {};
  tools.forEach(t => {
    const raw = props.getProperty('snap_' + t);
    if (raw) snaps[t] = JSON.parse(raw);
  });
  return okCors({
    ...snaps,
    serverTime : new Date().toISOString(),
    tz         : HR_CFG.TZ,
    version    : HR_CFG.VERSION,
    recentLog,
  });
}

// ═══════════════════════════════════════════════════════════════
// HEARTBEAT
// ═══════════════════════════════════════════════════════════════
function handleHeartbeat() {
  return okCors({ ok: true, ts: new Date().toISOString(), v: HR_CFG.VERSION });
}

// ═══════════════════════════════════════════════════════════════
// LOG — 回傳事件紀錄
// ═══════════════════════════════════════════════════════════════
function handleLog() {
  const raw = PropertiesService.getScriptProperties().getProperty('event_log') || '[]';
  return okCors({ log: JSON.parse(raw) });
}

// ═══════════════════════════════════════════════════════════════
// BACKUP — 存一份帶時間戳的備份
// ═══════════════════════════════════════════════════════════════
function handleBackup(payload) {
  const ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const name = `backup_attendance_${ts}.json`;
  saveToDrive(name, JSON.stringify(payload));
  logEvent('BACKUP', `Saved: ${name}`);
  return okCors({ backup: name, timestamp: new Date().toISOString() });
}

// ═══════════════════════════════════════════════════════════════
// TELEGRAM — 代理傳送訊息（前端 CORS 限制，必須走 GAS）
// ═══════════════════════════════════════════════════════════════
function handleTelegram(payload) {
  const text  = (payload.text  || '').slice(0, 4000);
  const retries = 3;

  for (let i = 0; i < retries; i++) {
    try {
      const resp = UrlFetchApp.fetch(
        `https://api.telegram.org/bot${HR_CFG.BOT_TOKEN}/sendMessage`,
        {
          method      : 'post',
          contentType : 'application/json',
          payload     : JSON.stringify({ chat_id: HR_CFG.CHAT_ID, text, parse_mode: 'HTML' }),
          muteHttpExceptions: true,
        }
      );
      const result = JSON.parse(resp.getContentText());
      if (result.ok) {
        logEvent('TG_SENT', text.slice(0, 60) + '…');
        return okCors({ sent: true, message_id: result.result?.message_id });
      }
      if (i < retries - 1) Utilities.sleep(1200);
    } catch(e) {
      if (i < retries - 1) Utilities.sleep(1200);
    }
  }
  logEvent('TG_FAIL', 'Failed after 3 retries — ' + text.slice(0, 40));
  return failCors('Telegram send failed after retries');
}

// ═══════════════════════════════════════════════════════════════
// SCHEDULED TELEGRAM REPORTS
// 設定觸發：GAS 主選單 > 觸發條件 > 新增
// ═══════════════════════════════════════════════════════════════
function sendDailyReport()   { _schedReport('daily');   }
function sendWeeklyReport()  { _schedReport('weekly');  }
function sendMonthlyReport() { _schedReport('monthly'); }
function sendYearlyReport()  { _schedReport('yearly');  }

function _schedReport(mode) {
  const snap = getSnap('attendance');
  const ts   = Utilities.formatDate(new Date(), HR_CFG.TZ, 'yyyy-MM-dd HH:mm');
  const sm   = snap ? (snap.summary || {}) : {};
  const SEP  = '─'.repeat(28);

  const modeLabel = { daily:'日報', weekly:'週報', monthly:'月報', yearly:'年報' }[mode] || mode;

  let text = `<b>【VRT 考勤${modeLabel}】</b>\n`;
  text += `${SEP}\n`;
  text += `📅 時間 / Time: <code>${ts}</code>\n`;

  if (!snap) {
    text += `⚠️ 尚無雲端資料 / No cloud data\n`;
  } else {
    text += `📊 模式 / Mode: <b>${modeLabel}</b>\n`;
    text += `📋 記錄數 / Records: <b>${snap.recordCount || 0}</b> 筆\n`;
    if (sm.latestDate)  text += `📆 最新日期 / Latest: <code>${sm.latestDate}</code>\n`;
    if (sm.avgRate)     text += `📈 出勤率 / Att.Rate: <b>${sm.avgRate}</b>\n`;
    if (sm.totalJoin)   text += `🟢 新進 / Join: <b>+${sm.totalJoin}</b>\n`;
    if (sm.totalResign) text += `🔴 離職 / Resign: <b>-${sm.totalResign}</b>\n`;
    if (sm.totalDays)   text += `📆 統計天數 / Days: ${sm.totalDays}\n`;
  }

  text += `${SEP}\n`;
  text += `[EN] VRT HR Attendance ${mode.charAt(0).toUpperCase()+mode.slice(1)} Report\n`;
  if (sm.avgRate)     text += `Att.Rate: ${sm.avgRate}  Records: ${snap?.recordCount || 0}\n`;
  text += `${SEP}\n`;
  text += `[KM] របាយការណ៍វត្តមាន${modeLabel === '月報' ? 'ប្រចាំខែ' : ''}\n`;
  if (sm.avgRate)     text += `អត្រាវត្តមាន: ${sm.avgRate}\n`;
  text += `${SEP}\n`;
  text += `🏭 Vantage River Textiles · Sihanoukville`;

  sendTg(text);
}

// Anomaly alert — call this from a trigger or manually
function sendAnomalyAlert(dept, rate, type) {
  const ts = Utilities.formatDate(new Date(), HR_CFG.TZ, 'yyyy-MM-dd HH:mm');
  const emoji = type === 'low_att' ? '🔴' : type === 'high_resign' ? '⚠️' : '📌';
  let text = `${emoji} <b>【VRT 出勤異常警示】</b>\n`;
  text += `─────────────────────\n`;
  text += `📅 ${ts}\n`;
  text += `🏢 部門 / Dept: <b>${dept}</b>\n`;
  if (type === 'low_att')    text += `📉 出勤率過低 / Low Att.Rate: <b>${rate}</b>\n`;
  if (type === 'high_resign') text += `📈 離職異常 / High Resign: <b>${rate}</b>\n`;
  text += `─────────────────────\n`;
  text += `[EN] Attendance anomaly detected: ${dept} — ${rate}\n`;
  text += `[KM] ការព្រមានវត្តមានមិនប្រក្រតី: ${dept}\n`;
  text += `🏭 VRT HR System`;
  sendTg(text);
}

function sendTg(text) {
  try {
    UrlFetchApp.fetch(
      `https://api.telegram.org/bot${HR_CFG.BOT_TOKEN}/sendMessage`,
      {
        method: 'post', contentType: 'application/json',
        payload: JSON.stringify({ chat_id: HR_CFG.CHAT_ID, text, parse_mode: 'HTML' }),
        muteHttpExceptions: true,
      }
    );
  } catch(e) { console.error('sendTg error:', e); }
}

// ═══════════════════════════════════════════════════════════════
// SHEETS — 寫入出勤摘要
// ═══════════════════════════════════════════════════════════════
function writeAttendanceSummary(summary) {
  if (!summary || !Object.keys(summary).length) return;
  const ss   = getOrCreateSpreadsheet();
  let sh = ss.getSheetByName('Attendance_Summary');
  if (!sh) {
    sh = ss.insertSheet('Attendance_Summary');
    sh.appendRow(['Timestamp','RecordCount','LatestDate','TotalDays','AvgRate','TotalJoin','TotalResign','PushedBy']);
    sh.getRange(1,1,1,8).setFontWeight('bold').setBackground('#1a6e5c').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  sh.appendRow([
    new Date().toISOString(),
    summary.recordCount || 0,
    summary.latestDate  || '',
    summary.totalDays   || 0,
    summary.avgRate     || '',
    summary.totalJoin   || 0,
    summary.totalResign || 0,
    summary.pushedBy    || 'web',
  ]);
}

// ═══════════════════════════════════════════════════════════════
// EVENT LOG
// ═══════════════════════════════════════════════════════════════
function logEvent(type, msg) {
  try {
    const props = PropertiesService.getScriptProperties();
    const raw   = props.getProperty('event_log') || '[]';
    const log   = JSON.parse(raw);
    log.unshift({ type, msg, ts: new Date().toISOString() });
    if (log.length > 100) log.splice(100);
    props.setProperty('event_log', JSON.stringify(log));
    // Also write to Sheets log if available
    try {
      const ss = SpreadsheetApp.openById(props.getProperty('hr_sheet_id') || '');
      let sh = ss.getSheetByName('Attendance_Log');
      if (!sh) {
        sh = ss.insertSheet('Attendance_Log');
        sh.appendRow(['Timestamp','Type','Message']);
        sh.getRange(1,1,1,3).setFontWeight('bold').setBackground('#e8f4f1');
      }
      sh.appendRow([new Date().toISOString(), type, msg]);
    } catch(e2) {}
  } catch(e) {}
}

// ═══════════════════════════════════════════════════════════════
// PROPERTIES HELPERS
// ═══════════════════════════════════════════════════════════════
function getSnap(tool) {
  const raw = PropertiesService.getScriptProperties().getProperty('snap_' + tool);
  return raw ? JSON.parse(raw) : null;
}

function setSnap(tool, meta) {
  const snap = { tool: meta.tool, timestamp: meta.timestamp, recordCount: meta.recordCount, summary: meta.summary };
  PropertiesService.getScriptProperties().setProperty('snap_' + tool, JSON.stringify(snap));
}

// ═══════════════════════════════════════════════════════════════
// DRIVE HELPERS
// ═══════════════════════════════════════════════════════════════
function getFolder() {
  const folders = DriveApp.getFoldersByName(HR_CFG.FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  const f = DriveApp.createFolder(HR_CFG.FOLDER_NAME);
  logEvent('INIT', 'Created Drive folder: ' + HR_CFG.FOLDER_NAME);
  return f;
}

function saveToDrive(filename, content) {
  const folder = getFolder();
  const files  = folder.getFilesByName(filename);
  if (files.hasNext()) {
    files.next().setContent(content);
  } else {
    folder.createFile(filename, content, MimeType.PLAIN_TEXT);
  }
}

function loadFromDrive(filename) {
  const folder = getFolder();
  const files  = folder.getFilesByName(filename);
  if (!files.hasNext()) return null;
  return files.next().getBlob().getDataAsString();
}

// ═══════════════════════════════════════════════════════════════
// SPREADSHEET
// ═══════════════════════════════════════════════════════════════
function getOrCreateSpreadsheet() {
  const propKey = 'hr_sheet_id';
  const props   = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty(propKey);

  if (sheetId) {
    try { return SpreadsheetApp.openById(sheetId); } catch(e) {}
  }

  const ss = SpreadsheetApp.create('VRT_HR_Database');
  props.setProperty(propKey, ss.getId());

  // Init required sheets
  ['Attendance_Raw','Attendance_Summary','Attendance_Log','Attendance_Config'].forEach(name => {
    if (!ss.getSheetByName(name)) ss.insertSheet(name);
  });

  logEvent('INIT', 'Created Spreadsheet: VRT_HR_Database id=' + ss.getId());
  return ss;
}

// ═══════════════════════════════════════════════════════════════
// CORS RESPONSE HELPERS
// ═══════════════════════════════════════════════════════════════
function okCors(data) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, ...data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function failCors(msg) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: false, error: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}
