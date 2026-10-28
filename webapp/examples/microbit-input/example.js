import { microbit } from '../../src/microbit-input/index.js';
import { afterInputChange, resumeGame } from '../../src/platform/rules.js';

const $ = id => document.getElementById(id);
let game = null, kind = null, phase = 'idle', score = 0, busy = false;
function log(message) {
  const item = document.createElement('li'); item.textContent = message;
  $('events').prepend(item);
  while ($('events').children.length > 100) $('events').lastElementChild.remove();
}
function refresh() {
  const state = microbit.getState(), ready = state.inputAvailable;
  $('connection').textContent = state.connection === 'connected' ? 'Connected · input ready' : state.connection === 'connecting' ? 'Connecting · input unavailable' : 'Disconnected';
  $('state').textContent = JSON.stringify(state, null, 2);
  $('connect').disabled = busy || state.connection !== 'disconnected';
  $('disconnect').disabled = busy || state.connection === 'disconnected';
  for (const id of ['counter', 'cursor']) $(id).disabled = busy || !ready;
  $('resume').disabled = busy || phase !== 'paused' || !ready;
  $('exit').disabled = busy || !game;
  for (const id of ['show-text', 'clear', 'tone', 'melody', 'stop']) $(id).disabled = busy || !game || !ready;
  $('sound').disabled = busy || !game || !ready || !microbit.capabilities?.outputs.builtInSounds.length;
  $('game-status').textContent = !game ? 'No game running' : `${kind === 'counter' ? 'Button counter' : 'Tilt cursor'} · ${phase}`;
}
async function action(work) {
  if (busy) return;
  busy = true; $('error').textContent = ''; refresh();
  try { await work(); } catch (failure) { $('error').textContent = `${failure.kind ?? 'error'}: ${failure.message}`; }
  finally { busy = false; refresh(); }
}
async function start(name) {
  if (game) { phase = 'idle'; await game.dispose(); game = null; }
  const session = microbit.createGameSession(); game = session; kind = name; phase = 'playing'; score = 0;
  $('score').textContent = '0'; $('score').hidden = name !== 'counter'; $('cursor-dot').hidden = name !== 'cursor';
  $('instructions').textContent = name === 'counter' ? 'Press A to score. Counted presses survive missed held-state samples.' : 'Tilt to move the dot. Recovered input waits for Continue playing.';
  session.inputs.subscribe(state => {
    if (game !== session) return;
    phase = afterInputChange(phase, state);
    if (phase === 'playing' && name === 'cursor') {
      $('cursor-dot').style.left = `${50 + state.tilt.x * 43}%`;
      $('cursor-dot').style.top = `${50 + state.tilt.y * 40}%`;
    }
    refresh();
  });
  session.inputs.onPress(event => {
    if (phase !== 'playing' || game !== session) return;
    log(`${event.input}: ${event.count} press(es)`);
    if (name === 'counter' && event.input === 'a') { score += event.count; $('score').textContent = String(score); }
  });
  session.inputs.onGesture(gesture => { if (phase === 'playing') log(gesture); });
}
$('connect').addEventListener('click', () => action(() => microbit.connect()));
$('disconnect').addEventListener('click', () => action(async () => {
  try { await microbit.disconnect(); } finally { game = null; phase = 'idle'; }
}));
for (const name of ['counter', 'cursor']) $(name).addEventListener('click', () => action(() => start(name)));
$('resume').addEventListener('click', () => { phase = resumeGame(phase, microbit.getState(), true); refresh(); });
$('exit').addEventListener('click', () => action(async () => {
  const old = game; phase = 'idle';
  try { await old.dispose(); } finally { if (game === old) game = null; }
}));
$('show-text').addEventListener('click', () => action(() => game.outputs.display.showText($('display-text').value)));
$('clear').addEventListener('click', () => action(() => game.outputs.display.clear()));
$('tone').addEventListener('click', () => action(() => game.outputs.speaker.playTone({ frequencyHz: 440, durationMs: 500 })));
$('melody').addEventListener('click', () => action(() => game.outputs.speaker.playMelody({ notes: [
  { frequencyHz: 440, durationMs: 200 }, { frequencyHz: 0, durationMs: 100 }, { frequencyHz: 660, durationMs: 250 }
] })));
$('sound').addEventListener('click', () => action(() => game.outputs.speaker.playBuiltInSound(microbit.capabilities.outputs.builtInSounds[0])));
$('stop').addEventListener('click', () => action(() => game.outputs.speaker.stop()));
microbit.onError(failure => { log(`${failure.kind}: ${failure.message}`); $('error').textContent = failure.message; refresh(); });
const timer = setInterval(refresh, 100);
window.addEventListener('pagehide', () => { clearInterval(timer); void microbit.disconnect().catch(() => {}); }, { once: true });
refresh();
