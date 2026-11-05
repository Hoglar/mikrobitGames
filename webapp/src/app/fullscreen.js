import {el,button} from './dom.js';
const transitions=new WeakMap();
export const waitForFullscreen=frame=>transitions.get(frame)??Promise.resolve();
export function attachFullscreen(frame){
 const supported=typeof frame.requestFullscreen==='function'&&document.fullscreenEnabled!==false;
 const status=el('span',{class:'fullscreen-status',role:'status',hidden:true});let pending=null,disposed=false;
 const toggle=button('Fullskjerm ⛶',()=>{if(pending||disposed||!supported)return;status.hidden=true;pending=(document.fullscreenElement===frame?document.exitFullscreen():frame.requestFullscreen()).catch(()=>{if(!disposed){status.textContent='Kunne ikke åpne eller avslutte fullskjerm. Prøv igjen.';status.hidden=false;}}).finally(()=>{pending=null;transitions.delete(frame);if(!disposed)sync();});transitions.set(frame,pending);sync();},'button secondary fullscreen-toggle');
 function sync(){const active=document.fullscreenElement===frame;toggle.textContent=active?'Avslutt fullskjerm ⛶':'Fullskjerm ⛶';toggle.setAttribute('aria-pressed',String(active));toggle.disabled=!supported||!!pending;}
 frame.querySelector('.game-toolbar').append(toggle,status);document.addEventListener('fullscreenchange',sync);sync();
 return async()=>{disposed=true;document.removeEventListener('fullscreenchange',sync);await pending;if(document.fullscreenElement===frame)try{await document.exitFullscreen();}catch{}};
}
