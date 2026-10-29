import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve,extname,relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const base=fileURLToPath(new URL('../',import.meta.url)),root=process.argv.includes('--dist')?resolve(base,'dist'):base;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json'};
const port=Number(process.env.PORT??4174);
createServer(async(req,res)=>{try{const path=decodeURIComponent(new URL(req.url,'http://local').pathname);if(path.startsWith('/api/')){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{code:'SERVICE_UNAVAILABLE',message:'Lokal forhåndsvisning har ingen backend. Publiser dist/ ved samme HTTPS-adresse som API-et.'}}));return;}if(!(path==='/'||path==='/index.html'||path==='/build-manifest.json'||path.startsWith('/src/'))){res.writeHead(404);res.end('Not found');return;}const file=resolve(root,'.'+(path==='/'?'/index.html':path));if(relative(root,file).startsWith('..')||!mime[extname(file)]){res.writeHead(403);res.end();return;}const data=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data);}catch{res.writeHead(404);res.end('Not found');}}).listen(port,'127.0.0.1',()=>console.log(`bit:arcade: http://127.0.0.1:${port}/`));
