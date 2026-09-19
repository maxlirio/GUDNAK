// The flat UI over the battlefield: whose turn, actions left, both Strongholds,
// the active player's hand, and a running log.
//
// Everything in here is DOM. The scene never draws text.

const ROMAN = { 1: 'I', 2: 'II', 3: 'III' };

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

      el.innerHTML = `
        ${def.img ? `<img src="../site/${def.img}.thumb.jpg" alt="">` : '<div class="noart"></div>'}
        <span class="hc-name">${def.power ? ROMAN[def.power] + ' ' : ''}${def.name || '?'}</span>
        ${def.cost != null ? `<span class="hc-cost">${def.cost}</span>` : ''}
        ${def.inert ? '<span class="hc-inert" title="This card’s effect is not implemented yet">no effect yet</span>' : ''}`;

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

  // A card option shows the card. A name in a box is not enough to choose by.
  const add = (text, value, cls = '', img = null) => {
    const b = document.createElement('button');
    b.className = `choicebtn ${cls}${img ? ' hascard' : ''}`;
    b.type = 'button';
    b.innerHTML = img
      ? `<img src="../site/${img}.thumb.jpg" alt=""><span>${text}</span>`
      : text;
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
        b.innerHTML = im
          ? `<img src="../site/${im}.thumb.jpg" alt=""><span>${label(o, request.kind)}</span>`
          : label(o, request.kind);
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
      ${e.img ? `<img src="../site/${e.img}.thumb.jpg" alt="">` : '<div class="spnoart"></div>'}
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
        ${a.img ? `<img src="../site/${a.img}.thumb.jpg" alt="">` : '<div class="spnoart"></div>'}
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
Hud.prototype.showGraveyard = function showGraveyard(who, entries) {
  if (!entries || !entries.length) { this.hideStack(); return; }
  this.stackEl.hidden = false;
  this.stackEl.innerHTML = `<div class="sp-title">${who} · discard, newest first</div>`;
  for (const e of entries.slice().reverse()) {
    const row = document.createElement('div');
    row.className = 'sprow';
    row.innerHTML = `
      ${e.img ? `<img src="../site/${e.img}.thumb.jpg" alt="">` : '<div class="spnoart"></div>'}
      <span class="spname">${e.power ? `<b>${e.power}</b> ` : ''}${e.name}</span>`;
    if (e.img) row.addEventListener('click', () => this.zoom(e.img));
    this.stackEl.appendChild(row);
  }
};
