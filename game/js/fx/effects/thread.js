// THREAD — the Auroxi Weavers stitch. They do not throw anything.
//
// The card is Fatewoven Tapestry: an action is FORBIDDEN. So the motif is a
// piece of cloth being made and then laid down over the square, and the beat
// that matters is the last one — the weave pulls taut, drops onto the stone,
// and the light goes out of it. Nothing is destroyed; something is simply shut.
//
// The shape of it, in order:
//   the lead   — one thread runs out of the card and stakes at a far corner
//   the hem    — it carries on round all four corners, binding the frame
//   the guys   — four threads run on out past the corners and bite the stone
//   the warp   — thirteen teal threads laid the long way between the hems
//   the weft   — ONE orange shuttle running back and forth across them,
//                over-under, turning at the selvedge
//   the pull   — everything goes taut in one damped ring and settles down
//                onto the card, and stops glowing
//
// Three things were wrong with what this replaced and all three fixes are
// load bearing:
//   - it was a RADIAL fan of chords between pins on a circle. A star is not
//     cloth; nobody weaves outward from a hub. A loom is warp and weft at right
//     angles, and the moment the threads were made parallel it read as weaving
//     without anything else having to say so.
//   - the crossings now genuinely interleave in Y (`crimp` below): warp rides
//     high where weft rides low and the sign flips at every crossing, which is
//     a plain weave. It is real geometry, so the over thread really does hide
//     the under one. Painting them all at the same height gave a flat grid,
//     and a flat grid is a fence.
//   - the weft is ONE continuous strand, not eleven separate ones, with the
//     U-turns at the edge drawn in and a slow-down before each turn. A shuttle
//     is a single thread going back and forth; a row of strands appearing in
//     sequence looked like a printer.
//
// Preview — and use `fxt`, not --settle. Headless renders this table at two
// or three frames a second and main.js clamps dt, so wall-clock timing lands
// every shot in the first moments of the motif:
//   node tools/shot.js --url "game/?quick=1&seed=5&fxt=0.9" \
//     --eval tools/fxdemo/thread.js --out /tmp/t.png --settle 250

import { THREE, easeOut, easeInOut } from '../kit.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

// One texture for the life of the page — kit.hold disposes materials, never
// their maps, so this survives every cast.
let GLINT = null;
function glintTex() {
  if (GLINT) return GLINT;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 26);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.22, 'rgba(255,240,205,0.55)');
  grd.addColorStop(1, 'rgba(255,215,150,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  // the glint off a needle: a short cross, not the long spikes the old one
  // had — those read as a star at the head of every strand.
  g.strokeStyle = 'rgba(255,255,255,0.75)';
  g.lineWidth = 1.3;
  g.beginPath();
  g.moveTo(32, 13); g.lineTo(32, 51); g.moveTo(13, 32); g.lineTo(51, 32);
  g.stroke();
  GLINT = new THREE.CanvasTexture(c);
  GLINT.colorSpace = THREE.SRGBColorSpace;
  return GLINT;
}

// The soft square the finished cloth casts on what it covers. A ribbon five
// centimetres wide cannot cast a real shadow — three.js gives it an aliased
// mess — so the cloth gets one painted patch of shade instead, and that single
// dark square under it is what stops the weave reading as a cage floating over
// the card.
let SHADE = null;
function shadeTex() {
  if (SHADE) return SHADE;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  for (let i = 0; i < 14; i++) {
    const inset = 62 - i * 4.4;
    g.fillStyle = 'rgba(0,0,0,0.115)';
    g.beginPath();
    g.roundRect(inset, inset, 128 - inset * 2, 128 - inset * 2, 18);
    g.fill();
  }
  SHADE = new THREE.CanvasTexture(c);
  return SHADE;
}

export function threads(kit, at, colour = 0xffb257) {
  const from = kit.at(at);
  if (!from) return;

  /* --- the loom.
     R is a touch wider than the card, so the cloth overhangs what it covers.
     Everything is built in (u, v) on [-1, 1] and mapped through EX/EZ at draw
     time; that is what lets the whole patch sit square on the board while
     still being a few degrees off true, which is how a hand-made thing sits. */
  const R = 1.30;                                // just past the edge of the slab
  const W = 13;                                  // warp threads
  const P = 11;                                  // weft passes
  const SELV = 1.0;                              // selvedge, where the warp ends
  // A crossing has to ride up by clearly MORE than a thread is wide or the
  // interleave is a pixel and the whole thing flattens into a grille — which
  // is exactly what happened at 0.026 against a 0.045 thread.
  const CRIMP = 0.044;
  const HEM_LIFT = 1.9;                          // the binding sits over the lot

  const spin = rnd(-0.045, 0.045);
  const EX = new THREE.Vector3(Math.cos(spin), 0, Math.sin(spin));
  const EZ = new THREE.Vector3(-Math.sin(spin), 0, Math.cos(spin));
  const centre = from.clone();

  // `at` is always a card on the board here (cast-auroxi passes the caster),
  // so the face it is woven over is a known height.
  const STONE = 0.215;
  const HIGH = STONE + 0.40;                     // where it is woven
  const LOW = STONE + 0.095;                     // where it comes to rest

  // Auroxi are teal and warm orange, so the warp and the weft are given one
  // each: at this camera the alternating colour is what makes the plain weave
  // legible as a weave rather than as a mesh.
  // The suggested colour comes in as a pale brazier-orange, and pale warm
  // threads under warm braziers came out cream — the whole thing read as a
  // wicker basket. Pushing the warm side to a saturated amber is what gets an
  // ORANGE thread on screen; the teal never had the problem, being the one
  // colour on this table that nothing else is.
  const WARM = new THREE.Color(colour).lerp(new THREE.Color(0xe0670f), 0.85);
  const COOL = new THREE.Color(0x36bdb4);

  const LEAD_IN = 0.00, LEAD_RUN = 0.30;
  const HEM_IN = 0.24, HEM_RUN = 0.44;
  const WARP_IN = 0.40, WARP_RUN = 0.20, WARP_GAP = 0.019;
  const WEFT_IN = 0.66, WEFT_RUN = 0.58;
  const TAUT = 1.28;
  const SETTLE = 0.30;
  const HOLD_END = 1.72;
  const SPAN = 2.05;

  const group = new THREE.Group();
  const strands = [];

  /* --- a strand is a path in (u, v) sampled by arc length, so it can be
     revealed a little at a time by a needle running along it. Each node also
     carries its weave PHASE (which side of the crossing it is on) and its SAG
     parameter (0 at the two ends of its span, 1 in the middle). */
  function strand(nodes, o) {
    let L = 0;
    for (let i = 1; i < nodes.length; i++) {
      const a = nodes[i - 1], b = nodes[i];
      L += Math.hypot(b.u - a.u, b.v - a.v) * R;
      b.L = L;
    }
    nodes[0].L = 0;
    const seg = o.seg;
    const st = kit.strip({ segments: seg, width: o.width, colour: o.tint, emissive: 0.3 });
    st.mesh.castShadow = false;                  // a 5cm ribbon casts a dirty
    st.mat.opacity = 0;                          // aliased shadow, not a thread
    group.add(st.mesh);
    const pts = [];
    for (let i = 0; i < seg; i++) pts.push(new THREE.Vector3());
    const s = { st, pts, nodes, total: L, seg, seed: rnd(0, 6.3), ...o };
    strands.push(s);
    return s;
  }

  const P_ = (u, v, ph, sg, gnd = 0) => ({ u, v, ph, sg, gnd, L: 0 });

  // Every thread wanders a little across its own line. Dead-straight threads
  // at an even pitch are a grille; this, plus the jitter on the warp pitch, is
  // the difference between something woven and something machined.
  const MEANDER = 0.013;

  // Where the warp and the weft cross. A crossing at (pass j, warp k) has the
  // weft above and the warp below when j+k is even, and the other way round
  // when it is odd — which is the definition of a plain weave.
  const warpPhase = (u, k) => Math.PI * (((u + 1) / 2) * P - 0.5 + k);
  const weftPhase = (v, j) => Math.PI * (((v + 1) / 2) * W - 0.5 + j);

  const corner = [
    { u: -SELV, v: -SELV }, { u: SELV, v: -SELV },
    { u: SELV, v: SELV }, { u: -SELV, v: SELV },
  ];

  /* --- the lead: the thread leaving the card. It flies up and lands, which is
     the only part of this that moves like something thrown, and it is gone
     again by the time the cloth is finished. */
  const leadNodes = [];
  for (let i = 0; i < 12; i++) {
    const q = i / 11;
    leadNodes.push(P_(corner[0].u * q, corner[0].v * q, 0, q));
  }
  const lead = strand(leadNodes, {
    seg: 16, width: 0.042, tint: WARM, born: LEAD_IN, run: LEAD_RUN,
    lift: HEM_LIFT, sag: -0.03, fly: 0.42, needle: 0.28, glint: colour,
  });

  /* --- the hem: the same thread carrying on round all four corners. One
     strand, not four, so it reads as one continuous binding run. */
  const hemNodes = [];
  for (let e = 0; e < 4; e++) {
    const a = corner[e], b = corner[(e + 1) % 4];
    for (let i = (e ? 1 : 0); i <= 14; i++) {
      const q = i / 14;
      hemNodes.push(P_(a.u + (b.u - a.u) * q, a.v + (b.v - a.v) * q, 0, q));
    }
  }
  const hem = strand(hemNodes, {
    seg: 64, width: 0.055, tint: WARM, born: HEM_IN, run: HEM_RUN,
    lift: HEM_LIFT, sag: -0.05, fly: 0.05, needle: 0, glint: colour,
  });

  /* --- the warp. Laid the long way, all parallel, staggered so the eye can
     follow one being put down before the next starts. */
  for (let k = 0; k < W; k++) {
    const v = -1 + (2 * (k + 0.5)) / W + rnd(-0.014, 0.014);
    const nodes = [];
    for (let i = 0; i < 22; i++) {
      const q = i / 21, u = -SELV + 2 * SELV * q;
      nodes.push(P_(u, v, warpPhase(u, k), q));
    }
    strand(nodes, {
      seg: 24, width: 0.046, tint: COOL, born: WARP_IN + k * WARP_GAP, run: WARP_RUN,
      lift: -1, sag: -0.10, fly: 0.07, needle: 0.15, glint: 0x8ff0e6,
    });
  }

  /* --- the weft: ONE shuttle. The U-turns outside the selvedge are drawn,
     because the turn is the part that tells you it is the same thread coming
     back. `mark` records where each pass begins and ends so the run can slow
     into the turn instead of sweeping round at full speed. */
  const weftNodes = [];
  const passA = [], passB = [];
  for (let j = 0; j < P; j++) {
    const u = -1 + (2 * (j + 0.5)) / P;
    const dir = j % 2 ? -1 : 1;
    passA.push(weftNodes.length);
    for (let i = 0; i < 26; i++) {
      const q = i / 25, v = dir * (-SELV + 2 * SELV * q);
      weftNodes.push(P_(u, v, weftPhase(v, j), q));
    }
    passB.push(weftNodes.length - 1);
    if (j === P - 1) break;
    const uN = -1 + (2 * (j + 1.5)) / P;
    const vEnd = dir * SELV, mid = (u + uN) / 2, half = (uN - u) / 2;
    const phEnd = weftPhase(vEnd, j);
    for (let i = 1; i <= 8; i++) {
      const a = (i / 8) * Math.PI;
      weftNodes.push(P_(mid - half * Math.cos(a), vEnd + dir * 0.032 * Math.sin(a), phEnd, 0));
    }
  }
  const weft = strand(weftNodes, {
    seg: 330, width: 0.042, tint: WARM, born: WEFT_IN, run: WEFT_RUN,
    lift: 1, sag: -0.085, fly: 0.05, needle: 0.3, glint: colour,
  });

  /* --- the guys. Four long threads run out past the corners and stake into
     the stone well outside the square. They are what puts this ON THE TABLE:
     with the weave alone the motif was a neat little mat that started and
     ended inside one square and had no reach at all. Each leaves as the hem
     turns that corner, so the piece still reads as one continuous job of work.
     `gnd` is what takes a thread down to the stone at its far end — without it
     the guys hung in the air like scaffolding. */
  const HEM_AT = [0.02, 0.06, 0.11, 0.18];       // eased hem arrival per corner
  const guyUV = [];
  for (let i = 0; i < 4; i++) {
    const c = corner[i];
    const a = Math.atan2(c.v, c.u) + rnd(-0.24, 0.24);
    // Measured from the CENTRE, so it has to clear the corner at 1.41 before
    // it is a guy at all — at 1.45 they came out as stubs. The top of the range
    // is set by the diagonal neighbour: a guy points straight at that card and
    // at 2.3 one of them would stake itself through the corner of it.
    const reach = rnd(1.85, 2.1);
    const end = { u: Math.cos(a) * reach, v: Math.sin(a) * reach };
    guyUV.push(end);
    const nodes = [];
    for (let n = 0; n < 10; n++) {
      const q = n / 9;
      nodes.push(P_(c.u + (end.u - c.u) * q, c.v + (end.v - c.v) * q, 0, q, q ** 1.7));
    }
    strand(nodes, {
      seg: 14, width: 0.044, tint: WARM, born: HEM_IN + HEM_AT[i], run: rnd(0.24, 0.3),
      lift: 0, sag: -0.11, fly: 0.14, needle: 0.17, glint: colour,
    });
  }

  /* --- the stakes. A knot where the hem turns and another where each guy
     bites the stone, so the cloth is pinned to the table, not floating. */
  const knotMat = new THREE.MeshBasicMaterial({
    color: colour, transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const stakeUV = corner.concat(guyUV);
  const knots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.055, 8, 6), knotMat, 8);
  knots.frustumCulled = false;
  const m4 = new THREE.Matrix4();
  group.add(knots);

  const shadeMat = new THREE.MeshBasicMaterial({
    map: shadeTex(), color: 0x120c06, transparent: true, opacity: 0, depthWrite: false,
  });
  const shade = new THREE.Mesh(new THREE.PlaneGeometry(2.3 * R, 2.3 * R), shadeMat);
  shade.rotation.x = -Math.PI / 2;
  shade.rotation.z = -spin;
  shade.position.copy(centre).setY(STONE + 0.02);
  shade.renderOrder = -1;
  group.add(shade);

  /* --- the needles. One glint at the head of whatever is being laid. */
  for (const s of strands) {
    if (!s.needle) continue;
    s.nm = new THREE.SpriteMaterial({
      map: glintTex(), color: s.glint, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, opacity: 0,
    });
    s.sp = new THREE.Sprite(s.nm);
    s.sp.scale.setScalar(s.needle);
    group.add(s.sp);
  }

  // Everything the whole cloth shares in a given frame, set once at the top of
  // the tick. These were nine arguments threaded through `lay` and the call
  // site was unreadable.
  const tmp = new THREE.Vector3();
  let Rn = R;          // R, cinched in by the pull
  let baseY = HIGH;    // the height the cloth is being worked at
  let slack = 1;       // 1 while it hangs loose, ringing to 0 on the pull
  let crimp = CRIMP;   // how far a crossing rides over its neighbour
  let breath = 0;      // the flex of a cloth that has come to rest
  let shuttle = -1;    // how far across the warp the weft has got
  let drop = 0;        // 0 woven in the air, 1 lying on the card

  // Lay one strand out to `want` arc length. The point of working in arc
  // length is that the strip's points bunch up BEHIND the needle rather than
  // the strand stretching into place, so a thread is laid, not scaled.
  function lay(s, want, prog) {
    const { nodes, pts, seg } = s;
    let n = 0;
    for (let i = 0; i < seg; i++) {
      const d = (i / (seg - 1)) * want;
      while (n < nodes.length - 2 && nodes[n + 1].L < d) n++;
      const a = nodes[n], b = nodes[n + 1];
      const f = b.L > a.L ? (d - a.L) / (b.L - a.L) : 0;
      const u = a.u + (b.u - a.u) * f;
      const v = a.v + (b.v - a.v) * f;
      const ph = a.ph + (b.ph - a.ph) * f;
      const sg = a.sg + (b.sg - a.sg) * f;
      const gnd = a.gnd + (b.gnd - a.gnd) * f;
      const wob = MEANDER * Math.sin((u + v) * 9 + s.seed);
      const p = pts[i];
      p.copy(centre)
        .addScaledVector(EX, (u + (s.lift < 0 ? 0 : wob)) * Rn)
        .addScaledVector(EZ, (v + (s.lift < 0 ? wob : 0)) * Rn);
      // On a loom the warp lies dead straight and the SHUTTLE is what crimps
      // it. Crimping the whole warp the moment it was laid left a combful of
      // wavy hairs over the card with nothing crossing them, which looked like
      // weeds; now the ripple appears behind the shuttle as it goes by.
      const bite = s.lift < 0 ? clamp01((shuttle - u) / 0.28) : 1;
      // Once it is down it is lying over a CARD, not over a flat world: the
      // middle rests on the card and the rest of it falls away to the stone.
      // Without this the finished cloth was a rigid plate hanging in the air.
      const m = Math.max(Math.abs(u), Math.abs(v));
      const drape = -0.085 * drop * clamp01((m - 0.66) / 0.34) ** 1.4;
      p.y = baseY + drape + s.lift * Math.cos(ph) * crimp * bite
        + Math.sin(Math.PI * sg) * (s.sag * slack + s.fly * (1 - prog))
        + breath * Math.sin(u * 2.1 + v * 1.7);
      p.y += (STONE + 0.025 - p.y) * gnd;
    }
    s.st.lay(pts, { taper: 0 });
    if (s.sp) {
      tmp.copy(pts[seg - 1]);
      s.sp.position.copy(tmp);
    }
  }

  /* --- the gather. The first thread used to appear out of nothing at the
     middle of the card; this is the pinch of light it is drawn from. */
  const moteMat = new THREE.SpriteMaterial({
    map: glintTex(), color: colour, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, opacity: 0,
  });
  const mote = new THREE.Sprite(moteMat);
  mote.position.copy(centre).setY(STONE + 0.1);
  group.add(mote);

  kit.hold(group, SPAN, (t) => {
    const s = t * SPAN;

    /* Cloth pulled tight rings once and stops — a damped oscillation, not an
       ease. Easing the slack out looked like a menu transition. */
    let snap = 0;
    slack = 1;
    if (s > TAUT) {
      const k = (s - TAUT) / 0.34;
      slack = k >= 1 ? 0 : Math.exp(-k * 6) * Math.cos(k * 12.5);
      snap = Math.max(0, 1 - k) ** 2;
    }
    // and then it comes down onto the square. The drop is the whole "shut"
    // beat: the cloth stops being a thing in the air and becomes a thing lying
    // on the card.
    drop = easeOut(clamp01((s - TAUT) / SETTLE));
    baseY = HIGH + (LOW - HIGH) * drop;
    crimp = CRIMP * (1 + 0.45 * snap);
    // Cloth pulled tight draws IN — without this the pull was only a change of
    // brightness, which is a light being switched, not a thread being pulled —
    // and then it goes on drawing in, very slightly, for as long as it is
    // there. That creep after the pull is the unease the card is owed: the
    // thing is finished and it is still tightening.
    Rn = R * (1 - 0.055 * snap - 0.022 * drop);
    // once it is down it is not still: a slow shallow flex, barely there, so
    // the finished thing reads as cloth and not as a decal.
    breath = 0.011 * drop * Math.sin(s * 4.4);
    // where across the warp the shuttle has reached, which is how far the
    // crimp has spread (see `bite` in lay)
    shuttle = -1 + 2.35 * clamp01((s - WEFT_IN) / WEFT_RUN);

    const fadeOf = (off) => (s > HOLD_END + off
      ? Math.max(0, 1 - (s - HOLD_END - off) / (SPAN - HOLD_END - off)) : 1);
    // the field goes first and the binding a moment later, so the last thing
    // on the table is the outline of a square with nothing allowed in it
    const outWeave = fadeOf(0);
    const outHem = fadeOf(0.16);

    for (const st of strands) {
      let prog = clamp01((s - st.born) / st.run);
      let want;
      if (st === weft) {
        // the shuttle: across, slow into the turn, round, and back
        const x = prog * P;
        const j = Math.min(P - 1, Math.floor(x));
        const w = x - j;
        const A = st.nodes[passA[j]].L, B = st.nodes[passB[j]].L;
        if (w < 0.84 || j === P - 1) {
          want = A + easeInOut(Math.min(1, w / 0.84)) * (B - A);
        } else {
          const C = st.nodes[passA[j + 1]].L;
          want = B + ((w - 0.84) / 0.16) * (C - B);
        }
      } else {
        want = easeOut(prog) * st.total;
      }
      if (prog <= 0) { st.st.mat.opacity = 0; if (st.nm) st.nm.opacity = 0; continue; }

      // The lead is pulled back in at the end. A thread running across the
      // finished cloth to the middle of the card is the weaver's tail, and
      // leaving it there made the piece look unfinished rather than shut.
      let op = 1;
      if (st === lead) {
        const back = clamp01((s - (WEFT_IN + WEFT_RUN * 0.35)) / 0.3);
        want *= 1 - back;
        op = 1 - back;
        if (op <= 0.001) { st.st.mat.opacity = 0; if (st.nm) st.nm.opacity = 0; continue; }
      }

      lay(st, want, prog);
      const out = st === hem ? outHem : outWeave;
      st.st.mat.opacity = Math.min(1, prog * 9) * 0.97 * out * op;
      // the light LEAVES it once it is woven. That is the unsettling part:
      // it does not flare and vanish, it dulls and stays.
      st.st.mat.emissiveIntensity = 0.42 + 0.62 * snap - 0.24 * drop;

      if (st.nm) {
        st.nm.opacity = Math.min(1, prog * 10) * (1 - prog ** 2) * 1.25 * op;
        st.nm.rotation += 0.16;
        st.sp.scale.setScalar(st.needle * (1 - prog * 0.3));
      }
    }

    const gather = clamp01(s / 0.12) * Math.max(0, 1 - Math.max(0, s - 0.12) / 0.3);
    moteMat.opacity = gather * 0.9;
    mote.scale.setScalar(0.18 + 0.3 * gather);

    // the stakes take a thread, flare on the pull, then go. They are moved
    // rather than scaled so they stay at the corners while the cloth cinches.
    const set = clamp01((s - LEAD_RUN) / 0.5);
    knotMat.opacity = (0.3 * set + 0.55 * snap) * outHem;
    for (let i = 0; i < 8; i++) {
      tmp.copy(centre).addScaledVector(EX, stakeUV[i].u * Rn)
        .addScaledVector(EZ, stakeUV[i].v * Rn).setY(STONE + 0.03);
      m4.makeScale(1 + snap * 0.8, 1 + snap * 0.8, 1 + snap * 0.8).setPosition(tmp);
      knots.setMatrixAt(i, m4);
    }
    knots.instanceMatrix.needsUpdate = true;

    shadeMat.opacity = 0.40 * drop * outWeave;
    shade.scale.setScalar(Rn / R);
  });

  /* --- the light this casts is small on purpose: the Weavers are not a flash,
     and this plays on the same board as the Dragon's fire, which is already
     the loudest thing on the table. The one moment it is allowed is the pull. */
  const lamp = new THREE.PointLight(colour, 0, 4.4, 2);
  lamp.position.copy(centre).setY(STONE + 0.95);  // high: down at 0.6 the pull
                                                  // blew the card out white
  kit.hold(lamp, SPAN, (t) => {
    const s = t * SPAN;
    lamp.intensity = 1.6 * Math.min(1, s / 0.25) * (1 - t)
      + 2.4 * Math.max(0, 1 - Math.abs(s - TAUT) / 0.2) ** 2;
  });

  // One ring on the stone at the pull, wide enough to run out from under the
  // cloth rather than hide beneath it. There were sparks here too and they had
  // to go: fat bright blobs lobbed off a card is the grammar of an explosion,
  // and this card does not explode, it forbids.
  kit.after(TAUT, () => {
    kit.ring(centre.clone().setY(STONE + 0.02), colour, { size: 3.6, seconds: 0.55 });
  });
}
