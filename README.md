# Fly-Half

An **amateur / semi-professional rugby club management sim** in the spirit of
*Football Manager* — set in the **Swedish club rugby** system, and deliberately
without a fancy 3D match engine. Matches play out **top-down with dots**, so all
the depth lives in the simulation and (in time) the management layer.

The differentiator is *amateurism*: players have day jobs and lives, so
availability, recruitment, finances, travel and morale — not money and big
transfers — are the core tensions. The year mixes a summer **Union (15s)** league
with **Sevens (7s)** tournament weekends.

See `docs`/the plan for the full scope & roadmap.

## Status

**Milestone 1 — match engine** ✅ and **Milestone 2 — match & tactics depth** (in
progress). The match is a watchable, self-contained game of rugby:

- Real **Swedish clubs** (Allsvenskan) with procedurally generated squads of
  named, positioned players (1–15 / sevens roles) and **FM-style 1–20
  attributes** — pace, strength, stamina, handling, tackling, kicking, decision
  making, positioning, discipline, plus set-piece scrummaging/lineout/throwing.
- **Full FM-style tactics** you set in a dedicated screen (the **Tactics**
  button): a selectable **attack formation** (1‑3‑3‑1 / 2‑4‑2 / 1‑3‑2‑2), a
  **defensive system** (drift / blitz / umbrella), and seven instruction sliders
  (line speed, breakdown aggression, width, kicking game, tempo, ruck commitment,
  set‑piece focus), with presets. Your changes apply **live**; the AI opponent
  sets up its own way. Every one of these visibly changes how the side plays.
- All twelve player attributes now feed the match — including decision‑making
  (option choice & handling errors), positioning (defensive read, cover & kick
  fielding) and discipline (penalties conceded).
- **Realistic shape & flow**, researched from real rugby: forward **pods** and a
  **backline at depth** in attack; a connected **defensive line** that fans from
  the breakdown with **pillars** at the ruck and a **backfield** (fullback +
  wing) dropped deep; per-phase plays (pick-and-go, pod carry, go wide, kick);
  passing along the line; and mistakes on both sides (knock-ons, forward passes,
  missed tackles, breakdown turnovers, interceptions, penalties).
- **Set pieces**: scrums (with against-the-head and pushover tries) and lineouts
  (steals, off-the-top ball or a catch-and-drive maul).
- Scoring: tries, conversions, penalties; goal kicks resolved from distance/angle.
- A live scoreboard, two-half match clock, and a commentary feed.
- Deterministic and seeded, so any match can be replayed exactly.

### Still to come

- **This milestone:** live touchline control (substitutions & in-match tactic
  changes), a pre-match team-selection screen, set-piece visuals, and a Sevens
  scoring balance pass.
- **Later:** the management layer — season, fixtures & tables, the amateur
  availability/jobs model, club finances, recruitment & youth — and save games.

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
areas). Each tick (`Match.step`) advances play through a state machine:

`kickoff → flight → open → ruck → (open | scrum | lineout | turnover | penalty | conversion) → …`

At each breakdown a **play** is chosen from the side's tactics and field
position, and during the ruck both teams pre-form their shape, so when the ball
emerges the attack is in pods + a backline and the defence is a fanned line with
pillars and a backfield. Contact, contests, set pieces and goal kicks are
resolved probabilistically from the players' 1–20 attributes and the tactics.
The renderer (`src/render/renderer.ts`) paints that state: pitch markings,
coloured dots with shirt numbers, and the ball.

## Layout

```
src/
  engine/
    rng.ts        seedable PRNG (deterministic replays)
    types.ts      Player / Ball / Position / phase types & attributes
    formats.ts    Union vs Sevens config + pitch geometry
    teams.ts      positions, squad generation & Swedish player names
    tactics.ts    team tactics sliders, presets & defaults
    match.ts      the simulation state machine (shape, plays, set pieces)
  data/
    clubs.ts      the real Swedish Allsvenskan clubs
  render/
    renderer.ts   canvas rendering of the match state
  main.ts         game loop, controls, scoreboard, commentary
```
