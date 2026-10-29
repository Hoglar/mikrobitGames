import { randomGenerator } from './random.js';
import { createVikingRenderer, environmentNames } from './viking-scene.js';
import { createVikingAudio } from './viking-audio.js';

export const events = [
  ['Nordlys', 0, 3], ['Stjerneskudd', 0, 3], ['Meteorregn', 200, 2],
  ['Solformørkelse', 400, 1], ['Måneformørkelse', 400, 1], ['Tordenvær', 200, 2],
  ['Snøstorm', 200, 2], ['Tåke', 200, 2], ['Solnedgang', 0, 3],
  ['Tor', 400, 2], ['Odin', 400, 2], ['Bivrost', 400, 2],
  ['Yggdrasil', 600, 1], ['Fenrisulven', 800, 1], ['Ragnarok', 1200, .5]
];
const STEP = 1 / 120;
const intense = name => name === 'Odin' || name === 'Ragnarok';
function weighted(rng, items) {
  let n = rng() * items.reduce((sum, item) => sum + item[2], 0);
  return items.find(item => (n -= item[2]) < 0) ?? items.at(-1);
}

export function createViking({ seed = 'viking-v2' } = {}) {
  // Separate streams keep the lane independent of weather, scenery and rendering.
  const version = 'viking-v2', normalizedSeed = String(seed).trim().normalize('NFC');
  const laneRandom = randomGenerator(`${version}:lane:${normalizedSeed}`);
  const environmentRandom = randomGenerator(`${version}:environment:${normalizedSeed}`);
  const eventRandom = randomGenerator(`${version}:events:${normalizedSeed}`);
  const skinRandom = randomGenerator(`${version}:skins:${normalizedSeed}`);
  const render = createVikingRenderer(), audio = createVikingAudio();
  let distance = 0, time = 0, y = 0, velocity = 0, duck = false, ended = false;
  let jumpBuffer = 0, nextObstacle = 28, objects = [], remainder = 0;
  let environment = 0, previousEnvironment = 0, environmentStarted = -2, section = 0;
  let event = null, lastEvent = null, nextEvent = 10 + eventRandom() * 5;

  function spawn() {
    // Use the obstacle's location, rather than lookahead time, for unlock gates.
    const location = nextObstacle;
    let types = location < 100 ? ['rock'] : location < 200 ? ['rock', 'branch'] : ['rock', 'branch', 'pit'];
    const influenced = event && time - event.start >= 2;
    if (influenced && event.name === 'Odin' && location >= 400) types = ['branch', 'branch', 'rock', 'pit'];
    const type = types[Math.floor(laneRandom() * types.length)];
    const width = type === 'pit' ? (laneRandom() < .5 ? 1.5 : 2.5) :
      type === 'branch' ? (laneRandom() < .5 ? 1 : 1.5) : (laneRandom() < .5 ? .6 : 1);
    const skins = type === 'branch' ? ['branch', 'raven', 'arrow', 'beam'] :
      ['rock', 'log', 'stump', 'wheel', 'shield', 'rune'];
    const skin = influenced && event.name === 'Odin' && type === 'branch' ? 'raven' :
      skins[Math.floor(skinRandom() * skins.length)];
    objects.push({ x: location, type, width, height: width === .6 ? .4 : .7, skin });
    // At maximum speed even the shortest interval leaves room for a full jump,
    // recovery and the next action. Events never tighten the physics margins.
    nextObstacle += influenced && event.name === 'Ragnarok' && location >= 1200 ?
      26 + laneRandom() * 6 : 32 + laneRandom() * 16;
  }

  function updateWorld(dt, previousDistance) {
    const nextSection = Math.floor(distance / 500);
    if (nextSection > section) {
      section = nextSection;
      previousEnvironment = environment;
      environment = weighted(environmentRandom, environmentNames.map((name, i) => [name, i, [15, 35, 35, 10, 5][i]]))[1];
      environmentStarted = time;
    }
    if (event && time >= event.until) {
      lastEvent = event.name;
      nextEvent = time + (intense(lastEvent) ? 12 : 6) + eventRandom() * (intense(lastEvent) ? 8 : 6);
      event = null;
    }
    if (!event && time >= nextEvent) {
      const chosen = weighted(eventRandom, events.filter(e => distance >= e[1] && e[0] !== lastEvent));
      event = { name: chosen[0], start: time, until: time + (intense(chosen[0]) ? 12 : 10) + eventRandom() * 8 };
      audio.play('event', event.name);
    }
    while (distance + 55 >= nextObstacle) spawn();

    const wasAirborne = y > 0 || velocity > 0;
    if (!wasAirborne && jumpBuffer > 0 && !duck) {
      velocity = 8; jumpBuffer = 0; audio.play('jump');
    }
    const previousY = y;
    if (y > 0 || velocity > 0) {
      y += velocity * dt - 10 * dt * dt;
      velocity -= 20 * dt;
      if (y <= 0) { y = 0; velocity = 0; }
    }
    const height = y > 0 ? 1.4 : duck ? .65 : 1.4;
    for (const o of objects) {
      if (distance + .25 <= o.x || previousDistance - .25 >= o.x + o.width) continue;
      if (o.type === 'pit') {
        if (distance >= o.x && distance < o.x + o.width && y === 0) ended = true;
      } else {
        const bottom = o.type === 'rock' ? 0 : .9, top = o.type === 'rock' ? o.height : 1.8;
        if (Math.min(y, previousY) < top && Math.max(y + height, previousY + height) > bottom) ended = true;
      }
    }
    if (ended) { jumpBuffer = 0; audio.play('collision'); }
    else if (wasAirborne && y === 0 && jumpBuffer > 0 && !duck) {
      // The buffered press is consumed on the landing step, not one tick later.
      velocity = 8; jumpBuffer = 0; audio.play('jump');
    }
    jumpBuffer = Math.max(0, jumpBuffer - dt);
    objects = objects.filter(o => o.x + o.width > distance - 5);
  }

  function state() {
    return {
      version, distance, time, y, duck, environment, previousEnvironment, section,
      transition: Math.min(1, Math.max(0, (time - environmentStarted) / 2)),
      event: event && { ...event }, objects: objects.map(o => ({ ...o })), ended
    };
  }

  return {
    press({ input }) {
      if (input !== 'a' || duck || ended) return;
      // No mid-air jump queue; only the agreed small pre-landing tolerance.
      const landingIn = y > 0 ? (velocity + Math.sqrt(velocity * velocity + 40 * y)) / 20 : 0;
      if (landingIn <= .1 + 1e-9) jumpBuffer = .1;
    },
    input(input) { duck = input.buttons.bPressed; if (duck) jumpBuffer = 0; },
    releaseControls() { duck = false; jumpBuffer = 0; },
    tick(dt) {
      if (!Number.isFinite(dt) || dt <= 0 || ended) return;
      remainder += dt;
      while (!ended && remainder + 1e-12 >= STEP) {
        const speed = 8 + 8 * Math.min(distance / 1500, 1);
        const previousDistance = distance;
        time += STEP; distance += speed * STEP; updateWorld(STEP, previousDistance);
        remainder = Math.max(0, remainder - STEP);
      }
    },
    setSoundEnabled(enabled) { return audio.setEnabled(enabled); },
    dispose() { audio.dispose(); },
    get ended() { return ended; },
    get value() { return Math.floor(distance); },
    get label() { return `${Math.floor(distance)} m · ${environmentNames[environment]}`; },
    get resultText() { return 'Eventyret er over. Klar for en ny ferd?'; },
    get state() { return state(); },
    draw(ctx, w, h) { render(ctx, w, h, state()); }
  };
}
