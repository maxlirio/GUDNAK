// Preview harness for the FIRE BOLT'S EXIT — what becomes of the card.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&t=1600" \
//     --eval tools/fxdemo/boltexit.js --out /tmp/be-1600.png \
//     --wait 4000 --settle 600
//
// ?t is MILLISECONDS from the moment the bolt is thrown, NOT from the moment
// the card starts burning away: the exit is what the table does after
// fx.killWait() seconds, and the whole point is that the two read as one
// event, so the harness runs them on the same clock the game does.
(() => {
  const T = window.__table, st = T.state;
  const q = new URLSearchParams(location.search);
  const put = (sq, def, own) => {
    const u = ++st.nextUid;
    st.board[sq] = [{ uid: u, def, owner: own, fatigued: false, attachments: [] }];
    return u;
  };
  st.board = Array.from({ length: 12 }, () => []);
  const from = 1, to = 7;
  put(from, 'M027', 0);
  const victim = put(to, 'A016', 1);
  st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];
  T.resync();

  const at = Number(q.get('t') || 0) / 1000;
  const real = T.anim.update.bind(T.anim);
  T.anim.update = () => {};

  const ev = { kind: 'bolt', bolt: 'fire', from, to };
  T.fx.play(ev);
  // exactly what main.js does: wait the motif's own kill time, then hand the
  // card to whoever owns its leaving
  const wait = T.fx.killWait([ev]);
  const piece = T.pieces.get(victim);
  T.anim.add(wait, () => {}, () => {
    T.fx.exitFor([ev], 'destroy')(piece, to, () => T.pieces.retire(victim));
  });

  for (let t = 0; t < at; t += 1 / 120) real(1 / 120);
  return `fire bolt + exit, kill wait ${wait}s, frozen at ${at.toFixed(2)}s`;
})()
