// Procedural canvas textures. Nothing is fetched — the arena has to work from
// a GitHub Pages static host with no asset pipeline, and hand-painted noise
// beats a flat colour for reading depth under a low sun.

import * as THREE from 'three';

function makeCanvas(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')];
}

function finish(canvas, repeat = 1) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Deterministic value noise so the ground looks the same on every load. */
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/* ------------------------------------------------------------ ground */

export function grassTexture(repeat = 12) {
  const [c, g] = makeCanvas(512);
  const r = rng(7);
  g.fillStyle = '#3f5a2c';
  g.fillRect(0, 0, 512, 512);

  // broad tonal patches first, so the ground is not uniform at distance
  for (let i = 0; i < 90; i++) {
    const x = r() * 512, y = r() * 512, rad = 30 + r() * 90;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    const dark = r() < 0.5;
    grd.addColorStop(0, dark ? 'rgba(42,64,30,.55)' : 'rgba(96,120,58,.35)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
  }
  // blades
  for (let i = 0; i < 9000; i++) {
    const x = r() * 512, y = r() * 512;
    const l = 2 + r() * 5;
    g.strokeStyle = `hsl(${78 + r() * 26} ${32 + r() * 26}% ${18 + r() * 24}%)`;
    g.lineWidth = r() < 0.15 ? 1.6 : 0.9;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (r() - 0.5) * 2.4, y - l);
    g.stroke();
  }
  return finish(c, repeat);
}

/** Worn flagstone for the nine squares — mossy, so it sits in the grass. */
export function stoneTexture() {
  const [c, g] = makeCanvas(512);
  const r = rng(19);
  g.fillStyle = '#6b6357';
  g.fillRect(0, 0, 512, 512);

  // irregular cobbles
  for (let i = 0; i < 34; i++) {
    const x = r() * 512, y = r() * 512, w = 60 + r() * 120, h = 50 + r() * 110;
    g.save();
    g.translate(x, y);
    g.rotate((r() - 0.5) * 0.6);
    g.fillStyle = `hsl(${32 + r() * 18} ${6 + r() * 10}% ${34 + r() * 22}%)`;
    g.beginPath();
    g.roundRect(-w / 2, -h / 2, w, h, 12 + r() * 16);
    g.fill();
    g.strokeStyle = 'rgba(28,24,20,.55)';
    g.lineWidth = 3;
    g.stroke();
    g.restore();
  }
  // moss creeping in from the joints
  for (let i = 0; i < 1600; i++) {
    const x = r() * 512, y = r() * 512;
    g.fillStyle = `hsla(${84 + r() * 24} 40% ${22 + r() * 18}% ,${0.1 + r() * 0.4})`;
    g.beginPath(); g.arc(x, y, 1 + r() * 4, 0, Math.PI * 2); g.fill();
  }
  // grime
  for (let i = 0; i < 700; i++) {
    const x = r() * 512, y = r() * 512;
    g.fillStyle = `rgba(20,16,12,${r() * 0.3})`;
    g.beginPath(); g.arc(x, y, 1 + r() * 7, 0, Math.PI * 2); g.fill();
  }
  return finish(c, 1);
}

export function woodTexture(repeat = 1, tint = 32) {
  const [c, g] = makeCanvas(256);
  const r = rng(53);
  g.fillStyle = `hsl(${tint} 26% 26%)`;
  g.fillRect(0, 0, 256, 256);
  for (let p = 0; p < 8; p++) {
    const x = p * 32;
    g.fillStyle = `hsl(${tint} ${20 + r() * 16}% ${18 + r() * 16}%)`;
    g.fillRect(x, 0, 30, 256);
    for (let i = 0; i < 26; i++) {
      g.strokeStyle = `rgba(0,0,0,${0.06 + r() * 0.16})`;
      g.lineWidth = 0.6 + r() * 1.4;
      g.beginPath();
      g.moveTo(x + r() * 30, 0);
      g.bezierCurveTo(x + r() * 30, 85, x + r() * 30, 170, x + r() * 30, 256);
      g.stroke();
    }
  }
  return finish(c, repeat);
}

export function dirtTexture(repeat = 4) {
  const [c, g] = makeCanvas(256);
  const r = rng(91);
  g.fillStyle = '#4a3a29';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const x = r() * 256, y = r() * 256;
    g.fillStyle = `hsl(${24 + r() * 16} ${16 + r() * 18}% ${14 + r() * 22}%)`;
    g.beginPath(); g.arc(x, y, 1 + r() * 5, 0, Math.PI * 2); g.fill();
  }
  return finish(c, repeat);
}

/* ------------------------------------------------------------ helpers */

/** A soft radial blob, for glows, shadows and dust sprites. */
export function blobTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const [c, g] = makeCanvas(128);
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, inner);
  grd.addColorStop(1, outer);
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Card faces come from the site's JPEGs; this keeps the loader in one place. */
const loader = new THREE.TextureLoader();
const cache = new Map();

export function cardTexture(url) {
  if (cache.has(url)) return cache.get(url);
  const t = loader.load(url);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  cache.set(url, t);
  return t;
}

/* ------------------------------------------------------------ markers */

const markerCache = new Map();

/**
 * A small badge for a stat change on a fighter — "+I", "-II" and so on.
 * Cached by text and colour, because the same badge appears on many cards.
 */
export function markerTexture(text, tone = 'up') {
  const key = `${tone}:${text}`;
  if (markerCache.has(key)) return markerCache.get(key);

  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');

  const fill = tone === 'down' ? '#c2352b' : tone === 'token' ? '#6b4ea8' : '#2f8f52';
  const edge = tone === 'down' ? '#ff9c92' : tone === 'token' ? '#c3aef0' : '#9fe8b0';

  g.beginPath();
  g.arc(64, 64, 52, 0, Math.PI * 2);
  g.fillStyle = 'rgba(12,9,8,0.92)';
  g.fill();
  g.lineWidth = 9;
  g.strokeStyle = fill;
  g.stroke();

  g.fillStyle = edge;
  g.font = `bold ${text.length > 2 ? 46 : 58}px "Iowan Old Style", Georgia, serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 64, 70);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  markerCache.set(key, t);
  return t;
}

/* ------------------------------------------------------------ ruin stone */

/**
 * Dressed masonry: coursed blocks with deep joints, for the ruin's walls.
 *
 * The walls used to borrow the flagstone texture above, and stretched up a
 * vertical face it read as a rockery — round cobbles, no courses, nothing that
 * said a mason had ever touched it. Ashlar is the cue that the place was BUILT.
 * Joints are drawn as gaps down to a dark underlayer rather than as lines, so
 * the blocks still separate once the mip chain has eaten the fine detail.
 *
 * Painted warm (hue 30-46) because the scene's hemisphere light is 0x93a9d2 and
 * anything neutral comes out lavender.
 */
export function ashlarTexture(repeat = 1) {
  const [c, g] = makeCanvas(512);
  const r = rng(131);
  g.fillStyle = '#241e17';              // the joint, seen between the blocks
  g.fillRect(0, 0, 512, 512);

  const COURSE = 64;
  for (let row = 0; row < 8; row++) {
    const y = row * COURSE;
    let x = -r() * 110;                 // stagger, so joints never stack
    while (x < 512) {
      const w = 74 + r() * 96;
      const lum = 31 + r() * 17;
      g.fillStyle = `hsl(${32 + r() * 14} ${7 + r() * 9}% ${lum}%)`;
      g.beginPath();
      g.roundRect(x + 4, y + 4, w - 8, COURSE - 8, 4);
      g.fill();
      // a bevelled arris: lit along the top edge, shaded along the bottom.
      // Without these the wall was one flat field and the courses vanished at
      // the distance the camera actually sits.
      g.fillStyle = 'rgba(255,238,204,.17)';
      g.fillRect(x + 4, y + 4, w - 8, 3);
      g.fillStyle = 'rgba(0,0,0,.30)';
      g.fillRect(x + 4, y + COURSE - 8, w - 8, 4);
      // knocked-off corners
      if (r() < 0.4) {
        g.fillStyle = '#241e17';
        const s = 6 + r() * 12;
        g.beginPath();
        const cx = r() < 0.5 ? x + 4 : x + w - 4 - s;
        g.moveTo(cx, y + 4); g.lineTo(cx + s, y + 4); g.lineTo(cx, y + 4 + s);
        g.fill();
      }
      x += w;
    }
  }

  // water running off the broken top, which is what ages a wall fastest
  for (let i = 0; i < 26; i++) {
    const x = r() * 512, w = 6 + r() * 26, h = 90 + r() * 300;
    const grd = g.createLinearGradient(0, r() * 120, 0, r() * 120 + h);
    grd.addColorStop(0, 'rgba(26,20,14,.34)');
    grd.addColorStop(1, 'rgba(26,20,14,0)');
    g.fillStyle = grd;
    g.fillRect(x, 0, w, 512);
  }
  // lichen, pale and dry rather than green — it is the only thing that breaks
  // the grey up without reading as moss on a vertical face
  for (let i = 0; i < 340; i++) {
    const x = r() * 512, y = r() * 512, rad = 3 + r() * 13;
    g.fillStyle = `hsla(${58 + r() * 26} ${12 + r() * 20}% ${52 + r() * 22}%,${0.05 + r() * 0.17})`;
    g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
  }
  // soot: the place has been fought over before
  for (let i = 0; i < 120; i++) {
    const x = r() * 512, y = r() * 512, rad = 8 + r() * 40;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, `rgba(14,11,9,${0.05 + r() * 0.12})`);
    grd.addColorStop(1, 'rgba(14,11,9,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
  }
  return finish(c, repeat);
}

/**
 * Undressed stone: grain, bedding streaks and lichen, for column drums, rubble
 * and the outcrops. Deliberately lower contrast than the ashlar — the point of
 * it is tone, since a boulder is only thirty pixels across at this camera and
 * any pattern finer than that is gone by the first mip level.
 */
export function rockTexture(repeat = 1) {
  const [c, g] = makeCanvas(256);
  const r = rng(577);
  g.fillStyle = '#6f6656';
  g.fillRect(0, 0, 256, 256);

  // bedding: broad soft bands, so a slab has a direction to it
  for (let i = 0; i < 16; i++) {
    const y = r() * 256, h = 4 + r() * 26;
    g.fillStyle = `hsla(${30 + r() * 16} ${8 + r() * 12}% ${26 + r() * 30}%,${0.18 + r() * 0.3})`;
    g.fillRect(0, y, 256, h);
  }
  // grain
  for (let i = 0; i < 2400; i++) {
    const x = r() * 256, y = r() * 256;
    g.fillStyle = `hsla(${28 + r() * 22} ${6 + r() * 14}% ${22 + r() * 40}%,${0.18 + r() * 0.5})`;
    g.beginPath(); g.arc(x, y, 0.7 + r() * 2.6, 0, Math.PI * 2); g.fill();
  }
  // lichen crust
  for (let i = 0; i < 90; i++) {
    const x = r() * 256, y = r() * 256, rad = 4 + r() * 16;
    g.fillStyle = `hsla(${62 + r() * 28} ${16 + r() * 22}% ${46 + r() * 22}%,${0.06 + r() * 0.2})`;
    g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
  }
  return finish(c, repeat);
}

/* ------------------------------------------------------------ apron */

/**
 * The trodden ring the nine squares sit in.
 *
 * dirtTexture() used to do this job and the apron came out a bright warm
 * ORANGE field — six braziers stand on it, and under them it was reading
 * LIGHTER than half the flagstones. The board is the thing a card player has
 * to find in a tenth of a second, so it cannot sit in a disc brighter than
 * itself. This is the same churned earth painted about two stops down: wet
 * hollows, dry scuff, trodden grit and old ash, with nothing in it pale
 * enough to compete with dressed stone.
 *
 * Warm (hue 20-40) for the usual reason — the 0x93a9d2 hemisphere turns
 * anything neutral lavender — but low saturation, so it reads as earth rather
 * than as the red-brown of a running track.
 */
export function apronTexture(repeat = 3) {
  const [c, g] = makeCanvas(512);
  const r = rng(2207);
  g.fillStyle = '#2a2018';
  g.fillRect(0, 0, 512, 512);

  // Broad churn: wet hollows and dried ridges. These are the only marks in
  // here that survive to the screen — at the camera's distance one tile of
  // this is about 200 pixels, so anything under a tenth of the canvas is gone
  // by the second mip. The first pass painted them at a third opacity and the
  // apron came back as a flat brown void; they are now the loudest thing in
  // the texture and the grain below is just tooth.
  for (let i = 0; i < 70; i++) {
    const x = r() * 512, y = r() * 512, rad = 46 + r() * 120;
    const wet = r() < 0.5;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, wet ? 'rgba(10,8,6,.80)' : 'rgba(104,82,55,.52)');
    grd.addColorStop(wet ? 0.55 : 0.4, wet ? 'rgba(10,8,6,.34)' : 'rgba(104,82,55,.2)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
  }
  // standing water in the deepest of them, with a dried pale collar
  for (let i = 0; i < 22; i++) {
    const x = r() * 512, y = r() * 512, rad = 14 + r() * 40;
    g.save();
    g.translate(x, y);
    g.rotate(r() * 6.283);
    g.scale(1, 0.55 + r() * 0.4);
    g.fillStyle = `rgba(118,96,66,${0.1 + r() * 0.12})`;
    g.beginPath(); g.arc(0, 0, rad * 1.35, 0, Math.PI * 2); g.fill();
    g.fillStyle = `rgba(9,8,7,${0.4 + r() * 0.3})`;
    g.beginPath(); g.arc(0, 0, rad, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  // hoof and boot: short gouges, all shallow, none of them readable on its own
  for (let i = 0; i < 900; i++) {
    const x = r() * 512, y = r() * 512, a = r() * Math.PI * 2, l = 3 + r() * 13;
    g.strokeStyle = r() < 0.5
      ? `rgba(12,9,6,${0.12 + r() * 0.3})` : `rgba(96,78,54,${0.07 + r() * 0.16})`;
    g.lineWidth = 1 + r() * 3.4;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  // grit trodden up out of the mud, and the odd chip of the ruin's own stone
  for (let i = 0; i < 1400; i++) {
    const x = r() * 512, y = r() * 512, s = 0.6 + r() * 2.2;
    g.fillStyle = `hsla(${26 + r() * 22} ${8 + r() * 14}% ${22 + r() * 26}%,${0.2 + r() * 0.5})`;
    g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill();
  }
  // trampled grass dragged in from the verge — a few flecks only, or the ring
  // starts reading green and stops reading as bare earth
  for (let i = 0; i < 220; i++) {
    const x = r() * 512, y = r() * 512, a = r() * Math.PI * 2, l = 2 + r() * 7;
    g.strokeStyle = `hsla(${68 + r() * 22} ${16 + r() * 18}% ${16 + r() * 12}%,${0.2 + r() * 0.4})`;
    g.lineWidth = 0.8 + r() * 1.2;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  // ash: the place has been camped in
  for (let i = 0; i < 40; i++) {
    const x = r() * 512, y = r() * 512, rad = 10 + r() * 34;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, `rgba(122,116,108,${0.05 + r() * 0.1})`);
    grd.addColorStop(1, 'rgba(122,116,108,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
  }
  return finish(c, repeat);
}

/* ------------------------------------------------------------ sky */

/**
 * The dusk sky, as one 1024x512 equirectangular canvas wrapped on the inside
 * of a sphere. Canvas row 0 is the zenith and the bottom row is the nadir,
 * which is how SphereGeometry lays its v out.
 *
 * It replaced a four-stop vertical gradient. A pure gradient has no DEPTH: it
 * is the same in every direction, so nothing in it says where the sun is, and
 * the one thing the whole frame's warm key light needs is somewhere for the
 * warmth to be coming FROM. Everything here is built around `sunU`, the
 * azimuth of the arena's key light, so the glow, the lit cloud undersides and
 * the cold half of the sky all agree with the shadows on the ground.
 *
 * Softness comes from stacked radial gradients rather than ctx.filter: canvas
 * blur is a GPU path that is missing or very slow on some of the machines this
 * runs on, and a sky that costs 400ms on first load is a worse sky.
 */
export function duskSkyTexture(sunU = 0.1) {
  const W = 1024, H = 512;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const r = rng(90210);
  // Wrap x round the seam, so a cloud that runs off one edge comes back on
  // the other instead of leaving a vertical cut down the sky.
  const px = (x) => ((x % W) + W) % W;

  // Base: night at the zenith down through slate to a warm horizon. The
  // horizon sits at v=0.5 (the sphere's equator) and the bottom half is
  // ground-facing and never seen, so it just keeps going dark.
  const base = g.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0.00, '#0d1226');
  base.addColorStop(0.20, '#1b2340');
  base.addColorStop(0.36, '#38405e');
  base.addColorStop(0.46, '#6c6070');
  base.addColorStop(0.50, '#9c7560');
  base.addColorStop(0.56, '#3a2f31');
  base.addColorStop(1.00, '#15131a');
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);

  // Stars, only in the top third and thinning out fast as the sky warms.
  for (let i = 0; i < 520; i++) {
    const y = r() * H * 0.42;
    const a = (1 - y / (H * 0.42)) ** 1.6 * (0.25 + r() * 0.75);
    g.fillStyle = `rgba(226,232,255,${a * 0.75})`;
    const s = r() < 0.08 ? 1.7 : 0.9;
    g.beginPath(); g.arc(r() * W, y, s, 0, Math.PI * 2); g.fill();
  }

  // Two soft glows in the sun's quarter: a wide one that lifts a third of the
  // sky and a small hot one sitting on the horizon itself.
  const sx = sunU * W;
  // Kept TIGHT on purpose. The first version ran the wide glow out to 0.42W
  // at 0.3 alpha, which is most of the sky, and it flattened everything: the
  // clouds, the belt and the stars all went under one warm wash and the sky
  // had no structure left anywhere. A sunset is a small very bright thing with
  // a lot of dark around it.
  for (const [rad, col, stop] of [
    [W * 0.26, '255,156,84', 0.34],
    [W * 0.085, '255,206,146', 0.78],
  ]) {
    for (const dx of [-W, 0, W]) {                 // painted three times, for the seam
      const grd = g.createRadialGradient(sx + dx, H * 0.5, 0, sx + dx, H * 0.5, rad);
      grd.addColorStop(0, `rgba(${col},${stop})`);
      grd.addColorStop(0.45, `rgba(${col},${stop * 0.3})`);
      grd.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = grd;
      g.fillRect(0, 0, W, H);
    }
  }

  // The Belt of Venus: opposite the sun, the earth's own shadow rising as a
  // slate-blue band with a dusty pink edge on top of it. It is the detail that
  // makes a sky read as the minute after sunset rather than as a gradient.
  const ax = px(sx + W * 0.5);
  for (const dx of [-W, 0, W]) {
    const belt = g.createRadialGradient(ax + dx, H * 0.52, 0, ax + dx, H * 0.52, W * 0.34);
    belt.addColorStop(0.00, 'rgba(198,138,132,0.30)');
    belt.addColorStop(0.55, 'rgba(120,104,132,0.16)');
    belt.addColorStop(1.00, 'rgba(120,104,132,0)');
    g.fillStyle = belt;
    g.fillRect(0, H * 0.40, W, H * 0.14);
    const dark = g.createLinearGradient(0, H * 0.47, 0, H * 0.5);
    dark.addColorStop(0, 'rgba(36,40,66,0)');
    dark.addColorStop(1, 'rgba(36,40,66,0.45)');
    g.fillStyle = dark;
    g.fillRect(0, H * 0.47, W, H * 0.03);
  }

  // Strata. Each band is a run of squashed radial blobs along one line, so it
  // feathers at both ends without a blur pass. Bands near the horizon are
  // flattened hardest, which is what gives the sky its perspective: cloud you
  // see edge-on a hundred miles away is a streak, cloud overhead is a lump.
  const cloud = (yFrac, len, thick, lift, alpha) => {
    const y = H * yFrac;
    const x0 = r() * W;
    const n = Math.round(len / 26);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1 || 1);
      const fade = Math.sin(t * Math.PI) ** 0.7;                 // ends dissolve
      const x = x0 + t * len + (r() - 0.5) * 12;
      const rad = thick * (0.55 + r() * 0.8);
      // How much of the sun's warmth this piece catches: near the sun and low
      // in the sky, the underside is lit; far from it the cloud is a silhouette.
      const d = Math.min(Math.abs(px(x) - sx), W - Math.abs(px(x) - sx)) / (W * 0.5);
      const warm = Math.max(0, 1 - d * 1.5) * lift;
      const col = warm > 0.02
        ? `${Math.round(120 + warm * 150)},${Math.round(92 + warm * 84)},${Math.round(96 + warm * 40)}`
        : '30,33,54';
      for (const dx of [-W, 0, W]) {
        const grd = g.createRadialGradient(x + dx, y, 0, x + dx, y, rad);
        grd.addColorStop(0, `rgba(${col},${alpha * fade})`);
        grd.addColorStop(0.6, `rgba(${col},${alpha * fade * 0.35})`);
        grd.addColorStop(1, `rgba(${col},0)`);
        g.fillStyle = grd;
        g.save();
        g.translate(x + dx, y);
        g.scale(1, 0.13 + yFrac * 0.55);        // flatter the lower it sits
        g.translate(-(x + dx), -y);
        g.fillRect(x + dx - rad * 1.2, y - rad, rad * 2.4, rad * 2);
        g.restore();
      }
    }
  };
  for (let i = 0; i < 26; i++) {
    const yF = 0.10 + r() ** 1.5 * 0.38;
    cloud(yF, 120 + r() * 460, 24 + r() * 60, 0.35 + r() * 0.65, 0.3 + r() * 0.38);
  }
  // A last few bright slivers right on the horizon line, the ones still in
  // direct sun after the ground has lost it.
  for (let i = 0; i < 7; i++) {
    cloud(0.475 + r() * 0.02, 90 + r() * 200, 9 + r() * 10, 1.25, 0.34 + r() * 0.2);
  }

  // Grain, last, over everything. Not for texture — to KILL a pattern. Chrome
  // dithers its gradients with an ordered 4x4 matrix, which is invisible in a
  // 512px swatch and is a crisp diagonal cross-hatch once the same pixels are
  // stretched over a 180-unit sphere and pushed through ACES. Random noise on
  // top of ordered noise reads as air; ordered noise on its own reads as a bug.
  //
  // It goes on through a second canvas and drawImage, NOT putImageData:
  // putImageData writes raw bytes and ignores both globalAlpha and the
  // composite mode, so the obvious version of this quietly replaced the whole
  // sky with flat grey.
  const gc = document.createElement('canvas');
  gc.width = W; gc.height = H;
  const gg = gc.getContext('2d');
  const grain = gg.createImageData(W, H);
  for (let i = 0; i < grain.data.length; i += 4) {
    const v = 128 + (r() - 0.5) * 42;
    grain.data[i] = grain.data[i + 1] = grain.data[i + 2] = v;
    grain.data[i + 3] = 255;
  }
  gg.putImageData(grain, 0, 0);
  g.globalAlpha = 0.09;
  g.globalCompositeOperation = 'overlay';
  g.drawImage(gc, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;

  const t = new THREE.CanvasTexture(c);
  // u wraps because the sky is a full turn; v must NOT, or the zenith row
  // bleeds into the nadir row and puts a seam across the top of the sphere.
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/* ------------------------------------------------------------ air */

/**
 * Ground mist, as a disc seen from above: a CLEAR HOLE over the play area,
 * ramping to solid out where the ruins stand, then dying before the disc's
 * own rim so the edge never shows as a circle on the grass.
 *
 * The hole is the whole point. Exponential fog is useless at this camera —
 * everything on screen is 25 to 40 units from the lens — so the only way to
 * put air between the board and the ruin ring is to lay the air down where
 * the ruins are and nowhere else.
 */
export function mistTexture() {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const r = rng(4242);
  g.clearRect(0, 0, S, S);

  // The ring itself. Stops are fractions of the disc's own radius, so a disc
  // of radius R is clear to 0.16R, solid from 0.36R to 0.70R, gone by R.
  //
  // The clear hole is much wider than the board needs, and that is deliberate:
  // the first cut opened at 0.16R, which put the thickest mist right where the
  // key light's cone still reaches, the ring lit up like a lamp and the board
  // ended up inside a bright halo. It has to start OUTSIDE the pool.
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  // Opening at 0.27R still put mist over the ruin ring itself, which took the
  // contrast off the one arch in the scene that was meant to be a landmark.
  // Air belongs BEYOND the thing you want looked at, not in front of it.
  grd.addColorStop(0.00, 'rgba(216,214,218,0)');
  grd.addColorStop(0.36, 'rgba(216,214,218,0)');
  grd.addColorStop(0.56, 'rgba(216,214,218,0.72)');
  grd.addColorStop(0.78, 'rgba(216,214,218,0.8)');
  grd.addColorStop(1.00, 'rgba(216,214,218,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);

  // Then break it up, or it reads as a grey doughnut painted on the field.
  // Holes punched out and thicker banks dropped in, both in the ring only.
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 170; i++) {
    const a = r() * Math.PI * 2, d = (0.34 + r() * 0.16) * S;
    const x = S / 2 + Math.cos(a) * d, y = S / 2 + Math.sin(a) * d;
    const rad = 14 + r() * 62;
    const h = g.createRadialGradient(x, y, 0, x, y, rad);
    h.addColorStop(0, `rgba(0,0,0,${0.25 + r() * 0.45})`);
    h.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = h;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  g.globalCompositeOperation = 'source-over';
  return finish(c, 1);
}

/**
 * The far veil: a vertical alpha ramp, dense just off the ground and gone by
 * head height, for the back half of a cylinder standing just outside the
 * apron. Everything past the board — the ruin ring, the treeline — is then
 * seen THROUGH it and the board is not, which is the separation the frame
 * needs and the one thing flat ground mist cannot do for a standing wall.
 */
export function veilTexture() {
  const c = document.createElement('canvas');
  c.width = 8; c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256);
  // Kept low and thin. The first ramp was half the wall's height at up to 0.9
  // alpha and the result was a pale band arcing right across the top of the
  // frame — a fog machine, not air. What reads is a shallow layer the ruins'
  // feet stand in.
  grd.addColorStop(0.00, 'rgba(214,208,206,0)');     // top of the wall
  grd.addColorStop(0.56, 'rgba(214,208,206,0.04)');
  grd.addColorStop(0.84, 'rgba(214,208,206,0.26)');
  grd.addColorStop(1.00, 'rgba(214,208,206,0.52)');  // down in the grass
  g.fillStyle = grd;
  g.fillRect(0, 0, 8, 256);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * A flame tongue for the braziers: a soft teardrop, wide and hot at the coals,
 * narrowing and cooling to nothing at the tip.
 *
 * blobTexture() was doing this job and a fire drawn as one round radial
 * gradient reads as a LAMP — which is what the braziers looked like close up.
 * The shape is stacked circles up an axis rather than a filled path, because
 * a path needs a blur to feather its edge, and canvas blur is a slow or
 * missing GPU path on some of the machines this has to run on.
 */
export function flameTexture() {
  const [c, g] = makeCanvas(128);
  const r = rng(3131);
  g.globalCompositeOperation = 'lighter';     // the blobs have to sum, not stack
  // Outer tongue, then the hot inner column: two passes, the second narrower,
  // shorter and paler, which is where the white core comes from without
  // painting a white disc.
  // Short and fat, not long and thin. The first cut ran the tongue 92px up a
  // 128px canvas off a slow taper, and a 20-pixel sprite of it on screen was a
  // NEEDLE — a welding spark on a stick. Fire at this size is mostly a blob
  // with a lick on top.
  for (const [w, h, y0, col, a] of [
    [33, 60, 108, '255,132,36', 0.17],
    [17, 38, 106, '255,214,148', 0.21],
  ]) {
    const N = 26;
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const y = y0 - t * h;
      // The taper: fat for the first third, then away to a point.
      const rad = w * (1 - t) ** 1.25 + 1.5;
      const x = 64 + Math.sin(t * 4.1 + 0.6) * t * 5 + (r() - 0.5) * 2;
      const grd = g.createRadialGradient(x, y, 0, x, y, rad);
      grd.addColorStop(0, `rgba(${col},${a})`);
      grd.addColorStop(0.55, `rgba(${col},${a * 0.45})`);
      grd.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = grd;
      g.save();
      g.translate(x, y);
      g.scale(0.62 + 0.38 * (1 - t), 1);       // narrower than it is tall
      g.translate(-x, -y);
      g.fillRect(x - rad * 1.7, y - rad, rad * 3.4, rad * 2);
      g.restore();
    }
  }
  g.globalCompositeOperation = 'source-over';
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
