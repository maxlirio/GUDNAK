// Preview harness for ONE motif: triangle — the trait cycle biting as an
// attack resolves.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&t=200" \
//     --eval tools/fxdemo/triangle.js --out /tmp/tri-200.png --wait 10000 --settle 600
//
// ?t is MILLISECONDS from the moment the ATTACK starts, not from the moment
// the mark appears — the motif is nothing on its own and everything about it
// is timed against the lunge in anim.js. The lunge lands at 168ms.
//
// --settle is WALL CLOCK, and headless rendering runs animation time at a
// fraction of it, so the animator is taken off the frame clock here and
// stepped by hand to ?t. --settle then only has to be long enough for Chrome
// to draw one frame.
//
// THE ATTACK IS STAGED FOR REAL: anim.attack() is started on the same frame as
// fx.play(), exactly the way main.js does it, because this motif reads its
// heading off the attacker's own displacement and has no direction at all
// without a card actually moving.
//
//   ?me=3&foe=4   across the middle row, left to right — the widest read
//   ?me=1&foe=4   straight up the board, away from the camera (foreshortened)
//   ?me=7&foe=4   straight down the board, at the camera
//   ?me=4&foe=8   a diagonal, which the rules do not allow but the geometry can
//   ?nolunge=1    no attack animation: the effects-lab fallback, which has to
//                 find the enemy for itself
//   ?nofx=1       the lunge alone, with no motif on top — the baseline every
//                 "can you see it?" question has to be measured against
//   ?die=1        the defender dies on the hit, which is what usually happens
//                 when this fires — the mark has to hold up over a card being
//                 struck flat and thrown at the discard pile
//   ?solo=1       no enemy anywhere — the blind fallback
//   ?faction=Gloaming   every faction owns cards with this line; check the
//                 colour survives ACES on all five
//   ?zoom=14      narrows the lens. The board is PLAYED at 60 pixels a card
//                 and that is what the mark has to read at, so a zoomed frame
//                 is for finding faults — depth fighting, a corner notch — and
//                 never for deciding whether it reads.
//
// Row 0 (squares 0,1,2) is nearest the camera.
//
// The wait for __table is not optional: main.js finishes booting behind a
// top-level await, and on a loaded machine that can take longer than any
// --settle worth waiting — the harness then threw on a window.__table that was
// not there yet and the screenshot was the loading screen.
(async () => {
  for (let i = 0; i < 400 && !window.__table; i++) {
    await new Promise((r) => setTimeout(r, 50));
  }
  const T = window.__table, st = T.state;
  const q = new URLSearchParams(location.search);
  const num = (k, d) => (q.has(k) ? Number(q.get(k)) : d);
  const put = (sq, def, own) => {
    const u = ++st.nextUid;
    st.board[sq] = [{ uid: u, def, owner: own, fatigued: false, attachments: [] }];
    return u;
  };
  st.board = Array.from({ length: 12 }, () => []);
  const mySq = num('me', 3);
  const foeSq = num('foe', 4);
  const me = put(mySq, 'A016', 0);                     // the attacker
  if (!q.has('solo')) put(foeSq, 'M027', 1);           // the defender

  // Bystanders. The mark has to read over a busy board and not only over two
  // cards on bare stone, and with ?nolunge=1 they are also what proves the
  // fallback picks the card that was actually attacked rather than the nearest
  // thing it can see.
  for (const [sq, def, own] of [[0, 'A019', 0], [5, 'M031', 1], [6, 'M029', 0]]) {
    if (sq !== mySq && sq !== foeSq) put(sq, def, own);
  }
  st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];
  T.resync();

  if (q.has('zoom')) {
    // placeCamera() re-aims every frame, so the target has to be patched in
    // rather than set once or the next frame throws it away.
    const a = T.pieces.get(me).group.position;
    const mid = { x: (a.x + 0) / 2, y: 0.2, z: (a.z + 0) / 2 };
    const orig = T.camera.lookAt.bind(T.camera);
    T.camera.lookAt = () => orig(mid.x, mid.y, mid.z);
    T.camera.fov = num('zoom', 14);
    T.camera.updateProjectionMatrix();
  }

  const at = num('t', 200) / 1000;
  const IMPACT_S = 0.168;              // when anim.attack() lands its blow
  const real = T.anim.update.bind(T.anim);
  T.anim.update = () => {};                            // off the frame clock

  // Both started in the same pass, like main.js: playAnimations() runs the
  // lunge and then the fx notes are played. Neither tween is stepped until the
  // next frame, which is what lets the motif count 168ms to the impact.
  const piece = T.pieces.get(me);
  if (!q.has('nolunge')) T.anim.attack(piece, mySq, foeSq, {});
  // ?nofx=1 plays the lunge and nothing else. It is the only honest way to
  // answer "is that light actually doing anything?" — the attack's own flash
  // is bright enough that a small point light next to it can be argued for
  // from a single frame either way.
  if (!q.has('nofx')) {
    T.fx.play({ kind: 'triangle', at: mySq, to: foeSq, amount: 1, trait: 'Brute',
      faction: q.get('faction') || 'Auroxi' });
  }

  // ?die=1 is the COMMON case, not an edge one: the bonus is only announced
  // when it changes the attacker's power, which usually means it is the reason
  // the defender lost. main.js hangs the death off the lunge's onImpact and
  // this motif declares no kill wait, so the defender starts dying on the same
  // frame the blow lands and is on its way to the pile while the mark is still
  // on the stone. A mark that reads beautifully over a card that is standing
  // still is worth nothing if it reads as pointing at nowhere over a card that
  // is leaving.
  if (q.has('die')) {
    const victim = T.pieces.topAt(foeSq);
    if (victim) T.anim.add(IMPACT_S, () => {}, () => T.anim.destroy(victim, foeSq));
  }

  for (let t = 0; t < at; t += 1 / 120) real(1 / 120);
  return `triangle over a lunge ${mySq}->${foeSq}, frozen at ${at.toFixed(3)}s`;
})()
