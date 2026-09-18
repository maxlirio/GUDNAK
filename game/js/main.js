// The table: engine + battlefield + input + netcode.
//
// The engine (js/engine.js) is the authority. Nothing here decides a rule; it
// asks legalActions() what is possible, shows that on the board, and sends the
// chosen action back.
//
// Online play is lockstep. Both machines build the same game from the same
// setup and apply the same ordered moves, so only the MOVES cross the wire.
// Every move carries a hash of the state it produced; a mismatch is reported
// immediately rather than left to drift.

import * as THREE from 'three';
import { Arena, STEP, LITE } from './arena.js';
import { Board, squareToWorld } from './board.js';
import { Pieces } from './pieces.js';
import { Hud } from './hud.js';
import { Lobby } from './lobby.js';
import { Net } from './net.js';
import { Animator, snapshotBoard, diffBoard } from './anim.js';
import {
  createGame, legalActions, apply, choose, isSieged, gatesOf, topOf, hashState,
} from '../../js/engine.js';

const boot = document.getElementById('boot');
const bootMsg = document.getElementById('boot-msg');
const lobbyRoot = document.getElementById('lobby');

/* ------------------------------------------------------------ renderer */

const canvas = document.getElementById('view');

// Without WebGL this used to throw at module scope, which killed the whole
// page and left a blank screen with no explanation. Say what happened instead.
let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = !LITE;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
} catch (e) {
  bootMsg.textContent = 'This browser cannot open WebGL, so the table cannot be drawn.';
  throw e;
}

const arena = new Arena(renderer);
const board = new Board(arena.scene);
const anim = new Animator(arena.scene);

const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 400);
const CAM_DIST = 18.6, CAM_HEIGHT = 19.4;
const CAM_LOOK = new THREE.Vector3(0, 0.2, 3.4);

let viewSide = 0;
let viewAngle = 0;

function placeCamera() {
  const s = Math.sin(viewAngle), c = Math.cos(viewAngle);
  camera.position.set(CAM_DIST * s, CAM_HEIGHT, CAM_DIST * c);
  camera.lookAt(CAM_LOOK.x * c, CAM_LOOK.y, CAM_LOOK.z * c);
}

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();
placeCamera();

/* ------------------------------------------------------------ game state */

let defs = {}, deckList = [], state = null, pieces = null, hud = null;
let deckNames = ['Player One', 'Player Two'];

let net = null;
let online = false;
let mySide = 0;
let started = false;

let sel = { kind: null, uid: null, from: null };
let hovered = { square: null, piece: null };

const params = new URLSearchParams(location.search);

/* ------------------------------------------------------------ lobby */

const data = await fetch('data/decks.json').then((r) => r.json());
defs = data.defs;
deckList = data.decks;
boot.classList.add('gone');

const lobby = new Lobby(lobbyRoot, deckList, { onStart: beginFromLobby });

// ?quick=1 skips the lobby into a one-screen game, which is handy for a link
// straight to the table and for looking at it without clicking through.
// ?p0= / ?p1= name the decks.
if (params.has('quick')) {
  const pickName = (want, fb) =>
    (deckList.find((d) => d.name.toLowerCase() === (want || '').toLowerCase()) || deckList[fb]).name;
  startGame({
    seed: Number(params.get('seed')) || Math.floor(Math.random() * 1e9),
    decks: [pickName(params.get('p0'), 0), pickName(params.get('p1'), 1)],
    first: 0,
  }, { online: false, side: 0 });
}

// ?room=ABCD pre-fills the join box, so a link works as well as a spoken code.
if (params.get('room')) {
  lobby.setMode('join');
  lobbyRoot.querySelector('#joincode').value = params.get('room').toUpperCase().slice(0, 4);
}

async function beginFromLobby(opts) {
  if (opts.mode === 'local') {
    startGame({ seed: Math.floor(Math.random() * 1e9), decks: opts.decks, first: 0 },
      { online: false, side: 0 });
    return;
  }

  net = new Net();
  net.addEventListener('neterror', (e) => lobby.say(e.detail.message, 'bad'));
  net.addEventListener('left', () => hud?.banner('Your opponent disconnected.', 'bad'));
  net.addEventListener('desync', () => {
    hud?.banner('The two games have gone out of step.', 'bad');
  });

  if (opts.mode === 'host') {
    lobby.say('Opening a room…');
    let code;
    try { code = await net.host(); } catch (e) { lobby.say(e.message, 'bad'); return; }
    lobby.showCode(code);
    lobby.say('Waiting for an opponent…');

    // The guest announces its deck first; only then does the host deal. If the
    // host guessed instead, the two clients would build different games from
    // the same seed and desync on the very first move.
    net.addEventListener('hello', (e) => {
      const setup = {
        seed: Math.floor(Math.random() * 1e9),
        decks: [opts.decks[0], e.detail.deck],
        first: 0,
      };
      net.sendSetup(setup);
      startGame(setup, { online: true, side: 0 });
    });
  } else {
    lobby.say(`Looking for room ${opts.code}…`);
    try { await net.join(opts.code); } catch (e) { lobby.say(e.message, 'bad'); return; }
    lobby.say('Connected. Waiting for the host to deal…');
    net.sendHello(opts.decks[1]);

    net.addEventListener('setup', (e) => {
      // Take the host's setup EXACTLY as given — it already contains the deck
      // this client announced.
      startGame(e.detail, { online: true, side: 1 });
    });
  }
}

/* ------------------------------------------------------------ start */

function startGame(setup, { online: isOnline, side }) {
  if (started) return;
  started = true;
  online = isOnline;
  mySide = side;

  const byName = (n, fb) => deckList.find((d) => d.name === n) || deckList[fb];
  const d0 = byName(setup.decks[0], 0);
  const d1 = byName(setup.decks[1], 1);
  deckNames = [d0.name, d1.name];

  state = createGame({
    seed: setup.seed,
    defs,
    decks: [d0.cards, d1.cards],
    strongholds: [d0.stronghold || null, d1.stronghold || null],
    first: setup.first ?? 0,
  });

  pieces = new Pieces(arena.scene, defs);
  hud = new Hud(document.getElementById('hud'), { onHandPick });
  lobby.hide();

  if (online) {
    net.addEventListener('move', (e) => receiveMove(e.detail));
    hud.log(`Connected — you are ${deckNames[mySide]}.`);
  } else {
    hud.log('The battle begins.');
  }
  sync();
}

/* ------------------------------------------------------------ turn rights */

/** Whose answer is the game waiting for? Usually the active player. */
function whoseChoice() {
  if (!state.pending) return state.active;
  return state.pending.request.player ?? state.active;
}

/** May this client act right now? On one screen, always. */
function mine() {
  if (!online) return true;
  return whoseChoice() === mySide;
}

/* ------------------------------------------------------------ moves */

/**
 * One funnel for everything that changes the game, so the wire sees exactly
 * what the local engine saw, in the same order.
 */
function submit(move, fromNetwork = false) {
  if (state.winner !== null) return;
  const actor = state.active;

  // The engine resolves instantly; the animation is played afterwards from a
  // diff of the board, so nothing in the view can change the game.
  const before = snapshotBoard(state);
  const graveBefore = new Set(
    [0, 1].flatMap((p) => state.players[p].graveyard.map((c) => c.uid)));

  try {
    if (move.k === 'action') apply(state, move.action);
    else choose(state, move.answer);
  } catch (e) {
    hud.hint(fromNetwork ? `Out of step: ${e.message}` : e.message);
    return;
  }

  if (online && !fromNetwork) net.sendMove(move, hashState(state));
  if (move.k === 'action') describe(move.action, actor);

  sel = { kind: null, uid: null, from: null };
  hovered.piece = null;
  pieces.setHovered(null);
  sync(before, graveBefore, move);
}

function receiveMove(msg) {
  submit(msg.move, true);
  // Both machines should now agree. If they do not, say so at once rather than
  // letting the boards quietly drift apart.
  if (msg.hash && hashState(state) !== msg.hash) {
    net.reportDesync({ seq: msg.seq, mine: hashState(state), theirs: msg.hash });
  }
}

function describe(a, by) {
  const who = deckNames[by];
  switch (a.t) {
    case 'draw': hud.log(`${who} drew a card.`); break;
    case 'deploy': hud.log(`${who} deployed a fighter.`); break;
    case 'move': hud.log(`${who} moved ${a.from} → ${a.to}.`); break;
    case 'attack': hud.log(`${who} attacked ${a.to}.`); break;
    case 'defend': hud.log(`${who} defended the Gates.`); break;
    case 'tactic': hud.log(`${who} played a Tactic.`); break;
    case 'construct': hud.log(`${who} built a Construct.`); break;
    case 'attach': hud.log(`${who} played an Attachment.`); break;
    case 'ability': hud.log(`${who} used an ability.`); break;
    default: break;
  }
}

/* ------------------------------------------------------------ view */

function squareOfUid(uid) {
  for (let i = 0; i < state.board.length; i++) {
    if ((state.board[i] || []).some((c) => c.uid === uid)) return i;
  }
  return null;
}

function labelFor(value, kind) {
  if (kind === 'square' || typeof value === 'number') return `Square ${value}`;
  for (const c of allCardsInState()) if (c.uid === value) return defs[c.def]?.name || 'card';
  return String(value);
}

function* allCardsInState() {
  for (const sqr of state.board) for (const c of sqr || []) yield c;
  for (const c of state.constructs || []) if (c) yield c;
  for (let p = 0; p < 2; p++) {
    for (const z of ['hand', 'deck', 'graveyard']) for (const c of state.players[p][z]) yield c;
  }
}

function sync(before = null, graveBefore = null, move = null) {
  // Online the board always faces THIS client; on one screen it swings to
  // whoever is playing.
  viewSide = online ? mySide : state.active;

  const after = snapshotBoard(state);
  const changes = before ? diffBoard(before, after) : { entered: [], moved: [], left: [] };

  // Cards that left the board have to stay on screen long enough to be seen
  // going, so they are retained and retired when their animation ends.
  const dying = new Set(changes.left.map((l) => l.uid));
  pieces.sync(state, { retain: dying });
  if (before) playAnimations(changes, graveBefore, move);
  hud.select(sel.kind === 'hand' ? sel.uid : null);
  hud.render(state, defs, {
    sieged: [isSieged(state, 0), isSieged(state, 1)],
    names: deckNames,
    handOf: online ? mySide : state.active,
  });
  board.setDecks([state.players[0].deck.length, state.players[1].deck.length]);
  board.setGraveyards(
    [state.players[0].graveyard.length, state.players[1].graveyard.length],
    [0, 1].map((p) => {
      const gy = state.players[p].graveyard;
      const last = gy[gy.length - 1];
      return last ? (defs[last.def]?.img || null) : null;
    }),
  );
  paintBoard();

  if (state.pending && mine()) {
    hud.askChoice(state.pending.request, labelFor, (answer) => submit({ k: 'choice', answer }));
    hud.hint(state.pending.request.prompt || 'Choose');
  } else if (state.pending) {
    hud.askChoice(null);
    hud.hint(`Waiting for ${deckNames[whoseChoice()]}…`);
  } else {
    hud.askChoice(null);
    hud.hint(online && !mine() ? `Waiting for ${deckNames[state.active]}…` : '');
  }

  if (state.winner !== null) {
    const text = state.winner === 0 || state.winner === 1 ? `${deckNames[state.winner]} wins`
      : state.winner === 'stalemate' ? 'Stalemate' : 'Draw';
    const good = online ? state.winner === mySide : state.winner === 0;
    hud.banner(`${text} — ${state.reason || ''}`, good ? 'good' : 'bad');
  }
}

function paintBoard() {
  const states = {};

  // Gates are a computed set — Living Stronghold adds them, Avatar's Burden
  // removes them — so every one of them shows when it is under siege.
  for (let p = 0; p < 2; p++) {
    for (const g of gatesOf(state, p)) {
      const t = topOf(state, g);
      if (t && t.owner !== p) states[g] = 'danger';
    }
  }

  if (state.pending && mine() && state.pending.request.kind !== 'option') {
    for (const o of state.pending.request.options || []) {
      const s = typeof o === 'number' ? o : squareOfUid(o);
      if (s != null) states[s] = 'target';
    }
  } else if (mine() && !state.pending) {
    const acts = legalActions(state);
    if (sel.kind === 'hand') {
      for (const a of acts) {
        if (a.card !== sel.uid) continue;
        if (a.t === 'deploy' || a.t === 'construct') states[a.to] = 'target';
        if (a.t === 'attach') {
          const s = squareOfUid(a.host);
          if (s != null) states[s] = 'target';
        }
      }
    } else if (sel.kind === 'board') {
      states[sel.from] = 'source';
      for (const a of acts) {
        if ((a.t === 'move' || a.t === 'attack') && a.from === sel.from) states[a.to] = 'target';
      }
    }
  }

  if (hovered.square != null && !states[hovered.square]) states[hovered.square] = 'hover';
  board.setStates(states, state.board.map((sq) => (sq || []).length));
}

/* ------------------------------------------------------------ animation */

/** Turn a board diff into something worth watching. */
function playAnimations(changes, graveBefore, move) {
  const action = move?.k === 'action' ? move.action : null;
  const died = (uid) => [0, 1].some(
    (p) => state.players[p].graveyard.some((c) => c.uid === uid));

  const killOff = () => {
    for (const l of changes.left) {
      const piece = pieces.get(l.uid);
      if (!piece) continue;
      const gone = died(l.uid) && !graveBefore?.has(l.uid);
      const finish = () => pieces.retire(l.uid);
      if (gone) anim.destroy(piece, l.from, finish);
      else anim.vanish(piece, finish);
    }
  };

  if (action?.t === 'attack') {
    // The attacker may itself have died, in which case it is in `left` and the
    // lunge still needs to play before it falls.
    const attacker = [...pieces.byUid.values()]
      .find((p) => p.square === action.to || p.lastSquare === action.from);
    const shown = pieces.get(
      changes.left.find((l) => l.from === action.from)?.uid) || attacker;
    if (shown) {
      anim.attack(shown, action.from, action.to, { onImpact: killOff });
    } else {
      killOff();
    }
    for (const m of changes.moved) {
      const piece = pieces.get(m.uid);
      if (piece && piece !== shown) anim.move(piece, m.from, m.to);
    }
    return;
  }

  for (const e of changes.entered) {
    const piece = pieces.get(e.uid);
    if (!piece) continue;
    // A Stronghold rising out of the ground is a different event to a card
    // being dealt in from the side.
    const isStronghold = state.strongholds.some((sh) => sh.revealed && sh.card?.uid === e.uid);
    if (isStronghold) anim.rise(piece, e.to);
    else anim.deploy(piece, e.to);
  }
  for (const m of changes.moved) {
    const piece = pieces.get(m.uid);
    if (piece) anim.move(piece, m.from, m.to);
  }
  killOff();
}

/* ------------------------------------------------------------ input */

function onHandPick(card, def) {
  if (state.winner !== null || !mine() || state.pending || anim.busy) return;
  const acts = legalActions(state);

  if (def.type !== 'fighter') {
    const plays = acts.filter((a) =>
      (a.t === 'tactic' || a.t === 'construct' || a.t === 'attach') && a.card === card.uid);
    if (!plays.length) { hud.hint(`${def.name} cannot be played right now.`); return; }
    if (plays[0].t === 'tactic') return submit({ k: 'action', action: plays[0] });
    sel = { kind: 'hand', uid: card.uid, from: null };
    hud.hint(plays[0].t === 'construct'
      ? `Where does ${def.name} go?` : `Attach ${def.name} to whom?`);
    sync();
    return;
  }

  if (!acts.some((a) => a.t === 'deploy' && a.card === card.uid)) {
    hud.hint(`Nowhere to deploy ${def.name}.`);
    return;
  }
  sel = { kind: 'hand', uid: card.uid, from: null };
  hud.hint(`Choose a square for ${def.name}.`);
  sync();
}

function onSquareClick(square) {
  if (state.winner !== null || !mine() || anim.busy) return;

  if (state.pending) {
    const req = state.pending.request;
    if (req.type === 'one') {
      const match = (req.options || []).find(
        (o) => (typeof o === 'number' ? o : squareOfUid(o)) === square);
      if (match !== undefined) submit({ k: 'choice', answer: match });
    }
    return;
  }

  const acts = legalActions(state);

  if (sel.kind === 'hand') {
    const a = acts.find((x) => x.card === sel.uid
      && ((x.t === 'deploy' && x.to === square)
        || (x.t === 'construct' && x.to === square)
        || (x.t === 'attach' && squareOfUid(x.host) === square)));
    if (a) return submit({ k: 'action', action: a });
  }
  if (sel.kind === 'board') {
    const a = acts.find((x) => (x.t === 'move' || x.t === 'attack')
      && x.from === sel.from && x.to === square);
    if (a) return submit({ k: 'action', action: a });
  }

  const top = topOf(state, square);
  if (top && top.owner === state.active && !top.fatigued) {
    if (acts.some((x) => (x.t === 'move' || x.t === 'attack') && x.from === square)) {
      sel = { kind: 'board', uid: top.uid, from: square };
      hud.hint('Choose where to move or what to attack.');
      pieces.clearSelection();
      pieces.topAt(square)?.setSelected(true);
      sync();
      return;
    }
    const ab = acts.find((x) => x.t === 'ability' && x.uid === top.uid);
    if (ab) return submit({ k: 'action', action: ab });
    hud.hint('That fighter has nothing it can do.');
  }

  sel = { kind: null, uid: null, from: null };
  pieces.clearSelection();
  sync();
}

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();

function pick(ev) {
  ndc.x = (ev.clientX / innerWidth) * 2 - 1;
  ndc.y = -(ev.clientY / innerHeight) * 2 + 1;
  ray.setFromCamera(ndc, camera);
  const cardHit = ray.intersectObjects(pieces ? pieces.pickables() : [], false)[0];
  if (cardHit) {
    const piece = cardHit.object.userData.piece;
    return { square: piece.square, piece };
  }
  const tileHit = ray.intersectObjects(board.pickables(), false)[0];
  if (tileHit) return { square: tileHit.object.userData.square, piece: null };
  return { square: null, piece: null };
}

addEventListener('pointermove', (ev) => {
  if (!pieces) return;
  const hit = pick(ev);
  if (hit.square !== hovered.square || hit.piece !== hovered.piece) {
    hovered = hit;
    pieces.setHovered(hit.piece);
    paintBoard();
    canvas.style.cursor = hit.square != null ? 'pointer' : 'default';
  }
});

addEventListener('pointerdown', (ev) => {
  if (!pieces || ev.button !== 0) return;
  const hit = pick(ev);
  if (hit.square != null) onSquareClick(hit.square);
});

addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && state) {
    sel = { kind: null, uid: null, from: null };
    pieces?.clearSelection();
    hud?.hint('');
    sync();
  }
});

/* ------------------------------------------------------------ loop */

const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  arena.update(dt);
  board.update(dt);
  anim.update(dt);
  pieces?.update(dt, camera);

  const want = viewSide === 0 ? 0 : Math.PI;
  const diff = ((want - viewAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  viewAngle += diff * Math.min(1, dt * 2.6);
  placeCamera();

  const t = performance.now() * 0.00013;
  camera.position.x += Math.sin(t) * 0.30;
  camera.position.y += Math.cos(t * 1.3) * 0.16;

  renderer.render(arena.scene, camera);
  requestAnimationFrame(frame);
}
frame();

window.__table = {
  get state() { return state; }, arena, board, camera,
  get pieces() { return pieces; }, get net() { return net; },
};
