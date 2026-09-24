// Shared tools every motif is built from.
//
// The motifs live in sibling files and are worked on independently; this is
// the common vocabulary — where a card IS, how to hold an object on screen for
// a while, sparks, light, and the cloth strip the Auroxi bolts are made of.

import * as THREE from 'three';
import { squareToWorld, strongholdPosition, graveyardPosition, CARD_W, CARD_H } from '../board.js';
import { blobTexture, faceTexture, cardTexture } from '../textures.js';

export { THREE, CARD_W, CARD_H };

export const easeOut = (t) => 1 - (1 - t) ** 3;
export const easeIn = (t) => t * t * t;
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Each faction's light, for the effects that have no motif of their own. */
export const FACTION = {
  Auroxi:     { spark: 0xffb257, glow: 'rgba(255,190,110,1)' },
  Refractory: { spark: 0xf2d68a, glow: 'rgba(255,225,150,1)' },
  Gloaming:   { spark: 0xa87ddd, glow: 'rgba(180,140,235,1)' },
  Shardsworn: { spark: 0xf06aa8, glow: 'rgba(255,130,185,1)' },
  Marvorren:  { spark: 0x6fd6e8, glow: 'rgba(130,225,245,1)' },
  Neutral:    { spark: 0xd8cbb4, glow: 'rgba(230,215,185,1)' },
};

export class Kit {
  constructor(scene, anim, pieces) {
    this.scene = scene;
    this.anim = anim;
    this.pieces = pieces;
  }

  /**
   * Where a card or a square is, in the world.
   *
   * HAZARD, and it has bitten twice: a card UID and a square INDEX are both
   * numbers, and uids start at 1, so uids 1-8 collide with squares 0-8. Most
   * motifs are handed a uid by defaultCast; a few (the bolts, maelstrom,
   * moonrise, triangle) are handed a square by the rules instead. A motif that
   * wrote `typeof at === 'number' ? at : <default>` read uid 44 as square 44
   * and painted itself thirty-four units off the back of the board — perfectly,
   * silently, behind the camera.
   *
   * The piece is therefore always asked FIRST here, and a bare number is only
   * accepted as a square when nothing owns it. A motif that needs a square of
   * its own should do the same, and must bound the result to the nine.
   */
  at(ref) {
    if (ref == null) return null;
    const piece = this.pieces?.get(ref);
    if (piece) return piece.group.position.clone();
    if (typeof ref === 'number' && ref >= 0 && ref < 12) {
      const p = squareToWorld(ref);
      p.y = 0.4;
      return p;
    }
    return null;
  }

  /** The piece itself, when a motif wants to move the card about. */
  piece(ref) { return this.pieces?.get(ref) || null; }

  /**
   * Where a card GOES. A motif that owns a card's leaving has to put it
   * somewhere real — a death that fades in place reads as the card being
   * deleted rather than discarded, and the eye loses track of what happened.
   */
  grave(owner) { return graveyardPosition(owner).clone(); }

  /**
   * The hand: off the near edge of the table, on the owner's side. Taken from
   * the same place `anim.vanish` and `anim.draw` aim at, so a motif that
   * returns a card lands where every other card returning to hand lands.
   */
  hand(owner) {
    const p = strongholdPosition(owner).clone();
    p.z += (owner === 0 ? 1 : -1) * 4.2;
    p.x += (owner === 0 ? 1 : -1) * 1.6;
    return p;
  }

  /**
   * A REAL card, as a mesh.
   *
   * Every motif that showed a card used to draw one: a plate with an invented
   * face painted on it, because the rules never said WHICH card and there was
   * no way to ask. Both halves are fixed now — `ops.noteCards` puts the card
   * ids on the note, and this turns an id into the printed face. A motif that
   * hauls a card out of a graveyard can haul THAT card.
   *
   * `faceTexture` covers the one card in the game with no art by drawing its
   * name, cost and text instead, so this never renders a blank.
   *
   * Returns null for an id nothing knows, which is the right answer for a
   * motif asked to show a card that is not there — better a beat with nothing
   * in it than a blank white slab.
   */
  card(defId, { thickness = 0.035 } = {}) {
    const def = this.pieces?.defs?.[defId];
    if (!def) return null;
    const face = faceTexture(def);
    if (!face) return null;
    const edge = new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.85 });
    const front = new THREE.MeshStandardMaterial({ map: face, roughness: 0.55, metalness: 0.03 });
    const back = new THREE.MeshStandardMaterial({
      map: cardTexture('../site/assets/card-back.jpg'), roughness: 0.65,
    });
    // BoxGeometry face order is +x, -x, +y, -y, +z, -z — the same slab the
    // table's own pieces are, so a motif's card and a real one match in
    // thickness, proportion and which way up the art sits.
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(CARD_W, thickness, CARD_H),
      [edge, edge, front, back, edge, edge],
    );
    mesh.castShadow = true;
    return mesh;
  }

  /** Put something in the scene for a while, then take it away again. */
  hold(obj, seconds, tick, done) {
    this.scene.add(obj);
    this.anim.add(seconds, tick, () => {
      this.scene.remove(obj);
      obj.traverse?.((o) => {
        o.geometry?.dispose?.();
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose?.());
        else o.material?.dispose?.();
      });
      done?.();
    });
    return obj;
  }

  /** A delay measured in animation time, so it pauses when the game does. */
  after(seconds, fn) { this.anim.add(Math.max(0.001, seconds), () => {}, fn); }

  ring(at, colour, { size = 2, seconds = 0.5 } = {}) {
    this.anim.ring(null, { at, colour, size, seconds });
  }

  light(at, colour, { power = 14, seconds = 0.4, reach = 7 } = {}) {
    const l = new THREE.PointLight(colour, 0, reach, 2);
    l.position.copy(at);
    this.hold(l, seconds, (t) => {
      l.intensity = power * (1 - t) * (t < 0.2 ? t / 0.2 : 1);
    });
  }

  sparks(at, { colour, count = 14, spread = 0.9, seconds = 0.6, rise = 1.1, size = 0.46 } = {}) {
    const tex = blobTexture(colour, colour.replace(/,\s*1\)$/, ',0)'));
    const grp = new THREE.Group();
    const vel = [];
    for (let i = 0; i < count; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      s.position.copy(at);
      s.scale.setScalar(size);
      vel.push(new THREE.Vector3(Math.cos(a) * spread, rise * (0.55 + Math.random() * 0.9),
        Math.sin(a) * spread));
      grp.add(s);
    }
    this.hold(grp, seconds, (t) => {
      for (let i = 0; i < grp.children.length; i++) {
        const s = grp.children[i];
        s.position.copy(at).addScaledVector(vel[i], t);
        s.position.y -= t * t * 1.3;
        s.material.opacity = 1 - t;
        s.scale.setScalar(size * (1 - t * 0.5));
      }
    });
  }

  /**
   * A strip of cloth: a chain of points you place each frame, built into a
   * quad strip with normals, so it takes the light like fabric.
   */
  strip({ segments = 60, width = 0.3, colour = 0xffffff, emissive = 0.4 } = {}) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(segments * 2 * 3), 3));
    const uv = new Float32Array(segments * 2 * 2);
    for (let i = 0; i < segments; i++) {
      uv[i * 4 + 0] = i / (segments - 1); uv[i * 4 + 1] = 0;
      uv[i * 4 + 2] = i / (segments - 1); uv[i * 4 + 3] = 1;
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const idx = [];
    for (let i = 0; i < segments - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    geo.setIndex(idx);

    const mat = new THREE.MeshStandardMaterial({
      color: colour, emissive: colour, emissiveIntensity: emissive,
      roughness: 0.92, metalness: 0, side: THREE.DoubleSide, transparent: true,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.castShadow = true;

    const up = new THREE.Vector3(0, 1, 0);
    const lay = (pts, { taper = 0.55, twist = 0 } = {}) => {
      const pos = geo.attributes.position.array;
      for (let i = 0; i < segments; i++) {
        const prev = pts[Math.max(0, i - 1)];
        const next = pts[Math.min(segments - 1, i + 1)];
        const tan = next.clone().sub(prev);
        if (tan.lengthSq() < 1e-9) tan.set(1, 0, 0);
        tan.normalize();
        const side = tan.clone().cross(up);
        if (side.lengthSq() < 1e-9) side.set(0, 0, 1);
        side.normalize();
        if (twist) side.applyAxisAngle(tan, Math.sin(i * 0.4 + twist) * 0.6);
        side.multiplyScalar(width * (1 - (i / segments) * taper) * 0.5);
        const p = pts[i];
        pos[i * 6 + 0] = p.x - side.x; pos[i * 6 + 1] = p.y - side.y; pos[i * 6 + 2] = p.z - side.z;
        pos[i * 6 + 3] = p.x + side.x; pos[i * 6 + 4] = p.y + side.y; pos[i * 6 + 5] = p.z + side.z;
      }
      geo.attributes.position.needsUpdate = true;
      geo.computeVertexNormals();
    };

    return { mesh, geo, mat, lay, segments };
  }
}
