// A contact sheet of closing camera poses.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&side=0&win=1" \
//     --eval tools/endposes.js --out /tmp/poses.png --wait 6000 --settle 1200
//
// Framing was the thing the ending kept getting wrong and the thing a single
// screenshot was worst at settling: a subject can be present, lit and correct
// and still be a thumbnail behind the result panel. One pose per run at ninety
// seconds a run is too slow to tune a shot with, so this stages the ending
// once and then re-points the camera at each candidate in turn, tiling the
// renders into one picture with the panel's footprint drawn over each.
//
// It reuses tools/endshot.js to stage the board, so the two cannot drift.
// ?win / ?side / ?how mean what they mean there. ?t is fixed at the end of the
// timeline, because a pose is judged where it comes to rest.
const ready = async () => {
  for (let i = 0; i < 600; i++) {
    if (window.__table?.state) return window.__table;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('the table never came up');
};

(async () => {
  const T = await ready();
  const q = new URLSearchParams(location.search);
  if (!q.get('t')) {
    // endshot reads ?t off the URL; a pose is judged at rest, so pin it.
    history.replaceState(null, '', `${location.pathname}?${q}&t=3600`);
  }
  const staged = await fetch('/tools/endshot.js').then((r) => r.text());
  // eslint-disable-next-line no-eval
  await eval(staged);

  const V3 = Object.getPrototypeOf(T.camera.position).constructor;
  const s = Number(q.get('side') || 0) === 0 ? 1 : -1;

  // Each candidate is written for the player sitting at +Z and mirrored, which
  // is what game/js/victory.js does with the pose it ships.
  const POSES = (q.get('poses') ? JSON.parse(q.get('poses')) : [
    { n: 'A close head-on', p: [2.5, 4.5, 11.4], a: [-0.1, 1.35, 2.6] },
    { n: 'B pitched down', p: [2.5, 5.2, 11.4], a: [-0.1, -0.4, 3.4] },
    { n: 'C flank low', p: [9.5, 4.2, 8.6], a: [-1.2, 0.6, 0.6] },
    { n: 'D flank higher', p: [10.5, 6.4, 7.4], a: [-1.5, -0.6, 0.4] },
    { n: 'E over the wreck', p: [4.4, 3.4, 8.8], a: [-1.0, 0.3, -0.6] },
    { n: 'F far flank', p: [13.0, 5.6, 10.0], a: [-2.0, 0.0, 0.0] },
  ]);

  // The renderer is not on window.__table, so the picture has to be taken from
  // the page's own canvas — which means reading it inside the SAME frame the
  // main loop drew, before the drawing buffer is presented and cleared.
  const canvas = document.querySelector('canvas');
  const cam = T.camera;
  // The ending has ALREADY replaced camera.updateMatrixWorld with its own
  // pose, so wrapping whatever is on the instance just lets it overwrite the
  // candidate a moment later — the first run of this produced six identical
  // tiles. Go past it to the prototype method, which is the real one.
  const real = Object.getPrototypeOf(cam).updateMatrixWorld;
  let want = null;
  cam.updateMatrixWorld = () => {
    if (want) {
      cam.position.set(want.p[0] * s, want.p[1], want.p[2] * s);
      cam.lookAt(want.a[0] * s, want.a[1], want.a[2] * s);
    }
    real.call(cam, true);
  };

  const shots = [];
  for (const pose of POSES) {
    want = pose;
    // two frames: one to draw with the new pose, one to be sure it landed
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    // eslint-disable-next-line no-await-in-loop
    const url = await new Promise((r) => requestAnimationFrame(() => r(canvas.toDataURL('image/png'))));
    shots.push({ pose, url });
  }

  const COLS = 3, CW = 1280 / COLS, CH = CW * (canvas.height / canvas.width);
  const sheet = document.createElement('div');
  sheet.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#000;'
    + 'display:grid;grid-template-columns:repeat(3,1fr);align-items:start;'
    + 'font:11px monospace;color:#d8b163';
  sheet.innerHTML = shots.map(({ pose, url }) => `
    <div style="position:relative">
      <img src="${url}" style="display:block;width:100%">
      <!-- the result panel's footprint: everything below this line is covered -->
      <div style="position:absolute;left:0;right:0;bottom:0;height:45%;
                  background:rgba(180,40,40,.30);border-top:1px solid #f55"></div>
      <div style="position:absolute;left:4px;top:3px;text-shadow:0 0 4px #000">${pose.n}</div>
    </div>`).join('');
  document.body.appendChild(sheet);

  const where = (v) => {
    const pv = v.clone().project(cam);
    return `${((pv.x + 1) / 2).toFixed(2)},${((1 - pv.y) / 2).toFixed(2)}`;
  };
  // Where the board and the fallen Stronghold land in each candidate, in
  // fractions of the frame from the top left. The panel covers everything
  // below y=0.55, so a subject has to come back between about 0.08 and 0.44.
  const wreck = T.board.strongholds[Number(q.get('win') || 0) === 0 ? 1 : 0]
    .group.getWorldPosition(new V3());
  const lines = POSES.map((pose) => {
    want = pose;
    cam.updateMatrixWorld();
    return `${pose.n}: board ${where(new V3(0, 0, 0))} wreck ${where(wreck)}`;
  });
  return `${CW | 0}x${CH | 0} tiles — ${lines.join(' | ')}`;
})()
