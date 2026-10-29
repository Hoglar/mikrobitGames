import { el, button, link, heading, errorBox, field, toast } from './dom.js';
import { families, games, registeredGame, loadGame, formatScore } from '../games/registry.js';
import { getCatalog } from './pages.js';
import { createAttempt, finishAttempt, shouldRenew } from '../platform/rules.js';
import { validateSession } from './api.js';
import { createTetrisAudio } from '../games/tetris/audio.js';
const faces={win:[0,9,0,9,0,0,9,0,9,0,0,0,0,0,0,9,0,0,0,9,0,9,9,9,0],lose:[0,9,0,9,0,0,9,0,9,0,0,0,0,0,0,0,9,9,9,0,9,0,0,0,9],trophy:[9,0,0,0,9,9,9,9,9,9,0,9,9,9,0,0,0,9,0,0,0,9,9,9,0]};
export async function gamePage({root,ctx,parts,view}) {
 const key=parts[1],family=families.find(f=>f.key===key);if(!family)throw new Error('Ukjent spill.');
 root.append(heading('SPILLHALL / '+family.genre,family.title,family.description));
 const notice=el('div',{'aria-live':'polite'}),canvas=el('canvas',{width:960,height:key==='snake'?660:540,'aria-label':family.title+' spillflate'}),score=el('span',{},'Klar for en ny runde'),phaseLabel=el('span',{},'KLAR'),overlay=el('div',{class:'game-overlay'}),frame=el('section',{class:'game-frame'},el('div',{class:'game-toolbar'},score,phaseLabel,button('Pause',()=>pause('Spillet er satt på pause.'),'button secondary')),canvas,overlay,el('div',{class:'controls-hint'},key==='snake'?el('span',{},el('b',{class:'key'},'A'),' venstre · ',el('b',{class:'key'},'B'),' høyre · ',el('b',{class:'key'},'LOGO'),' pause'):key==='viking'?el('span',{},el('b',{class:'key'},'A'),' hopp · Hold ',el('b',{class:'key'},'B'),' for å dukke'):key==='reaction'?el('span',{},el('b',{class:'key'},'A / B'),' følg signalet'):el('span',{},el('b',{class:'key'},'VIPP'),' styr i alle retninger')));
 const topList=link('Toppliste for valgt variant','#/leaderboard','text-button');
 root.append(notice,frame,el('div',{class:'toolbar'},link('← Spillvelgeren','#/','text-button'),ctx.localPlay?null:topList,ctx.localPlay?el('span',{class:'notice'},'Lokal øving · ingen lagring'):link('Mine resultater','#/dashboard','text-button')));
 let alive=true,session=null,engine=null,phase='ready',countdown=3,attempt=null,ranked=!ctx.localPlay,round=0,selectedIndex=0,chordArmed=false,previousButtons={a:false,b:false},menuAction=null,menuIndex=0,lastInput=0,lastRenew=performance.now(),renewing=false,lastFrame=performance.now(),raf,personalRecord=null;
 let soundEnabled=false;
 const tetrisAudio=key==='tetris'?createTetrisAudio():null;
 const tetrisSettings={musicEnabled:true,musicVolume:96,effectsEnabled:true,effectsVolume:.2};
 let tetrisStatus=null;
 let selected=games.find(g=>g.key===key),remote=null,catalogReady=false;
 const factory=await loadGame(key);engine=await factory({config:selected.config,seed:'preview'});if(!view.active){engine.dispose?.();return;}
 if(key==='viking'){
  frame.classList.add('viking-theme');frame.dataset.phase='ready';
  const sound=button('Musikk og lyd: av',()=>{soundEnabled=engine.setSoundEnabled?.(!soundEnabled)??false;engine.setPlaying?.(phase==='playing');sound.textContent=soundEnabled?'Musikk og lyd: på':'Musikk og lyd: av';sound.setAttribute('aria-pressed',String(soundEnabled));},'button secondary viking-sound');
  sound.setAttribute('aria-pressed','false');frame.querySelector('.game-toolbar').insertBefore(sound,frame.querySelector('.game-toolbar').lastElementChild);
 }
 if(key==='tetris'){
  frame.classList.add('tetris-theme');
  frame.querySelector('.controls-hint').textContent='Vipp ← → · B: roter · A: hard drop · Logo: hold · Escape: pause';
  const music=el('input',{type:'checkbox',checked:true,'aria-label':'Micro:bit-musikk'}),effects=el('input',{type:'checkbox',checked:true,'aria-label':'Nettlesereffekter'});
  const musicVolume=el('input',{type:'range',min:0,max:255,value:96,'aria-label':'Musikkvolum'}),effectsVolume=el('input',{type:'range',min:0,max:1,step:.01,value:.2,'aria-label':'Effektvolum'});
  tetrisStatus=el('span',{class:'tetris-audio-status','aria-live':'polite'},'Lyd aktiveres med Start. Hold kontroller nøytrale under nedtelling.');
  const update=()=>{tetrisSettings.musicEnabled=music.checked;tetrisSettings.effectsEnabled=effects.checked;tetrisSettings.musicVolume=Number(musicVolume.value);tetrisSettings.effectsVolume=Number(effectsVolume.value);tetrisAudio.configure(tetrisSettings);engine.setAudioSettings?.(tetrisSettings);};
  for(const node of [music,effects,musicVolume,effectsVolume])node.addEventListener('input',update);
  frame.insertBefore(el('div',{class:'tetris-audio'},el('label',{},music,'Micro:bit-musikk'),musicVolume,el('label',{},effects,'Nettlesereffekter'),effectsVolume,tetrisStatus),canvas);
 }
 function renderEngine(){
  if(key==='viking'||key==='tetris'){
   const bounds=canvas.getBoundingClientRect(),ratio=Math.min(2,Math.max(1,globalThis.devicePixelRatio||1));
   const width=Math.round((bounds.width||960)*ratio),height=Math.round((bounds.height||540)*ratio);
   if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
  }
  engine.draw(canvas.getContext('2d'),canvas.width,canvas.height);
 }
 renderEngine();
 const choice=el('select',{'aria-label':'Spillmodus'},games.filter(g=>g.key===key).map(g=>el('option',{value:g.id},key==='snake'?g.name.replace('Micro Snake · ',''):g.name)));
 const practice=el('select',{'aria-label':'Rangert eller øving'},...(ctx.localPlay?[el('option',{value:'practice'},'Lokal øving · ingen lagring')]:[el('option',{value:'ranked'},'Rangert · lagres på kontoen'),el('option',{value:'practice'},'Øving · bare lokalt')]));practice.disabled=!!ctx.localPlay;
 const seed=el('input',{placeholder:'Valgfri seed for øving',maxlength:100,'aria-label':'Seed for øving'});seed.disabled=!ctx.localPlay;
 practice.onchange=()=>{seed.disabled=practice.value!=='practice';};
 choice.onchange=()=>{selected=games.find(g=>g.id===choice.value);remote=ctx.catalog.find(g=>g.id===selected.id);personalRecord=null;refreshReady();void fetchRecord();};
 let startButton;
 function showReady(){
  phase='ready';document.body.classList.remove('playing');startButton=button('Start spill →',()=>{void start().catch(report);},'button light');overlay.hidden=false;
  overlay.replaceChildren(...[
   el('h2',{},key==='viking'?'En ny ferd venter.':'Din neste rekord?'),
   el('p',{},key==='snake'?'A/B velger modus. A+B starter. A svinger venstre, B svinger høyre. Logo åpner pausemenyen.':key==='viking'?'Løp gjennom norsk natur. Trykk A for et hopp, hold B for å dukke.':key==='tetris'?'Vipp for å flytte, B for å rotere, A for hard drop og logo for hold. Start med kontroller nøytrale.':'Koble til micro:bit og gjør deg klar.'),
   key==='snake'?choice:null,practice,['viking','snake','tetris'].includes(key)?seed:null,startButton,
   el('p',{id:'start-requirements'},'Kontrollerer spillkatalog …')
  ].filter(child=>child!=null));refreshReady();
 }
 function refreshReady(){if(phase!=='ready')return;topList.href=`#/leaderboard/${selected.id}`;remote=ctx.catalog.find(g=>g.id===selected.id);const ready=ctx.microbit.getState().inputAvailable;startButton.disabled=!catalogReady||!remote?.is_active||!registeredGame(remote)||!ready||(!ctx.localPlay&&!ctx.session);const reason=!catalogReady?'Kontrollerer spillkatalog …':!remote?'Spillet følger med i webpakken, men er ikke registrert i backend ennå.':!registeredGame(remote)?'Spillreglene i katalogen samsvarer ikke med denne versjonen.':!remote.is_active?'Spillet er deaktivert.':!ready?'Koble til en micro:bit V2 for å starte.':ctx.localPlay?'Klar for lokal øving. Ingen innlogging, lagring eller AI.':`Klar. ${personalRecord===null?'Personlig rekord utilgjengelig.':personalRecord==='none'?'Ingen personlig rekord ennå.':`Personlig rekord: ${formatScore(remote,personalRecord)}`}`;overlay.querySelector('#start-requirements').textContent=reason;}
 async function fetchRecord(){if(ctx.localPlay)return;const id=selected.id;try{const data=(await ctx.api(`/players/${ctx.session.player.id}/records?page=0&page_size=100`)).data;if(alive&&id===selected.id){personalRecord=data.items.find(x=>x.game.id===id)?.record.value??'none';refreshReady();}}catch{}}
 function report(e){if(alive)notice.replaceChildren(errorBox(e.message));}
 function onState(s){
  if(!alive)return;
  if(!s.inputAvailable){chordArmed=false;previousButtons={a:false,b:false};if(['playing','countdown'].includes(phase))pause('Micro:bit-input er utilgjengelig. Koble til igjen og velg Fortsett.');return;}
  engine?.input?.(s);
  if(s.buttons.aPressed||s.buttons.bPressed||s.touch.logoPressed||Math.abs(s.tilt.x)+Math.abs(s.tilt.y)>.1)lastInput=performance.now();
  const a=s.buttons.aPressed,b=s.buttons.bPressed;
  if(!a&&!b)chordArmed=true;
  if(key==='snake' && ['ready','result','paused','confirm'].includes(phase)){
   if(chordArmed&&a&&b){chordArmed=false;previousButtons={a:false,b:false};if(phase==='ready'||phase==='result'){void start().catch(report);}else if(phase==='paused')menuSelect();else confirmSelect();return;}
   if(chordArmed && !a&&!b){if(previousButtons.a)menuMove(-1);else if(previousButtons.b)menuMove(1);previousButtons={a:false,b:false};}
   if(a||b)previousButtons={a:previousButtons.a||a,b:previousButtons.b||b};
  }else if(['viking','tetris'].includes(key) && phase==='result'&&chordArmed&&a){chordArmed=false;void start().catch(report);}
 }
 function onPress(e){const s=ctx.microbit.getState();if(!s.inputAvailable)return;lastInput=performance.now();
  if(e.input==='logo' && key==='snake') {if(phase==='playing'||phase==='countdown')pause('Ta en liten pust i bakken.');else if(phase==='paused')resume();else if(phase==='confirm')pause('Ta en liten pust i bakken.');return;}
  if(phase==='playing'&&!(key==='snake'&&(s.touch.logoPressed||s.buttons.aPressed&&s.buttons.bPressed)))engine.press(e);
 }
 function ensureSession(){if(!session&&ctx.microbit.getState().inputAvailable){session=ctx.microbit.createGameSession();session.inputs.subscribe(onState);session.inputs.onPress(onPress);}}
 async function start(){
  if(!alive||!['ready','result'].includes(phase))return;
  selected=games.find(g=>g.id===choice.value)||selected;remote=ctx.catalog.find(g=>g.id===selected.id);
  if(!remote?.is_active||!registeredGame(remote)||!ctx.microbit.getState().inputAvailable||(!ctx.localPlay&&!ctx.session))throw new Error(ctx.localPlay?'Start krever et lokalt spill og klar micro:bit.':'Start krever innlogging, aktivt registrert spill og klar micro:bit.');
  tetrisAudio?.unlock(); // Before auth/serial awaits: preserve the browser user gesture.
  phase='starting';phaseLabel.textContent='FORBEREDER';startButton&&(startButton.disabled=true);const owner=ctx.session?.player.id;
  try{
   if(!ctx.localPlay)await ctx.api('/auth/renew',{method:'POST'});if(!alive)return;if((!ctx.localPlay&&ctx.session?.player.id!==owner)||!ctx.microbit.getState().inputAvailable)throw new Error('Konto eller tilkobling ble endret før start.');
   engine.setPlaying?.(false);if(key==='tetris')engine.dispose?.();
   if(session){const old=session;session=null;await old.dispose();}ensureSession();
   if(!session||!ctx.microbit.getState().inputAvailable)throw new Error('Micro:bit-tilkoblingen ble endret før rundestart. Koble til og prøv igjen.');
   ranked=!ctx.localPlay&&practice.value==='ranked';const roundSeed=ranked?crypto.randomUUID():seed.value.trim().normalize('NFC')||crypto.randomUUID();
   engine.dispose?.();engine=await factory({config:selected.config,seed:roundSeed,outputs:session?.outputs,browserAudio:tetrisAudio,reportOutputError:report});if(!alive){engine.dispose?.();return;}if(soundEnabled)engine.setSoundEnabled?.(true);engine.setAudioSettings?.(tetrisSettings);
   attempt=ctx.localPlay?null:createAttempt({playerId:owner,game:remote,attemptId:crypto.randomUUID()});round++;lastRenew=performance.now();lastInput=lastRenew;chordArmed=false;previousButtons={a:false,b:false};
   if(key==='snake')void session.outputs.display.clear().catch(report);
   beginCountdown();notice.replaceChildren();
  }catch(e){if(e.status===401)ctx.setSession(null);showReady();throw e;}
 }
 function beginCountdown(){phase='countdown';countdown=3;engine.setPlaying?.(false);engine.releaseControls?.();overlay.hidden=false;overlay.replaceChildren(el('h2',{},'3'),el('p',{},ranked?'Rangert runde · gjør deg klar':'Øving · resultatet lagres bare lokalt'));document.body.classList.add('playing');chordArmed=false;lastFrame=performance.now();}
 function pause(reason){if(!['playing','countdown','paused','confirm'].includes(phase))return;phase='paused';engine.setPlaying?.(false);engine.releaseControls?.();menuIndex=0;menuAction=null;chordArmed=false;previousButtons={a:false,b:false};renderPause(reason);}
 function renderPause(reason='Velg hva du vil gjøre videre.'){
  overlay.hidden=false;const labels=['Fortsett','Restart','Hovedmeny'];overlay.replaceChildren(el('h2',{},'Pause'),el('p',{},reason),...labels.map((label,i)=>button(`${menuIndex===i?'→ ':''}${label}`,()=>{menuIndex=i;menuSelect();},i===menuIndex?'button light':'button secondary')));
  if (!ctx.localPlay && (!ctx.session || ctx.session.player.id !== attempt?.playerId)) {
    const username=el('input',{required:true,autocomplete:'username','aria-label':'Brukernavn for å fortsette',placeholder:'Brukernavn'});
    const password=el('input',{type:'password',required:true,autocomplete:'current-password','aria-label':'Passord for å fortsette',placeholder:'Passord'});
    const submit=el('button',{type:'submit',class:'button light'},'Logg inn med samme konto');
    const form=el('form',{},username,password,submit);
    form.onsubmit=async event=>{event.preventDefault();submit.disabled=true;try{
      const response=await ctx.api('/auth/login',{method:'POST',body:{username:username.value,password:password.value}});
      const restored=validateSession(response.data);ctx.setSession(restored);
      if(restored.player.id!==attempt.playerId)throw new Error('Denne runden tilhører en annen konto. Logg inn med kontoen som startet den.');
      renderPause('Innloggingen er gjenopprettet. Velg Fortsett når du er klar.');
    }catch(error){report(error);}finally{password.value='';submit.disabled=false;}};
    overlay.append(form);
  }
 }
 function menuMove(direction){if(phase==='ready'){if(key==='snake'){selectedIndex=(selectedIndex+direction+choice.options.length)%choice.options.length;choice.selectedIndex=selectedIndex;choice.dispatchEvent(new Event('change'));}}else if(phase==='paused'){menuIndex=(menuIndex+direction+3)%3;renderPause();}else if(phase==='confirm'){menuIndex=1-menuIndex;renderConfirm();}}
 function menuSelect(){if(menuIndex===0)resume();else{menuAction=menuIndex===1?'restart':'menu';phase='confirm';menuIndex=0;chordArmed=false;renderConfirm();}}
 function renderConfirm(){overlay.replaceChildren(el('h2',{},'Avslutte denne runden?'),el('p',{},ranked?'Forsøket lagres som ufullført.':'Øvingsresultatet beholdes bare lokalt.'),button(`${menuIndex===0?'→ ':''}Avbryt`,()=>pause('Runden er fortsatt satt på pause.'),menuIndex===0?'button light':'button secondary'),button(`${menuIndex===1?'→ ':''}Ja, avslutt`,()=>{menuIndex=1;confirmSelect();},menuIndex===1?'button light':'button secondary'));}
 function confirmSelect(){if(menuIndex===0){pause('Runden er fortsatt satt på pause.');return;}const action=menuAction;finish('incomplete');if(action==='restart')void start().catch(report);else showReady();}
 function resume(){if(phase!=='paused')return;if(!ctx.microbit.getState().inputAvailable){report(new Error('Micro:bit er ikke klar ennå.'));return;}if(!ctx.localPlay&&(!ctx.session||ctx.session.player.id!==attempt.playerId)){report(new Error('Logg inn med samme konto før du fortsetter.'));return;}beginCountdown();}
 function finish(status){
  if((!ctx.localPlay&&!attempt)||['result','ready','closed'].includes(phase))return;
  phase='result';engine.setPlaying?.(false);engine.finishRound?.();document.body.classList.remove('playing');engine.releaseControls?.();chordArmed=false;const finished=ctx.localPlay?Object.freeze({value:engine.value}):finishAttempt(attempt,status,engine.value),thisRound=round,outputSession=session,localGame=remote;
  const saveStatus=el('p',{class:'notice'},ranked?'Avventer lagringsbekreftelse …':'Øving · resultatet lagres ikke i backend.');
  const retry=button('Prøv lagring igjen',()=>{void save();},'button secondary');retry.hidden=true;
  overlay.hidden=false;overlay.replaceChildren(el('h2',{},status==='completed'?'Godt spilt!':'Runden er avsluttet'),el('p',{},formatScore(localGame,finished.value)),el('p',{},engine.resultText),saveStatus,el('div',{class:'actions'},button('Spill igjen →',()=>{void start().catch(report);},'button light'),retry,...(ctx.localPlay?[]:[link('Se Dashboard',`#/dashboard?attempt=${finished.attemptId}`,'button secondary')])),button('Til modusvelger',showReady,'text-button'));
  if(key==='snake'&&status==='completed'&&ctx.microbit.getState().inputAvailable){const image=engine.state.won?faces.win:faces.lose;if(engine.state.steps<999999)void outputSession.outputs.display.showImage(image).catch(report);}
  if(!ranked)return;
  ctx.queue.add(finished);let trophyShown=false;
  async function save(){retry.disabled=true;saveStatus.textContent='Avventer lagringsbekreftelse …';try{const data=await ctx.queue.send(finished.attemptId);saveStatus.textContent=data.outcome==='created'?'Lagret · ny personlig rekord!':'Forsøket er lagret.';retry.hidden=true;
    if(alive&&round===thisRound&&phase==='result'&&key==='snake'&&data.outcome==='created'&&!trophyShown&&session===outputSession&&ctx.microbit.getState().inputAvailable){trophyShown=true;void outputSession.outputs.display.showImage(faces.trophy).catch(report);}
  }catch(e){saveStatus.textContent=`Ikke bekreftet lagret. ${e.message} Data beholdes i minnet. Oppdatering kan miste dem.`;retry.hidden=false;}finally{retry.disabled=false;}}
  void save();
 }
 const visibility=()=>{if(document.hidden)pause('Fanen er skjult. Spillet venter til du velger Fortsett.');};document.addEventListener('visibilitychange',visibility);
 const escape=event=>{if(key==='tetris'&&event.key==='Escape'&&['playing','countdown'].includes(phase)){event.preventDefault();pause('Spillet er satt på pause.');}};document.addEventListener('keydown',escape);
 function draw(now){if(!alive)return;const dt=(now-lastFrame)/1000;lastFrame=now;
  if(dt>.25&&['playing','countdown'].includes(phase))pause('Spillet ble satt på pause etter et opphold i nettleseren.');
  if(phase==='countdown'&&dt<=.25){countdown-=dt;overlay.querySelector('h2').textContent=String(Math.max(1,Math.ceil(countdown)));if(countdown<=0){phase='playing';overlay.hidden=true;engine.releaseControls?.();}}
  if(key==='tetris'&&['playing','countdown'].includes(phase)){const bounds=canvas.getBoundingClientRect();if(bounds.width<280||bounds.height<440)pause('Spillflaten er for liten. Utvid vinduet eller roter skjermen.');}
  engine.setPlaying?.(phase==='playing');
  if(phase==='playing'&&dt<=.25){if(!ctx.microbit.getState().inputAvailable)pause('Input er utilgjengelig.');else{engine.tick(dt);if(engine.ended)finish(engine.completed===false?'incomplete':'completed');}}
  frame.dataset.phase=phase;renderEngine();score.textContent=engine.label;phaseLabel.textContent={ready:'KLAR',playing:'SPILLER',countdown:'NEDTELLING',paused:'PAUSE',confirm:'BEKREFT',result:'RESULTAT',starting:'FORBEREDER'}[phase]??phase;
  if(tetrisStatus){const status=engine.outputStatus;const sound=tetrisAudio.status;const text=`Musikk: ${!tetrisSettings.musicEnabled||!tetrisSettings.musicVolume?'av':status?.music==='error'?'feil – slå av/på for å prøve igjen':phase==='playing'?'på':'pause'} · Effekter: ${sound==='on'?'på':sound==='off'?'av':'klikk lydvalget for å aktivere'}${status?.display==='error'?' · Hold-display ikke bekreftet':''}`;if(tetrisStatus.textContent!==text)tetrisStatus.textContent=text;}
  raf=requestAnimationFrame(draw);
 }
 showReady();raf=requestAnimationFrame(draw);
 const poll=setInterval(()=>{if(!alive)return;try{ensureSession();refreshReady();}catch(e){report(e);}
  if(!ctx.localPlay&&shouldRenew({active:phase==='playing',visible:!document.hidden,hasUserInput:performance.now()-lastInput<300000,elapsedMs:performance.now()-lastRenew})&&!renewing){renewing=true;ctx.api('/auth/renew',{method:'POST'}).then(()=>{lastRenew=performance.now();},e=>{if(e.status===401)ctx.setSession(null);pause('Sesjonen kunne ikke fornyes. Runden er beholdt.');report(e);}).finally(()=>{renewing=false;});}
 },150);
 view.canLeave=()=>!['playing','countdown','paused','confirm','starting'].includes(phase)||confirm(ranked?'Avslutte runden og gå videre? Et startet rangert forsøk lagres som ufullført.':'Avslutte øvingsrunden og gå videre?');
 view.dispose=async()=>{if(!alive)return;if(['playing','countdown','paused','confirm'].includes(phase))finish('incomplete');alive=false;round++;phase='closed';cancelAnimationFrame(raf);clearInterval(poll);document.removeEventListener('visibilitychange',visibility);document.removeEventListener('keydown',escape);document.body.classList.remove('playing');engine.dispose?.();tetrisAudio?.dispose();const old=session;session=null;if(old)await old.dispose();};
 try{await getCatalog(ctx);if(!alive)return;catalogReady=true;refreshReady();void fetchRecord();}catch(e){if(alive){catalogReady=true;refreshReady();report(e);}}
}
