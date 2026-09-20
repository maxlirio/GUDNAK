// VOLLEY — the Refractory tactic Barrage: a fusillade loosed around one of
// your own fighters, killing every weak enemy standing next to it.
//
// One effect, one file.
//
// Preview:  node tools/shot.js --url "game/?quick=1&seed=5&t=260&n=4" \
//             --eval tools/fxdemo/volley.js --out /tmp/vo.png --settle 300
// `t` is the point in the MOTIF to freeze at; see the harness for why --settle
// alone lies about where on the timeline a screenshot was taken.
//
// The faction's other motifs are the chain and the brand — slow, ceremonial,
// one card at a time. This is the loud one, so it is built out of the opposite
// material: nothing here is ceremonial, nothing waits, and the shape of it is
// a CADENCE. Rounds leave one at a time, rake round the fighter, and the
// impacts arrive as a roll of hits rather than one thump.
//
// Four things had to be true before it read as a volley at all:
//
//   ROUNDS, PLURAL.  One shot per square is an attack; two or three per square,
//     overlapping, is a barrage. A lone target gets three so the tactic never
//     degenerates into a single bullet.
//   A SWEEP.  The targets are fired in angular order round the shooter and the
//     next pass rakes back the other way, so the fan has a direction instead of
//     everything going off at once.
//   FORCE AT BOTH ENDS.  Rounds leave the EDGE of the shooter's card facing the
//     square they are for, with a flare, and knock the card back; at the far end
//     a flash, a ring snapped across the square, a shrapnel star thrown away
//     from the shooter, and a flinch from the card taking it. Travel on its own
//     reads as drifting.
//   GOLD, NOT WHITE.  The first pass was additive white on every layer and it
//     clipped to a flat glare that could have belonged to any faction. Only the
//     nose of a round and the first instant of an impact are white now; the
//     body of everything is amber, and opacities are kept low enough that the
//     colour survives being stacked.
//
// NOTHING HERE SCHEDULES FROM INSIDE A TICK. Every piece is built up front and
// gated on absolute motif seconds, which is also why each round's whole life —
// flare, flight, impact — is one hold: a `t` of 0..1 over that round's own span
// is the same clock for all of them.

import { THREE, FACTION, easeOut } from '../kit.js';
import { blobTexture } from '../../textures.js';

/* ------------------------------------------------------------- materials */

/**
 * Soft sprite maps, kept by colour. A barrage builds sixty-odd sprites and
 * every one of them wanted a fresh 128px canvas and a texture upload for a
 * picture that never changes. kit.hold disposes materials but never their
 * maps, so these outlive every volley.
 */
const blobs = new Map();
function blob(inner, outer) {
  const key = `${inner}|${outer}`;
  let t = blobs.get(key);
  if (!t) { t = blobTexture(inner, outer); blobs.set(key, t); }
  return t;
}
const alpha = (rgba, a) => rgba.replace(/[\d.]+\)$/, `${a})`);

function mote(glow, size) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: blob(glow, alpha(glow, 0)), transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, opacity: 0,
  }));
  s.scale.setScalar(size);
  return s;
}

/**
 * Where a motif's flat parts lie. `kit.at` answers 0.4 for a bare square but
 * about 0.2 for a card, whose face is at ~0.22 — so anything drawn at the raw
 * height either floated well above an empty square or sank into an occupied
 * one. Clamp to just clear of a card face either way.
 */
const flatY = (p) => Math.min(p.y, 0.225) + 0.028;

const CORE = 'rgba(255,248,224,1)';   // white-hot: the nose, the first instant
const GOLD = 'rgba(255,186,88,1)';    // Refractory gold: halo, debris, embers

/**
 * The one shape everything here is cut from: a tapered ribbon of light, given
 * as cuts across it — [z, half-width, r, g, b] — and built twice, once flat
 * and once upright, crossed along +Z. `lookAt` therefore aims it.
 *
 * Camera-facing sprites were the first version's whole problem. From a camera
 * this high a sprite has no direction in it, so the shots read as beads
 * sliding along a wire and the impacts as puffs of smoke. Crossed quads keep
 * their line whether you are looking along them or across them, and the vertex
 * colours do the head-to-tail falloff that no sprite can.
 */
function shard(cuts) {
  const pos = [], col = [], idx = [];
  for (let plane = 0; plane < 2; plane++) {
    const base = pos.length / 3;
    for (const [z, h, r, g, b] of cuts) {
      if (plane) pos.push(0, -h, z, 0, h, z);
      else pos.push(-h, 0, z, h, 0, z);
      col.push(r, g, b, r, g, b);
    }
    for (let i = 0; i < cuts.length - 1; i++) {
      const v = base + i * 2;
      idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  }));
  mesh.frustumCulled = false;
  return mesh;
}

// A round in flight: a white point, a hot amber waist, and a tail gone by 1.2
// units — about half the gap between two squares, long enough to read as
// motion and short enough that four in the air are still four things. It is
// narrow on purpose; the fat first version blotted out the card it crossed.
const TRACER = [
  [0.16, 0.024, 1.00, 0.98, 0.88],
  [0.02, 0.060, 1.00, 0.76, 0.34],
  [-0.30, 0.048, 1.00, 0.52, 0.12],
  [-0.68, 0.024, 0.52, 0.24, 0.04],
  [-1.20, 0.002, 0, 0, 0],
];

// The muzzle flare: a stubby cone thrown FORWARD off the card's edge. It is
// what says a shot was fired rather than spawned.
const FLARE = [
  [0.00, 0.034, 1.00, 0.98, 0.90],
  [0.15, 0.150, 1.00, 0.80, 0.42],
  [0.38, 0.185, 1.00, 0.58, 0.18],
  [0.64, 0.085, 0.45, 0.24, 0.05],
  [0.88, 0.000, 0, 0, 0],
];

// One arm of the shrapnel star at an impact, brightest where it leaves the
// card. Five splayed backwards give the hit a silhouette; a sprite flash on
// its own is a blob and reads as nothing but brightness.
const SPIKE = [
  [0.00, 0.034, 1.00, 0.97, 0.86],
  [0.18, 0.026, 1.00, 0.72, 0.32],
  [0.48, 0.010, 0.52, 0.28, 0.07],
  [0.74, 0.000, 0, 0, 0],
];

/* ------------------------------------------------------------- the volley */

const V = {
  BRACE: 0.085,   // the fighter sets before the first round leaves
  BEAT: 0.048,    // between rounds inside one pass of the sweep
  TURN: 0.075,    // the extra breath before the sweep rakes back
  FLARE: 0.070,   // how long a muzzle flare lives
  HIT: 0.42,      // impact flash, shrapnel and debris
  SMOKE: 0.70,    // how long a struck square goes on smouldering
  OUT: 0.70,      // how far off the shooter's centre a round starts
};

export function volley(kit, from, targets = []) {
  const a = kit.at(from);
  if (!a) return;
  const look = FACTION.Refractory;

  const marks = [];
  for (const sq of targets) {
    const p = kit.at(sq);
    if (p) marks.push({ sq, p, first: Infinity, hits: [] });
  }
  if (!marks.length) return;

  const stand = a.clone().setY(flatY(a) + 0.26);

  // Fire in angular order round the shooter, not in whatever order the rules
  // happened to list the squares. Unsorted, four targets looked like four
  // unrelated shots; sorted, the fan visibly opens.
  marks.sort((m, n) => angle(stand, m.p) - angle(stand, n.p));

  // A lone target still has to read as a barrage, so it gets three rounds.
  const ROUNDS = marks.length === 1 ? 3 : 2;

  // The firing order: every target once, then round again the other way. The
  // reversal is what makes the second pass feel like the same weapon raking
  // back rather than a copy of the first pasted on top.
  // The extra beat between passes is the sound of the weapon reaching the end
  // of its arc and coming back. With one target there is no arc, and holding
  // it turned a three-round burst into three separate shots 120ms apart.
  const TURN = marks.length > 1 ? V.TURN : 0;

  const shots = [];
  for (let r = 0; r < ROUNDS; r++) {
    const pass = r % 2 ? marks.slice().reverse() : marks;
    pass.forEach((m, i) => {
      // Geometry is worked out here, up front, because the shooter's hold
      // below reads it and is built before the per-round holds are.
      const aim = m.p.clone().setY(flatY(m.p) + 0.15);
      const dir = aim.clone().sub(stand).setY(0).normalize();
      // The round leaves the EDGE of the card facing its square. Fired from
      // the middle they all erupted out of the fighter's own portrait, which
      // is where the old version's shots looked like they were spawning.
      const muzzle = stand.clone().addScaledVector(dir, V.OUT);
      // A few per cent of speed jitter: identical flight times made the
      // second pass land in perfect lockstep with the first.
      const fly = (0.080 + muzzle.distanceTo(aim) * 0.026) * (0.93 + Math.random() * 0.14);
      const go = V.BRACE + r * TURN + (r * marks.length + i) * V.BEAT;
      m.first = Math.min(m.first, go + fly);
      m.hits.push(go + fly);
      shots.push({
        mark: m, aim, dir, muzzle, fly, go,
        back: dir.clone().negate(),
        side: new THREE.Vector3(-dir.z, 0, dir.x),
        // Rounds at the same square must not fly the same line or the second
        // one is invisible behind the first.
        bow: (r - (ROUNDS - 1) / 2) * 0.17 + (Math.random() - 0.5) * 0.06,
        loft: 0.09 + Math.random() * 0.06,
        lamp: r === 0,          // one light per square, not one per round
      });
    });
  }
  const last = shots[shots.length - 1];
  const SPAN = last.go + last.fly + V.HIT;

  /* ---- the shooter: a stance ring, the muzzle light, and the recoil ---- */

  kit.ring(a.clone().setY(flatY(a)), look.spark, { size: 0.5, seconds: 0.28 });

  // Held well above the card and kept near the braziers' own strength. The
  // first pass sat this at the muzzle with intensity 6: a point light 26cm off
  // a card face is an irradiance ten times a brazier's, and it bleached the
  // shooter's own portrait white for the length of the volley.
  const lamp = new THREE.PointLight(0xffdca6, 0, 4.5, 2);
  lamp.position.copy(stand).setY(stand.y + 0.7);
  const home = kit.piece(from)?.restingPosition?.() || a.clone();
  let held = null;                        // the last position we wrote
  kit.hold(lamp, SPAN, (t) => {
    const s = t * SPAN;
    // The brace: the fighter sets its weight into the ground and comes back
    // up as the first round leaves. Without it the 85ms before the first shot
    // was dead screen time and the volley began out of nowhere.
    const set = s < V.BRACE ? Math.sin((s / V.BRACE) * Math.PI) : 0;

    // Both the light and the kick are a SUM over the rounds already fired, so
    // a fast pair stacks into one harder jolt instead of the second cancelling
    // the first's recovery.
    let flash = 0;
    const kick = new THREE.Vector3();
    for (const sh of shots) {
      const x = s - sh.go;
      if (x < 0) continue;
      const decay = Math.exp(-x * 17);
      flash += decay;
      kick.addScaledVector(sh.back, 0.05 * decay);
    }
    lamp.intensity = Math.min(2.4, flash) * 4.5;

    const p = kit.piece(from);
    if (!p) return;
    // Set every tick, not once: the board's own move tween clears this flag
    // when it ends and the card snapped home mid-volley.
    p.animating = true;
    p.group.position.copy(home).add(kick);
    p.group.position.y = home.y + Math.min(0.045, kick.length() * 0.45) - 0.03 * set;
    held = p.group.position.clone();
  }, () => {
    // Hand the card back only if nothing else has taken it since. Barrage
    // kills what it hits and the board's own destroy tween starts on top of
    // this one; restoring blind would have yanked a dying card back onto its
    // square mid-flight to the discard pile.
    const p = kit.piece(from);
    if (p && held && p.group.position.distanceTo(held) < 1e-4) {
      p.group.position.copy(home);
      p.animating = false;
    }
  });

  /* ---- each struck square: the flinch, and what smoulders afterwards ---- */

  for (const m of marks) {
    const rest = kit.piece(m.sq)?.restingPosition?.() || null;
    const away = m.p.clone().sub(a).setY(0).normalize();
    const base = m.p.clone().setY(flatY(m.p) + 0.03);   // clears the card face

    // A struck square goes on smouldering after the flash, and it is embers
    // RISING that say so. One steady blob of gold was tried first and was
    // invisible against the card art underneath it — additive gold on a lit
    // painting is just a slightly brighter painting. Things that MOVE are
    // read; things that merely glow are not.
    const smoke = new THREE.Group();
    const glow = mote(GOLD, 0.8);
    glow.position.copy(base);
    smoke.add(glow);
    const emb = [];
    for (let i = 0; i < 7; i++) {
      const e = mote(GOLD, 0.17 + Math.random() * 0.09);
      e.userData = {
        off: new THREE.Vector3((Math.random() - 0.5) * 1.1, 0, (Math.random() - 0.5) * 1.1),
        rise: 0.75 + Math.random() * 0.75,
        drift: (Math.random() - 0.5) * 0.3,
        phase: Math.random() * 6.3,
      };
      emb.push(e);
      smoke.add(e);
    }

    const life = m.first + V.SMOKE;
    kit.hold(smoke, life, (t) => {
      const s = t * life;
      // Heat and jolt are both sums over the rounds that have landed here, so
      // a square taking a second round flares and flinches again instead of
      // quietly cooling through it.
      let heat = 0;
      for (const h of m.hits) {
        const x = s - h;
        if (x >= 0) heat += Math.exp(-x * 2.6);
      }
      glow.material.opacity = 0.22 * Math.min(1.5, heat);
      glow.scale.setScalar(0.7 + Math.min(1, heat) * 0.5);

      const x = s - m.first;
      for (const e of emb) {
        const u = e.userData;
        if (x < 0) { e.material.opacity = 0; continue; }
        e.position.copy(base).add(u.off);
        e.position.y += u.rise * x;
        e.position.x += u.drift * x;
        const flick = 0.72 + 0.28 * Math.sin(x * 19 + u.phase);
        // Not scaled by `heat`: tied to it the embers were down at a tenth of
        // an opacity within 300ms and simply could not be seen on the card art.
        e.material.opacity = 0.85 * flick * (1 - Math.min(1, x / V.SMOKE)) ** 1.3;
      }
    });

    // The flinch is a SEPARATE, short hold. Folded into the smoulder above it
    // pinned the struck card for a second — long enough for the board's own
    // destroy tween to start underneath it and be fought frame by frame.
    if (!rest) continue;
    const shake = m.hits[m.hits.length - 1] + 0.34;
    let held2 = null;
    kit.hold(new THREE.Object3D(), shake, (t) => {
      const s = t * shake;
      let jolt = 0;
      for (const h of m.hits) {
        const x = s - h;
        if (x >= 0) jolt += Math.exp(-x * 9) * Math.cos(x * 17);
      }
      const p = kit.piece(m.sq);
      if (!p) return;
      p.animating = true;
      p.group.position.copy(rest).addScaledVector(away, 0.06 * jolt);
      p.group.position.y = rest.y - 0.05 * jolt;
      held2 = p.group.position.clone();
    }, () => {
      const p = kit.piece(m.sq);
      if (p && held2 && p.group.position.distanceTo(held2) < 1e-4) {
        p.group.position.copy(rest);
        p.animating = false;
      }
    });
  }

  /* ---- one hold per round: flare, flight, impact ---- */

  for (const sh of shots) {
    const mark = sh.aim;
    const b = sh.mark.p;
    const life = sh.go + sh.fly + V.HIT;

    const g = new THREE.Group();             // identity: children are placed
    const at = (k) => {                      // in world coordinates
      const q = sh.muzzle.clone().lerp(mark, k);
      q.addScaledVector(sh.side, Math.sin(Math.PI * k) * sh.bow);
      q.y += Math.sin(Math.PI * k) * sh.loft;
      return q;
    };

    const flare = shard(FLARE);
    flare.position.copy(sh.muzzle);
    flare.lookAt(mark);
    g.add(flare);

    const round = shard(TRACER);
    const head = mote(CORE, 0.17);           // the hot point, and an amber
    const halo = mote(GOLD, 0.44);           // halo that sells it as burning
    head.position.z = 0.1; halo.position.z = 0.08;
    round.add(halo, head);
    g.add(round);

    /* impact */
    const flash = mote(CORE, 0.24);          // white for one frame only
    const bloom = mote(GOLD, 0.42);          // the gold that outlives it
    flash.position.copy(mark);
    bloom.position.copy(mark);
    g.add(flash, bloom);

    // A hard ring across the square itself. kit.ring draws at y = 0.1 and a
    // card face is at 0.25, so the shared one is UNDER the card and only its
    // rim clears the edges — which is why the impacts had no spread on them
    // at the size this is actually played at. This one lies on the card.
    const shock = new THREE.Mesh(
      new THREE.RingGeometry(0.62, 0.78, 36),
      new THREE.MeshBasicMaterial({
        color: 0xffc274, transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      }),
    );
    shock.rotation.x = -Math.PI / 2;
    // A full 0.03 of its own on top of flatY's clearance. Less than about
    // 0.055 over a card face loses the depth test and the ring draws only on
    // the stone around the card, which is the same bug that put kit.ring's
    // rings under the cards in the first place.
    shock.position.copy(b).setY(flatY(b) + 0.03);
    g.add(shock);

    // The shrapnel star and the debris both go BACKWARD, the way the round
    // came from. Spray thrown evenly in all directions has no shooter in it.
    const spikes = [];
    for (let i = 0; i < 5; i++) {
      const s = shard(SPIKE);
      const yaw = (i - 2) * 0.45 + (Math.random() - 0.5) * 0.2;
      const out = sh.back.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      s.position.copy(mark);
      s.lookAt(mark.clone().add(out).setY(mark.y + 0.3 + Math.random() * 0.5));
      spikes.push(s);
      g.add(s);
    }

    const bits = [];
    for (let i = 0; i < 8; i++) {
      const s = mote(GOLD, 0.18);
      s.userData = new THREE.Vector3(
        sh.back.x * (0.8 + Math.random() * 1.6) + sh.side.x * (Math.random() - 0.5) * 1.5,
        1.1 + Math.random() * 1.5,
        sh.back.z * (0.8 + Math.random() * 1.6) + sh.side.z * (Math.random() - 0.5) * 1.5,
      );
      bits.push(s);
      g.add(s);
    }

    let hitLamp = null;
    if (sh.lamp) {
      hitLamp = new THREE.PointLight(look.spark, 0, 4.2, 2);
      hitLamp.position.copy(mark).setY(mark.y + 1.0);   // see the note above
      g.add(hitLamp);
    }

    let rang = false;
    kit.hold(g, life, (t) => {
      const s = t * life;

      const f = (s - sh.go) / V.FLARE;
      // A muzzle flash is at its full size on the first frame and then
      // collapses. Grown in from nothing, as it was at first, it was a third
      // of its length at the only moment it was bright and never read at all.
      flare.material.opacity = f < 0 || f > 1 ? 0 : 0.9 * (1 - f) ** 1.8;
      flare.scale.setScalar(0.78 + f * 0.5);

      const k = (s - sh.go) / sh.fly;
      round.visible = k > 0 && k < 1;
      if (round.visible) {
        round.position.copy(at(k));
        round.lookAt(at(Math.min(1, k + 0.06)));
        // Stretched out of the muzzle rather than appearing at full length:
        // at this speed the first frame of flight is most of what you see.
        round.scale.set(1, 1, 0.45 + Math.min(1, k * 5) * 0.75);
        // Capped below 1: additive white at full strength over a lit card
        // clips every channel and the round comes out colourless, which is
        // how the whole first pass ended up looking like any faction's spell.
        // It does NOT fade on approach — it was dimmed over the last fifth of
        // the flight and every round appeared to run out of steam short of
        // the square it was about to blow apart.
        const o = 0.88 * Math.min(1, k * 8);
        round.material.opacity = o;
        head.material.opacity = 0.8 * o;
        halo.material.opacity = 0.5 * o;
      }

      const hit = (s - sh.go - sh.fly) / V.HIT;
      if (hit < 0) return;
      if (!rang) {
        rang = true;
        // The ground ring spreads onto the stone AROUND the card; the shock
        // ring above does the card face. One each, not two of the same.
        if (sh.lamp) kit.ring(b, look.spark, { size: 1.5, seconds: 0.4 });
      }

      // Held DOWN deliberately. The first pass put a flash a whole card wide
      // over every hit, which wiped out the shrapnel star, the debris and the
      // card's own art with it — all four impacts read as the same white hole.
      flash.material.opacity = 0.55 * (1 - Math.min(1, hit * 11)) ** 2;
      flash.scale.setScalar(0.5 + easeOut(Math.min(1, hit * 9)) * 0.6);

      // Snapped out and gone. Scaling a ring scales its WIDTH too, so left to
      // run it ended as a fat slow hoop drawn over the square — a piece of UI,
      // not a shockwave. It is capped at about a card's width and faded twice
      // as fast as it grows, so what you see is the leading edge leaving.
      const ring = easeOut(Math.min(1, hit * 3.6));
      shock.scale.setScalar(0.25 + ring * 1.1);
      shock.material.opacity = 0.8 * (1 - Math.min(1, hit * 5)) ** 1.6;
      bloom.material.opacity = 0.36 * (1 - Math.min(1, hit * 4)) ** 1.6;
      bloom.scale.setScalar(0.5 + easeOut(Math.min(1, hit * 5)) * 0.85);

      const sp = Math.min(1, hit * 6);
      for (const s2 of spikes) {
        s2.scale.setScalar(0.35 + easeOut(sp) * 0.85);
        s2.material.opacity = 0.85 * (1 - Math.min(1, hit * 4.5)) ** 1.5;
      }

      for (const bit of bits) {
        const v = bit.userData;
        bit.position.copy(mark);
        bit.position.x += v.x * hit;
        bit.position.z += v.z * hit;
        bit.position.y += v.y * hit - hit * hit * 2.4;
        bit.material.opacity = 0.8 * (1 - hit) ** 1.2;
        bit.scale.setScalar(0.17 * (1 - hit * 0.45));
      }

      if (hitLamp) hitLamp.intensity = 13 * (1 - Math.min(1, hit * 2.6)) ** 2;
    });
  }
}

/** Angle round the shooter, so the sweep can be put in order. */
function angle(o, p) {
  const t = Math.atan2(p.z - o.z, p.x - o.x);
  return t < 0 ? t + Math.PI * 2 : t;
}
