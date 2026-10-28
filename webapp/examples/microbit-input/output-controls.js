// Example UI only. The shared game facade owns all validation, queues and I/O.
const $ = id => document.getElementById(id);
const semitones = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B', 'C'];
const melodies = {
  scale: [0, 2, 4, 5, 7, 9, 11, 12], descending: [12, 11, 9, 7, 5, 4, 2, 0],
  arpeggio: [0, 4, 7, 12, 7, 4, 0], twinkle: [0, 0, 7, 7, 9, 9, 7, 5, 5, 4, 4, 2, 2, 0]
};

export function createOutputControls({ getGame, run }) {
  const pixels = Array(25).fill(0), cells = [], keys = [];
  let painting = null, catalog = null;
  const setPixel = (index, value) => {
    pixels[index] = value;
    const cell = cells[index];
    cell.textContent = String(value); cell.style.setProperty('--brightness', String(value / 9));
    cell.setAttribute('aria-pressed', String(value > 0));
    cell.setAttribute('aria-label', `Row ${Math.floor(index / 5) + 1}, column ${index % 5 + 1}, brightness ${value}`);
  };
  const toggleValue = index => pixels[index] === Number($('brush').value) ? 0 : Number($('brush').value);
  for (let index = 0; index < 25; index++) {
    const cell = document.createElement('button'); cell.type = 'button'; cell.className = 'pixel';
    cell.dataset.index = String(index); cells.push(cell); $('image-grid').append(cell); setPixel(index, 0);
    // Pointer painting is handled below; a zero-detail click also supports keyboard/assistive activation.
    cell.addEventListener('click', event => { if (event.detail === 0) setPixel(index, toggleValue(index)); });
  }
  const grid = $('image-grid');
  grid.addEventListener('pointerdown', event => {
    const cell = event.target.closest('.pixel');
    if (!cell || event.button !== 0 || !event.isPrimary) return;
    event.preventDefault(); cell.focus();
    const index = Number(cell.dataset.index), value = toggleValue(index);
    painting = { pointerId: event.pointerId, value }; setPixel(index, value);
    grid.setPointerCapture(event.pointerId);
  });
  grid.addEventListener('pointermove', event => {
    if (painting?.pointerId !== event.pointerId) return;
    const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest('.pixel');
    if (cell && grid.contains(cell)) setPixel(Number(cell.dataset.index), painting.value);
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) grid.addEventListener(name, () => { painting = null; });
  $('brush').addEventListener('input', () => { $('brush-value').textContent = $('brush').value; });
  $('reset-image').addEventListener('click', () => pixels.forEach((_, index) => setPixel(index, 0)));
  $('fill-image').addEventListener('click', () => pixels.forEach((_, index) => setPixel(index, Number($('brush').value))));
  $('send-image').addEventListener('click', () => run(() => getGame().outputs.display.showImage(pixels)));
  $('show-text').addEventListener('click', () => run(() => getGame().outputs.display.showText($('display-text').value)));
  $('clear').addEventListener('click', () => run(() => getGame().outputs.display.clear()));

  const number = id => {
    const input = $(id);
    if (!input.checkValidity()) { input.reportValidity(); throw new Error(`${input.labels[0].textContent.trim()}: enter a whole number from ${input.min} to ${input.max}.`); }
    return input.valueAsNumber;
  };
  const frequency = offset => Math.round(440 * 2 ** ((12 * (Number($('octave').value) + 1) + offset - 69) / 12));
  const toneOptions = frequencyHz => ({ frequencyHz, durationMs: number('note-duration'), volume: number('volume') });
  const updateMelody = () => {
    const count = melodies[$('melody-choice').value].length, duration = $('note-duration').valueAsNumber;
    $('melody-description').textContent = Number.isInteger(duration) && duration >= 1 && duration <= 10000
      ? `${count} notes · ${count * duration} ms total. Maximum melody length: 10000 ms.` : 'Choose a note length from 1 to 10000 ms.';
  };
  const updateKeys = () => {
    let whiteCount = 0;
    keys.forEach((key, offset) => {
      const name = `${semitones[offset]}${Number($('octave').value) + (offset === 12 ? 1 : 0)}`;
      key.textContent = name; key.setAttribute('aria-label', `Play ${name}`); key.title = `${name} · ${frequency(offset)} Hz`;
      if (key.classList.contains('black-key')) key.style.left = `${whiteCount / 8 * 100}%`;
      else whiteCount++;
    });
  };
  for (let offset = 0; offset < semitones.length; offset++) {
    const key = document.createElement('button'); key.type = 'button'; key.disabled = true;
    key.className = `piano-key${semitones[offset].includes('♯') ? ' black-key' : ''}`;
    key.addEventListener('click', () => run(async () => {
      const options = toneOptions(frequency(offset)), label = key.textContent;
      await getGame().outputs.speaker.playTone(options);
      $('last-note').textContent = `${label} · ${options.frequencyHz} Hz · ${options.durationMs} ms · volume ${options.volume}`;
    }));
    keys.push(key); $('piano').append(key);
  }
  $('octave').addEventListener('change', updateKeys);
  $('volume').addEventListener('input', () => { $('volume-value').textContent = $('volume').value; });
  $('note-duration').addEventListener('input', updateMelody);
  $('melody-choice').addEventListener('change', updateMelody);
  $('tone').addEventListener('click', () => run(() => getGame().outputs.speaker.playTone(toneOptions(number('frequency')))));
  $('melody').addEventListener('click', () => run(() => {
    const options = toneOptions(0), notes = melodies[$('melody-choice').value].map(offset => ({ frequencyHz: frequency(offset), durationMs: options.durationMs }));
    if (notes.length * options.durationMs > 10000) throw new Error(`This melody needs a note length of ${Math.floor(10000 / notes.length)} ms or less (10000 ms total).`);
    return getGame().outputs.speaker.playMelody({ notes, volume: options.volume });
  }));
  $('sound').addEventListener('click', () => run(() => getGame().outputs.speaker.playBuiltInSound($('sound-choice').value)));
  $('stop').addEventListener('click', () => run(() => getGame().outputs.speaker.stop()));
  updateKeys(); updateMelody();

  return { update({ ready, busy, capabilities }) {
    const disabled = busy || !getGame() || !ready;
    for (const id of ['show-text', 'clear', 'send-image', 'tone', 'melody', 'stop']) $(id).disabled = disabled;
    for (const key of keys) key.disabled = disabled;
    const sounds = capabilities?.outputs.builtInSounds ?? [], signature = JSON.stringify({ known: !!capabilities, sounds });
    if (catalog !== signature) {
      const selected = $('sound-choice').value;
      $('sound-choice').replaceChildren();
      for (const name of sounds) $('sound-choice').add(new Option(name, name));
      if (!sounds.length) $('sound-choice').add(new Option(capabilities ? 'No named sounds available' : 'Connect to see sounds', ''));
      if (sounds.includes(selected)) $('sound-choice').value = selected;
      catalog = signature;
    }
    $('sound-choice').disabled = $('sound').disabled = disabled || !sounds.length;
  } };
}
