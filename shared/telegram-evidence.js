/* AC HRA Portal — Telegram evidence collector v1.0
 * Converts record evidence/photos into a compact payload for GAS.
 * No file bytes are copied when the record already stores Drive metadata.
 */
(function(g){
  'use strict';
  if(g.HRATelegramEvidence)return;
  function arr(v){return Array.isArray(v)?v:(v==null?[]:[v]);}
  function labelOf(r, fallback){
    if(fallback)return String(fallback);
    if(!r||typeof r!=='object')return '';
    return String(r.name||r.nameEn||r.nameKh||r.item||r.productName||r.title||r.grievance||r.employeeId||r.empId||r.idNo||r.cardId||r.id||'');
  }
  function mimeGuess(x){
    if(x&&typeof x==='object'&&x.mimeType)return String(x.mimeType);
    var s=typeof x==='string'?x:String(x&& (x.url||x.downloadUrl||x.previewUrl||x.src||x.fileName||x.name)||'');
    if(/^data:image\//i.test(s))return (s.match(/^data:([^;]+)/i)||[])[1]||'image/jpeg';
    if(/^data:application\/pdf/i.test(s)||/\.pdf(?:\?|#|$)/i.test(s))return 'application/pdf';
    if(/\.(png)(?:\?|#|$)/i.test(s))return 'image/png';
    if(/\.(webp)(?:\?|#|$)/i.test(s))return 'image/webp';
    if(/\.(gif)(?:\?|#|$)/i.test(s))return 'image/gif';
    return 'image/jpeg';
  }
  function desc(x,label,recordKey){
    if(!x)return null;
    if(typeof x==='string'){
      var d={label:label||'',recordKey:recordKey||'',mimeType:mimeGuess(x)};
      if(/^data:/i.test(x))d.src=x; else d.url=x;
      return d;
    }
    if(typeof x!=='object')return null;
    var d={
      id:x.id||x.fileId||'', name:x.name||x.fileName||'', fileName:x.fileName||x.name||'',
      mimeType:x.mimeType||mimeGuess(x), url:x.url||'', downloadUrl:x.downloadUrl||'', previewUrl:x.previewUrl||'', src:x.src||'',
      label:x.label||label||'', recordKey:x.recordKey||recordKey||'', period:x.period||''
    };
    if(!d.id&&!d.url&&!d.downloadUrl&&!d.previewUrl&&!d.src)return null;
    return d;
  }
  function key(d){return String(d.id||d.downloadUrl||d.url||d.previewUrl||d.src||'')+'|'+String(d.recordKey||'');}
  function collect(records,opts){
    opts=opts||{};var out=[],seen=Object.create(null);
    function add(x,label,rk){var d=desc(x,label,rk);if(!d)return;var k=key(d);if(!k||seen[k])return;seen[k]=1;out.push(d);}
    arr(records).forEach(function(r,idx){
      if(!r)return;
      var label=typeof opts.labelFn==='function'?opts.labelFn(r,idx):labelOf(r,opts.label);
      var rk=String(r._k||r.key||r.itemId||r.id||r.empId||r.employeeId||r.idNo||r.cardId||'');
      arr(r.evidence).forEach(function(x){add(x,label,rk);});
      arr(r.attachments).forEach(function(x){add(x,label,rk);});
      arr(r.files).forEach(function(x){add(x,label,rk);});
      arr(r.photos).forEach(function(x){add(x,label,rk);});
      if(r.photo)add(r.photo,label,rk);
      if(r.image)add(r.image,label,rk);
    });
    return out;
  }
  function merge(){
    var all=[],seen=Object.create(null);
    for(var i=0;i<arguments.length;i++)arr(arguments[i]).forEach(function(x){var d=desc(x,x&&x.label,x&&x.recordKey);if(!d)return;var k=key(d);if(!k||seen[k])return;seen[k]=1;all.push(d);});
    return all;
  }
  g.HRATelegramEvidence={collect:collect,merge:merge,version:'1.0'};
})(typeof window!=='undefined'?window:this);
