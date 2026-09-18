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

/** The discard pile sits beside the Stronghold, on the player's right. */
export function graveyardPosition(player) {
  const p = strongholdPosition(player);
  p.x = (player === 0 ? 1 : -1) * (CARD_W + 0.55);
  return p;
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

    this.graveyards = [new Graveyard(0), new Graveyard(1)];
    for (const g of this.graveyards) this.group.add(g.group);
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
          map: stoneMap.clone(), roughness: 0.9, metalness: 0.02, color: 0xe6e0d2,
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

      // A deploy target can be an OCCUPIED square — deploying onto a friendly
      // fighter that shares a trait. The tile glow would be hidden under that
      // card, so the marker floats above whatever is stacked there.
      const marker = new THREE.Group();
      const halo = new THREE.Mesh(
        new THREE.RingGeometry(TILE * 0.30, TILE * 0.40, 24),
        new THREE.MeshBasicMaterial({
          color: 0x9fe8b0, transparent: true, opacity: 0, side: THREE.DoubleSide,
          depthWrite: false, depthTest: false,
        }),
      );
      halo.rotation.x = -Math.PI / 2;
      marker.add(halo);

      // a chevron pointing down into the square
      const chev = new THREE.Mesh(
        new THREE.ConeGeometry(TILE * 0.17, TILE * 0.26, 4),
        new THREE.MeshBasicMaterial({
          color: 0xdcffe6, transparent: true, opacity: 0,
          depthWrite: false, depthTest: false,
        }),
      );
      chev.rotation.x = Math.PI;
      chev.rotation.y = Math.PI / 4;
      chev.position.y = 0.42;
      marker.add(chev);

      marker.renderOrder = 20;
      marker.visible = false;
      tile.add(marker);

      this.group.add(tile);
      this.tiles.push({ i, group: tile, slab, glow, rim, pick, marker, halo, chev, state: null, stack: 0 });
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

  /**
   * The Gates have to be unmistakable — losing there is the whole game — and
   * they are a property of the SQUARE, so they are cut into the stone rather
   * than drawn on top of it. Two stone posts flank the square and a threshold
   * strip runs across its mouth, facing the owner.
   *
   * (Gates can move or multiply: Living Stronghold makes squares next to it
   * count as your Gates. `setGates` exists so that stays possible.)
   */
  #gateMarks() {
    this.gateMarks = [];
    const gateStone = new THREE.MeshStandardMaterial({
      map: stoneTexture(), roughness: 0.9, color: 0xd8cfbe,
    });

    for (let p = 0; p < 2; p++) {
      const g = new THREE.Group();
      const w = squareToWorld(GATES[p]);
      g.position.set(w.x, 0, w.z);

      // a worn threshold cut across the mouth of the square
      const sill = new THREE.Mesh(
        new THREE.BoxGeometry(TILE * 0.92, 0.1, 0.3), gateStone,
      );
      sill.position.set(0, 0.085, (p === 0 ? 1 : -1) * TILE * 0.42);
      sill.receiveShadow = true;
      g.add(sill);

      // gate posts either side
      for (const sx of [-1, 1]) {
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.15, 0.19, 0.95, 8), gateStone,
        );
        post.position.set(sx * TILE * 0.44, 0.47, (p === 0 ? 1 : -1) * TILE * 0.42);
        post.castShadow = post.receiveShadow = true;
        g.add(post);

        const cap = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.17, 0), gateStone,
        );
        cap.position.set(sx * TILE * 0.44, 1.02, (p === 0 ? 1 : -1) * TILE * 0.42);
        cap.castShadow = true;
        g.add(cap);
      }

      // and a scorched brand on the stone itself so the square reads as Gates
      // even from directly overhead
      const brand = new THREE.Mesh(
        new THREE.RingGeometry(TILE * 0.20, TILE * 0.29, 3),
        new THREE.MeshStandardMaterial({
          color: 0x2a211a, emissive: 0xff7a3a, emissiveIntensity: 0.25,
          roughness: 1, side: THREE.DoubleSide,
        }),
      );
      brand.rotation.x = -Math.PI / 2;
      brand.rotation.z = p === 0 ? 0 : Math.PI;
      brand.position.y = 0.072;
      g.add(brand);

      this.group.add(g);
      this.gateMarks.push(brand);
    }
  }

  /* ---------------------------------------------------------- state */

  /**
   * `states` maps square index -> null | 'target' | 'source' | 'hover' | 'danger'.
   * Anything not named goes dark. The board never decides these itself.
   */
  setStates(states = {}, stackHeights = []) {
    for (const t of this.tiles) {
      t.state = states[t.i] || null;
      t.stack = stackHeights[t.i] || 0;
    }
  }

  pickables() {
    return this.tiles.map((t) => t.pick);
  }

  /** Deck counts, so the two piles shrink as the game bleeds them. */
  setDecks(counts) {
    this.strongholds[0].setCount(counts[0]);
    this.strongholds[1].setCount(counts[1]);
  }

  /** The deck meshes, so a click can land on them. */
  deckPickables() {
    return this.strongholds.map((s) => s.deck);
  }

  /** Which player may draw, and which deck the pointer is over. */
  setDrawable(player, hotPlayer) {
    for (let p = 0; p < 2; p++) {
      this.strongholds[p].setDrawable(p === player, p === hotPlayer);
    }
  }

  /** Discard piles, and the face of whatever went in last. */
  setGraveyards(counts, topImages) {
    for (let p = 0; p < 2; p++) this.graveyards[p].set(counts[p], topImages[p]);
  }

  update(dt) {
    this.clock += dt;
    const pulse = 0.5 + Math.sin(this.clock * 3.4) * 0.5;
    for (const s of this.strongholds) s.update(dt, pulse);
    for (const g of this.graveyards) g.update(dt);

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

      // float the marker clear of whatever is stacked on the square
      const wantMark = t.state === 'target' ? 1 : 0;
      const o = t.halo.material.opacity + (wantMark - t.halo.material.opacity) * Math.min(1, dt * 14);
      t.halo.material.opacity = o;
      t.chev.material.opacity = o * 0.9;
      t.marker.visible = o > 0.01;
      const lift = 0.22 + t.stack * 0.05 + (t.stack ? 0.55 : 0) + Math.sin(this.clock * 3) * 0.05;
      t.marker.position.y = lift;
    }

    // Gates breathe so the eye keeps finding them.
    for (const m of this.gateMarks) {
      m.material.emissiveIntensity = 0.18 + pulse * 0.30;
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

    // the plinth the deck stands on
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(CARD_W + 0.34, 0.22, CARD_H + 0.34),
      new THREE.MeshStandardMaterial({ map: stoneTexture(), roughness: 0.95, color: 0xb3ab9d }),
    );
    plinth.position.y = -0.03;
    plinth.receiveShadow = true;
    this.group.add(plinth);

    // Stone trim, not a team colour. It only lights up when the deck is empty,
    // which is a warning rather than a decoration.
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(CARD_W * 0.82, 0.045, 6, 4),
      new THREE.MeshStandardMaterial({
        color: 0xbdb3a2, emissive: 0x000000, emissiveIntensity: 0, roughness: 0.75,
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
    // Drawing is an action like any other, so the pile has to be clickable —
    // there was previously no way to take a Draw at all.
    this.deck.userData.deckOf = player;
    this.group.add(this.deck);

    // a soft glow that comes up when the deck can be drawn from
    const halo = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD_W + 0.9, CARD_H + 0.9),
      new THREE.MeshBasicMaterial({
        map: blobTexture('rgba(255,235,180,0.9)', 'rgba(255,235,180,0)'),
        transparent: true, depthWrite: false, opacity: 0,
        blending: THREE.AdditiveBlending,
      }),
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.1;
    this.group.add(halo);
    this.halo = halo;
    this.live = false;
    this.hot = false;

    this.#applyCount(20);
  }

  setCount(n) { this.count = Math.max(0, n); }

  /** `live` = this player may draw right now. `hot` = the pointer is on it. */
  setDrawable(live, hot) { this.live = live; this.hot = hot; }

  #applyCount(n) {
    const h = Math.max(0.02, n * 0.021);
    this.deck.scale.y = h;
    this.deck.position.y = 0.085 + h / 2;
    this.deck.visible = n > 0;
  }

  update(dt, pulse) {
    this.shown += (this.count - this.shown) * Math.min(1, dt * 7);
    this.#applyCount(this.shown);

    // The pile lights up when it can be drawn from, and lifts a little under
    // the pointer, so it reads as a thing you can click.
    const want = this.live ? (this.hot ? 0.55 : 0.14 + pulse * 0.10) : 0;
    this.halo.material.opacity += (want - this.halo.material.opacity) * Math.min(1, dt * 12);
    if (this.hot && this.live) this.deck.position.y += 0.12;

    // an empty Stronghold is a loss waiting to happen, so it pulses
    if (this.count === 0) {
      this.band.material.color.setHex(0xff5a4a);
      this.band.material.emissive.setHex(0xff5a4a);
      this.band.material.emissiveIntensity = 0.3 + pulse * 0.9;
    } else {
      this.band.material.emissiveIntensity = 0;
    }
  }
}


/**
 * The discard pile, beside the Stronghold. Cards go into it face UP — it is
 * open information, and several cards deploy or retrieve from it, so you have
 * to be able to see what is in there.
 */
class Graveyard {
  constructor(player) {
    this.player = player;
    this.count = 0;
    this.shown = 0;
    this.topImg = null;

    this.group = new THREE.Group();
    this.group.position.copy(graveyardPosition(player));

    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(CARD_W + 0.22, 0.16, CARD_H + 0.22),
      new THREE.MeshStandardMaterial({ map: stoneTexture(), roughness: 1, color: 0x8d8579 }),
    );
    slab.position.y = -0.04;
    slab.receiveShadow = true;
    this.group.add(slab);

    // the pile: one box scaled by count, wearing the last card discarded
    const edge = new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.9 });
    this.faceMat = new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.6 });
    this.pile = new THREE.Mesh(
      new THREE.BoxGeometry(CARD_W, 1, CARD_H),
      [edge, edge, this.faceMat, edge, edge, edge],
    );
    this.pile.castShadow = this.pile.receiveShadow = true;
    this.pile.rotation.y = player === 0 ? 0 : Math.PI;
    this.group.add(this.pile);

    this.#apply(0);
  }

  set(count, img) {
    this.count = count;
    if (img && img !== this.topImg) {
      this.topImg = img;
      this.faceMat.map = cardTexture(`../site/${img}.jpg`);
      this.faceMat.color.setHex(0xffffff);
      this.faceMat.needsUpdate = true;
    }
  }

  #apply(n) {
    const h = Math.max(0.02, n * 0.021);
    this.pile.scale.y = h;
    this.pile.position.y = 0.045 + h / 2;
    this.pile.visible = n > 0;
  }

  update(dt) {
    this.shown += (this.count - this.shown) * Math.min(1, dt * 7);
    this.#apply(this.shown);
  }
}
