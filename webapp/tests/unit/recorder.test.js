import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecorder } from '../../src/testlab/recorder.js';
const sensors = { temperatureC: 23, lightLevel: 80, soundLevel: 12 };
test('TLAB-09: start/pause/fortsett/stopp og bekreftelse før overskriving', () => {
  const r = createRecorder(); assert.equal(r.sample(0, sensors), false); assert.equal(r.start(), true);
  r.sample(0, sensors); r.pause(); assert.equal(r.sample(100, sensors), false);
  assert.equal(r.event(100, {}), false); r.resume(); r.sample(200, sensors); r.stop();
  assert.equal(r.sample(300, sensors), false); assert.equal(r.start(), false);
  assert.equal(r.snapshot().samples.length, 2); assert.equal(r.start({ replaceUnexported: true }), true);
  assert.equal(r.snapshot().samples.length, 0);
});
test('TLAB-10/11: høyst 10 Hz og reelle opphold uten fabrikasjon', () => {
  const r = createRecorder(); r.start();
  for (const time of [0, 20, 40, 60, 80, 100, 120, 200, 5000]) r.sample(time, sensors);
  assert.deepEqual(r.snapshot().samples.map(s => s.timestampMs), [0, 100, 200, 5000]);
  assert.equal(r.state, 'recording');
});
test('TLAB-11/16: flere omløp beholder siste 3000 målinger og 1000 hendelser', () => {
  const r = createRecorder(); r.start();
  for (let i = 0; i < 10000; i++) { r.sample(i * 100, sensors); r.event(i * 100, { count: i }); }
  const data = r.snapshot(); assert.equal(data.samples.length, 3000); assert.equal(data.events.length, 1000);
  assert.equal(data.samples[0].timestampMs, 700000); assert.equal(data.events[0].event.count, 9000);
  assert.deepEqual(data.dropped, { samples: 7000, events: 9000 });
});
test('TLAB-13: JSON roundtrip og isolasjon mot mutasjon', () => {
  const r = createRecorder(); r.start(); const sample = { ...sensors }, event = { count: 2 };
  r.sample(0, sample); r.event(0, event); sample.temperatureC = 99; event.count = 9;
  r.snapshot().samples[0].sensors.lightLevel = 0;
  const data = JSON.parse(r.exportJSON()); assert.equal(data.samples[0].sensors.temperatureC, 23);
  assert.equal(data.samples[0].sensors.lightLevel, 80); assert.equal(data.events[0].event.count, 2);
  assert.equal(r.start(), true);
});
test('TLAB-13: CSV oppgir enheter og tap; null er ikke en målt nullverdi', () => {
  const r = createRecorder(); r.start(); r.sample(0, sensors);
  r.sample(100, { temperatureC: null, lightLevel: 0, soundLevel: 255 });
  const csv = r.exportCSV(); assert.match(csv, /dropped_samples=0/);
  assert.match(csv, /0,23,80,12/); assert.match(csv, /100,,0,255/);
  assert.equal(r.start(), false, 'CSV eksporterer ikke hendelsene');
});
test('TLAB-09/10: avvis bakovergående/ugyldig tid', () => {
  const r = createRecorder(); r.start(); r.sample(100, sensors);
  for (const time of [99, NaN, Infinity]) assert.throws(() => r.sample(time, sensors), RangeError);
  assert.equal(r.snapshot().samples.length, 1);
});
test('TLAB-09/13: nye data etter eksport krever ny bekreftelse; CSV beholder alle sensorer', () => {
  const r = createRecorder(); r.start(); r.sample(0, sensors); r.exportJSON();
  r.sample(100, { ...sensors, xMg: -1000, aPressed: true, gesture: 'shake' });
  assert.equal(r.start(), false);
  assert.match(r.exportCSV(), /xMg/); assert.match(r.exportCSV(), /"-1000"/);
  assert.match(r.exportCSV(), /"true"/); assert.match(r.exportCSV(), /"shake"/);
});
