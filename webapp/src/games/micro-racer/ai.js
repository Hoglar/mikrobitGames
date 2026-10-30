import { clamp, forward, heading, wrapAngle } from './config.js';
import { closestTrack, pointAt } from './tracks.js';

export function driveAI(car,track,profile,drivers=[]) {
  const near=closestTrack(track,car.x,car.y),speed=Math.hypot(car.vx,car.vy),lookahead=5+speed*.55;
  let lane=0,targetSpeed=profile.topSpeed*.8;
  const f=forward(car.angle);
  for(const other of drivers){
    if(other===car||other.finishedMs!==null)continue;
    const dx=other.x-car.x,dy=other.y-car.y,ahead=dx*f.x+dy*f.y,side=dx*-f.y+dy*f.x;
    if(ahead>0&&ahead<14&&Math.abs(side)<3){
      lane=(car.id==='ai-2'?-1:1)*Math.min(2,track.width/2-2);
      if(ahead<5)targetSpeed=Math.min(targetSpeed,Math.hypot(other.vx,other.vy)+1);
    }
  }
  const target=pointAt(track,near.s+lookahead),x=target.x-target.ty*lane,y=target.y+target.tx*lane;
  const alpha=wrapAngle(heading(x-car.x,y-car.y)-car.angle);
  const delta=Math.atan2(2*2.6*Math.sin(alpha),lookahead);
  const steer=clamp(delta/(.55/(1+speed/18)),-1,1);
  // Look far enough ahead to brake using the real profile, including low grip.
  const lateral=profile.grip*.9;
  for(let distance=0;distance<=Math.max(30,speed*2.5);distance+=4){
    const a=pointAt(track,near.s+distance),b=pointAt(track,near.s+distance+4);
    const curvature=Math.abs(wrapAngle(heading(b.tx,b.ty)-heading(a.tx,a.ty)))/4;
    const corner=Math.min(profile.topSpeed*.8,Math.sqrt(lateral/Math.max(.001,curvature))*.8);
    targetSpeed=Math.min(targetSpeed,Math.sqrt(corner*corner+2*profile.brake*.7*Math.max(0,distance-4)));
  }
  if(Math.abs(alpha)>.7)targetSpeed=Math.min(targetSpeed,7);
  if(near.distance>track.width*.35)targetSpeed=Math.min(targetSpeed,9);
  return {steer,throttle:speed<targetSpeed-.25,brake:speed>targetSpeed+.4};
}
