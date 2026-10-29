// Browser-only soundtrack and feedback. Audio never advances the game or its RNG.
const EIGHTH = 60 / 132 / 2;
const MAX_VOICES = 40;
const melody = [
  62, 65, 69, 67, 65, 62, 60, 62, 65, 69, 74, 72, 69, 67, 65, null,
  62, 65, 69, 72, 74, 72, 69, 67, 65, 67, 69, 65, 62, null, 60, 62,
  58, 62, 65, 69, 70, 69, 65, 62, 65, 69, 70, 74, 72, 70, 69, null,
  60, 64, 67, 69, 72, 69, 67, 64, 62, 65, 69, 67, 65, 62, 60, null
];
const bassRoots = [38, 38, 34, 36];
const hz = midi => 440 * 2 ** ((midi - 69) / 12);

export function createVikingAudio({
  createContext = () => {
    const Audio = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    return Audio ? new Audio() : null;
  },
  scheduleInterval = (callback, ms) => globalThis.setInterval(callback, ms),
  cancelInterval = timer => globalThis.clearInterval(timer)
} = {}) {
  let context = null, enabled = false, playing = false, timer = null;
  let master = null, musicBus = null, effectsBus = null, noiseBuffer = null;
  let nextNoteTime = 0, step = 0, generation = 0;
  const voices = new Set();

  function finishVoice(voice) {
    if (voice.finished) return;
    voice.finished = true; voices.delete(voice);
    voice.source.disconnect(); voice.gain.disconnect();
    voice.filter?.disconnect();
  }

  function stopVoices(predicate) {
    for (const voice of [...voices]) if (predicate(voice)) {
      try { voice.source.stop(); } catch { /* The source may have ended already. */ }
      finishVoice(voice);
    }
  }

  function addVoice(source, start, duration, volume, group, { attack = .008, filterFrequency } = {}) {
    const gain = context.createGain(), voice = { source, gain, group, finished: false };
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.linearRampToValueAtTime(volume, start + attack);
    gain.gain.exponentialRampToValueAtTime(.0001, start + Math.max(attack + .005, duration));
    if (filterFrequency) {
      const filter = context.createBiquadFilter(); filter.type = 'lowpass';
      filter.frequency.setValueAtTime(filterFrequency, start); source.connect(filter); filter.connect(gain); voice.filter = filter;
    } else source.connect(gain);
    gain.connect(group === 'music' ? musicBus : effectsBus);
    voices.add(voice); source.onended = () => finishVoice(voice);
    source.start(start); source.stop(start + duration + .025);
  }

  function tone(frequency, duration, start, { wave = 'triangle', volume = .12, group = 'effect', to, attack, filterFrequency } = {}) {
    if (!enabled || context?.state !== 'running' || voices.size >= MAX_VOICES) return;
    const oscillator = context.createOscillator(); oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (to) oscillator.frequency.exponentialRampToValueAtTime(to, start + duration);
    addVoice(oscillator, start, duration, volume, group, { attack, filterFrequency });
  }

  function noise(duration, start, volume, group = 'music', filterFrequency = 1400) {
    if (!enabled || context?.state !== 'running' || voices.size >= MAX_VOICES) return;
    if (!noiseBuffer) {
      noiseBuffer = context.createBuffer(1, Math.ceil(context.sampleRate * .25), context.sampleRate);
      const data = noiseBuffer.getChannelData(0); let value = 17;
      for (let i = 0; i < data.length; i++) {
        value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
        data[i] = value / 2147483648 - 1;
      }
    }
    const source = context.createBufferSource(); source.buffer = noiseBuffer; source.loop = duration > .25;
    addVoice(source, start, duration, volume, group, { attack: .004, filterFrequency });
  }

  function musicStep(index, at) {
    const barStep = index % 16, root = bassRoots[Math.floor(index / 16) % bassRoots.length];
    const lead = melody[index % melody.length];
    if (lead !== null) tone(hz(lead), EIGHTH * .83, at, { volume: .10, group: 'music', filterFrequency: 2600 });
    if (barStep % 4 === 0) tone(hz(root), EIGHTH * 3.1, at, { wave: 'triangle', volume: .17, group: 'music', filterFrequency: 550 });
    if (barStep === 0 || barStep === 8) {
      tone(130, .17, at, { wave: 'sine', volume: .28, group: 'music', to: 40 });
      for (const note of [root + 12, root + 19]) tone(hz(note), EIGHTH * 6, at, { wave: 'sine', volume: .035, group: 'music', attack: .03 });
    }
    if (barStep === 4 || barStep === 12) noise(.11, at, .09, 'music', 1700);
    if (barStep % 2 === 1) noise(.035, at, .03, 'music', 6500);
    if (barStep === 14) tone(100, .1, at, { wave: 'sine', volume: .13, group: 'music', to: 45 });
  }

  function scheduleMusic() {
    if (!enabled || !playing || context?.state !== 'running') return;
    const now = context.currentTime;
    // A suspended/background browser must not catch up with a burst of old notes.
    if (nextNoteTime < now - EIGHTH * 2) nextNoteTime = now + .025;
    let scheduled = 0;
    while (nextNoteTime < now + .18 && scheduled++ < 4) {
      musicStep(step++, Math.max(now, nextNoteTime)); nextNoteTime += EIGHTH;
    }
  }

  function stopMusic() {
    if (timer !== null) { cancelInterval(timer); timer = null; }
    stopVoices(voice => voice.group !== 'ending');
  }

  function startMusic() {
    if (!enabled || !playing || !context || timer !== null) return;
    nextNoteTime = context.currentTime + .025;
    scheduleMusic(); timer = scheduleInterval(scheduleMusic, 60);
  }

  function closeContext() {
    generation++; stopMusic(); stopVoices(() => true);
    const old = context; context = null; noiseBuffer = null;
    master?.disconnect(); musicBus?.disconnect(); effectsBus?.disconnect();
    master = null; musicBus = null; effectsBus = null;
    if (old) { old.onstatechange = null; try { void Promise.resolve(old.close()).catch(() => {}); } catch { /* Already closed. */ } }
  }

  return {
    setEnabled(value) {
      if (!value) { enabled = false; closeContext(); return false; }
      try {
        if (!context) {
          context = createContext();
          if (!context) return false;
          master = context.createGain(); master.gain.value = .7; master.connect(context.destination);
          musicBus = context.createGain(); musicBus.gain.value = .36; musicBus.connect(master);
          effectsBus = context.createGain(); effectsBus.gain.value = .72; effectsBus.connect(master);
          context.onstatechange = () => { if (context?.state === 'running' && timer !== null) scheduleMusic(); };
        }
        enabled = true;
        const token = generation;
        void Promise.resolve(context.resume()).then(() => {
          if (enabled && token === generation) { startMusic(); scheduleMusic(); }
        }).catch(() => {
          if (token === generation) { enabled = false; closeContext(); }
        });
        startMusic(); return true;
      } catch { enabled = false; closeContext(); return false; }
    },
    setPlaying(value) {
      playing = Boolean(value);
      if (playing) startMusic(); else stopMusic();
    },
    play(kind, name) {
      if (!enabled || context?.state !== 'running') return;
      const now = context.currentTime + .005;
      if (kind === 'jump') {
        tone(260, .15, now, { to: 620, volume: .15 });
        tone(520, .09, now + .045, { wave: 'sine', volume: .07 });
      } else if (kind === 'land') tone(105, .09, now, { to: 55, volume: .11 });
      else if (kind === 'duck') tone(190, .09, now, { to: 100, volume: .10 });
      else if (kind === 'collision') {
        playing = false; stopMusic();
        noise(.23, now, .17, 'ending', 600);
        tone(165, .35, now, { to: 49, wave: 'triangle', volume: .19, group: 'ending' });
        tone(73, .45, now + .08, { wave: 'sine', volume: .13, group: 'ending' });
      } else if (kind === 'event') {
        const notes = name === 'Ragnarok' ? [38, 41, 45] : name === 'Odin' ? [62, 69, 74] : [62, 65, 69];
        notes.forEach((note, i) => tone(hz(note), .55, now + i * .10, { wave: 'sine', volume: .10 }));
        if (['Tor', 'Tordenvær', 'Ragnarok'].includes(name)) noise(.45, now, .10, 'effect', 500);
      }
    },
    get enabled() { return enabled; },
    dispose() { enabled = false; playing = false; closeContext(); }
  };
}
