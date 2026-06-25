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
  /** standing/prestige 1..100 — drives squad size & pulls player quality; evolves over years. */
  reputation: number;
  /** facilities level 1..5 (clubhouse, pitches, floodlights) — feeds reputation & youth. */
  facilities: number;
  /** in/near a university town — attracts strong overseas student players. */
  university?: boolean;
  colors: { primary: string; secondary: string };
}

/** Number of players a club carries, scaled by reputation (bigger clubs, deeper squads). */
export function squadSize(reputation: number): number {
  return Math.max(30, Math.min(50, Math.round(28 + reputation * 0.22)));
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

interface PersonalityInputs {
  det: number; prof: number; temp: number; commit: number;
  loyalty: number; ambition: number; sociability: number;
}

/** FM-style personality, picked from the standout mental traits. */
function personalityLabel(p: PersonalityInputs): string {
  const { det, prof, temp, commit, loyalty, ambition, sociability } = p;
  if (prof >= 17 && det >= 16) return "Model Professional";
  if (prof >= 15 && det >= 13) return "Strict Professional";
  if (loyalty >= 17 && ambition <= 12) return "Club Loyalist";
  if (ambition >= 17 && loyalty <= 9) return "Mercenary";
  if (det >= 15 && (det + ambition) >= 17 && sociability >= 13) return "Charismatic Leader";
  if (ambition >= 16 && det >= 13) return "Ambitious";
  if (det >= 17) return "Iron-Willed";
  if (sociability >= 16 && prof <= 10) return "Party-goer";
  if (sociability >= 15) return "Sociable";
  if (temp <= 6) return "Volatile";
  if (temp <= 9) return "Temperamental";
  if (commit <= 6) return "Unreliable";
  if (prof <= 7) return "Casual";
  if (det >= 14) return "Determined";
  if (det <= 7) return "Relaxed";
  if (loyalty >= 14) return "Loyal";
  if (prof >= 13) return "Professional";
  if (commit >= 15 && prof >= 11) return "Spirited";
  return "Realist";
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

function makePerson(rng: Rng, pos: PositionDef, hidden: HiddenAttributes): PersonProfile {
  const commitment = rngAttr(rng);
  const loyalty = rngAttr(rng);
  const ambition = rngAttr(rng);
  const sociability = rngAttr(rng);
  const pool = pos.forward ? FWD_TRAITS : BACK_TRAITS;
  const traits: string[] = [];
  const nTraits = rng.next() < 0.5 ? 0 : rng.next() < 0.7 ? 1 : 2;
  while (traits.length < nTraits) {
    const t = rng.pick(pool);
    if (!traits.includes(t)) traits.push(t);
  }
  return {
    job: rng.pick(JOBS),
    commitment,
    workFlexibility: rngAttr(rng),
    injuryProneness: rngAttr(rng),
    loyalty,
    ambition,
    sociability,
    personality: personalityLabel({
      det: hidden.determination,
      prof: hidden.professionalism,
      temp: hidden.bigMatch,
      commit: commitment,
      loyalty,
      ambition,
      sociability,
    }),
    traits,
    canPlay: [pos.short],
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
  const hidden = makeHidden(rng, attr, age);
  return {
    id: nextId++,
    side,
    number,
    name: `${rng.pick(FORENAMES)} ${rng.pick(SURNAMES)}`,
    age,
    nationality: "Sweden",
    position: pos,
    forward: pos.forward,
    attr,
    hidden,
    person: makePerson(rng, pos, hidden),
    condition: { fitness: 100, sharpness: rng.int(70, 100), morale: rng.int(55, 85), injuredWeeks: 0 },
    onField,
    x: 0,
    y: 0,
    fatigue: 0,
  };
}

// --- overseas student players (university clubs only) ---------------------
const STUDENT_NATIONS: { nation: string; forenames: string[]; surnames: string[] }[] = [
  { nation: "England", forenames: ["Harry", "Jack", "Oliver", "George", "Charlie", "Tom", "Will", "Sam"], surnames: ["Smith", "Jones", "Taylor", "Brown", "Wilson", "Roberts", "Hughes", "Carter"] },
  { nation: "New Zealand", forenames: ["Tane", "Ari", "Manaia", "Kauri", "Nikau", "Rangi", "Hemi", "Te Ariki"], surnames: ["Ngata", "Walker", "Wī", "Thompson", "Brooke", "Savea", "Cooper", "Mahuta"] },
  { nation: "South Africa", forenames: ["Pieter", "Johan", "Ruan", "Bongani", "Sipho", "Werner", "Jaco", "Thabo"], surnames: ["Van der Merwe", "Botha", "Nkosi", "Du Plessis", "Pretorius", "Mokoena", "Venter", "Dlamini"] },
  { nation: "Australia", forenames: ["Liam", "Noah", "Cooper", "Lachlan", "Jett", "Kai", "Hunter", "Flynn"], surnames: ["Williams", "Murphy", "O'Brien", "Kelly", "Ryan", "Walsh", "Foster", "Hayes"] },
  { nation: "Ireland", forenames: ["Cian", "Conor", "Eoin", "Fionn", "Oisín", "Darragh", "Rory", "Cormac"], surnames: ["Murphy", "Kelly", "O'Sullivan", "Byrne", "Ryan", "O'Connor", "Healy", "Doyle"] },
  { nation: "Wales", forenames: ["Dylan", "Rhys", "Ioan", "Osian", "Tomos", "Gethin", "Carwyn", "Llŷr"], surnames: ["Jones", "Davies", "Williams", "Evans", "Thomas", "Roberts", "Lewis", "Morgan"] },
  { nation: "France", forenames: ["Antoine", "Louis", "Hugo", "Théo", "Nathan", "Romain", "Baptiste", "Matthieu"], surnames: ["Dupont", "Martin", "Bernard", "Dubois", "Penaud", "Moreau", "Laurent", "Garnier"] },
  { nation: "Fiji", forenames: ["Josua", "Semi", "Waisea", "Viliame", "Eroni", "Levani", "Api", "Jiuta"], surnames: ["Tuisova", "Radradra", "Nayacalevu", "Mata", "Volavola", "Kunatani", "Botia", "Naikadawa"] },
];

/** A strong overseas student on a 1–3 year stint — clearly above the league. */
export function makeStudent(rng: Rng, team: Team, pos: PositionDef, number: number): Player {
  const src = rng.pick(STUDENT_NATIONS);
  const age = rng.int(19, 24);
  // students come from rugby nations: a clear ability boost over the local league
  const boosted: Team = { ...team, rating: Math.min(20, team.rating + rng.int(4, 7)) };
  const attr = makeAttributes(rng, boosted.rating, pos);
  const hidden = makeHidden(rng, attr, age);
  hidden.potentialAbility = Math.max(hidden.potentialAbility, hidden.currentAbility + rng.int(2, 10));
  const person = makePerson(rng, pos, hidden);
  person.ambition = Math.max(person.ambition, rng.int(13, 20)); // they move on
  person.loyalty = Math.min(person.loyalty, rng.int(4, 11));
  return {
    id: nextId++,
    side: "home",
    number,
    name: `${rng.pick(src.forenames)} ${rng.pick(src.surnames)}`,
    age,
    nationality: src.nation,
    studentYearsLeft: rng.int(1, 3),
    position: pos,
    forward: pos.forward,
    attr,
    hidden,
    person,
    condition: { fitness: 100, sharpness: rng.int(70, 100), morale: rng.int(60, 90), injuredWeeks: 0 },
    onField: false,
    x: 0,
    y: 0,
    fatigue: 0,
  };
}

export function positionsFor(fmt: FormatConfig): PositionDef[] {
  return fmt.id === "sevens" ? SEVENS_POSITIONS : UNION_POSITIONS;
}

// how much cover each shirt tends to carry (front row, half-backs & back row deepest)
const UNION_DEPTH_WEIGHT = [3, 3, 3, 3, 2, 3, 3, 2, 3, 3, 2, 2, 2, 2, 2];

/**
 * A full club roster: one specialist per shirt (the spine, marked onField as a
 * default XV) plus depth across the squad up to `size`, weighted toward the
 * positions that need cover. Bigger (higher-reputation) clubs carry more.
 */
export function buildSquad(
  rng: Rng,
  team: Team,
  side: Side,
  fmt: FormatConfig,
  size?: number,
  reputation: number = team.reputation
): Player[] {
  const positions = positionsFor(fmt);
  // the spine: best of each position, onField as the default starting XV/VII
  const squad: Player[] = positions.map((pos) =>
    makePlayer(rng, team, side, pos, pos.number, true)
  );
  const target = fmt.id === "sevens" ? size ?? 14 : size ?? squadSize(team.reputation);
  // weighted bag of positions for the depth players
  const weights = fmt.id === "sevens" ? positions.map(() => 1) : UNION_DEPTH_WEIGHT;
  const bag: number[] = [];
  positions.forEach((_, i) => {
    for (let w = 0; w < (weights[i] ?? 2); w++) bag.push(i);
  });
  let shirt = positions.length + 1;
  while (squad.length < target) {
    const posIdx = bag[Math.floor(rng.next() * bag.length)];
    squad.push(makePlayer(rng, team, side, positions[posIdx], shirt++, false));
  }
  // university clubs attract 1–3 strong overseas students (key positions)
  if (fmt.id !== "sevens" && team.university) {
    const n = rng.int(1, 3);
    // favour impact positions: 10, 12, 13, wings, 8, locks, openside
    const impact = [9, 10, 11, 12, 13, 7, 4, 5];
    for (let s = 0; s < n; s++) {
      const posIdx = impact[Math.floor(rng.next() * impact.length)];
      const student = makeStudent(rng, team, positions[posIdx], shirt++);
      student.side = side;
      squad.push(student);
    }
  }
  // dressing-room cohesion tracks reputation: low-rep clubs struggle for numbers
  // at training, so morale starts lower (which then drags reputation down again).
  const moraleBase = Math.max(25, Math.min(90, 40 + reputation * 0.45));
  for (const p of squad) {
    if (p.studentYearsLeft) continue; // students arrive keen
    p.condition.morale = Math.max(20, Math.min(95, Math.round(moraleBase + rng.range(-10, 10))));
  }
  assignRoles(squad);
  return squad;
}

/** Natural leadership: experience, drive and standing in the group. */
export function leadershipScore(p: Player): number {
  const personaBonus =
    p.person.personality === "Charismatic Leader" ? 8 :
    p.person.personality === "Club Loyalist" || p.person.personality === "Iron-Willed" ? 5 :
    p.person.personality === "Model Professional" || p.person.personality === "Strict Professional" ? 4 :
    p.person.personality === "Volatile" || p.person.personality === "Unreliable" ? -6 : 0;
  return (
    p.hidden.determination * 2 +
    p.hidden.professionalism +
    p.person.loyalty +
    p.person.sociability * 0.5 +
    Math.min(8, Math.max(0, p.age - 22)) + // a few years' standing
    personaBonus
  );
}

/**
 * Pick sensible default squad roles. Captain = the natural leader; goal-kicker =
 * the best off the tee; lineout leader = the best jumper in the pack. The user
 * can override their own club's choices from the squad screen.
 */
export function assignRoles(squad: Player[]): void {
  for (const p of squad) {
    p.isCaptain = false;
    p.isGoalKicker = false;
    p.isLineoutLeader = false;
  }
  if (!squad.length) return;
  const captain = squad.reduce((a, b) => (leadershipScore(b) > leadershipScore(a) ? b : a));
  captain.isCaptain = true;
  const kicker = squad.reduce((a, b) => (b.attr.kicking > a.attr.kicking ? b : a));
  kicker.isGoalKicker = true;
  const fwds = squad.filter((p) => p.forward);
  if (fwds.length) {
    fwds.reduce((a, b) => (b.attr.lineoutJump > a.attr.lineoutJump ? b : a)).isLineoutLeader = true;
  }
}

/** Re-point a single role at a chosen player (clears the previous holder). */
export function setRole(
  squad: Player[],
  role: "isCaptain" | "isGoalKicker" | "isLineoutLeader",
  playerId: number
): void {
  for (const p of squad) p[role] = false;
  const p = squad.find((q) => q.id === playerId);
  if (p) p[role] = true;
}

/** Generate `count` fresh young recruits/newgens (age 18–21) for an annual intake. */
export function recruitPlayers(
  rng: Rng,
  team: Team,
  count: number,
  shirtStart: number
): Player[] {
  const positions = UNION_POSITIONS;
  const bag: number[] = [];
  positions.forEach((_, i) => {
    for (let w = 0; w < (UNION_DEPTH_WEIGHT[i] ?? 2); w++) bag.push(i);
  });
  const out: Player[] = [];
  let shirt = shirtStart;
  for (let k = 0; k < count; k++) {
    const pos = positions[bag[Math.floor(rng.next() * bag.length)]];
    const p = makePlayer(rng, team, "home", pos, shirt++, false);
    p.age = rng.int(18, 21); // newgens come through young
    p.hidden = makeHidden(rng, p.attr, p.age);
    p.person = makePerson(rng, pos, p.hidden);
    out.push(p);
  }
  return out;
}

/** A university intake of `count` overseas students at impact positions. */
export function recruitStudents(rng: Rng, team: Team, count: number, shirtStart: number): Player[] {
  const impact = [9, 10, 11, 12, 13, 7, 4, 5];
  const out: Player[] = [];
  let shirt = shirtStart;
  for (let s = 0; s < count; s++) {
    const pos = UNION_POSITIONS[impact[Math.floor(rng.next() * impact.length)]];
    out.push(makeStudent(rng, team, pos, shirt++));
  }
  return out;
}

/** Compact a player to a JSON-safe object (position stored by shirt number). */
export function serializePlayer(p: Player): unknown {
  return {
    id: p.id, number: p.number, name: p.name, age: p.age, nationality: p.nationality,
    studentYearsLeft: p.studentYearsLeft, lastDevDelta: p.lastDevDelta,
    pos: p.position.number, attr: p.attr, hidden: p.hidden, person: p.person,
    condition: p.condition,
    isCaptain: p.isCaptain, isGoalKicker: p.isGoalKicker, isLineoutLeader: p.isLineoutLeader,
  };
}

/** Rebuild a Player from serializePlayer output. */
export function deserializePlayer(o: any): Player {
  const pos = UNION_POSITIONS.find((q) => q.number === o.pos) ?? UNION_POSITIONS[0];
  if (o.id >= nextId) nextId = o.id + 1; // keep id generator ahead of loaded ids
  return {
    id: o.id, side: "home", number: o.number, name: o.name, age: o.age,
    nationality: o.nationality, studentYearsLeft: o.studentYearsLeft, lastDevDelta: o.lastDevDelta,
    position: pos, forward: pos.forward, attr: o.attr, hidden: o.hidden, person: o.person,
    condition: o.condition,
    isCaptain: o.isCaptain, isGoalKicker: o.isGoalKicker, isLineoutLeader: o.isLineoutLeader,
    onField: false, x: 0, y: 0, fatigue: 0,
  };
}
