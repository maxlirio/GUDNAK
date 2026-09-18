// GUDNAK card library — renders site/data/cards.json, filters, and a lightbox.
// No framework, no build step.

const FACTION_COLOR = {
  Gloaming: 'var(--gloaming)', Shardsworn: 'var(--shardsworn)',
  Refractory: 'var(--refractory)', Marvorren: 'var(--marvorren)', Neutral: 'var(--neutral)',
};

// Card images live under site/; index.html is served from the repo root.
const BASE = 'site/';

const ROMAN = { 1: 'I', 2: 'II', 3: 'III' };
const ABILITY_LABEL = { constant: 'constant', action: 'action', deployment: 'deploy', passive: 'passive' };

const els = {
  decks: document.getElementById('decks'),
  q: document.getElementById('q'),
  chips: document.getElementById('faction-chips'),
  empty: document.getElementById('empty'),
  lb: document.getElementById('lightbox'),
  lbImg: document.getElementById('lb-img'),
  lbInfo: document.getElementById('lb-info'),
};

let DATA = { decks: [] };
let factionFilter = null;

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// A deck's faction string can read "Marvorren (+ Neutral)"; the base name is
// what the colour and the filter key off.
const baseFaction = (f) => (f || '').replace(/\s*\(.*$/, '').trim();

/** Everything a search should be able to hit. */
function haystack(card) {
  return [
    card.name, card.code, card.type, card.kind, card.text,
    ...(card.traits || []), ...(card.keywords || []),
    ...(card.abilities || []).flatMap((a) => [a.name, a.text, a.k]),
  ].filter(Boolean).join(' ').toLowerCase();
}

function statLine(card) {
  const bits = [];
  if (card.power) bits.push(ROMAN[card.power]);
  if (card.kind === 'hero') bits.push('Hero');
  else if (card.kind === 'basic') bits.push('Basic');
  if (card.type !== 'fighter') bits.push(card.type[0].toUpperCase() + card.type.slice(1));
  if (card.cost != null) bits.push(`cost ${card.cost}`);
  const traits = (card.traits || []).filter((t) => t !== 'Hero');
  if (traits.length) bits.push(traits.join(' · '));
  return bits.join(' · ');
}

function cardTile(card) {
  const b = document.createElement('button');
  b.className = 'card';
  b.type = 'button';
  const label = card.power ? `${ROMAN[card.power]} ${card.name}` : card.name;
  b.innerHTML = `
    <img loading="lazy" src="${BASE}${esc(card.img)}.thumb.jpg" alt="${esc(card.name)}">
    ${card.duplicate ? '<span class="dupe">2nd copy</span>' : ''}
    <span class="cap">${esc(label)}</span>`;
  b.addEventListener('click', () => openLightbox(card));
  return b;
}

function render() {
  const q = els.q.value.trim().toLowerCase();
  els.decks.innerHTML = '';
  let shown = 0;

  for (const deck of DATA.decks) {
    const deckFaction = baseFaction(deck.faction);
    const cards = deck.cards.filter((c) => {
      const f = c.faction || deckFaction;
      if (factionFilter && baseFaction(f) !== factionFilter) return false;
      if (q && !haystack(c).includes(q)) return false;
      return true;
    });
    if (!cards.length) continue;
    shown += cards.length;

    const sec = document.createElement('section');
    sec.className = 'deck';
    const colour = FACTION_COLOR[deckFaction] || 'var(--neutral)';
    const status = deck.legal
      ? '<span class="badge legal">legal deck</span>'
      : '<span class="badge incomplete">incomplete</span>';
    const meta = deck.legal
      ? (deck.note ? esc(deck.note) : '')
      : esc(deck.incomplete ? `Missing ${deck.incomplete.missing}` : '');

    sec.innerHTML = `
      <div class="deckhead">
        <h3>${esc(deck.deck)}</h3>
        <span class="badge faction" style="color:${colour}">${esc(deck.faction || '—')}</span>
        ${status}
        <span class="badge" style="color:var(--muted);border-color:var(--line)">${cards.length} shown</span>
      </div>
      ${meta ? `<p class="deckmeta">${meta}</p>` : ''}
      <div class="cardgrid"></div>`;

    const grid = sec.querySelector('.cardgrid');
    for (const c of cards) grid.appendChild(cardTile(c));
    els.decks.appendChild(sec);
  }

  els.empty.hidden = shown > 0;
}

function openLightbox(card, push = true) {
  // Cards are addressable: #card-C087 opens that card directly, so a link to a
  // specific card can be shared.
  if (push && card.code) history.replaceState(null, '', `#card-${card.code}`);
  els.lbImg.src = `${BASE}${card.img}.jpg`;
  els.lbImg.alt = card.name;

  const abilities = (card.abilities || []).map((a) => `
    <div class="ab">
      ${a.name ? `<span class="abname">${esc(a.name)}</span>` : ''}
      <span class="abkind">${esc(ABILITY_LABEL[a.k] || a.k)}</span>
      <div>${esc(a.text)}</div>
    </div>`).join('');

  const body = card.text ? `<div class="ab"><div>${esc(card.text)}</div></div>` : '';
  const notes = [];
  if (card.trap) notes.push('Played facedown as a Trap.');
  if (card.keywords?.length) notes.push(`Keywords: ${card.keywords.join(', ')}.`);
  if (card.mergedFrom) notes.push(`Merged in from the ${card.mergedFrom} folder.`);
  if (card.credit) notes.push(card.credit);

  els.lbInfo.innerHTML = `
    <h3>${esc(card.name)}</h3>
    <p class="sub">${esc(statLine(card))}${card.faction ? ` · ${esc(card.faction)}` : ''}</p>
    ${abilities}${body}
    <div class="code">${esc(card.code || 'no collector code')}${
      notes.length ? ` — ${esc(notes.join(' '))}` : ''}</div>`;

  els.lb.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  els.lb.hidden = true;
  document.body.style.overflow = '';
  if (location.hash.startsWith('#card-')) history.replaceState(null, '', location.pathname);
}

/** Open whatever card the URL hash names, if any. */
function openFromHash() {
  const m = /^#card-(.+)$/.exec(decodeURIComponent(location.hash));
  if (!m) return;
  for (const d of DATA.decks) {
    const hit = d.cards.find((c) => c.code === m[1]);
    if (hit) { openLightbox(hit, false); return; }
  }
}

document.getElementById('lb-close').addEventListener('click', closeLightbox);
els.lb.addEventListener('click', (e) => { if (e.target === els.lb) closeLightbox(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });
els.q.addEventListener('input', render);

fetch('site/data/cards.json')
  .then((r) => r.json())
  .then((data) => {
    DATA = data;

    const factions = new Set();
    let total = 0;
    for (const d of data.decks) {
      for (const c of d.cards) {
        factions.add(baseFaction(c.faction || d.faction));
        total++;
      }
    }

    document.getElementById('s-cards').textContent = total;
    document.getElementById('s-decks').textContent = data.decks.length;
    document.getElementById('s-factions').textContent =
      [...factions].filter((f) => f !== 'Neutral').length;

    // faction chips
    const mk = (label, value) => {
      const b = document.createElement('button');
      b.className = 'chip';
      b.type = 'button';
      b.textContent = label;
      b.setAttribute('aria-pressed', String(factionFilter === value));
      if (value && FACTION_COLOR[value]) b.style.borderColor = FACTION_COLOR[value];
      b.addEventListener('click', () => {
        factionFilter = factionFilter === value ? null : value;
        [...els.chips.children].forEach((c) => c.setAttribute('aria-pressed', 'false'));
        if (factionFilter) b.setAttribute('aria-pressed', 'true');
        else els.chips.firstChild.setAttribute('aria-pressed', 'true');
        render();
      });
      return b;
    };
    els.chips.appendChild(mk('All', null));
    els.chips.firstChild.setAttribute('aria-pressed', 'true');
    for (const f of [...factions].sort()) els.chips.appendChild(mk(f, f));

    render();
    openFromHash();

    // The grid renders after the browser has already jumped to any #section
    // anchor, and the page grows under it — so re-aim at the target once the
    // real height exists.
    if (location.hash && !location.hash.startsWith('#card-')) {
      const target = document.querySelector(location.hash);
      if (target) target.scrollIntoView();
    }
  })
  .catch((e) => {
    els.decks.innerHTML = `<p class="empty">Could not load the card data (${esc(e.message)}).</p>`;
  });
