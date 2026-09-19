# GUDNAK

**Live: [maxlirio.github.io/GUDNAK](https://maxlirio.github.io/GUDNAK)**

A video-game version of [Gudnak](https://gudnak.com), the 3×3 tactical card
game by Chaotic Great. Browser, no build step. Three phases:

1. **Rules engine** (done) — headless, deterministic, playtested.
2. **3D table** (next) — three.js, cards as objects on a lit board.
3. **Online play** — PeerJS room codes, no server.

## Status

| Piece | State |
|---|---|
| `docs/RULES.md` | Full ruleset transcribed from the official rules app |
| `js/engine.js` | Complete: phases, actions, stacks, siege, stalemate |
| `js/cards.js` | Deck legality + vanilla test fixtures — engine content not wired yet |
| `tools/simulate.js` | Playtest harness, invariants checked every decision |
| `tools/ingest-cards.js` | Turns CARD_FORGE exports into readable card images |
| `cards/decks/*.json` | **125 real cards read off the faces**, 6 decks |
| `cards/by-faction/*.json` | The same cards divided by faction |
| `tools/build-catalog.js` | Rebuilds the faction split + legality report |
| `index.html` + `site/` | Card library website, live on GitHub Pages |
| `game/` | 3D table — battlefield, board, cards, HUD, wired to the engine |
| `js/rules/` | Every card implemented — triggers, continuous effects, choices |
| `game/js/net.js` | Lockstep multiplayer over PeerJS, four-letter rooms |
| Animations | not started |

## Playtesting

```bash
node tools/simulate.js --games 2000 --seed 1
node tools/simulate.js --games 200 --strict     # verify every offered action
node tools/simulate.js --games 1 --verbose      # dump a game log
```

Random-legal bots play whole matches while the harness asserts card
conservation, zone ownership, fatigue legality and action applicability after
**every** decision. Unit tests do not find the interesting bugs; full matches
do.

Last run — 400 games, 33,581 decisions, no violations: P0 49.5% / P1 48.8% /
stalemate 1.8%, mean 44.6 turns.

## Getting card data in

Card content comes from CARD_FORGE, where the real cards live as screenshots.

1. In CARD_FORGE, open the game and start a print job for the cards you want —
   the folder's 🖨 button, or **🖨 Print Job** in the header for the lot.
2. In the dialog set **Output → JSON**, leave Image on *Original art*, Export.
3. Here: `node tools/ingest-cards.js --out cards ~/Downloads/*.cards.json`

That writes `cards/images/<folder>/<name>.png` plus `cards/index.json`, whose
`card: null` slots get filled in with power, traits and rules text once the
faces have been read.

## Engine notes

- State is plain JSON — `structuredClone`-able, hashable, wire-safe. The
  renderer and the netcode both sit on top of it; neither is imported by it.
- Seeded RNG lives *in* the state, so a game replays identically from a seed
  plus its action list. That is the netcode's sync model.
- `legalActions(state)` is exhaustive; there is no pass action, because the
  rules require you to spend your actions if you can.
- Every interpretation the rules left open is marked `[ruling]` in
  `docs/RULES.md` and `RULING #n` in the code.

## Board indices

```
        player 1 stronghold
          6   7   8       <- P1 back row, 7 = P1 gates
          3   4   5
          0   1   2       <- P0 back row, 1 = P0 gates
        player 0 stronghold
```

## The website

`index.html` at the repo root is the site GitHub Pages serves from `main:/`.
It reads `site/data/cards.json` and shows every card read so far, grouped by
deck, filterable by faction, searchable across names, abilities and collector
codes. Clicking a card opens its full face beside the parsed data; `#card-C087`
links straight to one.

Regenerate the site data and images after reading more cards:

```bash
node tools/build-catalog.js          # faction split + legality report
# then re-run the JPEG/thumbnail conversion and site/data/cards.json build
```

The original PNGs are gitignored (~71MB); `site/cards/*.jpg` are what ship.

## The table

`game/` is the playable table. Open `game/` on the site, or locally:

```bash
python3 -m http.server 8000     # then /game/
```

- **The fighters are the cards.** No models. A card lies flat on its square,
  face up, and hovering lifts it, scales it and turns it square-on to the
  camera so the rules text is readable without leaving the board. Fatigue taps
  the card a quarter turn.
- **Both players see everything on the battlefield.** Ownership reads from the
  coloured mat under each card. Only hands and decks are hidden.
- **The layout is the real one**: your deck sits on your Stronghold behind your
  centre square, so the run is deck → three → three → three → deck.
- **Ruins, not castles.** The factions do not all live in forts — Auroxi
  strongholds are giant oxen — so the arena is a ruined place belonging to
  nobody, scattered right around the play area.
- The nine squares are worn flagstones sunk into a dirt apron with grass over
  the joints. There are no drawn gridlines.

`?lite=1` strips shadows and prop counts so headless Chrome (which renders
WebGL on SwiftShader here) can take a screenshot at all. It changes nothing on
a real GPU. `?seed=N`, `?p0=<deck name>`, `?p1=<deck name>` pick the game.

**Not done yet:** animations (cards slide and settle, but there is no deploy
arc or attack clash), and 62 of the 100 cards have effects the engine does not
implement — Constructs, Attachments, Traps, Songs, and every Action and
Deployment ability. Those cards are playable and inert, and the hand labels
them rather than pretending.

## Multiplayer

Open `game/`, choose **Host a game**, and read the four-letter code out. The
other player picks **Join a game** and types it. `game/?room=ABCD` pre-fills it,
so a link works too.

It is peer to peer over PeerJS with no server of ours. **The wire carries the
decision, never the board**: both machines build the same game from the same
seed and apply the same ordered moves. Every move carries a hash of the state
it produced, so a disagreement is reported at once instead of drifting.

```bash
node tools/checklockstep.js --games 800   # two engines, same moves, compared after every move
node tools/playtest.js --games 2000       # every deck vs every deck, random choices
node tools/coverage.js                    # which cards have implementations
node tools/verify-abilities.js            # does each card DO what it SAYS?
node tools/verify-abilities.js --selftest # ...and prove the checker can fail
node tools/shot.js --url "game/?quick=1"  # photograph the table
```

Worth knowing: both clients run the whole engine, so each holds the opponent's
hand in memory. The UI never shows it, but a determined opponent could read it.
Hiding it properly needs an authoritative server, which this deliberately does
not have.
