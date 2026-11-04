import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

export const firmwareRoot=new URL('../src/microbit-input/firmware/',import.meta.url);
const sha256=data=>createHash('sha256').update(data).digest('hex');

// Hosting uses the bundled release, independently of local firmware source/builds.
export async function readFirmware(){
  const [hex,release]=await Promise.all([
    readFile(new URL('microbit-v2.hex',firmwareRoot)),
    readFile(new URL('release.json',firmwareRoot),'utf8').then(JSON.parse)
  ]);
  if(release.board!=='microbit-v2'||release.protocolVersion!==1||release.sha256!==sha256(hex)||release.bytes!==hex.length)throw new Error('Den medfølgende HEX-filen samsvarer ikke med release.json. Gjenopprett firmwarepakken fra repositoryet.');
  return hex;
}
