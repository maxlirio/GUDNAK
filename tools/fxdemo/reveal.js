// Preview harness for ONE motif: reveal.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&t=500" \\
//     --eval tools/fxdemo/reveal.js --out /tmp/rv-500.png \\
//     --wait 4000 --settle 600
//
// ?t is MILLISECONDS INTO THE MOTIF. --settle is WALL CLOCK and headless
// rendering runs animation time at a fraction of it, so the animator is taken
// off the frame clock here and stepped by hand to ?t, then frozen. --settle
// then only has to be long enough for Chrome to draw one frame — but --wait
// has to be over ~900ms or the page is still on its splash, and under ~1400
// the table's own opening deal starts putting cards over the ones set up here.
//
// ?side is who CASTS it (default 0). It decides everything: the motif opens
// the OTHER player's deck, so side=0 reaches for the far deck at the top of
// the screen (about 70 pixels wide) and side=1 for the near one (nearly twice
// that), and the revealed card turns over toward whichever seat cast it. Both
// have to read, and the near one is the one that fills the frame.
//
// ?tactic=1 fires it from a card with no piece on the table, which is how
// Decarceration resolves. ?zoom=N crops the render onto the deck being opened.
//
// ?deck is how many cards are in the deck being opened. The stack is a box
// scaled by its count, so its top slides half a unit over a game: at 20 the
// card tears off a tall pile and at 1 off a bare plinth. Both were wrong at
// some point with a fixed height.
(async () => {
  const T = window.__table, st = T.state;
  const q = new URLSearchParams(location.search);
  const put = (sq, def, own) => {
    const u = ++st.nextUid;
    st.board[sq] = [{ uid: u, def, owner: own, fatigued: false, attachments: [] }];
    return u;
  };
  st.board = Array.from({ length: 12 }, () => []);
  const side = Number(q.get('side') ?? 0);
  // The Confessor itself on the caster's side, an enemy opposite it, and one
  // more of the caster's fighters so the board is not empty behind the lamp.
  const me = put(side === 0 ? 3 : 5, 'A045', side);
  put(side === 0 ? 5 : 3, 'M027', 1 - side);
  put(side === 0 ? 1 : 7, 'A019', side);

  // The deck being opened is the OTHER player's. `quick=1` deals a game, so
  // both decks already have cards; this just pins the one under the lamp to a
  // known height.
  const deck = Number(q.get('deck') ?? 16);
  st.players[1 - side].deck = Array.from({ length: deck }, () => (
    { uid: ++st.nextUid, def: 'M027', owner: 1 - side }));

  // ACTIVE = the caster, because that is the real situation: the camera sits
  // at the active player's seat, and the revealed card is turned over to face
  // that seat. Freezing the motif with the camera on the other side shows the
  // card's back and looks like the flip is the wrong way round.
  // ?seat overrides which chair the camera sits in. Offline it is always the
  // caster's, and then the deck being opened is always the FAR one; online the
  // camera stays at your own seat, so your opponent revealing off YOUR deck
  // plays out at the near end of the table, twice the size and turned the
  // other way. seat=0 side=1 is that case.
  st.active = q.has('seat') ? Number(q.get('seat')) : side;
  st.actionsLeft = 3; delete st.pending; st.queue = [];
  T.resync();

  // THEN LET THE CAMERA SETTLE. The table swings to the active player's seat
  // over about a second, and a shot taken mid-swing is forty degrees off — a
  // board seen from a corner, which looks like a bug in the motif and is a bug
  // in the harness. The effect itself is frozen below, so this costs only wall
  // clock.
  await new Promise((r) => setTimeout(r, 1500));

  // ?zoom=N crops the render to a 1/N window centred on the deck being opened
  // and draws it at the full canvas resolution — a sharp close-up, not a
  // magnified screenshot. The whole board is 1280 pixels wide and the far deck
  // is seventy of them, so the wide shot cannot tell you whether the pool has
  // an edge or the card has a face; every judgement about this motif's detail
  // was made at zoom=3 and every judgement about whether it READS at zoom=0.
  // setViewOffset survives the frame loop, which only sets position and lookAt.
  const zoom = Number(q.get('zoom') || 0);
  if (zoom > 1) {
    let deck = null;
    T.arena.scene.traverse((o) => {
      if (o.userData?.deckOf === 1 - side && o.visible) deck = o;
    });
    if (deck) {
      const v = deck.getWorldPosition(new deck.position.constructor());
      // Centre on the DOCK, not the deck: the motif hauls what it finds two
      // squares in toward the board before it holds it up, so a crop centred
      // on the pile cuts the held card in half.
      v.z -= Math.sign(v.z) * 1.3;
      v.y += 0.8;
      v.project(T.camera);
      const W = T.camera.view?.fullWidth || window.innerWidth;
      const H = T.camera.view?.fullHeight || window.innerHeight;
      const w = W / zoom, h = H / zoom;
      const cx = (v.x * 0.5 + 0.5) * W, cy = (0.5 - v.y * 0.5) * H;
      T.camera.setViewOffset(W, H,
        Math.max(0, Math.min(W - w, cx - w / 2)),
        Math.max(0, Math.min(H - h, cy - h / 2)), w, h);
    }
  }

  const at = Number(q.get('t') || 0) / 1000;
  const real = T.anim.update.bind(T.anim);
  T.anim.update = () => {};            // off the frame clock
  // ?tactic=1 plays it the way Decarceration does: from a card that is NOT on
  // the table, so kit.at returns null and the motif has to work out whose deck
  // to open on its own. That path showed nothing at all before, because the
  // placeholder gave up the moment it had no source card.
  T.fx.play({
    kind: 'reveal', faction: 'Refractory',
    at: q.get('tactic') === '1' ? st.nextUid + 99 : me,
  });
  for (let t = 0; t < at; t += 1 / 120) real(1 / 120);
  return `reveal by side ${side} on a deck of ${deck}, frozen at ${at.toFixed(2)}s`;
})()
