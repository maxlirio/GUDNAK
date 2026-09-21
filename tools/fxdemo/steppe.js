// Preview harness for ONE motif: steppe (A040 Winds of the Steppe).
//
//   node tools/shot.js --url "game/?quick=1&seed=5&t=400" \\
//     --eval tools/fxdemo/steppe.js --out /tmp/st-400.png \\
//     --wait 10000 --settle 600
//
// ?t is MILLISECONDS INTO THE MOTIF. --settle is WALL CLOCK and headless
// rendering runs animation time at a fraction of it, so the animator is taken
// off the frame clock here and stepped by hand to ?t, then frozen. --settle
// then only has to be long enough for Chrome to draw one frame — and must NOT
// be long, because the table's own opening keeps running in real time and past
// about a second it deals over the board this sets up.
//
// The machine is busy and the table can take many seconds to build, so this
// POLLS for window.__table rather than trusting --wait. Without it a slow load
// photographs the loading screen, which looks exactly like a motif that never
// fired.
//
// THE WHOLE BOARD IS FILLED, because "all fighters that are not in any Gates"
// is the case this motif exists for and judging it on one card would hide the
// only question that matters — whether the nine squares read as ONE event.
//
// IT ALSO FAKES THE SHOVE. main.js pins every card the rules moved at the
// square it LEFT (animating = true, group.position on the old square, and
// piece.square already the new one) and only releases it after the motif's
// declared timing.kill. That pinned state is the only place TWO things the
// motif needs exist: the wind's DIRECTION, and which fighters actually moved —
// a fighter still sitting on its resting place is in a Gate or was blocked,
// and gets the bow wave instead of the tip. A harness that did not reproduce
// it would be testing the fallback heading with every card treated as a Gate.
// ?dir=left|right|up|down sets which way the fake shove goes (default up), and
// ?dir=none leaves nothing pinned so the fallback can be looked at.
(async () => {
  for (let i = 0; i < 400 && !window.__table?.state; i++) {
    await new Promise((r) => setTimeout(r, 50));
  }
  const T = window.__table;
  if (!T?.state) return 'no __table';
  const st = T.state;
  const q = new URLSearchParams(location.search);

  const put = (sq, def, own) => {
    const u = ++st.nextUid;
    st.board[sq] = [{ uid: u, def, owner: own, fatigued: false, attachments: [] }];
    return u;
  };
  st.board = Array.from({ length: 12 }, () => []);

  // A040's own delta table, from js/rules/cards.js: up -3, down 3, left -1,
  // right 1. `up` is a row DECREASE, which is world +z — toward the camera.
  const DELTA = { up: -3, down: 3, left: -1, right: 1 };
  const dir = q.get('dir') ?? 'up';
  const d = DELTA[dir];

  // THE SHOVE IS RUN FOR REAL, by A040's own algorithm, rather than faked.
  // Nine fighters dropped on nine squares and then offset at random gives a
  // board with two cards on one flagstone and a whole column empty — a picture
  // no game can produce, which is worse than useless for judging a motif that
  // is ABOUT where the fighters are. A full board also cannot gust at all:
  // with nowhere to go, every fighter is blocked and nothing moves.
  //
  // So the fighters start on the two ranks FURTHEST UPWIND, which is the
  // arrangement that actually shoves, and the Gates (squares 1 and 7) are
  // among them so they can be seen standing fast while their neighbours go.
  const pre = [];
  for (let s = 0; s < 9; s++) {
    const c = s % 3, r = Math.floor(s / 3);
    const lane = Math.abs(d) === 1 ? c : r;
    const upwind = d < 0 ? lane >= 1 : lane <= 1;
    if (upwind) pre.push(s);
  }
  const occupied = new Set(pre);
  const order = d > 0 ? [8, 7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7, 8];
  const shove = new Map();                       // final square -> square left
  for (const s of order) {
    if (!occupied.has(s)) continue;
    if (s === 1 || s === 7) continue;            // the Gates are spared
    const to = s + d;
    if (to < 0 || to > 8) continue;
    if (Math.abs(d) === 1 && Math.floor(to / 3) !== Math.floor(s / 3)) continue;
    if (occupied.has(to)) continue;
    occupied.delete(s); occupied.add(to);
    shove.set(to, to - d);
  }

  const DEFS = ['A016', 'A019', 'M027', 'A016', 'M017', 'A019', 'M027', 'A016', 'A019'];
  const moved = [];
  for (const s of occupied) put(s, DEFS[s], s % 2 ? 1 : 0);
  st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];
  T.resync();

  // Now put the ones that moved back where they came from and PIN them, which
  // is exactly what main.js does while it waits out this motif's timing.kill.
  if (q.get('dir') !== 'none') {
    for (const [to, from] of shove) {
      const piece = T.pieces.get(st.board[to][0].uid);
      if (!piece) continue;
      piece.animating = true;
      piece.group.position.set(((from % 3) - 1) * 2.62, piece.group.position.y,
        (1 - Math.floor(from / 3)) * 2.62);
      moved.push(`${from}->${to}`);
    }
  }

  // ?zoom=1 drops the camera onto the grid from the same angle, about twice
  // closer, because the nine squares are 250px wide in a 1280px frame and a
  // ragged edge cannot be judged as an edge at that size. JUDGE AT PLAY SCALE
  // FIRST — something that only reads at 2x has failed, which is exactly how
  // the motif this one replaced passed its own reviews. placeCamera() runs
  // every frame, so the position has to be frozen component by component and
  // lookAt taken away; setting either once is overwritten on the next frame.
  if (q.has('zoom')) {
    const cam = T.camera;
    const z = Number(q.get('zoom')) || 1;
    cam.position.set(0, 0.2 + 10.5 / z, 0.4 + 8.2 / z);
    cam.lookAt(0, 0.2, 0.4);
    for (const k of ['x', 'y', 'z']) {
      const val = cam.position[k];
      Object.defineProperty(cam.position, k, { get: () => val, set: () => {} });
    }
    cam.lookAt = () => {};
  }

  const at = Number(q.get('t') || 0) / 1000;
  const real = T.anim.update.bind(T.anim);
  T.anim.update = () => {};            // off the frame clock
  // `at: null` on purpose: Winds of the Steppe is a TACTIC, so the card that
  // resolved is in the graveyard and kit.at() answers nothing. A motif that
  // bailed on that would never once play in a real game.
  T.fx.play({ kind: 'steppe', at: null, faction: 'Auroxi' });
  for (let t = 0; t < at; t += 1 / 120) real(1 / 120);

  // HOW MUCH IS ACTUALLY ON SCREEN. Every layer here is per-vertex alpha under
  // a multiplying map, and at this size "faint" and "not drawn at all" look
  // identical in a board shot — a whole round went on tuning a sheet whose
  // average alpha turned out to be 0.07. This counts the live vertices and
  // reports the strongest alpha in each layer, so a shot that shows nothing
  // can be told apart from a motif that drew nothing.
  const layers = [];
  T.arena.scene.traverse((o) => {
    const col = o.geometry?.attributes?.color;
    if (!col || col.itemSize !== 4 || !o.material?.transparent) return;
    let live = 0, peak = 0;
    for (let i = 3; i < col.array.length; i += 4) {
      if (col.array[i] > 0.02) live++;
      if (col.array[i] > peak) peak = col.array[i];
    }
    if (live) layers.push(`r${o.renderOrder}:${live}/${col.count}@${peak.toFixed(2)}`);
  });

  return `steppe dir=${dir} shoved ${moved.length} [${moved.join(' ')}]`
    + ` frozen at ${at.toFixed(2)}s — ${layers.join(' ') || 'NOTHING DRAWN'}`;
})()
