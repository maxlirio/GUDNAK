// A whole match played through the animation path, checking after every action
// that the board the player can SEE agrees with the board the rules hold.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&moves=60" \
//     --eval tools/fxdemo/soak.js --out /tmp/soak.png --wait 10000 --settle 600
//
// Every card in the game now animates through a stunt double, so the thing to
// watch for is a card left BEHIND its double: hidden, or standing somewhere its
// square and depth do not put it. Both are checked once the animator has run
// dry after each action, and the animator is driven by hand because headless
// Chrome renders this scene at about six frames a second.
(() => {
  const T = window.__table, st = T.state;
  if (!T || !st) return 'no table yet';
  const q = new URLSearchParams(location.search);
  const moves = Number(q.get('moves') || 60);

  let seed = Number(q.get('pick') || 12345);
  const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };

  // Answered the same way tools/playtest.js answers, so the same shapes of
  // request are covered here as there.
  const answer = (req) => {
    const pick = (arr) => arr[Math.floor(rand() * arr.length)];
    switch (req.type) {
      case 'one': return req.options.length ? pick(req.options) : null;
      case 'some': {
        const pool = [...req.options];
        const out = [];
        for (let i = 0; i < Math.min(req.count, pool.length); i++) {
          out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
        }
        return out;
      }
      case 'pick': return req.options.length ? pick(req.options) : null;
      case 'confirm': return rand() < 0.5;
      default: return null;
    }
  };

  const bad = [];
  const seen = { actions: 0, kinds: {} };

  const live = () => {
    const s = new Set();
    for (const sq of st.board) for (const c of sq || []) s.add(c.uid);
    for (const c of st.constructs || []) if (c) s.add(c.uid);
    return s;
  };

  for (let n = 0; n < moves; n++) {
    if (st.winner !== null) break;
    let guard = 0;
    while (st.pending && guard++ < 60) T.choose(answer(st.pending.request));
    if (st.winner !== null) break;
    const acts = T.legal();
    if (!acts.length) break;
    const a = acts[Math.floor(rand() * acts.length)];
    seen.actions++;
    seen.kinds[a.t] = (seen.kinds[a.t] || 0) + 1;
    T.play(a);

    guard = 0;
    while (st.pending && guard++ < 60) T.choose(answer(st.pending.request));

    // run the animator dry, then let the frame loop's idle safety nets run
    for (let i = 0; i < 900 && T.anim.running.length; i++) T.anim.update(1 / 60);
    for (let pass = 0; pass < 4; pass++) {
      T.settle();
      for (let i = 0; i < 900 && T.anim.running.length; i++) T.anim.update(1 / 60);
    }
    // and let the pieces ease home, which is the frame loop's job and not the
    // animator's — a card with nothing animating it lerps to its resting place
    for (let i = 0; i < 60; i++) T.pieces.update(1 / 60, T.camera);

    const on = live();
    for (const [uid, p] of T.pieces.byUid) {
      if (!on.has(uid)) continue;                 // a corpse waiting to be retired
      if (!p.group.visible) bad.push(`${n}: uid ${uid} left hidden behind its double`);
      if (p.doubles) bad.push(`${n}: uid ${uid} still has ${p.doubles} double(s)`);
      const off = p.group.position.distanceTo(p.restingPosition());
      // a piece eases home over a few frames, so allow the lerp, not a square
      if (off > 0.35) {
        bad.push(`${n}: ${a.t} — uid ${uid} is ${off.toFixed(2)} from where the state puts it`
          + ` (animating=${!!p.animating} sq=${p.square} depth=${p.depth}`
          + ` fx=${(st.fx || []).map((e) => e.kind).join('/') || 'none'})`);
      }
    }
    if (bad.length > 6) break;
  }

  return { moves: seen.actions, kinds: seen.kinds, winner: st.winner, problems: bad };
})()
