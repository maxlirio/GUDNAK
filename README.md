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
| 3D renderer | not started |
| Netcode | not started |

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
