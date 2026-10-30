import { microbit } from '../microbit-input/index.js';
import { api, ApiError, validateSession } from './api.js';
import { createSubmissionQueue } from '../platform/submissions.js';
import { el, link, button, toast, heading, errorBox } from './dom.js';
import { authentication, dashboard, profile, leaderboard } from './pages.js';
import { gamePage } from './play.js';
import { testlabPage } from './testlab.js';
import { createArcade } from './arcade.js';
import { families } from '../games/registry.js';
const localPlay=['localhost','127.0.0.1','[::1]'].includes(location.hostname)&&document.querySelector('meta[name="microbit-local-play"]')?.content==='true';
export const context={ microbit, api, localPlay, session:null, sessionError:null, catalog:[], chat:[], aiBusy:false, page:null, sessionReady:null };
context.api=async(...args)=>{if(localPlay)throw new ApiError('Database, konto og AI er deaktivert i lokalt spill.',{code:'LOCAL_PLAY_BLOCKED'});try{return await api(...args);}catch(error){if(error.status===401&&error.code==='AUTH_REQUIRED')context.setSession(null);throw error;}};
context.queue=createSubmissionQueue({api:(...args)=>context.api(...args),getPlayer:()=>context.session?.player});
context.setSession=value=>{context.session=value;renderNavigation();void arcade?.refreshChat();};
context.loadSession=async()=>{if(localPlay){context.setSession(null);return;}try{context.setSession(validateSession((await api('/auth/session')).data));context.sessionError=null;}catch(e){context.setSession(null);context.sessionError=e.status===401?null:e;}};
const main=document.querySelector('#main'),connect=document.querySelector('#connect');
document.querySelector('.skip').addEventListener('click',event=>{event.preventDefault();main.focus();main.scrollIntoView({block:'start'});});
document.addEventListener('click',event=>{if(event.target.closest('a[href="#/"]')&&location.hash==='#/'){event.preventDefault();window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}});
context.connect=()=>{
  const operation=microbit.connect(); // Keep requestPort directly inside the click gesture.
  refreshConnection();operation.then(()=>{refreshConnection();toast('Micro:bit er klar.');},e=>toast(e.message));return operation;
};
connect.onclick=()=>{context.connect().catch(()=>{});};
const offError=microbit.onError(e=>{if(!['protocol'].includes(e.kind))toast(e.message);});
function refreshConnection(){const s=microbit.getState();connect.classList.toggle('ready',s.inputAvailable);document.querySelector('#connection-label').textContent=s.inputAvailable?'Micro:bit er tilkoblet':s.connection==='connecting'?'Kobler til …':'Koble til micro:bit';connect.disabled=s.connection==='connecting';}
let arcade=null;
function renderNavigation(){
 if(localPlay){document.querySelector('#navigation').replaceChildren(link('Spill','#/',''),link('Testlab','#/testlab',''),el('span',{class:'pill'},'LOKALT · UTEN LAGRING'));return;}
 const nav=document.querySelector('#navigation');nav.replaceChildren(...[['Spill','#/'],['Testlab','#/testlab'],['Topplister','#/leaderboard'],['Dashboard','#/dashboard'],['AI-chat','#/ai'],['Profil','#/profile']].map(([name,href])=>link(name,href,location.hash===href?'active':'')));
 if(context.session)nav.append(button('Logg ut',async()=>{try{await api('/auth/logout',{method:'POST'});context.setSession(null);context.chat=[];location.hash='#/';toast('Du er logget ut.');}catch(e){toast(e.message);}},'text-button'));else nav.append(link('Logg inn','#/login',''));
}
let current=null,accountView=null,navigation=Promise.resolve(),selectedKey=null;
arcade=createArcade({root:main,ctx:context,selectGame:key=>{
 if(location.hash===`#/play/${key}`){document.querySelector('#arcade-stage').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});return;}
 location.hash=`#/play/${key}`;
}});
async function closeAccount(){if(accountView){accountView.active=false;await accountView.dispose?.();accountView=null;}arcade.account.hidden=true;arcade.account.replaceChildren();}
async function mountCabinet(key,hash,{testlab=false,animate=true}={}){
 if(current?.key===key&&current?.testlab===testlab&&(!current.locked||!context.session))return true;
 if(current?.canLeave&&!current.canLeave()){history.replaceState(null,'',current.hash);return false;}
 if(current){current.active=false;try{await current.dispose?.();}catch(e){toast(`Opprydding: ${e.message}`);}}
 document.body.classList.remove('playing');
 const view={hash,key,testlab,active:true,dispose:null,canLeave:null};current=view;
 const container=el('div');arcade.screen.replaceChildren(container);arcade.select(testlab?null:key,animate);selectedKey=testlab?null:key;
 if(testlab){arcade.board.idle();void testlabPage({root:container,ctx:context,view}).catch(e=>{if(view.active)container.append(errorBox(e.message));});return true;}
 container.append(heading('SPILLHALL','Laster kassett …'));
 // Await authentication in this renderer, without holding up navigation to Testlab.
 void (async()=>{
  await context.sessionReady;if(!view.active)return;container.replaceChildren();
  if(!localPlay&&!context.session){view.locked=true;container.append(el('div',{class:'cabinet-empty'},heading('READY PLAYER ONE','Logg inn for å spille','Velg spill og se topplister fritt. Logg inn for å starte en runde.'),context.sessionError&&errorBox(context.sessionError.message),link('Logg inn',`#/login?next=${encodeURIComponent('/play/'+key)}`,'button light')));return;}
  await gamePage({root:container,ctx:context,parts:['play',key],view,onSelectedGame:game=>{if(view.active)arcade.board.show(game);},onResultSaved:()=>{if(view.active)arcade.board.refresh();}});
 })().catch(e=>{if(view.active)container.replaceChildren(heading('NOE GIKK GALT','Kunne ikke laste spillet.'),errorBox(e.message));});
 return true;
}
async function route(){
 const hash=location.hash||'#/',url=new URL(hash.slice(1),'http://local'),parts=url.pathname.split('/').filter(Boolean),name=parts[0]||'launcher';
 renderNavigation();
 if(name==='play'||name==='testlab'){
  if(name==='play'&&!families.some(family=>family.key===parts[1])){toast('Ukjent spill.');return;}
  if(!await mountCabinet(parts[1]??'testlab',hash,{testlab:name==='testlab',animate:true}))return;
  await closeAccount();return;
 }
 if(name==='launcher'){await closeAccount();if(current?.locked&&context.session)await mountCabinet(selectedKey,current.hash,{animate:false});window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});return;}
 if(name==='ai'){
  await closeAccount();arcade.focusChat();void context.sessionReady.then(()=>arcade.refreshChat());return;
 }
 await closeAccount();
 const container=el('div');arcade.account.hidden=false;
 arcade.account.append(el('div',{class:'account-toolbar'},button('Lukk ×',()=>{location.hash='#/';},'button secondary')),container);
 const view={hash,active:true,dispose:null};accountView=view;
 const publicRoute=['login','register','leaderboard','history'].includes(name);
 // Network requests must not serialize navigation. Old renderers own a detached root.
 async function renderView(){
  if(localPlay){
   container.append(heading('LOKALT SPILL','Bare lokalt spill','Database, innlogging, resultathistorikk, topplister og AI er deaktivert i denne lokale versjonen.'),link('Til spillvelgeren','#/','button'));return;
  }
  if(!publicRoute){container.append(heading('BIT:ARCADE','Laster …'));await context.sessionReady;if(!view.active)return;container.replaceChildren();}
  if(!localPlay && !publicRoute && !context.session){
   container.append(heading('KONTO','Logg inn for å fortsette',context.sessionError?'Kunne ikke kontrollere sesjonen. Prøv igjen.':'Spill, private resultater og AI-chat krever innlogging.'));
   if(context.sessionError)container.append(errorBox(context.sessionError.message));
   container.append(link('Logg inn',`#/login?next=${encodeURIComponent(url.pathname+url.search)}`));return;
  }
  const render=name==='login'||name==='register'?authentication:name==='dashboard'?dashboard:name==='profile'?profile:name==='leaderboard'||name==='history'?leaderboard:null;
  if(!render){container.append(heading('404','Denne siden finnes ikke.'),link('Til spillvelgeren','#/'));return;}
  await render({root:container,ctx:context,url,parts,view});
 }
 void renderView().then(()=>{if(view.active)arcade.account.focus({preventScroll:true});}).catch(e=>{if(view.active)container.replaceChildren(heading('NOE GIKK GALT','Kunne ikke åpne siden.'),errorBox(e.message),link('Til spillvelgeren','#/'));});
 arcade.account.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
}
window.addEventListener('hashchange',()=>{navigation=navigation.then(route).catch(e=>toast(e.message));});
context.sessionReady=context.loadSession().then(()=>{renderNavigation();});
refreshConnection();const poll=setInterval(refreshConnection,150);
window.addEventListener('pagehide',()=>{offError();clearInterval(poll);void microbit.disconnect().catch(()=>{});},{once:true});
window.addEventListener('beforeunload',e=>{if(context.queue.list().some(x=>x.state!=='saved')){e.preventDefault();e.returnValue='';}});
navigation=navigation.then(route);
