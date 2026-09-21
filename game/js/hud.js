// The flat UI over the battlefield: whose turn, actions left, both Strongholds,
// the active player's hand, and a running log.
//
// Everything in here is DOM. The scene never draws text.

import { cardFaceDataURL } from './textures.js';

const ROMAN = { 1: 'I', 2: 'II', 3: 'III' };

/**
 * The thumbnail for a card, whether or not it was ever painted.
 *
 * A card with no art used to get an empty `<div class="noart">` here — a blank
 * panel with the name beside it — in the hand, the stack panel, the graveyard
 * and the end screen. Migration is the only card in the game with no art and
 * the player's report was "the card for Migration was missing", which it was,
 * in five places. The table draws such a card from what it says about itself
 * (see ./textures.js), and this is the same picture as a data URL, which is
 * the only thing an `<img src>` will take.
 */
function thumb(def, cls = 'noart') {
  if (!def) return `<div class="${cls}"></div>`;
  if (def.img) return `<img src="../site/${def.img}.thumb.jpg" alt="">`;
  const url = cardFaceDataURL(def);
  return url ? `<img src="${url}" alt="">` : `<div class="${cls}"></div>`;
}

export class Hud {
  constructor(root, { onHandPick, onEndHint }) {
    this.root = root;
    this.onHandPick = onHandPick;
    this.selectedUid = null;

    root.innerHTML = `
      <div class="hud-top">
        <button class="exitbtn" id="exitbtn" type="button" title="Leave this game">Leave</button>
        <div class="stronghold" id="sh-1">
          <span class="who" id="who-1">—</span>
          <span class="deck" id="deck-1">—</span>
          <span class="lbl">cards left</span>
        </div>
        <div class="turnbox">
          <div class="turn" id="turnline">—</div>
          <div class="actions" id="actiondots"></div>
          <div class="hint" id="hint"></div>
        </div>
        <div class="stronghold" id="sh-0">
          <span class="who" id="who-0">—</span>
          <span class="deck" id="deck-0">—</span>
          <span class="lbl">cards left</span>
        </div>
      </div>

      <div class="hud-log" id="log"></div>

      <div class="hud-hand" id="hand"></div>

      <div class="banner" id="banner" hidden></div>

      <div class="actionmenu" id="actionmenu" hidden></div>

      <div class="stackpanel" id="stackpanel" hidden></div>
      <div class="sppeek" id="sppeek" hidden><img id="sppeekimg" alt=""></div>
      <div class="cardzoom" id="cardzoom" hidden><img id="zoomimg" alt=""></div>

      <div class="choice" id="choice" hidden>
        <div class="choice-prompt" id="choice-prompt"></div>
        <div class="choice-opts" id="choice-opts"></div>
      </div>`;

    this.turnline = root.querySelector('#turnline');
    this.dots = root.querySelector('#actiondots');
    this.hintEl = root.querySelector('#hint');
    this.handEl = root.querySelector('#hand');
    this.logEl = root.querySelector('#log');
    this.bannerEl = root.querySelector('#banner');
    this.menuEl = root.querySelector('#actionmenu');
    this.stackEl = root.querySelector('#stackpanel');
    this.peekEl = root.querySelector('#sppeek');
    this.peekImg = root.querySelector('#sppeekimg');
    this.zoomEl = root.querySelector('#cardzoom');
    this.zoomImg = root.querySelector('#zoomimg');
    this.zoomEl.addEventListener('click', () => { this.zoomEl.hidden = true; });
    this.choiceEl = root.querySelector('#choice');
    this.choicePrompt = root.querySelector('#choice-prompt');
    this.choiceOpts = root.querySelector('#choice-opts');
    this.deckEls = [root.querySelector('#deck-0'), root.querySelector('#deck-1')];
    this.whoEls = [root.querySelector('#who-0'), root.querySelector('#who-1')];
    this.shEls = [root.querySelector('#sh-0'), root.querySelector('#sh-1')];
  }

  hint(text) { this.hintEl.textContent = text || this.idleHint || ''; }

  /** Shown whenever there is nothing more pressing to say. */
  setIdleHint(text) { this.idleHint = text; }

  log(line) {
    const p = document.createElement('div');
    p.textContent = line;
    this.logEl.appendChild(p);
    while (this.logEl.children.length > 7) this.logEl.removeChild(this.logEl.firstChild);
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  /**
   * `onAgain` adds a way out. A finished game used to state the result and
   * then simply sit there with nothing to click.
   */
  banner(text, tone = '', { onAgain = null } = {}) {
    if (!text) { this.bannerEl.hidden = true; return; }
    this.bannerEl.className = `banner ${tone}`;
    this.bannerEl.hidden = false;
    this.bannerEl.innerHTML = '';
    const t = document.createElement('div');
    t.className = 'bannertext';
    t.textContent = text;
    this.bannerEl.appendChild(t);
    if (onAgain) {
      const b = document.createElement('button');
      b.className = 'bigbtn bannerbtn';
      b.type = 'button';
      b.textContent = 'Back to the lobby';
      b.addEventListener('click', onAgain);
      this.bannerEl.appendChild(b);
    }
  }

  onExit(fn) {
    this.root.querySelector('#exitbtn').addEventListener('click', fn);
  }

  /** Redraw from engine state. `defs` supplies names and art for hand cards. */
  /** `names` are the two decks, which is what each side is called. */
  render(state, defs, { sieged, names, handOf }) {
    const p = state.active;
    this.turnline.textContent = names[p];
    this.turnline.className = `turn p${p}`;
    for (let i = 0; i < 2; i++) this.whoEls[i].textContent = names[i];

    this.dots.innerHTML = '';
    // Cards grant extra actions (Time Warp, Temporal Shed), so the row cannot
    // be a fixed two — showing two dots when you hold three is how you end up
    // believing a 2-action card was playable on one action.
    const base = state.turn === 1 ? 1 : 2;
    const max = Math.max(base, state.actionsLeft);
    for (let i = 0; i < max; i++) {
      const d = document.createElement('i');
      d.className = i < state.actionsLeft ? 'dot on' : 'dot';
      this.dots.appendChild(d);
    }

    for (let i = 0; i < 2; i++) {
      this.deckEls[i].textContent = state.players[i].deck.length;
      this.shEls[i].classList.toggle('active', state.active === i);
      this.shEls[i].classList.toggle('sieged', !!sieged[i]);
    }

    this.#renderHand(state, defs, handOf ?? state.active);
  }

  #renderHand(state, defs, who) {
    // Online this is always YOUR hand, never the active player's — otherwise
    // the screen would show the opponent's cards on their turn.
    const p = who;
    const hand = state.players[p].hand;
    this.handEl.innerHTML = '';

    for (const c of hand) {
      const def = defs[c.def] || {};
      const el = document.createElement('button');
      el.className = 'handcard';
      el.type = 'button';
      if (c.uid === this.selectedUid) el.classList.add('sel');
      if (def.type !== 'fighter') el.classList.add('tacticcard');

      // A card you cannot pay for should SAY so. Doom Bolt costs two actions,
      // and with one left it simply refused to be played with no explanation.
      const cost = def.type === 'fighter' ? 1 : (def.cost ?? 1);
      const affordable = state.active === p && cost <= state.actionsLeft;
      if (!affordable && state.active === p) {
        el.classList.add('unaffordable');
        el.title = `Costs ${cost} action${cost === 1 ? '' : 's'} — you have ${state.actionsLeft}.`;
      }

      el.innerHTML = `
        ${thumb(def)}
        <span class="hc-name">${def.power ? ROMAN[def.power] + ' ' : ''}${def.name || '?'}</span>
        ${def.cost != null ? `<span class="hc-cost${affordable ? '' : ' short'}">${def.cost}</span>` : ''}
        ${def.inert ? '<span class="hc-inert" title="This card’s effect is not implemented yet">no effect yet</span>' : ''}`;

      el.dataset.uid = String(c.uid);
      el.addEventListener('click', () => this.onHandPick(c, def));
      this.handEl.appendChild(el);
    }

    if (!hand.length) {
      const empty = document.createElement('div');
      empty.className = 'handempty';
      empty.textContent = 'Hand empty';
      this.handEl.appendChild(empty);
    }
  }

  select(uid) { this.selectedUid = uid; }

  /**
   * Where each card in hand is ON SCREEN, so a card that is played can fly
   * from the card you actually clicked instead of in from off-stage.
   */
  handPoints() {
    const out = new Map();
    for (const el of this.handEl.querySelectorAll('.handcard')) {
      const r = el.getBoundingClientRect();
      out.set(Number(el.dataset.uid), { x: r.left + r.width / 2, y: r.top + r.height * 0.35 });
    }
    return out;
  }
}

/**
 * A nine-square board with one square lit, drawn from the reader's side.
 *
 * For choices that land on an EMPTY square there is no card to show, and a
 * number tells you nothing — you have to count along the rows to find out
 * where "square 7" is.
 */
function miniBoard(square, view = 0) {
  const cells = [];
  for (let pos = 0; pos < 9; pos++) {
    // Drawn the way the table looks from where you are sitting: YOUR back row
    // along the bottom, nearest the camera, and left/right as you see them.
    const row = Math.floor(pos / 3), col = pos % 3;
    const shown = view === 0 ? (2 - row) * 3 + col : row * 3 + (2 - col);
    cells.push(`<i class="${shown === square ? 'on' : ''}"></i>`);
  }
  const off = square === 9 ? 'void' : square === 10 || square === 11 ? 'sh' : '';
  return `<span class="minib ${off}">${cells.join('')}</span>`;
}

/* ------------------------------------------------------------ choices */

/**
 * Cards stop and ask. This renders whatever the engine is waiting for; board
 * targets are answered by clicking the board, so only the non-board kinds get
 * buttons here.
 */
Hud.prototype.askChoice = function askChoice(request, label, onAnswer, art = () => null) {
  if (!request) { this.choiceEl.hidden = true; return; }
  this.choiceEl.hidden = false;
  this.choicePrompt.textContent = request.prompt || 'Choose';
  this.choiceOpts.innerHTML = '';

  // A card option shows the CARD. An empty square has no card to show, so it
  // shows a little board with that square marked — still a picture of where
  // you are pointing, and never a bare number.
  const face = (art2, text) => {
    if (!art2) return text;
    if (typeof art2 === 'string') return `<img src="../site/${art2}.thumb.jpg" alt=""><span>${text}</span>`;
    return `${miniBoard(art2.mini, art2.view)}<span>${text}</span>`;
  };

  const add = (text, value, cls = '', img = null) => {
    const b = document.createElement('button');
    b.className = `choicebtn ${cls}${img ? ' hascard' : ''}`;
    b.type = 'button';
    b.innerHTML = face(img, text);
    b.addEventListener('click', () => onAnswer(value));
    this.choiceOpts.appendChild(b);
  };

  if (request.type === 'confirm') {
    add('Yes', true, 'yes');
    add('No', false);
  } else if (request.type === 'pick') {
    for (const o of request.options) add(String(o), o);
  } else if (request.type === 'one') {
    for (const o of request.options) add(label(o, request.kind), o, '', art(o, request.kind));
    if (request.allowNone || !request.required) add('Decline', null);
  } else if (request.type === 'some') {
    const chosen = [];
    const redraw = () => {
      this.choiceOpts.innerHTML = '';
      for (const o of request.options) {
        const b = document.createElement('button');
        const im = art(o, request.kind);
        b.className = `choicebtn ${chosen.includes(o) ? 'on' : ''}${im ? ' hascard' : ''}`;
        b.type = 'button';
        b.innerHTML = face(im, label(o, request.kind));
        b.addEventListener('click', () => {
          const i = chosen.indexOf(o);
          if (i >= 0) chosen.splice(i, 1); else chosen.push(o);
          redraw();
        });
        this.choiceOpts.appendChild(b);
      }
      const done = document.createElement('button');
      done.className = 'choicebtn yes';
      done.type = 'button';
      done.textContent = request.exact
        ? `Confirm ${chosen.length}/${request.count}` : `Confirm ${chosen.length}`;
      done.disabled = request.exact && chosen.length !== request.count;
      done.addEventListener('click', () => onAnswer([...chosen]));
      this.choiceOpts.appendChild(done);
    };
    redraw();
  } else {
    add('Continue', null);
  }
};

/* ------------------------------------------------------------ action menu */

/**
 * Clicking a fighter should say what it can DO, in words. Abilities were
 * previously unreachable — there was no way to fire one at all — and Defend had
 * no interface whatsoever.
 *
 * `items` is [{label, detail, kind, onPick, disabled}].
 */
Hud.prototype.showActions = function showActions(screen, items) {
  if (!items || !items.length) { this.hideActions(); return; }
  this.menuEl.hidden = false;
  this.menuEl.innerHTML = '';

  for (const it of items) {
    const b = document.createElement('button');
    b.className = `amitem ${it.kind || ''}${it.disabled ? ' off' : ''}`;
    b.type = 'button';
    b.disabled = !!it.disabled;
    b.innerHTML = `<span class="amlabel">${it.label}</span>`
      + (it.detail ? `<span class="amdetail">${it.detail}</span>` : '');
    b.addEventListener('click', (e) => { e.stopPropagation(); this.hideActions(); it.onPick(); });
    this.menuEl.appendChild(b);
  }

  // keep it on screen
  const pad = 12;
  const w = 250, h = this.menuEl.offsetHeight || 140;
  const x = Math.min(Math.max(pad, screen.x - w / 2), innerWidth - w - pad);
  const y = Math.min(Math.max(pad, screen.y - h - 18), innerHeight - h - 130);
  this.menuEl.style.left = `${x}px`;
  this.menuEl.style.top = `${y}px`;
};

Hud.prototype.hideActions = function hideActions() {
  if (this.menuEl) this.menuEl.hidden = true;
};

/* ------------------------------------------------------------ stack panel */

/**
 * Hovering a square shows what is actually ON it, top to bottom. Only the top
 * card of a stack is in play, and the ones underneath are otherwise invisible —
 * you could not see what you were standing on.
 *
 * `entries` is [{img, name, power, top, attachments:[{img,name}]}].
 */
Hud.prototype.showStack = function showStack(entries, { pinned = false, onClose = null } = {}) {
  if (!entries || !entries.length) { this.hideStack(); return; }
  this.stackEl.hidden = false;
  this.stackEl.classList.toggle('pinned', !!pinned);
  this.stackEl.innerHTML = '';

  const title = document.createElement('div');
  title.className = 'sp-title';
  title.textContent = entries.length > 1
    ? `Stack of ${entries.length} — top first` : 'On this square';
  if (pinned) {
    const x = document.createElement('button');
    x.className = 'sp-close';
    x.type = 'button';
    x.textContent = '×';
    x.title = 'Close';
    x.addEventListener('click', (e) => { e.stopPropagation(); onClose?.(); });
    title.appendChild(x);
  }
  this.stackEl.appendChild(title);

  // Hovering a row enlarges that card BESIDE the panel. Reading what an
  // Attachment does was otherwise impossible: the panel gave you its name and
  // nothing else, and it vanished the moment you moved the mouse toward it.
  const bind = (row, img) => {
    if (!img) return;
    row.addEventListener('mouseenter', () => this.peek(img));
    row.addEventListener('mouseleave', () => this.hidePeek());
    row.addEventListener('click', () => this.zoom(img));
  };

  for (const e of entries) {
    const row = document.createElement('div');
    row.className = `sprow${e.top ? ' top' : ''}`;
    row.innerHTML = `
      ${thumb(e, 'spnoart')}
      <span class="spname">${e.power ? `<b>${e.power}</b> ` : ''}${e.name}</span>
      ${e.top ? '<span class="sptag">in play</span>' : ''}`;
    bind(row, e.img);
    this.stackEl.appendChild(row);

    for (const a of e.attachments || []) {
      const ar = document.createElement('div');
      ar.className = 'sprow attach';
      // the arrow is the affordance: it pulls the attachment out to be read
      ar.innerHTML = `
        <span class="sparrow">↳</span>
        ${thumb(a, 'spnoart')}
        <span class="spname">${a.name}</span>
        <span class="sptag">attached</span>`;
      bind(ar, a.img);
      this.stackEl.appendChild(ar);
    }
  }
};

Hud.prototype.hideStack = function hideStack() {
  if (this.stackEl) { this.stackEl.hidden = true; this.stackEl.classList.remove('pinned'); }
  this.hidePeek();
};

/** A big readable copy of one card, next to the panel rather than over it. */
Hud.prototype.peek = function peek(img) {
  if (!this.peekEl) return;
  this.peekImg.src = `../site/${img}.jpg`;
  this.peekEl.hidden = false;
};

Hud.prototype.hidePeek = function hidePeek() {
  if (this.peekEl) this.peekEl.hidden = true;
};

/** Slide one card out, big enough to read. */
Hud.prototype.zoom = function zoom(img) {
  this.zoomImg.src = `../site/${img}.jpg`;
  this.zoomEl.hidden = false;
};

/** The discard pile, listed newest first. */
Hud.prototype.showGraveyard = function showGraveyard(who, entries, { pinned = false, onClose = null } = {}) {
  if ((!entries || !entries.length) && !pinned) { this.hideStack(); return; }
  this.stackEl.hidden = false;
  this.stackEl.classList.toggle('pinned', !!pinned);
  this.stackEl.innerHTML = '';

  const title = document.createElement('div');
  title.className = 'sp-title';
  title.textContent = `${who} · discard, newest first`;
  if (pinned) {
    const x = document.createElement('button');
    x.className = 'sp-close';
    x.type = 'button';
    x.textContent = '×';
    x.title = 'Close';
    x.addEventListener('click', (e) => { e.stopPropagation(); onClose?.(); });
    title.appendChild(x);
  }
  this.stackEl.appendChild(title);

  if (!entries || !entries.length) {
    const empty = document.createElement('div');
    empty.className = 'sprow';
    empty.innerHTML = '<span class="spname">Nothing has died yet.</span>';
    this.stackEl.appendChild(empty);
    return;
  }

  // The pile can be long, so it scrolls; hovering a row reads that card, the
  // same as the stack panel.
  for (const e of entries.slice().reverse()) {
    const row = document.createElement('div');
    row.className = 'sprow';
    row.innerHTML = `
      ${thumb(e, 'spnoart')}
      <span class="spname">${e.power ? `<b>${e.power}</b> ` : ''}${e.name}</span>`;
    if (e.img) {
      row.addEventListener('mouseenter', () => this.peek(e.img));
      row.addEventListener('mouseleave', () => this.hidePeek());
      row.addEventListener('click', () => this.zoom(e.img));
    }
    this.stackEl.appendChild(row);
  }
};

/* ------------------------------------------------------------ the ending */

/**
 * The end of the game. The banner above is still what a disconnection or a
 * desync uses — those are announcements. This is the other thing entirely: the
 * result of twenty minutes of play, told over an arena that is finishing the
 * story itself (game/js/victory.js), so it stays low in the frame and leaves
 * the table visible above it.
 *
 * `roll` is the cards that matter at the end — who is still standing, or who
 * fell — because naming them is the only part of this screen that is about
 * THIS game rather than about winning and losing in general.
 */
Hud.prototype.showEnding = function showEnding(
  { tone = 'won', overline, title, sub, accent, epitaph, rollTitle, roll = [], footer, onAgain },
) {
  if (this.endEl) this.endEl.remove();
  const el = document.createElement('div');
  el.className = `ending ${tone}`;
  el.style.setProperty('--accent', accent || '#d8b163');
  el.innerHTML = `
    <div class="end-vignette"></div>
    <div class="end-veil"></div>
    <div class="end-body">
      <div class="end-over">${overline}</div>
      <h2 class="end-title">${title}</h2>
      <div class="end-sub">${sub}</div>
      <p class="end-why">${epitaph}${footer ? ` <b>${footer}</b>` : ''}</p>
      ${roll.length ? `<div class="end-roll">
        <span class="end-rolltitle">${rollTitle}</span>
        <div class="end-cards">${roll.map((c) => `
          <figure class="end-card" title="${c.name}">
            ${thumb(c, 'end-noart')}
            <figcaption>${c.name}</figcaption>
          </figure>`).join('')}</div>
      </div>` : ''}
      <div class="end-buttons">
        <button class="bigbtn end-leave" type="button">Back to the lobby</button>
        <button class="end-stay" type="button">Stay and look at the field</button>
      </div>
    </div>`;
  this.root.appendChild(el);
  this.endEl = el;
  // Everything you play WITH is done with: the hand, the log and the turn
  // counter go quiet so the last thing on screen is the field and the result.
  this.root.classList.add('is-ending');

  el.querySelector('.end-leave').addEventListener('click', () => onAgain?.());
  // Twenty minutes of play ends on a board worth looking at, and a panel over
  // it that cannot be moved is a poor reward. This folds it away to a tab.
  const stay = el.querySelector('.end-stay');
  stay.addEventListener('click', () => {
    el.classList.add('folded');
    if (!this.endTab) {
      const tab = document.createElement('button');
      tab.className = 'end-tab';
      tab.type = 'button';
      tab.textContent = 'Show the result';
      tab.addEventListener('click', () => { el.classList.remove('folded'); tab.hidden = true; });
      this.root.appendChild(tab);
      this.endTab = tab;
    }
    this.endTab.hidden = false;
  });
};

Hud.prototype.hideEnding = function hideEnding() {
  this.endEl?.remove();
  this.endTab?.remove();
  this.endEl = null;
  this.endTab = null;
  this.root.classList.remove('is-ending');
};
