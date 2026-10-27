// WEB-009–013: kun allerede validerte sensormålinger; ingen serial/backend-I/O.
class Ring {
  constructor(capacity) { this.capacity = capacity; this.clear(); }
  clear() { this.data = new Array(this.capacity); this.head = 0; this.size = 0; this.dropped = 0; }
  push(value) {
    if (this.size < this.capacity) this.data[(this.head + this.size++) % this.capacity] = value;
    else { this.data[this.head] = value; this.head = (this.head + 1) % this.capacity; this.dropped++; }
  }
  values() { return Array.from({ length: this.size }, (_, i) => this.data[(this.head + i) % this.capacity]); }
}

export function createRecorder() {
  const samples = new Ring(3000), events = new Ring(1000);
  let state = 'ready', exported = true, lastSample = null, lastTime = -Infinity;
  function time(timestampMs) {
    if (!Number.isFinite(timestampMs) || timestampMs < lastTime) throw new RangeError('Ugyldig monoton tid');
    lastTime = timestampMs;
  }
  return {
    get state() { return state; },
    start({ replaceUnexported = false } = {}) {
      if (!exported && !replaceUnexported) return false;
      samples.clear(); events.clear(); lastSample = null; lastTime = -Infinity;
      exported = false; state = 'recording'; return true;
    },
    pause() { if (state === 'recording') state = 'paused'; },
    resume() { if (state === 'paused') state = 'recording'; },
    stop() { if (state === 'recording' || state === 'paused') state = 'stopped'; },
    sample(timestampMs, sensors) {
      if (state !== 'recording') return false;
      time(timestampMs);
      if (lastSample !== null && timestampMs - lastSample < 100) return false;
      const owned = structuredClone(sensors);
      exported = false; samples.push({ timestampMs, sensors: owned }); lastSample = timestampMs; return true;
    },
    event(timestampMs, event) {
      if (state !== 'recording') return false;
      time(timestampMs); exported = false; events.push({ timestampMs, event: structuredClone(event) }); return true;
    },
    snapshot() {
      return structuredClone({ formatVersion: 1, state,
        time: { unit: 'ms', origin: 'recording monotonic clock' },
        units: { temperatureC: '°C', lightLevel: '0–255', soundLevel: '0–255', acceleration: 'mg', tilt: '-1–1' },
        samples: samples.values(), events: events.values(),
        dropped: { samples: samples.dropped, events: events.dropped } });
    },
    exportJSON() { const json = JSON.stringify(this.snapshot()); exported = true; return json; },
    exportCSV() {
      // CSV er bare sensorhistorikk, og markerer derfor ikke hele opptaket eksportert.
      const extra = ['aPressed', 'bPressed', 'logoPressed', 'tiltX', 'tiltY', 'xMg', 'yMg', 'zMg', 'strengthMg', 'gesture', 'soundEvent'];
      const cell = value => value == null ? '' : '"' + String(value).replaceAll('"', '""') + '"';
      const rows = samples.values().map(({ timestampMs, sensors: s }) =>
        [timestampMs, s.temperatureC ?? '', s.lightLevel ?? '', s.soundLevel ?? '', ...extra.map(key => cell(s[key]))].join(','));
      return `# time=monotonic_ms; temperature=C; light=0-255; sound=0-255; dropped_samples=${samples.dropped}\n` +
        'timestamp_ms,temperature_C,light_0_255,sound_0_255,' + extra.join(',') + '\n' + rows.join('\n') + '\n';
    }
  };
}
