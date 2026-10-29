import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve,extname,relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const base=fileURLToPath(new URL('../',import.meta.url)),root=process.argv.includes('--dist')?resolve(base,'dist'):base;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json'};
// The local marker is injected into responses, never into deployable dist/ files.
const localPlay=!process.argv.includes('--connected');
const port=Number(process.argv.find(arg=>arg.startsWith('--port='))?.slice(7)??process.env.PORT??4174);
createServer(async(req,res)=>{try{const path=decodeURIComponent(new URL(req.url,'http://local').pathname);if(path==='/api'||path.startsWith('/api/')){res.writeHead(localPlay?403:503,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error:{code:localPlay?'LOCAL_PLAY_BLOCKED':'SERVICE_UNAVAILABLE',message:localPlay?'Database, konto og AI er deaktivert i lokalt spill.':'Lokal forhåndsvisning har ingen backend. Publiser dist/ ved samme HTTPS-adresse som API-et.'}}));return;}if(!(path==='/'||path==='/index.html'||path==='/build-manifest.json'||path.startsWith('/src/'))){res.writeHead(404);res.end('Not found');return;}const file=resolve(root,'.'+(path==='/'?'/index.html':path));if(relative(root,file).startsWith('..')||!mime[extname(file)]){res.writeHead(403);res.end();return;}let data=await readFile(file);if(localPlay&&extname(file)==='.html')data=data.toString('utf8').replace('<head>','<head><meta name="microbit-local-play" content="true">');res.writeHead(200,{'Content-Type':mime[extname(file)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data);}catch{res.writeHead(404);res.end('Not found');}}).listen(port,'127.0.0.1',()=>console.log(`bit:arcade (${localPlay?'local play':'connected UI'}): http://127.0.0.1:${port}/`));
