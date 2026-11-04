import {mkdir,writeFile,readFile,cp} from 'node:fs/promises';
import {resolve,relative,basename} from 'node:path';
import {randomUUID} from 'node:crypto';
import {deflateRawSync} from 'node:zlib';
import {inspectGame,webRoot} from './cartridges.mjs';
const [operation,arg]=process.argv.slice(2);if(!arg||!['new','check','pack'].includes(operation))throw new Error('Bruk game:new -- navn, game:check -- mappe eller game:pack -- mappe.');
if(operation==='new'){
 if(!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(arg))throw new Error('Bruk et navn som my-game.');const folder=resolve(webRoot,'src/games',arg);await mkdir(folder);await cp(resolve(webRoot,'templates/game'),folder,{recursive:true});const file=resolve(folder,'game.json'),manifest=JSON.parse(await readFile(file));manifest.id=randomUUID();manifest.slug=arg;manifest.title=arg.split('-').map(x=>x[0].toUpperCase()+x.slice(1)).join(' ');await writeFile(file,JSON.stringify(manifest,null,2)+'\n');console.log(`Opprettet ${relative(webRoot,folder)}. Rediger game.json og index.js, og kjør npm run dev.`);
}else{
 const folder=resolve(arg),game=await inspectGame(folder);console.log(`${game.manifest.title}: gyldig SDK v1-spill, ${game.modeRecords.length} topplister.`);
 if(operation==='pack'){
  const files=new Map(game.files);files.set('README.md',await readFile(resolve(folder,'README.md')));const chunks=[],directory=[];let position=0;
  const crc32=buffer=>{let crc=0xffffffff;for(const byte of buffer){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;};
  for(const [path,data]of files){const name=Buffer.from(`${game.manifest.slug}/${path}`),packed=deflateRawSync(data),crc=crc32(data),header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);header.writeUInt16LE(8,8);header.writeUInt32LE(crc,14);header.writeUInt32LE(packed.length,18);header.writeUInt32LE(data.length,22);header.writeUInt16LE(name.length,26);chunks.push(header,name,packed);const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(0x800,8);central.writeUInt16LE(8,10);central.writeUInt32LE(crc,16);central.writeUInt32LE(packed.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(name.length,28);central.writeUInt32LE(position,42);directory.push(central,name);position+=header.length+name.length+packed.length;}
  const center=Buffer.concat(directory),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.size,8);end.writeUInt16LE(files.size,10);end.writeUInt32LE(center.length,12);end.writeUInt32LE(position,16);const target=resolve(webRoot,'build/game-packages');await mkdir(target,{recursive:true});const file=resolve(target,`${game.manifest.slug}-${game.manifest.version}.zip`);await writeFile(file,Buffer.concat([...chunks,center,end]));console.log(`Skrevet ${relative(webRoot,file)}. Mottakeren pakker ut spillmappen i src/games/.`);
 }
}
