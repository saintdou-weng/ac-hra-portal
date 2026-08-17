/* AC HRA Portal shared action bar
   It only wires the existing module functions to a common action layout. */
(function(){
  'use strict';

  var labels = {
    import:   ['匯入 Excel','Import Excel','នាំចូល Excel'],
    upload:   ['上傳','Upload','ផ្ទុកឡើង'],
    download: ['下載','Download','ទាញយក'],
    telegram: ['Telegram 摘要','Telegram Summary','សេចក្តីសង្ខេប Telegram'],
    export:   ['匯出 XLSX','Export XLSX','នាំចេញ XLSX'],
    print:    ['列印','Print','បោះពុម្ព'],
    config:   ['雲端設定','Cloud settings','ការកំណត់ Cloud']
  };

  function addCss(){
    if(document.querySelector('link[data-portal-actionbar-css]')) return;
    var link=document.createElement('link');
    link.rel='stylesheet';
    link.href='shared/portal-actionbar.css';
    link.setAttribute('data-portal-actionbar-css','1');
    (document.head||document.documentElement).appendChild(link);
  }
  function text(key,override){
    var x=override||labels[key]||[key,key,key];
    return '<span class="portal-action-label">'+
      '<span class="portal-label-zh">'+x[0]+'</span><span class="portal-label-en">'+x[1]+'</span><span class="portal-label-km">'+x[2]+'</span></span>';
  }
  function button(key, handler, extra){
    var b=document.createElement('button');
    b.type='button';
    b.className='portal-action-btn portal-'+key+(extra&&extra.className?' '+extra.className:'');
    b.setAttribute('data-portal-action',key);
    var lx=(extra&&extra.labels)||labels[key]||[key,key,key];
    b.title=lx.join(' / ');
    b.innerHTML=(extra&&extra.icon?extra.icon+' ':'')+text(key,lx);
    b.addEventListener('click',function(e){e.preventDefault();handler(e);});
    return b;
  }
  function call(name,args){
    return function(){
      var fn=window[name];
      if(typeof fn==='function') return fn.apply(window,args||[]);
      var el=document.querySelector('[onclick*="'+name+'"]');
      if(el) return el.click();
      if(window.alert) window.alert('Action unavailable: '+name);
    };
  }
  function clickInput(selector){
    return function(){
      var el=document.querySelector(selector);
      if(el) el.click();
      else if(window.alert) window.alert('Import input not found');
    };
  }
  function first(selectors){
    for(var i=0;i<selectors.length;i++){
      var el=document.querySelector(selectors[i]);
      if(el) return el;
    }
    return null;
  }
  function hasAction(host,key){
    return !!host.querySelector('[data-portal-action="'+key+'"]');
  }
  function addAction(host,key,handler,icon,where){
    if(!host||hasAction(host,key)) return null;
    var b=button(key,handler,{icon:icon});
    if(where==='first'&&host.firstChild) host.insertBefore(b,host.firstChild);
    else host.appendChild(b);
    return b;
  }
  function markHost(host){
    if(host) host.classList.add('portal-actionbar');
    return host;
  }
  function wrapCloudButtons(host,upSelector,downSelector){
    if(!host) return;
    var up=host.querySelector(upSelector), down=host.querySelector(downSelector);
    if(!up||!down||up.parentElement===down.parentElement&&up.parentElement.classList.contains('portal-cloud-group')) return;
    var p=up.parentElement;
    if(p!==down.parentElement) return;
    var group=document.createElement('span');
    group.className='portal-cloud-group';
    p.insertBefore(group,up);
    group.appendChild(up);
    group.appendChild(down);
  }
  function injectBar(after, actions){
    if(!after||document.querySelector('.portal-actionbar-injected')) return null;
    var bar=document.createElement('div');
    bar.className='portal-actionbar portal-actionbar-injected no-print';
    actions.forEach(function(a){bar.appendChild(button(a.key,a.handler,a));});
    after.insertAdjacentElement('afterend',bar);
    return bar;
  }
  function makeAction(key,handler,icon,customLabels){return {key:key,handler:handler,icon:icon,labels:customLabels};}

  function setupAttendance(){
    var host=markHost(document.querySelector('.cloud-bar'));
    if(!host) return;
    var buttons=host.querySelector('.cloud-btns')||host;
    addAction(buttons,'import',clickInput('#dz input'),'📥');
    addAction(buttons,'telegram',call('genTelegram',['monthly']),'✈️');
    addAction(buttons,'export',call('exportAllCSV'),'⇩');
    addAction(buttons,'print',function(){window.print();},'🖨️');
  }
  function setupCalendar(){
    var header=document.querySelector('.header');
    injectBar(header,[
      makeAction('import',call('openCalendarImportPicker'),'📥',['匯入行事曆 Excel','Import Calendar Excel','នាំចូល Excel ប្រតិទិន']),
      makeAction('upload',call('calPush'),'☁↑'),
      makeAction('download',call('calPull'),'☁↓'),
      makeAction('telegram',call('openTelegramForPeriod'),'✈️'),
      makeAction('export',call('exportExcel'),'⇩'),
      makeAction('print',call('exportColorPrint'),'🖨️'),
      makeAction('config',call('calCloudToggle'),'⚙')
    ]);
    var old=document.getElementById('calCloudBtn');
    if(old) old.style.display='none';
  }
  function setupComplete(){
    var host=markHost(document.querySelector('#hdr .hbtns'));
    if(!host) return;
    addAction(host,'import',clickInput('#attFile'),'📥','first');
  }
  function setupMain(){
    var host=markHost(document.querySelector('.cloud-bar'));
    if(!host) return;
    var actions=host.querySelector('.cloud-btns')||host;
    addAction(actions,'telegram',call('sendTgMenu'),'✈️');
  }
  function setupExisting(){
    var path=(location.pathname||'').toLowerCase();
    var host=null;
    if(path.indexOf('contract')>=0){
      host=markHost(first(['#btn-cloud-down','#btn-cloud-up'])?.parentElement);
      addAction(host,'import',clickInput('#file-in'),'📥');
      wrapCloudButtons(host,'#btn-cloud-up','#btn-cloud-down');
    } else if(path.indexOf('onboarding')>=0){
      host=markHost(first(['#btn-cloud-down','#btn-cloud-up'])?.parentElement);
      addAction(host,'import',clickInput('#file-input'),'📥','first');
      wrapCloudButtons(host,'#btn-cloud-up','#btn-cloud-down');
    } else if(path.indexOf('maternity')>=0){
      host=markHost(first(['#btn-cloud-down','#btn-cloud-up'])?.parentElement);
      addAction(host,'import',clickInput('#file-input'),'📥','first');
      wrapCloudButtons(host,'#btn-cloud-up','#btn-cloud-down');
    } else if(path.indexOf('manpower')>=0){
      host=markHost(document.querySelector('.header-actions'));
      addAction(host,'import',clickInput('#smartFiles'),'📥','first');
    } else if(path.indexOf('certificate')>=0||path.indexOf('welfare')>=0){
      host=markHost(document.querySelector('.actions'));
    } else if(path.indexOf('attendance')>=0){
      setupAttendance();
    } else if(path.indexOf('calendar')>=0){
      setupCalendar();
    } else if(path.indexOf('complete')>=0){
      setupComplete();
    } else if(path.indexOf('hra_portal')>=0||path.endsWith('/')){
      setupMain();
    }
  }
  function ready(){addCss();setupExisting();}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',ready); else ready();
})();
