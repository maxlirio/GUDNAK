// Preview harness for ONE effect: cast-shardsworn.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&at=230" \
//     --eval tools/fxdemo/cast-shardsworn.js --out /tmp/cs-230.png
//
// ?at is MILLISECONDS INTO THE MOTIF, and that is the number that matters.
// --settle is wall clock, and headless Chrome renders this table at a few
// frames a second while main.js clamps dt to 0.05 — so animation time runs at
// a fraction of wall clock and a "spread" of wall-clock settles all lands in
// the motif's first moments. So this takes the animator off the frame clock
// the instant the effect is queued and steps it by hand in fixed 1/120s ticks
// up to ?at, inside one call. Every shot is then exactly reproducible, and two
// shots 40ms apart really are 40ms apart.
//
// It also waits for the card JPEGs before firing. Their textures load
// asynchronously and a card whose face has not arrived is drawn BLACK, which
// makes any judgement about how much of the art the effect covers worthless.
//
// ?fx=pair fires the flourish AND the Shard Dragon's shardfire side by side,
// which is the shot that proves the quiet cousin is telling apart from the
// loud one. ?fx=row fires it on three squares at once, to check that forty of
// these a game would not become a nuisance. ?fx=bare fires it on an EMPTY
// square, which is the other thing `cast` is handed — kit.at answers 0.4 there
// against ~0.2 for a card, so it is the case that catches a motif floating.
(() => {
  const T = window.__table, st = T.state, anim = T.anim;
  const q = new URLSearchParams(location.search);
  const put = (sq, def, own) => {
    const u = ++st.nextUid;
    st.board[sq] = [{ uid: u, def, owner: own, fatigued: false, attachments: [] }];
    return u;
  };
  st.board = Array.from({ length: 12 }, () => []);
  const me = put(3, 'A016', 0);        // your fighter, centre-left
  const foe = put(5, 'M027', 1);       // an enemy, centre-right
  const friend = put(1, 'A019', 0);    // a second fighter of yours
  st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];
  T.resync();

  /** Every card face in the scene has its image, or we are not ready. */
  const painted = () => {
    let ready = true;
    T.arena.scene.traverse((o) => {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        const im = m && m.map && m.map.image;
        if (im && typeof HTMLImageElement !== 'undefined'
          && im instanceof HTMLImageElement && !im.complete) ready = false;
        if (m && m.map && m.map.source && m.map.source.data === undefined) ready = false;
      }
    });
    return ready;
  };

  const go = () => {
    // Freeze first, THEN queue: the render loop must not get a single dt of
    // its own in, or the motif is already a frame or two old before the
    // stepping starts.
    const step = anim.update.bind(anim);
    anim.update = () => {};

    const mode = q.get('fx') || 'one';
    const played = [];
    const fire = (ev) => { T.fx.play(ev); played.push(ev); };
    if (mode === 'pair') {
      fire({ kind: 'cast', at: me, faction: 'Shardsworn' });
      fire({ kind: 'shardfire', at: foe });
    } else if (mode === 'row') {
      fire({ kind: 'cast', at: me, faction: 'Shardsworn' });
      fire({ kind: 'cast', at: foe, faction: 'Shardsworn' });
      fire({ kind: 'cast', at: friend, faction: 'Shardsworn' });
    } else if (mode === 'bare') {
      fire({ kind: 'cast', at: 8, faction: 'Shardsworn' });
    } else {
      fire({ kind: 'cast', at: me, faction: 'Shardsworn' });
    }

    const AT = Number(q.get('at') || 0) / 1000;
    const TICK = 1 / 120;
    for (let s = 0; s < AT - 1e-6; s += TICK) step(Math.min(TICK, AT - s));
    return `${mode} @${(AT * 1000) | 0}ms ` + JSON.stringify(played);
  };

  return new Promise((done) => {
    let tries = 0;
    const wait = () => {
      if (painted() || ++tries > 120) done(go());
      else setTimeout(wait, 50);
    };
    wait();
  });
})()
