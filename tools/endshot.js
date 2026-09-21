// Preview harness for the END OF THE GAME.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&side=0&win=0&t=2600" \
//     --eval tools/endshot.js --out /tmp/win.png --wait 4000 --settle 900
//
// ?win  is who wins: 0, 1, or "draw"/"stalemate".
// ?side is the seat you are sitting in, so the same finish can be looked at
//       from the winner's chair and the loser's.
// ?how  picks the reason the engine would have given.
// ?t    is MILLISECONDS INTO THE ENDING. --settle is WALL CLOCK and headless
//       renders animation time at a fraction of it, so the animator is taken
//       off the frame clock here, stepped by hand to ?t and pinned there. The
//       HTML overlay animates on wall clock, so --settle still has to be long
//       enough (~900ms) for its fades to have run.
//
// It stages the board a real finish leaves behind — the winner's fighters
// still standing on the field, one of the loser's left, both discard piles
// deep, the loser's Stronghold drawn dry — because that is the material the
// ending is made of.

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
  const T = await ready(), st = T.state;
  const q = new URLSearchParams(location.search);
  const raw = q.get('win') ?? '0';
  const winner = raw === 'draw' || raw === 'stalemate' ? raw : Number(raw);
  const W = winner === 1 ? 1 : 0;          // for staging a draw, treat P0 as "north"
  const L = 1 - W;

  const put = (sq, def, own, fatigued = false) => {
    const u = ++st.nextUid;
    st.board[sq] = [{ uid: u, def, owner: own, fatigued, attachments: [] }];
    return u;
  };
  const dead = (def, own) => ({ uid: ++st.nextUid, def, owner: own, attachments: [] });

  st.board = Array.from({ length: 12 }, () => []);
  const wCards = ['A024', 'A014', 'A002', 'A020'];   // Auroxi, deck 0
  const lCards = ['C021', 'C011', 'C017', 'C024'];   // Refractory, deck 1

  // The winner is standing on the loser's half of the field: that is how the
  // game is actually won, and it is what the closing camera has to look at.
  const wSq = W === 0 ? [7, 4, 3, 6] : [1, 4, 5, 2];
  const lSq = W === 0 ? [8] : [0];
  wSq.forEach((sq, i) => put(sq, (W === 0 ? wCards : lCards)[i], W));
  lSq.forEach((sq, i) => put(sq, (W === 0 ? lCards : wCards)[i], L, true));

  const gy = [
    ['A005', 'A003', 'A010', 'M170', 'A029'],
    ['C014', 'C019', 'C022', 'C012', 'C017', 'C021', 'C011'],
  ];
  for (let p = 0; p < 2; p++) {
    st.players[p].graveyard = gy[p].map((d) => dead(d, p));
    st.players[p].hand = st.players[p].hand.slice(0, p === L ? 1 : 3);
  }
  st.players[L].deck = [];                 // drawn dry, which is how you lose
  st.players[W].deck = st.players[W].deck.slice(0, 5);
  st.turn = 23;
  st.active = W;
  delete st.pending; st.queue = [];

  const how = q.get('how') || 'avatar';
  st.winner = winner;
  st.reason = winner === 'stalemate' ? 'position repeated four times'
    : winner === 'draw' ? 'both Strongholds empty and no fighter destroyed for ten turns'
    : how === 'siege' ? `P${L} sieged with an empty Stronghold`
    : how === 'rise' ? `P${L}'s Stronghold had nowhere to rise`
    : `P${L}'s Avatar was destroyed`;

  T.resync();                              // this is what fires the ending

  const at = Number(q.get('t') || 0) / 1000;
  const real = T.anim.update.bind(T.anim);
  T.anim.update = () => {};                // off the frame clock
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

  // CSS animations tick on FRAMES too, and SwiftShader draws a couple a
  // second — the overlay's fades were still half-done after a second of
  // settle, which looks like a transparency bug and is not one. Run them out.
  for (const a of document.getAnimations()) a.finish();

  // ?panel=0 takes the result overlay away, which is the only way to see the
  // 45% of the table it sits on. ?zoom=x,y blows up a quarter-frame box around
  // that point — a wide shot of a dark arena hides everything, and the one
  // object a defeat is about ends up forty pixels tall under the veil.
  if (q.get('panel') === '0') document.getElementById('hud').style.display = 'none';
  // ?fold=1 presses "Stay and look at the field", which is the one control on
  // this screen with a state of its own — and pressing it through .click()
  // also proves the button is reachable at all, which a picture of it cannot.
  // ?fold=2 presses it and then presses "Show the result" again, which is the
  // way back and the only state the CSS reaches by REMOVING a class.
  if (q.get('fold')) {
    document.querySelector('.end-stay').click();
    if (q.get('fold') === '2') {
      await new Promise((r) => setTimeout(r, 700));
      document.querySelector('.end-tab').click();
    }
    // Unfolding RESTARTS the panel's rise — .folded sets animation:none, so
    // taking the class off gives it a fresh one with a 0.35s delay in front of
    // it. Those are frame-driven and SwiftShader draws a couple a second, so
    // the first shot of this path caught a panel a third of the way through
    // fading back in and it looked like a transparency fault. The finish above
    // ran before the click and could not have covered it.
    await new Promise((r) => setTimeout(r, 120));
    for (const a of document.getAnimations()) a.finish();
  }
  const zoom = q.get('zoom');
  if (zoom) {
    const [zx, zy] = zoom.split(',').map(Number);
    const src = document.querySelector('canvas');
    const box = document.createElement('canvas');
    box.width = src.width; box.height = src.height;
    box.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:9999';
    const w = src.width / 4, h = src.height / 4;
    const g = box.getContext('2d');
    // The crop is a still, taken now and then shown for the rest of the run,
    // so it has to be taken LATE. Grabbed immediately it caught the frame
    // before the staged board's card art had come back off the wire and every
    // fighter was a blank brown slab — which looks exactly like a broken
    // material and is not one. --settle covers the overlay's own fades; this
    // covers the textures underneath it.
    await new Promise((r) => setTimeout(r, 1500));
    await new Promise((r) => requestAnimationFrame(() => {
      g.imageSmoothingEnabled = false;
      g.drawImage(src, zx * src.width - w / 2, zy * src.height - h / 2, w, h,
        0, 0, box.width, box.height);
      r();
    }));
    document.body.appendChild(box);
  }

  // Reported, not guessed: which fires are out and how far the Stronghold has
  // gone down are the two things a screenshot of a dark field cannot settle.
  const V3 = Object.getPrototypeOf(T.camera.position).constructor;
  const fires = T.arena.torches.map((x) => {
    const v = new V3();
    x.light.getWorldPosition(v);
    // The sprite is reported next to the light because they are set
    // separately and only the sprite is visible as FIRE — a brazier can be
    // lighting the board hard with nothing burning on top of it.
    return `${v.z > 0 ? 'P0' : 'P1'}:${x.light.intensity.toFixed(1)}`
      + `/${x.flame.scale.x.toFixed(2)}${x.flame.visible ? '' : ' HIDDEN'}`;
  }).join(' ');
  const sh = T.board.strongholds.map((x) => x.group.position.y.toFixed(2)).join('/');

  // WHERE things land in the frame. Composition was the thing these shots kept
  // getting wrong and the thing they were worst at proving: a subject can be
  // present, correctly lit, and still be a thumbnail behind the panel. The
  // bottom ~45% of the frame is the result panel, so anything that matters has
  // to come back with y between about 0.08 and 0.44.
  //
  // x,y are fractions of the frame from the top left; "off" means behind the
  // camera or outside it.
  T.camera.updateMatrixWorld(true);
  const where = (v) => {
    const p = v.clone().project(T.camera);
    const x = (p.x + 1) / 2, y = (1 - p.y) / 2;
    return p.z > 1 || x < 0 || x > 1 || y < 0 || y > 1
      ? 'off' : `${x.toFixed(2)},${y.toFixed(2)}`;
  };
  const centroid = (pts) => {
    const c = new V3();
    for (const p of pts) c.add(p);
    return pts.length ? c.divideScalar(pts.length) : c;
  };
  const live = [...T.pieces.byUid.values()];
  const mine = centroid(live.filter((p) => p.owner === W).map((p) => p.group.position));
  const theirs = centroid(live.filter((p) => p.owner === L).map((p) => p.group.position));
  const wreck = T.board.strongholds[L].group.getWorldPosition(new V3());
  const intact = T.board.strongholds[W].group.getWorldPosition(new V3());
  const frame = `winnerLine=${where(mine)} loserLine=${where(theirs)} `
    + `fallenSH=${where(wreck)} standingSH=${where(intact)} board=${where(new V3(0, 0, 0))}`;

  return `winner=${raw} seat=${q.get('side') ?? 0} t=${at.toFixed(2)}s `
    + `fires[${fires}] strongholdY=${sh}\n  ${frame}`;
})()
