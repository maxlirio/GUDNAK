// Preview harness for ONE motif: harvest.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&t=300" \\
//     --eval tools/fxdemo/harvest.js --out /tmp/h-300.png --wait 60000 --settle 700
//
// --wait 60000 IS NOT OPTIONAL. This waits for the table to finish swinging to
// the chair ?seat asks for, and that costs up to forty seconds of wall clock
// on a headless renderer — see the note on frames below.
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
//
// ?ids is WHAT THE PILE GIVES UP, comma-separated, and it is now the thing
// this motif is judged on: the prize that surfaces is the real printed card.
// The default is one card, which is the Lich and the Crypt. `?ids=C084,C110,
// R072` is the Undead Horde's Legion raising three at once, which is the case
// that has to be checked separately — they surface spread across the square
// and leave for hand in order. `?ids=` fires the event with no `cards` field,
// the way the effects bench and an old saved replay do: the pile should still
// open, the current should still run, and nothing should surface.
(async () => {
  // The page boots its modules asynchronously and --wait is wall clock, so
  // this polls rather than assuming: an eval that ran a frame early threw on
  // __table being undefined and the shot came out an empty table with no hint
  // as to why.
  const T = await (async () => {
    for (let i = 0; i < 400; i++) {
      if (window.__table?.state && window.__table.pieces) return window.__table;
      await new Promise((r) => setTimeout(r, 25));
    }
    throw new Error('__table never appeared');
  })();
  const st = T.state;
  const q = new URLSearchParams(location.search);
  // AND THEN LET THE GAME FINISH STARTING BEFORE ANYTHING IS STAGED. __table
  // and its pieces exist well before the quick game has dealt: the engine
  // picks a first player on a coin flip somewhere after that, writes it into
  // this same state object and swings the table to that chair. A board staged
  // in the gap was quietly overwritten — ?seat did nothing at all, every shot
  // came out from whichever chair the coin had chosen, and the far-pile case
  // could not be photographed from here.
  await new Promise((r) => setTimeout(r, 2500));
  const put = (sq, def, own) => {
    const u = ++st.nextUid;
    st.board[sq] = [{ uid: u, def, owner: own, fatigued: false, attachments: [] }];
    return u;
  };
  st.board = Array.from({ length: 12 }, () => []);
  // ?side=1 plays it for the OTHER player, which is also the other chair — see
  // the note below on why those two cannot be separated here. Everything about
  // the picture flips: which way the current bows, which way the souls lie on
  // screen, and which edge of the table the prize leaves over. Getting any of
  // the three wrong is invisible until you look at this.
  const side = Number(q.get('side') ?? 0);
  const sq = Number(q.get('sq') ?? 3);
  const me = put(sq, 'R067', side);    // The Lich itself, one of the three
  if (sq !== 5) put(5, 'M027', 1);     // an enemy, centre-right
  if (sq !== 1) put(1, 'A019', 0);     // a second fighter of yours

  // a real pile to reach into, face up, as the game draws it
  const n = Number(q.get('grave') ?? 6);
  st.players[side].graveyard = Array.from({ length: n }, (_, i) => (
    { uid: ++st.nextUid, def: ['C084', 'C086', 'R072', 'C087'][i % 4], owner: side }));

  // THE CHAIR FOLLOWS THE CASTER AND CANNOT BE PRISED APART FROM HIM HERE.
  //
  // That was worth four shots to establish, so it is written down. main.js
  // sets viewSide from state.active on every sync, and the quick game keeps
  // putting state.active back — forced to the other seat, with a resync, with
  // the force repeated on an interval, and with forty seconds of budget for
  // the swing, the table always came back to the caster's chair. So a ?seat
  // switch is a lie and there is not one.
  //
  // What that means for the motif is worth knowing and is not a limitation:
  // OFFLINE, the pile is always the near one, because the board is always
  // turned to whoever is casting. The far-pile picture — the pile across the
  // table, at the dim end of the arena's light — belongs to online play, where
  // viewSide is pinned to your own side. The longest run this can stage is
  // ?sq=8, the far corner to the near pile, and that is the geometry to judge
  // a long reach on.
  st.active = side; st.actionsLeft = 3; delete st.pending; st.queue = [];
  T.resync();

  // THEN WAIT FOR THE CAMERA, AND COUNT IN FRAMES RATHER THAN SECONDS.
  //
  // The table eases 13% of the remaining angle per FRAME — main.js clamps its
  // delta at 0.05s, so a slow renderer does not get a bigger step, it just
  // gets fewer of them — and thirty-odd frames on headless SwiftShader is ten
  // to twenty seconds of wall clock. Every sleep shorter than that came back
  // with the board seen from forty degrees off, which looks like a bug in the
  // motif and is a bug in here.
  //
  // Polling for "has stopped moving" is not enough on its own either, and that
  // cost a shot of its own: the swing has not begun yet when the poll first
  // looks, so the loop exits in a third of a second. It waits out a floor
  // first and wants the camera on the right SIDE of the board as well as
  // still — at seat 0 it sits at positive z and at seat 1 at negative.
  const want = side === 0 ? 1 : -1;
  await (async () => {
    const was = T.camera.position.clone();
    for (let i = 0, still = 0; i < 500; i++) {
      await new Promise((r) => setTimeout(r, 80));
      const seated = Math.sign(T.camera.position.z) === want
        && Math.abs(T.camera.position.z) > 6;
      still = seated && T.camera.position.distanceTo(was) < 0.02 ? still + 1 : 0;
      was.copy(T.camera.position);
      if (still >= 4 && i > 24) return;
    }
  })();

  // WHAT COMES BACK, AND PRE-WARMED.
  //
  // `cardTexture()` loads each painting asynchronously. This harness freezes
  // the animator and then screenshots, so a face still in flight when the shot
  // is taken renders as an untextured slab — which looks exactly like a broken
  // effect and has cost other motifs an afternoon. Fetching them first puts
  // them in the HTTP cache.
  const ids = (q.get('ids') ?? 'C084').split(',').map((x) => x.trim()).filter(Boolean);
  await Promise.all(ids.map((id) => new Promise((r) => {
    const img = st.defs?.[id]?.img;
    if (!img) { r(); return; }
    const el = new Image();
    el.onload = el.onerror = r;
    el.src = '../site/' + img + '.jpg';
  })));

  const at = Number(q.get('t') || 0) / 1000;
  const real = T.anim.update.bind(T.anim);
  T.anim.update = () => {};            // off the frame clock
  // The way the rules pass it: `ops.noteCards` leaves the ids on the note and
  // fx.js hands the whole event to the motif.
  const ev = { kind: 'harvest', at: me, faction: 'Gloaming' };
  if (ids.length) ev.cards = ids;
  T.fx.play(ev);
  // ONE DRAWN FRAME BEFORE THE CLOCK IS STEPPED, and it is not a nicety. The
  // souls are turned to point along the current in the camera's own plane, and
  // the only way a motif learns where the camera is is to be handed it by
  // three.js while it is being drawn. With the animator off the frame clock
  // the whole motif was stepped to ?t before anything had ever been rendered,
  // so every soul in every shot was still at its default bearing — straight up
  // the screen, which is a lie at both seats. Two frames: the first draws, the
  // second is the one the tick that follows can trust.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  for (let t = 0; t < at; t += 1 / 120) real(1 / 120);
  return 'played harvest on sq ' + sq + ' bringing back '
    + (ids.length ? ids.join('+') : 'nothing')
    + ' frozen at ' + at.toFixed(2) + 's';
})()
