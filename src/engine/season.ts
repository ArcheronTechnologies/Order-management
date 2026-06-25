import type { Team } from "./teams";
import { Rng } from "./rng";

export interface Fixture {
  round: number;
  home: Team;
  away: Team;
  played: boolean;
  homeScore: number;
  awayScore: number;
  homeTries: number;
  awayTries: number;
}

export interface TableRow {
  team: Team;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  pointsFor: number;
  pointsAgainst: number;
  bonus: number;
  points: number; // league points
}

/** Standard rugby league points: 4 win, 2 draw, +1 try bonus (4+ tries), +1 losing bonus (≤7). */
function leaguePoints(row: { won: number; drawn: number; bonus: number }): number {
  return row.won * 4 + row.drawn * 2 + row.bonus;
}

/** Round-robin (circle method) producing a double round (home & away). */
function buildFixtures(clubs: Team[], rng: Rng): Fixture[] {
  const teams = [...clubs];
  if (teams.length % 2 === 1) teams.push(null as unknown as Team); // bye placeholder
  const n = teams.length;
  const rounds = n - 1;
  const half = n / 2;
  const rotation = teams.slice();
  const firstLeg: Fixture[] = [];

  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < half; i++) {
      const a = rotation[i];
      const b = rotation[n - 1 - i];
      if (a && b) {
        // alternate home/away by round for fairness
        const home = (r + i) % 2 === 0 ? a : b;
        const away = home === a ? b : a;
        firstLeg.push({ round: r + 1, home, away, played: false, homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0 });
      }
    }
    // rotate, keeping the first team fixed
    rotation.splice(1, 0, rotation.pop()!);
  }

  // second leg: same pairings, swapped venue, later rounds
  const secondLeg = firstLeg.map((f) => ({
    round: f.round + rounds,
    home: f.away,
    away: f.home,
    played: false,
    homeScore: 0,
    awayScore: 0,
    homeTries: 0,
    awayTries: 0,
  }));

  const all = [...firstLeg, ...secondLeg];
  // light shuffle within each round for variety (deterministic)
  void rng;
  return all;
}

export class Season {
  readonly clubs: Team[];
  readonly userClub: Team;
  readonly fixtures: Fixture[];
  readonly totalRounds: number;
  round = 1; // next round to play

  constructor(clubs: Team[], userClub: Team, seed: number) {
    this.clubs = clubs;
    this.userClub = userClub;
    this.fixtures = buildFixtures(clubs, new Rng(seed));
    this.totalRounds = Math.max(...this.fixtures.map((f) => f.round));
  }

  roundFixtures(r: number): Fixture[] {
    return this.fixtures.filter((f) => f.round === r);
  }

  userFixture(r: number): Fixture | undefined {
    return this.fixtures.find(
      (f) => f.round === r && (f.home === this.userClub || f.away === this.userClub)
    );
  }

  record(fixture: Fixture, homeScore: number, awayScore: number, homeTries: number, awayTries: number) {
    fixture.homeScore = homeScore;
    fixture.awayScore = awayScore;
    fixture.homeTries = homeTries;
    fixture.awayTries = awayTries;
    fixture.played = true;
  }

  table(): TableRow[] {
    const rows = new Map<Team, TableRow>();
    for (const c of this.clubs) {
      rows.set(c, { team: c, played: 0, won: 0, drawn: 0, lost: 0, pointsFor: 0, pointsAgainst: 0, bonus: 0, points: 0 });
    }
    for (const f of this.fixtures) {
      if (!f.played) continue;
      const h = rows.get(f.home)!;
      const a = rows.get(f.away)!;
      h.played++; a.played++;
      h.pointsFor += f.homeScore; h.pointsAgainst += f.awayScore;
      a.pointsFor += f.awayScore; a.pointsAgainst += f.homeScore;
      const margin = f.homeScore - f.awayScore;
      if (margin > 0) { h.won++; a.lost++; }
      else if (margin < 0) { a.won++; h.lost++; }
      else { h.drawn++; a.drawn++; }
      // bonus points
      if (f.homeTries >= 4) h.bonus++;
      if (f.awayTries >= 4) a.bonus++;
      if (margin < 0 && margin >= -7) h.bonus++;
      if (margin > 0 && margin <= 7) a.bonus++;
    }
    for (const row of rows.values()) row.points = leaguePoints(row);
    return [...rows.values()].sort(
      (x, y) =>
        y.points - x.points ||
        (y.pointsFor - y.pointsAgainst) - (x.pointsFor - x.pointsAgainst) ||
        y.pointsFor - x.pointsFor ||
        x.team.name.localeCompare(y.team.name)
    );
  }

  isComplete(): boolean {
    return this.round > this.totalRounds;
  }

  champion(): Team | null {
    return this.isComplete() ? this.table()[0].team : null;
  }
}

/**
 * Quick statistical result for AI-vs-AI fixtures (instant, deterministic per
 * seed) — calibrated to the match engine's feel (~25-35 pts, a few tries each),
 * with a home edge and strength-driven expected scores.
 */
export function quickSim(home: Team, away: Team, rng: Rng): { hs: number; as: number; ht: number; at: number } {
  const side = (strength: number, homeAdv: number) => {
    const s = strength + homeAdv + rng.range(-3.5, 3.5);
    const tries = Math.max(0, Math.round((s - 7) / 3 + rng.range(-1, 1.6)));
    const cons = Math.round(tries * rng.range(0.4, 0.85));
    const pens = rng.int(0, 4);
    return { tries, score: tries * 5 + cons * 2 + pens * 3 };
  };
  const h = side(home.rating, 1.5);
  const a = side(away.rating, 0);
  return { hs: h.score, as: a.score, ht: h.tries, at: a.tries };
}
