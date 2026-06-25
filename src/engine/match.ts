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
import { DEFAULT_TACTICS, lerpSlider, type TeamTactics } from "./tactics";
import type { Ball, Phase, Player, ScoreEvent, Side } from "./types";

const TACKLE_RADIUS = 1.3; // m
const PASS_SPEED = 13; // m/s
const KICK_SPEED = 24; // m/s
const DEF_LINE_GAP = 6; // m the defensive line sets up ahead of the ball (neutral)
const REDZONE = 22; // m from the line (the 22) where pressure tells

export interface MatchOptions {
  homeTactics?: TeamTactics;
  awayTactics?: TeamTactics;
}

/** the shape of attack chosen for a phase. */
type Play = "pick" | "pod" | "wide" | "kick";

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
  /** full matchday squads incl. bench, for substitutions. */
  squads: Record<Side, Player[]> = { home: [], away: [] };
  tactics: Record<Side, TeamTactics>;
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
  debug = { rucks: 0, breaks: 0, gateContacts: 0, cleanBreaks: 0, endpoint: 0, kicks: 0, turnovers: 0, phases: 0, tryRun: 0, tryDive: 0, tryPush: 0, tryMaul: 0 };

  private phaseTimer = 0; // counts down restarts/rucks/goal kicks
  private decisionTimer = 0;
  private phaseCount = 0; // phases within current possession
  private openAnchorX = HALFWAY; // where the current phase started (sets the def line)
  private openAnchorY = PITCH.width / 2; // ball's y at the breakdown
  private openSign = 1; // +1 attack toward larger y, -1 toward smaller y (the open side)
  private play: Play = "wide"; // the chosen play for this phase
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
  /** active scrum/lineout (for rendering & resolution). */
  setPiece: { kind: "scrum" | "lineout"; putIn: Side; x: number; y: number } | null = null;

  constructor(
    seed: number,
    formatId: FormatId,
    home: Team,
    away: Team,
    opts: MatchOptions = {}
  ) {
    this.rng = new Rng(seed);
    this.fmt = FORMATS[formatId];
    this.home = home;
    this.away = away;
    this.tactics = {
      home: opts.homeTactics ?? { ...DEFAULT_TACTICS },
      away: opts.awayTactics ?? { ...DEFAULT_TACTICS },
    };
    this.squads = {
      home: buildSquad(this.rng, home, "home", this.fmt),
      away: buildSquad(this.rng, away, "away", this.fmt),
    };
    // only the starting XV/VII take the field; the bench waits for subs
    this.players = [...this.squads.home, ...this.squads.away].filter((p) => p.onField);
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

  // --- tactics helpers -----------------------------------------------------
  /** how far ahead the defence (opponents of `att`) sets its line. */
  private defGap(att: Side): number {
    // hard rush → smaller gap (up fast & close); passive → sit back deeper.
    // A tight gain line keeps territorial gains realistic (a few metres a phase).
    return lerpSlider(this.tactics[this.opp(att)].defensiveLineSpeed, 6, 3);
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
      burst = p.id === this.breakawayId ? 1.18 : p.side !== this.possession ? 1.14 : 1;
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
  private setupKickoff(receiving: Side) {
    const kicking = this.opp(receiving);
    this.possession = receiving;
    this.phaseCount = 0;
    this.beaten.clear();
    const onPitch = (x: number) => clamp(x, PITCH.inGoal, PITCH.inGoal + PITCH.fieldLength);
    const spreadY = (i: number, n: number, lo = 6, hi = PITCH.width - 6) =>
      clamp(lo + (n > 1 ? (i / (n - 1)) * (hi - lo) : (hi - lo) / 2), 3, PITCH.width - 3);

    // Kicking team: a chase line across the field just behind halfway, in a
    // shallow arc (middle a touch forward), ready to sprint after the ball.
    const kdir = attackDir(kicking);
    const kf = this.side(kicking);
    kf.forEach((p, i) => {
      const frac = kf.length > 1 ? i / (kf.length - 1) : 0.5;
      const arc = 1 - Math.abs(frac - 0.5) * 2; // 1 in the middle, 0 at the wings
      p.x = onPitch(HALFWAY - kdir * (2 - arc * 1.5));
      p.y = spreadY(i, kf.length, 4, PITCH.width - 4);
    });

    // Receiving team: real depth — forwards in a catch line, backs deeper, the
    // fullback deepest and central (a receiving shape, not a column).
    const rdir = attackDir(receiving);
    const rfwd = this.side(receiving).filter((p) => p.forward);
    const rbacks = this.side(receiving).filter((p) => !p.forward);
    const fb = this.byRole(receiving, "FB");
    rfwd.forEach((p, i) => {
      p.x = onPitch(HALFWAY - rdir * this.rng.range(18, 24));
      p.y = spreadY(i, rfwd.length, 12, PITCH.width - 12);
    });
    rbacks.forEach((p, i) => {
      if (p === fb) return;
      p.x = onPitch(HALFWAY - rdir * (30 + (i % 2) * 6));
      p.y = spreadY(i, Math.max(1, rbacks.length - 1), 8, PITCH.width - 8);
    });
    if (fb) {
      fb.x = onPitch(HALFWAY - rdir * 44);
      fb.y = PITCH.width / 2;
    }

    // launch the ball as a contestable kick toward the receivers
    this.ball.carrier = null;
    this.ball.x = HALFWAY;
    this.ball.y = PITCH.width / 2 + this.rng.range(-15, 15);
    const targetX = HALFWAY + kdir * this.rng.range(22, 32);
    const targetY = clamp(this.ball.y + this.rng.range(-12, 12), 6, PITCH.width - 6);
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
      case "scrum":
      case "lineout":
        this.tickSetPiece(dt);
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
    // A kick is contested by the nearest man of each side; the kicking side
    // sweeps up after it as a chase LINE (advancing, holding their lane) while
    // the catching side mostly holds depth — so it reads like a kick chase, not
    // 30 players collapsing onto a point.
    const kickingSide = this.ball.thrownBy ? this.ball.thrownBy.side : this.opp(this.possession);
    const catchingSide = this.opp(kickingSide);
    const catcher = this.nearestOf(catchingSide, this.ball.x, this.ball.y);
    const chaser = this.nearestOf(kickingSide, this.ball.x, this.ball.y);
    for (const p of this.players) {
      if (p === catcher || p === chaser) {
        this.moveToward(p, this.ball.x, this.ball.y, this.speed(p), dt);
      } else if (p.side === kickingSide) {
        // advance after the kick as a line, holding width
        this.moveToward(p, this.ball.x, p.y, this.speed(p) * 0.82, dt);
      }
      // catching side (besides the catcher) holds its receiving shape
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
      } else if (this.rng.chance(0.09 + (12 - best.attr.handling) * 0.012)) {
        this.say(`Knock-on by ${best.name}.`);
        this.startScrum(this.opp(this.possession), best.x, best.y);
        return;
      }
    }
    // A pass completed within the same team keeps the phase's shape & play (the
    // ball sweeps across the line). A kick or a change of hands starts afresh.
    const samePhasePass = !this.ball.kicked && best.side === prevPossession;
    const reset = this.ball.kicked || best.side !== prevPossession;
    this.enterOpen(best, reset, samePhasePass ? this.play : undefined, samePhasePass);
  }

  /**
   * Hand the ball to a carrier and start a phase of open play. `keepAnchor` keeps
   * the breakdown anchor and called play fixed — used when the ball is passed
   * along the line within the same phase, so the formation holds and the ball
   * sweeps across it rather than re-forming on each receiver.
   */
  private enterOpen(carrier: Player, resetDefence = false, play?: Play, keepAnchor = false) {
    this.ball.carrier = carrier;
    this.ball.x = carrier.x;
    this.ball.y = carrier.y;
    if (!keepAnchor) {
      this.openAnchorX = carrier.x; // anchors the defensive line for this phase
      this.openAnchorY = carrier.y;
      // attack the more open side of the field (more room to the touch)
      this.openSign = carrier.y < PITCH.width / 2 ? 1 : -1;
      this.play = play ?? this.choosePlay(carrier.side);
    }
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

  private byRole(side: Side, short: string): Player | undefined {
    return this.side(side).find((p) => p.position.short === short);
  }

  /** pick the phase's play from tactics, field position and phase count. */
  private choosePlay(att: Side): Play {
    const tac = this.tactics[att];
    const distToLine = Math.abs(attackingLine(att) - this.openAnchorX);
    let pick = lerpSlider(tac.ruckCommitment, 0.4, 1.7);
    let pod = 1.2;
    let wide = lerpSlider(tac.attackingWidth, 0.4, 2.1);
    // kicking is comparatively rare — mostly an exit from deep in your own half
    let kick = lerpSlider(tac.kickingTendency, 0.03, 0.6) * (distToLine > 60 ? 1.6 : 0.25);
    if (distToLine < 12) {
      // near the line: hammer it up, less width, rarely kick
      pick *= 1.9; pod *= 1.3; wide *= 0.6; kick *= 0.1;
    } else if (distToLine > 75) {
      // deep in own half: more inclined to kick or keep it tight
      kick *= 1.6; wide *= 0.7;
    }
    if (this.phaseCount > 6) { pick *= 1.3; kick *= 1.2; } // tiring — simplify
    const total = pick + pod + wide + kick;
    let r = this.rng.next() * total;
    if ((r -= pick) < 0) return "pick";
    if ((r -= pod) < 0) return "pod";
    if ((r -= wide) < 0) return "wide";
    return "kick";
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
    const gap = this.defGap(att);
    const lineX = this.defLineX(att, anchorX, gap);
    const list = this.side(def).slice().sort((a, b) => a.y - b.y);
    const cover = list.pop()!; // one back as the sweeper
    const spacing = 4.2;
    const span = (list.length - 1) * spacing;
    const startY = clamp(ballY - span / 2, 2, PITCH.width - 2 - span);
    list.forEach((p, i) => {
      p.x = lineX;
      p.y = clamp(startY + i * spacing, 2, PITCH.width - 2);
    });
    cover.x = this.defLineX(att, anchorX, gap + 16);
    cover.y = ballY;
  }

  /**
   * Position the defending side like a real rugby line: two pillars guarding the
   * ruck, a connected line fanning out across the open side (drifting to stay
   * connected to the ball), and a two-man backfield (fullback + wing) dropped
   * deep to cover the kick. When the line is broken everyone scrambles.
   */
  private positionDefence(
    att: Side,
    focusX: number,
    focusY: number,
    lineX: number,
    gap: number,
    brokenThrough: boolean,
    exclude: Set<number>,
    dt: number
  ) {
    const def = this.opp(att);
    const defenders = this.side(def).filter((p) => !this.beaten.has(p.id) && !exclude.has(p.id));
    if (brokenThrough) {
      for (const p of defenders) this.moveToward(p, focusX, focusY, this.speed(p), dt);
      return;
    }
    const ay = this.openAnchorY;
    const os = this.openSign;
    const ruckDist = (p: Player) => Math.hypot(p.x - this.openAnchorX, p.y - ay);
    const sorted = [...defenders].sort((a, b) => ruckDist(a) - ruckDist(b));
    const pillars = sorted.slice(0, 2);
    // backfield: prefer the recognised back three, else the deepest spare men
    let backfield = defenders.filter(
      (p) => !pillars.includes(p) &&
        (p.position.short === "FB" || p.position.short === "LW" || p.position.short === "RW" || p.position.short === "WG")
    ).slice(0, 2);
    if (backfield.length < 2) {
      for (const p of [...sorted].reverse()) {
        if (backfield.length >= 2) break;
        if (!pillars.includes(p) && !backfield.includes(p)) backfield.push(p);
      }
    }
    const inLine = defenders.filter((p) => !pillars.includes(p) && !backfield.includes(p));

    // pillars sit right on the gain line either side of the ruck
    const pillarX = this.defLineX(att, this.openAnchorX, Math.min(gap, 3.5));
    pillars.forEach((p, i) =>
      this.moveToward(p, pillarX, clamp(ay + (i === 0 ? -2.6 : 2.6), 3, PITCH.width - 3), this.speed(p), dt)
    );
    // backfield drops deep on the open side to field kicks
    const deepX = this.defLineX(att, this.openAnchorX, gap + 20);
    backfield.forEach((p, i) =>
      this.moveToward(p, deepX, clamp(ay + os * (10 + i * 16), 6, PITCH.width - 6), this.speed(p) * 0.9, dt)
    );
    // front line fans from just open of the ruck out across the open side, and
    // always reaches the carrier's channel so it stays connected to the ball
    const fromY = clamp(ay + os * 4, 3, PITCH.width - 3);
    const edgeY = os > 0 ? PITCH.width - 4 : 4;
    const farY = os > 0 ? Math.max(edgeY, focusY + 2) : Math.min(edgeY, focusY - 2);
    // the two line defenders nearest the ball mark its channel directly (so the
    // ball-carrier always meets a tackler); the rest hold the fanned line
    const markers = [...inLine]
      .sort((a, b) => Math.abs(a.y - focusY) - Math.abs(b.y - focusY))
      .slice(0, 2);
    inLine.sort((a, b) => (a.y - b.y) * os);
    const n = inLine.length;
    inLine.forEach((p, i) => {
      let ty: number;
      const m = markers.indexOf(p);
      if (m >= 0) {
        ty = focusY + (m === 0 ? 0 : focusY < ay ? 2 : -2);
      } else {
        const f = n > 1 ? i / (n - 1) : 0;
        ty = fromY + (farY - fromY) * f;
      }
      this.moveToward(p, lineX, clamp(ty, 3, PITCH.width - 3), this.speed(p), dt);
    });
  }

  /**
   * Position the attacking side in real rugby shape: scrum-half at the base,
   * fly-half at first-receiver depth, the rest of the backs strung in a DIAGONAL
   * backline that fans out to the open touchline (wider = deeper), and the
   * forwards in tight PODS near the gain line as carry/clear-out options.
   */
  private positionAttack(att: Side, dir: number, exclude: Set<number>, dt: number) {
    const ax = this.openAnchorX;
    const ay = this.openAnchorY;
    const os = this.openSign;
    const onX = (x: number) => clamp(x, PITCH.inGoal, PITCH.inGoal + PITCH.fieldLength);
    const onY = (y: number) => clamp(y, 3, PITCH.width - 3);
    const sh = this.byRole(att, "SH");
    const fh = this.byRole(att, "FH");
    const mates = this.side(att).filter((p) => !exclude.has(p.id));

    // Forwards form tight pods: the first pod just to the open side of the ruck
    // at the gain line (carry option), a second pod a bit wider, any spare on
    // the blindside. Within a pod players bind close and stagger a touch back.
    const fwds = mates.filter((p) => p.forward);
    fwds.forEach((p, i) => {
      const pod = Math.floor(i / 3);
      const inPod = i % 3;
      const podY = ay + os * (5 + pod * 13 + inPod * 2.3);
      const podX = ax - dir * (1 + inPod * 0.9 + pod * 0.5);
      this.moveToward(p, onX(podX), onY(podY), this.speed(p) * 0.8, dt);
    });

    // half-backs: 9 at the base, 10 at first-receiver depth a few metres open
    if (sh && !exclude.has(sh.id)) this.moveToward(sh, onX(ax - dir * 2), onY(ay), this.speed(sh) * 0.9, dt);
    if (fh && !exclude.has(fh.id)) this.moveToward(fh, onX(ax - dir * 9), onY(ay + os * 7), this.speed(fh) * 0.85, dt);

    // backline: a diagonal stretching from just outside 10 to the open touch,
    // each man wider and a touch deeper than the last so they run onto the ball
    const backs = mates
      .filter((p) => !p.forward && p !== sh && p !== fh)
      .sort((a, b) => a.position.number - b.position.number);
    const startY = ay + os * 15;
    const endY = os > 0 ? PITCH.width - 6 : 6;
    const n = backs.length;
    backs.forEach((p, i) => {
      const f = n > 1 ? i / (n - 1) : 0;
      const ty = startY + (endY - startY) * f;
      const depth = 10 + f * 6; // wider channels stand deeper (the diagonal)
      this.moveToward(p, onX(ax - dir * depth), onY(ty), this.speed(p) * 0.8, dt);
    });
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

    // Defensive line is anchored at the gain line; the attack is set in shape.
    const defList = this.side(def);
    const gap = this.defGap(att);
    const lineX = this.defLineX(att, this.openAnchorX, gap);
    const brokenThrough = (carrier.x - lineX) * dir > 1;
    const exCarrier = new Set([carrier.id]);
    this.positionDefence(att, carrier.x, carrier.y, lineX, gap, brokenThrough, new Set(), dt);
    this.positionAttack(att, dir, exCarrier, dt);

    // advance the carrier — straight at the line for a forward carry, or drifting
    // across toward the open side to draw defenders on a wide play
    const prevX = carrier.x;
    const target = this.runTarget(carrier, def, dir, line);
    const carrySpeed = this.speed(carrier) * (this.play === "wide" ? 0.78 : 0.85);
    this.moveToward(carrier, target.x, target.y, carrySpeed, dt);
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
      this.debug.tryRun++;
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
    // Run at the line, steering toward the channel with the most space. A wide
    // play drifts toward the open side to draw defenders and find the edge; a
    // tight carry (pick/pod) runs straighter at the man in front.
    const ahead = this.side(def).filter((p) => (p.x - carrier.x) * dir > -3);
    const os = this.openSign;
    const w = lerpSlider(this.tactics[carrier.side].attackingWidth, 5, 9);
    const offsets = this.play === "wide" ? [0, os * w * 0.6, os * w] : [-w * 0.5, 0, w * 0.5];
    let bestY = carrier.y;
    let bestGap = -1;
    for (const off of offsets) {
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

  /** the next attacker out toward the open side (for passing along the line). */
  private nextReceiver(carrier: Player, att: Side, dir: number): Player | null {
    const os = this.openSign;
    let best: Player | null = null;
    let bestScore = Infinity;
    for (const p of this.side(att)) {
      if (p === carrier) continue;
      const behind = (carrier.x - p.x) * dir; // >=0 means level or behind (legal)
      if (behind < -1.5) continue; // can't pass forward
      const outboard = (p.y - carrier.y) * os; // wider toward the open side
      if (outboard <= 0.5) continue; // must be further out
      // prefer the nearest man just outside (a realistic short pass along the line)
      const score = outboard + Math.abs(behind) * 0.5;
      if (score < bestScore) {
        bestScore = score;
        best = p;
      }
    }
    return best;
  }

  private decide(carrier: Player, att: Side, def: Side, dir: number, line: number) {
    const distToLine = Math.abs(line - carrier.x);
    const nearestDef = this.nearestOf(def, carrier.x, carrier.y);
    const pressure = dist(nearestDef.x, nearestDef.y, carrier.x, carrier.y);

    // a phase called as a kick: box-kick / territorial kick once there's room
    if (this.play === "kick" && distToLine > 35 && this.rng.chance(0.5 + carrier.attr.kicking * 0.01)) {
      const tx = clamp(carrier.x + dir * this.rng.range(28, 44), PITCH.inGoal + 2, PITCH.inGoal + PITCH.fieldLength - 2);
      const ty = clamp(carrier.y + this.rng.range(-12, 12), 4, PITCH.width - 4);
      this.launchBall(tx, ty, KICK_SPEED, true, carrier);
      this.phase = "flight";
      this.debug.kicks++;
      this.say(`${carrier.name} kicks for territory.`);
      return;
    }

    // On a wide play the inside men (9, 10, 12) move the ball on early — they
    // draw their man and pass, so the ball sweeps through the hands across the
    // backline before the outside backs attack the space.
    const insideBack = carrier.position.short === "SH" || carrier.position.short === "FH" || carrier.position.short === "IC";
    if (this.play === "wide" && insideBack && this.rng.chance(0.85)) {
      const out = this.nextReceiver(carrier, att, dir);
      if (out) {
        if (this.rng.chance(clamp(0.04 + (12 - carrier.attr.handling) * 0.005, 0.02, 0.1))) {
          this.say(`Forward pass, ${this.teamOf(att).short}. Scrum.`);
          this.startScrum(def, carrier.x, carrier.y);
          return;
        }
        this.launchBall(out.x, out.y, PASS_SPEED, false, carrier);
        this.phase = "flight";
        return;
      }
    }

    // pass along the line. Wide plays move the ball through the hands readily;
    // tight plays mostly keep it with the forwards.
    const passReady =
      this.play === "wide"
        ? 0.45
        : this.play === "pod"
          ? 0.2
          : 0.08; // pick-and-go rarely passes
    if (pressure < 5.5 && this.rng.chance(passReady + carrier.attr.handling * 0.015)) {
      const receiver = this.nextReceiver(carrier, att, dir) ?? this.bestSupport(carrier, att, dir);
      if (receiver) {
        // forward pass — a handling error, called back for a scrum the other way
        const forwardPassP = clamp(0.05 + (12 - carrier.attr.handling) * 0.006, 0.02, 0.13);
        if (this.rng.chance(forwardPassP)) {
          this.say(`Forward pass, ${this.teamOf(att).short}. Scrum.`);
          this.startScrum(def, carrier.x, carrier.y);
          return;
        }
        // overlap: a pass into clear space in the opponent half can spring a break
        const space = this.distToNearestOpp(receiver);
        const inOppHalf = (line - receiver.x) * dir < PITCH.fieldLength / 2;
        if (space > 14 && inOppHalf && this.rng.chance(0.1)) {
          this.breakawayId = receiver.id;
          this.breakawayTimer = 1.8;
        }
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
    const pressure = nearLine ? Math.min(this.phaseCount, 12) * 0.006 : 0;
    // an aggressive defensive side makes its tackles stick (harder to break)
    const aggression = (this.tactics[tackler.side].defensiveAggression - 50) / 50;
    const breakP = clamp(
      0.06 +
        (carrier.attr.strength - tackler.attr.tackling) / 65 +
        (carrier.attr.pace - 10) / 95 +
        pressure -
        aggression * 0.04,
      0.02,
      0.34
    );
    if (this.rng.chance(breakP)) {
      this.debug.breaks++;
      const dir = attackDir(carrier.side);
      // right on the line, a beaten defender means he dives over for the try
      if (distToLine < 2.5) {
        this.debug.tryDive++;
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
    // tackle complete -> ruck. High tempo recycles quicker.
    this.debug.rucks++;
    this.phase = "ruck";
    const tempoFactor = lerpSlider(this.tactics[carrier.side].tempo, 1.35, 0.6);
    this.phaseTimer = this.rng.range(1.4, 3.0) * tempoFactor;
    this.ball.x = carrier.x;
    this.ball.y = carrier.y;
    this.ball.carrier = null;
    // anchor the NEXT phase's shape on the breakdown and call the next play, so
    // both teams can form up during the ruck
    this.openAnchorX = carrier.x;
    this.openAnchorY = carrier.y;
    this.openSign = carrier.y < PITCH.width / 2 ? 1 : -1;
    this.play = this.choosePlay(carrier.side);
  }

  private tickRuck(dt: number) {
    this.phaseTimer -= dt;
    const att = this.possession;
    const def = this.opp(att);
    const dir = attackDir(att);
    const rx = this.ball.x;
    const ry = this.ball.y;
    const commit = this.fmt.id === "sevens" ? 1 : 2;

    // A couple of forwards from each side commit to the breakdown; everyone else
    // pre-forms the NEXT phase's shape during the ~2s ruck, so when the ball
    // comes out the teams are already set (attack in pods + a backline, defence
    // in a fanned line with pillars and a backfield).
    const committed = new Set<number>();
    for (const side of [att, def] as Side[]) {
      const fwds = this.side(side)
        .filter((p) => p.forward)
        .map((p) => ({ p, d: dist(p.x, p.y, rx, ry) }))
        .sort((a, b) => a.d - b.d);
      fwds.slice(0, commit).forEach(({ p }) => {
        committed.add(p.id);
        this.moveToward(p, rx, ry, this.speed(p), dt);
      });
    }
    // shape the rest into formation around the ruck (anchored at the breakdown)
    const lineX = this.defLineX(att, rx, this.defGap(att));
    this.positionDefence(att, rx, ry, lineX, this.defGap(att), false, committed, dt);
    this.positionAttack(att, dir, committed, dt);
    for (const p of this.players) if (!committed.has(p.id)) this.rest(p, dt * 0.5);

    if (this.phaseTimer <= 0) this.resolveRuck();
  }

  private resolveRuck() {
    const att = this.possession;
    const def = this.opp(att);
    this.phaseCount++;

    // The defending side's aggression wins more turnovers but concedes more
    // penalties; the attacking side's ruck commitment protects its own ball.
    const defAgg = (this.tactics[def].defensiveAggression - 50) / 50;
    const attCommit = (this.tactics[att].ruckCommitment - 50) / 50;

    // penalty? (aggressive jackal sides give away more at the breakdown) — kept
    // low so the game isn't a penalty-goal shoot-out
    if (this.rng.chance(clamp(0.012 + defAgg * 0.01, 0.004, 0.04))) {
      // offending side: random, but more likely the defenders
      const offender = this.rng.chance(0.6) ? def : att;
      const winner = this.opp(offender);
      this.possession = winner;
      this.say(`Penalty to ${this.teamOf(winner).short}.`);
      this.takePenalty(winner);
      return;
    }

    // turnover chance grows as a side hangs onto the ball over many phases;
    // committing more to rucks lowers it, an aggressive jackal raises it.
    // Amateur rugby is error-strewn, so the breakdown is a real lottery.
    const turnoverP = clamp(
      0.06 + (this.phaseCount - 4) * 0.012 + defAgg * 0.03 - attCommit * 0.03,
      0.03,
      0.26
    );
    if (this.rng.chance(turnoverP)) {
      this.turnover(this.ball.x, this.ball.y);
      return;
    }

    // ball recycled: with the play already called at the breakdown, the right
    // man carries it — a forward off the base for a pick/pod, the scrum-half to
    // launch a wide play or a kick. Everyone is already in shape.
    const play = this.play;
    let carrier: Player;
    if (play === "pick" || play === "pod") {
      const fwds = this.side(att).filter((p) => p.forward);
      carrier = fwds.length
        ? fwds.reduce((a, b) => (dist(b.x, b.y, this.ball.x, this.ball.y) < dist(a.x, a.y, this.ball.x, this.ball.y) ? b : a))
        : this.nearestOf(att, this.ball.x, this.ball.y);
    } else {
      carrier = this.byRole(att, "SH") ?? this.nearestOf(att, this.ball.x, this.ball.y);
    }
    this.enterOpen(carrier, false, play);
  }

  private turnover(x: number, y: number) {
    this.debug.turnovers++;
    this.possession = this.opp(this.possession);
    this.phaseCount = 0;
    this.say(`Turnover — ${this.teamOf(this.possession).short} have it.`);
    this.enterOpen(this.nearestOf(this.possession, x, y), true);
  }

  // --- SET PIECES (scrum & lineout) ----------------------------------------
  /** sum of a pack's forward set-piece grunt. */
  private packPower(side: Side, attr: "scrummaging" | "lineoutJump"): number {
    const fwds = this.side(side).filter((p) => p.forward);
    const total = fwds.reduce((s, p) => s + p.attr[attr] + p.attr.strength * 0.4, 0);
    return total / Math.max(1, fwds.length);
  }
  private hookerThrow(side: Side): number {
    const fwds = this.side(side).filter((p) => p.forward);
    return fwds.reduce((b, p) => Math.max(b, p.attr.throwing), 0);
  }

  private startScrum(putIn: Side, x: number, y: number) {
    this.possession = putIn;
    this.phaseCount = 0;
    this.setPiece = {
      kind: "scrum",
      putIn,
      x: clamp(x, PITCH.inGoal + 3, PITCH.inGoal + PITCH.fieldLength - 3),
      y: clamp(y, 10, PITCH.width - 10),
    };
    this.positionSetPiece();
    this.phase = "scrum";
    this.phaseTimer = this.rng.range(2.2, 3.6);
    this.say(`Scrum to ${this.teamOf(putIn).short}.`);
  }

  private startLineout(throwIn: Side, x: number, y: number) {
    this.possession = throwIn;
    this.phaseCount = 0;
    // lineouts are taken near the touchline the ball went out on
    const lineY = y < PITCH.width / 2 ? 6 : PITCH.width - 6;
    this.setPiece = {
      kind: "lineout",
      putIn: throwIn,
      x: clamp(x, PITCH.inGoal + 3, PITCH.inGoal + PITCH.fieldLength - 3),
      y: lineY,
    };
    this.positionSetPiece();
    this.phase = "lineout";
    this.phaseTimer = this.rng.range(2.0, 3.2);
    this.say(`Lineout to ${this.teamOf(throwIn).short}.`);
  }

  /** arrange forwards at the mark and backs behind each side for the renderer. */
  private positionSetPiece() {
    const sp = this.setPiece!;
    for (const side of ["home", "away"] as Side[]) {
      const sdir = attackDir(side);
      const fwds = this.side(side).filter((p) => p.forward);
      const backs = this.side(side).filter((p) => !p.forward);
      fwds.forEach((p, i) => {
        if (sp.kind === "scrum") {
          // two packs bound at the mark, each just on their own side
          p.x = clamp(sp.x - sdir * (1.2 + Math.floor(i / 3) * 1.2), PITCH.inGoal, PITCH.inGoal + PITCH.fieldLength);
          p.y = clamp(sp.y - 4 + (i % 3) * 4, 4, PITCH.width - 4);
        } else {
          // lineout: a line of forwards running in from the touch line
          const along = side === sp.putIn ? 1 : -1;
          p.x = clamp(sp.x + sdir * 0, PITCH.inGoal, PITCH.inGoal + PITCH.fieldLength);
          const toward = sp.y < PITCH.width / 2 ? 1 : -1;
          p.y = clamp(sp.y + toward * (3 + i * 2) + (along < 0 ? 1.5 : 0), 3, PITCH.width - 3);
        }
      });
      // backs spread in a line behind their own side
      backs.forEach((p, i) => {
        p.x = clamp(sp.x - sdir * (8 + i * 2), PITCH.inGoal, PITCH.inGoal + PITCH.fieldLength);
        p.y = clamp(((i + 1) / (backs.length + 1)) * PITCH.width, 4, PITCH.width - 4);
      });
    }
    this.ball.carrier = null;
    this.ball.x = sp.x;
    this.ball.y = sp.y;
  }

  private tickSetPiece(dt: number) {
    this.phaseTimer -= dt;
    if (this.phaseTimer <= 0) {
      if (this.setPiece!.kind === "scrum") this.resolveScrum();
      else this.resolveLineout();
    }
  }

  private resolveScrum() {
    const sp = this.setPiece!;
    const putIn = sp.putIn;
    const def = this.opp(putIn);
    const edge = this.packPower(putIn, "scrummaging") - this.packPower(def, "scrummaging");
    // put-in side strongly favoured; a dominant pack can win against the head
    const winP = clamp(0.8 + edge / 70, 0.55, 0.96);
    let winner = putIn;
    if (!this.rng.chance(winP)) {
      winner = def;
      this.say(`Against the head! ${this.teamOf(def).short} win the scrum.`);
    }
    // a dominant put-in pack right on the line can shove over for a try
    const line = attackingLine(putIn);
    if (winner === putIn && Math.abs(line - sp.x) < 6 && edge > 8 && this.rng.chance(0.35)) {
      const n8 = this.nearestOf(putIn, sp.x, sp.y);
      this.say(`Pushover try! ${this.teamOf(putIn).short} drive it over.`);
      this.debug.tryPush++;
      n8.x = line + attackDir(putIn) * 0.5;
      n8.y = sp.y;
      this.setPiece = null;
      this.scoreTry(n8);
      return;
    }
    this.setPiece = null;
    this.enterOpen(this.nearestOf(winner, sp.x, sp.y), true);
  }

  private resolveLineout() {
    const sp = this.setPiece!;
    const throwIn = sp.putIn;
    const def = this.opp(throwIn);
    const edge =
      this.packPower(throwIn, "lineoutJump") - this.packPower(def, "lineoutJump") +
      (this.hookerThrow(throwIn) - 10) * 0.5;
    const winP = clamp(0.82 + edge / 70, 0.5, 0.96);
    let winner = throwIn;
    if (!this.rng.chance(winP)) {
      winner = def;
      this.say(`Stolen! ${this.teamOf(def).short} pinch the lineout.`);
    }
    this.setPiece = null;
    if (winner !== throwIn) {
      this.enterOpen(this.nearestOf(winner, sp.x, sp.y), true);
      return;
    }
    // won their own ball: drive a maul (power) or use it off the top (speed)
    const focus = this.tactics[throwIn].setPieceFocus;
    const line = attackingLine(throwIn);
    const dir = attackDir(throwIn);
    if (this.rng.chance(lerpSlider(focus, 0.15, 0.7))) {
      // catch-and-drive maul: gain ground toward the line
      const drive = lerpSlider(focus, 3, 12) + Math.max(0, edge) * 0.3;
      const mx = clamp(sp.x + dir * drive, PITCH.inGoal + 1, line);
      // a powerful maul near the line can occasionally rumble over
      if (Math.abs(line - mx) < 2.5 && edge > 2 && this.rng.chance(0.13)) {
        const scorer = this.nearestOf(throwIn, sp.x, sp.y);
        this.say(`Driving maul... and they get it down! ${this.teamOf(throwIn).short}.`);
        this.debug.tryMaul++;
        scorer.x = line + dir * 0.5;
        scorer.y = sp.y;
        this.scoreTry(scorer);
        return;
      }
      this.say(`${this.teamOf(throwIn).short} set the maul and drive.`);
      const carrier = this.nearestOf(throwIn, sp.x, sp.y);
      carrier.x = mx;
      carrier.y = sp.y;
      this.enterOpen(carrier, true);
      return;
    }
    this.enterOpen(this.nearestOf(throwIn, sp.x, sp.y), true);
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
      // kick to touch for territory — gains ground and the throw at the lineout
      const dir = attackDir(side);
      let tx = carrier.x + dir * this.rng.range(20, 34);
      tx = dir > 0 ? Math.min(tx, line - 5) : Math.max(tx, line + 5);
      this.say(`${this.teamOf(side).short} kick to the corner.`);
      this.startLineout(side, tx, carrier.y);
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
