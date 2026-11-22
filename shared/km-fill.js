/* 柬文補齊 v1（2026-11-22 Paul：選柬文時不要一堆中英文；翻不出來才用英文；中英柬分清楚）
   1) 選柬文時：畫面上「整段剛好是常用英文介面字」的文字（按鈕、欄位標題、分頁、月份…）換成柬文。只換完全相符的介面字，
      不碰資料（姓名、部門代碼、金額、備註）。切回中文／英文會還原。
   2) 大字卡（Keynote）和我們加的標示原本是「中文 English」並列：中文模式只留中文，英文／柬文模式只留英文（柬文再套 1）。
   由 row-keynote.js 自動載入，所以掛了大字卡的頁面都有。關閉：localStorage.ac_km_fill='off' */
(function(){
  'use strict';
  if(window.__acKmFill)return;window.__acKmFill=1;
  try{if(localStorage.getItem('ac_km_fill')==='off')return;}catch(e){}
  var M={
    'all':'ទាំងអស់','save':'រក្សាទុក','cancel':'បោះបង់','delete':'លុប','edit':'កែប្រែ','close':'បិទ','search':'ស្វែងរក','add':'បន្ថែម',
    'import':'នាំចូល','export':'នាំចេញ','export csv':'នាំចេញ CSV','print':'បោះពុម្ព','upload':'ផ្ទុកឡើង','download':'ទាញយក','backup':'បម្រុងទុក','restore':'ស្ដារឡើងវិញ',
    'report':'របាយការណ៍','reports':'របាយការណ៍','settings':'ការកំណត់','dashboard':'ផ្ទាំងគ្រប់គ្រង','overview':'ទិដ្ឋភាពទូទៅ','summary':'សង្ខេប','menu':'ម៉ឺនុយ',
    'approval':'ការអនុម័ត','approve':'អនុម័ត','reject':'បដិសេធ','pending':'រង់ចាំ','done':'រួចរាល់','cancelled':'បានលុបចោល','planning':'គម្រោង','status':'ស្ថានភាព',
    'synced':'បានធ្វើសមកាលកម្ម','yes':'បាទ/ចាស','no':'ទេ','total':'សរុប','avg':'មធ្យម','average':'មធ្យម','rank':'ចំណាត់ថ្នាក់','rate':'អត្រា','amount':'ចំនួនទឹកប្រាក់',
    'day':'ថ្ងៃ','week':'សប្តាហ៍','month':'ខែ','year':'ឆ្នាំ','date':'កាលបរិច្ឆេទ','time':'ម៉ោង','duration':'រយៈពេល','period':'រយៈពេល','today':'ថ្ងៃនេះ',
    'name':'ឈ្មោះ','department':'ផ្នែក','dept.':'ផ្នែក','dept':'ផ្នែក','position':'តួនាទី','gender':'ភេទ','age':'អាយុ','male':'ប្រុស','female':'ស្រី','line':'ខ្សែ',
    'factory id':'អត្តលេខ','employee id':'អត្តលេខ','no.':'ល.រ','category':'ប្រភេទ','type':'ប្រភេទ','remarks':'កំណត់សម្គាល់','remark':'កំណត់សម្គាល់','notes':'កំណត់ចំណាំ',
    'records':'កំណត់ត្រា','record':'កំណត់ត្រា','people':'នាក់','headcount':'ចំនួនបុគ្គលិក','attendance':'វត្តមាន','absence':'អវត្តមាន','leave':'ច្បាប់ឈប់',
    'join':'ចូលធ្វើការ','joins':'ចូលធ្វើការ','resign':'លាឈប់','resigns':'លាឈប់','turnover':'អត្រាចេញ','contract':'កិច្ចសន្យា','contracts':'កិច្ចសន្យា','probation':'សាកល្បង',
    'maternity':'មាតុភាព','calendar':'ប្រតិទិន','manpower':'កម្លាំងពលកម្ម','welfare':'សុខុមាលភាព','training':'បណ្តុះបណ្តាល','certificate':'វិញ្ញាបនបត្រ','analytics':'វិភាគ',
    'safety':'សុវត្ថិភាព','hr':'ធនធានមនុស្ស','health':'សុខភាព','admin':'រដ្ឋបាល','audit':'សវនកម្ម','environment':'បរិស្ថាន','production':'ផលិតកម្ម',
    'annual plan':'ផែនការប្រចាំឆ្នាំ','monthly records':'កំណត់ត្រាប្រចាំខែ','training library':'បណ្ណាល័យបណ្តុះបណ្តាល','training records':'កំណត់ត្រាបណ្តុះបណ្តាល',
    'plan vs actual':'ផែនការធៀបនឹងជាក់ស្តែង','add training':'បន្ថែមវគ្គបណ្តុះបណ្តាល','add record':'បន្ថែមកំណត់ត្រា','send summary to telegram':'ផ្ញើសង្ខេបទៅ Telegram',
    'training subject':'ប្រធានបទបណ្តុះបណ្តាល','trainer':'គ្រូបង្គោល','hrs':'ម៉ោង','hours':'ម៉ោង','participant':'អ្នកចូលរួម','freq.':'ភាពញឹកញាប់','frequency':'ភាពញឹកញាប់',
    'att.':'ចូលរួម','abs.':'អវត្តមាន','click month cell to toggle status':'ចុចប្រអប់ខែដើម្បីប្ដូរស្ថានភាព',
    'jan':'មករា','feb':'កុម្ភៈ','mar':'មីនា','apr':'មេសា','may':'ឧសភា','jun':'មិថុនា','jul':'កក្កដា','aug':'សីហា','sep':'កញ្ញា','oct':'តុលា','nov':'វិច្ឆិកា','dec':'ធ្នូ',
    'statistics':'ស្ថិតិ','freq':'ភាពញឹកញាប់','sync again':'ធ្វើសមកាលកម្មម្ដងទៀត','synced ✓':'បានធ្វើសមកាលកម្ម ✓','times':'ដង','monthly':'ប្រចាំខែ','weekly':'ប្រចាំសប្តាហ៍','yearly':'ប្រចាំឆ្នាំ','all employees':'បុគ្គលិកទាំងអស់','new hire':'បុគ្គលិកថ្មី','key':'សំខាន់','all data':'ទិន្នន័យទាំងអស់','compare':'ប្រៀបធៀប','prev':'មុន','next':'បន្ទាប់','swipe':'អូស','expected':'ត្រូវមក','present':'មានវត្តមាន','absent':'អវត្តមាន',
    'photos / evidence':'រូបថត / ភស្តុតាង','monthly status':'ស្ថានភាពប្រចាំខែ','sessions held this year':'វគ្គដែលបានធ្វើក្នុងឆ្នាំនេះ','edit / add photos':'កែប្រែ / បន្ថែមរូបថត',
    'no matching training records yet':'មិនទាន់មានកំណត់ត្រាបណ្តុះបណ្តាលត្រូវគ្នា','sync all':'ធ្វើសមកាលកម្មទាំងអស់','sync selected':'ធ្វើសមកាលកម្មដែលបានជ្រើស'
  };
  function lang(){var v='';try{v=typeof LANG!=='undefined'?LANG:'';}catch(e){}if(!v)try{v=typeof lang_cur!=='undefined'?lang_cur:(typeof curLang!=='undefined'?curLang:(typeof currentLang!=='undefined'?currentLang:''));}catch(e){}
    if(!v)v=document.documentElement.getAttribute('data-lang')||'';v=String(v).toLowerCase();return /^(kh|km)/.test(v)?'km':/^en/.test(v)?'en':/^(zh|tc|cn)/.test(v)?'zh':'';}
  var CJK=/[㐀-鿿＀-￯　-〿]/, EDGE=/^[\s←-⯿\u{1F000}-\u{1FAFF}️+•·:：|/\-–—()\[\]\d.,%✓✕✔✖↑↓←→‹›▲▼]*|[\s:：|·•()\[\]\d,%/\-–—✓✕↑↓▲▼›‹]*$/gu;
  /* 我們自己加的雙語標示：依語言只留一種 */
  var OWN='#kn-tabs button,#kn-foot button,#kn-hint,.kn-ref,.kn-nl,.kn-rl,#kn-sub,.tk-h,.tk-btn,.tk-rate,.tk-sec,#fx-home';
  function tidyOwn(L){
    [].forEach.call(document.querySelectorAll(OWN),function(el){
      var w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT,null),n;
      while((n=w.nextNode())){
        var p=n.parentElement;if(!p||p.closest('.kn-rv,.kn-nv,#kn-title > :not(#kn-sub),.tk-list,b'))continue;
        if(n.__own===undefined)n.__own=n.nodeValue;var o=n.__own,r=o;
        if(/[A-Za-z]{2}/.test(o)&&CJK.test(o)){
          if(L==='zh')r=o.replace(/ ?[A-Za-z][A-Za-z ./'-]*[A-Za-z.]/g,function(m){return /^(PDF|CSV|Excel|Telegram|ID|HRA|PAY|Portal|GAS|AC|VRT)\b/.test(m.trim())?m:'';});
          else r=o.replace(/[㐀-鿿！-～　-〿]+\s?/g,'');
        }
        if(r!==n.nodeValue&&r.trim())n.nodeValue=r;
      }
    });
  }
  function fill(L){
    var w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,{acceptNode:function(n){var p=n.parentElement;if(!p)return 2;var t=p.tagName;return (t==='SCRIPT'||t==='STYLE'||t==='TEXTAREA'||t==='OPTION'&&false||p.isContentEditable||p.closest('.kn-rv,.kn-nv,[data-km="off"]'))?2:1;}}),n,c=0;
    while((n=w.nextNode())&&c<6000){c++;
      if(L!=='km'){if(n.__km!==undefined&&n.nodeValue===n.__kmNew){n.nodeValue=n.__km;}continue;}
      var v=n.nodeValue;if(!v||v.length>60||!/[A-Za-z]{2}/.test(v)||/[ក-៿]/.test(v))continue;
      var core=v.replace(EDGE,'');if(!core)continue;var k=M[core.toLowerCase()];if(!k)continue;
      n.__km=v;n.nodeValue=n.__kmNew=v.replace(core,k);
    }
  }
  var last='',tm=null;
  function run(){tm=null;var L=lang();if(!L)return;last=L;try{tidyOwn(L);fill(L);}catch(e){}}
  function req(){if(!tm)tm=setTimeout(run,250);}
  function init(){run();try{new MutationObserver(req).observe(document.body,{childList:true,subtree:true,characterData:false});}catch(e){}setInterval(function(){if(lang()!==last)req();},900);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
