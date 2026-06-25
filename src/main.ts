import "./style.css";
import { Match } from "./engine/match";
import { Renderer } from "./render/renderer";
import { CLUBS } from "./data/clubs";
import type { FormatId } from "./engine/formats";

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
};

const canvas = $("pitch") as HTMLCanvasElement;
const renderer = new Renderer(canvas);

const formatSel = $("format") as HTMLSelectElement;
const speedSel = $("speed") as HTMLSelectElement;
const playBtn = $("playPause") as HTMLButtonElement;
const newBtn = $("newMatch") as HTMLButtonElement;

const homeNameEl = $("homeName");
const awayNameEl = $("awayName");
const homeScoreEl = $("homeScore");
const awayScoreEl = $("awayScore");
const clockEl = $("clock");
const halfEl = $("half");
const eventsEl = $("events") as HTMLUListElement;

let match: Match;
let playing = false;
let seed = 0x1a2b3c;
let renderedCommentary = 0;

function pickTeams(s: number): [number, number] {
  const n = CLUBS.length;
  const a = (s >>> 0) % n; // unsigned — large seeds must stay in range
  let b = (a + 1 + ((s >>> 3) % n)) % n;
  if (b === a) b = (b + 1) % n;
  return [a, b];
}

function newMatch() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  const [hi, ai] = pickTeams(seed);
  const home = CLUBS[hi];
  const away = CLUBS[ai];
  match = new Match(seed, formatSel.value as FormatId, home, away);
  renderedCommentary = 0;
  eventsEl.innerHTML = "";
  homeNameEl.textContent = home.name;
  awayNameEl.textContent = away.name;
  syncScoreboard();
  renderer.resize();
  renderer.draw(match);
}

function fmtClock(sec: number): string {
  const total = Math.floor(sec);
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function syncScoreboard() {
  homeScoreEl.textContent = String(match.score.home);
  awayScoreEl.textContent = String(match.score.away);
  clockEl.textContent = fmtClock(match.clock);
  halfEl.textContent = match.finished
    ? "Full time"
    : match.half === 1
      ? "1st half"
      : "2nd half";
}

function flushCommentary() {
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
  playing = on && !match.finished;
  playBtn.textContent = playing ? "Pause" : match.finished ? "Done" : "Play";
}

// fixed-step simulation; render once per animation frame
const SIM_DT = 0.05; // 50ms sim steps
let acc = 0;
let last = 0;

function loop(now: number) {
  requestAnimationFrame(loop);
  if (!last) last = now;
  let frame = (now - last) / 1000;
  last = now;
  if (frame > 0.25) frame = 0.25; // avoid spiral after a tab stall

  if (playing && !match.finished) {
    const multiplier = Number(speedSel.value);
    acc += frame * multiplier;
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
  renderer.draw(match);
}

playBtn.addEventListener("click", () => setPlaying(!playing));
newBtn.addEventListener("click", () => {
  newMatch();
  setPlaying(true);
});
formatSel.addEventListener("change", () => {
  newMatch();
  setPlaying(false);
});

newMatch();
requestAnimationFrame(loop);
