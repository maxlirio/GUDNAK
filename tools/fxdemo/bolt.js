// Preview harness for the bolt motifs. Used with tools/shot.js:
//   node tools/shot.js --url "game/?quick=1&seed=5" --eval tools/fxdemo/bolt.js \
//     --out /tmp/bolt.png --settle 500
//
// Headless Chrome draws this scene at about 7 frames a second and main.js
// clamps dt to 0.05, so wall-clock settle time is NOT animation time — a 500ms
// settle lands about 100ms into the motif. So the harness can instead drive the
// animator by hand: set AT to the animation time you want to look at, and the
// frame it leaves on screen is exactly that moment, however slow the renderer
// is. Set VIEW to 'close' or 'mid' to pin the camera in on the target.
(() => {
  const T = window.__table, st = T.state;
  const put = (sq, def, own) => {
    const u = ++st.nextUid;
    st.board[sq] = [{ uid: u, def, owner: own, fatigued: false, attachments: [] }];
    return u;
  };
  st.board = Array.from({ length: 12 }, () => []);
  const me = put(3, 'A016', 0);
  const foe = put(5, 'M027', 1);
  const friend = put(1, 'A019', 0);
  st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];
  T.resync();

  // The camera is re-placed and nudged every frame, so a close view has to be
  // nailed down rather than simply assigned.
  const pin = (px, py, pz, lx, ly, lz) => {
    const c = T.camera;
    for (const [k, v] of [['x', px], ['y', py], ['z', pz]]) {
      Object.defineProperty(c.position, k, { get: () => v, set: () => {}, configurable: true });
    }
    Object.getPrototypeOf(c).lookAt.call(c, lx, ly, lz);
    c.lookAt = () => {};
  };
  const VIEW = window.__FX_VIEW || 'table';
  if (VIEW === 'close') pin(4.2, 4.6, 5.6, 2.3, 0.5, 0.1);
  if (VIEW === 'mid') pin(1.2, 9.0, 10.0, 0.4, 0.4, 0.1);

  // Earth and lightning both need a destination, which the rules write as
  // `toSquare`; lightning wraps the caster's OWN square rather than a target.
  const DEFAULT = { kind: 'bolt', bolt: 'fire', from: me, to: foe };
  if (window.__FX_SELF) DEFAULT.to = 3;
  if (window.__FX_TOSQ != null) DEFAULT.toSquare = window.__FX_TOSQ;
  const FX = window.__FX_EVENT || DEFAULT;
  const AT = window.__FX_AT;

  if (AT == null) { T.fx.play(FX); return 'played ' + JSON.stringify(FX); }

  const anim = T.anim;
  const step = anim.update.bind(anim);
  anim.update = () => {};              // the loop no longer advances anything
  T.fx.play(FX);
  for (let s = 0; s < AT; s += 1 / 60) step(1 / 60);   // the rate a player sees
  return 'played ' + JSON.stringify(FX) + ' @' + AT;
})()
