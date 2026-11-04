import {build} from 'esbuild';
import {readFile,realpath} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
// The SDK contains only local ES modules. Resolve them explicitly instead of
// searching unrelated parent package.json/tsconfig files on a developer's PC.
export async function buildSdk(root,name){return (await build({entryPoints:[resolve(root,`src/game-sdk/${name}.js`)],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',tsconfigRaw:{},plugins:[{name:'sdk-local-modules',setup(b){b.onResolve({filter:/.*/},async a=>{if(a.kind!=='entry-point'&&!a.path.startsWith('.'))throw new Error('SDK-import må være lokal.');const path=await realpath(a.kind==='entry-point'?a.path:resolve(a.resolveDir,a.path));if(relative(root,path).startsWith('..'))throw new Error('SDK-import utenfor webappen.');return {path};});b.onLoad({filter:/\.js$/},async a=>({contents:await readFile(a.path,'utf8'),loader:'js',resolveDir:dirname(a.path)}));}}]})).outputFiles[0].text;}
