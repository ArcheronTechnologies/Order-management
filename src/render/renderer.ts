import { Match } from "../engine/match";
import type { MatchEnvironment } from "../engine/matchday";
import {
  PITCH,
  TOTAL_LENGTH,
  HOME_TRY_LINE,
  AWAY_TRY_LINE,
  HALFWAY,
} from "../engine/formats";

const HOME_COLOR = "#4aa3ff";
const AWAY_COLOR = "#ff5d5d";

const DEFAULT_ENV: MatchEnvironment = {
  ground: "owned",
  facilities: 3,
  pitchCondition: 80,
  attendance: 0.4,
  homeColor: HOME_COLOR,
  awayColor: AWAY_COLOR,
  boards: [],
};

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private scale = 1;
  private padX = 0;
  private padY = 0;
  private topBand = 0;
  private bottomBand = 0;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");
    this.ctx = ctx;
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // reserve a band above the pitch for the stand & crowd, and below for the
    // pitch-side sponsor boards & terracing
    const margin = 10;
    this.topBand = Math.max(26, Math.min(96, rect.height * 0.17));
    this.bottomBand = Math.max(18, Math.min(60, rect.height * 0.1));
    const availW = rect.width - margin * 2;
    const availH = rect.height - margin * 2 - this.topBand - this.bottomBand;
    this.scale = Math.min(availW / TOTAL_LENGTH, availH / PITCH.width);
    this.padX = (rect.width - TOTAL_LENGTH * this.scale) / 2;
    this.padY = margin + this.topBand + (availH - PITCH.width * this.scale) / 2;
  }

  private sx(x: number): number {
    return this.padX + x * this.scale;
  }
  private sy(y: number): number {
    return this.padY + y * this.scale;
  }
  /** stable pseudo-random in [0,1) from an integer — keeps the crowd from flickering. */
  private rand(i: number): number {
    const v = Math.sin(i * 12.9898 + 7.13) * 43758.5453;
    return v - Math.floor(v);
  }

  draw(m: Match, env: MatchEnvironment = DEFAULT_ENV) {
    const ctx = this.ctx;
    const rect = this.canvas.getBoundingClientRect();
    ctx.fillStyle = "#0b1a12";
    ctx.fillRect(0, 0, rect.width, rect.height);
    this.drawStand(env);
    this.drawPitch(m, env);
    this.drawBoards(env);
    this.drawPlayers(m);
    this.drawBall(m);
  }

  // --- the stand & crowd along the top touchline -----------------------------
  private drawStand(env: MatchEnvironment) {
    const ctx = this.ctx;
    const left = this.sx(0);
    const right = this.sx(TOTAL_LENGTH);
    const w = right - left;
    const pitchTop = this.sy(0);
    const bandTop = pitchTop - this.topBand;
    if (this.topBand < 8) return;

    if (env.ground === "owned") {
      // a built grandstand, taller with better facilities
      const roofH = Math.min(this.topBand * 0.32, 6 + env.facilities * 3);
      const standTop = bandTop + 2;
      ctx.fillStyle = "#10241a";
      ctx.fillRect(left, standTop, w, this.topBand - 4);
      // terraced seating rows
      const rows = 3 + env.facilities;
      const seatTop = standTop + roofH;
      const seatH = (pitchTop - 2 - seatTop) / rows;
      for (let r = 0; r < rows; r++) {
        ctx.fillStyle = r % 2 === 0 ? "#16322360" : "#1b3c2960";
        ctx.fillRect(left, seatTop + r * seatH, w, seatH - 0.5);
      }
      // roof
      ctx.fillStyle = "#0a1c14";
      ctx.fillRect(left, standTop, w, roofH);
      ctx.fillStyle = env.homeColor;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(left, standTop, w, 2);
      ctx.globalAlpha = 1;
      this.drawCrowd(left, seatTop, w, pitchTop - 2 - seatTop, env, 320, 0);
    } else {
      // shared/communal ground: just a rope and a sparse standing crowd on grass
      const top = pitchTop - this.topBand * 0.6;
      this.drawCrowd(left, top, w, pitchTop - 4 - top, env, 120, 1000);
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(left, pitchTop - 2);
      ctx.lineTo(right, pitchTop - 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  private drawCrowd(x: number, y: number, w: number, h: number, env: MatchEnvironment, maxN: number, seed: number) {
    if (h < 3) return;
    const ctx = this.ctx;
    const n = Math.floor(maxN * env.attendance);
    for (let i = 0; i < n; i++) {
      const px = x + this.rand(seed + i * 2) * w;
      const py = y + this.rand(seed + i * 2 + 1) * h;
      const tint = this.rand(seed + i * 3);
      ctx.fillStyle = tint < 0.34 ? env.homeColor : tint < 0.5 ? env.awayColor : tint < 0.75 ? "#cfd8d3" : "#8b9a92";
      ctx.globalAlpha = 0.85;
      ctx.fillRect(px, py, 1.6, 1.6);
    }
    ctx.globalAlpha = 1;
  }

  // --- pitch-side sponsor boards along the bottom touchline -------------------
  private drawBoards(env: MatchEnvironment) {
    const ctx = this.ctx;
    const left = this.sx(0);
    const right = this.sx(TOTAL_LENGTH);
    const w = right - left;
    const pitchBottom = this.sy(PITCH.width);
    const boardTop = pitchBottom + 3;
    const boardH = Math.min(this.bottomBand * 0.5, 16);
    if (boardH < 5) return;

    // sparse standing crowd behind the boards
    this.drawCrowd(left, boardTop + boardH + 1, w, this.bottomBand - boardH - 3, env, 90, 5000);

    const boards = env.boards.length ? env.boards : [{ name: "", color: "#16322a" }];
    const seg = w / Math.max(boards.length, 6);
    let i = 0;
    for (let x = left; x < right - 1; x += seg, i++) {
      const board = boards[i % boards.length];
      ctx.fillStyle = board.color;
      ctx.fillRect(x + 1, boardTop, seg - 2, boardH);
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 1, boardTop, seg - 2, boardH);
      if (board.name && seg > 34) {
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.font = `bold ${Math.min(boardH - 4, 9)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(board.name.slice(0, 14), x + seg / 2, boardTop + boardH / 2 + 0.5);
      }
    }
  }

  private drawPitch(m: Match, env: MatchEnvironment) {
    const ctx = this.ctx;
    const cond = env.pitchCondition / 100; // 1 = lush, 0 = worn
    // grass colour shifts from vivid green (good) to scrubby brown (poor)
    const lerp = (a: number, b: number) => Math.round(a + (b - a) * cond);
    const lush1 = [lerp(58, 31), lerp(60, 80), lerp(40, 52)];
    const lush2 = [lerp(52, 26), lerp(54, 72), lerp(36, 46)];
    const rgb = (c: number[]) => `rgb(${c[0]},${c[1]},${c[2]})`;
    const stripes = 12;
    for (let i = 0; i < stripes; i++) {
      const x0 = (TOTAL_LENGTH / stripes) * i;
      ctx.fillStyle = i % 2 === 0 ? rgb(lush1) : rgb(lush2);
      ctx.fillRect(this.sx(x0), this.sy(0), (TOTAL_LENGTH / stripes) * this.scale + 1, PITCH.width * this.scale);
    }
    // worn / muddy patches in the high-traffic middle when the pitch is poor
    if (env.pitchCondition < 70) {
      const patches = Math.round((70 - env.pitchCondition) / 4);
      ctx.fillStyle = `rgba(60,46,28,${0.18 + (1 - cond) * 0.3})`;
      for (let i = 0; i < patches; i++) {
        const px = HALFWAY + (this.rand(i * 2) - 0.5) * 70;
        const py = PITCH.width / 2 + (this.rand(i * 2 + 1) - 0.5) * 46;
        const rr = (3 + this.rand(i * 5) * 6) * this.scale;
        ctx.beginPath();
        ctx.ellipse(this.sx(px), this.sy(py), rr, rr * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // in-goal areas
    ctx.fillStyle = "rgba(74,163,255,0.10)";
    ctx.fillRect(this.sx(0), this.sy(0), PITCH.inGoal * this.scale, PITCH.width * this.scale);
    ctx.fillStyle = "rgba(255,93,93,0.10)";
    ctx.fillRect(this.sx(AWAY_TRY_LINE), this.sy(0), PITCH.inGoal * this.scale, PITCH.width * this.scale);

    // markings fade a little on a scruffy communal pitch
    const lineAlpha = env.ground === "shared" ? 0.4 : 0.55;
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = `rgba(255,255,255,${lineAlpha})`;
    this.strokeLineX(0);
    this.strokeLineX(TOTAL_LENGTH);
    ctx.strokeRect(this.sx(0), this.sy(0), TOTAL_LENGTH * this.scale, PITCH.width * this.scale);
    this.strokeLineX(HOME_TRY_LINE);
    this.strokeLineX(AWAY_TRY_LINE);
    ctx.strokeStyle = `rgba(255,255,255,${lineAlpha + 0.15})`;
    this.strokeLineX(HALFWAY);
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = `rgba(255,255,255,${lineAlpha - 0.15})`;
    this.strokeLineX(HOME_TRY_LINE + 22);
    this.strokeLineX(AWAY_TRY_LINE - 22);
    this.strokeLineX(HALFWAY - 10);
    this.strokeLineX(HALFWAY + 10);
    ctx.setLineDash([]);

    this.drawPosts(HOME_TRY_LINE);
    this.drawPosts(AWAY_TRY_LINE);

    if (m.goalTarget) {
      ctx.strokeStyle = "rgba(255,212,121,0.8)";
      ctx.beginPath();
      ctx.arc(this.sx(m.goalTarget.x), this.sy(m.goalTarget.y), 5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawPosts(x: number) {
    const ctx = this.ctx;
    const cy = PITCH.width / 2;
    const halfGap = 2.8;
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.sx(x), this.sy(cy - halfGap));
    ctx.lineTo(this.sx(x), this.sy(cy + halfGap));
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    for (const dy of [-halfGap, halfGap]) {
      ctx.beginPath();
      ctx.arc(this.sx(x), this.sy(cy + dy), 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private strokeLineX(x: number) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(this.sx(x), this.sy(0));
    ctx.lineTo(this.sx(x), this.sy(PITCH.width));
    ctx.stroke();
  }

  private drawPlayers(m: Match) {
    const ctx = this.ctx;
    const r = Math.max(4, this.scale * 0.85);
    for (const p of m.players) {
      const carrying = m.ball.carrier === p;
      ctx.beginPath();
      ctx.arc(this.sx(p.x), this.sy(p.y), r, 0, Math.PI * 2);
      ctx.fillStyle = p.side === "home" ? HOME_COLOR : AWAY_COLOR;
      ctx.fill();
      if (carrying) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#fff";
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(0,0,0,0.8)";
      ctx.font = `${Math.round(r)}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(p.number), this.sx(p.x), this.sy(p.y) + 0.5);
    }
  }

  private drawBall(m: Match) {
    if (m.ball.carrier) return;
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.ellipse(
      this.sx(m.ball.x),
      this.sy(m.ball.y),
      Math.max(2.5, this.scale * 0.45),
      Math.max(1.7, this.scale * 0.3),
      0,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = "#f4e3c1";
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.stroke();
  }
}
