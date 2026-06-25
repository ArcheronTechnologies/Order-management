import { Rng } from "./rng";
import { UNION_POSITIONS, makePlayer, makeHidden as _mh } from "./teams";
import type { Team } from "./teams";
import type { Player } from "./types";

export type RecruitBackground = "Local lad" | "Walk-up" | "Ex-pro" | "Returning student" | "Trialist";

export interface Recruit {
  player: Player;
  background: RecruitBackground;
  /** scouted current-ability stars (1–5) and a potential-ceiling estimate. */
  stars: number;
  potential: number;
}

const BG_AGES: Record<RecruitBackground, [number, number]> = {
  "Local lad": [17, 21],
  "Walk-up": [20, 30],
  "Ex-pro": [29, 35],
  "Returning student": [22, 26],
  Trialist: [18, 27],
};
// rating nudge each background brings relative to the club's level
const BG_BIAS: Record<RecruitBackground, number> = {
  "Local lad": -1,
  "Walk-up": -2,
  "Ex-pro": 3,
  "Returning student": 2,
  Trialist: -1,
};

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}
function caStars(ca: number): number {
  return clamp(Math.round(ca / 20), 1, 5);
}

/**
 * The free-agent / walk-up pool available to a club this season. Better-run
 * clubs (reputation) attract stronger players; ex-pros and returning students
 * are a cut above, local lads are raw but young. Deterministic per rng.
 */
export function generateRecruitPool(
  rng: Rng,
  team: Team,
  reputation: number,
  count: number
): Recruit[] {
  const repBias = (reputation - 50) / 12; // ±~4 from the club's pulling power
  const out: Recruit[] = [];
  for (let i = 0; i < count; i++) {
    const pos = UNION_POSITIONS[Math.floor(rng.next() * UNION_POSITIONS.length)];
    const bgRoll = rng.next();
    const background: RecruitBackground =
      bgRoll < 0.34 ? "Walk-up" :
      bgRoll < 0.58 ? "Local lad" :
      bgRoll < 0.76 ? "Trialist" :
      bgRoll < 0.9 ? "Returning student" : "Ex-pro";
    const rating = clamp(team.rating + repBias + BG_BIAS[background] + rng.range(-1.5, 1.5), 3, 19);
    const synthetic: Team = { ...team, rating };
    const p = makePlayer(rng, synthetic, "home", pos, 0, false);
    const [lo, hi] = BG_AGES[background];
    p.age = rng.int(lo, hi);
    p.hidden = _mh(rng, p.attr, p.age);
    out.push({ player: p, background, stars: caStars(p.hidden.currentAbility), potential: caStars(p.hidden.potentialAbility) });
  }
  return out;
}

/** A signing-on fee — free in the amateur game, a modest fee at the semi-pro top tier. */
export function signingFee(tier: "allsvenskan" | "div1", stars: number): number {
  if (tier !== "allsvenskan") return 0;
  return stars * 9000;
}
