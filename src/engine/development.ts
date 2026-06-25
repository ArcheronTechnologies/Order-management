import { Rng } from "./rng";
import { ATTRIBUTE_KEYS, type Player } from "./types";
import {
  type Team,
  squadSize,
  assignRoles,
  recruitPlayers,
  recruitStudents,
} from "./teams";

export interface Departure {
  player: Player;
  reason: string;
}

export interface SeasonDevelopment {
  roster: Player[]; // next season's squad
  retirements: Departure[];
  departures: Departure[]; // students returning home + glory-hunter moves
  intake: Player[]; // newgens + new students
  risers: Player[]; // notable improvers (sorted, best first)
}

function clampAttr(v: number) {
  return Math.max(1, Math.min(20, Math.round(v)));
}
function clamp100(v: number) {
  return Math.max(1, Math.min(100, Math.round(v)));
}

/**
 * Age a player a year and move their ability: the young grow toward their
 * potential (faster if professional & determined), the prime hold, and the old
 * decline — sharply past their mid-30s. Returns the change in current ability.
 */
function ageAndDevelop(p: Player, rng: Rng): number {
  p.age += 1;
  const gap = p.hidden.potentialAbility - p.hidden.currentAbility;
  const proDet = (p.hidden.professionalism + p.hidden.determination) / 2; // 1–20
  let delta: number;
  if (p.age <= 23) delta = gap * (0.18 + proDet * 0.02) + rng.range(-1, 2);
  else if (p.age <= 28) delta = gap * (0.09 + proDet * 0.01) + rng.range(-1.5, 1.5);
  else if (p.age <= 31) delta = (proDet - 11) * 0.15 + rng.range(-2.5, 1.5);
  else delta = -(p.age - 30) * rng.range(0.7, 1.6) - (15 - proDet) * 0.15;
  const before = p.hidden.currentAbility;
  p.hidden.currentAbility = clamp100(before + delta);
  // nudge the visible attributes in step with the ability change
  if (before > 0 && Math.abs(p.hidden.currentAbility - before) >= 1) {
    const ratio = p.hidden.currentAbility / before;
    for (const k of ATTRIBUTE_KEYS) p.attr[k] = clampAttr(p.attr[k] * ratio);
  }
  const change = p.hidden.currentAbility - before;
  p.lastDevDelta = change;
  return change;
}

function retires(p: Player, rng: Rng): boolean {
  if (p.age >= 39) return true;
  if (p.age < 32) return false;
  const base = (p.age - 31) * 0.13;
  const lowCA = p.hidden.currentAbility < 45 ? 0.18 : 0;
  const proHangsOn = (p.hidden.professionalism - 10) * 0.012;
  return rng.chance(Math.max(0.04, Math.min(0.92, base + lowCA - proHangsOn)));
}

/** Pre-season condition for a returning player — rested, sharpness low, morale toward club standing. */
function preSeasonCondition(p: Player, reputation: number, rng: Rng) {
  const moraleBase = Math.max(25, Math.min(90, 40 + reputation * 0.45));
  p.condition = {
    fitness: clamp100(88 + rng.range(0, 12)),
    sharpness: clamp100(45 + rng.range(0, 20)),
    morale: clamp100(p.condition.morale * 0.5 + moraleBase * 0.5 + rng.range(-6, 6)),
    injuredWeeks: 0,
  };
}

/**
 * Roll a club's squad forward one year: develop/age everyone, retire the old,
 * lose students (stint over) and glory-hunters (a club punching below its
 * players' ambition), then top back up to the reputation-scaled size with a
 * youth intake (and fresh students for university clubs). Deterministic per rng.
 */
export function developSquad(
  prev: Player[],
  rng: Rng,
  team: Team,
  reputation: number
): SeasonDevelopment {
  const kept: Player[] = [];
  const retirements: Departure[] = [];
  const departures: Departure[] = [];
  const avgCA = prev.reduce((s, p) => s + p.hidden.currentAbility, 0) / Math.max(1, prev.length);
  // everyone who was here banks another season of service (for old-boy loyalty)
  for (const p of prev) p.seasonsAtClub = (p.seasonsAtClub ?? 0) + 1;

  for (const p of prev) {
    // students are here on a fixed stint
    if (p.studentYearsLeft != null) {
      p.studentYearsLeft -= 1;
      if (p.studentYearsLeft <= 0) {
        departures.push({ player: p, reason: `returned to ${p.nationality}` });
        continue;
      }
    }
    ageAndDevelop(p, rng);
    if (retires(p, rng)) {
      retirements.push({ player: p, reason: p.age >= 37 ? "hung up the boots" : "retired" });
      continue;
    }
    // glory-hunter: an ambitious, clearly-above-average player leaves a club
    // whose standing can't hold them
    if (
      p.studentYearsLeft == null &&
      p.person.ambition >= 13 &&
      p.hidden.currentAbility > avgCA + 6 &&
      reputation < 58 &&
      rng.chance(0.12 + (58 - reputation) * 0.02) // lower standing, more poaching
    ) {
      departures.push({ player: p, reason: "moved to a bigger club" });
      continue;
    }
    preSeasonCondition(p, reputation, rng);
    kept.push(p);
  }

  // replenish to the reputation-scaled size
  const target = squadSize(reputation);
  const shirtStart = (kept.reduce((m, p) => Math.max(m, p.number), 0) || kept.length) + 1;
  const intake: Player[] = [];
  if (kept.length < target) {
    intake.push(...recruitPlayers(rng, team, target - kept.length, shirtStart));
  }
  if (team.university) {
    intake.push(...recruitStudents(rng, team, rng.int(1, 3), shirtStart + intake.length));
  }

  const roster = [...kept, ...intake];
  assignRoles(roster);
  const risers = kept
    .filter((p) => (p.lastDevDelta ?? 0) >= 3)
    .sort((a, b) => (b.lastDevDelta ?? 0) - (a.lastDevDelta ?? 0));
  return { roster, retirements, departures, intake, risers };
}
