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
