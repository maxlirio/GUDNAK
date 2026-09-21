// THE CHAINS, PLAYED FOR REAL — the Umbren Jailor's Man Catcher, driven
// through the same path a click takes so the board diff and the motif both
// run.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&zoom=24&t=800" \
//     --eval tools/fxdemo/irons.js --out /tmp/irons.png --wait 10000 --settle 400
//
//   &t=800   freeze the motif 800ms in
//   &zoom=24 field of view
//
// What was reported: "the chains went after the card was moved under". The
// generic slide and the chains both had hold of the victim, and the slide —
// a third of the length — had already tucked the card under the stack while
// the irons were still in the air. A carrying motif now owns its card
// outright: the card is pinned where it stood, the chains haul it, and nothing
// else touches it.
//
// `carriedNotSlid` is the evidence. It is true while the victim is still out
// on its old square with the chains working, which is only possible if the
// generic slide never ran.
(() => {
  const T = window.__table, st = T.state;
  if (!T || !st) return 'no table yet';
  const q = new URLSearchParams(location.search);
  const freeze = q.has('t') ? Number(q.get('t')) / 1000 : 0;

  if (q.has('zoom')) {
    T.camera.fov = Number(q.get('zoom'));
    T.camera.updateProjectionMatrix();
  }

  const put = (sq, def, own) => {
    const u = ++st.nextUid;
    st.board[sq].push({ uid: u, def, owner: own, fatigued: false, attachments: [] });
    return u;
  };
  st.board = Array.from({ length: 12 }, () => []);
  const jailor = put(4, 'A042', 0);          // Umbren Jailor — Man Catcher
  const victim = put(5, 'M027', 1);
  st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];
  T.resync();

  const act = T.legal().find((a) => a.t === 'ability' && a.uid === jailor);
  if (!act) return 'the Jailor cannot catch anybody here';
  T.play(act);
  if (st.pending) T.choose(victim);           // "Catch" — that one

  const before = {
    square: st.board[4].map((c) => c.uid),
    fx: (st.fx || []).map((e) => e.kind),
  };

  const STEP = 1 / 120;
  for (let c = 0; c < freeze; c += STEP) T.anim.update(STEP);
  if (freeze) T.anim.update = () => {};

  const p = T.pieces.get(victim);
  const rest = p.restingPosition();
  const off = p.group.position.distanceTo(rest);
  return {
    frozenAt: freeze,
    fx: before.fx,
    stack: before.square,                     // jailor first, victim underneath
    depth: p.depth,
    hidden: p.group.visible === false,        // a carried card keeps its own body
    doubles: p.doubles || 0,
    offFromRest: Number(off.toFixed(3)),
    // still out on the stone with the irons on it, which the generic slide
    // would have made impossible by now
    carriedNotSlid: freeze > 0.4 && freeze < 1.3 ? off > 0.5 : null,
    running: T.anim.running.length,
    where: [+p.group.position.x.toFixed(2), +p.group.position.y.toFixed(2), +p.group.position.z.toFixed(2)],
    rest: [+rest.x.toFixed(2), +rest.y.toFixed(2), +rest.z.toFixed(2)],
    inScene: !!p.group.parent,
    animating: !!p.animating,
    scale: +p.group.scale.x.toFixed(3),
    faceOpacity: +p.frontMat.opacity.toFixed(2),
    faceColour: +p.frontMat.color.r.toFixed(2),
    cardVisible: p.card3d.visible,
  };
})()
