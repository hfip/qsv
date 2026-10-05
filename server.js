'use strict';
const http=require('node:http');
const {handler}=require('./lib/addon');
const port=Number(process.env.PORT||7000);
http.createServer(handler).listen(port,'0.0.0.0',()=>console.log(`قصة عشق: http://localhost:${port}/manifest.json`));
