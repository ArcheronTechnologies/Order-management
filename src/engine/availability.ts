import { Rng } from "./rng";
import { UNION_POSITIONS } from "./teams";
import type { Player } from "./types";

export interface Availability {
  player: Player;
  available: boolean;
  reason: string;
}

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Amateur availability: each match some players can't make it — injured, stuck at
 * work, family, or just didn't show. Low commitment / inflexible jobs miss more.
 * Deterministic per (seed, player) so a round is stable across reloads.
 */
export function rollAvailability(squad: Player[], seed: number, reputation = 60): Availability[] {
  // low-reputation clubs struggle for numbers — players drift away from training
  // and matches, so everyone is a bit more likely to be a no-show
  const repPenalty = clamp((62 - reputation) / 260, 0, 0.18);
  return squad.map((p) => {
    if (p.condition.injuredWeeks > 0) {
      return { player: p, available: false, reason: `Injured (${p.condition.injuredWeeks}w)` };
    }
    const rng = new Rng((seed * 31 + p.id * 7 + 1) >>> 0);
    const miss = clamp(
      0.015 + (20 - p.person.commitment) * 0.007 + (20 - p.person.workFlexibility) * 0.005 + repPenalty,
      0.01,
      0.4
    );
    if (rng.chance(miss)) {
      const r = rng.next();
      const reason = r < 0.5 ? `Working (${p.person.job})` : r < 0.8 ? "Family / personal" : "No-show";
      return { player: p, available: false, reason };
    }
    return { player: p, available: true, reason: "Available" };
  });
}

/** Personalities that chafe at being left out — they expect to be picked. */
const GAME_TIME_HUNGRY = new Set([
  "Ambitious", "Mercenary", "Volatile", "Temperamental", "Determined",
  "Charismatic Leader", "Model Professional",
]);

export interface Snub {
  player: Player;
  severity: "annoyed" | "frustrated" | "furious";
}

/**
 * Game-time morale after a match: starters lift (more in a win); fit players
 * left out stew — the ambitious, big-ego and clearly-good-enough most of all.
 * Returns the notable snubs so the manager hears about unhappy fringe players.
 */
export function applySelectionMorale(squad: Player[], won: boolean): Snub[] {
  const fit = squad.filter((p) => p.condition.injuredWeeks === 0);
  const cas = fit.map((p) => p.hidden.currentAbility).sort((a, b) => a - b);
  const median = cas.length ? cas[Math.floor(cas.length / 2)] : 50;
  const snubs: Snub[] = [];
  for (const p of fit) {
    if (p.onField) {
      p.condition.morale = clamp(p.condition.morale + (won ? 4 : 1.5), 0, 100);
      continue;
    }
    let hit = 1.2; // everyone would rather have played
    if (GAME_TIME_HUNGRY.has(p.person.personality)) hit += 2;
    hit += Math.max(0, p.person.ambition - 10) * 0.25;
    if (p.hidden.currentAbility >= median) hit += 1.5; // "I'm good enough — why not me?"
    p.condition.morale = clamp(p.condition.morale - hit, 0, 100);
    if (hit >= 6) snubs.push({ player: p, severity: "furious" });
    else if (hit >= 4.5) snubs.push({ player: p, severity: "frustrated" });
    else if (hit >= 3) snubs.push({ player: p, severity: "annoyed" });
  }
  const rank = { furious: 0, frustrated: 1, annoyed: 2 };
  return snubs.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

/** Persistently unhappy players (low morale) — surfaced to the manager. */
export function squadConcerns(squad: Player[]): Player[] {
  return squad
    .filter((p) => p.condition.morale < 38)
    .sort((a, b) => a.condition.morale - b.condition.morale);
}

/** How well a player fits a position: exact > can-cover > emergency; CA breaks ties. */
export function fitScore(p: Player, posShort: string): number {
  let base = 0;
  if (p.position.short === posShort) base = 1000;
  else if (p.person.canPlay.includes(posShort)) base = 600;
  else if (p.forward === isForwardPos(posShort)) base = 300; // same unit (pack/backs)
  else base = 0;
  return base + p.hidden.currentAbility;
}

function isForwardPos(short: string): boolean {
  const pos = UNION_POSITIONS.find((q) => q.short === short);
  return pos ? pos.forward : false;
}

/**
 * Auto-pick the strongest available XV (best fit per shirt), then a bench from
 * the rest. Mutates `onField` on the squad. Returns the chosen starters in shirt
 * order. If fewer than 15 are available, fields who there is (amateur reality).
 */
export function autoSelect(squad: Player[], availableIds: Set<number>): Player[] {
  squad.forEach((p) => (p.onField = false));
  const pool = squad.filter((p) => availableIds.has(p.id));
  const used = new Set<number>();
  const starters: Player[] = [];
  for (const pos of UNION_POSITIONS) {
    const best = pool
      .filter((p) => !used.has(p.id))
      .sort((a, b) => fitScore(b, pos.short) - fitScore(a, pos.short))[0];
    if (best) {
      best.onField = true;
      used.add(best.id);
      starters.push(best);
    }
  }
  return starters;
}

/** Set exactly these players as the starting XV (the rest off). */
export function applyLineup(squad: Player[], starterIds: number[]) {
  const set = new Set(starterIds);
  squad.forEach((p) => (p.onField = set.has(p.id)));
}

/** After a match: starters tire, sharpen up, and risk a knock. */
export function applyPostMatch(squad: Player[], seed: number) {
  const rng = new Rng((seed * 17 + 5) >>> 0);
  for (const p of squad) {
    if (!p.onField) continue;
    const drain = rng.range(14, 30) * (1 - (p.attr.stamina - 10) / 50);
    p.condition.fitness = clamp(p.condition.fitness - drain, 15, 100);
    p.condition.sharpness = clamp(p.condition.sharpness + 14, 0, 100);
    const injP = clamp(0.02 + (p.person.injuryProneness - 10) * 0.004, 0.008, 0.12);
    if (rng.chance(injP)) p.condition.injuredWeeks = rng.int(1, 6);
  }
}

/** Between rounds: rest restores fitness, heal injuries, idle players go stale. */
export function applyWeeklyRecovery(squad: Player[]) {
  for (const p of squad) {
    if (p.condition.injuredWeeks > 0) p.condition.injuredWeeks = Math.max(0, p.condition.injuredWeeks - 1);
    p.condition.fitness = clamp(p.condition.fitness + 18 + p.attr.stamina / 2, 0, 100);
    if (!p.onField) p.condition.sharpness = clamp(p.condition.sharpness - 4, 0, 100);
  }
}
