# Fly-Half

A rugby management sim in the spirit of *Football Manager* — but for rugby, and
deliberately without a fancy 3D match engine. Matches play out **top-down with
dots** representing players, so all the depth lives in the simulation and (soon)
the management layer rather than the graphics.

Supports both **Rugby Union (15-a-side)** and **Sevens (7-a-side)** on the same
World Rugby pitch; the formats differ in squad size and match length, and the
faster, more end-to-end feel of Sevens falls out naturally from having fewer
defenders on a full-size field.

## Status

**Milestone 1 — the match engine** (current). A watchable, self-contained match:

- Two procedurally generated squads with FM-style 1–20 attributes
  (pace, handling, tackling, kicking, strength, stamina).
- A possession-based simulation: carry, pass, kick for territory, tackles,
  rucks, turnovers, knock-ons, interceptions.
- Scoring: tries, conversions, and penalties, with goal kicks resolved from
  distance and angle.
- A live scoreboard, match clock with two halves, and a commentary feed.
- Deterministic and seeded, so any match can be replayed exactly.

### Not yet built (planned)

- The management layer: clubs, leagues & fixtures, squad selection, training,
  transfers, results tables.
- Tactics that feed into the match engine (defensive line speed, kicking game,
  width, etc.).
- Persistence / save games.

## Running it

Requires Node 18+.

```bash
npm install
npm run dev      # start the dev server, then open the printed URL
```

Other scripts:

```bash
npm run build      # type-check and produce a production build in dist/
npm run preview    # serve the production build
npm run typecheck  # type-check only
```

## Controls

- **Format** — switch between Union (15s) and Sevens (7s); starts a fresh match.
- **Speed** — 1×–8× simulation speed.
- **Play / Pause** — run or hold the match.
- **New match** — generate two new squads and kick off.

## How the match engine works

The pitch is modelled in metres (120 × 70, including the two 10 m in-goal
areas). Each tick (`Match.step`) advances play through a small state machine:

`kickoff → flight → open → ruck → (open | turnover | penalty | conversion) → …`

Players steer toward simple targets — the carrier runs at the biggest gap,
defenders press the ball or hold the line, support runners trail for the pass —
and contact, contests, and goal kicks are resolved probabilistically from the
players' attributes. The renderer (`src/render/renderer.ts`) just paints that
state: pitch markings, coloured dots with shirt numbers, and the ball.

## Layout

```
src/
  engine/
    rng.ts        seedable PRNG (deterministic replays)
    types.ts      Player / Ball / phase types
    formats.ts    Union vs Sevens config + pitch geometry
    teams.ts      squad generation & sample clubs
    match.ts      the simulation state machine
  render/
    renderer.ts   canvas rendering of the match state
  main.ts         game loop, controls, scoreboard, commentary
```
