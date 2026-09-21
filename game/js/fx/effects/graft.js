// GRAFT — crystal veins link your fighters and share what they are.
//
// Shared by 3 cards: A058 Shared Knowledge, A059 Inspiration, A053 Spirit of
// Alliance. All three do the same thing in the rules: something one of your
// fighters IS spreads to the others. So this is the one motif in the set that
// is about a GROUP, and the whole file is built so that the group is the thing
// you see — not the caster.
//
// Two beats, in this order and no other:
//   1. GROW   — crystal creeps out of the source across the flagstones and
//               reaches every friendly fighter, then climbs onto each card and
//               sets. Spokes first, then short chords ally-to-ally, so what is
//               left standing is a NETWORK and not a star.
//   2. SHARE  — light runs along the finished veins: out from the source, round
//               the ring, and back in again. Every linked card keeps a pink
//               border until the motif ends, which is the payoff — five cards
//               lit as one thing.
//
// The palette is shardfire's, deliberately: same crimson-magenta, same
// octahedral splinter, same dark body under a modest emissive so the facets
// take the brazier light. The SHAPE is the opposite — shardfire is a violent
// bloom on one square, this is slow, level and connective, and nothing here
// is thrown.
//
// Preview — &t is milliseconds into the motif, and --settle must stay SHORT
// (the table's own opening keeps running in wall clock and at 1400ms it deals
// cards over the board the harness set up):
//   node tools/shot.js --url "game/?quick=1&seed=5&t=900" \
//     --eval tools/fxdemo/graft.js --out /tmp/g.png --wait 4000 --settle 600
// &fxzoom looks closely, &fxlone=1 checks the no-allies version and
// &fxref=square|none checks the two references a tactic can hand this.

import { THREE, CARD_W, CARD_H } from '../kit.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (x) => x * x * (3 - 2 * x);

/* ------------------------------------------------------------ textures */

// Cached for the life of the page: kit.hold() disposes materials and a
// material never disposes its map, so building these per cast would leak.
const TEXES = new Map();
function tex(key, paint, size = 128) {
  let t = TEXES.get(key);
  if (!t) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    paint(c.getContext('2d'), size);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    TEXES.set(key, t);
  }
  return t;
}

/** The head of a pulse: a hard white dot in a soft halo. */
const beadTex = () => tex('graft-bead', (g, S) => {
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.47);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.13, 'rgba(255,255,255,0.8)');
  grd.addColorStop(0.32, 'rgba(255,255,255,0.2)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
});

/**
 * The border that marks a card as part of the network.
 *
 * A filled patch was tried first and it simply washed the card art out — at 60
 * screen pixels a card is almost all art, and a pink pane over it reads as the
 * card being selected by the UI, not grafted. A BORDER leaves the art alone and
 * still says, unmistakably, "this one and that one and that one".
 *
 * Four passes from wide-and-faint to thin-and-bright: one stroke of one width
 * is a rectangle, several stacked are a glow with an edge inside it.
 */
const frameTex = () => tex('graft-frame', (g, S) => {
  g.lineJoin = 'round';
  const pass = [[0.075, 0.105, 0.10], [0.095, 0.060, 0.22], [0.112, 0.028, 0.55],
    [0.124, 0.010, 1], [0.124, 0.004, 1]];
  for (const [inset, w, a] of pass) {
    g.filter = `blur(${S * w * 0.34}px)`;
    g.strokeStyle = `rgba(255,255,255,${a})`;
    g.lineWidth = S * w;
    g.beginPath();
    g.roundRect(S * inset, S * inset, S * (1 - inset * 2), S * (1 - inset * 2), S * 0.075);
    g.stroke();
  }
}, 256);

/* ------------------------------------------------------------- heights */

// Measured, not guessed. The flagstone face is at 0.080 and a depth-0 card
// sits at 0.203 with its face near 0.21. A vein drawn flat at stone height
// vanishes the moment it crosses a card — it loses the depth test and paints
// only on the stone AROUND it, which is how the first cut of this looked like
// veins that stopped dead at every card edge.
//
// So the vein has a HEIGHT PROFILE: it lies low over open stone and climbs to
// clear the card face over the last unit before each end. The climb happens in
// the bare gap between squares (centres are 2.62 apart, a card is 1.74 wide,
// so there is 0.88 of stone to do it in), which is also what makes it read as
// crystal creeping UP onto the card rather than a decal laid over everything.
const STONE_Y = 0.088;        // the glow painted on the flagstone
const OPEN_Y = 0.150;         // the crystal chain's axis over open stone
const CARD_Y = 0.285;         // its axis over a card, clear of the face

/* -------------------------------------------------------------- colour */

// shardfire's crimson-magenta. Green is held very low on purpose: the renderer
// tone-maps with ACES, so additive pink whose green sits high sums past 1.0
// where two veins cross and the crossing goes white — which killed the colour
// in the version before this one. At 0.10 it clips to hot pink instead.
const PINK = 0xff2f68;
const BODY = 0x86123a;
const HOT = { r: 1.0, g: 0.07, b: 0.24 };

/* ---------------------------------------------------------------- path */

/**
 * The line a vein takes between two points.
 *
 * Crystal grows in straight runs that kink; it does not curve. So the path is
 * a coarse control polyline with alternating sideways offsets, sampled with
 * HARD corners kept — an earlier smoothed version read as a cable or a hose,
 * which is exactly the wrong material.
 */
function veinPath(a, b, wob) {
  const dir = b.clone().sub(a);
  dir.y = 0;
  const L = dir.length() || 0.001;
  const t = dir.clone().divideScalar(L);
  const side = new THREE.Vector3(-t.z, 0, t.x);

  // A joint every ~0.30. Each crystal spans TWO of them, so the blades are
  // 0.6 long and overlap their neighbours by half — the aspect is what makes an
  // octahedron read as a splinter, and the overlap is what stops the splinters
  // reading as one extruded tube. Two earlier versions got this wrong in
  // opposite directions: a fixed 13 joints made every crystal 0.20 long and
  // 0.15 wide (a bead: the vein was a caterpillar), and end-to-end links at
  // 0.42 welded into a smooth stroke (a ribbon: the vein was pink lightning).
  const nodes = Math.max(6, Math.min(20, Math.round(L / 0.30)));
  const K = Math.max(3, Math.min(6, Math.round(L / 1.2)));
  const ctrl = [a.clone().setY(0)];
  for (let i = 1; i < K; i++) {
    const u = i / K + rnd(-0.05, 0.05);
    // the bulge is widest in the middle and zero at the ends, or the vein
    // leaves the card sideways and misses the one it is aiming at
    const off = (i % 2 ? 1 : -1) * rnd(0.08, 0.26) * wob * Math.sin(Math.PI * u);
    ctrl.push(a.clone().setY(0).addScaledVector(t, L * u).addScaledVector(side, off));
  }
  ctrl.push(b.clone().setY(0));

  // resample by arclength so the crystals along it come out roughly equal
  const seg = [];
  let total = 0;
  for (let i = 1; i < ctrl.length; i++) {
    const d = ctrl[i].distanceTo(ctrl[i - 1]);
    seg.push(d);
    total += d;
  }
  const pts = [];
  for (let n = 0; n <= nodes; n++) {
    let want = (n / nodes) * total;
    let i = 0;
    while (i < seg.length - 1 && want > seg[i]) { want -= seg[i]; i++; }
    const p = ctrl[i].clone().lerp(ctrl[i + 1], seg[i] ? clamp01(want / seg[i]) : 0);
    // ZIGZAG, alternating side to side, not random jitter. Crystal grows in
    // straight runs that turn; random wander gives a wobbly line, which from
    // above is indistinguishable from a cable. The turn has to be a real angle
    // or the overlapping blades all point the same way and weld shut again.
    if (n > 0 && n < nodes) {
      const z = (n % 2 ? 1 : -1) * rnd(0.03, 0.075);
      p.x += side.x * z + rnd(-0.02, 0.02);
      p.z += side.z * z + rnd(-0.02, 0.02);
    }
    const da = Math.hypot(p.x - a.x, p.z - a.z);
    const db = Math.hypot(p.x - b.x, p.z - b.z);
    const k = smooth(1 - clamp01((Math.min(da, db) - 1.0) / 0.62));
    p.y = OPEN_Y + (CARD_Y - OPEN_Y) * k;
    pts.push(p);
  }
  return pts;
}

/* --------------------------------------------------------------- graft */

export function graft(kit, at) {
  const src = kit.at(at);
  if (!src) return;

  // Who is in the network. `at` is usually a uid but the caller is allowed to
  // hand us a bare square, so both are resolved before anything is built — and
  // if neither finds a piece we never learn whose side this is and fall through
  // to the small version rather than linking the enemy by accident.
  let srcPiece = kit.piece(at);
  if (!srcPiece && typeof at === 'number') srcPiece = kit.pieces?.topAt?.(at) || null;
  const all = kit.pieces?.byUid ? [...kit.pieces.byUid.values()] : [];

  let ends = [];
  if (srcPiece && srcPiece.owner != null) {
    ends = all
      .filter((p) => p !== srcPiece && p.owner === srcPiece.owner && p.depth === 0
        && p.square >= 0 && p.square <= 8 && p.square !== srcPiece.square && p.group)
      .map((p) => ({ pos: p.group.position.clone(), card: true }))
      .sort((x, y) => x.pos.distanceToSquared(src) - y.pos.distanceToSquared(src))
      // four is the legible limit. Six spokes out of the middle square is a
      // snowflake, and the eye stops counting cards and starts seeing a shape.
      .slice(0, 4);
  }

  // Nothing to link to — a lone fighter, or a tactic resolved on an empty
  // board. It still has to look like something, so the crystal creeps a short
  // way out and finds nothing. Smaller, not broken.
  const lone = ends.length === 0;
  if (lone) {
    const ph = Math.random() * Math.PI * 2;
    for (let i = 0; i < 4; i++) {
      const a = ph + (i / 4) * Math.PI * 2 + rnd(-0.25, 0.25);
      ends.push({
        pos: src.clone().add(new THREE.Vector3(Math.cos(a) * 1.5, 0, Math.sin(a) * 1.5)),
        card: false,
      });
    }
  }

  const veins = [];
  const vein = (a, b, wob, o) => {
    const pts = veinPath(a, b, wob);
    const v = Object.assign({ pts, nodes: pts.length - 1, pulses: [] }, o);
    v.set = v.t0 + v.dur;                          // when it stops growing
    veins.push(v);
  };

  // --- spokes. Staggered by 55ms: released together, four veins arrive as one
  // event and the network appears rather than grows.
  ends.forEach((e, i) => {
    vein(src, e.pos, lone ? 0.7 : 1, { t0: 0.12 + i * 0.055, dur: 0.42, w: 1 });
  });

  // --- chords. Each ally to its NEAREST other ally, deduplicated, and only
  // when they are close enough that the link does not cut clean across the
  // board. This is the part that turns a star into a network: with it you read
  // "these fighters are joined to each other", without it you read "the caster
  // is pointing at them". They are thinner and later than the spokes so they
  // stay the second thing you see.
  if (!lone && ends.length >= 2) {
    const seen = new Set();
    for (let i = 0; i < ends.length; i++) {
      let best = -1, bd = 1e9;
      for (let j = 0; j < ends.length; j++) {
        if (i === j) continue;
        const d = ends[i].pos.distanceTo(ends[j].pos);
        if (d < bd) { bd = d; best = j; }
      }
      const key = Math.min(i, best) + ':' + Math.max(i, best);
      if (best < 0 || bd > 4.3 || seen.has(key)) continue;
      seen.add(key);
      vein(ends[i].pos, ends[best].pos, 1.15,
        { t0: 0.60 + seen.size * 0.06, dur: 0.36, w: 0.72 });
    }
  }

  const SPOKES = ends.length;
  // SHARE. Out along the spokes, round the ring, then back in — three passes,
  // because one pass out from the caster is a targeting line and says nothing
  // about sharing. The return pass is what makes it mutual.
  for (let i = 0; i < veins.length; i++) {
    const v = veins[i];
    if (i < SPOKES) {
      v.pulses.push({ t0: 0.82 + i * 0.03, dur: 0.34, dir: 1, amp: 1.9 });
      v.pulses.push({ t0: 1.34 + i * 0.03, dur: 0.36, dir: -1, amp: 1.5 });
    } else {
      v.pulses.push({ t0: 1.06 + (i - SPOKES) * 0.05, dur: 0.32, dir: 1, amp: 1.7 });
    }
  }

  const group = new THREE.Group();
  const SPAN = 2.5;
  const FADE = 2.02;                              // everything cools from here

  /* --- the crystal itself.
     A vein is a CHAIN of elongated octahedra, each spanning two joints of the
     path so it overlaps its neighbour by half. A swept ribbon was tried first
     and it read as cloth or hose — eight flat facets under flatShading give a
     lit side and a dark side, and that is the only thing that says crystal at
     this size. The chain can also GROW, each blade extending out of the last;
     a swept strip cannot, without the whole length rippling.

     Spurs are short blades rooted on the joints and angled up and out. Without
     them the chain is a tube: the spurs are what give the vein a ragged profile
     against the stone and say it is growing rather than being drawn. They are
     kept SHORT — at link length they turned the vein into a row of leaves. */
  const items = [];
  veins.forEach((v, vi) => {
    for (let n = 0; n < v.nodes; n++) {
      items.push({
        v: vi, n, spur: 0,
        born: v.t0 + v.dur * (n / v.nodes),
        grow: (v.dur / v.nodes) * 1.7,
        w: rnd(0.075, 0.115) * v.w * (1 - 0.38 * (n / v.nodes)),
        // each blade is aimed a few degrees off its own run of the path, so
        // overlapping neighbours cross instead of lying flush. Aligned exactly
        // they weld into one smooth stroke and the vein stops having a grain.
        skew: rnd(-0.13, 0.13), skew2: rnd(-0.09, 0.09),
        glow: rnd(0.74, 1.3),
        roll: rnd(0, Math.PI), over: rnd(1.06, 1.2),
      });
      // every third joint, and never the ones on the cards themselves, where a
      // spur would just stand up in the middle of the art
      if (n % 3 === 1 && n > 1 && n < v.nodes - 2) {
        for (let k = 0; k < (Math.random() < 0.4 ? 2 : 1); k++) {
          items.push({
            v: vi, n, spur: 1,
            born: v.t0 + v.dur * (n / v.nodes) + 0.03,
            grow: 0.13,
            w: rnd(0.038, 0.062) * v.w, len: rnd(0.12, 0.27) * v.w,
            lean: (Math.random() < 0.5 ? -1 : 1) * rnd(0.5, 1.25),
            rise: rnd(0.35, 1.0), glow: rnd(0.7, 1.25),
            roll: rnd(0, Math.PI), over: rnd(1.1, 1.3),
          });
        }
      }
    }
  });

  /* --- the graft points. A rosette of blades standing on each card where the
     vein lands: the source's opens first, in the middle, because its veins
     leave in every direction; each ally's opens as its own vein arrives and is
     pushed off-centre TOWARD the source, so it sits where the vein lands
     rather than in the middle of the art. */
  // `kick` is when the sharing pulse LANDS here, which is when this card's
  // border flares. It is the only moment in the motif that says the thing
  // being shared actually arrived somewhere, so it is worth the bookkeeping.
  const nodesAt = [{ pos: src, card: !!srcPiece, t: 0.02, n: 5, s: 1, kick: 1.34 + 0.36 }];
  ends.forEach((e, i) => {
    nodesAt.push({
      pos: e.pos, card: e.card,
      t: 0.12 + i * 0.055 + 0.42 * 0.9, n: lone ? 3 : 5, s: lone ? 0.7 : 0.88,
      toward: src, kick: 0.82 + i * 0.03 + 0.34,
    });
  });
  nodesAt.forEach((nd, ni) => {
    const y = nd.card ? CARD_Y - 0.02 : 0.105;
    const aim = nd.toward ? nd.toward.clone().sub(nd.pos).setY(0).normalize() : null;
    for (let k = 0; k < nd.n; k++) {
      const a = (k / nd.n) * Math.PI * 2 + rnd(-0.4, 0.4) + ni;
      const r = rnd(0.13, 0.36) * nd.s;
      items.push({
        v: -1, born: nd.t + k * 0.012, grow: 0.17,
        w: rnd(0.065, 0.095) * nd.s, len: rnd(0.22, 0.44) * nd.s,
        glow: rnd(0.8, 1.3), roll: rnd(0, Math.PI), over: rnd(1.1, 1.28),
        px: nd.pos.x + Math.cos(a) * r + (aim ? aim.x * 0.26 : 0),
        py: y,
        pz: nd.pos.z + Math.sin(a) * r + (aim ? aim.z * 0.26 : 0),
        // leaning outward off the vertical, so the rosette has a silhouette;
        // upright blades all at one angle read as a fence post
        tilt: rnd(0.3, 0.72), az: a + rnd(-0.5, 0.5),
        node: ni,
      });
    }
  });

  const splinter = new THREE.OctahedronGeometry(0.5, 0);
  splinter.scale(0.30, 1, 0.22);
  const N = Math.max(1, items.length);

  const crystalMat = new THREE.MeshStandardMaterial({
    // metalness near zero: there is no environment map in this scene, so a
    // metallic surface has nothing to reflect and renders dead flat.
    color: BODY, emissive: PINK, emissiveIntensity: 0.42,
    roughness: 0.28, metalness: 0.05, flatShading: true, transparent: true,
  });
  const chain = new THREE.InstancedMesh(splinter, crystalMat, N);
  chain.frustumCulled = false;
  chain.castShadow = true;
  group.add(chain);

  // A larger purely additive copy of every crystal. The solid mesh gives the
  // facets; this gives the light coming off them, and it is also the thing the
  // pulse modulates — a bead of light travelling over a dark chain looks like
  // a bead travelling in FRONT of it, whereas brightening the chain itself is
  // what makes the light look like it is INSIDE the crystal.
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.25,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const halo = new THREE.InstancedMesh(splinter, haloMat, N);
  halo.frustumCulled = false;
  group.add(halo);

  const tint = new THREE.Color();
  for (let i = 0; i < N; i++) {
    tint.setRGB(rnd(0.8, 1.25), rnd(0.6, 1.05), rnd(0.75, 1.15));
    chain.setColorAt(i, tint);
  }
  if (chain.instanceColor) chain.instanceColor.needsUpdate = true;
  halo.setColorAt(0, tint.setRGB(1, 1, 1));       // allocate the attribute

  /* --- the glow on the stone. The crystal rides above the flagstone face so it
     never fights the cards for depth, and left alone that makes a vein look
     like it is floating across the board. A dim wide additive strip painted
     flat on the stone underneath grounds it — and being depth-tested it is
     hidden wherever a card covers it, so the crystal is on top of the cards and
     the glow is under them, which is the right way round. */
  const glows = veins.map((v) => {
    const s = kit.strip({ segments: v.nodes + 1, width: 0.20 * v.w + 0.06, colour: PINK });
    s.mesh.material.dispose();
    s.mat = new THREE.MeshBasicMaterial({
      color: PINK, transparent: true, opacity: 0, depthWrite: false,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    });
    s.mesh.material = s.mat;
    s.mesh.castShadow = false;
    group.add(s.mesh);
    s.pts = [];
    for (let i = 0; i <= v.nodes; i++) s.pts.push(new THREE.Vector3());
    return s;
  });

  /* --- the borders. The payoff: when the motif settles, every card in the
     network is wearing the same pink edge at the same time. This is the only
     part that is asked to be READ rather than admired, so it arrives late,
     holds steady, and does not flicker. */
  const frames = nodesAt.filter((nd) => nd.card).map((nd) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD_W + 0.34, CARD_H + 0.34),
      new THREE.MeshBasicMaterial({
        map: frameTex(), color: 0xff3f7a, transparent: true, opacity: 0,
        depthWrite: false, blending: THREE.AdditiveBlending,
      }),
    );
    m.rotation.x = -Math.PI / 2;
    // 0.062 above the card's own origin. The margin matters: a depth-0 card
    // sits at 0.203 and its face is near 0.21, and anything flatter than that
    // loses the depth test and paints only on the stone AROUND the card — a
    // border that frames everything except the card it belongs to.
    m.position.set(nd.pos.x, CARD_Y - 0.02, nd.pos.z);
    group.add(m);
    return { m, t: nd.t + 0.12, kick: nd.kick };
  });

  /* --- the bead. One sprite per vein for the head of whatever pulse is running
     on it; depth test off, because a sprite is depth-tested at the depth of its
     centre and the bead has to be visible where it crosses a card. */
  const beads = veins.map(() => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: beadTex(), color: 0xff2f68, transparent: true, depthWrite: false,
      depthTest: false, blending: THREE.AdditiveBlending, opacity: 0,
    }));
    s.scale.setScalar(0.01);
    group.add(s);
    return s;
  });

  /* ------------------------------------------------------------- frame */

  const mat4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const roll = new THREE.Quaternion();
  const axis = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const a3 = new THREE.Vector3();
  const b3 = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  const hide = new THREE.Vector3(0, -99, 0);
  const NOPULSE = { pulses: [] };                 // hoisted: the tick allocates nothing

  /** How bright the light inside vein `v` is, at `u` along it, at time `s`. */
  const pulseAt = (v, u, s) => {
    let g = 0;
    for (const p of v.pulses) {
      const e = (s - p.t0) / p.dur;
      if (e <= 0 || e >= 1.3) continue;
      const head = p.dir > 0 ? e : 1 - e;
      const d = (u - head) * p.dir;
      // sharp in front of the head, long tail behind it — a symmetric blob
      // travels like a bubble in a pipe, and the tail is what makes it look
      // like something arrived from somewhere.
      const k = d > 0 ? Math.exp(-((d / 0.05) ** 2)) : Math.exp(-((-d / 0.24) ** 1.4));
      g += p.amp * k * Math.min(1, (1.3 - e) / 0.3);
    }
    return g;
  };

  /** A point along a vein, by fraction of its length. */
  const along = (v, u, out) => {
    const f = clamp01(u) * v.nodes;
    const i = Math.min(v.nodes - 1, Math.floor(f));
    return out.copy(v.pts[i]).lerp(v.pts[i + 1], f - i);
  };

  kit.hold(group, SPAN, (t) => {
    const s = t * SPAN;
    const cool = s > FADE ? Math.max(0, 1 - (s - FADE) / (SPAN - FADE)) : 1;

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const u = clamp01((s - it.born) / it.grow);
      if (u <= 0) {
        mat4.compose(hide, q.identity(), scl.setScalar(0));
        chain.setMatrixAt(i, mat4);
        halo.setMatrixAt(i, mat4);
        continue;
      }
      // a small overshoot on the way in: crystal SNAPS into place, it does not
      // inflate, and without the overshoot the growth had no crispness to it
      const k = u < 1 ? (u < 0.7 ? (u / 0.7) * it.over : it.over + (1 - it.over) * ((u - 0.7) / 0.3)) : 1;
      let pu = 0;

      if (it.v < 0) {                              // a rosette blade
        axis.set(Math.cos(it.az) * Math.sin(it.tilt), Math.cos(it.tilt),
          Math.sin(it.az) * Math.sin(it.tilt)).normalize();
        pos.set(it.px, it.py, it.pz).addScaledVector(axis, it.len * k * 0.5);
        scl.set(it.w / 0.3, it.len * k, it.w / 0.22);
        // a rosette lights with the end of the vein it belongs to: the
        // source's with the start of the first spoke, an ally's with the
        // arrival at its own
        pu = it.node === 0 ? pulseAt(veins[0] || NOPULSE, 0.02, s)
          : pulseAt(veins[it.node - 1] || NOPULSE, 0.98, s);
      } else {
        const v = veins[it.v];
        a3.copy(v.pts[it.n]);
        b3.copy(v.pts[Math.min(v.nodes, it.n + 2)]);
        if (it.spur) {
          // rooted on the joint, leaning off the vein's own side
          axis.copy(b3).sub(a3).normalize();
          const sx = -axis.z, sz = axis.x;
          axis.set(sx * it.lean, it.rise, sz * it.lean).normalize();
          pos.copy(a3).addScaledVector(axis, it.len * k * 0.5);
          scl.set(it.w / 0.3, it.len * k, it.w / 0.22);
          pu = pulseAt(v, it.n / v.nodes, s);
        } else {
          // the blade runs from this joint to the one after next
          const len = a3.distanceTo(b3);
          axis.copy(b3).sub(a3).divideScalar(len || 1);
          axis.set(axis.x - axis.z * it.skew, it.skew2, axis.z + axis.x * it.skew).normalize();
          pos.copy(a3).addScaledVector(axis, len * k * 0.5);
          scl.set(it.w / 0.3, len * k * 1.16, it.w / 0.22);
          pu = pulseAt(v, (it.n + 1) / v.nodes, s);
        }
      }

      q.setFromUnitVectors(UP, axis);
      roll.setFromAxisAngle(axis, it.roll);
      q.premultiply(roll);
      mat4.compose(pos, q, scl);
      chain.setMatrixAt(i, mat4);
      // the halo is a touch fatter than the crystal and swells where the pulse
      // is passing, which is the light running through the vein
      mat4.compose(pos, q, scl.multiplyScalar(1.16 + pu * 0.7));
      halo.setMatrixAt(i, mat4);

      // The vein SETS. It is hot while it grows and then cools to a low
      // resting charge, and only then does the sharing pulse run through it.
      // Held at full brightness the second beat did not exist: photographed
      // mid-travel the pulse was a slightly paler patch on an already-bright
      // vein, which is a lighting change, not an event. `glow` varies per
      // blade so a settled vein is a seam of unequal crystals, not a strip
      // light.
      const fresh = it.v < 0
        ? Math.max(0, 1 - (s - it.born - it.grow) / 0.5)
        : Math.max(0, 1 - (s - veins[it.v].set) / 0.5);
      const gain = (0.18 + 0.44 * fresh + pu * 1.7) * it.glow * cool;
      halo.setColorAt(i, tint.setRGB(HOT.r * gain, HOT.g * gain, HOT.b * gain));
    }
    chain.instanceMatrix.needsUpdate = true;
    halo.instanceMatrix.needsUpdate = true;
    if (halo.instanceColor) halo.instanceColor.needsUpdate = true;
    crystalMat.opacity = cool;
    crystalMat.emissiveIntensity = (0.22 + 0.32 * Math.max(0, 1 - s / 1.0)) * cool;
    haloMat.opacity = 0.25 * cool;

    for (let i = 0; i < veins.length; i++) {
      const v = veins[i];
      const f = clamp01((s - v.t0) / v.dur);
      const g = glows[i];
      if (f <= 0) { g.mat.opacity = 0; beads[i].material.opacity = 0; continue; }
      for (let n = 0; n <= v.nodes; n++) {
        along(v, (n / v.nodes) * f, g.pts[n]);
        g.pts[n].y = STONE_Y;
      }
      g.lay(g.pts, { taper: 0 });                  // no taper: it is a stain, not a tail
      // brightest at the moment the vein lands, then a low steady charge that
      // the pulses ride on top of
      const pk = pulseAt(v, f * 0.5, s) + pulseAt(v, f * 0.85, s);
      // Dim and narrow. At 0.44 wide and 0.5 opaque this was a smooth pink
      // BAND under the crystal, and a smooth band is a ribbon: photographed at
      // t+900ms the vein read as pink cloth with a few splinters lying on it.
      // It is meant to be the charge in the stone, not the vein.
      g.mat.opacity = (0.13 + 0.16 * Math.max(0, 1 - (s - v.t0 - v.dur) / 0.5) + pk * 0.14) * cool;

      const bd = beads[i];
      let best = 0, bu = 0;
      for (const p of v.pulses) {
        const e = (s - p.t0) / p.dur;
        if (e <= 0 || e >= 1) continue;
        const w = Math.min(1, e / 0.12) * Math.min(1, (1 - e) / 0.18);
        if (w > best) { best = w; bu = p.dir > 0 ? e : 1 - e; }
      }
      if (best <= 0) { bd.material.opacity = 0; } else {
        along(v, bu, pos);
        bd.position.copy(pos);
        bd.position.y += 0.05;
        bd.scale.setScalar((0.26 + 0.08 * best) * v.w);
        bd.material.opacity = 0.75 * best * cool;
      }
    }

    for (const f of frames) {
      const u = clamp01((s - f.t) / 0.26);
      // it opens slightly oversized and settles, so it lands on the card rather
      // than simply switching on
      const kick = Math.exp(-(((s - f.kick) / 0.13) ** 2));
      f.m.scale.setScalar(1 + (1 - u) * 0.08 + kick * 0.03);
      f.m.material.opacity = 0.72 * smooth(u) * (1 + kick * 0.6) * cool;
    }
  });

  /* --- light. Local and low, exactly as shardfire's is: reach 3.4 against a
     2.62 square pitch means a linked card catches its own light and the board
     does not turn pink. One at the source when the crystal opens, one at each
     ally as its vein lands — so the LIGHT also travels outward, which is half
     of why the order of events reads at all. */
  const lamp = (p, delay, power, secs) => {
    const go = () => {
      const l = new THREE.PointLight(0xff5a92, 0, 3.4, 2);
      l.position.set(p.x, p.y + 0.55, p.z);
      kit.hold(l, secs, (t) => {
        l.intensity = power * (t < 0.14 ? t / 0.14 : (1 - (t - 0.14) / 0.86) ** 1.6);
      });
    };
    if (delay > 0) kit.after(delay, go); else go();
  };
  lamp(src, 0, 4.0, 0.5);
  ends.forEach((e, i) => lamp(e.pos, 0.12 + i * 0.055 + 0.40, 4.2, 0.55));
  // and once more when the sharing pulse reaches each of them
  ends.forEach((e, i) => lamp(e.pos, 0.82 + i * 0.03 + 0.30, 3.4, 0.45));

  // A single quiet ring on the source's stone at the instant the crystal
  // breaks out. Only one, and only here: a ring under every ally as well was
  // five hoops opening across the board in half a second and it turned the
  // calmest motif in the set into fireworks.
  kit.ring(src.clone().setY(0.1), 0xff3f7a, { size: 1.5, seconds: 0.45 });
}
