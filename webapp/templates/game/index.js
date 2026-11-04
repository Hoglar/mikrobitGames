import {defineGame} from '@microbit-games/sdk';
export default defineGame(({input,scores,ui})=>{
 let x=0,y=0,done=false;
 const off=input.subscribe(state=>{x=state.inputAvailable?state.tilt.x:0;y=state.inputAvailable?state.tilt.y:0;});
 const press=input.onPress(({input:key})=>{if(key!=='b'||done)return;done=true;const points=Math.round(1000*(1-Math.min(1,Math.hypot(x,y)/Math.SQRT2)));void scores.finish({status:'completed',score:{points},resultText:'Nærmere midten gir flere poeng!'}).catch(e=>ui.setStatus(e.message));});
 return {update(){},render(ctx,{width,height}){ctx.fillStyle='#101426';ctx.fillRect(0,0,width,height);const r=Math.min(width,height)*.4;ctx.strokeStyle='#fff0a8';ctx.beginPath();ctx.arc(width/2,height/2,r,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#8dffb0';ctx.beginPath();ctx.arc(width/2+x*r,height/2+y*r,10,0,Math.PI*2);ctx.fill();},dispose(){off();press();}};
});
