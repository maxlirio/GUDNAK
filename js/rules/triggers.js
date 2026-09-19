// The trigger bus.
//
// More than half the pool fires on an event rather than on an action. Two kinds
// exist and they are genuinely different:
//
//   listeners   run AFTER the thing happened, and may queue effects.
//   replacements  run INSTEAD of it, and return a new outcome. Phylactery,
//                 Empty Crypt, Jagged Rocks and the Traps all need this — they
//                 do not append to an event, they intercept it.
//
// Effects raised by a trigger are queued rather than run inline, so a card
// cannot mutate the board out from under the loop that is walking it.

import { allInPlay } from './derive.js';

export const EVENTS = [
  'onDeploy',          // {card, square}
  'afterMove',         // {card, from, to}
  'afterRelocate',     // {card, from, to}
  'afterEnter',        // {card, square}  — move OR relocate OR deploy
  'afterAttack',       // {attacker, defender, result}
  'afterDestroy',      // {card, by, square}
  'afterDefend',       // {player, card}
  'startOfTurn',       // {player}
  'endOfTurn',         // {player}
  'afterPlayTactic',   // {card}
  'afterAttachmentPlayed', // {attachment, host}
  'afterToHand',       // {card, from}  — NOT from a draw
  'afterAbility',      // {source, index, name} — an Action ability finished
];

/** Everything in play that might listen, top-of-stack first. */
function* listenersFor(state, impls, event) {
  for (const entry of allInPlay(state)) {
    const impl = impls[entry.card.def];
    // a covered Construct is switched off, like its constant abilities
    if (entry.covered && !impl?.whileCovered) continue;
    const fn = impl?.on?.[event];
    if (fn) yield { fn, entry, impl };
  }
  // attachments listen through their host
  for (const entry of allInPlay(state)) {
    for (const a of entry.card.attachments || []) {
      const impl = impls[a.def];
      const fn = impl?.on?.[event];
      if (fn) yield { fn, entry: { ...entry, card: a, host: entry.card }, impl };
    }
  }
}

/**
 * Fire an event. Any effect a listener wants to run is pushed onto
 * `state.queue` as a descriptor, and the engine drains it between actions.
 */
export function emit(state, impls, event, payload = {}) {
  for (const { fn, entry } of listenersFor(state, impls, event)) {
    try {
      (state.implsUsed ||= {})[entry.card.def] = true;
      fn({ state, self: entry.card, host: entry.host, square: entry.square, ...payload });
    } catch (e) {
      (state.triggerErrors ||= []).push(`${entry.card.def}/${event}: ${e.message}`);
    }
  }
}

/**
 * Ask whether anything replaces this outcome.
 * Returns the (possibly rewritten) outcome; a replacement returns a new one.
 */
export function replace(state, impls, event, outcome) {
  for (const entry of allInPlay(state)) {
    if (entry.covered && !impls[entry.card.def]?.whileCovered) continue;
    const fn = impls[entry.card.def]?.replace?.[event];
    if (!fn) continue;
    try {
      (state.implsUsed ||= {})[entry.card.def] = true;
      const next = fn({ state, self: entry.card, square: entry.square, outcome });
      if (next !== undefined && next !== null) outcome = next;
    } catch (e) {
      (state.triggerErrors ||= []).push(`${entry.card.def}/replace:${event}: ${e.message}`);
    }
  }
  return outcome;
}

/**
 * Traps, which go off BEFORE the intruder arrives.
 *
 * "It is Triggered at the start of your turn or BEFORE an enemy fighter enters
 * this square." The word before is the whole card: an Explosive Trap destroys
 * everything ADJACENT to it, so if the fighter has already stepped on, it is
 * not adjacent any more — and worse, standing on a Construct destroys it, so
 * the trap was swept into the graveyard without ever going off.
 *
 * Returns true if the entry must be cancelled — the intruder was killed, or
 * the Construct now forbids it.
 */
export function springTraps(state, to, mover) {
  if (!mover || to == null || state.springing) return false;
  const impls = state.impls || {};
  let cancelled = false;

  state.springing = true;
  try {
    for (const con of [...(state.constructs || [])]) {
      if (!con || con.square !== to || con.owner === mover.owner) continue;
      const fn = impls[con.def]?.onIntrusion;
      if (!fn) continue;
      try {
        if (fn({ state, self: con, card: mover })) cancelled = true;
      } catch (e) {
        (state.triggerErrors ||= []).push(`${con.def}/intrusion: ${e.message}`);
      }
    }
  } finally {
    delete state.springing;
  }
  return cancelled;
}

/** Queue an effect to run once the current action finishes. */
export function queueEffect(state, descriptor) {
  (state.queue ||= []).push(descriptor);
}
