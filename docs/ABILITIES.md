# Abilities — what the cards actually ask for

A scan of all cards read so far — now including the full 75-card Auroxi pool.
`node tools/scan-abilities.js --full` regenerates the inventory; this document
is the reading of it.

- **127** unique cards, **130** abilities and effects
- **47** are the trait triangle, already implemented as `bonusVsTrait`
- **83** remain

The Auroxi added 12 effects but almost no new *machinery* — they lean on the
same triggers and continuous layer the rest of the pool already needed. What
they did add is structural, and it is described at the end: The Void, and
Strongholds that are also fighters.

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


## Stronghold cards — found 2026-09-18 in the Auroxi pool

A **Stronghold is a card**, brought from outside the 20-card deck and placed in
the Stronghold space with your deck stacked on top of it. The six "unfiled"
cards in the library are these, not mat art; they have been reclassified.

Most are inert. The Auroxi ones are not:

**Living Stronghold** — power II, no trait, no collector code.
- *On the Move* (constant): During your Action Phase, while this fighter is not
  fatigued, squares adjacent to it are considered your Gates.
- *Avatar* (constant): If this fighter is destroyed, you lose the game.

**Black Aurox** — power II, no trait, no collector code.
- *Yoke of The Void* (constant): During your turn, squares adjacent to this
  fighter are considered adjacent to *The Void*.
- *Avatar* (constant): If this fighter is destroyed, you lose the game.

Both **replace your Stronghold and function as one**. When your deck runs out
and the Stronghold is revealed, it becomes a **Stronghold-fighter** on the
battlefield that is both at once. Your printed Gates stay where they are;
*On the Move* **adds** Gates rather than moving them, which the rulebook already
allows for — *"even if an effect causes them to move or for you to have
multiple Gates"*.

What this needs from the engine:

- a Stronghold zone that holds a card, with the deck on top of it
- a reveal step when the deck empties, putting that card onto the battlefield
- `Avatar` — an instant-loss condition separate from being sieged out
- **multiple Gates**, computed rather than the constant `GATES = [1, 7]`. Siege
  and Defend both key off "an enemy fighter on your Gates", so that has to
  become a set, not an index.

## The Void — a Location, and a tenth square

**The Void** (M208, LOCATION): *"Before the start of the game, if your
Stronghold or any card in your deck mentions The Void, put this card beside the
Battlefield. This card is considered a square on the Battlefield, in your Back
Row, and adjacent only to the center square."*

This breaks the 3×3 assumption outright. The board becomes a **graph**, not a
grid: a tenth square that is in your Back Row (so you can Deploy to it) and
adjacent only to square 4. `ADJACENT` has to become data rather than arithmetic.

At least eight Auroxi cards reference it (Voidstrider, Shadowcaster, Veil
Shearer, Veil Shroud, Shadow Hunter, Shadowstep Shuttle, Drop Shadow, Black
Aurox), along with the **Shadow** trait.

Worth doing before the deck builder: a faction whose mechanic is an extra
square cannot be bolted on afterwards.


## What the full Auroxi pool changed

Reading all 75 confirmed the shape of the work rather than widening it. Two
new mechanics, both continuous:

**Voidlink** — on every Shadow basic: *"During your turn, this fighter has the
abilities of all fighters that are in The Void and share a trait with it."*
That is ability-granting computed from board position, so it belongs in the
continuous layer with *Shared Knowledge* and *Inspiration*.

**Bolt attachments** — nine of them, all the same shape: the Attachment grants
the host an Action ability, and *"once per turn, after attached <trait> Moves
or is relocated, it may Use this Ability"*. One trigger plus one granted
ability covers the whole cycle.

Three cards bend the Gates, which is why Gates had to stop being a constant:

- **Divine Aurox** (A001) and **Living Stronghold** — squares adjacent to them
  count as your Gates while they are unfatigued.
- **Looming Large** (A039) — squares adjacent to your Gates become Gates for a
  turn.
- **Avatar's Burden** (M204) — attaches to your Stronghold and *removes* your
  Gates entirely: *"While this fighter is in play, you have no Gates."*

So Gates is a computed **set** that can grow, move, or be empty. Siege and
Defend both key off it, and `isSieged` currently reads a single index.

Two cards swap places with a named card that is not in play (**Boltbeast** ⇄
**Boltbearer**), which needs a "find this specific card wherever it is" lookup
that no other card in the pool asks for.

And **Veteran Herdsman** puts *Migration* into your hand **from outside the
game** — a second out-of-deck zone alongside tokens and Strongholds.
