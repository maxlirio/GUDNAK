// What a card LOOKS like when it goes off.
//
// The rules leave a note on `state.fx` saying what happened — "this was a
// Convict", "this was a Fire Bolt" — because only the rules know that. Nothing
// here can change the game; it is all read after the fact, like the rest of
// the animation.
//
// Motifs are shared on purpose. A Refractory card that drags an enemy under
// one of yours throws CHAINS, whichever card did it, because that is what the
// faction does — Incarceration, an Umbren Jailor's Catch, a Heretic
// Condemner's Man Catcher and a fighter rescued by its own Convicted of Heresy
// all pull on the same iron. The Bolts are the opposite case: they are the
// same card six times over, so each one has to feel different or the whole
// cycle reads as one card.

import * as THREE from 'three';
import { squareToWorld, CARD_W, CARD_H } from './board.js';
import { blobTexture } from './textures.js';

const easeOut = (t) => 1 - (1 - t) ** 3;
const easeIn = (t) => t * t * t;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Each faction's light, for the effects that have no motif of their own. */
const FACTION = {
  Auroxi:     { spark: 0xffb257, glow: 'rgba(255,190,110,1)' },
  Refractory: { spark: 0xf2d68a, glow: 'rgba(255,225,150,1)' },
  Gloaming:   { spark: 0xa87ddd, glow: 'rgba(180,140,235,1)' },
  Shardsworn: { spark: 0xf06aa8, glow: 'rgba(255,130,185,1)' },
  Marvorren:  { spark: 0x6fd6e8, glow: 'rgba(130,225,245,1)' },
  Neutral:    { spark: 0xd8cbb4, glow: 'rgba(230,215,185,1)' },
};

const IRON = 0x6b6258;

export class Fx {
  constructor(scene, anim, pieces) {
    this.scene = scene;
    this.anim = anim;
    this.pieces = pieces;
  }

  /* ---------------------------------------------------------- helpers */

  #at(ref) {
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

  #hold(obj, seconds, tick) {
    this.scene.add(obj);
    this.anim.add(seconds, tick, () => this.scene.remove(obj));
    return obj;
  }

  /** A short length of chain, pointing from a to b. */
  #chain(a, b, links = 7) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0xa79a89, roughness: 0.35, metalness: 0.9,
      emissive: 0x6b5a45, emissiveIntensity: 0.85,
    });
    for (let i = 0; i < links; i++) {
      const link = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.07, 5, 10), mat);
      link.rotation.y = (i % 2) * Math.PI / 2;
      g.add(link);
    }
    g.userData.lay = (t) => {
      for (let i = 0; i < links; i++) {
        const k = (i / (links - 1)) * t;
        const p = a.clone().lerp(b, k);
        p.y += Math.sin(Math.PI * k) * 0.95 + 0.5;
        g.children[i].position.copy(p);
        g.children[i].visible = k <= t + 0.001;
      }
    };
    return g;
  }

  #sparks(at, { colour, count = 14, spread = 0.9, seconds = 0.6, rise = 1.1 }) {
    const tex = blobTexture(colour, colour.replace(/,1\)$/, ',0)'));
    const grp = new THREE.Group();
    const vel = [];
    for (let i = 0; i < count; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending,
      }));
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      s.position.copy(at);
      s.scale.setScalar(0.34);
      vel.push(new THREE.Vector3(Math.cos(a) * spread, rise * (0.6 + Math.random() * 0.8),
        Math.sin(a) * spread));
      grp.add(s);
    }
    this.#hold(grp, seconds, (t) => {
      for (let i = 0; i < grp.children.length; i++) {
        const s = grp.children[i];
        s.position.copy(at).addScaledVector(vel[i], t);
        s.position.y -= t * t * 1.3;
        s.material.opacity = 1 - t;
        s.scale.setScalar(0.46 * (1 - t * 0.5));
      }
    });
  }

  /**
   * A BOLT OF CLOTH — which is what a bolt IS: fabric rolled around a rod.
   *
   * It unrolls off the fighter carrying it, runs out across the table, and
   * WINDS round the target in bands, like bandaging. Only once it has hold of
   * them does the bolt do its work; then it unwinds and is drawn back in.
   *
   * The wrapped part follows a path — cloth pulled tight has no slack left —
   * while the span still in the air is run through Verlet integration so it
   * sags, whips and settles under its own weight. Physics everywhere made the
   * whole strip collapse into a heap; physics nowhere made it a ribbon of
   * glass.
   */
  #ribbon(from, to, colour, { seconds = 1.5, turns = 3.2, width = 0.3, segments = 60 } = {}) {
    const travel = from.distanceTo(to);
    const wrapLen = turns * 2.4;
    const total = travel + wrapLen;
    const axis = to.clone().sub(from).setY(0).normalize();
    if (axis.lengthSq() < 1e-6) axis.set(1, 0, 0);
    const across = new THREE.Vector3(-axis.z, 0, axis.x);

    // Where a given length of cloth lies, measured from the rod.
    const pathAt = (u) => {
      if (u <= travel) {
        const k = travel < 1e-6 ? 0 : u / travel;
        const p = from.clone().lerp(to, k);
        p.y = from.y + 0.35 + Math.sin(Math.PI * k) * 0.55;
        return p;
      }
      // winding: successive bands stepped along the card, so it reads as
      // bandaging rather than a single hoop
      const w = (u - travel) / wrapLen;
      const a = w * Math.PI * 2 * turns;
      const band = (w - 0.5) * CARD_H * 0.62;
      const p = to.clone()
        .addScaledVector(axis, band)
        .addScaledVector(across, Math.cos(a) * CARD_W * 0.56);
      p.y = to.y + 0.14 + (Math.sin(a) * 0.5 + 0.5) * 0.42;
      return p;
    };

    const pts = [];
    for (let i = 0; i < segments; i++) pts.push({ p: from.clone(), o: from.clone() });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(segments * 2 * 3), 3));
    const idx = [];
    for (let i = 0; i < segments - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    geo.setIndex(idx);

    const mat = new THREE.MeshStandardMaterial({
      color: colour, emissive: colour, emissiveIntensity: 0.4,
      roughness: 0.92, metalness: 0.0, side: THREE.DoubleSide,
      transparent: true, opacity: 1,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;

    const up = new THREE.Vector3(0, 1, 0);
    let prevT = 0;

    this.#hold(mesh, seconds, (t) => {
      const dt = Math.min(0.05, Math.max(0.004, (t - prevT) * seconds));
      prevT = t;

      // how much cloth is off the roll
      let out;
      if (t < 0.22) out = (t / 0.22) * travel;                       // running out
      else if (t < 0.5) out = travel + ((t - 0.22) / 0.28) * wrapLen; // winding on
      else if (t < 0.68) out = total;                                 // held
      else out = total * (1 - easeInOut((t - 0.68) / 0.32));          // unwinding

      const tight = t > 0.22 && t < 0.72;     // no slack while it is pulling tight

      for (let i = 0; i < segments; i++) {
        const u = (i / (segments - 1)) * out;
        const target = pathAt(u);
        const q = pts[i];

        if (i === 0 || u > travel || tight) {
          // pulled taut — it goes exactly where the winding puts it
          q.o.copy(q.p);
          q.p.lerp(target, i === 0 ? 1 : 0.45);
        } else {
          // still in the air: carry momentum, lose some to drag, and fall
          const vx = (q.p.x - q.o.x) * 0.88;
          const vy = (q.p.y - q.o.y) * 0.88;
          const vz = (q.p.z - q.o.z) * 0.88;
          q.o.copy(q.p);
          q.p.x += vx; q.p.y += vy - 7.5 * dt * dt; q.p.z += vz;
          q.p.lerp(target, 0.16);              // the rod still leads it
          if (q.p.y < 0.13) q.p.y = 0.13;
        }
      }

      // hold the weave together, so it stays one piece of cloth
      const rest = out / (segments - 1);
      for (let pass = 0; pass < 3; pass++) {
        for (let i = 1; i < segments; i++) {
          const a = pts[i - 1].p, b = pts[i].p;
          const d = b.clone().sub(a);
          const len = d.length() || 1e-4;
          const pull = (len - rest) / len;
          b.addScaledVector(d, -pull * 0.5);
          if (i > 1) a.addScaledVector(d, pull * 0.5);
        }
      }

      // lay it out as a strip, twisting a little along its length
      const pos = geo.attributes.position.array;
      for (let i = 0; i < segments; i++) {
        const prev = pts[Math.max(0, i - 1)].p;
        const next = pts[Math.min(segments - 1, i + 1)].p;
        const tan = next.clone().sub(prev);
        if (tan.lengthSq() < 1e-8) tan.copy(axis);
        const side = tan.normalize().cross(up);
        if (side.lengthSq() < 1e-8) side.copy(across);
        side.normalize().applyAxisAngle(tan, Math.sin(i * 0.4 + t * 5) * 0.5)
          .multiplyScalar(width * 0.5);
        const p2 = pts[i].p;
        pos[i * 6 + 0] = p2.x - side.x; pos[i * 6 + 1] = p2.y - side.y; pos[i * 6 + 2] = p2.z - side.z;
        pos[i * 6 + 3] = p2.x + side.x; pos[i * 6 + 4] = p2.y + side.y; pos[i * 6 + 5] = p2.z + side.z;
      }
      geo.attributes.position.needsUpdate = true;
      geo.computeVertexNormals();

      mat.opacity = t < 0.88 ? 1 : 1 - (t - 0.88) / 0.12;
    });
  }

  /* ---------------------------------------------------------- motifs */

  /**
   * IRON. Chains snake out, wrap the victim and drag it under. The card is
   * already where it belongs by the time this plays, so the chains are laid
   * along the path it took rather than pulling anything.
   */
  chains(from, to) {
    const a = this.#at(from) || this.#at(to);
    const b = this.#at(to);
    if (!a || !b) return;
    const chain = this.#chain(a, b);
    this.#hold(chain, 0.85, (t) => {
      // thrown, held, then gone
      const lay = t < 0.35 ? t / 0.35 : 1;
      chain.userData.lay(lay);
      const fade = t < 0.65 ? 1 : 1 - (t - 0.65) / 0.35;
      for (const link of chain.children) {
        link.material.opacity = fade;
        link.material.transparent = true;
        if (t > 0.35) link.position.y -= (t - 0.35) * 0.35;
      }
    });
    this.anim.ring(null, { at: b, colour: 0x8a7f70, size: 1.5, seconds: 0.5 });
  }

  /**
   * A BRAND: a ring with four spikes, seared onto the card, held, then gone.
   * The mark comes before the card that carries it.
   */
  brand(target) {
    const at = this.#at(target);
    if (!at) return;
    const mat = new THREE.MeshStandardMaterial({
      color: 0x3a0d07, emissive: 0xff5a2a, emissiveIntensity: 1.6,
      roughness: 1, side: THREE.DoubleSide, transparent: true,
    });
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.06, 6, 20), mat);
    ring.rotation.x = -Math.PI / 2;
    g.add(ring);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.34, 4), mat);
      spike.position.set(Math.cos(a) * 0.52, 0, Math.sin(a) * 0.52);
      spike.rotation.z = -Math.PI / 2;
      spike.rotation.y = -a;
      g.add(spike);
    }
    g.position.copy(at);
    g.position.y += 0.12;
    this.#hold(g, 0.95, (t) => {
      const grow = t < 0.3 ? easeOut(t / 0.3) : 1;
      g.scale.setScalar(0.4 + grow * 0.8);
      g.rotation.y = (1 - grow) * 1.2;
      mat.emissiveIntensity = 1.9 - Math.max(0, t - 0.45) * 2.4;
      mat.opacity = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
    });
    this.#sparks(at.clone().setY(at.y + 0.2),
      { colour: 'rgba(255,120,60,1)', count: 10, spread: 0.5, seconds: 0.5, rise: 0.7 });
  }

  /** A fan of shots, loosed from one square across several. */
  volley(from, targets = []) {
    const a = this.#at(from);
    if (!a) return;
    const tex = blobTexture('rgba(255,235,190,1)', 'rgba(255,200,120,0)');
    for (const [i, t] of targets.entries()) {
      const b = this.#at(t);
      if (!b) continue;
      const shot = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      shot.scale.set(0.7, 0.18, 1);
      this.#hold(shot, 0.5, (k) => {
        const t2 = Math.min(1, Math.max(0, (k - i * 0.06) / 0.6));
        shot.position.copy(a).lerp(b, easeIn(t2));
        shot.position.y += 0.5 + Math.sin(Math.PI * t2) * 1.5;
        shot.material.opacity = t2 >= 1 ? 0 : 1;
        if (t2 >= 1 && !shot.userData.hit) {
          shot.userData.hit = true;
          this.#sparks(b, { colour: 'rgba(255,220,160,1)', count: 8, spread: 0.6, seconds: 0.4 });
        }
      });
    }
  }

  /**
   * The Bolts. One card six times over, so each has to land differently —
   * they all begin the same way, coiling out from the fighter that carries
   * them, and then do their own thing.
   */
  bolt(kind, from, to, extra = {}) {
    const a = this.#at(from);
    const b = this.#at(to) || a;
    if (!a) return;

    const look = {
      fire:      { colour: 0xff7a2a, glow: 'rgba(255,140,60,1)' },
      ice:       { colour: 0x8fd8ff, glow: 'rgba(170,225,255,1)' },
      earth:     { colour: 0xbf9758, glow: 'rgba(210,170,110,1)' },
      lightning: { colour: 0xffe14a, glow: 'rgba(255,240,130,1)' },
      shadow:    { colour: 0x9a72d6, glow: 'rgba(160,120,225,1)' },
      doom:      { colour: 0xd8455a, glow: 'rgba(230,90,110,1)' },
    }[kind] || { colour: 0xffc46a, glow: 'rgba(255,200,120,1)' };

    this.#ribbon(a, b, look.colour);

    // what happens once the cloth has hold of them
    const after = 0.78;
    setTimeoutish(this.anim, after, () => {
      if (kind === 'fire') {
        this.#sparks(b, { colour: look.glow, count: 20, spread: 0.7, seconds: 0.7, rise: 1.7 });
        this.anim.ring(null, { at: b, colour: look.colour, size: 1.9, seconds: 0.55 });
      } else if (kind === 'ice') {
        this.#frost(b, look.colour);
      } else if (kind === 'earth') {
        this.#shove(b, extra.to != null ? this.#at(extra.to) : null, look);
      } else if (kind === 'lightning') {
        this.#crackle(a, look);
        if (extra.to != null) this.#crackle(this.#at(extra.to) || b, look);
      } else if (kind === 'shadow') {
        this.#sparks(b, { colour: look.glow, count: 16, spread: 0.5, seconds: 0.8, rise: -0.4 });
      } else {
        this.#sparks(b, { colour: look.glow, count: 24, spread: 1.3, seconds: 0.6, rise: 0.4 });
        this.anim.ring(null, { at: b, colour: look.colour, size: 2.6, seconds: 0.5 });
      }
    });
  }

  #frost(at, colour) {
    const mat = new THREE.MeshStandardMaterial({
      color: colour, emissive: colour, emissiveIntensity: 0.9,
      transparent: true, opacity: 0.85, roughness: 0.2,
    });
    const g = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const shard = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.5 + Math.random() * 0.4, 4), mat);
      const a = (i / 7) * Math.PI * 2;
      shard.position.set(Math.cos(a) * 0.4, 0.1, Math.sin(a) * 0.35);
      shard.rotation.z = Math.cos(a) * 0.5;
      shard.rotation.x = Math.sin(a) * 0.5;
      g.add(shard);
    }
    g.position.copy(at);
    this.#hold(g, 0.8, (t) => {
      g.scale.setScalar(0.3 + easeOut(Math.min(1, t * 2.4)) * 0.9);
      mat.opacity = 0.85 * (1 - Math.max(0, t - 0.5) / 0.5);
    });
  }

  #shove(at, toward, look) {
    this.#sparks(at, { colour: look.glow, count: 14, spread: 1.0, seconds: 0.5, rise: 0.3 });
    const dir = toward ? toward.clone().sub(at).normalize() : new THREE.Vector3(0, 0, -1);
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.12, 0.5),
      new THREE.MeshStandardMaterial({ color: look.colour, roughness: 1, transparent: true }),
    );
    slab.position.copy(at);
    slab.lookAt(at.clone().add(dir));
    this.#hold(slab, 0.5, (t) => {
      slab.position.copy(at).addScaledVector(dir, easeOut(t) * 1.4);
      slab.position.y = 0.16 + Math.sin(Math.PI * t) * 0.2;
      slab.material.opacity = 1 - t;
    });
  }

  /**
   * Arcs of energy hugging the card, not a starburst.
   *
   * The first version was a dozen boxes fanned out from a point, which read as
   * a spiky ball — the thing you notice instead of the card. These are thin,
   * jagged, short-lived and low to the table, which is what a fighter blinking
   * out actually wants: a flicker, then it is gone.
   */
  #crackle(at, look) {
    const mat = new THREE.MeshBasicMaterial({
      color: look.colour, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const g = new THREE.Group();
    const arcs = [];

    for (let a = 0; a < 5; a++) {
      const arc = new THREE.Group();
      const steps = 5;
      const dir = new THREE.Vector3(
        (Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2,
      ).normalize().multiplyScalar(0.34);
      let cur = new THREE.Vector3(0, 0, 0);
      for (let i = 0; i < steps; i++) {
        const nxt = cur.clone().add(dir).add(new THREE.Vector3(
          (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.22, (Math.random() - 0.5) * 0.3,
        ));
        const seg = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, cur.distanceTo(nxt)), mat);
        seg.position.copy(cur).lerp(nxt, 0.5);
        seg.lookAt(nxt);
        arc.add(seg);
        cur = nxt;
      }
      arc.rotation.y = Math.random() * Math.PI * 2;
      g.add(arc);
      arcs.push(arc);
    }
    g.position.copy(at).setY(at.y + 0.18);
    this.#hold(g, 0.34, (t) => {
      // flicker rather than fade: electricity is not a dimmer switch
      const flick = t < 0.75 ? (Math.random() < 0.35 ? 0.35 : 1) : 1 - (t - 0.75) / 0.25;
      mat.opacity = flick;
      for (const arc of arcs) arc.scale.setScalar(0.7 + t * 0.7);
    });

    const light = new THREE.PointLight(look.colour, 0, 5, 2);
    light.position.copy(at).setY(1.0);
    this.#hold(light, 0.3, (t) => { light.intensity = 11 * (1 - t); });
    this.#sparks(at, { colour: look.glow, count: 8, spread: 0.45, seconds: 0.35, rise: 1.1 });
  }

  /**
   * THREAD. The Weavers do not throw anything — they stitch. Ribbons run out
   * across the table and pull taut, and something is simply no longer allowed.
   */
  threads(at, colour = 0xffc46a) {
    const from = this.#at(at);
    if (!from) return;
    const mat = new THREE.MeshBasicMaterial({
      color: colour, transparent: true, blending: THREE.AdditiveBlending,
    });
    const g = new THREE.Group();
    const ends = [];
    for (let i = 0; i < 8; i++) {
      const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 1), mat);
      g.add(ribbon);
      const a = (i / 8) * Math.PI * 2;
      ends.push(new THREE.Vector3(Math.cos(a) * 2.6, 0.2, Math.sin(a) * 2.2));
    }
    g.position.copy(from);
    this.#hold(g, 0.9, (t) => {
      const e = easeInOut(Math.min(1, t * 1.6));
      for (let i = 0; i < g.children.length; i++) {
        const r = g.children[i];
        const end = ends[i].clone().multiplyScalar(e);
        r.position.copy(end).multiplyScalar(0.5);
        r.scale.z = end.length();
        r.lookAt(g.position.clone().add(end));
        r.rotation.z = t * 3;
      }
      mat.opacity = t < 0.55 ? 0.9 : 0.9 * (1 - (t - 0.55) / 0.45);
    });
  }

  /**
   * SHARD FIRE. The Dragon's own colour — the red-pink of the crystal growing
   * out of its back — thrown every time something dies to it, whichever side
   * it belonged to. Lay Waste can chain for a long time, so this fires once
   * per death rather than once per casting.
   */
  shardfire(at) {
    const p = this.#at(at);
    if (!p) return;
    const PINK = 0xf03a72;

    const mat = new THREE.MeshStandardMaterial({
      color: PINK, emissive: 0xff5c8f, emissiveIntensity: 1.7,
      transparent: true, roughness: 0.2, flatShading: true,
    });
    const g = new THREE.Group();
    const dir = [];
    for (let i = 0; i < 14; i++) {
      const shard = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.44, 4), mat);
      g.add(shard);
      const a = (i / 14) * Math.PI * 2 + Math.random() * 0.3;
      const lean = 0.55 + Math.random() * 0.9;
      dir.push(new THREE.Vector3(Math.cos(a) * 1.25, lean, Math.sin(a) * 1.05));
    }
    g.position.copy(p);
    this.#hold(g, 0.75, (t) => {
      const e = easeOut(t);
      for (let i = 0; i < g.children.length; i++) {
        const c = g.children[i];
        c.position.copy(dir[i]).multiplyScalar(e * 1.5);
        c.position.y -= t * t * 0.7;
        c.lookAt(g.position.clone().add(dir[i]).multiplyScalar(4));
        c.scale.setScalar(1 + e * 0.5);
      }
      mat.opacity = 1 - easeIn(t);
      mat.emissiveIntensity = 1.7 * (1 - t * 0.6);
    });

    this.#sparks(p, { colour: 'rgba(255,90,140,1)', count: 22, spread: 1.15, seconds: 0.7, rise: 1.5 });
    this.anim.ring(null, { at: p, colour: PINK, size: 2.8, seconds: 0.6 });

    // a hard pink light, thrown from where it died
    // Lay Waste can kill half a dozen fighters in one go, and six of these
    // going off together turned the whole battlefield pink. Kept local.
    const light = new THREE.PointLight(0xff5c8f, 0, 6.5, 2);
    light.position.copy(p).setY(1.0);
    this.#hold(light, 0.4, (t) => {
      light.intensity = 14 * (1 - t) * (t < 0.2 ? t / 0.2 : 1);
    });
  }

  /**
   * The fallback, for cards with no motif of their own — but a DIFFERENT
   * fallback per faction, in shape and not only in colour. A Gloaming card
   * sinking into the dark should not look like a Shardsworn card shattering
   * with a different tint on it.
   */
  cast(at, faction) {
    const p = this.#at(at);
    if (!p) return;
    const look = FACTION[faction] || FACTION.Neutral;

    switch (faction) {
      case 'Auroxi':                                  // woven ribbons
        this.threads(at, look.spark);
        break;
      case 'Refractory': {                            // a shaft of judgement
        const beam = new THREE.Mesh(
          new THREE.CylinderGeometry(0.42, 0.62, 4.2, 12, 1, true),
          new THREE.MeshBasicMaterial({
            color: look.spark, transparent: true, opacity: 0.5,
            blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false,
          }),
        );
        beam.position.copy(p).setY(2.2);
        this.#hold(beam, 0.6, (t) => {
          beam.scale.set(1 - t * 0.4, 1, 1 - t * 0.4);
          beam.material.opacity = 0.5 * (1 - t);
        });
        this.#sparks(p, { colour: look.glow, count: 10, spread: 0.5, seconds: 0.5, rise: 1.6 });
        break;
      }
      case 'Gloaming':                                // motes sinking, not rising
        this.#sparks(p, { colour: look.glow, count: 18, spread: 0.85, seconds: 0.85, rise: -0.5 });
        break;
      case 'Shardsworn': {                            // it comes apart in facets
        const mat = new THREE.MeshStandardMaterial({
          color: look.spark, emissive: look.spark, emissiveIntensity: 1.1,
          transparent: true, roughness: 0.25, flatShading: true,
        });
        const g = new THREE.Group();
        const dir = [];
        for (let i = 0; i < 9; i++) {
          const sh = new THREE.Mesh(new THREE.TetrahedronGeometry(0.17), mat);
          g.add(sh);
          const a = (i / 9) * Math.PI * 2;
          dir.push(new THREE.Vector3(Math.cos(a), 0.7 + Math.random(), Math.sin(a) * 0.8));
        }
        g.position.copy(p);
        this.#hold(g, 0.7, (t) => {
          for (let i = 0; i < g.children.length; i++) {
            g.children[i].position.copy(dir[i]).multiplyScalar(t * 1.3);
            g.children[i].rotation.set(t * 5, t * 4, 0);
          }
          mat.opacity = 1 - t;
        });
        break;
      }
      case 'Marvorren': {                             // a ripple, and then another
        this.anim.ring(null, { at: p, colour: look.spark, size: 2.2, seconds: 0.6 });
        this.anim.add(0.18, () => {}, () => this.anim.ring(null, {
          at: p, colour: look.spark, size: 3.0, seconds: 0.7,
        }));
        this.#sparks(p, { colour: look.glow, count: 9, spread: 1.1, seconds: 0.55, rise: 0.5 });
        break;
      }
      default:
        this.#sparks(p, { colour: look.glow, count: 13, spread: 0.75, seconds: 0.55, rise: 1.2 });
        this.anim.ring(null, { at: p, colour: look.spark, size: 1.6, seconds: 0.5 });
    }
  }

  /* ---------------------------------------------------------- dispatch */

  play(ev) {
    if (!ev) return;
    switch (ev.kind) {
      case 'chains': this.chains(ev.from, ev.to); break;
      case 'brand': this.brand(ev.target); break;
      case 'volley': this.volley(ev.from, ev.targets || []); break;
      case 'bolt': this.bolt(ev.bolt, ev.from, ev.to, ev); break;
      case 'threads': this.threads(ev.at, ev.colour); break;
      case 'shardfire': this.shardfire(ev.at); break;
      case 'cast': this.cast(ev.at, ev.faction); break;
      default: break;
    }
  }
}

/** A delay measured in animation time, so it pauses when the game does. */
function setTimeoutish(anim, seconds, fn) {
  anim.add(seconds, () => {}, fn);
}
