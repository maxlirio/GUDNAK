// Running card effects that have to stop and ask.
//
// "Discard X, where X is the target's power." "Choose a direction." "The
// opponent chooses two, then you choose one." "You may repeat this any number
// of times." An effect cannot be a single function call.
//
// Effects are GENERATORS. They yield a request; the driver answers it or parks
// the game on `state.pending`. Because a paused generator cannot be serialised
// (and the netcode has to survive a reload), a pending effect stores a snapshot
// of the state from BEFORE it started plus the answers so far; each new answer
// re-runs the whole effect from that snapshot, feeding the recorded answers
// back in. Effects must therefore be deterministic given their answers — which
// they are, because every random choice goes through the seeded rng in state.

export const PENDING = Symbol('pending');

// `derived` holds live predicates (blockEnter, cannotAttack, extraDeploy), so it
// cannot be cloned — and must not be, because it is recomputed from the board
// every time anyway. Same for defs and impls, which are shared and immutable.
const NOT_CLONED = ['defs', 'impls', 'derived'];

function snapshot(state) {
  const rest = {};
  for (const k of Object.keys(state)) if (!NOT_CLONED.includes(k)) rest[k] = state[k];
  return structuredClone(rest);
}

function restore(state, snap, refresh) {
  const keep = {};
  for (const k of NOT_CLONED) keep[k] = state[k];
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, structuredClone(snap));
  for (const k of NOT_CLONED) if (keep[k] !== undefined) state[k] = keep[k];
  refresh?.(state);
}

/**
 * Run an effect to completion, or park it awaiting an answer.
 *
 * `descriptor` is a small serialisable thing that says which effect this is, so
 * it can be found again on resume: {kind, uid, index, ...}.
 */
export function runEffect(state, descriptor, makeGenerator, answers = []) {
  const snap = snapshot(state);
  return drive(state, descriptor, makeGenerator, answers, snap);
}

function drive(state, descriptor, makeGenerator, answers, snap) {
  const gen = makeGenerator();
  let i = 0;
  let sent;

  for (;;) {
    // A pending effect RE-RUNS from its snapshot every time it is answered,
    // feeding the recorded answers back in. Everything that happens during
    // that replay has happened before, so the notes it leaves for the view
    // must not be left again — Sentence branded its first victim once when you
    // picked them and a second time when you picked the next.
    state.replaying = i < answers.length;
    const step = gen.next(sent);
    state.replaying = false;
    if (step.done) {
      delete state.pending;
      return { done: true, value: step.value };
    }
    const request = step.value;

    if (i < answers.length) {
      sent = answers[i++];
      continue;
    }

    // Nothing left to feed: park and wait for a real answer.
    //
    // A request with NO options is answered null immediately, whether or not it
    // is "required" — there is nothing to choose, and parking on it means the
    // effect re-runs from its snapshot and asks the same impossible question
    // forever, which is exactly what Empty Crypt did with an empty Graveyard.
    if (request.options && request.options.length === 0) {
      sent = null;
      i++;
      answers.push(null);
      continue;
    }

    state.pending = { descriptor, answers: [...answers], request, snapshot: snap };
    return { done: false, pending: request };
  }
}

/** Answer the outstanding request and carry on. */
export function answerPending(state, answer, resolveDescriptor, refresh) {
  const p = state.pending;
  if (!p) throw new Error('nothing is waiting for an answer');

  const answers = [...p.answers, answer];
  const snap = p.snapshot;
  restore(state, snap, refresh);

  const made = resolveDescriptor(state, p.descriptor);
  if (!made) { delete state.pending; return { done: true }; }
  return drive(state, p.descriptor, made, answers, snap);
}

/* ------------------------------------------------------------ requests */
//
// The vocabulary an effect can ask in. Each is a plain object so it can cross
// the wire and be rendered by the table.

export const ask = {
  /** Pick one of `options` (uids or squares). */
  one: (options, { prompt = '', kind = 'target', required = true, allowNone = false } = {}) =>
    ({ type: 'one', kind, options, prompt, required: required && !allowNone, allowNone }),

  /** Pick exactly / up to `count` of `options`. */
  some: (options, count, { prompt = '', exact = true, kind = 'target' } = {}) =>
    ({ type: 'some', kind, options, count, exact, prompt, required: exact }),

  /** A named choice from a fixed list, e.g. a trait or a direction. */
  pick: (options, { prompt = '' } = {}) =>
    ({ type: 'pick', kind: 'option', options, prompt, required: true }),

  /** Yes or no — "you may". */
  confirm: (prompt = '') => ({ type: 'confirm', kind: 'confirm', prompt, required: false }),

  /** Which player must answer, when it is not the active one. */
  by: (player, request) => ({ ...request, player }),
};
