// Fighters on the battlefield.
//
// A fighter IS its card. It lies flat on its square, face up, the way it would
// on a real table — no standees, no models.
//
// RIGHT-CLICK inspects a card: it lifts clear, scales up and turns square-on to
// the camera so the rules text is readable. Hover deliberately does NOT do this
// — a card that grows under the pointer swallows its own neighbours and makes
// the board hard to click.
//
// Fatigue taps the card 90 degrees, which is the one gesture every card player
// already knows. Stacks are literal: the buried cards sit under the top one
// with their edges peeking out, and only the top card is in play.

import * as THREE from 'three';
import { cardTexture, blobTexture, markerTexture } from './textures.js';
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
  constructor(card, def, owner, { construct = false } = {}) {
    this.isConstruct = construct;
    this.card = card;          // engine instance { uid, def, owner, fatigued }
    this.def = def;            // display definition from game/data/decks.json
    this.owner = owner;
    this.square = null;
    this.depth = 0;            // 0 = top of the stack, the one in play

    this.hover = 0;            // 0..1, eased — the INSPECT state, not the pointer
    this.hoverTarget = 0;
    this.pointer = 0;          // eased pointer-over, a much gentler cue
    this.selected = false;
    this.grey = 0;             // 0..1, how spent the fighter looks
    this.greyTarget = 0;
    this.lift = 0;             // animation hook: extra height above the stone
    this.spin = 0;             // for the few cards whose abilities turn them

    // A card faces its owner: player 0 reads it from +Z, player 1 from -Z.
    this.baseYaw = owner === 0 ? 0 : Math.PI;
    this.faceDown = false;

    this.group = new THREE.Group();
    this.#build();
  }

  #build() {
    // The card. A flat slab: +Y is the face, -Y the back.
    // BoxGeometry face order is +x, -x, +y, -y, +z, -z.
    const face = this.def.img ? cardTexture(`../site/${this.def.img}.jpg`) : null;
    // No colour anywhere. A card belongs to whoever it FACES — same as on a
    // real table — so the only marking a card needs is its own printing.
    const edge = new THREE.MeshStandardMaterial({
      color: 0x1a1410, roughness: 0.85,
      // a Construct is flat on the stone; the offset keeps the slab from
      // fighting it for the same pixels
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
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

    // The tilt and the yaw live on SEPARATE objects on purpose.
    //
    // Both on one object means Three composes them in Euler XYZ order, so the
    // pitch is applied in the already-yawed frame — and a card facing the far
    // player (yaw 180) tilts AWAY from the reader instead of toward them. That
    // is why an inspected card always seemed to turn towards the first player.
    // With the tilt on a parent it is a world-space rotation, identical for
    // both sides, and the yaw underneath stays the card's own facing.
    const tilt = new THREE.Group();
    tilt.add(card);
    this.group.add(tilt);

    this.tilt = tilt;
    this.card3d = card;
    this.frontMat = front;
    this.backMat = back;

    // BoxGeometry's +Y face already runs the texture's top edge toward -Z,
    // which is away from the camera — the right way up when you look down at a
    // table. The half-turn that used to be here was what flipped every card.

    // Owner mat: a thin coloured border just under the card. With every card
    // lying face up, this is the only thing saying whose fighter it is.
    // A hard border that only appears when this fighter is standing in a
    // Gates. It sits a hair above the card so it reads from directly overhead.
    const threat = new THREE.Mesh(
      new THREE.RingGeometry(CARD_W * 0.72, CARD_W * 0.80, 4, 1),
      new THREE.MeshBasicMaterial({
        color: 0xff4438, transparent: true, opacity: 0, side: THREE.DoubleSide,
        depthWrite: false, depthTest: false,
      }),
    );
    threat.rotation.x = -Math.PI / 2;
    threat.rotation.z = Math.PI / 4;
    threat.position.y = CARD_T / 2 + 0.01;
    threat.renderOrder = 12;
    card.add(threat);
    this.threatRing = threat;
    this.threat = false;

    // Stat markers. A fighter whose power has been changed carries a counter,
    // because otherwise the only way to know is to remember which effects are
    // in play — and a -I that you cannot see is a rule you cannot check.
    this.markers = new THREE.Group();
    this.markers.position.set(CARD_W / 2 - 0.1, CARD_T, -CARD_H / 2 + 0.1);
    card.add(this.markers);
    this.markerState = '';

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
    // A Construct lies UNDER any fighters on its square, but must sit above
    // the pebbles and grass on the stone — terrain was poking through it.
    if (this.isConstruct) { p.y = 0.2; return p; }
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

  /** Pointer is over this card. A whisper of a lift, nothing that blocks a click. */
  setHovered(on) { this.pointerTarget = on && this.depth === 0 ? 1 : 0; }

  /** Right-click: read this card properly. */
  setInspected(on) {
    // A facedown Trap is hidden information; right-clicking it shows you the
    // back, not the card.
    this.hoverTarget = on && this.depth === 0 ? 1 : 0;
  }

  /** This fighter is standing in somebody's Gates. */
  setThreat(on) { this.threat = !!on; }

  /**
   * Show what has been done to this fighter: a power change as a signed badge,
   * and any tokens hung on it.
   */
  setMarkers({ powerDelta = 0, tokens = [] } = {}) {
    const key = `${powerDelta}|${tokens.join(',')}`;
    if (key === this.markerState) return;
    this.markerState = key;

    for (const m of [...this.markers.children]) {
      this.markers.remove(m);
      m.material?.map?.dispose?.();
      m.material?.dispose?.();
    }

    const badges = [];
    if (powerDelta) {
      const n = Math.min(3, Math.abs(powerDelta));
      const roman = ['', 'I', 'II', 'III'][n];
      badges.push([`${powerDelta > 0 ? '+' : '-'}${roman}`, powerDelta > 0 ? 'up' : 'down']);
    }
    for (const t of tokens.slice(0, 2)) badges.push([t[0].toUpperCase(), 'token']);

    badges.forEach(([text, tone], i) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: markerTexture(text, tone), transparent: true, depthTest: false,
      }));
      sp.scale.setScalar(0.52);
      sp.position.set(0, 0.02, i * -0.46);
      sp.renderOrder = 1001;
      this.markers.add(sp);
    });
  }

  /**
   * A Trap is played FACE DOWN and stays that way until it Triggers, so the
   * top face has to be the card back. Swapping the two materials is all it
   * takes — the geometry is the same slab either way.
   */
  setFaceDown(on) {
    const want = !!on;
    if (want === this.faceDown) return;
    this.faceDown = want;
    const mats = this.card3d.material;
    mats[2] = want ? this.backMat : this.frontMat;
    mats[3] = want ? this.frontMat : this.backMat;
    for (const m of mats) m.needsUpdate = true;
  }
  get inspected() { return this.hoverTarget > 0.5; }
  setFatigued(on) { this.greyTarget = on ? 1 : 0; }
  setSelected(on) { this.selected = on; }

  update(dt, camera) {
    const k = Math.min(1, dt * 11);
    this.hover += (this.hoverTarget - this.hover) * k;
    this.pointer += ((this.pointerTarget || 0) - this.pointer) * k;
    this.grey += (this.greyTarget - this.grey) * Math.min(1, dt * 7);

    // While an animation owns this card, it owns its transform too — otherwise
    // the resting-position lerp drags it back mid-flight.
    if (this.animating) {
      this.contact.position.y = -this.group.position.y + 0.075;
      return;
    }

    const rest = this.restingPosition();
    // Lifted well clear of the ruins and braziers, which otherwise stand in
    // front of a card you are trying to read.
    const raise = this.hover * 2.7 + this.pointer * 0.07
      + (this.selected ? 0.22 : 0) + this.lift;

    this.group.position.x += (rest.x - this.group.position.x) * k;
    this.group.position.z += (rest.z - this.group.position.z) * k;
    this.group.position.y += (rest.y + raise - this.group.position.y) * k;

    // Inspecting lifts it clear of its neighbours, scales it up enough to READ,
    // and turns the face square-on to the camera — the tilt is computed from
    // where the camera actually is, so it faces the viewer wherever that is.
    // Merely pointing at it only brightens it a touch.
    const grow = (1 + this.hover * 1.35 + this.pointer * 0.03)
      * (this.isConstruct && this.hover < 0.2 ? 0.86 : 1);
    this.group.scale.setScalar(grow);

    let faceTilt = 0.86;
    let readYaw = this.baseYaw;
    if (camera) {
      const dir = camera.position.clone().sub(this.group.position);
      // Math.hypot is ALWAYS POSITIVE, so this angle alone says how far to tip
      // but not which way. Unsigned, the card tipped toward +Z whichever end
      // the camera was at — away from player two, far enough past vertical to
      // show its back. The sign has to come from which side the camera is on;
      // the view only ever sits at one end or the other, never side-on.
      const side = dir.z >= 0 ? 1 : -1;
      faceTilt = Math.atan2(Math.hypot(dir.x, dir.z), dir.y) * side;

      // Reading an opponent's card should turn it the right way up for the
      // person looking at it, not leave it upside down.
      readYaw = side > 0 ? 0 : Math.PI;
    }
    // world-space pitch, so it leans toward the reader from either end
    this.tilt.rotation.x = this.hover * faceTilt;

    // Yaw: resting, the card faces its owner. Inspected, it turns to whoever is
    // reading it — which is the active player, since the camera sits at their
    // end of the field.
    let yaw = this.baseYaw;
    const d = ((readYaw - this.baseYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    yaw += d * this.hover;
    this.card3d.rotation.y = yaw + this.spin;

    // Buried cards dim, and a fatigued fighter greys out — that is the whole
    // signal, no label and no rotation. Hovering restores it so it stays
    // readable.
    const buried = this.depth > 0;
    const spent = this.grey * (1 - this.hover);
    const dim = (buried ? 0.42 : 1 - spent * 0.62) * (1 + this.pointer * 0.18);
    this.frontMat.color.setScalar(Math.min(1.35, dim));
    this.contact.visible = !buried;
    this.contact.material.opacity = 0.8 - this.hover * 0.3;
    this.contact.position.y = -this.group.position.y + 0.075;
    this.contact.scale.setScalar(1 + this.hover * 0.25);

    // flashing border on a fighter that is sieging a Gates
    const pulse = 0.5 + Math.sin(performance.now() * 0.006) * 0.5;
    this.threatRing.material.opacity = this.threat ? 0.35 + pulse * 0.6 : 0;

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

    // Constructs live outside state.board, which is why they were invisible —
    // Traps included, so a facedown Trap showed nothing at all.
    for (const c of state.constructs || []) {
      if (!c) continue;
      seen.add(c.uid);
      let piece = this.byUid.get(c.uid);
      if (!piece) {
        piece = new Piece(c, this.defs[c.def] || {}, c.owner, { construct: true });
        piece.placeAt(c.square, 0);
        this.scene.add(piece.group);
        this.byUid.set(c.uid, piece);
      }
      piece.square = c.square;
      piece.depth = 0;
      piece.lastSquare = c.square;
      piece.setFaceDown(!!c.facedown);
    }

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

  setThreats(uids) {
    for (const [uid, p] of this.byUid) p.setThreat(uids.has(uid));
  }

  /** Only one card is ever held up for reading. */
  setInspected(piece) {
    for (const p of this.byUid.values()) p.setInspected(p === piece);
  }

  get inspecting() {
    for (const p of this.byUid.values()) if (p.inspected) return p;
    return null;
  }

  clearSelection() {
    for (const p of this.byUid.values()) p.setSelected(false);
  }

  update(dt, camera) {
    for (const p of this.byUid.values()) p.update(dt, camera);
  }
}
