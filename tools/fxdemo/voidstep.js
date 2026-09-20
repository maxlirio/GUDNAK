// Preview harness for ONE motif: voidstep.
//
//   node tools/shot.js --wait 9000 --settle 800 \
//     --url "game/?quick=1&seed=5&p0=The%20Voidbringers&t=520" \
//     --eval tools/fxdemo/voidstep.js --out /tmp/vs-520.png
//
// THE DECK MATTERS, and getting it wrong is silent. `p0=The Voidbringers` is
// what opens the Void — board.js only draws the pit for a deck that mentions
// it — and the far end of this motif's passage IS the pit. main.js matches
// ?p0= by exact name and falls back to the FIRST deck in the list when it
// misses, with nothing logged, so a stale or misspelt name simply hands you
// Bolts of Destruction, no pit, and a shadow running off into bare dirt. An
// afternoon went on that.
//
// ?t is MILLISECONDS INTO THE MOTIF. --settle is WALL CLOCK and headless
// rendering runs animation time at a fraction of it, so the animator is taken
// off the frame clock here and stepped by hand to ?t, then frozen. --settle
// then only has to be long enough for Chrome to draw one frame; under ~900ms
// you get the splash screen and over ~1400 the opening deal covers the board.
//
// --wait, though, is NOT a constant. On a loaded machine — several of these
// running at once — the page is still on the splash at 4s and the eval dies
// on `window.__table` being undefined, which looks exactly like the effect
// having failed. 9000 is reliable; check for `eval ->` in the output and
// retry rather than trusting the PNG.
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
  // ?sq= moves the acting fighter. The passage is aimed at square 9 from
  // wherever the card is, so a corner square is a DIAGONAL run and is the one
  // that catches a seam pointed along the straight line to the pit instead of
  // along the path it actually leaves on.
  const SQ = Number(q.get('sq') ?? 5);
  const me = put(SQ, 'A016', 0);       // the fighter that stepped
  for (const s2 of [4, 3, 7]) if (s2 !== SQ) put(s2, s2 === 3 ? 'A019' : 'M027', s2 === 3 ? 0 : 1);
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
