// Preview harness for ONE effect: cast-auroxi.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&at=300" \
//     --eval tools/fxdemo/cast-auroxi.js --out /tmp/cast-auroxi-300.png --settle 400
//
// ?at is MILLISECONDS INTO THE MOTIF, and that is not the same thing as
// --settle. Headless Chrome on SwiftShader renders at maybe ten frames a
// second while main.js clamps dt to 0.05, so animation time runs at roughly
// half wall-clock and every shot landed well short of where --settle claimed.
// So the animator is taken off the frame clock here: anim.update is replaced
// with one that advances only the budget this harness hands it, in 1/120s
// sub-steps, all inside one frame. --settle then only has to be long enough
// for Chrome to draw ONE frame (400ms is plenty); ?at decides what is in it.
//
// Add &cmp=1 to fire Refractory and Marvorren on the squares either side at
// the same instant — the shot that proves this flourish is telling apart from
// the others and is not louder than they are.
(() => {
  const T = window.__table, st = T.state;
  const put = (sq, def, own) => {
    const u = ++st.nextUid;
    st.board[sq] = [{ uid: u, def, owner: own, fatigued: false, attachments: [] }];
    return u;
  };
  st.board = Array.from({ length: 12 }, () => []);
  const me = put(4, 'A016', 0);        // your fighter, middle of the board
  const foe = put(5, 'M027', 1);       // an enemy, alongside
  const friend = put(1, 'A019', 0);    // a second fighter of yours
  st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];
  T.resync();

  const at = Number(new URLSearchParams(location.search).get('at') || 0);
  const anim = T.anim;
  if (at && !anim.__stepped) {
    anim.__stepped = true;
    const real = Object.getPrototypeOf(anim).update.bind(anim);
    let budget = 0;
    anim.update = () => {
      while (budget > 1e-6) { const d = Math.min(1 / 120, budget); budget -= d; real(d); }
    };
    window.__adv = (ms) => { budget += ms / 1000; };
  }

  // &cmp=1 fires Refractory and Marvorren on the squares either side at the
  // same instant. The Auroxi flourish has to be TELLABLE from the other four
  // and no louder than they are, and neither of those can be judged from a
  // shot of it on its own.
  const cmp = new URLSearchParams(location.search).has('cmp');
  T.fx.play({ kind: 'cast', at: me, faction: 'Auroxi' });
  if (cmp) {
    T.fx.play({ kind: 'cast', at: friend, faction: 'Refractory' });
    T.fx.play({ kind: 'cast', at: foe, faction: 'Marvorren' });
  }
  if (at) window.__adv(at);
  return 'played Auroxi' + (cmp ? '+cmp' : '') + ' at=' + at;
})()
