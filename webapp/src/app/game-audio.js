import {el,button} from './dom.js';

const key='bit-arcade-audio-v1';
let settings=Object.freeze({enabled:false,volume:1});
try{
 const saved=JSON.parse(localStorage.getItem(key));
 if(typeof saved?.enabled==='boolean'&&Number.isFinite(saved.volume)&&saved.volume>=0&&saved.volume<=1)settings=Object.freeze({enabled:saved.enabled,volume:saved.volume});
}catch{/* Audio preferences also work when browser storage is unavailable. */}

export function gameAudioControls(onChange){
 const toggle=button('',()=>change({...settings,enabled:!settings.enabled}),'button secondary audio-toggle');
 const volume=el('input',{type:'range',min:0,max:1,step:.05,'aria-label':'Spillvolum'});
 const value=el('span',{class:'audio-volume-value','aria-hidden':'true'});
 const node=el('div',{class:'game-audio',role:'group','aria-label':'Spilllyd'},toggle,el('label',{class:'audio-volume'},el('span',{},'Volum'),volume,value));
 function sync(){toggle.textContent=settings.enabled?'Lyd: på':'Lyd: av';toggle.setAttribute('aria-pressed',String(settings.enabled));volume.value=settings.volume;value.textContent=Math.round(settings.volume*100)+'%';}
 function change(next){settings=Object.freeze(next);try{localStorage.setItem(key,JSON.stringify(settings));}catch{}sync();onChange(settings);}
 volume.oninput=()=>change({...settings,volume:Number(volume.value)});
 sync();return {node,getSettings:()=>settings};
}
