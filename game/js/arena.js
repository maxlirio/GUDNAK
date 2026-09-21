// The battlefield the nine squares sit in: ground, strongholds, scenery,
// weather and light. Everything here is decoration — board.js owns the grid
// and nothing in this file knows the rules.

import * as THREE from 'three';
import { grassTexture, woodTexture, dirtTexture, blobTexture, stoneTexture,
  ashlarTexture, rockTexture } from './textures.js';

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
    this.scene.fog = new THREE.FogExp2(0x6a6a80, 0.0095);
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
      map: grassTexture(26), roughness: 1, metalness: 0, color: 0xc2cbb0,
    }));
    ground.receiveShadow = true;
    this.scene.add(ground);

    // A trodden dirt apron so the stone squares are not dropped onto raw grass.
    const apron = new THREE.Mesh(
      new THREE.CircleGeometry(STEP * 3.05, 64),
      new THREE.MeshStandardMaterial({
        map: dirtTexture(3), roughness: 1, transparent: true, opacity: 0.93, color: 0xcfc3ae,
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
    const sun = new THREE.DirectionalLight(0xffd7a2, 3.1);
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
    this.scene.add(new THREE.HemisphereLight(0x93a9d2, 0x4a4030, 1.05));
    this.scene.add(new THREE.AmbientLight(0xc9d4e6, 0.34));
  }

  /* -------------------------------------------------------- scenery */

  #scenery() {
    this.#ruins();
    this.#treeline();
    this.#rocks();
    this.#motes();
  }

  /* ------------------------------------------------- ruin: stone palette */

  /**
   * One palette for every piece of stone on the field, built once and shared
   * by the ruins and the rocks, so a fallen block and a dressed stone lying
   * out in the grass are obviously the same material.
   *
   * Every colour here is warmed a long way past neutral on purpose. The scene
   * is lit by a 0x93a9d2 hemisphere, so stone mixed to a "correct" grey renders
   * LAVENDER. The cure has to be in the material: warming the canvas instead
   * leaves the unmapped materials — rubble, chips, gravel — still blue.
   */
  #stoneMats() {
    if (this.ruinMats) return this.ruinMats;
    const ashlar = ashlarTexture();
    const rough = rockTexture();
    const mk = (o) => new THREE.MeshStandardMaterial({ roughness: 0.96, metalness: 0, ...o });
    this.ruinMats = {
      ashlar,
      rough,
      // vertexColors carries the weathering (see #tintY / #tintFaces). Every
      // mesh built with these materials MUST have a colour attribute — a
      // missing attribute reads as black, not as white.
      wall: mk({ map: ashlar, color: 0xe6d9bf, vertexColors: true }),
      drum: mk({ map: rough, color: 0xe8dbc0, vertexColors: true }),
      chunk: mk({ color: 0xc7bb9f, flatShading: true, vertexColors: true }),
      stone: mk({ map: rough, color: 0xdbcdb1, flatShading: true, vertexColors: true }),
      floor: mk({ map: stoneTexture(), color: 0xb0a48c, vertexColors: true }),
      soil: mk({ map: dirtTexture(2), color: 0x9c8f76, vertexColors: true }),
    };
    return this.ruinMats;
  }

  /**
   * Height of the field at (x, z).
   *
   * #ground() flattens the arena footprint but lets the field roll beyond
   * radius 8.1, by up to half a unit at the distance the outer ruins stand.
   * Everything out there was being built at y=0 and so hovered over a dip or
   * sank into a rise — blocks with daylight under them and a shadow beneath.
   * The plane's own vertices are read rather than the formula recomputed,
   * because #ground belongs to somebody else and its formula will change.
   */
  #gy(x, z) {
    if (!this.groundSample) {
      const g = this.scene.children.find((o) => o.isMesh
        && o.geometry?.type === 'PlaneGeometry' && o.geometry.parameters.width > 60);
      if (!g) { this.groundSample = () => 0; return 0; }
      const P = g.geometry.parameters, pos = g.geometry.attributes.position;
      const nx = P.widthSegments + 1, nz = P.heightSegments + 1;
      this.groundSample = (px, pz) => {
        const u = THREE.MathUtils.clamp((px + P.width / 2) / P.width, 0, 1) * (nx - 1);
        const v = THREE.MathUtils.clamp((pz + P.height / 2) / P.height, 0, 1) * (nz - 1);
        const i0 = Math.floor(u), j0 = Math.floor(v);
        const i1 = Math.min(i0 + 1, nx - 1), j1 = Math.min(j0 + 1, nz - 1);
        const fx = u - i0, fz = v - j0;
        const at = (i, j) => pos.getY(j * nx + i);
        return (at(i0, j0) * (1 - fx) + at(i1, j0) * fx) * (1 - fz)
             + (at(i0, j1) * (1 - fx) + at(i1, j1) * fx) * fz;
      };
    }
    return this.groundSample(x, z);
  }

  /**
   * Box UVs are 0..1 per face whatever the box measures, so a half-metre block
   * and a four-metre pier came out with courses of completely different sizes —
   * the giveaway that the whole thing is stretched texture rather than masonry.
   * This rescales them to a fixed world size so one course is one course.
   *
   * k is 2.9 rather than the 1.9 first tried: at 1.9 a course was 0.24 units,
   * which is eight pixels at this camera, and the walls read as modern brick.
   */
  #boxUV(geo, w, h, d, k = 2.9) {
    const uv = geo.attributes.uv;
    const face = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) {
      for (let i = f * 4; i < f * 4 + 4; i++) {
        uv.setXY(i, uv.getX(i) * face[f][0] / k, uv.getY(i) * face[f][1] / k);
      }
    }
    uv.needsUpdate = true;
  }

  /**
   * Weathering down a wall block, written into vertex colours: damp and soil
   * at the foot, sun-bleach and lichen on the broken top. This is what makes a
   * block sit IN the ground instead of on it — the bottom course going dark
   * reads the same way a tide mark does.
   *
   * Requires a non-indexed geometry: each run of three vertices is one face, so
   * the tint is per-facet and does not bleed round a corner.
   */
  #tintY(geo, h, r, tone = 1) {
    const pos = geo.attributes.position, nrm = geo.attributes.normal;
    const arr = new Float32Array(pos.count * 3);
    const damp = new THREE.Color(0x6f6350), lich = new THREE.Color(0xc6c69a);
    const weed = new THREE.Color(0x8d9a72);
    const c = new THREE.Color();
    // `tone` below 1 does not just darken: it shifts the stone toward the
    // grey-green of something that has been lying in wet grass for centuries.
    // Scaling brightness alone left the whole ruin one flat tan from edge to
    // edge — a hundred pieces of the same rock, just some of them in shadow.
    const age = THREE.MathUtils.clamp((1 - tone) * 1.8, 0, 0.6);
    const block = (0.88 + r() * 0.2) * (0.74 + tone * 0.26);
    for (let f = 0; f + 2 < pos.count; f += 3) {
      const y = (pos.getY(f) + pos.getY(f + 1) + pos.getY(f + 2)) / 3;
      const up = (nrm.getY(f) + nrm.getY(f + 1) + nrm.getY(f + 2)) / 3;
      const t = THREE.MathUtils.clamp((y + h / 2) / Math.max(h, 0.001), 0, 1);
      c.setRGB(1, 1, 1);
      c.lerp(damp, Math.pow(1 - t, 2.6) * 0.85);
      if (up > 0.5) c.lerp(lich, 0.2 + r() * 0.28);
      if (age > 0) c.lerp(weed, age * (0.45 + Math.max(0, up) * 0.55) * (0.7 + r() * 0.5));
      const k = block * (0.94 + r() * 0.12);
      for (let v = 0; v < 3; v++) {
        arr[(f + v) * 3] = c.r * k;
        arr[(f + v) * 3 + 1] = c.g * k;
        arr[(f + v) * 3 + 2] = c.b * k;
      }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return geo;
  }

  /**
   * Facet tint from the face normal, for anything that is not a cut block.
   *
   * The camera never leaves its raised angle, so the TOP of a stone is most of
   * what you see of it: pale weathered crust and moss go up, wet dark rock goes
   * down. Forty flat-shaded dodecahedra sharing one colour read as one lump
   * stamped forty times; this is what makes two stones cut from the same
   * geometry look like different rock.
   */
  #tintFaces(geo, low, high, moss, mossiness, r) {
    const pos = geo.attributes.position, nrm = geo.attributes.normal;
    const arr = new Float32Array(pos.count * 3);
    const A = new THREE.Color(low), B = new THREE.Color(high), M = new THREE.Color(moss);
    const c = new THREE.Color();
    for (let f = 0; f + 2 < pos.count; f += 3) {
      const up = Math.max(0, (nrm.getY(f) + nrm.getY(f + 1) + nrm.getY(f + 2)) / 3);
      c.copy(A).lerp(B, 0.1 + Math.pow(up, 1.4) * 0.9);
      // up-cubed put moss only on dead-level faces, and a tumbled rock has
      // almost none of those: the boulders came out as flat chocolate lumps.
      if (mossiness > 0) c.lerp(M, up * up * mossiness * (0.3 + r() * 0.7));
      const k = 0.87 + r() * 0.26;
      for (let v = 0; v < 3; v++) {
        arr[(f + v) * 3] = c.r * k;
        arr[(f + v) * 3 + 1] = c.g * k;
        arr[(f + v) * 3 + 2] = c.b * k;
      }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return geo;
  }

  /** A dressed block: world-scaled courses, weathered foot, own geometry.
   *  `tone` darkens a whole piece — with one material and one texture the ruin
   *  came out a single flat tan from edge to edge of the frame, and the older,
   *  further-gone pieces need to sit back from the ones still standing. */
  #wallBox(w, h, d, r, tone = 1, k = 2.9) {
    const src = new THREE.BoxGeometry(w, h, d);
    this.#boxUV(src, w, h, d, k);
    const geo = src.toNonIndexed();
    src.dispose();
    this.#tintY(geo, h, r, tone);
    const m = new THREE.Mesh(geo, this.#stoneMats().wall);
    m.castShadow = m.receiveShadow = true;
    return m;
  }

  /** A slab of surviving pavement. Same treatment as a wall block, because
   *  untinted they came out as flat pale rectangles lying on the dirt — the
   *  "sheet of paper dropped on the scene" read, in a place where the whole
   *  point is that this stone has been lying here for centuries. */
  #paveSlab(w, h, d, r, tone = 0.9) {
    const src = new THREE.BoxGeometry(w, h, d);
    this.#boxUV(src, w, h, d, 2.4);
    const geo = src.toNonIndexed();
    src.dispose();
    this.#tintY(geo, h, r, tone);
    const m = new THREE.Mesh(geo, this.#stoneMats().floor);
    m.castShadow = m.receiveShadow = true;
    return m;
  }

  /** One drum of a column. Columns are stacked drums, not one lathe-turned rod:
   *  the joints are the only thing that says the shaft was assembled by hand,
   *  and they are what a broken one breaks along. */
  #drumMesh(rt, rb, h, r, sides = 12) {
    const src = new THREE.CylinderGeometry(rt, rb, h, sides, 1);
    const uv = src.attributes.uv;
    const ku = (2 * Math.PI * rb) / 2.9, kv = h / 2.9;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * ku, uv.getY(i) * kv);
    const geo = src.toNonIndexed();
    src.dispose();
    this.#tintFaces(geo, 0x8a7d66, 0xffffff, 0xb9bd92, 0.35, r);
    const m = new THREE.Mesh(geo, this.#stoneMats().drum);
    m.castShadow = m.receiveShadow = true;
    return m;
  }

  /** Deterministic lumpiness. Shared corners are looked up by position so the
   *  facets stay welded — jittering a non-indexed geometry vertex by vertex
   *  tears it open into confetti. */
  #chunkGeo(base, amp, r, uvScale = 1) {
    const geo = base.index ? base.toNonIndexed() : base;
    if (uvScale !== 1 && geo.attributes.uv) {
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uvScale, uv.getY(i) * uvScale);
    }
    const pos = geo.attributes.position;
    const seen = new Map();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const key = `${x.toFixed(2)}|${y.toFixed(2)}|${z.toFixed(2)}`;
      let o = seen.get(key);
      if (!o) { o = [(r() - 0.5) * amp, (r() - 0.5) * amp, (r() - 0.5) * amp]; seen.set(key, o); }
      pos.setXYZ(i, x + o[0], y + o[1], z + o[2]);
    }
    geo.computeVertexNormals();
    return geo;
  }

  /**
   * A low mound of spoil where stone meets earth.
   *
   * A wall standing on an unbroken grass plane is the loudest possible tell
   * that the mesh was dropped into the scene; in a real ruin the foot of
   * everything is buried in its own debris. An opaque mound is used rather
   * than a transparent decal because the ground and the dirt apron are already
   * blended and a third transparent layer sorts badly against them.
   *
   * Two passes were wasted on these. At 2-3 units across they merged into one
   * brown field that ate the grass; shrunk and lit from a raised sun they still
   * came out as PALE flat polygons lying on the dirt apron — the exact "dropped
   * into the scene" read they were supposed to cure. They are now dark, low,
   * and skipped entirely inside radius 8.6, because inside that the ground is
   * already the trodden dirt apron and a mound of earth on earth is nothing but
   * an extra silhouette.
   */
  #spoil(parent, x, z, rad, hgt, r) {
    if (Math.hypot(x, z) < 8.6) return null;
    const geo = new THREE.CircleGeometry(rad, 22);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const arr = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i), pz = pos.getZ(i);
      const d = Math.hypot(px, pz) / rad;
      const w = 0.7 + r() * 0.6;                   // ragged outline, not a disc
      pos.setXYZ(i, px * w, hgt * 0.55 * (1 - d * d) + 0.004, pz * w);
      const edge = Math.pow(d, 1.3);               // dirt only in the middle
      arr[i * 3] = 0.92 - edge * 0.30;
      arr[i * 3 + 1] = 0.92 + edge * 0.06;         // rim goes green, into grass
      arr[i * 3 + 2] = 0.9 - edge * 0.5;
    }
    geo.computeVertexNormals();
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    const m = new THREE.Mesh(geo, this.#stoneMats().soil);
    m.position.set(x, 0, z);
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  /** Debris around a point, collected for one instanced batch per region.
   *
   *  Yaw is free but pitch and roll are kept small on purpose. #tintFaces bakes
   *  the weathering into the geometry from the face normals, so a chunk spun
   *  freely in all three axes lands with its mossy crust pointing sideways or
   *  underground — which is why the first rubble came out as uniform brown
   *  lumps however hard the tint was pushed. */
  #debris(list, x, z, n, rad, lo, hi, r, flat = 0.5) {
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * rad;
      const s = lo + r() * (hi - lo);
      list.push({
        x: x + Math.cos(a) * d, z: z + Math.sin(a) * d,
        sx: s * (0.75 + r() * 0.8), sy: s * (flat * 0.7 + r() * 0.5), sz: s * (0.7 + r() * 0.8),
        rx: (r() - 0.5) * 0.9, ry: r() * 6.3, rz: (r() - 0.5) * 0.9, t: r(),
      });
    }
  }

  /**
   * One InstancedMesh per region, positioned at the region's centre rather than
   * at the origin. victory.js hides scene objects by their group position when
   * the ending camera swings past, and a batch parked at (0,0,0) is always "in
   * the way" — the whole field's rubble blinked out for the last shot.
   */
  #instanceChunks(parent, ox, oz, list, geo, hueLo, hueHi) {
    if (!list.length) return null;
    const mesh = new THREE.InstancedMesh(geo, this.#stoneMats().chunk, list.length);
    const o = new THREE.Object3D(), c = new THREE.Color();
    list.forEach((b, i) => {
      o.position.set(b.x - ox, this.#gy(b.x, b.z) + b.sy * (0.26 + b.t * 0.2), b.z - oz);
      o.rotation.set(b.rx, b.ry, b.rz);
      o.scale.set(b.sx, b.sy, b.sz);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
      c.setHSL(hueLo + b.t * (hueHi - hueLo), 0.03 + b.t * 0.05,
        0.26 + ((b.t * 7919) % 1) * 0.2, THREE.SRGBColorSpace);
      mesh.setColorAt(i, c);
    });
    mesh.position.set(ox, 0, oz);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  /** A run of footing along one axis, broken into courses with gaps torn in it.
   *  The footing is the most valuable thing in the whole ruin, because the
   *  camera looks DOWN: a floor plan you can trace reads from up here, where a
   *  standing wall is foreshortened to almost nothing. */
  #footRun(parent, axis, from, to, fixed, r, debris, survive = 0.76) {
    const dir = Math.sign(to - from);
    let t = from;
    while (dir * (to - t) > 0.6) {
      const len = Math.min((LITE ? 3.2 : 1.6) + r() * 2.2, dir * (to - t));
      // A complete rectangle of footing read as a pen built round the board.
      // The runs nearest the camera survive least, so the plan is implied from
      // three sides and the bottom of the frame stays open.
      if (r() > survive) { t += dir * (len + 0.5 + r() * 1.8); continue; }
      const h = 0.46 + r() * 0.26;
      const w = 1.5 + r() * 0.3;
      const mid = t + dir * len / 2;
      // Bigger blocks in the footing than in the walls above it, which is
      // how it is actually built and reads as weight from this far up.
      // Tone varies course to course: one flat tan all the way round the
      // plan read as garden edging rather than as buried masonry.
      const tn = 0.64 + r() * 0.38;
      const blk = axis === 'x' ? this.#wallBox(len, h, w, r, tn, 3.6)
        : this.#wallBox(w, h, len, r, tn, 3.6);
      const x = axis === 'x' ? mid : fixed;
      const z = axis === 'x' ? fixed : mid;
      blk.position.set(x, h / 2 - 0.26, z);         // sunk: a footing is buried
      blk.rotation.y = (r() - 0.5) * 0.05;
      blk.rotation.z = axis === 'x' ? (r() - 0.5) * 0.05 : 0;
      blk.rotation.x = axis === 'z' ? (r() - 0.5) * 0.05 : 0;
      parent.add(blk);
      if (r() < 0.55) this.#spoil(parent, x, z, 1.0 + r() * 0.5, 0.06, r);
      if (r() < 0.8) {
        const ox = axis === 'x' ? (r() - 0.5) * len : (r() < 0.5 ? -1 : 1) * 1.1;
        const oz = axis === 'x' ? (r() < 0.5 ? -1 : 1) * 1.1 : (r() - 0.5) * len;
        this.#debris(debris, x + ox, z + oz, 2 + Math.floor(r() * 3), 0.9, 0.18, 0.44, r);
      }
      t += dir * (len + 0.16 + r() * 0.34);
    }
  }

  /**
   * A crossing pier: stepped base, coursed shaft, broken off somewhere up it,
   * and on the taller ones the springing of the arch it used to carry.
   *
   * These four are the whole reason the ruin reads at all. The treeline starts
   * at radius 8.9 and is densest right there, so anything placed out where a
   * hall's walls would naturally go is behind a tree by the time the frame is
   * taken. The one region guaranteed clear is between the apron (r 8.0) and the
   * square the treeline leaves empty (|x|,|z| < 8.13) — four corner pockets on
   * the diagonals. So the building's crossing is put there, and the arcades run
   * away from it into the wood where being half-hidden is the point.
   */
  #pier(parent, x, z, h, style, r, debris) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = (r() - 0.5) * 0.1;
    if (style === 'lean') g.rotation.z = (x > 0 ? -1 : 1) * (0.05 + r() * 0.05);

    const b0 = this.#wallBox(2.95, 0.36, 2.95, r, 0.94, 3.4);
    b0.position.y = 0.04;                       // the bottom step is half buried
    g.add(b0);
    const b1 = this.#wallBox(2.45, 0.32, 2.45, r, 0.97, 3.4);
    b1.position.y = 0.38;
    g.add(b1);

    let y = 0.54;
    const W = 2.0;
    while (y < h - 0.1) {
      const dh = Math.min(0.58 + r() * 0.34, h - y);
      const blk = this.#wallBox(W, dh, W, r);
      blk.position.set((r() - 0.5) * 0.05, y + dh / 2, (r() - 0.5) * 0.05);
      blk.rotation.y = (r() - 0.5) * 0.035;
      g.add(blk);
      y += dh;
    }
    // the break: a last block knocked off square, so the top is not a cut
    if (h > 1.0) {
      const cap = this.#wallBox(W * 0.72, 0.46, W * 0.58, r);
      cap.position.set((r() - 0.5) * 0.35, y + 0.18, (r() - 0.5) * 0.35);
      cap.rotation.set((r() - 0.5) * 0.3, r() * 0.8, (r() - 0.5) * 0.26);
      g.add(cap);
    }
    // arch springing — two courses stepping out and up toward the neighbour.
    // A corbel is cheap and it is the one shape that says "an arch stood here".
    if (style === 'arch') {
      const dirX = -Math.sign(x);
      for (let k = 0; k < 3; k++) {
        const s = this.#wallBox(0.95 + k * 0.18, 0.4, 1.1, r);
        s.position.set(dirX * (0.7 + k * 0.42), y - 0.2 + k * 0.42, 0);
        s.rotation.z = dirX * (0.1 + k * 0.09);
        g.add(s);
      }
    }
    parent.add(g);
    this.#spoil(parent, x, z, 1.6 + r() * 0.5, 0.11, r);
    this.#debris(debris, x, z, LITE ? 4 : 10, 2.8, 0.2, 0.6, r);
    return g;
  }

  /** A patch of the original pavement, still lying where it was laid. Built out
   *  of three or four overlapping slabs at slightly different levels, because a
   *  single clean rectangle read as a modern patio. */
  #floorPatch(parent, x, z, w, d, r, debris) {
    const n = 3 + Math.floor(r() * 2);
    for (let i = 0; i < n; i++) {
      const sw = w * (0.4 + r() * 0.45), sd = d * (0.4 + r() * 0.45);
      const s = this.#paveSlab(sw, 0.2, sd, r, 0.7 + r() * 0.2);
      s.position.set(x + (r() - 0.5) * w * 0.55, 0.035 + r() * 0.03, z + (r() - 0.5) * d * 0.55);
      s.rotation.set((r() - 0.5) * 0.05, (r() - 0.5) * 0.5, (r() - 0.5) * 0.05);
      parent.add(s);
    }
    this.#spoil(parent, x, z, Math.max(w, d) * 0.5, 0.04, r);
    this.#debris(debris, x, z, LITE ? 3 : 7, Math.max(w, d) * 0.6, 0.14, 0.34, r, 0.35);
  }

  /**
   * The ruin is a BUILDING, not a pile.
   *
   * It used to be forty-six fragments spaced by angle around the board: every
   * piece the same visual weight, nothing shared between any two of them, and
   * the whole thing read as a fence rather than as somewhere. This lays out ONE
   * plan and puts the nine squares down on its floor — the fiction being that
   * the battle is fought in somebody else's wrecked temple, something a great
   * deal older than either army.
   *
   * The plan is a crossing: four piers on the diagonals of the board with
   * footings running between them, a door out to the west with the Void sitting
   * in it, and the east door still standing with its lintel on. Where the
   * pieces go is decided by the camera and the treeline, not by taste — see
   * #pier for why the crossing is exactly where it is.
   *
   * The pavement patches use the same flagstone texture as board.js's squares
   * on purpose: the nine squares should read as what is left of this floor.
   */
  #ruins() {
    const r = rand(9001);
    const ring = new THREE.Group();
    this.scene.add(ring);
    this.ruins = ring;

    const PX = 7.35;                 // crossing piers, on the diagonals
    const ZF = -7.6, ZN = 7.25;
    const near = [], far = [], east = [], west = [], out = [];

    /* --- the four crossing piers ----------------------------------------- */
    // Deliberately unequal. Four matching piers read as a intact tower; four
    // ruined four different ways is what lets a viewer work out the plan.
    // Height is set by the frustum, not by taste: at z = -7.6 the top edge of
    // the frame cuts everything over about 3.3 units, so the far pair are
    // stumps whatever the fiction says. The near pair have all the headroom.
    this.#pier(ring, PX, ZF, 3.05, 'arch', r, far);
    this.#pier(ring, -PX, ZF, 1.3, 'stump', r, far);
    this.#pier(ring, PX, ZN, 4.2, 'arch', r, near);
    this.#pier(ring, -PX, ZN, 2.95, 'lean', r, near);

    /* --- footings between them, with a door torn through the west --------- */
    this.#footRun(ring, 'x', -PX + 1.5, PX - 1.5, ZF, r, far, 0.82);
    this.#footRun(ring, 'x', PX - 1.5, -PX + 1.5, ZN, r, near, 0.42);
    this.#footRun(ring, 'z', ZF + 1.5, ZN - 1.5, PX, r, east, 0.55);
    // the west door. The Void square stands just inside it, which is the one
    // piece of the rules this arena gets to illustrate.
    this.#footRun(ring, 'z', ZF + 1.5, -3.5, -PX, r, west, 0.7);
    this.#footRun(ring, 'z', ZN - 1.5, 3.5, -PX, r, west, 0.55);
    for (const zz of [-3.1, 3.1]) {
      const jamb = this.#wallBox(1.7, 1.25 + r() * 0.5, 1.15, r);
      jamb.position.set(-PX, 0.42, zz);
      jamb.rotation.y = (r() - 0.5) * 0.08;
      ring.add(jamb);
      this.#spoil(ring, -PX, zz, 1.4, 0.08, r);
    }
    // The threshold, broken in two and settled apart. One clean rectangle of
    // pavement read as a sheet of paper dropped on the grass.
    for (const [zz, len] of [[-1.15, 2.0], [1.35, 1.7]]) {
      const sill = this.#paveSlab(1.8, 0.24, len, r, 0.78);
      sill.position.set(-PX + (r() - 0.5) * 0.2, 0.03, zz);
      sill.rotation.set((r() - 0.5) * 0.06, (r() - 0.5) * 0.1, (r() - 0.5) * 0.05);
      ring.add(sill);
    }

    /* --- the column that came down, lying where it fell ------------------- */
    // Drums, not a rod: it broke at its joints and rolled apart. It is the one
    // object on the field that says out loud what the uprights used to be.
    {
      // On open grass OUTSIDE the far footing and parallel to it, so it reads
      // as the shaft off the colonnade it belongs to. Lying inside the plan it
      // was dark drums on dark apron, hidden behind the footing itself.
      const fx = -9.8, fz = -10.0;
      const fall = new THREE.Group();
      fall.position.set(fx, 0, fz);
      fall.rotation.y = 0.12;
      let t = 0;
      for (let k = 0; k < 5; k++) {
        const dh = 0.68 + r() * 0.5;
        const d = this.#drumMesh(0.48, 0.51, dh, r);
        d.rotation.z = Math.PI / 2 + (r() - 0.5) * 0.14;
        d.rotation.y = (r() - 0.5) * 0.2;
        d.position.set(t + dh / 2, 0.38, (r() - 0.5) * 0.45);
        fall.add(d);
        t += dh + 0.1 + r() * 0.42;
      }
      ring.add(fall);
      this.#spoil(ring, fx + 2.0, fz - 0.3, 3.0, 0.06, r);
      this.#debris(far, fx + 2.0, fz - 0.4, LITE ? 4 : 12, 2.8, 0.16, 0.44, r);
    }

    /* --- the east door, still standing ------------------------------------ */
    // The tall piece goes east because the sun travels +x: the camera sees the
    // face that is lit, and the west end opposite silhouettes against it.
    {
      const EX = 11.9;
      const bay = new THREE.Group();
      bay.position.set(EX, 0, 0.3);

      // A stylobate with two steps down to the field. Steps are the cheapest
      // thing in the world that reads as ARCHITECTURE from a raised camera,
      // and the half-metre lift is what makes the door a landmark rather than
      // one more wall fragment.
      const plat = this.#wallBox(2.8, 0.56, 6.6, r, 1.0, 3.4);
      plat.position.set(0, 0.2, 0);
      bay.add(plat);
      for (const [dx, hh] of [[-1.85, 0.38], [-2.35, 0.2]]) {
        const st = this.#wallBox(0.56, hh, 4.2, r, 0.98, 3.4);
        st.position.set(dx, hh / 2 - 0.03, 0.1);
        st.rotation.y = (r() - 0.5) * 0.02;
        bay.add(st);
      }

      // THIN. The first arch here was built into a 1.3-unit-thick wall with
      // more wall on top of it, and from a camera pitched 52 degrees down the
      // whole thing read as a solid block: you look at the TOP of a doorway
      // from up here, never through it. A thin wall with a wide hole shows
      // grass through the opening, and an arch with nothing above it puts its
      // own curve on the skyline where the curve can actually be seen.
      const SILL = 0.48;                      // top of the stylobate
      const PH = 3.0;
      const HALF = 1.32;                      // half the door opening
      const T = 0.92;                         // wall thickness
      for (const zz of [-1, 1]) {
        const pier = this.#wallBox(T, PH, 1.3, r, 1.06);
        pier.position.set(0, SILL + PH / 2, zz * (HALF + 0.65));
        pier.rotation.y = (r() - 0.5) * 0.02;
        bay.add(pier);
        // impost: the course the arch springs off, stepped proud of the pier
        const imp = this.#wallBox(T + 0.2, 0.26, 1.5, r, 1.06);
        imp.position.set(0, SILL + PH + 0.13, zz * (HALF + 0.65));
        bay.add(imp);
      }

      // The arch, cut into voussoirs, kept COMPLETE: an arch missing its
      // keystone would not be standing at all, and "the arch survived, the wall
      // over it did not" is both true and the reason this piece is still here.
      const SPRING = SILL + PH + 0.26;
      const R = HALF + 0.38;
      const N = LITE ? 9 : 15;
      for (let i = 0; i < N; i++) {
        const th = (i + 0.5) * Math.PI / N;
        const v = this.#wallBox(T, 0.76, 0.34, r, 1.08, 5.0);
        v.position.set(0, SPRING + Math.sin(th) * R, Math.cos(th) * R);
        v.rotation.x = th - Math.PI / 2;
        bay.add(v);
      }
      // one block of the wall that stood over it, left on the south haunch
      const stub = this.#wallBox(T, 0.9, 1.5, r, 1.02);
      stub.position.set(-0.02, SPRING + R * 0.72, 1.5);
      stub.rotation.z = -0.02;
      bay.add(stub);

      // the springing of the NEXT arch along, snapped off — the cue that this
      // was one bay of an arcade and not a garden gate
      for (let i = 0; i < 3; i++) {
        const th = (i + 0.5) * Math.PI / N;
        const v = this.#wallBox(T, 0.72, 0.34, r, 0.96, 5.0);
        v.position.set(0, SPRING + Math.sin(th) * R, -4.0 - Math.cos(th) * R);
        v.rotation.x = -(th - Math.PI / 2);
        bay.add(v);
      }
      ring.add(bay);

      // the wall carries on north and south of the door, stepping down as it goes
      // Two stubs south, one north. Six of these turned the landmark into a
      // curtain wall and the door stopped being the thing you looked at.
      for (const [sgn, n] of [[1, 2], [-1, 1]]) {
        for (let k = 0; k < n; k++) {
          const h = 2.5 - k * 0.8 + (r() - 0.5) * 0.3;
          const w = this.#wallBox(0.95, h, 1.5 + r() * 0.4, r, 0.94);
          w.position.set(EX + (r() - 0.5) * 0.14, 0.3 + h / 2, 0.3 + sgn * (3.4 + k * 1.8));
          w.rotation.y = (r() - 0.5) * 0.06;
          ring.add(w);
        }
      }
      for (const zz of [-1.7, 1.7, 3.6, -3.2, 6.0, -5.6]) {
        this.#spoil(ring, EX + (r() - 0.5) * 0.8, zz, 1.5 + r() * 0.5, 0.09, r);
      }
      this.#debris(east, EX - 1.5, 0.3, LITE ? 5 : 14, 3.2, 0.2, 0.62, r);
      this.#debris(east, EX + 1.6, 3.4, LITE ? 4 : 10, 3.0, 0.2, 0.6, r);
      for (const [zz, len] of [[-0.95, 2.1], [1.55, 1.5]]) {
        const sill = this.#paveSlab(2.2, 0.22, len, r, 0.82);
        sill.position.set(EX - 1.7 + (r() - 0.5) * 0.3, 0.03, 0.3 + zz);
        sill.rotation.set((r() - 0.5) * 0.06, (r() - 0.5) * 0.12, (r() - 0.5) * 0.05);
        ring.add(sill);
      }
    }

    /* --- the west end, which came down in one piece ----------------------- */
    // Tipped outward and lying there, with the wall's own rubble fanned beyond
    // it. Two ends treated differently is what stops the plan reading as a box.
    {
      const WX = -12.2;
      const slab = this.#wallBox(3.6, 0.9, 4.8, r, 0.78);
      slab.position.set(WX - 0.6, 0.6, -2.0);
      slab.rotation.set(0.05, 0.2, 0.36);          // one edge still buried
      ring.add(slab);
      const slab2 = this.#wallBox(2.7, 0.75, 3.3, r, 0.78);
      slab2.position.set(WX + 0.4, 0.42, 2.9);
      slab2.rotation.set(-0.08, -0.32, -0.22);
      ring.add(slab2);
      // One finger of wall left standing. The sun travels +x, so this face is
      // the one in shadow: it is the dark vertical the composition needs
      // opposite the lit east door, and it is the only thing on the west side
      // tall enough to break the treeline.
      const finger = this.#wallBox(0.88, 4.4, 1.55, r, 0.78);
      finger.position.set(WX + 0.5, 2.1, 0.5);
      finger.rotation.set(0, 0.06, 0.05);
      ring.add(finger);
      const fingerCap = this.#wallBox(0.8, 0.55, 1.15, r, 0.78);
      fingerCap.position.set(WX + 0.36, 4.5, 0.15);
      fingerCap.rotation.set(0.1, 0.2, -0.18);
      ring.add(fingerCap);
      for (let k = 0; k < 3; k++) {
        const h = 1.2 + r() * 1.1;
        const w = this.#wallBox(1.25, h, 1.5, r, 0.78);
        w.position.set(WX + (r() - 0.5) * 0.3, 0.2 + h / 2, -5.4 - k * 1.6);
        w.rotation.y = (r() - 0.5) * 0.12;
        ring.add(w);
      }
      // The lintel off that wall, lying where it landed. A single long mass
      // reads from a camera this high better than any number of small props.
      const drop = this.#wallBox(4.6, 0.78, 1.15, r, 0.82);
      drop.position.set(WX + 2.0, 0.22, -6.4);
      drop.rotation.set(0.04, 0.62, -0.07);
      ring.add(drop);
      for (const zz of [-2.2, 2.6, -5.6, 5.4]) {
        this.#spoil(ring, WX + (r() - 0.5) * 1.4, zz, 1.7 + r() * 0.7, 0.09, r);
      }
      this.#debris(west, WX - 1.8, -1.4, LITE ? 6 : 17, 3.8, 0.2, 0.64, r);
      this.#debris(west, WX + 0.6, 4.4, LITE ? 4 : 9, 3.0, 0.18, 0.5, r);
    }

    /* --- what is left of the floor ---------------------------------------- */
    // Flat, ground level, half swallowed. From a camera this high a patch of
    // surviving pavement does more for "there was a building here" than another
    // upright would, and it costs three boxes.
    this.#floorPatch(ring, 5.4, -6.0, 3.6, 3.0, r, far);
    this.#floorPatch(ring, -5.6, 5.9, 3.4, 2.8, r, near);
    if (!LITE) this.#floorPatch(ring, 4.6, 6.1, 3.0, 2.6, r, near);
    if (!LITE) this.#floorPatch(ring, -10.5, -4.6, 3.2, 2.8, r, west);

    /* --- a few outliers, so the place does not stop at the wall ------------ */
    // Two loose pairs, not a ring: seven spaced by angle rebuilt the fence.
    const BEARINGS = [2.1, 2.5, 5.3, 5.8];
    const OUT = LITE ? 2 : 4;
    for (let i = 0; i < OUT; i++) {
      const a = BEARINGS[i] + (r() - 0.5) * 0.3;
      const d = 17 + r() * 11;
      const x = Math.cos(a) * d, z = Math.sin(a) * d * 0.9;
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.rotation.y = r() * 6.3;
      const len = 2 + Math.floor(r() * 3);
      for (let b = 0; b < len; b++) {
        const h = 0.6 + r() * 1.5 * (1 - b / (len + 1));
        const blk = this.#wallBox(1.3, h, 1.05, r, 0.72, 2.3);
        blk.position.set((b - len / 2) * 1.34, h / 2 - 0.17, (r() - 0.5) * 0.22);
        blk.rotation.z = (r() - 0.5) * 0.09;
        g.add(blk);
      }
      ring.add(g);
      this.#spoil(ring, x, z, 1.8, 0.07, r);
      this.#debris(out, x, z, 5, 1.8, 0.16, 0.42, r);
    }

    /* --- everything broken, in five batches -------------------------------- */
    // Broken masonry is angular. A dodecahedron is not: the first pass looked
    // like a heap of bread rolls piled at the foot of every wall.
    const chunkGeo = this.#tintFaces(
      this.#chunkGeo(new THREE.BoxGeometry(0.66, 0.4, 0.52), 0.2, rand(5150)),
      0x6e6250, 0xd0c2a6, 0x75803f, 0.3, rand(611));
    this.#instanceChunks(ring, 0, ZF, far, chunkGeo, 0.085, 0.105);
    this.#instanceChunks(ring, 0, ZN, near, chunkGeo, 0.085, 0.105);
    this.#instanceChunks(ring, 11.9, 0, east, chunkGeo, 0.08, 0.1);
    this.#instanceChunks(ring, -12.2, 0, west, chunkGeo, 0.08, 0.1);
    this.#instanceChunks(ring, 0, -20, out, chunkGeo, 0.075, 0.1);

    // Everything above was laid out on a flat y=0 plan, which is the only sane
    // way to write a floor plan; this drops each piece onto the field it
    // actually stands on. The instanced batches place themselves per chunk.
    for (const o of ring.children) {
      if (!o.isInstancedMesh) o.position.y += this.#gy(o.position.x, o.position.z);
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

  /* -------------------------------------------------------- treeline */

  /** Ground height under (x,z), mirroring the displacement #ground() applies. */
  #treeGroundY(x, z) {
    const roll = Math.sin(x * 0.08) * Math.cos(z * 0.07) * 1.5
               + Math.sin(x * 0.21 + 1.7) * 0.5;
    const flat = STEP * 3.1;
    const k = THREE.MathUtils.smoothstep(Math.max(Math.abs(x), Math.abs(z)), flat, flat + 16);
    return roll * k;
  }

  /**
   * Concatenate parts into one buffer. Written out by hand rather than pulled
   * from three/addons because the page has no build step and every import is
   * a live CDN fetch on someone's first load; this needs four attributes.
   */
  #treeMerge(parts) {
    let vn = 0, iN = 0;
    for (const g of parts) {
      vn += g.attributes.position.count;
      iN += g.index ? g.index.count : g.attributes.position.count;
    }
    const pos = new Float32Array(vn * 3);
    const nor = new Float32Array(vn * 3);
    const col = new Float32Array(vn * 3);
    const uv = new Float32Array(vn * 2);
    const idx = new Uint32Array(iN);
    let vo = 0, io = 0;
    for (const g of parts) {
      const p = g.attributes.position;
      pos.set(p.array, vo * 3);
      nor.set(g.attributes.normal.array, vo * 3);
      col.set(g.attributes.color.array, vo * 3);
      if (g.attributes.uv) uv.set(g.attributes.uv.array, vo * 2);
      const gi = g.index, n = gi ? gi.count : p.count;
      for (let i = 0; i < n; i++) idx[io + i] = (gi ? gi.getX(i) : i) + vo;
      vo += p.count; io += n;
      g.dispose();
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    out.setAttribute('color', new THREE.BufferAttribute(col, 3));
    out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    out.setIndex(new THREE.BufferAttribute(idx, 1));
    out.computeBoundingSphere();
    return out;
  }

  /** Bake a light multiplier into a part's colour attribute. */
  #treeShade(geo, fn) {
    const p = geo.attributes.position;
    const c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const v = fn(p.getX(i), p.getY(i), p.getZ(i));
      c[i * 3] = v[0]; c[i * 3 + 1] = v[1]; c[i * 3 + 2] = v[2];
    }
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
    return geo;
  }

  /** A tapered limb between two points: trunk sections, boughs, dead branches. */
  #treeLimb(ax, ay, az, bx, by, bz, r0, r1, seg = 5, capped = true) {
    const a = new THREE.Vector3(ax, ay, az);
    const d = new THREE.Vector3(bx - ax, by - ay, bz - az);
    const len = Math.max(d.length(), 1e-3);
    const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, !capped);
    const q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0), d.clone().divideScalar(len));
    g.applyMatrix4(new THREE.Matrix4().compose(
      a.addScaledVector(d, 0.5), q, new THREE.Vector3(1, 1, 1)));
    return g;
  }

  /**
   * One leaf clump. A low-poly SPHERE, not an icosahedron: three builds
   * icosahedra non-indexed, so every face carries its own normal and the
   * thing is hard-facetted whatever the material says — which is most of why
   * the old canopies read as green crystal. Vertices are pushed about by a
   * function of DIRECTION, because the sphere's seam holds duplicate vertices
   * and index-based noise tears a gash straight down it.
   */
  #treeClump(rad, rr, flat = 0.8) {
    const g = new THREE.SphereGeometry(1, 6, 4);
    const p = g.attributes.position;
    const a = rr() * 6.283, b = rr() * 6.283, c = rr() * 6.283;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const n = Math.sin(x * 4.1 + a) * Math.cos(y * 3.3 + b) * Math.sin(z * 3.9 + c);
      const s = rad * (1 + n * 0.30);
      p.setXYZ(i, x * s, y * s * flat, z * s);
    }
    g.computeVertexNormals();
    return g;
  }

  /**
   * One conifer tier: a cone whose skirt is cut into a ring of lobes and
   * drooped, so the spire is serrated in outline and reads as branch fans
   * from the fixed overhead camera rather than as a smooth party hat.
   */
  #treeTier(rad, h, rr, seg = 9) {
    const g = new THREE.ConeGeometry(rad, h, seg, 1, true);
    const p = g.attributes.position;
    const ph = rr() * 6.283;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y > -h * 0.49) continue;                 // apex row: leave it be
      const x = p.getX(i), z = p.getZ(i);
      const th = Math.atan2(z, x);
      // periodic in theta, or the duplicated seam vertex splits off
      const k = 0.56 + 0.36 * (0.5 + 0.5 * Math.cos(th * seg))
              + 0.22 * (0.5 + 0.5 * Math.cos(th * 3 + ph));
      p.setXYZ(i, x * k, y - h * 0.16 * k, z * k);
    }
    g.computeVertexNormals();
    return g;
  }

  /**
   * Build one tree in local space, y = 0 at the grass. Bark and leaf parts
   * come back separately because each becomes its own InstancedMesh — that is
   * what lets a tree have its own bark tone and its own leaf tone while still
   * costing one draw call for the whole band.
   */
  #treeModel(base, lo, rr) {
    const seg = lo ? 4 : 6;
    const bark = [], leaf = [];

    if (base === 'fir' || base === 'firS') {
      const squat = base === 'firS';
      // 5:1 tall-to-wide made a spike, not a fir — the inner band is scaled
      // down to about 0.45 and a narrow model there reads as a green dart.
      const h = squat ? 5.2 : 7.0;
      const R = squat ? 2.4 : 1.95;
      const tiers = lo ? 5 : (squat ? 7 : 9);
      bark.push(this.#treeLimb(0, -0.8, 0, 0, h * 0.88, 0, 0.34, 0.05, seg));
      const y0 = h * 0.14, y1 = h * 0.96;
      for (let k = 0; k < tiers; k++) {
        const u = k / (tiers - 1);
        const rad = R * ((1 - u) ** 1.2) * (0.86 + rr() * 0.26) + R * 0.05;
        const th = ((y1 - y0) / tiers) * (lo ? 2.4 : 2.0);
        const yk = y0 + (y1 - y0) * u;
        const g = this.#treeTier(rad, th, rr, lo ? 6 : 9);
        g.translate((rr() - 0.5) * 0.16, yk + th * 0.26, (rr() - 0.5) * 0.16);
        leaf.push(g);
        // Lobing the cone's base ring was not enough on its own: a cone with
        // one height segment has straight sides, so from the frame edge it is
        // still a clean triangle however ragged its footprint. These are the
        // branch tips that break that line — and they have to sit ON the
        // drooping rim. At 0.34 to 0.8 of the tier radius they were inside
        // the cone's own volume and did precisely nothing.
        for (let b = 0; b < (lo ? 2 : 3); b++) {
          const a2 = rr() * 6.283, out = rad * (0.80 + rr() * 0.38);
          const c = this.#treeClump(rad * (0.20 + rr() * 0.15), rr, 0.58);
          c.translate(Math.cos(a2) * out, yk - th * 0.26 + (rr() - 0.5) * th * 0.22,
                      Math.sin(a2) * out);
          leaf.push(c);
        }
      }
    }

    if (base === 'oak' || base === 'beech') {
      const wide = base === 'oak';
      const h = wide ? 6.0 : 7.4;
      const R = wide ? 3.0 : 2.1;
      const crown = h * (wide ? 0.70 : 0.78);
      const lean = (rr() - 0.5) * 0.9;
      const mid = crown * 0.52;
      bark.push(this.#treeLimb(0, -0.8, 0, lean * 0.28, mid, lean * 0.1, 0.42, 0.26, seg));
      bark.push(this.#treeLimb(lean * 0.28, mid, lean * 0.1, lean, crown * 0.88, lean * 0.4,
        0.26, 0.15, seg));
      const subs = lo ? 3 : 6;
      for (let k = 0; k < subs; k++) {
        const a = (k / subs) * 6.283 + rr() * 0.9;
        const d = R * (0.40 + rr() * 0.42);
        const cx = lean + Math.cos(a) * d, cz = lean * 0.4 + Math.sin(a) * d;
        const cy = crown + (rr() - 0.45) * h * 0.22;
        if (!lo) {
          bark.push(this.#treeLimb(lean * 0.5, crown * 0.64, lean * 0.2,
            cx * 0.82, cy * 0.92, cz * 0.82, 0.15, 0.05, 4));
        }
        // Small clumps, many of them, packed. The first pass used five fat
        // ones per bough at R*0.3 and the crown came out as a pile of
        // potatoes: three lobes across the whole tree, each with a hard
        // rounded edge. The grain of the silhouette has to be finer than the
        // tree, or the eye reads the lobes as the object.
        for (let b = 0; b < (lo ? 3 : 6); b++) {
          const g = this.#treeClump(R * (0.10 + rr() * 0.18), rr, 0.78);
          g.translate(cx + (rr() - 0.5) * d * 0.62,
                      cy + (rr() - 0.5) * R * 0.34,
                      cz + (rr() - 0.5) * d * 0.62);
          leaf.push(g);
        }
      }
      // the middle of the crown, or the tree is a ring of separate bushes
      for (let b = 0; b < (lo ? 2 : 5); b++) {
        const g = this.#treeClump(R * (0.20 + rr() * 0.12), rr, 0.72);
        g.translate(lean + (rr() - 0.5) * R * 0.5, crown + (rr() - 0.35) * R * 0.34,
                    (rr() - 0.5) * R * 0.5);
        leaf.push(g);
      }
      // sprigs standing proud of the mass, so the outline is never a closed
      // curve — a canopy that ends on a clean arc looks moulded
      if (!lo) {
        for (let b = 0; b < 5; b++) {
          // kept INSIDE the mass: pushed out to the full crown radius they
          // came off the tree and hung in the air as loose green pebbles
          const a = rr() * 6.283, dd = R * (0.36 + rr() * 0.32);
          const g = this.#treeClump(R * (0.08 + rr() * 0.07), rr, 0.85);
          g.translate(lean + Math.cos(a) * dd, crown + (rr() - 0.3) * R * 0.55,
                      Math.sin(a) * dd);
          leaf.push(g);
        }
      }
    }

    if (base === 'snag') {
      // Dead standing timber: the one silhouette that is nothing but branch,
      // and the reason the ring reads as an old place rather than a hedge.
      const h = 5.6;
      const lean = (rr() - 0.5) * 1.5;
      bark.push(this.#treeLimb(0, -0.8, 0, lean, h, lean * 0.3, 0.38, 0.11, seg));
      for (let k = 0; k < (lo ? 2 : 4); k++) {            // splintered crown
        const a = rr() * 6.283, t = 0.20 + rr() * 0.60;
        bark.push(this.#treeLimb(lean, h * 0.92, lean * 0.3,
          lean + Math.cos(a) * 0.22, h + t, lean * 0.3 + Math.sin(a) * 0.22,
          0.07, 0.012, 3));
      }
      for (let k = 0; k < (lo ? 3 : 6); k++) {
        const a = rr() * 6.283;
        const y = h * (0.32 + rr() * 0.52);
        const L = 0.9 + rr() * 1.7;
        const ux = Math.cos(a), uz = Math.sin(a);
        const tx = lean * 0.6 + ux * L, ty = y + L * (0.15 + rr() * 0.7), tz = uz * L;
        bark.push(this.#treeLimb(lean * 0.6, y, lean * 0.2, tx, ty, tz, 0.13, 0.03, 4));
        if (!lo && rr() < 0.55) {
          bark.push(this.#treeLimb(lean * 0.6 + ux * L * 0.55, y + (ty - y) * 0.55, uz * L * 0.55,
            tx + (rr() - 0.5), ty + 0.45 + rr() * 0.7, tz + (rr() - 0.5), 0.06, 0.015, 3));
        }
      }
    }

    if (base === 'scrub') {
      for (let k = 0; k < (lo ? 4 : 8); k++) {
        const a = rr() * 6.283, d = Math.sqrt(rr());
        const g = this.#treeClump(0.34 + rr() * 0.30, rr, 0.70);
        g.translate(Math.cos(a) * d, 0.22 + rr() * 0.46, Math.sin(a) * d);
        leaf.push(g);
      }
    }

    if (base === 'log') {
      const L = 3.6;
      bark.push(this.#treeLimb(-L / 2, 0.34, -0.2, L / 2, 0.26, 0.3, 0.36, 0.19, 6));
      bark.push(this.#treeLimb(L * 0.36, 0.28, 0.22, L * 0.62, 1.0, 0.7, 0.11, 0.025, 4));
      bark.push(this.#treeLimb(-L * 0.18, 0.36, -0.1, -L * 0.3, 1.05, -0.8, 0.10, 0.02, 4));
      const plate = new THREE.CylinderGeometry(0.95, 0.72, 0.26, 7);   // torn root disc
      plate.rotateZ(Math.PI * 0.46);
      plate.translate(-L / 2 - 0.12, 0.62, -0.2);
      bark.push(plate);
    }

    // A root mound over the seam where the trunk meets the grass. The ground
    // plane is only tessellated every 1.5 units (6.5 in ?lite=1), so an
    // analytic height sample is out by a tenth of a unit or more; the mound
    // covers the gap either way and gives the trunk a foot instead of a cut.
    if (base !== 'scrub' && base !== 'log') {
      const mound = new THREE.ConeGeometry(1.25, 1.0, lo ? 6 : 8);
      mound.translate(0, -0.05, 0);
      bark.push(mound);

      // Leaf litter around the foot. Without it a trunk stands on bright
      // grass texture and the whole ring looks planted on a lawn. A shallow
      // DOME, not a flat disc: the rim dips under the turf, so it never
      // z-fights the ground and never floats when the field rolls.
      const litter = new THREE.CircleGeometry(1.9, lo ? 8 : 11);
      litter.rotateX(-Math.PI / 2);
      const lp = litter.attributes.position;
      for (let i = 0; i < lp.count; i++) {
        const q = Math.hypot(lp.getX(i), lp.getZ(i)) / 1.9;
        lp.setY(i, 0.14 - q * q * 0.52);
      }
      litter.computeVertexNormals();
      bark.push(litter);
    }

    // Bake the light in. This is the whole trick: a canopy lit only by the
    // scene's lights is a painted lump, because every clump in it gets the
    // same treatment. Dark inside and underneath, bright and warm on the
    // crown, plus a per-clump brightness jitter that mottles the mass for
    // free — no texture, no extra draw, nothing sampled at runtime.
    const bb = new THREE.Box3();
    for (const g of leaf) { g.computeBoundingBox(); bb.union(g.boundingBox); }
    const ly0 = bb.min.y, ly1 = Math.max(bb.max.y, bb.min.y + 0.001);
    const lcx = (bb.min.x + bb.max.x) / 2, lcz = (bb.min.z + bb.max.z) / 2;
    const lr = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) / 2 + 0.001;
    for (const g of leaf) {
      const jit = 0.72 + rr() * 0.52;
      this.#treeShade(g, (x, y, z) => {
        const u = THREE.MathUtils.clamp((y - ly0) / (ly1 - ly0), 0, 1);
        const o = Math.min(Math.hypot(x - lcx, z - lcz) / lr, 1);
        // a fine mottle INSIDE each clump as well as between them: without it
        // every clump is one flat green and the mass reads as moulded plastic
        const grain = 1 + 0.17 * Math.sin(x * 8.7) * Math.cos(z * 7.9) * Math.sin(y * 6.3 + 1.1);
        const k = THREE.MathUtils.clamp(
          (0.18 + 0.74 * u ** 0.9) * (0.80 + 0.32 * o) * jit * grain, 0.12, 1.04);
        return [k * (1 + 0.10 * u), k, k * (0.92 - 0.14 * u + 0.16 * (1 - u))];
      });
    }
    for (const g of bark) {
      const jit = 0.88 + rr() * 0.24;
      this.#treeShade(g, (x, y) => {
        const k = THREE.MathUtils.clamp(
          (0.34 + 0.54 * THREE.MathUtils.clamp(y / 4, 0, 1)) * jit, 0.18, 1.0);
        return [k * 1.06, k, k * 0.86];
      });
    }
    return { bark, leaf };
  }

  /**
   * The forest ring. What was here before was 120 copies of a single model —
   * a six-sided cylinder with two or three flat-shaded icosahedra stuck on
   * top. At this camera that reads as green crystals on sticks: faceting is a
   * MINERAL cue, every tree carried the same silhouette, and each one was
   * parked at a fixed y while the ground under it rolls by a couple of units,
   * so half of them stood on invisible stilts and the rest were buried.
   *
   * The rebuild leans on the only three things that survive to the screen
   * here: silhouette, variety of silhouette, and the tree meeting the ground.
   *
   *  - seven models (two conifers, two broadleaves, a dead snag, scrub,
   *    fallen logs), each built from more than one seed so one model gives
   *    two different trees, and every instance gets its own lean, yaw, height
   *    and width;
   *  - canopies are clusters of small lumpy clumps, never one solid, so the
   *    OUTLINE is broken at a scale still several pixels wide in the near
   *    ring and averaging into a soft mass in the far one;
   *  - shading baked into vertex colours (see #treeModel) rather than bought
   *    with more lights;
   *  - trunks bedded with #ground()'s own height function, with a root mound
   *    over the seam;
   *  - three distance bands: a sparse near ring you can see between, a middle
   *    band, and a dense outer wall that closes off the top of the frame. The
   *    far bands get a cheaper model and cast no shadow — the sun's shadow
   *    box is only 18 units wide, so nothing out there could cast one anyway.
   *
   * Cost: ~370 trees, snags, scrub and logs in 29 InstancedMesh draws, ten of
   * which cast. The old loop spent about 420 draws on 120 trees.
   */
  #treeline() {
    const r = rand(404);
    const barkMat = new THREE.MeshStandardMaterial({
      map: woodTexture(2, 24), roughness: 1, vertexColors: true,
    });
    const leafMat = new THREE.MeshStandardMaterial({ roughness: 0.95, vertexColors: true });

    // ---- where they stand ------------------------------------------
    const KEEP = STEP * 3.25;              // clear of the apron and the ruin ring
    const spots = [];
    const sow = (n, d0, d1, gap, tier) => {
      for (let i = 0, guard = 0; i < n && guard < n * 40; guard++) {
        const a = r() * Math.PI * 2;
        const d = Math.sqrt(d0 * d0 + (d1 * d1 - d0 * d0) * r());   // area-uniform
        const x = Math.cos(a) * d, z = Math.sin(a) * d;
        if (Math.max(Math.abs(x), Math.abs(z)) < KEEP) continue;
        let ok = true;
        for (let k = 0; k < spots.length; k++) {
          const dx = spots[k].x - x, dz = spots[k].z - z;
          if (dx * dx + dz * dz < gap * gap) { ok = false; break; }
        }
        if (!ok) continue;
        spots.push({ x, z, d, tier });
        i++;
      }
    };
    // A probe of the real frame (project a ring of points at each radius
    // through the live camera) says only r = 8.5 to about 24 ever reaches the
    // screen at this fixed pitch — a 40-degree vertical FOV aimed 52 degrees
    // down runs out of ground 31 units from the eye. So the density goes
    // where it is seen; the outer bands are thin and cheap and exist for the
    // shots that pull back.
    // ?lite=1 can carry more than it used to: instancing means its cost is
    // draw calls, and 26 hand-built trees used to be ~90 of those where 110
    // instanced ones are about two dozen.
    sow(LITE ? 34 : 54, KEEP + 0.5, 16, 2.1, 0);
    sow(LITE ? 70 : 118, 15, 27, 1.95, 1);
    sow(LITE ? 26 : 70, 26, 42, 2.2, 2);
    sow(LITE ? 18 : 46, 40, 58, 2.4, 2);

    // Scrub and deadfall at the feet of the trunks, or the treeline is a row
    // of stilts with daylight under it — which is what the old one was.
    const extras = [];
    const host = (pool) => pool[Math.floor(r() * pool.length)];
    const near = spots.filter((s) => s.tier === 0);
    for (let i = 0; i < (LITE ? 26 : 78); i++) {
      const h = host(spots);
      const a = r() * Math.PI * 2, d = 0.7 + r() * 3.2;
      const x = h.x + Math.cos(a) * d, z = h.z + Math.sin(a) * d;
      if (Math.max(Math.abs(x), Math.abs(z)) < KEEP - 0.8) continue;
      extras.push({ x, z, d: Math.hypot(x, z), kind: 'scrub' });
    }
    for (let i = 0; near.length && i < (LITE ? 3 : 12); i++) {
      const h = host(near);
      const a = r() * Math.PI * 2, d = 1.8 + r() * 3.4;
      const x = h.x + Math.cos(a) * d, z = h.z + Math.sin(a) * d;
      if (Math.max(Math.abs(x), Math.abs(z)) < KEEP - 0.4) continue;
      extras.push({ x, z, d: Math.hypot(x, z), kind: 'log' });
    }

    // ---- which model each one uses ---------------------------------
    // Bucket -> [model, cheap model?, casts shadow?]. Buckets sharing a model
    // differ only by seed, which buys a second silhouette for the price of
    // one more draw call. Only the inner band casts: the sun's shadow box is
    // 18 units across, so a shadow from anything further out is thrown at
    // ground that is not in the map.
    const KIT = {
      fir1: ['fir', 0, 1], firS: ['firS', 0, 1], oak1: ['oak', 0, 1],
      beech: ['beech', 0, 1], snag1: ['snag', 0, 1], log: ['log', 0, 1],
      fir2: ['fir', 0, 0], firS2: ['firS', 0, 0], oak2: ['oak', 0, 0],
      beech2: ['beech', 0, 0], snag2: ['snag', 0, 0], scrub: ['scrub', 0, 0],
      firD: ['fir', 1, 0], firE: ['fir', 1, 0], oakD: ['oak', 1, 0],
      beechD: ['beech', 1, 0], snagD: ['snag', 1, 0],
    };
    const SLIM = { slim: 'beech', slim2: 'beech2' };   // a birch is a thin beech
    const PICK = [
      LITE ? ['fir1', 'firS', 'oak1', 'beech', 'slim', 'snag1']
           : ['fir1', 'firS', 'firS', 'oak1', 'oak1', 'beech', 'slim', 'snag1'],
      LITE ? ['fir2', 'oak2', 'beech2', 'snag2']
           : ['fir2', 'fir2', 'firS2', 'oak2', 'oak2', 'beech2', 'slim2', 'snag2'],
      LITE ? ['firD', 'firD', 'oakD', 'snagD']
           : ['firD', 'firD', 'firE', 'oakD', 'oakD', 'beechD', 'snagD'],
    ];

    const LEAF = [0x39481f, 0x2e3c1d, 0x25331a, 0x414d26, 0x2a3618, 0x1e2a14];
    // Turning leaves, but MUCH further down than they look on a swatch: the
    // first try used 0x6d5324 and with ACES and the warm key on top of it a
    // near tree came out as an orange fireball a quarter of the frame wide.
    const AUTUMN = [0x3a2d15, 0x453518];
    const NEEDLE = [0x2c3f2a, 0x33472c, 0x263a26, 0x3a4c2e];
    const BARK = [0xc4b39b, 0xb5a189, 0xd2c1a8];  // warmed: neutral goes lavender here

    const buckets = new Map();
    const UP = new THREE.Vector3(0, 1, 0);
    const axis = new THREE.Vector3(), qy = new THREE.Quaternion(), qt = new THREE.Quaternion();
    const pv = new THREE.Vector3(), sv = new THREE.Vector3();

    const plant = (s, kind) => {
      const slim = !!SLIM[kind];
      const name = SLIM[kind] || kind;
      const conifer = KIT[name][0].startsWith('fir');
      const dead = KIT[name][0] === 'snag';
      // Size grows with distance. Full-height trees at the inner edge of the
      // ring loomed over the board — an eight-metre crown nine units out is
      // closer to the camera than the board is, and it swallowed a quarter of
      // the frame. Saplings and scrub at the edge, mature timber behind them,
      // which is also how a real wood meets a clearing.
      const grow = 0.44 + 0.62 * THREE.MathUtils.clamp((s.d - 8.5) / 11, 0, 1);
      let sy = grow * (0.84 + r() * 0.52);
      let sw = grow * (0.88 + r() * 0.40);
      if (slim) { sy *= 1.25; sw *= 0.50; }
      if (kind === 'scrub') { sy = 0.70 + r() * 0.90; sw = 0.80 + r() * 0.95; }
      if (kind === 'log') { sy = 0.80 + r() * 0.50; sw = 0.80 + r() * 0.50; }
      const tilt = (r() - 0.5) * (dead ? 0.28 : 0.14);
      axis.set(Math.cos(r() * 6.283), 0, Math.sin(r() * 6.283));
      qy.setFromAxisAngle(UP, r() * 6.283);
      qt.setFromAxisAngle(axis, tilt);
      qy.premultiply(qt);
      pv.set(s.x, this.#treeGroundY(s.x, s.z), s.z);
      sv.set(sw, sy, sw);

      // Aerial depth by hand: the outer band starts darker so FogExp2 lifts it
      // back to a dusk blue instead of leaving a bright green wall up there.
      const dim = 1 - 0.32 * THREE.MathUtils.clamp((s.d - 18) / 38, 0, 1);
      const pal = conifer ? NEEDLE : (r() < 0.06 ? AUTUMN : LEAF);
      // Wide, because a treeline of one value is a wall. Some crowns want to
      // be nearly black and a few want to have caught the last of the sun.
      const leaf = new THREE.Color(pal[Math.floor(r() * pal.length)])
        .multiplyScalar(dim * (0.72 + r() * 0.56));
      const wood = new THREE.Color(dead ? 0xa9a396 : slim ? 0xe0d6c4
        : BARK[Math.floor(r() * BARK.length)]).multiplyScalar(dim * (0.88 + r() * 0.24));

      if (!buckets.has(name)) buckets.set(name, []);
      buckets.get(name).push({
        m: new THREE.Matrix4().compose(pv, qy, sv), leaf, bark: wood,
      });
    };

    for (const s of spots) {
      const pool = PICK[s.tier];
      plant(s, pool[Math.floor(r() * pool.length)]);
    }
    for (const e of extras) plant(e, e.kind);

    // ---- one InstancedMesh per bucket per material -------------------
    let seed = 601;
    for (const [name, list] of buckets) {
      const [model, lo, shade] = KIT[name];
      const parts = this.#treeModel(model, lo, rand(seed += 137));
      const solid = !!shade;
      for (const which of ['bark', 'leaf']) {
        if (!parts[which].length) continue;
        const im = new THREE.InstancedMesh(this.#treeMerge(parts[which]),
          which === 'bark' ? barkMat : leafMat, list.length);
        im.castShadow = solid;
        im.receiveShadow = solid;
        for (let i = 0; i < list.length; i++) {
          im.setMatrixAt(i, list[i].m);
          im.setColorAt(i, list[i][which]);
        }
        im.instanceMatrix.needsUpdate = true;
        im.instanceColor.needsUpdate = true;
        this.scene.add(im);
      }
    }
  }

  /** Drop a stone until its lowest vertex is under the turf. Real vertices,
   *  not the bounding box: a box corner on a tumbled rock is nowhere near the
   *  rock, and bedding by the box left everything hovering. */
  #bed(mesh, sink) {
    mesh.updateMatrix();
    const pos = mesh.geometry.attributes.position;
    const v = new THREE.Vector3();
    let lo = Infinity;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrix);
      if (v.y < lo) lo = v.y;
    }
    mesh.position.y += -lo - sink + this.#gy(mesh.position.x, mesh.position.z);
    mesh.updateMatrix();
  }

  /** One shared geometry for every chip of gravel on the field. */
  #gritGeo() {
    if (!this.gritGeometry) {
      this.gritGeometry = this.#tintFaces(
        this.#chunkGeo(new THREE.OctahedronGeometry(0.42, 0), 0.16, rand(3307)),
        0x655a4a, 0xc4b79c, 0x707a40, 0.3, rand(919));
    }
    return this.gritGeometry;
  }

  /**
   * Rocks.
   *
   * There used to be forty of these: one DodecahedronGeometry, one flat
   * 0x6d6459 material, random rotation and scale, spaced by angle. That is the
   * recipe for forty of the SAME lump stamped round the field, and it was the
   * loudest unfinished thing out there. Three different stones now, each
   * placed for a reason:
   *
   *  - BEDROCK, broken through the turf in clusters that share one bedding
   *    angle, because an outcrop is one rock and one rock tilts one way. That
   *    shared angle is the entire difference between an outcrop and a spill.
   *  - FIELD STONE, rounded boulders in loose pairs out in the grass.
   *  - DRESSED stone, square-cut blocks fanned outward from the ruin's walls on
   *    the side each one fell. These are what tie the two subjects together,
   *    and they are the reason a viewer can tell which way the hall came down.
   *
   * Everything is bedded below y=0 and sits in a mound of its own spoil, and
   * the colour is carried by per-facet vertex tint rather than by the material,
   * so stones cut from one geometry still read as different rock.
   */
  #rocks() {
    const r = rand(77);
    const M = this.#stoneMats();
    const grit = [];

    // Keep clear of the play area, and of the crossing the ruins lay out, or
    // the rocks end up standing in the doorways.
    const blocked = (x, z) => Math.hypot(x, z * 0.95) < 9.1
      || (Math.abs(x) < 9.2 && z > -9.4 && z < 9.0)
      || (Math.abs(x - 11.9) < 3.4 && Math.abs(z) < 7.2)
      || (Math.abs(x + 12.2) < 3.4 && Math.abs(z) < 7.2);
    // Only radius 8.5 to 24 ever reaches the screen at the play camera's fixed
    // 52 degree pitch and 40 degree vertical FOV, so scatter beyond that is
    // geometry nobody sees. Everything here is placed inside that band.
    const taken = [];
    const site = (lo, hi) => {
      for (let k = 0; k < 80; k++) {
        const a = r() * Math.PI * 2, d = lo + r() * (hi - lo);
        const x = Math.cos(a) * d, z = Math.sin(a) * d * 0.92;
        if (blocked(x, z)) continue;
        // keep clusters apart, or the rejection sampler quietly bunches them
        // into one heap on whichever bearing happened to be clear
        if (taken.some((t) => Math.hypot(t[0] - x, t[1] - z) < 5.2)) continue;
        taken.push([x, z]);
        return [x, z];
      }
      return null;
    };

    // low, high, moss. `high` is what the camera mostly looks at, so it is
    // pushed well up: a rock tinted to its own true colour reads as a hole.
    const PAL = {
      granite: [0x5d5648, 0xcfc2a6, 0x8a9450],
      iron: [0x53412f, 0xbe9d70, 0x7d8a45],
      pale: [0x7a7060, 0xe2d6b8, 0x939c55],
      dark: [0x413b32, 0xa49a87, 0x7b8546],
    };
    const gravel = (x, z, n, rad, lo, hi) => {
      this.#debris(grit, x, z, n, rad, lo, hi, r, 0.35);
      this.#instanceChunks(this.scene, x, z, grit.splice(0), this.#gritGeo(), 0.075, 0.1);
    };

    /* --- bedrock: clusters sharing one bedding plane ---------------------- */
    // An earlier pass forced two outcrops into the corner pockets right beside
    // the board to guarantee they were in frame. They landed on the dirt apron,
    // dark rock on dark earth, and disappeared — and bedrock breaking through
    // the floor of a building is wrong anyway. They live outside the ruin now.
    const slabBase = new THREE.BoxGeometry(1.9, 0.72, 1.35, 2, 1, 2);
    for (let c = 0; c < (LITE ? 3 : 6); c++) {
      const p = site(10.5, 20);
      if (!p) continue;
      const tilt = (r() - 0.5) * 0.4, roll = (r() - 0.5) * 0.3, face = r() * 6.3;
      const pal = r() < 0.5 ? PAL.granite : PAL.dark;
      const n = 3 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const geo = this.#tintFaces(this.#chunkGeo(slabBase.clone(), 0.38, r, 2.2),
          pal[0], pal[1], pal[2], 0.5, r);
        const m = new THREE.Mesh(geo, M.stone);
        m.scale.set(0.62 + r() * 0.85, 0.42 + r() * 0.6, 0.62 + r() * 0.8);
        m.rotation.set(tilt + (r() - 0.5) * 0.12, face + (r() - 0.5) * 0.5, roll + (r() - 0.5) * 0.12);
        const a = r() * 6.3, d = Math.sqrt(r()) * (1.3 + n * 0.35);
        m.position.set(p[0] + Math.cos(a) * d, 0, p[1] + Math.sin(a) * d);
        this.#bed(m, 0.16 + r() * 0.3);
        m.castShadow = m.receiveShadow = true;
        this.scene.add(m);
      }
      this.#spoil(this.scene, p[0], p[1], 2.3, 0.06, r);
      gravel(p[0], p[1], LITE ? 5 : 12, 3.2, 0.11, 0.3);
    }

    /* --- field stone: rounded boulders in loose pairs ---------------------- */
    const boulderBase = new THREE.IcosahedronGeometry(0.78, 1);
    for (let c = 0; c < (LITE ? 4 : 10); c++) {
      const p = site(10, 19);
      if (!p) continue;
      const pal = r() < 0.5 ? PAL.iron : PAL.granite;
      const n = 1 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const geo = this.#tintFaces(this.#chunkGeo(boulderBase.clone(), 0.3, r, 2.6),
          pal[0], pal[1], pal[2], 0.7, r);
        const m = new THREE.Mesh(geo, M.stone);
        const s = 0.36 + r() * 0.52;
        m.scale.set(s * (0.85 + r() * 0.4), s * (0.6 + r() * 0.5), s * (0.85 + r() * 0.4));
        // yaw freely, tilt only a little: see #debris for why
        m.rotation.set((r() - 0.5) * 0.5, r() * 6.3, (r() - 0.5) * 0.5);
        const a = r() * 6.3, d = Math.sqrt(r()) * 1.9;
        m.position.set(p[0] + Math.cos(a) * d, 0, p[1] + Math.sin(a) * d);
        this.#bed(m, 0.12 + r() * 0.26);
        m.castShadow = m.receiveShadow = true;
        this.scene.add(m);
      }
      this.#spoil(this.scene, p[0], p[1], 1.5 + r() * 0.8, 0.05, r);
      gravel(p[0], p[1], LITE ? 4 : 7, 2.2, 0.1, 0.26);
    }

    /* --- dressed stone, fanned out from the wall it fell off ---------------- */
    // Direction matters far more than count here: the blocks trail AWAY from
    // each wall line, so the fan itself tells you which way that side went.
    const fans = [[-13.6, -2.4, -1, 0], [-13.4, 3.6, -1, 0], [13.9, 4.4, 1, 0],
      [3.2, -9.8, 0, -1], [-6.4, 9.3, 0, 1]];
    for (const f of fans) {
      const n = LITE ? 2 : 3 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const out = 0.6 + ((i + r()) / n) * 4.0;
        const w = 0.6 + r() * 0.8, h = 0.45 + r() * 0.55, d = 0.55 + r() * 0.85;
        const m = this.#wallBox(w, h, d, r, 0.85);
        m.rotation.set((r() - 0.5) * 0.9, r() * 6.3, (r() - 0.5) * 0.9);
        m.position.set(f[0] + f[2] * out + (r() - 0.5) * 2.2, 0,
          f[1] + f[3] * out + (r() - 0.5) * 2.2);
        this.#bed(m, 0.09 + r() * 0.18);
        this.scene.add(m);
      }
      this.#spoil(this.scene, f[0] + f[2] * 1.5, f[1] + f[3] * 1.5, 1.8, 0.05, r);
      gravel(f[0] + f[2] * 1.6, f[1] + f[3] * 1.6, LITE ? 3 : 9, 2.4, 0.1, 0.28);
    }

    slabBase.dispose();
    boulderBase.dispose();
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
