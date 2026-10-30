import { clamp, forward, right, RADIUS, wrapAngle } from './config.js';
import { nearby, closestTrack } from './tracks.js';
import { advanceProgress } from './progress.js';
const EPS=1e-7;
export function updateVelocity(car,control,profile,track,h) {
  if(car.finishedMs!==null||car.recoverRemaining>0){car.vx=0;car.vy=0;return;}
  car.steer+=(clamp(control.steer??0,-1,1)-car.steer)*(1-Math.exp(-h/.08));
  const f=forward(car.angle),offroad=closestTrack(track,car.x,car.y).distance>track.width/2+.6;
  const brake=!!control.brake,throttle=!!control.throttle&&!brake;
  if(throttle){car.vx+=f.x*profile.acceleration*h;car.vy+=f.y*profile.acceleration*h;}
  let speed=Math.hypot(car.vx,car.vy);
  const resistance=(brake?profile.brake:1+.002*speed*speed)+(offroad?8+(speed>profile.topSpeed*.45?16:0):0);
  const factor=speed>0?Math.max(0,speed-resistance*h)/speed:0;car.vx*=factor;car.vy*=factor;
  const longitudinal=car.vx*f.x+car.vy*f.y;
  const delta=car.steer*.55/(1+Math.abs(longitudinal)/18);
  car.angle=wrapAngle(car.angle+clamp(longitudinal/2.6*Math.tan(delta),-2,2)*h);
  const nf=forward(car.angle),nr=right(car.angle),vl=car.vx*nf.x+car.vy*nf.y,vs=(car.vx*nr.x+car.vy*nr.y)*Math.exp(-profile.grip*(offroad?.45:1)*h);
  car.vx=nf.x*vl+nr.x*vs;car.vy=nf.y*vl+nr.y*vs;
  speed=Math.hypot(car.vx,car.vy);
  if(speed>profile.topSpeed){car.vx*=profile.topSpeed/speed;car.vy*=profile.topSpeed/speed;}
  car.offroad=offroad;
}

// Moving point against a circle, in seconds. Used for segment caps and car pairs.
export function circleImpact(px,py,vx,vy,cx,cy,radius,limit) {
  const dx=px-cx,dy=py-cy,a=vx*vx+vy*vy,b=dx*vx+dy*vy,c=dx*dx+dy*dy-radius*radius;
  if(a<EPS||b>=0)return null;
  const disc=b*b-a*c;if(disc<0)return null;
  const time=Math.max(0,(-b-Math.sqrt(disc))/a);if(time>limit+EPS)return null;
  const nx=dx+vx*time,ny=dy+vy*time,len=Math.hypot(nx,ny);
  if(len<EPS)return null;
  return {time:Math.min(time,limit),nx:nx/len,ny:ny/len};
}
export function wallImpact(car,wall,limit) {
  const dx=wall.b.x-wall.a.x,dy=wall.b.y-wall.a.y,len=Math.hypot(dx,dy),tx=dx/len,ty=dy/len,nx=-ty,ny=tx;
  const distance=(car.x-wall.a.x)*nx+(car.y-wall.a.y)*ny,vn=car.vx*nx+car.vy*ny;
  let best=null;
  for(const side of [-1,1]){
    if(vn*side>=-EPS)continue;
    const time=(side*RADIUS-distance)/vn;
    if(time< -EPS||time>limit+EPS)continue;
    const along=(car.x+car.vx*time-wall.a.x)*tx+(car.y+car.vy*time-wall.a.y)*ty;
    if(along>=0&&along<=len)best={time:Math.max(0,Math.min(time,limit)),nx:nx*side,ny:ny*side};
  }
  for(const p of [wall.a,wall.b]){const hit=circleImpact(car.x,car.y,car.vx,car.vy,p.x,p.y,RADIUS,limit);if(hit&&(!best||hit.time<best.time))best=hit;}
  return best;
}

// One shared event timeline: contacts occur before cars can tunnel through walls
// or each other. Depenetration offsets are deliberately excluded from gate tests.
export function moveCars(cars,track,h,startTime,laps) {
  let elapsed=0,contacts=0;
  const active=()=>cars.filter(car=>car.finishedMs===null);
  // Resolve existing overlap without crediting the corrective displacement as
  // driving. This also handles coincident centres in injected/recovery fixtures.
  for(let pass=0;pass<4;pass++){
    let corrected=false;const drivers=active();
    for(let i=0;i<drivers.length;i++)for(let j=i+1;j<drivers.length;j++){
      const a=drivers[i],b=drivers[j],dx=a.x-b.x,dy=a.y-b.y,d=Math.hypot(dx,dy);
      if(d>=RADIUS*2-1e-7)continue;
      const ia=a.recoverRemaining>0?0:1,ib=b.recoverRemaining>0?0:1;if(!ia&&!ib)continue;
      const nx=d>EPS?dx/d:1,ny=d>EPS?dy/d:0,amount=(RADIUS*2-d+1e-5)/(ia+ib);
      a.x+=nx*amount*ia;a.y+=ny*amount*ia;b.x-=nx*amount*ib;b.y-=ny*amount*ib;corrected=true;
    }
    for(const car of drivers)for(const index of nearby(track.wallIndex,car.x,car.y,RADIUS)){
      const wall=track.walls[index],dx=wall.b.x-wall.a.x,dy=wall.b.y-wall.a.y,len2=dx*dx+dy*dy,t=clamp(((car.x-wall.a.x)*dx+(car.y-wall.a.y)*dy)/len2,0,1);
      const px=wall.a.x+dx*t,py=wall.a.y+dy*t,d=Math.hypot(car.x-px,car.y-py);
      if(d>=RADIUS-1e-7||car.recoverRemaining>0)continue;
      const nx=d>EPS?(car.x-px)/d:-dy/Math.sqrt(len2),ny=d>EPS?(car.y-py)/d:dx/Math.sqrt(len2);
      car.x+=nx*(RADIUS-d+1e-5);car.y+=ny*(RADIUS-d+1e-5);corrected=true;
    }
    if(!corrected)break;
  }
  function move(duration){
    if(duration<=0)return;
    for(const car of active()){
      const from={x:car.x,y:car.y},to={x:car.x+car.vx*duration,y:car.y+car.vy*duration};
      const finish=advanceProgress(car,track,from,to,startTime+elapsed,duration,laps);
      const fraction=finish??1;car.x=from.x+(to.x-from.x)*fraction;car.y=from.y+(to.y-from.y)*fraction;
    }
    elapsed+=duration;
  }
  for(let pass=0;pass<4&&elapsed<h-EPS;pass++){
    const remaining=h-elapsed,drivers=active();let event=null;
    const consider=hit=>{if(hit&&(!event||hit.time<event.time-EPS))event=hit;};
    for(const car of drivers){
      if(car.recoverRemaining>0)continue;
      const reach=RADIUS+Math.hypot(car.vx,car.vy)*remaining;
      for(const index of nearby(track.wallIndex,car.x,car.y,reach)){
        const hit=wallImpact(car,track.walls[index],remaining);if(hit)consider({...hit,a:car});
      }
    }
    for(let i=0;i<drivers.length;i++)for(let j=i+1;j<drivers.length;j++){
      const a=drivers[i],b=drivers[j];
      const hit=circleImpact(a.x,a.y,a.vx-b.vx,a.vy-b.vy,b.x,b.y,RADIUS*2,remaining);
      if(hit)consider({...hit,a,b});
    }
    if(!event){move(remaining);break;}
    move(event.time);contacts++;
    const {a,b,nx,ny}=event;
    if(a.finishedMs!==null||(b&&b.finishedMs!==null))continue;
    if(b){
      const ia=a.recoverRemaining>0?0:1,ib=b.recoverRemaining>0?0:1,relative=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;
      if(ia+ib&&relative<0){const impulse=-(1+.2)*relative/(ia+ib);a.vx+=impulse*nx*ia;a.vy+=impulse*ny*ia;b.vx-=impulse*nx*ib;b.vy-=impulse*ny*ib;}
      a.x+=nx*1e-5*ia;a.y+=ny*1e-5*ia;b.x-=nx*1e-5*ib;b.y-=ny*1e-5*ib;
    }else{
      const vn=a.vx*nx+a.vy*ny;if(vn<0){a.vx-=(1+.1)*vn*nx;a.vy-=(1+.1)*vn*ny;}
      a.x+=nx*1e-5;a.y+=ny*1e-5;
    }
    a.contacts++;if(b)b.contacts++;
  }
  // The unprocessed remainder after four contact events is held in place, not
  // advanced unchecked. Its time still belongs to this fixed simulation step.
  return contacts;
}
