// The camera leaning in, and time thickening, for the moments worth it.
//
// A fighter burning to ash or a whirlpool opening in the flagstones is the
// best thing that happens in a turn, and it was being shown at the same
// distance and the same speed as drawing a card. This pushes the camera in on
// the square and slows the clock for as long as the effect needs, then lets go.
//
// NOTHING HERE MAY TOUCH THE GAME. The engine resolves an action instantly and
// completely — that is what lets the netcode ship decisions instead of boards —
// and animations are played afterwards from a diff. So a slower clock and a
// moved camera are worth exactly nothing to the rules, and two players watching
// the same match at different zoom levels stay in lockstep. The one real cost
// is that the UI is held while the animator is busy, so a slow motif holds
// input for longer in wall-clock; that is why every duration here is short and
// why `MAX_HOLD` exists.
//
// Restraint is the whole design. A push-in that fires on every flourish is
// nausea, not drama: the rule is that a moment earns the camera by being rare.

import * as THREE from 'three';

/**
 * How far in, how slow, and for how long — per fx kind.
 *
 * Only the big ones are in this table, and that is deliberate. `cast` and the
 * everyday motifs are absent: they happen several times a turn and the camera
 * must ignore them completely or it never sits still.
 *
 *   zoom  world units of push toward the subject
 *   slow  the clock's multiplier at the bottom of the dip
 *   hold  seconds at full strength, measured in REAL time
 */
export const DRAMA = {
  // the moon turning over — four turns of waiting, and the biggest thing here
  moonrise:     { zoom: 7.0, slow: 0.30, hold: 0.95 },
  // a whirlpool hauling a fighter in to drown
  maelstrom:    { zoom: 5.0, slow: 0.42, hold: 0.45 },
  // the Shard Dragon's fire, thrown every time a fighter dies
  shardfire:    { zoom: 4.2, slow: 0.50, hold: 0.30 },
  // cards burned out of a hand and brought down on one fighter
  arcane:       { zoom: 6.0, slow: 0.36, hold: 0.70 },
  // a crystal detonation taking everything adjacent with it
  shatterblast: { zoom: 5.5, slow: 0.38, hold: 0.40 },
  // the dead getting up
  raise:        { zoom: 4.6, slow: 0.48, hold: 0.45 },
  // the bolts: a thrown cloth that wraps somebody and kills them
  bolt:         { zoom: 5.2, slow: 0.42, hold: 0.60 },
  // a soul intercepted on its way to the graveyard
  phylactery:   { zoom: 4.8, slow: 0.44, hold: 0.45 },
};

// A ceiling on how long the world may be held slow, whatever a table says.
// Wall-clock is the player's, not ours.
const MAX_HOLD = 1.2;

// Long enough after a push-in that the next one reads as a separate event
// rather than the camera juddering. Measured in real seconds.
const COOLDOWN = 1.1;

const easeOut = (t) => 1 - (1 - t) ** 3;
const easeIn = (t) => t * t;

export class Drama {
  constructor() {
    this.k = 0;                  // 0..1, how far into the push we are
    this.target = new THREE.Vector3();
    this.zoom = 0;
    this.slow = 1;
    this.phase = 'idle';         // idle | in | hold | out
    this.t = 0;
    this.hold = 0;
    this.cooling = 0;
    this.enabled = true;
    this.look = new THREE.Vector3();
  }

  /**
   * Ask for a push-in on a world point. Ignored when the feature is off, when
   * one is already running, or when the last one has not finished cooling —
   * several fighters dying at once is ONE moment, not four.
   */
  request(kind, at) {
    if (!this.enabled || !at) return;
    const d = DRAMA[kind];
    if (!d) return;
    if (this.phase !== 'idle' || this.cooling > 0) return;
    this.target.copy(at);
    this.zoom = d.zoom;
    this.slow = d.slow;
    this.hold = Math.min(d.hold, MAX_HOLD);
    this.phase = 'in';
    this.t = 0;
  }

  /** The clock multiplier the frame loop should apply to the animation. */
  get timeScale() {
    return 1 - this.k * (1 - this.slow);
  }

  /**
   * Stepped with REAL delta, never the scaled one. Tying the envelope to its
   * own output makes the tail asymptotic: the slower it gets, the slower it
   * lets go, and the camera never comes home.
   */
  update(realDt) {
    if (this.cooling > 0) this.cooling = Math.max(0, this.cooling - realDt);
    if (this.phase === 'idle') return;

    this.t += realDt;
    const IN = 0.13, OUT = 0.42;

    if (this.phase === 'in') {
      this.k = easeOut(Math.min(1, this.t / IN));
      if (this.t >= IN) { this.phase = 'hold'; this.t = 0; this.k = 1; }
      return;
    }
    if (this.phase === 'hold') {
      this.k = 1;
      if (this.t >= this.hold) { this.phase = 'out'; this.t = 0; }
      return;
    }
    // out
    this.k = 1 - easeIn(Math.min(1, this.t / OUT));
    if (this.t >= OUT) {
      this.phase = 'idle';
      this.k = 0;
      this.cooling = COOLDOWN;
    }
  }

  /**
   * Nudge the camera after the table has placed it.
   *
   * The camera is rebuilt from scratch every frame by placeCamera(), so this
   * has to run AFTER it and be a displacement rather than a state — anything
   * that tried to own camera.position outright would be overwritten before it
   * was ever drawn.
   */
  apply(camera, lookAt) {
    if (this.k <= 0.001) return false;
    const k = this.k;
    const toward = this.target.clone().sub(camera.position);
    const dist = toward.length();
    if (dist < 0.001) return false;
    toward.divideScalar(dist);
    // Never push past the subject, however big the table says the zoom is.
    camera.position.addScaledVector(toward, Math.min(this.zoom, dist * 0.55) * k);
    // Aim between where the table was looking and the subject. Not all the way:
    // swinging the whole frame onto one square loses the board, and the board
    // is what the moment is happening ON.
    this.look.lerpVectors(lookAt, this.target, k * 0.8);
    camera.lookAt(this.look);
    return true;
  }
}
