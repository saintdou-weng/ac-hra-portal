/* AC HRA UI 動效 v1（2026-11-22，Paul 指定 5 項）
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
  if(fine){
    css+=BTN.split(',').map(function(s){return s+NOBTN;}).join(',')+'{transition:translate .15s ease-out,box-shadow .15s ease-out,filter .15s ease-out;cursor:pointer}';
    css+=BTN.split(',').map(function(s){return s+NOBTN+':hover';}).join(',')+'{translate:0 -2px;box-shadow:0 6px 16px rgba(15,23,42,.22);filter:brightness(.92)}';
    css+='.fx-tilt{transition:transform .3s ease-out;will-change:transform;cursor:pointer}.fx-tilt.fx-on{transition:transform .08s linear}';
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
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
