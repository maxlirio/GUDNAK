# Abilities — what the cards actually ask for

A scan of all 100 cards read so far. `node tools/scan-abilities.js --full`
regenerates the inventory; this document is the reading of it.

- **108** abilities and effects in total
- **37** are the trait triangle, already implemented as `bonusVsTrait`
- **71** remain, spread over **62 cards**

Nothing below is implemented yet. The point of the document is to name the
machinery *once*, in the order that unlocks the most cards per unit of work,
instead of discovering it card by card.

## What the engine is missing

The current engine knows fighters, deploy/move/attack/defend, stacks and
siege. Every remaining effect needs one of six things it does not have.

### 1. A trigger bus

More than half the remaining effects fire on an event rather than on an
action. The engine currently has no way to say "when this happens, do that".

| Trigger | Asked for by |
|---|---|
| `onDeploy` | 8 deployment abilities |
| `afterMove` (self) | Capricorn Cavalry, Demolition "Experts" |
| `afterDestroyed` (self) | Shard Wisp, Demolition "Experts" |
| `afterAttack` / `afterDestroysWhileAttacking` | Corrupted Shardbeast, Dawnsteel Blade |
| `onEnterSquare` (any fighter) | Imperial Guard, Jagged Rocks, the three Traps |
| `startOfTurn` | the three Traps |

**Replacement triggers** are a separate, harder kind — they *intercept*
instead of appending, and there are four:

- **Phylactery** — a destroyed Hero goes here instead of the Graveyard.
- **Empty Crypt** — a card entering your hand goes on the Construct instead.
- **Jagged Rocks** — the entering fighter is destroyed instead of the Construct.
- **Wave Runner / Soul Swap** — relocate into the square *if it is now empty*.

### 2. A continuous-effects layer

Power and legality currently come from printed values. Several cards change
them for as long as they are in play, so both have to be **recomputed**, never
written into the card.

- **Power** — *Swarmseeker* (power = size of the enemy stack it is fighting),
  *The Everking* (all fighters count as I until your next turn),
  *Lord High Inquisitor* (+I to your Hunters against marked targets).
- **Traits** — *Spirit of Alliance* (gains all three on your turn),
  *Inspiration*, *Shared Knowledge*, *Inquisitorial Mandate*.
- **Card class** — *Khosari Cannoneer* is "considered Basic";
  *Deckhand Drifter* is "considered Singing".
- **Where your Back Row is** — *Scylla* and *Temple of Tides* redefine it, and
  the Back Row is what Deploy legality is built on. This one reaches into
  `legalActions` directly.
- **Ability replacement** — *Bards-for-Hire* blanks nearby enemy abilities.

This layer must be evaluated in `powerOf` and `legalActions` rather than
applied as a one-off, or effects will not turn off when the source leaves.

### 3. Targeting

The 71 effects use a small, closed vocabulary of target shapes. Worth building
as one selector rather than 71 bespoke searches:

`side` (friendly / enemy / any) · `zone` (battlefield / hand / graveyard /
deck) · `power` (exact, "or less", "equal to another card's") · `trait` ·
`adjacency` · `range` in squares · `inStack` / `notInStack` / `topOnly` /
`anyInStack` · `excluding an opponent's Gates`.

Note `anyInStack`: *Cross Examine* and *Decarceration* reach **inside** a stack,
which the "only the topmost fighter can be targeted" default forbids. The
selector needs to be able to opt out of that rule.

### 4. Zone movement primitives

| Primitive | Cards |
|---|---|
| `putUnderneath(fighter, stack)` | 6 — Umbren Jailor, Heretic Condemner, Incarceration, Undead Horde, Shallow Grave, The Living Dead |
| `deployFrom(graveyard, square)` | 5 — Necromancer, Echoing Specter, Soul Swap, Raise Dead, Dirge |
| `toHand(card)` | 6 — Unmarked Trails, Empty Crypt, The Lich, Battlemaster, Shard Wisp |
| `relocate(fighter, square, withStack)` | 9 |
| `toDeckBottom` | Diversion |
| `revealTop` / `discardRevealed` | Ballista, Cross Examine, Decarceration |

The recurring subtlety is **"without its stack"** versus carrying it: seven
effects say one or the other explicitly, so relocation needs the flag.

### 5. Three card types that do not exist yet

- **Construct** — occupies a square, is not a fighter, dies when an enemy
  enters, and is destroyed separately from the stack above it. 8 cards.
- **Attachment** — attaches to a fighter, grants traits and abilities, goes to
  the Graveyard with its host but returns to hand if the host merely leaves.
  3 cards, plus the **Convicted of Heresy** token.
- **Trap** — a Construct played facedown with a `Triggered` condition
  (start of your turn, or *before* an enemy enters). 3 cards. The "before"
  timing is what makes this a replacement trigger and not a plain one.

### 6. Player choices inside an effect

The engine's action model is a single atomic `apply()`. These effects need to
stop and ask:

- *Arcane Blast* — discard X, where X depends on the target chosen first.
- *Tidal Wave* — choose a direction.
- *Shared Knowledge* — choose a trait.
- *Shallow Grave* — the **opponent** chooses 2, then you choose 1.
- *The Shard Dragon* — "you may repeat this any number of times".
- Every **Song** — fatigue any number of your Is as a cost, which sets X.

This needs `apply()` to be able to return a *pending choice* rather than
always completing, which is also what the netcode will have to carry.

## Suggested order

Ordered by cards unlocked per unit of work, and by what depends on what.

| Stage | Build | Unlocks |
|---|---|---|
| 1 | Targeting selector + zone primitives | the plumbing for everything |
| 2 | `onDeploy` trigger | 8 cards, no new concepts |
| 3 | Action abilities that only destroy/move/relocate | ~14 cards |
| 4 | Continuous power and trait layer | 10 cards, and fixes silent wrongness |
| 5 | Constructs (incl. entry triggers) | 8 cards |
| 6 | Pending choices | 10 cards, and the netcode needs it anyway |
| 7 | Attachments + the Convicted token | 4 cards |
| 8 | Traps (replacement triggers) | 3 cards |
| 9 | Back-row redefinition, ability replacement | 3 cards, most invasive |

Stage 4 is worth pulling forward if anything feels wrong in play: an
unimplemented *continuous* effect is invisible, whereas an unimplemented
*action* ability is obvious because the button is not there.

## Cards with no remaining work

38 cards are fully implemented today — every basic fighter whose only ability
is the trait triangle. That is why the table is already playable: the fighters
work, and what is missing is the cleverness.

## The three the scanner could not classify

- **The Everking — Decree**: "all fighters become Is when Attacking or being
  Attacked until your next turn" — a global, timed power override.
- **Temple of Tides**: redefines which squares count as your Back Row, and
  explicitly does not cascade.
- **Deckhand Drifter — Shantyman**: "is considered Singing", a permanent
  version of a state the Songs create temporarily.

All three are continuous effects, which is the layer the engine most lacks.
