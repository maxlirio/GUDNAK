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
  // What the arena looked like before a single move was played. Anything that
  // turns up in the scene between here and the last move was put there by an
  // animation, and an animation is responsible for taking it away again.
  const wasThere = new Set(T.arena.scene.children);
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

  // Dropping the queue also strands the animator's OWN props. A tween is what
  // removes the loose card-back a draw flies across the table, and a card
  // effect's whole rig — Recall builds a signal post with a lamp on it — is
  // taken down the same way. Thrown away, they stay exactly where they were:
  // two separate runs ended with a pale post a metre tall standing upright in
  // the middle of the board, which reads as a rendering fault and is this
  // harness's litter.
  //
  // Swept by ORIGIN rather than by shape, because there is no shape they have
  // in common. Lights and point clouds are spared: the ending's own key light,
  // fill, embers and dust are also new since the game began.
  const pieceGroups = new Set([...T.pieces.byUid.values()].map((p) => p.group));
  for (const o of [...T.arena.scene.children]) {
    if (wasThere.has(o) || pieceGroups.has(o) || o.isLight || o.isPoints) continue;
    T.arena.scene.remove(o);
  }
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

  // The same two viewing controls tools/endshot.js has, and for the same
  // reason: ?panel=0 lifts the result overlay off the bottom half of the
  // table, ?zoom=x,y magnifies a quarter-frame box around a point. A wide shot
  // of a dark arena is exactly where a stray sliver of white geometry hides.
  const look = async () => {
    const qq = new URLSearchParams(location.search);
    if (qq.get('panel') === '0') document.getElementById('hud').style.display = 'none';
    if (!qq.get('zoom')) return;
    const [zx, zy] = qq.get('zoom').split(',').map(Number);
    const src = document.querySelector('canvas');
    const box = document.createElement('canvas');
    box.width = src.width; box.height = src.height;
    box.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:9999';
    const w = src.width / 4, h = src.height / 4;
    const g = box.getContext('2d');
    await new Promise((r) => setTimeout(r, 1500));   // let the card art land
    await new Promise((r) => requestAnimationFrame(() => {
      g.imageSmoothingEnabled = false;
      g.drawImage(src, zx * src.width - w / 2, zy * src.height - h / 2, w, h,
        0, 0, box.width, box.height);
      r();
    }));
    document.body.appendChild(box);
  };

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

  await look();

  // ?probe=x,y names whatever is DRAWN at that point of the frame. A ray, not
  // a projection of object origins: a long or offset mesh appears nowhere near
  // where its origin lands, which is exactly the case whenever something
  // unexplained is standing in the shot. The page has an import map, so `three`
  // resolves here the same as it does in the game's own modules.
  let probe = '';
  const pq = new URLSearchParams(location.search).get('probe');
  if (pq) {
    const THREE = await import('three');
    const [px, py] = pq.split(',').map(Number);
    T.camera.updateMatrixWorld(true);
    const rc = new THREE.Raycaster();
    rc.setFromCamera(new THREE.Vector2(px * 2 - 1, 1 - py * 2), T.camera);
    const named = (o) => {
      for (const [uid, pc] of T.pieces.byUid) {
        for (let n = o; n; n = n.parent) if (n === pc.group) return `piece uid=${uid}`;
      }
      for (let n = o; n; n = n.parent) {
        if (n === T.board.group) return 'board';
        if (n === T.arena.ruins) return 'ruins';
      }
      return 'scene';
    };
    const hits = rc.intersectObjects(T.arena.scene.children, true).slice(0, 5).map((h) => {
      const o = h.object;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      const w = o.getWorldScale(new THREE.Vector3());
      return `${o.type}:${o.geometry?.type || ''}`
        + `${JSON.stringify(o.geometry?.parameters || {})} [${named(o)}]`
        + ` parent=${o.parent?.type}/${o.parent?.parent?.type}`
        + ` mat=${m?.type}/${m?.color?.getHexString?.()}/${m?.map?.image?.src?.slice(-24) || ''}`
        + ` wscale ${w.x.toFixed(2)},${w.y.toFixed(2)},${w.z.toFixed(2)}`
        + ` d=${h.distance.toFixed(1)}`;
    });
    probe = ` :: ${hits.join(' | ') || 'the ray hits nothing'}`;
  }

  // Anything left standing on its edge, named rather than squinted at: a card
  // is a flat plate and its tilt is zero unless something has hold of it.
  const upright = [...T.pieces.byUid.values()].filter((p) =>
    Math.abs(p.tilt.rotation.x) + Math.abs(p.tilt.rotation.z)
    + Math.abs(p.card3d.rotation.x) > 0.15);

  return `winner=${T.state.winner} after ${T.state.turn} turns `
    + `(${guard} moves) — ${T.state.reason} — frozen at ${at.toFixed(2)}s`
    + ` — onEdge=${upright.length}${probe}`;
})()
