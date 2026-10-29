import { microbit } from '../microbit-input/index.js';
import { api, ApiError, validateSession } from './api.js';
import { createSubmissionQueue } from '../platform/submissions.js';
import { el, link, button, toast, heading, errorBox } from './dom.js';
import { launcher, authentication, dashboard, profile, chat, leaderboard } from './pages.js';
import { gamePage } from './play.js';
import { testlabPage } from './testlab.js';
const localPlay=['localhost','127.0.0.1','[::1]'].includes(location.hostname)&&document.querySelector('meta[name="microbit-local-play"]')?.content==='true';
export const context={ microbit, api, localPlay, session:null, sessionError:null, catalog:[], chat:[], aiBusy:false, page:null, sessionReady:null };
context.api=async(...args)=>{if(localPlay)throw new ApiError('Database, konto og AI er deaktivert i lokalt spill.',{code:'LOCAL_PLAY_BLOCKED'});try{return await api(...args);}catch(error){if(error.status===401&&error.code==='AUTH_REQUIRED')context.setSession(null);throw error;}};
context.queue=createSubmissionQueue({api:(...args)=>context.api(...args),getPlayer:()=>context.session?.player});
context.setSession=value=>{context.session=value;renderNavigation();};
context.loadSession=async()=>{if(localPlay){context.setSession(null);return;}try{context.setSession(validateSession((await api('/auth/session')).data));context.sessionError=null;}catch(e){context.setSession(null);context.sessionError=e.status===401?null:e;}};
const main=document.querySelector('#main'),connect=document.querySelector('#connect');
context.connect=()=>{
  const operation=microbit.connect(); // Keep requestPort directly inside the click gesture.
  refreshConnection();operation.then(()=>{refreshConnection();toast('Micro:bit er klar.');},e=>toast(e.message));return operation;
};
connect.onclick=()=>{context.connect().catch(()=>{});};
const offError=microbit.onError(e=>{if(!['protocol'].includes(e.kind))toast(e.message);});
function refreshConnection(){const s=microbit.getState();connect.classList.toggle('ready',s.inputAvailable);document.querySelector('#connection-label').textContent=s.inputAvailable?'Micro:bit er tilkoblet':s.connection==='connecting'?'Kobler til …':'Koble til micro:bit';connect.disabled=s.connection==='connecting';}
function renderNavigation(){
 if(localPlay){document.querySelector('#navigation').replaceChildren(link('Spill','#/'),link('Testlab','#/testlab'),el('span',{class:'pill'},'LOKALT · UTEN LAGRING'));return;}
 const nav=document.querySelector('#navigation');nav.replaceChildren(...[['Spill','#/'],['Topplister','#/leaderboard'],['Dashboard','#/dashboard'],['AI-chat','#/ai'],['Profil','#/profile']].map(([name,href])=>link(name,href,location.hash===href?'active':'')));
 if(context.session)nav.append(button('Logg ut',async()=>{try{await api('/auth/logout',{method:'POST'});context.setSession(null);context.chat=[];location.hash='#/';toast('Du er logget ut.');}catch(e){toast(e.message);}},'text-button'));else nav.append(link('Logg inn','#/login',''));
}
let current=null,navigation=Promise.resolve();
async function route(){
 const hash=location.hash||'#/',url=new URL(hash.slice(1),'http://local'),parts=url.pathname.split('/').filter(Boolean),name=parts[0]||'launcher';
 if(current?.canLeave && !current.canLeave()){history.replaceState(null,'',current.hash);return;}
 if(current){current.active=false;try{await current.dispose?.();}catch(e){toast(`Opprydding: ${e.message}`);}current=null;}
 document.body.classList.remove('playing');renderNavigation();
 const container=el('div');main.replaceChildren(container);
 const view={hash,active:true,dispose:null,canLeave:null};current=view;
 const publicRoute=['launcher','login','register','testlab','leaderboard','history'].includes(name);
 // Network requests must not serialize navigation. Old renderers own a detached root.
 async function renderView(){
  if(localPlay&&!['launcher','play','testlab'].includes(name)){
   container.append(heading('LOKALT SPILL','Bare lokalt spill','Database, innlogging, resultathistorikk, topplister og AI er deaktivert i denne lokale versjonen.'),link('Til spillvelgeren','#/','button'));return;
  }
  if(!publicRoute){container.append(heading('BIT:ARCADE','Laster …'));await context.sessionReady;if(!view.active)return;container.replaceChildren();}
  if(!localPlay && !publicRoute && !context.session){
   container.append(heading('KONTO','Logg inn for å fortsette',context.sessionError?'Kunne ikke kontrollere sesjonen. Prøv igjen.':'Spill, private resultater og AI-chat krever innlogging.'));
   if(context.sessionError)container.append(errorBox(context.sessionError.message));
   container.append(link('Logg inn',`#/login?next=${encodeURIComponent(url.pathname+url.search)}`));return;
  }
  const render=name==='launcher'?launcher:name==='login'||name==='register'?authentication:name==='dashboard'?dashboard:name==='profile'?profile:name==='ai'?chat:name==='leaderboard'||name==='history'?leaderboard:name==='play'?gamePage:name==='testlab'?testlabPage:null;
  if(!render){container.append(heading('404','Denne siden finnes ikke.'),link('Til spillvelgeren','#/'));return;}
  await render({root:container,ctx:context,url,parts,view});
 }
 void renderView().then(()=>{if(view.active)main.focus({preventScroll:true});}).catch(e=>{if(view.active)container.replaceChildren(heading('NOE GIKK GALT','Kunne ikke åpne siden.'),errorBox(e.message),link('Til spillvelgeren','#/'));});
 window.scrollTo(0,0);
}
window.addEventListener('hashchange',()=>{navigation=navigation.then(route).catch(e=>toast(e.message));});
context.sessionReady=context.loadSession().then(()=>{renderNavigation();});
refreshConnection();const poll=setInterval(refreshConnection,150);
window.addEventListener('pagehide',()=>{offError();clearInterval(poll);void microbit.disconnect().catch(()=>{});},{once:true});
window.addEventListener('beforeunload',e=>{if(context.queue.list().some(x=>x.state!=='saved')){e.preventDefault();e.returnValue='';}});
navigation=navigation.then(route);
