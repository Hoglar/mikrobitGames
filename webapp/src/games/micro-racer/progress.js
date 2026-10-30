import { heading } from './config.js';
export function gateIntersection(gate,from,to) {
  const a=(from.x-gate.x)*gate.tx+(from.y-gate.y)*gate.ty,b=(to.x-gate.x)*gate.tx+(to.y-gate.y)*gate.ty;
  if(a>=-1e-7||b<0||b-a<1e-9)return null;
  const t=-a/(b-a),x=from.x+(to.x-from.x)*t,y=from.y+(to.y-from.y)*t;
  return Math.abs((x-gate.x)*-gate.ty+(y-gate.y)*gate.tx)<=gate.halfWidth?t:null;
}
export function advanceProgress(car,track,from,to,startTime,duration,laps) {
  if(car.finishedMs!==null)return;
  const crossings=track.gates.map((gate,index)=>({index,t:gateIntersection(gate,from,to)})).filter(hit=>hit.t!==null).sort((a,b)=>a.t-b.t||a.index-b.index);
  for(const hit of crossings){
    if(hit.index!==car.nextGate)continue;
    const gate=track.gates[hit.index];
    car.safe={x:gate.x+gate.tx*3,y:gate.y+gate.ty*3,angle:heading(gate.tx,gate.ty)};
    car.gatesPassed++;
    if(hit.index===0){
      if(car.started){
        car.laps++;const total=Math.max(1,Math.ceil((startTime+duration*hit.t)*1000-1e-7));
        car.splits.push(total-car.lastLapMs);car.lastLapMs=total;
        if(car.laps===laps){car.finishedMs=total;car.vx=0;car.vy=0;return hit.t;}
      }else car.started=true;
    }
    car.nextGate=(car.nextGate+1)%track.gates.length;
  }
}
