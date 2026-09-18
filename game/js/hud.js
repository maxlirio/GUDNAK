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
    this.choiceEl = root.querySelector('#choice');
    this.choicePrompt = root.querySelector('#choice-prompt');
    this.choiceOpts = root.querySelector('#choice-opts');
    this.deckEls = [root.querySelector('#deck-0'), root.querySelector('#deck-1')];
    this.whoEls = [root.querySelector('#who-0'), root.querySelector('#who-1')];
    this.shEls = [root.querySelector('#sh-0'), root.querySelector('#sh-1')];
  }

  hint(text) { this.hintEl.textContent = text || ''; }

  log(line) {
    const p = document.createElement('div');
    p.textContent = line;
    this.logEl.appendChild(p);
    while (this.logEl.children.length > 7) this.logEl.removeChild(this.logEl.firstChild);
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  banner(text, tone = '') {
    if (!text) { this.bannerEl.hidden = true; return; }
    this.bannerEl.textContent = text;
    this.bannerEl.className = `banner ${tone}`;
    this.bannerEl.hidden = false;
  }

  /** Redraw from engine state. `defs` supplies names and art for hand cards. */
  /** `names` are the two decks, which is what each side is called. */
  render(state, defs, { sieged, names }) {
    const p = state.active;
    this.turnline.textContent = names[p];
    this.turnline.className = `turn p${p}`;
    for (let i = 0; i < 2; i++) this.whoEls[i].textContent = names[i];

    this.dots.innerHTML = '';
    const max = state.turn === 1 ? 1 : 2;
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

    this.#renderHand(state, defs);
  }

  #renderHand(state, defs) {
    const p = state.active;
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
Hud.prototype.askChoice = function askChoice(request, label, onAnswer) {
  if (!request) { this.choiceEl.hidden = true; return; }
  this.choiceEl.hidden = false;
  this.choicePrompt.textContent = request.prompt || 'Choose';
  this.choiceOpts.innerHTML = '';

  const add = (text, value, cls = '') => {
    const b = document.createElement('button');
    b.className = `choicebtn ${cls}`;
    b.type = 'button';
    b.textContent = text;
    b.addEventListener('click', () => onAnswer(value));
    this.choiceOpts.appendChild(b);
  };

  if (request.type === 'confirm') {
    add('Yes', true, 'yes');
    add('No', false);
  } else if (request.type === 'pick') {
    for (const o of request.options) add(String(o), o);
  } else if (request.type === 'one') {
    for (const o of request.options) add(label(o, request.kind), o);
    if (request.allowNone || !request.required) add('Decline', null);
  } else if (request.type === 'some') {
    const chosen = [];
    const redraw = () => {
      this.choiceOpts.innerHTML = '';
      for (const o of request.options) {
        const b = document.createElement('button');
        b.className = `choicebtn ${chosen.includes(o) ? 'on' : ''}`;
        b.type = 'button';
        b.textContent = label(o, request.kind);
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
