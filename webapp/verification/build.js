import {cp,mkdir,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,relative} from 'node:path';
import {buildSdk} from './sdk-build.mjs';
import {webRoot,discover,catalogOf,payloadOf} from './cartridges.mjs';
import {readFirmware} from './firmware.mjs';
const dist=resolve(webRoot,'dist');if(relative(webRoot,dist)!=='dist')throw new Error('Ugyldig byggmappe.');
const firmware=await readFirmware(),found=await discover(),catalog=catalogOf(found);
await mkdir(resolve(webRoot,'build/cartridges'),{recursive:true});await writeFile(resolve(webRoot,'build/cartridges/catalog.json'),JSON.stringify(catalog,null,2)+'\n');
await rm(dist,{recursive:true,force:true});await mkdir(dist,{recursive:true});await cp(resolve(webRoot,'index.html'),resolve(dist,'index.html'));
await mkdir(resolve(dist,'firmware'),{recursive:true});await writeFile(resolve(dist,'firmware/microbit-v2.hex'),firmware);
const gameRoot=resolve(webRoot,'src/games');
const firmwareSource=resolve(webRoot,'src/microbit-input/firmware');
await cp(resolve(webRoot,'src'),resolve(dist,'src'),{recursive:true,filter:path=>path!==gameRoot&&path!==firmwareSource&&!path.endsWith('.md')&&!path.includes(`${process.platform==='win32'?'\\':'/'}node_modules`)});
await mkdir(resolve(dist,'src/games'),{recursive:true});await cp(resolve(gameRoot,'registry.js'),resolve(dist,'src/games/registry.js'));
await mkdir(resolve(dist,'sdk'),{recursive:true});
for(const entry of ['runtime','index'])await writeFile(resolve(dist,`sdk/${entry}.js`),await buildSdk(webRoot,entry));
await writeFile(resolve(dist,'catalog.json'),JSON.stringify(catalog,null,2)+'\n');
for(const pkg of found.packages){const dir=resolve(dist,'cartridges',pkg.contentHash);await mkdir(dir,{recursive:true});await writeFile(resolve(dir,'payload.json'),JSON.stringify(payloadOf(pkg)));await writeFile(resolve(dir,pkg.manifest.cover),pkg.files.get(pkg.manifest.cover));for(const [name,data]of pkg.files){const file=resolve(dist,'src/games',pkg.folder,name);await mkdir(resolve(file,'..'),{recursive:true});await writeFile(file,data);}}
const manifest={formatVersion:1,files:{}};
async function scan(path,relative=''){for(const e of await readdir(path,{withFileTypes:true})){const name=relative+e.name;if(e.isDirectory())await scan(resolve(path,e.name),name+'/');else if(name!=='build-manifest.json')manifest.files[name]=createHash('sha256').update(await readFile(resolve(path,e.name))).digest('hex');}}
await scan(dist);await writeFile(resolve(dist,'build-manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log(`Built ${Object.keys(manifest.files).length} public files; ${catalog.packages.length} cartridges, ${catalog.games.length} leaderboards.`);
