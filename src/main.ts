import "./style.css";
import { Match } from "./engine/match";
import { Renderer } from "./render/renderer";
import { CLUBS } from "./data/clubs";
import { PRESETS, dutiesFor, type TeamTactics } from "./engine/tactics";
import { Season, quickSim, simStandings, type Fixture } from "./engine/season";
import { FORMATS } from "./engine/formats";
import { Rng } from "./engine/rng";
import type { Team } from "./engine/teams";
import { UNION_POSITIONS, setRole, serializePlayer, deserializePlayer, buildSquad, squadSize } from "./engine/teams";
import { SevensCup, sevensLineup, cupEntrants, ROUND_NAMES, type SevensTie } from "./engine/sevens";
import { computeFinances, formatKr, type FinanceBreakdown } from "./engine/finances";
import { pitchCondition, attendance as crowdAttendance, type MatchEnvironment, type SponsorBoard } from "./engine/matchday";
import { generateOffers, settleSponsors, type SponsorOffer } from "./engine/sponsors";
import { generateRecruitPool, signingFee, type Recruit } from "./engine/recruitment";
import { generateYouthIntake, type Prospect } from "./engine/youth";
import { pressQuestion, pressOutcome, postMatchQuestion, postMatchOutcome, rumour, PRESS_TONES, type PressTone, type MatchResult } from "./engine/media";
import {
  generateBoard, boardConfidence, moodLabel, holdVote, lobby, moveAgainst, updateBoard,
  type BoardMember, type CapitalProposal,
} from "./engine/board";
import { developSquad, type SeasonDevelopment } from "./engine/development";
import {
  applyTraining,
  DEFAULT_TRAINING,
  INTENSITY_LABELS,
  FOCUS_LABELS,
  type TrainingPlan,
  type TrainingIntensity,
  type TrainingFocus,
  type TrainingReport,
} from "./engine/training";
import type { Player } from "./engine/types";
import {
  rollAvailability,
  autoSelect,
  applyLineup,
  applyPostMatch,
  applyWeeklyRecovery,
  applySelectionMorale,
  squadConcerns,
  fitScore,
  type Availability,
  type Snub,
} from "./engine/availability";
import { deliverTalk, TONES, type TalkPhase, type TalkTone } from "./engine/teamtalk";
import { rateSide, manOfTheMatch, type PlayerRating } from "./engine/ratings";
import { createTacticsPanel } from "./ui/tactics-panel";
import type { Side } from "./engine/types";

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
const sevensView = $("sevensView");
const financesView = $("financesView");
const sponsorsView = $("sponsorsView");
const recruitView = $("recruitView");
const newsView = $("newsView");
const managerView = $("managerView");
const clubView = $("clubView");
const boardView = $("boardView");
const youthView = $("youthView");
type ViewName = "career" | "season" | "match" | "squad" | "select" | "sevens" | "finances" | "sponsors" | "recruit" | "news" | "manager" | "club" | "board" | "youth";
function showView(v: ViewName) {
  appView.classList.toggle("hidden", v !== "match");
  careerView.classList.toggle("hidden", v !== "career");
  seasonView.classList.toggle("hidden", v !== "season");
  squadView.classList.toggle("hidden", v !== "squad");
  selectView.classList.toggle("hidden", v !== "select");
  sevensView.classList.toggle("hidden", v !== "sevens");
  financesView.classList.toggle("hidden", v !== "finances");
  sponsorsView.classList.toggle("hidden", v !== "sponsors");
  recruitView.classList.toggle("hidden", v !== "recruit");
  newsView.classList.toggle("hidden", v !== "news");
  managerView.classList.toggle("hidden", v !== "manager");
  clubView.classList.toggle("hidden", v !== "club");
  boardView.classList.toggle("hidden", v !== "board");
  youthView.classList.toggle("hidden", v !== "youth");
}

// ---- manager profile & career history ----
interface SeasonRecord {
  year: number; club: string; division: string;
  pos: number; w: number; d: number; l: number;
  champ: boolean; natChamp: boolean;
}
let managerName = "Coach";
let careerHistory: SeasonRecord[] = [];
let careerW = 0, careerD = 0, careerL = 0; // lifetime match record

// ---- club inbox / news feed ----
interface NewsItem { year: number; round: number; text: string; }
let news: NewsItem[] = [];
function logNews(text: string) {
  news.unshift({ year: season?.year ?? 1, round: season?.round ?? 0, text });
  if (news.length > 250) news.length = 250;
}
function renderNews() {
  $("newsList").innerHTML = news.length
    ? news
        .map((n) => `<li><span class="news-when">Yr ${n.year}${n.round ? ` · R${n.round}` : ""}</span><span class="news-text">${n.text}</span></li>`)
        .join("")
    : `<li class="news-empty">No news yet — play some rugby!</li>`;
  showView("news");
}
$("newsBtn").addEventListener("click", renderNews);
$("newsBack").addEventListener("click", () => renderSeason());

function renderManager() {
  if (!season) return;
  const titles = careerHistory.filter((s) => s.champ).length;
  const natTitles = careerHistory.filter((s) => s.natChamp).length;
  // promotions: a season whose division sits above the previous one
  let promotions = 0;
  for (let i = 1; i < careerHistory.length; i++) {
    const prevTop = careerHistory[i - 1].division.startsWith("Allsvenskan");
    const nowTop = careerHistory[i].division.startsWith("Allsvenskan");
    if (!prevTop && nowTop) promotions++;
  }
  const played = careerW + careerD + careerL;
  const winPct = played ? Math.round((careerW / played) * 100) : 0;
  $("managerHead").innerHTML =
    `<div class="mgr-name">${managerName}</div>` +
    `<div class="mgr-club">${season.userClub.name} · ${divisionLabel(season.userClub)} · Year ${season.year}</div>`;
  $("managerStats").innerHTML = [
    `<div><span>${played}</span>matches</div>`,
    `<div><span>${winPct}%</span>win rate</div>`,
    `<div><span>${titles}</span>league titles</div>`,
    `<div><span>${natTitles}</span>national titles</div>`,
    `<div><span>${promotions}</span>promotions</div>`,
  ].join("");
  $("managerHistory").innerHTML = careerHistory.length
    ? [...careerHistory]
        .reverse()
        .map((s) => {
          const honours = [s.champ ? "🏆" : "", s.natChamp ? "🏅" : ""].filter(Boolean).join(" ");
          return `<tr><td>${s.year}</td><td class="club">${s.club}</td><td class="club"><span class="full">${s.division}</span></td>
            <td>${ordinal(s.pos)}</td><td>${s.w}</td><td>${s.d}</td><td>${s.l}</td><td>${honours || "—"}</td></tr>`;
        })
        .join("")
    : `<tr><td colspan="8" class="club"><span class="full muted">Your first season is under way — no history yet.</span></td></tr>`;
  showView("manager");
}
$("managerBtn").addEventListener("click", renderManager);
$("managerBack").addEventListener("click", () => renderSeason());

// ====================== club operations (board-gated) ====================
const FIELD_BUY = 250000;
const TRAINING_BUY = 130000;
function clubhouseBuildCost(level: number): number {
  return (level + 1) * 80000;
}
function currentProposals(): CapitalProposal[] {
  const props: CapitalProposal[] = [];
  if (matchField === "rented")
    props.push({ kind: "field", label: "Buy the match field (own your ground)", cost: FIELD_BUY, affordable: balance >= FIELD_BUY });
  if (trainingGround === "rented")
    props.push({ kind: "training", label: "Buy the training ground", cost: TRAINING_BUY, affordable: balance >= TRAINING_BUY });
  if (clubhouse < 3) {
    const c = clubhouseBuildCost(clubhouse);
    props.push({ kind: "clubhouse", label: `Build ${CLUBHOUSE_NAMES[clubhouse + 1]}`, cost: c, affordable: balance >= c });
  }
  return props;
}
function renderClub() {
  if (!season) return;
  $("clubBalance").innerHTML = `Bank balance: <strong class="${balance < 0 ? "neg" : "pos"}">${formatKr(balance)}</strong> · Facilities level ${compositeFacilities()}/5`;
  const assetRow = (label: string, status: string, prop?: CapitalProposal) =>
    `<div class="asset-row"><div><span class="asset-name">${label}</span><span class="asset-status">${status}</span></div>` +
    (prop
      ? `<button class="primary-inline propose" data-kind="${prop.kind}" ${prop.affordable ? "" : "disabled"}>Propose: ${formatKr(prop.cost)}</button>`
      : `<span class="asset-owned">Owned ✓</span>`) +
    `</div>`;
  const props = currentProposals();
  const propOf = (k: string) => props.find((p) => p.kind === k);
  $("clubAssets").innerHTML =
    assetRow("Match field", matchField === "owned" ? "You own the ground — better pitch, no rent" : "Rented communal pitch — scruffy, costs rent", propOf("field")) +
    assetRow("Training ground", trainingGround === "owned" ? "Your own training base — sharper sessions" : "Rented — limits training", propOf("training")) +
    assetRow(`Clubhouse: ${CLUBHOUSE_NAMES[clubhouse]}`, clubhouse > 0 ? "Bar income, cohesion & prestige" : "No clubhouse — no bar, little cohesion", propOf("clubhouse"));
  clubView.querySelectorAll<HTMLButtonElement>(".propose").forEach((b) =>
    b.addEventListener("click", () => proposeProject(b.dataset.kind as CapitalProposal["kind"])));

  // clubhouse access policy
  const accNote = $("accessNote");
  const accBtns = $("accessBtns");
  if (clubhouse < 1) {
    accNote.textContent = "Build a clubhouse first to set an access policy.";
    accBtns.innerHTML = "";
  } else {
    accNote.innerHTML =
      "How open is the clubhouse to the squad? <strong>Tight</strong> = less cohesion, less beer. " +
      "<strong>Loose</strong> = more cohesion & bar takings, but the odd costly mess to clean up.";
    const opts: { v: Access; label: string }[] = [
      { v: "tight", label: "Tight control" }, { v: "balanced", label: "Balanced" }, { v: "loose", label: "Loose / open" },
    ];
    accBtns.innerHTML = opts
      .map((o) => `<button class="tac-btn access ${clubAccess === o.v ? "on" : ""}" data-v="${o.v}">${o.label}</button>`)
      .join("");
    accBtns.querySelectorAll<HTMLButtonElement>(".access").forEach((b) =>
      b.addEventListener("click", () => { clubAccess = b.dataset.v as Access; save(); renderClub(); }));
  }
  $("oldBoysList").innerHTML = oldBoys.length
    ? oldBoys
        .map((o) => `<li><span class="ob-name">${o.name} <span class="ob-role">${o.role}</span></span><span class="ob-give">${formatKr(o.donation)}/yr · ${o.years} yrs</span></li>`)
        .join("") + `<li class="ob-tot"><span>Total donations</span><span>${formatKr(oldBoyDonations())}/yr</span></li>`
    : `<li class="muted">No old boys yet — long-serving players who retire from your club will give back here.</li>`;
  showView("club");
}
function proposeProject(kind: CapitalProposal["kind"]) {
  if (!season) return;
  const prop = currentProposals().find((p) => p.kind === kind);
  if (!prop) return;
  const vote = holdVote(board, prop, new Rng((seasonSeed * 333 + season.round * 17 + board.length + kind.length) >>> 0));
  const tally = `${vote.yes}–${vote.no}`;
  if (!vote.approved) {
    logNews(`🗳️ Board rejected "${prop.label}" (${tally}).`);
    alert(`The board votes ${tally} AGAINST.\nWin more of them over (lobby, results) and propose again.`);
    renderClub();
    return;
  }
  if (balance < prop.cost) return;
  balance -= prop.cost;
  investedThisSeason = true;
  if (kind === "field") matchField = "owned";
  else if (kind === "training") trainingGround = "owned";
  else clubhouse = Math.min(3, clubhouse + 1);
  syncUserFacilities();
  logNews(`🏗️ Board approved "${prop.label}" (${tally}). Done.`);
  save();
  renderClub();
}
$("clubBtn").addEventListener("click", renderClub);
$("clubBack").addEventListener("click", () => renderSeason());

// ====================== the board & politics =============================
function renderBoard() {
  if (!season) return;
  const conf = boardConfidence(board);
  $("boardConfidence").innerHTML = `Boardroom confidence: <strong class="${conf < 40 ? "neg" : "pos"}">${conf}/100</strong> (${moodLabel(conf)})`;
  $("boardActions").textContent = `${politicalActions} political move${politicalActions === 1 ? "" : "s"} left`;
  $("boardMembers").innerHTML = board
    .map(
      (m) => `<div class="board-card">
        <div class="bm-head"><span class="bm-name">${m.name}</span><span class="bm-role">${m.role}</span></div>
        <div class="bm-prio">Cares about: <strong>${m.priority}</strong></div>
        <div class="bm-mood"><span class="bm-bar"><span class="bm-fill" style="width:${m.approval}%"></span></span><span>${moodLabel(m.approval)} (${m.approval})</span></div>
        <div class="bm-acts">
          <button class="lobby" data-id="${m.id}" ${politicalActions <= 0 ? "disabled" : ""}>Lobby</button>
          <button class="oust" data-id="${m.id}" ${politicalActions <= 0 || m.approval >= 42 ? "disabled" : ""}>Move against</button>
        </div>
      </div>`
    )
    .join("");
  boardView.querySelectorAll<HTMLButtonElement>(".lobby").forEach((b) =>
    b.addEventListener("click", () => doLobby(Number(b.dataset.id))));
  boardView.querySelectorAll<HTMLButtonElement>(".oust").forEach((b) =>
    b.addEventListener("click", () => doOust(Number(b.dataset.id))));
  showView("board");
}
function doLobby(id: number) {
  if (politicalActions <= 0) return;
  const m = board.find((x) => x.id === id);
  if (!m) return;
  const gain = lobby(m, new Rng((seasonSeed * 71 + id * 13 + politicalActions) >>> 0));
  politicalActions--;
  logNews(`🤝 Lobbied ${m.name} (+${gain} approval).`);
  save();
  renderBoard();
}
function doOust(id: number) {
  if (politicalActions <= 0) return;
  const m = board.find((x) => x.id === id);
  if (!m || m.approval >= 42) return;
  if (!confirm(`Move against ${m.name} (${m.role})? If the board doesn't back you, the rest will turn on you.`)) return;
  const res = moveAgainst(board, m, new Rng((seasonSeed * 97 + id * 29 + politicalActions) >>> 0));
  politicalActions--;
  if (res.ousted) logNews(`🪓 ${m.name} ousted from the board (${res.backers} backed you). ${res.replacement!.name} steps in.`);
  else logNews(`❌ Move against ${m.name} failed (${res.backers} backed you) — the board resents it.`);
  save();
  renderBoard();
}
$("boardBtn").addEventListener("click", renderBoard);
$("boardBack").addEventListener("click", () => renderSeason());

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
const dressingRoomNote = document.createElement("p");
dressingRoomNote.className = "snub-note hidden";
championBanner.insertAdjacentElement("afterend", dressingRoomNote);

// --- state ---------------------------------------------------------------
let match: Match | null = null;
let playing = false;
let renderedCommentary = 0;
let season: Season | null = null;
let userTactics: TeamTactics = { ...PRESETS[0].tactics };
let currentFixture: Fixture | null = null; // the user's fixture being played
let userSide: Side = "home"; // which side of the current match the user manages
let lastHalf = 1; // to detect the half-time break for a talk
let lastSnubs: Snub[] = []; // fringe players unhappy at being left out last match
let lastMom: PlayerRating | null = null; // man of the match (either side)
let lastRatings: PlayerRating[] = []; // your XV's ratings last match
let balance = 0; // the club bank balance (kr), carried across years
let currentEnv: MatchEnvironment | undefined; // home club's match-day environment

/** Build the match-day environment for the home club (pitch, stand, crowd, boards). */
function buildEnvironment(home: Team, away: Team): MatchEnvironment {
  const fac = currentFacilities(home);
  // your own club's ground reflects whether you own or rent the match field
  const ground: "owned" | "shared" =
    season && home === season.userClub
      ? matchField === "owned" ? "owned" : "shared"
      : home.ground ?? (fac >= 3 ? "owned" : "shared");
  const rep = season ? season.repOf(home) : repState[home.short] ?? home.reputation;
  // recent form lifts the gate — use the home club's win rate this season if known
  let formBonus = 0;
  if (season) {
    const row = season.table().find((r) => r.team === home);
    if (row && row.played > 0) formBonus = (row.won / row.played - 0.45) * 0.3;
  }
  const boards = season && home === season.userClub ? userSponsorBoards() : [];
  return {
    ground,
    facilities: fac,
    pitchCondition: pitchCondition(ground, fac),
    attendance: crowdAttendance(rep, fac, formBonus),
    homeColor: home.colors.primary,
    awayColor: away.colors.primary,
    boards,
  };
}
/** Sponsor boards for the user's club — the deals they've signed this season. */
function userSponsorBoards(): SponsorBoard[] {
  return signedSponsors.map((s) => ({ name: s.name, color: s.color }));
}

// ---- sponsorship ----
const MAX_SPONSORS = 4;
let sponsorOffers: SponsorOffer[] = []; // this season's available deals
let signedSponsors: SponsorOffer[] = []; // deals signed this season
let seasonStartRep = 0; // reputation snapshot at season start (for "grow rep" goals)
let lastSponsorPayout: { total: number; met: number; of: number } | null = null;

/** Generate a fresh pool of offers and clear last year's signings (new season). */
function refreshSponsors() {
  if (!season) return;
  const user = season.userClub;
  seasonStartRep = Math.round(season.repOf(user));
  signedSponsors = [];
  const rng = new Rng((seasonSeed * 7349 + season.year * 19) >>> 0);
  sponsorOffers = generateOffers(rng, season.repOf(user), currentTier(user), currentFacilities(user), season.clubs.length);
}

// ---- recruitment ----
let recruitPool: Recruit[] = [];
function refreshRecruits() {
  if (!season) return;
  const user = season.userClub;
  const rng = new Rng((seasonSeed * 5179 + season.year * 23) >>> 0);
  recruitPool = generateRecruitPool(rng, user, season.repOf(user), 8);
}
function stars(n: number): string {
  return "★".repeat(n) + "☆".repeat(5 - n);
}
function renderRecruitment() {
  if (!season) return;
  const user = season.userClub;
  const roster = season.rosterFor(user);
  const cap = Math.max(50, squadSize(season.repOf(user)) + 4);
  const tier = currentTier(user);
  $("recruitSquad").textContent = `Squad ${roster.length}/${cap}`;
  $("recruitNote").textContent =
    `Sign free agents, walk-ups and trialists to bolster the squad. ` +
    (tier === "allsvenskan" ? "A small signing-on fee applies at this level." : "No fees at this level — it's the amateur game.");
  const full = roster.length >= cap;
  $("recruitBody").innerHTML = recruitPool.length
    ? recruitPool
        .map((rec, i) => {
          const p = rec.player;
          const fee = signingFee(tier, rec.stars);
          const canAfford = balance >= fee;
          const btn = full
            ? `<span class="muted">Squad full</span>`
            : `<button class="primary-inline rec-sign" data-i="${i}" ${canAfford ? "" : "disabled"}>${fee > 0 ? `Sign (${formatKr(fee)})` : "Sign"}</button>`;
          return `<tr>
            <td class="club">${p.position.short}</td>
            <td class="club"><span class="full" style="color:var(--text)">${p.name}</span> <span class="tag">${p.nationality !== "Sweden" ? p.nationality : rec.background}</span></td>
            <td>${p.age}</td>
            <td class="club"><span class="full" style="color:var(--muted)">${rec.background}</span></td>
            <td title="current ability"><span class="stars">${stars(rec.stars)}</span></td>
            <td title="potential"><span class="stars pot">${stars(rec.potential)}</span></td>
            <td>${fee > 0 ? formatKr(fee) : "—"}</td>
            <td>${btn}</td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="8" class="club"><span class="full muted">No one's knocking on the clubhouse door right now.</span></td></tr>`;
  recruitView.querySelectorAll<HTMLButtonElement>(".rec-sign").forEach((b) => {
    b.addEventListener("click", () => signRecruit(Number(b.dataset.i)));
  });
  showView("recruit");
}
function signRecruit(i: number) {
  if (!season || i < 0 || i >= recruitPool.length) return;
  const user = season.userClub;
  const roster = season.rosterFor(user);
  const cap = Math.max(50, squadSize(season.repOf(user)) + 4);
  if (roster.length >= cap) return;
  const rec = recruitPool[i];
  const fee = signingFee(currentTier(user), rec.stars);
  if (balance < fee) return;
  balance -= fee;
  rec.player.number = (roster.reduce((m, p) => Math.max(m, p.number), 0) || roster.length) + 1;
  roster.push(rec.player);
  recruitPool.splice(i, 1);
  logNews(`✍️ Signed ${rec.player.position.short} ${rec.player.name} (${rec.background})`);
  save();
  renderRecruitment();
}
$("recruitBtn").addEventListener("click", renderRecruitment);
$("recruitBack").addEventListener("click", () => renderSeason());

// ---- youth academy ----
let youthIntake: Prospect[] = [];
function refreshYouth() {
  if (!season) return;
  const user = season.userClub;
  const rng = new Rng((seasonSeed * 9173 + season.year * 29) >>> 0);
  youthIntake = generateYouthIntake(rng, user, season.repOf(user), currentFacilities(user), !!user.university, compositeFacilities());
}
function renderYouth() {
  if (!season) return;
  const user = season.userClub;
  const roster = season.rosterFor(user);
  const cap = Math.max(50, squadSize(season.repOf(user)) + 4);
  $("youthSquad").textContent = `Squad ${roster.length}/${cap}`;
  $("youthNote").textContent = `This year's academy graduates — raw but promising. A stronger club (reputation, facilities, a university link) brings through more, better youngsters. Promote them to the senior squad to develop them.`;
  const full = roster.length >= cap;
  $("youthBody").innerHTML = youthIntake.length
    ? youthIntake
        .map((pr, i) => {
          const p = pr.player;
          const btn = full ? `<span class="muted">Squad full</span>` : `<button class="primary-inline yp-promote" data-i="${i}">Promote</button>`;
          return `<tr>
            <td class="club">${p.position.short}</td>
            <td class="club"><span class="full" style="color:var(--text)">${p.name}</span> <span class="tag">academy</span></td>
            <td>${p.age}</td>
            <td><span class="stars">${"★".repeat(pr.stars)}${"☆".repeat(5 - pr.stars)}</span></td>
            <td><span class="stars pot">${"★".repeat(pr.potential)}${"☆".repeat(5 - pr.potential)}</span></td>
            <td>${btn}</td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="6" class="club"><span class="full muted">No graduates this year — invest in facilities & a university link to grow the academy.</span></td></tr>`;
  youthView.querySelectorAll<HTMLButtonElement>(".yp-promote").forEach((b) =>
    b.addEventListener("click", () => promoteYouth(Number(b.dataset.i))));
  showView("youth");
}
function promoteYouth(i: number) {
  if (!season || i < 0 || i >= youthIntake.length) return;
  const user = season.userClub;
  const roster = season.rosterFor(user);
  const cap = Math.max(50, squadSize(season.repOf(user)) + 4);
  if (roster.length >= cap) return;
  const pr = youthIntake[i];
  pr.player.number = (roster.reduce((m, p) => Math.max(m, p.number), 0) || roster.length) + 1;
  roster.push(pr.player);
  youthIntake.splice(i, 1);
  logNews(`🎓 Promoted academy graduate ${pr.player.position.short} ${pr.player.name} (potential ${"★".repeat(pr.potential)}).`);
  save();
  renderYouth();
}
$("youthBtn").addEventListener("click", renderYouth);
$("youthBack").addEventListener("click", () => renderSeason());
// the living pyramid: current tier & reputation per club short, for ALL 24 clubs,
// evolving year on year (promotion/relegation move clubs between tiers).
let tiers: Record<string, "allsvenskan" | "div1"> = {};
let repState: Record<string, number> = {};
let facState: Record<string, number> = {}; // current facilities level per club (upgradeable)
function currentTier(club: Team): "allsvenskan" | "div1" {
  return tiers[club.short] ?? club.tier;
}
function currentFacilities(club: Team): number {
  if (season && club === season.userClub) return compositeFacilities();
  return facState[club.short] ?? club.facilities;
}
function resetWorld() {
  tiers = {};
  repState = {};
  facState = {};
  for (const c of CLUBS) {
    tiers[c.short] = c.tier;
    repState[c.short] = c.reputation;
    facState[c.short] = c.facilities;
  }
}

// ---- club assets: the things you actually own/build (board-gated) ----
type Ownership = "rented" | "owned";
type Access = "tight" | "balanced" | "loose";
let clubhouse = 0; // 0 none, 1 portacabin, 2 clubhouse, 3 pavilion
let matchField: Ownership = "rented";
let trainingGround: Ownership = "rented";
let clubAccess: Access = "balanced";
const CLUBHOUSE_NAMES = ["No clubhouse", "Portacabin", "Clubhouse", "Pavilion"];

/** Your club's facilities level is the sum of what you own & have built (1–5). */
function compositeFacilities(): number {
  return Math.max(1, Math.min(5,
    1 + clubhouse + (matchField === "owned" ? 1 : 0) + (trainingGround === "owned" ? 1 : 0)));
}
/** Seed the asset model from a club's starting facilities so nothing jumps. */
function deriveAssets(facilities: number) {
  matchField = facilities >= 4 ? "owned" : "rented";
  trainingGround = facilities >= 3 ? "owned" : "rented";
  clubhouse = Math.max(0, Math.min(3, facilities - 1 - (matchField === "owned" ? 1 : 0) - (trainingGround === "owned" ? 1 : 0)));
  clubAccess = "balanced";
}
/** Keep the world-wide facilities map in step with the user's assets. */
function syncUserFacilities() {
  if (!season) return;
  const f = compositeFacilities();
  facState[season.userClub.short] = f;
  season.facilities.set(season.userClub, f);
}

// ---- the board & politics ----
let board: BoardMember[] = [];
let politicalActions = 2; // lobbying/manoeuvring chances per season
let investedThisSeason = false; // a board priority: did you build/buy this year?
let pendingBoardOutcome: {
  finishPos: number; divisionSize: number; promoted: boolean; relegated: boolean;
  balance: number; invested: boolean; youthPlayed: boolean; attendanceGood: boolean;
  tierBefore: "allsvenskan" | "div1";
} | null = null;

// ---- old boys: former players who give back as donors/supporters ----
interface OldBoy { name: string; years: number; peak: number; donation: number; role: string; }
let oldBoys: OldBoy[] = [];
function oldBoyDonations(): number {
  return oldBoys.reduce((s, o) => s + o.donation, 0);
}
/** A notable retiree (long-serving and/or quality) becomes an old boy who donates. */
function makeOldBoy(p: Player): OldBoy | null {
  const years = p.seasonsAtClub ?? 0;
  const peak = p.hidden.potentialAbility;
  if (years < 3 && peak < 64) return null; // real servants (3+ yrs) or notable talents give back
  const donation = Math.round(years * 2400 + Math.max(0, peak - 52) * 480);
  const role = peak >= 82 ? "Club legend" : peak >= 70 ? "Old boy" : "Loyal servant";
  return { name: p.name, years, peak, donation, role };
}
function divisionLabel(club: Team): string {
  const t = currentTier(club) === "allsvenskan" ? "Allsvenskan" : "Division 1";
  return `${t} ${club.region === "north" ? "North" : "South"}`;
}

// ---- club finances ----
/** Project (or settle) the current season's finances for the user's club. */
function currentSeasonFinances(): FinanceBreakdown | null {
  if (!season) return null;
  const user = season.userClub;
  const userFixtures = season.fixtures.filter((f) => f.home === user || f.away === user);
  const homeMatches = userFixtures.filter((f) => f.home === user).length;
  const awayOpponents = userFixtures.filter((f) => f.away === user).map((f) => f.home);
  return computeFinances(user, season.repOf(user), currentTier(user), homeMatches, awayOpponents, currentFacilities(user), {
    clubhouse, access: clubAccess, fieldRented: matchField === "rented", trainingRented: trainingGround === "rented",
  }, oldBoyDonations());
}

function renderFinances() {
  if (!season) return;
  const fin = currentSeasonFinances()!;
  $("financesClub").textContent = `${season.userClub.name} — finances`;
  $("finBalance").innerHTML = `Bank balance: <strong class="${balance < 0 ? "neg" : "pos"}">${formatKr(balance)}</strong>`;
  const conf = boardConfidence(board);
  $("finCommittee").innerHTML = `Board confidence: <strong>${moodLabel(conf)}</strong> (${conf}/100) — see the Board screen`;
  // facilities (built & owned via the Club screen, board permitting)
  const fac = currentFacilities(season.userClub);
  $("finFacilities").innerHTML = `Facilities: <strong>${"★".repeat(fac)}${"☆".repeat(5 - fac)}</strong> (level ${fac}/5) — manage on the Club screen`;
  ($("finUpgrade") as HTMLButtonElement).classList.add("hidden");
  const row = (label: string, v: number) => `<li><span>${label}</span><span>${formatKr(v)}</span></li>`;
  $("finIncome").innerHTML =
    row("Membership fees", fin.income.membership) +
    row("Sponsorship", fin.income.sponsorship) +
    row("Matchday (gate)", fin.income.matchday) +
    (fin.income.bar ? row("Clubhouse bar", fin.income.bar) : "") +
    (fin.income.donations ? row("Old boys' donations", fin.income.donations) : "") +
    `<li class="fin-tot"><span>Total income</span><span>${formatKr(fin.incomeTotal)}</span></li>`;
  $("finCosts").innerHTML =
    row("Facilities upkeep", fin.costs.upkeep) +
    row("Kit & insurance", fin.costs.kit) +
    row("Travel", fin.costs.travel) +
    (fin.costs.rent ? row("Ground / pitch rent", fin.costs.rent) : "") +
    `<li class="fin-tot"><span>Total costs</span><span>${formatKr(fin.costTotal)}</span></li>`;
  const projected = balance + fin.net;
  $("finNote").innerHTML = `Projected at season end: <strong class="${fin.net < 0 ? "neg" : "pos"}">${fin.net >= 0 ? "+" : ""}${formatKr(fin.net)}</strong> → balance <strong>${formatKr(projected)}</strong>.` +
    (fin.net < 0 ? " The club is running at a loss — the committee will want it addressed." : " The books are in good order.");
  showView("finances");
}
$("financesBtn").addEventListener("click", renderFinances);
$("financesBack").addEventListener("click", () => renderSeason());

function sponsorCard(s: SponsorOffer, signed: boolean): string {
  return `<div class="sponsor-card" style="border-left-color:${s.color}">
    <div class="sp-head"><span class="sp-name">${s.name}</span><span class="sp-up">${formatKr(s.upfront)} up front</span></div>
    <div class="sp-goals">
      <div>🏆 ${s.perfGoal.desc} → <strong>${formatKr(s.perfBonus)}</strong></div>
      <div>📈 ${s.devGoal.desc} → <strong>${formatKr(s.devBonus)}</strong></div>
    </div>
    ${signed ? `<div class="sp-signed">Signed</div>` : `<button class="primary-inline sp-sign" data-id="${s.id}">Sign deal</button>`}
  </div>`;
}
function renderSponsors() {
  if (!season) return;
  $("sponsorsSlots").textContent = `${signedSponsors.length}/${MAX_SPONSORS} boards`;
  const signedEl = $("sponsorsSigned");
  signedEl.innerHTML = signedSponsors.length
    ? signedSponsors.map((s) => sponsorCard(s, true)).join("")
    : `<p class="muted">No sponsors signed yet — sign a deal to put a board pitch-side and bank the fee.</p>`;
  const full = signedSponsors.length >= MAX_SPONSORS;
  const offersEl = $("sponsorsOffers");
  offersEl.innerHTML = full
    ? `<p class="muted">All board space is taken for this season.</p>`
    : sponsorOffers.length
      ? sponsorOffers.map((s) => sponsorCard(s, false)).join("")
      : `<p class="muted">No offers on the table right now.</p>`;
  offersEl.querySelectorAll<HTMLButtonElement>(".sp-sign").forEach((btn) => {
    btn.addEventListener("click", () => signSponsor(Number(btn.dataset.id)));
  });
  showView("sponsors");
}
function signSponsor(id: number) {
  if (!season || signedSponsors.length >= MAX_SPONSORS) return;
  const idx = sponsorOffers.findIndex((s) => s.id === id);
  if (idx < 0) return;
  const [offer] = sponsorOffers.splice(idx, 1);
  signedSponsors.push(offer);
  balance += offer.upfront;
  logNews(`🤝 New sponsor ${offer.name} (${formatKr(offer.upfront)} up front)`);
  save();
  renderSponsors();
}
$("sponsorsBtn").addEventListener("click", renderSponsors);
$("sponsorsBack").addEventListener("click", () => renderSeason());
// facilities are now built/bought through the board-gated Club Operations screen
// (capital projects), not a flat finance-screen upgrade.

const tacticsPanel = createTacticsPanel((t) => {
  userTactics = t;
  if (match) match.setTactics("home", t);
});
tacticsBtn.addEventListener("click", tacticsPanel.open);
$("openTacticsFromSeason").addEventListener("click", tacticsPanel.open);

// ====================== training =========================================
let trainingPlan: TrainingPlan = { ...DEFAULT_TRAINING };
let lastTraining: TrainingReport | null = null;
const trainIntensity = $("trainIntensity") as HTMLSelectElement;
const trainFocus = $("trainFocus") as HTMLSelectElement;
const trainHint = $("trainHint");
trainIntensity.innerHTML = (Object.keys(INTENSITY_LABELS) as TrainingIntensity[])
  .map((k) => `<option value="${k}">${INTENSITY_LABELS[k]}</option>`)
  .join("");
trainFocus.innerHTML = (Object.keys(FOCUS_LABELS) as TrainingFocus[])
  .map((k) => `<option value="${k}">${FOCUS_LABELS[k]}</option>`)
  .join("");
function syncTrainingControls() {
  trainIntensity.value = trainingPlan.intensity;
  trainFocus.value = trainingPlan.focus;
  trainHint.textContent =
    trainingPlan.intensity === "hard"
      ? "Faster gains — but tired legs and more knocks."
      : trainingPlan.intensity === "light"
        ? "Easy week — minimal gains, no risk."
        : "A balanced week's work.";
}
trainIntensity.addEventListener("change", () => {
  trainingPlan.intensity = trainIntensity.value as TrainingIntensity;
  syncTrainingControls();
  save();
});
trainFocus.addEventListener("change", () => {
  trainingPlan.focus = trainFocus.value as TrainingFocus;
  save();
});

// ====================== team talks =======================================
const talkOverlay = $("talkOverlay");
const talkTitle = $("talkTitle");
const talkContext = $("talkContext");
const talkHint = $("talkHint");
const talkTones = $("talkTones");
const talkReactions = $("talkReactions");
const talkSummary = $("talkSummary");
const talkReactionList = $("talkReactionList") as HTMLUListElement;
const talkContinue = $("talkContinue") as HTMLButtonElement;

const PHASE_TITLE: Record<TalkPhase, string> = {
  pre: "Pre-match team talk",
  half: "Half-time team talk",
  full: "Full-time team talk",
};

/** Show the talk overlay; resolves once the manager has spoken and read the room. */
function showTeamTalk(phase: TalkPhase): Promise<void> {
  return new Promise((resolve) => {
    if (!season || !match) return resolve();
    const roster = season.rosterFor(season.userClub);
    const myScore = match.score[userSide];
    const oppScore = match.score[userSide === "home" ? "away" : "home"];
    const margin = myScore - oppScore;
    const opp = currentFixture
      ? currentFixture.home === season.userClub
        ? currentFixture.away
        : currentFixture.home
      : null;
    const favourite = opp ? season.repOf(season.userClub) >= season.repOf(opp) : true;

    talkTitle.textContent = PHASE_TITLE[phase];
    talkContext.textContent =
      phase === "pre"
        ? favourite ? "You're the favourites" : "Underdogs today"
        : `${myScore}–${oppScore} · ${margin > 0 ? "ahead" : margin < 0 ? "behind" : "level"}`;
    talkHint.textContent =
      phase === "full" ? "A word before they head off." : "How do you send them out?";
    talkReactions.classList.add("hidden");
    talkTones.classList.remove("hidden");
    talkTones.innerHTML = "";
    for (const t of TONES) {
      const btn = document.createElement("button");
      btn.className = "talk-tone";
      btn.innerHTML = `<span class="tone-label">${t.label}</span><span class="tone-blurb">${t.blurb}</span>`;
      btn.addEventListener("click", () => speak(t.tone));
      talkTones.appendChild(btn);
    }
    talkOverlay.classList.remove("hidden");

    function speak(tone: TalkTone) {
      const res = deliverTalk(roster, tone, { phase, margin, favourite });
      if (phase !== "full" && match) match.talkBoost[userSide] = res.boost;
      talkTones.classList.add("hidden");
      talkSummary.textContent = res.summary;
      talkReactionList.innerHTML = res.reactions
        .slice()
        .sort((a, b) => b.delta - a.delta)
        .map(
          (r) =>
            `<li><span class="who"><span class="pos">${r.player.position.short}</span>${r.player.name}</span><span class="mood ${r.mood}">${r.mood.replace("-", " ")}</span></li>`
        )
        .join("");
      talkReactions.classList.remove("hidden");
    }

    talkContinue.onclick = () => {
      talkOverlay.classList.add("hidden");
      resolve();
    };
  });
}

// ====================== pre-match press conference =======================
const pressOverlay = $("pressOverlay");
const pressTonesEl = $("pressTones");
/** A quick pre-match presser; the tone nudges morale, the board and reputation. */
function showPressConference(opp: Team): Promise<void> {
  return new Promise((resolve) => {
    if (!season) return resolve();
    const favourite = season.repOf(season.userClub) >= season.repOf(opp);
    $("pressContext").textContent = favourite ? "You're the favourites" : "Underdogs";
    $("pressQuestion").textContent = pressQuestion(favourite, new Rng((seasonSeed * 51 + season.round * 7) >>> 0));
    pressTonesEl.innerHTML = "";
    const finish = (tone: PressTone | null) => {
      if (tone) {
        const o = pressOutcome(tone, favourite);
        for (const p of season!.rosterFor(season!.userClub)) p.condition.morale = Math.max(0, Math.min(100, p.condition.morale + o.morale));
        for (const m of board) m.approval = Math.max(0, Math.min(100, m.approval + o.board));
        repState[season!.userClub.short] = Math.max(15, Math.min(100, (repState[season!.userClub.short] ?? season!.userClub.reputation) + o.rep));
        season!.reputation.set(season!.userClub, repState[season!.userClub.short]);
        logNews(`🎤 Presser: ${o.line}`);
      }
      pressOverlay.classList.add("hidden");
      resolve();
    };
    for (const t of PRESS_TONES) {
      const btn = document.createElement("button");
      btn.className = "talk-tone";
      btn.innerHTML = `<span class="tone-label">${t.label}</span>`;
      btn.addEventListener("click", () => finish(t.tone));
      pressTonesEl.appendChild(btn);
    }
    const skip = document.createElement("button");
    skip.className = "talk-tone";
    skip.innerHTML = `<span class="tone-label">No comment</span><span class="tone-blurb">Say nothing of note.</span>`;
    skip.addEventListener("click", () => finish(null));
    pressTonesEl.appendChild(skip);
    pressOverlay.classList.remove("hidden");
  });
}

/** A result-aware post-match interview, reusing the presser overlay. */
function showPostMatchInterview(): Promise<void> {
  return new Promise((resolve) => {
    if (!season || !match) return resolve();
    const myScore = match.score[userSide];
    const oppScore = match.score[userSide === "home" ? "away" : "home"];
    const result: MatchResult = myScore > oppScore ? "won" : myScore < oppScore ? "lost" : "drew";
    $("pressContext").textContent =
      result === "won" ? `Full time · won ${myScore}–${oppScore}`
        : result === "lost" ? `Full time · lost ${myScore}–${oppScore}`
          : `Full time · drew ${myScore}–${oppScore}`;
    $("pressQuestion").textContent = postMatchQuestion(result, new Rng((seasonSeed * 71 + season.round * 13 + myScore) >>> 0));
    pressTonesEl.innerHTML = "";
    const finish = (tone: PressTone | null) => {
      if (tone) {
        const o = postMatchOutcome(tone, result);
        for (const p of season!.rosterFor(season!.userClub)) p.condition.morale = Math.max(0, Math.min(100, p.condition.morale + o.morale));
        for (const m of board) m.approval = Math.max(0, Math.min(100, m.approval + o.board));
        repState[season!.userClub.short] = Math.max(15, Math.min(100, (repState[season!.userClub.short] ?? season!.userClub.reputation) + o.rep));
        season!.reputation.set(season!.userClub, repState[season!.userClub.short]);
        logNews(`🎙️ Post-match: ${o.line}`);
      }
      pressOverlay.classList.add("hidden");
      resolve();
    };
    for (const t of PRESS_TONES) {
      const btn = document.createElement("button");
      btn.className = "talk-tone";
      btn.innerHTML = `<span class="tone-label">${t.label}</span>`;
      btn.addEventListener("click", () => finish(t.tone));
      pressTonesEl.appendChild(btn);
    }
    const skip = document.createElement("button");
    skip.className = "talk-tone";
    skip.innerHTML = `<span class="tone-label">No comment</span><span class="tone-blurb">Keep it brief.</span>`;
    skip.addEventListener("click", () => finish(null));
    pressTonesEl.appendChild(skip);
    pressOverlay.classList.remove("hidden");
  });
}

// ====================== substitutions (live) =============================
const subsOverlay = $("subsOverlay");
const subOff = $("subOff") as HTMLSelectElement;
const subOn = $("subOn") as HTMLSelectElement;
const subsUsedEl = $("subsUsed");
const subsBtn = $("subsBtn") as HTMLButtonElement;
let subsResumeAfter = false;

function fillSubsSelects() {
  if (!match) return;
  const squad = match.squads[userSide];
  const onField = squad.filter((p) => p.onField).sort((a, b) => a.number - b.number);
  const bench = squad.filter((p) => !p.onField && p.condition.injuredWeeks === 0);
  subOff.innerHTML = onField
    .map((p) => `<option value="${p.id}">${p.position.short} · ${p.name} (${Math.round(p.condition.fitness)}% fit)</option>`)
    .join("");
  subOn.innerHTML = bench.length
    ? bench
        .map((p) => `<option value="${p.id}">${p.position.short} · ${p.name} · CA ${p.hidden.currentAbility}</option>`)
        .join("")
    : `<option value="">No replacements available</option>`;
  const left = match.maxSubs - match.subsUsed[userSide];
  subsUsedEl.textContent = `${match.subsUsed[userSide]}/${match.maxSubs} used · ${left} left`;
}
function openSubs() {
  if (!match || match.finished) return;
  subsResumeAfter = playing;
  setPlaying(false);
  fillSubsSelects();
  subsOverlay.classList.remove("hidden");
}
function closeSubs() {
  subsOverlay.classList.add("hidden");
  if (subsResumeAfter) setPlaying(true);
}
subsBtn.addEventListener("click", openSubs);
$("subsClose").addEventListener("click", closeSubs);
$("makeSubBtn").addEventListener("click", () => {
  if (!match) return;
  const offId = Number(subOff.value);
  const onId = Number(subOn.value);
  if (!offId || !onId) return;
  if (match.substitute(userSide, offId, onId)) {
    flushCommentary();
    fillSubsSelects();
    renderer.draw(match, currentEnv);
    if (match.subsUsed[userSide] >= match.maxSubs) closeSubs();
  }
});

const squadBody = $("squadBody");
const squadClub = $("squadClub");
const roleCaptain = $("roleCaptain") as HTMLSelectElement;
const roleKicker = $("roleKicker") as HTMLSelectElement;
const roleLineout = $("roleLineout") as HTMLSelectElement;

function roleBadges(p: Player): string {
  const b: string[] = [];
  if (p.isCaptain) b.push(`<span class="role-badge cap" title="Captain">C</span>`);
  if (p.isGoalKicker) b.push(`<span class="role-badge gk" title="Goal-kicker">GK</span>`);
  if (p.isLineoutLeader) b.push(`<span class="role-badge ll" title="Lineout caller">LO</span>`);
  return b.join("");
}

function fillRoleSelect(sel: HTMLSelectElement, roster: Player[], flag: keyof Player, forwardsOnly = false) {
  const pool = forwardsOnly ? roster.filter((p) => p.forward) : roster;
  sel.innerHTML = pool
    .map((p) => `<option value="${p.id}"${p[flag] ? " selected" : ""}>${p.position.short} · ${p.name}</option>`)
    .join("");
}

function dutySelect(p: Player): string {
  const opts = dutiesFor(p.position.short);
  const cur = p.duty && opts.includes(p.duty) ? p.duty : opts[0];
  if (opts.length <= 1) return `<span class="full" style="color:var(--muted)">${cur}</span>`;
  return `<select class="duty-select" data-pid="${p.id}">${opts
    .map((d) => `<option value="${d}"${d === cur ? " selected" : ""}>${d}</option>`)
    .join("")}</select>`;
}

function renderSquad() {
  if (!season) return;
  const live = season.rosterFor(season.userClub);
  squadClub.textContent = season.userClub.name;
  const roster = [...live].sort((a, b) => a.position.number - b.position.number);
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
        <td class="club"><span class="full" style="color:var(--text)">${p.name}</span>${roleBadges(p)}${tag}</td>
        <td>${p.age}</td>
        <td>${a.strength}</td><td>${a.pace}</td><td>${a.handling}</td><td>${a.tackling}</td><td>${a.kicking}</td>
        <td>${p.hidden.currentAbility}</td><td>${p.hidden.potentialAbility}</td>
        <td class="club">${dutySelect(p)}</td>
        <td class="club"><span class="full" style="color:var(--muted)">${p.person.personality}</span></td>
        <td class="club"><span class="full" style="color:var(--muted)">${p.person.job}</span></td>
      </tr>`;
    })
    .join("");
  fillRoleSelect(roleCaptain, roster, "isCaptain");
  fillRoleSelect(roleKicker, roster, "isGoalKicker");
  fillRoleSelect(roleLineout, roster, "isLineoutLeader", true);
  showView("squad");
}

function onRoleChange(sel: HTMLSelectElement, role: "isCaptain" | "isGoalKicker" | "isLineoutLeader") {
  if (!season) return;
  setRole(season.rosterFor(season.userClub), role, Number(sel.value));
  save();
  renderSquad();
}
squadBody.addEventListener("change", (e) => {
  const sel = e.target as HTMLElement;
  if (!season || !sel.classList?.contains("duty-select")) return;
  const pid = Number((sel as HTMLSelectElement).dataset.pid);
  const player = season.rosterFor(season.userClub).find((p) => p.id === pid);
  if (!player) return;
  player.duty = (sel as HTMLSelectElement).value;
  save();
});
roleCaptain.addEventListener("change", () => onRoleChange(roleCaptain, "isCaptain"));
roleKicker.addEventListener("change", () => onRoleChange(roleKicker, "isGoalKicker"));
roleLineout.addEventListener("change", () => onRoleChange(roleLineout, "isLineoutLeader"));

$("squadBtn").addEventListener("click", renderSquad);
$("squadBack").addEventListener("click", () => renderSeason());

// ====================== persistence ======================================
const SAVE_KEY = "flyhalf.career.v1";
function save() {
  if (!season) return;
  // fold the current division's live reputation back into the world-wide map
  Object.assign(repState, season.reputationState());
  const data = {
    userShort: season.userClub.short,
    seed: seasonSeed,
    round: season.round,
    year: season.year,
    reputation: repState, // all 24 clubs
    tiers,
    facilities: facState,
    gfResolved,
    nationalChamp: nationalChamp?.short,
    balance,
    sponsorOffers,
    signedSponsors,
    seasonStartRep,
    recruits: recruitPool.map((r) => ({ p: serializePlayer(r.player), bg: r.background, st: r.stars, pot: r.potential })),
    youth: youthIntake.map((r) => ({ p: serializePlayer(r.player), st: r.stars, pot: r.potential })),
    news: news.slice(0, 120),
    managerName,
    careerHistory,
    careerRec: [careerW, careerD, careerL],
    assets: { clubhouse, matchField, trainingGround, clubAccess },
    board,
    politicalActions,
    investedThisSeason,
    oldBoys,
    tactics: userTactics,
    results: season.fixtures
      .filter((f) => f.played)
      .map((f) => ({ r: f.round, h: f.home.short, a: f.away.short, hs: f.homeScore, as: f.awayScore, ht: f.homeTries, at: f.awayTries })),
    training: trainingPlan,
    // your club's full squad — persistent players carry across years (dev/aging)
    roster: season.rosterFor(season.userClub).map(serializePlayer),
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
    // restore the living-pyramid state BEFORE building the division (divisionFor
    // depends on the current tiers); fall back to club defaults for old saves
    resetWorld();
    if (d.tiers) Object.assign(tiers, d.tiers);
    if (d.reputation) Object.assign(repState, d.reputation);
    if (d.facilities) Object.assign(facState, d.facilities);
    // restore club assets (or derive from the club's facilities for old saves)
    if (d.assets) {
      clubhouse = d.assets.clubhouse ?? 0;
      matchField = d.assets.matchField ?? "rented";
      trainingGround = d.assets.trainingGround ?? "rented";
      clubAccess = d.assets.clubAccess ?? "balanced";
    } else {
      deriveAssets(facState[user.short] ?? user.facilities);
    }
    facState[user.short] = compositeFacilities(); // keep the map in step with assets
    // carry the saved persistent squad so years of development survive a reload
    const carry = Array.isArray(d.roster)
      ? new Map<Team, Player[]>([[user, d.roster.map(deserializePlayer)]])
      : undefined;
    season = new Season(divisionFor(user), user, seasonSeed, { reputation: repState, facilities: facState, year: d.year }, carry);
    season.round = d.round;
    gfResolved = !!d.gfResolved;
    nationalChamp = d.nationalChamp ? CLUBS.find((c) => c.short === d.nationalChamp) ?? null : null;
    balance = d.balance ?? (currentTier(user) === "allsvenskan" ? 90000 : 45000);
    if (Array.isArray(d.sponsorOffers) && Array.isArray(d.signedSponsors)) {
      sponsorOffers = d.sponsorOffers;
      signedSponsors = d.signedSponsors;
      seasonStartRep = d.seasonStartRep ?? Math.round(season.repOf(user));
    } else {
      refreshSponsors();
    }
    if (Array.isArray(d.recruits)) {
      recruitPool = d.recruits.map((r: any) => ({
        player: deserializePlayer(r.p), background: r.bg, stars: r.st, potential: r.pot,
      }));
    } else {
      refreshRecruits();
    }
    if (Array.isArray(d.youth)) {
      youthIntake = d.youth.map((r: any) => ({ player: deserializePlayer(r.p), stars: r.st, potential: r.pot }));
    } else {
      refreshYouth();
    }
    news = Array.isArray(d.news) ? d.news : [];
    board = Array.isArray(d.board) && d.board.length ? d.board : generateBoard(new Rng((seasonSeed * 613 + 7) >>> 0));
    politicalActions = d.politicalActions ?? 2;
    investedThisSeason = !!d.investedThisSeason;
    oldBoys = Array.isArray(d.oldBoys) ? d.oldBoys : [];
    managerName = d.managerName ?? "Coach";
    careerHistory = Array.isArray(d.careerHistory) ? d.careerHistory : [];
    [careerW, careerD, careerL] = Array.isArray(d.careerRec) ? d.careerRec : [0, 0, 0];
    userTactics = d.tactics ?? { ...PRESETS[0].tactics };
    trainingPlan = d.training ?? { ...DEFAULT_TRAINING };
    for (const r of d.results ?? []) {
      const f = season.fixtures.find((x) => x.round === r.r && x.home.short === r.h && x.away.short === r.a);
      if (f) season.record(f, r.hs, r.as, r.ht, r.at);
    }
    // legacy saves (pre-roster persistence): re-apply condition & role overrides
    if (!carry && Array.isArray(d.condition)) {
      const roster = season.rosterFor(user);
      d.condition.forEach((c: number[], i: number) => {
        if (roster[i]) roster[i].condition = { fitness: c[0], sharpness: c[1], morale: c[2], injuredWeeks: c[3] };
      });
    }
    if (!carry && d.roles) {
      const roster = season.rosterFor(user);
      if (d.roles.c != null) setRole(roster, "isCaptain", d.roles.c);
      if (d.roles.gk != null) setRole(roster, "isGoalKicker", d.roles.gk);
      if (d.roles.ll != null) setRole(roster, "isLineoutLeader", d.roles.ll);
    }
    return true;
  } catch {
    return false;
  }
}

// ====================== career setup =====================================
function divisionFor(club: Team): Team[] {
  return CLUBS.filter((c) => c.region === club.region && currentTier(c) === currentTier(club));
}

function renderClubPicker() {
  clubGrid.innerHTML = "";
  for (const tier of ["allsvenskan", "div1"] as const) {
    const heading = document.createElement("h3");
    heading.className = "picker-tier";
    heading.textContent = tier === "allsvenskan" ? "Allsvenskan (top tier)" : "Division 1";
    clubGrid.appendChild(heading);
    const grid = document.createElement("div");
    grid.className = "club-grid-inner";
    for (const club of CLUBS.filter((c) => c.tier === tier)) {
      const card = document.createElement("button");
      card.className = "club-card";
      card.style.setProperty("--club", club.colors.primary);
      card.innerHTML = `
        <span class="badge" style="background:${club.colors.primary};border-color:${club.colors.secondary}"></span>
        <span class="club-name">${club.name}</span>
        <span class="club-meta">${club.city} · ${club.region === "north" ? "North" : "South"} · rep ${club.reputation}${club.university ? " · 🎓 uni" : ""}</span>`;
      card.addEventListener("click", () => startCareer(club));
      grid.appendChild(card);
    }
    clubGrid.appendChild(grid);
  }
}

function startCareer(club: Team) {
  seasonSeed = (Date.now() & 0xffffff) || 1;
  resetWorld();
  // a modest float to start: semi-pro top tier carries more cash than the amateurs
  balance = currentTier(club) === "allsvenskan" ? 90000 : 45000;
  season = new Season(divisionFor(club), club, seasonSeed, { reputation: repState, facilities: facState });
  userTactics = { ...PRESETS[0].tactics };
  trainingPlan = { ...DEFAULT_TRAINING };
  lastTraining = null;
  lastDev = null;
  lastMom = null;
  lastRatings = [];
  gfResolved = false;
  nationalChamp = null;
  gfTie = null;
  news = [];
  managerName = ($("managerNameInput") as HTMLInputElement).value.trim() || "Coach";
  careerHistory = [];
  careerW = careerD = careerL = 0;
  deriveAssets(club.facilities);
  syncUserFacilities();
  board = generateBoard(new Rng((seasonSeed * 613 + 7) >>> 0));
  politicalActions = 2;
  investedThisSeason = false;
  oldBoys = [];
  refreshSponsors();
  refreshRecruits();
  refreshYouth();
  logNews(`📅 ${managerName} takes charge of ${club.name} in ${divisionLabel(club)}.`);
  save();
  renderSeason();
}

// ====================== season hub =======================================
function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
function renderDressingRoom() {
  if (!season) {
    dressingRoomNote.classList.add("hidden");
    return;
  }
  const parts: string[] = [];
  // promotion/relegation news from the rollover just gone
  if (lastRolloverSummary) parts.push(`🪜 ${lastRolloverSummary}`);
  if (lastSponsorPayout) parts.push(`🤝 Sponsors paid ${formatKr(lastSponsorPayout.total)} (${lastSponsorPayout.met}/${lastSponsorPayout.of} goals met).`);
  // pre-season development summary (shown the first view of a new year)
  if (lastDev && (lastDev.retirements.length || lastDev.departures.length || lastDev.intake.length || lastDev.risers.length)) {
    const seg: string[] = [];
    if (lastDev.retirements.length) seg.push(`${lastDev.retirements.length} retired`);
    const moved = lastDev.departures.filter((d) => d.reason.startsWith("moved"));
    const returned = lastDev.departures.filter((d) => !d.reason.startsWith("moved"));
    if (moved.length) seg.push(`${moved.length} left for bigger clubs`);
    if (returned.length) seg.push(`${returned.length} students returned home`);
    if (lastDev.intake.length) seg.push(`${lastDev.intake.length} joined`);
    if (lastDev.risers.length) seg.push(`rising: ${lastDev.risers.slice(0, 3).map((p) => p.name).join(", ")}`);
    if (seg.length) parts.push(`📋 Pre-season: ${seg.join(" · ")}.`);
  }
  // last match's ratings & man of the match
  if (lastMom) {
    const star = lastRatings[0];
    const mine = star ? ` Top for us: ${star.player.name} ${star.rating.toFixed(1)}.` : "";
    parts.push(`🏅 Man of the match: ${lastMom.player.name} (${lastMom.rating.toFixed(1)}).${mine}`);
  }
  // only surface players who genuinely mind being left out (not the mildly annoyed)
  const serious = lastSnubs.filter((s) => s.severity !== "annoyed");
  if (serious.length) {
    const names = serious
      .slice(0, 4)
      .map((s) => `${s.player.name}${s.severity === "furious" ? " (furious)" : ""}`)
      .join(", ");
    parts.push(`🗣️ Unhappy at being left out: ${names}.`);
  }
  const concerns = squadConcerns(season.rosterFor(season.userClub)).filter(
    (p) => !lastSnubs.some((s) => s.player.id === p.id)
  );
  if (concerns.length) {
    parts.push(`Low morale: ${concerns.slice(0, 4).map((p) => p.name).join(", ")}.`);
  }
  if (lastTraining) {
    const t = lastTraining;
    const turnout = `${t.attended}/${t.squad} trained`;
    const gain = t.topGainer ? `, ${t.topGainer.name} sharpest` : "";
    const knock = t.knocks ? `, ${t.knocks} knock${t.knocks > 1 ? "s" : ""}` : "";
    parts.push(`💪 ${turnout}${gain}${knock}.`);
  }
  if (parts.length) {
    dressingRoomNote.innerHTML = parts.join(" ");
    dressingRoomNote.classList.remove("hidden");
  } else {
    dressingRoomNote.classList.add("hidden");
  }
}

function renderSeason() {
  if (!season) return;
  showView("season");
  seasonClub.textContent = `${season.userClub.name} · ${divisionLabel(season.userClub)} · rep ${Math.round(season.repOf(season.userClub))}`;
  championBanner.classList.add("hidden");
  syncTrainingControls();
  renderDressingRoom();

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
    // where the user finished, and what it means for promotion/relegation
    const pos = season.table().findIndex((r) => r.team === season!.userClub) + 1;
    const top = currentTier(season.userClub) === "allsvenskan";
    let fate = "";
    if (top && pos === 6) fate = " You're <strong>relegated</strong> to Division 1.";
    else if (top && pos === 5) fate = " Into a <strong>relegation playoff</strong>.";
    else if (!top && pos === 1) fate = " <strong>Promoted</strong> to the Allsvenskan!";
    else if (!top && pos === 2) fate = " Into a <strong>promotion playoff</strong>.";
    // Grand Final: the two Allsvenskan regional champions meet for the national
    // title. If the user isn't a finalist, resolve it now; otherwise they play it.
    const { nC, sC } = grandFinalPair();
    const finalist = userIsFinalist();
    if (!gfResolved && !finalist) {
      const r = quickSim(nC, sC, new Rng((seasonSeed * 13 + 7) >>> 0));
      nationalChamp = r.hs >= r.as ? nC : sC;
      gfResolved = true;
      logNews(`🏅 Grand Final: ${nationalChamp.name} are national champions.`);
    }
    const gfLine = gfResolved && nationalChamp
      ? ` 🏅 <strong>Grand Final:</strong> ${nationalChamp.name} are national champions (${nC.short} v ${sC.short}).`
      : finalist
        ? ` ⭐ You're in the <strong>Grand Final</strong> v ${(season.userClub === nC ? sC : nC).name}!`
        : "";
    championBanner.innerHTML =
      (champ === season.userClub
        ? `🏆 <strong>Champions!</strong> ${champ.name} win ${divisionLabel(season.userClub)}.`
        : `Season over — <strong>${champ.name}</strong> win ${divisionLabel(season.userClub)}. You finished ${ordinal(pos)}.`) +
      fate + gfLine +
      `<span class="rep-note"> Your reputation: ${myRep}/100</span>`;
    fixturesTitle.textContent = "Final standings";
    fixturesList.innerHTML = "";
    playRoundBtn.textContent = finalist && !gfResolved ? "⭐ Play Grand Final" : `Start year ${season.year + 1} ›`;
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
    if (userIsFinalist() && !gfResolved) {
      const { nC, sC } = grandFinalPair();
      startGrandFinal(nC, sC);
    } else {
      startNextSeason();
    }
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

let lastDev: SeasonDevelopment | null = null; // pre-season changes, surfaced in the season view
let lastRolloverSummary: string | null = null; // promotion/relegation news for the note
let pendingRolloverYear = 0; // year being rolled into (set while a playoff is pending)
let playoffTie: { a: Team; b: Team } | null = null; // a = Allsvenskan 5th, b = Div1 2nd
// Grand Final: the two Allsvenskan regional champions meet for the national title
let gfResolved = false;
let nationalChamp: Team | null = null;
let gfTie: { a: Team; b: Team } | null = null;

function regionChamp(region: "north" | "south"): Team {
  return divisionStandings(region, "allsvenskan", new Rng((seasonSeed * 991 + (region === "north" ? 1 : 2)) >>> 0))[0];
}
function grandFinalPair(): { nC: Team; sC: Team } {
  return { nC: regionChamp("north"), sC: regionChamp("south") };
}
function userIsFinalist(): boolean {
  if (!season || currentTier(season.userClub) !== "allsvenskan") return false;
  const { nC, sC } = grandFinalPair();
  return season.userClub === nC || season.userClub === sC;
}

function clubsIn(region: "north" | "south", tier: "allsvenskan" | "div1"): Team[] {
  return CLUBS.filter((c) => c.region === region && currentTier(c) === tier);
}
/** Standings for a division: the real table if it's the user's, else quick-simmed. */
function divisionStandings(region: "north" | "south", tier: "allsvenskan" | "div1", rng: Rng): Team[] {
  const clubs = clubsIn(region, tier);
  if (season && season.userClub.region === region && currentTier(season.userClub) === tier) {
    return season.table().map((r) => r.team);
  }
  return simStandings(clubs, rng);
}
function setTier(club: Team, tier: "allsvenskan" | "div1") {
  const was = currentTier(club);
  tiers[club.short] = tier;
  if (was !== tier) {
    const delta = tier === "allsvenskan" ? 3 : -3; // going up lifts standing, down dents it
    repState[club.short] = Math.max(15, Math.min(100, (repState[club.short] ?? club.reputation) + delta));
  }
}

/** End the league season: resolve promotion/relegation across the pyramid. */
function startNextSeason() {
  if (!season) return;
  // settle the books for the season just finished
  balance += currentSeasonFinances()?.net ?? 0;
  season.endSeasonReputation();
  Object.assign(repState, season.reputationState());
  // settle this season's sponsor goals against the final table & club growth
  if (signedSponsors.length) {
    const table = season.table();
    const finishPos = table.findIndex((r) => r.team === season!.userClub) + 1;
    const wins = table.find((r) => r.team === season!.userClub)?.won ?? 0;
    const settled = settleSponsors(signedSponsors, {
      finishPos,
      wins,
      repGrowth: Math.round(season.repOf(season.userClub)) - seasonStartRep,
      facilities: currentFacilities(season.userClub),
      divisionSize: season.clubs.length,
    });
    balance += settled.total;
    const met = settled.outcomes.reduce((nn, o) => nn + (o.perfMet ? 1 : 0) + (o.devMet ? 1 : 0), 0);
    lastSponsorPayout = { total: settled.total, met, of: signedSponsors.length * 2 };
  } else {
    lastSponsorPayout = null;
  }
  pendingRolloverYear = season.year + 1;
  const rng = new Rng((seasonSeed * 2654435761 + pendingRolloverYear) >>> 0);

  // resolve every region: bottom of Allsvenskan auto-down, Div1 champ auto-up,
  // Allsvenskan 5th vs Div1 2nd in a playoff (the user plays theirs).
  const moves: string[] = [];
  let userPlayoff: { a: Team; b: Team } | null = null;
  for (const region of ["north", "south"] as const) {
    const alls = divisionStandings(region, "allsvenskan", rng);
    const div1 = divisionStandings(region, "div1", rng);
    if (alls.length < 6 || div1.length < 6) continue;
    setTier(alls[5], "div1"); // 6th relegated
    setTier(div1[0], "allsvenskan"); // champion promoted
    moves.push(`${div1[0].short} ↑, ${alls[5].short} ↓ (${region === "north" ? "N" : "S"})`);
    const tie = { a: alls[4], b: div1[1] }; // 5th vs runner-up
    if (tie.a === season.userClub || tie.b === season.userClub) userPlayoff = tie;
    else resolvePlayoff(tie, simPlayoff(tie, rng), moves);
  }
  lastRolloverSummary = moves.length ? `Pyramid: ${moves.join(" · ")}.` : null;
  // record the year's headlines in the inbox
  const champ = season.table()[0]?.team;
  const finishPos = season.table().findIndex((r) => r.team === season!.userClub) + 1;
  if (champ) logNews(`🏆 ${champ.name} win ${divisionLabel(season.userClub)}; you finished ${ordinal(finishPos)}.`);
  // file the completed season in the manager's career history
  const myRow = season.table().find((r) => r.team === season!.userClub);
  if (myRow) {
    careerHistory.push({
      year: season.year,
      club: season.userClub.short,
      division: divisionLabel(season.userClub),
      pos: finishPos,
      w: myRow.won, d: myRow.drawn, l: myRow.lost,
      champ: finishPos === 1,
      natChamp: gfResolved && nationalChamp === season.userClub,
    });
  }
  if (lastSponsorPayout) logNews(`💰 Sponsors paid out ${formatKr(lastSponsorPayout.total)} (${lastSponsorPayout.met}/${lastSponsorPayout.of} goals).`);
  // an open clubhouse occasionally needs an expensive clear-up
  if (clubhouse > 0 && clubAccess === "loose") {
    const dRng = new Rng((seasonSeed * 401 + season.year * 13) >>> 0);
    if (dRng.chance(0.4)) {
      const bill = Math.round(dRng.range(15000, 45000));
      balance -= bill;
      logNews(`🍺 Clubhouse damage after a loose season — ${formatKr(bill)} to put right.`);
    }
  }
  // capture the facts the board will judge you on (promotion/relegation known at finalize)
  const myRep = Math.round(season.repOf(season.userClub));
  pendingBoardOutcome = {
    finishPos,
    divisionSize: season.clubs.length,
    promoted: false,
    relegated: false,
    balance,
    invested: investedThisSeason,
    youthPlayed: season.rosterFor(season.userClub).filter((p) => p.age <= 21).length >= 3,
    attendanceGood: crowdAttendance(myRep, currentFacilities(season.userClub)) >= 0.45,
    tierBefore: currentTier(season.userClub),
  };

  if (userPlayoff) {
    playoffTie = userPlayoff;
    startPlayoffMatch(userPlayoff);
  } else {
    finalizeRollover();
  }
}

/** Quick-sim a non-user playoff; returns the winning team. */
function simPlayoff(tie: { a: Team; b: Team }, rng: Rng): Team {
  const r = quickSim(tie.a, tie.b, rng);
  return r.hs >= r.as ? tie.a : tie.b; // a (the incumbent) survives a draw
}
/** Apply a playoff outcome: winner in/stays Allsvenskan, loser in/stays Division 1. */
function resolvePlayoff(tie: { a: Team; b: Team }, winner: Team, moves: string[]) {
  const loser = winner === tie.a ? tie.b : tie.a;
  setTier(winner, "allsvenskan");
  setTier(loser, "div1");
  moves.push(`playoff: ${winner.short} stays up, ${loser.short} down`);
}

function startPlayoffMatch(tie: { a: Team; b: Team }) {
  if (!season) return;
  const user = season.userClub;
  const seed = (seasonSeed * 149 + 17) >>> 0;
  const userIsA = tie.a === user;
  const userRoster = season.rosterFor(user);
  const av = rollAvailability(userRoster, seed, repState[user.short] ?? user.reputation);
  autoSelect(userRoster, new Set(av.filter((x) => x.available).map((x) => x.player.id)));
  const opp = userIsA ? tie.b : tie.a;
  const oppRoster = buildSquad(new Rng((seed * 7 + 1) >>> 0), opp, userIsA ? "away" : "home", FORMATS.union, undefined, repState[opp.short] ?? opp.reputation);
  userSide = userIsA ? "home" : "away";
  currentFixture = null;
  match = new Match(seed, "union", tie.a, tie.b, {
    homeTactics: userIsA ? userTactics : { ...PRESETS[0].tactics },
    awayTactics: userIsA ? { ...PRESETS[0].tactics } : userTactics,
    homeSquad: userIsA ? userRoster : oppRoster,
    awaySquad: userIsA ? oppRoster : userRoster,
  });
  renderedCommentary = 0;
  eventsEl.innerHTML = "";
  homeNameEl.textContent = tie.a.name;
  awayNameEl.textContent = tie.b.name;
  formatLabel.classList.add("hidden");
  newBtn.classList.add("hidden");
  simBtn.classList.remove("hidden");
  subsBtn.classList.remove("hidden");
  backToSeasonBtn.classList.remove("hidden");
  backToSeasonBtn.textContent = "Playoff";
  currentEnv = buildEnvironment(match!.home, match!.away);
  showView("match");
  syncScoreboard();
  renderer.resize();
  renderer.draw(match, currentEnv);
  setPlaying(true);
}

function finishPlayoffMatch() {
  if (!playoffTie || !match) return;
  const winner = match.score.home >= match.score.away ? playoffTie.a : playoffTie.b;
  const moves: string[] = [];
  resolvePlayoff(playoffTie, winner, moves);
  lastRolloverSummary = (lastRolloverSummary ? lastRolloverSummary + " " : "") + moves.join(" ") + ".";
  playoffTie = null;
  simBtn.classList.add("hidden");
  subsBtn.classList.add("hidden");
  backToSeasonBtn.classList.add("hidden");
  backToSeasonBtn.classList.remove("primary");
  finalizeRollover();
}

/** Develop the user's squad and build the new season's division (post-movement). */
function finalizeRollover() {
  if (!season) return;
  const user = season.userClub;
  const year = pendingRolloverYear;
  const devRng = new Rng((seasonSeed * 2654435761 + year * 31) >>> 0);
  lastDev = developSquad(season.rosterFor(user), devRng, user, repState[user.short] ?? user.reputation);
  // notable retirees come back into the fold as donating old boys
  for (const dep of lastDev.retirements) {
    const ob = makeOldBoy(dep.player);
    if (ob) {
      oldBoys.push(ob);
      logNews(`🎩 ${ob.name} retires after ${ob.years} years — joins as ${ob.role}, donating ${formatKr(ob.donation)}/yr.`);
    }
  }
  oldBoys.sort((a, b) => b.donation - a.donation);
  if (oldBoys.length > 16) oldBoys.length = 16; // keep the most generous benefactors
  const carry = new Map<Team, Player[]>([[user, lastDev.roster]]);
  seasonSeed = (seasonSeed * 1103515245 + 12345) >>> 0;
  season = new Season(divisionFor(user), user, seasonSeed, { reputation: repState, facilities: facState, year }, carry);
  syncUserFacilities();
  // the board passes judgement on the season just gone (now promotion is known)
  if (pendingBoardOutcome) {
    const tierAfter = currentTier(user);
    updateBoard(board, {
      ...pendingBoardOutcome,
      promoted: pendingBoardOutcome.tierBefore === "div1" && tierAfter === "allsvenskan",
      relegated: pendingBoardOutcome.tierBefore === "allsvenskan" && tierAfter === "div1",
    }, new Rng((seasonSeed * 211 + year) >>> 0));
    pendingBoardOutcome = null;
  }
  politicalActions = 2;
  investedThisSeason = false;
  // clubhouse cohesion: an open clubhouse builds togetherness over the off-season
  if (clubhouse > 0) {
    const lift = clubAccess === "loose" ? 5 : clubAccess === "balanced" ? 2 : -1;
    for (const p of season.rosterFor(user)) p.condition.morale = Math.max(0, Math.min(100, p.condition.morale + lift));
  }
  lastSnubs = [];
  lastMom = null;
  lastRatings = [];
  gfResolved = false;
  nationalChamp = null;
  gfTie = null;
  refreshSponsors();
  refreshRecruits();
  refreshYouth();
  logNews(`📅 Year ${season.year}: ${divisionLabel(season.userClub)} season begins. Board confidence ${boardConfidence(board)}/100.`);
  // a bit of pre-season grapevine chatter
  const rumRng = new Rng((seasonSeed * 149 + year * 23) >>> 0);
  const rr = rumour(season.userClub.name, rumRng);
  logNews(`📰 ${rr.text}`);
  save();
  renderSeason();
}

/** Play the cross-region Grand Final (national title) — user is one of the two. */
function startGrandFinal(nC: Team, sC: Team) {
  if (!season) return;
  gfTie = { a: nC, b: sC };
  const user = season.userClub;
  const seed = (seasonSeed * 211 + 23) >>> 0;
  const userIsHome = nC === user; // north champ is "home"
  const userRoster = season.rosterFor(user);
  const av = rollAvailability(userRoster, seed, repState[user.short] ?? user.reputation);
  autoSelect(userRoster, new Set(av.filter((x) => x.available).map((x) => x.player.id)));
  const opp = userIsHome ? sC : nC;
  const oppRoster = buildSquad(new Rng((seed * 7 + 3) >>> 0), opp, userIsHome ? "away" : "home", FORMATS.union, undefined, repState[opp.short] ?? opp.reputation);
  userSide = userIsHome ? "home" : "away";
  currentFixture = null;
  match = new Match(seed, "union", nC, sC, {
    homeTactics: userIsHome ? userTactics : { ...PRESETS[0].tactics },
    awayTactics: userIsHome ? { ...PRESETS[0].tactics } : userTactics,
    homeSquad: userIsHome ? userRoster : oppRoster,
    awaySquad: userIsHome ? oppRoster : userRoster,
  });
  renderedCommentary = 0;
  eventsEl.innerHTML = "";
  homeNameEl.textContent = nC.name;
  awayNameEl.textContent = sC.name;
  formatLabel.classList.add("hidden");
  newBtn.classList.add("hidden");
  simBtn.classList.remove("hidden");
  subsBtn.classList.remove("hidden");
  backToSeasonBtn.classList.remove("hidden");
  backToSeasonBtn.textContent = "Grand Final";
  currentEnv = buildEnvironment(match!.home, match!.away);
  showView("match");
  syncScoreboard();
  renderer.resize();
  renderer.draw(match, currentEnv);
  setPlaying(true);
}

function finishGrandFinal() {
  if (!gfTie || !match || !season) return;
  nationalChamp = match.score.home >= match.score.away ? gfTie.a : gfTie.b;
  gfResolved = true;
  logNews(`🏅 Grand Final: ${nationalChamp.name} are national champions${nationalChamp === season.userClub ? " — that's you!" : ""}.`);
  // lifting the national title is a big reputation & morale boost
  if (nationalChamp === season.userClub) {
    repState[season.userClub.short] = Math.min(100, (repState[season.userClub.short] ?? season.userClub.reputation) + 4);
    for (const pl of season.rosterFor(season.userClub)) pl.condition.morale = Math.min(100, pl.condition.morale + 5);
  }
  gfTie = null;
  simBtn.classList.add("hidden");
  subsBtn.classList.add("hidden");
  backToSeasonBtn.classList.add("hidden");
  backToSeasonBtn.classList.remove("primary");
  renderSeason(); // back to the complete-season view, now showing the national champ
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
  userSide = userIsHome ? "home" : "away";
  lastHalf = 1;
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
  subsBtn.classList.remove("hidden");
  backToSeasonBtn.classList.remove("hidden");
  backToSeasonBtn.textContent = "‹ Season";
  currentEnv = buildEnvironment(match!.home, match!.away);
  showView("match");
  syncScoreboard();
  renderer.resize();
  renderer.draw(match, currentEnv);
  // pre-match: face the press, then the team talk, then kick off
  showPressConference(aiClub)
    .then(() => showTeamTalk("pre"))
    .then(() => setPlaying(true));
}

function finishUserMatch() {
  if (!season || !currentFixture || !match) return;
  const ht = match.events.filter((e) => e.kind === "try" && e.side === "home").length;
  const at = match.events.filter((e) => e.kind === "try" && e.side === "away").length;
  season.record(currentFixture, match.score.home, match.score.away, ht, at);
  // game-time morale: starters lift, snubbed fringe players stew
  const won = match.score[userSide] > match.score[userSide === "home" ? "away" : "home"];
  const drew = match.score.home === match.score.away;
  if (drew) careerD++; else if (won) careerW++; else careerL++;
  logNews(
    `${drew ? "🤝" : won ? "✅" : "❌"} ${currentFixture.home.short} ${match.score.home}–${match.score.away} ${currentFixture.away.short}` +
    (lastMom ? ` · MotM ${lastMom.player.name}` : "")
  );
  // post-match player ratings & man of the match (before the match is cleared)
  lastRatings = rateSide(match, userSide);
  lastMom = manOfTheMatch(match);
  for (const r of lastRatings) {
    const d = (r.rating - 6.5) * 1.1; // a blinder lifts, a stinker dents
    r.player.condition.morale = Math.max(0, Math.min(100, r.player.condition.morale + d));
  }
  lastSnubs = applySelectionMorale(season.rosterFor(season.userClub), won);
  lastDev = null; // pre-season summary clears once the season is under way
  lastRolloverSummary = null;
  lastSponsorPayout = null;
  // your XV tire & risk knocks; then the whole league recovers a week
  applyPostMatch(season.rosterFor(season.userClub), (availSeed * 13 + 9) >>> 0);
  for (const c of season.clubs) applyWeeklyRecovery(season.rosterFor(c));
  // a week on the training paddock for your club (after recovery)
  lastTraining = applyTraining(
    season.rosterFor(season.userClub),
    trainingPlan,
    season.repOf(season.userClub) + (trainingGround === "owned" ? 8 : 0), // your own base = better turnout/sessions
    new Rng((availSeed * 19 + season.round * 3) >>> 0)
  );
  simRestOfRound(currentFixture);
  maybeRumour();
  season.round++;
  currentFixture = null;
  backToSeasonBtn.classList.add("hidden");
  backToSeasonBtn.classList.remove("primary");
  simBtn.classList.add("hidden");
  subsBtn.classList.add("hidden");
  renderSeason();
}

/** Drop the occasional 📰 flavour item into the inbox (about every other round). */
function maybeRumour() {
  if (!season) return;
  const rng = new Rng((seasonSeed * 131 + season.round * 17 + 5) >>> 0);
  if (rng.next() > 0.5) return; // not every round
  // mostly about a rival; sometimes about your own club
  const pool = season.clubs.filter((c) => c !== season!.userClub);
  const club = rng.next() < 0.4 || pool.length === 0 ? season.userClub : pool[Math.floor(rng.next() * pool.length)];
  const r = rumour(club.name, rng);
  logNews(`📰 ${r.text}`);
  if (r.morale !== 0 && club === season.userClub) {
    for (const p of season.rosterFor(season.userClub)) p.condition.morale = Math.max(0, Math.min(100, p.condition.morale + r.morale));
  }
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

// ====================== summer Sevens cup ================================
let cup: SevensCup | null = null;
let sevensTie: SevensTie | null = null;
let sevensSeed = 0;
const sevensBracket = $("sevensBracket");
const sevensChampion = $("sevensChampion");
const sevensRoundPill = $("sevensRound");
const sevensPlayBtn = $("sevensPlay") as HTMLButtonElement;
const sevensSimBtn = $("sevensSim") as HTMLButtonElement;

/** A full 7s matchday squad for a team — your club draws from its real roster. */
function sevensSquadFor(team: Team, side: "home" | "away", seed: number) {
  if (season && team === season.userClub) {
    const roster = season.rosterFor(team);
    sevensLineup(roster);
    roster.forEach((p) => (p.side = side));
    return roster;
  }
  return buildSquad(new Rng(seed >>> 0), team, side, FORMATS.sevens, 10, season?.repOf(team) ?? team.reputation);
}

/** Headless-sim a single tie (used for AI ties and abandoned ties). */
function simSevensTie(tie: SevensTie) {
  if (!cup) return;
  const seed = (sevensSeed * 131 + tie.round * 17 + tie.slot * 7) >>> 0;
  const hs = sevensSquadFor(tie.a, "home", seed * 3 + 1);
  const as = sevensSquadFor(tie.b, "away", seed * 3 + 2);
  const m = new Match(seed, "sevens", tie.a, tie.b, { homeSquad: hs, awaySquad: as });
  let g = 0;
  while (!m.finished && g < 200000) {
    m.step(0.05);
    g++;
  }
  cup.record(tie, m.score.home, m.score.away);
}

function startSevensCup() {
  if (!season) return;
  const entrants = cupEntrants(CLUBS, season.userClub, (t) => season!.repOf(t));
  sevensSeed = (seasonSeed * 7919 + season.year * 31) >>> 0;
  cup = new SevensCup(entrants, season.userClub);
  renderSevens();
}

function renderSevens() {
  if (!cup || !season) return;
  showView("sevens");
  sevensChampion.classList.toggle("hidden", !cup.champion);
  const ut = cup.userTie();
  sevensPlayBtn.classList.toggle("hidden", !ut || cup.isComplete());
  sevensSimBtn.classList.toggle("hidden", cup.isComplete() || cup.roundComplete());
  sevensRoundPill.textContent = cup.isComplete()
    ? "Cup complete"
    : `${ROUND_NAMES[cup.round]}`;

  if (cup.champion) {
    sevensChampion.innerHTML =
      cup.champion === season.userClub
        ? `🏆 <strong>Sevens champions!</strong> ${cup.champion.name} win the cup.`
        : `Cup won by <strong>${cup.champion.name}</strong>.`;
  }

  // bracket as columns per round
  const maxRound = cup.champion ? 3 : cup.round;
  const cols: string[] = [];
  for (let r = 1; r <= 3; r++) {
    const ties = cup.ties.filter((t) => t.round === r);
    const rows = ties
      .map((t) => {
        const mine = t.a === season!.userClub || t.b === season!.userClub;
        const win = t.played ? cup!.winnerOf(t) : null;
        const line = (team: Team, score: number) =>
          `<div class="bt-team ${win === team ? "win" : ""}"><span>${team.short}</span><span>${t.played ? score : ""}</span></div>`;
        return `<div class="bt-tie ${mine ? "mine" : ""}">${line(t.a, t.aScore)}${line(t.b, t.bScore)}</div>`;
      })
      .join("");
    cols.push(`<div class="bt-col ${r > maxRound ? "future" : ""}"><h3>${ROUND_NAMES[r]}</h3>${rows || '<p class="bt-tbd">—</p>'}</div>`);
  }
  sevensBracket.innerHTML = cols.join("");
}

/** After the user's tie is decided: sim the other ties this round, then advance. */
function finishSevensRound() {
  if (!cup) return;
  for (const t of cup.roundTies()) if (!t.played) simSevensTie(t);
  cup.advance();
  if (cup.isComplete()) applySevensReward();
  sevensTie = null;
  currentFixture = null;
  backToSeasonBtn.classList.add("hidden");
  backToSeasonBtn.classList.remove("primary");
  simBtn.classList.add("hidden");
  subsBtn.classList.add("hidden");
  renderSevens();
}

function applySevensReward() {
  if (!cup || !season || cup.champion !== season.userClub) return;
  // a cup run lifts morale and nudges reputation
  const roster = season.rosterFor(season.userClub);
  for (const p of roster) p.condition.morale = Math.min(100, p.condition.morale + 4);
  season.reputation.set(season.userClub, Math.min(100, season.repOf(season.userClub) + 2));
  logNews(`🏉 Won the Summer Sevens Cup!`);
  save();
}

function startSevensMatch(tie: SevensTie) {
  if (!season) return;
  sevensTie = tie;
  currentFixture = null;
  const seed = (sevensSeed * 131 + tie.round * 17 + tie.slot * 7) >>> 0;
  const hs = sevensSquadFor(tie.a, "home", seed * 3 + 1);
  const as = sevensSquadFor(tie.b, "away", seed * 3 + 2);
  userSide = tie.a === season.userClub ? "home" : "away";
  match = new Match(seed, "sevens", tie.a, tie.b, {
    homeTactics: userSide === "home" ? userTactics : { ...PRESETS[0].tactics },
    awayTactics: userSide === "away" ? userTactics : { ...PRESETS[0].tactics },
    homeSquad: hs,
    awaySquad: as,
  });
  renderedCommentary = 0;
  eventsEl.innerHTML = "";
  homeNameEl.textContent = tie.a.name;
  awayNameEl.textContent = tie.b.name;
  formatLabel.classList.add("hidden");
  newBtn.classList.add("hidden");
  simBtn.classList.remove("hidden");
  subsBtn.classList.remove("hidden");
  backToSeasonBtn.classList.remove("hidden");
  backToSeasonBtn.textContent = "‹ Cup";
  currentEnv = buildEnvironment(match!.home, match!.away);
  showView("match");
  syncScoreboard();
  renderer.resize();
  renderer.draw(match, currentEnv);
  setPlaying(true);
}

function finishSevensMatch() {
  if (!cup || !sevensTie || !match) return;
  cup.record(sevensTie, match.score.home, match.score.away);
  finishSevensRound();
}

$("sevensBtn").addEventListener("click", () => {
  if (!cup || cup.isComplete()) startSevensCup();
  else renderSevens();
});
$("sevensBack").addEventListener("click", () => renderSeason());
sevensPlayBtn.addEventListener("click", () => {
  const ut = cup?.userTie();
  if (ut) startSevensMatch(ut);
});
sevensSimBtn.addEventListener("click", () => {
  if (!cup) return;
  finishSevensRound();
});

backToSeasonBtn.addEventListener("click", () => {
  setPlaying(false);
  if (gfTie) {
    if (match && match.finished) finishGrandFinal();
    return; // see the Grand Final through
  }
  if (playoffTie) {
    if (match && match.finished) finishPlayoffMatch();
    return; // a playoff must be seen through — no bailing out
  }
  if (sevensTie) {
    if (match && match.finished) finishSevensMatch();
    else if (confirm("Leave this tie? It will be quick-simmed instead.")) {
      simSevensTie(sevensTie);
      finishSevensRound();
    }
    return;
  }
  if (match && match.finished) {
    showTeamTalk("full").then(() => showPostMatchInterview()).then(() => finishUserMatch());
  } else if (confirm("Leave this match? It will be quick-simmed instead.")) {
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
  renderStats();
}

const statsPanel = $("statsPanel");
/** A split bar (percentage) row: home value | bar | away value. */
function pctRow(label: string, h: number, a: number): string {
  const tot = h + a;
  const hp = tot > 0 ? Math.round((h / tot) * 100) : 50;
  return `<div class="stat-row">
    <span class="sv">${hp}%</span>
    <span class="stat-label">${label}<span class="stat-bar"><span class="fill" style="width:${hp}%"></span></span></span>
    <span class="sv right">${100 - hp}%</span>
  </div>`;
}
/** A plain count row: home value | label | away value. */
function numRow(label: string, h: string | number, a: string | number): string {
  return `<div class="stat-row">
    <span class="sv">${h}</span><span class="stat-label center">${label}</span><span class="sv right">${a}</span>
  </div>`;
}
function setPiecePct(won: number, lost: number): string {
  const t = won + lost;
  return t ? `${Math.round((won / t) * 100)}% (${won}/${t})` : "—";
}
function tacklePct(made: number, missed: number): string {
  const t = made + missed;
  return t ? `${Math.round((made / t) * 100)}%` : "—";
}
function renderStats() {
  if (!match) return;
  const h = match.stats.home;
  const a = match.stats.away;
  statsPanel.innerHTML =
    pctRow("Possession", h.possSecs, a.possSecs) +
    pctRow("Territory", h.terrSecs, a.terrSecs) +
    numRow("Tries", h.tries, a.tries) +
    numRow("Line breaks", h.lineBreaks, a.lineBreaks) +
    numRow("Tackle success", tacklePct(h.tackles, h.missedTackles), tacklePct(a.tackles, a.missedTackles)) +
    numRow("Kicks from hand", h.kicks, a.kicks) +
    numRow("Turnovers won", h.turnoversWon, a.turnoversWon) +
    numRow("Penalties conceded", h.penalties, a.penalties) +
    numRow("Scrums", setPiecePct(h.scrumWon, h.scrumLost), setPiecePct(a.scrumWon, a.scrumLost)) +
    numRow("Lineouts", setPiecePct(h.lineoutWon, h.lineoutLost), setPiecePct(a.lineoutWon, a.lineoutLost));
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
      // stop the clock at the interval for a half-time team talk (career only)
      if (currentFixture && match.half === 2 && lastHalf === 1) break;
    }
    syncScoreboard();
    flushCommentary();
    if (match.finished) setPlaying(false);
    else if (currentFixture && match.half === 2 && lastHalf === 1) {
      lastHalf = 2;
      acc = 0;
      setPlaying(false);
      showTeamTalk("half").then(() => setPlaying(true));
    }
  }
  if (match) renderer.draw(match, currentEnv);
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
  renderer.draw(match, currentEnv);
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
  currentEnv = buildEnvironment(a, b);
  renderedCommentary = 0;
  eventsEl.innerHTML = "";
  syncScoreboard();
  renderer.resize();
  renderer.draw(match, currentEnv);
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
