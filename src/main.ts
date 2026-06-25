import "./style.css";
import { Match } from "./engine/match";
import { Renderer } from "./render/renderer";
import { CLUBS } from "./data/clubs";
import { PRESETS, type TeamTactics } from "./engine/tactics";
import { Season, quickSim, type Fixture } from "./engine/season";
import { Rng } from "./engine/rng";
import type { Team } from "./engine/teams";
import { UNION_POSITIONS } from "./engine/teams";
import {
  rollAvailability,
  autoSelect,
  applyLineup,
  applyPostMatch,
  applyWeeklyRecovery,
  fitScore,
  type Availability,
} from "./engine/availability";
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
const squadView = $("squadView");
const selectView = $("selectView");
type ViewName = "career" | "season" | "match" | "squad" | "select";
function showView(v: ViewName) {
  appView.classList.toggle("hidden", v !== "match");
  careerView.classList.toggle("hidden", v !== "career");
  seasonView.classList.toggle("hidden", v !== "season");
  squadView.classList.toggle("hidden", v !== "squad");
  selectView.classList.toggle("hidden", v !== "select");
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

const squadBody = $("squadBody");
const squadClub = $("squadClub");
function renderSquad() {
  if (!season) return;
  squadClub.textContent = season.userClub.name;
  const roster = [...season.rosterFor(season.userClub)].sort(
    (a, b) => a.position.number - b.position.number
  );
  squadBody.innerHTML = roster
    .map((p) => {
      const a = p.attr;
      const tag = p.studentYearsLeft
        ? ` <span class="tag student">${p.nationality} · student</span>`
        : p.nationality !== "Sweden"
          ? ` <span class="tag">${p.nationality}</span>`
          : "";
      return `<tr${p.studentYearsLeft ? ' class="is-student"' : ""}>
        <td class="club">${p.position.short}</td>
        <td class="club"><span class="full" style="color:var(--text)">${p.name}</span>${tag}</td>
        <td>${p.age}</td>
        <td>${a.strength}</td><td>${a.pace}</td><td>${a.handling}</td><td>${a.tackling}</td><td>${a.kicking}</td>
        <td>${p.hidden.currentAbility}</td><td>${p.hidden.potentialAbility}</td>
        <td class="club"><span class="full" style="color:var(--muted)">${p.person.personality}</span></td>
        <td class="club"><span class="full" style="color:var(--muted)">${p.person.job}</span></td>
      </tr>`;
    })
    .join("");
  showView("squad");
}
$("squadBtn").addEventListener("click", renderSquad);
$("squadBack").addEventListener("click", () => renderSeason());

// ====================== persistence ======================================
const SAVE_KEY = "flyhalf.career.v1";
function save() {
  if (!season) return;
  const data = {
    userShort: season.userClub.short,
    seed: seasonSeed,
    round: season.round,
    year: season.year,
    reputation: season.reputationState(),
    tactics: userTactics,
    results: season.fixtures
      .filter((f) => f.played)
      .map((f) => ({ r: f.round, h: f.home.short, a: f.away.short, hs: f.homeScore, as: f.awayScore, ht: f.homeTries, at: f.awayTries })),
    // player condition for your club (in roster order — stable across reloads)
    condition: season.rosterFor(season.userClub).map((p) => [
      Math.round(p.condition.fitness),
      Math.round(p.condition.sharpness),
      Math.round(p.condition.morale),
      p.condition.injuredWeeks,
    ]),
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
    season = new Season(divisionFor(user), user, seasonSeed, { reputation: d.reputation, year: d.year });
    season.round = d.round;
    userTactics = d.tactics ?? { ...PRESETS[0].tactics };
    for (const r of d.results ?? []) {
      const f = season.fixtures.find((x) => x.round === r.r && x.home.short === r.h && x.away.short === r.a);
      if (f) season.record(f, r.hs, r.as, r.ht, r.at);
    }
    if (Array.isArray(d.condition)) {
      const roster = season.rosterFor(user);
      d.condition.forEach((c: number[], i: number) => {
        if (roster[i]) roster[i].condition = { fitness: c[0], sharpness: c[1], morale: c[2], injuredWeeks: c[3] };
      });
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
      <span class="club-meta">${club.city} · ${club.region === "north" ? "North" : "South"} · rep ${club.reputation}${club.university ? " · 🎓 uni" : ""}</span>`;
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
  seasonClub.textContent = `${season.userClub.name} · rep ${Math.round(season.repOf(season.userClub))}`;
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
    seasonRound.textContent = `Year ${season.year} — complete`;
    championBanner.classList.remove("hidden");
    const myRep = Math.round(season.repOf(season.userClub));
    championBanner.innerHTML =
      (champ === season.userClub
        ? `🏆 <strong>Champions!</strong> ${champ.name} win the league.`
        : `Season over — <strong>${champ.name}</strong> are champions.`) +
      `<span class="rep-note"> Your reputation: ${myRep}/100</span>`;
    fixturesTitle.textContent = "Final standings";
    fixturesList.innerHTML = "";
    playRoundBtn.textContent = `Start year ${season.year + 1} ›`;
    playRoundBtn.classList.remove("hidden");
    save();
    return;
  }

  seasonRound.textContent = `Year ${season.year} · Round ${season.round} of ${season.totalRounds}`;
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
  if (season.isComplete()) {
    startNextSeason();
    return;
  }
  const userFx = season.userFixture(season.round);
  if (userFx) {
    renderSelect(userFx);
  } else {
    simRestOfRound(null);
    season.round++;
    renderSeason();
  }
});

function startNextSeason() {
  if (!season) return;
  season.endSeasonReputation();
  const reputation = season.reputationState();
  const year = season.year + 1;
  const user = season.userClub;
  seasonSeed = (seasonSeed * 1103515245 + 12345) >>> 0;
  season = new Season(divisionFor(user), user, seasonSeed, { reputation, year });
  save();
  renderSeason();
}

// ====================== team selection ===================================
let pendingFixture: Fixture | null = null;
let availability: Availability[] = [];
let availSeed = 0;
const xvSlots = $("xvSlots");
const benchList = $("benchList");
const unavailList = $("unavailList");

function renderSelect(fixture: Fixture) {
  if (!season) return;
  pendingFixture = fixture;
  const roster = season.rosterFor(season.userClub);
  availSeed = (seasonSeed * 1000 + season.round) >>> 0;
  availability = rollAvailability(roster, availSeed, season.repOf(season.userClub));
  const availableIds = new Set(availability.filter((a) => a.available).map((a) => a.player.id));
  const starters = autoSelect(roster, availableIds);

  const opp = fixture.home === season.userClub ? fixture.away : fixture.home;
  $("selectTitle").textContent = `${season.userClub.name} v ${opp.name}`;
  const out = availability.filter((a) => !a.available).length;
  $("availSummary").textContent = `${availableIds.size} available, ${out} unavailable — pick your XV.`;

  // starting XV: one select per shirt, options = available players by fit
  const avail = availability.filter((a) => a.available).map((a) => a.player);
  xvSlots.innerHTML = "";
  UNION_POSITIONS.forEach((pos, i) => {
    const row = document.createElement("div");
    row.className = "xv-row";
    const sel = document.createElement("select");
    sel.dataset.slot = String(i);
    const opts = [...avail].sort((a, b) => fitScore(b, pos.short) - fitScore(a, pos.short));
    sel.innerHTML = opts
      .map((p) => `<option value="${p.id}">${p.position.short} ${p.name} (${p.hidden.currentAbility})</option>`)
      .join("");
    if (starters[i]) sel.value = String(starters[i].id);
    sel.addEventListener("change", refreshBench);
    row.innerHTML = `<span class="slot-pos">${pos.short}</span>`;
    row.appendChild(sel);
    xvSlots.appendChild(row);
  });

  unavailList.innerHTML = availability
    .filter((a) => !a.available)
    .map((a) => `<li><span>${a.player.position.short} ${a.player.name}</span><span class="reason">${a.reason}</span></li>`)
    .join("") || `<li class="none">Everyone's available!</li>`;

  refreshBench();
  showView("select");
}

function selectedIds(): number[] {
  return [...xvSlots.querySelectorAll("select")].map((s) => Number((s as HTMLSelectElement).value));
}

function refreshBench() {
  const chosen = new Set(selectedIds());
  const bench = availability
    .filter((a) => a.available && !chosen.has(a.player.id))
    .map((a) => `<li><span>${a.player.position.short} ${a.player.name}</span><span class="ca">${a.player.hidden.currentAbility}</span></li>`);
  benchList.innerHTML = bench.join("") || `<li class="none">No replacements left</li>`;
}

$("autoPickBtn").addEventListener("click", () => {
  if (pendingFixture) renderSelect(pendingFixture);
});
$("selectBack").addEventListener("click", () => renderSeason());
$("kickOffBtn").addEventListener("click", () => {
  if (!season || !pendingFixture) return;
  const roster = season.rosterFor(season.userClub);
  let ids = [...new Set(selectedIds())].filter(Boolean);
  // top up to 15 from any remaining available players
  for (const a of availability) {
    if (ids.length >= 15) break;
    if (a.available && !ids.includes(a.player.id)) ids.push(a.player.id);
  }
  applyLineup(roster, ids.slice(0, 15));
  startUserMatch(pendingFixture);
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
  // the AI opponent also has availability and fields its best available XV
  const aiClub = userIsHome ? away : home;
  const aiRoster = season!.rosterFor(aiClub);
  const aiAvail = rollAvailability(aiRoster, (availSeed * 7 + 3) >>> 0, season!.repOf(aiClub));
  autoSelect(aiRoster, new Set(aiAvail.filter((a) => a.available).map((a) => a.player.id)));
  // user's tactics go on their side; AI picks a preset
  const aiTactics = PRESETS[(seasonSeed + fixture.round) % PRESETS.length].tactics;
  const seed = (seasonSeed * 131 + fixture.round * 7) >>> 0;
  match = new Match(seed, "union", home, away, {
    homeTactics: userIsHome ? userTactics : { ...aiTactics },
    awayTactics: userIsHome ? { ...aiTactics } : userTactics,
    homeSquad: season!.rosterFor(home),
    awaySquad: season!.rosterFor(away),
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
  // your XV tire & risk knocks; then the whole league recovers a week
  applyPostMatch(season.rosterFor(season.userClub), (availSeed * 13 + 9) >>> 0);
  for (const c of season.clubs) applyWeeklyRecovery(season.rosterFor(c));
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
