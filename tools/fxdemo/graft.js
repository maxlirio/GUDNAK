// Preview harness for ONE motif: graft.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&t=600" \\
//     --eval tools/fxdemo/graft.js --out /tmp/graft-600.png --wait 4000 --settle 600
//
//   &t        MILLISECONDS INTO THE MOTIF. --settle is WALL CLOCK and headless
//             rendering runs animation time at a fraction of it, so the
//             animator is taken off the frame clock here and stepped by hand
//             to ?t, then frozen. --settle then only has to be long enough for
//             Chrome to draw one frame — and NOT long enough for the table's
//             own opening to deal cards over the board this sets up (1400ms
//             was, 600ms is not).
//   &fxzoom   narrow the field of view for a close look. Judge the motif at
//             fxzoom=1 as well: a card is 60 screen pixels on the real table
//             and everything looks generous at 2.5.
//   &fxseed   pin the dice, so two shots of the same instant match.
//
// FIVE friendly fighters, because the network between them is the whole point
// of this motif; a lone caster tests nothing. The source sits in the middle so
// the spokes run in every direction, the four allies sit at four different
// distances so the ally-to-ally chords have both a short pair and a pair too
// far apart to join, and one enemy stands in the near corner to prove the veins
// ignore it. &fxlone=1 strips the allies out to check the degraded version.
(() => {
  const T = window.__table, st = T.state;
  const q = new URLSearchParams(location.search);
  const num = (k, d) => (q.has(k) ? Number(q.get(k)) : d);

  const seed = num('fxseed', 0);
  if (seed) {
    let a = (seed * 1831565813) >>> 0;
    Math.random = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const put = (sq, def, own) => {
    const u = ++st.nextUid;
    st.board[sq] = [{ uid: u, def, owner: own, fatigued: false, attachments: [] }];
    return u;
  };
  st.board = Array.from({ length: 12 }, () => []);
  const me = put(4, 'A053', 0);        // Spirit of Alliance, the hub
  if (!num('fxlone', 0)) {
    put(0, 'C058', 0);                 // Orc Soldier, near corner
    put(3, 'C055', 0);                 // Orc Soldier, alongside the hub
    put(5, 'C063', 0);                 // Goblin Hunter, mid right
    put(7, 'VE14', 0);                 // Ogre Brute, far middle
  }
  put(2, 'M027', 1);                   // an enemy — must NOT be linked
  st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];
  T.resync();

  const zoom = num('fxzoom', 0);
  if (zoom) { T.camera.fov /= zoom; T.camera.updateProjectionMatrix(); }

  const at = num('t', 0) / 1000;
  const hud = document.createElement('div');
  hud.style.cssText = 'position:fixed;left:8px;top:8px;z-index:9999;font:16px monospace;'
    + 'color:#fff;background:#000a;padding:3px 7px;border-radius:3px';
  hud.textContent = 'graft  t=' + at.toFixed(2) + 's';
  document.body.appendChild(hud);

  const real = T.anim.update.bind(T.anim);
  T.anim.update = () => {};            // off the frame clock
  // &fxref=square hands the motif a bare square index instead of a uid, and
  // &fxref=none hands it nothing at all: both are shapes the real caller can
  // produce (two of the three cards are tactics, not fighters) and neither may
  // throw or leave the table without a flourish.
  const ref = q.get('fxref');
  T.fx.play({
    kind: 'graft', faction: 'Shardsworn',
    at: ref === 'square' ? 4 : ref === 'none' ? null : me,
  });
  for (let t = 0; t < at; t += 1 / 120) real(1 / 120);
  return 'played graft frozen at ' + at.toFixed(2) + 's';
})()
