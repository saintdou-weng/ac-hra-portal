/* v74 / GAS v55: one version check and atomic differential commit. */
var ContractFastSync = (function () {
  'use strict';
  let legacyUrl='',recent=null;
  const M=HRAContractModel,S=HRASmartSync;
  const key=url=>'ac_hra_contract_sync_v74_'+M.hash(url);
  const state=url=>{try{return JSON.parse(localStorage.getItem(key(url))||'{}');}catch(_){return {};}};
  const hashes=bs=>Object.fromEntries(Object.keys(bs).map(k=>[k,bs[k].hash]));
  function remember(url,m){localStorage.setItem(key(url),JSON.stringify({version:m.versionToken,hashes:m.hashes,at:Date.now()}));}
  function status(o,s,t){if(o.onStatus)o.onStatus(s,t||'busy');}
  async function post(o,body){
    const c=new AbortController(),timer=setTimeout(()=>c.abort(),45000);
    try{const r=await fetch(o.url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(body),signal:c.signal});const j=JSON.parse(await r.text());if(!r.ok||j.ok===false)throw new Error(j.error||'GAS HTTP '+r.status);return j.data||j;}
    catch(e){if(e.name==='AbortError')throw new Error('連線逾時，資料仍保留在本機 / Connection timed out; local data is safe');throw e;}
    finally{clearTimeout(timer);}
  }
  async function read(o,rows){
    const local=await S.buildBuckets(rows),prior=state(o.url);
    const r=await post(o,{action:'contractSyncRead',hashes:hashes(local),baseline:prior.hashes||{}});
    if(r.syncSchema!==55)throw new Error('unsupported contractSyncRead');
    if(r.legacy)return {legacy:true,local,reply:r};
    const incoming=[];
    for(const [k,b] of Object.entries(r.buckets||{})){
      if(!b||!Array.isArray(b.records)||b.records.length!==r.manifest.counts[k]||b.hash!==r.manifest.hashes[k])throw new Error('Incomplete cloud data: '+k);
      const check=await S.buildBuckets(b.records);if(!check[k]||Object.keys(check).length!==1||check[k].hash!==b.hash)throw new Error('Cloud data verification failed: '+k);
      incoming.push(...b.records);
    }
    const merged=o.mergeRecords?o.mergeRecords(rows,incoming):M.merge(rows,incoming);
    recent={url:o.url,at:Date.now(),reply:r};remember(o.url,r.manifest);
    return {records:merged,downloaded:incoming.length,reply:r,local};
  }
  async function fallback(o,kind){legacyUrl=o.url;return kind==='pull'?S.pullReliable(o):S.push(o);}
  function unsupported(e){return /unknown action|unsupported|not implemented/i.test(String(e.message||e));}
  async function pull(o){
    if(legacyUrl===o.url)return fallback(o,'pull');
    status(o,'比對雲端版本 / Checking cloud version…');
    try{const r=await read(o,o.localRecords||[]);if(r.legacy){const old=await S.pullReliable(o);recent=null;return {...old,upgradePending:true};}
      status(o,r.downloaded?'已下載 '+r.downloaded+' 筆 / Downloaded':'資料相同，無需下載 / Already current','ok');
      return {ok:true,records:r.records,downloaded:r.downloaded,remoteRecordCount:r.reply.manifest.recordCount,fast:true};
    }catch(e){if(unsupported(e))return fallback(o,'pull');throw e;}
  }
  async function push(o){
    if(legacyUrl===o.url)return fallback(o,'push');
    let rows=o.records||[];
    for(let attempt=0;attempt<2;attempt++){
      try{
        let r;
        if(attempt===0&&recent?.url===o.url&&Date.now()-recent.at<5000){r={records:rows,reply:recent.reply};recent=null;}
        else r=await read(o,rows);
        if(r.legacy){const old=await S.pullReliable({...o,localRecords:rows});if(!old||old.ok===false)throw new Error('Cloud baseline unavailable');rows=old.records;r=await read(o,rows);}
        rows=r.records||rows;const bs=await S.buildBuckets(rows),m=r.reply.manifest,changed={};
        for(const [k,b]of Object.entries(bs))if(m.hashes[k]!==b.hash)changed[k]=b;
        // The first v55 commit consolidates the verified legacy baseline once.
        const seed=!m.packed,removeBuckets=Object.keys(m.hashes).filter(k=>!bs[k]);
        if(!Object.keys(changed).length&&!removeBuckets.length&&!seed){status(o,'雲端已同步 / Cloud is current','ok');return {ok:true,skipped:true,uploaded:0,records:rows,fast:true};}
        status(o,seed?'首次整理雲端資料 / Preparing fast sync…':'上傳差異 / Uploading changes…');
        const saved=await post(o,{action:'contractSyncCommit',baseVersion:m.versionToken,buckets:seed?bs:changed,removeBuckets,seed,summary:o.summary||{},meta:o.meta||{}});
        if(saved.conflict){recent=null;if(!attempt)continue;throw new Error('Cloud changed; retry sync');}
        if(!saved.manifest)throw new Error('Cloud commit not confirmed');remember(o.url,saved.manifest);recent=null;
        status(o,'同步完成 / Sync complete','ok');return {ok:true,records:rows,uploaded:Object.values(seed?bs:changed).reduce((n,b)=>n+b.count,0),fast:true,timestamp:saved.manifest.updatedAt};
      }catch(e){if(unsupported(e))return fallback({...o,records:rows},'push');throw e;}
    }
  }
  return {pull,push};
})();
