import test from 'node:test';
import assert from 'node:assert/strict';
import { createVikingAudio } from '../../src/games/viking-dash/audio.js';

function audioHarness() {
  const contexts = [], timers = new Map(); let nextTimer = 0;
  const parameter = () => ({
    value: 0, events: [],
    setValueAtTime(...values) { this.events.push(['set', ...values]); },
    linearRampToValueAtTime(...values) { this.events.push(['linear', ...values]); },
    exponentialRampToValueAtTime(...values) { this.events.push(['exponential', ...values]); }
  });
  function createContext() {
    const context = {
      currentTime: 0, sampleRate: 8000, state: 'suspended', sources: [], destination: {}, closes: 0,
      resume() { this.state = 'running'; this.onstatechange?.(); return Promise.resolve(); },
      close() { this.state = 'closed'; this.closes++; return Promise.resolve(); },
      createGain() { return { gain: parameter(), connect() {}, disconnect() {} }; },
      createBiquadFilter() { return { frequency: parameter(), connect() {}, disconnect() {} }; },
      createBuffer(channels, length) { return { getChannelData: () => new Float32Array(length) }; },
      source(kind) {
        const source = {
          kind, frequency: parameter(), disconnected: false, finished: false,
          connect() {}, disconnect() { this.disconnected = true; },
          start(at) { this.startedAt = at; },
          stop(at = context.currentTime) {
            this.stoppedAt = at;
            if (at <= context.currentTime && !this.finished) { this.finished = true; this.onended?.(); }
          }
        };
        this.sources.push(source); return source;
      },
      createOscillator() { return this.source('oscillator'); },
      createBufferSource() { return this.source('noise'); }
    };
    contexts.push(context); return context;
  }
  const audio = createVikingAudio({
    createContext,
    scheduleInterval(callback) { const id = ++nextTimer; timers.set(id, callback); return id; },
    cancelInterval(id) { timers.delete(id); }
  });
  function advance(seconds) {
    let maxActive = 0;
    for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += .06) {
      for (const context of contexts) if (context.state !== 'closed') {
        context.currentTime += Math.min(.06, seconds - elapsed);
        for (const source of context.sources) if (!source.finished && source.stoppedAt <= context.currentTime) {
          source.finished = true; source.onended?.();
        }
      }
      for (const callback of [...timers.values()]) callback();
      for (const context of contexts) maxActive = Math.max(maxActive, context.sources.filter(source => !source.finished).length);
    }
    return maxActive;
  }
  return { audio, contexts, timers, advance, createContext };
}

test('Viking audio is opt-in and the soundtrack includes melody, bass and percussion over a complete loop', () => {
  const h = audioHarness();
  h.audio.setPlaying(true); h.audio.play('jump');
  assert.equal(h.contexts.length, 0); assert.equal(h.timers.size, 0);
  assert.equal(h.audio.setEnabled(true), true);
  assert.equal(h.timers.size, 1);
  const maxVoices = h.advance(32), sources = h.contexts[0].sources;
  assert.ok(sources.length > 150, 'music must continue beyond a short event jingle');
  assert.ok(sources.some(source => source.kind === 'noise'), 'soundtrack includes percussion');
  assert.ok(sources.some(source => source.kind === 'oscillator' && source.frequency.events.some(event => event[1] < 100)), 'soundtrack includes bass');
  assert.ok(sources.some(source => source.kind === 'oscillator' && source.frequency.events.some(event => event[1] > 400)), 'soundtrack includes melody');
  assert.ok(maxVoices <= 40); h.audio.dispose();
});

test('pause stops scheduled music, resume creates only one scheduler, and mute/dispose releases every source', () => {
  const h = audioHarness(); h.audio.setEnabled(true); h.audio.setPlaying(true); h.advance(1);
  h.audio.setPlaying(false);
  assert.equal(h.timers.size, 0);
  assert.ok(h.contexts[0].sources.every(source => source.disconnected));
  const pausedCount = h.contexts[0].sources.length; h.advance(2);
  assert.equal(h.contexts[0].sources.length, pausedCount);
  h.audio.setPlaying(true); h.audio.setPlaying(true);
  assert.equal(h.timers.size, 1); assert.ok(h.contexts[0].sources.length > pausedCount);
  h.audio.setEnabled(false);
  assert.equal(h.timers.size, 0); assert.equal(h.contexts[0].closes, 1);
  assert.ok(h.contexts[0].sources.every(source => source.disconnected));
  h.audio.setEnabled(true); assert.equal(h.contexts.length, 2); assert.equal(h.timers.size, 1);
  h.audio.dispose(); h.audio.dispose();
  assert.equal(h.contexts[1].closes, 1); assert.equal(h.timers.size, 0);
});

test('action cues are distinct and collision stops the soundtrack while its ending cue can finish', () => {
  const h = audioHarness(); h.audio.setEnabled(true); h.audio.setPlaying(true);
  const context = h.contexts[0], signatures = [];
  for (const kind of ['jump', 'land', 'duck']) {
    const start = context.sources.length; h.audio.play(kind);
    signatures.push(context.sources.slice(start).map(source => source.frequency.events));
    h.advance(.3);
  }
  assert.notDeepEqual(signatures[0], signatures[1]); assert.notDeepEqual(signatures[1], signatures[2]);
  h.audio.play('event', 'Tor'); assert.ok(context.sources.some(source => source.kind === 'noise'));
  h.audio.play('collision'); h.audio.setPlaying(false);
  assert.equal(h.timers.size, 0);
  assert.ok(context.sources.some(source => !source.finished && !source.disconnected), 'final collision cue survives the result transition');
  h.advance(1); assert.ok(context.sources.every(source => source.disconnected)); h.audio.dispose();
});

test('sound effects remain bounded and an old resume promise cannot restart disposed audio', async () => {
  const h = audioHarness(); h.audio.setEnabled(true);
  for (let i = 0; i < 200; i++) h.audio.play('jump');
  assert.ok(h.contexts[0].sources.length <= 40); h.audio.dispose();

  let resume;
  const context = h.createContext(); context.resume = () => new Promise(resolve => { resume = resolve; });
  const pending = createVikingAudio({
    createContext: () => context,
    scheduleInterval(callback) { h.timers.set(99, callback); return 99; },
    cancelInterval(id) { h.timers.delete(id); }
  });
  pending.setPlaying(true); pending.setEnabled(true); pending.dispose();
  resume(); await Promise.resolve(); await Promise.resolve();
  assert.equal(h.timers.size, 0); assert.equal(pending.enabled, false); assert.equal(context.state, 'closed');
});

test('unavailable or denied audio stays disabled without an unhandled resume rejection', async () => {
  const missing = createVikingAudio({ createContext: () => null });
  missing.setPlaying(true); assert.equal(missing.setEnabled(true), false); missing.dispose();

  const h = audioHarness(), context = h.createContext();
  context.resume = () => Promise.reject(new Error('Audio denied'));
  const denied = createVikingAudio({ createContext: () => context });
  denied.setEnabled(true); await Promise.resolve(); await Promise.resolve();
  assert.equal(denied.enabled, false); assert.equal(context.state, 'closed');
});
