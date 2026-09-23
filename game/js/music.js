// The soundtrack.
//
// Three CC0 tracks, chosen to sit under a slow game rather than on top of it,
// and mapped to the three things the game is ever doing:
//
//   lobby   The Old Tower Inn      RandomMind        a room before the fight
//   battle  Forgotten Tomb         kindland          the ruin itself, on a loop
//   ending  Breves Dies Hominis    Magdalen Kadel    a 13th-century Latin solo
//
// All three are CC0 / public domain from OpenGameArt, so nothing here is
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
//   Audio is only fetched when it is wanted. The three files are 6.7MB and
//   most of the page's weight — a player who has muted the music should never
//   pay for them, so the element's `src` is not set until it is time to play.

const TRACKS = {
  lobby:  { src: 'audio/tavern.mp3', gain: 0.55 },
  battle: { src: 'audio/ruin.mp3',   gain: 0.42 },
  ending: { src: 'audio/dirge.mp3',  gain: 0.60 },
};

// Per-track gain exists because loudness-matching the files got them within a
// stone's throw of each other and no closer: the tomb is a wash and the Latin
// solo is a voice, and a voice at the same measured loudness as a drone is
// louder to a listener.

const STORE = 'gudnak.music';
const FADE = 1.6;          // seconds, and the same both ways
const DUCK = 0.35;         // what the volume drops TO under a big effect

export class Music {
  constructor(base = '') {
    this.base = base;
    this.want = null;          // the track that SHOULD be playing
    this.cur = null;           // the name actually loaded
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

  /** Ask for a track by name. Same name twice is a no-op, not a restart. */
  play(name) {
    if (!TRACKS[name] || this.want === name) return;
    this.want = name;
    this.#apply();
  }

  stop() { this.want = null; this.#apply(); }

  setMuted(on) {
    this.muted = !!on;
    save({ volume: this.volume, muted: this.muted });
    this.#apply();
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
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
          // A faded-out element is released, not left holding a stream: an
          // ended track that nobody is listening to is still a download.
          if (f.to <= 0.001) { f.el.pause(); f.el.removeAttribute('src'); f.el.load(); }
          return false;
        }
        return true;
      });
    }
    // The duck is a target, not a fade, so it can be re-armed mid-dip.
    const target = this.#target();
    const el = this.live;
    if (el && !this.fades.some((f) => f.el === el)) {
      const step = Math.min(1, dt * 3);
      el.volume = clamp(el.volume + (target - el.volume) * step);
    }
  }

  /* ------------------------------------------------------------ private */

  #target() {
    if (this.muted || !this.cur) return 0;
    const g = TRACKS[this.cur]?.gain ?? 0.5;
    const duck = now() < this.duckUntil ? DUCK : 1;
    return clamp(this.volume * g * duck);
  }

  #apply() {
    if (this.muted || this.want === null) {
      if (this.cur) this.#fadeOut(this.live);
      this.cur = null;
      return;
    }
    // Armed but not yet woken: remember what to start with and wait.
    if (this.armed) return;
    if (this.cur === this.want) return;

    const next = this.live === this.a ? this.b : this.a;
    const track = TRACKS[this.want];
    next.src = this.base + track.src;
    next.volume = 0;
    next.loop = true;
    const started = next.play();
    // A rejected play() is the autoplay policy, not a broken file. Re-arm and
    // wait for a gesture rather than leaving the game silent for good.
    if (started && started.catch) {
      started.catch(() => { this.armed = true; this.cur = null; });
    }

    if (this.cur) this.#fadeOut(this.live);
    this.fades.push({ el: next, from: 0, to: this.#targetFor(this.want), t: 0 });
    this.live = next;
    this.cur = this.want;
  }

  #targetFor(name) {
    const g = TRACKS[name]?.gain ?? 0.5;
    return clamp(this.volume * g);
  }

  #fadeOut(el) {
    if (!el || !el.src) return;
    this.fades = this.fades.filter((f) => f.el !== el);
    this.fades.push({ el, from: el.volume, to: 0, t: 0 });
  }
}

/* ---------------------------------------------------------------- bits */

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
