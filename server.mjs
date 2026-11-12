import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readAirtable } from './server/airtable.mjs';
export { readAirtable, normalizeRecords } from './server/airtable.mjs';
const ROOT = dirname(fileURLToPath(import.meta.url));
const PUBLIC_FILES = new Map([
  ['', ['index.html','text/html; charset=utf-8']], ['index.html',['index.html','text/html; charset=utf-8']],
  ['css/style.css',['css/style.css','text/css']],
  ...['app','logic','storage','demo-data','holidays'].map(n=>['js/'+n+'.js',['js/'+n+'.js','text/javascript']]),
]);
export function makeServer(config, fetcher=fetch) {
  return createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store'); res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    let url; try {url=new URL(req.url,'http://localhost');} catch {res.writeHead(400).end(); return;}
    if(req.method !== 'GET' && req.method !== 'HEAD') {res.writeHead(405,{Allow:'GET, HEAD'}).end();return;}
    let route = url.pathname;
    if(route.startsWith('/lead-dashboard/')) route=route.slice('/lead-dashboard/'.length); else route=route.slice(1);
    if(route==='api/leads') {
      res.setHeader('Content-Type','application/json; charset=utf-8');
      try { const leads=await readAirtable(config,fetcher); res.writeHead(200).end(req.method==='HEAD'?undefined:JSON.stringify({source:'airtable',loadedAt:new Date().toISOString(),leads})); }
      catch {res.writeHead(502).end(JSON.stringify({error:'לא ניתן לטעון נתונים מ-Airtable. בדקו את החיבור, ההרשאות ותקינות הרשומות ונסו שוב.'}));}
      return;
    }
    const file=PUBLIC_FILES.get(route); if(!file){res.writeHead(404).end();return;}
    try { const content=await readFile(join(ROOT,file[0])); res.writeHead(200,{'Content-Type':file[1]}).end(req.method==='HEAD'?undefined:content); }
    catch {res.writeHead(404).end();}
  });
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {process.loadEnvFile(join(ROOT,'.env'));} catch { /* deployment can supply environment variables */ }
  const server=makeServer(process.env);
  server.listen(Number(process.env.PORT || 4318),'127.0.0.1',()=>console.log('Dashboard: http://127.0.0.1:4318/lead-dashboard/?source=airtable'));
}
