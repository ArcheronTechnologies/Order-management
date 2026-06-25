import { Rng } from "./rng";
import { UNION_POSITIONS, makePlayer, makeHidden } from "./teams";
import type { Team } from "./teams";
import type { Player } from "./types";

export interface Prospect {
  player: Player;
  /** scouted current-ability stars (raw youngsters are low) and a potential estimate. */
  stars: number;
  potential: number;
}

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}
function caStars(ca: number): number {
  return clamp(Math.round(ca / 20), 1, 5);
}

/**
 * The club's academy graduates for the season. Output is potential-led: they're
 * raw now but the better-run the academy (reputation, facilities, a university
 * link), the more — and the more promising — youngsters come through.
 */
export function generateYouthIntake(
  rng: Rng,
  team: Team,
  reputation: number,
  facilities: number,
  university: boolean,
  composite: number // facilities composite (1–5), sizes the class a touch
): Prospect[] {
  const strength = reputation / 100 + facilities * 0.08 + (university ? 0.18 : 0);
  const count = clamp(Math.round(2 + strength * 2.5 + composite * 0.2), 2, 6);
  const out: Prospect[] = [];
  for (let i = 0; i < count; i++) {
    const pos = UNION_POSITIONS[Math.floor(rng.next() * UNION_POSITIONS.length)];
    const rating = clamp(team.rating + (reputation - 50) / 14 + (university ? 1 : 0) + rng.range(-2, 2.5), 3, 18);
    const p = makePlayer(rng, { ...team, rating }, "home", pos, 0, false);
    p.age = rng.int(16, 19); // academy age
    p.hidden = makeHidden(rng, p.attr, p.age);
    // youngsters: trim current ability (raw), keep/raise the ceiling (promise)
    p.hidden.currentAbility = clamp(Math.round(p.hidden.currentAbility * 0.82), 1, 100);
    p.hidden.potentialAbility = clamp(
      Math.round(Math.max(p.hidden.potentialAbility, p.hidden.currentAbility + rng.range(8, 26))),
      1, 100
    );
    p.seasonsAtClub = 0;
    out.push({ player: p, stars: caStars(p.hidden.currentAbility), potential: caStars(p.hidden.potentialAbility) });
  }
  return out;
}
