// Preview harness for ONE motif: depthcharge.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&t=700&zoom=13" \\
//     --eval tools/fxdemo/depthcharge.js --out /tmp/depthcharge-700.png \\
//     --wait 4000 --settle 600
//
// ?t is MILLISECONDS INTO THE MOTIF. --settle is WALL CLOCK and headless
// rendering runs animation time at a fraction of it, so the animator is taken
// off the frame clock here and stepped by hand to ?t, then frozen. --settle
// then only has to be long enough for Chrome to draw one frame — and must NOT
// be long, because the table's own opening keeps running in real time and
// past about a second it deals over the board this sets up.
//
// THE BOARD IS THE CARD'S OWN SENTENCE: the victim is an ENEMY standing in
// YOUR Back Row (row 0, nearest the camera) and not in a Gate, so squares 0
// and 2 are the only legal targets — ?me picks between them. Wave Runner
// itself sits in the middle of the board, because the motif fires on the
// VICTIM's square and the caster only relocates there afterwards; anything
// that made the caster's square look like the centre of the effect would be
// the wrong read. A friendly stands next door so bleed onto a neighbouring
// square is visible in every shot.
(() => {
  const T = window.__table, st = T.state;
  const q = new URLSearchParams(location.search);
  const put = (sq, def, own) => {
    const u = ++st.nextUid;
    st.board[sq] = [{ uid: u, def, owner: own, fatigued: false, attachments: [] }];
    return u;
  };
  st.board = Array.from({ length: 12 }, () => []);
  const home = Number(q.get('me') ?? 0) === 2 ? 2 : 0;
  const victim = put(home, 'A016', 1);           // the enemy being destroyed
  put(home === 0 ? 1 : 1, 'A019', 0);            // a friendly next door
  put(4, 'M015', 0);                             // Wave Runner, still elsewhere
  st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];
  T.resync();

  // ?zoom drops the camera in on the square so detail can be judged. The
  // table re-aims the camera every frame from module scope, so the fov is the
  // only handle from out here — and lookAt is wrapped rather than called,
  // because a one-off call is overwritten before the frame is drawn.
  if (q.has('zoom')) {
    const cam = T.camera, STEP = 2.62;
    const x = ((home % 3) - 1) * STEP, z = (1 - Math.floor(home / 3)) * STEP;
    const lk = cam.lookAt.bind(cam);
    cam.lookAt = () => lk(x, 0.7, z);
    cam.fov = Number(q.get('zoom')) || 13;
    cam.updateProjectionMatrix();
  }

  const at = Number(q.get('t') || 0) / 1000;
  const real = T.anim.update.bind(T.anim);
  T.anim.update = () => {};            // off the frame clock

  // The motif AND the leaving, on one clock — which is the only way to see
  // whether they are one event. ?t is milliseconds from the moment the charge
  // is dropped, not from the moment the card starts flying: the table waits
  // fx.killWait() seconds and only then hands the card to whoever owns its
  // exit, so the harness does exactly that. ?nokill=1 leaves the card on the
  // board, for looking at the water on its own.
  const ev = { kind: 'depthcharge', at: victim, faction: 'Marvorren' };
  T.fx.play(ev);
  const wait = T.fx.killWait([ev]);
  if (!q.has('nokill')) {
    const piece = T.pieces.get(victim);
    T.anim.add(wait, () => {}, () => {
      T.fx.exitFor([ev], 'destroy')(piece, home, () => T.pieces.retire(victim));
    });
  }

  for (let t = 0; t < at; t += 1 / 120) real(1 / 120);
  return 'depthcharge on square ' + home + ', kill wait ' + wait
    + 's, frozen at ' + at.toFixed(2) + 's';
})()
