import type { Attributes, HiddenAttributes, PersonProfile, PositionDef, Player, Side } from "./types";
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

// amateur day jobs — the life outside rugby that shapes availability
const JOBS = [
  "Carpenter", "Teacher", "Student", "Electrician", "Nurse", "IT consultant",
  "Forestry worker", "Police officer", "Chef", "Plumber", "Accountant", "Farmer",
  "Lorry driver", "Engineer", "Bartender", "PE teacher", "Mechanic", "Paramedic",
  "Warehouse worker", "Fisherman", "Soldier", "Personal trainer", "Salesman",
];

const FWD_TRAITS = ["Big hitter", "Ball-carrying forward", "Hits rucks hard", "Dominant scrummager", "Lineout target", "Mauls well"];
const BACK_TRAITS = ["Goose-steps", "Offloads in the tackle", "Sidesteps", "Box-kicks", "Places kicks well", "Steps off both feet", "Tries to beat the first man"];

function personalityLabel(det: number, prof: number, commit: number): string {
  const s = det + prof + commit;
  if (prof >= 16 && det >= 15) return "Model professional";
  if (s >= 48) return "Driven";
  if (commit <= 7) return "Unreliable";
  if (prof <= 8) return "Casual";
  if (det >= 15) return "Determined";
  if (s <= 24) return "Easy-going";
  return "Balanced";
}

function makeHidden(rng: Rng, attr: Attributes, age: number): HiddenAttributes {
  const avg = Object.values(attr).reduce((a, b) => a + b, 0) / Object.keys(attr).length;
  const currentAbility = clampAttr100(Math.round(avg * 4.5 + rng.range(-6, 6)));
  // younger players have more headroom to grow
  const youth = Math.max(0, 30 - age);
  const potentialAbility = clampAttr100(currentAbility + Math.round(youth * rng.range(0.4, 1.4)));
  return {
    currentAbility,
    potentialAbility,
    determination: rngAttr(rng),
    professionalism: rngAttr(rng),
    consistency: rngAttr(rng),
    bigMatch: rngAttr(rng),
  };
}

function clampAttr100(v: number): number {
  return Math.max(1, Math.min(100, v));
}
function rngAttr(rng: Rng): number {
  return Math.max(1, Math.min(20, Math.round(rng.range(5, 17))));
}

function makePerson(rng: Rng, pos: PositionDef): PersonProfile {
  const determination = rngAttr(rng);
  const professionalism = rngAttr(rng);
  const commitment = rngAttr(rng);
  const pool = pos.forward ? FWD_TRAITS : BACK_TRAITS;
  const traits: string[] = [];
  const nTraits = rng.next() < 0.5 ? 0 : rng.next() < 0.7 ? 1 : 2;
  while (traits.length < nTraits) {
    const t = rng.pick(pool);
    if (!traits.includes(t)) traits.push(t);
  }
  // can cover adjacent positions of the same type
  const canPlay = [pos.short];
  return {
    job: rng.pick(JOBS),
    commitment,
    workFlexibility: rngAttr(rng),
    injuryProneness: rngAttr(rng),
    personality: personalityLabel(determination, professionalism, commitment),
    traits,
    canPlay,
  };
}

function makePlayer(
  rng: Rng,
  team: Team,
  side: Side,
  pos: PositionDef,
  number: number,
  onField: boolean
): Player {
  const age = rng.int(18, 36);
  const attr = makeAttributes(rng, team.rating, pos);
  return {
    id: nextId++,
    side,
    number,
    name: `${rng.pick(FORENAMES)} ${rng.pick(SURNAMES)}`,
    age,
    position: pos,
    forward: pos.forward,
    attr,
    hidden: makeHidden(rng, attr, age),
    person: makePerson(rng, pos),
    condition: { fitness: 100, sharpness: rng.int(70, 100), morale: rng.int(55, 85), injuredWeeks: 0 },
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
