/* AC HRA UI 動效 v5（2026-11-22 起；11-23 加第 8 項：標題列融合調色盤＋手機精簡）
   1 懸停回饋（按鈕）  2 游標聚光燈（深色卡片網格）  3 3D 傾斜（首頁模組卡、KPI 卡）
   4 導覽列吸頂（桌機、且頁面沒有其他吸頂列才啟用）  5 回到頂部按鈕
   原則：只加效果，不改任何現有結構、事件、資料。
   - 按鈕上移用獨立的 translate 屬性，不碰 transform（不會和既有定位或卡片傾斜衝突）
   - 聚光燈是一層蓋在畫面上的固定圖層（pointer-events:none），不往網格裡塞元素
   - 大型內容卡（裡面有表格、表單）不傾斜；觸控裝置不啟用懸停／傾斜／聚光燈
   - 滑鼠與捲動都用 requestAnimationFrame 節流；尊重「減少動態效果」系統設定
   關閉方式：網址加 ?fx=off，或 localStorage.ac_ui_fx='off' */
(function(){
  'use strict';
  if(window.__acUiFx)return;window.__acUiFx=1;
  try{if(/[?&]fx=off/.test(location.search)||localStorage.getItem('ac_ui_fx')==='off')return;}catch(e){}
  var fine=window.matchMedia&&matchMedia('(hover:hover) and (pointer:fine)').matches;
  var calm=window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches;
  var TILT='.mod-btn,.kpi,a.card,.mod-card,.tool-card,[data-fx="tilt"]';
  var BTN='button,.btn,a.btn,[role="button"],input[type="button"],input[type="submit"]';
  var NOBTN=':not(:disabled):not(.fx-tilt):not(.tab):not(.hra-tab):not([role="tab"]):not([class*="navbtn"]):not(.fx-top):not([data-fx="off"])';

  var css='';
  /* ── 7 卡片互動微變色（2026-11-22 Paul）──
     小卡片（模組卡、KPI、統計格）四色輪替：淺藍／淺綠／粉紅／粉橘。用「內陰影疊一層 12% 色光」的方式上色，
     淺色主題看起來是柔和淺色，深色主題就是色光疊加，文字對比不變，也不會蓋掉卡片原本的底色或漸層。
     電腦：@media(hover:hover) 才有 :hover，150ms 漸變。手機：不用 :hover（不會卡色），手指按下 :active 立刻變色、放開恢復。 */
  var CARD='.mod-btn,.kpi,a.card,.mod-card,.tool-card,.stat-item,.hstat,.kn-n,[data-fx="tilt"],[data-fx="card"]';
  var PAL=['59,130,246','16,185,129','236,72,153','249,115,22'];
  function tintRule(state){return PAL.map(function(c,i){return CARD.split(',').map(function(x){return x+':nth-child(4n+'+(i+1)+')'+state;}).join(',')+'{box-shadow:inset 0 0 0 999px rgba('+c+',.12),0 4px 14px rgba('+c+',.18)!important;border-color:rgba('+c+',.55)!important}';}).join('');}
  css+=CARD+'{transition:box-shadow .15s ease-out,border-color .15s ease-out,transform .3s ease-out;-webkit-tap-highlight-color:transparent}';
  css+='@media (hover:hover){'+tintRule(':hover')+'}';
  css+='@media (hover:none){'+CARD.split(',').map(function(x){return x+':active';}).join(',')+'{transition-duration:0s}'+tintRule(':active')+'}';
  try{document.addEventListener('touchstart',function(){},{passive:true});}catch(e){}      /* 讓 iOS 也有 :active */
  if(fine){
    css+=BTN.split(',').map(function(s){return s+NOBTN;}).join(',')+'{transition:translate .15s ease-out,box-shadow .15s ease-out,filter .15s ease-out;cursor:pointer}';
    css+=BTN.split(',').map(function(s){return s+NOBTN+':hover';}).join(',')+'{translate:0 -2px;box-shadow:0 6px 16px rgba(15,23,42,.22);filter:brightness(.92)}';
    css+='.fx-tilt{transition:transform .3s ease-out,box-shadow .15s ease-out,border-color .15s ease-out;will-change:transform;cursor:pointer}.fx-tilt.fx-on{transition:transform .08s linear,box-shadow .15s ease-out,border-color .15s ease-out}';
    css+='.fx-lit{outline:1px solid rgba(255,255,255,calc(var(--fx-glow,0)*.55));outline-offset:-1px}';
    css+='#fx-spot{position:fixed;inset:0;pointer-events:none;z-index:40;opacity:0;transition:opacity .2s ease-out;background:radial-gradient(240px circle at var(--fx-x,-999px) var(--fx-y,-999px),rgba(255,255,255,.15),rgba(255,255,255,0) 100%)}#fx-spot.on{opacity:1}';
  }
  css+='.fx-nav{position:sticky!important;top:0;z-index:60;transition:padding .2s ease,background-color .2s ease,box-shadow .2s ease,min-height .2s ease}';
  css+='.fx-nav.fx-stuck{-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);box-shadow:0 1px 10px rgba(15,23,42,.14);padding-top:var(--fx-pt)!important;padding-bottom:var(--fx-pb)!important}';
  css+='.fx-top{position:fixed;right:24px;bottom:24px;width:48px;height:48px;border-radius:50%;border:0;z-index:70;background:#0f172a;color:#fff;font-size:20px;line-height:48px;text-align:center;padding:0;cursor:pointer;box-shadow:0 4px 14px rgba(15,23,42,.3);opacity:0;visibility:hidden;transform:translateY(8px);transition:opacity .25s ease,transform .25s ease,visibility .25s}';
  css+='.fx-top.on{opacity:.92;visibility:visible;transform:none}.fx-top.on:hover{transform:translateY(-3px);opacity:1}';
  if(calm)css+='.fx-tilt,.fx-nav,.fx-top{transition:none!important}';
  var st=document.createElement('style');st.id='ac-ui-fx';st.textContent=css;document.head.appendChild(st);

  /* ── 顏色判斷 ── */
  function rgb(s){var m=String(s||'').match(/rgba?\(([^)]+)\)/);if(m){var p=m[1].split(/[,\s/]+/).map(parseFloat);if(p.length>3&&p[3]<0.05)return null;return p.slice(0,3);}m=String(s||'').match(/#([0-9a-f]{6})/i);return m?[parseInt(m[1].slice(0,2),16),parseInt(m[1].slice(2,4),16),parseInt(m[1].slice(4,6),16)]:null;}
  function bgOf(el){for(;el&&el.nodeType===1;el=el.parentElement){var c=getComputedStyle(el),g=c.backgroundImage&&c.backgroundImage!=='none'?rgb(c.backgroundImage):null;if(g)return g;var b=rgb(c.backgroundColor);if(b)return b;}return [255,255,255];}
  function dark(c){return (0.2126*c[0]+0.7152*c[1]+0.0722*c[2])/255<0.4;}

  /* ── 3 傾斜 ＋ 2 聚光燈 ── */
  function tiltable(el){
    if(el.dataset.fx==='off'||el.closest('[data-fx="off"]'))return false;
    if(el.querySelector('table,input,select,textarea,canvas'))return false;      /* 內容卡不傾斜 */
    var r=el.getBoundingClientRect();if(r.width<60||r.height<36||r.width>560||r.height>320)return false;
    /* 卡片自己原本只有「上移」這類位移的懸停效果時，改由傾斜接手（兩者不疊加） */
    var t=getComputedStyle(el).transform;return !t||t==='none'||el.classList.contains('fx-tilt')||/^matrix\(1, 0, 0, 1, /.test(t);
  }
  if(fine&&!calm){
    var spot=document.createElement('div');spot.id='fx-spot';(document.body||document.documentElement).appendChild(spot);
    var mx=0,my=0,cur=null,grid=null,lit=[],tick=false;
    function leave(){if(cur){cur.classList.remove('fx-on');cur.style.transform='';cur=null;}}
    function unlit(){lit.forEach(function(c){c.classList.remove('fx-lit');c.style.removeProperty('--fx-glow');});lit=[];spot.classList.remove('on');grid=null;}
    function frame(){
      tick=false;
      var el=document.elementFromPoint(mx,my),card=el&&el.closest?el.closest(TILT):null;
      if(card&&!tiltable(card))card=null;
      if(card!==cur){leave();if(card){cur=card;card.classList.add('fx-tilt');void card.offsetWidth;card.classList.add('fx-on');}}
      if(cur){var r=cur.getBoundingClientRect(),px=(mx-r.left)/r.width-.5,py=(my-r.top)/r.height-.5;
        cur.style.transform='perspective(1000px) rotateX('+(-py*16).toFixed(2)+'deg) rotateY('+(px*16).toFixed(2)+'deg) scale(1.02)';}
      /* 聚光燈：游標在「深色背景的卡片群」上才亮 */
      var g=null,any=el&&el.closest?el.closest(TILT):null;
      if(any&&any.parentElement&&any.parentElement.querySelectorAll(':scope > '+TILT.split(',').join(',:scope > ')).length>=2)g=any.parentElement;
      else if(el&&el.querySelectorAll&&el.children.length>=2&&el.querySelectorAll(':scope > '+TILT.split(',').join(',:scope > ')).length>=2)g=el;
      if(g&&!dark(bgOf(g)))g=null;
      if(g!==grid){unlit();grid=g;}
      if(grid){
        var gr=grid.getBoundingClientRect();
        spot.style.clipPath='inset('+Math.max(0,gr.top)+'px '+Math.max(0,innerWidth-gr.right)+'px '+Math.max(0,innerHeight-gr.bottom)+'px '+Math.max(0,gr.left)+'px)';
        spot.style.setProperty('--fx-x',mx+'px');spot.style.setProperty('--fx-y',my+'px');spot.classList.add('on');
        lit=[].slice.call(grid.querySelectorAll(':scope > '+TILT.split(',').join(',:scope > ')));
        lit.forEach(function(c){var r=c.getBoundingClientRect(),dx=Math.max(r.left-mx,0,mx-r.right),dy=Math.max(r.top-my,0,my-r.bottom),d=Math.sqrt(dx*dx+dy*dy);
          c.classList.add('fx-lit');c.style.setProperty('--fx-glow',Math.max(0,1-d/240).toFixed(2));});
      }
    }
    document.addEventListener('mousemove',function(e){mx=e.clientX;my=e.clientY;if(!tick){tick=true;requestAnimationFrame(frame);}},{passive:true});
    document.addEventListener('mouseleave',function(){leave();unlit();});
    window.addEventListener('blur',function(){leave();unlit();});
  }

  /* ── 4 吸頂 ＋ 5 回頂 ── */
  var scroller=null,nav=null,navOk=false,stuck=false,topBtn=null,sTick=false;
  function sy(){return scroller?scroller.scrollTop:(window.pageYOffset||document.documentElement.scrollTop||0);}
  function vh(){return scroller?scroller.clientHeight:window.innerHeight;}
  function initNav(){
    if(innerWidth<900)return;                                   /* 手機／窄螢幕不吸頂：頭列會佔掉太多畫面 */
    var c=document.querySelector('body > header, body > .header, body > .hdr, body > .topbar, .wrap > .portal-hdr, body > nav');
    if(!c)return;
    var cs=getComputedStyle(c);if(cs.position==='sticky'||cs.position==='fixed')return;   /* 已經吸頂的不動 */
    var r=c.getBoundingClientRect();if(r.height>110||r.top+sy()>40)return;
    /* 頁面已有別的吸頂列（分頁列等）就不做，避免兩條疊在一起 */
    var others=[].slice.call(document.querySelectorAll('body *')).slice(0,400).some(function(e){if(e===c||c.contains(e))return false;var s=getComputedStyle(e);return (s.position==='sticky'||s.position==='fixed')&&parseFloat(s.top)<=8&&e.offsetHeight>20&&e.offsetHeight<140&&e.offsetWidth>innerWidth*.5&&!e.closest('table')&&s.display!=='none'&&s.visibility!=='hidden'&&e.id!=='fx-spot';});
    if(others)return;
    for(var p=c.parentElement;p&&p!==document.body;p=p.parentElement){var o=getComputedStyle(p);if(/(auto|scroll|hidden)/.test(o.overflowY)&&p!==scroller)return;}
    nav=c;navOk=true;
    var pt=parseFloat(cs.paddingTop)||0,pb=parseFloat(cs.paddingBottom)||0,cut=Math.max(0,Math.min(8,(r.height-64)/2));
    c.style.setProperty('--fx-pt',Math.max(2,pt-cut)+'px');c.style.setProperty('--fx-pb',Math.max(2,pb-cut)+'px');
    c.classList.add('fx-nav');
    var hasImg=cs.backgroundImage&&cs.backgroundImage!=='none',col=rgb(cs.backgroundColor);
    c.__fxBg=hasImg?null:(col?'rgba('+col.join(',')+',.82)':(dark(bgOf(c))?'rgba(15,23,42,.78)':'rgba(255,255,255,.82)'));
  }
  function onScroll(){
    sTick=false;var y=sy();
    if(navOk){var want=stuck?y>56:y>80;if(want!==stuck){stuck=want;nav.classList.toggle('fx-stuck',stuck);if(nav.__fxBg)nav.style.backgroundColor=stuck?nav.__fxBg:'';}}
    if(topBtn){
      if(y>vh()){   /* 右下角如果已經有別的浮動按鈕，往上讓開 */
        if(!topBtn.classList.contains('on')){var hit=document.elementsFromPoint(innerWidth-48,innerHeight-48).filter(function(e){return e!==topBtn&&getComputedStyle(e).position==='fixed'&&e.id!=='fx-spot';})[0];topBtn.style.bottom=hit?Math.min(innerHeight-hit.getBoundingClientRect().top+12,220)+'px':'24px';}
        topBtn.classList.add('on');
      }else topBtn.classList.remove('on');
    }
  }
  function req(){if(!sTick){sTick=true;requestAnimationFrame(onScroll);}}
  function toTop(){
    var from=sy(),t0=null;if(calm||from<=0){scroller?scroller.scrollTop=0:window.scrollTo(0,0);return;}
    function step(ts){if(t0===null)t0=ts;var k=Math.min(1,(ts-t0)/500),e=1-Math.pow(1-k,3),v=Math.round(from*(1-e));scroller?scroller.scrollTop=v:window.scrollTo(0,v);if(k<1)requestAnimationFrame(step);}
    requestAnimationFrame(step);
  }
  function init(){
    topBtn=document.createElement('button');topBtn.type='button';topBtn.className='fx-top';topBtn.setAttribute('aria-label','Back to top');topBtn.title='Top';topBtn.textContent='↑';
    topBtn.addEventListener('click',toTop);document.body.appendChild(topBtn);
    window.addEventListener('scroll',req,{passive:true});
    /* 有些頁面是內層容器在捲：第一次抓到大的捲動容器就改盯它 */
    document.addEventListener('scroll',function(e){var t=e.target;if(t&&t.nodeType===1&&t!==scroller&&t.clientHeight>=innerHeight*.7&&t.scrollHeight>t.clientHeight+40&&t.clientWidth>=innerWidth*.6){scroller=t;}req();},{passive:true,capture:true});
    setTimeout(function(){try{initNav();}catch(e){}req();},600);
  }
  /* ── 6 回平台選單（2026-11-22 Paul：每頁最上面一條，不用退出再進來）── */
  function homeBar(){
    var path=location.pathname,pay=/\/ac-hra-pay\//.test(path),file=path.split('/').pop()||'index.html';
    if(document.getElementById('fx-home'))return;
    if(pay?/^(index\.html)?$/.test(file):/^hra_portal_v2\.html$/.test(file))return;      /* 選單頁自己不用 */
    if(!pay&&!/\/ac-hra-portal\//.test(path))return;
    var href=pay?'./index.html':'./hra_portal_v2.html',name=pay?'HRA-PAY':'HRA Portal';
    var a=document.createElement('a');a.id='fx-home';a.href=href;a.setAttribute('data-fx','off');
    a.innerHTML='<span style="font-size:15px">‹</span> 🏠 <b>'+name+'</b> 選單 Menu';
    var bs=getComputedStyle(document.body),row=(bs.display==='flex'&&!/column/.test(bs.flexDirection))||bs.display==='grid';
    var base='font:600 13px/1 system-ui,"Noto Sans TC",sans-serif;color:#fff;background:#0f172a;text-decoration:none;display:flex;align-items:center;gap:6px;';
    if(row){a.style.cssText=base+'position:fixed;top:6px;left:6px;z-index:80;padding:8px 12px;border-radius:999px;box-shadow:0 2px 10px rgba(15,23,42,.3);opacity:.92';document.body.appendChild(a);}
    else{
      /* v5：外面包一條（不可點），連結只有文字那麼寬 → 右邊留空給 ♪ 音樂／🎨 調色盤停靠，不會浮到畫面中間蓋住資料 */
      var bar=document.createElement('div');bar.id='fx-homebar';bar.style.cssText='background:#0f172a;display:flex;align-items:center;min-height:32px;width:100%;box-sizing:border-box';
      a.style.cssText=base+'padding:8px 12px;background:transparent;display:inline-flex';bar.appendChild(a);document.body.insertBefore(bar,document.body.firstChild);
    }
  }

  /* ── 8 標題列融合調色盤＋手機精簡 v5（2026-11-23 Paul：調色盤選了顏色，上方深色標題列還是一塊深色融不進去 → 學 PSJERP 的做法）──
     融合：🎨 調色盤（PSJERP 的 music.js，整頁蓋一層色片）有選顏色時，把「淺色頁面上的深色標題列」改成淺底深字，
           色片蓋上去就跟下面的卡片同一個色調。白色（沒選色）時維持原本的深色標題列；整頁本來就是深色的首頁不動。
           只有「原本是白字、直接壓在標題列上」的字才改深色；本來有自己底色的按鈕（綠／黃／紅）保留原色。
     精簡：手機（≤700px）標題列收矮 —— 拿掉大圖示和副標、標題字縮小、按鈕縮小排成一列（可左右滑）、分頁列與日期列收緊。
     只動外觀，不碰事件與資料；Tailwind 白底標題列不處理。 */
  var H=document.documentElement,hdrs=[],hdrObs=[],hdrTimer=0,INK='#14202b';
  var HC='html.fx-pal .fx-hdk';
  css='';
  css+=HC+'{background:#e9eff4!important;background-image:none!important;color:'+INK+'!important;box-shadow:0 1px 0 #c5d0db!important;border-color:#c5d0db!important}';
  css+=HC+' .fx-ink{color:'+INK+'!important;text-shadow:none!important;-webkit-text-fill-color:currentColor!important}'+HC+' .fx-ink2{color:#566779!important;text-shadow:none!important}';
  css+=HC+' .fx-hb{background:#fff!important;background-image:none!important;border:1px solid #bccad7!important;color:'+INK+'!important;box-shadow:none!important;text-shadow:none!important}';
  css+=HC+' .fx-hbd{border-color:#bccad7!important}'+HC+' .fx-hbg{background:rgba(20,32,43,.06)!important;background-image:none!important}';
  css+='html.fx-pal #fx-homebar{background:#dde6ee!important;box-shadow:0 1px 0 #c5d0db!important}html.fx-pal #fx-homebar #fx-home{color:'+INK+'!important}';
  css+='html.fx-nt *{transition:none!important;animation:none!important}';
  css+='@media (max-width:700px){#fx-homebar #fx-home{font-size:12px!important;padding:7px 10px!important}'+
    '.fx-hdr.fx-cp,.fx-hdr .fx-cp{padding-top:6px!important;padding-bottom:6px!important;min-height:0!important}'+
    '.fx-hdr .fx-hide{display:none!important}'+
    '.fx-hdr .fx-ttl{font-size:15px!important;line-height:1.25!important;margin:0!important;letter-spacing:0!important}'+
    '.fx-hdr .fx-cb{min-height:30px!important;height:auto!important;min-width:34px!important;padding:3px 8px!important;border-radius:8px!important}'+
    '.fx-hdr .fx-cb>span{font-size:15px!important}'+
    '.fx-hdr .fx-row{flex-wrap:nowrap!important;overflow-x:auto!important;scrollbar-width:none;gap:6px!important;margin-top:6px!important;-webkit-overflow-scrolling:touch}.fx-hdr .fx-row::-webkit-scrollbar{display:none}.fx-hdr .fx-row>*{flex:0 0 auto!important;width:auto!important;white-space:nowrap}'+
    '.tab-wrap .tabs{flex-wrap:nowrap!important}.tab-wrap .tab{padding:8px 11px!important;font-size:13px!important}'+
    '.period-bar{gap:6px!important;margin-top:8px!important}.period-bar .seg button{padding:6px 10px!important;font-size:13px!important}.period-bar .nav-btn{width:34px!important;height:34px!important;font-size:14px!important}.period-bar .control{height:34px!important;font-size:13px!important;padding:0 8px!important}'+
  '}';
  var st8=document.createElement('style');st8.id='ac-ui-fx-hdr';st8.textContent=css;document.head.appendChild(st8);
  function rgba(c){var m=String(c||'').match(/[\d.]+/g);if(!m||m.length<3)return null;return {r:+m[0],g:+m[1],b:+m[2],a:m.length>3?+m[3]:1};}
  function lumOf(o){return (0.2126*o.r+0.7152*o.g+0.0722*o.b)/255;}
  function bgOf(cs){var o=rgba(cs.backgroundColor);if(o&&o.a>=.5)return o;var im=cs.backgroundImage;if(im&&im!=='none'&&/gradient/.test(im)){var m=im.match(/rgba?\([^)]+\)/);var g=m&&rgba(m[0]);if(g&&g.a>=.5)return g;}return null;}
  function pageLight(){var b=bgOf(getComputedStyle(document.body))||bgOf(getComputedStyle(H));return !b||lumOf(b)>.6;}
  function findHdrs(){
    var out=[],sel='body>header,body>.header,body>.hdr,body>.top,body>.topbar,body>.app-header,body>.ct-apphead';
    var cand=[].slice.call(document.querySelectorAll(sel));
    [].slice.call(document.querySelectorAll('header,.header,.hdr,.top,.topbar,#topbar,.app-header')).slice(0,6).forEach(function(e){if(cand.indexOf(e)<0&&e.getBoundingClientRect().width>=window.innerWidth*.9)cand.push(e);});
    [].slice.call(document.body.children).slice(0,5).forEach(function(e){if(cand.indexOf(e)<0)cand.push(e);});
    cand.forEach(function(e){
      if(e.id==='fx-home'||e.id==='fx-homebar'||e.closest('#fx-homebar')||/^(SCRIPT|STYLE|LINK|NAV|MAIN)$/.test(e.tagName)||/\bbg-white\b/.test(e.className||''))return;
      var cs=getComputedStyle(e);if(cs.display==='none'||cs.position==='fixed')return;
      var r=e.getBoundingClientRect();if(r.top+window.scrollY>150||r.height>340||r.height<24)return;
      var bg=bgOf(cs);if(!bg||lumOf(bg)>=.42)return;      /* 只認深色標題列 */
      out.push(e);
    });
    return out;
  }
  function classify(h){
    var mobile=window.innerWidth<=700;
    var hcs=getComputedStyle(h);if(parseFloat(hcs.paddingTop)>8)h.classList.add('fx-cp');
    [].slice.call(h.querySelectorAll('*')).forEach(function(e){
      if(e.closest('#vmBox,#vmPanel,#vpPanel'))return;
      e.classList.remove('fx-ink','fx-ink2','fx-hb','fx-hbd','fx-hbg');      /* 每次重判（語言鈕換「選中」時底色會變）*/
      var cs=getComputedStyle(e),tag=e.tagName,ctl=/^(BUTTON|SELECT|INPUT|A)$/.test(tag);
      /* 這個元素的字是壓在誰的底色上：往上找到標題列為止 */
      var own=bgOf(cs),on=null,p=e;while(p&&p!==h){var b=p===e?own:bgOf(getComputedStyle(p));if(b){on=b;break;}p=p.parentElement;}
      var col=rgba(cs.color),light=col&&lumOf(col)>.6;
      if(!on&&light){
        var bgc=rgba(cs.backgroundColor),veil=bgc&&bgc.a>0&&bgc.a<.5;
        if(ctl&&(veil||parseFloat(cs.borderTopWidth)>0))e.classList.add('fx-hb');
        else{e.classList.add(col.a<.85?'fx-ink2':'fx-ink');if(veil)e.classList.add('fx-hbg');}
      }
      if(!e.classList.contains('fx-hb')&&parseFloat(cs.borderTopWidth)>0){var bc=rgba(cs.borderTopColor);if(bc&&bc.a>0&&lumOf(bc)>.75&&!on)e.classList.add('fx-hbd');}
      /* 手機精簡用的記號（只在 ≤700px 的樣式裡生效）*/
      var cls=String(e.className&&e.className.baseVal!=null?e.className.baseVal:e.className||'');
      if(parseFloat(cs.paddingTop)>8&&e.parentElement===h&&!ctl)e.classList.add('fx-cp');
      if(/logo/i.test(cls)&&!e.querySelector('button,select,input,a'))e.classList.add('fx-hide');
      if((tag==='H1'||tag==='H2'||/title/i.test(cls))&&!e.children.length&&parseFloat(cs.fontSize)>15)e.classList.add('fx-ttl');
      if((tag==='H1'||tag==='H2')&&e.children.length&&parseFloat(cs.fontSize)>15)e.classList.add('fx-ttl');
      if((tag==='P'||/(^|[-_ ])sub($|[-_ ])/i.test(cls))&&!e.querySelector('button,select,input,a')&&parseFloat(cs.fontSize)<=12.5&&!e.id)e.classList.add('fx-hide');
      if(tag==='BUTTON'&&e.getBoundingClientRect().height>33)e.classList.add('fx-cb');
      if(/flex/.test(cs.display)&&cs.flexWrap==='wrap'&&e.querySelectorAll(':scope>button').length>=4)e.classList.add('fx-row');
    });
  }
  function stickyFix(){
    var h=hdrs[0];if(!h)return;
    var n=h.nextElementSibling,k=0;
    while(n&&k++<3){var cs=getComputedStyle(n);if(cs.position==='sticky'&&(n.dataset.fxTop||parseFloat(cs.top)>=40)){n.dataset.fxTop=1;n.style.top=(getComputedStyle(h).position==='sticky'?h.offsetHeight:0)+'px';}n=n.nextElementSibling;}
  }
  function palState(){return !!document.getElementById('vpTint')||H.classList.contains('vp-dark');}
  var lightPg=true;
  function syncPal(){var on=palState()&&lightPg;if(H.classList.contains('fx-pal')!==on)H.classList.toggle('fx-pal',on);stickyFix();}
  function scanHdr(){
    if(!document.body)return;
    var had=H.classList.contains('fx-pal');H.classList.remove('fx-pal');H.classList.add('fx-nt');
    try{
      var light=lightPg=pageLight();
      findHdrs().forEach(function(h){if(hdrs.indexOf(h)<0){hdrs.push(h);h.classList.add('fx-hdr');if(light)h.classList.add('fx-hdk');
        try{var mo=new MutationObserver(function(){clearTimeout(hdrTimer);hdrTimer=setTimeout(scanHdr,200);});mo.observe(h,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});hdrObs.push(mo);}catch(e){}}});
      hdrs.forEach(classify);
    }catch(e){}
    H.classList.remove('fx-nt');if(had)H.classList.add('fx-pal');
    syncPal();
    hdrObs.forEach(function(m){try{m.takeRecords();}catch(e){}});      /* 自己加的記號不算變動，免得一直重掃 */
  }
  function hdrBoot(){
    scanHdr();[600,1800,4000].forEach(function(ms){setTimeout(scanHdr,ms);});
    try{new MutationObserver(syncPal).observe(document.body,{childList:true});new MutationObserver(syncPal).observe(H,{attributes:true,attributeFilter:['class']});}catch(e){}
    window.addEventListener('resize',function(){clearTimeout(hdrTimer);hdrTimer=setTimeout(function(){stickyFix();},150);},{passive:true});
    try{if(window.ResizeObserver)new ResizeObserver(stickyFix).observe(hdrs[0]||document.body);}catch(e){}
  }
  function boot(){init();try{homeBar();}catch(e){}try{hdrBoot();}catch(e){}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
