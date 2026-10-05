'use strict';
const {fetchText}=require('./http');
const BASE=(process.env.QESEH_BASE||'https://wwv.qeseh.com').replace(/\/$/,'');
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36';
const sections=[{id:'latest',name:'آخر الحلقات',type:'series',path:'/son-bolumler/'},{id:'series',name:'جميع المسلسلات',type:'series',path:'/discover/'},{id:'movies',name:'أفلام',type:'movie',path:'/category/yeni-filmler/'},{id:'complete',name:'مسلسلات كاملة',type:'series',path:'/category/alarshif/'}];
const manifest={id:'community.qeseh.stremio',version:'1.0.1',name:'قصة عشق',description:'أقسام قصة عشق الأربعة، المسلسلات والأفلام ومصادر التشغيل.',resources:['catalog','meta','stream'],types:['series','movie'],idPrefixes:['qeseh_'],catalogs:sections.map(s=>({id:s.id,name:s.name,type:s.type,extra:[{name:'skip'},{name:'search'}]})),behaviorHints:{configurable:false}};
const cache=new Map(),pending=new Map();
async function cached(key,ttl,fn){const c=cache.get(key);if(c&&c.exp>Date.now())return c.value;if(pending.has(key))return pending.get(key);const p=fn().then(value=>{if(cache.size>=300)cache.delete(cache.keys().next().value);cache.set(key,{value,exp:Date.now()+ttl});return value}).finally(()=>pending.delete(key));pending.set(key,p);return p;}
const entity=s=>String(s||'').replace(/&quot;/g,'"').replace(/&#0*39;|&apos;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n));
const clean=s=>entity(s).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
function siteURL(url){const u=new URL(entity(url),BASE);u.protocol=new URL(BASE).protocol;u.host=new URL(BASE).host;return u.href;}
const idFor=url=>'qeseh_'+Buffer.from(new URL(siteURL(url)).pathname).toString('base64url');
function urlFor(id){if(!/^qeseh_[A-Za-z0-9_-]+$/.test(id))throw Error('Invalid ID');const p=Buffer.from(id.slice(6),'base64url').toString();if(!p.startsWith('/')||p.startsWith('//')||/[\r\n\\]/.test(p))throw Error('Invalid path');const u=new URL(p,BASE);if(u.origin!==new URL(BASE).origin)throw Error('Invalid origin');return u.href;}
function cards(html,type){const out=[];for(const m of html.matchAll(/<div\b[^>]*class=["'][^"']*\bblock-post\b[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)){const b=m[1],a=b.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/i);if(!a)continue;const name=clean(b.match(/class=["']title["'][^>]*>([\s\S]*)/i)?.[1]||a[0].match(/title=["']([^"']+)/i)?.[1]).replace(/\s*-\s*قصة عشق$/,'');const image=b.match(/background-image\s*:\s*url\(\s*['"]?([^)'"\s]+)/i)?.[1]||b.match(/(?:data-src|src)=["']([^"']+)/i)?.[1];out.push({id:idFor(a[1]),type,name,poster:image?new URL(entity(image),BASE).href:undefined,posterShape:'poster',url:siteURL(a[1])});}return out;}
function pages(html,path){const links=[...html.matchAll(/href=['"]([^'"]*\/page\/\d+\/[^'"]*)['"]/g)].map(m=>siteURL(m[1]));return [...new Set(links)].filter(u=>new URL(u).pathname.startsWith(path));}
async function crawl(path,type){
  const first=await fetchText(BASE+path);
  let last=Math.max(1,...pages(first,path).map(u=>+(u.match(/\/page\/(\d+)/)?.[1]||1)));
  const list=cards(first,type);
  for(let start=2;start<=last;start+=4){
    if(last>2000)throw Error('Unexpected pagination');
    const numbers=Array.from({length:Math.min(4,last-start+1)},(_,i)=>start+i);
    const batch=await Promise.all(numbers.map(page=>fetchText(`${BASE}${path}page/${page}/`)));
    for(let i=0;i<batch.length;i++){
      const entries=cards(batch[i],type);
      if(!entries.length)throw Error(`Empty catalog page ${numbers[i]}`);
      list.push(...entries);
      last=Math.max(last,...pages(batch[i],path).map(u=>+(u.match(/\/page\/(\d+)/)?.[1]||1)));
    }
  }
  return {items:[...new Map(list.map(m=>[m.id,m])).values()],pages:last};
}
async function catalog(type,id,extra={}){const s=sections.find(s=>s.id===id&&s.type===type);if(!s)return [];const skip=Number(extra.skip||0);if(!Number.isSafeInteger(skip)||skip<0)throw Error('Invalid skip');let items;if(id==='latest'&&!extra.search){const size=30,page=Math.floor(skip/size)+1;const html=await cached('latest:'+page,300000,()=>fetchText(`${BASE}${s.path}${page===1?'':`page/${page}/`}`));items=cards(html,type).slice(skip%size,skip%size+size);}else{const all=await cached('catalog:'+id,1800000,()=>crawl(s.path,type));items=all.items;if(extra.search)items=items.filter(x=>x.name.includes(extra.search));items=items.slice(skip,skip+100);}return items.map(({url,...m})=>m);}
async function meta(type,id){const url=urlFor(id);const html=await cached('meta:'+id,900000,()=>fetchText(url));const title=clean(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]);const poster=html.match(/background-image\s*:\s*url\(\s*['"]?([^)'"\s]+)/i)?.[1];const result={id,type,name:title,poster,description:clean(html.match(/class=["']story["'][^>]*>([\s\S]*?)<\/div>/i)?.[1])};if(type==='series'){let episodes=cards(html,type).filter(c=>/الحلقة\s*\d+/.test(c.name));if(pages(html,new URL(url).pathname).length)episodes=(await crawl(new URL(url).pathname,type)).items.filter(c=>/الحلقة\s*\d+/.test(c.name));if(!episodes.length&&/الحلقة\s*\d+/.test(title))episodes=[{id,name:title,poster}];result.videos=[...new Map(episodes.map(e=>[e.id,e])).values()].map(e=>({id:e.id,title:e.name,season:+(e.name.match(/الموسم\s*(\d+)/)?.[1]||1),episode:+e.name.match(/الحلقة\s*(\d+)/)[1],thumbnail:e.poster})).sort((a,b)=>a.season-b.season||a.episode-b.episode);}return result;}
function payload(html){const encoded=html.match(/watch\?post=([^"'<>\s]+)/)?.[1];if(!encoded)throw Error('No watch payload');return JSON.parse(Buffer.from(decodeURIComponent(entity(encoded)),'base64').toString());}
// Decode the common P.A.C.K.E.R string substitution; never evaluate website JavaScript.
function jsString(s){return s.replace(/\\(u[\da-fA-F]{4}|x[\da-fA-F]{2}|[\s\S])/g,(_,x)=>x[0]==='u'||x[0]==='x'?String.fromCharCode(parseInt(x.slice(1),16)):({n:'\n',r:'\r',t:'\t'}[x]??x));}
function unpack(html){return html.replace(/eval\(function\(p,a,c,k,e,d\)[\s\S]*?\}\(\s*'((?:\\.|[^'\\])*)'\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*'((?:\\.|[^'\\])*)'\.split\('\|'\)[\s\S]*?\)\)/g,(_,p,radix,count,dict)=>{const table=jsString(dict).split('|');return jsString(p).replace(/\b[0-9a-zA-Z]+\b/g,word=>{const n=parseInt(word,+radix);return Number.isFinite(n)&&n<+count&&n.toString(+radix)===word&&table[n]?table[n]:word});});}
function mediaURLs(html){const text=entity(unpack(html)).replace(/\\\//g,'/');return [...new Set([...text.matchAll(/https?:\/\/[^\s"'<>\\]+/g)].map(m=>m[0]).filter(u=>/\.(m3u8|mp4)(?:[?&#]|$)/i.test(u)))];}
function provider(s){const n=s.name.toLowerCase();if(n==='arab hd')return {name:'Arab HD',url:`https://arabhd.onl/embed-${s.id}.html`};if(['estream','turk'].includes(n))return {name:'turk',url:`https://arabveturk.com/embed-${s.id}.html`};if(n==='red hd')return {name:'Red HD',url:`https://iplayerhls.com/e/${s.id}`};if(n==='ok')return {name:'ok',url:`https://ok.ru/videoembed/${s.id}`};if(n==='dailymotion')return {name:'express',url:`https://www.dailymotion.com/embed/video/${s.id}`,daily:s.id};if(n==='express')return {name:'express',url:s.id};return null;}
async function resolve(s,referer){const p=provider(s);if(!p)return {name:s.name,streams:[],error:'Unknown provider'};try{let html=p.daily?'':await fetchText(p.url,referer),urls=mediaURLs(html);if(p.daily){const data=JSON.parse(await fetchText(`https://www.dailymotion.com/player/metadata/video/${p.daily}`,p.url));urls=[...new Set(Object.values(data.qualities||{}).flat().map(q=>q.url).filter(u=>u&&/\.(m3u8|mp4)(?:\?|$)/.test(u)))];}if(s.name.toLowerCase()==='ok'){const opts=html.match(/data-options="([^"]+)"/);if(opts){const options=JSON.parse(entity(opts[1]));const raw=options.flashvars?.metadata;const d=typeof raw==='string'?JSON.parse(raw):raw;if(d)urls=[...new Set([...(d.videos||[]).map(v=>v.url),d.hlsManifestUrl,d.hlsMasterPlaylistUrl].filter(Boolean))];}}return {name:p.name,streams:urls.map(url=>({name:`قصة عشق | ${p.name}`,title:p.name,url,behaviorHints:{notWebReady:true,proxyHeaders:{request:{'User-Agent':UA,Referer:p.url}}}})),error:urls.length?undefined:(html.includes('movie_unavailable_for_region')?'Unavailable in server region':'No direct media found')};}catch(e){return {name:p.name,streams:[],error:(e.stderr||e.message).slice(0,240)};}}
async function streamReport(id){const url=urlFor(id);const html=await fetchText(url);const data=payload(html);const results=await Promise.all(data.servers.map(s=>resolve(s,url)));return {results,streams:results.flatMap(r=>r.streams)};}
// Vercel may pass the rewrite destination as req.url. Preserve the public path explicitly.
function requestURL(req){
  const incoming=new URL(req.url,'http://localhost');
  if(!['/api/index','/api/index.js'].includes(incoming.pathname))return incoming;
  const forwarded=incoming.searchParams.get('__qeseh_path');
  if(forwarded===null)return incoming;
  if(!forwarded.startsWith('/')||forwarded.startsWith('//')||/[\\\r\n]/.test(forwarded))throw Error('Invalid forwarded path');
  const restored=new URL(forwarded,'http://localhost');
  incoming.searchParams.delete('__qeseh_path');
  for(const [key,value] of incoming.searchParams)restored.searchParams.set(key,value);
  return restored;
}
async function handler(req,res){res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Methods','GET, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');if(req.method==='OPTIONS'){res.statusCode=204;return res.end();}try{const u=requestURL(req);const p=u.pathname;if(p==='/'){res.statusCode=302;res.setHeader('Location','/manifest.json');return res.end();}if(p==='/manifest.json')return res.end(JSON.stringify(manifest));if(p==='/health')return res.end(JSON.stringify({ok:true}));const m=p.match(/^\/(catalog|meta|stream)\/(series|movie)\/([^/]+?)(?:\/([^/]+))?\.json$/);if(!m){res.statusCode=404;return res.end(JSON.stringify({error:'Not found'}));}const [,resource,type,rawId,rawExtra]=m,id=decodeURIComponent(rawId),extra=Object.fromEntries(new URLSearchParams(rawExtra||u.search));let body;if(resource==='catalog')body={metas:await catalog(type,id,extra)};if(resource==='meta')body={meta:await meta(type,id)};if(resource==='stream'){const report=await streamReport(id);body={streams:report.streams};for(const r of report.results)if(r.error)console.warn(`[${r.name}] ${r.error}`);}res.end(JSON.stringify(body));}catch(e){console.error(e.message);res.statusCode=502;res.end(JSON.stringify({error:'تعذر جلب البيانات من المصدر، أعد المحاولة لاحقًا.'}));}}
module.exports={requestURL,handler,manifest,sections,cards,pages,crawl,catalog,meta,idFor,urlFor,payload,unpack,mediaURLs,provider,streamReport,fetchText};
