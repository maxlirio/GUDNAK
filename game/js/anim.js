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
//
// NOTHING HERE MOVES A REAL CARD. Every animation below hands the card to a
// STUNT DOUBLE — see Animator.#stand — and flies that instead. The real card is
// hidden and put where the state says it is the instant the rules say so, which
// is the only way the two can stop fighting: the board is correct on the first
// frame, and the stunt work happens in front of it.

import * as THREE from 'three';
import { squareToWorld, strongholdPosition, graveyardPosition, CARD_W, CARD_H } from './board.js';
import { blobTexture, cardTexture, faceTexture } from './textures.js';

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
    // An animation that finishes may START another — a card effect waits for
    // the cloth to have hold of someone before it burns them. Assigning the
    // filtered array back over `this.running` threw away anything added DURING
    // the pass, so every one of those follow-ups was silently discarded and
    // the effects simply never happened.
    const pass = this.running;
    this.running = [];
    const alive = pass.filter((t) => !t.update(dt));
    this.running = alive.concat(this.running);

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

  /* ------------------------------------------------------ stunt doubles */

  /**
   * Hand a card over to a stunt double.
   *
   * The double is pixel-identical to the card (see Piece.makeProxy) and is
   * what the animation actually moves. The real card is hidden for the
   * duration and, if it is still on the board, snapped straight to the place
   * its square and depth say it belongs — so the board is already correct the
   * instant the rules say it is, whatever the animation is still doing.
   *
   * `rest: false` is for a card that has LEFT the board. It has no true place
   * left to be put in, so it just stays hidden and main.js retires it when the
   * animation ends.
   *
   * Two animations can claim the same card — a shove and the motif that caused
   * it — so the doubles are counted and the card only comes back when the last
   * of them has let go.
   */
  #stand(piece, { rest = true } = {}) {
    const dbl = piece.makeProxy();
    this.scene.add(dbl.group);
    piece.doubles = (piece.doubles || 0) + 1;
    piece.group.visible = false;
    // The card is NOT animating any more as far as anything else is
    // concerned: it is standing still, in the right place, being covered for.
    piece.animating = false;
    if (rest) piece.snapToRest();

    // The double follows the real card's TONE. A card is dimmed to 42% the
    // moment the state buries it, so without this the double slid under a
    // stack at full brightness and the card popped dark the instant it was
    // handed back. Now it darkens as it goes under, which is the read.
    dbl.tone = piece.frontMat;

    let gone = false;
    dbl.release = () => {
      if (gone) return;
      gone = true;
      this.scene.remove(dbl.group);
      dbl.dispose();
      piece.doubles = Math.max(0, (piece.doubles || 1) - 1);
      if (rest && piece.doubles === 0) piece.group.visible = true;
    };
    return dbl;
  }

  /** Run a tween on a double and clear the double away when it ends. */
  #play(dbl, seconds, step, onDone) {
    return this.add(seconds, (t) => {
      step(t);
      // the contact shadow stays on the ground under whatever the double does
      dbl.contact.position.y = -dbl.group.position.y + 0.075;
      if (dbl.tone) dbl.frontMat.color.copy(dbl.tone.color);
    }, () => { dbl.release(); onDone?.(); });
  }

  /* ---------------------------------------------------------- the deck */

  /**
   * A loose card — one with no piece on the board behind it, for anything
   * flying to or from a deck or a hand.
   *
   * With a `def` it shows that card's printed face on top and the card back
   * underneath, so it can turn over; without one it is a card back both ways,
   * which is all anyone can see of a deck. It owns its geometry and its
   * materials and disposes them in #dropLoose; the face and back MAPS are the
   * shared cached ones and are left alone.
   */
  #looseCard(def = null) {
    const back = new THREE.MeshStandardMaterial({
      map: cardTexture('../site/assets/card-back.jpg'), roughness: 0.65,
    });
    const face = def
      ? new THREE.MeshStandardMaterial({ map: faceTexture(def), roughness: 0.55, metalness: 0.03 })
      : back;
    const edge = new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.85 });
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(CARD_W, 0.035, CARD_H),
      [edge, edge, face, back, edge, edge],
    );
    mesh.castShadow = true;
    this.scene.add(mesh);
    return mesh;
  }

  /** Take a loose card away again, and its own materials with it. */
  #dropLoose(mesh) {
    this.scene.remove(mesh);
    mesh.geometry.dispose();
    // The same material appears several times in the array — and when there is
    // no face, the back IS the face. Dispose each one once; the maps they
    // point at are cached and shared with every other card on the table.
    for (const m of new Set(mesh.material)) m.dispose();
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
    }, () => { this.#dropLoose(card); done?.(); });

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
    }, () => { this.#dropLoose(card); done?.(); });
  }

  /**
   * Shuffled back into the deck — Migration puts itself back, and several
   * cards return a fighter or a Tactic to the pile.
   *
   * There was no animation for this at ALL. A Tactic never gets a piece on the
   * board (Pieces.sync only walks state.board and state.constructs), and both
   * playDeckAnimations and playHandDiscards compute zero for a card that goes
   * from the hand to the DECK rather than to the graveyard — so Migration
   * simply disappeared out of the hand and the deck silently grew by one.
   *
   * The card is a stunt double of exactly the kind the rest of this file uses:
   * the rules have already put it in the deck, and this is a throwaway copy
   * showing you where it went. It lifts out of the hand face up so you can see
   * WHICH card it is, turns face down as it goes over, and is pushed square
   * into the pile — which takes the knock.
   */
  shuffleIntoDeck(player, def, { origin = null, pile = null, count = 0, done } = {}) {
    const to = strongholdPosition(player);
    // Where the top of the pile ends up, matching board.js's own sum: the
    // plinth at 0.085 plus 21 thousandths of a unit per card in it.
    to.y = 0.085 + Math.max(0.02, count * 0.021) + 0.02;

    const from = origin ? origin.clone() : strongholdPosition(player);
    if (!origin) {
      from.z += (player === 0 ? 1 : -1) * 4.4;
      from.x += (player === 0 ? 1 : -1) * 1.4;
      from.y = 0.9;
    }

    const card = this.#looseCard(def);
    card.position.copy(from);
    const lifted = from.clone().setY(from.y + 1.15);
    const yaw = (player === 0 ? 1 : -1) * 0.55;

    this.add(0.9, (t) => {
      // Two beats: held up long enough to be READ, then put away.
      if (t < 0.4) {
        const e = easeOutCubic(t / 0.4);
        card.position.lerpVectors(from, lifted, e);
        card.rotation.set(0, 0, 0);
        card.scale.setScalar(0.62 + e * 0.63);
        return;
      }
      const e = easeInOut((t - 0.4) / 0.6);
      card.position.lerpVectors(lifted, to, e);
      card.position.y += Math.sin(Math.PI * e) * 0.7;
      // The turn is LATE and quick. Turning over across the whole carry left
      // the card edge-on for most of it — and a card seen edge-on from a
      // camera nineteen units up is a three-centimetre sliver, which is to say
      // it vanished halfway to the deck and the effect read as a card being
      // deleted again.
      card.rotation.x = Math.PI * easeInCubic(Math.max(0, (e - 0.62) / 0.38));
      card.rotation.y = yaw * Math.sin(Math.PI * e);
      card.scale.setScalar(1.25 - e * 0.25);
    }, () => {
      this.#dropLoose(card);
      // The pile takes it: a short bounce and dust off the plinth. Dust, not a
      // ring — squares 10 and 11 ARE the two Stronghold plinths, so the burst
      // lands on the right one, and a pale ring sitting on the deck read as a
      // smudge painted over the card back rather than as an impact.
      if (pile) this.knock(pile);
      this.burst(10 + player, {
        count: 9, seconds: 0.45, up: 0.35, colour: 'rgba(206,188,158,1)',
      });
      done?.();
    });
  }

  /**
   * A pile jolting as something lands on it.
   *
   * board.js rebuilds the deck's height from the card count every frame, and
   * the frame loop runs board.update BEFORE anim.update — so an offset written
   * here survives to the render and is gone by the next frame's base, which is
   * the same trick the pile's own hover-lift uses.
   */
  knock(mesh, { drop = 0.13, seconds = 0.34 } = {}) {
    this.add(seconds, (t) => {
      const k = Math.sin(Math.PI * t) * Math.exp(-t * 2.4);
      mesh.position.y -= drop * k;
      mesh.rotation.z = 0.05 * k * Math.sin(t * 22);
    }, () => { mesh.rotation.z = 0; });
  }

  /* ---------------------------------------------------------- moves */

  /** Deal a card in from off-table: it arcs, spins, and lands with a thump. */
  /**
   * `origin` is where the card was sitting IN HAND, in world terms. Without it
   * a played card could only be thrown in from off-stage — it appeared out of
   * nowhere beside the board instead of leaving the card you had just clicked.
   */
  deploy(piece, square, done, origin = null) {
    // The card LANDS where its depth says, not in the bare middle of the
    // square. Flying to squareToWorld() and letting the piece crawl down
    // afterwards is what put a card dealt onto an occupied square on TOP of
    // the stack for the length of the arc.
    const to = piece.restingPosition();
    const from = origin ? origin.clone() : to.clone();
    if (!origin) {
      from.x += (piece.owner === 0 ? -1 : 1) * 5.5;
      from.z += (piece.owner === 0 ? 1 : -1) * 6.0;
    }

    const dbl = this.#stand(piece);
    dbl.group.position.copy(from);
    const spin = (piece.owner === 0 ? 1 : -1) * Math.PI * 1.5;

    this.#play(dbl, 0.46, (t) => {
      const e = easeOutCubic(t);
      dbl.group.position.lerpVectors(from, to, e);
      // a flatter arc when it comes from the hand, which is already low and
      // close to the camera — a 2.6 unit hop from there flies off the top
      dbl.group.position.y += Math.sin(Math.PI * t) * (origin ? 0.9 : 2.6);
      dbl.card3d.rotation.y = dbl.baseYaw + spin * (1 - e);
      dbl.card3d.rotation.z = (1 - e) * 0.5;
      dbl.group.scale.setScalar(0.7 + 0.3 * e);
    }, () => {
      this.ring(square, { colour: 0xffe2b0, size: 1.6, seconds: 0.45 });
      this.burst(square, { count: 12, seconds: 0.5, up: 0.7 });
      done?.();
    });
  }

  /** Slide, with a little overshoot so it has weight. */
  move(piece, fromSquare, toSquare, done) {
    const dbl = this.#stand(piece);
    // where the card visibly IS, which after a stack has shuffled under it is
    // not the bare centre of the square it came from
    const from = dbl.group.position.clone();
    const to = piece.restingPosition();
    this.#play(dbl, 0.3, (t) => {
      const e = easeOutBack(t);
      dbl.group.position.lerpVectors(from, to, e);
      dbl.group.position.y += Math.sin(Math.PI * t) * 0.3;
    }, () => {
      this.burst(toSquare, { count: 6, seconds: 0.35, up: 0.3, colour: 'rgba(210,190,160,1)' });
      done?.();
    });
  }

  /**
   * The attacker lunges into the defender and recoils. The flash lands on the
   * frame they meet, which is what sells the hit.
   */
  attack(piece, fromSquare, toSquare, { onImpact, done } = {}) {
    const dbl = this.#stand(piece);
    // The attacker never actually leaves its square — so the real card stays
    // on it, and anything the impact sets off asks the board where the
    // attacker is and gets the square, not a card halfway across the table.
    const from = dbl.group.position.clone();
    // Where the attacker ends up — its own square if it bounced off, the
    // defender's if it won and took the ground. Recoiling to `from` regardless
    // meant the double landed on the old square and the real card was
    // revealed a whole square away, which reads as a jump cut.
    const home = piece.restingPosition();
    const lunge = from.clone().lerp(squareToWorld(toSquare), 0.62);
    let hit = false;

    this.#play(dbl, 0.42, (t) => {
      if (t < 0.4) {
        const e = easeInCubic(t / 0.4);
        dbl.group.position.lerpVectors(from, lunge, e);
        dbl.group.position.y = from.y + e * 0.45;
      } else {
        if (!hit) {
          hit = true;
          this.flash(toSquare);
          this.ring(toSquare, { colour: 0xffd0a0, size: 2.0, seconds: 0.4 });
          this.burst(toSquare, { count: 18, seconds: 0.5, colour: 'rgba(255,200,140,1)' });
          onImpact?.();
        }
        const e = easeOutCubic((t - 0.4) / 0.6);
        dbl.group.position.lerpVectors(lunge, home, e);
        dbl.group.position.y = home.y + (1 - e) * 0.45;
      }
    }, done);
  }

  /**
   * Killed: struck flat, then thrown onto its owner's discard pile. Cards go
   * somewhere when they die, so the eye can follow where.
   */
  destroy(piece, square, done) {
    // A card that has left the board has no true place left to be put in, so
    // the double just takes over and the real card stays hidden until main.js
    // retires it. Fading the DOUBLE's cloned material is also what stops a
    // corpse that somehow outlives its animation being left half-transparent.
    const dbl = this.#stand(piece, { rest: false });
    const at = dbl.group.position.clone();
    const pile = graveyardPosition(piece.owner);

    this.burst(square, { count: 16, seconds: 0.55, colour: 'rgba(190,80,70,1)' });
    this.ring(square, { colour: 0xd0554f, size: 1.8, seconds: 0.5 });

    this.#play(dbl, 0.62, (t) => {
      // struck first, thrown second
      if (t < 0.28) {
        const e = easeOutCubic(t / 0.28);
        dbl.group.position.y = at.y + e * 0.35;
        dbl.card3d.rotation.z = e * 0.5;
        dbl.group.scale.setScalar(1 + e * 0.06);
        return;
      }
      const e = easeInOut((t - 0.28) / 0.72);
      dbl.group.position.lerpVectors(at, pile, e);
      dbl.group.position.y = at.y + 0.35 + Math.sin(Math.PI * e) * 1.4 - e * 0.25;
      dbl.card3d.rotation.z = 0.5 + e * 2.2;
      dbl.group.scale.setScalar(1.06 - e * 0.3);
      dbl.frontMat.opacity = 1 - e * 0.85;
      dbl.frontMat.transparent = true;
    }, done);
  }

  /** Bounced back to a hand: lifted off the board and pulled to its owner. */
  vanish(piece, done) {
    const dbl = this.#stand(piece, { rest: false });
    const at = dbl.group.position.clone();
    const to = strongholdPosition(piece.owner).clone();
    to.z += (piece.owner === 0 ? 1 : -1) * 3.4;
    this.#play(dbl, 0.4, (t) => {
      const e = easeInOut(t);
      dbl.group.position.lerpVectors(at, to, e);
      dbl.group.position.y = at.y + Math.sin(Math.PI * t) * 1.6;
      dbl.group.scale.setScalar(1 - e * 0.7);
      dbl.frontMat.opacity = 1 - e * 0.9;
      dbl.frontMat.transparent = true;
    }, done);
  }

  /**
   * Discarding from hand — paying for a Defend, or a Tactic's cost. The card
   * comes from where the hand is, not from nowhere.
   */
  discardFromHand(player, done, origin = null, def = null) {
    const from = origin ? origin.clone() : strongholdPosition(player).clone();
    if (!origin) {
      from.z += (player === 0 ? 1 : -1) * 4.4;
      from.x += (player === 0 ? 1 : -1) * 1.4;
    }
    const to = graveyardPosition(player);
    // Cards go into a discard pile FACE UP and it is open information, so the
    // one flying there shows its face. It used to be a card back, which told
    // you a card had been paid but never which one.
    const card = this.#looseCard(def);
    card.position.copy(from);

    this.add(0.44, (t) => {
      const e = easeInOut(t);
      card.position.lerpVectors(from, to, e);
      card.position.y = (origin ? from.y : 0.9) * (1 - e) + 0.45 * e
        + Math.sin(Math.PI * t) * 1.1;
      card.rotation.y = e * Math.PI;
      card.rotation.z = (1 - e) * 0.6;
      card.scale.setScalar(0.4 + e * 0.6);
    }, () => { this.#dropLoose(card); done?.(); });
  }

  /** The Stronghold rising as a fighter — big, slow, and unmissable. */
  rise(piece, square, done) {
    const dbl = this.#stand(piece);
    const to = piece.restingPosition();
    this.ring(square, { colour: 0xff7a3a, size: 4.5, seconds: 1.0 });
    this.#play(dbl, 0.8, (t) => {
      const e = easeOutCubic(t);
      dbl.group.position.set(to.x, -1.4 + e * (to.y + 1.4), to.z);
      dbl.group.scale.setScalar(0.5 + e * 0.5);
      dbl.card3d.rotation.y = dbl.baseYaw + (1 - e) * Math.PI;
    }, () => {
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
