// Peer-to-peer lockstep over PeerJS. No server of our own.
//
// THE WIRE CARRIES THE DECISION, NEVER THE BOARD.
//
// The engine is deterministic: the same seed, the same decks, the same first
// player and the same ordered list of actions produce the same game on both
// machines. So all that crosses the network is {seq, action} — and a hash of
// the resulting state, which is how a desync gets caught the moment it happens
// rather than three turns later when the boards visibly disagree.
//
// Both sides run the full engine. That means each client technically holds the
// opponent's hand and deck in memory: this is a friendly game between two
// people, not a tournament client, and hiding it properly would need an
// authoritative server. The UI never shows it; a determined opponent could
// read it. Said plainly rather than pretended away.

const BROKER = { debug: 1 };

/** Four-letter room codes, easy to read out loud. No I/O/0/1. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function makeCode() {
  let s = '';
  const r = crypto.getRandomValues(new Uint8Array(4));
  for (let i = 0; i < 4; i++) s += ALPHABET[r[i] % ALPHABET.length];
  return s;
}

const PREFIX = 'gudnak-';

export class Net extends EventTarget {
  constructor() {
    super();
    this.peer = null;
    this.conn = null;
    this.isHost = false;
    this.code = null;
    this.seq = 0;          // how many actions WE have sent
    this.applied = 0;      // how many actions have been applied locally
    this.inbox = new Map(); // seq -> message, for out-of-order arrivals
    this.ready = false;
  }

  #emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }

  /* ---------------------------------------------------------- connect */

  async host() {
    await loadPeerJS();
    this.isHost = true;
    // Try codes until the broker gives us one that is free.
    for (let attempt = 0; attempt < 6; attempt++) {
      const code = makeCode();
      try {
        this.peer = await openPeer(PREFIX + code);
        this.code = code;
        break;
      } catch (e) {
        if (attempt === 5) throw new Error('could not open a room — the broker may be busy');
      }
    }

    this.peer.on('connection', (conn) => {
      if (this.conn) { conn.close(); return; }   // one opponent only
      this.#bind(conn);
    });
    this.#emit('hosting', { code: this.code });
    return this.code;
  }

  async join(code) {
    await loadPeerJS();
    this.isHost = false;
    this.code = code.toUpperCase().trim();
    this.peer = await openPeer(null);
    const conn = this.peer.connect(PREFIX + this.code, { reliable: true });

    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`no room called ${this.code}`)), 12000);
      conn.on('open', () => { clearTimeout(t); resolve(); });
      conn.on('error', (e) => { clearTimeout(t); reject(e); });
      this.peer.on('error', (e) => { clearTimeout(t); reject(e); });
    });

    this.#bind(conn);
    return this.code;
  }

  #bind(conn) {
    this.conn = conn;
    conn.on('data', (msg) => this.#receive(msg));
    conn.on('close', () => { this.ready = false; this.#emit('left', {}); });
    conn.on('error', (e) => this.#emit('neterror', { message: String(e) }));
    if (conn.open) this.#opened(); else conn.on('open', () => this.#opened());
  }

  #opened() {
    this.ready = true;
    this.#emit('joined', { isHost: this.isHost });
  }

  /* ---------------------------------------------------------- messages */

  send(msg) {
    if (this.conn && this.conn.open) this.conn.send(msg);
  }

  /** Guest -> host, on connecting: which deck it brought. */
  sendHello(deck) { this.send({ t: 'hello', deck }); }

  /** Host only: the agreed setup. Everything needed to build the same game. */
  sendSetup(setup) { this.send({ t: 'setup', setup }); }

  /** An action or a choice, in order. */
  sendMove(move, hash) {
    this.send({ t: 'move', seq: this.seq++, move, hash });
  }

  sendChat(text) { this.send({ t: 'chat', text }); }

  #receive(msg) {
    if (!msg || !msg.t) return;
    if (msg.t === 'hello') { this.#emit('hello', { deck: msg.deck }); return; }
    if (msg.t === 'setup') { this.#emit('setup', msg.setup); return; }
    if (msg.t === 'chat') { this.#emit('chat', { text: msg.text }); return; }
    if (msg.t === 'desync') { this.#emit('desync', msg); return; }
    if (msg.t !== 'move') return;

    this.inbox.set(msg.seq, msg);
    // Deliver in order — a reliable channel should not reorder, but a dropped
    // frame that arrives late must not be applied out of sequence.
    while (this.inbox.has(this.applied)) {
      const next = this.inbox.get(this.applied);
      this.inbox.delete(this.applied);
      this.applied++;
      this.#emit('move', next);
    }
  }

  /** Tell the other side we disagree about the state. */
  reportDesync(detail) {
    this.send({ t: 'desync', ...detail });
    this.#emit('desync', detail);
  }

  close() {
    try { this.conn?.close(); } catch {}
    try { this.peer?.destroy(); } catch {}
    this.ready = false;
  }
}

/* ------------------------------------------------------------ plumbing */

let peerLoading = null;
function loadPeerJS() {
  if (window.Peer) return Promise.resolve();
  if (peerLoading) return peerLoading;
  peerLoading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('could not load PeerJS'));
    document.head.appendChild(s);
  });
  return peerLoading;
}

function openPeer(id) {
  return new Promise((resolve, reject) => {
    const peer = id ? new window.Peer(id, BROKER) : new window.Peer(BROKER);
    const t = setTimeout(() => reject(new Error('the broker did not answer')), 12000);
    peer.on('open', () => { clearTimeout(t); resolve(peer); });
    peer.on('error', (e) => {
      clearTimeout(t);
      reject(e);
    });
  });
}
