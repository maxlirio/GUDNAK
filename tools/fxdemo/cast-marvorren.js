// Preview harness for ONE effect: cast-marvorren.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&at=300" \
//     --eval tools/fxdemo/cast-marvorren.js --out /tmp/cm-300.png --settle 900
//
// ?at is MILLISECONDS INTO THE MOTIF, and it is the number to steer by.
// --settle is wall-clock, and wall clock is a lie here: main.js clamps dt to
// 0.05 and a headless SwiftShader frame costs far more than that, so a 400ms
// settle lands maybe 150ms into the motif — a different place every run, which
// had two shots of the same code disagreeing. So the harness takes the clock:
// it swallows anim.update, feeds the animator fixed 1/120s steps until the
// motif has run exactly `at` milliseconds, and then FREEZES there. Whatever
// the settle, the picture is the motif at `at`.
//
// It also leaves `window.__mvAt(ms)` behind, which winds the same frozen clock
// on to a later moment — that is how a tool takes a whole spread out of ONE
// page load instead of paying the load for every frame.
//
// It waits for the card art before it fires, and returns a promise so the
// shot tool waits too: the card JPEGs arrive well after the page does, and a
// shot taken early has a BLACK card in it, which is unjudgeable for a motif
// whose whole job is to be read against card art.
//
// This file is yours to change while you work on that effect.
(() => {
  const T = window.__table, st = T.state;
  const put = (sq, def, own) => {
    const u = ++st.nextUid;
    st.board[sq] = [{ uid: u, def, owner: own, fatigued: false, attachments: [] }];
    return u;
  };
  st.board = Array.from({ length: 12 }, () => []);
  const me = put(3, 'M016', 0);        // a Sea Soldier, centre-left: the caster
  put(5, 'M027', 1);                   // an enemy, centre-right
  put(1, 'A019', 0);                   // a second fighter of yours
  put(4, 'M020', 0);                   // the neighbour the tide must NOT spill onto
  st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];
  T.resync();

  const A = T.anim;
  const real = A.update.bind(A);
  let clock = 0, target = 0;
  A.update = () => {
    // Several sub-steps per frame or the clock never catches up: 900ms of
    // motif at one 1/120s step per headless frame would take 108 frames.
    for (let i = 0; i < 24 && clock < target; i++) {
      const s = Math.min(1 / 120, target - clock);
      clock += s;
      real(s);
    }
  };
  window.__mvAt = (ms) => { target = Math.max(target, ms / 1000); return target; };

  const painted = () => {
    let waiting = false;
    for (const p of T.pieces.byUid.values()) {
      p.group.traverse((o) => {
        for (const m of [].concat(o.material || [])) {
          const img = m?.map?.image;
          if (m?.map && (!img || !img.width)) waiting = true;
        }
      });
    }
    return !waiting;
  };

  return new Promise((done) => {
    let tries = 0;
    const go = () => {
      if (painted() || ++tries > 120) {
        // Fired TWICE: once on the card it marks, and once on the bare square
        // in front of it. Marvorren card art is itself blue-green, so on the
        // card alone it is hard to tell a weak effect from a broken one; the
        // copy on warm empty stone shows the shape plainly, and the two
        // together show whether the shape survives sea-coloured art.
        T.fx.play({ kind: 'cast', at: me, faction: 'Marvorren' });
        T.fx.play({ kind: 'cast', at: 0, faction: 'Marvorren' });
        window.__mvAt(Number(new URLSearchParams(location.search).get('at') || 0));
        done(`played, art ${painted() ? 'ready' : 'GAVE UP waiting'}`);
      } else setTimeout(go, 50);
    };
    go();
  });
})()
