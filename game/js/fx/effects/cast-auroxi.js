// THE AUROXI FLOURISH — a gust off the steppe, and the prayer-flags take it.
//
// What an Auroxi card does when it resolves and has no motif of its own, which
// is MOST of them. This is the effect a player sees more often than any other,
// so restraint matters here more than spectacle.
//
// SHAPE, not tint, is what tells the five factions apart at a glance:
// Refractory comes down, Gloaming sinks in, Shardsworn breaks apart, Marvorren
// runs outward in rings. So this one goes ACROSS — a line of bunting strung
// over the square, the gust running along it so the pennants snap out one
// after another, then the whole line going slack and fraying away downwind.
// Nothing else on this table moves sideways, and that is the read.
//
// It is of the same cloth as the named Auroxi cards without being either of
// them: the bolts unroll from a rod and WRAP, the Weavers stitch between pins.
// Nothing here is thrown and nothing here is tied — the wind simply passes.
//
// One effect, one file.

import { THREE, FACTION, easeOut, easeIn } from '../kit.js';
import { weave } from '../cloth-kit.js';
import { blobTexture } from '../../textures.js';

const UP = new THREE.Vector3(0, 1, 0);

// FACTION carries only the Auroxi orange, and the teal is half of what the
// faction looks like — it is the one cool colour on a table of braziers apart
// from Marvorren's water, and that is a sea-blue, not this greener felt dye.
// Both are darker than the card colours, because the flags are dyed cloth and
// not lamps: the weave map is a pale linen grey that takes a third of the
// saturation out of anything drawn through it, and the first pass — which used
// FACTION.spark, a peachy 0xffb257 — came out as cream paper.
const TEAL = 0x38c2ac;
const DYE = 0xe2701a;

const SPAN = 1.1;             // the whole flourish, start to gone

// Four pennants, not five, and a card is 1.74 across. Two things were learned
// by photographing this: 2.7 units of bunting runs clean across three squares
// and reads as a decoration of the BOARD rather than a mark on one card; and
// at five flags the gaps between them were 0.08 units, which is two pixels at
// the size a card really is on screen, so the cord never showed between them
// and the pennants read as loose scraps floating over the square.
const FLAGS = 4;
const FW = 0.38;              // pennant across the cord
const FH = 0.54;              // pennant along the wind
const GAP = 0.17;

// Both soft maps last the life of the page. kit.hold disposes materials but
// never their MAPS, so a texture built inside cast() is a 128px canvas and a
// GPU upload leaked on every card that resolves — and this is the flourish
// that fires more often than any other.
let LINT = null, SMEAR = null;
function lintTex() {
  if (!LINT) LINT = blobTexture('rgba(255,208,152,0.9)', 'rgba(255,168,88,0)');
  return LINT;
}
function smearTex() {
  if (!SMEAR) SMEAR = blobTexture('rgba(255,214,164,0.85)', 'rgba(255,180,110,0)');
  return SMEAR;
}

/** A pennant: a grid of verts, rewritten every frame. NU across, NV along. */
function pennant(colour, NU, NV) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NU * NV * 3), 3));
  const uv = new Float32Array(NU * NV * 2);
  for (let v = 0; v < NV; v++) {
    for (let u = 0; u < NU; u++) {
      // The weave's ribs run along canvas x, so x is put along the flag's
      // LENGTH: creases cross a streaming pennant, they do not run down it.
      uv[(v * NU + u) * 2 + 0] = v / (NV - 1);
      uv[(v * NU + u) * 2 + 1] = u / (NU - 1);
    }
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const idx = [];
  for (let v = 0; v < NV - 1; v++) {
    for (let u = 0; u < NU - 1; u++) {
      const a = v * NU + u;
      idx.push(a, a + NU, a + 1, a + 1, a + NU, a + NU + 1);
    }
  }
  geo.setIndex(idx);

  const w = weave();
  const mat = new THREE.MeshStandardMaterial({
    color: colour, emissive: colour, emissiveIntensity: 0.42,
    map: w.map, emissiveMap: w.map, alphaMap: w.alpha,
    // alphaTest as well as blending, as the bolts do: the pennants cross each
    // other end-on once the gust has them, and sorted transparency dropped the
    // near one behind the far one. It also gives the ending for free — as
    // opacity falls the cloth is eaten away from the frayed selvedge inward.
    alphaTest: 0.22, transparent: true, opacity: 0,
    roughness: 0.95, metalness: 0, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  // The sun casts, and a card face receives. A pennant's shadow sliding over
  // the card is most of what puts the cloth ON the table rather than in a
  // layer above it. The shadow depth material inherits alphaMap and alphaTest
  // but NOT opacity, so the shadow has to be switched off by hand as the
  // cloth frays or it outlives the flag that threw it.
  mesh.castShadow = true;
  return { mesh, geo, mat };
}

export function cast(kit, at) {
  const p = kit.at(at);
  if (!p) return;
  const look = FACTION.Auroxi || FACTION.Neutral;

  // kit.at answers 0.4 for a bare square but ~0.2 for a card, whose face is at
  // about 0.22 — so anything measured off the raw height floats over an empty
  // square and sinks into an occupied one.
  const y = Math.min(p.y, 0.225) + 0.02;

  // The wind is the same wind every time — it is the weather, not a die roll —
  // but it is taken off-axis so the line reads as a diagonal rather than as a
  // ruled edge of the board. Blown to the player's right and a little toward
  // the camera, because straight along z is foreshortened to nothing.
  const wd = new THREE.Vector3(0.82, 0, 0.57).normalize();
  const ac = new THREE.Vector3(-wd.z, 0, wd.x);           // along the cord

  const grp = new THREE.Group();
  // Low. At y+0.52 the line floated clear above the card's top edge and read
  // as strung between the squares BEHIND it; the pennants have to skim the
  // card's own face for the mark to land on the card.
  const CORD_Y = y + 0.34;
  const HALF = (FLAGS * FW + (FLAGS - 1) * GAP) * 0.5;

  // The cord's two ends, a little upwind of centre so the pennants stream ONTO
  // and then past the card instead of hanging off the far side of it.
  const A = p.clone().setY(CORD_Y).addScaledVector(ac, -HALF - 0.06).addScaledVector(wd, -0.30);
  const B = p.clone().setY(CORD_Y).addScaledVector(ac, HALF + 0.06).addScaledVector(wd, -0.30);

  // Dull ochre, barely lit: at emissive 0.7 on the faction's pale orange the
  // cord came out as a white wire ruled across the board, brighter than the
  // cloth it was carrying.
  const cord = kit.strip({ segments: 34, width: 0.06, colour: 0xc99048, emissive: 0.45 });
  cord.mesh.castShadow = false;
  cord.mat.transparent = true;
  cord.mat.opacity = 0;
  grp.add(cord.mesh);
  const cordPts = [];
  for (let i = 0; i < 34; i++) cordPts.push(new THREE.Vector3());

  const NU = 5, NV = 9;
  const flags = [];
  for (let i = 0; i < FLAGS; i++) {
    // Teal, orange, teal, orange — the alternation IS the prayer-flag read.
    // In one colour the line came out as a strip of packing tape.
    const f = pennant(i % 2 ? DYE : TEAL, NU, NV);
    grp.add(f.mesh);
    flags.push({
      ...f,
      // Slung UNDER the cord. Hung at exactly the cord's height the two were
      // coplanar and the line drew straight across the middle of every
      // pennant — four ping-pong paddles on a stick, not bunting on a line.
      root: A.clone().lerp(B, FLAGS === 1 ? 0.5 : i / (FLAGS - 1))
        .addScaledVector(UP, -0.05).addScaledVector(wd, 0.03),
      // Matched to where the gust front is: the cord is drawn on by the same
      // wave, so a pennant must not open before the line reaches it.
      born: 0.03 + i * 0.081,
      phase: i * 1.7,
      // no two flags on a real line are cut the same or hang the same
      len: FH * (0.84 + Math.random() * 0.32),
      sag: 0.9 + Math.random() * 0.25,
    });
  }

  // The gust itself. Four pennants 15 pixels across are legible when you look
  // AT the card but vanish in a shot of the whole table, and this flourish has
  // to say "something crossed that square" from the player's seat. So the wind
  // gets a footprint: one long soft smear of warm light drawn out along the
  // wind, travelling over the square and gone. Low opacity on purpose — it is
  // the gust passing, not a spotlight, and the card's art has to survive it.
  const gustMat = new THREE.MeshBasicMaterial({
    map: smearTex(), color: 0xffd9a8, transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const smear = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), gustMat);
  smear.rotation.x = -Math.PI / 2;
  smear.rotation.z = -Math.atan2(wd.z, wd.x);      // long axis down the wind
  smear.scale.set(2.5, 1.15, 1);
  grp.add(smear);

  // Lint torn off the cloth and carried on: nine motes, low and downwind. It
  // is what stops the flags reading as a decal hanging in still air.
  const lint = [];
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: lintTex(), transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, opacity: 0,
    }));
    s.userData = {
      from: p.clone().setY(y + 0.15 + Math.random() * 0.4)
        .addScaledVector(ac, (Math.random() - 0.5) * 2 * HALF),
      born: 0.26 + Math.random() * 0.4,
      run: 0.42 + Math.random() * 0.26,
      reach: 0.55 + Math.random() * 0.6,
      rise: 0.08 + Math.random() * 0.24,
      // Small. At 0.2-0.34 these came out as pale bokeh balls drifting off the
      // card and pulled the eye clean off the flags they were torn from.
      size: 0.09 + Math.random() * 0.07,
    };
    lint.push(s);
    grp.add(s);
  }

  // Point lights fall off with the square of the distance, and at power 3.4
  // sitting 0.2 units off the cloth this bleached every pennant to white
  // paper — the dye was fine, the exposure was not. Low, and further off.
  const lamp = new THREE.PointLight(look.spark, 0, 4.2, 2);
  lamp.position.copy(p).setY(y + 0.75);
  grp.add(lamp);

  const d = new THREE.Vector3(), nrm = new THREE.Vector3(), sp = new THREE.Vector3();

  kit.hold(grp, SPAN, (t) => {
    const s = t * SPAN;
    const gone = Math.max(0, (s - 0.62) / (SPAN - 0.62));     // the fraying-out

    // It leaves the way it came: the last thing the eye sees is cloth going
    // sideways, which is the one direction no other faction's flourish moves.
    grp.position.copy(wd).multiplyScalar(easeIn(gone) * 0.4);

    /* --- the cord: a shallow catenary that is pushed downwind as the gust
       arrives and springs back behind it. */
    const gust = Math.min(1, Math.max(0, (s - 0.02) / 0.28));
    // The cord is DRAWN ON by the gust rather than simply fading up. A line
    // that was already ruled right across the card before the first pennant
    // opened read as a wire that had always been there; growing it along its
    // own length is what makes the whole flourish one thing arriving.
    const front = Math.min(1, gust * 1.12);
    for (let i = 0; i < cordPts.length; i++) {
      const k = i / (cordPts.length - 1);
      const q = cordPts[i];
      q.copy(A).lerp(B, Math.min(k, front));
      q.y -= Math.sin(Math.PI * Math.min(k, front)) * 0.07;
      const hit = Math.min(1, Math.max(0, front - k + 0.08) * 6);
      q.addScaledVector(wd, Math.sin(Math.PI * k) * 0.14 * hit);
      q.y += Math.sin(k * 9 - s * 11) * 0.012 * hit;
    }
    cord.lay(cordPts, { taper: 0 });
    cord.mat.opacity = Math.min(1, gust * 8) * (1 - gone) * 0.8;

    /* --- the pennants. Each is a chain of NV steps whose direction turns as
       it goes: hanging before the gust reaches it, out along the wind once it
       has, and rippling the whole time. Swinging the flag as one rigid quad
       instead — which is the obvious way to do it — read as a road sign
       flipping over, because real cloth bends along its own length. */
    for (const f of flags) {
      const u = (s - f.born) / 0.20;
      const lift = Math.min(1, Math.max(0, u));
      const slack = Math.min(1, Math.max(0, (s - 0.62) / 0.34));   // the gust passes on
      const fly = easeOut(lift) * (1 - 0.42 * slack);
      // Cloth that is losing the wind ripples MORE, not less. Scaling the
      // ripple by `fly`, as the first cut did, ironed every pennant flat at
      // exactly the moment it should have been going loose.
      const amp = (0.26 + 0.34 * slack) * Math.min(1, u * 3);
      const pos = f.geo.attributes.position.array;
      const step = f.len / (NV - 1);
      sp.copy(f.root);
      for (let v = 0; v < NV; v++) {
        const k = v / (NV - 1);
        // hanging to streaming, the tip always trailing the root a little so
        // the cloth has a curve in it rather than a crease
        const rest = -1.15 * f.sag;
        const out = 0.16 - 0.34 * k;
        let th = rest + (out - rest) * fly;
        th += (Math.sin(k * 5.5 - s * 13 + f.phase) * 0.7
             + Math.sin(k * 9.0 - s * 21 + f.phase * 2)) * amp * 0.42 * k;
        // The camera looks DOWN at this table, so a ripple that only moves the
        // cloth up and down is foreshortened to nothing — every pennant in the
        // first cut was flapping hard and still looked like a sticker. The
        // wave that shows from above is the one that snakes the flag from side
        // to side, so the spine yaws as well as pitching.
        const psi = (Math.sin(k * 4.2 - s * 10 + f.phase) * 0.62
                   + Math.sin(k * 7.0 - s * 17 + f.phase * 1.7) * 0.38) * amp * 1.15 * k;
        const cw = Math.cos(psi), sw = Math.sin(psi);
        d.set(wd.x * cw + wd.z * sw, 0, -wd.x * sw + wd.z * cw)
          .multiplyScalar(Math.cos(th)).addScaledVector(UP, Math.sin(th));
        nrm.copy(d).cross(ac).normalize();
        // A pennant, not a paddle: the fly end is a little over half the width
        // of the hoist, so the silhouette tapers.
        const half = FW * 0.5 * (1 - 0.46 * k * k);
        // A swallowtail cut into the fly end. It is the one silhouette cue
        // that survives at the fifteen pixels a pennant actually occupies:
        // with a square end these read as cards, not as cloth.
        const notch = f.len * 0.26 * Math.max(0, (k - 0.66) / 0.34);
        for (let uu = 0; uu < NU; uu++) {
          const g = uu / (NU - 1);
          const tail = notch * (1 - (2 * g - 1) ** 2);
          // The cross-section curls and the loose corners lift. Without it
          // every pennant is a ruled quad, and four ruled quads tilting in a
          // row look like shovels rather than cloth.
          const bow = Math.sin(Math.PI * g) * (0.05 + 0.16 * k)
            * Math.sin(k * 4 - s * 9 + f.phase) * (0.55 + amp)
            + (g - 0.5) * (g - 0.5) * 0.5 * k * k * FW
            * Math.sin(s * 7 + f.phase);
          const i3 = (v * NU + uu) * 3;
          pos[i3 + 0] = sp.x + ac.x * (g - 0.5) * 2 * half + nrm.x * bow - d.x * tail;
          pos[i3 + 1] = sp.y + ac.y * (g - 0.5) * 2 * half + nrm.y * bow - d.y * tail;
          pos[i3 + 2] = sp.z + ac.z * (g - 0.5) * 2 * half + nrm.z * bow - d.z * tail;
        }
        sp.addScaledVector(d, step);
      }
      f.geo.attributes.position.needsUpdate = true;
      f.geo.computeVertexNormals();
      // Not easeIn: the flourish fires dozens of times a game, and a fade
      // that holds full strength for its first third simply sat on the card.
      f.mat.opacity = Math.min(1, Math.max(0, u * 2.2)) * (1 - Math.min(1, gone)) ** 1.3;
      f.mesh.castShadow = f.mat.opacity > 0.6;
      f.mat.emissiveIntensity = 0.42 + 0.24 * fly;
    }

    /* --- the gust's footprint, travelling downwind over the square */
    const swp = Math.min(1, Math.max(0, s / 0.48));
    smear.position.copy(p).setY(y + 0.004)
      .addScaledVector(wd, -0.9 + easeOut(swp) * 1.8);
    // Up fast, down slow. Squared, the smear was still at a twentieth of its
    // strength 80ms in and the first tenth of a second of the flourish — the
    // part that has to say "this card resolved" — was a blank card and an inch
    // of cord.
    gustMat.opacity = Math.sin(Math.PI * swp) ** 0.7 * 0.3;

    /* --- lint */
    for (const m of lint) {
      const w = m.userData;
      const k = (s - w.born) / w.run;
      if (k <= 0 || k >= 1) { m.material.opacity = 0; continue; }
      m.position.copy(w.from)
        .addScaledVector(wd, easeOut(k) * w.reach);
      m.position.y += w.rise * k - k * k * 0.25;
      m.material.opacity = Math.sin(Math.PI * k) * 0.5;
      m.scale.setScalar(w.size * (1 - k * 0.35));
    }

    // Enough to warm the card while the cloth is over it, and no more. The
    // flourish marks a card; it must not out-light the braziers.
    lamp.intensity = 1.5 * Math.min(1, s / 0.2) * (1 - t) ** 1.4;
  });
}
