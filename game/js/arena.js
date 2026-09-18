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

export class Arena {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.torches = [];
    this.banners = [];
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
    const size = 170, seg = 110;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const r = rand(2311);
    const flat = STEP * 2.6;   // keep the play area and its apron level
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
      map: grassTexture(26), roughness: 1, metalness: 0,
    }));
    ground.receiveShadow = true;
    this.scene.add(ground);

    // A trodden dirt apron so the stone squares are not dropped onto raw grass.
    const apron = new THREE.Mesh(
      new THREE.CircleGeometry(STEP * 2.55, 64),
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
    const sun = new THREE.DirectionalLight(0xffd9a8, 2.5);
    sun.position.set(-13, 15, 9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const c = sun.shadow.camera;
    c.left = -18; c.right = 18; c.top = 18; c.bottom = -18; c.near = 1; c.far = 60;
    sun.shadow.bias = -0.0012;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun);
    this.sun = sun;

    // Cool bounce from the sky, so shadow sides read blue rather than black.
    this.scene.add(new THREE.HemisphereLight(0x8fa6d0, 0x3a3320, 1.05));
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.22));
  }

  /* -------------------------------------------------------- scenery */

  #scenery() {
    this.#strongholds();
    this.#treeline();
    this.#rocks();
    this.#motes();
  }

  #strongholds() {
    // One at each end, past the back rows. Deliberately chunky and low so they
    // frame the board without stealing the camera.
    const z = STEP * 1.5 + 3.6;
    this.strongholds = [
      this.#gatehouse(0, z, 0, 0x3d86ad),          // player 0, near
      this.#gatehouse(0, -z, Math.PI, 0xb0413f),   // player 1, far
    ];
  }

  #gatehouse(x, z, rotY, bannerColour) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotY;

    const wood = woodTexture(2, 28);
    const stone = new THREE.MeshStandardMaterial({ map: stoneTexture(), roughness: 0.95 });

    const wall = new THREE.Mesh(new THREE.BoxGeometry(9.5, 2.6, 1.5), stone);
    wall.position.y = 1.3;
    wall.castShadow = wall.receiveShadow = true;
    group.add(wall);

    for (const tx of [-3.6, 3.6]) {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.35, 4.6, 12), stone);
      tower.position.set(tx, 2.3, 0);
      tower.castShadow = tower.receiveShadow = true;
      group.add(tower);

      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(1.5, 1.7, 12),
        new THREE.MeshStandardMaterial({ color: 0x53303a, roughness: 0.8 }),
      );
      roof.position.set(tx, 5.4, 0);
      roof.castShadow = true;
      group.add(roof);
    }

    // the gate itself, facing the board
    const gate = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 2.2, 0.35),
      new THREE.MeshStandardMaterial({ map: wood, roughness: 0.85 }),
    );
    gate.position.set(0, 1.1, -0.8);
    gate.castShadow = true;
    group.add(gate);

    // banner — the colour is the only thing telling the two ends apart at a glance
    const banner = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 2.4, 1, 8),
      new THREE.MeshStandardMaterial({ color: bannerColour, side: THREE.DoubleSide, roughness: 0.9 }),
    );
    banner.position.set(0, 3.3, -0.85);
    banner.castShadow = true;
    group.add(banner);
    this.banners.push(banner);

    for (const tx of [-1.9, 1.9]) this.#torch(group, tx, -0.9);

    this.scene.add(group);
    return group;
  }

  #torch(parent, x, z) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.12, 2.1, 6),
      new THREE.MeshStandardMaterial({ color: 0x2e241c, roughness: 1 }),
    );
    post.position.set(x, 1.05, z);
    post.castShadow = true;
    parent.add(post);

    const flame = new THREE.Sprite(new THREE.SpriteMaterial({
      map: blobTexture('rgba(255,236,170,1)', 'rgba(255,120,20,0)'),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    flame.scale.set(0.95, 1.25, 1);
    flame.position.set(x, 2.25, z);
    parent.add(flame);

    const light = new THREE.PointLight(0xffa64d, 9, 11, 2);
    light.position.set(x, 2.3, z);
    parent.add(light);

    this.torches.push({ flame, light, phase: Math.random() * 6.28 });
  }

  #treeline() {
    const r = rand(404);
    const trunkMat = new THREE.MeshStandardMaterial({ map: woodTexture(1, 26), roughness: 1 });
    const leafMats = [0x2f4a24, 0x3a5a2b, 0x26401f].map((c) =>
      new THREE.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true }));

    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 2.2, 6);
    const leafGeo = new THREE.IcosahedronGeometry(1, 0);

    for (let i = 0; i < 120; i++) {
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
    for (let i = 0; i < 40; i++) {
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
    const n = 240;
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

    // banners stir
    for (let i = 0; i < this.banners.length; i++) {
      this.banners[i].rotation.z = Math.sin(this.clock * 1.6 + i) * 0.045;
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
