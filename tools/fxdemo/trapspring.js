// Preview harness for ONE motif: trapspring.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&fxat=0.24" \
//     --eval tools/fxdemo/trapspring.js --out /tmp/ts-240.png --settle 400
//
// --settle is WALL CLOCK and headless Chrome renders this at a few frames a
// second, so shots at --settle 200 and --settle 900 come back at the same
// animation time. This harness takes the animator OFF the frame clock and
// steps it by hand to &fxat, then freezes. --settle then only has to be long
// enough for Chrome to draw one frame.
//
// It also POLLS for window.__table before staging: the machine is busy, and a
// snippet that ran before the table existed produced the loading screen, which
// looks exactly like a motif that does nothing.
//
// Params:
//   &fxat=0.24    step to exactly 240ms of animation time, then freeze
//   &fxzoom=2.2   narrow the field of view for a close look. Judge at zoom 1
//                 too — a card is 60 screen pixels on the real table
//   &fxmode=trap  a real facedown Blockade Construct with an enemy fighter
//                 standing next door about to walk onto it (the DEFAULT, and
//                 the case the card is actually for)
//   &fxmode=lab   what the fx lab does: a plain face-up fighter, so the motif
//                 is checked on the board it is browsed from
//   &fxseed=7     pin the dice so two tunings can be compared
//   &fxexit=1     fire exit.destroy() afterwards — Concealed Post destroys
//                 itself, so the spent trap has to leave on its own terms
(() => {
  const start = Date.now();
  const spin = () => new Promise((r) => setTimeout(r, 40));

  const run = async () => {
    while (!window.__table?.state && Date.now() - start < 12000) await spin();
    const T = window.__table;
    if (!T?.state) return 'no __table';
    const st = T.state;
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
    st.constructs = [];

    const mode = q.get('fxmode') || 'trap';
    let subject;
    if (mode === 'lab') {
      // exactly the fx lab's board: the motif is browsed on a face-up fighter
      subject = put(3, 'A016', 0);
      put(5, 'M027', 1);
      put(1, 'A019', 0);
    } else {
      // THE CASE THAT MATTERS: the trap lies facedown on the middle square and
      // an enemy is standing on the square next to it, about to walk on. A
      // Trap fires when the move is DECLARED, so the intruder is still on its
      // own square while the jaw shuts — which is why it is staged there and
      // not on top of the trap.
      const u = ++st.nextUid;
      st.constructs = [{
        uid: u, def: 'R062', owner: 0, square: 4, facedown: true, attachments: [],
      }];
      subject = u;
      put(5, 'M027', 1);            // the intruder, one square to the right
      put(1, 'A019', 0);            // your own fighter behind it
      put(7, 'A016', 1);
    }
    st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];
    T.resync();

    // Narrowing the fov alone is not enough: the table re-aims the camera
    // every frame from module scope, and it aims at the board's middle — so
    // the square under test crept to the top of the frame and sat behind the
    // HUD's own text. lookAt is WRAPPED rather than called once, because a
    // one-off call is overwritten before the frame is drawn.
    const zoom = num('fxzoom', 0);
    if (zoom) {
      const sq = mode === 'lab' ? 3 : 4;
      const STEP = 2.62;
      const cam = T.camera;
      const lk = cam.lookAt.bind(cam);
      cam.lookAt = () => lk(((sq % 3) - 1) * STEP, 0.35, (1 - Math.floor(sq / 3)) * STEP);
      cam.fov /= zoom;
      cam.updateProjectionMatrix();
    }

    const hud = document.createElement('div');
    hud.style.cssText = 'position:fixed;left:8px;top:8px;z-index:9999;font:16px monospace;'
      + 'color:#fff;background:#000a;padding:3px 7px;border-radius:3px';
    document.body.appendChild(hud);

    T.fx.play({ kind: 'trapspring', at: subject, faction: 'Shardsworn' });

    // Concealed Post takes its own Construct off the board as it fires. The
    // spent trap must leave on the motif's terms, so the exit is previewable.
    if (num('fxexit', 0)) {
      const mod = await import('/game/js/fx/effects/trapspring.js');
      const piece = T.pieces.get(subject);
      if (mod.exit?.destroy && piece) {
        T.anim.add(mod.timing?.kill ?? 0.3, () => {}, () => {
          mod.exit.destroy(T.fx.kit, piece, 4, {}, () => T.pieces.retire(subject));
        });
      }
    }

    const at = num('fxat', 0);
    const step = 1 / 120;           // fine slices: the snap is 45ms wide
    for (let s = 0; s < at; s += step) T.anim.update(Math.min(step, at - s));
    T.anim.update = () => {};       // hold this exact frame for the camera
    hud.textContent = `trapspring  ${mode}  t+${Math.round(at * 1000)}ms`;
    return `staged ${mode}, frozen at ${at.toFixed(3)}s`;
  };

  return run();
})()
