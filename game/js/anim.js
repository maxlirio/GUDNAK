// Animation.
//
// The engine resolves an action instantly and completely — that is what keeps
// it deterministic and what lets the netcode ship moves instead of boards. So
// nothing here may change the game. Animations are played AFTER the fact, from
// a diff of the board before and after, and the UI is simply held until they
// finish.
//
// Cards are physical objects on a table, so everything here is weight and
// momentum: a deployed card is dealt in an arc and lands with a thump, a moving
// card slides and overshoots a little, an attacker lunges and recoils, and a
// destroyed card is knocked flat and slides off.

import * as THREE from 'three';
import { squareToWorld, strongholdPosition, graveyardPosition, CARD_W, CARD_H } from './board.js';
import { blobTexture, cardTexture } from './textures.js';

const easeOutCubic = (t) => 1 - (1 - t) ** 3;
const easeInCubic = (t) => t * t * t;
const easeOutBack = (t) => 1 + 2.2 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** A single running animation. `step(t)` gets 0..1. */
class Tween {
  constructor(seconds, step, onDone) {
    this.life = 0;
    this.span = Math.max(0.001, seconds);
    this.step = step;
    this.onDone = onDone;
  }
  update(dt) {
    this.life += dt;
    const t = Math.min(1, this.life / this.span);
    this.step(t);
    if (t >= 1) { this.onDone?.(); return true; }
    return false;
  }
}

export class Animator {
  constructor(scene) {
    this.scene = scene;
    this.running = [];
    this.fx = [];
  }

  get busy() { return this.running.length > 0; }

  add(seconds, step, onDone) {
    const tw = new Tween(seconds, step, onDone);
    this.running.push(tw);
    return tw;
  }

  update(dt) {
    this.running = this.running.filter((t) => !t.update(dt));
    this.fx = this.fx.filter((f) => {
      f.life += dt;
      const k = f.life / f.span;
      if (k >= 1) { this.scene.remove(f.obj); return false; }
      f.tick(k);
      return true;
    });
  }

  /* ---------------------------------------------------------- effects */

  /** An expanding ring on the ground — landings, clashes, deaths. */
  ring(square, { colour = 0xffd9a8, size = 2.4, seconds = 0.5, y = 0.1, at = null } = {}) {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.2, 0.34, 28),
      new THREE.MeshBasicMaterial({
        color: colour, transparent: true, opacity: 0.9,
        side: THREE.DoubleSide, depthWrite: false,
      }),
    );
    const p = at || squareToWorld(square);
    mesh.position.set(p.x, y, p.z);
    mesh.rotation.x = -Math.PI / 2;
    this.scene.add(mesh);
    this.fx.push({
      obj: mesh, life: 0, span: seconds,
      tick: (k) => {
        const s = 1 + easeOutCubic(k) * size;
        mesh.scale.setScalar(s);
        mesh.material.opacity = 0.9 * (1 - k);
      },
    });
  }

  /** A puff of dust or sparks at a square. */
  burst(square, { colour = 'rgba(255,220,170,1)', count = 14, seconds = 0.6, up = 1.1 } = {}) {
    const p = squareToWorld(square);
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const vel = [];
    for (let i = 0; i < count; i++) {
      pos[i * 3] = p.x; pos[i * 3 + 1] = 0.2; pos[i * 3 + 2] = p.z;
      const a = (i / count) * Math.PI * 2 + Math.random();
      const r = 0.7 + Math.random() * 1.5;
      vel.push([Math.cos(a) * r, up * (0.5 + Math.random()), Math.sin(a) * r]);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.28, map: blobTexture(colour, colour.replace(/1\)$/, '0)')),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.scene.add(pts);
    this.fx.push({
      obj: pts, life: 0, span: seconds,
      tick: (k) => {
        const a = geo.attributes.position;
        for (let i = 0; i < count; i++) {
          a.setX(i, p.x + vel[i][0] * k);
          a.setY(i, 0.2 + vel[i][1] * k - 2.2 * k * k);
          a.setZ(i, p.z + vel[i][2] * k);
        }
        a.needsUpdate = true;
        pts.material.opacity = 1 - k;
      },
    });
  }

  /** A hard white flash, for the instant two fighters meet. */
  flash(square, { colour = 0xffffff, seconds = 0.26 } = {}) {
    const light = new THREE.PointLight(colour, 0, 9, 2);
    const p = squareToWorld(square);
    light.position.set(p.x, 1.2, p.z);
    this.scene.add(light);
    this.fx.push({
      obj: light, life: 0, span: seconds,
      tick: (k) => { light.intensity = 26 * (1 - k) * (k < 0.15 ? k / 0.15 : 1); },
    });
  }

  /* ---------------------------------------------------------- the deck */

  /** A loose card-back, used for anything flying to or from a deck. */
  #looseCard() {
    const mat = new THREE.MeshStandardMaterial({
      map: cardTexture('../site/assets/card-back.jpg'), roughness: 0.65,
    });
    const edge = new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.85 });
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(CARD_W, 0.035, CARD_H),
      [edge, edge, mat, mat, edge, edge],
    );
    mesh.castShadow = true;
    this.scene.add(mesh);
    return mesh;
  }

  /**
   * Drawing: a card lifts off the Stronghold, flips face-down-to-edge as it
   * arcs out toward its owner, and shrinks away into their hand.
   */
  draw(player, done) {
    const from = strongholdPosition(player);
    const card = this.#looseCard();
    const to = from.clone();
    to.z += (player === 0 ? 1 : -1) * 4.2;
    to.x += (player === 0 ? 1 : -1) * 1.6;

    this.add(0.42, (t) => {
      const e = easeInOut(t);
      card.position.lerpVectors(from, to, e);
      card.position.y = 0.45 + Math.sin(Math.PI * t) * 1.5;
      card.rotation.x = e * 0.9 * (player === 0 ? 1 : -1);
      card.rotation.z = e * 0.4;
      const k = 1 - e * 0.65;
      card.scale.setScalar(k);
    }, () => { this.scene.remove(card); done?.(); });

    this.ring(null, { colour: 0xd8b163, seconds: 0.35, size: 0.9, at: from, y: 0.4 });
  }

  /** Milling: the top card slides off the Stronghold onto the discard pile. */
  mill(player, done) {
    const from = strongholdPosition(player);
    const to = graveyardPosition(player);
    const card = this.#looseCard();

    this.add(0.4, (t) => {
      const e = easeOutCubic(t);
      card.position.lerpVectors(from, to, e);
      card.position.y = 0.45 + Math.sin(Math.PI * t) * 0.9;
      card.rotation.y = e * Math.PI;      // turns face up as it lands
      card.rotation.z = (1 - e) * 0.3;
    }, () => { this.scene.remove(card); done?.(); });
  }

  /* ---------------------------------------------------------- moves */

  /** Deal a card in from off-table: it arcs, spins, and lands with a thump. */
  /**
   * `origin` is where the card was sitting IN HAND, in world terms. Without it
   * a played card could only be thrown in from off-stage — it appeared out of
   * nowhere beside the board instead of leaving the card you had just clicked.
   */
  deploy(piece, square, done, origin = null) {
    const to = squareToWorld(square);
    const from = origin ? origin.clone() : to.clone();
    if (!origin) {
      from.x += (piece.owner === 0 ? -1 : 1) * 5.5;
      from.z += (piece.owner === 0 ? 1 : -1) * 6.0;
    }

    piece.animating = true;
    piece.group.position.copy(from);
    const spin = (piece.owner === 0 ? 1 : -1) * Math.PI * 1.5;

    this.add(0.46, (t) => {
      const e = easeOutCubic(t);
      piece.group.position.lerpVectors(from, to, e);
      // a flatter arc when it comes from the hand, which is already low and
      // close to the camera — a 2.6 unit hop from there flies off the top
      piece.group.position.y = (origin ? from.y * (1 - e) : 0.09)
        + 0.09 * e + Math.sin(Math.PI * t) * (origin ? 0.9 : 2.6);
      piece.card3d.rotation.y = piece.baseYaw + spin * (1 - e);
      piece.card3d.rotation.z = (1 - e) * 0.5;
      piece.group.scale.setScalar(0.7 + 0.3 * e);
    }, () => {
      piece.card3d.rotation.z = 0;
      piece.group.scale.setScalar(1);
      piece.animating = false;
      this.ring(square, { colour: 0xffe2b0, size: 1.6, seconds: 0.45 });
      this.burst(square, { count: 12, seconds: 0.5, up: 0.7 });
      done?.();
    });
  }

  /** Slide, with a little overshoot so it has weight. */
  move(piece, fromSquare, toSquare, done) {
    const from = squareToWorld(fromSquare);
    const to = squareToWorld(toSquare);
    piece.animating = true;
    this.add(0.3, (t) => {
      const e = easeOutBack(t);
      piece.group.position.lerpVectors(from, to, e);
      piece.group.position.y = 0.09 + Math.sin(Math.PI * t) * 0.3;
    }, () => {
      piece.animating = false;
      this.burst(toSquare, { count: 6, seconds: 0.35, up: 0.3, colour: 'rgba(210,190,160,1)' });
      done?.();
    });
  }

  /**
   * The attacker lunges into the defender and recoils. The flash lands on the
   * frame they meet, which is what sells the hit.
   */
  attack(piece, fromSquare, toSquare, { onImpact, done } = {}) {
    const from = squareToWorld(fromSquare);
    const to = squareToWorld(toSquare);
    const lunge = from.clone().lerp(to, 0.62);
    piece.animating = true;
    let hit = false;

    this.add(0.42, (t) => {
      if (t < 0.4) {
        const e = easeInCubic(t / 0.4);
        piece.group.position.lerpVectors(from, lunge, e);
        piece.group.position.y = 0.09 + e * 0.45;
      } else {
        if (!hit) {
          hit = true;
          this.flash(toSquare);
          this.ring(toSquare, { colour: 0xffd0a0, size: 2.0, seconds: 0.4 });
          this.burst(toSquare, { count: 18, seconds: 0.5, colour: 'rgba(255,200,140,1)' });
          onImpact?.();
        }
        const e = easeOutCubic((t - 0.4) / 0.6);
        piece.group.position.lerpVectors(lunge, from, e);
        piece.group.position.y = 0.09 + (1 - e) * 0.45;
      }
    }, () => { piece.animating = false; done?.(); });
  }

  /**
   * Killed: struck flat, then thrown onto its owner's discard pile. Cards go
   * somewhere when they die, so the eye can follow where.
   */
  destroy(piece, square, done) {
    const at = piece.group.position.clone();
    const pile = graveyardPosition(piece.owner);
    piece.animating = true;

    this.burst(square, { count: 16, seconds: 0.55, colour: 'rgba(190,80,70,1)' });
    this.ring(square, { colour: 0xd0554f, size: 1.8, seconds: 0.5 });

    this.add(0.62, (t) => {
      // struck first, thrown second
      if (t < 0.28) {
        const e = easeOutCubic(t / 0.28);
        piece.group.position.y = at.y + e * 0.35;
        piece.card3d.rotation.z = e * 0.5;
        piece.group.scale.setScalar(1 + e * 0.06);
        return;
      }
      const e = easeInOut((t - 0.28) / 0.72);
      piece.group.position.lerpVectors(at, pile, e);
      piece.group.position.y = at.y + 0.35 + Math.sin(Math.PI * e) * 1.4 - e * 0.25;
      piece.card3d.rotation.z = 0.5 + e * 2.2;
      piece.group.scale.setScalar(1.06 - e * 0.3);
      piece.frontMat.opacity = 1 - e * 0.85;
      piece.frontMat.transparent = true;
    }, () => { piece.animating = false; done?.(); });
  }

  /** Bounced back to a hand: lifted off the board and pulled to its owner. */
  vanish(piece, done) {
    const at = piece.group.position.clone();
    const to = strongholdPosition(piece.owner).clone();
    to.z += (piece.owner === 0 ? 1 : -1) * 3.4;
    piece.animating = true;
    this.add(0.4, (t) => {
      const e = easeInOut(t);
      piece.group.position.lerpVectors(at, to, e);
      piece.group.position.y = at.y + Math.sin(Math.PI * t) * 1.6;
      piece.group.scale.setScalar(1 - e * 0.7);
      piece.frontMat.opacity = 1 - e * 0.9;
      piece.frontMat.transparent = true;
    }, () => { piece.animating = false; done?.(); });
  }

  /**
   * Discarding from hand — paying for a Defend, or a Tactic's cost. The card
   * comes from where the hand is, not from nowhere.
   */
  discardFromHand(player, done, origin = null) {
    const from = origin ? origin.clone() : strongholdPosition(player).clone();
    if (!origin) {
      from.z += (player === 0 ? 1 : -1) * 4.4;
      from.x += (player === 0 ? 1 : -1) * 1.4;
    }
    const to = graveyardPosition(player);
    const card = this.#looseCard();
    card.position.copy(from);

    this.add(0.44, (t) => {
      const e = easeInOut(t);
      card.position.lerpVectors(from, to, e);
      card.position.y = (origin ? from.y : 0.9) * (1 - e) + 0.45 * e
        + Math.sin(Math.PI * t) * 1.1;
      card.rotation.y = e * Math.PI;
      card.rotation.z = (1 - e) * 0.6;
      card.scale.setScalar(0.4 + e * 0.6);
    }, () => { this.scene.remove(card); done?.(); });
  }

  /** The Stronghold rising as a fighter — big, slow, and unmissable. */
  rise(piece, square, done) {
    const to = squareToWorld(square);
    piece.animating = true;
    this.ring(square, { colour: 0xff7a3a, size: 4.5, seconds: 1.0 });
    this.add(0.8, (t) => {
      const e = easeOutCubic(t);
      piece.group.position.set(to.x, -1.4 + e * (0.09 + 1.4), to.z);
      piece.group.scale.setScalar(0.5 + e * 0.5);
      piece.card3d.rotation.y = piece.baseYaw + (1 - e) * Math.PI;
    }, () => {
      piece.group.scale.setScalar(1);
      piece.animating = false;
      this.burst(square, { count: 26, seconds: 0.9, colour: 'rgba(255,150,80,1)', up: 1.6 });
      done?.();
    });
  }
}

/**
 * What changed between two board snapshots.
 *
 * The engine does not tell the view what happened — it just resolves. Rather
 * than have every card report its own animation (which would put view concerns
 * inside the rules), the table takes a snapshot before the action and diffs it
 * afterwards.
 */
export function snapshotBoard(state) {
  const where = new Map();
  state.board.forEach((stack, square) => {
    (stack || []).forEach((card, depth) => where.set(card.uid, { square, depth, def: card.def }));
  });
  return where;
}

export function diffBoard(before, after) {
  const entered = [], moved = [], left = [];
  for (const [uid, now] of after) {
    const was = before.get(uid);
    if (!was) entered.push({ uid, to: now.square, def: now.def });
    else if (was.square !== now.square) moved.push({ uid, from: was.square, to: now.square });
  }
  for (const [uid, was] of before) {
    if (!after.has(uid)) left.push({ uid, from: was.square, def: was.def });
  }
  return { entered, moved, left };
}
