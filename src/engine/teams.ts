import type { Attributes, PositionDef, Player, Side } from "./types";
import { ATTRIBUTE_KEYS } from "./types";
import type { FormatConfig } from "./formats";
import { Rng } from "./rng";

export interface Team {
  name: string;
  short: string;
  city: string;
  tier: "allsvenskan" | "div1";
  region: "north" | "south";
  /** overall club strength 1..20, biases generated attributes. */
  rating: number;
  colors: { primary: string; secondary: string };
}

// --- positional roles ------------------------------------------------------
// `weights` are added to the club's base rating for that attribute before the
// roll. Anything not listed falls back to defaultDelta() below.
export const UNION_POSITIONS: PositionDef[] = [
  { number: 1, name: "Loosehead Prop", short: "LHP", forward: true, weights: { scrummaging: 6, strength: 3, pace: -5, kicking: -8 } },
  { number: 2, name: "Hooker", short: "HK", forward: true, weights: { scrummaging: 4, throwing: 8, strength: 2, pace: -4 } },
  { number: 3, name: "Tighthead Prop", short: "THP", forward: true, weights: { scrummaging: 6, strength: 3, pace: -5, kicking: -8 } },
  { number: 4, name: "Lock", short: "LK", forward: true, weights: { lineoutJump: 6, strength: 3, pace: -3 } },
  { number: 5, name: "Lock", short: "LK", forward: true, weights: { lineoutJump: 6, strength: 3, pace: -3 } },
  { number: 6, name: "Blindside Flanker", short: "BSF", forward: true, weights: { tackling: 3, strength: 2, pace: -1 } },
  { number: 7, name: "Openside Flanker", short: "OSF", forward: true, weights: { tackling: 4, pace: 0, positioning: 2 } },
  { number: 8, name: "Number 8", short: "N8", forward: true, weights: { strength: 3, tackling: 2, pace: -1 } },
  { number: 9, name: "Scrum-half", short: "SH", forward: false, weights: { handling: 3, decisionMaking: 3, pace: 1 } },
  { number: 10, name: "Fly-half", short: "FH", forward: false, weights: { kicking: 5, decisionMaking: 4, handling: 2 } },
  { number: 11, name: "Left Wing", short: "LW", forward: false, weights: { pace: 4, handling: 1 } },
  { number: 12, name: "Inside Centre", short: "IC", forward: false, weights: { strength: 1, tackling: 2, handling: 2 } },
  { number: 13, name: "Outside Centre", short: "OC", forward: false, weights: { pace: 2, tackling: 2, handling: 2 } },
  { number: 14, name: "Right Wing", short: "RW", forward: false, weights: { pace: 4, handling: 1 } },
  { number: 15, name: "Fullback", short: "FB", forward: false, weights: { kicking: 3, positioning: 3, pace: 2 } },
];

export const SEVENS_POSITIONS: PositionDef[] = [
  { number: 1, name: "Prop", short: "PR", forward: true, weights: { scrummaging: 4, strength: 3, pace: -1 } },
  { number: 2, name: "Hooker", short: "HK", forward: true, weights: { scrummaging: 3, throwing: 6, strength: 2 } },
  { number: 3, name: "Lock", short: "LK", forward: true, weights: { lineoutJump: 4, strength: 2 } },
  { number: 4, name: "Scrum-half", short: "SH", forward: false, weights: { handling: 3, decisionMaking: 3, pace: 2 } },
  { number: 5, name: "Fly-half", short: "FH", forward: false, weights: { kicking: 4, decisionMaking: 3, handling: 2, pace: 1 } },
  { number: 6, name: "Centre", short: "CE", forward: false, weights: { pace: 2, tackling: 2, handling: 1 } },
  { number: 7, name: "Wing", short: "WG", forward: false, weights: { pace: 5, handling: 1 } },
];

// bench cover: which starting positions the replacements double up on
const UNION_BENCH = [0, 1, 2, 3, 5, 8, 9, 11]; // FR, lock, back-row, 9, 10, centre
const SEVENS_BENCH = [0, 1, 3, 4, 6];

const FORENAMES = [
  "Erik", "Johan", "Anders", "Lars", "Karl", "Nils", "Gustav", "Oskar",
  "Emil", "Axel", "Albin", "Hugo", "Viktor", "Filip", "Elias", "William",
  "Liam", "Måns", "Sixten", "Love", "Vidar", "Ivar", "Folke", "Sven",
  "Björn", "Mattias", "Henrik", "Olof", "Rasmus", "Pontus", "Joel", "Theo",
];
const SURNAMES = [
  "Andersson", "Johansson", "Karlsson", "Nilsson", "Eriksson", "Larsson",
  "Olsson", "Persson", "Svensson", "Gustafsson", "Pettersson", "Jonsson",
  "Jansson", "Bergström", "Lindberg", "Lindström", "Lundgren", "Sandberg",
  "Forsberg", "Ekström", "Wikström", "Sjöberg", "Nyström", "Hedlund",
  "Dahl", "Öberg", "Holmberg", "Sundberg", "Hellström", "Norberg",
];

function clampAttr(v: number): number {
  return Math.max(1, Math.min(20, Math.round(v)));
}

/** Fallback bias for attributes a position doesn't explicitly weight. */
function defaultDelta(attr: keyof Attributes, forward: boolean): number {
  switch (attr) {
    case "pace": return forward ? -3 : 1;
    case "strength": return forward ? 2 : -1;
    case "handling": return forward ? -2 : 1;
    case "tackling": return forward ? 1 : -1;
    case "kicking": return forward ? -7 : -2;
    case "scrummaging": return forward ? -2 : -11;
    case "lineoutJump": return forward ? -3 : -11;
    case "throwing": return -10;
    default: return 0; // stamina, decisionMaking, positioning, discipline
  }
}

function makeAttributes(rng: Rng, rating: number, pos: PositionDef): Attributes {
  const out = {} as Attributes;
  for (const k of ATTRIBUTE_KEYS) {
    const delta = pos.weights[k] ?? defaultDelta(k, pos.forward);
    // amateurs: wide spread, so squads are lumpy and uneven
    out[k] = clampAttr(rating + delta + rng.range(-4, 4));
  }
  return out;
}

let nextId = 1;

function makePlayer(
  rng: Rng,
  team: Team,
  side: Side,
  pos: PositionDef,
  number: number,
  onField: boolean
): Player {
  return {
    id: nextId++,
    side,
    number,
    name: `${rng.pick(FORENAMES)} ${rng.pick(SURNAMES)}`,
    age: rng.int(18, 36),
    position: pos,
    forward: pos.forward,
    attr: makeAttributes(rng, team.rating, pos),
    onField,
    x: 0,
    y: 0,
    fatigue: 0,
  };
}

export function positionsFor(fmt: FormatConfig): PositionDef[] {
  return fmt.id === "sevens" ? SEVENS_POSITIONS : UNION_POSITIONS;
}

/**
 * A full matchday squad: the starting XV/VII (onField, shirts 1..N) followed by
 * the replacements bench (onField=false, shirts N+1..).
 */
export function buildSquad(
  rng: Rng,
  team: Team,
  side: Side,
  fmt: FormatConfig
): Player[] {
  const positions = positionsFor(fmt);
  const squad: Player[] = positions.map((pos) =>
    makePlayer(rng, team, side, pos, pos.number, true)
  );
  const bench = fmt.id === "sevens" ? SEVENS_BENCH : UNION_BENCH;
  bench.forEach((posIdx, i) => {
    squad.push(
      makePlayer(rng, team, side, positions[posIdx], positions.length + 1 + i, false)
    );
  });
  return squad;
}
