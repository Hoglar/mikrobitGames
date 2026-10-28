import { LIMITS } from './protocol/constants.js';
import { LineFramer } from './protocol/line-framer.js';
import { encodeAction, parseObject, parseResult, validateDeviceInfo, validateSnapshot } from './protocol/messages.js';
import { InputState, unavailable } from './inputs/state.js';
import { CommandQueue } from './outputs/commands.js';
import { PacedWriter } from './transport/paced-writer.js';
import { WebSerialTransport } from './transport/web-serial.js';
import { createSession } from './sessions.js';
import { asError, deferred, error, freeze, systemClock, within } from './errors.js';

/**
 * Internal construction seam for isolated clocks/transports. Games import the
 * page singleton from index.js and never construct or operate a serial port.
 */
export function createAdapter(options = {}) { return new Adapter(options); }

class Adapter {
  constructor({ clock = systemClock, serial = () => globalThis.navigator?.serial,
    secureContext = () => globalThis.isSecureContext === true,
    transportFactory = port => new WebSerialTransport(port), diagnostic = () => {} } = {}) {
    Object.assign(this, { clock, serial, secureContext, transportFactory, diagnostic });
    this.state = unavailable(); this.metadata = null; this.input = new InputState();
    this.context = null; this.game = null; this.epoch = 0; this.chooser = null;
    this.errors = new Set(); this.closures = new Set(); this.disconnecting = false;
    this.disconnectOperation = null;
  }
  get capabilities() { return this.metadata?.capabilities ?? null; }
  getState() { this.ensureFresh(); return this.state; }
  onError(callback) {
    if (typeof callback !== 'function') throw error('validation', 'onError requires a callback');
    const item = { callback }; this.errors.add(item);
    return () => this.errors.delete(item);
  }
  report(failure) {
    for (const item of [...this.errors]) if (this.errors.has(item)) {
      try { item.callback(failure); } catch { /* Error handlers cannot recursively break the adapter. */ }
    }
  }
  note(name, details) { try { this.diagnostic(name, details); } catch { /* Diagnostics have no protocol authority. */ } }
  callbackError(cause) { this.report(error('callback', 'Input callback threw', { cause })); }
  current(ctx) { return this.context === ctx && ctx.active; }
  ready(ctx = this.context) { return !!ctx && this.current(ctx) && ctx.phase === 'ready'; }
  publish(state, events = null) {
    this.state = state;
    const game = this.game;
    if (!game || game.closed) return;
    game.deliver('state', state, state);
    if (events) {
      for (const press of events.presses) game.deliver('press', press, state);
      if (events.gesture) game.deliver('gesture', events.gesture, state);
    }
  }
  notificationCurrent(game, state) {
    this.ensureFresh();
    return this.game === game && !game.closed && this.state === state;
  }
  ensureFresh() {
    const ctx = this.context;
    if (this.ready(ctx) && !this.disconnecting && this.clock.now() - ctx.lastAccepted >= LIMITS.freshnessMs)
      this.recover(ctx, error('timeout', 'Sensor input became stale'));
  }
  connect() {
    this.ensureFresh();
    if (this.disconnecting || this.closures.size) return Promise.reject(error('connection', 'Serial resources are still closing'));
    if (this.ready()) return Promise.resolve();
    if (this.context) return this.context.boot.promise;
    if (this.chooser) return Promise.reject(error('connection', 'A native port chooser is still outstanding'));
    let serial;
    try {
      serial = this.serial();
      if (!this.secureContext() || !serial?.requestPort) throw error('connection', 'Web Serial requires a supported secure-context browser');
    } catch (cause) { const failure = asError(cause); this.report(failure); return Promise.reject(failure); }
    const ctx = { epoch: ++this.epoch, active: true, phase: 'choosing', boot: deferred(),
      transport: null, handshake: null, freshTimer: null, release: null };
    this.context = ctx; this.input.reset(); this.metadata = null;
    this.publish(unavailable('connecting'));
    if (!this.current(ctx)) return ctx.boot.promise;
    let choice;
    try { choice = Promise.resolve(serial.requestPort()); } // Must run in the user gesture, before awaiting anything.
    catch (cause) { this.lose(ctx, asError(cause)); return ctx.boot.promise; }
    this.chooser = choice;
    choice.then(port => {
      if (this.chooser === choice) this.chooser = null;
      if (this.current(ctx)) return this.open(ctx, port, serial);
    }, cause => {
      if (this.chooser === choice) this.chooser = null;
      if (this.current(ctx)) this.lose(ctx, asError(cause));
    }).catch(cause => { if (this.current(ctx)) this.lose(ctx, asError(cause)); });
    return ctx.boot.promise;
  }
  async open(ctx, port, serial) {
    if (!this.current(ctx)) return;
    ctx.phase = 'opening'; ctx.transport = this.transportFactory(port);
    const removed = () => { if (this.current(ctx)) this.lose(ctx, error('connection', 'Serial device was removed', { fatal: true })); };
    ctx.offDisconnect = ctx.transport.onDisconnect(removed);
    ctx.serialDisconnect = event => { if (event.target === port || event.port === port) removed(); };
    serial.addEventListener?.('disconnect', ctx.serialDisconnect);
    ctx.offSerial = () => serial.removeEventListener?.('disconnect', ctx.serialDisconnect);
    try {
      await within(ctx.transport.open(), this.clock, LIMITS.operationMs, 'Port open');
      if (!this.current(ctx)) return;
      ctx.writer = new PacedWriter(ctx.transport, this.clock);
      ctx.commands = new CommandQueue({ writer: ctx.writer, clock: this.clock,
        ready: (owner, internal) => this.ready(ctx) && (internal || (!this.disconnecting && owner === this.game && !owner.closed)),
        report: failure => this.report(failure), recover: failure => {
          if (failure.fatal || this.disconnecting) this.lose(ctx, failure); else this.recover(ctx, failure);
        } });
      ctx.framer = new LineFramer(line => this.line(ctx, line), failure => {
        if (this.current(ctx)) { this.note('invalid-line', failure); this.report(failure); }
      });
      this.handshake(ctx, false);
      ctx.reader = this.read(ctx);
    } catch (cause) { if (this.current(ctx)) this.lose(ctx, asError(cause)); }
  }
  async read(ctx) {
    while (this.current(ctx)) {
      try {
        const { value, done } = await ctx.transport.read();
        if (!this.current(ctx)) return;
        if (done) { this.lose(ctx, error('connection', 'Serial stream ended', { fatal: true })); return; }
        this.ensureFresh();
        if (this.current(ctx) && value) ctx.framer.push(value);
      } catch (cause) {
        if (!this.current(ctx)) return;
        if (!this.ready(ctx) || this.disconnecting) { this.lose(ctx, asError(cause)); return; }
        await this.recover(ctx, asError(cause), true);
      }
    }
  }
  handshake(ctx, recovery) {
    if (!this.current(ctx)) return;
    ctx.phase = 'awaiting-info'; ctx.framer.reset();
    const h = { recovery, listen: false, info: false, written: false, latest: null, timer: null, done: deferred() };
    h.done.promise.catch(() => {}); // Recovery may have no connect/dispose caller waiting on it.
    ctx.handshake = h;
    const valid = () => this.current(ctx) && ctx.handshake === h && !this.disconnecting;
    ctx.writer.hello(valid, () => { h.listen = true; }).then(() => {
      if (!valid()) return;
      h.written = true; h.completedAt = this.clock.now();
      if (h.latest) this.becomeReady(ctx, h);
      else {
        const tick = () => {
          if (!valid() || this.ready(ctx)) return;
          const left = LIMITS.handshakeMs - (this.clock.now() - h.completedAt);
          if (left > 0) h.timer = this.clock.setTimeout(tick, left);
          else this.lose(ctx, error('timeout', 'deviceInfo and first snapshot did not arrive before the handshake deadline'));
        };
        h.timer = this.clock.setTimeout(tick, LIMITS.handshakeMs);
      }
    }, cause => { if (valid()) this.lose(ctx, asError(cause)); });
  }
  becomeReady(ctx, h) {
    if (!this.current(ctx) || ctx.handshake !== h || !h.written || !h.latest) return;
    this.clock.clearTimeout(h.timer); ctx.phase = 'ready'; ctx.commands.reset();
    this.publish(h.latest.state);
    if (!this.ready(ctx) || ctx.handshake !== h || this.disconnecting) return;
    ctx.boot.resolve(); h.done.resolve(); this.armFresh(ctx);
  }
  armFresh(ctx) {
    this.clock.clearTimeout(ctx.freshTimer);
    if (!this.ready(ctx) || this.disconnecting) return;
    ctx.freshTimer = this.clock.setTimeout(() => {
      if (!this.ready(ctx) || this.disconnecting) return;
      this.ensureFresh();
      if (this.ready(ctx)) this.armFresh(ctx);
    }, Math.max(0, LIMITS.freshnessMs - (this.clock.now() - ctx.lastAccepted)));
  }
  recover(ctx, failure, replaceReader = false) {
    if (!this.current(ctx)) return Promise.resolve();
    if (!this.ready(ctx) || this.disconnecting) { this.lose(ctx, failure); return Promise.resolve(); }
    ctx.phase = 'recovering'; this.clock.clearTimeout(ctx.freshTimer);
    ctx.commands.invalidate(failure); ctx.framer.reset(); this.input.reset();
    // A retained game's readiness callback can itself block until input is
    // stale. Settle that superseded startup before replacing its operation.
    ctx.boot.reject(failure); ctx.handshake?.done.reject(failure);
    ctx.boot = deferred(); ctx.boot.promise.catch(() => {});
    this.publish(unavailable('connecting', this.metadata?.board ?? null));
    this.report(failure); this.note('recovery', failure);
    if (!this.current(ctx) || this.disconnecting) return Promise.resolve();
    if (!replaceReader) { this.handshake(ctx, true); return Promise.resolve(); }
    return within(ctx.transport.replaceReader(), this.clock, LIMITS.operationMs, 'Reader replacement').then(usable => {
      if (!this.current(ctx)) return;
      if (!usable) this.lose(ctx, error('connection', 'Serial readable stream could not be recreated', { fatal: true }));
      else this.handshake(ctx, true);
    }, cause => { if (this.current(ctx)) this.lose(ctx, asError(cause)); });
  }
  line(ctx, line) {
    if (!this.current(ctx)) return;
    this.ensureFresh();
    if (!this.current(ctx)) return;
    this.note('line', line);
    try {
      if (line.startsWith('R|')) {
        if (this.ready(ctx)) ctx.commands.handle(parseResult(line));
        return;
      }
      if (line.startsWith('ERR|')) {
        const protocolCode = line.slice(4);
        if (!/^[A-Z][A-Z0-9_]*$/.test(protocolCode)) throw error('protocol', 'Malformed device error');
        const failure = error('protocol', `Uncorrelated device error: ${protocolCode}`, { protocolCode });
        if (this.ready(ctx) && !this.disconnecting) this.recover(ctx, failure);
        else if (ctx.handshake?.recovery && !ctx.handshake.info && protocolCode !== 'UNSUPPORTED_VERSION') this.report(failure);
        else this.lose(ctx, failure);
        return;
      }
      if (this.disconnecting) return; // Only outstanding results participate in explicit cleanup.
      const obj = parseObject(line);
      if (obj.type === 'deviceInfo') {
        if (this.ready(ctx)) { this.recover(ctx, error('protocol', 'Unexpected deviceInfo session barrier')); return; }
        const h = ctx.handshake;
        if (!h?.listen) return;
        if (h.info) throw error('protocol', 'Duplicate deviceInfo during startup');
        this.metadata = validateDeviceInfo(obj); h.info = true; ctx.phase = 'awaiting-snapshot';
        this.input.reset();
        this.publish(unavailable('connecting', this.metadata.board));
        return;
      }
      if (!this.ready(ctx) && !ctx.handshake?.info) return;
      const result = this.input.accept(validateSnapshot(obj));
      if (result.status === 'recover') {
        if (this.ready(ctx)) this.recover(ctx, error('protocol', 'Invalid forward device timestamp'));
        else throw error('protocol', 'Invalid device timestamp during startup');
        return;
      }
      if (result.status !== 'accepted') {
        this.note(result.status, obj);
        if (result.status === 'invalid') this.report(error('protocol', 'Invalid cumulative press counter delta'));
        return;
      }
      ctx.lastAccepted = this.clock.now();
      if (result.gaps) { this.note('gap', result.gaps); this.report(error('protocol', 'Snapshot sequence gap', { gapCount: result.gaps })); }
      if (this.ready(ctx)) { this.publish(result.state, result); this.armFresh(ctx); }
      else { ctx.handshake.latest = result; if (ctx.handshake.written) this.becomeReady(ctx, ctx.handshake); }
    } catch (cause) {
      const failure = asError(cause, 'protocol');
      let info = false;
      try { info = JSON.parse(line)?.type === 'deviceInfo'; } catch { /* Diagnostic classification only. */ }
      if (!this.ready(ctx) && ctx.handshake?.listen && info) this.lose(ctx, failure);
      else { this.note('invalid-message', failure); this.report(failure); }
    }
  }
  createGameSession() {
    this.ensureFresh();
    if (!this.ready() || this.disconnecting) throw error('connection', 'A ready input connection is required');
    if (this.game) throw error('disposed', 'Finish disposing the previous game before creating another');
    this.input.resetGame();
    if (this.state.accelerometer?.gesture) this.state = freeze({ ...this.state, accelerometer: { ...this.state.accelerometer, gesture: null } });
    this.game = createSession(this);
    return this.game.facade;
  }
  output(game, action, argument) {
    this.ensureFresh();
    if (game.closed || this.game !== game) return Promise.reject(error('disposed', 'Game session was disposed'));
    if (!this.ready() || this.disconnecting) return Promise.reject(error('connection', 'Input connection is not ready'));
    try { return this.context.commands.submit(encodeAction(action, argument, this.capabilities), game); }
    catch (cause) { const failure = asError(cause, 'validation'); this.report(failure); return Promise.reject(failure); }
  }
  cleanup(ctx) {
    return ctx.commands.submit('S|STOP', null, true).then(() => {
      if (!this.ready(ctx)) throw error('connection', 'Connection was lost during output cleanup');
      return ctx.commands.submit('D|CLEAR', null, true);
    });
  }
  disposeSession(game) {
    if (game.operation) return game.operation;
    const d = deferred(); game.operation = d.promise;
    game.clear();
    const ctx = this.context;
    const drain = ctx?.commands?.cancelOwner(game) ?? Promise.resolve();
    (async () => {
      try {
        await drain;
        if (ctx) {
          if (!this.current(ctx)) throw error('connection', 'Connection was lost during game disposal');
          if (!this.ready(ctx)) await ctx.handshake?.done.promise;
          if (!this.ready(ctx)) throw error('connection', 'Connection is unavailable during game disposal');
          await this.cleanup(ctx);
        }
        d.resolve();
      } catch (cause) {
        const failure = asError(cause);
        if (ctx && this.current(ctx)) { this.lose(ctx, failure); try { await this.release(ctx); } catch { /* Original cleanup failure wins. */ } }
        d.reject(failure);
      } finally { if (this.game === game) this.game = null; }
    })();
    return d.promise;
  }
  retire(ctx, failure) {
    if (!this.current(ctx)) return;
    ctx.active = false; this.context = null;
    this.clock.clearTimeout(ctx.freshTimer); this.clock.clearTimeout(ctx.handshake?.timer);
    ctx.commands?.invalidate(failure); ctx.boot.reject(failure); ctx.handshake?.done.reject(failure);
    ctx.framer?.reset(); ctx.offDisconnect?.(); ctx.offSerial?.();
    this.input.reset(); this.metadata = null; this.publish(unavailable());
  }
  lose(ctx, failure) {
    if (!this.current(ctx)) return;
    this.retire(ctx, failure); this.report(failure);
    this.release(ctx).catch(cause => this.report(asError(cause)));
  }
  release(ctx) {
    if (!ctx.transport) return Promise.resolve();
    if (!ctx.release) {
      const raw = Promise.resolve().then(() => ctx.transport.close());
      this.closures.add(raw);
      raw.then(() => this.closures.delete(raw), () => this.closures.delete(raw));
      ctx.release = within(raw, this.clock, LIMITS.operationMs, 'Serial resource cleanup');
    }
    return ctx.release;
  }
  disconnect() {
    if (this.disconnectOperation) return this.disconnectOperation;
    const d = deferred(); this.disconnectOperation = d.promise; this.disconnecting = true;
    const ctx = this.context, game = this.game, wasReady = this.ready(ctx);
    this.clock.clearTimeout(ctx?.freshTimer);
    this.publish(unavailable());
    if (ctx && !wasReady) this.retire(ctx, error('connection', 'Connection was canceled'));
    (async () => {
      let failure;
      try {
        if (game) {
          if (wasReady) await this.disposeSession(game);
          else { game.clear(); if (this.game === game) this.game = null; }
        } else if (wasReady) await this.cleanup(ctx);
      } catch (cause) { failure = asError(cause); }
      finally {
        if (ctx) {
          this.retire(ctx, failure ?? error('connection', 'Disconnected'));
          try { await this.release(ctx); } catch (cause) { failure ??= asError(cause); }
        } else if (this.closures.size) {
          // A prior fatal transport loss may still own pending native locks.
          try { await within(Promise.all([...this.closures]), this.clock, LIMITS.operationMs, 'Outstanding serial resource cleanup'); }
          catch (cause) { failure ??= asError(cause); }
        }
        this.metadata = null; this.input.reset(); this.state = unavailable();
        this.disconnecting = false; this.disconnectOperation = null;
        if (failure) { this.report(failure); d.reject(failure); } else d.resolve();
      }
    })();
    return d.promise;
  }
}
