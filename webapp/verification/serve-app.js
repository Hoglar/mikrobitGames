import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,relative,sep} from 'node:path';
import {buildSdk} from './sdk-build.mjs';
import {webRoot,discover,catalogOf,payloadOf} from './cartridges.mjs';
import {readFirmware} from './firmware.mjs';
const isDist=process.argv.includes('--dist'),root=isDist?resolve(webRoot,'dist'):webRoot,localPlay=!process.argv.includes('--connected');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.webp':'image/webp','.wav':'audio/wav','.ogg':'audio/ogg','.mp3':'audio/mpeg','.woff2':'font/woff2'};
const port=Number(process.argv.find(a=>a.startsWith('--port='))?.slice(7)??process.env.PORT??4174),known=new Map();
let scanning,sdk;
async function catalog(){scanning??=discover({strict:false}).then(found=>{for(const p of found.packages)known.set(p.contentHash,p);return catalogOf(found);}).finally(()=>{scanning=null;});return scanning;}
createServer(async(req,res)=>{try{const path=decodeURIComponent(new URL(req.url,'http://local').pathname);if(path==='/api'||path.startsWith('/api/')){res.writeHead(localPlay?403:503,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error:{code:localPlay?'LOCAL_PLAY_BLOCKED':'SERVICE_UNAVAILABLE',message:localPlay?'Konto, online-lagring og AI er deaktivert lokalt.':'Forhåndsvisningen har ingen backend.'}}));return;}
  let data;
  if(path==='/firmware/microbit-v2.hex'){data=isDist?await readFile(resolve(root,'firmware/microbit-v2.hex')):await readFirmware();res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Disposition':'attachment; filename="microbit-v2.hex"','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data);return;}
  if(!isDist&&path==='/catalog.json')data=JSON.stringify(await catalog());
  else if(!isDist&&path.startsWith('/cartridges/')){const [,base,hash,file]=path.split('/');if(!known.has(hash))await catalog();const p=known.get(hash);if(!p)throw new Error('Ukjent spillutgave.');if(file==='payload.json')data=JSON.stringify(payloadOf(p));else if(file===p.manifest.cover)data=p.files.get(file);else throw new Error('Ukjent spillressurs.');}
  else if(!isDist&&/^\/sdk\/(index|runtime)\.js$/.test(path)){sdk??=Promise.all(['index','runtime'].map(async name=>[name,await buildSdk(webRoot,name)])).then(Object.fromEntries);data=(await sdk)[path.split('/').at(-1).slice(0,-3)];}
  else{if(!(path==='/'||path==='/index.html'||path==='/build-manifest.json'||path==='/catalog.json'||path.startsWith('/src/')||path.startsWith('/sdk/')||path.startsWith('/cartridges/')))throw new Error('Ukjent sti.');const file=resolve(root,'.'+(path==='/'?'/index.html':path));if(relative(root,file).startsWith('..')||relative(root,file).split(sep).some(p=>p.startsWith('.'))||!mime[extname(file)])throw new Error('Ugyldig sti.');data=await readFile(file);}
  if(localPlay&&extname(path==='/'?'/index.html':path)==='.html')data=data.toString().replace('<head>','<head><meta name="microbit-local-play" content="true">');res.writeHead(200,{'Content-Type':mime[extname(path)]??(path==='/'?'text/html; charset=utf-8':'application/octet-stream'),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data);
}catch(error){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Not found');}}).listen(port,'127.0.0.1',()=>console.log(`bit:arcade (${localPlay?'local records':'connected UI'}): http://127.0.0.1:${port}/`));
