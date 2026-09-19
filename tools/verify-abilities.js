// Does each card DO what it SAYS?
//
//   node tools/verify-abilities.js              # every card
//   node tools/verify-abilities.js --card A029  # one card, with a trace
//   node tools/verify-abilities.js --verbose    # show passes and skips too
//
// The playtest harness proves the engine never reaches an illegal state. It
// cannot prove that Fire Bolt only hits things next to it, because a Fire Bolt
// that hits the whole table is a perfectly legal state.
//
// So this reads the PRINTED TEXT of every ability, turns the parts of it that
// are mechanically checkable into claims — "targets must be adjacent", "targets
// must be enemies", "something must be destroyed" — and then plays the ability
// for real, through the same entry points the game uses, in an arena built so
// that every claim has something to be WRONG about. An arena where every enemy
// happens to be adjacent cannot catch a missing adjacency filter, so the arena
// deliberately contains fighters that must NOT be offered, and a claim with no
// counter-example in reach is reported as vacuous rather than passed.
//
// Three verdicts, and the distinction matters:
//   FAIL      the ability was played and did something its text forbids
//   PASS      the claim was checked against a real counter-example and held
//   UNCHECKED the claim could not be exercised — said out loud, not hidden

import { readFileSync } from 'node:fs';
import {
  createGame, refresh, legalActions, apply, choose, powerOf, traitsFor,
  actionAbilitiesOf, VOID, distance, defOf,
} from '../js/engine.js';
import { CARDS } from '../js/rules/cards.js';
import { ask } from '../js/rules/driver.js';
import { targets, uids } from '../js/rules/target.js';
import { derive } from '../js/rules/derive.js';
import * as ops from '../js/rules/ops.js';

const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const ONLY = arg('--card', null);
const VERBOSE = argv.includes('--verbose');
const SELFTEST = argv.includes('--selftest');

const data = JSON.parse(readFileSync('game/data/decks.json', 'utf8'));
const { defs, decks } = data;

/* ==================================================================== */
/* Reading the printed text                                             */
/* ==================================================================== */

const TRAITS = ['Brute', 'Soldier', 'Hunter', 'Hero', 'Demon', 'Shadow', 'Token'];
const ROMAN = { I: 1, II: 2, III: 3, IV: 4 };

/**
 * Turn one ability's text into checkable claims.
 *
 * Deliberately conservative. A claim is only emitted when the wording leaves no
 * room for another reading — a false alarm here costs more attention than a
 * missed check, because the whole point is that nobody has hours to spend.
 */
function readClaims(text, kind) {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  const claims = [];
  const add = (type, extra = {}) => claims.push({ type, text: t, ...extra });
  const has = (re) => re.test(t);

  // ---- who may be picked -------------------------------------------------
  // "target adjacent friendly fighter", "destroy an adjacent I or II"
  //
  // Three wordings look like an adjacency restriction and are not: NON-adjacent
  // (Elven Ranger), adjacency measured from something other than the source
  // ("adjacent to that enemy" — Detached Shadow), and text that merely talks
  // about squares next to a fighter ("are considered your Gates").
  const anchoredElsewhere =
    /adjacent to (that|target|the|an|another|its|their|each|them|it|him|her)\b/i;
  if (has(/\badjacent\b/i)
      && !has(/\bnon-?adjacent\b/i)
      && !has(/adjacent to (The Void|it|this fighter|them) are considered/i)) {
    // "underneath an adjacent Hero you control" is adjacency between two things
    // the player picks, not adjacency to a source square. A Tactic has no
    // square of its own, so that is the only reading available to it.
    add(anchoredElsewhere.test(t) || kind === 'play' ? 'adjacentPair' : 'adjacent');
  }

  // The side restriction has to attach to the TARGET, not merely appear in the
  // sentence: "target other fighter adjacent to that enemy" targets anyone.
  const namesBoth = /friendly/i.test(t) && /enemy/i.test(t);
  const targetsOther = /target (an?o?ther|other) fighter/i.test(t);
  // "target opponent's deck" picks a DECK. Reading it as a restriction on
  // which fighters may be chosen judges a question the card never asks.
  const targetsDeck = /target (an? )?(opponent'?s|player'?s|your) deck/i.test(t);
  if (!namesBoth && !targetsOther && !targetsDeck) {
    if (has(/\btarget (adjacent |another |an? )?(enemy|opponent'?s)\b/i)
        || has(/\bdestroy (target |all |any |each |an? )?(adjacent )?enem/i)
        || has(/\b(an?|all|each|target) enemy (fighter|Shadow|Soldier|Brute|Hunter|Demon|construct)/i))
      add('enemyOnly');
    if (has(/\btarget (adjacent )?friendly\b/i)
        || has(/\btarget \w+ you control\b/i)
        || has(/\b(a|target) (Shadow|fighter) you control\b/i))
      add('friendlyOnly');
  }

  // "a I", "target II or III", "a I or II" — power bands, printed as pips
  // Longest alternative first, with a boundary after BOTH numerals — ordered
  // the other way, "I or II" reads as "I or I" and the band comes out too tight.
  const band = t.match(/\b(IV|III|II|I)\b(?: or (IV|III|II|I)\b)?/);
  if (band && !targetsDeck
      && /\b(target|a|an|another|each|all|destroy|put|relocate|deploy)\b/i.test(t)) {
    const a = ROMAN[band[1]], b = band[2] ? ROMAN[band[2]] : null;
    if (b != null) add('powerMax', { max: Math.max(a, b) });
    else if (/\bor (less|fewer)\b/i.test(t)) add('powerMax', { max: a });
    else if (!/\bor (more|greater)\b/i.test(t)) add('powerExact', { power: a });
  }

  for (const tr of TRAITS) {
    const m = t.match(new RegExp(`\\b(target|a|an|all|each|another) ${tr}s?\\b`));
    if (!m) continue;
    // "If that fighter was a Hunter, you may draw" restricts the BONUS, not the
    // target — the fighter was already chosen by then.
    const before = t.slice(0, m.index);
    if (/\bif\b[^.]*$/i.test(before)) continue;
    // "this fighter gains Hunter" hands out a trait; it does not restrict one
    if (/\b(gains?|has|have|considered)\s*$/i.test(before)) continue;
    add('trait', { trait: tr });
    break;
  }

  // ---- where they may be picked from ------------------------------------
  if (has(/\bfrom your Graveyard\b/i)) add('zone', { zone: 'graveyard' });
  if (has(/\bin The Void\b/i)
      && !/\b(this fighter|it) is in The Void/i.test(t)) add('zone', { zone: 'void' });
  if (has(/\bin your Back Row\b/i)) add('zone', { zone: 'backRow' });

  // ---- what must happen --------------------------------------------------
  //
  // "you may" makes an effect optional; "If ..." makes it conditional on
  // something the arena may not have arranged; "cannot Move" is a prohibition,
  // not an instruction. None of the three can be failed for not happening.
  const may = /\byou may\b/i.test(t) || /\bif\b/i.test(t)
    || /\bmay (instead |also )?\w+/i.test(t);
  const forbids = (verb) => new RegExp(`\\b(cannot|can't|may not|do(es)? not) [^.]*\\b${verb}`, 'i').test(t);
  if (has(/\bdestroy\b/i) && !forbids('destroy')) add('effect', { effect: 'destroy', may });
  if (has(/\bdraw\b/i) && !forbids('draw')) add('effect', { effect: 'draw', may });
  if (has(/\bdiscard\b/i) && !forbids('discard')) add('effect', { effect: 'discard', may });
  if (has(/\b(into (your|their owners'?|his|her) hands?|into your hand)\b/i))
    add('effect', { effect: 'toHand', may });
  if (has(/\b(relocate|move)\b/i) && kind !== 'constant' && !forbids('(Move|relocat)'))
    add('effect', { effect: 'relocate', may });
  if (has(/\bdeploy\b/i) && kind !== 'constant' && !forbids('Deploy'))
    add('effect', { effect: 'deploy', may });
  if (has(/\bfatigue\b/i) && !has(/\bnot fatigued\b/i) && !forbids('fatigue'))
    add('effect', { effect: 'fatigue', may });
  if (has(/\bunfatigue\b|\bready\b/i)) add('effect', { effect: 'unfatigue', may });
  if (has(/gain an additional action/i)) add('effect', { effect: 'action', may });

  return claims;
}

/* ==================================================================== */
/* The arena                                                             */
/* ==================================================================== */
//
// Actor sits on the centre square, so adjacency has a clear inside and a clear
// outside: 1, 3, 5, 7 and The Void are next to it; 0, 2, 6 and 8 are not.
//
//        0 enemy I         1 friendly II     2 (empty)        <- my Back Row
//        3 enemy I         4 ACTOR           5 enemy II
//        6 enemy III       7 (empty)         8 friendly I      <- their Back Row
//        Void: one friendly, one enemy
//
// Every restriction a card can print has both a right and a wrong answer in
// reach: enemies adjacent (3, 5) and not (0, 6); friendlies adjacent (1) and
// not (8); an enemy inside MY Back Row (0); an empty square that is adjacent
// (7, which is also their Gates) and one that is neither (2); powers I, II and
// III; the traits Soldier, Brute, Hunter, Demon and Shadow; and both a friend
// and an enemy in The Void.

/**
 * Fighters to furnish the arena with.
 *
 * Inert ones are preferred, so the arena adds no rules of its own — but the
 * inert pool only contains Brutes, Soldiers and Hunters. Asking it for a Shadow
 * or a Hero used to hand back a plain Soldier without a word, which is why
 * every card that needs a Shadow on the board reported "not usable here": the
 * board never had one. So when no inert card carries the trait, one that has an
 * implementation is used, preferring cards with no constant ability — those sit
 * quietly until something uses them.
 */
const ALL_FIGHTERS = Object.values(defs)
  .filter((d) => d.type === 'fighter' && d.realType === 'fighter' && d.power);

function filler(power, trait = null, alsoTrait = null) {
  // `alsoTrait` is a PREFERENCE, not a requirement: several Attachments want a
  // friendly Soldier and the arena's only back-row friendly was a Hero, so
  // there was nothing legal to attach them to.
  if (alsoTrait) {
    const both = ALL_FIGHTERS.find((d) => d.power === power
      && (d.traits || []).includes(trait) && (d.traits || []).includes(alsoTrait));
    if (both) return both;
  }
  const has = (d) => !trait || (d.traits || []).includes(trait);
  const tiers = [
    (d) => !CARDS[d.id],                                   // inert
    (d) => CARDS[d.id] && !CARDS[d.id].constant && !CARDS[d.id].on,  // quiet
    (d) => !CARDS[d.id]?.on?.afterAbility,                 // anything but a mimic
    () => true,
  ];
  for (const tier of tiers) {
    const hit = ALL_FIGHTERS.find((d) => d.power === power && has(d) && tier(d));
    if (hit) return hit;
  }
  // No card of that power carries the trait at all — take the trait over the
  // power, and say so rather than quietly furnishing the wrong thing.
  // Twain of Twine copies whatever ability anything else resolves, which makes
  // it the worst possible scenery: the questions it asks belong to the card it
  // is copying, measured from ITS square, and every targeting claim reads as
  // broken. Furniture must not join in.
  const anyTrait = ALL_FIGHTERS.find((d) => has(d) && !CARDS[d.id]?.on?.afterAbility);
  if (trait && anyTrait) return anyTrait;
  return ALL_FIGHTERS.find((d) => d.power === power) || ALL_FIGHTERS[0];
}

function makeCard(state, def, owner) {
  return {
    uid: ++state.nextUid, def: def.id, owner,
    fatigued: false, attachments: [],
  };
}

function baseGame(seed = 7) {
  const a = decks[0], b = decks[1];
  const st = createGame({
    seed, defs, impls: CARDS,
    decks: [a.cards, b.cards],
    strongholds: [a.stronghold || null, b.stronghold || null],
    first: 0,
  });
  // The Void has to exist for anything that reads or writes it.
  st.locations.void = true;
  st.board[VOID] = [];
  return st;
}

function stageArena(st, variant = 'spread') {
  const put = (sq, power, owner, trait, alsoTrait) => {
    const c = makeCard(st, filler(power, trait, alsoTrait), owner);
    st.board[sq] = [c];
    return c;
  };
  st.board = Array.from({ length: 9 }, () => []);
  st.board[VOID] = [];
  st.constructs = [];

  // "Put a Construct from your deck or Graveyard into your hand" needs a
  // Construct to be there in the first place; a Graveyard of plain fighters
  // makes half the search effects look broken when they are not.
  const sample = (type) => Object.values(defs).find((d) => (d.realType || d.type) === type
    && !CARDS[d.id]) || Object.values(defs).find((d) => (d.realType || d.type) === type);

  const marks = {};
  marks.enemyInMyBackRow = put(0, 1, 1, 'Soldier');
  // A Hero on your side, because eight cards say "a Hero you control" and the
  // arena had none — and a Shadow on the board, because a dozen more need one.
  marks.friendHero = put(1, variant === 'dense' ? 1 : 2, 0, 'Hero', 'Soldier');
  marks.friendNear = marks.friendHero;
  marks.enemyNear1 = put(3, 1, 1, 'Soldier');
  marks.enemyNear2 = put(5, variant === 'dense' ? 1 : 2, 1, 'Hunter');
  marks.enemyFar3 = put(6, 3, 1, 'Brute');
  marks.friendHunter = put(8, 1, 0, 'Hunter');
  marks.friendFar = marks.friendHunter;

  // A second arena, because a third of the pool talks about STACKS — "another
  // fighter in this stack", "target enemy stack", "without its stack" — and a
  // board of lone fighters cannot exercise any of it. Every square adjacent to
  // a landing spot also holds a I here, so unconditional "destroy all adjacent
  // Is" effects have something to destroy.
  // In the Void arena the actor stands on top of the Void stack, which hides
  // the Shadow underneath it — and square 4 is free, because the actor is not
  // on it. "Destroy all Shadows" needs one it can actually see.
  if (variant === 'void') {
    marks.shadowOnTop = makeCard(st, filler(1, 'Shadow'), 0);
    st.board[4] = [marks.shadowOnTop];
  }

  if (variant === 'dense') {
    // The stack sits at 5, not 3, because 3 is boxed in — "move to an
    // unoccupied square adjacent to target enemy stack" needs the stack to
    // HAVE an empty neighbour, or the card looks broken when the board is.
    st.board[5] = [makeCard(st, filler(1, 'Soldier'), 1), makeCard(st, filler(2, 'Hunter'), 1)];
    marks.enemyStack = 5;
    marks.buriedEnemy = makeCard(st, filler(1, 'Demon'), 1);
    marks.buriedFriend = makeCard(st, filler(1, 'Brute'), 0);
  }
  // A Construct of your own in play, an Attachment already attached, and a
  // friendly Shadow buried in a stack. Without these, "squares containing your
  // Constructs", "fighters with an Attachment you control" and "Shadows you
  // control may act within a stack" all read as dead cards when they are not.
  const constructDef = sample('construct');
  if (constructDef) {
    marks.myConstruct = { ...makeCard(st, constructDef, 0), square: 7 };
    st.constructs.push(marks.myConstruct);
  }
  const attachDef = sample('attachment');
  if (attachDef) {
    const att = makeCard(st, attachDef, 0);
    att.attachedTo = marks.friendHunter.uid;
    marks.friendHunter.attachments.push(att);
    marks.myAttachment = att;
  }
  marks.buriedShadow = makeCard(st, filler(1, 'Shadow'), 0);
  marks.friendShadow = marks.buriedShadow;
  // An ENEMY inside a friendly stack, because several cards reach into one —
  // "destroy any enemy fighter in target friendly stack" has nothing to find
  // on a board where every stack is all one colour.
  marks.buriedEnemyInMyStack = makeCard(st, filler(1, 'Soldier'), 1);
  st.board[8].push(marks.buriedShadow, marks.buriedEnemyInMyStack);

  // The Void gets one of each, so "in The Void" has both a right and a wrong answer.
  const vf = makeCard(st, filler(1, 'Shadow'), 0);
  const ve = makeCard(st, filler(2, 'Shadow'), 1);
  // One card in The Void that actually HAS an ability, or Voidlink — "this
  // fighter has the abilities of all fighters in The Void" — has nothing to
  // borrow and reads as a dead card.
  const lenders = ['Brute', 'Soldier', 'Hunter']
    .map((t) => ALL_FIGHTERS.find((d) => CARDS[d.id]?.actions?.length
      && (d.traits || []).includes(t)))
    .filter(Boolean);
  // Avatar's Burden attaches to your Stronghold, so one has to be standing —
  // and a revealed Stronghold that is not ON the board loses you the game on
  // the spot, which ended every run at its first action. The Void is the one
  // place it can stand without rearranging the grid.
  const shDef = Object.values(defs).find((d) => (d.realType || d.type) === 'stronghold');
  const shCard = shDef ? makeCard(st, shDef, 0) : null;
  if (shCard) {
    shCard.isStronghold = true;
    st.strongholds[0] = { card: shCard, revealed: true, art: false };
    marks.myStronghold = shCard;
  }

  // The Stronghold stands on TOP of the Void stack: an Attachment only ever
  // goes on the top of a stack, so a buried one is not a legal host.
  st.board[VOID] = [...(shCard ? [shCard] : []), vf, ve,
    ...lenders.map((d) => makeCard(st, d, 0))];
  marks.voidLenders = lenders;
  marks.voidFriend = vf;
  marks.voidEnemy = ve;

  // Zones. A graveyard with a range of powers, a hand with something to
  // discard, a deck with something to draw.
  for (const p of [0, 1]) {
    st.players[p].graveyard = [
      ...[1, 2, 3].map((n) => makeCard(st, filler(n), p)),
      ...['construct', 'tactic', 'attachment'].map(sample).filter(Boolean)
        .map((d) => makeCard(st, d, p)),
    ];
    st.players[p].hand = [
      ...[1, 2].map((n) => makeCard(st, filler(n), p)),
      makeCard(st, filler(1, 'Shadow'), p),   // "then you may Deploy a Shadow"
      ...(sample('attachment') ? [makeCard(st, sample('attachment'), p)] : []),
    ];
    // The TOP of the deck is a I and a Soldier on purpose: "reveal the top card
    // ... if that card is a I, discard it" and "... if it shares a trait with
    // the destroyed fighter" are both unreachable otherwise.
    st.players[p].deck = [
      makeCard(st, filler(1, 'Soldier'), p),
      ...[1, 2, 3, 1].map((n) => makeCard(st, filler(n), p)),
      ...['construct', 'tactic'].map(sample).filter(Boolean).map((d) => makeCard(st, d, p)),
    ];
  }


  st.active = 0;
  st.actionsLeft = 6;
  st.winner = null;
  delete st.pending;
  st.queue = [];
  refresh(st);
  return marks;
}

/* ==================================================================== */
/* Playing an ability for real                                          */
/* ==================================================================== */

/** What a single option in a request actually IS, so a claim can judge it. */
function identify(st, request, value) {
  if (request.kind === 'square' || (request.kind === 'option')) {
    return { square: typeof value === 'number' ? value : null, card: null };
  }
  const card = ops.findCard(st, value);
  if (!card) {
    // Not a card — squares are the only other thing a target request carries.
    return { square: typeof value === 'number' ? value : null, card: null };
  }
  const at = ops.locate(st, card.uid) || {};
  return {
    card, zone: at.zone || null,
    square: at.square ?? null,
    owner: card.owner,
    power: powerOf(st, card),
    traits: [...traitsFor(st, card)],
  };
}

function snapshotFacts(st) {
  const onBoard = [];
  const at = new Map();
  for (let s = 0; s < st.board.length; s++) {
    for (const c of st.board[s] || []) { onBoard.push(`${c.uid}@${s}`); at.set(c.uid, s); }
  }
  // A Construct is in play but lives outside `board`, so a Construct that
  // relocates itself looks like nothing happened unless it is counted here.
  for (const c of st.constructs || []) if (c) at.set(c.uid, `c${c.square}`);
  // Zones are compared by WHICH CARDS are in them, never by how many. The
  // staged card leaves your hand as it is played, so a card fetched into hand
  // leaves the count unchanged — which made every search effect look dead.
  const zone = (name) => {
    const set = new Set();
    for (const p of [0, 1]) for (const c of st.players[p][name]) set.add(c.uid);
    return set;
  };
  // Everything, with where it stood and what it was worth — a fighter that
  // has left cannot be asked about afterwards.
  const cards = new Map();
  for (const { card } of ops.allCards(st)) {
    const at2 = ops.locate(st, card.uid) || {};
    cards.set(card.uid, {
      uid: card.uid, name: st.defs[card.def]?.name || card.def,
      power: powerOf(st, card), zone: at2.zone || null, wasZone: at2.zone || null,
      wasSquare: at2.square ?? null,
    });
  }
  return {
    board: new Set(onBoard),
    cards,
    at, inGrave: zone('graveyard'),
    handSet: zone('hand'), deckSet: zone('deck'),
    boardCount: onBoard.length,
    hand: [0, 1].map((p) => st.players[p].hand.length),
    deck: [0, 1].map((p) => st.players[p].deck.length),
    grave: [0, 1].map((p) => st.players[p].graveyard.length),
    fatigued: new Set(st.board.flat().filter((c) => c.fatigued).map((c) => c.uid)),
    actions: st.actionsLeft,
    powerMods: st.derived.powerAdd.size + st.derived.powerSet.size,
  };
}

/**
 * Play one action to completion, recording every question it asked.
 * Answers are taken greedily — first option, always yes — because the claims
 * being checked are about what was OFFERED, not about what was picked.
 */
function playThrough(st, action, trace, shift = 0) {
  const asked = [];
  apply(st, action);
  let guard = 0;
  while (st.pending && guard++ < 40) {
    const req = st.pending.request;
    const opts = (req.options || []).map((v) => ({ value: v, id: identify(st, req, v) }));
    asked.push({ request: req, options: opts });
    if (trace) {
      trace.push(`  asks: ${req.type}/${req.kind} "${req.prompt}" -> `
        + opts.map((o) => describe(o.id)).join(', '));
    }
    // `shift` rotates which option each question takes. Always answering first
    // is not neutral: Tidal Wave's first direction pushes your Back Row off the
    // edge, which does nothing, and the card looks broken when it is not.
    const list = req.options || [];
    let answer = null;
    // Yes and no both have to be tried. Empty Crypt's "you may put it on the
    // Construct instead" means an unbroken YES makes "into your hand" look
    // like it never happened — because it happened and then moved on.
    if (req.type === 'confirm') answer = shift % 2 === 0;
    else if (req.type === 'some') {
      const want = Math.max(1, Math.min(req.count ?? 1, list.length));
      answer = list.slice(0, want);
    } else if (list.length) {
      answer = list[(shift + asked.length - 1) % list.length];
    }
    choose(st, answer);
  }
  return asked;
}

const describe = (id) => (id.card
  ? `${defs[id.card.def]?.name || id.card.def}(${id.owner === 0 ? 'mine' : 'theirs'},`
    + `${id.power},${id.zone}${id.square != null ? '@' + id.square : ''})`
  : `square ${id.square}`);

/* ==================================================================== */
/* Judging                                                              */
/* ==================================================================== */

const VERDICT = { FAIL: 'FAIL', PASS: 'PASS', UNCHECKED: 'UNCHECKED' };

/**
 * One ability can ask more than one question — "Destroy 3 friendly Is. Then,
 * destroy target enemy I or II" asks twice, about two different sets — and the
 * printed text does not say which restriction belongs to which question.
 *
 * So a targeting claim is judged against EACH question on its own and passes if
 * any one question satisfies it. Judging it against all the options at once
 * would condemn the second sentence for obeying the first.
 */
function judge(claim, ctx) {
  const reqs = ctx.asked.filter((a) => a.request.kind !== 'confirm'
    && a.request.kind !== 'option' && a.options.length);
  if (claim.type === 'effect' || !reqs.length) return judgeOne(claim, ctx, reqs);

  const takes = reqs.map((r) => judgeOne(claim, ctx, [r]));
  const p = takes.find((t) => t.verdict === VERDICT.PASS);
  if (p) return reqs.length > 1 ? pass(`${p.why} (of ${reqs.length} questions asked)`) : p;
  const f = takes.find((t) => t.verdict === VERDICT.FAIL);
  if (f) return reqs.length > 1
    ? fail(`no question it asked respects this — ${f.why}`) : f;
  return takes[0];
}

function judgeOne(claim, { st0, asked, before, after, source, marks }, targetReqs) {
  const cardOptions = targetReqs.flatMap((a) => a.options.filter((o) => o.id.card));
  const squareOptions = targetReqs.flatMap((a) => a.options.filter((o) => !o.id.card
    && o.id.square != null));

  switch (claim.type) {
    /* ---- who may be picked ------------------------------------------ */
    case 'adjacent': {
      if (source == null) return skip('the ability has no square to measure from');
      const pool = [...cardOptions, ...squareOptions];
      if (!pool.length) {
        // "Destroy all adjacent Is" never asks anything. Judge it by what it
        // touched instead: everything it moved or destroyed must have been
        // standing next to the source.
        const touched = [];
        for (const [uid, where] of before.at) {
          if (after.at.get(uid) === where) continue;
          if (uid === (marks.self?.uid)) continue;
          const sq = typeof where === 'string' ? Number(where.slice(1)) : where;
          touched.push({ uid, sq });
        }
        if (!touched.length) return skip('it offered no targets and changed nothing to measure');
        const bad = touched.filter((x) => distance(st0, source, x.sq) !== 1);
        if (bad.length) {
          return fail(`reached ${bad.length} fighter(s) that are not adjacent to square `
            + `${source}: squares ${bad.map((x) => x.sq).join(', ')}`);
        }
        return pass(`${touched.length} fighter(s) affected, all adjacent to ${source}`);
      }
      const bad = pool.filter((o) => {
        const sq = o.id.square;
        return sq != null && distance(st0, source, sq) !== 1;
      });
      if (bad.length) {
        return fail(`offered ${bad.length} target(s) that are not adjacent to square `
          + `${source}: ${bad.map((o) => describe(o.id)).join(', ')}`);
      }
      // Was there anything non-adjacent it COULD have wrongly offered?
      const decoys = boardCardsNotAdjacent(st0, source);
      return decoys ? pass(`${pool.length} offered, all adjacent (${decoys} non-adjacent decoys ignored)`)
        : vacuous('nothing non-adjacent was on the board to reject');
    }

    case 'enemyOnly':
    case 'friendlyOnly': {
      const want = claim.type === 'enemyOnly' ? 1 : 0;
      // "target enemy stack" asks for a SQUARE. Whose it is, is whose fighter
      // stands on it — judging only card options skipped every such card.
      const viaSquare = squareOptions
        .map((o) => ({ ...o, id: { ...o.id, ...ownerOfSquare(st0, o.id.square) } }))
        .filter((o) => o.id.owner != null);
      const pool = cardOptions.length ? cardOptions : viaSquare;
      if (!pool.length) return skip('it offered no fighters to check');
      const bad = pool.filter((o) => o.id.owner !== want);
      // A card that names BOTH sides ("target friendly fighter and target enemy
      // fighter") legitimately offers both; only complain when the text is
      // one-sided.
      if (/friendly/i.test(claim.text) && /enemy/i.test(claim.text)) {
        return skip('the text names both sides');
      }
      if (bad.length) {
        return fail(`offered ${bad.length} ${want === 1 ? 'friendly' : 'enemy'} target(s) `
          + `when the text says ${want === 1 ? 'enemy' : 'friendly'}: `
          + bad.map((o) => describe(o.id)).join(', '));
      }
      return pass(`${pool.length} offered, all ${want === 1 ? 'enemies' : 'friendly'}`);
    }

    case 'powerMax':
    case 'powerExact': {
      const ok = (p) => (claim.type === 'powerMax' ? p <= claim.max : p === claim.power);
      if (!cardOptions.length) {
        const touched = touchedCards(before, after, marks);
        if (!touched.length) return skip('it offered no fighters and changed nothing to check');
        const wrong = touched.filter((c) => !ok(c.power));
        return wrong.length
          ? fail(`acted on fighter(s) outside the printed power band: `
            + wrong.map((c) => `${c.name} (${c.power})`).join(', '))
          : pass(`${touched.length} fighter(s) affected, all within the band`);
      }
      const bad = cardOptions.filter((o) => !ok(o.id.power));
      if (bad.length) {
        return fail(`offered target(s) outside the printed power band: `
          + bad.map((o) => describe(o.id)).join(', '));
      }
      return pass(`${cardOptions.length} offered, all within the band`);
    }

    case 'trait': {
      if (!cardOptions.length) return skip('it offered no fighters to check');
      const bad = cardOptions.filter((o) => !o.id.traits.includes(claim.trait));
      if (bad.length) {
        return fail(`offered target(s) without the ${claim.trait} trait: `
          + bad.map((o) => describe(o.id)).join(', '));
      }
      return pass(`${cardOptions.length} offered, all ${claim.trait}s`);
    }

    case 'zone': {
      if (!cardOptions.length) {
        const touched = touchedCards(before, after, marks);
        if (!touched.length) return skip('it offered no cards and changed nothing to check');
        const fromZone = touched.filter((c) => (claim.zone === 'void' ? c.wasSquare === VOID
          : claim.zone === 'backRow' ? (st0.backRow?.[0] || []).includes(c.wasSquare)
            : c.wasZone === claim.zone));
        return fromZone.length === touched.length
          ? pass(`${touched.length} card(s) affected, all from ${claim.zone}`)
          : fail(`acted on ${touched.length - fromZone.length} card(s) from outside `
            + `${claim.zone}: ${touched.filter((c) => !fromZone.includes(c))
              .map((c) => c.name).join(', ')}`);
      }
      const inZone = (o) => (claim.zone === 'void'
        ? o.id.square === VOID
        : claim.zone === 'backRow'
          ? (st0.backRow?.[0] || []).includes(o.id.square)
          : o.id.zone === claim.zone);
      const bad = cardOptions.filter((o) => !inZone(o));
      if (bad.length) {
        return fail(`offered card(s) from outside ${claim.zone}: `
          + bad.map((o) => describe(o.id)).join(', '));
      }
      return pass(`${cardOptions.length} offered, all in ${claim.zone}`);
    }

    /* ---- what must happen ------------------------------------------- */
    case 'effect': {
      const happened = observedEffects(before, after, marks.self, source);
      if (happened.has(claim.effect)) return pass(`${claim.effect} observed`);
      if (claim.may) return skip(`"you may" — ${claim.effect} did not have to happen`);
      return fail(`the text says ${claim.effect}, but nothing was ${pastTense(claim.effect)}`);
    }

    case 'adjacentPair': {
      // Everything a LATER question offers must sit next to something an
      // EARLIER question already settled on.
      if (targetReqs.length < 2) return judgeAnchored(claim, st0, targetReqs, before, after, marks);
      const anchors = [];
      for (const r of targetReqs.slice(0, -1)) {
        for (const o of r.options) {
          const sq = o.id.square ?? (o.id.card ? null : o.id.square);
          if (sq != null) anchors.push(sq);
        }
      }
      const later = targetReqs[targetReqs.length - 1].options
        .map((o) => o.id.square).filter((x) => x != null);
      if (!anchors.length || !later.length) return skip('neither question offered a square');
      const bad = later.filter((sq) => !anchors.some((a) => distance(st0, a, sq) === 1));
      return bad.length
        ? fail(`offered ${bad.length} option(s) not adjacent to anything the first `
          + `question could have chosen: squares ${bad.join(', ')}`)
        : pass(`${later.length} option(s), each adjacent to a possible first choice`);
    }

    default: return skip('no check for this claim');
  }
}

const pastTense = (e) => ({
  destroy: 'destroyed', draw: 'drawn', discard: 'discarded', toHand: 'returned to hand',
  relocate: 'relocated', deploy: 'deployed', fatigue: 'fatigued', unfatigue: 'readied',
  action: 'gained',
}[e] || e);

function observedEffects(a, b, self = null, entered = null) {
  const seen = new Set();
  const grew = (x, y) => y.some((v, i) => v > x[i]);
  const shrank = (x, y) => y.some((v, i) => v < x[i]);
  // Destroyed means it was in play and is now in a graveyard. Growing the
  // graveyard alone is not enough — discarding does that too.
  for (const [uid] of a.at) {
    if (!b.at.has(uid) && b.inGrave.has(uid) && !a.inGrave.has(uid)) seen.add('destroy');
  }
  for (const uid of b.handSet) {
    if (a.handSet.has(uid)) continue;
    seen.add('toHand');
    if (a.deckSet.has(uid)) seen.add('draw');
  }
  // Discarding is not only from hand: Ballista mills the top of a deck, and
  // counting only hand-to-graveyard made a working card look dead.
  for (const uid of b.inGrave) {
    if (a.handSet.has(uid) || (a.deckSet.has(uid) && !b.deckSet.has(uid))) seen.add('discard');
  }
  // Deployed means something is in play that was not before. Counting heads
  // misses Soul Swap, which destroys one fighter and deploys another into the
  // same square for a net change of zero.
  for (const [uid] of b.at) if (!a.at.has(uid)) seen.add('deploy');
  // still in play, but somewhere else
  for (const [uid, where] of b.at) if (a.at.has(uid) && a.at.get(uid) !== where) seen.add('relocate');
  for (const uid of b.fatigued) if (!a.fatigued.has(uid)) seen.add('fatigue');
  for (const uid of a.fatigued) if (!b.fatigued.has(uid)) seen.add('unfatigue');
  if (b.actions > a.actions) seen.add('action');
  if (b.powerMods !== a.powerMods) seen.add('power');
  // A Deployment ability that moves ITSELF was not in play when `before` was
  // taken, so there is no earlier square to compare with — except the one it
  // was deployed to, which the staging knows.
  if (self && entered != null && b.at.has(self.uid) && b.at.get(self.uid) !== entered) {
    seen.add('relocate');
  }
  return seen;
}

/**
 * Adjacency measured from a thing the TEXT names rather than from the card.
 *
 * "underneath an adjacent Hero you control", "on top of target other fighter
 * adjacent to that enemy", "fighters adjacent to them that share a trait" —
 * in each case the anchor is a described fighter somewhere on the board, and
 * everything the ability reaches must be that anchor or stand next to one.
 */
function judgeAnchored(claim, st, reqs, before, after, marks) {
  const NOUNS = 'Hero|Shadow|Brute|Soldier|Hunter|Demon|Token|Attachment|Construct'
    + '|fighter|stack|enemy|square';
  let m = claim.text.match(new RegExp(
    `adjacent(?: to)?\\s+(?:an?|the|that|target|its|their|each|any|another)?\\s*`
    + `((?:friendly |enemy )?(?:${NOUNS})s?)`, 'i'));

  // "destroy all Shadows and fighters adjacent to THEM" — the pronoun points
  // back at the last thing named, which is what the adjacency is measured from.
  if (!m && /adjacent to (them|it|those|these)\b/i.test(claim.text)) {
    const before2 = claim.text.slice(0, claim.text.search(/adjacent to (them|it|those|these)\b/i));
    const nouns = [...before2.matchAll(new RegExp(`\\b(${NOUNS})s?\\b`, 'gi'))];
    if (nouns.length) m = [null, nouns[nouns.length - 1][1]];
  }
  if (!m) return skip('the text does not say what the adjacency is measured from');

  const phrase = m[1].toLowerCase();
  const wantFriendly = /friendly/.test(phrase) || /you control/i.test(claim.text);
  const wantEnemy = /enemy/.test(phrase);
  const trait = ['Hero', 'Shadow', 'Brute', 'Soldier', 'Hunter', 'Demon', 'Token']
    .find((t) => phrase.includes(t.toLowerCase()));

  const anchors = [];
  for (let sqr = 0; sqr < st.board.length; sqr++) {
    for (const c of st.board[sqr] || []) {
      if (wantFriendly && c.owner !== 0) continue;
      if (wantEnemy && c.owner === 0) continue;
      if (phrase.includes('attachment') && !(c.attachments || []).length) continue;
      if (trait && !traitsFor(st, c).has(trait)) continue;
      anchors.push(sqr);
      break;
    }
  }
  if (phrase.includes('construct')) {
    for (const c of st.constructs || []) {
      if (c && (!wantFriendly || c.owner === 0) && !anchors.includes(c.square)) anchors.push(c.square);
    }
  }
  if (!anchors.length) return vacuous(`there was no ${phrase} on the board to measure from`);

  const subjects = reqs.flatMap((r) => r.options.map((o) => o.id.square)).filter((x) => x != null);
  const touched = subjects.length ? [] : touchedCards(before, after, marks)
    .map((c) => c.wasSquare).filter((x) => x != null);
  const pool = subjects.length ? subjects : touched;
  if (!pool.length) return skip('it offered nothing and changed nothing to measure');

  // A subject may BE the anchor — "destroy all Shadows AND fighters adjacent to
  // them" reaches the Shadows themselves, which are not next to themselves.
  const bad = pool.filter((sqr) => !anchors.includes(sqr)
    && !anchors.some((a) => distance(st, a, sqr) === 1));
  if (bad.length) {
    return fail(`reached square(s) that are neither a ${phrase} nor next to one: `
      + `${[...new Set(bad)].join(', ')} (${phrase} stood on ${anchors.join(', ')})`);
  }
  return pass(`${pool.length} reached, each a ${phrase} or beside one`);
}

/** Whose square is it? The top of the stack decides. */
function ownerOfSquare(st, square) {
  if (square == null) return {};
  const top = (st.board[square] || [])[0];
  return top ? { owner: top.owner, card: top } : {};
}

/** Cards the ability moved, destroyed or fetched — not counting the actor. */
function touchedCards(before, after, marks) {
  const out = [];
  for (const [uid, where] of before.at) {
    if (after.at.get(uid) === where) continue;
    if (uid === marks.self?.uid) continue;
    const c = before.cards.get(uid);
    if (c) out.push(c);
  }
  for (const [uid, c] of after.cards) {
    if (!before.at.has(uid) && (before.cards.get(uid) || {}).zone !== c.zone) {
      if (uid !== marks.self?.uid && !out.some((x) => x.uid === uid)) out.push(before.cards.get(uid) || c);
    }
  }
  return out.filter(Boolean);
}

function boardCardsNotAdjacent(st, source) {
  let n = 0;
  for (let s = 0; s < st.board.length; s++) {
    if (!(st.board[s] || []).length) continue;
    if (s === source) continue;
    if (distance(st, source, s) !== 1) n += st.board[s].length;
  }
  return n;
}

const fail = (why) => ({ verdict: VERDICT.FAIL, why });
const pass = (why) => ({ verdict: VERDICT.PASS, why });
const skip = (why) => ({ verdict: VERDICT.UNCHECKED, why });
const vacuous = (why) => ({ verdict: VERDICT.UNCHECKED, why: `vacuous — ${why}` });

/* ==================================================================== */
/* Staging one ability                                                  */
/* ==================================================================== */

/**
 * Put the card where its ability can be used, and return the real action that
 * uses it — the same action the table would submit. Going through
 * legalActions/apply rather than calling the generator directly is the point:
 * the last Fire Bolt bug was in the engine's dispatch, not in the card.
 */
function stageAbility(def, rule, trace, variant = 'spread') {
  const st = baseGame();
  const marks = stageArena(st, variant);
  const kind = rule.k;
  const type = def.realType || def.type;

  if (type === 'fighter' && (kind === 'action' || kind === 'constant' || kind === 'passive')) {
    const card = makeCard(st, def, 0);
    // A whole wing of the Auroxi reads "if this fighter is in The Void"; with
    // the actor always on square 4 those abilities are never usable, and an
    // ability that is never usable is never checked.
    const home = variant === 'void' ? VOID : 4;
    if (variant === 'void') st.board[VOID] = [card, ...st.board[VOID]];
    else st.board[4] = variant === 'dense' ? [card, marks.buriedEnemy, marks.buriedFriend] : [card];
    refresh(st);
    if (kind !== 'action') return { st, card, marks, action: null, source: home };
    const entries = actionAbilitiesOf(st, card);
    const idx = pickAbilityIndex(entries, rule);
    if (idx == null) return { st, card, marks, action: null, source: home, why: 'no action ability is offered' };
    const act = legalActions(st).find((a) => a.t === 'ability' && a.uid === card.uid && a.index === idx);
    return { st, card, marks, source: home, action: act, why: act ? null : 'the ability is not usable here' };
  }

  if (type === 'fighter' && kind === 'deployment') {
    const card = makeCard(st, def, 0);
    st.players[0].hand.push(card);
    refresh(st);
    const act = legalActions(st).find((a) => a.t === 'deploy' && a.card === card.uid);
    // "Deploy this fighter to an unoccupied square adjacent to an Attachment
    // you control" ADDS somewhere to land; it does not take the ordinary Back
    // Row away. So the sentence describes the squares the CARD contributes,
    // and only those are judged against it — the whole legal set includes
    // perfectly proper back-row squares that the sentence says nothing about.
    const extras = CARDS[def.id]?.deploySquares?.(st, card, 0) || [];
    const pre = /Deploy this fighter/i.test(rule.text || '') && extras.length
      ? [{ squares: extras }] : null;
    return { st, card, marks, source: act ? act.to : null, action: act, pre,
      why: act ? null : 'it has nowhere legal to deploy' };
  }

  if (type === 'tactic') {
    const card = makeCard(st, def, 0);
    st.players[0].hand.push(card);
    refresh(st);
    const act = legalActions(st).find((a) => a.t === 'tactic' && a.card === card.uid);
    return { st, card, marks, source: null, action: act, why: act ? null : 'it is not playable here' };
  }

  if (type === 'construct') {
    const card = makeCard(st, def, 0);
    st.players[0].hand.push(card);
    refresh(st);
    let act = legalActions(st).find((a) => a.t === 'construct' && a.card === card.uid);
    if (!act) return { st, card, marks, source: null, action: null, why: 'nowhere legal to build it' };
    if (kind === 'action') {
      // Build it first, THEN use its ability.
      apply(st, act);
      while (st.pending) choose(st, (st.pending.request.options || [])[0] ?? true);
      const built = st.constructs.find((c) => c.uid === card.uid);
      if (!built) return { st, card, marks, source: null, action: null, why: 'it did not come into play' };
      const entries = actionAbilitiesOf(st, built);
      const idx = pickAbilityIndex(entries, rule);
      const a2 = idx == null ? null
        : legalActions(st).find((a) => a.t === 'ability' && a.uid === built.uid && a.index === idx);
      return { st, card: built, marks, source: built.square, action: a2,
        why: a2 ? null : 'its ability is not usable once built' };
    }
    return { st, card, marks, source: act.to, action: act };
  }

  if (type === 'attachment') {
    const card = makeCard(st, def, 0);
    st.players[0].hand.push(card);
    refresh(st);
    const act = legalActions(st).find((a) => a.t === 'attach' && a.card === card.uid);
    if (!act) return { st, card, marks, source: null, action: null, why: 'nothing legal to attach to' };
    // "Attach to a Hero you control" is checkable: the hosts the engine offers
    // ARE the answer to a question, even though it never asks one out loud.
    const hosts = legalActions(st).filter((a) => a.t === 'attach' && a.card === card.uid)
      .map((a) => ops.findCard(st, a.host)).filter(Boolean);
    if (kind === 'action' || kind === 'constant') {
      apply(st, act);
      while (st.pending) choose(st, (st.pending.request.options || [])[0] ?? true);
      const host = ops.findCard(st, act.host);
      const hostSq = ops.locate(st, act.host)?.square ?? null;
      // The ability being checked is the one THIS attachment grants. A host
      // can carry several — Voidlink lends it more — so "the first one" is not
      // good enough: it judged a borrowed ability against this card's text.
      const entries = actionAbilitiesOf(st, host);
      const own = entries.find((e) => e.ability?.from === card.uid)
        || entries.find((e) => (e.ability?.name || '') === def.name);
      const idx = own ? own.index : pickAbilityIndex(entries, rule);
      const a2 = idx == null ? null
        : legalActions(st).find((a) => a.t === 'ability' && a.uid === host.uid && a.index === idx);
      return { st, card: host, marks, source: hostSq, action: a2,
        why: a2 ? null : 'the attachment grants no usable ability' };
    }
    return { st, card, marks, source: null, action: act, pre: hosts.length ? [hosts] : null };
  }

  return { st, card: null, marks, source: null, action: null, why: `nothing stages a ${type}` };
}

/** Match a printed ability to the engine's list of usable abilities. */
function pickAbilityIndex(entries, rule) {
  if (!entries.length) return null;
  if (rule.name) {
    const byName = entries.find((e) => (e.ability?.name || e.name || '')
      .toLowerCase() === rule.name.toLowerCase());
    if (byName) return byName.index;
  }
  return entries[0].index;
}

/* ==================================================================== */
/* Proving the checker can fail                                         */
/* ==================================================================== */
//
// A conformance report that says "no disagreements" is worth exactly as much as
// the evidence that it COULD have said otherwise. --selftest plants cards whose
// implementation is deliberately wrong in each of the ways the pool can be
// wrong, and the run is only trustworthy if every one of them is caught.

const PLANTED = [
  {
    id: 'ZZ1', name: 'Planted — ignores adjacency',
    text: 'Destroy target adjacent enemy I.',
    impl: { *run({ state, self }) {
      const foes = targets(state, { player: self.owner, side: 'enemy', power: 1 });
      const pick = yield ask.one(uids(foes), { prompt: 'planted' });
      if (pick) ops.toGraveyard(state, pick);
    } },
    expect: 'adjacent',
  },
  {
    id: 'ZZ2', name: 'Planted — hits its own side',
    text: 'Destroy target enemy I.',
    impl: { *run({ state, self }) {
      const all = targets(state, { player: self.owner, side: 'any', power: 1 });
      const pick = yield ask.one(uids(all), { prompt: 'planted' });
      if (pick) ops.toGraveyard(state, pick);
    } },
    expect: 'enemyOnly',
  },
  {
    id: 'ZZ3', name: 'Planted — ignores the power band',
    text: 'Destroy target adjacent enemy I.',
    impl: { *run({ state, self }) {
      const here = sqOf(state, self.uid);
      const foes = targets(state, { player: self.owner, side: 'enemy', adjacentTo: here });
      const pick = yield ask.one(uids(foes), { prompt: 'planted' });
      if (pick) ops.toGraveyard(state, pick);
    } },
    expect: 'powerExact',
  },
  {
    id: 'ZZ4', name: 'Planted — asks, then does nothing',
    text: 'Destroy target adjacent enemy I.',
    impl: { *run({ state, self }) {
      const here = sqOf(state, self.uid);
      const foes = targets(state, { player: self.owner, side: 'enemy', adjacentTo: here, power: 1 });
      yield ask.one(uids(foes), { prompt: 'planted' });
    } },
    expect: 'effect',
  },
];

const sqOf = (st, uid) => ops.locate(st, uid)?.square ?? null;

if (SELFTEST) {
  for (const p of PLANTED) {
    defs[p.id] = {
      id: p.id, name: p.name, type: 'fighter', realType: 'fighter', kind: 'basic',
      power: 2, traits: ['Soldier'], abilities: [], text: null, keywords: [],
      rules: [{ k: 'action', name: 'Planted', text: p.text }],
    };
    CARDS[p.id] = { actions: [{ name: 'Planted', run: p.impl.run }] };
  }
}

/* ==================================================================== */
/* The sweep                                                            */
/* ==================================================================== */

const results = [];
const ids = Object.keys(defs).filter((id) => (ONLY ? id === ONLY : true));
const ARENAS = ['spread', 'dense', 'void'];

/** Play one ability once, with one way of answering its questions. */
function playOnce(def, rule, claims, variant, trace, shift) {
  let staged;
  try {
    staged = stageAbility(def, rule, trace, variant);
  } catch (e) {
    return { blocked: `staging threw — ${e.message}`, threw: true };
  }
  if (!staged.action) return { blocked: staged.why || 'could not be staged' };

  const st = staged.st;
  const before = snapshotFacts(st);
  let asked;
  try {
    asked = playThrough(st, staged.action, trace, shift);
  } catch (e) {
    return { blocked: `playing it threw — ${e.message}`, threw: true };
  }
  const after = snapshotFacts(st);
  // synthetic questions — option sets the engine computed but never asked about
  for (const group of (staged.pre || []).slice().reverse()) {
    const isSquares = !Array.isArray(group) && Array.isArray(group.squares);
    const values = isSquares ? group.squares : group.map((c) => c.uid);
    const kind = isSquares ? 'square' : 'target';
    asked.unshift({
      request: { type: 'one', kind, prompt: isSquares ? 'where may it land?' : 'which host?',
        options: values },
      options: values.map((v) => ({ value: v, id: identify(st, { kind }, v) })),
    });
  }
  const marks = { ...staged.marks, self: staged.card };
  const judged = claims.map((c) => ({ claim: c, variant,
    ...judge(c, { st0: st, asked, before, after, source: staged.source, marks }) }));
  return { judged, asked, variant, offered: asked.reduce((n, a) => n + a.options.length, 0) };
}

/**
 * Play one ability in one arena, trying several ways of answering it.
 *
 * "Destroy target fighter you control. Then Deploy another with EQUAL printed
 * power from your Graveyard" only deploys if the first answer happens to match
 * something in the Graveyard. Declaring the card broken because the first
 * option in the list was the wrong one would be the harness's fault, not the
 * card's — so the search keeps trying until every effect the text promises has
 * been seen at least once.
 */
function attempt(def, rule, claims, variant, trace) {
  const ATTEMPTS = 8;
  let best = null;
  for (let shift = 0; shift < ATTEMPTS; shift++) {
    const run = playOnce(def, rule, claims, variant, shift === 0 ? trace : null, shift);
    if (!run.judged) return best || run;
    if (!best) { best = run; continue; }
    // Effect claims take the BEST verdict across attempts — one way of playing
    // the card that produces the promised effect is proof it can. Targeting
    // claims take the WORST: offering an illegal target even once is the bug.
    let improved = false;
    best.judged = best.judged.map((prev, i) => {
      const now = run.judged[i];
      if (claims[i].type !== 'effect') {
        // A pass beats a fail ACROSS attempts: which questions get asked
        // depends on the answers, and an attempt that led somewhere with no
        // legal targets must not convict the card. Within one attempt a
        // violation still fails, and a card that is wrong every time stays
        // wrong every time.
        if (prev.verdict === VERDICT.PASS) return prev;
        if (now.verdict === VERDICT.PASS) { improved = true; return now; }
        return prev.verdict === VERDICT.FAIL ? prev : now;
      }
      if (prev.verdict === VERDICT.PASS) return prev;
      if (now.verdict === VERDICT.PASS) { improved = true; return now; }
      return prev;
    });
    best.offered = Math.max(best.offered, run.offered);
    // Keep going until every claim has actually been SEEN to hold. Stopping as
    // soon as nothing was failing meant an optional effect never got the second
    // answer it needed — Diversion only draws if you send a HUNTER to the
    // bottom and then say yes, which is the fifth combination, not the first.
    if (best.judged.every((j) => j.verdict === VERDICT.PASS)) break;
  }
  return best;
}

/**
 * Every ability on a card that can be PLAYED, in one shape.
 *
 * Fighters and Constructs carry their abilities in `rules`. Tactics and
 * Attachments print one block of prose in `text` instead — and an Attachment's
 * real ability is the sentence it puts in quotation marks, the one it grants
 * its host. Reading only `rules` silently skipped all 19 Tactics and all 8
 * Attachments, which is most of the pool's targeting.
 */
function abilityRules(def) {
  const type = def.realType || def.type;
  const out = (def.rules || []).filter((r) => r.k !== 'constant' && r.k !== 'passive');

  if (type === 'tactic' && def.text) out.push({ k: 'play', name: null, text: def.text });

  if (type === 'attachment' && def.text) {
    // "Attach to a Hero you control" is a restriction on the play itself, and
    // it is checkable against the hosts the engine offers. Keep it even when
    // the card also grants an ability — Inquisitorial Mandate does both, and
    // reading only the granted half lost the restriction entirely.
    const restriction = def.text.match(/^(Attach to [^.]+\.)/i);
    if (restriction) out.push({ k: 'attach', name: null, text: restriction[1] });

    // the granted ability is the quoted sentence, wherever it sits
    const granted = def.text.match(/["']([^"']{12,})["']/);
    if (granted) {
      out.push({ k: 'action', name: null, text: granted[1].replace(/^\(\w+\)\s*/, '') });
    } else if (!restriction) {
      out.push({ k: 'attach', name: null, text: def.text });
    }
  }
  return out;
}

for (const id of ids) {
  const def = defs[id];
  // A token is never played from anyone's hand — a card makes one — so the
  // rules about what you may legally attach it to do not apply to it.
  if (def.token) continue;
  const rules = abilityRules(def);
  if (!rules.length) continue;

  for (const rule of rules) {
    const claims = readClaims(rule.text, rule.k);
    const label = `${id} ${def.name}${rule.name ? ` — ${rule.name}` : ''}`;
    const trace = ONLY ? [] : null;

    const runs = ARENAS.map((v) => {
      if (trace) trace.push(`  [${v} arena]`);
      return attempt(def, rule, claims, v, trace);
    });
    const played = runs.filter((r) => r.judged);

    if (!played.length) {
      const threw = runs.find((r) => r.threw);
      results.push({ label, rule, claims, trace,
        verdict: threw ? VERDICT.FAIL : VERDICT.UNCHECKED,
        why: threw ? threw.blocked : (runs[0].blocked || 'could not be staged') });
      continue;
    }

    // Merge the arenas. A targeting claim that fails ANYWHERE is a real
    // disagreement — one bad option offered is one too many. An EFFECT claim is
    // only a disagreement if it failed in every arena, because an arena can
    // simply lack anything for the effect to act on.
    const merged = claims.map((claim, i) => {
      const takes = played.map((r) => r.judged[i]);
      const fails = takes.filter((t) => t.verdict === VERDICT.FAIL);
      const passes = takes.filter((t) => t.verdict === VERDICT.PASS);
      if (claim.type === 'effect') {
        if (passes.length) return passes[0];
        if (fails.length === takes.length) return fails[0];
        return takes.find((t) => t.verdict === VERDICT.UNCHECKED) || takes[0];
      }
      if (fails.length) return fails[0];
      if (passes.length) return passes[0];
      return takes[0];
    });

    results.push({ label, rule, claims, trace, judged: merged,
      asked: played[0].asked, offered: played.reduce((n, r) => n + r.offered, 0) });
  }
}

/* ==================================================================== */
/* Constants                                                            */
/* ==================================================================== */
//
// A Constant ability cannot be "played", so none of the above reaches it — and
// Constants are two thirds of the pool. What CAN be checked is whether the card
// being on the table changes anything at all: derive the continuous layer with
// the card in play and again without it, and compare. A Constant that leaves
// the derived layer byte-identical in every arena is doing nothing.
//
// Constants delivered as triggers ("After this fighter is destroyed...") live
// in `on`/`replace` instead and are counted separately rather than accused.

/**
 * A comparable summary of the whole continuous layer.
 *
 * Every key, not a chosen list. Cards add keys that `emptyDerived()` never
 * declares — `extraDeploy`, `puppeteered` — and a fingerprint that only looks
 * at the declared ones reports those cards as dead when they are working.
 * Predicates cannot be compared, so they are counted.
 */
function fingerprint(d) {
  const val = (v) => {
    if (v instanceof Map) {
      return `{${[...v.entries()].map(([k, x]) => `${k}:${val(x)}`).sort().join(',')}}`;
    }
    if (v instanceof Set) return `[${[...v].map(val).sort().join(',')}]`;
    if (Array.isArray(v)) return `(${v.map(val).join(',')})`;
    if (typeof v === 'function') return 'fn';
    if (v && typeof v === 'object') {
      return `{${Object.keys(v).sort().map((k) => `${k}:${val(v[k])}`).join(',')}}`;
    }
    return String(v);
  };
  return Object.keys(d).sort().map((k) => `${k}=${val(d[k])}`).join('|');
}

const constantResults = [];
for (const id of ids) {
  const def = defs[id];
  const statics = (def.rules || []).filter((r) => r.k === 'constant' || r.k === 'passive');
  if (!statics.length) continue;
  const impl = CARDS[id];
  const label = `${id} ${def.name}`;

  // "+I when Attacking Hunters" is not written as a per-card constant at all:
  // it is structured data on the definition that powerOf reads during combat.
  // So it is checked the only way that means anything — by fighting.
  const bonuses = (def.abilities || []).filter((a) => a.k === 'bonusVsTrait');
  if (bonuses.length && statics.length === bonuses.length) {
    const st = baseGame();
    stageArena(st, 'spread');
    const attacker = makeCard(st, def, 0);
    st.board[4] = [attacker];
    let ok = true;
    for (const b of bonuses) {
      const victim = makeCard(st, filler(1, b.trait), 1);
      st.board[3] = [victim];
      refresh(st);
      const plain = powerOf(st, attacker);
      const vs = powerOf(st, attacker, victim);
      if (!traitsFor(st, victim).has(b.trait) || vs !== plain + b.amount) ok = false;
    }
    constantResults.push({ label, verdict: ok ? 'ACTIVE' : 'INERT', where: ['combat'],
      note: ok ? null : 'the printed bonus does not apply when attacking that trait' });
    continue;
  }

  if (!impl) { constantResults.push({ label, verdict: 'NOIMPL' }); continue; }
  if (!impl.constant) {
    const how = ['on', 'replace', 'freeRun', 'queued', 'deploySquares', 'playable', 'whileCovered']
      .filter((k) => impl[k]);
    constantResults.push({ label, verdict: how.length ? 'TRIGGER' : 'NOIMPL', how });
    continue;
  }

  // WHERE the card stands decides whether its constant is switched on at all:
  // "while this fighter is in your Gates", "while in your Back Row", "while in
  // The Void". Testing only the centre square declares half of them dead.
  const type = def.realType || def.type;
  const spots = type === 'construct' ? ['construct@2', 'construct@7']
    : type === 'attachment' ? ['attached']
      : ['centre', 'gates', 'backRow', 'void'];

  let moved = false;
  const where = [];
  for (const variant of ARENAS) {
    for (const spot of spots) {
      const st = baseGame();
      const marks = stageArena(st, variant);
      const card = makeCard(st, def, 0);
      let undo;

      if (spot.startsWith('construct@')) {
        card.square = Number(spot.split('@')[1]);
        st.constructs.push(card);
        undo = () => { st.constructs = st.constructs.filter((c) => c.uid !== card.uid); };
      } else if (spot === 'attached') {
        const host = marks.friendHero;
        card.attachedTo = host.uid;
        host.attachments.push(card);
        undo = () => { host.attachments = host.attachments.filter((a) => a.uid !== card.uid); };
      } else {
        const home = spot === 'void' ? VOID : spot === 'gates' ? 1 : spot === 'backRow' ? 2 : 4;
        st.board[home] = [card, ...st.board[home]];
        undo = () => { st.board[home] = st.board[home].filter((c) => c.uid !== card.uid); };
      }

      const withIt = fingerprint(derive(st, CARDS));
      undo();
      const without = fingerprint(derive(st, CARDS));
      if (withIt !== without) { moved = true; where.push(`${variant}/${spot}`); }
    }
  }
  constantResults.push({ label, verdict: moved ? 'ACTIVE' : 'INERT', where });
}

/* ---------------------------------------------------------------- report */

const fails = [];
const unchecked = [];
let passes = 0, claimsChecked = 0;

for (const r of results) {
  if (r.verdict === VERDICT.FAIL) { fails.push(`${r.label}: ${r.why}`); continue; }
  if (r.verdict === VERDICT.UNCHECKED) { unchecked.push(`${r.label}: ${r.why}`); continue; }
  for (const j of r.judged || []) {
    claimsChecked++;
    if (j.verdict === VERDICT.FAIL) fails.push(`${r.label}: ${j.why}\n      text: "${j.claim.text}"`);
    else if (j.verdict === VERDICT.PASS) passes++;
    else unchecked.push(`${r.label} [${j.claim.type}]: ${j.why}`);
  }
}

if (ONLY) {
  for (const r of results) {
    console.log(`\n${r.label}`);
    console.log(`  text: ${r.rule.text}`);
    console.log(`  claims: ${(r.claims || []).map((c) => c.type + (c.trait ? ':' + c.trait : '')
      + (c.max ? '<=' + c.max : '') + (c.power ? '=' + c.power : '')
      + (c.effect ? ':' + c.effect : '')).join(', ') || '(none readable)'}`);
    for (const line of r.trace || []) console.log(line);
    for (const j of r.judged || []) console.log(`  ${j.verdict.padEnd(9)} ${j.claim.type}`
      + `${j.variant ? ` [${j.variant}]` : ''}: ${j.why}`);
    if (r.why) console.log(`  UNCHECKED ${r.why}`);
  }
}

if (SELFTEST) {
  console.log('\nPLANTED FAULTS — each of these MUST be caught');
  let caught = 0;
  for (const p of PLANTED) {
    const r = results.find((x) => x.label.startsWith(p.id));
    const hit = (r?.judged || []).find((j) => j.claim.type === p.expect
      && j.verdict === VERDICT.FAIL);
    console.log(`  ${hit ? 'caught ' : 'MISSED '} ${p.id} ${p.name} (${p.expect})`);
    if (hit) caught++;
  }
  console.log(`  ${caught}/${PLANTED.length} caught`);
  if (caught < PLANTED.length) {
    console.log('\nThe checker cannot see faults it is supposed to see — its clean'
      + ' report on the real cards means nothing until this is fixed.');
    process.exit(2);
  }
}

const inert = constantResults.filter((c) => c.verdict === 'INERT');
const noimpl = constantResults.filter((c) => c.verdict === 'NOIMPL');
const trig = constantResults.filter((c) => c.verdict === 'TRIGGER');
const active = constantResults.filter((c) => c.verdict === 'ACTIVE');

console.log(`\n${constantResults.length} constant/passive abilities`);
console.log(`  ${active.length} change the continuous layer when the card is in play`);
console.log(`  ${trig.length} are delivered as triggers, which this cannot judge`);
console.log(`  ${inert.length + noimpl.length} contribute nothing`);
if (inert.length || noimpl.length) {
  console.log('\nCONSTANTS THAT DO NOTHING');
  for (const c of [...inert, ...noimpl]) {
    console.log(`  ${c.label}${c.verdict === 'NOIMPL' ? ' (no implementation)' : ''}`);
  }
}

console.log(`\n${results.length} abilities exercised, ${claimsChecked} claims read from their text`);
console.log(`  ${passes} held against a counter-example`);
console.log(`  ${unchecked.length} could not be checked`);
console.log(`  ${fails.length} disagree with the card`);

if (fails.length) {
  console.log('\nDISAGREEMENTS');
  for (const f of fails) console.log(`  ${f}`);
}
if (VERBOSE && unchecked.length) {
  console.log('\nNOT CHECKED');
  for (const u of unchecked) console.log(`  ${u}`);
}
process.exit(fails.length || inert.length || noimpl.length ? 1 : 0);
