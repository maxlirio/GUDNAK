// The battlefield the nine squares sit in: ground, strongholds, scenery,
// weather and light. Everything here is decoration — board.js owns the grid
// and nothing in this file knows the rules.

import * as THREE from 'three';
import { grassTexture, woodTexture, dirtTexture, blobTexture, stoneTexture,
  ashlarTexture, rockTexture, apronTexture,
  duskSkyTexture, mistTexture, veilTexture, flameTexture } from './textures.js';

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
    // The sun is the arena's key light, so the sky has to be built around the
    // same azimuth or the warmth in the frame comes from nowhere. The key
    // stands at (-24, 27, 17); SphereGeometry lays phi out so that a world
    // bearing of atan2(x, z) lands at u = (atan2(x,z) + PI/2) / 2PI, which for
    // this sun is 0.098.
    //
    // Worth knowing before spending time in here: at the play camera the sky
    // IS NOT VISIBLE. The lens sits 19.4 up and pitches 52 degrees down, so
    // the top of the frame is still 31 degrees below the horizon and the far
    // edge of the picture is ground about thirteen units out. This sky is for
    // the ending, whose camera drops to head height, and for the day somebody
    // lifts the seat. That is also why the AIR does the work the sky would
    // normally do in a frame like this — see #haze().
    const sky = new THREE.Mesh(
      // 24x16 segments put the widest quad about fifteen degrees across, which
      // was enough for a four-stop gradient and is not enough for a sky with
      // a sun in it: the glow came out as a faceted lozenge.
      new THREE.SphereGeometry(180, 48, 32),
      new THREE.MeshBasicMaterial({
        map: duskSkyTexture(0.098), side: THREE.BackSide, fog: false,
      }),
    );
    this.scene.add(sky);

    // Fog is nearly powerless at this camera and it is important to know why
    // before reaching for it: the whole visible field is 25 to 40 units from
    // the lens, so exp2 fog that is 6% over the board is only 10% at the top
    // of the frame. Winding the density up far enough to separate them puts
    // that same veil straight onto the cards. So the density is left where 22
    // tuned effects and the ending's own ramp (+0.0225) expect it, and only
    // the COLOUR moves: from a pale grey-lavender that lifted the far trees
    // toward daylight, to a dusk violet that lets them sink.
    this.scene.fog = new THREE.FogExp2(0x4d4762, 0.0095);
  }

  /* -------------------------------------------------------- ground */

  #ground() {
    // A big rolling field. Vertices are nudged so the horizon is not a ruler
    // line, but the arena footprint is flattened so the squares sit true.
    //
    // The loop below is LOAD-BEARING FOR OTHER PEOPLE'S WORK and is left
    // exactly as it was on purpose. #gy() beds the ruins, the rocks and every
    // tree by sampling THESE vertices, so changing the formula, the segment
    // count or the seed moves a few hundred objects that were placed against
    // it — blocks with daylight under them, trunks sunk to the knee. All the
    // work below is colour, cover and a new surface laid ON this field.
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
    this.#fieldTint(geo);

    const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      map: grassTexture(26), roughness: 1, metalness: 0,
      // Was 0xc2cbb0 flat. The pale tint made one even sheet of hay out of
      // 170 units of field; the variation now comes from #fieldTint and the
      // base is dropped so the lit patches have somewhere to be lit FROM.
      color: 0xa8ad95, vertexColors: true,
    }));
    ground.receiveShadow = true;
    // Added before anything else on the ground: #gy() beds the ruins and the
    // trees by finding this mesh in scene.children, so it has to exist first.
    this.scene.add(ground);

    this.#apron();
    this.#apronDetail();
    this.#undergrowth();
  }

  /**
   * Cheap deterministic 2-D noise — three sine lattices at incommensurate
   * frequencies. A hashed value-noise table would be smoother, but every
   * feature this is used for is at least a metre across and the plane is only
   * tessellated every 1.5 units, so the lattice never shows.
   */
  #fieldNoise(x, z, k = 1) {
    return 0.52 * Math.sin(x * 0.17 * k + 1.3) * Math.cos(z * 0.21 * k)
         + 0.31 * Math.sin((x * 0.41 + z * 0.33) * k + 2.1)
         + 0.19 * Math.sin((z * 0.73 - x * 0.29) * k + 0.7);
  }

  /**
   * Broad tonal variation baked into the field's vertex colours: damp hollows,
   * dry bleached rises, and a slow dimming with distance.
   *
   * Written with setRGB rather than as colours, on purpose. These are
   * MULTIPLIERS on the grass map, and `new THREE.Color(0x67784a)` would be
   * converted out of sRGB into the working space and land at about 0.15 —
   * which turns the field black rather than green.
   *
   * The distance dim matters more than the patches do. FogExp2 lifts the far
   * field toward blue but does nothing to its brightness, and a field of even
   * value out to the horizon gives the eye no reason to stay in the middle.
   */
  #fieldTint(geo) {
    const pos = geo.attributes.position;
    const arr = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const n = this.#fieldNoise(x, z);
      const dry = THREE.MathUtils.clamp(0.5 + n * 0.75, 0, 1);
      // dry is warm and lighter, damp is cold and darker — the two ends of
      // the same grass rather than two different greens
      let kr = 0.80 + dry * 0.44, kg = 0.84 + dry * 0.30, kb = 0.72 + dry * 0.16;
      const d = Math.hypot(x, z);
      // Scuffed ground just off the apron, where the fighting spills over.
      const m = this.#fieldNoise(x + 41, z - 27, 2.1);
      const wear = THREE.MathUtils.clamp(1 - Math.abs(d - 10.5) / 6, 0, 1)
                 * THREE.MathUtils.clamp(m * 1.7 - 0.4, 0, 1);
      kr += wear * 0.22; kg -= wear * 0.30; kb -= wear * 0.34;
      // The verge: one ring of grass that has been rained on rather than
      // trodden, immediately outside the apron. It is the light side of the
      // sandwich — pale board, dark moat, verge, dark distance — and without
      // it the trodden ring just faded into a black field and the board had a
      // drop shadow rather than a setting.
      const verge = 1 + 0.20 * Math.exp(-((d - 10.5) ** 2) / 30);
      // and the far field falls away, so the eye has a reason to come back in
      const far = verge * (1 - 0.18 * THREE.MathUtils.clamp((d - 16) / 28, 0, 1));
      arr[i * 3] = kr * far;
      arr[i * 3 + 1] = kg * far;
      arr[i * 3 + 2] = kb * far * 1.04;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  }

  /* ---------------------------------------------------------- the apron */

  /**
   * The trodden ring between the board and everything else.
   *
   * This is the most important surface in the scene and it is not a decoration
   * job. The player has to find a 3x3 grid at a glance, and the ruin rebuild
   * put a field of pale masonry all round it; measured off a screenshot the
   * old apron came out at 0.25 luminance against the board's 0.33, so the
   * brightest large shape in the middle of the frame was a warm orange DISC
   * with the board sitting inside it, barely a third of a stop up.
   *
   * What fixes that is value, not prettiness:
   *  - a dark earth map (apronTexture) instead of dirtTexture, about two stops
   *    down, so the pale flagstones have somewhere to stand out FROM;
   *  - a darker moat still, hugging the SQUARE of the grid rather than the
   *    disc, which puts the strongest contrast edge in the picture hard around
   *    the nine squares — that edge is what the eye lands on;
   *  - value rising again toward the rim, so the moat reads as trodden ground
   *    and not as a drop shadow under a menu panel.
   * Everything else here — ruts, scars, scrapes, the ragged edge — is there so
   * the ring reads as ground that has been fought over rather than as a disc.
   */
  #apron() {
    const r = rand(4477);
    // Old fire scars. Deliberately NOT read off #brazier's loop: the braziers
    // belong to somebody else's method and if they move, a scorch mark left
    // behind still reads as an old campfire, where one that follows them
    // around would have to be kept in sync forever.
    this.scars = [
      { x: 6.0, z: 1.2, r: 1.5 }, { x: -2.9, z: 5.9, r: 1.25 },
      { x: 3.1, z: -5.8, r: 1.35 }, { x: -6.1, z: -1.9, r: 1.15 },
    ];

    const P = [], U = [], C = [];
    this.#earthPatch(P, U, C, 0, 0, 7.7, 0.075, r, true);
    // Scrapes off the ring: where it spilled over, and where the earth is bare
    // under the ruin's feet. Merged into the same buffer — a dozen separate
    // transparent discs would be a dozen draws and a dozen sorting decisions.
    const OUT = LITE ? 4 : 11;
    for (let i = 0; i < OUT; i++) {
      const a = r() * Math.PI * 2, d = 8.4 + r() * 5.2;
      this.#earthPatch(P, U, C, Math.cos(a) * d, Math.sin(a) * d,
        0.9 + r() * 1.5, 0.3, r, false);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(U), 2));
    // Four components: the rim fades out rather than ending on a cut edge, and
    // three.js only compiles the alpha path when the attribute is a vec4.
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(C), 4));
    geo.computeVertexNormals();

    const apron = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      map: apronTexture(1), roughness: 1, metalness: 0,
      // Warm, and well under white: the map is already dark and this is what
      // keeps six braziers standing on it from bleaching it back to orange.
      color: 0xb3a288,
      transparent: true, vertexColors: true,
    }));
    apron.receiveShadow = true;
    this.scene.add(apron);
  }

  /**
   * One ragged patch of bare earth, as a fan of rings appended to shared
   * buffers. Ragged in its OUTLINE, not just in its fade: a disc with a soft
   * edge still reads as a disc from a camera that is looking down at it.
   */
  #earthPatch(P, U, C, cx, cz, base, wob, r, halo) {
    // Sized to the patch, not fixed. At a flat 84x20 every one-unit scrape
    // off the ring carried ten thousand vertices — the same mesh density as
    // the whole apron, for something a thumbnail across.
    const lo = LITE ? 0.5 : 1;
    const SP = Math.round(THREE.MathUtils.clamp(base * 11, 16, 84) * lo);
    const RINGS = Math.round(THREE.MathUtils.clamp(base * 2.6, 5, 20) * lo);
    const ph = [r() * 6.283, r() * 6.283, r() * 6.283];
    const edge = (a) => base * (1 + wob * (0.58 * Math.sin(3 * a + ph[0])
                                         + 0.30 * Math.sin(7 * a + ph[1])
                                         + 0.16 * Math.sin(11 * a + ph[2])));
    // #undergrowth needs to know where the bare ground stops, or half the
    // grass tufts sprout out of the middle of the trodden ring.
    if (halo) this.apronEdge = edge;

    const grit = 0.9 + r() * 0.25;
    // Scaled for the little scrapes too: a fixed 1.25-unit feather on a patch
    // one unit across leaves nothing but feather.
    const feather = Math.min(1.25, base * 0.42);
    const push = (s, j) => {
      const a = (s % SP) / SP * Math.PI * 2;
      const d = edge(a) * (j / RINGS);
      const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      P.push(x, this.#gy(x, z) + 0.014, z);
      // World-space UVs. A patch mapped 0..1 across itself would have earth at
      // two different grains on the ring and on the scrapes beside it.
      U.push(x / 7, z / 7);

      let k = grit;
      if (halo) {
        // The moat. Square distance, because the thing being separated is a
        // square: a radial ramp leaves the grid's corners sitting in ground a
        // third brighter than its edges do.
        const sd = Math.max(Math.abs(x), Math.abs(z)) - (STEP + TILE / 2);
        // Floor at 0.62, and NARROW — two units, not three and a half. The
        // wide version was so dark across so much of the ring that no earth
        // was visible in it at all: the board had a drop shadow under it and
        // the apron had stopped being a material. Tight is also stronger,
        // because the contrast lands right on the edge being read.
        k *= 0.62 + 0.44 * THREE.MathUtils.smoothstep(sd, -0.35, 2.1);
        // Ruts through the two doors, east and west. They cost nothing and
        // they point along the ground straight at the grid.
        for (const o of [-0.95, 0.95]) {
          const off = o + 0.38 * Math.sin(x * 0.33);
          const w = Math.exp(-((z - off) * (z - off)) / 0.22);
          k *= 1 - 0.30 * w * THREE.MathUtils.smoothstep(Math.abs(x), 3.3, 4.5);
        }
      } else {
        k *= 0.88;
      }
      k *= 1 + 0.17 * this.#fieldNoise(x * 1.7, z * 1.7);

      // A fire scar is not a dark blob: it is a ring of char with a PALE bed
      // of cold ash inside it. Painted as one dark disc they read as damp
      // patches and the ring stopped saying anything at all.
      let ash = 0;
      for (const s of this.scars) {
        const q = Math.hypot(x - s.x, z - s.z) / s.r;
        if (q >= 1) continue;
        const char = Math.exp(-((q - 0.72) ** 2) / 0.05);
        const bed = THREE.MathUtils.clamp(1 - q / 0.55, 0, 1) ** 0.8;
        k *= (1 - 0.5 * char) * (1 + 0.45 * bed);
        ash = Math.max(ash, bed);
      }

      // The feather is a fixed WIDTH, not a fraction of the radius. Fading
      // over the last fifth of the ring meant the apron was only opaque out
      // to about 5.5 units — the board was ringed by a metre of earth and
      // then bright lawn, which is the exact "dropped on a lawn" read the
      // apron exists to stop.
      const fade = THREE.MathUtils.smoothstep(d, edge(a) - feather, edge(a));
      // Green creeping in as the earth runs out, so the crossfade into grass
      // is a verge and not a brown halo with a soft edge.
      const vr = (1.05 - fade * 0.30) * k, vg = (1.0 + fade * 0.12) * k,
        vb = (0.92 - fade * 0.18) * k;
      // ash is grey: it pulls the blue back up where the fires were
      C.push(vr * (1 - ash * 0.14), vg, vb * (1 + ash * 0.55), 1 - fade);
    };

    // Wound anticlockwise seen from ABOVE. The first pass had it the other way
    // round: every triangle's normal pointed into the earth, the whole apron
    // was back-face culled, and the board was left sitting on bare grass.
    for (let s = 0; s < SP; s++) {
      for (let j = 0; j < RINGS; j++) {
        push(s, j); push(s + 1, j + 1); push(s, j + 1);
        push(s, j); push(s + 1, j); push(s + 1, j + 1);
      }
    }
  }

  /**
   * What is lying ON the trodden ring: standing water, and stone trodden into
   * the mud.
   *
   * The puddles are the only smooth thing in the scene. Everything else is
   * roughness 1, so the braziers and the last of the daylight land on it as
   * pure diffuse and the ground has no highlight anywhere — which is why the
   * apron still read as a painted surface after its texture was fixed. A
   * shallow specular patch gives the eye something to catch, and a wet floor
   * is also the cheapest thing in the world that says DUSK AFTER RAIN.
   *
   * They are kept small, dark and out at the rim on purpose: a big bright
   * reflection anywhere near the grid would be competing with the cards.
   */
  #apronDetail() {
    const r = rand(1607);
    // Nothing goes on the grid. A ring of radius 4.4 still crosses the board's
    // CORNERS — the squares are a square and the ring is not — and a pebble
    // that lands there is half a centimetre under a flagstone, which is close
    // enough to poke up through a seam. Resample instead of skipping: an
    // InstancedMesh keeps its count either way, and a skipped instance is left
    // on its identity matrix, sitting at the origin in the middle of the grid.
    const KEEP = STEP + TILE / 2 + 0.4;
    const spot = (lo, hi) => {
      for (let k = 0; k < 24; k++) {
        const a = r() * 6.283, d = lo + r() * (hi - lo);
        const x = Math.cos(a) * d, z = Math.sin(a) * d;
        if (Math.max(Math.abs(x), Math.abs(z)) > KEEP) return [x, z];
      }
      return [KEEP + 1.2, 0];
    };

    const P = [], A = [];
    const N = LITE ? 3 : 8;
    for (let i = 0; i < N; i++) {
      const [cx, cz] = spot(4.6, 7.0);
      const rad = 0.6 + r() * 1.05;
      const ph = [r() * 6.283, r() * 6.283];
      const e = (t) => rad * (1 + 0.32 * Math.sin(3 * t + ph[0]) + 0.17 * Math.sin(5 * t + ph[1]));
      const SP = LITE ? 12 : 22;
      const rim = (t) => {
        const q = e(t);
        const x = cx + Math.cos(t) * q, z = cz + Math.sin(t) * q;
        P.push(x, this.#gy(x, z) + 0.019, z); A.push(1, 1, 1, 0);
      };
      for (let k = 0; k < SP; k++) {
        const t0 = (k / SP) * 6.283, t1 = ((k + 1) / SP) * 6.283;
        P.push(cx, this.#gy(cx, cz) + 0.019, cz); A.push(1, 1, 1, 0.9);
        // Anticlockwise from ABOVE — the larger angle first. Wind a fan the
        // other way and every triangle faces into the earth and is culled.
        rim(t1); rim(t0);
      }
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3));
    pg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(A), 4));
    pg.computeVertexNormals();
    const pool = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({
      // Roughness 0.42, not 0.22. At 0.22 the highlight was a mirror spot a
      // few pixels across and it only appeared where the geometry happened to
      // line a brazier up with the lens; broadened, the same light lands as a
      // sheen across the whole patch and reads as wet mud from the seat.
      color: 0x333029, roughness: 0.42, metalness: 0,
      transparent: true, vertexColors: true, depthWrite: false,
    }));
    pool.renderOrder = 1;               // always after the apron it lies on
    this.scene.add(pool);

    // Stone trodden into the ring. Flat and half-buried, not rubble: the
    // ruin's own debris batches already cover the wall feet, and a second
    // scatter of the same lumps out in the open would read as a gravel path.
    const peb = new THREE.IcosahedronGeometry(0.5, 0);
    peb.scale(1, 0.4, 1);
    const PN = LITE ? 20 : 80;
    const stones = new THREE.InstancedMesh(peb, new THREE.MeshStandardMaterial({
      roughness: 1, metalness: 0, flatShading: true,
    }), PN);
    const o = new THREE.Object3D(), c = new THREE.Color();
    for (let i = 0; i < PN; i++) {
      const [x, z] = spot(4.4, 7.4);
      const k = 0.12 + r() * 0.16;
      o.position.set(x, this.#gy(x, z) + k * 0.1, z);
      o.rotation.set((r() - 0.5) * 0.5, r() * 6.283, (r() - 0.5) * 0.5);
      o.scale.set(k * (0.8 + r() * 0.7), k * (0.5 + r() * 0.5), k * (0.8 + r() * 0.7));
      o.updateMatrix();
      stones.setMatrixAt(i, o.matrix);
      // Dark. At lightness 0.2-0.36 these came out as pale chips scattered
      // over the ring — the read was spilled paper, not stone trodden in.
      c.setHSL(0.09 + r() * 0.03, 0.06 + r() * 0.06, 0.13 + r() * 0.11, THREE.SRGBColorSpace);
      stones.setColorAt(i, c);
    }
    stones.receiveShadow = true;
    this.scene.add(stones);
  }

  /* ------------------------------------------------------ undergrowth */

  /**
   * A tuft of blades, built once and instanced.
   *
   * Every blade is a two-segment strip with a bend in it, because a straight
   * triangle read as a spike from a camera looking down on it — you see the
   * whole length of a blade from up here, so the curve is the silhouette.
   * Normals are pushed toward straight UP rather than left as face normals:
   * a vertical sliver lit by its own normal flickers between black and white
   * as the instance is turned, and grass that twinkles is worse than no grass.
   */
  #tuftGeo(rr, blades = 9) {
    const P = [], N = [], C = [];
    const vtx = (p, k, nx, nz) => {
      P.push(p[0], p[1], p[2]);
      const l = Math.hypot(nx, 1.9, nz);
      N.push(nx / l, 1.9 / l, nz / l);
      C.push(k, k, k);
    };
    for (let b = 0; b < blades; b++) {
      const a = rr() * 6.283, rad = rr() * 0.26;
      const bx = Math.cos(a) * rad, bz = Math.sin(a) * rad;
      const dir = a + (rr() - 0.5) * 1.4;
      const h = 0.5 + rr() * 0.55;
      // Lean is small. The first pass leaned every blade out by up to half its
      // own height and a tuft came out as a splayed agave — a desert plant in
      // a wet northern ruin, and one that read as a MODEL rather than as turf.
      const lean = 0.14 + rr() * 0.3;
      const px = Math.cos(dir), pz = Math.sin(dir);
      const qx = -pz, qz = px;                      // across the blade
      const w0 = 0.026 + rr() * 0.015, w1 = w0 * 0.6;
      const p0 = [bx, 0, bz];
      const p1 = [bx + px * lean * h * 0.4, h * 0.6, bz + pz * lean * h * 0.4];
      const p2 = [bx + px * lean * h, h * 0.92, bz + pz * lean * h];
      const off = (p, w, s) => [p[0] + qx * w * s, p[1], p[2] + qz * w * s];
      const a0 = off(p0, w0, -1), a1 = off(p0, w0, 1);
      const b0 = off(p1, w1, -1), b1 = off(p1, w1, 1);
      vtx(a0, 0.42, px, pz); vtx(b0, 0.82, px, pz); vtx(b1, 0.82, px, pz);
      vtx(a0, 0.42, px, pz); vtx(b1, 0.82, px, pz); vtx(a1, 0.42, px, pz);
      vtx(b0, 0.82, px, pz); vtx(p2, 1.04, px, pz); vtx(b1, 0.82, px, pz);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(N), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(C), 3));
    return g;
  }

  /**
   * A broad-leaved weed — dock, burdock, nettle. Grass alone still reads as
   * lawn; what says NOBODY HAS CUT THIS FOR A CENTURY is the coarse stuff that
   * takes hold where the mower never went, which is exactly the foot of a wall.
   * Leaves are wide and near-horizontal, which is also the only orientation
   * that catches any light at all from a camera this high.
   */
  #weedGeo(rr, leaves = 6) {
    const P = [], N = [], C = [];
    const vtx = (p, k) => { P.push(p[0], p[1], p[2]); N.push(0, 1, 0); C.push(k, k, k); };
    for (let l = 0; l < leaves; l++) {
      const a = (l / leaves) * 6.283 + rr() * 0.8;
      const len = 0.62 + rr() * 0.5, wid = 0.19 + rr() * 0.12;
      const px = Math.cos(a), pz = Math.sin(a);
      const qx = -pz, qz = px;
      const root = [0, 0.05, 0];
      const mid = [px * len * 0.45, 0.10 + len * 0.34, pz * len * 0.45];
      const tip = [px * len, 0.06 + len * 0.16, pz * len];   // droops back down
      const m0 = [mid[0] - qx * wid, mid[1], mid[2] - qz * wid];
      const m1 = [mid[0] + qx * wid, mid[1], mid[2] + qz * wid];
      vtx(root, 0.5); vtx(m0, 0.92); vtx(m1, 0.92);
      vtx(m0, 0.92); vtx(tip, 1.12); vtx(m1, 0.92);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(N), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(C), 3));
    return g;
  }

  /**
   * Where growth actually takes hold: outside the trodden ring, thickest
   * against the ruin's footings and again in under the trees, and NONE of it
   * inside the apron. That emptiness is the point — the quiet ring is what
   * makes the busy frame stop at the edge of the play area.
   *
   * Two InstancedMeshes, one per plant, and neither casts: the shadow pass is
   * a spotlight cone aimed at the board and a thousand grass shadows in it
   * would cost more than the grass does. They do RECEIVE, so the ruin's
   * shadows still lie across the verge.
   */
  #undergrowth() {
    const r = rand(8821);
    const N = LITE ? 190 : 950;
    const spots = [];
    for (let i = 0, guard = 0; i < N && guard < N * 14; guard++) {
      const a = r() * 6.283;
      const d = Math.sqrt(4.8 * 4.8 + (25 * 25 - 4.8 * 4.8) * r());   // area-uniform
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      // Half a unit INSIDE the rim, not outside it: the apron's last unit is
      // fading out, and grass coming up through that fade is what makes the
      // two surfaces meet instead of abut.
      const rim = this.apronEdge(a);
      // And a few survivors further in — clumps the traffic happened to miss.
      // A trodden ring with a perfectly clean edge reads as a SURFACE, like a
      // gravel drive; what says trodden is grass losing the argument unevenly.
      // Rare, and never within three units of the rim's own inner reach, so
      // nothing grows where it would clutter the edge of the grid.
      if (d < rim - 0.55 && (d < rim - 2.9 || r() > 0.16)) continue;
      // Clumped, not scattered: an even sprinkle of tufts reads as carpet.
      const clump = THREE.MathUtils.clamp(this.#fieldNoise(x, z, 2.7) * 1.6 + 0.5, 0, 1);
      // thick at the wall feet (d ~ 9.5) and again under the canopy (d > 17)
      const band = 0.55 + 1.1 * Math.exp(-((d - 8.9) ** 2) / 7)
                 + 0.8 * THREE.MathUtils.clamp((d - 16) / 7, 0, 1);
      if (r() > clump * band) continue;
      spots.push({ x, z, d });
      i++;
    }

    const o = new THREE.Object3D(), c = new THREE.Color();
    const mat = new THREE.MeshStandardMaterial({
      roughness: 1, metalness: 0, vertexColors: true, side: THREE.DoubleSide,
    });
    const weeds = spots.filter((s) => s.d < 13.5 && r() < 0.3);
    const tufts = spots.filter((s) => !weeds.includes(s));

    const place = (list, geo, sc, hue) => {
      if (!list.length) return null;
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((s, i) => {
        const k = sc * (0.75 + r() * 0.5);
        o.position.set(s.x, this.#gy(s.x, s.z) - 0.03, s.z);
        o.rotation.set((r() - 0.5) * 0.2, r() * 6.283, (r() - 0.5) * 0.2);
        o.scale.set(k * (0.85 + r() * 0.35), k * (0.85 + r() * 0.45), k * (0.85 + r() * 0.35));
        o.updateMatrix();
        im.setMatrixAt(i, o.matrix);
        // Dry ochre through to deep green, and darker the further out it is —
        // the same aerial-depth trick the treeline uses, done by hand because
        // fog cannot darken anything, only tint it.
        const dim = 1 - 0.3 * THREE.MathUtils.clamp((s.d - 10) / 16, 0, 1);
        c.setHSL(hue + r() * 0.06, 0.24 + r() * 0.26,
          (0.19 + r() * 0.13) * dim, THREE.SRGBColorSpace);
        im.setColorAt(i, c);
      });
      im.receiveShadow = true;
      im.frustumCulled = false;   // one batch spans the whole ring
      this.scene.add(im);
      return im;
    };
    // Scale is not taste. At 0.62 a tuft was four pixels of pale tip on a
    // dark field — it read as grit blown across the grass, not as grass.
    place(tufts, this.#tuftGeo(rand(31), LITE ? 6 : 9), 0.66, 0.17);
    place(weeds, this.#weedGeo(rand(97), LITE ? 5 : 6), 0.6, 0.21);
  }

  /* -------------------------------------------------------- lighting */

  #lights() {
    // The key light is a SPOTLIGHT, not a directional sun, and that is the
    // most important decision in this file. A directional light lights the
    // ruin ring and the treeline exactly as hard as it lights the nine
    // squares, and once the ruins were rebuilt the frame had no focus left:
    // measured off a screenshot, the brightest pixels in the picture were
    // sunlit masonry out at the edges (0.70) and not the play surface (0.58).
    // This is a card game — the board has to be the brightest thing in frame.
    //
    // So the last of the daylight comes down through a break in the cloud
    // over the field: a wide cone with penumbra 1, hung far enough back
    // (~40 units) that the pool is a gentle gradient rather than a stage
    // light. decay 0 / distance 0 makes it behave like a directional light
    // inside the cone, so intensity stays in the same units as before and
    // nothing that was tuned against it shifts. Its direction is unchanged,
    // so every shadow in the game still falls the way it used to.
    //
    // It is still `this.sun` and still a single light: victory.js drains the
    // ending by name off arena.sun, and a second "fill sun" added next to it
    // would sail through the ending at full daylight strength.
    const sun = new THREE.SpotLight(0xffd49c, 4.15);
    sun.position.set(-24, 27, 17);            // same direction as the old sun
    // The cone width is the single control over how much of the world outside
    // the board is lit at all, and it was set twice. At 0.33 the board won
    // outright and the frame died around it: the ruin ring got six per cent of
    // the key, the bottom corners measured 0.03 against a 0.33 board, and a
    // voussoir arch and a seven-species wood were a black surround.
    //
    // The instinct is to fix that with the fill — and it does not work. Taking
    // the hemisphere from 0.62 back to 1.06 moved the bottom-right corner from
    // 0.028 to 0.030, because what lights a corner is the key, not the sky:
    // fill only reaches surfaces that face the sky, and a corner is trees and
    // rolling grass in their own shade. 0.42 is the cone that puts the ruins
    // back in the picture at about half key while the board keeps the axis.
    sun.angle = 0.42;
    sun.penumbra = 1;
    sun.decay = 0;
    sun.distance = 0;
    sun.castShadow = true;
    sun.shadow.mapSize.set(LITE ? 512 : 2048, LITE ? 512 : 2048);
    // A spot's shadow camera is a PERSPECTIVE one — left/right/top/bottom do
    // nothing on it and the fov is driven by sun.angle, so only the depth
    // range is ours to set. It is pulled in tight around the field because
    // that is the entire depth range the cone covers, and a tight range is
    // what keeps 2048 texels from being spent on empty air.
    sun.shadow.camera.near = 22;
    sun.shadow.camera.far = 62;
    sun.shadow.bias = -0.0012;
    sun.shadow.normalBias = 0.02;
    // Aimed a touch beyond the middle of the grid, toward the seat the camera
    // looks from, so the pool's bright core sits on the squares rather than
    // on the far stronghold.
    sun.target.position.set(0, 0, 1.2);
    this.scene.add(sun.target);
    this.scene.add(sun);
    this.sun = sun;

    // Cool bounce from the sky, so shadow sides read blue rather than black.
    // This is the ONLY light on everything outside the pool, so it is what
    // decides whether the ruins and the wood are a place or a black surround.
    //
    // It sits back at roughly what it always was, and that is the conclusion
    // of an experiment rather than an oversight. Cutting it to 0.62/0.2 to
    // darken the surroundings darkened the wrong things: it took the sky off
    // upward-facing stone and grass, which is most of what makes the ruins
    // legible, and barely touched the corners it was aimed at. Separation is
    // the KEY's job (see sun.angle above); this is the job of making the place
    // a place. "The board reads first" is a HIERARCHY, not a spotlight on an
    // empty stage: brightest board, ruin and wood plainly there, distance
    // falling away. Measured, that is a board about 3x its surroundings.
    //
    // The ground half is warmer and lighter than the 0x4a4030 it was, because
    // with the key now confined to a cone it is the only light at all on a
    // downward-facing surface, and every underside in the wood was black.
    this.scene.add(new THREE.HemisphereLight(0x93a9d2, 0x584a38, 1.06));
    this.scene.add(new THREE.AmbientLight(0xc9d4e6, 0.3));
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

  /**
   * Textures shared by all six fires. blobTexture() paints a fresh 128px
   * canvas every call, and the braziers wanted four of them each.
   */
  #fireTex() {
    if (!this.fireTex) {
      this.fireTex = {
        // The core is deliberately DIMMER than it looks like it should be.
        // The renderer tone-maps with ACES and this sprite is additive, so an
        // alpha-1 near-white centre does not read as "hot", it reads as a flat
        // white disc — and measured off a screenshot, those discs were the
        // brightest pixels in the whole frame at 0.705 while the play surface
        // topped out at 0.58. The fire in a card game must not out-punch the
        // cards. Brightness is bought back in the point light, which lands on
        // the board instead of in the eye.
        core: flameTexture(),
        halo: blobTexture('rgba(255,150,58,0.26)', 'rgba(255,78,16,0)'),
        smoke: blobTexture('rgba(210,196,190,0.62)', 'rgba(190,178,174,0)'),
      };
    }
    return this.fireTex;
  }

  #brazier(x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const tex = this.#fireTex();

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

    // `flame` is a GROUP, not the sprite it used to be, because arena.update()
    // and victory.js both drive the fire by writing flame.scale — a group lets
    // the hot core and the glow around it breathe together off that one write,
    // and lets the ending put a fire out by hiding one object. Anything added
    // in here has to hang off this group or the ending will leave it burning.
    const flame = new THREE.Group();
    flame.position.y = 0.95;        // the lip of the bowl: fire starts on coal
    g.add(flame);

    const core = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex.core, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    // Taller than it is wide, and its pivot dropped so the tongue sits ON the
    // coals: a sprite is centred on its origin, so a flame-shaped one centred
    // at the bowl's lip has half its length buried in the iron.
    core.scale.set(0.66, 0.9, 1);
    core.center.set(0.5, 0.13);     // flameTexture() puts the coals at 12.5%
    flame.add(core);

    // A wide dim halo does what a bright core cannot: it says the air around
    // the fire is full of light. Additive halos sum, so two braziers close
    // together would go white if this carried any real alpha — 0.26 over a
    // 2.4-unit sprite is about a tenth of the core's punch per pixel.
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex.halo, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    halo.scale.set(2.4, 2.4, 1);
    halo.position.y = 0.42;
    flame.add(halo);

    // Smoke. Normally blended and DARK, not additive: it is the one thing in
    // the scene that takes light away, and it is what ties the fires to the
    // ground haze instead of leaving them as six lamps on poles.
    //
    // It leans outward as it climbs, away from the middle of the field — rising
    // straight up, the near braziers' plumes drifted over the board in screen
    // space and put grey veils across the cards, which is the opposite of the
    // job. The whole column is kept under four units for the same reason.
    //
    // It hangs off the brazier group and NOT off `flame`, which is the whole
    // reason `flame` being a group was a trap worth writing down: update()
    // rewrites flame.scale.y between 1.06 and 1.50 nine times a second as the
    // fire breathes, and a plume parented to that breathed with it — the
    // column's height jumped by a third of its length every flicker. It
    // follows flame.visible by hand instead, so putting a fire out still puts
    // its smoke out.
    const out = Math.hypot(x, z) || 1;
    const smoke = new THREE.Group();
    smoke.position.y = 1.35;
    g.add(smoke);
    const PUFFS = LITE ? 2 : 5;
    for (let i = 0; i < PUFFS; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex.smoke, transparent: true, depthWrite: false, opacity: 0.5,
        color: 0x6b5f5c,
      }));
      const seed = Math.random() * 6.28;
      // The animation rides onBeforeRender rather than arena.update(): the
      // per-frame loop belongs to the whole arena and this is the brazier's
      // own business. this.clock is what update() advances, so the two stay
      // in step and a paused game pauses the smoke.
      s.onBeforeRender = () => {
        if (!flame.visible) { s.material.opacity = 0; return; }
        const t = (this.clock * 0.19 + i / PUFFS + seed * 0.1) % 1;
        const k = t * 3.6;
        s.position.set(
          (x / out) * k * 0.34 + Math.sin(this.clock * 0.5 + seed) * k * 0.09,
          0.35 + k,
          (z / out) * k * 0.34 + Math.cos(this.clock * 0.43 + seed) * k * 0.09,
        );
        const w = 0.55 + k * 0.62;
        s.scale.set(w, w, 1);
        // Up at the top it is thin because it has spread, at the bottom it is
        // thin because it has not left the coals yet.
        // Kept FAINT, and the reason is a hard limit rather than taste: a
        // sprite is a flat camera-facing quad, so wherever the plume passes
        // behind a wall the depth buffer cuts it with a dead straight line.
        // At half opacity that line was plainly visible as grey rectangles
        // stacked over the masonry; soft particles would need a depth-sampling
        // shader, and a quarter of the opacity costs nothing and hides it.
        s.material.opacity = 0.22 * Math.sin(Math.min(1, t * 1.15) * Math.PI) ** 0.8;
        // Lit from below by the fire it came off, and going cold as it climbs.
        // Uniformly grey smoke was invisible against dark ground and looked
        // like a smudge against a lit wall; the warm bottom is what makes it
        // read as smoke off THIS fire rather than as dirt on the lens.
        const cool = Math.min(1, t * 2.1);
        s.material.color.setRGB(
          0.62 - cool * 0.42, 0.40 - cool * 0.25, 0.30 - cool * 0.14,
        );
      };
      smoke.add(s);
    }

    // Reach, not brightness. arena.update() overwrites the intensity every
    // frame from its own flicker (6 + f*6), so the only handles here are the
    // falloff and the cutoff — and they are the ones that matter anyway. At
    // decay 2 / distance 12 a brazier lit the ground it stood on and nothing
    // else: the masonry three metres behind it stayed as flat as the masonry
    // forty metres away, so the fires separated the board from the ruins by
    // leaving the ruins dark. At decay 1.55 the same fire is nearly three
    // times as strong eight units out and picks the nearer stone out of the
    // dusk, which buys the separation in COLOUR — warm stone near a fire,
    // cold stone away from one — instead of buying it in darkness.
    const light = new THREE.PointLight(0xffa64d, 8, 18, 1.55);
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
  }

  #motes() {
    // Slow drifting embers. They do more for "this is a place" than any prop.
    //
    // They used to be scattered flat across a 46x46 square, which put most of
    // them out over the empty grass where nothing is burning and only a
    // handful in the one place embers come from. Now they are thrown round
    // the fires and the field on a radius, thickest between the braziers and
    // the board and thinning out fast past the ruin ring — so the drift reads
    // as smoke off the fires rather than as weather.
    //
    // The heights stay spread over the full 0..13 the wrap in update() uses.
    const n = LITE ? 60 : 300;
    const pos = new Float32Array(n * 3);
    const r = rand(1234);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      // r()**0.62 pulls the radius inward; the square root that a uniform disc
      // would need pushes it out, which is the opposite of what is wanted.
      const d = 2.2 + (r() ** 0.62) * 22;
      pos[i * 3] = Math.cos(a) * d;
      pos[i * 3 + 1] = r() * 13;
      pos[i * 3 + 2] = Math.sin(a) * d * 1.05;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.motes = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.15, map: blobTexture('rgba(255,215,150,1)', 'rgba(255,150,60,0)'),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.75,
    }));
    this.scene.add(this.motes);

    this.#haze();
  }

  /**
   * The air. Two sheets, and between them they are what puts DISTANCE in a
   * frame that has none to spend.
   *
   * The problem they solve: the ruins were rebuilt into something much better
   * and the picture went busy — masonry and flagstone sitting at the same
   * value, no falloff anywhere, and the brightest pixels in the shot out at
   * the edges. Light fixed most of it (see #lights). This fixes the rest, by
   * physically putting something between the lens and everything that is not
   * the board. Neither sheet touches the play area at all.
   */
  #haze() {
    // 1. Mist lying on the ground, with a clear hole over the squares. Flat,
    // so it veils the field BETWEEN the ruins and pools round their feet — and
    // because it is a lit material rather than an unlit one, the braziers
    // standing in it light it, and it glows warm around each fire for free.
    const mist = new THREE.Mesh(
      new THREE.CircleGeometry(34, LITE ? 24 : 64),
      new THREE.MeshStandardMaterial({
        map: mistTexture(), color: 0x6e666a, roughness: 1, metalness: 0,
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
      }),
    );
    mist.rotation.x = -Math.PI / 2;
    mist.position.y = 0.38;
    mist.renderOrder = -2;
    this.scene.add(mist);

    // 2. The far veil: the BACK HALF of a short cylinder standing just outside
    // the apron. BackSide is doing real work here — it draws only the far
    // wall, so everything beyond the board is seen through it and the board
    // itself, which is inside the cylinder, is not. Flat mist cannot do this:
    // a sheet on the ground never gets between the lens and a standing wall.
    //
    // It is dense in the grass and gone by head height, so what is behind it
    // sinks while its top stays a hard silhouette.
    //
    // The radius is 13.5, not the 9.4 it started at, and the difference is the
    // whole argument about what haze is for. At 9.4 the wall stood between the
    // lens and the RUINS, and everything two other agents had built — piers, a
    // voussoir arch, dead snags — was being looked at through gauze. Out at
    // 13.5 the ruin ring is on the near side of it with its contrast intact
    // and the treeline beyond is what goes soft. Board clear, ruins clear,
    // distance dying: three steps, in that order.
    //
    // ORDER MATTERS AND NOTHING WILL TELL YOU IF IT BREAKS: victory.js and
    // tools/endrestore.js both find the sky with
    //   scene.children.find(o => o.isMesh && o.material.side === BackSide)
    // and this is the only other BackSide mesh in the arena. #sky() runs first
    // in the constructor and #haze() runs from #scenery(), so the sky is found;
    // move either call and the ending will spend the whole fade draining THIS
    // instead, leaving a bright dusk sky over a black field.
    const veil = new THREE.Mesh(
      new THREE.CylinderGeometry(13.5, 13.5, 6, LITE ? 24 : 64, 1, true),
      new THREE.MeshStandardMaterial({
        map: veilTexture(), color: 0x6d6260, roughness: 1, metalness: 0,
        transparent: true, depthWrite: false, side: THREE.BackSide,
      }),
    );
    veil.position.y = 3;
    veil.renderOrder = -1;
    this.scene.add(veil);
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
