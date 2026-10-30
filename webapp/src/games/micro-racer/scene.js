import { RADIUS, clamp, forward } from './config.js';
import { closestTrack } from './tracks.js';
import { formatTime } from './rules.js';
const colors=['#8bf0cf','#ffaf71','#c4a5ff','#f5ce71'];
function path(ctx,points,close=true){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));if(close)ctx.closePath();}
function label(ctx,text,x,y,size=12,color='#edf2e7',align='left'){ctx.fillStyle=color;ctx.font=`bold ${size}px monospace`;ctx.textAlign=align;ctx.fillText(text,x,y);}
function panel(ctx,x,y,w,h){ctx.fillStyle='#101827e8';ctx.fillRect(x,y,w,h);ctx.strokeStyle='#65768877';ctx.lineWidth=1;ctx.strokeRect(x+.5,y+.5,w-1,h-1);}
function road(ctx,track){
  path(ctx,track.points);ctx.lineJoin='round';ctx.lineCap='round';ctx.strokeStyle='#121e28';ctx.lineWidth=track.width+4;ctx.stroke();
  ctx.strokeStyle='#d5d3ba';ctx.lineWidth=track.width+1.4;ctx.stroke();ctx.strokeStyle='#404957';ctx.lineWidth=track.width;ctx.stroke();
  ctx.setLineDash([4,7]);ctx.strokeStyle='#b2bac033';ctx.lineWidth=.12;ctx.stroke();ctx.setLineDash([]);
  for(let i=0;i<track.segments.length;i++){
    const seg=track.segments[i];if(i%2)continue;
    ctx.strokeStyle=Math.floor(seg.s/4)%2?'#eee3cb':'#d76e69';ctx.lineWidth=.7;
    for(const side of [-1,1]){const offset=side*(track.width/2+.25);ctx.beginPath();ctx.moveTo(seg.a.x-seg.ty*offset,seg.a.y+seg.tx*offset);ctx.lineTo(seg.b.x-seg.ty*offset,seg.b.y+seg.tx*offset);ctx.stroke();}
  }
  ctx.lineWidth=.6;ctx.strokeStyle=track.palette[2];ctx.globalAlpha=.75;
  for(const wall of track.walls){ctx.beginPath();ctx.moveTo(wall.a.x,wall.a.y);ctx.lineTo(wall.b.x,wall.b.y);ctx.stroke();}ctx.globalAlpha=1;
  const gate=track.gates[0];ctx.save();ctx.translate(gate.x,gate.y);ctx.rotate(Math.atan2(gate.ty,gate.tx));
  for(let a=0;a<2;a++)for(let b=0;b<Math.ceil(track.width);b++){ctx.fillStyle=(a+b)%2?'#101722':'#f6f0dd';ctx.fillRect(a*.65-.65,b-track.width/2,.65,1);}ctx.restore();
  // Small grid marks and direction chevrons make a standing start legible.
  for(const grid of track.grid){ctx.save();ctx.translate(grid.x,grid.y);ctx.rotate(grid.angle);ctx.strokeStyle='#e0dec780';ctx.lineWidth=.12;ctx.strokeRect(-1.5,-2.2,3,4.4);ctx.restore();}
  for(let i=2;i<track.gates.length;i+=3){const g=track.gates[i];ctx.save();ctx.translate(g.x,g.y);ctx.rotate(Math.atan2(g.ty,g.tx));ctx.strokeStyle='#c5d5da44';ctx.lineWidth=.25;ctx.beginPath();ctx.moveTo(-1,-1.5);ctx.lineTo(1,0);ctx.lineTo(-1,1.5);ctx.stroke();ctx.restore();}
}
function scenery(ctx,track){
  for(let i=0;i<track.points.length;i+=7){
    const p=track.points[i],seg=track.segments[i],side=i%2?1:-1,offset=side*(track.width/2+12+(i%5)*2),x=p.x-seg.ty*offset,y=p.y+seg.tx*offset;
    if(closestTrack(track,x,y).distance<track.width/2+8)continue;
    ctx.save();ctx.translate(x,y);
    if(track.id==='pine-valley'){
      ctx.fillStyle='#111e2544';ctx.beginPath();ctx.arc(1,1,3.5,0,Math.PI*2);ctx.fill();ctx.fillStyle=i%3?'#38705d':'#4c8163';ctx.beginPath();ctx.moveTo(0,-4.5);ctx.lineTo(3.2,2.5);ctx.lineTo(-3.2,2.5);ctx.closePath();ctx.fill();
    }else{
      ctx.rotate(i*.17);ctx.fillStyle='#0b17294d';ctx.fillRect(-3,-3,7,6);ctx.fillStyle=track.id==='neon-docks'?'#45465e':'#547477';ctx.fillRect(-3.5,-3.5,6,5);ctx.strokeStyle=track.palette[2];ctx.lineWidth=.25;ctx.strokeRect(-3,-3,5,4);
    }
    ctx.restore();
  }
}
function car(ctx,driver,profile,index,scale=1){
  ctx.save();ctx.translate(driver.x,driver.y);ctx.rotate(driver.angle);ctx.scale(scale,scale);
  ctx.globalAlpha=driver.finishedMs!==null?.35:1;
  ctx.fillStyle='#0007';ctx.beginPath();ctx.ellipse(.15,.4,RADIUS*1.1,2.35,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#111a24';for(const x of [-1.15,.65])for(const y of [-1.45,1.05])ctx.fillRect(x,y,.5,.8);
  const color=colors[index];ctx.fillStyle=color;
  if(profile.id==='formula'){
    ctx.fillRect(-.55,-2.15,1.1,4);ctx.fillRect(-1.35,-1.8,2.7,.45);ctx.fillRect(-1.25,1.5,2.5,.45);ctx.fillRect(-.95,-.5,1.9,1.6);
  }else{
    ctx.beginPath();ctx.moveTo(-.85,-2);ctx.lineTo(.85,-2);ctx.lineTo(1.1,1.75);ctx.lineTo(-1.1,1.75);ctx.closePath();ctx.fill();
    if(profile.id==='drift')ctx.fillRect(-1.25,1.5,2.5,.3);
  }
  ctx.fillStyle='#142b3e';ctx.fillRect(-.65,-.85,1.3,.75);ctx.fillStyle='#f6f2d5';ctx.fillRect(-.12,-1.85,.24,.9);ctx.fillRect(-.3,.25,.6,.7);
  ctx.fillStyle='#d9fbeb';ctx.fillRect(-.8,-1.9,.4,.2);ctx.fillRect(.4,-1.9,.4,.2);
  ctx.fillStyle='#142b3e';ctx.font='bold .85px monospace';ctx.textAlign='center';ctx.fillText(String(index+1),0,.88);
  ctx.restore();
}
function minimap(ctx,model,x,y,w,h){
  const track=model.track,b=track.bounds,scale=Math.min((w-14)/(b.maxX-b.minX),(h-14)/(b.maxY-b.minY));
  panel(ctx,x,y,w,h);ctx.save();ctx.translate(x+w/2,y+h/2);ctx.scale(scale,scale);ctx.translate(-(b.minX+b.maxX)/2,-(b.minY+b.maxY)/2);
  path(ctx,track.points);ctx.strokeStyle='#65798c';ctx.lineWidth=track.width;ctx.lineJoin='round';ctx.stroke();
  for(let i=model.cars.length-1;i>=0;i--){const c=model.cars[i];ctx.save();ctx.translate(c.x,c.y);ctx.scale(1/scale,1/scale);ctx.fillStyle=colors[i];
    if(i===0){ctx.save();ctx.rotate(c.angle);ctx.beginPath();ctx.moveTo(0,-4);ctx.lineTo(3,3);ctx.lineTo(-3,3);ctx.closePath();ctx.fill();ctx.restore();}
    else{ctx.beginPath();ctx.arc(0,0,3,0,Math.PI*2);ctx.fill();}
    ctx.font='bold 7px monospace';ctx.textAlign='left';ctx.fillText(String(i+1),4,2);ctx.restore();}
  ctx.restore();label(ctx,'N',x+w-7,y+12,8,'#b8c8da','right');
}
function overview(ctx,model,w,h){
  const track=model.track,b=track.bounds,compact=h<180,pad=compact?12:24,scale=Math.min((w-pad*2)/(b.maxX-b.minX),(h-(compact?24:110))/(b.maxY-b.minY));
  ctx.fillStyle=track.palette[0];ctx.fillRect(0,0,w,h);
  ctx.save();ctx.translate(w/2,h/2+5);ctx.scale(scale,scale);ctx.translate(-(b.minX+b.maxX)/2,-(b.minY+b.maxY)/2);scenery(ctx,track);road(ctx,track);
  model.cars.forEach((c,i)=>car(ctx,c,model.profile,i,Math.max(1,1.6/scale)));ctx.restore();
  if(compact)return;
  label(ctx,'MICRO RACER / CIRCUIT SELECT',18,25,Math.max(8,Math.min(11,w/32)),'#bfe9db');
  label(ctx,track.name.toUpperCase(),18,48,Math.max(13,Math.min(22,w/18)));
  label(ctx,`${Math.round(track.length)} M · ${track.width} M BREDDE`,18,h-34,10,'#c1d5d1');
  label(ctx,`${model.config.laps} ${model.config.laps===1?'RUNDE':'RUNDER'} · ${model.config.format==='race'?'KLUBBLØP / 4 BILER':'TIDSKJØRING'}`,18,h-16,10,track.palette[2]);
}
export function drawRacing(ctx,model,width,height,{preview=false,armed=false}={}){
  const bounds=ctx.canvas?.getBoundingClientRect?.(),ratio=bounds?.width?width/bounds.width:1,w=width/ratio,h=height/ratio;
  ctx.save();ctx.scale(ratio,ratio);
  if(preview){overview(ctx,model,w,h);ctx.restore();return;}
  const track=model.track,p=model.player,zoom=h/110;
  ctx.fillStyle=track.palette[0];ctx.fillRect(0,0,w,h);
  ctx.save();ctx.translate(w/2,h*.7);ctx.scale(zoom,zoom);ctx.rotate(-p.angle);ctx.translate(-p.x,-p.y);
  scenery(ctx,track);road(ctx,track);
  const next=track.gates[p.nextGate];ctx.strokeStyle='#93f5cf55';ctx.lineWidth=.45;ctx.setLineDash([1,1]);ctx.beginPath();ctx.moveTo(next.x-next.ty*next.halfWidth,next.y+next.tx*next.halfWidth);ctx.lineTo(next.x+next.ty*next.halfWidth,next.y-next.tx*next.halfWidth);ctx.stroke();ctx.setLineDash([]);
  for(let i=model.cars.length-1;i>=0;i--)car(ctx,model.cars[i],model.profile,i);ctx.restore();
  const mobile=w<560,mapW=mobile?84:128,mapH=mobile?96:124;
  panel(ctx,12,12,w-mapW-36,70);label(ctx,`${track.name.toUpperCase()} / ${model.profile.name.toUpperCase()}`,22,30,mobile?9:11,'#9acdc0');
  label(ctx,formatTime(p.finishedMs??model.elapsedMs),22,55,mobile?21:30);
  label(ctx,`${Math.min(p.laps+1,model.config.laps)} / ${model.config.laps} RUNDER${model.config.format==='race'?`  ·  P${model.livePlace}/4`:''}`,22,73,mobile?9:11,'#c7d1d9');
  minimap(ctx,model,w-mapW-12,12,mapW,mapH);
  panel(ctx,12,h-57,w-24,45);
  label(ctx,`${Math.round(Math.hypot(p.vx,p.vy)*3.6)}`,25,h-28,24,'#8bf0cf');label(ctx,'KM/T',76,h-27,9,'#aab8ca');
  label(ctx,`RUNDE ${formatTime(Math.max(0,model.elapsedMs-p.lastLapMs))}`,w-24,h-29,mobile?10:12,'#d4dfdf','right');
  const hint=p.recoverPending?'VENTER PÅ FRI BANE':p.recoverRemaining>0?'TILBAKE PÅ BANEN …':!armed?'SLIPP A/B · HOLD KONTROLLEREN RETT':p.offroad?'AVKJØRING · REDUSERT GREP':null;
  const near=closestTrack(track,p.x,p.y),f=forward(p.angle),wrong=Math.hypot(p.vx,p.vy)>2&&(f.x*near.tx+f.y*near.ty)<-.3;
  if(hint||wrong){const text=wrong?'FEIL RETNING':hint;panel(ctx,Math.max(12,w/2-180),h-100,Math.min(360,w-24),30);label(ctx,text,w/2,h-80,mobile?10:12,wrong?'#ffa5a0':'#f5ce71','center');}
  ctx.restore();
}
