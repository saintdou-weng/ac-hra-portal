# AC_HRA_CloudSync 部署注意（2026-11-13）

- GAS 檔尾在 `/* ── shared/att-tg.js（與頁面同一份）── */` 之後是 att-tg.js 的內嵌副本，
  **但副本後面還接著別的函式**（例如 `adminWeekAttendance74_`，行政中心週六全系統週報用，另一個工作階段加的）。
- 更新內嵌的 att-tg.js 時，只能換掉「標記之後到 att-tg.js 結尾 `})(typeof window!=='undefined'?window:this);`」這一段，
  **不可以從標記一路換到檔尾**，否則會把後面的函式刪掉。
- 換完用 SHA 比對內嵌段與 GitHub Pages 上的 shared/att-tg.js。
