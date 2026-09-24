// Preview harness for ONE motif: arcane.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&t=300" \\
//     --eval tools/fxdemo/arcane.js --out /tmp/arcane-300.png \\
//     --wait 10000 --settle 900
//
// ?t is MILLISECONDS INTO THE MOTIF. --settle is WALL CLOCK and headless
// rendering runs animation time at a fraction of it, so the animator is taken
// off the frame clock here and stepped by hand to ?t, then frozen. --settle
// then only has to be long enough for Chrome to draw one frame.
//
// Extra params:
//   &kill=1    play the death as well, through the motif's own timing.kill
//              and exit.destroy. Without it you are looking at the effect
//              over a card that never leaves, which hides the whole last beat
//              — the card is meant to be in nine pieces on its way to the
//              pile by t+1.2s.
//   &seedfx=7  pin the dice. Every cast jitters its fan heights, bows, orbit
//              and spikes, which is the point, but it makes two tunings
//              impossible to compare — twice I "fixed" something that was
//              really a different roll.
//   &zoom=2.2  narrow the field of view for a close look.
//   &n=2       how many cards the blast cost, i.e. how many REAL cards go in
//              the fan. Arcane Blast discards one more than the target's
//              power, so 2, 3 and 4 are the counts that happen in a game —
//              and the arrangement that reads well for four is not the one
//              that reads well for two, so both get looked at.
//   &ids=      the exact card ids, comma separated, overriding &n.
//   &bare=1    fire the event with NO `cards` field, the way the effects
//              bench and an old saved note do. Nothing should be drawn in
//              the fan and nothing should throw.
(async () => {
  // WAIT FOR THE TABLE. --wait is wall clock and a cold cache can take eight
  // seconds to raise the battlefield; a shot taken before then comes back as
  // the splash screen with "Cannot read properties of undefined", which looks
  // exactly like a broken motif and is a page that had not loaded yet.
  for (let i = 0; i < 200 && !window.__table; i++) {
    await new Promise((r) => setTimeout(r, 100));
  }
  const T = window.__table, st = T.state;
  const q = new URLSearchParams(location.search);
  const num = (k, d) => (q.has(k) ? Number(q.get(k)) : d);

  const seed = num('seedfx', 0);
  if (seed) {
    let a = (seed * 1831565813) >>> 0;
    Math.random = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let x = Math.imul(a ^ (a >>> 15), 1 | a);
      x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  const put = (sq, def, own) => {
    const u = ++st.nextUid;
    st.board[sq] = [{ uid: u, def, owner: own, fatigued: false, attachments: [] }];
    return u;
  };
  st.board = Array.from({ length: 12 }, () => []);
  // The VICTIM is an enemy fighter, on the CENTRE square by default. &sq=
  // moves it. The motif stands three units tall and this camera
  // turns height into screen HEIGHT, so a target on the far row pushes the fan
  // of spent cards sixty pixels closer to the top of the window than one on
  // the near row — worth looking at on both before believing any of it.
  const SQ = num('sq', 4);
  const victim = put(SQ, 'M027', 1);
  const mine = put(SQ === 3 ? 0 : 3, 'A016', 0);
  const other = put(SQ === 5 ? 2 : 5, 'A019', 0);
  const back = put(SQ === 7 ? 6 : 7, 'A016', 1);
  st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];
  T.resync();

  const zoom = num('zoom', 0);
  if (zoom) { T.camera.fov /= zoom; T.camera.updateProjectionMatrix(); }

  const hud = document.createElement('div');
  hud.style.cssText = 'position:fixed;left:8px;top:8px;z-index:9999;font:16px monospace;'
    + 'color:#fff;background:#000a;padding:3px 7px;border-radius:3px';
  document.body.appendChild(hud);

  // THE REAL CARDS, passed the way the rules pass them: `ops.noteCards` puts
  // the ids on the note and fx.js hands the whole event to the motif. These
  // four are what a live blast on a III actually produced — Demolition
  // "Experts", Goblin Hunter, Burnout and an Orc Soldier.
  const POOL = ['C053', 'C063', 'C076', 'C057', 'C050', 'C071'];
  const n = Math.max(1, Math.min(POOL.length, num('n', 4)));
  const ids = q.has('ids') ? q.get('ids').split(',').filter(Boolean) : POOL.slice(0, n);

  // PRE-WARM THE FACES. cardTexture() loads the JPEG asynchronously, and this
  // harness freezes the animator and then screenshots — so a face that is
  // still in flight when the shot is taken renders as an untextured slab, and
  // the effect gets blamed for it. Fetching them first puts them in the HTTP
  // cache, so the TextureLoader resolves in the same tick it is asked.
  await Promise.all(ids.map((id) => new Promise((r) => {
    const img = st.defs?.[id]?.img;
    if (!img) { r(); return; }
    const el = new Image();
    el.onload = el.onerror = r;
    el.src = '../site/' + img + '.jpg';
  })));

  const at = num('t', 0) / 1000;
  const real = T.anim.update.bind(T.anim);
  T.anim.update = () => {};            // off the frame clock
  const ev = { kind: 'arcane', at: victim, faction: 'Shardsworn' };
  if (!num('bare', 0)) ev.cards = ids;
  T.fx.play(ev);
  // &kill=1 runs the death too, on the SAME clock main.js uses: wait the
  // motif's own timing.kill, then hand the card to whoever owns its leaving.
  // The strike and the card coming apart have to read as one event, and the
  // only way to see whether they do is to play them together.
  if (num('kill', 0)) {
    const piece = T.pieces.get(victim);
    const wait = T.fx.killWait([ev]);
    T.anim.add(wait, () => {}, () => {
      T.fx.exitFor([ev], 'destroy')(piece, SQ, () => T.pieces.retire(victim));
    });
  }
  const step = 1 / 120;
  for (let s = 0; s < at; s += step) real(Math.min(step, at - s));
  hud.textContent = `t+${Math.round(at * 1000)}ms  x${num('bare', 0) ? 0 : ids.length}`;
  return 'played arcane (' + (num('bare', 0) ? 'bare' : ids.join(',')) + ') frozen at '
    + at.toFixed(2) + 's';
})()
