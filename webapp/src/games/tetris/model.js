import { SevenBag, cellsOf, emptyBoard, gravityMs, kicksFor, levelOf, scoreLock } from './rules.js';

/** Pure game simulation. `initial` is an internal fixture seam, never a page setting. */
export class TetrisModel {
  constructor({ seed = 'tetris', initial = {} } = {}) {
    this.board = initial.board ? initial.board.map(row=>[...row]) : emptyBoard();
    this.bag = new SevenBag(seed); this.active = null; this.held = initial.held ?? null;
    this.score = initial.score ?? 0; this.lines = initial.lines ?? 0; this.combo = initial.combo ?? -1;
    this.backToBack = initial.backToBack ?? false; this.holdUsed = false; this.time = 0;
    this.ended = false; this.completed = true; this.reason = ''; this.phase = 'falling';
    this.clearRemaining = 0; this.lockCount = 0; this.pieceId = 0; this.lastResult = null; this.events = [];
    this.spawn(initial.active?.type,initial.active);
    this.lastRotation = initial.lastRotation ?? null;
    this.holdUsed = initial.holdUsed ?? false;
  }
  occupied(x,y) { return x<0 || x>=10 || y< -20 || y>=20 || this.board[y+20][x] !== null; }
  fits(piece) { return cellsOf(piece).every(([x,y])=>!this.occupied(x,y)); }
  grounded() { return !!this.active && !this.fits({...this.active,y:this.active.y+1}); }
  emit(type, data = {}) { this.events.push(Object.freeze({type,...data})); }
  spawn(type = this.bag.take(),position = null) {
    this.active = {type,x:3,y:-1,rotation:0,...position}; this.phase = 'falling'; this.pieceId++;
    this.fall = 0; this.groundTime = 0; this.resets = 0; this.lastRotation = null;
    this.contact = this.grounded();
    if (!this.fits(this.active)) this.end('Ingen plass til neste brikke.');
  }
  end(reason, completed = true) {
    if (this.ended) return;
    this.ended = true; this.completed = completed; this.reason = reason; this.phase = 'ended';
    this.emit('end');
  }
  resetLock(wasGrounded) { if (wasGrounded && this.resets<15) { this.resets++; this.groundTime=0; } this.contact=this.grounded(); }
  translate(dx,dy) {
    if (!this.active || this.ended) return false;
    const next={...this.active,x:this.active.x+dx,y:this.active.y+dy};
    if (!this.fits(next)) return false;
    const wasGrounded=this.grounded(); this.active=next; this.lastRotation=null;
    if (dx) this.resetLock(wasGrounded);
    return true;
  }
  rotate() {
    if (!this.active || this.ended) return false;
    const wasGrounded=this.grounded(), rotation=(this.active.rotation+1)%4;
    for (const [index,[dx,dy]] of kicksFor(this.active.type,this.active.rotation).entries()) {
      const next={...this.active,rotation,x:this.active.x+dx,y:this.active.y+dy};
      if (!this.fits(next)) continue;
      this.active=next; this.lastRotation={kick:index};
      if (next.type!=='O') this.resetLock(wasGrounded);
      this.emit('rotate'); return true;
    }
    return false;
  }
  hold() {
    if (!this.active || this.holdUsed || this.ended) return false;
    const old=this.active.type, incoming=this.held;
    this.held=old; this.holdUsed=true; this.emit('hold',{held:old}); this.spawn(incoming ?? undefined); return true;
  }
  ghost() {
    if (!this.active) return null;
    const piece={...this.active}; while (this.fits({...piece,y:piece.y+1})) piece.y++;
    return piece;
  }
  hardDrop() {
    if (!this.active || this.ended) return;
    const ghost=this.ghost(), distance=ghost.y-this.active.y;
    this.active=ghost; if (distance) this.lastRotation=null;
    this.emit('drop',{distance}); this.lock(distance);
  }
  spin(lines) {
    if (this.active.type!=='T' || !this.lastRotation) return null;
    const x=this.active.x+1,y=this.active.y+1;
    const corners=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([dx,dy])=>this.occupied(x+dx,y+dy));
    if (corners.filter(Boolean).length<3) return null;
    const fronts=[[0,1],[1,2],[2,3],[3,0]][this.active.rotation];
    return fronts.every(i=>corners[i]) || this.lastRotation.kick===4 || lines===3 ? 'full' : 'mini';
  }
  lock(dropDistance = 0) {
    const blocks=cellsOf(this.active);
    for (const [x,y] of blocks) this.board[y+20][x]=this.active.type;
    const rows=[]; for (let i=0;i<40;i++) if (this.board[i].every(Boolean)) rows.push(i-20);
    if (rows.length>4) { this.end('Ugyldig bretttilstand.',false); return; }
    const spin=this.spin(rows.length);
    this.board=this.board.filter((_,i)=>!rows.includes(i-20));
    while (this.board.length<40) this.board.unshift(Array(10).fill(null));
    const survivors=blocks.filter(([,y])=>!rows.includes(y)).map(([x,y])=>[x,y+rows.filter(row=>row>y).length]);
    const perfect=rows.length>0 && this.board.every(row=>row.every(cell=>cell===null));
    const result=scoreLock({lines:rows.length,spin,level:levelOf(this.score),combo:this.combo,backToBack:this.backToBack,perfect,dropDistance});
    if (!Number.isSafeInteger(result.total) || this.score>Number.MAX_SAFE_INTEGER-result.total) {
      this.end('Poenggrensen er nådd. Runden kan ikke rangeres.',false); return;
    }
    this.score+=result.total; this.lines+=rows.length; this.combo=result.combo; this.backToBack=result.backToBack; this.lockCount++;
    this.lastResult=Object.freeze({...result,rows:Object.freeze(rows),id:this.lockCount,at:this.time});
    this.emit('lock',{result:this.lastResult}); this.active=null;
    if (survivors.length && survivors.every(([,y])=>y<0)) { this.end('Brikkene nådde toppen.'); return; }
    this.holdUsed=false;
    if (rows.length) { this.phase='clearing'; this.clearRemaining=150; }
    else this.spawn();
  }
  step(ms, actions = {}) {
    this.events=[];
    if (this.ended) return this.events;
    this.time+=ms;
    if (this.phase==='clearing') {
      this.clearRemaining-=ms; if (this.clearRemaining<=1e-7) this.spawn();
      return this.events;
    }
    if (actions.hold) this.hold();
    if (this.ended) return this.events;
    if (actions.rotate) this.rotate();
    if (actions.move) this.translate(actions.move,0);
    if (actions.drop) { this.hardDrop(); return this.events; }
    this.fall+=ms;
    const interval=gravityMs(levelOf(this.score));
    while (this.fall+1e-7>=interval) { this.fall-=interval; if (!this.translate(0,1)) { this.fall=0; break; } }
    if (this.grounded()) {
      if (this.contact) this.groundTime+=ms; else this.groundTime=0;
      this.contact=true;
      if (this.resets>=15 || this.groundTime+1e-7>=500) this.lock();
    } else { this.contact=false; this.groundTime=0; }
    return this.events;
  }
  snapshot() {
    return { board:this.board.map(row=>[...row]), active:this.active && {...this.active}, ghost:this.ghost(),
      held:this.held, holdUsed:this.holdUsed, next:this.bag.next(), score:this.score, lines:this.lines, level:levelOf(this.score),
      combo:this.combo, backToBack:this.backToBack, time:this.time, phase:this.phase, ended:this.ended, completed:this.completed,
      reason:this.reason, lastResult:this.lastResult, pieceId:this.pieceId, resets:this.resets, groundTime:this.groundTime };
  }
}
