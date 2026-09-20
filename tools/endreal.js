// The ending as the game actually reaches it — no staged board.
//
//   node tools/shot.js --url "game/?quick=1&seed=11&t=3400" \
//     --eval tools/endreal.js --out /tmp/real.png --wait 4500 --settle 900
//
// tools/endshot.js sets up the finish it wants to look at; this one PLAYS a
// whole game with random legal moves and lets the engine decide how it ends,
// which is the only way to see the ending fire down the path a real match
// takes: whatever board is left, whatever reason the rules give, and whichever
// player the camera happens to be sitting behind.

// SwiftShader takes a variable, sometimes very long time to get through the
// opening deal, and --wait is a fixed number of milliseconds. When it ran out
// early this file ran against a page that had no `window.__table` yet and died
// on line one — and shot.js still wrote a PNG of the splash screen, so the
// failure looked like a rendering bug rather than a missed race. Wait for the
// table instead of guessing how long it needs.
const ready = async () => {
  for (let i = 0; i < 600; i++) {
    if (window.__table?.state) return window.__table;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('the table never came up');
};

(async () => {
  const T = await ready();
  // Its own generator, not Math.random: the same URL has to reach the same
  // finish twice, or comparing two shots of it proves nothing.
  let rs = (Number(new URLSearchParams(location.search).get('seed')) || 7) >>> 0;
  const rnd = () => { rs = (rs * 1664525 + 1013904223) >>> 0; return rs / 4294967296; };
  let guard = 0;
  while (T.state.winner === null && guard++ < 6000) {
    if (T.state.pending) {
      const r = T.state.pending.request;
      const answer = r.type === 'confirm' ? false
        : r.type === 'some' ? []
        : r.type === 'one' || r.type === 'pick' ? (r.options?.[0] ?? null)
        : null;
      T.choose(answer);
      continue;
    }
    const acts = T.legal();
    if (!acts.length) break;
    T.play(acts[Math.floor(rnd() * acts.length)]);
  }

  // A few hundred moves leave a queue of deals, lunges and deaths that would
  // take a minute to play out. Drop it — the ending itself lives on the fx
  // list, which is a different queue and is not touched by this.
  //
  // Dropping a tween strands whatever it was carrying: the pieces it owned
  // keep `animating` and stop wherever they were, which left the board wearing
  // nothing but contact shadows. Put every card back on its square by hand.
  T.anim.running.length = 0;
  for (const p of T.pieces.byUid.values()) {
    p.animating = false;
    p.group.position.copy(p.restingPosition());
    // ...and its rotation with it: a death tween turns a card most of the way
    // over on its way to the pile, so a stranded one stands on its edge as a
    // white sliver in the middle of the board.
    p.group.scale.setScalar(1);
    p.tilt.rotation.set(0, 0, 0);
    p.card3d.rotation.set(0, p.baseYaw, 0);
  }

  const at = Number(new URLSearchParams(location.search).get('t') || 0) / 1000;
  const real = T.anim.update.bind(T.anim);
  T.anim.update = () => {};
  for (let t = 0; t < at; t += 1 / 120) real(1 / 120);
  // ...and then PINNED there rather than left stopped. arena.update() rewrites
  // every brazier from scratch on every frame of the main loop, and the
  // ending's own tick is what multiplies those values down on the losing side
  // and up on the winning one. With the animator stubbed out dead, that tick
  // stopped running and the arena quietly put all six fires back to normal in
  // the second between this eval and the screenshot: the harness printed
  // "P0:1.4" for a guttered brazier that the PNG showed burning. Stepping it
  // by zero re-applies the same frozen moment every frame without advancing
  // it.
  T.anim.update = () => real(0);

  for (const a of document.getAnimations()) a.finish();

  return `winner=${T.state.winner} after ${T.state.turn} turns `
    + `(${guard} moves) — ${T.state.reason} — frozen at ${at.toFixed(2)}s`;
})()
