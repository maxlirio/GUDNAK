# Gudnak — rules of record

Source of truth for `js/engine.js`. Transcribed from the official rules app
(`players.gudnak.com/rules`) on 2026-09-17. Where the engine had to pick an
interpretation, it is marked **[ruling]** and listed again in OPEN QUESTIONS.

## Battlefield

A 3×3 grid of squares between two Strongholds.

```
        player 1 stronghold
          6   7   8          <- P1 back row, 7 = P1 Gates
          3   4   5
          0   1   2          <- P0 back row, 1 = P0 Gates
        player 0 stronghold
```

- The row closest to your Stronghold is your **Back Row**.
- The middle square of your Back Row is your **Gates**.
- Your deck sits in the Stronghold space. Destroyed/discarded cards go to your
  **Graveyard**.

## Cards

Two types: **Fighters** (stay on the battlefield) and **Tactics** (one-shot).

Fighters are **Hero** or **Basic**. Power is **I, II or III** (1/2/3).

Traits: Brute, Soldier, Hunter, Hero, Demon, Shadow, Token.

Trait triangle — a **Basic** fighter gets **+I while attacking** its prey:

| attacker | +I against |
|---|---|
| Brute   | Soldier |
| Soldier | Hunter  |
| Hunter  | Brute   |

Having a trait does not grant the ability: a *Hero* with the Soldier trait does
**not** get +I against Hunters. The bonus is printed on basic cards only.

Ability types: **Action** (costs an action to use), **Deployment** (may resolve
while taking the Deploy action), **Constant** (always on while on the
battlefield or being deployed).

## Setup

1. Build and shuffle a 20-card deck, place it in the Stronghold space.
2. Draw 5. You may mulligan once: shuffle the hand back and redraw 5.
3. Randomly determine the active player.

## Turn

### 1. Start Phase
If an enemy fighter occupies your Gates you are **Sieged**.
- Sieged → put the top card of your deck into your Graveyard. If you cannot
  (Stronghold empty), **you lose**.
- Not sieged → draw a card.

### 2. Action Phase
Gain **2 actions** (**1** instead on the first turn of the game). You **must
use them if possible**, in any order, repeating action types freely.

| Action | Cost | Effect |
|---|---|---|
| **Draw** | 1 | Top card of deck to hand. Not available with an empty deck. No hand limit. |
| **Deploy** | 1 | Put a fighter from hand onto an unoccupied square in your Back Row, **or** onto a square in your Back Row holding a fighter you control that shares ≥1 Trait — this forms a **stack**. Deployed fighter becomes fatigued. |
| **Move** | 1 | Put a fighter you control into an orthogonally adjacent **unoccupied** square. It becomes fatigued. |
| **Attack** | 1 | See below. |
| **Defend** | 1 | Only if an enemy fighter occupies your Gates. Discard cards from hand equal to that fighter's power, then **destroy it**. |
| **Use Ability** | 1 | Resolve an Action ability on a card you control. If it was a fighter, it becomes fatigued. |
| **Play Tactic** | 0–2 | Cost printed on the card. Resolve, then to Graveyard. |

You cannot take actions with **fatigued** fighters unless stated otherwise.

**Attack.** Choose an enemy fighter orthogonally adjacent to one of your
fighters.
1. *Calculate power* — base power plus modifiers, for both fighters.
2. *Determine winner* — attacker higher → enemy destroyed. Equal → **both**
   destroyed. Enemy higher → attacker destroyed.
3. *Resolve* — relocate the attacking fighter and any fighters remaining in its
   stack into the enemy's square **if it is now unoccupied**. The attacker
   becomes fatigued (if it survived).

### 3. End Phase
Resolve end-of-turn effects, then every fighter (including those inside stacks)
is no longer fatigued. Turn passes.

## Stacks

- Formed by deploying onto a trait-sharing friendly fighter in your Back Row.
- No size limit.
- Only the **topmost** fighter counts as being in play, can act, be sacrificed,
  destroyed or targeted, unless otherwise specified.
- Moving/relocating a fighter carries everything underneath it, order preserved.
- Only the topmost fighter becomes fatigued after an action.
- **Do not add up power** in a stack.
- A stack may contain fighters of different owners; the owner of the topmost
  fighter controls it and is the only one who can act with it.

## Winning

Win by successfully Sieging your opponent's **empty** Stronghold — i.e. they
start a turn Sieged with no cards left to mill.

- **Draw** — no player can win (e.g. nobody has fighters left on the
  battlefield or in hand).
- **Stalemate** — no player makes progress and turns repeat the same actions
  4 times.

## Deck building

Exactly 20 cards. Choose a faction; every card must be that faction or Neutral.

- **5 Heroes** — 1× III, 2× II, 2× I.
- **5 Tactics** — any action cost.
- **10 Basic Fighters** — 2× III (max 1 of each trait), 4× II (max 2 of each
  trait), 4× I (max 2 of each trait). Basic fighters without traits do not
  count towards trait maximums.

Max 1 copy of any given Tactic or Hero.

## Learned from the cards themselves (2026-09-18, 125 card faces)

**Ability-type icons.** Every ability is prefixed by one of three glyphs, and
the glyph is what tells you whether it costs an action:

| glyph | type | meaning |
|---|---|---|
| `<↗>` | Constant | always on while on the battlefield |
| `<+>` | Action | costs one of your two actions |
| `<↓>` | Deployment | resolves when you take the Deploy action |

**The trait triangle is card text, not a global rule.** It appears as three
named Constant abilities printed on basic fighters:

- *Overwhelming Strength* — Brute, +I when Attacking Soldiers
- *Superior Coordination* — Soldier, +I when Attacking Hunters
- *Armor Piercing* — Hunter, +I when Attacking Brutes

A Hero with the same trait does **not** get the bonus, which is exactly why
`js/cards.js` models it per-card rather than as an engine rule.

**Constructs and Attachments fill the 5 Tactic slots.** Every complete deck
read had exactly 5 cards across Tactic + Construct + Attachment. Deck legality
must count the three together, not Tactics alone.

- **Construct** — cost 0–2, played into a square, stays until destroyed.
- **Attachment** — cost 0–2, attaches to a fighter and grants it text.
- **Trap** — a Construct played *facedown*, with a **Triggered** condition
  (start of your turn, or before an enemy enters the square).

**Traitless basic fighters exist** (Totally Normal Villager, Deckhand Drifter)
— confirming the deck-building note that they are exempt from trait maxima.

**Neutral cards** (plain circle sigil) are legal in any faction's deck.

**Song / Singing** — a keyword on Marvorren cards: *"Song: Fatigue any number
of Is you control, they are considered Singing until the end of your turn"*,
then an effect scaled by the number of friendly Singing fighters.

## Card types not yet modelled

Tokens, Locations, Nested Actions. Constructs, Attachments and Traps are
described above but not yet implemented in the engine.

## OPEN QUESTIONS — engine rulings

1. **End Phase un-fatigue scope.** The text says "each fighter ... is no longer
   fatigued". The engine clears fatigue only on fighters owned by the active
   player, since only they can have been fatigued by a normal turn. If an effect
   ever fatigues an enemy fighter, that fighter clears on *its* controller's end
   phase. **[ruling]**
2. **Defend with too few cards.** Defend requires discarding exactly the
   fighter's power in cards, so the engine only offers it when
   `hand.length >= power`. **[ruling]**
3. **Draw with an empty deck while not Sieged.** Treated as a no-op rather than
   a loss; you only lose by milling while Sieged. **[ruling]**
4. **Stalemate detection.** Formalised as: the full game state (board, hands,
   decks, graveyards, active player) repeating 4 times at turn start.
   **[ruling]**
5. **Dead games.** Once both Strongholds are empty and nobody is Sieged, no
   player can ever be made to lose a card, and fighters can shuffle about
   forever without the position ever repeating exactly. The engine calls a Draw
   when both decks are empty and no fighter has been destroyed for ten turns —
   the rulebook's "no player can win" case, detected by lack of progress rather
   than by exact repetition. **[ruling]**
6. **A hard turn cap.** Cards that Deploy out of the Graveyard (Necromancer,
   Echoing Specter, The Living Dead) can trade fighters indefinitely, so a game
   is not guaranteed to terminate. At 400 turns the engine calls a Draw.
   **[ruling]**
