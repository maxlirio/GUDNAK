// Does the arena come BACK?
//
//   node tools/shot.js --url "game/?quick=1&seed=5&side=0&win=0&t=4200" \
//     --eval tools/endrestore.js --out /tmp/restore.png --wait 9000 --settle 1200
//
// ?t IS NOT OPTIONAL, and leaving it off is why this file passed for so long
// while proving almost nothing. It is handed straight to tools/endshot.js,
// which hand-steps the animator to it; without one the ending is measured at
// t=0 and the only things it has done are the four its constructor does. The
// list of what moved came back as [sunShadow children hidden camPatched] — no
// sun, no fog, no fallen Stronghold, no sooted plinth, no claimed cards — and
// every one of those is a thing that has to be handed back. At t=4200 the
// whole timeline has run and fourteen properties are checked instead of four.
//
// The ending takes the arena apart: it drains the sun, recolours the fog and
// the sky, hides every ruin standing between the lens and the board, claims
// every card away from pieces.js, tips a Stronghold over and replaces the
// camera's own updateMatrixWorld. All of that has to be handed back, or the
// next game starts at dusk behind a hijacked camera with holes in the scenery
// — and that bug would appear one game LATE, which is the hardest kind to
// trace back to here.
//
// So: measure the arena, end the game, press "Back to the lobby", and measure
// it again. Numbers, not a picture: "the lobby looks fine" is not the claim.
const ready = async () => {
  for (let i = 0; i < 600; i++) {
    if (window.__table?.state) return window.__table;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('the table never came up');
};

(async () => {
  const T = await ready();
  const sc = T.arena.scene;
  const hemi = sc.children.find((o) => o.isHemisphereLight);
  const amb = sc.children.find((o) => o.isAmbientLight);
  const sky = sc.children.find((o) => o.isMesh && o.material?.side === 1);

  const take = () => ({
    sun: T.arena.sun.intensity,
    sunShadow: T.arena.sun.castShadow,
    sunColour: T.arena.sun.color.getHexString(),
    hemi: hemi.intensity,
    hemiColour: hemi.color.getHexString(),
    amb: amb.intensity,
    fog: sc.fog.density,
    fogColour: sc.fog.color.getHexString(),
    sky: sky ? sky.material.color.getHexString() : '-',
    children: sc.children.length,
    // Everything in the scene that is switched off. #clearSightline hides
    // whatever stands in the closing shot's way, and the ruin ring is one
    // group of forty-odd, so this counts the whole tree rather than the top.
    hidden: (() => { let n = 0; sc.traverse((o) => { if (!o.visible) n++; }); return n; })(),
    strongholds: T.board.strongholds
      .map((s) => `${s.group.position.y.toFixed(2)}/${s.group.rotation.z.toFixed(2)}`).join(' '),
    // The plinth is the first thing board.js's Stronghold constructor adds,
    // and its colour is set ONCE there — unlike the band, which is rewritten
    // from the deck count every frame and heals itself whatever anyone does
    // to it. The ending dirties the whole fallen group down to soot, so this
    // is the one material that would carry a burnt Stronghold into the next
    // game if it were not handed back.
    plinths: T.board.strongholds
      .map((s) => s.group.children[0].material.color.getHexString()).join(' '),
    // An own property here means somebody's override is still installed. The
    // seat camera's own pose comes off the prototype.
    camPatched: Object.prototype.hasOwnProperty.call(T.camera, 'updateMatrixWorld'),
  });

  const before = take();
  // Held as identities, not as counts, so the difference can be named later.
  const firstChildren = new Set(sc.children);
  const firstHidden = new Set();
  sc.traverse((o) => { if (!o.visible) firstHidden.add(o); });

  // endshot.js pins the animator by stepping it with ZERO seconds, which is
  // the only way to freeze a frame in a headless browser — and a frozen clock
  // never expires anything. The ring and the burst thrown at the falling
  // Stronghold stayed alive forever and this file reported them as two scene
  // children the ending had failed to clean up, which is a leak that does not
  // exist. Put the real clock back before leaving and give it time to sweep.
  const realUpdate = T.anim.update.bind(T.anim);
  const staged = await fetch('/tools/endshot.js').then((r) => r.text());
  // eslint-disable-next-line no-eval
  await eval(staged);
  const during = take();

  // The button the player actually presses — not clearEnding() called directly,
  // because the path that matters is the one wired to the DOM.
  document.querySelector('.end-leave').click();
  T.anim.update = realUpdate;
  // ...and then waited on by CONDITION, not by wall clock. The frame loop caps
  // dt at 0.05s, so at the eight frames a second SwiftShader manages, two and
  // a half real seconds are under half a second of animation — the 1.3s burst
  // thrown at the falling Stronghold was still perfectly alive and this file
  // reported it as a scene child the ending had leaked. Let the effects list
  // actually empty.
  for (let i = 0; i < 300 && T.anim.fx.length; i++) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => requestAnimationFrame(r));
  }
  const after = take();

  const diff = Object.keys(before).filter((k) => String(before[k]) !== String(after[k]))
    .map((k) => `${k}: ${before[k]} -> ${after[k]}`);
  const changed = Object.keys(before).filter((k) => String(before[k]) !== String(during[k]));

  // A COUNT that has not come back to where it started says only that
  // something is wrong, and the whole point of this file is to find what. Name
  // the extra scene children and the objects left switched off, so a leak from
  // the ending can be told apart from one the harness's own staged board left.
  const kindOf = (o) => `${o.type}${o.isLight ? '(light)' : ''}`
    + `${o.geometry?.type ? `:${o.geometry.type}` : ''}`
    // The particle systems are all Points:BufferGeometry and there are four
    // kinds of them in an ending — motes, dust, burst, ring — so the type
    // alone named nothing. The vertex count and the blend mode tell them
    // apart: the ending's dust is 90 points and normally blended, a burst is
    // additive and counted in dozens.
    + `${o.geometry?.attributes?.position ? `[n=${o.geometry.attributes.position.count}` : ''}`
    + `${o.material && !Array.isArray(o.material)
      ? ` ${o.material.type} blend=${o.material.blending} size=${o.material.size ?? '-'}`
        + ` vis=${o.visible} par=${o.parent?.type}]` : ''}`;
  const extra = [...sc.children].filter((o) => !firstChildren.has(o)).map(kindOf);
  // Whose object it is, not just what shape it is. The two boxes that always
  // come back switched off are the Stronghold deck stacks: leaveGame() calls
  // board.setDecks([0, 0]) on its way out and board.js hides an empty deck.
  // That is correct, and it is nothing to do with the ending — but unnamed it
  // looked exactly like #clearSightline having failed to put the scenery back.
  const owner = (o) => {
    for (let n = o; n; n = n.parent) {
      for (let i = 0; i < T.board.strongholds.length; i++) {
        if (n === T.board.strongholds[i].group) return ` <stronghold ${i}>`;
      }
      if (n === T.board.group) return ' <board>';
      if (n === T.arena.ruins) return ' <ruins>';
    }
    return '';
  };
  const stillOff = [];
  sc.traverse((o) => {
    if (!o.visible && !firstHidden.has(o)) stillOff.push(kindOf(o) + owner(o));
  });

  return `the ending moved [${changed.join(' ')}]\n`
    + `  still wrong after leaving: ${diff.length ? diff.join(' | ') : 'NOTHING — clean'}\n`
    + `  extra children: ${extra.join(', ') || 'none'}\n`
    + `  left switched off: ${stillOff.join(', ') || 'none'}\n`
    + `  overlay gone=${!document.querySelector('.ending')}`
    + ` hudClass=${document.getElementById('hud').className || '(none)'}`;
})()
