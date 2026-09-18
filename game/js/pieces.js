// Fighters on the battlefield.
//
// A fighter IS its card. It lies flat on its square, face up, the way it would
// on a real table — no standees, no models. Hovering lifts it, scales it up and
// tilts the face toward the camera so you can read it without leaving the board.
//
// Fatigue taps the card 90 degrees, which is the one gesture every card player
// already knows. Stacks are literal: the buried cards sit under the top one
// with their edges peeking out, and only the top card is in play.

import * as THREE from 'three';
import { cardTexture, blobTexture } from './textures.js';
import { squareToWorld } from './board.js';
import { TILE } from './arena.js';

const CARD_W = 1.74;
const CARD_H = 1.76;      // the scans are near enough square
const CARD_T = 0.035;
const LAYER = 0.028;      // vertical gap between cards in a stack

let backTexture = null;
function cardBack() {
  if (!backTexture) backTexture = cardTexture('../site/assets/card-back.jpg');
  return backTexture;
}

export class Piece {
  constructor(card, def, owner) {
    this.card = card;          // engine instance { uid, def, owner, fatigued }
    this.def = def;            // display definition from game/data/decks.json
    this.owner = owner;
    this.square = null;
    this.depth = 0;            // 0 = top of the stack, the one in play

    this.hover = 0;            // 0..1, eased
    this.hoverTarget = 0;
    this.selected = false;
    this.grey = 0;             // 0..1, how spent the fighter looks
    this.greyTarget = 0;
    this.lift = 0;             // animation hook: extra height above the stone
    this.spin = 0;             // for the few cards whose abilities turn them

    // A card faces its owner: player 0 reads it from +Z, player 1 from -Z.
    this.baseYaw = owner === 0 ? 0 : Math.PI;

    this.group = new THREE.Group();
    this.#build();
  }

  #build() {
    // The card. A flat slab: +Y is the face, -Y the back.
    // BoxGeometry face order is +x, -x, +y, -y, +z, -z.
    const face = this.def.img ? cardTexture(`../site/${this.def.img}.jpg`) : null;
    // No colour anywhere. A card belongs to whoever it FACES — same as on a
    // real table — so the only marking a card needs is its own printing.
    const edge = new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.85 });
    const front = new THREE.MeshStandardMaterial({
      map: face, roughness: 0.55, metalness: 0.03,
      color: face ? 0xffffff : 0x6b5a48,
    });
    const back = new THREE.MeshStandardMaterial({ map: cardBack(), roughness: 0.65 });

    const card = new THREE.Mesh(
      new THREE.BoxGeometry(CARD_W, CARD_T, CARD_H),
      [edge, edge, front, back, edge, edge],
    );
    card.castShadow = true;
    card.receiveShadow = true;
    this.group.add(card);
    this.card3d = card;
    this.frontMat = front;

    // BoxGeometry's +Y face already runs the texture's top edge toward -Z,
    // which is away from the camera — the right way up when you look down at a
    // table. The half-turn that used to be here was what flipped every card.

    // Owner mat: a thin coloured border just under the card. With every card
    // lying face up, this is the only thing saying whose fighter it is.
    // Soft contact shadow, so a lifted card still feels attached to the stone.
    const contact = new THREE.Mesh(
      new THREE.PlaneGeometry(2.5, 2.5),
      new THREE.MeshBasicMaterial({
        map: blobTexture('rgba(0,0,0,0.55)', 'rgba(0,0,0,0)'),
        transparent: true, depthWrite: false, opacity: 0.8,
      }),
    );
    contact.rotation.x = -Math.PI / 2;
    this.group.add(contact);
    this.contact = contact;
  }

  /** Where the card rests, given its square and how deep in the stack it is. */
  restingPosition() {
    const p = squareToWorld(this.square ?? 4).clone();
    p.y = 0.09 + Math.max(0, 4 - this.depth) * LAYER;
    // buried cards slide back and left a touch so their edges stay visible
    p.z += this.depth * 0.085;
    p.x -= this.depth * 0.085;
    return p;
  }

  placeAt(square, depth = 0) {
    this.square = square;
    this.depth = depth;
    const p = this.restingPosition();
    this.group.position.copy(p);
  }

  setHovered(on) { this.hoverTarget = on && this.depth === 0 ? 1 : 0; }
  setFatigued(on) { this.greyTarget = on ? 1 : 0; }
  setSelected(on) { this.selected = on; }

  update(dt, camera) {
    const k = Math.min(1, dt * 11);
    this.hover += (this.hoverTarget - this.hover) * k;
    this.grey += (this.greyTarget - this.grey) * Math.min(1, dt * 7);

    // While an animation owns this card, it owns its transform too — otherwise
    // the resting-position lerp drags it back mid-flight.
    if (this.animating) {
      this.contact.position.y = -this.group.position.y + 0.075;
      return;
    }

    const rest = this.restingPosition();
    const raise = this.hover * 1.55 + (this.selected ? 0.22 : 0) + this.lift;

    this.group.position.x += (rest.x - this.group.position.x) * k;
    this.group.position.z += (rest.z - this.group.position.z) * k;
    this.group.position.y += (rest.y + raise - this.group.position.y) * k;

    // Hover: lift it clear of its neighbours, scale it up enough to READ, and
    // turn the face square-on to the camera. The tilt needed is the camera's
    // own elevation subtracted from vertical, so the card ends up facing the
    // viewer however the camera is placed.
    const grow = 1 + this.hover * 1.35;
    this.group.scale.setScalar(grow);

    let faceTilt = 0.86;
    let readYaw = this.baseYaw;
    if (camera) {
      const dir = camera.position.clone().sub(this.group.position);
      faceTilt = Math.atan2(Math.hypot(dir.x, dir.z), dir.y);
      // Reading an opponent's card should turn it the right way up for the
      // person looking at it, not leave it upside down.
      readYaw = dir.z >= 0 ? 0 : Math.PI;
    }
    this.card3d.rotation.x = this.hover * faceTilt;

    // Yaw: resting, the card faces its owner. Hovered, it turns to the reader.
    let yaw = this.baseYaw;
    const d = ((readYaw - this.baseYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    yaw += d * this.hover;
    this.card3d.rotation.y = yaw + this.spin;

    // Buried cards dim, and a fatigued fighter greys out — that is the whole
    // signal, no label and no rotation. Hovering restores it so it stays
    // readable.
    const buried = this.depth > 0;
    const spent = this.grey * (1 - this.hover);
    const dim = buried ? 0.42 : 1 - spent * 0.62;
    this.frontMat.color.setScalar(dim);
    this.contact.visible = !buried;
    this.contact.material.opacity = 0.8 - this.hover * 0.3;
    this.contact.position.y = -this.group.position.y + 0.075;
    this.contact.scale.setScalar(1 + this.hover * 0.25);

    // While being read the card draws last, so it sits over its neighbours
    // without having to switch depth testing off.
    this.card3d.renderOrder = this.hover > 0.05 ? 10 : 0;
  }

  dispose(scene) {
    scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material])
        .forEach((m) => m.dispose?.());
    });
  }
}

/** Keeps the live cards in step with the engine's board. */
export class Pieces {
  constructor(scene, defs) {
    this.scene = scene;
    this.defs = defs;
    this.byUid = new Map();
  }

  /**
   * Reconcile against engine state.
   *
   * `retain` holds uids that have left the board but must stay on screen a
   * moment longer so they can be seen to die. main.js retires them when their
   * animation finishes.
   */
  sync(state, { retain = new Set() } = {}) {
    const seen = new Set();

    state.board.forEach((stack, square) => {
      stack.forEach((card, depth) => {
        seen.add(card.uid);
        let piece = this.byUid.get(card.uid);
        if (!piece) {
          piece = new Piece(card, this.defs[card.def] || {}, card.owner);
          piece.placeAt(square, depth);
          this.scene.add(piece.group);
          this.byUid.set(card.uid, piece);
        }
        piece.square = square;
        piece.depth = depth;
        piece.lastSquare = square;
        piece.setFatigued(!!card.fatigued);
      });
    });

    for (const [uid, piece] of [...this.byUid]) {
      if (!seen.has(uid) && !retain.has(uid)) {
        piece.dispose(this.scene);
        this.byUid.delete(uid);
      }
    }
  }

  /** Remove a piece that was being kept alive for its death animation. */
  retire(uid) {
    const p = this.byUid.get(uid);
    if (!p) return;
    p.dispose(this.scene);
    this.byUid.delete(uid);
  }

  get(uid) { return this.byUid.get(uid); }

  topAt(square) {
    let best = null;
    for (const p of this.byUid.values()) {
      if (p.square === square && (!best || p.depth < best.depth)) best = p;
    }
    return best;
  }

  pickables() {
    return [...this.byUid.values()].filter((p) => p.depth === 0).map((p) => {
      p.card3d.userData.piece = p;
      return p.card3d;
    });
  }

  setHovered(piece) {
    for (const p of this.byUid.values()) p.setHovered(p === piece);
  }

  clearSelection() {
    for (const p of this.byUid.values()) p.setSelected(false);
  }

  update(dt, camera) {
    for (const p of this.byUid.values()) p.update(dt, camera);
  }
}
