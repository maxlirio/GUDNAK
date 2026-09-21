// BURY — a fighter is forced UNDERNEATH another one, and pinned there.
//
// Shared by 4 cards: A042 Umbren Jailor (Catch), A046 Incarceration, A044
// Heretic Condemner (Man Catcher) and M165 Shadowcaster (Shadow Underfoot).
// Three of them are the Inquisition jailing an enemy; the fourth is a friendly
// Shadow slipping under cover. What they have in common is IMPRISONMENT and
// not death: the card goes under the stack, it is still on the table, and it
// can be let out again later.
//
// THAT IS THE WHOLE JOB — telling this apart from a kill. A death in this game
// is a card leaving: it is knocked flat and slid off to the graveyard, or it
// goes up in cloth and fire. So this motif does the opposite in every respect.
// Nothing leaves. The only card that travels, travels a third of a square and
// ENDS UP STILL IN FRAME, with its corner sticking out from under its jailer
// and a light burning in the crack.
//
// The shape of it is DOWN, and everything here is arranged so that the eye
// reads weight:
//   the jailer HEAVES UP and hangs open, tipped toward the corner the victim
//   is coming in by — the one moment in the motif where anything rises;
//   the victim is DRIVEN IN underneath it and stops SHORT, jammed with a tenth
//   of itself still out on the stone;
//   the weight COMES DOWN, and the dust it squeezes out goes sideways rather
//   than up, because that is what a slab landing on a slab does;
//   one HEAVE from underneath fails;
//   and only then is it pressed the last of the way in, with the seam lit.
//
// THE TWO THINGS THAT MADE IT READ, both found in shots and neither obvious:
//
// IT HAS TO STOP SHORT. pieces.js slides a buried card back and to the left by
// 0.085 a layer so its edges stay visible, and 0.085 is THREE SCREEN PIXELS —
// narrower than the card's own black border. Run all the way home at the slam,
// the end state of this motif was one card lying on a flagstone and there was
// no way to tell that anything had happened. Left jammed a third of a unit out
// for the whole pinned beat, there are visibly TWO CARDS on the square, one of
// them under the other, which is the entire rules text in one picture.
//
// AND THE CRACK IS LIT. A thin hot line along the jailer's near and left
// edges, sitting just outside them so it falls on the buried card rather than
// on the art of the one standing on it, brightest at the corner the victim
// went in by. An L is the one shape on this board that says "there is a second
// card here", and it is the last thing left on screen. It BREATHES, and that
// slow pulse is what says the fighter under there is alive and can be let out
// — the distinction this whole motif exists to draw.
//
// WHAT THIS IS NOT. possess.js lays a card-shaped slab of black OVER a card
// and is the mirror image of this one, so nothing here is a rectangle of dark.
// chains.js already owns the LATERAL half of these same cards — the irons
// thrown from the captor and the long haul across the stone — so this motif
// never drags anything more than the last few inches and never shows a link of
// chain. Between them the Refractory cards read as one event: hauled in
// irons, then put under.
//
// Preview — `t` is MILLISECONDS INTO THE MOTIF, because --settle is wall clock
// and headless Chrome draws this table at a few frames a second:
//   node tools/shot.js --url "game/?quick=1&seed=5&t=500" \
//     --eval tools/fxdemo/bury.js --out /tmp/b.png --wait 10000 --settle 600
// &sweep=1 is the Man Catcher's two victims, &auroxi=1 the Shadowcaster.

import { THREE, CARD_W, CARD_H, FACTION, easeOut } from '../kit.js';
import { blobTexture } from '../../textures.js';

/* ------------------------------------------------------------- directions */

// pieces.js slides a buried card back (+z, toward the player) and left (-x) by
// 0.085 a layer so its edges stay visible. So the corner that stays in sight —
// and therefore the mouth the victim is shoved in by — is the near-left one,
// and the hinge the jailer opens on is the diagonal at right angles to it.
const IN = new THREE.Vector3(-1, 0, 1).normalize();
const ACROSS = new THREE.Vector3(1, 0, 1).normalize();

/* ---------------------------------------------------------------- timings */

/** Phase boundaries in seconds, not durations. */
const B = {
  RISE: 0.24,     // the jailer is up and tipped open
  SHOVE: 0.56,    // the victim has been driven home underneath it
  SLAM: 0.66,     // the weight lands
  JOLT: 0.86,     // the ring of the impact has died out of both cards
  HEAVE: 1.06,    // one push from underneath, and it fails
  FADE: 1.42,     // the seam starts to go out
  TOTAL: 1.76,
};

// How far the jailer rides up, and how far over it tips.
//
// Both of these were tripled after the first shots. At 0.34 and 0.21 — which
// looked like plenty in the editor — six ages of the motif laid out side by
// side were indistinguishable from six cards lying still: the camera is fixed
// at 52 degrees, height costs about 26 screen pixels per world unit, and a
// card is only 60 pixels wide, so a third of a unit of lift is eight pixels of
// daylight under a card whose own black border is three. The gap has to be
// wide enough to put a WHOLE CARD through, because that is exactly what goes
// through it.
const OPEN = 0.62;
const TIP = 0.30;

// How far out the victim starts.
//
// The single most legible event in this motif is a card DISAPPEARING UNDER
// another card, and that only happens if the victim was a card in its own
// right first. At 0.62 it never cleared its jailer's footprint and the whole
// shove happened out of sight; at 1.05 better than half of it is out in the
// open on the flagstone before it goes under. Width is free at this camera and
// height is not, so all of it is spent sideways — and it is still only a third
// of a square, because the long haul across the stone belongs to chains.js.
const SHOVE_OUT = 1.05;

// WHERE IT STOPS. pieces.js leaves a buried card sticking out by 0.085 a layer,
// which is three screen pixels — less than the card's own black border, and
// not enough for anyone to see that there are two cards on the square at all.
// So the shove stops SHORT and the victim is left jammed with a tenth of
// itself out in the open, plainly a second card, for the whole of the pinned
// beat; it is pressed the last of the way home only in the closing moments,
// which is also the last thing the motif says. Held at the true offset from
// the moment of the slam, the end state was a single card lying on a flagstone
// and the player had no way of knowing anything had happened to it.
const JAM = 0.34;

/* --------------------------------------------------------------- textures */

// Cached for the life of the page: kit.hold disposes materials, and a material
// never disposes its map.
const TEXES = new Map();
function tex(key, paint, size = 256) {
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

// The quad the seam is painted on: a square a little larger than a card,
// centred on the JAILER. Everything below is a fraction of it.
const SEAM_SPAN = CARD_W * 1.34;
const LEFT = 0.5 - (CARD_W * 0.5) / SEAM_SPAN;    // the jailer's left edge
const NEAR = 0.5 + (CARD_H * 0.5) / SEAM_SPAN;    // and its near edge

/**
 * The L of light in the crack.
 *
 * PlaneGeometry rotated -90° about x maps local +y to world -z, and a
 * CanvasTexture flips y, so canvas TOP is away from the camera and canvas
 * BOTTOM is toward it. The buried card slides back (+z, toward the player) and
 * left (-x), so the crack it shows through runs down the canvas's left edge
 * and along its bottom — an L with its corner at bottom left.
 *
 * It is NOT an even stroke. The light is concentrated at the corner and dies
 * away along both arms, which is the difference between a line leaking out of
 * a gap and a selection highlight drawn round a card. The board already
 * outlines squares to say "you may click this" and a glowing rectangle on a
 * card is that UI element, not a fighter trapped under a slab.
 *
 * `w` is the stroke width and `blur` its falloff, both as fractions of the
 * canvas, and `off` pushes the whole L OUTWARD — left and toward the player —
 * so the same painter cuts both the hot core, which sits on the crack, and the
 * dark band that lies just outside it.
 *
 * The offset is the part that was missing. Drawn concentric, the dark and the
 * light were the same line and the additive core simply ate the shadow: the
 * card came out with a pale mushy edge, which on this board reads as the
 * selection highlight and not as light escaping from under a slab. Pushed out,
 * the cross-section is card, hot line, dark, stone — which is what a lit gap
 * under something heavy actually looks like.
 */
const seamTex = (key, w, blur, alpha, off = 0) => tex(key, (g, S) => {
  const x = (LEFT - off) * S, y = (NEAR + off) * S;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  if (blur) g.filter = `blur(${blur * S}px)`;
  g.strokeStyle = `rgba(255,255,255,${alpha})`;
  g.lineWidth = w * S;
  g.beginPath();
  g.moveTo(x, S * 0.04);
  g.lineTo(x, y);
  g.lineTo(S * 0.96, y);
  g.stroke();
  g.filter = 'none';
  // Brightest at the corner the victim went in by, gone by the far ends. A
  // radial mask rather than two linear ones, so the corner itself is the peak
  // instead of a bright square where two ramps cross.
  g.globalCompositeOperation = 'destination-in';
  // The falloff is GENTLE. At a steeper one the arms were down to a tenth of
  // the corner's strength by the middle of each edge, so the only thing that
  // ever showed was a bright dot at the corner — which reads as a glint on the
  // stone, not as a seam running the length of two edges.
  const fall = g.createRadialGradient(x, y, 0, x, y, S * 0.95);
  fall.addColorStop(0.00, 'rgba(0,0,0,1)');
  fall.addColorStop(0.45, 'rgba(0,0,0,0.95)');
  fall.addColorStop(0.85, 'rgba(0,0,0,0.55)');
  fall.addColorStop(1.00, 'rgba(0,0,0,0)');
  g.fillStyle = fall;
  g.fillRect(0, 0, S, S);
});

// Grit and stone dust, for what is squeezed out from between two slabs.
let GRIT = null;
// Brighter than the flagstone, not the same colour as it. The first pass was
// rgba(212,196,168) — real stone dust — and eighteen puffs of it over a tan
// flagstone in a warm torchlit frame were completely invisible.
const gritPuff = () => (GRIT ||= blobTexture('rgba(244,224,190,0.95)', 'rgba(120,102,80,0)'));

/* ------------------------------------------------------------- the pieces */

/**
 * Everything on this square that is UNDER the card that resolved.
 *
 * `at` is the jailer, and the rules have already put the victims beneath it by
 * the time this plays, so the motif finds them by depth rather than being told
 * — which is also how the Man Catcher's whole sweep arrives as one event
 * instead of one effect per card.
 */
function victimsOf(kit, at) {
  const host = kit.piece(at);
  if (!host) return [];
  const out = [];
  for (const p of kit.pieces?.byUid?.values?.() || []) {
    if (p !== host && p.square === host.square && p.depth > host.depth) out.push(p);
  }
  return out.sort((a, b) => a.depth - b.depth);
}

const restOf = (p) => (p?.restingPosition ? p.restingPosition() : p.group.position.clone());

/* ----------------------------------------------------------- dust and light */

/**
 * Stone dust, thrown FLAT.
 *
 * kit.sparks rises and has no delay of its own, and every beat here has to be
 * booked before the motif starts — the animator replaces its list with a
 * filter() of the list it began the frame with, so a tween added from inside
 * another tween's callback is thrown away and never ticked. So this carries
 * its own delay.
 *
 * Dust off a slab landing on a slab goes SIDEWAYS. Given any real rise it
 * became a puff of smoke, which is the brand's language and belongs to heat.
 */
function dust(kit, at, {
  count = 14, spread = 1.5, rise = 0.16, size = 0.3, born = 0.5,
  life = 0.5, delay = 0, total = 1, gravity = 0.5,
}) {
  const grp = new THREE.Group();
  const from = [], vel = [];
  const map = gritPuff();
  for (let i = 0; i < count; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map, transparent: true, opacity: 0, depthWrite: false,
    }));
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.7;
    const r = 0.55 + Math.random() * 0.75;
    // Born on the PERIMETER of the pair, not in the middle of it. At a birth
    // radius of 0.5 every puff started inside the card's own footprint and the
    // slam drew a white veil across the art — fog on the one card the player is
    // trying to read. Dust squeezed out from between two slabs comes out at
    // the edges.
    from.push(at.clone().add(new THREE.Vector3(
      Math.cos(a) * born, (Math.random() - 0.5) * 0.02, Math.sin(a) * born)));
    s.position.copy(from[i]);
    s.scale.setScalar(size);
    vel.push(new THREE.Vector3(Math.cos(a) * spread * r,
      rise * (0.4 + Math.random()), Math.sin(a) * spread * r));
    grp.add(s);
  }
  kit.hold(grp, total, (t) => {
    const k = (t * total - delay) / life;
    grp.visible = k > 0 && k < 1;
    if (!grp.visible) return;
    for (let i = 0; i < grp.children.length; i++) {
      const s = grp.children[i];
      s.position.copy(from[i]).addScaledVector(vel[i], k);
      s.position.y -= k * k * gravity;
      s.material.opacity = 0.62 * (1 - k) ** 1.4 * Math.min(1, k * 9);
      s.scale.setScalar(size * (0.7 + k * 0.8));
    }
  });
}

/** A light that has to be booked in advance, for the same reason. */
function flash(kit, at, colour, { power, life, delay = 0, total, reach = 5 }) {
  const l = new THREE.PointLight(colour, 0, reach, 2);
  l.position.copy(at);
  kit.hold(l, total, (t) => {
    const k = (t * total - delay) / life;
    l.intensity = k <= 0 || k >= 1 ? 0 : power * (1 - k) * Math.min(1, k * 7);
  });
}

/* ------------------------------------------------------------------ motif */

export function bury(kit, at, faction) {
  // The jailer's own piece, and nothing else will do. Falling back to kit.at()
  // would take a bare uid and — since uids start at 1 and squares run 0..11 —
  // hand back a SQUARE for any of the first eleven cards dealt, which is the
  // hazard kit.js documents. There is also nothing to show: without the card
  // that is standing on the victim there is no weight and no seam.
  const host = kit.piece(at);
  if (!host) return;
  const anchor = restOf(host);
  const look = FACTION[faction] || FACTION.Neutral;
  const victims = victimsOf(kit, at);

  /* --- the victims: shoved home, flat and fast, and then held down. */
  victims.forEach((v, i) => {
    const uid = v.card?.uid;
    const home = restOf(v);
    // Staggered when a Man Catcher sweeps a whole square: three cards arriving
    // in the same frame is one card arriving, three cards thick.
    const lag = i * 0.075;
    // WHERE IT COMES FROM. The rules have already put the card under the stack
    // by the time this plays, but pieces.js has not moved it yet — a fighter
    // that was standing somewhere else is still standing there, because the
    // piece only lerps toward its resting place in update(). So a Shadowcaster
    // relocating a Shadow from across the board gets its real journey for
    // free, and a jailer catching the fighter next door — which has no
    // journey, only a change of level — gets the synthetic shove from the
    // corner instead. Clamped, because a card crossing three squares in a
    // third of a second is a thrown card, not a shoved one.
    const held = v.group.position.clone().setY(home.y);
    const travelled = held.distanceTo(home);
    const start = travelled > SHOVE_OUT
      ? home.clone().lerp(held, Math.min(1, 2.6 / travelled))
      : home.clone().addScaledVector(IN, SHOVE_OUT);
    start.y = home.y + 0.055;
    // the dust it ploughs up, and the edge it rides in on, follow the way it
    // actually came rather than the way the stack happens to be offset
    const lead = start.clone().sub(home).setY(0);
    const hinge = lead.lengthSq() > 1e-6
      ? new THREE.Vector3(-lead.z, 0, lead.x).normalize() : ACROSS;
    // Wherever it came from, it seats into the stack's own offset direction,
    // so the corner left showing is the one pieces.js will keep showing.
    const jam = home.clone().addScaledVector(IN, JAM);
    kit.hold(new THREE.Object3D(), B.TOTAL, (t) => {
      const s = t * B.TOTAL;
      const p = kit.piece(uid) || v;
      // set every tick, not once: the board's own 0.3s homing lerp clears this
      // flag when it ends and the card snapped into place mid-shove
      p.animating = true;
      const k = Math.min(1, Math.max(0, (s - lag) / (B.SHOVE - lag)));
      // ACCELERATING, and stopped dead. easeOut was the wrong curve by a mile:
      // it put the card 99 per cent of the way home a fifth of the way through
      // its own shove, so every shot but the first two frames showed it
      // already under the stack and the travel was never seen at all. Driven
      // from behind, it spends most of the beat out in the open where it can
      // be read as a whole card, and goes under fast.
      const e = k * k * (1.7 - 0.7 * k);
      p.group.position.lerpVectors(start, jam, e);
      // it goes in tipped up on its leading edge and is flattened by the slab
      // coming down on it, which is the one frame that says it was FORCED
      const tipUp = (1 - e) * 0.16 + (s > B.SLAM ? 0
        : Math.max(0, 1 - (s - B.SHOVE) / (B.SLAM - B.SHOVE)) * 0.05);
      p.group.quaternion.setFromAxisAngle(hinge, tipUp);
      if (s > B.SLAM) {
        // squashed under the weight, then still
        const j = s - B.SLAM;
        p.group.position.y = home.y - 0.012 * Math.exp(-j * 7) * Math.cos(j * 26);
        // one shove back out from underneath, at the same moment the jailer
        // is tipped by it, and it gains nothing
        if (s > B.HEAVE && s < B.HEAVE + 0.16) {
          const push = Math.sin(Math.PI * Math.min(1, (s - B.HEAVE) / 0.16 * 1.25)) ** 1.5;
          p.group.position.addScaledVector(IN, 0.055 * push);
        }
        // THE LIGHT GOES OUT OF IT. pieces.js dims a buried card to 0.42 in
        // update(), but update() returns early while an animation owns the
        // piece, so through the whole pinned beat the victim was as brightly
        // lit as the fighter standing on it — and then dropped to half
        // brightness in one frame the moment the motif released it. Dimming it
        // here across the press is the same signal, arrived at honestly, and
        // it hands over to pieces.js with nothing to see.
        const gone = Math.min(1, (s - B.SLAM) / 0.5);
        p.frontMat?.color.setScalar(1 - 0.58 * gone);
        // and then it is pressed the rest of the way under, which is the last
        // thing that happens
        if (s > B.FADE) {
          const f = Math.min(1, (s - B.FADE) / (B.TOTAL - B.FADE));
          p.group.position.lerpVectors(jam, home, f * f * (3 - 2 * f));
          p.group.position.y = home.y;
        }
      }
    }, () => {
      const p = kit.piece(uid) || v;
      p.group.position.copy(restOf(p));
      p.group.quaternion.identity();
      p.animating = false;
    });
  });

  /* --- the jailer: heaves up, hangs open, and comes down. */
  const home = restOf(host);
  kit.hold(new THREE.Object3D(), B.TOTAL, (t) => {
    const s = t * B.TOTAL;
    const p = kit.piece(at) || host;
    p.animating = true;
    let up = 0, tip = 0;
    if (s < B.RISE) {
      // hauled up, not lifted: the effort is at the start
      const k = easeOut(s / B.RISE);
      up = OPEN * k; tip = TIP * k;
    } else if (s < B.SLAM) {
      // held open while the victim goes under, breathing slightly
      up = OPEN + 0.012 * Math.sin((s - B.RISE) * 9);
      tip = TIP;
    } else if (s < B.JOLT) {
      // dropped. Nothing eases a falling slab in, and the rebound is the
      // weight of it — a plain lerp down read as the card being lowered by
      // hand and took every ounce out of the motif.
      const k = (s - B.SLAM) / (B.JOLT - B.SLAM);
      up = -0.02 * Math.exp(-k * 5.5) * Math.cos(k * 19);
      tip = TIP * Math.max(0, 1 - k * 3.4) + 0.02 * Math.exp(-k * 6) * Math.sin(k * 17);
    } else if (s < B.HEAVE + 0.16) {
      // ONE PUSH FROM UNDERNEATH, and it fails. This is the beat that says
      // the fighter under there is alive rather than dead, and it is a TIP
      // and not a lift: at this camera a card raised by 0.05 moves one and a
      // half pixels, while the same card tipped about the seam lifts its far
      // corner by four.
      const k = Math.max(0, (s - B.HEAVE) / 0.16);
      const push = Math.sin(Math.PI * Math.min(1, k * 1.25)) ** 1.5;
      up = 0.018 * push;
      tip = -0.085 * push;
    }
    p.group.position.copy(home);
    p.group.position.y += up;
    // Tipped about the axis ACROSS the seam, and NEGATIVE, so the near-left
    // corner — the mouth the victim goes in by — is the one that opens. A
    // positive angle about this axis lifts the far-right corner instead,
    // which had the jailer yawning open on the side nothing was coming from.
    p.group.quaternion.setFromAxisAngle(ACROSS, -tip);
  }, () => {
    const p = kit.piece(at) || host;
    p.group.position.copy(restOf(p));
    p.group.quaternion.identity();
    p.animating = false;
  });

  /* --- the seam: the light in the crack, and the dark that makes it read. */
  const seam = new THREE.Group();
  seam.position.set(anchor.x, anchor.y + 0.055, anchor.z);
  const plate = (map, colour, blending, order, opacity) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(SEAM_SPAN, SEAM_SPAN),
      new THREE.MeshBasicMaterial({
        map, color: colour, transparent: true, opacity, depthWrite: false,
        side: THREE.DoubleSide, blending,
      }),
    );
    m.rotation.x = -Math.PI / 2;
    m.renderOrder = order;
    seam.add(m);
    return m;
  };
  // Three passes, dark first: contrast on this board is bought with shadow, and
  // an additive line on its own washed out over pale flagstone and read as a
  // scratch on the lens.
  //
  // The widths are fractions of a quad 2.33 units across, so 0.032 is a core
  // line nearly three pixels wide. The first cut ran at 0.018 — one and a half
  // pixels — and a sub-pixel detail is an absent detail: it did not show up in
  // a single shot.
  //
  // ALL THREE SIT OUTSIDE THE JAILER'S EDGE, which is the other half of it.
  // Laid ON the edge, half of every stroke fell across the top card's art and
  // the motif ended in a pale smear — a smudge, not a gap. Pushed out by a
  // little more than their own width, the hot line lands on the sliver of the
  // BURIED card, so what is lit is the thing that is trapped.
  const shade = plate(seamTex('bury-shade', 0.100, 0.038, 0.92, 0.062), 0x08060a,
    THREE.NormalBlending, 20, 0);
  const halo = plate(seamTex('bury-halo', 0.052, 0.020, 0.42, 0.040), look.spark,
    THREE.AdditiveBlending, 21, 0);
  // Washed most of the way to white. At the faction's own gold the line read
  // as a warm ribbon lying on a warm card in a warm frame and had no contrast
  // at all; near-white over the dark band beside it reads as light, and the
  // faction's colour still shows in the halo around it.
  const core = new THREE.Color(look.spark).lerp(new THREE.Color(0xffffff), 0.34);
  const light = plate(seamTex('bury-core', 0.032, 0.007, 1, 0.034), core,
    THREE.AdditiveBlending, 22, 0);

  kit.hold(seam, B.TOTAL, (t) => {
    const s = t * B.TOTAL;
    if (s < B.SLAM) { seam.visible = false; return; }
    seam.visible = true;
    const out = s > B.FADE ? Math.max(0, 1 - (s - B.FADE) / (B.TOTAL - B.FADE)) : 1;
    // Two flares: the moment the weight lands, and the moment the push from
    // underneath fails. Between and after them it BREATHES — a slow pulse is
    // the cheapest thing on this board that says something is still alive, and
    // at sixty pixels it is worth more than any amount of detail.
    const land = Math.max(0, 1 - (s - B.SLAM) / 0.22) ** 2;
    const strain = Math.max(0, 1 - Math.abs(s - (B.HEAVE + 0.07)) / 0.14) ** 2;
    const breathe = 0.5 + 0.5 * Math.sin((s - B.SLAM) * 5.2 - 1.5);
    const lit = Math.min(1, (s - B.SLAM) / 0.06);
    // Balanced off two shots: at a base of 0.42 the steady seam was thin
    // enough to miss, and with a 0.55 flare on top of it the strain beat
    // summed past 1.0 and came out as a pure white L — ACES turns any
    // additive that oversteps into paper. Steady is now most of the way up
    // and the flares only lean on it.
    light.material.opacity = (0.62 + 0.20 * breathe + 0.30 * land + 0.24 * strain) * lit * out;
    halo.material.opacity = (0.16 + 0.10 * breathe + 0.20 * land + 0.16 * strain) * lit * out;
    // the weight's own shadow arrives with the slab and outlives the glow
    shade.material.opacity = 0.62 * lit * (0.55 + 0.45 * out);
  });

  /* --- what the impact throws out, and what lights it. */
  // Below the card face rather than above it: a sprite is a billboard and one
  // born level with the art paints straight over it.
  const seat = anchor.clone().setY(anchor.y - 0.05);
  // Flat and wide. Height is expensive here and width is free, so the dust
  // spends everything it has going sideways across the flagstone.
  dust(kit, seat, {
    count: 12, spread: 1.5, rise: 0.15, size: 0.44, born: 0.98,
    delay: B.SLAM, life: 0.52, total: B.TOTAL, gravity: 0.55,
  });
  // grit kicked up ahead of the victim as it is driven under
  dust(kit, anchor.clone().addScaledVector(IN, 0.5).setY(anchor.y + 0.02), {
    count: 5, spread: 0.85, rise: 0.1, size: 0.42,
    delay: B.SHOVE - 0.12, life: 0.4, total: B.TOTAL, gravity: 0.4,
  });
  // and a last few grains shaken loose when the push from underneath fails
  dust(kit, anchor.clone().addScaledVector(IN, 0.8).setY(anchor.y + 0.02), {
    count: 5, spread: 0.7, rise: 0.22, size: 0.36,
    delay: B.HEAVE + 0.04, life: 0.45, total: B.TOTAL, gravity: 0.6,
  });

  // HEIGHT, not power. A point light falls off as 1/d^2 with a floor of 0.01,
  // so a flash sitting just above the card face is multiplied by a hundred and
  // burns a white hole in the art at the one moment the two cards most need to
  // be told apart. Lifted about a card's width up it is a pool instead.
  flash(kit, anchor.clone().setY(anchor.y + 0.95), 0xfff0d2,
    { power: 7.5, delay: B.SLAM, life: 0.22, total: B.TOTAL, reach: 4.4 });
  // and a low, weak one at the corner for the rest of the motif, so the stone
  // beside the crack takes some of the colour the seam is burning
  const corner = anchor.clone()
    .addScaledVector(IN, (CARD_W + CARD_H) * 0.26).setY(anchor.y + 0.1);
  flash(kit, corner, look.spark,
    { power: 1.8, delay: B.SLAM, life: B.TOTAL - B.SLAM, total: B.TOTAL, reach: 2.2 });

  // The shock running out across the stone, at the landing and not before.
  // kit.ring draws at y=0.1 whatever it is handed, under a card face at 0.21:
  // below about 1.8 it never escapes the card it is under, and much above 3 it
  // parks a pale slab over the neighbouring squares.
  kit.after(B.SLAM, () => kit.ring(anchor, 0xd8c49c, { size: 3.0, seconds: 0.36 }));
}
