import { Rng } from "./rng";

/** A season goal (on-pitch) or development goal (off-pitch) attached to a deal. */
export type GoalKind = "finishTop" | "winMatches" | "reputation" | "facilities" | "survive";
export interface SponsorGoal {
  kind: GoalKind;
  target: number;
  desc: string;
}

export interface SponsorOffer {
  id: number;
  name: string;
  color: string;
  upfront: number; // paid on signing
  perfBonus: number; // paid if the performance goal is met
  devBonus: number; // paid if the development goal is met
  perfGoal: SponsorGoal;
  devGoal: SponsorGoal;
}

const NAMES = [
  "Nordbron Bygg", "Frasses Grill", "Lindqvist El", "Bergmans Bil", "Café Måns",
  "Sundström VVS", "Öhmans Färg", "Trygg Försäkring", "Nyberg Frakt", "Allbygg AB",
  "Svensson & Söner", "Kustens Fisk", "Hökarängs Bageri", "Pernillas Blommor",
  "Stenmark Däck", "Gröna Lund Pizzeria", "Vikinga Smide", "Dahls Möbler",
];
const COLORS = [
  "#1565c0", "#c62828", "#2e7d32", "#6a1b9a", "#ef6c00", "#00838f",
  "#ad1457", "#4527a0", "#33691e", "#bf360c", "#01579b", "#4e342e",
];

function pick<T>(rng: Rng, arr: T[]): T {
  return arr[Math.floor(rng.next() * arr.length)];
}
function round5(n: number): number {
  return Math.round(n / 1000) * 1000;
}

/**
 * A fresh pool of 3–5 sponsor offers for the season, scaled by the club's
 * standing & tier (bigger clubs attract bigger deals). Deterministic per rng.
 */
export function generateOffers(
  rng: Rng,
  reputation: number,
  tier: "allsvenskan" | "div1",
  facilities: number,
  divisionSize: number
): SponsorOffer[] {
  const n = rng.int(3, 5);
  const scale = (tier === "allsvenskan" ? 1.7 : 1) * (0.55 + reputation / 100);
  const usedNames = new Set<string>();
  const offers: SponsorOffer[] = [];
  for (let i = 0; i < n; i++) {
    let name = pick(rng, NAMES);
    while (usedNames.has(name)) name = pick(rng, NAMES);
    usedNames.add(name);

    // performance goal: ambitious clubs are asked to finish high, others to win games
    const perfGoal: SponsorGoal = reputation >= 62 || rng.next() < 0.4
      ? (() => {
          const t = rng.int(1, Math.min(4, Math.max(2, Math.round(divisionSize / 2))));
          return { kind: "finishTop", target: t, desc: `Finish in the top ${t}` };
        })()
      : (() => {
          const t = rng.int(3, 6);
          return { kind: "winMatches", target: t, desc: `Win at least ${t} matches` };
        })();

    // development goal: grow the club off the pitch
    const devRoll = rng.next();
    const devGoal: SponsorGoal =
      devRoll < 0.4
        ? { kind: "reputation", target: rng.int(3, 6), desc: `Grow club reputation by ${0}` } // desc filled below
        : devRoll < 0.7 && facilities < 5
          ? { kind: "facilities", target: facilities + 1, desc: `Upgrade facilities to level ${facilities + 1}` }
          : { kind: "survive", target: divisionSize - 1, desc: `Avoid the drop (don't finish last)` };
    if (devGoal.kind === "reputation") devGoal.desc = `Grow club reputation by ${devGoal.target}`;

    offers.push({
      id: 1000 + Math.floor(rng.next() * 1e6),
      name,
      color: pick(rng, COLORS),
      upfront: round5(rng.range(18000, 46000) * scale),
      perfBonus: round5(rng.range(16000, 42000) * scale),
      devBonus: round5(rng.range(16000, 42000) * scale),
      perfGoal,
      devGoal,
    });
  }
  return offers;
}

export interface SponsorOutcome {
  name: string;
  perfMet: boolean;
  devMet: boolean;
  paid: number;
}

/** End-of-season facts a sponsor's goals are judged against. */
export interface SeasonOutcome {
  finishPos: number; // 1 = champion
  wins: number;
  repGrowth: number; // reputation gained over the season
  facilities: number; // current level
  divisionSize: number;
}

export function goalMet(goal: SponsorGoal, o: SeasonOutcome): boolean {
  switch (goal.kind) {
    case "finishTop": return o.finishPos <= goal.target;
    case "winMatches": return o.wins >= goal.target;
    case "reputation": return o.repGrowth >= goal.target;
    case "facilities": return o.facilities >= goal.target;
    case "survive": return o.finishPos <= goal.target;
  }
}

/** Settle all signed sponsors against the season outcome; returns bonuses to pay. */
export function settleSponsors(signed: SponsorOffer[], o: SeasonOutcome): { total: number; outcomes: SponsorOutcome[] } {
  let total = 0;
  const outcomes = signed.map((s) => {
    const perfMet = goalMet(s.perfGoal, o);
    const devMet = goalMet(s.devGoal, o);
    const paid = (perfMet ? s.perfBonus : 0) + (devMet ? s.devBonus : 0);
    total += paid;
    return { name: s.name, perfMet, devMet, paid };
  });
  return { total, outcomes };
}
