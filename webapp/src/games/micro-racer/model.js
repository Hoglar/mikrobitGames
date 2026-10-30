import { carProfile, cars as profiles, STEP, LIMIT_MS, RADIUS } from './config.js';
import { getTrack, tracks, closestTrack } from './tracks.js';
import { updateVelocity, moveCars } from './physics.js';
import { driveAI } from './ai.js';
import { encodeRace, finishingPlace } from './rules.js';

function driver(id,spawn){return {id,...spawn,vx:0,vy:0,steer:0,offroad:false,started:false,nextGate:0,gatesPassed:0,laps:0,splits:[],lastLapMs:0,finishedMs:null,safe:{...spawn},recoverPending:false,recoverRemaining:0,stuck:0,contacts:0,control:{steer:0,throttle:false,brake:false}};}
export class RaceModel {
  constructor(config={}){
    if(config.track!==undefined&&!tracks.some(track=>track.id===config.track)||config.car!==undefined&&!profiles.some(car=>car.id===config.car)||config.format!==undefined&&!['race','time-trial'].includes(config.format)||config.laps!==undefined&&![1,3].includes(config.laps)||config.trackVersion!==undefined&&config.trackVersion!==1||config.profile!==undefined&&config.profile!=='micro-racer-v1')throw new RangeError('Ukjent racingvariant eller regelprofil.');
    this.track=getTrack(config.track);this.profile=carProfile(config.car);
    this.config=Object.freeze({track:this.track.id,trackVersion:1,format:config.format==='race'?'race':'time-trial',laps:config.laps===3?3:1,car:this.profile.id,profile:'micro-racer-v1'});
    this.cars=this.config.format==='race'?[driver('player',this.track.grid[3]),...this.track.grid.slice(0,3).map((spawn,i)=>driver(`ai-${i+1}`,spawn))]:[driver('player',this.track.grid[0])];
    this.ticks=0;this.ended=false;this.completed=false;this.value=null;this.place=null;this.reason='';this.maxContacts=0;
  }
  get player(){return this.cars[0];}
  get seconds(){return this.ticks*STEP;}
  get elapsedMs(){return Math.min(LIMIT_MS,Math.floor(this.seconds*1000+1e-7));}
  get livePlace(){
    const p=this.player,progress=car=>car.gatesPassed+(closestTrack(this.track,car.x,car.y).s/(this.track.length/this.track.gates.length))%1;
    return 1+this.cars.slice(1).filter(car=>car.finishedMs!==null||progress(car)>progress(p)).length;
  }
  requestRecovery(car=this.player){if(!this.ended&&car.finishedMs===null&&!car.recoverPending&&car.recoverRemaining<=0){car.recoverPending=true;car.vx=0;car.vy=0;car.steer=0;}}
  recover(car){
    if(car.recoverPending){
      const point=car.safe;
      if(this.cars.some(other=>other!==car&&other.finishedMs===null&&Math.hypot(other.x-point.x,other.y-point.y)<RADIUS*2+.5))return;
      car.x=point.x;car.y=point.y;car.angle=point.angle;car.vx=0;car.vy=0;car.steer=0;car.recoverPending=false;car.recoverRemaining=2;car.stuck=0;
    }
  }
  step(control={}){
    if(this.ended)return;
    const before=this.seconds;
    for(const car of this.cars){
      if(car.finishedMs!==null)continue;
      this.recover(car);
      if(car.id!=='player'&&this.ticks%6===0)car.control=driveAI(car,this.track,this.profile,this.cars);
      const input=car===this.player?control:car.control;
      updateVelocity(car,car.recoverPending?{}:input,this.profile,this.track,STEP);
    }
    this.maxContacts=Math.max(this.maxContacts,moveCars(this.cars,this.track,STEP,before,this.config.laps));
    for(const car of this.cars){
      if(car.recoverRemaining>0)car.recoverRemaining=Math.max(0,car.recoverRemaining-STEP);
      if(car.id!=='player'&&car.finishedMs===null){
        car.stuck=Math.hypot(car.vx,car.vy)<1?car.stuck+STEP:0;
        if(car.stuck>4)this.requestRecovery(car);
      }
      if(![car.x,car.y,car.vx,car.vy,car.angle].every(Number.isFinite)){this.ended=true;this.reason='Ugyldig fysikktilstand.';return;}
    }
    this.ticks++;
    if(this.player.finishedMs!==null&&this.player.finishedMs<=LIMIT_MS){
      this.ended=true;this.completed=true;this.place=finishingPlace(this.player,this.cars);
      this.value=this.config.format==='race'?encodeRace(this.place,this.player.finishedMs):this.player.finishedMs;
    }else if(this.elapsedMs>=LIMIT_MS){this.ended=true;this.reason='Tiden er ute. Løpet er ikke fullført.';}
  }
  snapshot(){return {config:{...this.config},cars:this.cars.map(car=>({...car,safe:{...car.safe},splits:[...car.splits],control:{...car.control}})),time:this.elapsedMs,ended:this.ended,completed:this.completed,value:this.value,place:this.place,livePlace:this.livePlace,reason:this.reason};}
}
