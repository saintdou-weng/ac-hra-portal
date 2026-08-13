/* AC HRA cross-module employee status link.
   Reads the shared onboarding resignation mirror without creating a second
   source of truth.  Missing data is intentionally rendered as blank. */
(function(w){
  'use strict';
  function read(key){try{var v=JSON.parse(w.localStorage.getItem(key)||'[]');return Array.isArray(v)?v:[];}catch(e){return[];}}
  function idOf(r){r=r||{};return String(r.empId||r.employeeId||r.idNo||r.factoryId||r.cardId||r.id||'').trim();}
  function resigns(){
    var a=read('ac_hra_resigns'), b=read('vrt_dashFinish'), out=[], seen={};
    a.concat(b).forEach(function(r){
      var id=idOf(r), d=String(r.resignDate||r.date||r.period||'').slice(0,10);
      if(!id&&!d)return;
      var k=id+'|'+d+'|'+String(r.name||'');
      if(!seen[k]){seen[k]=1;out.push(Object.assign({},r,{_statusId:id,_statusDate:d}));}
    });
    return out;
  }
  function forEmployee(r,refDate){
    var id=idOf(r), ref=String(refDate||'').slice(0,10), rows=resigns().filter(function(x){
      return id&&x._statusId===id;
    });
    rows.sort(function(a,b){return String(b._statusDate||'').localeCompare(String(a._statusDate||''));});
    if(ref){
      var before=rows.filter(function(x){return !x._statusDate||x._statusDate<=ref;});
      if(before.length)return before[0];
    }
    return rows[0]||null;
  }
  function text(r,refDate){
    var x=forEmployee(r,refDate); if(!x)return '';
    return 'Resigned'+(x._statusDate?' '+x._statusDate:'');
  }
  function html(r,refDate,lang){
    var x=forEmployee(r,refDate); if(!x)return '';
    var d=x._statusDate||'', zh='已離職'+(d?' '+d:''), en='Resigned'+(d?' '+d:''), km='បានចាកចេញ'+(d?' '+d:'');
    var label=lang==='km'?km:lang==='en'?en:zh;
    return '<span class="pill bg-rose-50 text-rose-700">⚠ '+esc0(label)+'</span>';
  }
  function esc0(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  w.HRAStatusLink={idOf:idOf,resigns:resigns,forEmployee:forEmployee,text:text,html:html};
})(window);
