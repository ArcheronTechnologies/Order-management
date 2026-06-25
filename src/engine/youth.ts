import { Rng } from "./rng";
import { UNION_POSITIONS, makePlayer, makeHidden } from "./teams";
import type { Team } from "./teams";
import { ATTRIBUTE_KEYS, type Player } from "./types";

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

function clampAttr(v: number) {
  return Math.max(1, Math.min(20, Math.round(v)));
}
function clamp100(v: number) {
  return Math.max(1, Math.min(100, Math.round(v)));
}

/**
 * Roll the U18/U20 holding squad forward a year. In a dedicated development
 * environment youngsters grow toward their potential markedly faster than in
 * the senior set-up. Anyone who turns 20 graduates out (ready for the seniors).
 */
export function developAcademy(prospects: Prospect[], rng: Rng): { stayed: Prospect[]; graduated: Prospect[] } {
  const stayed: Prospect[] = [];
  const graduated: Prospect[] = [];
  for (const pr of prospects) {
    const p = pr.player;
    p.age += 1;
    const gap = p.hidden.potentialAbility - p.hidden.currentAbility;
    const proDet = (p.hidden.professionalism + p.hidden.determination) / 2; // 1–20
    // accelerated academy growth toward the ceiling
    const delta = gap * (0.3 + proDet * 0.025) + rng.range(-0.5, 2.5);
    const before = p.hidden.currentAbility;
    p.hidden.currentAbility = clamp100(before + delta);
    if (before > 0 && Math.abs(p.hidden.currentAbility - before) >= 1) {
      const ratio = p.hidden.currentAbility / before;
      for (const k of ATTRIBUTE_KEYS) p.attr[k] = clampAttr(p.attr[k] * ratio);
    }
    p.lastDevDelta = p.hidden.currentAbility - before;
    pr.stars = caStars(p.hidden.currentAbility);
    pr.potential = caStars(p.hidden.potentialAbility);
    if (p.age >= 20) graduated.push(pr);
    else stayed.push(pr);
  }
  return { stayed, graduated };
}
