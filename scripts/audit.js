'use strict';
const fs=require('node:fs');
const {sections,crawl}=require('../lib/addon');
(async()=>{const report={checkedAt:new Date().toISOString(),sections:[]};for(const s of sections.filter(s=>s.id!=='latest')){console.log('Checking',s.name);const d=await crawl(s.path,s.type);fs.writeFileSync(`data/${s.id}.json`,JSON.stringify(d.items,null,2));report.sections.push({id:s.id,name:s.name,pages:d.pages,count:d.items.length,missingPosters:d.items.filter(x=>!x.poster).length});}fs.writeFileSync('data/audit.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));})().catch(e=>{console.error(e);process.exitCode=1;});
