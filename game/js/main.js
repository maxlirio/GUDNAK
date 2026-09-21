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
import { Fx } from './fx.js';
import { endGame, clearEnding } from './victory.js';
import { Drama } from './drama.js';
import { openLab } from './fxlab.js';   // DEV ONLY — delete with fxlab.js
import {
  createGame, legalActions, apply, choose, isSieged, gatesOf, topOf, hashState,
  actionAbilitiesOf, powerOf, refresh as refreshRules,
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
  renderer.toneMappingExposure = 1.18;
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

// Where the camera was aiming before anything leaned it. `drama` blends
// against this rather than replacing it, so a push-in keeps the board in frame.
// The camera's lean-in on a big effect. `enabled` is set once the URL has been
// read, further down — `params` is declared after this point, and reading it
// here is a temporal-dead-zone throw at module load, which takes the whole
// page with it.
const drama = new Drama();

const camLook = new THREE.Vector3();
function placeCamera() {
  const s = Math.sin(viewAngle), c = Math.cos(viewAngle);
  camera.position.set(CAM_DIST * s, CAM_HEIGHT, CAM_DIST * c);
  camLook.set(CAM_LOOK.x * c, CAM_LOOK.y, CAM_LOOK.z * c);
  camera.lookAt(camLook);
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

let sel = { kind: null, uid: null, from: null, mode: null };
// Pieces kept on screen past their removal from the board so they can be seen
// to die. Retiring them from an animation callback alone is fragile — if the
// callback that owns a piece never runs, the corpse sits there until the next
// sync. This set is swept whenever the animator goes idle.
const pendingRetire = new Set();

/**
 * The three motifs that CARRY a card rather than decorate one.
 *
 * Most effects lean a card, light it or shake it and leave the moving to the
 * slide below — game/js/fx/effects/steppe.js says so in as many words, and
 * hands a pinned card back still `animating` precisely so the slide can have
 * it. These three do the moving themselves: the chains haul their victim
 * bodily across the stone, the jailer shoves his under the stack, and the tow
 * drags its man along behind. All three read the card's CURRENT position as
 * the start of the journey and its restingPosition as the end.
 *
 * The generic slide used to run over the top of them and, being a third of the
 * length, it had already tucked the card under the stack before the irons had
 * finished being thrown — "the chains went after the card was moved under" is
 * exactly what that looks like. Whoever shows HOW a card moved owns its
 * moving, the same rule fx.exitFor already applies to how a card leaves.
 *
 * A motif missing from this list costs a doubled animation, which is what the
 * game did before. A motif wrongly IN it costs a card that arrives without a
 * slide. Neither can strand a card: anything pinned and then never picked up
 * is swept home by sweepIdle() as soon as the animator runs dry.
 */
const CARRIED = new Set(['chains', 'bury', 'haul']);

/**
 * Cards pinned on their old square for a carrying motif to come and get.
 *
 * Swept once the animator runs dry, the same way `pendingRetire` is: a card
 * the motif never picked up would otherwise sit frozen on the square it left
 * for the rest of the game. Whatever is still lying EXACTLY where it was
 * pinned is plainly nobody's, so it is let go and slid home.
 */
const pinnedMoves = [];
let hovered = { square: null, piece: null, deck: null, grave: null };
// The stack panel used to vanish the moment the mouse left the square, which
// made it useless for READING anything. Clicking pins it open — on a square,
// or on a discard pile, which is the only way to look through what has died.
let pinnedSquare = null;
let pinnedGrave = null;
let fx = null;
const unpin = () => { pinnedSquare = null; pinnedGrave = null; };
// Where each hand card sat on screen just before the current action, so the
// animation can start from it.
let handOrigins = new Map();

const params = new URLSearchParams(location.search);
// ?drama=0 turns the push-in and the slow-down off entirely, for anyone who
// finds it motion-sick or is recording footage they want held steady.
if (params.get('drama') === '0') drama.enabled = false;

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
    first: Number(params.get('first')) || 0,
    // ?side=1 pretends to be the GUEST of an online game without a broker, so
    // the half of the UI that only the guest ever sees can be tested at all.
  }, { online: params.has('side'), side: Number(params.get('side')) || 0 });
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
  fx = new Fx(arena.scene, anim, pieces);
  // The fx layer decides WHICH moments are big enough; the camera decides what
  // to do about it. Passed as a hook rather than an import so fx.js stays a
  // module about drawing and knows nothing about the camera.
  fx.onBig = (kind, at) => drama.request(kind, at);
  hud = new Hud(document.getElementById('hud'), { onHandPick });
  hud.setIdleHint('Click your deck to draw · right-click a card to read it.');
  hud.onExit(leaveGame);
  lobby.hide();

  // ?fxlab=1 opens the effects bench — a dev-only page for watching every card
  // effect without playing sixteen games. Delete game/js/fxlab.js, this block
  // and the #fxlab rules in game.css to remove it entirely. Opened from HERE
  // rather than from the query-param section at the top, because `fx` and
  // `anim` do not exist until a game has been built.
  if (params.has('fxlab')) {
    // Imported statically rather than dynamically: a dynamic import here
    // resolved and then did nothing at all, with neither a panel nor a
    // rejection to say why, and a dev tool is not worth an afternoon.
    openLab({ state, fx, anim, resync: () => { refreshRules(state); sync(); } });
  }

  if (online) {
    // `net` is absent when ?side= is used to rehearse the guest's half of the
    // UI locally, which is the only way to see it without a broker.
    net?.addEventListener('move', (e) => receiveMove(e.detail));
    hud.log(`Connected — you are ${deckNames[mySide]}.`);
  } else {
    hud.log('The battle begins.');
  }
  sync();
}

/** Tear the game down and go back to the lobby. */
function leaveGame() {
  if (online && net) {
    try { net.close(); } catch { /* already gone */ }
    net = null;
  }
  clearEnding();
  if (pieces) for (const uid of [...pieces.byUid.keys()]) pieces.retire(uid);
  pendingRetire.clear();
  pinnedMoves.length = 0;
  hud?.banner(null);
  hud?.hideActions();
  hud?.hideStack();
  document.getElementById('hud').innerHTML = '';
  board.setDecks([0, 0]);
  board.setGraveyards([0, 0], [null, null]);
  board.setStates({}, []);
  state = null; pieces = null; hud = null;
  started = false; online = false; mySide = 0;
  viewSide = 0;
  lobby.show();
  lobby.render();
  lobby.say('');
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
  const zonesBefore = [0, 1].map((p) => ({
    deck: state.players[p].deck.length,
    hand: state.players[p].hand.length,
    grave: state.players[p].graveyard.length,
    // WHICH cards were in hand, not just how many — a card that is played or
    // discarded should leave from the card you were looking at, and show its
    // own face on the way.
    hand: state.players[p].hand.map((c) => ({ uid: c.uid, def: c.def })),
    // WHICH cards were in the deck, so a card SHUFFLED BACK IN can be told
    // apart from the deck merely being a card shorter. Counting alone said
    // nothing had happened, which is why Migration put itself away invisibly.
    deckUids: new Set(state.players[p].deck.map((c) => c.uid)),
  }));
  // MERGED, not replaced. A card that asks a question on the way out — pick a
  // square, pick a target — leaves the hand on the FIRST submit and finishes
  // on the second, by which time it has no seat left to be looked up and the
  // animation had to start from nowhere. The last place a card was seen is
  // remembered until it is seen somewhere else.
  for (const [uid, at] of (hud ? hud.handPoints() : new Map())) handOrigins.set(uid, at);

  const preNames = move.k === 'action' ? namesBefore(move.action) : {};

  try {
    if (move.k === 'action') apply(state, move.action);
    else choose(state, move.answer);
  } catch (e) {
    hud.hint(fromNetwork ? `Out of step: ${e.message}` : e.message);
    return;
  }

  if (online && !fromNetwork) net?.sendMove(move, hashState(state));
  if (move.k === 'action') describe(move.action, actor, preNames);

  sel = { kind: null, uid: null, from: null, mode: null };
  hud.hideActions();
  hovered.piece = null;
  hovered.deck = null;
  pieces.setHovered(null);
  sync(before, graveBefore, move, zonesBefore);
}

function receiveMove(msg) {
  submit(msg.move, true);
  // Both machines should now agree. If they do not, say so at once rather than
  // letting the boards quietly drift apart.
  if (msg.hash && hashState(state) !== msg.hash) {
    net.reportDesync({ seq: msg.seq, mine: hashState(state), theirs: msg.hash });
  }
}

function describe(a, by, pre = {}) {
  const who = deckNames[by];
  switch (a.t) {
    case 'draw': hud.log(`${who} drew a card.`); break;
    case 'deploy': hud.log(`${who} deployed ${pre.card || 'a fighter'} to ${placeName(a.to)}.`); break;
    case 'move': hud.log(`${who} moved ${pre.from || 'a fighter'} to ${placeName(a.to)}.`); break;
    case 'attack':
      hud.log(`${who} attacked ${pre.to || 'a fighter'} with ${pre.from || 'a fighter'}.`); break;
    case 'defend': hud.log(`${who} defended ${placeName(a.square)}.`); break;
    case 'tactic': hud.log(`${who} played ${pre.card || 'a Tactic'}.`); break;
    case 'construct': hud.log(`${who} built ${pre.card || 'a Construct'} on ${placeName(a.to)}.`); break;
    case 'attach': hud.log(`${who} attached ${pre.card || 'an Attachment'} to ${pre.host || 'a fighter'}.`); break;
    case 'ability': hud.log(`${who} used ${pre.ability || 'an ability'}.`); break;
    default: break;
  }
}

/** Names have to be read BEFORE the action moves or kills anything. */
function namesBefore(a) {
  if (!a) return {};
  const cardName = (uid) => {
    for (const c of allCardsInState()) {
      if (c.uid === uid) {
        const d = defs[c.def] || {};
        return `${d.power ? `${['', 'I', 'II', 'III'][d.power]} ` : ''}${d.name || 'a card'}`;
      }
    }
    return null;
  };
  const out = {};
  if (a.from != null) out.from = nameAt(a.from);
  if (a.to != null && a.t === 'attack') out.to = nameAt(a.to);
  if (a.card != null) out.card = cardName(a.card);
  if (a.host != null) out.host = cardName(a.host);
  if (a.t === 'ability') {
    const card = occupantOf(squareOfUid(a.uid) ?? -1)
      || (state.constructs || []).find((c) => c && c.uid === a.uid);
    const entry = card ? actionAbilitiesOf(state, card)[a.index] : null;
    out.ability = entry?.ability?.name || 'an ability';
  }
  return out;
}

/* ------------------------------------------------------------ view */

function squareOfUid(uid) {
  for (let i = 0; i < state.board.length; i++) {
    if ((state.board[i] || []).some((c) => c.uid === uid)) return i;
  }
  return null;
}

/**
 * What is standing on a square — the fighter on top, or the Construct if the
 * square is bare. Constructs are not on state.board, so they have to be asked
 * for separately or a Trap's square reads as empty.
 */
function occupantOf(square) {
  const top = topOf(state, square);
  if (top) return top;
  return (state.constructs || []).find((c) => c && c.square === square) || null;
}

/**
 * A square by NAME, never by number.
 *
 * Numbers are an implementation detail of the board array. Nobody sitting at
 * the table thinks of the centre as "4", and told "Square 7" you have to count
 * along the rows to work out where that is. Names are given from the point of
 * view of whoever is reading the screen, so "your Gates" is always yours.
 */
function placeName(square) {
  if (square == null) return 'nowhere';
  if (square === 9) return 'The Void';
  if (square === 10 || square === 11) {
    return (square - 10) === viewSide ? 'your Stronghold' : 'their Stronghold';
  }
  if (square === 1 || square === 7) {
    const owner = square === 1 ? 0 : 1;
    return owner === viewSide ? 'your Gates' : 'their Gates';
  }
  const row = Math.floor(square / 3);
  const rowName = row === 1 ? 'the middle row'
    : (row === 0) === (viewSide === 0) ? 'your back row' : 'their back row';
  const col = viewSide === 0 ? square % 3 : 2 - (square % 3);
  return `${rowName}, ${['left', 'centre', 'right'][col]}`;
}

/** The card on a square, named — "II Wolfpack Soldier", not "Square 5". */
function nameAt(square) {
  const c = occupantOf(square);
  if (!c) return placeName(square);
  const d = defs[c.def] || {};
  const power = d.power ? `${['', 'I', 'II', 'III'][d.power]} ` : '';
  return `${power}${d.name || 'card'}`;
}

/**
 * Card uids are numbers and so are square indices, so `typeof value` cannot
 * tell them apart — which is why a choice between two Heroes offered
 * "Square 41" and "Square 37". The request says which it is; trust that.
 */
function labelFor(value, kind) {
  if (kind === 'square') {
    const c = occupantOf(value);
    return c ? `${nameAt(value)} — ${placeName(value)}` : placeName(value);
  }
  for (const c of allCardsInState()) {
    if (c.uid !== value) continue;
    const d = defs[c.def] || {};
    const power = d.power ? `${['', 'I', 'II', 'III'][d.power]} ` : '';
    const where = squareOfUid(value);
    return `${power}${d.name || 'card'}${where != null ? ` — ${placeName(where)}` : ''}`;
  }
  return String(value);
}

/**
 * The picture for a pending option.
 *
 * A square with something on it shows THAT CARD. An empty square has no card
 * to show, so it gets a little board with the square marked — which is still a
 * picture of where you are pointing, and never a number.
 */
function artFor(value, kind) {
  if (kind === 'square') {
    const c = occupantOf(value);
    if (c && !c.facedown) return defs[c.def]?.img || { mini: value, view: viewSide };
    return { mini: value, view: viewSide };
  }
  for (const c of allCardsInState()) if (c.uid === value) return defs[c.def]?.img || null;
  return null;
}

/** Which board square a pending option refers to, if any. */
function optionSquare(option, kind) {
  return kind === 'square' ? option : squareOfUid(option);
}

function* allCardsInState() {
  for (const sqr of state.board) {
    for (const c of sqr || []) {
      yield c;
      // Attachments are cards, and leaving them out is why "Take which
      // Attachment?" offered a bare uid instead of the Fire Bolt.
      for (const a of c.attachments || []) yield a;
    }
  }
  for (const c of state.constructs || []) {
    if (!c) continue;
    yield c;
    for (const a of c.attachments || []) yield a;
  }
  for (let p = 0; p < 2; p++) {
    for (const z of ['hand', 'deck', 'graveyard']) {
      for (const c of state.players[p][z]) {
        yield c;
        for (const a of c.attachments || []) yield a;
      }
    }
    const sh = state.strongholds?.[p]?.card;
    if (sh) yield sh;
  }
}

function sync(before = null, graveBefore = null, move = null, zonesBefore = null) {
  // Online the board always faces THIS client; on one screen it swings to
  // whoever is playing.
  viewSide = online ? mySide : state.active;

  const after = snapshotBoard(state);
  const changes = before ? diffBoard(before, after) : { entered: [], moved: [], left: [] };

  // Cards that left the board have to stay on screen long enough to be seen
  // going, so they are retained and retired when their animation ends.
  const dying = new Set(changes.left.map((l) => l.uid));
  for (const uid of dying) pendingRetire.add(uid);
  pieces.sync(state, { retain: new Set([...pendingRetire]) });

  // An enemy on your Gates is the whole losing condition; it gets a pulsing
  // red border and can be clicked to Defend.
  const threats = new Set();
  for (let p = 0; p < 2; p++) {
    for (const g of gatesOf(state, p)) {
      const t = topOf(state, g);
      if (t && t.owner !== p) threats.add(t.uid);
    }
  }
  pieces.setThreats(threats);

  // A power change is invisible unless it is drawn, so every fighter carries a
  // counter when its power differs from what is printed on the card.
  for (const [, piece] of pieces.byUid) {
    const card = piece.card;
    const printed = defs[card.def]?.power;
    if (printed == null) { piece.setMarkers({}); continue; }
    const live = powerOf(state, card);
    piece.setMarkers({ powerDelta: live - printed, tokens: card.tokens || [] });
  }
  if (before) {
    // the top card of the attacking square, as it stood before the attack
    let attackerUid = null;
    if (move?.k === 'action' && move.action.t === 'attack') {
      for (const [uid, at] of before) {
        if (at.square === move.action.from && at.depth === 0) attackerUid = uid;
      }
    }
    playAnimations(changes, graveBefore, move, attackerUid);
  }
  // What the RULES said happened, which the board diff cannot know: that this
  // was a Convict and not a plain attach, a Fire Bolt and not a plain destroy.
  //
  // Only after a MOVE. The notes sit on the state until the next action
  // replaces them, and sync() also runs for cosmetic reasons — selecting a
  // square, closing a panel — so playing them every time meant the Shard
  // Dragon's fire went off again every time you clicked anything.
  if (fx && move && state.fx?.length) {
    // TWO MOTIFS CANNOT DRAG THE SAME CARD. An Umbren Jailor's catch leaves
    // BOTH a `chains` note and a `bury` one, and each of them takes hold of
    // the victim. `bury` registers second, so it wins every frame: it shoved
    // the card under the stack in a fifth of a second while the irons were
    // still in the air, and left the chain stretched across empty stone
    // behind it. That is what "the chains went after the card was moved
    // under" looks like on screen. The first carrying KIND to fire wins the
    // action — by kind and not by event, or a Man Catcher sweeping a square
    // would keep the first chain and lose the other two.
    let carrier = null;
    for (const ev of state.fx) {
      if (CARRIED.has(ev.kind)) {
        if (carrier === null) carrier = ev.kind;
        else if (ev.kind !== carrier) continue;
      }
      fx.play(ev);
    }
  }

  if (zonesBefore) {
    playDeckAnimations(zonesBefore);
    const lost = [0, 1].map((p) => changes.left.filter((l) => {
      const c = [...state.players[p].graveyard].find((x) => x.uid === l.uid);
      return !!c;
    }).length);
    playHandDiscards(zonesBefore, lost);
  }
  hud.select(sel.kind === 'hand' ? sel.uid : null);
  hud.render(state, defs, {
    sieged: [isSieged(state, 0), isSieged(state, 1)],
    names: deckNames,
    handOf: online ? mySide : state.active,
  });
  // The Void is opened by the rules, not by the view: a deck that mentions it
  // puts it beside the battlefield, and otherwise there is no tenth square.
  board.setVoid(!!state.locations?.void);
  board.setDecks(
    [state.players[0].deck.length, state.players[1].deck.length],
    // A Stronghold that has RISEN is a fighter on the board and is drawn there,
    // so the plinth only shows the card while it is still sitting under the deck.
    [0, 1].map((p) => {
      const sh = state.strongholds[p];
      if (!sh?.card || (sh.revealed && !sh.art)) return null;
      return defs[sh.card.def]?.img || null;
    }),
  );
  board.setGraveyards(
    [state.players[0].graveyard.length, state.players[1].graveyard.length],
    [0, 1].map((p) => {
      const gy = state.players[p].graveyard;
      const last = gy[gy.length - 1];
      return last ? (defs[last.def]?.img || null) : null;
    }),
  );
  paintBoard();
  refreshDeckGlow();

  if (state.pending && mine()) {
    hud.askChoice(state.pending.request, labelFor,
      (answer) => submit({ k: 'choice', answer }), artFor);
    hud.hint(state.pending.request.prompt || 'Choose');
  } else if (state.pending) {
    hud.askChoice(null);
    hud.hint(`Waiting for ${deckNames[whoseChoice()]}…`);
  } else {
    hud.askChoice(null);
    hud.hint(online && !mine() ? `Waiting for ${deckNames[state.active]}…` : '');
  }

  if (state.winner !== null) {
    // The ending is the arena's, not a banner's — game/js/victory.js takes the
    // light, the camera and the fallen Stronghold. It is idempotent, which it
    // has to be: sync() runs again on every hover of a finished board.
    endGame({
      state, defs, deckNames, arena, board, pieces, anim, camera, hud,
      // Online there is no question whose defeat this is. On one screen both
      // players are sitting here, so nobody LOST — it is shown from the
      // winner's chair as the victory it is.
      you: online ? mySide : (state.winner === 1 ? 1 : 0),
      onAgain: leaveGame,
    });
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
    const kind = state.pending.request.kind;
    for (const o of state.pending.request.options || []) {
      const s = optionSquare(o, kind);
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
        if (a.from !== sel.from) continue;
        if (sel.mode && a.t !== sel.mode) continue;
        // white to walk into, red to fight — they must not read the same
        if (a.t === 'move') states[a.to] = 'target';
        else if (a.t === 'attack') states[a.to] = 'attack';
      }
    }
  }

  if (hovered.square != null && !states[hovered.square]) states[hovered.square] = 'hover';
  board.setStates(states, state.board.map((sq) => (sq || []).length));

  // Back Row and Gates are computed, and cards move them, so the board is told
  // the live answer rather than assuming the printed squares.
  board.setZones({
    backRow: [state.backRow?.[0] || [], state.backRow?.[1] || []],
    gates: [[...gatesOf(state, 0)], [...gatesOf(state, 1)]],
  }, viewSide);
}

/* ------------------------------------------------------------ animation */

/**
 * Draws and mills never touch the board, so the board diff cannot see them.
 * Compare the deck, hand and graveyard counts instead.
 */
function playDeckAnimations(zonesBefore) {
  for (let p = 0; p < 2; p++) {
    const was = zonesBefore[p];
    const now = state.players[p];

    // Cards that went the OTHER way — shuffled back in. Migration does this to
    // itself, and a Tactic never gets a piece on the board at all, so without
    // this the card left the hand and nothing whatever was drawn: the deck
    // just silently grew by one.
    const back = now.deck.filter((c) => !was.deckUids.has(c.uid));
    for (const c of back) {
      const seat = handOrigins.get(c.uid);
      anim.shuffleIntoDeck(p, defs[c.def] || {}, {
        origin: seat ? screenToWorld(seat.x, seat.y) : null,
        pile: board.deckPickables()[p],
        count: now.deck.length,
      });
    }

    const drewFromDeck = was.deck - now.deck.length;
    if (drewFromDeck <= 0) continue;

    const wentToHand = now.hand.length - was.hand.length;
    const wentToGrave = now.graveyard.length - was.grave;

    // A Sieged player mills instead of drawing: the card goes to the graveyard.
    for (let i = 0; i < Math.min(drewFromDeck, Math.max(0, wentToHand)); i++) anim.draw(p);
    for (let i = 0; i < Math.min(drewFromDeck, Math.max(0, wentToGrave)); i++) anim.mill(p);
  }
}

/**
 * Cards discarded straight out of hand — Defend's cost, Arcane Blast's cost.
 * They never reach the board, so only the hand and graveyard counts show them.
 */
function playHandDiscards(zonesBefore, boardLosses) {
  for (let p = 0; p < 2; p++) {
    const was = zonesBefore[p];
    const now = state.players[p];
    const handLost = was.hand.length - now.hand.length;
    const drewIn = Math.max(0, was.deck - now.deck.length);
    const graveGained = now.graveyard.length - was.grave;
    // whatever reached the graveyard that did not come off the board or the deck
    const fromHand = Math.min(
      Math.max(0, handLost),
      Math.max(0, graveGained - boardLosses[p] - drewIn),
    );
    // Prefer the cards that actually left this player's hand, so each one
    // flies out of the slot it was sitting in — and carries its own face.
    const stillHeld = new Set(now.hand.map((c) => c.uid));
    // A card that left the hand for the DECK is not a discard; it has its own
    // animation and must not also be thrown on the pile.
    const wentToDeck = new Set(now.deck.map((c) => c.uid));
    const left = (was.hand || [])
      .filter((c) => !stillHeld.has(c.uid) && !wentToDeck.has(c.uid));
    for (let i = 0; i < fromHand; i++) {
      const card = left[i];
      const seat = card ? handOrigins.get(card.uid) : null;
      anim.discardFromHand(p, undefined, seat ? screenToWorld(seat.x, seat.y) : null,
        card ? (defs[card.def] || null) : null);
    }
  }
}

/** Turn a board diff into something worth watching. */
function playAnimations(changes, graveBefore, move, attackerUid) {
  const action = move?.k === 'action' ? move.action : null;
  const died = (uid) => [0, 1].some(
    (p) => state.players[p].graveyard.some((c) => c.uid === uid));

  // Nothing may die before the effect that killed it has landed. Each motif
  // declares its own wait, next to the animation it was measured against.
  const wait = fx?.killWait(state.fx) ?? 0;
  const killOff = () => (wait > 0 ? anim.add(wait, () => {}, killNow) : killNow());

  const killNow = () => {
    for (const l of changes.left) {
      const piece = pieces.get(l.uid);
      if (!piece) continue;
      const gone = died(l.uid) && !graveBefore?.has(l.uid);
      const finish = () => { pendingRetire.delete(l.uid); pieces.retire(l.uid); };
      // Whoever showed HOW this card went owns its going. Otherwise the card
      // burns up and is THEN struck flat and thrown on the pile by the generic
      // death running underneath — two deaths for one fighter, and the effect
      // reads as something that merely happened near the card.
      const owned = fx?.exitFor(state.fx, gone ? 'destroy' : 'hand');
      if (owned) owned(piece, l.from, finish);
      else if (gone) anim.destroy(piece, l.from, finish);
      else anim.vanish(piece, finish);
    }
  };

  if (action?.t === 'attack') {
    // Who attacked is a fact from BEFORE the action, not something to infer
    // from pieces whose square may already be stale.
    const shown = pieces.get(attackerUid);
    if (shown) anim.attack(shown, action.from, action.to, { onImpact: killOff });
    else killOff();

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
    else {
      const seat = handOrigins.get(e.uid);
      anim.deploy(piece, e.to, undefined, seat ? screenToWorld(seat.x, seat.y) : null);
    }
  }
  // A card SHOVED or BLINKED by an effect must not set off before the effect
  // that moves it has taken hold, for the same reason a card it kills must not
  // vanish early: the rules resolve instantly, the motif does not.
  // Delaying the move is not enough on its own: a piece with no animation
  // running lerps toward its RESTING place every frame, so it simply walked to
  // the new square by itself while the bolt was still in the air. Holding
  // `animating` is what actually pins it where the effect can find it.
  const pin = () => {
    for (const m of changes.moved) {
      const piece = pieces.get(m.uid);
      if (!piece) continue;
      piece.animating = true;
      // The card's own height, read BEFORE the copy. Written as
      // `.copy(p).setY(piece.group.position.y)` the argument is evaluated
      // after copy() has already zeroed it, so every pinned card was dropped
      // to y=0 — under the flagstone face at 0.080, which is to say it stopped
      // being drawn at all while it waited for its effect.
      const y = piece.group.position.y;
      piece.group.position.copy(squareToWorld(m.from)).setY(y);
      pinnedMoves.push({ uid: m.uid, from: m.from, to: m.to, at: piece.group.position.clone() });
    }
  };
  const moveOff = () => {
    for (const m of changes.moved) {
      const piece = pieces.get(m.uid);
      if (piece) anim.move(piece, m.from, m.to);
    }
  };

  // A CARRYING motif does the moving itself — and both the tow and the jailer
  // FIND their man by looking for a card standing a square away from where the
  // rules now put it, so it has to still be standing there. It is asked for
  // the whole action rather than per card, because a motif picks its victims
  // off the board and the event only ever names the captor.
  if ((state.fx || []).some((ev) => CARRIED.has(ev.kind))) pin();
  else if (wait > 0) { pin(); anim.add(wait, () => {}, moveOff); }
  else moveOff();
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
    sel = { kind: 'hand', uid: card.uid, from: null, mode: null };
    hud.hint(plays[0].t === 'construct'
      ? `Where does ${def.name} go?` : `Attach ${def.name} to whom?`);
    sync();
    return;
  }

  if (!acts.some((a) => a.t === 'deploy' && a.card === card.uid)) {
    hud.hint(`Nowhere to deploy ${def.name}.`);
    return;
  }
  sel = { kind: 'hand', uid: card.uid, from: null, mode: null };
  hud.hint(`Choose a square for ${def.name}.`);
  sync();
}

/** Clicking your own Stronghold pile draws a card. */
function onDeckClick(player) {
  if (!mine() || anim.busy || state.pending || state.winner !== null) return;
  if (player !== state.active) {
    hud.hint('That is not your Stronghold.');
    return;
  }
  const draw = legalActions(state).find((a) => a.t === 'draw');
  if (draw) submit({ k: 'action', action: draw });
  else hud.hint('Your Stronghold is empty.');
}

/**
 * A point on the screen, as a place on the table.
 *
 * The hand is HTML laid over the scene, so a card leaving it has to be given a
 * world position to fly from — otherwise it can only come in from off-stage,
 * which is what every played card used to do.
 */
const FLIGHT_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.6);
function screenToWorld(x, y) {
  ndc.x = (x / innerWidth) * 2 - 1;
  ndc.y = -(y / innerHeight) * 2 + 1;
  ray.setFromCamera(ndc, camera);
  const hit = new THREE.Vector3();
  return ray.ray.intersectPlane(FLIGHT_PLANE, hit) ? hit : null;
}

/** Where a square is on screen, for placing the menu. */
function screenPointOf(square) {
  const p = squareToWorld(square).clone();
  p.y = 0.6;
  p.project(camera);
  return { x: (p.x * 0.5 + 0.5) * innerWidth, y: (-p.y * 0.5 + 0.5) * innerHeight };
}

/** Build the menu for whatever is on this square. */
function openActionMenu(square) {
  const acts = legalActions(state);
  const top = topOf(state, square);
  // Constructs sit outside state.board, so a menu built only from the fighter
  // on a square could never reach one — Ballista's ability was unusable.
  const con = (state.constructs || []).find((c) => c && c.square === square);
  if (!top && !con) return false;
  const items = [];

  if (top && top.owner === state.active) {
    const canMove = acts.some((a) => a.t === 'move' && a.from === square);
    const canFight = acts.some((a) => a.t === 'attack' && a.from === square);
    // A spent fighter can do nothing at all, so say that once rather than
    // leaving three greyed rows with no explanation.
    const spent = top.fatigued && !state.derived.actWhileFatigued.has(top.uid);
    // A fighter that just arrived is fatigued too, which is the usual reason an
    // ability looks dead the turn you play the card.
    const why = spent ? 'Fatigued — it can act again on your next turn.' : null;

    items.push({
      label: 'Move', kind: 'move', disabled: !canMove,
      detail: canMove ? 'Slide into an empty adjacent square.' : (why || 'Nowhere to go.'),
      onPick: () => {
        sel = { kind: 'board', uid: top.uid, from: square, mode: 'move' };
        hud.hint('Choose a square to move to.');
        pieces.clearSelection();
        pieces.topAt(square)?.setSelected(true);
        sync();
      },
    });
    items.push({
      label: 'Fight', kind: 'fight', disabled: !canFight,
      detail: canFight ? 'Attack an adjacent enemy. Higher power wins; a tie kills both.'
        : (why || 'No enemy in reach.'),
      onPick: () => {
        sel = { kind: 'board', uid: top.uid, from: square, mode: 'attack' };
        hud.hint('Choose an enemy to attack.');
        pieces.clearSelection();
        pieces.topAt(square)?.setSelected(true);
        sync();
      },
    });

    // Action abilities by name, with the card's own words underneath —
    // INCLUDING the ones an Attachment grants, which are otherwise invisible.
    const own = (defs[top.def]?.rules || []).filter((r) => r.k === 'action');
    let ownSeen = 0;
    actionAbilitiesOf(state, top).forEach((entry) => {
      const act = acts.find((a) => a.t === 'ability' && a.uid === top.uid && a.index === entry.index);
      const granted = entry.ability.from != null;
      let detail = '';
      let label = entry.ability.name || 'Ability';

      if (granted) {
        const src = (top.attachments || []).find((a) => a.uid === entry.ability.from);
        const sdef = src && defs[src.def];
        detail = sdef ? (sdef.text || '') : '';
        label = `${label} (from ${sdef ? sdef.name : 'an Attachment'})`;
      } else {
        const rule = own[ownSeen++] || {};
        detail = rule.text || '';
        if (!label || label === 'Ability') label = rule.name || 'Ability';
      }

      items.push({
        label, kind: 'ability', disabled: !act,
        detail: detail + (act ? '' : `\n${why || 'Cannot be used right now.'}`),
        onPick: () => act && submit({ k: 'action', action: act }),
      });
    });
  } else if (top) {
    // An enemy standing in your Gates can be thrown off it — at a price.
    const def = acts.find((a) => a.t === 'defend' && a.square === square);
    const cost = powerOf(state, top);
    if (def) {
      items.push({
        label: `Defend — destroy it`, kind: 'defend',
        detail: `Discard ${cost} card${cost === 1 ? '' : 's'} from your hand to destroy this fighter.`,
        onPick: () => submit({ k: 'action', action: def }),
      });
    } else if (gatesOf(state, state.active).includes(square)) {
      items.push({
        label: 'Defend', kind: 'defend', disabled: true,
        detail: `You need ${cost} card${cost === 1 ? '' : 's'} in hand to defend.`,
        onPick: () => {},
      });
    }
  }

  // A Construct on this square brings its own Action abilities.
  if (con && con.owner === state.active) {
    const rules = (defs[con.def]?.rules || []).filter((r) => r.k === 'action');
    let seen = 0;
    actionAbilitiesOf(state, con).forEach((entry) => {
      const act = acts.find((a) => a.t === 'ability' && a.uid === con.uid && a.index === entry.index);
      const rule = rules[seen++] || {};
      items.push({
        label: `${entry.ability.name || rule.name || 'Ability'} — ${defs[con.def]?.name || 'Construct'}`,
        kind: 'ability', disabled: !act,
        detail: (rule.text || '') + (act ? '' : '\nCannot be used right now.'),
        onPick: () => act && submit({ k: 'action', action: act }),
      });
    });
  }

  if (!items.length) return false;
  hud.showActions(screenPointOf(square), items);
  return true;
}

function onSquareClick(square) {
  if (state.winner !== null || anim.busy) return;
  hud.hideActions();

  // READING is always allowed. Only acting waits for your turn — you could not
  // even look at what was on a square while the opponent was thinking.
  if (!mine()) {
    pinnedGrave = null;
    pinnedSquare = square;
    showStackFor(square);
    return;
  }

  if (state.pending) {
    const req = state.pending.request;
    if (req.type === 'one') {
      const match = (req.options || []).find((o) => optionSquare(o, req.kind) === square);
      if (match !== undefined) submit({ k: 'choice', answer: match });
      else hud.hint(`${req.prompt || 'Choose'} — that is not one of the options.`);
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
    // Move and Fight are chosen from the menu, so a pending selection knows
    // which it is — white squares must not silently become an attack.
    const want = sel.mode === 'attack' ? 'attack' : sel.mode === 'move' ? 'move' : null;
    const a = acts.find((x) => (want ? x.t === want : (x.t === 'move' || x.t === 'attack'))
      && x.from === sel.from && x.to === square);
    if (a) return submit({ k: 'action', action: a });
  }

  // Pin whatever is on this square so it can be READ while you decide.
  pinnedGrave = null;
  pinnedSquare = square;
  showStackFor(square);

  // The menu is the only route to an ability. It was written and then never
  // called: clicking a fighter silently put it into move-mode, and a
  // Construct's ability (Ballista) was unreachable altogether, because
  // Constructs do not live on state.board.
  const top = topOf(state, square);
  if (openActionMenu(square)) {
    if (top && top.owner === state.active) {
      pieces.clearSelection();
      pieces.topAt(square)?.setSelected(true);
    }
    sync();
    return;
  }
  if (top && top.owner === state.active) hud.hint('That fighter has nothing it can do.');

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
    return { square: piece.square, piece, deck: null, grave: null };
  }
  // the Stronghold pile is a target too — clicking it takes a Draw
  const deckHit = ray.intersectObjects(board.deckPickables(), false)[0];
  if (deckHit) return { square: null, piece: null, deck: deckHit.object.userData.deckOf, grave: null };

  const graveHit = ray.intersectObjects(board.gravePickables(), false)[0];
  if (graveHit) return { square: null, piece: null, deck: null, grave: graveHit.object.userData.graveOf };

  const tileHit = ray.intersectObjects(board.pickables(), false)[0];
  if (tileHit) return { square: tileHit.object.userData.square, piece: null, deck: null, grave: null };
  return { square: null, piece: null, deck: null, grave: null };
}

addEventListener('pointermove', (ev) => {
  if (!pieces) return;
  // Hovering the stack panel must not re-aim the board underneath it.
  if (ev.target !== canvas) return;
  const hit = pick(ev);
  if (hit.square !== hovered.square || hit.piece !== hovered.piece
      || hit.deck !== hovered.deck || hit.grave !== hovered.grave) {
    hovered = hit;
    pieces.setHovered(hit.piece);
    if (pinnedGrave != null) showGraveyardFor(pinnedGrave);
    else if (pinnedSquare != null) showStackFor(pinnedSquare);
    else if (hit.grave != null) showGraveyardFor(hit.grave);
    else showStackFor(hit.square);
    refreshDeckGlow();
    paintBoard();
    const over = hit.square != null || (hit.deck != null && canDraw());
    canvas.style.cursor = over ? 'pointer' : 'default';
  }
});

/** Hovering a discard pile lists what is in it, newest first. */
function showGraveyardFor(player) {
  const gy = state.players[player].graveyard;
  if (!gy.length) {
    if (pinnedGrave === player) hud.showGraveyard(deckNames[player], [], { pinned: true, onClose: closePanel });
    else hud.hideStack();
    return;
  }
  hud.showGraveyard(deckNames[player], gy.map((c) => {
    const d = defs[c.def] || {};
    return {
      img: d.img, name: d.name || 'card',
      power: d.power ? ['', 'I', 'II', 'III'][d.power] : null,
    };
  }), { pinned: pinnedGrave === player, onClose: closePanel });
}

/** Put the panel away and go back to following the pointer. */
function closePanel() {
  unpin();
  if (hovered.grave != null) showGraveyardFor(hovered.grave);
  else showStackFor(hovered.square);
}

/** Is a Draw legal for whoever is playing? */
function canDraw() {
  if (!state || state.winner !== null || state.pending || !mine() || anim.busy) return false;
  return legalActions(state).some((a) => a.t === 'draw');
}

function refreshDeckGlow() {
  board.setDrawable(canDraw() ? state.active : null, hovered.deck);
}

/**
 * Hovering a square lists everything on it, top to bottom. Only the top card of
 * a stack is in play and the rest are hidden underneath it, so without this you
 * cannot see what a stack is made of.
 */
function showStackFor(square) {
  if (square == null || !state) { hud?.hideStack(); return; }
  const stack = state.board[square] || [];
  const construct = (state.constructs || []).find((c) => c && c.square === square);
  if (!stack.length && !construct) { hud.hideStack(); return; }

  const rows = stack.map((card, i) => {
    const d = defs[card.def] || {};
    return {
      img: d.img, name: d.name || 'card',
      power: d.power ? ['', 'I', 'II', 'III'][d.power] : null,
      top: i === 0,
      attachments: (card.attachments || []).map((a) => ({
        img: defs[a.def]?.img, name: defs[a.def]?.name || 'attachment',
      })),
    };
  });

  if (construct) {
    const d = defs[construct.def] || {};
    rows.push({
      // a facedown Trap is hidden information and stays hidden
      img: construct.facedown ? null : d.img,
      name: construct.facedown ? 'Facedown Trap' : (d.name || 'Construct'),
      power: null, top: false,
      attachments: (construct.attachments || []).map((a) => ({
        img: defs[a.def]?.img, name: defs[a.def]?.name || 'attachment',
      })),
    });
  }
  hud.showStack(rows, { pinned: pinnedSquare === square, onClose: closePanel });
}

addEventListener('pointerdown', (ev) => {
  if (!pieces) return;
  // A click on the HUD belongs to the HUD. This listener fires BEFORE the
  // button's own click, and acting on it rebuilt the action menu — which threw
  // the button away before it could be pressed, so Move and Fight did nothing
  // at all. The menu only started appearing once it was finally wired up, so
  // this never showed until now.
  if (ev.target !== canvas) return;

  // Right-click reads a card. Left-click plays. Enlarging on hover made the
  // board hard to click, because the card under the pointer grew over its own
  // neighbours.
  if (ev.button === 2) {
    const hit = pick(ev);
    const already = pieces.inspecting;
    pieces.setInspected(hit.piece && hit.piece !== already ? hit.piece : null);
    return;
  }
  if (ev.button !== 0) return;

  // A left-click anywhere puts the inspected card back down first.
  if (pieces.inspecting) { pieces.setInspected(null); return; }
  hud?.hideActions();

  const hit = pick(ev);
  if (hit.grave != null) {
    // A discard pile reads like any other place on the table: click it and it
    // STAYS open, so you can go back through what has died instead of holding
    // the mouse still on a pile of cards. Click it again to close it.
    pinnedSquare = null;
    pinnedGrave = pinnedGrave === hit.grave ? null : hit.grave;
    if (pinnedGrave == null) closePanel(); else showGraveyardFor(hit.grave);
    return;
  }
  if (hit.deck != null) { onDeckClick(hit.deck); return; }
  if (hit.square != null) { onSquareClick(hit.square); return; }
  unpin();                       // clicking the ground puts the panel away
  hud.hideStack();
});

// the browser menu would otherwise eat the right-click
addEventListener('contextmenu', (ev) => {
  if (state) ev.preventDefault();
});

addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && state) {
    unpin();
    hud?.hideStack();
    hud?.hideActions();
    sel = { kind: null, uid: null, from: null, mode: null };
    pieces?.clearSelection();
    pieces?.setInspected(null);
    hud?.hint('');
    sync();
  }
});

/**
 * Safety nets, run whenever the animator falls idle.
 *
 * Anything still on screen that is no longer in the game goes: a corpse left
 * standing until the next click was the symptom of trusting a single callback
 * to clean up.
 *
 * And any card pinned on its old square for a carrying motif that never came
 * for it. One still lying EXACTLY where it was pinned was never picked up —
 * the motif did not exist, or it threw — so it is let go and slid home rather
 * than left frozen there for the rest of the game. Anything that did move is
 * simply released.
 */
function sweepIdle() {
  if (!pieces || anim.busy) return;
  for (const uid of [...pendingRetire]) {
    pendingRetire.delete(uid);
    pieces.retire(uid);
  }
  for (const p of pinnedMoves.splice(0)) {
    const piece = pieces.get(p.uid);
    if (!piece || !piece.animating) continue;
    piece.animating = false;
    if (piece.group.position.distanceToSquared(p.at) < 1e-6) anim.move(piece, p.from, p.to);
  }
}

/* ------------------------------------------------------------ loop */

const clock = new THREE.Clock();
function frame() {
  const real = Math.min(clock.getDelta(), 0.05);
  // The envelope is stepped with REAL time; the animation with slowed time.
  // Driving the envelope with its own output makes the tail asymptotic — the
  // slower it gets the slower it lets go, and the camera never comes home.
  drama.update(real);
  const dt = real * drama.timeScale;

  // The arena keeps its own time. Slowing the braziers with everything else
  // reads as the machine struggling rather than as a held breath, and the fire
  // is the one thing in frame the player knows the real speed of.
  arena.update(real);
  board.update(dt);
  anim.update(dt);

  sweepIdle();

  pieces?.update(dt, camera);

  const want = viewSide === 0 ? 0 : Math.PI;
  const diff = ((want - viewAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  viewAngle += diff * Math.min(1, real * 2.6);
  placeCamera();

  // The idle sway runs on wall clock and must keep doing so: freezing it
  // during a push-in is the difference between a held breath and a stutter.
  const t = performance.now() * 0.00013;
  camera.position.x += Math.sin(t) * 0.30;
  camera.position.y += Math.cos(t * 1.3) * 0.16;

  // Last, and as a displacement: placeCamera() rebuilds the camera from
  // scratch every frame, so anything that tried to OWN camera.position would
  // be overwritten before it was ever drawn.
  drama.apply(camera, camLook);

  // A card held up to be read is the top of the world while it is up.
  board?.setOverlaysHidden(!!pieces?.inspecting);

  renderer.render(arena.scene, camera);
  requestAnimationFrame(frame);
}
frame();

window.__table = {
  get state() { return state; }, arena, board, camera,
  get pieces() { return pieces; }, get net() { return net; },
  // exposed so the click path can be driven from a test without synthesising
  // pointer events against a moving camera
  clickSquare: (n) => onSquareClick(n),
  clickGrave: (p) => { pinnedSquare = null; pinnedGrave = p; showGraveyardFor(p); },
  legal: () => legalActions(state),
  get fx() { return fx; },
  anim, drama,
  // so a test can stage a board and see it drawn without faking pointer events
  resync: () => { refreshRules(state); sync(); },
  // the idle safety nets, so a test driving anim.update by hand gets the same
  // clean-up the frame loop does
  settle: () => sweepIdle(),
  choose: (answer) => submit({ k: 'choice', answer }),
  play: (action) => submit({ k: 'action', action }),
};
