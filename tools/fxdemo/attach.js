// Preview harness for ONE motif: attach.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&t=800" \
//     --eval tools/fxdemo/attach.js --out /tmp/attach-800.png --wait 10000 --settle 600
//
// ?t is MILLISECONDS INTO THE MOTIF. --settle is WALL CLOCK and headless
// Chrome runs this table at a few frames a second, so a shot taken at
// --settle 800 is really the motif 80ms in. The animator is therefore taken
// off the frame clock here and stepped by hand to ?t, then frozen.
//
//   ?t=800        one fighter, frozen 800ms in
//   ?iron=1       the Refractory case — an Inquisitorial Mandate on a Hero
//   ?held=1       `at` is the ATTACHMENT'S uid and not the fighter's, which is
//                 what the engine hands this motif for A033 and A050: the
//                 tactic is not a piece on the board, it is an entry in the
//                 host's `attachments`. If the host lookup ever breaks, this
//                 is the variant that shows nothing at all.
//   (no ?t)       six ages of the motif on six squares, oldest on the left
//
// The fighters are OWNED BY BOTH PLAYERS on purpose: the band flies in from
// its owner's side of the table, so a motif that reads the owner wrongly has
// half the board throwing cloth in from behind the wrong seat.
(() => {
  const T = window.__table, st = T.state;
  const q = new URLSearchParams(location.search);
  const DT = 1 / 120;

  const IRON = q.has('iron');
  const HOST = q.has('held');
  const FIGHTER = IRON ? 'A041' : 'A002';        // Lord High Inquisitor / Bolt Bender
  const PAPER = IRON ? 'A050' : 'A033';          // Mandate / Fatewoven Tapestry
  const FACTION = IRON ? 'Refractory' : 'Auroxi';

  const card = (def, own) => ({
    uid: ++st.nextUid, def, owner: own, fatigued: false, attachments: [],
  });

  // Returns what the engine would hand the motif: the fighter's uid when the
  // card that resolved IS the fighter (Bolt Bender, Bolt Golem), and the
  // attachment's uid when it is a tactic that attached itself.
  const put = (sq, own) => {
    const f = card(FIGHTER, own);
    st.board[sq] = [f];
    if (!HOST) return f.uid;
    const a = card(PAPER, own);
    f.attachments.push(a);
    return a.uid;
  };

  st.board = Array.from({ length: 12 }, () => []);
  st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];

  const anim = T.anim;
  const play = (uid) => T.fx.play({ kind: 'attach', at: uid, faction: FACTION });

  // ---- one fighter, one moment
  if (q.has('t')) {
    const me = put(4, 0);
    put(2, 1);                                    // the far player's side, for the throw
    st.board[6] = [card('A016', 0)];              // an untouched fighter, for comparison
    T.resync();
    const at = Number(q.get('t') || 0) / 1000;
    const step = anim.update.bind(anim);
    anim.update = () => {};                       // off the frame clock, still drawing
    play(me);
    for (let s = 0; s < at; s += DT) step(DT);
    return `attach frozen at ${at.toFixed(2)}s`;
  }

  // ---- six ages at once, oldest on the left
  const AGES = [1450, 1150, 900, 700, 480, 240];
  const uids = AGES.map((_, i) => put(i, 0));
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
