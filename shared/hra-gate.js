/* AC HRA Portal 平台入口密碼 v1.0（2026-10-24）— 做法同 AC-HRA-PAY
 * 每一頁最先載入：這台裝置／這個瀏覽器沒輸入過密碼，就先看到密碼畫面；輸入正確後記住，以後不用再打。
 * 程式碼只存密碼的 SHA-256，不存明碼。這是「門鎖」：擋住一般拿到網址的人，不是銀行等級的保護。
 * 只遮住畫面，不擋背景程式：首頁的雲端同步／智慧匯入在隱藏框架開模組頁時照常運作。
 * 要讓某台裝置重新輸入：在網址列打 javascript:HRAGate.lock() 或清除該網站資料。
 */
(function (g) {
  'use strict';
  var doc = g.document, KEY = 'ac_hra_gate_v1', YEARS = 10;
  var HASH = '41e5653fc7aeb894026d6bb7b2db7f65902b454945fa8fd65a6327047b5277fb';   /* sha256 of the platform password */
  function ok() {
    try { var v = JSON.parse(localStorage.getItem(KEY) || 'null'); return !!(v && v.h === HASH && v.exp > Date.now()); } catch (_) { return false; }
  }
  function lang() { try { var l = localStorage.getItem('ac_hra_lang') || localStorage.getItem('hra_lang') || ''; return /^en/.test(l) ? 'en' : /^km/.test(l) ? 'km' : 'zh'; } catch (_) { return 'zh'; } }
  function L(zh, en, km) { var l = lang(); return l === 'en' ? en : l === 'km' ? km : zh; }
  async function sha(t) {
    var d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
    return Array.prototype.map.call(new Uint8Array(d), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  g.HRAGate = {
    lock: function () { try { localStorage.removeItem(KEY); } catch (_) {} location.reload(); },
    unlocked: ok
  };
  if (ok()) return;
  /* 在隱藏框架裡（首頁同步／匯入用）不顯示密碼畫面：上層頁面已經解鎖才可能開到這裡 */
  try { if (g.top !== g && g.top.HRAGate && g.top.HRAGate.unlocked()) return; } catch (_) {}
  doc.documentElement.classList.add('hra-locked');
  var st = doc.createElement('style');
  st.textContent = 'html.hra-locked body>*:not(#hra-gate){visibility:hidden!important}' +
    '#hra-gate{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:linear-gradient(160deg,#1b6b3a,#2d8f55 45%,#1e7a45);font:15px/1.5 system-ui,"Noto Sans TC",sans-serif;padding:16px}' +
    '#hra-gate form{background:#fff;color:#0f172a;border-radius:16px;padding:26px 24px;width:min(360px,100%);box-shadow:0 20px 50px rgba(0,0,0,.35);text-align:center}' +
    '#hra-gate h1{font-size:20px;margin:0 0 4px}#hra-gate p{color:#64748b;font-size:13px;margin:0 0 16px}' +
    '#hra-gate input{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:10px;padding:11px 12px;font-size:16px;text-align:center;letter-spacing:2px}' +
    '#hra-gate button{margin-top:12px;width:100%;border:0;border-radius:10px;padding:11px;background:#1b6b3a;color:#fff;font-weight:800;font-size:15px;cursor:pointer}' +
    '#hra-gate .err{color:#b91c1c;font-size:13px;min-height:18px;margin-top:8px}';
  (doc.head || doc.documentElement).appendChild(st);
  function show() {
    if (doc.getElementById('hra-gate') || ok()) return;
    var box = doc.createElement('div'); box.id = 'hra-gate';
    box.innerHTML = '<form autocomplete="off"><h1>🏥 AC HRA Portal</h1><p>' + L('請輸入平台密碼（輸入一次，這台裝置會記住）', 'Enter the platform password (remembered on this device)', 'សូមបញ្ចូលពាក្យសម្ងាត់') + '</p>' +
      '<input type="password" name="pw" autofocus aria-label="password" autocomplete="current-password"><button type="submit">' + L('進入', 'Enter', 'ចូល') + '</button><div class="err" role="alert"></div></form>';
    doc.body.appendChild(box);
    var f = box.querySelector('form'), inp = f.querySelector('input'), err = f.querySelector('.err');
    setTimeout(function () { try { inp.focus(); } catch (_) {} }, 50);
    f.addEventListener('submit', async function (e) {
      e.preventDefault();
      var h = '';
      try { h = await sha(String(inp.value || '').trim()); } catch (_) {}
      if (h !== HASH) { err.textContent = L('密碼不對，請再試一次', 'Wrong password, please try again', 'ពាក្យសម្ងាត់មិនត្រឹមត្រូវ'); inp.select(); return; }
      try { localStorage.setItem(KEY, JSON.stringify({ h: HASH, exp: Date.now() + YEARS * 365 * 86400000 })); } catch (_) {}
      box.remove(); doc.documentElement.classList.remove('hra-locked');
    });
  }
  if (doc.body) show(); else doc.addEventListener('DOMContentLoaded', show);
  /* 會整個重建 <body> 的頁面（切語言）也不能把鎖弄掉 */
  setInterval(function () { if (!ok() && doc.body && !doc.getElementById('hra-gate')) show(); }, 800);
})(window);
