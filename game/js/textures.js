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
