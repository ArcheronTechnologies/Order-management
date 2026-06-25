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
  - *Done (core):* **persistent players across years** — your squad now carries
    over and is rolled forward each pre-season: the young grow toward potential
    (faster if professional/determined), the prime hold, veterans decline and
    **retire**; **students leave** when their stint ends and **glory-hunters
    leave low-reputation clubs** for bigger ones; a **youth intake** (and fresh
    students for uni clubs) tops the squad back to its reputation-scaled size.
    Visible attributes track ability changes; a pre-season summary shows
    retirements / departures / arrivals / risers (`development.ts`, full user
    roster persisted in saves).
  - *Done (old boys):* notable retirees from your club come back as **old boys** —
    donors & supporters who give a yearly donation that scales with how
    successful their years were (seasons served + peak ability). Their combined
    donations are a growing passive income line, shown on the Club screen and in
    the finances (`makeOldBoy`, `seasonsAtClub` tenure tracking).
  - *Done:* **in-season training** — a weekly plan (intensity light/normal/hard
    × focus balanced/fitness/attack/defence/set-piece) nudges ability and the
    focused attributes toward potential. Amateur-capped by **turnout**
    (commitment + a low-reputation club struggling for numbers), so thin
    sessions develop less; hard weeks gain more but tire legs and risk
    training-ground knocks. Post-round report in the season note; plan persisted
    (`training.ts`). *Still to do:* individual focuses, mentoring, coaching staff.
- **M7 — Morale, squad dynamics & player interaction.** Morale/concerns/promises;
  hierarchy/social groups/leaders/dressing room; 1‑on‑1s & praise/criticism;
  captain / goal-kicker / set-piece taker; team talks.
  - *Started:* **team talks** (pre/half/full-time) with five tones whose
    reception depends on tone × scoreline × personality/temperament, giving a
    transient in-match lift/slump that fades through the half (`teamtalk.ts`,
    `Match.talkBoost`). **Game-time unhappiness**: starters lift, fit players
    left out stew — the ambitious & big-ego most of all — surfaced as
    dressing-room concerns (`applySelectionMorale`/`squadConcerns`).
  - *Started:* **squad roles** — captain (natural leader), goal-kicker and
    lineout caller, auto-assigned and editable from the squad screen. They feed
    the match: the goal-kicker takes the kicks at goal, a lineout caller on the
    field steadies the throw, and a strong captain makes team talks land harder
    (`teams.assignRoles`/`leadershipScore`/`setRole`, `Match.bestKicker`).
- **M8 — Deeper tactics & set-piece creator.** Roles & duties per position;
  in-possession / transition / out-of-possession instructions; opposition
  instructions; familiarity; a set-piece creator; shouts & mentality.
- **M9 — Match-day presentation & in-match management.** Follow-ball camera/zoom;
  highlights/commentary/full view modes; broadcast overlays; live stats
  (possession, territory, an xPoints analogue); substitutions UI.
  - *Done (stats):* a **live broadcast stats panel** in the match view —
    possession & territory split bars, tries, line breaks, tackle success,
    kicks from hand, turnovers won, penalties conceded, and scrum/lineout
    retention %. Per-side stats accumulated in the engine (`Match.stats` /
    `SideStats`), updating every frame.
  - *Done (subs):* **live substitutions** — a touchline Subs panel pauses the
    match, lists your on-field XV (with fitness) and available bench (with CA),
    and brings a replacement on (up to 8, union limit). The engine swaps them
    on the dots mid-play, keeping the ball with the new man if needed
    (`Match.substitute`).
  - *Done (ratings):* **player match ratings & man of the match** — per-player
    contributions tracked in the engine and normalised against the field into
    4.5–10.0 ratings; the man of the match and your top performer are surfaced
    post-match, and a blinder lifts morale while a stinker dents it
    (`ratings.ts`, `Match.contrib`).
  - *Done (match-day environment):* the canvas now draws the home club's
    surroundings — a **grandstand & crowd** along the top touchline (a built stand
    for owned grounds, sized by facilities; just a rope & sparse spectators for a
    shared communal ground), **pitch-side sponsor boards** along the bottom, and a
    **pitch surface that reflects its condition** (lush & striped when well kept,
    scruffy with muddy patches when worn — owned grounds you maintain can be
    pristine, shared communal pitches stay scruffy). Crowd density scales with
    reputation, facilities and form (`matchday.ts`, `render/renderer.ts`).
    *Still to do:* follow-ball camera/zoom, view modes.
- **M10 — Recruitment, retention & staff.** Local catchment, uni links, walk-ups,
  trials; scouting reports/shortlists; retention vs life-pull; volunteer staff.
  - *Done (recruitment):* an amateur **free-agent / walk-up pool** refreshed each
    season — local lads, walk-ups, trialists, returning students and the odd
    ex-pro, with pool quality scaled by the club's pulling power (reputation).
    A Recruitment screen lists each with background, age and **scouted ability &
    potential star ratings**; sign them into the squad (free in the amateur game,
    a small signing-on fee at the semi-pro top tier) up to a squad cap
    (`recruitment.ts`). *Still to do:* deeper scouting reports/shortlists,
    retention vs life-pull, volunteer staff.
- **M11 — Club operations, finances & committee.** Costs vs income; semi-pro
  budgets; committee confidence/objectives/job security; vision; facilities.
  - *Done (finances):* a **club bank balance** carried across years, settled each
    season. Income = membership fees (squad size) + reputation-driven sponsorship
    (semi-pro multiplier at the top tier) + matchday gate; costs = facilities
    upkeep + kit/insurance + **travel by real geography** (great-circle distance
    between club cities — Umeå's away trips cost ~3× a Stockholm club's). A
    Finances screen shows the breakdown, a season-end projection, and **committee
    mood** (from balance + league position) (`finances.ts`, `data/geo.ts`).
  - *Done (facilities):* spend the bank balance to **upgrade facilities** (level
    1→5) from the Finances screen. Higher facilities raise the reputation ceiling
    the club is pulled toward each year (the money→facilities→prestige→squad loop)
    but also cost more in annual upkeep. Per-club facilities level persists for
    all clubs (`facState`, `Season.facilities`).
  - *Done (club operations & a board with politics):* the club is yours to run.
    **Capital projects** — buy your **match field** (own the ground → better pitch,
    no rent), buy the **training ground** (sharper sessions), and **build the
    clubhouse** (Portacabin → Clubhouse → Pavilion) — are proposed to a **board**
    that **votes** on them (you can't cast their votes). Five board members each
    have a **priority** (Ambition / Prudence / Facilities / Youth / Community) and
    an opinion of you that shifts each season by whether you served their priority;
    you do **politics** — *lobby* a member to warm them, or *move against* a hostile
    one to have the board oust them (risky). **Clubhouse access** (tight / balanced
    / loose) trades cohesion & bar takings against the odd costly clear-up
    (`board.ts`, composite facilities from owned assets). *Still to do:* committee
    objectives/job security as a firing threat.
  - *Done (sponsors):* **pitch-side sponsorship**. Each season a pool of local
    sponsor offers appears, scaled by club standing & tier; sign up to four to
    bank an up-front fee and put their **board on the sideline** (rendered in the
    match). Every deal carries a **performance goal** (finish top N / win X
    matches) and a **development goal** (grow reputation by N / upgrade facilities
    / avoid the drop) that pay bonuses when met — settled against the final table
    and the club's growth at season's end (`sponsors.ts`). *Still to do:*
    committee objectives/job security, multi-year deals, fundraising.
- **M12 — Youth & academy.** Annual intake (newgens), minis/juniors, schools links,
  U18/U20, development centres, feeder/affiliate clubs.
- **M13 — Competitions & game world.** Full Swedish pyramid + promotion/relegation,
  cups, Grand Final, Nordic Cup, Sevens series; then Denmark/Norway/Germany/USA
  leagues; women's rugby; national-team management.
  - *Done (sevens):* a **summer Sevens Cup** — an eight-team single-elimination
    tournament (seeded by reputation) you reach from the season hub. Your club
    fields a 7s VII drawn from its real squad (three mobile forwards, four quick
    backs); play your ties in the match view or sim the round, advancing to a
    champion (winning it lifts squad morale & reputation). The 7s match engine
    was rebalanced — far more open space, decisive clean breaks — so games are
    high-scoring and competitive (`sevens.ts`, sevens-gated engine tuning).
  - *Done (pyramid):* a **two-tier, 24-club pyramid with promotion/relegation**.
    Added a **Division 1** (12 clubs, 6 N + 6 S) below the Allsvenskan; you can
    start in either tier and climb. Each year the **whole pyramid moves** (living
    world): per region the Allsvenskan bottom is auto-relegated, the Division 1
    champion auto-promoted, and the Allsvenskan 5th meets the Division 1 runner-up
    in a **playoff you play** (or sim if you're not in it). Per-club tier &
    reputation now persist for all 24 clubs (`tiers`/`repState` in saves);
    `divisionFor` filters by region + current tier; standings for the divisions
    you don't play are quick-simmed (`season.simStandings`). Club picker grouped
    by tier; season header shows your division; end-of-season banner spells out
    your fate and a pyramid summary lists who went up/down.
  - *Done (Grand Final):* the two **Allsvenskan regional champions** meet in a
    cross-region **Grand Final** for the national title. If your club tops its
    region you play the final in the match view (else it's simmed and the national
    champion shown); winning it boosts reputation & morale. Resolved before the
    promotion/relegation rollover and persisted (`gfResolved`/`nationalChamp`).
    *Still to do:* Nordic Cup, other nations, women's rugby.
- **M14 — Manager & career meta.** Manager creator, backstory, coaching badges,
  job offers/interviews, journeyman, career history.
  - *Done (profile & history):* name your manager at career start; a Manager
    screen shows lifetime record (matches, win %), honours (league titles,
    national titles, promotions) and a **season-by-season career history** table,
    persisted. *Still to do:* job offers/interviews, coaching badges, journeyman.
- **M15 — Media & reputation.** Local press conferences, interviews, social feed,
  news/rumours, reputation.
- **M16 — Interface, tools & meta.** Portal/hub + bookmarks, search + a
  "RugbyPedia" glossary, inbox/news, data hub + comparison tools, calendar;
  modding / custom DB; holiday / instant-result.
  - *Done (inbox):* a **club inbox / news feed** that accumulates the career's
    headlines — match results (with man of the match), signings, new sponsors,
    facility upgrades, season summaries, promotion/relegation, Grand Final and
    Sevens outcomes — each dated by year/round, newest first, persisted across
    reloads (`logNews`/news view). *Still to do:* search, RugbyPedia, data hub,
    calendar, modding.

## Someday-maybe (not scoped)

3D/Unity match engine; online multi-manager; mobile/PWA packaging; official
licensing; Steam-Workshop-style sharing.
