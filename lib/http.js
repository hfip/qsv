'use strict';
const {fetch, EnvHttpProxyAgent}=require('undici');
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36';
const dispatcher=new EnvHttpProxyAgent();
const MAX_BYTES=12*1024*1024;
async function fetchText(url,referer=process.env.QESEH_BASE||'https://wwv.qeseh.com'){
  const u=new URL(url);
  if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw Error('Invalid URL');
  for(let attempt=0;attempt<2;attempt++){
    try{
      const res=await fetch(u,{dispatcher,redirect:'follow',signal:AbortSignal.timeout(25000),headers:{'User-Agent':UA,Referer:referer,Accept:'text/html,application/json,*/*','Accept-Language':'ar,en;q=0.8'}});
      if(!res.ok){await res.body?.cancel();const error=new Error(`HTTP ${res.status} from ${u.hostname}`);error.status=res.status;throw error;}
      const reader=res.body.getReader(),chunks=[];let total=0;
      try{while(true){const {value,done}=await reader.read();if(done)break;total+=value.byteLength;if(total>MAX_BYTES){await reader.cancel();throw Error('Source response too large');}chunks.push(Buffer.from(value));}}finally{reader.releaseLock();}
      return Buffer.concat(chunks,total).toString('utf8');
    }catch(error){if(attempt===1||(error.status&&error.status<500&&error.status!==429)||error.message==='Source response too large')throw error;}
  }
}
module.exports={fetchText};
