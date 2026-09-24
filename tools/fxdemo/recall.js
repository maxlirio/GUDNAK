// Preview harness for ONE motif: recall — the Battlemaster's Tactician.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&t=300" \\
//     --eval tools/fxdemo/recall.js --out /tmp/rc-300.png --wait 4000 --settle 600
//
// ?t is MILLISECONDS INTO THE MOTIF. --settle is WALL CLOCK and headless
// rendering runs animation time at a fraction of it, so the animator is taken
// off the frame clock here and stepped by hand to ?t, then frozen. --settle
// then only has to be long enough for Chrome to draw one frame — but under
// about 900ms the splash screen is still up, and over about 1400 the table
// deals its opening hand over the board this sets up.
//
// ?sq picks the square the Battlemaster deploys on. The motif runs from his
// card all the way to the discard pile beside his deck, so how it reads is
// entirely a question of how far that is: sq=2 is the near-right square, two
// and a half units from the pile, and sq=8 is the far corner at nearly eight.
// A rail that looks right at one length looks like a dropped girder at the
// other, so both get checked.
//
// ?grave is how many cards are in the pile. An empty Graveyard is a 2cm wafer
// on its slab and a full one is half a unit tall; the seal is stamped on the
// TOP of it, which is measured rather than guessed, and this is how that gets
// tested. 0 must not throw.
//
// ?side=1 plays it for the far player, whose Graveyard is at the other end of
// the table and whose hand is off the top of the screen. The direction the
// prize leaves in flips with the owner and that is invisible until you look.
//
// ?id=A046 is WHICH Tactic he takes back — the real card that comes up the
// rule. It has to be one that is actually in the pile below, because that is
// what the rules guarantee and a card returning from a Graveyard it was never
// in is the sort of thing only a harness can produce. ?bare=1 fires the event
// with no `cards` field at all, the way the effects bench and an old saved
// note do: the order must still go out and come back with nothing on it.
(async () => {
  // WAIT FOR THE TABLE. --wait is wall clock and this page sometimes takes
  // eight seconds to raise the battlefield on a cold cache; roughly one shot
  // in four came back as the splash screen with "Cannot read properties of
  // undefined (reading 'state')" in the log, which looks exactly like a broken
  // motif and is a page that had not loaded yet.
  for (let i = 0; i < 200 && !window.__table; i++) {
    await new Promise((r) => setTimeout(r, 100));
  }
  const T = window.__table, st = T.state;
  const q = new URLSearchParams(location.search);
  const put = (sq, def, own) => {
    const u = ++st.nextUid;
    st.board[sq] = [{ uid: u, def, owner: own, fatigued: false, attachments: [] }];
    return u;
  };
  st.board = Array.from({ length: 12 }, () => []);
  const side = Number(q.get('side') ?? 0);
  const sq = Number(q.get('sq') ?? 3);
  const me = put(sq, 'C006', side);      // the Battlemaster himself
  if (sq !== 5) put(5, 'M027', 1);       // an enemy, centre-right
  if (sq !== 1) put(1, 'A019', 0);       // a second fighter, for scale

  // A real pile to reach into, face up, as the game draws it — and Tactics in
  // it, because that is what he is reaching for.
  const n = Number(q.get('grave') ?? 6);
  st.players[side].graveyard = Array.from({ length: n }, (_, i) => (
    { uid: ++st.nextUid, def: ['A050', 'C034', 'A046', 'R053'][i % 4], owner: side }));

  // active stays 0 whatever `side` is: watching the far player's recall from
  // your own chair is the more useful check, and it keeps the camera still.
  st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];
  T.resync();

  // THEN LET THE CAMERA SETTLE. The table swings round to the active player's
  // seat over about a second, and a frame caught mid-swing is a board seen
  // from a corner — which looks like a bug in the motif and is a bug in the
  // harness. The effect itself is frozen below, so this costs only wall clock.
  await new Promise((r) => setTimeout(r, 1400));

  // ?zoom is a FIELD OF VIEW in degrees (the table's own is 40) and ?look
  // picks what it is aimed at: `mid` is the middle of the run — the whole
  // rule from his card to the pile — while `card` and `pile` are for judging
  // the seal at either end. The table re-aims the camera every frame from
  // module scope, so lookAt has to be WRAPPED; a one-off call is overwritten
  // before the frame is drawn. Zoomed frames are for FINDING faults; the game
  // is played at 40 and that is where this has to work.
  if (q.has('zoom')) {
    const cam = T.camera, STEP = 2.62, CW = 1.74, CH = 1.76;
    const cx = ((sq % 3) - 1) * STEP, cz = (1 - Math.floor(sq / 3)) * STEP;
    const gx = (side === 0 ? 1 : -1) * (CW + 0.55);
    const gz = (side === 0 ? 1 : -1) * (STEP * 1.5 + CH * 0.62);
    const spot = q.get('look') || 'mid';
    const x = spot === 'card' ? cx : spot === 'pile' ? gx : (cx + gx) / 2;
    const z = spot === 'card' ? cz : spot === 'pile' ? gz : (cz + gz) / 2;
    const lk = cam.lookAt.bind(cam);
    cam.lookAt = () => lk(x, 0.45, z);
    cam.fov = Number(q.get('zoom')) || 16;
    cam.updateProjectionMatrix();
  }

  // THE REAL TACTIC, passed the way the rules pass it: `ops.noteCards` puts
  // the id on the note and fx.js hands the whole event to the motif.
  const id = q.get('id') || 'A050';      // Inquisitorial Mandate, in the pile

  // PRE-WARM THE FACE. cardTexture() loads the JPEG asynchronously and this
  // harness freezes the animator and then screenshots, so a face still in
  // flight when the shot is taken renders as an untextured slab and the motif
  // gets blamed for it. Fetching it first puts it in the HTTP cache.
  await new Promise((r) => {
    const img = st.defs?.[id]?.img;
    if (!img) { r(); return; }
    const el = new Image();
    el.onload = el.onerror = r;
    el.src = '../site/' + img + '.jpg';
  });

  const at = Number(q.get('t') || 0) / 1000;
  const real = T.anim.update.bind(T.anim);
  T.anim.update = () => {};              // off the frame clock
  const ev = { kind: 'recall', at: me, faction: 'Refractory' };
  if (!Number(q.get('bare') || 0)) ev.cards = [id];
  T.fx.play(ev);
  for (let t = 0; t < at; t += 1 / 120) real(1 / 120);
  return 'recall on sq ' + sq + ' grave ' + n + ' carrying '
    + (ev.cards ? id : 'nothing') + ' frozen at ' + at.toFixed(2) + 's';
})()
