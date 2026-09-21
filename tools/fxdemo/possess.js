// Preview harness for ONE motif: possess.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&t=700" \
//     --eval tools/fxdemo/possess.js --out /tmp/possess-700.png \
//     --wait 10000 --settle 600
//
// ?t is MILLISECONDS INTO THE MOTIF. --settle is WALL CLOCK and headless
// rendering runs animation time at a fraction of it, so the animator is taken
// off the frame clock here and stepped by hand to ?t, then frozen. --settle
// then only has to be long enough for Chrome to draw one frame.
//
// IT WAITS FOR `window.__table`. shot.js evaluates this after a fixed --wait,
// and on a cold SwiftShader start the game is sometimes not up yet: the
// snippet threw on `T.state`, shot.js printed EVAL THREW, and the picture that
// came back was an empty board that looked exactly like an effect that had
// failed to draw. Returning a promise makes shot.js await it (it passes
// awaitPromise), so the wait is on the game rather than on the clock.
//
// EVERY SQUARE HERE IS A STACK OF TWO. That is the whole motif: a fighter
// comes to rest ON another one, which is still physically on the table and no
// longer in play. Staging a lone fighter — which is what this harness used to
// do — hid the one thing the effect has to say, and the buried card's slide
// back and to the left (pieces.js) is what tells you there is something under
// there at all. The victim is an ENEMY card, because both cards that share
// this motif land on an enemy.
//
// With no ?t, six squares hold six ages of the motif at once — read them right
// to left, newest first. That is the shot that proves it reads at a glance;
// ?t is for looking at one moment closely.
//
// CROP GENEROUSLY ABOVE THE CARD. The motif spends its first fifth of a second
// on the flagstone BEYOND the square, and the wraith itself leans back over
// the stone behind the card, so a crop tight on the card cuts off both — two
// passes were spent believing the approach was not being drawn when it was
// simply out of frame:
//   sips -c 230 300 --cropOffset 140 430 shot.png --out z.png
// puts square 3 in the lower half with the stone it is crossing above it.
(async () => {
  for (let i = 0; i < 200 && !(window.__table && window.__table.state); i++) {
    await new Promise((r) => setTimeout(r, 50));
  }
  const T = window.__table, st = T.state;
  const q = new URLSearchParams(location.search);
  const DT = 1 / 120;

  // depth 0 is the TOP of a stack (pieces.js), so the possessor goes first in
  // the array and the smothered card second.
  const stack = (sq, top, bottom) => {
    const a = ++st.nextUid, b = ++st.nextUid;
    st.board[sq] = [
      { uid: a, def: top, owner: 0, fatigued: false, attachments: [] },
      { uid: b, def: bottom, owner: 1, fatigued: false, attachments: [] },
    ];
    return a;
  };
  st.board = Array.from({ length: 12 }, () => []);
  st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];

  const anim = T.anim;
  const play = (uid) => T.fx.play({ kind: 'possess', at: uid, faction: 'Gloaming' });

  // ---- one stack, one moment
  if (q.has('t')) {
    const me = stack(3, 'C083', 'M027');   // Dominating Wraith over an enemy
    stack(5, 'A016', 'M027');              // a plain stack, for comparison
    st.board[1] = [{ uid: ++st.nextUid, def: 'A019', owner: 0, fatigued: false, attachments: [] }];
    T.resync();
    const at = Number(q.get('t') || 0) / 1000;
    const step = anim.update.bind(anim);
    anim.update = () => {};              // off the frame clock, still drawing
    play(me);
    for (let s = 0; s < at; s += DT) step(DT);
    return 'possess frozen at ' + at.toFixed(2) + 's';
  }

  // ---- six ages at once, oldest on the left.
  // Spread across the full 1.35s span, and the moments are chosen rather than
  // spaced evenly: the arrival, the stand-up, the grip, the hold and the
  // lie-down are the five things this has to get right.
  const AGES = [1250, 1000, 800, 640, 460, 240];
  const uids = AGES.map((_, i) => stack(i, 'C083', 'M027'));
  T.resync();

  if (!q.has('live')) {
    const step = anim.update.bind(anim);
    anim.update = () => {};
    let now = 0;
    const stepTo = (ms) => { while (now < ms - 0.5) { step(DT); now += 1000 * DT; } };
    AGES.forEach((a, i) => { stepTo(AGES[0] - a); play(uids[i]); });
    stepTo(AGES[0]);
    return 'frozen ages (left to right) ' + AGES.join(',') + 'ms';
  }
  uids.forEach(play);
  return 'playing live on 6 squares';
})()
