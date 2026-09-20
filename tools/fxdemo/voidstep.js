// Preview harness for ONE motif: voidstep.
//
//   node tools/shot.js --wait 4000 --settle 600 \
//     --url "game/?quick=1&seed=5&p0=Veil%20of%20the%20Void&t=520" \
//     --eval tools/fxdemo/voidstep.js --out /tmp/vs-520.png
//
// THE DECK MATTERS. `p0=Veil of the Void` is what opens the Void — board.js
// only draws the pit for a deck that mentions it — and the far end of this
// motif's passage IS the pit, so shooting any other deck hides half the
// effect and the shadow appears to run off into bare dirt.
//
// ?t is MILLISECONDS INTO THE MOTIF. --settle is WALL CLOCK and headless
// rendering runs animation time at a fraction of it, so the animator is taken
// off the frame clock here and stepped by hand to ?t, then frozen. --settle
// then only has to be long enough for Chrome to draw one frame; under ~900ms
// you get the splash screen and over ~1400 the opening deal covers the board,
// so --wait 4000 --settle 600 is the pair that works.
//
// THE ACTING FIGHTER IS AT SQUARE 5, the far side of the board from the Void,
// with allies on 4 and 3 standing in the way. That is deliberate: the whole
// motif lives at flagstone height so that a card OCCLUDES the shadow running
// beneath it, and a passage with nothing to pass under never shows it. A
// fighter on square 3 has a two-unit hop to the pit and proves nothing.
//
// CROP TO THE BOARD. At 1280x800 the nine squares are about 400px wide and
// the passage is a hairline:
//   sips -c 320 640 --cropOffset 120 300 /tmp/vs-520.png --out /tmp/z.png
//
// ?exit=1 plays Drop Shadow's leaving instead — the card sinking through its
// own shadow and surfacing at the hand — stepped to the same ?t.
(() => {
  const T = window.__table, st = T.state;
  const q = new URLSearchParams(location.search);
  const DT = 1 / 120;

  const put = (sq, def, own) => {
    const u = ++st.nextUid;
    st.board[sq] = [{ uid: u, def, owner: own, fatigued: false, attachments: [] }];
    return u;
  };
  st.board = Array.from({ length: 12 }, () => []);
  const me = put(5, 'A016', 0);        // the fighter that stepped, far from the pit
  put(4, 'M027', 1);                   // in the way — the shadow goes UNDER it
  put(3, 'A019', 0);                   // and under this one too
  put(7, 'M027', 1);                   // one more square lit, for comparison
  st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];
  T.resync();

  const anim = T.anim;
  const at = Number(q.get('t') || 0) / 1000;
  const step = anim.update.bind(anim);

  if (q.has('live')) {
    T.fx.play({ kind: 'voidstep', at: me, faction: 'Auroxi' });
    return 'playing voidstep live';
  }

  anim.update = () => {};              // off the frame clock, still drawing
  T.fx.play({ kind: 'voidstep', at: me, faction: 'Auroxi' });

  // The leaving is a SEPARATE animation the table starts once the rules have
  // resolved, `timing.kill` seconds in — so to see it the way a player does it
  // has to be started at that offset, not at zero.
  if (q.has('exit')) {
    const mod = T.fx.exitFor([{ kind: 'voidstep' }], 'hand');
    const piece = T.pieces.get(me);
    let fired = false;
    const when = 0.43;
    for (let s = 0; s < at; s += DT) {
      if (!fired && s >= when) { fired = true; mod(piece, 5, () => {}); }
      step(DT);
    }
    return 'voidstep + hand exit frozen at ' + at.toFixed(2) + 's';
  }

  for (let s = 0; s < at; s += DT) step(DT);
  return 'voidstep frozen at ' + at.toFixed(2) + 's';
})()
