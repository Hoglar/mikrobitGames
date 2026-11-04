/** Declare a game. The site supplies the context; importing this module has no side effects. */
export function defineGame(factory,{stepHz=60}={}){if(typeof factory!=='function'||![30,60,120].includes(stepHz))throw new TypeError('Ugyldig spilldefinisjon.');return Object.freeze({factory,stepHz});}

/** Compatibility utility for the bundled engines. New games can just use defineGame. */
export function adaptEngine(ctx,create,{audio,settings,logoPause=false,recovery=false,decorate=()=>{},score=ctx.scores.decode}={}){
  const {input,device,round,ui,scores}=ctx;
  const engine=create({seed:round.seed,config:round.config,outputs:device,browserAudio:audio,reportOutputError:e=>ui.setStatus(e.message)});
  let finished=false;
  const off=input.subscribe(s=>engine.input?.(s));
  const press=input.onPress(e=>{if(logoPause&&e.input==='logo'){round.requestPause();return;}engine.press?.(e);});
  const gesture=input.onGesture(g=>engine.gesture?.(g));
  if(settings)settings(ctx,engine);
  if(recovery)ui.addPauseAction({id:'recover',label:'Tilbake til banen',confirmText:'Flytte bilen til siste sikre punkt?',resumeAfter:true},()=>engine.requestRecovery());
  function stop(){engine.setPlaying?.(false);engine.releaseControls?.();audio?.stop?.();}
  decorate(ctx,engine);
  return {update(dt){engine.tick(dt);ui.setStatus(engine.accessibleStatus??engine.label);if(engine.ended&&!finished){finished=true;engine.finishRound?.();const value=engine.value;void scores.finish({status:engine.completed===false?'incomplete':'completed',score:value===null?null:score(value,engine),resultText:engine.resultText}).catch(e=>ui.setStatus(e.message));}},render(c){c.save();c.setTransform(1,0,0,1,0,0);engine.draw(c,ctx.canvas.width,ctx.canvas.height);c.restore();},onPause:stop,onResume(){engine.setPlaying?.(true);},dispose(){stop();off();press();gesture();engine.dispose?.();audio?.dispose?.();}};
}
