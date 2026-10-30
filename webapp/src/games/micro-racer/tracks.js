import { clamp, heading } from './config.js';

// Hand-authored closed circuits. Spline sampling and geometry are part of v1.
const definitions = [
  { id: 'harbor-ring', name: 'Havneringen', subtitle: 'Brede svinger · åpen S-kombinasjon', width: 14, palette: ['#243d42','#2b5051','#f0bd7b'],
    points: [[0,65],[0,-60],[30,-100],[105,-100],[140,-60],[140,45],[120,85],[87,79],[60,99],[20,99]] },
  { id: 'pine-valley', name: 'Furudalen', subtitle: 'Hårnåler · flytende kurver', width: 12, palette: ['#253c38','#33594b','#c6db95'],
    points: [[0,70],[0,-65],[30,-105],[90,-105],[118,-73],[95,-35],[148,0],[145,78],[115,110],[65,80],[25,110]] },
  { id: 'neon-docks', name: 'Neonhavna', subtitle: 'Sjikaner · presise bremsepunkter', width: 10, palette: ['#242a41','#32374e','#d19aee'],
    points: [[0,85],[0,-80],[28,-108],[105,-108],[130,-80],[107,-40],[142,-5],[115,33],[145,80],[115,115],[25,115]] }
];
const lerp = (a,b,t) => a+(b-a)*t;
function spline(p0,p1,p2,p3,t) {
  return [0,1].map(axis => .5 * (2*p1[axis]+(-p0[axis]+p2[axis])*t+(2*p0[axis]-5*p1[axis]+4*p2[axis]-p3[axis])*t*t+(-p0[axis]+3*p1[axis]-3*p2[axis]+p3[axis])*t*t*t));
}
function indexSegments(segments, padding = 0) {
  const grid = new Map(), size = 24;
  for (let i=0;i<segments.length;i++) {
    const {a,b}=segments[i];
    for(let x=Math.floor((Math.min(a.x,b.x)-padding)/size);x<=Math.floor((Math.max(a.x,b.x)+padding)/size);x++)
      for(let y=Math.floor((Math.min(a.y,b.y)-padding)/size);y<=Math.floor((Math.max(a.y,b.y)+padding)/size);y++) {
        const key=`${x},${y}`;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(i);
      }
  }
  return {grid,size};
}
function build(definition) {
  const raw=[],n=definition.points.length;
  for(let i=0;i<n;i++)for(let j=0;j<24;j++){
    const [x,y]=spline(definition.points[(i+n-1)%n],definition.points[i],definition.points[(i+1)%n],definition.points[(i+2)%n],j/24);raw.push({x,y});
  }
  // Put the start on the long opening straight; its tangent is northward.
  const offset=10,points=[...raw.slice(offset),...raw.slice(0,offset)];
  let length=0;
  const segments=points.map((a,i)=>{const b=points[(i+1)%points.length],len=Math.hypot(b.x-a.x,b.y-a.y),s=length;length+=len;return {a,b,len,s,tx:(b.x-a.x)/len,ty:(b.y-a.y)/len};});
  const tangents=points.map((p,i)=>{const a=points[(i+points.length-1)%points.length],b=points[(i+1)%points.length],len=Math.hypot(b.x-a.x,b.y-a.y);return {x:(b.x-a.x)/len,y:(b.y-a.y)/len};});
  const walls=[];
  for(const side of [-1,1]){
    const edge=points.map((p,i)=>({x:p.x-tangents[i].y*side*(definition.width/2+6),y:p.y+tangents[i].x*side*(definition.width/2+6)}));
    for(let i=0;i<edge.length;i++)walls.push({a:edge[i],b:edge[(i+1)%edge.length]});
  }
  const track={...definition,version:1,points,segments,length,walls,roadIndex:indexSegments(segments,definition.width/2+18),wallIndex:indexSegments(walls,3)};
  track.gates=Array.from({length:20},(_,i)=>{const p=pointAt(track,i*length/20);return {x:p.x,y:p.y,tx:p.tx,ty:p.ty,halfWidth:definition.width/2+1,s:i*length/20};});
  track.grid=Array.from({length:4},(_,i)=>{const p=pointAt(track,-4-Math.floor(i/2)*7),lane=(i%2?1:-1)*2.1;return {x:p.x-p.ty*lane,y:p.y+p.tx*lane,angle:heading(p.tx,p.ty)};});
  track.bounds={minX:Math.min(...points.map(p=>p.x))-24,maxX:Math.max(...points.map(p=>p.x))+24,minY:Math.min(...points.map(p=>p.y))-24,maxY:Math.max(...points.map(p=>p.y))+24};
  validateTrack(track);
  return track;
}
export function pointAt(track, distance) {
  const s=((distance%track.length)+track.length)%track.length;
  let low=0,high=track.segments.length-1;
  while(low<high){const mid=Math.ceil((low+high)/2);if(track.segments[mid].s<=s)low=mid;else high=mid-1;}
  const seg=track.segments[low],t=clamp((s-seg.s)/seg.len,0,1);
  return {x:lerp(seg.a.x,seg.b.x,t),y:lerp(seg.a.y,seg.b.y,t),tx:seg.tx,ty:seg.ty,s,index:low};
}
export function nearby(index,x,y,radius=1) {
  const result=new Set(),{grid,size}=index;
  for(let a=Math.floor((x-radius)/size);a<=Math.floor((x+radius)/size);a++)for(let b=Math.floor((y-radius)/size);b<=Math.floor((y+radius)/size);b++)for(const i of grid.get(`${a},${b}`)??[])result.add(i);
  return result;
}
export function closestTrack(track,x,y) {
  let best=null;const candidates=nearby(track.roadIndex,x,y);
  for(const i of candidates.size?candidates:track.segments.keys()){
    const seg=track.segments[i],t=clamp(((x-seg.a.x)*seg.tx+(y-seg.a.y)*seg.ty)/seg.len,0,1),px=seg.a.x+seg.tx*seg.len*t,py=seg.a.y+seg.ty*seg.len*t,d2=(x-px)**2+(y-py)**2;
    if(!best||d2<best.d2)best={x:px,y:py,tx:seg.tx,ty:seg.ty,s:seg.s+seg.len*t,d2,distance:Math.sqrt(d2),signed:(x-px)*-seg.ty+(y-py)*seg.tx,index:i};
  }
  return best;
}
export function validateTrack(track) {
  if(!Number.isFinite(track.length)||track.length<100||track.width<8||track.gates.length<8)throw new Error('Ugyldig racingbane.');
  for(const p of [...track.points,...track.grid])if(!Number.isFinite(p.x)||!Number.isFinite(p.y))throw new Error('Ugyldig banekoordinat.');
  for(let i=0;i<track.grid.length;i++){
    if(closestTrack(track,track.grid[i].x,track.grid[i].y).distance>track.width/2-1.2)throw new Error('Startplass utenfor banen.');
    for(let j=0;j<i;j++)if(Math.hypot(track.grid[i].x-track.grid[j].x,track.grid[i].y-track.grid[j].y)<2.4)throw new Error('Overlappende startplasser.');
  }
  return true;
}
export const tracks = Object.freeze(definitions.map(build));
export const getTrack = id => tracks.find(track=>track.id===id)??tracks[0];
