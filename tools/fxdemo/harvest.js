// Preview harness for ONE motif: harvest.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&t=300" \\
//     --eval tools/fxdemo/harvest.js --out /tmp/harvest-300.png --settle 700
//
// ?t is MILLISECONDS INTO THE MOTIF. --settle is WALL CLOCK and headless
// rendering runs animation time at a fraction of it, so the animator is taken
// off the frame clock here and stepped by hand to ?t, then frozen. --settle
// then only has to be long enough for Chrome to draw one frame.
//
// ?sq picks the square the card resolves on (default 3, middle row left). The
// motif reaches ACROSS the table to the discard pile, so how it reads depends
// on how far away that is: sq=2 is the near-right square, barely a square from
// the pile, and sq=8 is the far corner, the longest reach on the board. Both
// have to work.
//
// ?grave sets how many cards are in the pile. This matters more than it
// sounds: an empty Graveyard is drawn as a 2cm wafer on its slab, so a motif
// aimed at the top of the pile appeared to be aimed at the ground, and the
// first screenshots of the reach looked like it had missed. Six is a normal
// mid-game pile.
(async () => {
  const T = window.__table, st = T.state;
  const q = new URLSearchParams(location.search);
  const put = (sq, def, own) => {
    const u = ++st.nextUid;
    st.board[sq] = [{ uid: u, def, owner: own, fatigued: false, attachments: [] }];
    return u;
  };
  st.board = Array.from({ length: 12 }, () => []);
  // ?side=1 plays it for the far player, whose Graveyard is at the other end
  // of the table and whose hand is off the TOP of the screen. The bow of the
  // line and the direction the prize leaves in both flip with the owner, and
  // getting one of those wrong is invisible until you look at this.
  const side = Number(q.get('side') ?? 0);
  const sq = Number(q.get('sq') ?? 3);
  const me = put(sq, 'R067', side);    // The Lich itself, one of the three
  if (sq !== 5) put(5, 'M027', 1);     // an enemy, centre-right
  if (sq !== 1) put(1, 'A019', 0);     // a second fighter of yours

  // a real pile to reach into, face up, as the game draws it
  const n = Number(q.get('grave') ?? 6);
  st.players[side].graveyard = Array.from({ length: n }, (_, i) => (
    { uid: ++st.nextUid, def: ['C084', 'C086', 'R072', 'C087'][i % 4], owner: side }));

  // active stays 0 whatever `side` is: watching the far player's harvest from
  // your own chair is the more useful check, and it keeps the camera still.
  st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];
  T.resync();

  // THEN LET THE CAMERA SETTLE. The table swings round to the active player's
  // seat over about a second, and if the page has been sitting long enough for
  // the turn to pass to the far player it is mid-swing when this runs — so
  // forcing `active` back to 0 starts it swinging BACK, and the screenshot
  // caught it at forty-odd degrees off. Every far-side frame came out as a
  // board seen from a corner and was unreadable, which looked like a bug in
  // the motif and was a bug in the harness. The effect itself is frozen below,
  // so this wait costs nothing but wall clock.
  await new Promise((r) => setTimeout(r, 1400));

  const at = Number(q.get('t') || 0) / 1000;
  const real = T.anim.update.bind(T.anim);
  T.anim.update = () => {};            // off the frame clock
  T.fx.play({ kind: 'harvest', at: me, faction: 'Gloaming' });
  for (let t = 0; t < at; t += 1 / 120) real(1 / 120);
  return 'played harvest on sq ' + sq + ' frozen at ' + at.toFixed(2) + 's';
})()
