// The soundtrack.
//
// Five CC0 tracks, chosen to sit under a slow game rather than on top of it.
// The lobby and the endings play one piece; BATTLE PLAYS A SEQUENCE, for the
// reason written above STATES below.
//
//   lobby   The Old Tower Inn      RandomMind        a room before the fight
//   battle  Forgotten Tomb         kindland          the ruin itself
//           Col Legno              Vehicle           foreboding, orchestral
//           Medieval: Battle       RandomMind        drums and strings
//   ending  Breves Dies Hominis    Magdalen Kadel    a 13th-century Latin solo
//
// All five are CC0 / public domain from OpenGameArt, so nothing here is
// anybody's to withhold. See site/audio/CREDITS.md, which names the authors
// anyway — CC0 asks for nothing and they are owed it regardless.
//
// HTMLAudioElement rather than Web Audio, deliberately. This needs streaming,
// gapless-enough looping and a volume ramp, and that is all; decoding three
// minutes of MP3 into an AudioBuffer to get a gain node would cost tens of
// megabytes of RAM for a fade this does in four lines.
//
// TWO RULES THE BROWSER IMPOSES, and both shape the design:
//
//   Nothing may play until the user has interacted with the page. So the
//   first track is armed and waits, and the first real click starts it. A
//   game that silently fails to play music looks broken; one that starts on
//   the first click reads as deliberate.
//
//   Audio is only fetched when it is wanted. The five files are 8.4MB and by
//   far the page's heaviest asset — a player who has muted the music should
//   never pay for them, and a game that never reaches an ending should never
//   fetch the ending. So no `src` is set until that track is actually next.

const FILES = {
  tavern: 'audio/tavern.mp3',   // The Old Tower Inn      RandomMind
  ruin:   'audio/ruin.mp3',     // Forgotten Tomb         kindland
  march:  'audio/march.mp3',    // Col Legno              Vehicle
  clash:  'audio/clash.mp3',    // Medieval: Battle       RandomMind
  dirge:  'audio/dirge.mp3',    // Breves Dies Hominis    Magdalen Kadel
};

/**
 * What each part of the game plays, as a SEQUENCE rather than a track.
 *
 * Battle is the reason this exists. One ambient loop under a twenty-minute
 * game is not a score, it is a room tone, and the player's verdict on it was
 * "listening to rocks and chains slide across each other for 20 minutes might
 * be aggravating" — which is right, and is what an ambient bed does when it
 * is asked to carry the whole thing on its own.
 *
 * So the tomb is still the ground the game sits on, but it ALTERNATES with
 * two pieces of actual music, and never two of those in a row: you come back
 * to the ambience after each one, which is what keeps it the home key rather
 * than the whole key. A full cycle is a little under ten minutes, so a normal
 * game hears each piece about twice and no piece twice running.
 *
 * A one-entry sequence loops forever, which is right for a lobby nobody sits
 * in for long and for an ending that holds until you leave it.
 */
const STATES = {
  lobby:  { seq: ['tavern'], gain: 0.55 },
  battle: { seq: ['ruin', 'march', 'ruin', 'clash'], gain: 0.42 },
  ending: { seq: ['dirge'], gain: 0.60 },
};

// Trim per track, applied on top of the state's gain. Loudness-matching got
// the files to the same MEASURED level, which is not the same as sounding
// equally loud: a drone and an orchestra at -18 LUFS are not the same
// presence, and the two written pieces have to sit under the drone rather
// than announce themselves over it.
const TRIM = { tavern: 1, ruin: 1, march: 0.82, clash: 0.78, dirge: 1 };

const STORE = 'gudnak.music';
const FADE = 1.6;          // seconds, and the same both ways
const DUCK = 0.35;         // what the volume drops TO under a big effect

export class Music {
  constructor(base = '') {
    this.base = base;
    this.state = null;         // 'lobby' | 'battle' | 'ending'
    this.idx = 0;              // where we are in that state's sequence
    this.cur = null;           // the FILE key actually loaded
    this.armed = false;        // waiting for the first gesture
    this.duckUntil = 0;
    this.fades = [];

    const saved = readSaved();
    this.volume = saved.volume;
    this.muted = saved.muted;

    // Two elements so one can come up while the other goes down. A single
    // element cannot cross-fade with itself.
    this.a = makeEl();
    this.b = makeEl();
    this.live = this.a;

    // The first gesture anywhere starts whatever is waiting. `once` per event
    // so this costs nothing after it has fired.
    const wake = () => { this.armed = false; this.#apply(); };
    for (const ev of ['pointerdown', 'keydown', 'touchstart']) {
      addEventListener(ev, wake, { once: true, passive: true });
    }
  }

  /** Ask for a part of the game. Same one twice is a no-op, not a restart. */
  play(state) {
    if (!STATES[state] || this.state === state) return;
    this.state = state;
    this.idx = 0;              // every state opens on its own first track
    this.#apply();
  }

  stop() { this.state = null; this.#apply(); }

  setMuted(on) {
    this.muted = !!on;
    save({ volume: this.volume, muted: this.muted });
    this.#apply();
  }

  setVolume(v) {
    this.volume = clamp(v);
    save({ volume: this.volume, muted: this.muted });
    this.#apply();
  }

  /**
   * Pull the music down for a moment so something loud can be heard over it.
   * Called by the table when the camera leans in on a big effect — the same
   * moments, so the score gets out of the way of exactly the things that
   * earned the camera.
   */
  duck(seconds = 1.2) {
    this.duckUntil = Math.max(this.duckUntil, now() + seconds);
  }

  /** Stepped from the frame loop with REAL time. */
  update(dt) {
    if (this.fades.length) {
      this.fades = this.fades.filter((f) => {
        f.t += dt;
        const k = Math.min(1, f.t / FADE);
        f.el.volume = clamp(f.from + (f.to - f.from) * k);
        if (k >= 1) {
          // A faded-out element is released, not left holding a stream: a
          // track nobody is listening to is still a download.
          if (f.to <= 0.001) release(f.el);
          return false;
        }
        return true;
      });
    }

    // The duck is a target, not a fade, so it can be re-armed mid-dip.
    const el = this.live;
    if (el && !this.fades.some((f) => f.el === el)) {
      const step = Math.min(1, dt * 3);
      el.volume = clamp(el.volume + (this.#target() - el.volume) * step);
    }

    this.#advance();
  }

  /* ------------------------------------------------------------ private */

  /**
   * Hand over to the next track in the sequence BEFORE the current one runs
   * out, so the crossfade happens over real music at both ends rather than
   * over a second and a half of silence at the tail.
   *
   * A single-track state loops instead and never gets here — `duration` on a
   * looping element still reports the file's length, so without that guard
   * the lobby would try to advance to itself every pass.
   */
  #advance() {
    const seq = STATES[this.state]?.seq;
    if (!seq || seq.length < 2 || this.armed) return;
    const el = this.live;
    if (!el || !el.src || el.paused) return;
    const len = el.duration;
    if (!Number.isFinite(len) || len <= 0) return;   // metadata not in yet
    if (len - el.currentTime > FADE) return;
    this.idx = (this.idx + 1) % seq.length;
    this.#start(seq[this.idx]);
  }

  #target() {
    if (this.muted || !this.cur) return 0;
    const duck = now() < this.duckUntil ? DUCK : 1;
    return clamp(this.volume * this.#gainFor(this.cur) * duck);
  }

  #gainFor(file) {
    const g = STATES[this.state]?.gain ?? 0.5;
    return g * (TRIM[file] ?? 1);
  }

  #apply() {
    if (this.muted || this.state === null) {
      if (this.cur) this.#fadeOut(this.live);
      this.cur = null;
      return;
    }
    if (this.armed) return;                  // woken by the first gesture
    const want = STATES[this.state].seq[this.idx];
    if (this.cur === want) return;
    this.#start(want);
  }

  #start(file) {
    const seq = STATES[this.state]?.seq;
    const next = this.live === this.a ? this.b : this.a;
    next.src = this.base + FILES[file];
    // Explicit, though setting `src` is supposed to do it: these two elements
    // are reused for the whole session, and an element that came back round
    // still holding the position it was released at hands the sequence a
    // track that is already over, which advances again immediately and every
    // frame after that.
    try { next.currentTime = 0; } catch { /* before metadata; harmless */ }
    next.volume = 0;
    // Only a state with ONE track loops. The rest hand on, and a looping
    // element would never reach an end to hand on from.
    next.loop = !seq || seq.length < 2;
    const started = next.play();
    // A rejected play() is the autoplay policy, not a broken file. Re-arm and
    // wait for a gesture rather than leaving the game silent for good.
    if (started && started.catch) {
      started.catch(() => { this.armed = true; this.cur = null; release(next); });
    }

    if (this.cur) this.#fadeOut(this.live);
    this.fades.push({ el: next, from: 0, to: clamp(this.volume * this.#gainFor(file)), t: 0 });
    this.live = next;
    this.cur = file;
  }

  #fadeOut(el) {
    if (!el || !el.src) return;
    this.fades = this.fades.filter((f) => f.el !== el);
    this.fades.push({ el, from: el.volume, to: 0, t: 0 });
  }
}

/* ---------------------------------------------------------------- bits */

/** Let go of a stream entirely — pausing alone leaves the download held. */
function release(el) {
  el.pause();
  el.removeAttribute('src');
  el.load();
}

function makeEl() {
  const el = new Audio();
  el.preload = 'none';        // nothing is fetched until a src is set
  el.loop = true;
  el.volume = 0;
  return el;
}

const clamp = (v) => Math.max(0, Math.min(1, v));
const now = () => performance.now() / 1000;

function readSaved() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) || '{}');
    return {
      volume: typeof raw.volume === 'number' ? clamp(raw.volume) : 0.7,
      muted: !!raw.muted,
    };
  } catch { return { volume: 0.7, muted: false }; }
}

function save(state) {
  try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* private mode */ }
}
