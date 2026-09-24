// Preview harness for ONE motif: reveal.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&t=2000" \\
//     --eval tools/fxdemo/reveal.js --out /tmp/rv-2000.png \\
//     --wait 10000 --settle 700
//
// ?t is MILLISECONDS INTO THE MOTIF. --settle is WALL CLOCK and headless
// rendering runs animation time at a fraction of it, so the animator is taken
// off the frame clock here and stepped by hand to ?t, then frozen. --settle
// then only has to be long enough for Chrome to draw one frame — but --wait
// has to be over ~900ms or the page is still on its splash, and under ~1400
// the table's own opening deal starts putting cards over the ones set up here.
//
// ?side is who CASTS it (default 0). The motif opens the OTHER player's deck,
// so side=0 reaches for the far deck at the top of the screen and side=1 for
// the near one — the two ends of a six-unit haul. Where the card ENDS UP no
// longer depends on it: both hauls finish at the same reading spot out in the
// middle of the table, leaned toward whichever seat the camera is in. Both
// still have to be checked, because the journey differs and so does the
// shadow the lamp throws on the way.
//
// ?tactic=1 fires it from a card with no piece on the table, which is how
// Decarceration resolves. ?zoom=N crops the render onto the deck being opened.
//
// ?deck is how many cards are in the deck being opened. The stack is a box
// scaled by its count, so its top slides half a unit over a game: at 20 the
// card tears off a tall pile and at 1 off a bare plinth. Both were wrong at
// some point with a fixed height.
//
// ?id is WHICH card is turned over, and it is now the whole point of the
// motif: `ops.noteCards` names the top of the deck and the motif holds that
// real printed card up to be read. The default is M027 Totally Normal
// Villager, which is the longest-winded card in the game and so the hardest
// one to make legible. ?bare=1 fires the event with no `cards` field at all,
// the way the effects bench and an old saved replay do — everything but the
// card itself should still play.
//
// THE ACCEPTANCE TEST IS BLUNT: at the hold (about ?t=1500 to ?t=2700) the
// card's name and rules text must be readable in a plain ?zoom=0 shot. If it
// needs magnifying it has failed the thing the user asked for.
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
    { uid: ++st.nextUid, def: q.get('id') || 'M027', owner: 1 - side }));

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

  // THEN LET THE CAMERA SETTLE, AND PROVE THAT IT HAS.
  //
  // The table swings to the active player's seat over about a second, and a
  // shot taken mid-swing is a board seen from a corner — which looks like a
  // bug in the motif and is a bug in the harness. A fixed 1500ms wait was not
  // enough: headless Chrome runs the frame loop at a few frames a second, and
  // the swing is driven off wall-clock dt in that loop, so ?side=1 was being
  // staged with the camera thirteen degrees short of the far seat and the
  // motif was blamed for a card that came out rolled out of level.
  //
  // The camera sits at x = 0 at either seat and swings through x = +/-18.6, so
  // its own x says whether the swing is over. 0.4 is the idle sway's amplitude
  // plus a margin. The effect itself is frozen below, so this costs only wall
  // clock.
  for (let i = 0; i < 120; i++) {
    if (Math.abs(T.camera.position.x) < 0.4) break;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 60));
  }
  await new Promise((r) => setTimeout(r, 600));

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
      // Centre between the pile and the READING SPOT, not on the deck: the
      // motif hauls what it finds the whole way out to the middle of the table
      // before it holds it up, so a crop centred on the pile shows an empty
      // plinth for most of the motif.
      v.z -= Math.sign(v.z) * 2.6;
      v.y += 1.1;
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

  // THE CARD THAT IS TURNED OVER, and PRE-WARMED.
  //
  // `cardTexture()` loads the painting asynchronously. This harness freezes
  // the animator and then screenshots, so a face still in flight when the shot
  // is taken renders as an untextured slab — which looks exactly like a broken
  // effect and has cost other motifs an afternoon. Fetching it first puts it
  // in the HTTP cache, and the back goes with it because the card is seen from
  // behind for the whole of the haul.
  const id = q.get('id') || 'M027';
  await Promise.all(['../site/assets/card-back.jpg',
    st.defs?.[id]?.img ? '../site/' + st.defs[id].img + '.jpg' : null]
    .filter(Boolean).map((src) => new Promise((r) => {
      const el = new Image();
      el.onload = el.onerror = r;
      el.src = src;
    })));

  const at = Number(q.get('t') || 0) / 1000;
  const real = T.anim.update.bind(T.anim);
  T.anim.update = () => {};            // off the frame clock
  // ?tactic=1 plays it the way Decarceration does: from a card that is NOT on
  // the table, so kit.at returns null and the motif has to work out whose deck
  // to open on its own. That path showed nothing at all before, because the
  // placeholder gave up the moment it had no source card.
  const ev = {
    kind: 'reveal', faction: 'Refractory',
    at: q.get('tactic') === '1' ? st.nextUid + 99 : me,
  };
  // The way the rules pass it: `ops.noteCards(state, top.def)` leaves the id
  // on the note and fx.js hands the whole event to the motif.
  if (!Number(q.get('bare') || 0)) ev.cards = [id];
  T.fx.play(ev);
  for (let t = 0; t < at; t += 1 / 120) real(1 / 120);
  return `reveal by side ${side} on a deck of ${deck} showing `
    + (ev.cards ? id : 'nothing') + `, frozen at ${at.toFixed(2)}s`;
})()
