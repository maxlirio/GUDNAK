// The nine squares.
//
// The brief was that the grid should blend into the battlefield rather than
// look like a board dropped on grass, so each square is a worn stone slab set
// slightly INTO a dirt apron, with grass tufts growing over the seams and no
// drawn gridlines at all. What separates the squares is the joint between
// stones, the way it would be on a real courtyard.

import * as THREE from 'three';
import { STEP, TILE, LITE } from './arena.js';
import { stoneTexture, blobTexture, cardTexture, woodTexture } from './textures.js';

export const GATES = [1, 7];

// A card's footprint on the board, so the Stronghold space matches a real card.
export const CARD_W = 1.74;
export const CARD_H = 1.76;

/** The Stronghold space sits behind the centre square of each back row. */
export function strongholdPosition(player) {
  const z = (player === 0 ? 1 : -1) * (STEP * 1.5 + CARD_H * 0.62);
  return new THREE.Vector3(0, 0, z);
}

/** Square index -> world position. Row 0 (0,1,2) is player 0's back row, nearest the camera. */
export function squareToWorld(i) {
  const col = i % 3, row = Math.floor(i / 3);
  return new THREE.Vector3((col - 1) * STEP, 0, (1 - row) * STEP);
}

function rand(seed) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}

export class Board {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);

    this.tiles = [];
    this.highlights = [];
    this.clock = 0;

    const stone = stoneTexture();
    this.#slabs(stone);
    this.#seams();
    this.#gateMarks();

    // Your deck sits ON your Stronghold, behind your centre square — so the
    // run from you to your opponent is: your deck, three rows of three, their
    // deck. The Stronghold is a card space, not a building.
    this.strongholds = [new Stronghold(0), new Stronghold(1)];
    for (const s of this.strongholds) this.group.add(s.group);
  }

  #slabs(stoneMap) {
    const r = rand(313);

    for (let i = 0; i < 9; i++) {
      const p = squareToWorld(i);
      const tile = new THREE.Group();
      tile.position.copy(p);

      // The slab is a shallow box sunk so only its top 6cm shows. Each one is
      // rotated a hair and sized a hair differently, which is what stops nine
      // identical squares reading as a UI element.
      const jitter = 0.97 + r() * 0.06;
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(TILE * jitter, 0.34, TILE * jitter),
        new THREE.MeshStandardMaterial({
          map: stoneMap.clone(), roughness: 0.92, metalness: 0.02, color: 0xc9c2b4,
        }),
      );
      slab.material.map.offset.set(r(), r());
      slab.material.map.needsUpdate = true;
      slab.position.y = -0.09;             // sunk into the apron
      slab.rotation.y = (r() - 0.5) * 0.05;
      slab.receiveShadow = true;
      slab.castShadow = false;
      tile.add(slab);

      // Selection glow. Sits just above the stone, off until the rules say so.
      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(TILE * 1.02, TILE * 1.02),
        new THREE.MeshBasicMaterial({
          map: blobTexture('rgba(255,255,255,0.85)', 'rgba(255,255,255,0)'),
          transparent: true, depthWrite: false, opacity: 0,
          blending: THREE.AdditiveBlending,
        }),
      );
      glow.rotation.x = -Math.PI / 2;
      glow.position.y = 0.085;
      tile.add(glow);

      // Rim that lights up on hover — a thin ring, not a hard outline.
      const rim = new THREE.Mesh(
        new THREE.RingGeometry(TILE * 0.40, TILE * 0.50, 4, 1),
        new THREE.MeshBasicMaterial({
          color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      rim.rotation.x = -Math.PI / 2;
      rim.rotation.z = Math.PI / 4;
      rim.position.y = 0.09;
      tile.add(rim);

      // Invisible slab used only for picking, so a click never misses because
      // it landed in a seam.
      const pick = new THREE.Mesh(
        new THREE.BoxGeometry(STEP, 0.5, STEP),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      pick.position.y = 0.2;
      pick.userData.square = i;
      tile.add(pick);

      this.group.add(tile);
      this.tiles.push({ i, group: tile, slab, glow, rim, pick, state: null });
    }
  }

  /** Grass and gravel creeping over the joints, so the slabs are not floating. */
  #seams() {
    const r = rand(88);
    const bladeGeo = new THREE.PlaneGeometry(0.09, 0.3);
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0x4e6b32, side: THREE.DoubleSide, roughness: 1,
      alphaTest: 0.5, transparent: true,
    });

    const TUFTS = LITE ? 260 : 1400;
    const tufts = new THREE.InstancedMesh(bladeGeo, bladeMat, TUFTS);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const pos = new THREE.Vector3();
    let n = 0;

    const half = STEP * 1.5;
    while (n < TUFTS) {
      const x = (r() * 2 - 1) * half * 1.12;
      const z = (r() * 2 - 1) * half * 1.12;

      // keep tufts near the joints and the outer edge, off the middle of slabs
      const nx = Math.abs(((x + half) % STEP) - STEP / 2);
      const nz = Math.abs(((z + half) % STEP) - STEP / 2);
      const nearSeam = nx > TILE * 0.42 || nz > TILE * 0.42;
      const outside = Math.max(Math.abs(x), Math.abs(z)) > half;
      if (!nearSeam && !outside) continue;

      pos.set(x, 0.06 + r() * 0.04, z);
      q.setFromEuler(new THREE.Euler((r() - 0.5) * 0.3, r() * Math.PI, (r() - 0.5) * 0.35));
      s.setScalar(0.6 + r() * 0.9);
      m.compose(pos, q, s);
      tufts.setMatrixAt(n, m);
      n++;
    }
    tufts.instanceMatrix.needsUpdate = true;
    tufts.castShadow = false;
    tufts.receiveShadow = true;
    this.group.add(tufts);

    // loose gravel in the joints
    const pebbleGeo = new THREE.DodecahedronGeometry(0.05, 0);
    const pebbleMat = new THREE.MeshStandardMaterial({ color: 0x7a7266, roughness: 1, flatShading: true });
    const PEB = LITE ? 60 : 260;
    const pebbles = new THREE.InstancedMesh(pebbleGeo, pebbleMat, PEB);
    for (let i = 0; i < PEB; i++) {
      const x = (r() * 2 - 1) * half * 1.08;
      const z = (r() * 2 - 1) * half * 1.08;
      pos.set(x, 0.05, z);
      q.setFromEuler(new THREE.Euler(r() * 3, r() * 3, r() * 3));
      s.setScalar(0.5 + r() * 1.4);
      m.compose(pos, q, s);
      pebbles.setMatrixAt(i, m);
    }
    pebbles.instanceMatrix.needsUpdate = true;
    pebbles.receiveShadow = true;
    this.group.add(pebbles);
  }

  /** The two Gates get an inlay, because losing there is the whole game. */
  #gateMarks() {
    this.gateMarks = [];
    for (let p = 0; p < 2; p++) {
      const mark = new THREE.Mesh(
        new THREE.RingGeometry(TILE * 0.22, TILE * 0.33, 6),
        new THREE.MeshStandardMaterial({
          color: p === 0 ? 0x3d86ad : 0xb0413f,
          emissive: p === 0 ? 0x11364f : 0x4a1210,
          emissiveIntensity: 0.6, roughness: 0.6, side: THREE.DoubleSide,
        }),
      );
      mark.rotation.x = -Math.PI / 2;
      mark.rotation.z = Math.PI / 6;
      const w = squareToWorld(GATES[p]);
      mark.position.set(w.x, 0.075, w.z);
      this.group.add(mark);
      this.gateMarks.push(mark);
    }
  }

  /* ---------------------------------------------------------- state */

  /**
   * `states` maps square index -> null | 'target' | 'source' | 'hover' | 'danger'.
   * Anything not named goes dark. The board never decides these itself.
   */
  setStates(states = {}) {
    for (const t of this.tiles) t.state = states[t.i] || null;
  }

  pickables() {
    return this.tiles.map((t) => t.pick);
  }

  /** Deck counts, so the two piles shrink as the game bleeds them. */
  setDecks(counts) {
    this.strongholds[0].setCount(counts[0]);
    this.strongholds[1].setCount(counts[1]);
  }

  update(dt) {
    this.clock += dt;
    const pulse = 0.5 + Math.sin(this.clock * 3.4) * 0.5;
    for (const s of this.strongholds) s.update(dt, pulse);

    for (const t of this.tiles) {
      let glow = 0, rim = 0, colour = 0xffffff;
      switch (t.state) {
        case 'target': glow = 0.22 + pulse * 0.20; rim = 0.55; colour = 0x9fe8b0; break;
        case 'source': glow = 0.30; rim = 0.75; colour = 0xffd98a; break;
        case 'hover':  glow = 0.34; rim = 0.9;  colour = 0xffffff; break;
        case 'danger': glow = 0.25 + pulse * 0.3; rim = 0.6; colour = 0xff6a5a; break;
        default: break;
      }
      t.glow.material.opacity += (glow - t.glow.material.opacity) * Math.min(1, dt * 14);
      t.rim.material.opacity += (rim - t.rim.material.opacity) * Math.min(1, dt * 14);
      t.glow.material.color.setHex(colour);
      t.rim.material.color.setHex(colour);
    }

    // Gates breathe so the eye keeps finding them.
    for (const m of this.gateMarks) {
      m.material.emissiveIntensity = 0.35 + pulse * 0.45;
    }
  }
}


/**
 * A Stronghold: a worn card-sized plinth set into the ground with the player's
 * deck stacked face down on top of it. The pile is one box scaled by the deck
 * count rather than twenty meshes — it reads the same and costs nothing.
 */
class Stronghold {
  constructor(player) {
    this.player = player;
    this.count = 20;
    this.shown = 20;
    this.group = new THREE.Group();
    this.group.position.copy(strongholdPosition(player));

    const tint = player === 0 ? 0x4c9fd0 : 0xd0554f;

    // the plinth the deck stands on
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(CARD_W + 0.34, 0.22, CARD_H + 0.34),
      new THREE.MeshStandardMaterial({ map: stoneTexture(), roughness: 0.95, color: 0xb3ab9d }),
    );
    plinth.position.y = -0.03;
    plinth.receiveShadow = true;
    this.group.add(plinth);

    // Owner colour goes on the plinth's rim as solid trim, not a translucent
    // sheet laid over the top of it.
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(CARD_W * 0.82, 0.045, 6, 4),
      new THREE.MeshStandardMaterial({
        color: tint, emissive: tint, emissiveIntensity: 0.3, roughness: 0.5,
      }),
    );
    band.rotation.x = Math.PI / 2;
    band.rotation.z = Math.PI / 4;
    band.position.y = 0.085;
    band.castShadow = true;
    this.group.add(band);
    this.band = band;

    // the deck itself, face down
    const back = cardTexture('../site/assets/card-back.jpg');
    const edge = new THREE.MeshStandardMaterial({ map: woodTexture(1, 30), roughness: 0.9, color: 0x9a8f80 });
    const top = new THREE.MeshStandardMaterial({ map: back, roughness: 0.6 });
    this.deck = new THREE.Mesh(
      new THREE.BoxGeometry(CARD_W, 1, CARD_H),
      [edge, edge, top, edge, edge, edge],
    );
    this.deck.castShadow = true;
    this.deck.receiveShadow = true;
    this.group.add(this.deck);

    this.#applyCount(20);
  }

  setCount(n) { this.count = Math.max(0, n); }

  #applyCount(n) {
    const h = Math.max(0.02, n * 0.021);
    this.deck.scale.y = h;
    this.deck.position.y = 0.085 + h / 2;
    this.deck.visible = n > 0;
  }

  update(dt, pulse) {
    this.shown += (this.count - this.shown) * Math.min(1, dt * 7);
    this.#applyCount(this.shown);
    // an empty Stronghold is a loss waiting to happen, so it pulses
    if (this.count === 0) {
      this.band.material.color.setHex(0xff5a4a);
      this.band.material.emissive.setHex(0xff5a4a);
      this.band.material.emissiveIntensity = 0.3 + pulse * 0.9;
    } else {
      this.band.material.emissiveIntensity = 0.3;
    }
  }
}
