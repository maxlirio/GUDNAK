// ECHO — the same thing happens a second time.
//
// Shared by 3 Auroxi weavers: M170 Twain of Twine ("after a fighter you
// control resolves an Action ability, this fighter may also resolve that
// ability"), A010 Fateweaver (fighters with an Attachment may act while
// fatigued) and A008 Timeweaver (an additional action at the start of your
// Action Phase). One sentence covers all three: SOMETHING HAPPENS AGAIN WHEN
// IT SHOULD NOT HAVE.
//
// THE WHOLE MOTIF IS ONE PASS, PLAYED TWICE. A shuttle crosses the card and
// leaves a band of cloth behind it; the band snaps taut and bright, the
// card's own edge takes the light and a ring goes out. Four tenths of a
// second later the identical thing happens again — the same path, the same
// speed, the same shape, at half the weight — with the second shuttle still
// on the line while the first band is lying there. It is built that way in
// the code as well: `pass()` is called twice with nothing but a delay and a
// strength between them, which is the only arrangement that guarantees the
// two are really the same run and not two runs that look alike.
//
// TWICE, NOT TWO THINGS. That distinction is the whole card:
//   - the echo runs the SAME LINE, a third of a unit to one side — edge to
//     edge with the first band, the way a misregistered print doubles. Drift
//     is measured on screen and not in the world, though: `side` points very
//     nearly along z and depth is foreshortened to about two thirds here, so
//     a fifth of a unit was five pixels and the two merged into one thick
//     stroke.
//   - the echo is the same COLOUR. A cooler or paler second pass reads as a
//     different material doing a different job.
//   - the two overlap. A crossing takes longer than the gap between the
//     passes, so a single frame holds both shuttles, one ahead of the other
//     on the same track — and a ring outlives its own pass, so a single frame
//     holds both rings too. Neither was true in the first cut and it is the
//     difference between "again" and "and then something else".
//
// THE RINGS ARE THE COUNT. Two amber circles round one square, a big faint
// one and a small bright one chasing it, is the only part of this that
// survives being sixty pixels wide and glanced at sideways. The shuttle and
// the cloth are what make it Auroxi; the rings are what make it legible.
//
// Colour is thread.js's: the pale brazier-orange the kit hands out comes back
// as cream under warm light, so the warm side is pushed to a saturated amber
// before it is used. Nothing here is additive except the glints and the ring,
// because ACES turns an additive band into a white slab.
//
// Preview:  node tools/shot.js --wait 10000 --settle 600 \
//   --url "game/?quick=1&seed=5&t=620" \
//   --eval tools/fxdemo/echo.js --out /tmp/ec.png

import { THREE, CARD_W, CARD_H, FACTION, easeOut, easeIn } from '../kit.js';

/* ---------------------------------------------------------------- colour */

// thread.js's amber. A pale warm thread under warm braziers comes out cream
// and the whole thing reads as wicker, so the warm side is taken most of the
// way to a saturated orange before it is ever put on screen.
const WARM = new THREE.Color(0xffb257).lerp(new THREE.Color(0xe0670f), 0.85);
const TAUT = new THREE.Color(0xffd9a8);   // the band at the instant it snaps
// The ring and the glints are the only additive things here, so they are the
// only things that can blow out. 0xffd9a0 was the first choice and ACES took
// it straight to white — a white hoop on a torchlit table reads as a UI
// element, not as a wavefront of amber light. Held well down in green and
// blue it stays the colour it was chosen for.
const PALE = 0xff9a34;

/* --------------------------------------------------------------- heights */

// The flagstone face is 0.080 and a card's slab runs 0.185 to 0.220. Every
// part of this motif lies over a CARD, so every part of it has to clear that
// slab by enough that the depth buffer can tell them apart — a centimetre is
// not enough at this camera, which is a lesson voidstep.js paid two passes
// for. Six is.
const FACE = 0.215;
const CLOTH = FACE + 0.060;
const RING_Y = FACE + 0.072;
const EDGE_Y = FACE + 0.084;
const SHUTTLE_Y = FACE + 0.100;

/* -------------------------------------------------------------- textures */

// Cached for the life of the page: kit.hold disposes materials, and a
// material never disposes its map.
const TEXES = new Map();
function tex(key, paint, w = 256, h = 64) {
  let t = TEXES.get(key);
  if (!t) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    paint(c.getContext('2d'), w, h);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    TEXES.set(key, t);
  }
  return t;
}

/**
 * The band the shuttle leaves: cloth, not light. x runs from the START of the
 * pass to the shuttle, y across.
 *
 * The ribs run ACROSS it, which is the direction cloth creases in and the
 * same choice cloth-kit.js's weave makes, and they are COARSE — eight of them
 * over a band ninety pixels long. Thirty fine ones, which is what real cloth
 * has, came out sub-pixel and shimmered.
 *
 * The tail end is thinned to nothing so the band has no start: a band of even
 * weight from end to end read as a painted stripe somebody had put down,
 * rather than as something being paid out behind a moving object.
 */
const bandTex = () => tex('ec-band', (g, W, H) => {
  // GREYSCALE, with the colour on the material. Painted orange here and then
  // tinted orange as well, the band came out a dense brown line with no hot
  // core in it — orange times orange is not orange, and the shading is what
  // makes a strip of cloth a strip of cloth.
  const across = g.createLinearGradient(0, 0, 0, H);
  across.addColorStop(0.00, '#161110');
  across.addColorStop(0.22, '#6d5a4e');
  across.addColorStop(0.42, '#fff4e6');
  across.addColorStop(0.60, '#c7ab92');
  across.addColorStop(0.84, '#4a3a30');
  across.addColorStop(1.00, '#141010');
  g.fillStyle = across;
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 9; i++) {
    const x = (i + 0.5) * (W / 9);
    g.fillStyle = 'rgba(255,248,236,0.30)';
    g.fillRect(x - W / 40, 0, W / 26, H);
    g.fillStyle = 'rgba(14,10,8,0.34)';
    g.fillRect(x + W / 40, 0, W / 40, H);
  }
  const along = g.createLinearGradient(0, 0, W, 0);
  along.addColorStop(0.00, 'rgba(0,0,0,0)');
  along.addColorStop(0.10, 'rgba(0,0,0,0.55)');
  along.addColorStop(0.32, 'rgba(0,0,0,1)');
  along.addColorStop(1.00, 'rgba(0,0,0,1)');
  const edge = g.createLinearGradient(0, 0, 0, H);
  edge.addColorStop(0.00, 'rgba(0,0,0,0)');
  edge.addColorStop(0.14, 'rgba(0,0,0,0.9)');
  edge.addColorStop(0.30, 'rgba(0,0,0,1)');
  edge.addColorStop(0.72, 'rgba(0,0,0,1)');
  edge.addColorStop(0.88, 'rgba(0,0,0,0.9)');
  edge.addColorStop(1.00, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = along; g.fillRect(0, 0, W, H);
  g.fillStyle = edge; g.fillRect(0, 0, W, H);
}, 192, 32);

/**
 * The shuttle: a weaver's boat, pointed at both ends, seen from above.
 *
 * Drawn with a real silhouette rather than as a blob, because this is the one
 * object in the motif the eye is meant to follow, and a round glow travelling
 * across a card is the grammar of every bolt in this game. x is along its
 * length. The bright spine is offset off centre so it has a lit side and a
 * shaded one and does not read as a lozenge of flat colour.
 */
const shuttleTex = () => tex('ec-shuttle', (g, W, H) => {
  const boat = (inset, style) => {
    g.beginPath();
    g.moveTo(inset, H / 2);
    g.quadraticCurveTo(W / 2, inset * 0.6, W - inset, H / 2);
    g.quadraticCurveTo(W / 2, H - inset * 0.6, inset, H / 2);
    g.closePath();
    g.fillStyle = style;
    g.fill();
  };
  boat(2, '#3a1a06');
  boat(5, '#d4761f');
  // The lit side, held above the middle so the boat has a top. It is a THIN
  // highlight: at 0.85 alpha over most of the hull the whole object came out
  // cream, and a pale lozenge crossing a card is indistinguishable from the
  // bright head of the band it is pulling.
  g.save();
  g.beginPath();
  g.moveTo(10, H / 2);
  g.quadraticCurveTo(W / 2, H * 0.20, W - 10, H / 2);
  g.quadraticCurveTo(W / 2, H * 0.43, 10, H / 2);
  g.closePath();
  g.fillStyle = 'rgba(255,233,196,0.62)';
  g.fill();
  g.restore();
  // the thread coming off its nose
  g.strokeStyle = 'rgba(255,225,180,0.8)';
  g.lineWidth = 2;
  g.beginPath(); g.moveTo(W - 4, H / 2); g.lineTo(W, H / 2); g.stroke();
}, 96, 32);

/** A soft blob, for glints and for the flare at the end of a pass. */
const blobTex = () => tex('ec-blob', (g, W, H) => {
  const grd = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
  grd.addColorStop(0.00, 'rgba(255,255,255,1)');
  grd.addColorStop(0.22, 'rgba(255,255,255,0.52)');
  grd.addColorStop(0.55, 'rgba(255,255,255,0.13)');
  grd.addColorStop(1.00, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
}, 64, 64);

/**
 * The ring that goes out when a pass lands: one thin bright circle with a
 * little dust inside its trailing edge.
 *
 * Its whole job is to be COUNTABLE. Two of these, identical and a third of a
 * second apart, is the clearest statement of "that happened twice" available
 * at sixty pixels, and it stays clear when the card is half off the edge of
 * the screen or behind the hand.
 */
const ringTex = () => tex('ec-ring', (g, W, H) => {
  const cx = W / 2, cy = H / 2;
  const circle = (r, width, alpha, blur) => {
    g.filter = blur ? `blur(${blur}px)` : 'none';
    g.strokeStyle = `rgba(255,255,255,${alpha})`;
    g.lineWidth = width;
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
  };
  circle(W * 0.40, W * 0.052, 0.14, W * 0.020);
  circle(W * 0.40, W * 0.018, 0.48, W * 0.006);
  circle(W * 0.40, W * 0.007, 1.0, W * 0.002);
  g.filter = 'none';
  // a breath of dust just inside it, so the ring is a wavefront and not a hoop
  const grd = g.createRadialGradient(cx, cy, W * 0.26, cx, cy, W * 0.40);
  grd.addColorStop(0, 'rgba(255,255,255,0)');
  grd.addColorStop(1, 'rgba(255,255,255,0.10)');
  g.fillStyle = grd;
  g.beginPath(); g.arc(cx, cy, W * 0.40, 0, Math.PI * 2); g.fill();
}, 256, 256);

/**
 * The card's own border, for the flash at the end of each pass.
 *
 * Three strokes, wide and faint down to narrow and hot — one stroke of one
 * width is a drawn border, and light on an edge has a falloff either side of
 * it. It sits just inside the card's outline so it reads as the card lighting
 * up rather than as a halo the card is standing in the middle of.
 */
const edgeTex = () => tex('ec-edge', (g, W, H) => {
  const pass = (inset, width, alpha, blur) => {
    g.filter = blur ? `blur(${blur}px)` : 'none';
    g.strokeStyle = `rgba(255,255,255,${alpha})`;
    g.lineWidth = width;
    g.beginPath();
    g.roundRect(inset, inset, W - inset * 2, H - inset * 2, 14);
    g.stroke();
  };
  pass(W * 0.235, W * 0.055, 0.16, W * 0.020);
  pass(W * 0.235, W * 0.022, 0.44, W * 0.007);
  pass(W * 0.235, W * 0.008, 1.0, W * 0.002);
  g.filter = 'none';
}, 256, 256);

/* ------------------------------------------------------------- the ribbon */

/** A strip of quads whose spine is rewritten every frame. */
function ribbon(segs) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(segs * 2 * 3), 3));
  const uv = new Float32Array(segs * 2 * 2);
  for (let i = 0; i < segs; i++) {
    const k = i / (segs - 1);
    uv[i * 4 + 0] = k; uv[i * 4 + 1] = 0;
    uv[i * 4 + 2] = k; uv[i * 4 + 3] = 1;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const idx = [];
  for (let i = 0; i < segs - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  geo.setIndex(idx);
  return geo;
}

/* ------------------------------------------------------------------ time */

// kit.hold hands the tick a FRACTION of the span, so every moment below is a
// fraction and SPAN is the only number in seconds.
const SPAN = 1.7;
// The gap between the two passes. Shorter than this and the second reads as
// part of the first — a wide double stroke rather than a repeat; much longer
// and the eye has let go of the first before the second arrives and they are
// simply two events. Four tenths of a second is about where a repeat still
// feels like the SAME action coming round again.
const GAP = 0.24;
const P1 = 0.05;         // the first shuttle leaves
// A crossing takes LONGER THAN THE GAP, and by a good margin, or the two
// shuttles are never on the line together. At 0.33 against a gap of 0.245 the
// overlap was an eighth of a second and no frame ever held both — which threw
// away the one picture that says "again" without needing a memory of the
// frame before.
const RUN = 0.40;
const RING = 0.44;       // and a ring outlives its own pass, for the same reason
const FADE = 0.78;       // the cloth starts to go
const OUT = 0.90;        // and everything is off the table by the end

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const flat = (m) => { m.rotation.x = -Math.PI / 2; return m; };

/** A flat quad lying over the card. */
function decal(map, w, h, extra = {}) {
  return flat(new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({
      map, transparent: true, opacity: 0, depthWrite: false,
      side: THREE.DoubleSide, ...extra,
    }),
  ));
}

/**
 * Point a decal along a heading.
 *
 * A decal is rotated -90° about x, and three.js composes an XYZ euler as
 * Rx·Ry·Rz, so the map's own +x axis ends up pointing at (cos z, 0, -sin z) in
 * the world. The angle that aims it along (dx, dz) is therefore
 * atan2(-dz, dx), and it is worth deriving rather than guessing: the first
 * cut here was out by exactly pi, which sent every shuttle across the card
 * stern first with the thread trailing off its bow.
 */
const heading = (m, dx, dz) => { m.rotation.z = Math.atan2(-dz, dx); };

export function echo(kit, at, faction) {
  const p = kit.at(at);
  if (!p) return;
  const look = FACTION[faction] || FACTION.Auroxi;

  /* ------------------------------------------------------------- the line */

  // Across the card, left to right, tilted a few degrees. WIDTH IS THE CHEAP
  // DIRECTION at this camera — a run along x costs nothing in foreshortening
  // while the same distance in z is squashed to two thirds — so the pass is
  // laid along the rows and only tipped enough to stop it looking ruled.
  //
  // It runs well past the card at both ends: a shuttle that started and
  // stopped inside the square had no approach and no follow-through, and read
  // as a thing appearing on the card rather than as a pass across it.
  // How far past the middle of the card each pass runs. At 1.5 card widths
  // the cloth lay across the NEIGHBOURING square's card at both ends, which
  // made a motif about one fighter look like something happening to a row.
  // 1.12 still overhangs by a third of a card — enough for an approach and a
  // follow-through — and dies in the joint between the squares.
  const REACH = CARD_W * 1.12;
  const TILT = 0.18;
  const dir = new THREE.Vector3(Math.cos(TILT), 0, -Math.sin(TILT));
  const side = new THREE.Vector3(-dir.z, 0, dir.x);
  const A = p.clone().addScaledVector(dir, -REACH).setY(CLOTH);
  const B = p.clone().addScaledVector(dir, REACH).setY(CLOTH);

  const g = new THREE.Group();
  const here = new THREE.Vector3();

  /**
   * One crossing: a shuttle, the band it pays out behind it, a glint on its
   * nose, the card's edge lighting as it lands and a ring going out.
   *
   * `delay` is when it starts and `weight` is how much of it there is. Both
   * passes are THIS function — that is the point of the card, and building
   * the echo as a copy of the code as well as of the picture is what keeps
   * the two from drifting apart when either is tuned.
   */
  const pass = (delay, weight, drift) => {
    const SEGS = 30;
    const geo = ribbon(SEGS);
    const band = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      map: bandTex(), color: WARM, transparent: true, opacity: 0,
      depthWrite: false, side: THREE.DoubleSide,
    }));
    band.frustumCulled = false;
    band.renderOrder = 4;

    // A SHUTTLE HAS TO BE BIG ENOUGH TO HAVE A SHAPE. At 0.62 by 0.21 it was
    // twenty-two pixels by seven and the pointed hull the texture is entirely
    // about was three pixels of it, so what crossed the card was a dash.
    const boat = decal(shuttleTex(), 1.32, 0.48);
    boat.material.color.setHex(0xffffff);
    boat.position.y = SHUTTLE_Y;
    boat.renderOrder = 8;

    const glint = decal(blobTex(), 0.55, 0.55,
      { blending: THREE.AdditiveBlending, color: PALE });
    glint.position.y = SHUTTLE_Y + 0.004;
    glint.renderOrder = 9;

    const ring = decal(ringTex(), 1, 1,
      { blending: THREE.AdditiveBlending, color: PALE });
    ring.position.set(p.x, RING_Y, p.z);
    ring.renderOrder = 6;

    const edge = decal(edgeTex(), CARD_W * 1.70, CARD_H * 1.70,
      { blending: THREE.AdditiveBlending, color: look.spark });
    edge.position.set(p.x, EDGE_Y, p.z);
    edge.renderOrder = 7;

    g.add(band, boat, glint, ring, edge);

    const pos = geo.attributes.position.array;
    const lay = (u1, hw) => {
      for (let i = 0; i < SEGS; i++) {
        const k = i / (SEGS - 1);
        const u = u1 * k;
        here.copy(A).lerp(B, u).addScaledVector(side, drift);
        // The band is paid out FLAT but not dead flat: it lifts a little
        // where the shuttle has just been and settles behind it, which is the
        // only thing separating a length of cloth from a painted stripe at
        // this size.
        const lift = 0.055 * Math.sin(Math.PI * clamp01((u - u1 + 0.42) / 0.42));
        const w = hw * Math.min(1, (u1 - u) * 14 + 0.25);
        pos[i * 6 + 0] = here.x - side.x * w;
        pos[i * 6 + 1] = CLOTH + lift;
        pos[i * 6 + 2] = here.z - side.z * w;
        pos[i * 6 + 3] = here.x + side.x * w;
        pos[i * 6 + 4] = CLOTH + lift;
        pos[i * 6 + 5] = here.z + side.z * w;
      }
      geo.attributes.position.needsUpdate = true;
    };

    return (t) => {
      const k = (t - delay) / RUN;
      if (k <= 0) {
        band.material.opacity = 0; boat.material.opacity = 0;
        glint.material.opacity = 0; ring.material.opacity = 0;
        edge.material.opacity = 0;
        return;
      }
      // A shuttle is thrown and caught: away fast, slowing into the selvedge.
      // Eased the other way it crept off the edge of the card and then bolted,
      // which reads as a thing being fired rather than as a pass of work.
      const u = k < 1 ? (k * 0.4 + easeOut(clamp01(k)) * 0.6) : 1;
      here.copy(A).lerp(B, u).addScaledVector(side, drift);

      const fall = 1 - easeIn(clamp01((t - OUT) / (1 - OUT)));
      const gone = easeIn(clamp01((t - FADE - delay * 0.4) / (1 - FADE)));
      lay(u, 0.21);
      band.material.opacity = weight * Math.min(1, k * 7) * (1 - gone) * fall;

      // The shuttle is only there while it is crossing; it is caught at the
      // selvedge and the cloth is what stays.
      const flying = clamp01((1 - k) * 6) * Math.min(1, k * 10);
      boat.position.set(here.x, SHUTTLE_Y, here.z);
      heading(boat, dir.x, dir.z);
      boat.material.opacity = weight * flying * fall;
      // BEHIND the nose, not on it. On the nose the blob sat exactly where
      // the hull's point is and the two summed into a bright smear with no
      // shape in it — the one thing this object exists to have.
      glint.position.set(here.x - dir.x * 0.46, SHUTTLE_Y + 0.004, here.z - dir.z * 0.46);
      glint.material.opacity = weight * flying * 0.42 * fall;
      glint.scale.setScalar(0.62 + 0.22 * Math.sin(t * SPAN * 26));

      // THE LANDING. The card's edge takes the light for a moment and a ring
      // goes out — the two countable events, one per pass.
      const hit = Math.max(0, 1 - Math.abs(k - 1.04) / 0.30) ** 1.4;
      // THE WHOLE BAND SNAPS, not just its ends. Cloth pulled tight goes
      // bright along its length for an instant, and it is that flash — twice,
      // on the same stroke — that carries the card in motion. Without it the
      // landing was two small events at the card's border and the eye, which
      // was following the shuttle, had already left.
      band.material.color.copy(WARM).lerp(TAUT, hit * 0.75);
      edge.material.opacity = weight * hit * 0.95 * fall;
      edge.scale.setScalar(1 + 0.05 * (1 - hit));
      // THE RING OUTLIVES ITS OWN PASS ON PURPOSE. Tied to the crossing it
      // was born and dead inside a fifth of a second, which is shorter than
      // the gap between the passes — so the first ring had always vanished
      // before the second appeared and the board never once held two of them
      // at the same time. Two rings on screen together, a big faint one and a
      // small bright one chasing it, is the single clearest statement this
      // motif makes, and it only exists if a ring lives longer than GAP.
      const e = clamp01((t - delay - RUN) / RING);
      // weight ** 0.55 rather than weight: the echo's ring at 48 per cent was
      // the faintest thing on the table and the pair never read as a pair.
      // The rings are the count, so the second one has to be plainly there —
      // quieter than the first, but not nearly gone.
      ring.material.opacity = weight ** 0.55 * 0.82 * Math.sin(Math.PI * e ** 0.62) * fall;
      // It is BORN AT THE CARD'S OWN EDGE, not at its middle. The ring in
      // this map sits at four fifths of the quad, so a scale of 0.5 put a
      // circle a third the width of a card underneath the card — the first
      // third of every ring's life happened where nothing could see it, and
      // the birth, which is the countable moment, was invisible.
      ring.scale.setScalar(CARD_W * (1.25 + 1.95 * easeOut(e)));
    };
  };

  // The first pass is the action. The second is the same run at a third of
  // the weight, a hair to one side — an eighth of a unit, which is four
  // pixels, the way a misregistered print doubles rather than the way two
  // threads sit side by side.
  const first = pass(P1, 1.0, 0);
  // The drift is measured ON SCREEN, not in the world. `side` here points
  // very nearly along z, and depth is foreshortened to about two thirds at
  // this camera, so a fifth of a unit put the echo five pixels off the
  // original — inside the band's own width, where it merged into a single
  // thick stroke. 0.38 lands the two edge to edge: plainly doubled, still
  // plainly the same line.
  const second = pass(P1 + GAP, 0.48, 0.38);

  kit.hold(g, SPAN, (t) => { first(t); second(t); });

  /* ----------------------------------------------------------- the lights */

  // One small lamp per landing, and they are SMALL: two flashes on a card
  // this size blew the art out to white the first time round, and a card you
  // cannot read is a worse answer than no effect at all. High, because down
  // at the face the falloff put a hot spot in the middle of the picture.
  const lamp = (when, power) => kit.after(when * SPAN, () => {
    kit.light(new THREE.Vector3(p.x, FACE + 0.9, p.z), look.spark,
      { power, seconds: 0.28, reach: 3.4 });
  });
  lamp(P1 + RUN, 3.0);
  lamp(P1 + GAP + RUN, 1.6);
}

/**
 * Nothing this motif touches leaves the board — all three cards are constant
 * abilities on fighters that stay where they are — so there is no kill wait
 * to declare and no exit to own.
 */
export const timing = { kill: 0 };
