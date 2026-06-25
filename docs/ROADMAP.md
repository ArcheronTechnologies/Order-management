# Fly-Half — Roadmap

An **amateur / semi-pro rugby club management sim** set in the Swedish (then
Nordic+) system, played by watching/coaching **top-down 2D "dots"** matches —
"Football Manager for grassroots rugby."

## Shipped so far

- **Match engine** with researched real shape & flow: forward pods + a diagonal
  backline, a connected defensive line with ruck pillars and a deep back three
  that drifts, per-phase plays (pick / pod / wide / kick), ball through the hands,
  realistic kickoff & kick-chase, set pieces (scrum / lineout / maul), and
  mistakes on both sides. Deterministic & balanced (~30 pts/match, try-led).
- **Full FM-style tactics** (live): attack formation (1‑3‑3‑1 / 2‑4‑2 / 1‑3‑2‑2),
  defensive system (drift / blitz / umbrella), seven instruction sliders, presets.
- **All twelve 1–20 player attributes wired**, position-weighted, with real
  Swedish clubs and generated Swedish player names.
- **Career mode**: pick a club, play a season vs your region, league table with
  bonus points, play-or-Sim matches, the league sims around you, champion, and
  localStorage saves.

## Adaptation principles (FM26 features → Fly-Half)

The FM26 feature set is adapted to a solo, top-down 2D, web-based,
amateur/semi-pro rugby game:

- **Identity = top-down 2D dots.** We invest in 2D presentation (follow-ball
  camera, highlights/commentary-only modes, broadcast overlays, live stats). A
  3D/Unity engine is a *someday-maybe* note, not scoped.
- **Economy = semi-pro hybrid.** Low tiers amateur-true (no fees/wages; players
  move for life reasons; finances = running costs; contracts = registration +
  commitment). Higher tiers unlock small expenses/match fees + modest budgets.
- **World expands** beyond Sweden to **Denmark, Norway, Germany, USA** league
  systems (loadable nations, one world). **Women's rugby** as a parallel layer.
  **Modding / custom DB** in scope.
- **Cut (out of scope):** 3D/Unity engine, official licences, motion-capture,
  console/Netflix/mobile builds & PWA, online multi-manager, Steam Workshop.

Key reinterpretations: transfers/contracts → **amateur recruitment & retention**;
scouting → watch local/uni games & word of mouth; staff → volunteer backroom;
board → **club committee**.

## Roadmap (post-career-mode)

M4–M5 are the immediate priority (the amateur soul + the squad-persistence
refactor everything else needs).

- **M4 — Persistent squads & deep player model.** Persistent seeded club squads;
  technical/mental/physical + hidden attrs (CA/PA, determination, professionalism,
  consistency, temperament), roles & natural positions, traits, personality;
  squad/depth view; Match accepts a chosen lineup.
- **M5 — Amateur availability, condition & medical.** Day jobs; per-match
  availability; condition/fitness/fatigue/sharpness; injuries + recovery;
  team-selection screen (XV + bench from available players).
- **M6 — Training & development.** Schedules/intensity (amateur-capped), individual
  focuses, retraining, mentoring; CA→PA development, aging & retirement.
- **M7 — Morale, squad dynamics & player interaction.** Morale/concerns/promises;
  hierarchy/social groups/leaders/dressing room; 1‑on‑1s & praise/criticism;
  captain / goal-kicker / set-piece taker; team talks.
- **M8 — Deeper tactics & set-piece creator.** Roles & duties per position;
  in-possession / transition / out-of-possession instructions; opposition
  instructions; familiarity; a set-piece creator; shouts & mentality.
- **M9 — Match-day presentation & in-match management.** Follow-ball camera/zoom;
  highlights/commentary/full view modes; broadcast overlays; live stats
  (possession, territory, an xPoints analogue); substitutions UI.
- **M10 — Recruitment, retention & staff.** Local catchment, uni links, walk-ups,
  trials; scouting reports/shortlists; retention vs life-pull; volunteer staff.
- **M11 — Club operations, finances & committee.** Costs vs income; semi-pro
  budgets; committee confidence/objectives/job security; vision; facilities.
- **M12 — Youth & academy.** Annual intake (newgens), minis/juniors, schools links,
  U18/U20, development centres, feeder/affiliate clubs.
- **M13 — Competitions & game world.** Full Swedish pyramid + promotion/relegation,
  cups, Grand Final, Nordic Cup, Sevens series; then Denmark/Norway/Germany/USA
  leagues; women's rugby; national-team management.
- **M14 — Manager & career meta.** Manager creator, backstory, coaching badges,
  job offers/interviews, journeyman, career history.
- **M15 — Media & reputation.** Local press conferences, interviews, social feed,
  news/rumours, reputation.
- **M16 — Interface, tools & meta.** Portal/hub + bookmarks, search + a
  "RugbyPedia" glossary, inbox/news, data hub + comparison tools, calendar;
  modding / custom DB; holiday / instant-result.

## Someday-maybe (not scoped)

3D/Unity match engine; online multi-manager; mobile/PWA packaging; official
licensing; Steam-Workshop-style sharing.
