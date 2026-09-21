// Preview harness for ONE motif: bury.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&t=500" \
//     --eval tools/fxdemo/bury.js --out /tmp/bury-500.png --wait 10000 --settle 600
//
// ?t is MILLISECONDS INTO THE MOTIF. --settle is WALL CLOCK and headless
// Chrome runs this table at a few frames a second, so a shot taken at
// --settle 800 is really the motif 80ms in. The animator is therefore taken
// off the frame clock here and stepped by hand to ?t, then frozen; --settle
// only has to be long enough for Chrome to draw one frame.
//
// EVERY SQUARE HERE IS A REAL STACK. The motif is about a fighter being put
// UNDERNEATH another one, so a lone card on a square hides the only thing it
// has to say. depth 0 is the TOP of the stack (pieces.js), so the jailer goes
// first in the array and the victim second — and the victim's card slides back
// and to the left by 0.085 per layer, which is the sliver the seam light
// lives on.
//
//   ?t=900        one stack, frozen 900ms in
//   ?sweep=1      TWO victims under the jailer — the Man Catcher case
//   ?auroxi=1     M165 Shadowcaster sliding a friendly Shadow under cover
//   (no ?t)       six ages of the motif on six squares, oldest on the left
//
// CROP GENEROUSLY. The dust goes out past the square and the jailer rides up
// out of the card's own footprint:
//   sips -c 300 340 --cropOffset 460 380 shot.png --out z.png
(() => {
  const T = window.__table, st = T.state;
  const q = new URLSearchParams(location.search);
  const DT = 1 / 120;

  const SWEEP = q.has('sweep');
  const AUROXI = q.has('auroxi');
  // Umbren Jailor over an enemy is the common case; the Shadowcaster is the
  // one card in the set where the buried fighter is a FRIEND, so both the
  // colour and the pair of owners have to be checked.
  const JAILER = AUROXI ? 'M165' : 'A042';
  const VICTIM = AUROXI ? 'M199' : 'M027';
  const VICTIM_OWNER = AUROXI ? 0 : 1;
  const FACTION = AUROXI ? 'Auroxi' : 'Refractory';

  const card = (def, own) => ({
    uid: ++st.nextUid, def, owner: own, fatigued: false, attachments: [],
  });

  const stack = (sq) => {
    const top = card(JAILER, 0);
    const under = [card(VICTIM, VICTIM_OWNER)];
    if (SWEEP) under.push(card('M017', VICTIM_OWNER));
    st.board[sq] = [top, ...under];
    return top.uid;
  };

  st.board = Array.from({ length: 12 }, () => []);
  st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];

  const anim = T.anim;
  const play = (uid) => T.fx.play({ kind: 'bury', at: uid, faction: FACTION });

  // ---- one stack, one moment
  if (q.has('t')) {
    const me = stack(4);
    stack(0);                                     // a second one, for the eye
    // a plain lone fighter and an untouched stack beside it, so the motif is
    // read against what the board normally looks like rather than in isolation
    st.board[5] = [card('A016', 0)];
    st.board[8] = [card('A019', 0), card('M027', 1)];
    T.resync();
    const at = Number(q.get('t') || 0) / 1000;
    const step = anim.update.bind(anim);
    anim.update = () => {};                       // off the frame clock, still drawing
    play(me);
    for (let s = 0; s < at; s += DT) step(DT);
    return `bury frozen at ${at.toFixed(2)}s`;
  }

  // ---- six ages at once, oldest on the left
  const AGES = [1550, 1220, 940, 700, 480, 250];
  const uids = AGES.map((_, i) => stack(i));
  T.resync();

  if (!q.has('live')) {
    const step = anim.update.bind(anim);
    anim.update = () => {};
    let now = 0;
    const stepTo = (ms) => { while (now < ms - 0.5) { step(DT); now += 1000 * DT; } };
    AGES.forEach((a, i) => { stepTo(AGES[0] - a); play(uids[i]); });
    stepTo(AGES[0]);
    return `frozen ages (left to right) ${AGES.join(',')}ms`;
  }
  uids.forEach(play);
  return 'playing live on 6 squares';
})()
