// THE LIGHTNING BOLT — what the cloth does once it has hold of them.
//
// The unrolling and the winding are shared (../cloth-kit.js); this file owns
// only the ending, and the colours it asks the cloth to take on as it grips.
//
// This is the one bolt that takes its OWN fighter: the cloth grips, the charge
// runs up it, and they are gone from one square and standing in another.
//
// Nothing of the first discharge survives. It was a dozen 3cm boxes fanned out
// of a single point, and a box seen end-on at this camera is a matchstick, so
// twelve of them read as a spiky ball rather than as electricity. What is here
// instead is a filament system: paths built by midpoint displacement and torn
// up and REBUILT every ~30ms, drawn as hairlines with a halo of blobs threaded
// along the same points. Real electricity is thin, forked, and gone before you
// can look at it — so the opacity jumps between full and a quarter rather than
// ramping down, because a fading arc is a dimmer switch and not a spark.
//
// The shape of the whole thing is converge, jump, spread. The charge climbs in
// off the surrounding flagstones and meets at one point over their head; a
// single forked bolt leaps the gap; it splashes out over the stone where they
// land. Nothing radiates out of a point, which is the read that was thrown away.

import { THREE, CARD_W, CARD_H, easeOut, easeIn } from '../kit.js';
import { blobTexture } from '../../textures.js';
import { stage, ring, puff, glowAt } from '../cloth-kit.js';

const UP = new THREE.Vector3(0, 1, 0);
const CORE = 0xfffdf0;                 // the filament itself is very nearly white
const GLOW = 'rgba(255,218,54,1)';     // the yellow it throws around itself

/* --------------------------------------------------------- drawing arcs */

/**
 * A jagged run from `a` to `b` by midpoint displacement.
 *
 * `amp` is the kink as a fraction of the span being split, and it more than
 * halves every pass, so the line is rough at every scale at once. That is the
 * whole difference between electricity and a hand-drawn zigzag: a zigzag has
 * one wavelength, an arc has all of them.
 */
function jag(a, b, amp, depth) {
  let pts = [a.clone(), b.clone()];
  const u = new THREE.Vector3(), v = new THREE.Vector3(), d = new THREE.Vector3();
  for (let pass = 0; pass < depth; pass++) {
    const next = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1], q = pts[i];
      d.copy(q).sub(p);
      const len = d.length();
      if (len > 1e-4) {
        d.divideScalar(len);
        u.set(-d.z, 0, d.x);                      // a level perpendicular…
        if (u.lengthSq() < 1e-6) u.set(1, 0, 0);  // …unless the run is vertical
        u.normalize();
        v.copy(d).cross(u).normalize();
        // Split off-centre. Splitting at the exact middle every time leaves a
        // ladder of evenly spaced kinks that the eye picks out as a pattern.
        const m = p.clone().lerp(q, 0.36 + Math.random() * 0.28);
        const roll = Math.random() * Math.PI * 2;
        const k = amp * len * (0.35 + Math.random() * 0.75);
        m.addScaledVector(u, Math.cos(roll) * k).addScaledVector(v, Math.sin(roll) * k);
        next.push(m);
      }
      next.push(q);
    }
    pts = next;
    amp *= 0.52;
  }
  return pts;
}

/** A run threaded through a list of control points, jagged between each pair. */
function through(ctrl, amp, depth) {
  const out = [ctrl[0].clone()];
  for (let i = 1; i < ctrl.length; i++) {
    const seg = jag(ctrl[i - 1], ctrl[i], amp, depth);
    for (let j = 1; j < seg.length; j++) out.push(seg[j]);
  }
  return out;
}

/**
 * Forks off a run already built: shorter, and leaving at an angle.
 *
 * A fork has to break away from its parent's heading or it just thickens the
 * line, so the direction is the parent's tangent swung 30-90 degrees — never a
 * fresh random one, which reads as a second unrelated arc starting by accident.
 */
function fork(path, into, count, reach, floor) {
  for (let i = 0; i < count; i++) {
    if (path.length < 3) return;
    const n = 1 + Math.floor(Math.random() * (path.length - 2));
    const from = path[n];
    const dir = from.clone().sub(path[n - 1]);
    if (dir.lengthSq() < 1e-8) continue;
    dir.normalize().applyAxisAngle(UP, (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random()));
    dir.y = dir.y * 0.35 + (Math.random() - 0.5) * 0.5;
    if (dir.lengthSq() < 1e-8) continue;
    const to = from.clone().addScaledVector(dir.normalize(), reach * (0.25 + Math.random() * 0.8));
    if (floor != null && to.y < floor) to.y = floor;
    into.push(jag(from, to, 0.34, 2));
  }
}

const MAX = 512;   // segments (and halo sprites) one discharge may hold

// One canvas per colour, kept for the life of the page. `blobTexture` paints a
// fresh 128px canvas every call and a Material.dispose() does not take its map
// with it, so building these per discharge quietly left eight textures behind
// on every cast of the card.
const BLOBS = new Map();
function blob(colour) {
  let t = BLOBS.get(colour);
  if (!t) {
    t = blobTexture(colour, colour.replace(/,\s*1\)$/, ',0)'));
    BLOBS.set(colour, t);
  }
  return t;
}

/**
 * A discharge: `make(t)` hands back a list of runs, and it is called again and
 * again for the life of the effect so the arc never holds still.
 *
 * Three layers over one path. The core is a GL line, which is one pixel however
 * wide you ask for it, and for once that is exactly right: a quad thick enough
 * to see is already thicker than lightning. On its own, though, a hairline
 * reads as a scratch on the lens — the first cut of this had no body at all —
 * so the same points also carry a tight white-hot bloom and a wide yellow one.
 *
 * Point size is world units scaled by distance, and at this camera one world
 * unit comes out at about twelve pixels, so these numbers read oddly for a
 * table 2.6 units to a square: `dot` 0.45 is a 5px glow. Keeping it near that
 * matters — at 0.8 the blooms of neighbouring nodes merged and every arc came
 * out as a fat glowing rope with its kinks smoothed away, which is a lava
 * flow. The filament has to stay narrower than the card is thick.
 */
function filaments(kit, when, seconds, make, {
  glow = GLOW, dot = 0.45, rate = 0.032, hold = 0.6, dim = 0.28,
} = {}) {
  stage(kit, when, seconds, () => {
    const lpos = new Float32Array(MAX * 6);
    const lgeo = new THREE.BufferGeometry();
    lgeo.setAttribute('position', new THREE.BufferAttribute(lpos, 3));
    const lmat = new THREE.LineBasicMaterial({
      color: CORE, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const lines = new THREE.LineSegments(lgeo, lmat);
    lines.frustumCulled = false;   // the buffer is rewritten every frame

    const hpos = new Float32Array(MAX * 3);
    const hgeo = new THREE.BufferGeometry();
    hgeo.setAttribute('position', new THREE.BufferAttribute(hpos, 3));
    const hmat = new THREE.PointsMaterial({
      map: blob(glow),
      size: dot, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, sizeAttenuation: true,
    });
    const halo = new THREE.Points(hgeo, hmat);
    halo.frustumCulled = false;
    // the white-hot part, on the SAME points — a bloom with no core in it is
    // a smoke trail, and a core with no bloom is a scratch
    const cmat = new THREE.PointsMaterial({
      map: blob('rgba(255,253,235,1)'),
      size: dot * 0.5, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, sizeAttenuation: true,
    });
    const hot = new THREE.Points(hgeo, cmat);
    hot.frustumCulled = false;

    const grp = new THREE.Group();
    grp.add(lines, halo, hot);

    let last = -1;
    return {
      obj: grp,
      tick: (t) => {
        const life = t * seconds;
        if (life - last >= rate) {
          last = life;
          let s = 0, h = 0;
          for (const run of make(t)) {
            for (let i = 1; i < run.length && s < MAX; i++, s++) {
              const a = run[i - 1], b = run[i];
              lpos[s * 6 + 0] = a.x; lpos[s * 6 + 1] = a.y; lpos[s * 6 + 2] = a.z;
              lpos[s * 6 + 3] = b.x; lpos[s * 6 + 4] = b.y; lpos[s * 6 + 5] = b.z;
            }
            // A blob on EVERY node. Taking every other one left the bloom
            // beaded instead of reading as one thread of light.
            for (let i = 0; i < run.length && h < MAX; i++, h++) {
              hpos[h * 3 + 0] = run[i].x; hpos[h * 3 + 1] = run[i].y; hpos[h * 3 + 2] = run[i].z;
            }
          }
          lgeo.setDrawRange(0, s * 2);
          hgeo.setDrawRange(0, h);
          lgeo.attributes.position.needsUpdate = true;
          hgeo.attributes.position.needsUpdate = true;
        }
        // Flicker, not fade. The arc is either lit or it is barely there, and
        // only the last stretch of its life pulls the ceiling down.
        const left = t < hold ? 1 : 1 - (t - hold) / (1 - hold);
        const f = Math.random() < 0.26 ? dim : 1;
        lmat.opacity = left * f;
        hmat.opacity = left * f * 0.75;
        cmat.opacity = left * f;
      },
    };
  });
}

/* ------------------------------------------------------------- the blink */

/** Your own fighter is crackled out of one square and into another. */
export function blink(kit, when, at, dest, look) {
  const src = at.clone();
  const to = (dest || at).clone();
  // The wrap is a dome about 0.9 tall and blazing white by now, so the charge
  // gathers clear ABOVE its peak — arcs laid over that cocoon are invisible.
  const apex = src.clone().setY(src.y + 1.22);
  // The leap ends ON the far square, not in the air over it. Stopping it at
  // head height left a hand's gap between the bolt and the crackle that was
  // supposed to be the same current, and read as two effects.
  const land = to.clone().setY(to.y + 0.04);

  const GO = 0.22;    // the charge closes and they are gone
  const HIT = 0.33;   // the leap arrives

  /* ------------------------------------------------------------- charge */

  // Off the surrounding flagstones, up and IN, meeting over their head. The
  // feet start out on the neighbouring stone and walk inward as the charge
  // builds, so it reads as a cage closing on them.
  //
  // They have to stand OFF the wrap to be seen at all. The first cut ran them
  // along the cloth at the cocoon's own radius and every one of them was lost
  // against a dome the cloth had just flashed white; only the two on the
  // silhouette showed, as a pair of lamps either side of the card.
  filaments(kit, when, GO + 0.08, (t) => {
    const runs = [];
    const close = easeIn(t);
    // Angles are stratified, not free: with five free draws they clumped on one
    // side of the card and the cage read as a single swoosh over the cocoon.
    for (let i = 0, n = 5; i < n; i++) {
      const a = (i + 0.1 + Math.random() * 0.8) / n * Math.PI * 2;
      const r = (1.8 - close * 0.9) * (0.7 + Math.random() * 0.6);
      const foot = new THREE.Vector3(Math.cos(a) * r, 0.02, Math.sin(a) * r).add(src);
      const belly = new THREE.Vector3(Math.cos(a) * r * 0.5, 0.7, Math.sin(a) * r * 0.5).add(src);
      // Only some of them make it to the point. Five arcs that all reach the
      // same place, from the same radius, is a wheel of spokes seen from above
      // — which is the starburst again, drawn thinner. The short ones die on
      // the wrap and break the pattern up.
      const end = Math.random() < 0.45
        ? new THREE.Vector3(Math.cos(a) * 0.3, 0.55 + Math.random() * 0.4, Math.sin(a) * 0.3).add(src)
        : apex;
      const run = through([foot, belly, end], 0.16, 3);
      runs.push(run);
      if (Math.random() < 0.7) fork(run, runs, 1, 0.38, src.y + 0.01);
    }
    return runs;
  }, { rate: 0.03, hold: 0.72, dot: 0.42 });

  // The point it gathers to. This is a sprite and not more filaments because
  // SOMETHING has to be solid white at the instant they go — with arcs alone
  // the departure read as the lines merely stopping.
  stage(kit, when + 0.02, GO + 0.20, () => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: blob('rgba(255,255,236,1)'),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    s.position.copy(apex);
    const span = GO + 0.20;
    return {
      obj: s,
      tick: (t) => {
        const life = t * span;
        const k = Math.min(1, life / GO);
        const burst = Math.max(0, life - GO) / 0.20;
        s.scale.setScalar(0.2 + k * 0.7 + easeOut(burst) * 2.4);
        s.material.opacity = burst > 0
          ? (1 - burst) ** 1.7
          : (0.3 + 0.7 * k) * (Math.random() < 0.2 ? 0.45 : 1);
      },
    };
  });

  // The card's own footprint is what actually leaves: it whites out and is
  // drawn up into the apex, narrowing as it goes. The version that simply
  // faded a plate in place looked like a card being switched off; a plate that
  // is TAKEN upward reads as the bolt having them.
  stage(kit, when + 0.02, GO + 0.02, () => {
    const g = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD_W, CARD_H),
      new THREE.MeshBasicMaterial({
        color: 0xfff4c4, transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      }),
    );
    g.rotation.x = -Math.PI / 2;
    // +0.055, not +0.03: closer than that and the plate loses the depth test
    // against the card it is sitting on, so it draws on the stone AROUND the
    // card and vanishes over the one thing it is meant to be lighting up.
    g.position.copy(src).setY(src.y + 0.055);
    return {
      obj: g,
      tick: (t) => {
        const k = easeIn(t);
        g.position.y = src.y + 0.055 + k * 0.84;
        g.scale.set(1 - k * 0.9, 1 - k * 0.72, 1);
        // kept well under 1: additive white at full strength turned the card
        // into a blank slab of paper, which is not a fighter going anywhere
        g.material.opacity = (0.12 + 0.5 * t) * (Math.random() < 0.18 ? 0.5 : 1);
      },
    };
  });

  glowAt(kit, when, apex, look.colour, { power: 15, seconds: GO, reach: 5.5, flicker: 0.55 });
  glowAt(kit, when + GO, apex, 0xfff2b0, { power: 36, seconds: 0.22, reach: 7.5 });
  // tight and quick: the ground mark of a departure, not an explosion
  ring(kit, when + GO, src, 0xffee9c, { size: 1.5, seconds: 0.3, thick: 0.07 });
  puff(kit, when + GO, src, GLOW, {
    count: 9, spread: 0.45, rise: 2.4, seconds: 0.42, size: 0.2, drag: 1.5,
  });

  /* --------------------------------------------------------------- leap */

  if (dest) {
    // One bolt across the gap. This is the line that makes the two ends a
    // single event instead of two yellow flashes in different places, so it is
    // built as one long run with a handful of forks dying off it — not as a
    // beam, and not as a stream of particles.
    filaments(kit, when + GO, (HIT - GO) + 0.06, () => {
      const mid = apex.clone().lerp(land, 0.38 + Math.random() * 0.24);
      mid.y = apex.y + 0.25 + Math.random() * 0.3;
      const run = through([apex, mid, land], 0.1, 5);
      const runs = [run];
      fork(run, runs, 3, 0.8, src.y + 0.02);
      return runs;
    }, { rate: 0.03, hold: 0.42, dot: 0.5 });

    glowAt(kit, when + GO + 0.02, apex.clone().lerp(land, 0.5).setY(apex.y + 0.3),
      look.colour, { power: 22, seconds: 0.16, reach: 9 });
  }

  // What is left behind. The current has to go somewhere once they are not
  // there to carry it, and a couple of low arcs earthing themselves on the
  // empty square stops the departure from being a flash that simply stops.
  filaments(kit, when + GO + 0.12, 0.22, () => {
    const runs = [];
    const floor = src.y + 0.05;
    for (let i = 0; i < 3; i++) {
      const a = (i + Math.random()) / 3 * Math.PI * 2;
      // out past the card: under the cloth still reeling off the square there
      // is nothing to see, so these have to reach the open stone
      const r = 0.8 + Math.random() * 0.9;
      const head = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r).add(src).setY(floor);
      const run = through([src.clone().setY(floor + 0.25), head], 0.24, 3);
      for (const p of run) if (p.y < floor) p.y = floor;
      runs.push(run);
    }
    return runs;
  }, { rate: 0.04, hold: 0.3, dot: 0.38 });

  /* ------------------------------------------------------------ arrival */

  // It strikes the square and runs OUT over the stone — the mirror of the
  // charge, so the arrival reads as the same current arriving rather than as a
  // second effect that happens to be the same colour.
  filaments(kit, when + HIT, 0.46, (t) => {
    const runs = [];
    const grow = easeOut(Math.min(1, 0.3 + t * 1.9));   // violent from the first frame
    // Above the arrival flash, not under it: run along the card face, and the
    // plate's own glare swallowed the whole discharge.
    const floor = to.y + 0.075;
    for (let i = 0, n = 5; i < n; i++) {
      const a = (i + Math.random()) / n * Math.PI * 2;
      const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      const side = new THREE.Vector3(-dir.z, 0, dir.x);
      // long enough to get OFF the card: a discharge that stops at the card's
      // edge reads as a squiggle drawn on it rather than as current in the floor
      const reach = grow * (i % 2 ? 1.2 + Math.random() * 0.9 : 0.5 + Math.random() * 0.6);
      // Every run starting from the dead centre piled five blooms on the same
      // few pixels and left a bright knot on the card with arcs hanging off it.
      // Scattering the roots over the card's own footprint breaks that up.
      const root = to.clone().setY(floor)
        .addScaledVector(dir, 0.1 + Math.random() * 0.4)
        .addScaledVector(side, (Math.random() - 0.5) * 0.5);
      // The sideways wander is kept under half the reach. At 0.8 the runs hooked
      // right back on themselves and the arrival came out as loops of rope
      // lying on the card — a doodle, not a discharge.
      const bow = root.clone().addScaledVector(dir, reach * 0.55)
        .addScaledVector(side, (Math.random() - 0.5) * reach * 0.45);
      bow.y += 0.07 + Math.random() * 0.13;              // it hops, then comes back down
      const head = root.clone().addScaledVector(dir, reach)
        .addScaledVector(side, (Math.random() - 0.5) * reach * 0.3);
      const run = through([root, bow, head], 0.14, 3);
      for (const p of run) if (p.y < floor) p.y = floor;   // it crawls, it does not dive
      runs.push(run);
      if (Math.random() < 0.7) fork(run, runs, 1, 0.45, floor);
    }
    return runs;
  }, { rate: 0.034, hold: 0.42, dot: 0.42 });

  // …and the mirror of the departure: the streak drops out of the air and
  // opens back into a card-sized plate on the square they arrive at.
  stage(kit, when + HIT - 0.05, 0.26, () => {
    const g = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD_W, CARD_H),
      new THREE.MeshBasicMaterial({
        color: 0xfff4c4, transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      }),
    );
    g.rotation.x = -Math.PI / 2;
    return {
      obj: g,
      tick: (t) => {
        const drop = easeOut(Math.min(1, t / 0.26));
        g.position.copy(to).setY(to.y + 0.055 + (1 - drop) * 0.85);   // clears the card's own face
        g.scale.set(0.1 + drop * 0.9, 0.24 + drop * 0.76, 1);
        // Held well below full: at opacity 1 this additive plate covered the
        // square in a blank white rectangle the exact size of a card, which
        // read as a bug rather than as a fighter arriving.
        g.material.opacity = (t < 0.26 ? drop * 0.24 : (1 - (t - 0.26) / 0.74) ** 1.5 * 0.24)
          * (Math.random() < 0.25 ? 0.5 : 1);
      },
    };
  });

  // High and weak. A point light falls off with the square of the distance, so
  // parked 0.7 over a flat card at power 24 it was effectively at intensity 50
  // and bleached the card, the plate and the whole discharge into one white
  // rectangle — the arrival had no arcs in it at all, only glare.
  glowAt(kit, when + HIT, to.clone().setY(to.y + 1.35), 0xfff2b0,
    { power: 13, seconds: 0.26, reach: 7.5 });
  glowAt(kit, when + HIT + 0.1, to.clone().setY(to.y + 0.9), look.colour,
    { power: 9, seconds: 0.4, reach: 6, flicker: 0.5 });
  ring(kit, when + HIT, to, 0xffee9c, { size: 2.3, seconds: 0.42, thick: 0.1 });
  puff(kit, when + HIT, to, look.glow, {
    count: 14, spread: 0.85, rise: 1.9, seconds: 0.5, size: 0.26, drag: 1.1,
  });
}
