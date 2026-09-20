// Preview harness for ONE motif: bounce — and for its EXIT, which is most of
// it.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&t=600" \
//     --eval tools/fxdemo/bounce.js --out /tmp/b-600.png \
//     --wait 3500 --settle 500 --port 9811 --serve-port 8811
//
// ?t is MILLISECONDS FROM THE MOMENT THE RULES RESOLVE — not from the moment
// the card starts coming apart. The two are different things and the gap
// between them is the motif's own `timing.kill`, so the harness does exactly
// what main.js does: play the fx, wait that long, then hand the card to
// whoever claims its leaving. Anything else is a lie about when things happen.
//
// --settle is WALL CLOCK and headless rendering runs animation time at a
// fraction of it, so the animator is taken off the frame clock here and
// stepped by hand to ?t, then frozen; --settle then only has to be long enough
// for Chrome to draw one frame.
//
// Other params:
//   &tactic=1  resolve the spell from NOWHERE, which is what Unmarked Trails
//              and Diversion actually do: they are Tactics, they are not on
//              the board, and `bounce()` itself draws nothing at all. The
//              exit is the whole motif. The default is the Shard Wisp case,
//              where the caster is a fighter on another square.
//   &foe=1     bounce the ENEMY's fighter, so the crystal goes home to the
//              far end of the table instead of toward the camera. NOT &side —
//              the game itself takes ?side as "pretend to be the online
//              guest", and using that name here quietly turned the table
//              around.
//   &fate=destroy   ask for the exit the DISCARD PILE would use. Bounce
//              declares no exit.destroy, so this checks the fallback path:
//              the table must still kill the card the generic way.
//   &zoom=2.2  narrow the field of view for looking at the crystal close up.
//   &seed=7    pin the dice — every flake and mote is rolled, so two tunings
//              are otherwise not comparable.
(() => {
  const T = window.__table, st = T.state;
  const q = new URLSearchParams(location.search);
  const num = (k, d) => (q.has(k) ? Number(q.get(k)) : d);

  const put = (sq, def, own) => {
    const u = ++st.nextUid;
    st.board[sq] = [{ uid: u, def, owner: own, fatigued: false, attachments: [] }];
    return u;
  };
  st.board = Array.from({ length: 12 }, () => []);
  const me = put(3, 'A016', 0);        // your fighter, centre-left
  const foe = put(5, 'M027', 1);       // an enemy, centre-right
  const wisp = put(1, 'A019', 0);      // the caster, on its own square
  st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];
  T.resync();

  // Pinning the dice: the motif rolls every flake, so without this two
  // screenshots of two tunings differ for reasons that have nothing to do
  // with the change being judged.
  const seed = num('seed', 0);
  if (seed) {
    let a = (seed * 1831565813) >>> 0;
    Math.random = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const zoom = num('zoom', 0);
  if (zoom) { T.camera.fov /= zoom; T.camera.updateProjectionMatrix(); }

  const hud = document.createElement('div');
  hud.style.cssText = 'position:fixed;left:8px;top:8px;z-index:9999;font:16px monospace;'
    + 'color:#fff;background:#000a;padding:3px 7px;border-radius:3px';
  document.body.appendChild(hud);

  const uid = num('foe', 0) ? foe : me;
  const square = num('foe', 0) ? 5 : 3;
  const piece = T.pieces.get(uid);
  // A Tactic resolves from a hand, so its uid is not a piece and never will
  // be. 9999 rather than a small number on purpose: kit.at() treats a number
  // under 12 as a SQUARE, so a "missing" uid of 4 silently plays the whole
  // flourish on the middle of the board.
  const ev = { kind: 'bounce', at: num('tactic', 0) ? 9999 : wisp, faction: 'Shardsworn' };
  const fate = q.get('fate') || 'hand';

  T.fx.play(ev);
  // ...and then exactly what main.js does with the card that is leaving.
  const wait = T.fx.killWait([ev]);
  T.anim.add(wait, () => {}, () => {
    const finish = () => T.pieces.retire(uid);
    const owned = T.fx.exitFor([ev], fate);
    if (owned) owned(piece, square, finish);
    else if (fate === 'destroy') T.anim.destroy(piece, square, finish);
    else T.anim.vanish(piece, finish);
  });

  const at = Number(q.get('t') || 0) / 1000;
  const real = T.anim.update.bind(T.anim);
  T.anim.update = () => {};            // off the frame clock
  for (let t = 0; t < at; t += 1 / 120) real(1 / 120);
  hud.textContent = `bounce ${fate} t+${Math.round(at * 1000)}ms  kill ${wait}s`;
  return `bounce on uid ${uid} (${piece ? 'piece found' : 'MISSING'}), fate ${fate},`
    + ` kill wait ${wait}s, exit ${T.fx.exitFor([ev], fate) ? 'claimed' : 'FALLBACK'},`
    + ` frozen at ${at.toFixed(2)}s`;
})()
