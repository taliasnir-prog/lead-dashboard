import {mkdir,copyFile,readdir} from 'node:fs/promises';
import {dirname,resolve,relative,join} from 'node:path';import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');const target=join(root,'dist');
const files=['index.html','css/style.css','js/app.js','js/logic.js','js/storage.js','js/demo-data.js','js/holidays.js'];
await mkdir(target,{recursive:true});
async function audit(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const p=join(dir,entry.name);if(entry.isDirectory())await audit(p);else if(!files.includes(relative(target,p).split(String.fromCharCode(92)).join('/')))throw Error('Unexpected file in publish directory');}}
await audit(target);
for(const file of files){const dest=join(target,file);await mkdir(dirname(dest),{recursive:true});await copyFile(join(root,file),dest);}
await audit(target);console.log('Public build: '+files.length+' allowlisted files.');
