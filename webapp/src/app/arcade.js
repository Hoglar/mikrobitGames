import { el, button, link, field, errorBox } from './dom.js';
import { families, games, loadGame, formatScore } from '../games/registry.js';
import { chat } from './pages.js';

// The rack, cabinet and chat stay mounted when a cartridge changes.
export function createArcade({ root, ctx, selectGame }) {
  const track = el('div', { class: 'cartridge-track', 'aria-label': 'Velg spill', tabindex: '0' });
  const screen = el('div', { class: 'cabinet-screen' });
  const marquee = el('h2', {}, 'VELG ET SPILL');
  const slot = el('div', { class: 'cartridge-slot', 'aria-hidden': 'true' }, el('span', {}, 'INSERT CARTRIDGE'));
  const cabinet = el('section', { class: 'cabinet', 'aria-label': 'Spillmaskin' },
    el('div', { class: 'cabinet-marquee' }, marquee, el('span', { class: 'pill' }, 'MICRO:BIT V2')),
    slot, screen,
    el('div', { class: 'cabinet-controls', 'aria-hidden': 'true' }, el('span', { class: 'joystick' }),
      el('span', { class: 'control-label' }, 'TILT · PRESS · PLAY'), el('span', { class: 'arcade-button' }, 'A'), el('span', { class: 'arcade-button' }, 'B')));
  const board = createLeaderboard(ctx);
  const chatRoot = el('section', { class: 'arcade-chat', id: 'arcade-chat', 'aria-label': 'AI-chat' });
  const account = el('section', { class: 'arcade-account', hidden: true, 'aria-label': 'Kontoverktøy', tabindex: '-1' });
  const previous = button('←', () => move(-1), 'rack-arrow');
  const next = button('→', () => move(1), 'rack-arrow');
  previous.setAttribute('aria-label', 'Bla til forrige spill');
  next.setAttribute('aria-label', 'Bla til neste spill');
  root.append(el('div', { class: 'arcade-shell' },
    el('section', { class: 'arcade-intro' }, el('div', {},
      el('p', { class: 'eyebrow' }, 'BIT:ARCADE / PLAYER ONE'), el('h1', {}, 'Din egen spillhall.'),
      el('p', {}, `${families.length} spill. Én micro:bit. Jakten på neste rekord starter her.`)),
      el('span', { class: 'arcade-status' }, ctx.localPlay ? 'FREE PLAY · LOKAL ØVING' : 'INSERT MICRO:BIT · PRESS START')),
    el('section', { class: 'game-selector', id: 'games' },
      el('div', { class: 'selector-heading' }, el('div', {}, el('p', { class: 'eyebrow' }, '01 / VELG KASSETT'),
        el('h2', {}, 'Velg ditt neste eventyr.')), el('div', { class: 'actions' },
        el('span', { class: 'muted rack-hint' }, 'Rull · velg · spill'), previous, next)), track),
    el('div', { class: 'arcade-stage', id: 'arcade-stage' }, cabinet, board.root),
    account, chatRoot));

  const cards = new Map();
  for (const family of families) {
    const canvas = el('canvas', { width: 400, height: 220, 'aria-hidden': 'true' });
    const card = button('', () => selectGame(family.key), `game-cartridge game-card ${family.color}`);
    card.dataset.game = family.key;
    card.setAttribute('aria-label', `Last inn ${family.title}`);
    card.setAttribute('aria-pressed', 'false');
    card.append(el('span', { class: 'cartridge-cover' }, canvas),
      el('span', { class: 'cartridge-meta' }, `${family.number} / ${family.genre}`),
      el('span', { class: 'cartridge-title' }, family.title),
      el('span', { class: 'cartridge-control' }, `${family.control} · MICRO:BIT`));
    card.addEventListener('keydown', event => {
      const index = families.findIndex(f => f.key === family.key);
      const target = event.key === 'ArrowRight' ? index + 1 : event.key === 'ArrowLeft' ? index - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? families.length - 1 : null;
      if (target === null) return;
      event.preventDefault();
      const neighbor = cards.get(families[(target + families.length) % families.length].key);
      neighbor.focus({ preventScroll: true });
      neighbor.scrollIntoView({ block: 'nearest', inline: 'center', behavior: motion() });
    });
    cards.set(family.key, card);
    track.append(card);
    void loadGame(family.key).then(factory => factory({ config: { mode: 'standard', food: 'competitive' }, seed: 'cover' })).then(engine => {
      try { engine.draw(canvas.getContext('2d'), canvas.width, canvas.height); } finally { engine.dispose?.(); }
    }).catch(() => { canvas.hidden = true; });
  }
  function move(direction) { track.scrollBy({ left: direction * (cards.values().next().value.offsetWidth + 16), behavior: motion() }); }
  // A vertical wheel over the rack browses horizontally; the rest of the page scrolls normally.
  track.addEventListener('wheel', event => {
    if (event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY) || track.scrollWidth <= track.clientWidth) return;
    const delta = event.deltaY * (event.deltaMode === 1 ? 20 : event.deltaMode === 2 ? track.clientWidth : 1);
    const canMove = delta > 0 ? track.scrollLeft < track.scrollWidth - track.clientWidth - 1 : track.scrollLeft > 1;
    if (canMove) { event.preventDefault(); track.scrollLeft += delta; }
  }, { passive: false });

  let flight = null, flightTimer = null, chatView = null, chatOwner, chatGeneration = 0;
  const motion = () => matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
  function cancelFlight() {
    clearTimeout(flightTimer); flight?.cancel(); flight = null;
    document.querySelectorAll('.loading-cartridge').forEach(node => node.remove());
    cabinet.classList.remove('loading'); cabinet.removeAttribute('aria-busy');
  }
  function select(key, animate = false) {
    const family = families.find(f => f.key === key);
    for (const [id, card] of cards) { card.classList.toggle('selected', id === key); card.setAttribute('aria-pressed', String(id === key)); }
    marquee.textContent = family?.title.toUpperCase() ?? 'TESTLAB';
    cancelFlight();
    if (!family) return;
    board.show(games.find(game => game.key === key));
    if (!animate || motion() === 'instant') return;
    const card = cards.get(key), from = card.getBoundingClientRect(), to = slot.getBoundingClientRect();
    // Clone the label and copy the canvas so the moving cartridge matches the selected game.
    const ghost = card.cloneNode(true); ghost.className = `${card.className} loading-cartridge`;
    ghost.style.setProperty('--cartridge-color', getComputedStyle(card).getPropertyValue('--cartridge-color'));
    ghost.removeAttribute('data-game');
    ghost.removeAttribute('aria-label'); ghost.removeAttribute('aria-pressed'); ghost.setAttribute('aria-hidden', 'true');
    ghost.tabIndex = -1; ghost.disabled = true;
    const source = card.querySelector('canvas'), copy = ghost.querySelector('canvas');
    copy.getContext('2d').drawImage(source, 0, 0);
    Object.assign(ghost.style, { position: 'fixed', left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`, margin: '0', zIndex: '80', pointerEvents: 'none' });
    document.body.append(ghost); cabinet.classList.add('loading'); cabinet.setAttribute('aria-busy', 'true');
    const x = to.left + to.width / 2 - (from.left + from.width / 2), y = to.top - from.top - from.height * .65;
    flight = ghost.animate([
      { transform: 'translate(0,0) rotate(0)', opacity: 1 },
      { transform: `translate(${x}px,${y}px) scale(.55) rotate(-5deg)`, opacity: 1, offset: .6 },
      { transform: `translate(${x}px,${y + from.height * .38}px) scale(.4,.06) rotate(0)`, opacity: 0 }
    ], { duration: 760, easing: 'cubic-bezier(.35,0,.2,1)', fill: 'forwards' });
    flightTimer = setTimeout(cancelFlight, 780);
  }
  function empty() {
    screen.replaceChildren(el('div', { class: 'cabinet-empty' },
      el('span', { class: 'standby-pixels', 'aria-hidden': 'true' }, '▟ ▙'),
      el('p', { class: 'eyebrow' }, 'READY PLAYER ONE'), el('h2', {}, 'Sett inn et spill.'),
      el('p', {}, 'Velg en kassett fra spillhyllen over. Koble til micro:bit og gjør deg klar.'),
      button('Velg et spill ↑', () => { cards.get('snake').focus(); track.scrollIntoView({ block: 'center', behavior: motion() }); }, 'button light')));
  }
  async function refreshChat() {
    const owner = ctx.localPlay ? 'local' : ctx.session?.player.id ?? 'guest';
    if (chatOwner === owner) return;
    chatOwner = owner;
    const version = ++chatGeneration, previous = chatView;
    chatView = null;
    if (previous) previous.active = false;
    await previous?.dispose?.();
    if (version !== chatGeneration) return;
    chatRoot.replaceChildren();
    if (ctx.session && !ctx.localPlay) {
      chatView = { active: true };
      await chat({ root: chatRoot, ctx, view: chatView });
    } else {
      chatView = null;
      const question = el('textarea', { 'aria-label': 'Ditt spørsmål', disabled: true, placeholder: 'Spør om rekorder, spillere og neste utfordring …' });
      chatRoot.append(el('div', { class: 'page-heading' }, el('p', { class: 'eyebrow' }, '03 / SPILLASSISTENTEN'),
        el('h2', {}, 'AI-chat'), el('p', { class: 'muted' }, ctx.localPlay ? 'AI-chat er deaktivert i lokal øving. Den er tilgjengelig i den tilkoblede appen.' : 'Logg inn for å spørre om offentlige rekorder og sammenligne resultater.')),
        el('div', { class: 'panel' }, field('Hva lurer du på?', question), ctx.localPlay ? el('span', { class: 'pill' }, 'LOKAL ØVING · AI FRAKOBLET') : link('Logg inn for å chatte', '#/login?next=/ai', 'button')));
    }
  }
  empty(); void refreshChat();
  return { screen, account, board, select, empty, refreshChat, cancelFlight,
    focusChat: () => chatRoot.scrollIntoView({ behavior: motion(), block: 'start' }) };
}

function createLeaderboard(ctx) {
  const title = el('h2', {}, 'HIGH SCORES'), mode = el('p', { class: 'leaderboard-mode' }, 'Velg et spill for å se rekorder.'),
    content = el('div', { class: 'leaderboard-content', 'aria-live': 'polite' });
  const root = el('aside', { class: 'arcade-leaderboard', 'aria-label': 'Toppliste for valgt modus' },
    el('div', { class: 'leaderboard-heading' }, el('p', { class: 'eyebrow' }, '02 / TOPPLISTE'), title,
      el('span', { class: 'leaderboard-trophy', 'aria-hidden': 'true' }, '★')), mode, content);
  let selected = null, generation = 0, page = 0;
  function idle() { generation++; selected = null; root.removeAttribute('data-game-id'); mode.textContent = 'Velg et spill for å se rekorder.'; content.replaceChildren(el('p', { class: 'notice' }, 'Neste rekord kan bli din.')); }
  async function load() {
    const version = ++generation, game = selected;
    if (!game) return;
    mode.textContent = game.name;
    root.dataset.gameId = game.id;
    if (ctx.localPlay) { content.replaceChildren(el('p', { class: 'notice' }, 'Lokal øving · topplister er frakoblet. Resultatene dine lagres ikke.')); return; }
    content.replaceChildren(el('p', { class: 'notice' }, 'Laster rekorder …'));
    try {
      const data = (await ctx.api(`/games/${game.id}/leaderboard?page=${page}&page_size=10`)).data;
      if (version !== generation) return;
      if (!Array.isArray(data.items)) throw new Error('Ugyldig toppliste.');
      if (!data.items.length) content.replaceChildren(el('div', { class: 'leaderboard-empty' }, el('span', { 'aria-hidden': 'true' }, '---'), el('p', {}, 'Ingen rekorder ennå.'), el('p', { class: 'muted' }, 'Bli den første på listen.')));
      else content.replaceChildren(el('div', { class: 'table-wrap' }, el('table', {},
        el('thead', {}, el('tr', {}, ['#', 'Spiller', 'Resultat'].map(label => el('th', {}, label)))),
        el('tbody', {}, data.items.map(row => el('tr', { class: row.player.id === ctx.session?.player.id ? 'highlight' : '' },
          el('td', { class: 'leaderboard-rank' }, String(row.rank).padStart(2, '0')),
          el('td', {}, link(row.player.username, `#/history/${game.id}?player=${encodeURIComponent(row.player.id)}`, 'text-button')),
          el('td', {}, formatScore(game, row.record.value))))))));
      if (page > 0 || (page + 1) * 10 < data.total) {
        const prev = button('←', () => { page--; void load(); }, 'rack-arrow'), next = button('→', () => { page++; void load(); }, 'rack-arrow');
        prev.disabled = page === 0; next.disabled = (page + 1) * 10 >= data.total;
        prev.setAttribute('aria-label', 'Forrige rekordside'); next.setAttribute('aria-label', 'Neste rekordside');
        content.append(el('div', { class: 'pagination' }, prev, el('span', {}, `SIDE ${page + 1}`), next));
      }
      content.append(button('Oppdater rekorder ↻', () => { void load(); }, 'text-button'));
    } catch (error) {
      if (version !== generation) return;
      content.replaceChildren(errorBox(`Topplisten er utilgjengelig. ${error.message}`), button('Prøv igjen', () => { void load(); }, 'button secondary'));
    }
  }
  idle();
  return { root, idle, show(game) { if (selected?.id === game.id) return; selected = game; page = 0; void load(); }, refresh() { if (selected) void load(); } };
}
