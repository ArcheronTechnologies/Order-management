import type { Team } from "./teams";
import { squadSize } from "./teams";
import { distanceKm } from "../data/geo";

/**
 * A season's club finances. Amateur-true at the bottom (membership fees & a bar
 * keep the lights on, travel bites); semi-pro nearer the top (Allsvenskan
 * sponsorship & gate money matter). All figures in kr.
 */
export interface FinanceBreakdown {
  income: { membership: number; sponsorship: number; matchday: number; bar: number; donations: number };
  costs: { upkeep: number; kit: number; travel: number; rent: number };
  incomeTotal: number;
  costTotal: number;
  net: number;
}

export interface ClubOps {
  clubhouse: number; // 0–3
  access: "tight" | "balanced" | "loose";
  fieldRented: boolean;
  trainingRented: boolean;
}
const FIELD_RENT = 55000;
const TRAINING_RENT = 30000;
const BAR_PER_LEVEL = 26000;
const ACCESS_BAR: Record<ClubOps["access"], number> = { tight: 0.45, balanced: 1, loose: 1.7 };

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
  awayOpponents: Team[],
  facilities: number,
  ops: ClubOps,
  donations = 0
): FinanceBreakdown {
  const membership = squadSize(reputation) * MEMBER_FEE;
  const sponsorship = Math.round(reputation * tierMultiplier(tier) * SPONSOR_PER_REP);
  const matchday = Math.round(homeMatches * reputation * GATE_PER_REP);
  // clubhouse bar: more open access sells more beer
  const bar = ops.clubhouse > 0
    ? Math.round(ops.clubhouse * BAR_PER_LEVEL * ACCESS_BAR[ops.access] * (0.6 + reputation / 130))
    : 0;
  const upkeep = facilities * UPKEEP_PER_FACILITY;
  const kit = KIT_INSURANCE;
  const travel = awayOpponents.reduce(
    (s, opp) => s + Math.round(distanceKm(club.city, opp.city) * TRAVEL_PER_KM),
    0
  );
  const rent = (ops.fieldRented ? FIELD_RENT : 0) + (ops.trainingRented ? TRAINING_RENT : 0);
  const incomeTotal = membership + sponsorship + matchday + bar + donations;
  const costTotal = upkeep + kit + travel + rent;
  return {
    income: { membership, sponsorship, matchday, bar, donations },
    costs: { upkeep, kit, travel, rent },
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

/** Cost to upgrade facilities from `level` to `level + 1` (steeper near the top). */
export function facilityUpgradeCost(level: number): number {
  return level * 70000;
}

export function formatKr(n: number): string {
  const sign = n < 0 ? "−" : "";
  return `${sign}${Math.abs(Math.round(n)).toLocaleString("sv-SE")} kr`;
}
