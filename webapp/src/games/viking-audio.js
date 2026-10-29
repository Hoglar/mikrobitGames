// Optional, quiet browser feedback. It never drives the simulation or uses micro:bit output.
export function createVikingAudio() {
  let context = null, enabled = false;
  const voices = new Set();
  function note(frequency, duration, delay = 0, wave = 'triangle', volume = .035) {
    if (!enabled || !context || context.state !== 'running') return;
    const oscillator = context.createOscillator(), gain = context.createGain();
    const start = context.currentTime + delay;
    oscillator.type = wave; oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(volume, start + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(gain); gain.connect(context.destination); voices.add(oscillator);
    oscillator.onended = () => { voices.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(start); oscillator.stop(start + duration + .02);
  }
  function dispose() {
    enabled = false;
    for (const voice of voices) { try { voice.stop(); } catch { /* already stopped */ } }
    voices.clear();
    if (context) { void context.close().catch(() => {}); context = null; }
  }
  return {
    setEnabled(value) {
      if (!value) { dispose(); return false; }
      const Audio = globalThis.AudioContext ?? globalThis.webkitAudioContext;
      if (!Audio) return false;
      try { context ??= new Audio(); enabled = true; void context.resume().catch(() => { enabled = false; }); return true; }
      catch { dispose(); return false; }
    },
    play(kind, name) {
      if (kind === 'jump') { note(220, .09); note(330, .1, .035); }
      else if (kind === 'collision') { note(110, .18, 0, 'triangle', .055); note(73, .3, .1); }
      else if (kind === 'event') {
        const tones = name === 'Ragnarok' ? [110, 147, 165] : [220, 294, 440];
        tones.forEach((frequency, i) => note(frequency, .5, i * .12, 'sine', .025));
      }
    },
    dispose
  };
}
