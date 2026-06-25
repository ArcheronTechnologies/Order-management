import { Match } from "../engine/match";
import {
  PITCH,
  TOTAL_LENGTH,
  HOME_TRY_LINE,
  AWAY_TRY_LINE,
  HALFWAY,
} from "../engine/formats";

const HOME_COLOR = "#4aa3ff";
const AWAY_COLOR = "#ff5d5d";

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private scale = 1;
  private padX = 0;
  private padY = 0;

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

    // fit the 120x70 pitch into the canvas with a small margin
    const margin = 16;
    const availW = rect.width - margin * 2;
    const availH = rect.height - margin * 2;
    this.scale = Math.min(availW / TOTAL_LENGTH, availH / PITCH.width);
    this.padX = (rect.width - TOTAL_LENGTH * this.scale) / 2;
    this.padY = (rect.height - PITCH.width * this.scale) / 2;
  }

  private sx(x: number): number {
    return this.padX + x * this.scale;
  }
  private sy(y: number): number {
    return this.padY + y * this.scale;
  }

  draw(m: Match) {
    const ctx = this.ctx;
    const rect = this.canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    this.drawPitch(m);
    this.drawPlayers(m);
    this.drawBall(m);
  }

  private drawPitch(m: Match) {
    const ctx = this.ctx;
    // grass with mowing stripes
    const stripes = 12;
    for (let i = 0; i < stripes; i++) {
      const x0 = (TOTAL_LENGTH / stripes) * i;
      ctx.fillStyle = i % 2 === 0 ? "#1d3324" : "#1a2e20";
      ctx.fillRect(
        this.sx(x0),
        this.sy(0),
        (TOTAL_LENGTH / stripes) * this.scale + 1,
        PITCH.width * this.scale
      );
    }
    // in-goal areas
    ctx.fillStyle = "rgba(74,163,255,0.10)";
    ctx.fillRect(this.sx(0), this.sy(0), PITCH.inGoal * this.scale, PITCH.width * this.scale);
    ctx.fillStyle = "rgba(255,93,93,0.10)";
    ctx.fillRect(
      this.sx(AWAY_TRY_LINE),
      this.sy(0),
      PITCH.inGoal * this.scale,
      PITCH.width * this.scale
    );

    ctx.lineWidth = 1.2;
    ctx.strokeStyle = "rgba(255,255,255,0.55)";

    // boundary
    this.strokeLineX(0);
    this.strokeLineX(TOTAL_LENGTH);
    ctx.strokeRect(this.sx(0), this.sy(0), TOTAL_LENGTH * this.scale, PITCH.width * this.scale);

    // try lines (solid)
    this.strokeLineX(HOME_TRY_LINE);
    this.strokeLineX(AWAY_TRY_LINE);
    // halfway (solid)
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    this.strokeLineX(HALFWAY);
    // 22m lines (dashed)
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    this.strokeLineX(HOME_TRY_LINE + 22);
    this.strokeLineX(AWAY_TRY_LINE - 22);
    // 10m lines either side of halfway (dashed)
    this.strokeLineX(HALFWAY - 10);
    this.strokeLineX(HALFWAY + 10);
    ctx.setLineDash([]);

    // goal posts
    this.drawPosts(HOME_TRY_LINE);
    this.drawPosts(AWAY_TRY_LINE);

    // active goal-kick target
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
    const halfGap = 2.8; // ~5.6m between posts
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
      // shirt number
      ctx.fillStyle = "rgba(0,0,0,0.8)";
      ctx.font = `${Math.round(r)}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(p.number), this.sx(p.x), this.sy(p.y) + 0.5);
    }
  }

  private drawBall(m: Match) {
    if (m.ball.carrier) return; // drawn as the white ring on the carrier
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
