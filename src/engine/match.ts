import { Rng } from "./rng";
import {
  FORMATS,
  type FormatId,
  type FormatConfig,
  PITCH,
  TOTAL_LENGTH,
  HALFWAY,
  attackingLine,
  attackDir,
} from "./formats";
import { buildSquad, type Team } from "./teams";
import type { Ball, Phase, Player, ScoreEvent, Side } from "./types";

const TACKLE_RADIUS = 1.3; // m
const PASS_SPEED = 13; // m/s
const KICK_SPEED = 24; // m/s
const DEF_LINE_GAP = 6; // m the defensive line sets up ahead of the ball
const REDZONE = 22; // m from the line (the 22) where pressure tells

export interface CommentaryLine {
  clock: number;
  text: string;
  kind?: "try" | "score";
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}
function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export class Match {
  readonly rng: Rng;
  readonly fmt: FormatConfig;
  readonly home: Team;
  readonly away: Team;
  players: Player[] = [];
  ball: Ball;

  phase: Phase = "kickoff";
  possession: Side = "away"; // away kicks off to home in the 1st half
  clock = 0;
  half = 1;
  score: Record<Side, number> = { home: 0, away: 0 };
  events: ScoreEvent[] = [];
  commentary: CommentaryLine[] = [];
  finished = false;
  /** counters for tuning/debug (not shown in the UI). */
  debug = { rucks: 0, breaks: 0, gateContacts: 0, cleanBreaks: 0, endpoint: 0, kicks: 0, turnovers: 0, phases: 0 };

  private phaseTimer = 0; // counts down restarts/rucks/goal kicks
  private decisionTimer = 0;
  private phaseCount = 0; // phases within current possession
  private openAnchorX = HALFWAY; // where the current phase started (sets the def line)
  private beaten = new Map<number, number>(); // defenderId -> seconds beaten
  private breakawayId = -1; // carrier currently in open space
  private breakawayTimer = 0; // seconds of the pace burst remaining
  private goalKick: {
    side: Side;
    fromX: number;
    fromY: number;
    success: boolean;
    points: number;
    kind: "conversion" | "penalty";
  } | null = null;
  /** target the active goal kick is flying toward (for rendering). */
  goalTarget: { x: number; y: number } | null = null;

  constructor(seed: number, formatId: FormatId, home: Team, away: Team) {
    this.rng = new Rng(seed);
    this.fmt = FORMATS[formatId];
    this.home = home;
    this.away = away;
    this.players = [
      ...buildSquad(this.rng, home, "home", this.fmt),
      ...buildSquad(this.rng, away, "away", this.fmt),
    ];
    this.ball = {
      x: HALFWAY,
      y: PITCH.width / 2,
      carrier: null,
      vx: 0,
      vy: 0,
      airTime: 0,
      thrownBy: null,
      kicked: false,
    };
    this.setupKickoff("home"); // away kicks off, home receives
  }

  get totalTime(): number {
    return this.fmt.halfLength * 2;
  }
  private side(s: Side): Player[] {
    return this.players.filter((p) => p.side === s);
  }
  private opp(s: Side): Side {
    return s === "home" ? "away" : "home";
  }
  private teamOf(s: Side): Team {
    return s === "home" ? this.home : this.away;
  }

  private say(text: string, kind?: CommentaryLine["kind"]) {
    this.commentary.push({ clock: this.clock, text, kind });
    if (this.commentary.length > 60) this.commentary.shift();
  }

  // --- speeds & movement ---------------------------------------------------
  private speed(p: Player): number {
    const base = 4.6 + (p.attr.pace / 20) * 4.4; // 4.6 .. 9.0 m/s
    let burst = 1;
    if (this.breakawayTimer > 0) {
      // the breaker gets a burst into space; the defence scrambles a bit faster
      // too, so only a genuinely quicker player finishes the line break
      burst = p.id === this.breakawayId ? 1.3 : p.side !== this.possession ? 1.12 : 1;
    }
    return base * (1 - 0.4 * p.fatigue) * burst;
  }
  private moveToward(p: Player, tx: number, ty: number, spd: number, dt: number) {
    const d = dist(p.x, p.y, tx, ty);
    if (d < 1e-3) return;
    const step = Math.min(d, spd * dt);
    p.x += ((tx - p.x) / d) * step;
    p.y += ((ty - p.y) / d) * step;
    p.x = clamp(p.x, 0, TOTAL_LENGTH);
    p.y = clamp(p.y, 0, PITCH.width);
    p.fatigue = clamp(
      p.fatigue + dt * 0.0009 * (1 + (20 - p.attr.stamina) / 20),
      0,
      1
    );
  }
  private rest(p: Player, dt: number) {
    p.fatigue = clamp(p.fatigue - dt * 0.0006, 0, 1);
  }

  // --- formations ----------------------------------------------------------
  private lineUp(side: Side, anchorX: number, attacking: boolean) {
    const dir = attackDir(side);
    const list = this.side(side);
    const lineX = attacking
      ? anchorX - dir * 6 // attackers stand behind the ball
      : anchorX + dir * 8; // defenders form a line in front
    list.forEach((p, i) => {
      const lane = (i + 0.5) / list.length;
      p.x = clamp(lineX, PITCH.inGoal, PITCH.inGoal + PITCH.fieldLength);
      p.y = clamp(lane * PITCH.width, 2, PITCH.width - 2);
    });
  }

  private setupKickoff(receiving: Side) {
    const kicking = this.opp(receiving);
    this.possession = receiving;
    this.phaseCount = 0;
    this.beaten.clear();
    // kicking team behind halfway, receiving team deeper in own half
    this.lineUp(kicking, HALFWAY - attackDir(kicking) * 4, false);
    this.lineUp(receiving, HALFWAY - attackDir(receiving) * 28, true);
    // launch the ball as a contestable kick toward the receivers
    const dir = attackDir(kicking);
    this.ball.carrier = null;
    this.ball.x = HALFWAY;
    this.ball.y = PITCH.width / 2 + this.rng.range(-15, 15);
    const targetX = HALFWAY + dir * this.rng.range(24, 34);
    const targetY = clamp(this.ball.y + this.rng.range(-12, 12), 4, PITCH.width - 4);
    this.launchBall(targetX, targetY, KICK_SPEED * 0.7, true, null);
    this.phase = "flight";
    this.say(`${this.teamOf(kicking).short} kick off.`);
  }

  private launchBall(
    tx: number,
    ty: number,
    spd: number,
    kicked: boolean,
    thrownBy: Player | null
  ) {
    const d = dist(this.ball.x, this.ball.y, tx, ty) || 0.001;
    this.ball.vx = ((tx - this.ball.x) / d) * spd;
    this.ball.vy = ((ty - this.ball.y) / d) * spd;
    this.ball.airTime = d / spd;
    this.ball.kicked = kicked;
    this.ball.thrownBy = thrownBy;
    this.ball.carrier = null;
  }

  // --- the main tick -------------------------------------------------------
  step(dt: number) {
    if (this.finished) return;

    // The clock runs continuously, including through rucks and restarts — only
    // ~35 of 80 minutes is ball-in-play, which keeps the number of phases (and
    // so the scoring) realistic.
    this.clock += dt;

    switch (this.phase) {
      case "flight":
        this.tickFlight(dt);
        break;
      case "open":
        this.tickOpen(dt);
        break;
      case "ruck":
        this.tickRuck(dt);
        break;
      case "conversion":
      case "penalty":
        this.tickGoalKick(dt);
        break;
      case "kickoff":
        // transient; setupKickoff moves us straight to flight
        break;
      case "fulltime":
        break;
    }

    this.checkClock();
  }

  private checkClock() {
    if (this.finished) return;
    if (this.half === 1 && this.clock >= this.fmt.halfLength) {
      // roll to 2nd half at the next restart-ish moment
      if (this.phase === "flight" || this.phase === "open") {
        this.half = 2;
        this.say("Half time.");
        this.setupKickoff("home"); // home kicks off the 2nd half
      }
    }
    if (this.clock >= this.totalTime) {
      // end at the next breakdown/restart — or force it if play overruns
      if (this.phase === "ruck" || this.phase === "flight" || this.clock >= this.totalTime + 90) {
        this.finished = true;
        this.phase = "fulltime";
        this.say("Full time.", "score");
      }
    }
  }

  // --- FLIGHT: ball in the air (kickoff, pass, kick) -----------------------
  private tickFlight(dt: number) {
    this.ball.x += this.ball.vx * dt;
    this.ball.y += this.ball.vy * dt;
    this.ball.airTime -= dt;
    // everyone drifts toward the ball's projected landing
    for (const p of this.players) {
      const chase = this.speed(p) * (p.side === this.possession ? 1 : 0.95);
      this.moveToward(p, this.ball.x, this.ball.y, chase, dt);
    }
    if (this.ball.airTime <= 0 || this.ball.y <= 0 || this.ball.y >= PITCH.width) {
      this.ball.y = clamp(this.ball.y, 1, PITCH.width - 1);
      this.resolveLanding();
    }
  }

  private resolveLanding() {
    // nearest player of each side
    let best: Player | null = null;
    let bestD = Infinity;
    for (const p of this.players) {
      if (p === this.ball.thrownBy) continue;
      const d = dist(p.x, p.y, this.ball.x, this.ball.y);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (!best) best = this.players[0];

    const prevPossession = this.possession;
    if (this.ball.kicked) {
      // contestable: whoever is closest gathers; possession follows them
      this.possession = best.side;
      this.phaseCount = 0;
    } else {
      // a pass: knock-on / interception checks
      if (best.side !== this.possession) {
        this.say(`Intercepted by ${best.name}!`);
        this.possession = best.side;
        this.phaseCount = 0;
      } else if (this.rng.chance(0.06 + (12 - best.attr.handling) * 0.01)) {
        this.say(`Knock-on by ${best.name}. Scrum.`);
        this.turnover(best.x, best.y);
        return;
      }
    }
    // reset the defence after a kick or a change of hands, but not for a pass
    // completed within the same team's attacking shape
    const reset = this.ball.kicked || best.side !== prevPossession;
    this.enterOpen(best, reset);
  }

  /** Hand the ball to a carrier and start a fresh phase of open play. */
  private enterOpen(carrier: Player, resetDefence = false) {
    this.ball.carrier = carrier;
    this.ball.x = carrier.x;
    this.ball.y = carrier.y;
    this.openAnchorX = carrier.x; // anchors the defensive line for this phase
    this.ball.thrownBy = null;
    this.ball.kicked = false;
    this.phase = "open";
    this.decisionTimer = this.rng.range(0.2, 0.5);
    this.debug.phases++;
    // On a possession change the defence is out of shape (they were attacking).
    // Snap them into a line in front of the new carrier so he can't just run
    // through the space the old attack left behind.
    if (resetDefence) this.setDefence(carrier.side, carrier.x, carrier.y);
  }

  /**
   * x for the defensive line: `gap` metres in front of the ball toward the line
   * being attacked, but never past that try line — so defenders can mount a
   * goal-line stand instead of being stranded behind the carrier.
   */
  private defLineX(att: Side, anchorX: number, gap = DEF_LINE_GAP): number {
    const dir = attackDir(att);
    const line = attackingLine(att);
    let x = anchorX + dir * gap;
    x = dir > 0 ? Math.min(x, line) : Math.max(x, line);
    return clamp(x, PITCH.inGoal, PITCH.inGoal + PITCH.fieldLength);
  }

  /** Place the defending side in a wall in front of `anchorX`, plus a sweeper. */
  private setDefence(att: Side, anchorX: number, ballY: number) {
    const def = this.opp(att);
    const lineX = this.defLineX(att, anchorX);
    const list = this.side(def).slice().sort((a, b) => a.y - b.y);
    const cover = list.pop()!; // one back as the sweeper
    const spacing = 4.2;
    const span = (list.length - 1) * spacing;
    const startY = clamp(ballY - span / 2, 2, PITCH.width - 2 - span);
    list.forEach((p, i) => {
      p.x = lineX;
      p.y = clamp(startY + i * spacing, 2, PITCH.width - 2);
    });
    cover.x = this.defLineX(att, anchorX, DEF_LINE_GAP + 16);
    cover.y = ballY;
  }

  // --- OPEN PLAY -----------------------------------------------------------
  private tickOpen(dt: number) {
    let carrier = this.ball.carrier;
    if (!carrier || carrier.side !== this.possession) {
      carrier = this.nearestOf(this.possession, this.ball.x, this.ball.y);
      this.ball.carrier = carrier;
    }
    const att = this.possession;
    const def = this.opp(att);
    const dir = attackDir(att);
    const line = attackingLine(att);

    // tick down "beaten" defenders and any active breakaway burst
    for (const [id, t] of this.beaten) {
      const nt = t - dt;
      if (nt <= 0) this.beaten.delete(id);
      else this.beaten.set(id, nt);
    }
    if (this.breakawayTimer > 0) this.breakawayTimer -= dt;

    // The defensive line holds at an anchored x (it does NOT retreat with the
    // carrier) and compresses toward the ball, forming a continuous wall so the
    // carrier's channel is always covered. The deepest defender sweeps as cover.
    const defList = this.side(def);
    const lineX = this.defLineX(att, this.openAnchorX);
    // the sweeper is the deepest defender — furthest toward the line they defend
    const cover = defList.reduce((a, b) => ((b.x - a.x) * dir > 0 ? b : a));
    // has the carrier got past the defensive line? then everyone scrambles
    const brokenThrough = (carrier.x - lineX) * dir > 1;
    const sweepX = this.defLineX(att, this.openAnchorX, DEF_LINE_GAP + 16);
    this.moveToward(
      cover,
      brokenThrough ? carrier.x + dir : sweepX,
      carrier.y,
      this.speed(cover),
      dt
    );

    // wall: holders evenly packed in a window centred on the carrier; if the
    // line is broken they turn and chase the ball instead of holding shape
    const holders = defList
      .filter((p) => p !== cover && !this.beaten.has(p.id))
      .sort((a, b) => a.y - b.y);
    const spacing = 4.2;
    const span = (holders.length - 1) * spacing;
    const startY = clamp(carrier.y - span / 2, 2, PITCH.width - 2 - span);
    holders.forEach((p, i) => {
      if (brokenThrough) {
        this.moveToward(p, carrier.x, carrier.y, this.speed(p), dt);
      } else {
        this.moveToward(p, lineX, startY + i * spacing, this.speed(p), dt);
      }
    });

    // support runners trail behind the ball (so passes stay legal/backward)
    const support = this.side(att).filter((p) => p !== carrier);
    support.forEach((p, i) => {
      const back = carrier!.x - dir * (5 + (i % 3) * 4);
      const lane = clamp(
        carrier!.y + (i % 2 === 0 ? -1 : 1) * (6 + (i % 4) * 6),
        3,
        PITCH.width - 3
      );
      this.moveToward(p, back, lane, this.speed(p) * 0.8, dt);
    });

    // advance the carrier toward the line, steering to the biggest gap
    const prevX = carrier.x;
    const target = this.runTarget(carrier, def, dir, line);
    this.moveToward(carrier, target.x, target.y, this.speed(carrier) * 0.85, dt);
    this.ball.x = carrier.x;
    this.ball.y = carrier.y;

    // GATE: the carrier cannot pass the defensive line plane this tick unless
    // the marker covering his channel is beaten. Guarantees contact at the line
    // even when the carrier would otherwise "flash" past in a single step.
    const crossedLine =
      (prevX - lineX) * dir < 0 && (carrier.x - lineX) * dir >= 0;
    if (crossedLine) {
      let gatekeeper: Player | null = null;
      let gd = Infinity;
      for (const p of defList) {
        if (this.beaten.has(p.id)) continue;
        if (Math.abs(p.x - lineX) > 3) continue; // must be set on the line
        const dy = Math.abs(p.y - carrier.y);
        if (dy <= 2.2 && dy < gd) {
          gd = dy;
          gatekeeper = p;
        }
      }
      if (gatekeeper) {
        this.debug.gateContacts++;
        this.contact(carrier, gatekeeper);
        return;
      }
      this.debug.cleanBreaks++;
      // nobody home in that channel — clean line break! the carrier gets a pace
      // burst into space, so a quick player can outrun the cover for a try while
      // a forward gets hauled down (a big gain). Beat the nearest two markers.
      this.say(`${carrier.name} is through the line!`);
      this.breakawayId = carrier.id;
      this.breakawayTimer = 2.2;
      defList
        .map((p) => ({ p, dy: Math.abs(p.y - carrier.y) }))
        .sort((a, b) => a.dy - b.dy)
        .slice(0, 2)
        .forEach(({ p }) => this.beaten.set(p.id, this.rng.range(1.2, 1.8)));
    }

    // try?
    if ((dir > 0 && carrier.x >= line) || (dir < 0 && carrier.x <= line)) {
      this.scoreTry(carrier);
      return;
    }

    // a trailing or cover defender can still drag down a line-breaker in range
    let tackler: Player | null = null;
    let td = Infinity;
    for (const p of defList) {
      if (this.beaten.has(p.id)) continue;
      const d = dist(p.x, p.y, carrier.x, carrier.y);
      if (d <= TACKLE_RADIUS && d < td) {
        td = d;
        tackler = p;
      }
    }
    if (tackler) {
      this.debug.endpoint++;
      this.contact(carrier, tackler);
      return;
    }

    // decisions (pass / kick) on a cadence
    this.decisionTimer -= dt;
    if (this.decisionTimer <= 0) {
      this.decisionTimer = this.rng.range(0.5, 0.9);
      this.decide(carrier, att, def, dir, line);
    }
  }

  private runTarget(carrier: Player, def: Side, dir: number, line: number) {
    // Run at the line, but steer toward the channel with the most space in the
    // defensive line. With a sparse defence (e.g. Sevens) the gaps are big, so
    // this naturally produces more line breaks than in a packed 15s defence.
    const ahead = this.side(def).filter((p) => (p.x - carrier.x) * dir > -3);
    let bestY = carrier.y;
    let bestGap = -1;
    for (const off of [-9, 0, 9]) {
      const cy = clamp(carrier.y + off, 4, PITCH.width - 4);
      let nearest = Infinity;
      for (const p of ahead) nearest = Math.min(nearest, Math.abs(p.y - cy));
      if (nearest > bestGap) {
        bestGap = nearest;
        bestY = cy;
      }
    }
    return { x: line, y: bestY };
  }

  private decide(carrier: Player, att: Side, def: Side, dir: number, line: number) {
    const distToLine = Math.abs(line - carrier.x);
    const nearestDef = this.nearestOf(def, carrier.x, carrier.y);
    const pressure = dist(nearestDef.x, nearestDef.y, carrier.x, carrier.y);

    // deep in own half and under pressure: kick for territory
    if (distToLine > 62 && this.rng.chance(0.06 + (pressure < 6 ? 0.08 : 0))) {
      const tx = clamp(carrier.x + dir * this.rng.range(28, 42), PITCH.inGoal + 2, PITCH.inGoal + PITCH.fieldLength - 2);
      const ty = clamp(carrier.y + this.rng.range(-10, 10), 4, PITCH.width - 4);
      this.launchBall(tx, ty, KICK_SPEED, true, carrier);
      this.phase = "flight";
      this.debug.kicks++;
      this.say(`${carrier.name} clears it downfield.`);
      return;
    }

    // pass to a support runner when a defender closes in
    if (pressure < 5 && this.rng.chance(0.35 + carrier.attr.handling * 0.02)) {
      const receiver = this.bestSupport(carrier, att, dir);
      if (receiver) {
        this.launchBall(receiver.x, receiver.y, PASS_SPEED, false, carrier);
        this.phase = "flight";
        return;
      }
    }
    // otherwise keep carrying
  }

  private bestSupport(carrier: Player, att: Side, dir: number): Player | null {
    // legal pass = backward (toward own line); prefer a teammate in space
    let best: Player | null = null;
    let bestScore = -Infinity;
    for (const p of this.side(att)) {
      if (p === carrier) continue;
      const behind = (carrier.x - p.x) * dir; // >0 means behind the ball
      if (behind < -1) continue;
      const space = this.distToNearestOpp(p);
      const score = space - Math.abs(p.y - carrier.y) * 0.3 - behind * 0.2;
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    return best;
  }

  // --- CONTACT / RUCK ------------------------------------------------------
  private contact(carrier: Player, tackler: Player) {
    const line = attackingLine(carrier.side);
    const distToLine = Math.abs(line - carrier.x);
    const nearLine = distToLine < REDZONE;
    // Sustained pressure tells: the more phases a side strings together near the
    // line, the more the defence tires and fractures, so breaks get more likely.
    const pressure = nearLine ? Math.min(this.phaseCount, 12) * 0.02 : 0;
    const breakP = clamp(
      0.09 +
        (carrier.attr.strength - tackler.attr.tackling) / 55 +
        (carrier.attr.pace - 10) / 85 +
        (nearLine ? 0.05 : 0) +
        pressure,
      0.02,
      0.45
    );
    if (this.rng.chance(breakP)) {
      this.debug.breaks++;
      const dir = attackDir(carrier.side);
      // close to the line, a beaten defender means he dives over for the try
      if (distToLine < 6) {
        this.say(`${carrier.name} forces his way over!`);
        carrier.x = line + dir * 0.5;
        this.ball.x = carrier.x;
        this.scoreTry(carrier);
        return;
      }
      this.say(`${carrier.name} beats ${tackler.name}!`);
      // beaten only briefly; a small burst keeps him near the line so the next
      // defender can re-engage — beating ONE man shouldn't clear the whole line
      this.beaten.set(tackler.id, this.rng.range(0.6, 1.1));
      carrier.x = clamp(carrier.x + dir * 1.5, 0, TOTAL_LENGTH);
      this.ball.x = carrier.x;
      return;
    }
    // tackle complete -> ruck
    this.debug.rucks++;
    this.phase = "ruck";
    this.phaseTimer = this.rng.range(1.4, 3.0);
    this.ball.x = carrier.x;
    this.ball.y = carrier.y;
    this.ball.carrier = null;
  }

  private tickRuck(dt: number) {
    this.phaseTimer -= dt;
    const att = this.possession;
    const dir = attackDir(att);
    const rx = this.ball.x;
    const ry = this.ball.y;
    const commit = this.fmt.id === "sevens" ? 1 : 2;

    // Each side commits a couple of forwards to the breakdown; everyone else
    // resets into next-phase shape (attack behind the ball, defence in a line
    // in front) and gets a breather.
    for (const side of [att, this.opp(att)] as Side[]) {
      const attacking = side === att;
      const lineX = attacking
        ? clamp(rx - dir * 5, PITCH.inGoal, PITCH.inGoal + PITCH.fieldLength)
        : this.defLineX(att, rx);
      const list = this.side(side);
      const fwds = list
        .filter((p) => p.forward)
        .map((p) => ({ p, d: dist(p.x, p.y, rx, ry) }))
        .sort((a, b) => a.d - b.d);
      const committed = new Set(fwds.slice(0, commit).map((f) => f.p.id));
      const others = list.filter((p) => !committed.has(p.id));
      for (const p of list) {
        if (committed.has(p.id)) {
          this.moveToward(p, rx, ry, this.speed(p), dt);
        } else {
          const idx = others.indexOf(p);
          const lane = clamp(((idx + 0.5) / others.length) * PITCH.width, 3, PITCH.width - 3);
          this.moveToward(p, lineX, lane, this.speed(p) * 0.7, dt);
          this.rest(p, dt);
        }
      }
    }

    if (this.phaseTimer <= 0) this.resolveRuck();
  }

  private resolveRuck() {
    const att = this.possession;
    this.phaseCount++;

    // penalty?
    if (this.rng.chance(0.035)) {
      // offending side: random, but more likely the defenders
      const offender = this.rng.chance(0.6) ? this.opp(att) : att;
      const winner = this.opp(offender);
      this.possession = winner;
      this.say(`Penalty to ${this.teamOf(winner).short}.`);
      this.takePenalty(winner);
      return;
    }

    // turnover chance grows as a side hangs onto the ball over many phases
    const turnoverP = clamp(0.025 + (this.phaseCount - 6) * 0.01, 0.02, 0.18);
    if (this.rng.chance(turnoverP)) {
      this.turnover(this.ball.x, this.ball.y);
      return;
    }

    // ball recycled: scrum-half (nearest support) picks up and away we go
    this.enterOpen(this.nearestOf(att, this.ball.x, this.ball.y));
  }

  private turnover(x: number, y: number) {
    this.debug.turnovers++;
    this.possession = this.opp(this.possession);
    this.phaseCount = 0;
    this.say(`Turnover — ${this.teamOf(this.possession).short} have it.`);
    this.enterOpen(this.nearestOf(this.possession, x, y), true);
  }

  // --- SCORING -------------------------------------------------------------
  private scoreTry(scorer: Player) {
    const side = scorer.side;
    this.score[side] += 5;
    const ev: ScoreEvent = {
      clock: this.clock,
      side,
      kind: "try",
      points: 5,
      text: `TRY — ${scorer.name} (${this.teamOf(side).short})`,
    };
    this.events.push(ev);
    this.say(ev.text, "try");
    this.startGoalKick(side, "conversion", scorer.y);
  }

  private takePenalty(side: Side) {
    const carrier = this.nearestOf(side, this.ball.x, this.ball.y);
    const line = attackingLine(side);
    const distToPosts = Math.abs(line - carrier.x);
    // close in, often kick to the corner and go for the try instead of 3 points
    const goForGoal = distToPosts < 38 && !(distToPosts < 22 && this.rng.chance(0.55));
    if (goForGoal) {
      this.startGoalKick(side, "penalty", carrier.y);
    } else {
      // kick to touch for territory, then carry on (stop ~5m short of the line)
      const dir = attackDir(side);
      let tx = carrier.x + dir * this.rng.range(18, 30);
      tx = dir > 0 ? Math.min(tx, line - 5) : Math.max(tx, line + 5);
      carrier.x = clamp(tx, PITCH.inGoal + 2, PITCH.inGoal + PITCH.fieldLength - 2);
      carrier.y = clamp(carrier.y, 4, PITCH.width - 4);
      this.say(`${this.teamOf(side).short} kick to touch.`);
      this.enterOpen(carrier, true);
    }
  }

  private startGoalKick(side: Side, kind: "conversion" | "penalty", y: number) {
    const kicker = this.bestKicker(side);
    const line = attackingLine(side);
    const angle = Math.abs(y - PITCH.width / 2) / (PITCH.width / 2); // 0 central .. 1 touchline
    const distFactor = kind === "conversion" ? 0.78 : 0.7;
    const p = clamp(
      distFactor + kicker.attr.kicking * 0.012 - angle * 0.35,
      0.15,
      0.97
    );
    const success = this.rng.chance(p);
    this.goalKick = { side, fromX: line - attackDir(side) * 12, fromY: y, success, points: kind === "conversion" ? 2 : 3, kind };
    this.goalTarget = { x: line + attackDir(side) * 6, y: PITCH.width / 2 };
    this.phase = kind;
    this.phaseTimer = 1.6;
    // place the ball at the kicking tee for the renderer
    this.ball.carrier = null;
    this.ball.x = this.goalKick.fromX;
    this.ball.y = y;
  }

  private tickGoalKick(dt: number) {
    this.phaseTimer -= dt;
    if (!this.goalKick) return;
    // animate the ball toward the posts
    if (this.goalTarget) {
      this.moveBallTo(this.goalTarget.x, this.goalTarget.y, 26, dt);
    }
    if (this.phaseTimer <= 0) {
      const gk = this.goalKick;
      if (gk.success) {
        this.score[gk.side] += gk.points;
        this.events.push({
          clock: this.clock,
          side: gk.side,
          kind: gk.kind,
          points: gk.points,
          text: `${gk.kind === "conversion" ? "Conversion" : "Penalty"} good (+${gk.points})`,
        });
        this.say(`${gk.kind === "conversion" ? "Conversion" : "Penalty"} is good. ${this.teamOf(gk.side).short} +${gk.points}.`, "score");
      } else {
        this.say(`${gk.kind === "conversion" ? "Conversion" : "Penalty"} drifts wide.`);
      }
      this.goalKick = null;
      this.goalTarget = null;
      if (this.clock >= this.totalTime) {
        this.finished = true;
        this.phase = "fulltime";
        this.say("Full time.", "score");
        return;
      }
      // restart: hand the ball to the side that was just scored against, so a
      // score doesn't snowball into more possession for the leaders
      this.setupKickoff(this.opp(gk.side));
    }
  }

  private moveBallTo(tx: number, ty: number, spd: number, dt: number) {
    const d = dist(this.ball.x, this.ball.y, tx, ty);
    if (d < 1e-3) return;
    const step = Math.min(d, spd * dt);
    this.ball.x += ((tx - this.ball.x) / d) * step;
    this.ball.y += ((ty - this.ball.y) / d) * step;
  }

  // --- small helpers -------------------------------------------------------
  private nearestOf(side: Side, x: number, y: number): Player {
    let best = this.side(side)[0];
    let bd = Infinity;
    for (const p of this.side(side)) {
      const d = dist(p.x, p.y, x, y);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  }
  private distToNearestOpp(p: Player): number {
    return dist(p.x, p.y, this.nearestOf(this.opp(p.side), p.x, p.y).x, this.nearestOf(this.opp(p.side), p.x, p.y).y);
  }
  private bestKicker(side: Side): Player {
    return this.side(side).reduce((a, b) => (b.attr.kicking > a.attr.kicking ? b : a));
  }
}
