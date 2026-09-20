// Preview harness for ONE motif: arcane.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&t=300" \\
//     --eval tools/fxdemo/arcane.js --out /tmp/arcane-300.png --settle 700
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
(() => {
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

  const at = num('t', 0) / 1000;
  const real = T.anim.update.bind(T.anim);
  T.anim.update = () => {};            // off the frame clock
  const ev = { kind: 'arcane', at: victim, faction: 'Shardsworn' };
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
  hud.textContent = `t+${Math.round(at * 1000)}ms`;
  return 'played arcane frozen at ' + at.toFixed(2) + 's';
})()
