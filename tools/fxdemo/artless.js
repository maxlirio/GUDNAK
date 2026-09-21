// A038 Migration is the only card in the game with no painting, and it used to
// come out as a blank brown slab. This stages it beside a painted card so the
// drawn face can be judged against the real thing.
//
//   node tools/shot.js --url "game/?quick=1&seed=5" \
//     --eval tools/fxdemo/artless.js --out /tmp/artless.png --wait 10000 --settle 900
//
//   &read=1   hold the drawn card up, the way right-click does, to read it
//   &zoom=18  narrow the field of view for a close look
(() => {
  const T = window.__table, st = T.state;
  if (!T || !st) return 'no table yet';
  const q = new URLSearchParams(location.search);

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
  const drawn = put(4, 'A038', 0);        // no art — drawn from the card's words
  put(3, 'A002', 0);                      // painted, for comparison
  put(5, 'M199', 0);                      // a painted TACTIC, the same layout
  st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];
  T.resync();

  if (q.has('read')) T.pieces.setInspected(T.pieces.get(drawn));

  // &face=1 — the drawn face itself, blitted over the scene at a size a person
  // can actually read. The card lying on a square is 90 pixels tall and
  // holding it up puts it off the top of the frame, so neither shot can say
  // whether the TEXT is right.
  if (q.has('face')) {
    const src = T.pieces.get(drawn).frontMat.map.image;
    const el = document.createElement('canvas');
    el.width = el.height = 640;
    Object.assign(el.style, {
      position: 'fixed', left: '50%', top: '50%', width: '640px', height: '640px',
      transform: 'translate(-50%,-50%)', zIndex: 9999,
    });
    el.getContext('2d').drawImage(src, 0, 0, 640, 640);
    document.body.appendChild(el);
  }
  return `A038 on 4 as uid ${drawn}`;
})()
