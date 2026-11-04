import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {firmwareRoot} from './firmware.mjs';

const root=new URL('../../microbit/',import.meta.url);
const sha256=data=>createHash('sha256').update(data).digest('hex');
// An explicit maintainer step: never replace the shipped release during a web build.
const [hex,provenance]=await Promise.all([
  readFile(new URL('build/v2/MICROBIT.hex',root)),
  readFile(new URL('build/v2/provenance.json',root),'utf8').then(JSON.parse)
]);
const artifact=provenance.artifacts?.find(item=>item.file==='MICROBIT.hex');
if(!artifact||artifact.sha256!==sha256(hex)||artifact.bytes!==hex.length)throw new Error('HEX-filen samsvarer ikke med firmwarebyggets proveniens. Bygg firmware på nytt.');
const sources=Object.entries(provenance.sourceSha256??{});
if(!sources.length)throw new Error('Firmwarebygget mangler kildehasher.');
for(const [path,digest]of sources){
  if(!/^(src|toolchain)\/[a-zA-Z0-9/_.-]+$/.test(path)||path.split('/').includes('..')||sha256(await readFile(new URL(path,root)))!==digest)throw new Error('Firmwarekildene er endret etter HEX-bygget. Bygg firmware på nytt.');
}
const release={board:'microbit-v2',protocolVersion:1,file:'microbit-v2.hex',sha256:artifact.sha256,bytes:artifact.bytes,
  builtAt:provenance.builtAt,projectCommit:provenance.projectCommit,dependencies:provenance.dependencies,
  configuration:provenance.configuration,compiler:provenance.compiler,sourceSha256:provenance.sourceSha256};
await mkdir(firmwareRoot,{recursive:true});
await writeFile(new URL('microbit-v2.hex',firmwareRoot),hex);
await writeFile(new URL('release.json',firmwareRoot),JSON.stringify(release,null,2)+'\n');
console.log(`Oppdatert medfølgende V2-firmware: ${artifact.bytes} bytes, SHA-256 ${artifact.sha256}. Kontroller fysisk maskinvare før publisering.`);
