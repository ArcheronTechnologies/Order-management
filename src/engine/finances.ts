import type { Team } from "./teams";
import { squadSize } from "./teams";
import { distanceKm } from "../data/geo";

/**
 * A season's club finances. Amateur-true at the bottom (membership fees & a bar
 * keep the lights on, travel bites); semi-pro nearer the top (Allsvenskan
 * sponsorship & gate money matter). All figures in kr.
 */
export interface FinanceBreakdown {
  income: { membership: number; sponsorship: number; matchday: number };
  costs: { upkeep: number; kit: number; travel: number };
  incomeTotal: number;
  costTotal: number;
  net: number;
}

const MEMBER_FEE = 1500; // per registered player, per year
const SPONSOR_PER_REP = 1100; // × reputation × tier multiplier
const GATE_PER_REP = 110; // × reputation, per home match
const UPKEEP_PER_FACILITY = 30000; // clubhouse / pitches / floodlights
const KIT_INSURANCE = 45000; // flat annual
const TRAVEL_PER_KM = 28; // coach + expenses, per km, per away trip

function tierMultiplier(tier: "allsvenskan" | "div1"): number {
  return tier === "allsvenskan" ? 1.8 : 1.0;
}

/**
 * Project/settle a season's finances for `club`: membership from squad size,
 * reputation-driven sponsorship & gate, against facilities upkeep, kit, and the
 * real travel bill summed over the away fixtures.
 */
export function computeFinances(
  club: Team,
  reputation: number,
  tier: "allsvenskan" | "div1",
  homeMatches: number,
  awayOpponents: Team[]
): FinanceBreakdown {
  const membership = squadSize(reputation) * MEMBER_FEE;
  const sponsorship = Math.round(reputation * tierMultiplier(tier) * SPONSOR_PER_REP);
  const matchday = Math.round(homeMatches * reputation * GATE_PER_REP);
  const upkeep = club.facilities * UPKEEP_PER_FACILITY;
  const kit = KIT_INSURANCE;
  const travel = awayOpponents.reduce(
    (s, opp) => s + Math.round(distanceKm(club.city, opp.city) * TRAVEL_PER_KM),
    0
  );
  const incomeTotal = membership + sponsorship + matchday;
  const costTotal = upkeep + kit + travel;
  return {
    income: { membership, sponsorship, matchday },
    costs: { upkeep, kit, travel },
    incomeTotal,
    costTotal,
    net: incomeTotal - costTotal,
  };
}

/** Committee mood from the bank balance and last finishing position (1 = top). */
export function committeeMood(balance: number, finishPos: number, divisionSize: number): { score: number; label: string } {
  let score = 55;
  score += balance >= 0 ? Math.min(20, balance / 15000) : Math.max(-35, balance / 8000);
  score += (divisionSize - finishPos) * 4 - divisionSize * 1.5; // mid-table ≈ neutral
  score = Math.max(0, Math.min(100, Math.round(score)));
  const label =
    score >= 80 ? "Delighted" :
    score >= 60 ? "Pleased" :
    score >= 40 ? "Content" :
    score >= 22 ? "Concerned" : "Restless";
  return { score, label };
}

export function formatKr(n: number): string {
  const sign = n < 0 ? "−" : "";
  return `${sign}${Math.abs(Math.round(n)).toLocaleString("sv-SE")} kr`;
}
