import { cp, mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)),dist=resolve(root,'dist');
// Copy only the public application. No tests, credentials, backend or node_modules.
await rm(dist,{recursive:true,force:true});
await mkdir(dist,{recursive:true});
await cp(resolve(root,'index.html'),resolve(dist,'index.html'));
await cp(resolve(root,'src'),resolve(dist,'src'),{recursive:true,filter:path=>!path.endsWith('.md')});
const manifest={formatVersion:1,files:{}};
async function scan(path,relative=''){for(const entry of await readdir(path,{withFileTypes:true})){const name=relative+entry.name;if(entry.isDirectory())await scan(resolve(path,entry.name),name+'/');else if(name!=='build-manifest.json')manifest.files[name]=createHash('sha256').update(await readFile(resolve(path,entry.name))).digest('hex');}}
await scan(dist);await writeFile(resolve(dist,'build-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Built ${Object.keys(manifest.files).length} public files in dist/.`);
