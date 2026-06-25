import type { Team } from "./teams";
import type { Player } from "./types";

/**
 * Pick a sevens VII from a club's union roster: the three most mobile forwards
 * and the four quickest backs. Mutates onField and returns the chosen seven.
 */
export function sevensLineup(roster: Player[]): Player[] {
  roster.forEach((p) => (p.onField = false));
  const avail = roster.filter((p) => p.condition.injuredWeeks === 0);
  const fit = (p: Player) => p.attr.pace * 2 + p.attr.handling + p.attr.stamina * 0.6 + p.hidden.currentAbility * 0.05;
  const fwds = avail.filter((p) => p.forward).sort((a, b) => fit(b) - fit(a)).slice(0, 3);
  const backs = avail.filter((p) => !p.forward).sort((a, b) => fit(b) - fit(a)).slice(0, 4);
  const vii = [...fwds, ...backs];
  vii.forEach((p) => (p.onField = true));
  return vii;
}

export interface SevensTie {
  round: number; // 1 = quarter-final, 2 = semi, 3 = final
  slot: number;
  a: Team;
  b: Team;
  aScore: number;
  bScore: number;
  played: boolean;
}

export const ROUND_NAMES = ["", "Quarter-finals", "Semi-finals", "Final"];

/**
 * An eight-team single-elimination summer Sevens cup. Teams are seeded by
 * reputation into a standard bracket; the user plays (or sims) their ties while
 * the rest are simmed, round by round, to a champion.
 */
export class SevensCup {
  readonly teams: Team[];
  readonly userClub: Team;
  readonly ties: SevensTie[] = [];
  round = 1;
  champion: Team | null = null;

  constructor(teams8: Team[], userClub: Team) {
    this.teams = teams8;
    this.userClub = userClub;
    const seeded = [...teams8].sort((a, b) => b.reputation - a.reputation);
    // standard 8-team bracket so the top seeds can only meet late
    const pairs = [
      [0, 7], [3, 4], [2, 5], [1, 6],
    ];
    pairs.forEach(([x, y], i) =>
      this.ties.push({ round: 1, slot: i, a: seeded[x], b: seeded[y], aScore: 0, bScore: 0, played: false })
    );
  }

  roundTies(): SevensTie[] {
    return this.ties.filter((t) => t.round === this.round);
  }

  userTie(): SevensTie | undefined {
    return this.roundTies().find((t) => !t.played && (t.a === this.userClub || t.b === this.userClub));
  }

  record(tie: SevensTie, aScore: number, bScore: number) {
    tie.aScore = aScore;
    tie.bScore = bScore;
    tie.played = true;
  }

  /** Winner of a tie; a (rare) draw goes to the higher seed (reputation). */
  winnerOf(t: SevensTie): Team {
    if (t.aScore === t.bScore) return t.a.reputation >= t.b.reputation ? t.a : t.b;
    return t.aScore > t.bScore ? t.a : t.b;
  }

  roundComplete(): boolean {
    return this.roundTies().every((t) => t.played);
  }

  /** Once a round is complete, build the next round from the winners (or crown a champion). */
  advance(): void {
    if (!this.roundComplete() || this.champion) return;
    const winners = this.roundTies().map((t) => this.winnerOf(t));
    if (winners.length === 1) {
      this.champion = winners[0];
      return;
    }
    const next = this.round + 1;
    for (let i = 0; i < winners.length / 2; i++) {
      this.ties.push({
        round: next, slot: i, a: winners[i * 2], b: winners[i * 2 + 1],
        aScore: 0, bScore: 0, played: false,
      });
    }
    this.round = next;
  }

  isComplete(): boolean {
    return this.champion !== null;
  }
}

/** The eight cup entrants: the user's club plus the seven next-highest by reputation. */
export function cupEntrants(allClubs: Team[], userClub: Team, repOf: (t: Team) => number): Team[] {
  const others = allClubs
    .filter((c) => c !== userClub)
    .sort((a, b) => repOf(b) - repOf(a))
    .slice(0, 7);
  return [userClub, ...others];
}
