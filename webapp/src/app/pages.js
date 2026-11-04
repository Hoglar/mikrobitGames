import { el, button, link, field, heading, errorBox, toast } from './dom.js';
import { families, games, registeredGame, formatScore } from '../games/registry.js';
import { validateSession } from './api.js';
import { questionBody } from '../platform/rules.js';
const date=s=>new Date(s).toLocaleString('nb-NO');
export function deviceFigure(){const pixels=[0,1,0,1,0,1,0,1,0,1,1,0,0,0,1,0,1,0,1,0,0,0,1,0,0];return el('div',{class:'microbit','aria-label':'Illustrasjon av micro:bit'},el('span',{class:'logo'},'●'),el('span',{class:'pad'},'A'),el('div',{class:'led-grid'},pixels.map(x=>el('span',{class:x?'on':''}))),el('span',{class:'pad'},'B'));}
export async function getCatalog(ctx){if(ctx.localPlay){ctx.catalog=games.map(game=>({...game,is_active:true}));return ctx.catalog;}const items=[];for(let page=0;page<100;page++){const data=(await ctx.api(`/games?page=${page}&page_size=100&include_inactive=true`)).data;if(!Array.isArray(data.items)||!Number.isInteger(data.total))throw new Error('Ugyldig spillkatalog.');items.push(...data.items);if(items.length>=data.total||!data.items.length)break;}ctx.catalog=items;return items;}
export async function authentication({root,ctx,url,parts}){
 const register=parts[0]==='register',message=el('div',{'aria-live':'polite'}),username=el('input',{name:'username',autocomplete:'username',required:true,minlength:3,maxlength:32,pattern:'[A-Za-z0-9_-]+'}),password=el('input',{name:'password',type:'password',autocomplete:register?'new-password':'current-password',required:true,minlength:12,maxlength:256});
 const submit=el('button',{class:'button',type:'submit'},register?'Opprett konto':'Logg inn');
 const form=el('form',{class:'panel auth-panel'},el('h2',{},register?'Bli med i spillhallen.':'Velkommen tilbake.'),field('Brukernavn',username),field('Passord · 12–128 tegn',password),message,submit,el('p',{class:'page-footer'},register?link('Har du konto? Logg inn','#/login','text-button'):link('Ny her? Opprett konto','#/register','text-button')));
 root.append(heading('DIN SPILLHALL',register?'En ny rekord starter her.':'Klar for en ny runde?'),form);
 form.onsubmit=async e=>{e.preventDefault();submit.disabled=true;message.replaceChildren();try{
 if([...password.value].length>128)throw new Error('Passordet kan ha høyst 128 tegn.');
 const {data}=await ctx.api(register?'/auth/register':'/auth/login',{method:'POST',body:{username:username.value,password:password.value}});password.value='';
 if(register){toast('Kontoen er opprettet. Logg inn for å spille.');location.hash='#/login';}else{ctx.setSession(validateSession(data));ctx.chat=[];const next=url.searchParams.get('next');location.hash=next?.startsWith('/')&&!next.startsWith('//')?`#${next}`:'#/';}
 }catch(error){password.value='';message.append(errorBox(error.message));}finally{submit.disabled=false;}};
}
export function pagination(data,onPage){const previous=button('← Forrige',()=>onPage(data.page-1),'button secondary'),next=button('Neste →',()=>onPage(data.page+1),'button secondary');previous.disabled=data.page===0;next.disabled=(data.page+1)*data.page_size>=data.total;return el('div',{class:'pagination'},previous,el('span',{class:'muted'},`${data.total} totalt · Side ${data.page+1}`),next);}
export async function leaderboard({root,ctx,url,parts}){
 const id=parts[1],player=url.searchParams.get('player'),page=Math.max(0,Number(url.searchParams.get('page'))||0),history=parts[0]==='history';
 if(!id&&!history){
  root.append(heading('OFFENTLIGE REKORDER','Topplister','Se rekorder fra alle spillere. Hver spillvariant har sin egen toppliste.'));
  const catalog=await getCatalog(ctx),available=catalog.filter(g=>registeredGame(g));
  root.append(available.length?el('div',{class:'stat-grid'},available.map(g=>el('div',{class:'stat'},el('h2',{},g.name),link('Åpne toppliste →',`#/leaderboard/${g.id}`,'text-button')))):el('p',{class:'notice'},'Ingen kompatible spill i katalogen ennå.'));
  return;
 }
 root.append(heading(history?'OFFENTLIG REKORDHISTORIKK':'OFFENTLIG TOPPLISTE',history?'Veien til rekorden.':'Litt vennlig konkurranse.','Bare fullførte forsøk som har gitt rekord vises offentlig.'));
 const path=history?`/players/${encodeURIComponent(player)}/games/${encodeURIComponent(id)}/records`:`/games/${encodeURIComponent(id)}/leaderboard`,data=(await ctx.api(`${path}?page=${page}&page_size=30`)).data;
 root.append(el('h2',{},data.game.name),history?el('p',{class:'muted'},data.player.username):null);
 const table=el('table',{},el('thead',{},el('tr',{},['Plass / dato','Spiller','Resultat'].map(x=>el('th',{},x)))),el('tbody',{},data.items.map(row=>history?el('tr',{},el('td',{},date(row.created_at)),el('td',{},data.player.username),el('td',{},formatScore(data.game,row.value))):el('tr',{},el('td',{},`#${row.rank}`),el('td',{},link(row.player.username,`#/history/${id}?player=${row.player.id}`,'text-button')),el('td',{},formatScore(data.game,row.record.value))))));
 root.append(data.items.length?el('div',{class:'table-wrap panel'},table):el('p',{class:'notice'},'Ingen rekorder ennå.'),pagination(data,n=>{location.hash=`#/${history?'history':'leaderboard'}/${id}?page=${n}${player?`&player=${player}`:''}`;}),link('← Alle topplister','#/leaderboard','text-button'),link('← Spillvelgeren','#/','text-button'));
}
export async function dashboard({root,ctx,url}){
 root.append(heading('DITT DASHBOARD','Hver runde teller.','Private forsøk og personlige rekorder. Ufullførte forsøk påvirker aldri topplisten.'));
 root.append(link('Se topplister for alle spillere →','#/leaderboard','text-button'));
 const pending=ctx.queue.list().filter(e=>e.attempt.playerId===ctx.session.player.id&&e.state!=='saved');
 for(const entry of pending){const status=el('p',{},entry.error?.message??'Dette forsøket er ikke bekreftet lagret.');const retry=button('Prøv lagring igjen',async()=>{retry.disabled=true;try{await ctx.queue.send(entry.attempt.attemptId);status.textContent='Lagring bekreftet.';retry.remove();}catch(e){status.textContent=e.message;}finally{retry.disabled=false;}});root.append(el('div',{class:'notice'},el('strong',{},'Ubekreftet lokalt forsøk'),status,el('p',{},formatScore(ctx.catalog.find(g=>g.id===entry.attempt.gameId),entry.attempt.value)),retry));}
 let catalog=ctx.catalog;try{if(!catalog.length)catalog=await getCatalog(ctx);}catch{}
 const filter=el('select',{'aria-label':'Filtrer på spill'},el('option',{value:''},'Alle spill'),catalog.map(g=>el('option',{value:g.id,selected:url.searchParams.get('game')===g.id},g.name)));
 filter.onchange=()=>{location.hash=`#/dashboard${filter.value?`?game=${filter.value}`:''}`;};root.append(el('div',{class:'toolbar'},filter));
 const game=url.searchParams.get('game'),page=Math.max(0,Number(url.searchParams.get('page'))||0),attemptId=url.searchParams.get('attempt');
 if(attemptId){try{const a=(await ctx.api(`/account/results/${encodeURIComponent(attemptId)}`)).data;root.append(el('div',{class:'notice success'},el('strong',{},'Ditt siste forsøk'),el('p',{},`${a.status==='completed'?'Fullført':'Ufullført'} · ${formatScore(catalog.find(g=>g.id===a.game_id),a.value)}`)));}catch(e){root.append(errorBox(e.message));}}
 const data=(await ctx.api(`/account/results?page=${page}&page_size=30${game?`&game_id=${encodeURIComponent(game)}`:''}`)).data;
 const table=el('table',{},el('thead',{},el('tr',{},['Spill','Resultat','Status','Tidspunkt'].map(x=>el('th',{},x)))),el('tbody',{},data.items.map(a=>el('tr',{class:a.id===attemptId?'highlight':''},el('td',{},catalog.find(g=>g.id===a.game_id)?.name??a.game_id),el('td',{},formatScore(catalog.find(g=>g.id===a.game_id),a.value)),el('td',{},a.status==='completed'?'Fullført':'Ufullført'),el('td',{},date(a.created_at))))));
 root.append(data.items.length?el('div',{class:'panel table-wrap'},table):el('p',{class:'notice'},'Du har ingen spillresultater ennå.'),pagination(data,n=>{location.hash=`#/dashboard?page=${n}${game?`&game=${game}`:''}`;}));
 try{const records=(await ctx.api(`/players/${ctx.session.player.id}/records?page=0&page_size=100`)).data;root.append(el('h2',{style:'margin-top:35px'},'Personlige rekorder'),el('div',{class:'stat-grid'},records.items.map(({game,record})=>el('div',{class:'stat'},el('span',{},game.name),el('strong',{},formatScore(game,record.value)),link('Se rekordhistorikk →',`#/history/${game.id}?player=${ctx.session.player.id}`,'text-button')))));if(!records.items.length)root.append(el('p',{class:'notice'},'Du har ingen personlige rekorder ennå.'));}catch(e){root.append(errorBox(`Rekorder: ${e.message}`));}
}
export async function profile({root,ctx}){
 const player=ctx.session.player;root.append(heading('DIN KONTO','Hei, '+player.username+'.','Her finner du kontoen din og innstillinger for passord.'));
 root.append(el('div',{class:'panel'},el('h2',{},'Kontoinformasjon'),el('dl',{},el('dt',{},'Brukernavn'),el('dd',{},player.username),el('dt',{},'Spiller-ID'),el('dd',{style:'overflow-wrap:anywhere'},player.id),el('dt',{},'Opprettet'),el('dd',{},date(player.created_at)))));
 const columns=el('div',{class:'columns',style:'margin-top:24px'});root.append(columns);
 for(const remove of [false,true]){const current=el('input',{type:'password',required:true,autocomplete:'current-password',maxlength:256}),newPass=el('input',{type:'password',required:true,autocomplete:'new-password',minlength:12,maxlength:256}),message=el('div',{'aria-live':'polite'}),submit=el('button',{type:'submit',class:remove?'button danger':'button'},remove?'Slett kontoen':'Endre passord');const form=el('form',{class:`panel ${remove?'danger-zone':''}`},el('h3',{},remove?'Slett konto':'Nytt passord'),el('p',{class:'muted'},remove?'Kontoen, forsøkene og rekordene dine slettes permanent.':'Alle innlogginger avsluttes etter endringen.'),field('Gjeldende passord',current),!remove&&field('Nytt passord · 12–128 tegn',newPass),message,submit);columns.append(form);
 form.onsubmit=async e=>{e.preventDefault();if(remove&&!confirm('Slette kontoen og all spillhistorikken permanent?'))return;submit.disabled=true;message.replaceChildren();try{if(!remove&&[...newPass.value].length>128)throw new Error('Passordet kan ha høyst 128 tegn.');await ctx.api(remove?'/account/delete':'/account/password',{method:'POST',body:remove?{current_password:current.value}:{current_password:current.value,new_password:newPass.value}});ctx.setSession(null);ctx.chat=[];location.hash='#/login';toast(remove?'Kontoen er slettet.':'Passordet er endret. Logg inn igjen.');}catch(e){message.append(errorBox(e.message));}finally{current.value='';newPass.value='';submit.disabled=false;}};
 }
}
export async function chat({root,ctx,view}){
 const chatHeading=heading('03 / SPILLASSISTENTEN','AI-chat','Spør om offentlige rekorder og sammenligninger. Assistenten får ikke lese private spillforsøk.');
 const title=chatHeading.querySelector('h1'),smallTitle=el('h2',{},title.textContent);title.replaceWith(smallTitle);root.append(chatHeading);
 const list=el('div',{class:'chat-list',role:'log','aria-label':'Samtale','aria-live':'polite'}),message=el('div',{'aria-live':'polite'}),question=el('textarea',{required:true,maxlength:2000,placeholder:'Hvem har rekorden i Viking Dash?','aria-label':'Ditt spørsmål'}),submit=el('button',{type:'submit',class:'button'},'Send spørsmål ↗'),reset=button('Ny samtale',async()=>{reset.disabled=true;try{await ctx.api('/ai/conversation/reset',{method:'POST'});ctx.chat=[];render();}catch(e){message.replaceChildren(errorBox(e.message));}finally{reset.disabled=false;}});
 let alive=true;view.dispose=()=>{alive=false;};
 let rendered='';function render(){const content=JSON.stringify(ctx.chat);if(content!==rendered){list.replaceChildren(...ctx.chat.map(m=>el('div',{class:`chat-message ${m.role}`},el('small',{},m.role==='user'?'DU':'SPILLASSISTENTEN'),m.text)));rendered=content;list.scrollTop=list.scrollHeight;}submit.disabled=ctx.aiBusy;reset.disabled=ctx.aiBusy;question.disabled=ctx.aiBusy;}
 const form=el('form',{class:'panel'},field('Hva lurer du på?',question),message,el('div',{class:'actions'},submit,reset));
 root.append(el('p',{class:'notice'},'Samtalen huskes midlertidig på serveren, opptil 20 utvekslinger. Ny innlogging, inaktivitet eller omstart kan tømme minnet.'),list,form);
 // A request may finish while the player is on another page.
 const watch=setInterval(()=>{if(alive)render();},500);view.dispose=()=>{alive=false;clearInterval(watch);};render();
 form.onsubmit=async e=>{e.preventDefault();if(ctx.aiBusy)return;message.replaceChildren();let body;try{body=questionBody(question.value);}catch(e){message.append(errorBox(e.message));return;}ctx.aiBusy=true;const owner=ctx.session.player.id;ctx.chat.push({role:'user',text:body.question});question.value='';render();message.append(el('p',{class:'notice'},'Assistenten tenker … Dette kan ta opptil 70 sekunder.'));
 try{const data=(await ctx.api('/ai/questions',{method:'POST',body,timeoutMs:70000})).data;if(!['ok','no_data','cannot_answer'].includes(data.status)||typeof data.answer!=='string')throw new Error('Ugyldig AI-svar.');if(ctx.session?.player.id===owner){ctx.chat.push({role:'assistant',text:data.answer});for(const notice of data.notices??[])ctx.chat.push({role:'assistant',text:notice});}}
 catch(error){if(ctx.session?.player.id===owner)ctx.chat.push({role:'assistant',text:`Kunne ikke svare: ${error.message}`});}
 finally{ctx.aiBusy=false;if(alive){message.replaceChildren();render();}}
 };
}
