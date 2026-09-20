// The end of the game.
//
// The whole match builds to this, so it is not a label dropped over a still
// bright battlefield: the TABLE finishes the story. Daylight drains out of the
// arena until only firelight is left, the losing Stronghold heels over in the
// dirt, the fighters that survived are the ones still lit, and the camera
// leaves its seat to look at what is left.
//
// Winning and losing are the same fall of light seen from opposite ends. You
// win: the camera comes in high and close over your own surviving line, their
// broken Stronghold burning small at the top of the frame, and the fires on
// YOUR side burn up. You lose: it drops low and back, your own Stronghold
// tipped over in the near ground and your braziers gone to coals, looking
// across at their line still standing in the light. A defeat in a story, not
// a failure message.
//
// Nothing in here touches the rules. It reads the finished state and animates.

import * as THREE from 'three';
import { strongholdPosition } from './board.js';
import { blobTexture } from './textures.js';

// UI colours per faction. arena.js has its own tints for 3D materials, but
// they are chosen to sit in firelight, they run dark on a panel, and Auroxi is
// missing from them entirely (it falls through to grey).
const FACTION_COLOUR = {
  Auroxi: '#e6bd53', Gloaming: '#a887e0', Shardsworn: '#52c9a1',
  Refractory: '#e5972f', Marvorren: '#57a8d8', Neutral: '#a79c90',
};

// The Stronghold band's own stone, from board.js. Used to take the empty-deck
// warning colour back off it once the game is over.
const STONE = new THREE.Color(0xbdb3a2);

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (t) => 1 - (1 - t) ** 3;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
/** 0 before `a`, eased 0..1 across `a`..`b`. The whole timeline is built of these. */
const at = (t, a, b, ease = easeInOut) => ease(clamp01((t - a) / (b - a)));

const ORDINAL = (n) => {
  const v = n % 100;
  const s = v >= 11 && v <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] || 'th');
  return `${n}${s}`;
};

/**
 * The engine's reason, said the way a person would say it. `reason` arrives
 * with the players called P0 and P1; nobody at the table calls them that, and
 * "P1's Avatar was destroyed" is a log line, not an ending.
 */
function epitaphFor(reason, { won, drawn, foe, loserName }) {
  const r = reason || '';
  if (/Avatar was destroyed/.test(r)) {
    return won ? `${foe}'s Avatar fell on the field.`
      : 'Your Avatar fell, and with it everything it held together.';
  }
  if (/sieged with an empty/.test(r)) {
    return won ? `${foe} was besieged with nothing left to draw.`
      : 'Besieged, with nothing left in the Stronghold to answer with.';
  }
  if (/nowhere to rise/.test(r)) {
    return won ? `${foe}'s Stronghold had nowhere left to rise.`
      : 'Your Stronghold had nowhere left to rise.';
  }
  if (/position repeated/.test(r)) {
    return 'The same four moves, four times over. Neither side could break it.';
  }
  if (/both Strongholds empty/.test(r)) {
    return 'Both Strongholds stand empty. Nothing is left to decide it with.';
  }
  if (/400 turns/.test(r)) return 'Four hundred turns, and no ground given.';
  if (/neither player could act/.test(r)) return 'Neither side could make a move.';
  if (drawn) return 'Nothing was settled here.';
  return won ? `${loserName} could not hold the field.` : `${foe} holds the field.`;
}

/**
 * One ending at a time. Held at module scope rather than in main.js so the
 * end-of-game path there stays a single call — and so a sync() that runs again
 * (a hover redraws the HUD) does not start the whole thing over.
 */
let live = null;

export function endGame(ctx) {
  if (live && live.hud === ctx.hud) return live;   // already ending
  if (live) live.restore();                        // a new game: give the old one back
  live = new Ending(ctx);
  return live;
}

/** Put the arena back the way it was — a second game must not start at dusk. */
export function clearEnding() {
  if (live) live.restore();
  live = null;
}

class Ending {
  constructor({ state, defs, deckNames, arena, board, pieces, anim, camera, hud, you, onAgain }) {
    this.hud = hud;
    this.arena = arena; this.board = board; this.pieces = pieces; this.camera = camera;
    this.t = 0;
    this.done = false;

    const w = state.winner;
    this.drawn = w !== 0 && w !== 1;
    this.winnerSide = this.drawn ? null : w;
    this.loserSide = this.drawn ? null : 1 - w;
    this.seat = you;
    this.won = !this.drawn && w === you;

    this.#readScene();
    this.#panel(state, defs, deckNames, onAgain);
    this.#stage(state, pieces);

    // NOT anim.add(): a tween makes the animator BUSY, and the frame loop waits
    // for it to go idle before sweeping away pieces that have left the game —
    // an ending that ran as a tween left the last corpse standing on the board
    // for its whole length. The fx list is stepped by exactly the same clock
    // and claims nothing.
    this.entry = {
      obj: new THREE.Object3D(), life: 0, span: 90,
      tick: (k) => this.#tick(k * 90),
    };
    anim.fx.push(this.entry);
    this.anim = anim;
    this.animOnce?.(anim);

    // The frame loop re-seats the camera from the player's seat every single
    // frame, so the ending cannot simply move it. It takes the camera at the
    // last possible moment instead: the matrix update the renderer itself
    // performs just before it draws.
    //
    // Whether it was an own property BEFORE is remembered so restore() can put
    // it back by deleting rather than by assigning. Assigning the bound
    // original back leaves an own property shadowing the prototype, so the next
    // game binds THAT and the one after binds that — a wrapper deeper every
    // rematch, every one of them called on every frame. tools/endrestore.js is
    // what caught it: the only thing in the arena that did not come back the
    // way it went in.
    this.camWasOwn = Object.prototype.hasOwnProperty.call(camera, 'updateMatrixWorld');
    this.realMatrix = camera.updateMatrixWorld.bind(camera);
    camera.updateMatrixWorld = () => { this.#driveCamera(); this.realMatrix(true); };
  }

  /* ------------------------------------------------------ what is here */

  #readScene() {
    const sc = this.arena.scene;
    this.sun = this.arena.sun;
    this.hemi = sc.children.find((o) => o.isHemisphereLight);
    this.amb = sc.children.find((o) => o.isAmbientLight);
    // The sky is a huge inside-out sphere with fog switched off, so it does NOT
    // darken with everything else — left alone it stays a bright dusk over a
    // black field, which reads as a bug rather than as night.
    this.sky = sc.children.find((o) => o.isMesh && o.material?.side === THREE.BackSide);
    this.fog = sc.fog;

    // The key light's shadow map only covers the middle of the field, so the
    // treeline threw a long hard-edged wedge that stopped dead in mid-air. In
    // daylight it is lost among everything else; in a dark frame it is the
    // first thing you see. The ending drops the sun's shadow and lights the
    // field from the fires, which cast none.
    if (this.sun) this.sun.castShadow = false;

    this.was = {
      sun: this.sun ? this.sun.intensity : 0,
      sunColour: this.sun ? this.sun.color.clone() : null,
      hemi: this.hemi ? this.hemi.intensity : 0,
      hemiColour: this.hemi ? this.hemi.color.clone() : null,
      amb: this.amb ? this.amb.intensity : 0,
      fogDensity: this.fog ? this.fog.density : 0,
      fogColour: this.fog ? this.fog.color.clone() : null,
      sky: this.sky ? this.sky.material.color.clone() : null,
      moteColour: this.arena.motes ? this.arena.motes.material.color.clone() : null,
    };

    // Which end of the field each brazier stands at, so the fires can die on
    // the losing side and burn up on the winning one.
    const v = new THREE.Vector3();
    this.torches = this.arena.torches.map((t) => {
      t.light.getWorldPosition(v);
      return { t, side: v.z > 0 ? 0 : 1 };
    });
  }

  /* ------------------------------------------------------ staging */

  #stage(state, pieces) {
    const sc = this.arena.scene;
    this.added = [];

    // A warm light over whoever is left holding the field. The rest of the
    // arena is about to lose its daylight; this is what keeps their cards
    // readable and, in a loss, what you are looking across at.
    const held = this.drawn ? this.seat : this.winnerSide;
    const standing = [...pieces.byUid.values()].filter((p) => p.owner === held && !p.isConstruct);
    const focus = new THREE.Vector3(0, 0, 0);
    if (standing.length) {
      for (const p of standing) focus.add(p.group.position);
      focus.divideScalar(standing.length);
    }
    this.keyLight = new THREE.PointLight(0xffb271, 0, 26, 2);
    this.keyLight.position.set(focus.x * 0.6, 4.6, focus.z * 0.8);
    sc.add(this.keyLight);
    this.added.push(this.keyLight);
    const { pos: rest, aim: restAim } = this.#endPose();
    this.#clearSightline(rest, restAim);

    // A cold fill from behind the camera. Without it the ruins that end up in
    // the foreground are lit by nothing at all and come out as flat black
    // shapes across the middle of the frame — worst in defeat, where the
    // camera pulls back into the ruin ring to look at the field.
    this.fill = new THREE.DirectionalLight(0x9fb4dc, 0);
    this.fill.position.set(rest.x, 9, rest.z);
    sc.add(this.fill);
    this.added.push(this.fill);

    // The cards are NOT taken here. The move that ended the game is still
    // being played — the killing lunge, the body thrown onto the pile — and
    // those animations own the pieces they touch. Claiming them now fought
    // the animation for the same transform, and when the animation finished
    // it handed the piece back to pieces.js, which quietly undid the ending's
    // lift and ash. #takeCards runs once the animator is idle instead.
    this.cards = null;

    if (this.drawn) return;

    // The Stronghold that fell. Its whole plinth sinks and tilts; if there was
    // still a deck standing on it, that spills.
    this.fallen = this.board.strongholds[this.loserSide];
    this.fallenWas = {
      pos: this.fallen.group.position.clone(),
      rot: this.fallen.group.rotation.clone(),
    };
    const where = strongholdPosition(this.loserSide);
    this.dust = this.#dust(where);
    sc.add(this.dust.points);
    this.added.push(this.dust.points);

    // Pulled a little toward the seat the camera watches from: sitting in the
    // middle of the plinth it lit the far face and left the near one — the one
    // filling the foreground of a defeat — a black slab.
    // Small and close. At the 16-96 this used to run it was not an ember in a
    // wreck, it was a floodlight a metre off the board's stone lip: the nearest
    // edges came back as a hot orange rim with no shading left in them.
    this.ember = new THREE.PointLight(0xff5f24, 0, 6.5, 2);
    this.ember.position.set(where.x, 0.85, where.z + (this.seat === 0 ? 1.5 : -1.5));
    sc.add(this.ember);
    this.added.push(this.ember);

    // The moment it goes. Square 10 and 11 ARE the two Stronghold spaces, so
    // the animator's own effects land on the right stone.
    const sq = 10 + this.loserSide;
    this.animOnce = (a) => {
      a.ring(sq, { colour: 0xff6a33, size: 5.5, seconds: 1.1, y: 0.12 });
      a.burst(sq, { count: 30, seconds: 1.3, colour: 'rgba(255,150,70,1)', up: 1.4 });
    };
  }

  /**
   * Take the cards over, once the last blow has finished playing.
   *
   * `animating` is the same flag the animator sets, and it stops the
   * resting-position lerp in pieces.js from dragging a piece back — which is
   * what makes the lift and the ash hold. Nothing sets it back to false while
   * the animator's queue is empty, so this only has to be done once.
   */
  #takeCards() {
    const lit = this.drawn ? null : this.winnerSide;
    this.cards = [...this.pieces.byUid.values()].map((p) => {
      p.animating = true;
      p.setThreat(false);
      // With update() short-circuited the siege ring would hold whatever
      // opacity it happened to stop at, flashing over a finished game.
      p.threatRing.material.opacity = 0;
      // Power badges and token pips are the same: in-play arithmetic, not
      // part of the last look at the field.
      p.markers.visible = false;
      return {
        p, base: p.group.position.clone(), roll: (Math.random() - 0.5) * 0.5,
        mine: lit === null || p.owner === lit,
      };
    });

    // The light over the survivors can only be aimed once they have all
    // stopped moving, so it is placed here rather than at the start.
    const held = this.cards.filter((c) => c.mine);
    if (held.length && this.keyLight) {
      const f = new THREE.Vector3();
      for (const c of held) f.add(c.base);
      f.divideScalar(held.length);
      this.keyLight.position.set(f.x * 0.6, 4.6, f.z * 0.8);
    }
  }

  /**
   * The seat camera looks down on the field from twenty units up, well over
   * the treeline. The ending's does not — and a scenery tree standing where
   * it comes to rest filled a third of the last shot of the game with a
   * black flat-shaded leaf. Whatever is close enough to be in the way is
   * either in front of the lens or behind it, so it is simply taken out for
   * the length of the ending and put back afterwards.
   */
  #clearSightline(pos, aim) {
    const keep = new Set([this.board.group, this.arena.motes, this.sky, ...this.added]);
    for (const p of this.pieces.byUid.values()) keep.add(p.group);
    // The braziers are the light. Taking one out of the way puts the field
    // out with it, so they stay wherever they stand.
    const lit = (o) => o.isLight || o.children?.some(lit);

    const ax = aim.x - pos.x, az = aim.z - pos.z;
    const run = Math.hypot(ax, az) || 1;
    this.hidden = [];

    // Every broken wall and column lives in ONE group standing at the origin,
    // so walking the scene's own children finds the whole ruin ring sitting
    // nowhere near the camera and clears nothing. The ring is opened up.
    const candidates = [];
    for (const o of this.arena.scene.children) {
      if (o === this.arena.ruins) candidates.push(...o.children);
      else candidates.push(o);
    }

    for (const o of candidates) {
      if (keep.has(o) || !o.visible || lit(o)) continue;
      // the ground and the dirt apron, which are under everything
      if (o.geometry?.type === 'PlaneGeometry' || o.geometry?.type === 'CircleGeometry') continue;

      const vx = o.position.x - pos.x, vz = o.position.z - pos.z;
      const along = (vx * ax + vz * az) / run;          // metres down the sightline
      const perp = Math.abs(vx * az - vz * ax) / run;   // metres off it
      const near = Math.hypot(vx, vz) < 8.5;
      if (!near && !(along > 0 && along < run && perp < 3.2)) continue;
      o.visible = false;
      this.hidden.push(o);
    }
  }

  /**
   * A slow plume off the broken Stronghold. anim.burst() is additive — it can
   * only add light, which is right for sparks and wrong for the dust of
   * something collapsing, so this is its own normally-blended cloud.
   */
  #dust(origin) {
    const n = 90;
    const pos = new Float32Array(n * 3);
    const vel = [];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 1.5;
      pos[i * 3] = origin.x + Math.cos(a) * r;
      pos[i * 3 + 1] = 0.1 + Math.random() * 0.3;
      pos[i * 3 + 2] = origin.z + Math.sin(a) * r;
      vel.push([Math.cos(a) * (0.3 + Math.random() * 0.7), 0.35 + Math.random() * 0.9,
        Math.sin(a) * (0.3 + Math.random() * 0.7)]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const points = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 1.5, map: blobTexture('rgba(150,138,120,0.85)', 'rgba(120,108,92,0)'),
      transparent: true, depthWrite: false, opacity: 0,
    }));
    return { points, geo, vel, origin, from: pos.slice() };
  }

  /* ------------------------------------------------------ per frame */

  #tick(t) {
    this.t = t;
    const fall = at(t, 0, 1.9);            // the light going out
    const settle = at(t, 0.9, 2.6);        // what is left of it coming up

    if (this.sun) {
      this.sun.intensity = this.was.sun * (1 - fall * 0.88);
      // Not just dimmer — colder. The warmth that is left has to come from the
      // fires, or the fires do not read as the only thing still burning.
      this.sun.color.copy(this.was.sunColour).lerp(new THREE.Color(0x8ea3cf), fall * 0.85);
    }
    // The sun goes almost out but the sky does not, on purpose: with the sun
    // dominant the ruins threw hard black wedges across the field, and a
    // hard-edged hole in the middle of the last shot of the game reads as a
    // fault. What is left is a low blue floor with the fires burning on top.
    // The sky bounce and the ambient are what actually light the treeline, and
    // at the old 0.52/0.46 they left it plainly GREEN — the arena read as late
    // afternoon with a dark board in it, which is not an ending. They have to
    // go most of the way down before the fires become the light rather than an
    // accent, and the sky half of the hemisphere goes to night with them.
    if (this.hemi) {
      this.hemi.intensity = this.was.hemi * (1 - fall * 0.78);
      this.hemi.color.copy(this.was.hemiColour).lerp(new THREE.Color(0x2d3a58), fall);
    }
    if (this.amb) this.amb.intensity = this.was.amb * (1 - fall * 0.72);
    if (this.fog) {
      this.fog.density = this.was.fogDensity + fall * 0.0072;
      this.fog.color.copy(this.was.fogColour).lerp(new THREE.Color(0x161420), fall);
    }
    if (this.sky) {
      this.sky.material.color.copy(this.was.sky).lerp(new THREE.Color(0x232438), fall * 0.86);
    }
    if (this.arena.motes && this.was.moteColour) {
      // In a loss the embers go to ash; in a win they stay as sparks.
      const to = this.won || this.drawn ? new THREE.Color(0xffd2a0) : new THREE.Color(0x8c8a90);
      this.arena.motes.material.color.copy(this.was.moteColour).lerp(to, fall);
    }

    // arena.update() rewrites every brazier from scratch each frame and runs
    // BEFORE this does, so these are multipliers on what it just decided —
    // the flicker underneath is still the arena's.
    //
    // Unless it does not run. Stepping the animator by hand (which is the only
    // way to freeze a frame in a headless browser) leaves arena.update out, and
    // multiplying our own output four hundred times over sent the surviving
    // braziers to 1.7e62. So each one remembers what it was handed and what it
    // handed back, and refuses to compound.
    for (const e of this.torches) {
      const dying = this.drawn ? false : e.side === this.loserSide;
      // A dying fire goes to EMBERS, not to zero. Taken all the way out, the
      // braziers on the losing side became unlit black poles — and in defeat
      // they stand right in the foreground, so the frame gained three dead
      // props and lost the one line that says whose end of the field this is.
      // A coal still has a little light in it, and it still moves.
      let k = dying
        ? 0.085 + (1 - fall) * (0.55 + 0.45 * Math.sin(t * 19 + e.t.phase * 3))
          + fall * 0.05 * Math.sin(t * 2.3 + e.t.phase)
        : 1 + settle * 0.85;
      if (k < 0) k = 0;

      // "Is this the number I wrote last time?" If it is not, the arena has
      // been here since and that is the new base. NaN on the first pass has to
      // fall through to "no", which is why this is written as a negated < and
      // not as a >= : every comparison with NaN is false, so `>=` answered NO
      // on the very first frame and the base was never taken at all. The light
      // got that right; the flame below got it backwards and multiplied an
      // undefined base, so every brazier in every ending had a sprite scaled
      // to NaN — six unlit iron cups round a field whose whole point was that
      // the fires are the only light left.
      const fresh = (cur, sent) => !(Math.abs(cur - (sent ?? NaN)) < 1e-9);

      const lit = e.t.light.intensity;
      if (fresh(lit, e.sent)) e.base = lit;
      e.sent = e.base * k;
      e.t.light.intensity = e.sent;

      // The flame is an additive sprite and the renderer tone-maps, so a
      // brighter fire has to be bought in LIGHT, not in sprite: scaling the
      // sprite up just grows the white blob its core already is.
      const fk = dying ? k : 1 + settle * 0.15;
      const sc = e.t.flame.scale;
      if (fresh(sc.x, e.sentX)) { e.baseX = sc.x; e.baseY = sc.y; }
      e.sentX = e.baseX * fk;
      sc.set(e.sentX, e.baseY * fk, 1);
    }
    // Point lights here fall off with the square of the distance, the same as
    // the braziers do — a brazier's 12 sits a metre above its bowl. This one
    // hangs five metres over the board, so it needs two orders more to land
    // the same light on a card. 30 did nothing at all.
    // In defeat this is the far side of the field rather than the near one,
    // and it is the one thing the eye is meant to find, so it carries further.
    if (this.keyLight) this.keyLight.intensity = (this.won || this.drawn ? 170 : 260) * settle;
    if (this.fill) this.fill.intensity = 1.15 * settle;

    // The board is still wearing the aids you play WITH: red danger rings on
    // besieged Gates, the brand on each Gate breathing. They were the last UI
    // left in an otherwise cinematic frame, and they are answering a question
    // nobody is asking any more.
    this.board.setStates({}, []);
    for (const m of this.board.gateMarks) m.emissiveIntensity = 0;
    this.board.gateMarks.length = 0;

    this.#tickStronghold(t);

    // The cards are claimed the moment the last animation of the game has
    // finished, and their part of the timeline starts from THERE — a lift that
    // began during the killing blow would have played out unseen.
    if (!this.cards && !this.anim.running.length) { this.#takeCards(); this.tCards = t; }
    if (this.cards) this.#tickCards(t - this.tCards);
    if (this.dust) this.#tickDust(t);
    // What is left burning in the wreck of the Stronghold. It is the only
    // thing marking the spot once the plinth has gone down, and the camera is
    // pointed at it.
    if (this.ember) this.ember.intensity = 3.4 + 11 * Math.exp(-t * 1.1);
  }

  #tickStronghold(t) {
    if (!this.fallen) return;
    const sink = at(t, 0.05, 1.5, easeOut);
    const g = this.fallen.group;
    // It HEELS OVER; it does not go down. The plinth is 0.22 thick and its top
    // face sits at y=0.08, so the 0.62 descent this used to do put the entire
    // Stronghold — plinth, band and the Stronghold card revealed under an
    // empty deck — under a ground plane that is opaque and unbroken. The
    // number in the harness said -0.62 and the frame showed nothing at all:
    // the loser's Stronghold was not falling, it was being deleted, and the
    // one object the defeat is about was missing from the shot.
    //
    // Tipped instead, the low corner buries itself and the high one lifts
    // clear of the dirt, which is what a thing that has gone over looks like.
    const s = this.seat === 0 ? 1 : -1;
    g.position.y = this.fallenWas.pos.y - sink * 0.07;
    g.position.x = this.fallenWas.pos.x + sink * 0.26 * s;
    g.rotation.z = this.fallenWas.rot.z + sink * 0.36 * s;
    g.rotation.x = this.fallenWas.rot.x + sink * 0.17 * s;

    // Both of these are recomputed from the deck count every frame by
    // board.js, so they are nudged rather than set.
    const spill = at(t, 0.0, 0.85, easeOut);
    if (this.fallen.deck.visible) {
      this.fallen.deck.position.x += spill * 1.15;
      this.fallen.deck.position.y += spill * 0.05;
      this.fallen.deck.rotation.z -= spill * 1.05;
    }
    // An empty Stronghold pulses red as a warning. The warning is over.
    //
    // Killing the emissive was not enough. board.js also sets the band's
    // DIFFUSE to 0xff5a4a while the deck is empty, and it does it every frame,
    // so the ring survived as a hard scarlet hoop around the wreck — a torus
    // slightly wider than the plinth, catching the ember light edge-on and
    // blowing out. It is the loudest thing in the frame and it is a play aid.
    // Both Strongholds get it, because a game can end with both decks dry.
    const gone = 1 - at(t, 0, 0.7);
    for (const sh of this.board.strongholds) {
      sh.band.material.emissiveIntensity *= gone;
      sh.band.material.color.lerp(STONE, at(t, 0, 0.7));
    }
  }

  #tickCards(t) {
    const lift = at(t, 0.1, 1.2, easeOut);
    const fade = at(t, 0.0, 1.0);
    for (const c of this.cards) {
      if (c.mine) {
        c.p.group.position.y = c.base.y + lift * 0.16;
        c.p.frontMat.color.setScalar(1 + lift * 0.14);
      } else {
        // Knocked askew and gone to ash. They are still on the board — that is
        // the point — but nothing about them is lit any more.
        c.p.group.position.y = c.base.y - fade * 0.03;
        c.p.card3d.rotation.z = c.roll * fade;
        c.p.frontMat.color.setScalar(1 - fade * 0.66);
      }
    }
  }

  #tickDust(t) {
    const k = clamp01(t / 4.2);
    const a = this.dust.geo.attributes.position;
    for (let i = 0; i < a.count; i++) {
      const v = this.dust.vel[i];
      a.setX(i, this.dust.from[i * 3] + v[0] * k * 2.4);
      a.setY(i, this.dust.from[i * 3 + 1] + v[1] * k * 3.4);
      a.setZ(i, this.dust.from[i * 3 + 2] + v[2] * k * 2.4);
    }
    a.needsUpdate = true;
    this.dust.points.material.size = 1.5 + k * 3.4;
    this.dust.points.material.opacity = Math.min(k * 5, 1) * (1 - k) * 0.85;
  }

  /* ------------------------------------------------------ the camera */

  /**
   * Where the ending comes to rest. Written for the player sitting at +Z and
   * mirrored for the other seat, which is the trick the seat camera uses too.
   *
   * The aim point is what lands in the middle of the frame, so it sits a
   * little IN FRONT of the board: that pushes the field into the top half and
   * leaves the bottom of the frame for the panel. Aiming at the board itself
   * put the result over the cards.
   */
  #endPose() {
    const s = this.seat === 0 ? 1 : -1;
    if (this.drawn) {
      // Nobody's shot: high, square on, no side favoured.
      return { pos: new THREE.Vector3(2.4 * s, 9.2, 13.4 * s),
        aim: new THREE.Vector3(0.3 * s, -1.3, 2.2 * s) };
    }
    // Both of these are PITCHED DOWN — the aim point is below the ground, not
    // on it. Aiming level, which is the obvious thing to do, put the board
    // across the middle of the frame and the result panel then covered the
    // bottom half of it; the whole field has to ride in the top 45% or it is
    // simply not in the shot. tools/endposes.js draws the panel's footprint
    // over a sheet of candidates, which is how these two were chosen.
    if (this.won) {
      // High and close over your own line, their broken Stronghold small at
      // the top of the frame. Flat cards go invisible from much lower.
      return { pos: new THREE.Vector3(2.8 * s, 6.2, 10.8 * s),
        aim: new THREE.Vector3(0.4 * s, -1.0, 1.6 * s) };
    }
    // Defeat stays ON the field, low, just behind your own wreck. Pulling the
    // camera back outside the ruin ring — which is what it did before — put
    // twelve metres of broken wall and half a treeline between the lens and
    // the board: the frame had no subject, the winner's line was a cluster of
    // thumbnails off to one side, and your own fallen Stronghold was not in
    // it at all. From here the wreck is the near ground, their line is across
    // the middle, and your dead braziers stand between the two.
    // Lower and further back than the victory, so the two do not read as the
    // same shot: your tipped Stronghold is the near ground on the left, their
    // line is across the middle still lit, and your guttered braziers stand
    // between them.
    return { pos: new THREE.Vector3(5.0 * s, 4.2, 12.0 * s),
      aim: new THREE.Vector3(0.9 * s, -1.5, 3.0 * s) };
  }

  #driveCamera() {
    const cam = this.camera;
    if (!this.camFrom) {
      // Where the seat camera had got to, so the move starts from the shot the
      // player was already looking at rather than cutting.
      this.camFrom = cam.position.clone();
      this.camAim = cam.position.clone()
        .add(new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion).multiplyScalar(22));
    }
    const k = at(this.t, 0.35, 3.3);
    if (k <= 0) return;

    const { pos, aim } = this.#endPose();

    // It never quite stops: a slow drift keeps the held shot alive.
    const d = this.t * 0.11;
    pos.x += Math.sin(d) * 0.55 * k;
    pos.y += Math.cos(d * 0.8) * 0.22 * k;

    cam.position.lerpVectors(this.camFrom, pos, k);
    const look = this.camAim.clone().lerp(aim, k);
    cam.lookAt(look);
  }

  /* ------------------------------------------------------ the panel */

  #panel(state, defs, deckNames, onAgain) {
    const you = this.seat, foe = 1 - you;
    const fallen = state.players[0].graveyard.length + state.players[1].graveyard.length;
    // A deck's faction is whatever most of its cards are. Asking one card is
    // not enough: decks carry a few cards from elsewhere, and the one card you
    // happen to ask can easily be the Neutral mercenary.
    const facOf = (p) => {
      const pl = state.players[p];
      const owned = [...pl.deck, ...pl.hand, ...pl.graveyard,
        ...state.board.flat().filter((c) => c && c.owner === p)];
      const tally = {};
      for (const c of owned) {
        const f = defs[c.def]?.faction;
        if (f && f !== 'Neutral') tally[f] = (tally[f] || 0) + 1;
      }
      return Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0] || 'Neutral';
    };

    const thumbs = (cards) => cards.map((c) => defs[c.def]).filter(Boolean)
      .map((d) => ({ img: d.img, name: d.name }));
    const standing = (p) => state.board.flatMap((sq) => (sq || []).slice(0, 1))
      .filter((c) => c.owner === p);

    const winName = this.drawn ? null : deckNames[this.winnerSide];
    const loseName = this.drawn ? null : deckNames[1 - this.winnerSide];
    const epitaph = epitaphFor(state.reason, {
      won: this.won, drawn: this.drawn, foe: deckNames[foe], loserName: loseName,
    });

    let view;
    if (this.drawn) {
      view = {
        tone: 'draw',
        overline: state.winner === 'stalemate' ? 'Neither side broke' : 'The field is held by no one',
        title: state.winner === 'stalemate' ? 'Stalemate' : 'A draw',
        sub: `${state.turn} turns · ${fallen} fallen`,
        accent: FACTION_COLOUR.Neutral,
        rollTitle: 'Left on the field',
        roll: thumbs([...standing(0), ...standing(1)]).slice(0, 7),
      };
    } else if (this.won) {
      view = {
        tone: 'won',
        overline: 'The field is held',
        title: winName,
        sub: `${facOf(this.winnerSide)} · ${state.turn} turns · ${fallen} fallen`,
        accent: FACTION_COLOUR[facOf(this.winnerSide)] || FACTION_COLOUR.Neutral,
        rollTitle: 'Still standing',
        roll: thumbs(standing(this.winnerSide)).slice(0, 7),
      };
    } else {
      view = {
        tone: 'lost',
        // The loss is told about YOUR army, not theirs. It is the one that has
        // a story here; "you lose" is not one.
        overline: 'The field is lost',
        title: deckNames[you],
        sub: `${facOf(you)} · fell on the ${ORDINAL(state.turn)} turn`,
        accent: FACTION_COLOUR[facOf(you)] || FACTION_COLOUR.Neutral,
        rollTitle: 'The fallen',
        roll: thumbs(state.players[you].graveyard.slice(-7).reverse()),
        footer: `${winName} holds what is left of it.`,
      };
    }

    this.hud.showEnding({ ...view, epitaph, onAgain: () => { clearEnding(); onAgain(); } });
  }

  /* ------------------------------------------------------ teardown */

  restore() {
    if (this.done) return;
    this.done = true;

    if (this.camWasOwn) this.camera.updateMatrixWorld = this.realMatrix;
    else delete this.camera.updateMatrixWorld;
    if (this.entry) this.entry.life = this.entry.span;   // the animator drops it next frame
    if (this.anim) this.anim.fx = this.anim.fx.filter((f) => f !== this.entry);

    if (this.sun) {
      this.sun.intensity = this.was.sun;
      this.sun.color.copy(this.was.sunColour);
      this.sun.castShadow = true;
    }
    if (this.hemi) {
      this.hemi.intensity = this.was.hemi;
      this.hemi.color.copy(this.was.hemiColour);
    }
    if (this.amb) this.amb.intensity = this.was.amb;
    if (this.fog) { this.fog.density = this.was.fogDensity; this.fog.color.copy(this.was.fogColour); }
    if (this.sky) this.sky.material.color.copy(this.was.sky);
    if (this.arena.motes && this.was.moteColour) {
      this.arena.motes.material.color.copy(this.was.moteColour);
    }
    if (this.fallen) {
      this.fallen.group.position.copy(this.fallenWas.pos);
      this.fallen.group.rotation.copy(this.fallenWas.rot);
    }
    for (const c of this.cards || []) {
      c.p.animating = false;
      c.p.markers.visible = true;
      c.p.card3d.rotation.z = 0;
      c.p.frontMat.color.setScalar(1);
    }
    for (const o of this.hidden || []) o.visible = true;
    for (const o of this.added || []) {
      o.parent?.remove(o);
      o.geometry?.dispose?.();
      o.material?.dispose?.();
    }
    this.hud?.hideEnding?.();
  }
}
