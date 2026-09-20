// THE ICE BOLT — what the cloth does once it has hold of them.
//
// The unrolling and the winding are shared (../cloth-kit.js); this file owns
// only the ending, and the colours it asks the cloth to take on as it grips.
//
// Ice Bolt does not kill anyone: it STRIPS A TRAIT. So the beat here is theft,
// not destruction — the air is pulled in, the wrap crusts over and goes rigid,
// one bright thing is drawn up out of them and cracked, the ice lets go with
// the cloth, and the fighter is left on a card still white with frost. That
// last second, after the cloth has gone and the rime has not, is what says
// something was taken and they are still standing.

import { THREE, CARD_W, CARD_H, easeOut, easeIn } from '../kit.js';
import { blobTexture } from '../../textures.js';
import { stage, ring, puff, glowAt } from '../cloth-kit.js';

const UP = new THREE.Vector3(0, 1, 0);
const FWD = new THREE.Vector3(0, 0, 1);

// The wrap's own dome, read off cloth-kit's band(): the crust has to sit ON the
// cloth. Placed by eye instead, the plates floated a finger clear of it and the
// ice read as a separate object hovering over a fighter rather than as the
// cloth itself going hard.
const DOME_R = Math.min(CARD_W, CARD_H) * 0.52;
const DOME_RISE = 0.9;
const DOME_BASE = -0.03;

let s = 20260918;
const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);

/**
 * Hoar frost for the card face.
 *
 * Drawn rather than built out of meshes because the card is only about a
 * hundred pixels across at this camera: fine frost as geometry is forty grey
 * smudges, whereas a bitmap can carry needles thinner than a pixel and still
 * come out as a texture rather than as litter. It takes at the RIM first —
 * that is where frost starts on anything real, and it leaves the art readable
 * in the middle for longest, which matters, because the fighter is supposed to
 * still be there when it is over.
 */
let RIME = null;
function rime() {
  if (RIME) return RIME;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.lineCap = 'round';

  // feathers: strokes swept back in toward the middle, densest at the edge
  for (let i = 0; i < 900; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 34 + Math.sqrt(rnd()) * 104;
    const x = 128 + Math.cos(a) * r;
    const y = 128 + Math.sin(a) * r;
    const k = Math.min(1, (r - 28) / 100);
    const len = 4 + rnd() * (10 + k * 34);
    const dir = a + Math.PI + (rnd() - 0.5) * 1.2;
    g.strokeStyle = `rgba(255,255,255,${0.08 + k * 0.72})`;
    g.lineWidth = 0.5 + rnd() * 2.2;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(dir) * len, y + Math.sin(dir) * len);
    g.stroke();
  }
  // stars where the feathers meet, so the eye has something to land on
  for (let i = 0; i < 48; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 44 + rnd() * 82;
    const x = 128 + Math.cos(a) * r;
    const y = 128 + Math.sin(a) * r;
    const arm = 5 + rnd() * 12;
    g.strokeStyle = `rgba(255,255,255,${0.3 + rnd() * 0.35})`;
    g.lineWidth = 1 + rnd();
    for (let b = 0; b < 3; b++) {
      const t = (b / 3) * Math.PI + rnd() * 0.3;
      g.beginPath();
      g.moveTo(x - Math.cos(t) * arm, y - Math.sin(t) * arm);
      g.lineTo(x + Math.cos(t) * arm, y + Math.sin(t) * arm);
      g.stroke();
    }
  }
  // and a cold wash under all of it, so the card COOLS as well as ices over
  const grd = g.createRadialGradient(128, 128, 18, 128, 128, 150);
  grd.addColorStop(0, 'rgba(196,230,252,0.14)');
  grd.addColorStop(0.55, 'rgba(206,238,255,0.42)');
  grd.addColorStop(1, 'rgba(228,247,255,0.7)');
  g.globalCompositeOperation = 'destination-over';
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);

  RIME = new THREE.CanvasTexture(c);
  RIME.colorSpace = THREE.SRGBColorSpace;
  return RIME;
}

/**
 * The frost that gets onto the FLAGSTONES around them.
 *
 * Needs its own canvas rather than a second copy of the rime: that one runs to
 * the corners because a card is a rectangle, and stamped on open stone it came
 * out as a square white placemat. This one is ragged and dies well inside its
 * own edge.
 */
let PATCH = null;
function patch() {
  if (PATCH) return PATCH;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  for (let i = 0; i < 900; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * 118;
    const k = 1 - r / 118;
    g.fillStyle = `rgba(232,248,255,${0.02 + k * k * 0.14})`;
    g.beginPath();
    g.arc(128 + Math.cos(a) * r, 128 + Math.sin(a) * r, 2 + rnd() * (4 + k * 14), 0, 7);
    g.fill();
  }
  PATCH = new THREE.CanvasTexture(c);
  PATCH.colorSpace = THREE.SRGBColorSpace;
  return PATCH;
}

/** A spine with barbs: one frost needle, lying flat in the card's own plane. */
function frond() {
  const v = [];
  const tri = (ax, az, bx, bz, cx, cz) => v.push(ax, 0, az, bx, 0, bz, cx, 0, cz);
  tri(-0.035, 0, 0.035, 0, 0, -1);
  // The barbs are what make it frost. A bare sliver at this size reads as a
  // crack in glass, and twenty of them read as a smashed card — which is the
  // wrong card entirely, because nobody died.
  for (const [z, len] of [[-0.19, 0.36], [-0.39, 0.29], [-0.59, 0.2], [-0.77, 0.12]]) {
    for (const d of [-1, 1]) tri(0, z + 0.03, 0, z - 0.03, d * len * 0.78, z - len * 0.62);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(v), 3));
  const n = new Float32Array(v.length);
  for (let i = 1; i < n.length; i += 3) n[i] = 1;
  geo.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  return geo;
}

/** The wrap freezes solid round them, something is taken, and the ice lets go. */
export function freeze(kit, when, at, look) {
  /* ------------------------------------------------- the breath drawn in */

  // Cold arriving as an EXPLOSION was the first version's mistake — a small
  // white bomb, which is every other bolt. Cold TAKES: the vapour is hauled in
  // off the surrounding flagstones before anything else happens.
  stage(kit, when, 0.34, () => {
    const tex = blobTexture('rgba(216,241,255,0.8)', 'rgba(216,241,255,0)');
    const grp = new THREE.Group();
    const from = [];
    for (let i = 0; i < 22; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      const a = (i / 22) * Math.PI * 2 + rnd() * 0.45;
      const r = 1.5 + rnd() * 1.3;
      from.push(new THREE.Vector3(Math.cos(a) * r, 0.05 + rnd() * 0.4, Math.sin(a) * r));
      grp.add(sp);
    }
    grp.position.copy(at);
    return {
      obj: grp,
      tick: (t) => {
        const k = easeIn(t);
        for (let i = 0; i < grp.children.length; i++) {
          const sp = grp.children[i];
          sp.position.copy(from[i]).multiplyScalar(1 - k);
          sp.position.y = from[i].y * (1 - k) + 0.2 * k;
          // small and dim: at 0.6 across these came out as bokeh, a row of
          // fat white dots sitting on the stonework with nothing to do with ice
          sp.material.opacity = Math.sin(Math.PI * t) * 0.42;
          sp.scale.setScalar(0.22 * (1 - t * 0.45));
        }
      },
    };
  });

  /* ------------------------------------------------------- the crust */

  // The cloth going hard. Plates lie ON the dome the wrap made, laid on from
  // the BOTTOM UP so the freeze visibly climbs the body; all of them popping
  // together looked like a switch being thrown.
  //
  // It breaks up on the cloth's own schedule. Left to run its full length the
  // crust was still hanging in the air a third of a second after the bolt had
  // reeled the cloth back in, and a shell of loose white plates over an empty
  // square reads as broken glass, not as a fighter.
  stage(kit, when + 0.03, 0.94, () => {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0xd0e9f8, emissive: 0x3a82b2, emissiveIntensity: 0.52,
      // Translucent, and only half lit from within: at full emissive the plates
      // came out as flat white paper with no facets, because nothing the
      // braziers did to them could show.
      transparent: true, opacity: 0.85, roughness: 0.14, metalness: 0.1,
      flatShading: true, side: THREE.DoubleSide,
    });
    const plate = new THREE.PlaneGeometry(1, 1);
    const blade = new THREE.ConeGeometry(0.075, 1, 4);
    const nrm = new THREE.Vector3();
    const born = [], out = [], home = [], size = [];

    const N = 14;
    for (let i = 0; i < N; i++) {
      const w = (i + 0.3) / N;
      // golden angle: an even crust with no seam running up one side
      const a = i * 2.39996 + 0.9;
      const taper = Math.sqrt(Math.max(0.04, 1 - w * w * 0.92));
      const r = DOME_R * taper;
      nrm.set(Math.cos(a) * 0.9, (DOME_R * 0.92 * w) / taper, Math.sin(a) * 0.9).normalize();
      const m = new THREE.Mesh(plate, mat);
      m.position.set(Math.cos(a) * r, DOME_BASE + DOME_RISE * w, Math.sin(a) * r)
        .addScaledVector(nrm, 0.02);
      m.quaternion.setFromUnitVectors(FWD, nrm);
      m.rotateZ(rnd() * Math.PI);
      m.rotateX((rnd() - 0.5) * 0.45);
      g.add(m);
      size.push([0.42 + rnd() * 0.26, 0.32 + rnd() * 0.2]);
      born.push(0.02 + w * 0.16 + rnd() * 0.04);
      out.push(nrm.clone());
      home.push(m.position.clone());
    }

    // blades out of the crust — the silhouette is what says "ice" from this far
    // up, and a smooth dome has no silhouette at all
    for (let i = 0; i < 7; i++) {
      const w = 0.12 + rnd() * 0.64;
      const a = rnd() * Math.PI * 2;
      const taper = Math.sqrt(Math.max(0.04, 1 - w * w * 0.92));
      nrm.set(Math.cos(a) * 0.9, (DOME_R * 0.92 * w) / taper + 0.5, Math.sin(a) * 0.9).normalize();
      const len = 0.28 + rnd() * 0.34;
      const m = new THREE.Mesh(blade, mat);
      m.position
        .set(Math.cos(a) * DOME_R * taper, DOME_BASE + DOME_RISE * w, Math.sin(a) * DOME_R * taper)
        .addScaledVector(nrm, len * 0.38);
      m.quaternion.setFromUnitVectors(UP, nrm);
      g.add(m);
      size.push([0.7 + rnd() * 0.45, len]);
      born.push(0.06 + w * 0.15 + rnd() * 0.05);
      out.push(nrm.clone());
      home.push(m.position.clone());
    }

    g.position.copy(at);
    return {
      obj: g,
      tick: (t) => {
        const go = Math.max(0, t - 0.36) / 0.64;          // it lets go in pieces
        mat.opacity = 0.85 * (1 - go ** 1.3);
        for (let i = 0; i < g.children.length; i++) {
          const m = g.children[i];
          // A flick of overshoot on arrival: ice does not ease into place, it
          // takes, and that snap is most of what sells the cold.
          const k = Math.min(1, Math.max(0, (t - born[i]) / 0.1));
          // shrinking as they go, or the last of the crust hangs about as
          // full-size white scraps that read as torn paper rather than ice
          const sc = easeOut(k) * (1 + 0.22 * Math.sin(k * Math.PI)) * (1 - go * 0.55);
          m.scale.set(size[i][0] * sc, size[i][1] * sc, 1);
          if (go > 0) {
            m.position.copy(home[i]).addScaledVector(out[i], go * 0.3);
            m.position.y -= go * go * 0.6;
            m.rotateZ(0.05 * go);
          }
        }
      },
    };
  });

  /* ------------------------------------------------- the ground goes hard */

  stage(kit, when + 0.1, 1.15, () => {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0xbcdcf2, emissive: 0x2f6f9c, emissiveIntensity: 0.36,
      transparent: true, opacity: 0.86, roughness: 0.1, metalness: 0.05,
      flatShading: true,
    });
    const geo = new THREE.ConeGeometry(0.12, 1, 4);
    const roll = new THREE.Quaternion();
    const dir = new THREE.Vector3();
    const born = [], high = [];
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2 + rnd() * 0.45;
      const r = 0.98 + rnd() * 0.5;
      const tilt = 0.18 + rnd() * 0.26;
      const m = new THREE.Mesh(geo, mat);
      m.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      // Built out of Euler angles this went wrong: the random roll about the
      // spike's own axis was applied BEFORE the outward lean, so half of them
      // leaned inward over the card instead of away from it.
      dir.set(Math.cos(a) * tilt, 1, Math.sin(a) * tilt).normalize();
      m.quaternion.setFromUnitVectors(UP, dir)
        .multiply(roll.setFromAxisAngle(UP, rnd() * Math.PI));
      g.add(m);
      high.push(0.34 + rnd() * 0.62);
      born.push(rnd() * 0.12);
    }
    g.position.copy(at);
    return {
      obj: g,
      tick: (t) => {
        // They are DRAWN BACK DOWN rather than left to fade: the last half
        // second belongs to the frost on the card, and eleven pale slivers
        // still lying about the square read as litter over the top of it.
        const gone = easeIn(Math.max(0, t - 0.52) / 0.48);
        mat.opacity = 0.86 * (1 - gone);
        for (let i = 0; i < g.children.length; i++) {
          const m = g.children[i];
          const k = Math.min(1, Math.max(0, (t - born[i]) / 0.09));
          const sc = easeOut(k) * (1 + 0.18 * Math.sin(k * Math.PI));
          const h = high[i] * sc;
          m.scale.set(0.55 + 0.45 * sc, h, 0.55 + 0.45 * sc);
          // grown from the base, not from the middle: scaling a cone about its
          // centre drove the point down THROUGH the flagstones as it rose
          m.position.y = -0.2 + h * 0.5 - gone * (high[i] + 0.3);
        }
      },
    };
  });

  /* ------------------------------------------------------- the rime left */

  // Outlives the cloth on purpose. The wrap has reeled back in by about the
  // time this is halfway through, and the card lying there still white is the
  // whole point of this card: they are alive, and something is missing.
  stage(kit, when + 0.1, 1.5, () => {
    const g = new THREE.Group();

    // frost on the flagstones first, so the card's own rime is the middle of a
    // spread and not a decal pasted on one square
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD_W * 1.9, CARD_H * 1.9),
      new THREE.MeshBasicMaterial({
        map: patch(), color: 0xdff4ff, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.1;
    g.add(floor);

    const wash = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD_W * 1.04, CARD_H * 1.04),
      // NOT additive. An additive white disc over the card — which is what this
      // used to be — burns the art out from under it and leaves a blank lozenge
      // where the fighter was, which reads as a death, not a theft.
      new THREE.MeshBasicMaterial({
        map: rime(), color: 0xf2fcff, transparent: true, depthWrite: false,
      }),
    );
    wash.rotation.x = -Math.PI / 2;
    // Clearance above the card's FACE, not its base. `at` is already pulled
    // down to the face by cloth.js, but a card is a box with a lid: too little
    // and the frost loses the depth test and paints the flagstones AROUND the
    // one square it is supposed to be on.
    wash.position.y = 0.055;
    g.add(wash);

    // The bite. One frame of the card going white under the cold is worth more
    // than any amount of build-up: without it the frost merely appears, and a
    // cold snap that does not SNAP is just weather.
    const snap = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD_W * 1.04, CARD_H * 1.04),
      new THREE.MeshBasicMaterial({
        color: 0xeaf8ff, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    snap.rotation.x = -Math.PI / 2;
    snap.position.y = 0.059;
    g.add(snap);

    // Needles taking the card from its edges inward, lying in the card's own
    // plane so they read as frost ON it and not as chips standing on top of it.
    const tri = frond();
    // NOT additive. Added light, the needles came out as bright scratches
    // raked across the art — claw marks, which is the wrong bolt entirely.
    // Frost is something DEPOSITED, so it covers rather than glows.
    const nmat = new THREE.MeshBasicMaterial({
      color: 0xeaf8ff, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    const HW = CARD_W * 0.47, HH = CARD_H * 0.47;
    const born = [], span = [];
    for (let i = 0; i < 34; i++) {
      const u = rnd() * 1.8 - 0.9;
      const e = i % 4;
      const px = e === 2 ? -HW : e === 3 ? HW : u * HW;
      const pz = e === 0 ? -HH : e === 1 ? HH : u * HH;
      const m = new THREE.Mesh(tri, nmat);
      m.position.set(px, 0.063, pz);
      // the tip is at local -z, so this aims it back at the middle of the card
      m.rotation.y = Math.atan2(px, pz) + (rnd() - 0.5) * 0.8;
      g.add(m);
      span.push(0.18 + rnd() * 0.32);
      born.push(0.02 + rnd() * 0.32);
    }

    g.position.copy(at);
    return {
      obj: g,
      tick: (t) => {
        const fade = 1 - Math.max(0, t - 0.82) / 0.18;
        const on = Math.min(1, t / 0.2);
        // Thick at the bite, then thinning to a coat. Held at full strength
        // the wash drowned its own frost: the drawn crystals only became
        // readable at the very end, as it faded off them.
        const settle = Math.min(1, Math.max(0, (t - 0.18) / 0.4));
        wash.material.opacity = on * (0.74 - 0.28 * settle) * fade;
        floor.material.opacity = on * 0.3 * fade;
        floor.scale.setScalar(0.5 + easeOut(Math.min(1, t * 3.5)) * 0.55);
        snap.material.opacity = Math.max(0, 0.85 - t * 12) ** 1.4;
        nmat.opacity = Math.min(1, t / 0.12) * 0.85 * fade;
        for (let i = 3; i < g.children.length; i++) {
          const m = g.children[i];
          const k = Math.min(1, Math.max(0, (t - born[i - 3]) / 0.26));
          const L = span[i - 3] * easeOut(k);
          m.scale.set(L, 1, L);
        }
      },
    };
  });

  /* ------------------------------------------------------ the trait taken */

  // The one beat that says STRIPPED rather than killed: something is drawn up
  // out of the card on a thread, goes rigid in the air, and is broken.
  //
  // It waits for the crust to start letting go before it rises. Drawn out from
  // under a full shell of ice it was simply lost — one more pale facet among
  // twenty — and the beat that names the card went unread.
  stage(kit, when + 0.5, 0.85, () => {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: 0xa9e2ff, emissiveIntensity: 2.4,
      transparent: true, opacity: 0.96, roughness: 0.08, metalness: 0.2,
      flatShading: true,
    });
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.19, 0), mat);
    g.add(core);
    // Lit from around itself as well as from within. Bare, the crystal came out
    // as a small white quad pasted over the card — a shape, not a thing being
    // stolen — because nothing at this size survives without a halo.
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: blobTexture('rgba(224,246,255,0.9)', 'rgba(180,225,255,0)'),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    g.add(halo);
    const tether = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.07, 1, 6, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xbfe9ff, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      }),
    );
    g.add(tether);
    const shard = new THREE.TetrahedronGeometry(0.08, 0);
    const fly = [];
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(shard, mat);
      m.visible = false;
      g.add(m);
      const a = (i / 9) * Math.PI * 2 + rnd();
      fly.push(new THREE.Vector3(
        Math.cos(a) * (0.5 + rnd() * 0.5), 0.25 + rnd() * 0.5, Math.sin(a) * (0.5 + rnd() * 0.5),
      ));
    }
    g.position.copy(at);
    return {
      obj: g,
      tick: (t) => {
        const rise = easeOut(Math.min(1, t / 0.44));
        const y = 0.12 + rise * 0.58;
        core.position.y = y;
        core.rotation.set(t * 5.2, t * 7.4, t * 1.8);
        halo.position.y = y;
        halo.scale.setScalar(0.95 + rise * 0.35);
        const crack = Math.max(0, t - 0.5) / 0.5;
        core.scale.setScalar(crack > 0 ? Math.max(0, 1 - crack * 6) : 0.45 + rise * 0.6);
        halo.material.opacity = crack > 0 ? Math.max(0, 0.7 - crack * 4) : 0.25 + rise * 0.45;
        tether.visible = crack <= 0;
        tether.position.y = (0.02 + y) * 0.5;
        tether.scale.set(1, Math.max(0.02, y - 0.02), 1);
        // Held on until the break rather than faded out on the way up: the
        // thread IS the theft, and once it had gone the crystal read as
        // something arriving from above instead of something being taken.
        tether.material.opacity = 0.5 * (1 - rise * 0.55);
        for (let i = 0; i < fly.length; i++) {
          if (crack <= 0) break;
          const m = g.children[i + 3];
          m.visible = true;
          m.position.copy(fly[i]).multiplyScalar(crack * 0.95);
          m.position.y = y + fly[i].y * crack - crack * crack * 1.1;
          m.rotation.set(crack * 6 + i, crack * 4, 0);
          m.scale.setScalar(1 - crack * 0.5);
        }
        mat.opacity = 0.96 * (1 - crack ** 1.5);
      },
    };
  });

  /* --------------------------------------------------------------- light */

  glowAt(kit, when + 0.1, at.clone().setY(at.y + 0.5), 0xcfeeff, { power: 26, seconds: 0.42 });
  ring(kit, when + 0.11, at, 0xe4f7ff, { size: 2.9, seconds: 0.42, thick: 0.08 });
  ring(kit, when + 0.18, at, 0x8ecdf0, { size: 4.4, seconds: 0.85, thick: 0.045 });
  // Cold air FALLS. A rising puff is smoke and belongs to the fire bolt; this
  // one barely leaves the ground and creeps out over the flagstones instead.
  puff(kit, when + 0.12, at, 'rgba(226,246,255,1)', {
    count: 14, spread: 1.9, rise: 0.12, seconds: 1.0, size: 0.34, drag: 0.3, y: 0.03,
  });
  puff(kit, when + 0.14, at, look.glow, {
    count: 9, spread: 0.7, rise: 0.8, seconds: 0.6, size: 0.2, drag: 1.4, y: 0.3,
  });
  // the break, when the thing taken out of them is snapped
  glowAt(kit, when + 0.92, at.clone().setY(at.y + 0.7), 0xe8f8ff, { power: 15, seconds: 0.3 });
  puff(kit, when + 0.92, at, 'rgba(236,250,255,1)', {
    count: 10, spread: 1.1, rise: 0.45, seconds: 0.7, size: 0.13, drag: 1.9, y: 0.72,
  });
}
