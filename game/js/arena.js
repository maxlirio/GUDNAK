// The battlefield the nine squares sit in: ground, strongholds, scenery,
// weather and light. Everything here is decoration — board.js owns the grid
// and nothing in this file knows the rules.

import * as THREE from 'three';
import { grassTexture, woodTexture, dirtTexture, blobTexture, stoneTexture } from './textures.js';

export const TILE = 2.5;        // square size in world units
export const GAP = 0.12;
export const STEP = TILE + GAP; // centre-to-centre

const FACTION_TINT = {
  Gloaming: 0x7d5fb0, Shardsworn: 0x3f9d7e,
  Refractory: 0xc98a2c, Marvorren: 0x3d86ad, Neutral: 0x8a8f95,
};

function rand(seed) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}

// Headless Chrome renders WebGL on SwiftShader, where a 2048 shadow map and a
// hundred trees take minutes rather than milliseconds. ?lite=1 trims the scene
// so a screenshot check is actually possible; it changes nothing for a real GPU.
export const LITE = new URLSearchParams(location.search).has('lite');

export class Arena {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.torches = [];
    this.clock = 0;

    this.#sky();
    this.#ground();
    this.#lights();
    this.#scenery();
  }

  /* -------------------------------------------------------- sky + fog */

  #sky() {
    // Dusk: warm low on the horizon, cold overhead. Fog in the same family so
    // distant scenery dissolves instead of cutting off at a hard edge.
    const canvas = document.createElement('canvas');
    canvas.width = 4; canvas.height = 256;
    const g = canvas.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0.00, '#15213a');
    grd.addColorStop(0.45, '#3c4a63');
    grd.addColorStop(0.72, '#8a6a58');
    grd.addColorStop(1.00, '#c08a52');
    g.fillStyle = grd;
    g.fillRect(0, 0, 4, 256);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(180, 24, 16),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false }),
    );
    this.scene.add(sky);
    this.scene.fog = new THREE.FogExp2(0x4a4a5c, 0.0125);
  }

  /* -------------------------------------------------------- ground */

  #ground() {
    // A big rolling field. Vertices are nudged so the horizon is not a ruler
    // line, but the arena footprint is flattened so the squares sit true.
    const size = 170, seg = LITE ? 26 : 110;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const r = rand(2311);
    const flat = STEP * 3.1;   // play area, strongholds and apron all level
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const d = Math.max(Math.abs(x), Math.abs(z));
      const roll = Math.sin(x * 0.08) * Math.cos(z * 0.07) * 1.5
                 + Math.sin(x * 0.21 + 1.7) * 0.5
                 + (r() - 0.5) * 0.25;
      const k = THREE.MathUtils.smoothstep(d, flat, flat + 16);
      pos.setY(i, roll * k);
    }
    geo.computeVertexNormals();

    const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      map: grassTexture(26), roughness: 1, metalness: 0, color: 0x9aa88c,
    }));
    ground.receiveShadow = true;
    this.scene.add(ground);

    // A trodden dirt apron so the stone squares are not dropped onto raw grass.
    const apron = new THREE.Mesh(
      new THREE.CircleGeometry(STEP * 3.05, 64),
      new THREE.MeshStandardMaterial({
        map: dirtTexture(3), roughness: 1, transparent: true, opacity: 0.93,
      }),
    );
    apron.rotation.x = -Math.PI / 2;
    apron.position.y = 0.012;
    apron.receiveShadow = true;
    this.scene.add(apron);
  }

  /* -------------------------------------------------------- lighting */

  #lights() {
    // Key light is a low sun raking across the board, which is what gives the
    // standees long readable shadows and the stone its relief.
    const sun = new THREE.DirectionalLight(0xffc98a, 2.15);
    sun.position.set(-13, 15, 9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(LITE ? 512 : 2048, LITE ? 512 : 2048);
    const c = sun.shadow.camera;
    c.left = -18; c.right = 18; c.top = 18; c.bottom = -18; c.near = 1; c.far = 60;
    sun.shadow.bias = -0.0012;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun);
    this.sun = sun;

    // Cool bounce from the sky, so shadow sides read blue rather than black.
    this.scene.add(new THREE.HemisphereLight(0x6f86b4, 0x2a2418, 0.55));
    this.scene.add(new THREE.AmbientLight(0x9fb0cc, 0.12));
  }

  /* -------------------------------------------------------- scenery */

  #scenery() {
    this.#ruins();
    this.#treeline();
    this.#rocks();
    this.#motes();
  }

  /**
   * Ruins, not buildings. The factions do not all live in castles — Auroxi
   * strongholds are giant oxen — so the arena is a ruined place that belongs to
   * nobody: broken walls, toppled columns and arch fragments scattered right
   * around the play area rather than a fort at each end.
   */
  #ruins() {
    const r = rand(9001);
    const stoneMat = new THREE.MeshStandardMaterial({
      map: stoneTexture(), roughness: 0.96, color: 0xb9b2a4,
    });
    const darkStone = new THREE.MeshStandardMaterial({
      color: 0x6a6357, roughness: 1, flatShading: true,
    });

    const ring = new THREE.Group();
    this.scene.add(ring);
    this.ruins = ring;

    const COUNT = LITE ? 16 : 46;
    for (let i = 0; i < COUNT; i++) {
      const a = (i / COUNT) * Math.PI * 2 + (r() - 0.5) * 0.25;
      const dist = STEP * 2.9 + r() * 9;
      const x = Math.cos(a) * dist;
      const z = Math.sin(a) * dist * 1.15;

      const piece = new THREE.Group();
      piece.position.set(x, 0, z);
      piece.rotation.y = a + Math.PI / 2 + (r() - 0.5) * 0.7;

      const kind = r();
      if (kind < 0.42) {
        // a broken wall: a run of blocks with the top course fallen away
        const len = 2 + Math.floor(r() * 4);
        for (let b = 0; b < len; b++) {
          const h = 0.5 + r() * 1.9 * (1 - b / (len + 1));
          const block = new THREE.Mesh(new THREE.BoxGeometry(1.05, h, 0.72), stoneMat);
          block.position.set((b - len / 2) * 1.08, h / 2, (r() - 0.5) * 0.12);
          block.rotation.z = (r() - 0.5) * 0.05;
          block.castShadow = block.receiveShadow = true;
          piece.add(block);
        }
      } else if (kind < 0.68) {
        // a stump of tower, snapped off
        const h = 1.4 + r() * 2.6;
        const tower = new THREE.Mesh(
          new THREE.CylinderGeometry(0.85 + r() * 0.3, 1.1 + r() * 0.3, h, 9, 1, true), stoneMat);
        tower.material.side = THREE.DoubleSide;
        tower.position.y = h / 2;
        tower.rotation.y = r() * 3;
        tower.castShadow = tower.receiveShadow = true;
        piece.add(tower);
        // rubble spilling out of the break
        for (let k = 0; k < 5; k++) {
          const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22 + r() * 0.25, 0), darkStone);
          rock.position.set((r() - 0.5) * 2.6, 0.12 + r() * 0.2, (r() - 0.5) * 2.6);
          rock.rotation.set(r() * 3, r() * 3, r() * 3);
          rock.castShadow = rock.receiveShadow = true;
          piece.add(rock);
        }
      } else if (kind < 0.86) {
        // a column, still standing or lying where it fell
        const h = 1.8 + r() * 2.4;
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, h, 10), stoneMat);
        const fallen = r() < 0.55;
        if (fallen) {
          col.rotation.z = Math.PI / 2 + (r() - 0.5) * 0.3;
          col.position.set((r() - 0.5) * 0.6, 0.3, 0);
        } else {
          col.position.y = h / 2;
          col.rotation.z = (r() - 0.5) * 0.09;
        }
        col.castShadow = col.receiveShadow = true;
        piece.add(col);
      } else {
        // a fragment of arch
        const h = 2.2 + r() * 1.2;
        for (const side of [-1, 1]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.55, h, 0.6), stoneMat);
          leg.position.set(side * 0.95, h / 2, 0);
          leg.castShadow = leg.receiveShadow = true;
          piece.add(leg);
        }
        const span = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 0.6), stoneMat);
        span.position.y = h + 0.22;
        span.rotation.z = (r() - 0.5) * 0.06;
        span.castShadow = span.receiveShadow = true;
        piece.add(span);
      }

      ring.add(piece);
    }

    // scorched braziers dotted round the ruins, for the firelight
    const TORCHES = LITE ? 2 : 6;
    for (let i = 0; i < TORCHES; i++) {
      const a = (i / TORCHES) * Math.PI * 2 + 0.4;
      const d = STEP * 2.45;
      this.#brazier(Math.cos(a) * d, Math.sin(a) * d * 1.05);
    }
  }

  #brazier(x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);

    const bowl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.2, 0.3, 8),
      new THREE.MeshStandardMaterial({ color: 0x33291f, roughness: 1, metalness: 0.2 }),
    );
    bowl.position.y = 0.82;
    bowl.castShadow = true;
    g.add(bowl);

    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.15, 0.75, 6),
      new THREE.MeshStandardMaterial({ color: 0x2b231b, roughness: 1 }),
    );
    stem.position.y = 0.37;
    stem.castShadow = true;
    g.add(stem);

    const flame = new THREE.Sprite(new THREE.SpriteMaterial({
      map: blobTexture('rgba(255,238,180,1)', 'rgba(255,110,20,0)'),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    flame.scale.set(0.9, 1.2, 1);
    flame.position.y = 1.25;
    g.add(flame);

    const light = new THREE.PointLight(0xffa64d, 8, 12, 2);
    light.position.y = 1.3;
    g.add(light);

    this.scene.add(g);
    this.torches.push({ flame, light, phase: Math.random() * 6.28 });
  }

  #treeline() {
    const r = rand(404);
    const trunkMat = new THREE.MeshStandardMaterial({ map: woodTexture(1, 26), roughness: 1 });
    const leafMats = [0x2f4a24, 0x3a5a2b, 0x26401f].map((c) =>
      new THREE.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true }));

    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 2.2, 6);
    const leafGeo = new THREE.IcosahedronGeometry(1, 0);

    for (let i = 0; i < (LITE ? 26 : 120); i++) {
      const a = r() * Math.PI * 2;
      const dist = STEP * 3.4 + r() * 46;
      const x = Math.cos(a) * dist, z = Math.sin(a) * dist;
      if (Math.max(Math.abs(x), Math.abs(z)) < STEP * 3.1) continue;

      const t = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 1.1;
      trunk.castShadow = true;
      t.add(trunk);

      const tiers = 2 + Math.floor(r() * 2);
      for (let k = 0; k < tiers; k++) {
        const leaf = new THREE.Mesh(leafGeo, leafMats[Math.floor(r() * 3)]);
        const s = 1.5 - k * 0.32;
        leaf.scale.set(s, s * (0.8 + r() * 0.4), s);
        leaf.position.y = 2.2 + k * 0.95;
        leaf.rotation.set(r() * 3, r() * 3, r() * 3);
        leaf.castShadow = true;
        t.add(leaf);
      }
      const s = 0.8 + r() * 1.1;
      t.scale.setScalar(s);
      t.position.set(x, -0.2, z);
      this.scene.add(t);
    }
  }

  #rocks() {
    const r = rand(77);
    const mat = new THREE.MeshStandardMaterial({ color: 0x6d6459, roughness: 1, flatShading: true });
    const geo = new THREE.DodecahedronGeometry(1, 0);
    for (let i = 0; i < (LITE ? 12 : 40); i++) {
      const a = r() * Math.PI * 2;
      const dist = STEP * 2.7 + r() * 26;
      const x = Math.cos(a) * dist, z = Math.sin(a) * dist;
      if (Math.max(Math.abs(x), Math.abs(z)) < STEP * 2.6) continue;
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, r() * 0.3, z);
      m.rotation.set(r() * 3, r() * 3, r() * 3);
      m.scale.set(0.4 + r() * 1.1, 0.3 + r() * 0.8, 0.4 + r() * 1.1);
      m.castShadow = m.receiveShadow = true;
      this.scene.add(m);
    }
  }

  #motes() {
    // Slow drifting embers. They do more for "this is a place" than any prop.
    const n = LITE ? 60 : 240;
    const pos = new Float32Array(n * 3);
    const r = rand(1234);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (r() - 0.5) * 46;
      pos[i * 3 + 1] = r() * 12;
      pos[i * 3 + 2] = (r() - 0.5) * 46;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.motes = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.13, map: blobTexture('rgba(255,215,150,1)', 'rgba(255,150,60,0)'),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.75,
    }));
    this.scene.add(this.motes);
  }

  /* -------------------------------------------------------- per frame */

  update(dt) {
    this.clock += dt;

    for (const t of this.torches) {
      const f = 0.72 + Math.sin(this.clock * 9 + t.phase) * 0.12
                     + Math.sin(this.clock * 23.7 + t.phase * 2) * 0.07;
      t.light.intensity = 6 + f * 6;
      t.flame.scale.set(0.85 * f + 0.35, 1.15 * f + 0.45, 1);
    }

    if (this.motes) {
      const p = this.motes.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        let y = p.getY(i) + dt * (0.25 + (i % 7) * 0.05);
        if (y > 13) y = 0;
        p.setY(i, y);
        p.setX(i, p.getX(i) + Math.sin(this.clock * 0.4 + i) * dt * 0.12);
      }
      p.needsUpdate = true;
    }
  }

  static tint(faction) {
    return FACTION_TINT[faction] || 0x8a8f95;
  }
}
