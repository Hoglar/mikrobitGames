import { el, field } from '../../app/dom.js';
import { tracks } from './tracks.js';
import { cars, carProfile } from './config.js';

export function createRacingSetup(variants,onChange){
  const select=(name,options)=>el('select',{'aria-label':name},options.map(([value,label])=>el('option',{value},label)));
  const track=select('Racingbane',tracks.map(t=>[t.id,t.name]));
  const format=select('Løpsformat',[['time-trial','Tidskjøring'],['race','AI-løp · 4 biler']]);
  const laps=select('Antall runder',[[1,'1 runde'],[3,'3 runder']]);
  const car=select('Bilklasse',cars.map(c=>[c.id,c.name]));
  const stats=el('div',{class:'racing-car-stats','aria-label':'Bilens egenskaper'});
  const root=el('div',{class:'racing-options'},field('Bane',track),field('Løpsformat',format),field('Runder',laps),field('Bilklasse',car));
  function renderStats(){
    const profile=carProfile(car.value);
    stats.replaceChildren(...[['Grep',profile.grip,12,`${profile.grip}/12`],['Akselerasjon',profile.acceleration,13,`${profile.acceleration} m/s²`],['Toppfart',profile.topSpeed,44,`${Math.round(profile.topSpeed*3.6)} km/t`]].map(([name,value,max,label])=>el('div',{class:'racing-stat'},el('span',{},name),el('i',{'aria-hidden':'true'},el('span',{style:`width:${value/max*100}%`})),el('b',{},label))));
  }
  for(const node of [track,format,laps,car])node.onchange=()=>{
    renderStats();const variant=variants.find(g=>g.config.track===track.value&&g.config.format===format.value&&g.config.laps===Number(laps.value)&&g.config.car===car.value);
    if(variant)onChange(variant.id);
  };
  return {root,stats,sync(config){track.value=config.track;format.value=config.format;laps.value=String(config.laps);car.value=config.car;renderStats();}};
}
