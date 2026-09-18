// The lobby: pick a deck, then play alone on one screen or open a room and
// read a four-letter code out to someone.

const ROMAN = { 1: 'I', 2: 'II', 3: 'III' };

export class Lobby {
  constructor(root, decks, { onStart }) {
    this.root = root;
    this.decks = decks;
    this.onStart = onStart;
    this.choice = [decks[0]?.name, decks[1]?.name];
    this.render();
  }

  render() {
    this.root.innerHTML = `
      <div class="lobby-card">
        <h1>GUDNAK</h1>
        <p class="lobby-sub">Nine squares. Siege the other Stronghold.</p>

        <div class="lobby-tabs">
          <button class="lobbytab on" data-mode="local">One screen</button>
          <button class="lobbytab" data-mode="host">Host a game</button>
          <button class="lobbytab" data-mode="join">Join a game</button>
        </div>

        <div class="lobby-pane" id="pane-local">
          <label class="lobby-label">Near side</label>
          <div class="deckpick" data-slot="0"></div>
          <label class="lobby-label">Far side</label>
          <div class="deckpick" data-slot="1"></div>
          <button class="bigbtn" id="go-local">Play</button>
        </div>

        <div class="lobby-pane" id="pane-host" hidden>
          <label class="lobby-label">Your deck</label>
          <div class="deckpick" data-slot="0"></div>
          <button class="bigbtn" id="go-host">Open a room</button>
          <div class="roomcode" id="roomcode" hidden>
            <span class="code" id="codetext">····</span>
            <p class="lobby-note">Read this out. The game starts when they join.</p>
          </div>
        </div>

        <div class="lobby-pane" id="pane-join" hidden>
          <label class="lobby-label">Your deck</label>
          <div class="deckpick" data-slot="1"></div>
          <label class="lobby-label">Room code</label>
          <input id="joincode" maxlength="4" placeholder="ABCD" autocomplete="off" spellcheck="false">
          <button class="bigbtn" id="go-join">Join</button>
        </div>

        <p class="lobby-status" id="lobby-status"></p>
        <p class="lobby-note">
          Peer to peer over PeerJS — no server. Both machines run the whole game
          and only the moves cross the wire.
        </p>
      </div>`;

    for (const t of this.root.querySelectorAll('.lobbytab')) {
      t.addEventListener('click', () => this.setMode(t.dataset.mode));
    }
    for (const p of this.root.querySelectorAll('.deckpick')) {
      this.#renderPicker(p, Number(p.dataset.slot));
    }

    this.status = this.root.querySelector('#lobby-status');
    this.root.querySelector('#go-local').addEventListener('click', () => {
      this.onStart({ mode: 'local', decks: this.choice });
    });
    this.root.querySelector('#go-host').addEventListener('click', () => {
      this.onStart({ mode: 'host', decks: this.choice });
    });
    this.root.querySelector('#go-join').addEventListener('click', () => {
      const code = this.root.querySelector('#joincode').value.trim().toUpperCase();
      if (code.length !== 4) { this.say('A room code is four letters.'); return; }
      this.onStart({ mode: 'join', decks: this.choice, code });
    });
    const input = this.root.querySelector('#joincode');
    input.addEventListener('input', () => { input.value = input.value.toUpperCase(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.root.querySelector('#go-join').click();
    });
  }

  #renderPicker(host, slot) {
    host.innerHTML = '';
    for (const d of this.decks) {
      const b = document.createElement('button');
      b.className = 'deckbtn' + (this.choice[slot] === d.name ? ' on' : '');
      b.type = 'button';
      b.innerHTML = `
        <span class="dname">${d.name}</span>
        <span class="dfac">${d.faction || ''}${d.stronghold ? ' · ' + d.stronghold : ''}</span>`;
      b.addEventListener('click', () => {
        this.choice[slot] = d.name;
        this.#renderPicker(host, slot);
      });
      host.appendChild(b);
    }
  }

  setMode(mode) {
    for (const t of this.root.querySelectorAll('.lobbytab')) {
      t.classList.toggle('on', t.dataset.mode === mode);
    }
    for (const m of ['local', 'host', 'join']) {
      this.root.querySelector(`#pane-${m}`).hidden = m !== mode;
    }
    this.say('');
  }

  say(text, tone = '') {
    if (!this.status) return;
    this.status.textContent = text || '';
    this.status.className = `lobby-status ${tone}`;
  }

  showCode(code) {
    this.root.querySelector('#roomcode').hidden = false;
    this.root.querySelector('#codetext').textContent = code;
    this.root.querySelector('#go-host').disabled = true;
  }

  hide() { this.root.hidden = true; }
  show() { this.root.hidden = false; }
}
