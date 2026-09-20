// Preview harness for ONE motif: song.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&t=300" \\
//     --eval tools/fxdemo/song.js --out /tmp/song-300.png --settle 500 --wait 8000
//
// ?t is MILLISECONDS INTO THE MOTIF. --settle is WALL CLOCK and headless
// rendering runs animation time at a fraction of it, so the animator is taken
// off the frame clock here and stepped by hand to ?t, then frozen. --settle
// then only has to be long enough for Chrome to draw one frame.
//
// --wait is the other one. The board takes several seconds to raise under
// SwiftShader and longer again with other shots running beside it; too short
// and this throws on window.__table, which reads as "the effect is broken"
// when the page simply had not booted.
//
// A CHORUS is the case that matters — the strength of all four cards is the
// number of Singers — so the default staging is four of your fighters fatigued
// and singing around the card that resolved. Knobs for the other cases:
//   &n=1..5   how many singers besides the card that resolved
//   &sq=1     the card that resolved is a SQUARE (a tactic), not a fighter
//   &solo=1   no singers at all, the fallback nothing may throw on
//   &fov=18   narrow the camera, for a close look at one cord
(() => {
  const T = window.__table, st = T.state;
  const q = new URLSearchParams(location.search);
  const put = (sq, def, own, fat) => {
    const u = ++st.nextUid;
    st.board[sq] = [{ uid: u, def, owner: own, fatigued: !!fat, attachments: [] }];
    return u;
  };
  st.board = Array.from({ length: 12 }, () => []);

  // The card that resolved sits in the middle of your line.
  const me = put(4, 'M087', 0);        // Deckhand Drifter — always Singing
  put(5, 'M027', 1);                   // an enemy, to keep a foreign card in shot

  // The singers: your own power-I fighters, spent to give voice, so they are
  // fatigued — which is the state the game greys them in.
  const SING = [[0, 'M015'], [2, 'M017'], [7, 'M020'], [6, 'M025'], [8, 'M026']];
  const n = q.has('solo') ? 0 : Math.max(0, Math.min(SING.length, Number(q.get('n') || 4)));
  for (let i = 0; i < n; i++) put(SING[i][0], SING[i][1], 0, true);

  if (q.has('fov')) { T.camera.fov = Number(q.get('fov')); T.camera.updateProjectionMatrix(); }

  st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];
  T.resync();

  const at = Number(q.get('t') || 0) / 1000;
  const real = T.anim.update.bind(T.anim);
  T.anim.update = () => {};            // off the frame clock
  T.fx.play({ kind: 'song', at: q.has('sq') ? 4 : me, faction: 'Marvorren' });
  for (let t = 0; t < at; t += 1 / 120) real(1 / 120);
  return 'played song frozen at ' + at.toFixed(2) + 's';
})()
