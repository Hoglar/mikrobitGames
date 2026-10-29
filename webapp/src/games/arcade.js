import { randomGenerator, clamp } from './random.js';
export function createArcade({ kind, seed='arcade-v1' }) {
  const rng=randomGenerator(seed);let t=0,x=.5,y=.5,tilt={x:0,y:0},ended=false,points=0,remaining=0,signal=null,wait=1+rng()*2,reactions=[],penalty=0;
  let target={x:.15+rng()*.7,y:.15+rng()*.7}, hazards=[{x:.3,y:.4},{x:.7,y:.7}],checkpoint=0;
  const checkpoints=[{x:.15,y:.8},{x:.15,y:.2},{x:.5,y:.2},{x:.5,y:.75},{x:.85,y:.75},{x:.85,y:.2}];
  return {
    input(s){tilt=s.tilt;},releaseControls(){tilt={x:0,y:0};},
    press({input}){if(kind!=='reaction'||ended||!['a','b'].includes(input))return;if(!signal){penalty+=500;return;}const response=Math.round((t-remaining)*1000)+(input===signal?0:1000)+penalty;reactions.push(response);penalty=0;signal=null;wait=t+1+rng()*2;if(reactions.length===5)ended=true;},
    tick(dt){if(ended)return;t+=dt;
      if(kind==='reaction'){if(!signal&&t>=wait){signal=rng()<.5?'a':'b';remaining=t;}if(signal&&t-remaining>=10){reactions.push(10000+penalty);penalty=0;signal=null;wait=t+1+rng()*2;if(reactions.length===5)ended=true;}return;}
      x=clamp(x+tilt.x*dt*.55,.025,.975);y=clamp(y+tilt.y*dt*.55,.04,.96);
      if(kind==='stars'){if(Math.hypot(x-target.x,y-target.y)<.06){points+=100;target={x:.1+rng()*.8,y:.1+rng()*.8};}for(const h of hazards)if(Math.hypot(x-h.x,y-h.y)<.055){points=Math.max(0,points-50);x=.5;y=.9;}if(t>=60)ended=true;}
      else {const p=checkpoints[checkpoint];if(p&&Math.hypot(x-p.x,y-p.y)<.05)checkpoint++;if(checkpoint===checkpoints.length||t>=600)ended=true;}
    },
    get ended(){return ended;},get value(){return kind==='stars'?points:kind==='reaction'?Math.round(reactions.reduce((a,b)=>a+b,0)/Math.max(1,reactions.length)):Math.min(600000,Math.ceil(t*1000));},
    get label(){return kind==='stars'?`${points} poeng · ${Math.max(0,Math.ceil(60-t))} s`:kind==='reaction'?`${reactions.length}/5 signaler · ${penalty?'+500 ms ved for tidlig trykk':''}`:`${checkpoint}/6 kontrollpunkter · ${t.toFixed(1)} s`;},
    get resultText(){return kind==='balance'&&checkpoint<6?'Tiden er ute. Forsøket er ufullført.':'Godt spilt! Prøv igjen og utfordre rekorden din.';},
    get completed(){return kind!=='balance'||checkpoint===6;},
    draw(ctx,w,h){ctx.fillStyle='#122321';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#243b36';for(let i=0;i<20;i++){ctx.beginPath();ctx.moveTo(i*w/20,0);ctx.lineTo(i*w/20,h);ctx.stroke();}
      if(kind==='reaction'){ctx.textAlign='center';ctx.fillStyle=signal?'#d6f59b':'#9aaca1';ctx.font='bold 100px monospace';ctx.fillText(signal?signal.toUpperCase():'···',w/2,h/2);ctx.font='19px monospace';ctx.fillText(signal?'TRYKK NÅ':'VENT PÅ SIGNALET',w/2,h/2+50);ctx.textAlign='start';return;}
      const circle=(p,r,color)=>{ctx.beginPath();ctx.fillStyle=color;ctx.arc(p.x*w,p.y*h,r,0,Math.PI*2);ctx.fill();};
      if(kind==='stars'){circle(target,15,'#ffd481');for(const hz of hazards)circle(hz,15,'#f59696');}
      else {ctx.beginPath();ctx.strokeStyle='#486a61';ctx.lineWidth=16;checkpoints.forEach(p=>ctx.lineTo(p.x*w,p.y*h));ctx.stroke();checkpoints.forEach((p,i)=>{circle(p,18,i<checkpoint?'#d6f59b':'#557d7c');ctx.fillStyle='#122321';ctx.font='bold 14px monospace';ctx.fillText(i+1,p.x*w-4,p.y*h+5);});}
      circle({x,y},12,'#e5fff8');circle({x:x-.004,y:y-.008},4,'#fff');
    }
  };
}
