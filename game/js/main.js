// The table: engine + battlefield + input.
//
// The engine (js/engine.js) is the authority. Nothing here decides a rule; it
// asks legalActions() what is possible, shows that on the board, and sends the
// chosen action back. That is also what makes the netcode later a matter of
// shipping actions rather than board state.

import * as THREE from 'three';
import { Arena, STEP, LITE } from './arena.js';
import { Board, squareToWorld } from './board.js';
import { Pieces } from './pieces.js';
import { Hud } from './hud.js';
import {
  createGame, legalActions, apply, isSieged, GATES, topOf,
} from '../../js/engine.js';

const boot = document.getElementById('boot');
const bootMsg = document.getElementById('boot-msg');

/* ------------------------------------------------------------ renderer */

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = !LITE;   // software GL cannot afford shadows
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;

const arena = new Arena(renderer);
const board = new Board(arena.scene);

// Three-quarter view down the field. The framing has to hold the whole run —
// your deck, three rows of three, their deck — which is about 11 units of Z, so
// the camera sits higher and further back than a board-only view would need.
const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 400);
const CAM_DIST = 17.4, CAM_HEIGHT = 17.6;
// Aimed slightly in FRONT of the centre, which pitches the camera down and
// lifts the whole run up the frame — otherwise the near Stronghold sits behind
// the hand bar and you never see your own deck.
const CAM_LOOK = new THREE.Vector3(0, 0.2, 2.1);

// The board always faces the player whose turn it is: the camera sits at THEIR
// end of the field. It never swings side-on — only end to end. Over the
// network this is pinned to the local player and never moves, which is why it
// is a view setting rather than anything the rules know about.
let viewSide = 0;          // which end we are looking from
let viewAngle = 0;         // eased, 0 = player 0's end, PI = player 1's end

function cameraSideFor(p) { return p; }

function placeCamera() {
  const s = Math.sin(viewAngle), c = Math.cos(viewAngle);
  camera.position.set(CAM_DIST * s, CAM_HEIGHT, CAM_DIST * c);
  // the aim point swings with the view, so "in front of centre" stays in front
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

/* ------------------------------------------------------------ game */

let defs = {}, deckList = [], state = null, pieces = null, hud = null;
let deckNames = ['Player One', 'Player Two'];

// what the player is currently doing
let sel = { kind: null, uid: null, from: null };   // kind: 'hand' | 'board'
let hovered = { square: null, piece: null };

const params = new URLSearchParams(location.search);

// ?side=0|1 pins the view to one end, which is what a networked client does.
const PINNED_SIDE = params.has('side') ? Number(params.get('side')) : null;

async function start() {
  bootMsg.textContent = 'Dealing…';
  const data = await fetch('data/decks.json').then((r) => r.json());
  defs = data.defs;
  deckList = data.decks;

  const nameOf = (want, fallback) => {
    const d = deckList.find((x) => x.name.toLowerCase() === (want || '').toLowerCase());
    return (d || deckList[fallback]).name;
  };
  const pick = (want, fallback) => {
    const d = deckList.find((x) => x.name.toLowerCase() === (want || '').toLowerCase());
    return (d || deckList[fallback]).cards;
  };
  const d0 = pick(params.get('p0'), 0);
  const d1 = pick(params.get('p1'), 1);
  deckNames = [nameOf(params.get('p0'), 0), nameOf(params.get('p1'), 1)];

  state = createGame({
    seed: Number(params.get('seed')) || Math.floor(Math.random() * 1e9),
    defs, decks: [d0, d1], first: 0,
  });

  pieces = new Pieces(arena.scene, defs);
  hud = new Hud(document.getElementById('hud'), { onHandPick });

  sync();
  hud.log('The battle begins.');
  boot.classList.add('gone');
}

/** Push engine state into the view. */
function sync() {
  viewSide = PINNED_SIDE ?? state.active;
  pieces.sync(state);
  hud.select(sel.kind === 'hand' ? sel.uid : null);
  hud.render(state, defs, { sieged: [isSieged(state, 0), isSieged(state, 1)], names: deckNames });
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

  if (state.winner !== null) {
    const text = state.winner === 0 || state.winner === 1 ? `${deckNames[state.winner]} wins'`.replace("'", '')
      : state.winner === 'stalemate' ? 'Stalemate' : 'Draw';
    hud.banner(`${text} — ${state.reason || ''}`, state.winner === 0 ? 'good' : 'bad');
  }
}

/** Highlight whatever the current selection makes possible. */
function paintBoard() {
  const states = {};

  // a Gates under siege always shows as danger, whatever else is going on
  for (let p = 0; p < 2; p++) if (isSieged(state, p)) states[GATES[p]] = 'danger';

  const acts = legalActions(state);

  if (sel.kind === 'hand') {
    for (const a of acts) if (a.t === 'deploy' && a.card === sel.uid) states[a.to] = 'target';
  } else if (sel.kind === 'board') {
    states[sel.from] = 'source';
    for (const a of acts) {
      if ((a.t === 'move' || a.t === 'attack') && a.from === sel.from) states[a.to] = 'target';
    }
  }

  if (hovered.square != null && !states[hovered.square]) states[hovered.square] = 'hover';
  board.setStates(states, state.board.map((sq) => sq.length));
}

/* ------------------------------------------------------------ actions */

function act(action) {
  if (!action || state.winner !== null) return;
  const before = state.active;
  try {
    apply(state, action);
  } catch (e) {
    hud.hint(`Illegal: ${e.message}`);
    return;
  }
  describe(action, before);
  sel = { kind: null, uid: null, from: null };
  hovered.piece = null;
  pieces.setHovered(null);
  sync();
}

function describe(a, p) {
  const who = deckNames[p];
  const name = (uid) => {
    const c = [...state.players[p].graveyard, ...state.players[p].hand].find((x) => x.uid === uid);
    return c ? (defs[c.def]?.name || 'a card') : 'a card';
  };
  switch (a.t) {
    case 'draw': hud.log(`${who} drew a card.`); break;
    case 'deploy': hud.log(`${who} deployed ${name(a.card)}.`); break;
    case 'move': hud.log(`${who} moved ${a.from} → ${a.to}.`); break;
    case 'attack': hud.log(`${who} attacked ${a.to}.`); break;
    case 'defend': hud.log(`${who} defended the Gates.`); break;
    case 'tactic': hud.log(`${who} played ${name(a.card)}.`); break;
    default: hud.log(`${who} acted.`);
  }
}

function onHandPick(card, def) {
  if (state.winner !== null) return;
  const acts = legalActions(state);

  if (def.type !== 'fighter') {
    const play = acts.find((a) => a.t === 'tactic' && a.card === card.uid);
    if (play) {
      if (def.inert) hud.hint(`${def.name} has no implemented effect — it just costs the action.`);
      act(play);
    } else {
      hud.hint(`${def.name} cannot be played right now.`);
    }
    return;
  }

  const canDeploy = acts.some((a) => a.t === 'deploy' && a.card === card.uid);
  if (!canDeploy) { hud.hint(`Nowhere to deploy ${def.name}.`); return; }

  sel = { kind: 'hand', uid: card.uid, from: null };
  hud.hint(`Choose a square for ${def.name}.`);
  sync();
}

function onSquareClick(square) {
  if (state.winner !== null) return;
  const acts = legalActions(state);

  // completing a pending selection
  if (sel.kind === 'hand') {
    const a = acts.find((x) => x.t === 'deploy' && x.card === sel.uid && x.to === square);
    if (a) return act(a);
  }
  if (sel.kind === 'board') {
    const a = acts.find((x) => (x.t === 'move' || x.t === 'attack')
      && x.from === sel.from && x.to === square);
    if (a) return act(a);
  }

  // otherwise: try to pick up whatever is on this square
  const top = topOf(state, square);
  if (top && top.owner === state.active && !top.fatigued) {
    const has = acts.some((x) => (x.t === 'move' || x.t === 'attack') && x.from === square);
    if (has) {
      sel = { kind: 'board', uid: top.uid, from: square };
      hud.hint('Choose where to move or what to attack.');
      pieces.clearSelection();
      pieces.topAt(square)?.setSelected(true);
      sync();
      return;
    }
    hud.hint('That fighter has nothing it can do.');
  }

  sel = { kind: null, uid: null, from: null };
  pieces.clearSelection();
  sync();
}

/* ------------------------------------------------------------ input */

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();

function pick(ev) {
  ndc.x = (ev.clientX / innerWidth) * 2 - 1;
  ndc.y = -(ev.clientY / innerHeight) * 2 + 1;
  ray.setFromCamera(ndc, camera);

  // cards first — hovering one should enlarge it even though it sits on a tile
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
  if (ev.key === 'Escape') {
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
  pieces?.update(dt, camera);

  // swing end to end when the turn passes, taking the shortest way round
  const want = viewSide === 0 ? 0 : Math.PI;
  let diff = ((want - viewAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  viewAngle += diff * Math.min(1, dt * 2.6);
  placeCamera();

  // and drift a hair so the scene never looks frozen
  const t = performance.now() * 0.00013;
  camera.position.x += Math.sin(t) * 0.30;
  camera.position.y += Math.cos(t * 1.3) * 0.16;

  renderer.render(arena.scene, camera);
  requestAnimationFrame(frame);
}
frame();

start().catch((e) => {
  bootMsg.textContent = `Could not start: ${e.message}`;
  console.error(e);
});

window.__table = { get state() { return state; }, arena, board, get pieces() { return pieces; }, camera };
