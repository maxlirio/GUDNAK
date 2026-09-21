// Preview harness for ONE motif: raise.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&t=760" \\
//     --eval tools/fxdemo/raise.js --out /tmp/raise-760.png --wait 10000 --settle 600
//
// ?t is MILLISECONDS INTO THE MOTIF. --settle is WALL CLOCK and headless
// rendering runs animation time at a fraction of it, so the animator is taken
// off the frame clock here and stepped by hand to ?t, then frozen. --settle
// then only has to be long enough for Chrome to draw one frame.
//
// Switches, for the ways this motif is asked for:
//   ?bare=1   fire it on an EMPTY square, the way a Necromancer deploying into
//             open ground does — the flat parts have to drop to the flagstone
//             face at 0.080 instead of riding a card at 0.21
//   ?many=1   fire it on three squares in one breath, the way The Living Dead
//             does, to see whether three graves opening at once read as three
//             different graves or as the same texture stamped three times
//   ?seat=1   the OTHER end of the table. main.js swings the camera to one of
//             two bearings and nowhere else, and the hand is built around
//             knowing which — so every change to it has to be seen from both.
//   ?fxseed=N pin every Math.random the motif draws, so two shots of the same
//             ?t are the same grave and a change can be told from a reroll
//   ?grave=N  how many cards are in the discard pile the souls come out of.
//             NOT COSMETIC. The pile is a box scaled by its own height, so an
//             empty Graveyard is a 2cm wafer on its slab and a motif aimed at
//             the top of the pile then appears to be aimed at the ground —
//             which is what the first shots of the current looked like. Six is
//             a normal mid-game pile; 0 is the legal case where the souls have
//             to come off a bare slab and must still read.
//   ?zoom=N   push the camera in on the square, N world units. WITHOUT THIS
//             THE SHOT IS A LIE BY OMISSION IN BOTH DIRECTIONS: a raise is in
//             drama.js's table, so in the real game this motif is always seen
//             pushed in by 4.6 and at half speed. ?zoom=4.6 is what a player
//             sees; bigger is a magnifying glass for detail, and a hand that
//             only reads there has failed. Default is the plain table view.
//
// A plain screenshot of this at table distance puts the whole grave inside
// about sixty pixels, which is where an earlier pass at the hand was signed
// off as fine. It was not fine. Look at it at 4.6 at least once.
(async () => {
  // The page boots its modules asynchronously and --wait is wall clock, so
  // this polls rather than assuming: an eval that ran a frame early used to
  // throw on __table being undefined and the shot came out an empty table
  // with no hint as to why.
  const T = await (async () => {
    for (let i = 0; i < 400; i++) {
      if (window.__table?.state && window.__table.pieces) return window.__table;
      await new Promise((r) => setTimeout(r, 25));
    }
    throw new Error('__table never appeared');
  })();
  const st = T.state;
  const q = new URLSearchParams(location.search);
  const put = (sq, def, own) => {
    const u = ++st.nextUid;
    st.board[sq] = [{ uid: u, def, owner: own, fatigued: false, attachments: [] }];
    return u;
  };
  st.board = Array.from({ length: 12 }, () => []);
  const me = put(3, 'A016', 0);        // your fighter, centre-left
  const foe = put(5, 'M027', 1);       // an enemy, centre-right
  const friend = put(1, 'A019', 0);    // a second fighter of yours
  const seat = Number(q.get('seat') || 0);
  // A REAL PILE TO COME OUT OF. The current runs from the caster's discard
  // pile, so a harness that stages only the board stages half the motif: with
  // an empty Graveyard the souls launched off a bare slab at the table's edge
  // and every shot of the lead-in looked like the effect had missed. Face up,
  // the way the game draws it.
  const n = Number(q.get('grave') ?? 6);
  st.players[0].graveyard = Array.from({ length: n }, (_, i) => (
    { uid: ++st.nextUid, def: ['C084', 'C086', 'R072', 'C087'][i % 4], owner: 0 }));
  // viewSide follows state.active offline, and the camera EASES to the new
  // bearing over about a second of wall clock — so the seat is chosen first
  // and slept on, or the shot catches the table mid-swing.
  st.active = seat; st.actionsLeft = 3; delete st.pending; st.queue = [];
  T.resync();

  const at = Number(q.get('t') || 0) / 1000;
  const real = T.anim.update.bind(T.anim);
  T.anim.update = () => {};            // off the frame clock
  if (seat) await new Promise((r) => setTimeout(r, 2200));

  // The motif is built out of Math.random — the tear's yaw, which way the hand
  // is turned, the jitter on every finger — and that is right in the game and
  // useless on a bench: two shots of "the same" frame differ enough that you
  // cannot tell a change from a reroll. ?fxseed pins it for the span of the
  // call only, so before and after are the same grave.
  const seed = q.get('fxseed');
  const rng = seed === null ? null : (() => {
    let a = (Number(seed) >>> 0) + 0x6d2b79f5;
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let x = Math.imul(a ^ (a >>> 15), 1 | a);
      x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  })();
  const orig = Math.random;
  if (rng) Math.random = rng;
  if (q.get('bare')) {
    T.fx.play({ kind: 'raise', at: 8, faction: 'Gloaming' });
  } else if (q.get('many')) {
    for (const who of [me, friend, foe]) {
      T.fx.play({ kind: 'raise', at: who, faction: 'Gloaming' });
    }
  } else {
    T.fx.play({ kind: 'raise', at: me, faction: 'Gloaming' });
  }
  Math.random = orig;
  // ONE DRAWN FRAME BEFORE THE CLOCK IS STEPPED, and it is not a nicety.
  // The hand turns to face the camera, and the only way a motif can learn
  // where the camera is is to be handed it by three.js while it is being
  // drawn. With the animator taken off the frame clock the whole motif was
  // being stepped to ?t before anything had ever been rendered, so the hand
  // was still at its default bearing in every shot — which looks right at the
  // near seat, where the default happens to be about right, and is a lie at
  // the far one. Two frames: the first draws, the second is the one the tick
  // that follows can trust.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  for (let t = 0; t < at; t += 1 / 120) real(1 / 120);

  // The push-in, pinned open. drama.request would start its own envelope and
  // let go again while the shot was still being taken, so the phase is held
  // at full strength by hand — the camera work is then exactly what the game
  // does, minus the easing in and out.
  //
  // The target is NOT computed here. fx.play already told drama where the
  // effect is, through the same onBig hook the game uses, so it is right for a
  // bare square too — worked out locally from the piece it lands on, ?bare=1
  // had nothing to look up and the camera pushed in on the middle of the board
  // instead, which is a preview of somewhere the effect is not.
  const zoom = Number(q.get('zoom') || 0);
  if (zoom > 0) {
    T.drama.zoom = zoom;
    T.drama.slow = 1;                  // the clock is already stopped
    T.drama.hold = 1e9;
    T.drama.phase = 'hold';
    T.drama.k = 1;
  }
  return 'played raise frozen at ' + at.toFixed(2) + 's'
    + (zoom ? ' zoom ' + zoom : '') + ' seat ' + seat;
})()
