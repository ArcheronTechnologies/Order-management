import "./style.css";
import { Match } from "./engine/match";
import { Renderer } from "./render/renderer";
import { CLUBS } from "./data/clubs";
import { PRESETS, type TeamTactics } from "./engine/tactics";
import { Season, quickSim, type Fixture } from "./engine/season";
import { Rng } from "./engine/rng";
import type { Team } from "./engine/teams";
import { createTacticsPanel } from "./ui/tactics-panel";

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
};

// --- views ---------------------------------------------------------------
const appView = $("app");
const careerView = $("careerSetup");
const seasonView = $("seasonView");
type ViewName = "career" | "season" | "match";
function showView(v: ViewName) {
  appView.classList.toggle("hidden", v !== "match");
  careerView.classList.toggle("hidden", v !== "career");
  seasonView.classList.toggle("hidden", v !== "season");
}

// --- match view elements -------------------------------------------------
const canvas = $("pitch") as HTMLCanvasElement;
const renderer = new Renderer(canvas);
const formatLabel = $("format").parentElement as HTMLElement;
const speedSel = $("speed") as HTMLSelectElement;
const playBtn = $("playPause") as HTMLButtonElement;
const simBtn = $("simMatch") as HTMLButtonElement;
const newBtn = $("newMatch") as HTMLButtonElement;
const tacticsBtn = $("tacticsBtn") as HTMLButtonElement;
const backToSeasonBtn = $("backToSeason") as HTMLButtonElement;
const homeNameEl = $("homeName");
const awayNameEl = $("awayName");
const homeScoreEl = $("homeScore");
const awayScoreEl = $("awayScore");
const clockEl = $("clock");
const halfEl = $("half");
const eventsEl = $("events") as HTMLUListElement;

// --- season view elements ------------------------------------------------
const clubGrid = $("clubGrid");
const seasonClub = $("seasonClub");
const seasonRound = $("seasonRound");
const tableBody = $("tableBody");
const fixturesList = $("fixturesList");
const fixturesTitle = $("fixturesTitle");
const playRoundBtn = $("playRound") as HTMLButtonElement;
const championBanner = $("championBanner");

// --- state ---------------------------------------------------------------
let match: Match | null = null;
let playing = false;
let renderedCommentary = 0;
let season: Season | null = null;
let userTactics: TeamTactics = { ...PRESETS[0].tactics };
let currentFixture: Fixture | null = null; // the user's fixture being played

const tacticsPanel = createTacticsPanel((t) => {
  userTactics = t;
  if (match) match.setTactics("home", t);
});
tacticsBtn.addEventListener("click", tacticsPanel.open);
$("openTacticsFromSeason").addEventListener("click", tacticsPanel.open);

// ====================== persistence ======================================
const SAVE_KEY = "flyhalf.career.v1";
function save() {
  if (!season) return;
  const data = {
    userShort: season.userClub.short,
    seed: seasonSeed,
    round: season.round,
    tactics: userTactics,
    results: season.fixtures
      .filter((f) => f.played)
      .map((f) => ({ r: f.round, h: f.home.short, a: f.away.short, hs: f.homeScore, as: f.awayScore, ht: f.homeTries, at: f.awayTries })),
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}
let seasonSeed = 1;
function load(): boolean {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return false;
  try {
    const d = JSON.parse(raw);
    const user = CLUBS.find((c) => c.short === d.userShort);
    if (!user) return false;
    seasonSeed = d.seed;
    season = new Season(divisionFor(user), user, seasonSeed);
    season.round = d.round;
    userTactics = d.tactics ?? { ...PRESETS[0].tactics };
    for (const r of d.results ?? []) {
      const f = season.fixtures.find((x) => x.round === r.r && x.home.short === r.h && x.away.short === r.a);
      if (f) season.record(f, r.hs, r.as, r.ht, r.at);
    }
    return true;
  } catch {
    return false;
  }
}

// ====================== career setup =====================================
function divisionFor(club: Team): Team[] {
  return CLUBS.filter((c) => c.region === club.region);
}

function renderClubPicker() {
  clubGrid.innerHTML = "";
  for (const club of CLUBS) {
    const card = document.createElement("button");
    card.className = "club-card";
    card.style.setProperty("--club", club.colors.primary);
    card.innerHTML = `
      <span class="badge" style="background:${club.colors.primary};border-color:${club.colors.secondary}"></span>
      <span class="club-name">${club.name}</span>
      <span class="club-meta">${club.city} · ${club.region === "north" ? "North" : "South"} · ★ ${club.rating}</span>`;
    card.addEventListener("click", () => startCareer(club));
    clubGrid.appendChild(card);
  }
}

function startCareer(club: Team) {
  seasonSeed = (Date.now() & 0xffffff) || 1;
  season = new Season(divisionFor(club), club, seasonSeed);
  userTactics = { ...PRESETS[0].tactics };
  save();
  renderSeason();
}

// ====================== season hub =======================================
function renderSeason() {
  if (!season) return;
  showView("season");
  seasonClub.textContent = `${season.userClub.name}`;
  championBanner.classList.add("hidden");

  // table
  const rows = season.table();
  tableBody.innerHTML = rows
    .map((r, i) => {
      const pd = r.pointsFor - r.pointsAgainst;
      const me = r.team === season!.userClub ? " me" : "";
      return `<tr class="${me.trim()}">
        <td>${i + 1}</td><td class="club">${r.team.short} <span class="full">${r.team.name}</span></td>
        <td>${r.played}</td><td>${r.won}</td><td>${r.drawn}</td><td>${r.lost}</td>
        <td>${pd > 0 ? "+" : ""}${pd}</td><td>${r.bonus}</td><td class="pts">${r.points}</td>
      </tr>`;
    })
    .join("");

  if (season.isComplete()) {
    const champ = season.champion()!;
    seasonRound.textContent = "Season complete";
    championBanner.classList.remove("hidden");
    championBanner.innerHTML = champ === season.userClub
      ? `🏆 <strong>Champions!</strong> ${champ.name} win the league.`
      : `Season over — <strong>${champ.name}</strong> are champions.`;
    fixturesTitle.textContent = "Final standings";
    fixturesList.innerHTML = "";
    playRoundBtn.classList.add("hidden");
    save();
    return;
  }

  seasonRound.textContent = `Round ${season.round} of ${season.totalRounds}`;
  playRoundBtn.classList.remove("hidden");

  // fixtures for this round
  const fx = season.roundFixtures(season.round);
  fixturesTitle.textContent = `Round ${season.round} fixtures`;
  fixturesList.innerHTML = fx
    .map((f) => {
      const mine = f.home === season!.userClub || f.away === season!.userClub;
      const res = f.played ? `${f.homeScore}–${f.awayScore}` : "v";
      return `<li class="${mine ? "mine" : ""}">
        <span class="fx-home">${f.home.name}</span>
        <span class="fx-res">${res}</span>
        <span class="fx-away">${f.away.name}</span>
      </li>`;
    })
    .join("");

  const userFx = season.userFixture(season.round);
  if (userFx) {
    const opp = userFx.home === season.userClub ? userFx.away : userFx.home;
    const venue = userFx.home === season.userClub ? "home" : "away";
    playRoundBtn.textContent = `Play: ${season.userClub.short} v ${opp.short} (${venue})`;
  } else {
    playRoundBtn.textContent = "Advance round";
  }
  save();
}

playRoundBtn.addEventListener("click", () => {
  if (!season) return;
  const userFx = season.userFixture(season.round);
  if (userFx) {
    startUserMatch(userFx);
  } else {
    simRestOfRound(null);
    season.round++;
    renderSeason();
  }
});

$("newCareer").addEventListener("click", () => {
  if (confirm("Start a new career? Your current season will be lost.")) {
    localStorage.removeItem(SAVE_KEY);
    season = null;
    renderClubPicker();
    showView("career");
  }
});

// ====================== playing a match ==================================
function startUserMatch(fixture: Fixture) {
  currentFixture = fixture;
  const home = fixture.home;
  const away = fixture.away;
  const userIsHome = home === season!.userClub;
  // user's tactics go on their side; AI picks a preset
  const aiTactics = PRESETS[(seasonSeed + fixture.round) % PRESETS.length].tactics;
  const seed = (seasonSeed * 131 + fixture.round * 7) >>> 0;
  match = new Match(seed, "union", home, away, {
    homeTactics: userIsHome ? userTactics : { ...aiTactics },
    awayTactics: userIsHome ? { ...aiTactics } : userTactics,
  });
  tacticsPanel.setTeamName(season!.userClub.name);
  renderedCommentary = 0;
  eventsEl.innerHTML = "";
  homeNameEl.textContent = home.name;
  awayNameEl.textContent = away.name;
  formatLabel.classList.add("hidden"); // league is Union
  newBtn.classList.add("hidden");
  simBtn.classList.remove("hidden");
  backToSeasonBtn.classList.remove("hidden");
  backToSeasonBtn.textContent = "‹ Season";
  showView("match");
  syncScoreboard();
  renderer.resize();
  renderer.draw(match);
  setPlaying(true);
}

function finishUserMatch() {
  if (!season || !currentFixture || !match) return;
  const ht = match.events.filter((e) => e.kind === "try" && e.side === "home").length;
  const at = match.events.filter((e) => e.kind === "try" && e.side === "away").length;
  season.record(currentFixture, match.score.home, match.score.away, ht, at);
  simRestOfRound(currentFixture);
  season.round++;
  currentFixture = null;
  backToSeasonBtn.classList.add("hidden");
  backToSeasonBtn.classList.remove("primary");
  simBtn.classList.add("hidden");
  renderSeason();
}

function simRestOfRound(skip: Fixture | null) {
  if (!season) return;
  const rng = new Rng((seasonSeed * 977 + season.round * 31) >>> 0);
  for (const f of season.roundFixtures(season.round)) {
    if (f === skip || f.played) continue;
    const r = quickSim(f.home, f.away, rng);
    season.record(f, r.hs, r.as, r.ht, r.at);
  }
}

backToSeasonBtn.addEventListener("click", () => {
  setPlaying(false);
  if (match && match.finished) finishUserMatch();
  else if (confirm("Leave this match? It will be quick-simmed instead.")) {
    // abandon → quick-sim the user's match too
    if (season && currentFixture) {
      const rng = new Rng((seasonSeed * 53 + season.round) >>> 0);
      const r = quickSim(currentFixture.home, currentFixture.away, rng);
      season.record(currentFixture, r.hs, r.as, r.ht, r.at);
      simRestOfRound(currentFixture);
      season.round++;
      currentFixture = null;
      backToSeasonBtn.classList.add("hidden");
      renderSeason();
    }
  }
});

// ====================== match loop (shared) ==============================
function fmtClock(sec: number): string {
  const total = Math.floor(sec);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
function syncScoreboard() {
  if (!match) return;
  homeScoreEl.textContent = String(match.score.home);
  awayScoreEl.textContent = String(match.score.away);
  clockEl.textContent = fmtClock(match.clock);
  halfEl.textContent = match.finished ? "Full time" : match.half === 1 ? "1st half" : "2nd half";
}
function flushCommentary() {
  if (!match) return;
  for (let i = renderedCommentary; i < match.commentary.length; i++) {
    const c = match.commentary[i];
    const li = document.createElement("li");
    if (c.kind === "try") li.className = "try";
    else if (c.kind === "score") li.className = "score-evt";
    li.innerHTML = `<span class="t">${fmtClock(c.clock)}</span>${c.text}`;
    eventsEl.prepend(li);
  }
  renderedCommentary = match.commentary.length;
}
function setPlaying(on: boolean) {
  if (!match) return;
  playing = on && !match.finished;
  playBtn.textContent = playing ? "Pause" : match.finished ? "Full time" : "Play";
  if (match.finished && currentFixture) {
    backToSeasonBtn.textContent = "Continue ›";
    backToSeasonBtn.classList.add("primary");
  }
}

const SIM_DT = 0.05;
let acc = 0;
let last = 0;
function loop(now: number) {
  requestAnimationFrame(loop);
  if (!last) last = now;
  let frame = (now - last) / 1000;
  last = now;
  if (frame > 0.25) frame = 0.25;
  if (match && playing && !match.finished) {
    acc += frame * Number(speedSel.value);
    let guard = 0;
    while (acc >= SIM_DT && guard < 400) {
      match.step(SIM_DT);
      acc -= SIM_DT;
      guard++;
      if (match.finished) break;
    }
    syncScoreboard();
    flushCommentary();
    if (match.finished) setPlaying(false);
  }
  if (match) renderer.draw(match);
}

simBtn.addEventListener("click", () => {
  if (!match) return;
  playing = false;
  let guard = 0;
  while (!match.finished && guard < 200000) {
    match.step(SIM_DT);
    guard++;
  }
  syncScoreboard();
  flushCommentary();
  setPlaying(false);
  renderer.draw(match);
});

playBtn.addEventListener("click", () => setPlaying(!playing));
// quick exhibition (kept for testing): random clubs, no season
newBtn.addEventListener("click", () => {
  const a = CLUBS[Math.floor(Math.random() * CLUBS.length)];
  let b = CLUBS[Math.floor(Math.random() * CLUBS.length)];
  if (b === a) b = CLUBS[(CLUBS.indexOf(a) + 1) % CLUBS.length];
  currentFixture = null;
  match = new Match((Math.random() * 1e9) >>> 0, "union", a, b, {
    homeTactics: userTactics,
    awayTactics: { ...PRESETS[0].tactics },
  });
  homeNameEl.textContent = a.name;
  awayNameEl.textContent = b.name;
  renderedCommentary = 0;
  eventsEl.innerHTML = "";
  syncScoreboard();
  renderer.resize();
  renderer.draw(match);
  setPlaying(true);
});

// ====================== boot =============================================
if (load()) {
  renderSeason();
} else {
  renderClubPicker();
  showView("career");
}
requestAnimationFrame(loop);
