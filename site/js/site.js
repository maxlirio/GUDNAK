// GUDNAK card library.
//
// Two views over site/data/cards.json:
//   Library — one tile per UNIQUE card. Alternate art is the same card with a
//             different picture, so it does not get its own tile.
//   Decks   — deck names only, until you open one. Inside a deck every copy is
//             shown, and copies wear different art where a printing exists.

const FACTION_COLOR = {
  Gloaming: 'var(--gloaming)', Shardsworn: 'var(--shardsworn)',
  Refractory: 'var(--refractory)', Marvorren: 'var(--marvorren)', Neutral: 'var(--neutral)',
};

// Card images live under site/; index.html is served from the repo root.
const BASE = 'site/';

const ROMAN = { 1: 'I', 2: 'II', 3: 'III' };
const ABILITY_LABEL = { constant: 'constant', action: 'action', deployment: 'deploy', passive: 'passive' };

const els = {
  tabs: document.getElementById('viewtabs'),
  library: document.getElementById('library-view'),
  decksView: document.getElementById('decks-view'),
  grid: document.getElementById('library-grid'),
  deckList: document.getElementById('deck-list'),
  deckDetail: document.getElementById('deck-detail'),
  q: document.getElementById('q'),
  chips: document.getElementById('faction-chips'),
  empty: document.getElementById('empty'),
  lb: document.getElementById('lightbox'),
  lbImg: document.getElementById('lb-img'),
  lbInfo: document.getElementById('lb-info'),
};

let DATA = { cards: [], decks: [] };
let byUid = new Map();
let factionFilter = null;

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const baseFaction = (f) => (f || '').replace(/\s*\(.*$/, '').trim();
const slugOf = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function haystack(card) {
  return [
    card.name, card.type, card.kind, card.text,
    ...(card.arts || []).map((a) => a.code),
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

/**
 * Which art each copy in a deck should wear. The deck's own printings come
 * first, then any other printing of the same card so repeated copies look
 * different, and only then does it start repeating.
 */
function artsForCopies(card, count, deckCodes = []) {
  const pool = [];
  for (const code of deckCodes) {
    const a = card.arts.find((x) => x.code === code);
    if (a && !pool.includes(a)) pool.push(a);
  }
  for (const a of card.arts) if (!pool.includes(a)) pool.push(a);
  return Array.from({ length: count }, (_, i) => pool[i % pool.length] || card.arts[0]);
}

function cardTile(card, art, note) {
  const b = document.createElement('button');
  b.className = 'card';
  b.type = 'button';
  const label = card.power ? `${ROMAN[card.power]} ${card.name}` : card.name;
  b.innerHTML = `
    <img loading="lazy" src="${BASE}${esc(art.img)}.thumb.jpg" alt="${esc(card.name)}">
    ${note ? `<span class="dupe">${esc(note)}</span>` : ''}
    <span class="cap">${esc(label)}</span>`;
  b.addEventListener('click', () => openLightbox(card, card.arts.indexOf(art)));
  return b;
}

/* ------------------------------------------------------------ library */

function renderLibrary() {
  const q = els.q.value.trim().toLowerCase();
  const list = DATA.cards.filter((c) => {
    if (factionFilter && baseFaction(c.faction) !== factionFilter) return false;
    if (q && !haystack(c).includes(q)) return false;
    return true;
  });

  els.grid.innerHTML = '';
  for (const c of list) {
    els.grid.appendChild(cardTile(c, c.arts[0],
      c.arts.length > 1 ? `${c.arts.length} arts` : null));
  }
  els.empty.hidden = list.length > 0;
  document.getElementById('library-count').textContent =
    `${list.length} of ${DATA.cards.length} cards`;
}

/* ------------------------------------------------------------ decks */

function renderDeckList() {
  els.deckDetail.hidden = true;
  els.deckList.hidden = false;
  els.deckList.innerHTML = '';

  for (const d of DATA.decks) {
    const total = d.entries.reduce((n, e) => n + e.count, 0);
    const colour = FACTION_COLOR[baseFaction(d.faction)] || 'var(--neutral)';

    // a few faces as a preview, so the row is not just words
    const preview = d.entries.slice(0, 6).map((e) => {
      const c = byUid.get(e.uid);
      return c ? `<img loading="lazy" src="${BASE}${esc(c.arts[0].img)}.thumb.jpg" alt="">` : '';
    }).join('');

    const row = document.createElement('button');
    row.className = 'deckrow';
    row.type = 'button';
    row.innerHTML = `
      <div class="deckrow-main">
        <h3>${esc(d.deck)}</h3>
        <div class="deckrow-badges">
          <span class="badge faction" style="color:${colour}">${esc(d.faction || '—')}</span>
          ${d.legal ? '<span class="badge legal">legal deck</span>'
                    : '<span class="badge incomplete">incomplete</span>'}
          <span class="badge" style="color:var(--muted);border-color:var(--line)">${total} cards</span>
        </div>
      </div>
      <div class="deckrow-peek">${preview}</div>
      <span class="deckrow-go">View deck →</span>`;
    row.addEventListener('click', () => openDeck(d));
    els.deckList.appendChild(row);
  }
}

function openDeck(d) {
  els.deckList.hidden = true;
  els.deckDetail.hidden = false;
  const total = d.entries.reduce((n, e) => n + e.count, 0);
  const colour = FACTION_COLOR[baseFaction(d.faction)] || 'var(--neutral)';

  els.deckDetail.innerHTML = `
    <button class="backbtn" type="button">← All decks</button>
    <div class="deckhead">
      <h3>${esc(d.deck)}</h3>
      <span class="badge faction" style="color:${colour}">${esc(d.faction || '—')}</span>
      ${d.legal ? '<span class="badge legal">legal deck</span>'
                : '<span class="badge incomplete">incomplete</span>'}
      <span class="badge" style="color:var(--muted);border-color:var(--line)">${total} cards</span>
    </div>
    ${d.note ? `<p class="deckmeta">${esc(d.note)}</p>` : ''}
    ${!d.legal && d.incomplete ? `<p class="deckmeta">Missing ${esc(d.incomplete.missing)}</p>` : ''}
    <div class="cardgrid" id="deck-grid"></div>`;

  history.replaceState(null, '', `#deck-${slugOf(d.deck)}`);
  els.deckDetail.querySelector('.backbtn').addEventListener('click', () => {
    history.replaceState(null, '', '#decks');
    renderDeckList();
  });

  // heroes last, fighters before tactic-slot cards, then by power
  const slotOrder = { fighter: 0, tactic: 1, construct: 1, attachment: 1 };
  const grid = els.deckDetail.querySelector('#deck-grid');
  const entries = [...d.entries].sort((a, b) => {
    const ca = byUid.get(a.uid), cb = byUid.get(b.uid);
    if (!ca || !cb) return 0;
    return (ca.kind === 'hero') - (cb.kind === 'hero')
        || slotOrder[ca.type] - slotOrder[cb.type]
        || (ca.power ?? 9) - (cb.power ?? 9)
        || ca.name.localeCompare(cb.name);
  });

  for (const e of entries) {
    const card = byUid.get(e.uid);
    if (!card) continue;
    artsForCopies(card, e.count, e.codes).forEach((art, i) => {
      grid.appendChild(cardTile(card, art, e.count > 1 ? `copy ${i + 1} of ${e.count}` : null));
    });
  }
}

/* ------------------------------------------------------------ lightbox */

function openLightbox(card, artIndex = 0, push = true) {
  const idx = Math.max(0, artIndex);
  const art = card.arts[idx] || card.arts[0];
  if (push && art.code) history.replaceState(null, '', `#card-${art.code}`);

  els.lbImg.src = `${BASE}${art.img}.jpg`;
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
  if (art.credit) notes.push(art.credit);

  const artSwitch = card.arts.length > 1 ? `
    <div class="artrow">
      <span class="artlabel">${card.arts.length} printings</span>
      ${card.arts.map((a, i) => `
        <button class="artbtn" type="button" data-i="${i}" aria-pressed="${i === idx}">
          <img src="${BASE}${esc(a.img)}.thumb.jpg" alt="${esc(a.code || '')}">
        </button>`).join('')}
    </div>` : '';

  els.lbInfo.innerHTML = `
    <h3>${esc(card.name)}</h3>
    <p class="sub">${esc(statLine(card))}${card.faction ? ` · ${esc(card.faction)}` : ''}</p>
    ${abilities}${body}
    ${artSwitch}
    <div class="code">${esc(art.code || 'no collector code')}${
      notes.length ? ` — ${esc(notes.join(' '))}` : ''}${
      card.decks?.length ? `<br>In: ${esc(card.decks.join(', '))}` : ''}</div>`;

  els.lbInfo.querySelectorAll('.artbtn').forEach((b) => {
    b.addEventListener('click', () => openLightbox(card, Number(b.dataset.i)));
  });

  els.lb.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  els.lb.hidden = true;
  document.body.style.overflow = '';
  if (location.hash.startsWith('#card-')) history.replaceState(null, '', location.pathname);
}

function openFromHash() {
  const m = /^#card-(.+)$/.exec(decodeURIComponent(location.hash));
  if (!m) return;
  for (const c of DATA.cards) {
    const i = c.arts.findIndex((a) => a.code === m[1]);
    if (i >= 0) { openLightbox(c, i, false); return; }
  }
}

/* ------------------------------------------------------------ views */

function setView(next) {
  els.library.hidden = next !== 'library';
  els.decksView.hidden = next !== 'decks';
  for (const b of els.tabs.children) b.setAttribute('aria-pressed', String(b.dataset.view === next));
  if (next === 'decks') renderDeckList();
}

document.getElementById('lb-close').addEventListener('click', closeLightbox);
els.lb.addEventListener('click', (e) => { if (e.target === els.lb) closeLightbox(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });
els.q.addEventListener('input', renderLibrary);

fetch('site/data/cards.json')
  .then((r) => r.json())
  .then((data) => {
    DATA = data;
    byUid = new Map(data.cards.map((c) => [c.uid, c]));

    const factions = new Set(data.cards.map((c) => baseFaction(c.faction)).filter(Boolean));
    const totalInDecks = data.decks.reduce(
      (n, d) => n + d.entries.reduce((m, e) => m + e.count, 0), 0);

    document.getElementById('s-cards').textContent = data.cards.length;
    document.getElementById('s-copies').textContent = totalInDecks;
    document.getElementById('s-decks').textContent = data.decks.length;
    document.getElementById('s-factions').textContent =
      [...factions].filter((f) => f !== 'Neutral').length;

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
        renderLibrary();
      });
      return b;
    };
    els.chips.appendChild(mk('All', null));
    els.chips.firstChild.setAttribute('aria-pressed', 'true');
    for (const f of [...factions].sort()) els.chips.appendChild(mk(f, f));

    for (const b of els.tabs.children) b.addEventListener('click', () => setView(b.dataset.view));

    renderLibrary();
    // #decks (or #deck-<name>) opens the deck side directly, which also makes
    // the two views linkable.
    const deckHash = /^#deck-(.+)$/.exec(decodeURIComponent(location.hash));
    setView(location.hash === '#decks' || deckHash ? 'decks' : 'library');
    if (deckHash) {
      const d = DATA.decks.find((x) => slugOf(x.deck) === deckHash[1]);
      if (d) openDeck(d);
    }
    openFromHash();

    if (location.hash && !location.hash.startsWith('#card-')) {
      const target = document.querySelector(location.hash);
      if (target) target.scrollIntoView();
    }
  })
  .catch((e) => {
    els.grid.innerHTML = `<p class="empty">Could not load the card data (${esc(e.message)}).</p>`;
  });
