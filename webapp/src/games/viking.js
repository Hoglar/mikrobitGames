import { randomGenerator } from './random.js';
const environments = ['Norsk skog','Fjord og kyst','Fjellandskap','Nordlysnatt','Mytologisk landskap'];
export const events = [
  ['Nordlys',0,3],['Stjerneskudd',0,3],['Meteorregn',200,2],['Solformørkelse',400,1],['Måneformørkelse',400,1],['Tordenvær',200,2],['Snøstorm',200,2],['Tåke',200,2],['Solnedgang',0,3],['Tor',400,2],['Odin',400,2],['Bivrost',400,2],['Yggdrasil',600,1],['Fenrisulven',800,1],['Ragnarok',1200,.5]
];
function weighted(rng, items) { let n=rng()*items.reduce((a,x)=>a+x[2],0); return items.find(x=>(n-=x[2])<0) ?? items.at(-1); }
export function createViking({ seed = 'viking-v1' } = {}) {
  const rng=randomGenerator(`viking-v1-${seed}`);
  let distance=0,time=0,y=0,velocity=0,duck=false,ended=false,jumpBuffer=0,nextObstacle=28,objects=[],remainder=0,environment=0,section=0,event=null,lastEvent=null,nextEvent=10+rng()*5;
  function step(dt) {
    const previous=distance;time+=dt;distance+=(8+8*Math.min(distance/1500,1))*dt;
    if (Math.floor(distance/500)>section) { section=Math.floor(distance/500); environment=weighted(rng,environments.map((n,i)=>[n,i,[15,35,35,10,5][i]]))[1]; }
    if(event && time>=event.until) { lastEvent=event.name; const intense=['Odin','Ragnarok'].includes(event.name);event=null;nextEvent=time+(intense?12:6)+rng()*(intense?8:6); }
    if(!event && time>=nextEvent) { const chosen=weighted(rng,events.filter(e=>distance>=e[1]&&e[0]!==lastEvent));event={ name:chosen[0], start:time, until:time+(['Odin','Ragnarok'].includes(chosen[0])?14:10)+rng()*8 }; }
    if(distance+55>=nextObstacle) {
      let types=distance<100?['rock']:distance<200?['rock','branch']:['rock','branch','pit'];
      if(event?.name==='Odin' && time-event.start>=2) types=['branch','branch','rock','pit'];
      const type=types[Math.floor(rng()*types.length)], width=type==='pit'?(rng()<.5?1.5:2.5):type==='branch'?(rng()<.5?1:1.5):(rng()<.5?.6:1);
      objects.push({ x:nextObstacle,type,width,height:width===.6?.4:.7 });
      // At the maximum speed, 32m leaves 2 seconds between isolated actions:
      // 0.8s flight + 0.35s switch + over 0.8s additional margin.
      nextObstacle+=(event?.name==='Ragnarok' && time-event.start>=2 ? 26+rng()*6 : 32+rng()*16);
    }
    jumpBuffer=Math.max(0,jumpBuffer-dt);
    if(y===0 && jumpBuffer>0 && !duck) { velocity=8;jumpBuffer=0; }
    if(y>0 || velocity>0) { y+=velocity*dt-10*dt*dt;velocity-=20*dt;if(y<=0){y=0;velocity=0;} }
    const height=y>0?1.4:duck?.65:1.4;
    for(const o of objects) {
      const crosses=distance+.25>o.x && previous-.25<o.x+o.width;
      if(!crosses)continue;
      if(o.type==='pit') { if(distance>=o.x && distance<o.x+o.width && y===0)ended=true; }
      else if(o.type==='rock') { if(y<o.height && y+height>0)ended=true; }
      else if(y<1.8 && y+height>.9)ended=true;
    }
    objects=objects.filter(o=>o.x+o.width>distance-5);
  }
  return {
    press({input}) { if(input==='a' && !duck && !ended)jumpBuffer=.1; },
    input(state) { duck=state.buttons.bPressed; },
    releaseControls() { duck=false;jumpBuffer=0; },
    tick(dt) { remainder+=dt;while(!ended&&remainder>=1/120){step(1/120);remainder-=1/120;} },
    get ended(){return ended;},get value(){return Math.floor(distance);},get label(){return `${Math.floor(distance)} m · ${environments[environment]}`;},get resultText(){return 'Eventyret er over. Klar for en ny ferd?';},
    get state(){return {distance,time,y,duck,environment,event,objects:structuredClone(objects),ended};},
    draw(ctx,w,h) {
      const palettes=[['#b5c6bd','#708d80','#203f35'],['#b5d7dc','#729caa','#294b56'],['#d0dae0','#8a9eaf','#334657'],['#182a43','#3e736e','#132b35'],['#443c5b','#877394','#302d45']];
      const [sky,mountain,ground]=palettes[environment],scale=w/42,baseline=h*.78;
      ctx.fillStyle=event?.name==='Ragnarok'?'#664043':sky;ctx.fillRect(0,0,w,h);
      ctx.fillStyle=mountain;
      for(let i=-1;i<8;i++){const x=i*w/5-(distance*scale*.12)%(w/5);ctx.beginPath();ctx.moveTo(x,baseline);ctx.lineTo(x+w/7,h*.17+(i%2)*h*.1);ctx.lineTo(x+w/3,baseline);ctx.fill();}
      if(environment===3 || event?.name==='Nordlys' || event?.name==='Bivrost'){ctx.globalAlpha=.5;ctx.strokeStyle=event?.name==='Bivrost'?'#ffca8a':'#88efd1';ctx.lineWidth=12;ctx.beginPath();for(let i=0;i<w;i+=8)ctx.lineTo(i,h*.2+Math.sin(i/90+time)*25);ctx.stroke();ctx.globalAlpha=1;}
      ctx.fillStyle=ground;ctx.fillRect(0,baseline,w,h-baseline);
      for(let i=0;i<12;i++){const x=i*w/9-(distance*scale*.3)%(w/9);ctx.fillStyle=ground;ctx.beginPath();ctx.moveTo(x,baseline);ctx.lineTo(x+18,baseline-h*.24);ctx.lineTo(x+36,baseline);ctx.fill();}
      const px=w*.18;
      for(const o of objects){const x=px+(o.x-distance)*scale;ctx.fillStyle=o.type==='pit'?sky:'#f3cb94';if(o.type==='pit')ctx.fillRect(x,baseline,o.width*scale,h-baseline);else if(o.type==='branch'){ctx.fillRect(x,baseline-1.8*scale,o.width*scale,.9*scale);ctx.fillStyle=ground;ctx.fillRect(x+o.width*scale-3,baseline-2.8*scale,5,scale);}else ctx.fillRect(x,baseline-o.height*scale,o.width*scale,o.height*scale);}
      const foot=baseline-y*scale,ph=(y===0&&duck?.8:1.6)*scale;
      ctx.fillStyle='#e5a16e';ctx.fillRect(px-.3*scale,foot-ph,.6*scale,ph*.35);
      ctx.fillStyle='#e9ded1';ctx.fillRect(px-.35*scale,foot-ph-5,.7*scale,7);
      ctx.fillStyle='#b54b43';ctx.fillRect(px-.3*scale,foot-ph*.65,.6*scale,ph*.45);
      ctx.fillStyle='#182c32';const run=y===0?Math.sin(time*17)*4:3;ctx.fillRect(px-.25*scale,foot-ph*.2,.18*scale,ph*.2+run);ctx.fillRect(px+.08*scale,foot-ph*.2,.18*scale,ph*.2-run);
      ctx.fillStyle='#fff2db';ctx.font='14px monospace';if(event)ctx.fillText(`${time-event.start<2?'NÅ KOMMER: ':''}${event.name.toUpperCase()}`,22,30);
      if(event && ['Stjerneskudd','Meteorregn','Snøstorm','Tordenvær','Tor','Tåke','Yggdrasil','Fenrisulven','Solformørkelse','Måneformørkelse','Solnedgang','Odin','Ragnarok'].includes(event.name)) {
        ctx.save();ctx.globalAlpha=.35;ctx.strokeStyle='#fff';ctx.fillStyle='#eee';
        if(['Tåke','Solformørkelse','Måneformørkelse','Solnedgang'].includes(event.name)){ctx.fillStyle=event.name==='Tåke'?'#eee':'#493e64';ctx.fillRect(0,0,w,baseline*.8);}
        else if(['Yggdrasil','Fenrisulven','Odin'].includes(event.name)){ctx.font=`${h*.12}px serif`;ctx.fillText(event.name==='Yggdrasil'?'♠':event.name==='Fenrisulven'?'ᚠ':'ᛟ',w*.7,h*.35);}
        else for(let i=0;i<16;i++){const x=(i*71+time*22)%w,yy=(i*37+time*15)%(baseline*.7);ctx.beginPath();ctx.moveTo(x,yy);ctx.lineTo(x+8,yy+(['Tor','Tordenvær'].includes(event.name)?20:3));ctx.stroke();}
        ctx.restore();
      }
    }
  };
}
