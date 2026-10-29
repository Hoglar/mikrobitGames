// Viking Dash pixel art. World geometry and random choices belong to index.js.
// Everything is drawn locally: no fonts, images or network resources are needed.
const WIDTH = 480, HEIGHT = 270, GROUND = 214, SCALE = WIDTH / 32;
export const environmentNames = ['Norsk skog', 'Fjord og kyst', 'Fjellandskap', 'Nordlysnatt', 'Mytologisk landskap'];
const places = ['SKOGHEIM', 'FJORDVIK', 'JOTUNFJELL', 'NORDLYSNATT', 'YGGDRASILS RIKE'];
const palettes = [
  { sky: '#d9d8cf', horizon: '#eeeadf', far: '#b3b6ae', mid: '#8e9890', near: '#586a60', dark: '#263e35', soil: '#41483b', edge: '#c3c6ae', water: '#bdc9c3', snow: '#e8e8db', accent: '#ddd0ab', mist: '#e5e7dc' },
  { sky: '#bdced0', horizon: '#e5dbbd', far: '#9aafb1', mid: '#6f9294', near: '#365f60', dark: '#193d3b', soil: '#414b3d', edge: '#c4c299', water: '#79a7a8', snow: '#e4e5d9', accent: '#e7bd79', mist: '#cee1d8' },
  { sky: '#c5d5df', horizon: '#eee7d6', far: '#a3b8c8', mid: '#758fa6', near: '#435f77', dark: '#273b4b', soil: '#3b464c', edge: '#e3e9e3', water: '#9dbac5', snow: '#f0efe4', accent: '#dfc696', mist: '#dce8eb' },
  { sky: '#111e34', horizon: '#35495c', far: '#34485a', mid: '#273e50', near: '#1b3440', dark: '#102a30', soil: '#243c3c', edge: '#83b2a3', water: '#416b76', snow: '#aecbc7', accent: '#b9e5be', mist: '#729992' },
  { sky: '#302b49', horizon: '#896b82', far: '#675774', mid: '#50415e', near: '#3d344b', dark: '#222b36', soil: '#39353e', edge: '#c4ada4', water: '#70627d', snow: '#c1b4cc', accent: '#e4bc8a', mist: '#ae8da7' }
];
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const fract = n => n - Math.floor(n);
// Coordinate noise is stateless, so drawing never advances the game's random streams.
const noise = n => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);
const mix = (a, b, t) => {
  const c = [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t));
  return `rgb(${c.join(',')})`;
};
function rect(c, color, x, y, w, h) { c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); }
function poly(c, color, points) {
  c.fillStyle = color; c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(Math.round(x), Math.round(y)) : c.moveTo(Math.round(x), Math.round(y))); c.closePath(); c.fill();
}
function line(c, color, points, width = 1) {
  c.strokeStyle = color; c.lineWidth = width; c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(Math.round(x), Math.round(y)) : c.moveTo(Math.round(x), Math.round(y))); c.stroke();
}
function circle(c, color, x, y, r) { c.fillStyle = color; c.beginPath(); c.arc(Math.round(x), Math.round(y), r, 0, Math.PI * 2); c.fill(); }
function alpha(c, opacity, draw) { c.save(); c.globalAlpha *= clamp(opacity); draw(); c.restore(); }

function pine(c, x, base, height, color, highlight) {
  const w = height * .29;
  rect(c, color, x - 1, base - height * .5, 3, height * .5);
  for (let k = 0; k < 4; k++) {
    const y = base - height + k * height * .19, spread = w * (.4 + k * .21);
    poly(c, color, [[x, y], [x + spread, y + height * .37], [x - spread, y + height * .37]]);
    if (highlight) line(c, highlight, [[x, y + 2], [x - spread * .6, y + height * .25]]);
  }
}
function rune(c, x, y, size, color, variant = 0) {
  const h = size, w = size * .4;
  line(c, color, [[x, y], [x, y + h]]);
  if (variant % 3 === 0) line(c, color, [[x, y], [x + w, y + h * .23], [x, y + h * .48], [x + w, y + h * .76]]);
  else if (variant % 3 === 1) { line(c, color, [[x - w, y + h * .22], [x, y + h * .5], [x + w, y + h * .22]]); }
  else line(c, color, [[x, y + h * .15], [x + w, y + h * .4], [x, y + h * .65], [x - w, y + h * .4], [x, y + h * .15]]);
}

function sky(c, p, biome, event, t, strength) {
  const g = c.createLinearGradient(0, 0, 0, GROUND);
  g.addColorStop(0, p.sky); g.addColorStop(1, p.horizon); c.fillStyle = g; c.fillRect(0, 0, WIDTH, GROUND);
  const night = biome >= 3, eclipse = ['Solformørkelse', 'Måneformørkelse', 'Fenrisulven'].includes(event?.name);
  if (event?.name === 'Solnedgang') alpha(c, strength * .7, () => {
    const sunset = c.createLinearGradient(0, 0, 0, GROUND); sunset.addColorStop(0, '#433653'); sunset.addColorStop(.65, '#c98b83'); sunset.addColorStop(1, '#edc99b'); c.fillStyle = sunset; c.fillRect(0, 0, WIDTH, GROUND);
  });
  if (night || eclipse) {
    for (let i = 0; i < 55; i++) {
      const x = noise(i + 3) * WIDTH, y = 12 + noise(i + 73) * 113;
      alpha(c, .3 + .5 * noise(i + 18) + .12 * Math.sin(t * .8 + i), () => rect(c, '#e5e1ce', x, y, i % 13 === 0 ? 2 : 1, 1));
    }
  }
  const celestialX = 368, celestialY = 55;
  alpha(c, .1, () => circle(c, p.accent, celestialX, celestialY, 34));
  circle(c, night || event?.name === 'Måneformørkelse' || event?.name === 'Fenrisulven' ? '#e0dac5' : '#f1e7c9', celestialX, celestialY, night ? 13 : 19);
  if (night) { rect(c, '#bebfad', celestialX - 5, celestialY - 4, 4, 3); rect(c, '#bebfad', celestialX + 4, celestialY + 4, 3, 2); }
  if (eclipse) alpha(c, strength, () => circle(c, event.name === 'Solformørkelse' ? '#333847' : '#6f4959', celestialX - 3, celestialY - 2, 17));
  if (event?.name === 'Ragnarok') alpha(c, strength * .75, () => {
    const fire = c.createLinearGradient(0, 0, 0, GROUND); fire.addColorStop(0, '#292233'); fire.addColorStop(.6, '#8a444a'); fire.addColorStop(1, '#cc825c'); c.fillStyle = fire; c.fillRect(0, 0, WIDTH, GROUND);
  });
  for (let i = 0; i < 5; i++) {
    const x = ((i * 133 - t * (1 + i % 2)) % (WIDTH + 90) + WIDTH + 90) % (WIDTH + 90) - 50;
    alpha(c, night ? .1 : .28, () => { rect(c, p.snow, x, 45 + i % 3 * 22, 48, 3); rect(c, p.snow, x + 9, 42 + i % 3 * 22, 23, 3); rect(c, p.snow, x + 28, 48 + i % 3 * 22, 31, 2); });
  }
}

function aurora(c, t, amount = 1) {
  c.save(); c.globalCompositeOperation = 'screen';
  for (let band = 0; band < 3; band++) {
    for (let x = 0; x < WIDTH; x += 2) {
      const y = 35 + band * 9 + Math.sin(x / 97 + t * .13 + band) * 15 + Math.sin(x / 43 - t * .08) * 5;
      const length = 14 + Math.sin(x / 61 + band + t * .2) * 8;
      alpha(c, amount * (.05 + .08 * (1 + Math.sin(x / 80 + t * .1))), () => rect(c, ['#86dbae', '#64bdc4', '#a998ce'][band], x, y, 2, length));
    }
    alpha(c, amount * .35, () => line(c, ['#a3edc8', '#87cbd7', '#cab1e6'][band], Array.from({ length: 61 }, (_, i) => {
      const x = i * 8; return [x, 35 + band * 9 + Math.sin(x / 97 + t * .13 + band) * 15 + Math.sin(x / 43 - t * .08) * 5];
    })));
  }
  c.restore();
}

function mountainLayer(c, p, distance, depth, biome) {
  const span = depth === 0 ? 137 : 103, rate = depth === 0 ? .8 : 1.8;
  const shift = distance * rate, first = Math.floor(shift / span);
  for (let i = first - 1; i <= first + 5; i++) {
    const x = i * span - shift, high = (42 + noise(i + depth * 21) * 38 + (biome === 2 ? 15 : 0)) * (biome === 0 ? .5 : 1), peak = x + span * (.4 + noise(i + 14) * .2), base = depth === 0 ? 169 : 189;
    const points = [[x - 27, base], [x + 13, base - high * .5], [peak - 12, base - high + 12], [peak, base - high], [peak + 22, base - high * .68], [x + span + 32, base]];
    poly(c, depth === 0 ? p.far : p.mid, points);
    poly(c, depth === 0 ? p.mid : p.near, [[peak, base - high], [peak + 22, base - high * .68], [x + span + 32, base], [peak + 11, base - high * .25]]);
    if (biome === 1 || biome === 2 || biome === 3) {
      poly(c, p.snow, [[peak - 19, base - high + 20], [peak - 12, base - high + 12], [peak, base - high], [peak + 19, base - high * .73], [peak + 3, base - high + 13], [peak - 4, base - high + 10], [peak - 8, base - high + 19]]);
    }
  }
}

function ship(c, x, y, size, p, t = 0) {
  c.save(); c.translate(Math.round(x), Math.round(y + Math.sin(t * .6 + x) * .5)); c.scale(size, size);
  poly(c, p.dark, [[-27, -4], [24, -4], [29, -12], [32, -13], [31, -4], [22, 4], [-16, 5], [-29, -2], [-32, -9], [-30, -12], [-26, -10]]);
  line(c, p.accent, [[-26, -2], [-17, 1], [22, 0], [28, -5]]);
  rect(c, p.dark, -1, -40, 2, 39); line(c, p.dark, [[-1, -38], [23, -3]]);
  poly(c, p.snow, [[-19, -36], [13, -36], [17, -11], [-18, -11], [-15, -24]]);
  for (let i = 0; i < 4; i++) rect(c, i % 2 ? p.near : p.mid, -14 + i * 8, -35, 4, 24);
  for (let i = -16; i < 20; i += 7) circle(c, p.accent, i, -1, 2);
  c.restore();
}

function village(c, x, y, p) {
  for (let i = 0; i < 3; i++) {
    const dx = x + i * 22, h = i === 1 ? 17 : 12;
    rect(c, p.near, dx, y - h, 19, h); poly(c, p.dark, [[dx - 3, y - h], [dx + 8, y - h - 9], [dx + 22, y - h]]);
    rect(c, p.accent, dx + 6, y - 7, 3, 4); rect(c, p.dark, dx + 13, y - 6, 4, 6);
    line(c, p.mid, [[dx, y - 2], [dx + 19, y - 2]]);
  }
}

function worldTree(c, x, base, size, p) {
  c.save(); c.translate(x, base); c.scale(size, size);
  poly(c, p.dark, [[-8, 0], [-5, -39], [-17, -65], [-13, -76], [0, -48], [8, -82], [13, -76], [7, -41], [12, 0]]);
  line(c, p.dark, [[0, -45], [-26, -61], [-47, -62]], 5); line(c, p.dark, [[5, -44], [34, -62], [54, -59]], 5);
  // Broad, stepped crown, visibly different from the surrounding conifers.
  poly(c, p.dark, [[-64, -65], [-59, -78], [-43, -79], [-40, -88], [-25, -91], [-22, -98], [-2, -101], [16, -98], [24, -91], [44, -88], [48, -78], [64, -74], [65, -63], [45, -58], [27, -60], [5, -55], [-13, -59], [-36, -57]]);
  for (let i = 0; i < 24; i++) {
    const xx = -53 + noise(i + 6) * 103, yy = -70 - noise(i + 87) * 23;
    rect(c, i % 3 ? p.near : p.mid, xx, yy, 10 + noise(i) * 12, 4 + noise(i + 5) * 6);
  }
  line(c, p.mid, [[0, -52], [-3, -73], [-25, -84]], 2); line(c, p.mid, [[5, -56], [16, -75], [37, -80]], 2);
  for (const dir of [-1, 1]) line(c, p.dark, [[0, -5], [dir * 14, -1], [dir * 29, 2]], 3);
  c.restore();
}

function wolf(c, x, y, p) {
  poly(c, p.dark, [[x - 27, y], [x - 22, y - 10], [x - 19, y - 21], [x - 12, y - 27], [x - 5, y - 28], [x + 3, y - 34], [x + 7, y - 44], [x + 11, y - 36], [x + 15, y - 40], [x + 18, y - 31], [x + 27, y - 26], [x + 15, y - 23], [x + 11, y - 14], [x + 16, y], [x + 9, y], [x + 5, y - 14], [x - 7, y - 12], [x - 7, y], [x - 13, y], [x - 14, y - 9], [x - 23, y + 1]]);
  rect(c, p.accent, x + 14, y - 31, 2, 1);
}

function backdrop(c, p, biome, d, t, event, strength) {
  sky(c, p, biome, event, t, strength);
  if (biome === 3 || event?.name === 'Nordlys') aurora(c, t, biome === 3 ? .85 : strength);
  if (event?.name === 'Bivrost') alpha(c, strength * .45, () => {
    for (let k = 0; k < 5; k++) line(c, ['#deb696', '#d1c99b', '#9fc8b4', '#a1bdcf', '#bbabd1'][k], Array.from({ length: 81 }, (_, i) => {
      const x = 105 + i * 4; return [x, 118 - Math.sin(i / 80 * Math.PI) * 75 + k * 3];
    }), 2);
  });
  mountainLayer(c, p, d, 0, biome);
  if (biome !== 1) mountainLayer(c, p, d, 1, biome);
  if (biome === 1 || biome === 3) {
    rect(c, p.water, 0, biome === 1 ? 156 : 174, WIDTH, biome === 1 ? 49 : 25);
    for (let i = 0; i < 32; i++) {
      const x = (noise(i) * WIDTH - d * .5 + WIDTH * 100) % WIDTH;
      alpha(c, .35, () => rect(c, i % 3 ? p.snow : p.dark, x, (biome === 1 ? 158 : 176) + noise(i + 25) * 27, 3 + noise(i + 2) * 21, 1));
    }
    const shift = d * .4, firstShip = Math.floor(shift / 280);
    for (let i = firstShip; i <= firstShip + 2; i++) ship(c, 70 + i * 280 - shift, 187, biome === 1 ? .85 : .55, p, t);
    if (biome === 1) {
      // Fjord cliffs frame open water instead of covering the ships with mountains.
      poly(c, p.mid, [[0, 93], [19, 104], [39, 144], [71, 173], [106, 184], [0, 190]]);
      poly(c, p.near, [[0, 118], [21, 144], [28, 178], [66, 190], [0, 194]]);
      poly(c, p.mid, [[480, 95], [450, 119], [431, 155], [400, 174], [370, 187], [480, 190]]);
      poly(c, p.near, [[480, 129], [458, 149], [450, 177], [409, 190], [480, 198]]);
      const coast = ((410 - d * .2) % 720 + 720) % 720;
      poly(c, p.near, [[coast - 11, 160], [coast + 32, 151], [coast + 78, 160]]); village(c, coast, 158, p);
    }
  }
  if (event?.name === 'Yggdrasil') alpha(c, strength * .85, () => worldTree(c, 321, 193, 1.55, p));
  if (event?.name === 'Fenrisulven') alpha(c, strength, () => {
    poly(c, p.near, [[275, 190], [310, 161], [337, 150], [358, 154], [404, 190]]); wolf(c, 343, 153, p);
  });
  if (biome === 4 && event?.name !== 'Yggdrasil') worldTree(c, ((370 - d * .7) % 720 + 720) % 720, 197, .9, p);
  if (biome === 0) {
    const shift = d * 1.8, first = Math.floor(shift / 27);
    for (let i = first - 1; i <= first + 19; i++) pine(c, i * 27 - shift, 204, 25 + noise(i + 77) * 33, p.mid, p.far);
  }
  const shift = d * 3.5, first = Math.floor(shift / 49);
  for (let i = first - 1; i < first + 12; i++) {
    const x = i * 49 - shift, h = 22 + noise(i + 8) * 46;
    if (biome === 0 || biome === 3) pine(c, x, GROUND - 6, h, i % 2 ? p.near : p.dark, i % 3 === 0 ? p.mid : null);
    else if (biome === 2 && i % 3 === 0) pine(c, x, GROUND - 4, h * .6, p.near, p.snow);
    else if (biome === 1 && i % 4 === 0) pine(c, x, GROUND - 5, h * .7, p.near);
    else if (biome === 4 && i % 3 === 0) {
      poly(c, p.dark, [[x - 6, GROUND], [x - 8, GROUND - 22], [x - 3, GROUND - 30], [x + 5, GROUND - 28], [x + 8, GROUND]]);
      rune(c, x, GROUND - 24, 14, p.accent, i);
    }
  }
  // A low distant shore closes the scene without covering the playable lane.
  poly(c, p.near, [[0, 210], [70, 201], [133, 207], [230, 197], [312, 207], [410, 200], [480, 207], [480, GROUND], [0, GROUND]]);
  weather(c, p, t, event, strength);
}

function raven(c, x, y, scale, time, color) {
  c.save(); c.translate(Math.round(x), Math.round(y)); c.scale(scale, scale);
  const wing = Math.floor(time * 6) % 3;
  poly(c, color, [[-1, 0], [-6, -2], [-12, wing === 0 ? -7 : wing === 1 ? -2 : 3], [-7, 1], [-2, 3], [2, 2], [6, -1], [9, -1], [6, -3], [2, -2], [7, wing === 0 ? -8 : wing === 1 ? -3 : 3], [1, -1]]);
  c.restore();
}

function weather(c, p, t, event, strength) {
  if (!event) return;
  const name = event.name, age = t - event.start;
  c.save(); c.beginPath(); c.rect(0, 0, WIDTH, GROUND - 35); c.clip();
  alpha(c, strength, () => {
    if (['Stjerneskudd', 'Meteorregn', 'Ragnarok'].includes(name)) {
      for (let i = 0; i < (name === 'Stjerneskudd' ? 1 : 7); i++) {
        const phase = (age * .22 + noise(i + 3)) % 1, x = 70 + phase * 360 + noise(i) * 30, y = 12 + phase * 80 + noise(i + 53) * 42;
        alpha(c, Math.sin(phase * Math.PI) * .85, () => { line(c, name === 'Ragnarok' ? '#f2b68a' : p.snow, [[x - 24, y - 12], [x, y]]); rect(c, '#f7eed9', x, y, 2, 2); });
      }
    }
    if (['Tordenvær', 'Tor', 'Ragnarok'].includes(name)) {
      const beat = (age + .4) % 5.3;
      alpha(c, .38, () => { rect(c, p.dark, 0, 15, WIDTH, 16); rect(c, p.dark, 30, 29, 135, 7); rect(c, p.dark, 260, 30, 180, 8); });
      if (beat < .22) alpha(c, (1 - beat / .22) * .65, () => line(c, '#eadbc0', [[287, 31], [278, 53], [290, 51], [272, 84], [280, 62], [271, 64], [280, 40]], 2));
      if (name !== 'Ragnarok') for (let i = 0; i < 38; i++) { const x = (noise(i) * WIDTH - age * 32 + WIDTH * 100) % WIDTH, y = (noise(i + 50) * 140 + age * 55) % 154; alpha(c, .25, () => line(c, p.snow, [[x, y], [x - 2, y + 6]])); }
    }
    if (name === 'Snøstorm') for (let i = 0; i < 55; i++) {
      const x = (noise(i) * WIDTH - age * (10 + i % 6) + WIDTH * 100) % WIDTH, y = (noise(i + 9) * 155 + age * (4 + i % 5)) % 165;
      alpha(c, .3 + noise(i + 10) * .4, () => rect(c, p.snow, x, y, i % 5 === 0 ? 2 : 1, 1));
    }
    if (name === 'Tåke') for (let i = 0; i < 4; i++) {
      const x = ((i * 153 + age * 4) % 700) - 140;
      alpha(c, .14, () => { rect(c, p.mist, x, 102 + i * 16, 210, 13); rect(c, p.mist, x + 30, 97 + i * 16, 145, 23); });
    }
    if (name === 'Odin') for (let i = 0; i < 5; i++) raven(c, ((400 + i * 46 - age * 9) % 570 + 570) % 570, 71 + Math.sin(age + i) * 4 + i % 2 * 12, .6, t + i, p.dark);
  });
  c.restore();
}

function ground(c, p, d, biome) {
  rect(c, p.dark, 0, GROUND, WIDTH, HEIGHT - GROUND);
  rect(c, p.edge, 0, GROUND, WIDTH, 2); rect(c, p.soil, 0, GROUND + 3, WIDTH, 16);
  const shift = d * SCALE;
  for (let i = Math.floor(shift / 17) - 1; i < Math.floor(shift / 17) + 31; i++) {
    const x = i * 17 - shift, n = noise(i + 61);
    rect(c, n > .5 ? p.edge : p.near, x, GROUND + 4 + n * 7, 2 + n * 5, 1);
    if (i % 3 === 0) line(c, p.dark, [[x + 8, GROUND + 4], [x + 6, GROUND + 10], [x + 10, GROUND + 12]]);
    if (biome !== 2 && i % 2 === 0) line(c, p.edge, [[x + 2, GROUND], [x, GROUND - 3], [x + 4, GROUND], [x + 6, GROUND - 2]]);
  }
  rect(c, p.near, 0, GROUND + 19, WIDTH, 1);
  alpha(c, .24, () => rect(c, '#0c1c20', 0, GROUND + 23, WIDTH, HEIGHT - GROUND - 23));
  for (let i = 0; i < 40; i++) rect(c, p.soil, (noise(i + Math.floor(d / 40)) * WIDTH + d * 2) % WIDTH, GROUND + 29 + noise(i + 12) * 23, 2, 1);
}

function obstacle(c, o, x, p, biome, t) {
  const w = o.width * SCALE, h = o.height * SCALE, base = GROUND;
  if (o.type === 'pit') {
    rect(c, '#101e22', x, base, w, HEIGHT - base);
    poly(c, p.near, [[x, base + 2], [x + 3, base + 5], [x + 2, base + 12], [x + 5, base + 17], [x + 3, base + 29], [x, base + 37]]);
    poly(c, p.soil, [[x + w, base + 2], [x + w - 3, base + 8], [x + w - 2, base + 17], [x + w - 5, base + 25], [x + w, base + 39]]);
    line(c, p.edge, [[x - 3, base], [x, base], [x + 1, base + 3]]); line(c, p.edge, [[x + w - 1, base + 3], [x + w, base], [x + w + 3, base]]);
    return;
  }
  if (o.type === 'branch') {
    const top = base - 1.8 * SCALE, low = base - .9 * SCALE;
    if (o.skin === 'raven') {
      // Keep the full obstacle silhouette visible, including its hanging tail.
      raven(c, x + w * .5, top + 4, w / 22, t, '#25333a');
      poly(c, '#25333a', [[x + w * .4, top + 3], [x + w * .68, top + 4], [x + w * .62, low], [x + w * .45, low - 2]]);
      rect(c, p.accent, x + w * .7, top + 3, 1, 1);
    } else if (o.skin === 'arrow') {
      line(c, '#342d2b', [[x, (top + low) / 2], [x + w, (top + low) / 2]], 2);
      poly(c, '#ede2c3', [[x, (top + low) / 2], [x + 5, top], [x + 5, low]]);
      line(c, '#926e4e', [[x + w - 5, top + 2], [x + w - 1, (top + low) / 2], [x + w - 5, low - 2]], 2);
    } else {
      rect(c, '#2c302c', x, top, w, low - top);
      rect(c, '#8d7956', x + 1, top + 1, w - 2, 3); rect(c, '#b5a47b', x + 2, top + 1, w - 4, 1);
      line(c, '#776343', [[x + 4, top + 5], [x + w * .7, low - 2], [x + w - 2, top + 5]]);
      if (o.skin === 'beam') { rect(c, '#c6b887', x + 2, top + 4, 2, 2); rect(c, '#c6b887', x + w - 4, top + 4, 2, 2); }
      else { rect(c, p.near, x + w * .25, top - 3, 5, 3); rect(c, p.mid, x + w * .6, top - 2, 4, 3); }
    }
    return;
  }
  const edge = '#292f2b', stone = biome === 2 ? '#b3bdc2' : '#899184', light = biome === 2 ? '#e5e8dd' : '#bfc1a8';
  if (o.skin === 'log' || o.skin === 'stump') {
    rect(c, edge, x, base - h, w, h); rect(c, '#806546', x + 1, base - h + 1, w - 2, h - 2);
    line(c, '#b99c70', [[x + 2, base - h + 2], [x + w - 2, base - h + 2]]);
    if (o.skin === 'log') { rect(c, '#cfb789', x + w - 5, base - h + 1, 4, h - 2); rect(c, '#8a704f', x + w - 4, base - h + 3, 2, h - 5); }
    else { rect(c, '#cdb78c', x + 1, base - h, w - 2, 2); rect(c, '#3b3d31', x + w * .5, base - h + 3, 1, h - 3); }
  } else if (o.skin === 'shield' || o.skin === 'wheel') {
    c.save(); c.beginPath(); c.rect(x, base - h, w, h); c.clip();
    circle(c, edge, x + w / 2, base - h / 2, Math.max(w, h) / 2);
    circle(c, o.skin === 'shield' ? '#8b5c4c' : '#9d855e', x + w / 2, base - h / 2, Math.max(w, h) / 2 - 1);
    if (o.skin === 'wheel') { for (let i = 0; i < 4; i++) { const a = i * Math.PI / 4; line(c, edge, [[x + w / 2 - Math.cos(a) * w / 2, base - h / 2 - Math.sin(a) * h / 2], [x + w / 2 + Math.cos(a) * w / 2, base - h / 2 + Math.sin(a) * h / 2]]); } }
    else { rect(c, '#c1ab75', x + w * .45, base - h, 2, h); rect(c, '#c1ab75', x, base - h * .55, w, 2); }
    rect(c, '#d6cdaa', x + w / 2 - 1, base - h / 2 - 1, 2, 2); c.restore();
  } else {
    poly(c, edge, [[x, base], [x, base - h + 3], [x + 3, base - h], [x + w - 3, base - h], [x + w, base - h + 3], [x + w, base]]);
    poly(c, stone, [[x + 1, base - 1], [x + 1, base - h + 3], [x + 4, base - h + 1], [x + w - 3, base - h + 1], [x + w - 1, base - h + 3], [x + w - 1, base - 1]]);
    line(c, light, [[x + 2, base - h + 4], [x + 4, base - h + 2], [x + w - 4, base - h + 2]]);
    if (o.skin === 'rune') rune(c, x + w / 2, base - h + 3, Math.max(3, h - 5), p.dark, 0);
    else line(c, '#626d63', [[x + w * .6, base - h + 3], [x + w * .4, base - h / 2], [x + w * .7, base - 2]]);
    if (biome === 2) rect(c, '#e5e8dd', x + 3, base - h, w - 6, 2);
  }
}

function viking(c, x, foot, t, y, duck, ended, p) {
  const crouch = y === 0 && duck, run = Math.floor(t * 10) % 4;
  const leg = y > 0 ? [2, -2] : [[-3, 3], [0, 0], [3, -3], [0, 0]][run];
  const headY = crouch ? -13 : -27, bodyY = crouch ? -9 : -18;
  c.save(); c.translate(Math.round(x), Math.round(foot));
  if (ended) { c.translate(1, -7); c.rotate(-.32); }
  // Boots and alternating legs; cloak, round shield, belt and braided beard.
  rect(c, '#263137', -4, -6, 3, 5 + (crouch ? 0 : leg[0])); rect(c, '#263137', 2, -6, 3, 5 + (crouch ? 0 : leg[1]));
  rect(c, '#182b30', -5, -2 + (crouch ? 0 : leg[0]), 5, 2); rect(c, '#182b30', 2, -2 + (crouch ? 0 : leg[1]), 5, 2);
  poly(c, '#563e3c', [[-3, bodyY - 1], [-8, bodyY + 2], [-9 - Math.floor(Math.sin(t * 11)), crouch ? -3 : -7], [-3, -5]]);
  rect(c, '#9c5d4c', -4, bodyY, crouch ? 11 : 8, crouch ? 6 : 12);
  rect(c, '#c08362', -3, bodyY + 1, 3, crouch ? 3 : 7); rect(c, '#d3b27b', -4, -7, crouch ? 11 : 8, 2); rect(c, '#493b31', 0, -7, 2, 2);
  rect(c, '#263137', -5, headY, 11, 10); rect(c, '#e0bd88', -3, headY + 3, 8, 6);
  rect(c, '#bd875c', -2, headY + 7, 7, 5); rect(c, '#deae70', 1, headY + 8, 3, 5); rect(c, '#263137', 3, headY + 4, 2, 1);
  rect(c, '#8d9e9d', -4, headY, 9, 4); rect(c, '#d0d1b9', -3, headY, 7, 1); rect(c, '#c5c7ae', -5, headY + 3, 11, 1);
  rect(c, '#d0d1b9', 0, headY - 2, 2, 5); rect(c, '#6e807e', 4, headY + 1, 1, 2);
  // Small horn-like side ornaments remain part of the compact retro silhouette.
  poly(c, '#d8cba3', [[-4, headY + 1], [-7, headY - 2], [-7, headY - 5], [-5, headY - 2], [-2, headY]]);
  poly(c, '#d8cba3', [[4, headY], [7, headY - 3], [7, headY - 5], [9, headY - 2], [7, headY + 2]]);
  circle(c, '#263137', -5, crouch ? -6 : -12, 5); circle(c, '#af7754', -5, crouch ? -6 : -12, 4);
  line(c, '#dfc38a', [[-8, crouch ? -6 : -12], [-2, crouch ? -6 : -12]]); line(c, '#dfc38a', [[-5, crouch ? -9 : -15], [-5, crouch ? -3 : -9]]); rect(c, '#d9d3b1', -6, crouch ? -7 : -13, 2, 2);
  c.restore();
  if (!ended && y === 0 && !crouch) for (let i = 0; i < 3; i++) {
    const age = (t * 3 + i / 3) % 1;
    alpha(c, (1 - age) * .35, () => rect(c, p.edge, x - 8 - age * 14, GROUND - 1 - age * 3, 2, 1));
  }
}

function hud(c, s, p) {
  c.save(); c.font = '8px monospace'; c.textBaseline = 'top';
  alpha(c, .82, () => { rect(c, '#172b2e', 12, 12, 146, 26); rect(c, p.accent, 12, 12, 2, 26); });
  c.fillStyle = '#e7e2cb'; c.fillText(places[s.environment], 22, 17); c.fillStyle = '#acb9aa'; c.font = '6px monospace'; c.fillText('MIDGARD / ' + String(s.section + 1).padStart(2, '0'), 22, 29);
  if (s.event) {
    const age = s.time - s.event.start, affecting = ['Odin', 'Ragnarok'].includes(s.event.name), title = affecting && age < 2 ? 'VARSEL: ' + s.event.name.toUpperCase() : s.event.name.toUpperCase();
    c.font = '8px monospace'; const w = c.measureText(title).width + 24;
    alpha(c, .88, () => rect(c, '#172b2e', WIDTH - w - 12, 12, w, 26));
    c.fillStyle = p.accent; c.fillText(title, WIDTH - w, 18);
    rect(c, '#41514c', WIDTH - w, 31, w - 24, 1); rect(c, p.accent, WIDTH - w, 31, (w - 24) * clamp((s.event.until - s.time) / (s.event.until - s.event.start)), 1);
  }
  // A small trail marker gives distance a place in the landscape.
  c.font = '6px monospace'; c.fillStyle = p.edge; c.fillText('ᚠ  VIKING DASH  ᚱ', 16, HEIGHT - 13);
  const speed = 8 + 8 * Math.min(s.distance / 1500, 1); c.textAlign = 'right'; c.fillStyle = p.edge; c.fillText(`${Math.floor(s.distance).toLocaleString('nb-NO')} M  /  ${speed.toFixed(1)} M/S`, WIDTH - 14, HEIGHT - 13);
  c.restore();
}

export function createVikingRenderer() {
  let surface, context;
  return function draw(ctx, w, h, s) {
    if (!surface) {
      surface = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(WIDTH, HEIGHT) : ctx.canvas.ownerDocument.createElement('canvas');
      surface.width = WIDTH; surface.height = HEIGHT; context = surface.getContext('2d');
    }
    const c = context, p = palettes[s.environment], transition = clamp(s.transition ?? 1);
    const strength = s.event ? Math.min(clamp((s.time - s.event.start) / 1.5), clamp((s.event.until - s.time) / 1.5)) : 0;
    c.clearRect(0, 0, WIDTH, HEIGHT); c.imageSmoothingEnabled = false;
    if (transition < 1 && s.previousEnvironment !== undefined && s.previousEnvironment !== s.environment) {
      const previous = palettes[s.previousEnvironment]; backdrop(c, previous, s.previousEnvironment, s.distance, s.time, s.event, strength);
      alpha(c, transition, () => backdrop(c, p, s.environment, s.distance, s.time, s.event, strength));
    } else backdrop(c, p, s.environment, s.distance, s.time, s.event, strength);
    const terrain = transition < 1 ? Object.fromEntries(Object.keys(p).map(key => [key, mix(palettes[s.previousEnvironment ?? s.environment][key], p[key], transition)])) : p;
    ground(c, terrain, s.distance, s.environment);
    const px = WIDTH * .18;
    for (const o of s.objects) {
      const x = px + (o.x - s.distance) * SCALE;
      if (x + o.width * SCALE >= -8 && x < WIDTH + 8) obstacle(c, o, x, terrain, s.environment, s.time);
    }
    if (s.y < .04) alpha(c, .25, () => rect(c, '#111e24', px - 8, GROUND - 1, 17, 2));
    viking(c, px, GROUND - s.y * SCALE, s.time, s.y, s.duck, s.ended, terrain);
    hud(c, s, p);
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, w, h); ctx.drawImage(surface, 0, 0, w, h); ctx.restore();
  };
}
