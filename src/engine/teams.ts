import type { Attributes, Player, Side } from "./types";
import type { FormatConfig } from "./formats";
import { Rng } from "./rng";

export interface Team {
  name: string;
  short: string;
  /** overall club strength 1..20, biases generated attributes. */
  rating: number;
}

export const SAMPLE_TEAMS: Team[] = [
  { name: "Thornbury Oaks", short: "OAK", rating: 15 },
  { name: "Harborne Gulls", short: "GUL", rating: 13 },
  { name: "Penrith Miners", short: "MIN", rating: 16 },
  { name: "Calder Wolves", short: "WOL", rating: 12 },
  { name: "Severn Kestrels", short: "KES", rating: 14 },
  { name: "Dunmere Sharks", short: "SHK", rating: 17 },
];

const FORENAMES = [
  "Owen", "Finn", "Cole", "Reuben", "Sefa", "Tane", "Iestyn", "Marcus",
  "Bryn", "Levi", "Kaden", "Noa", "Dylan", "Joss", "Hemi", "Ruairi",
  "Tomos", "Manu", "Eli", "Caleb", "Asher", "Gethin", "Sol", "Vili",
];
const SURNAMES = [
  "Hartley", "Mensah", "Okafor", "Ngata", "Salesa", "Pryce", "Doyle",
  "Faletau", "Vunipola", "Kruis", "Marler", "Daly", "Tuilagi", "Radwan",
  "Kolisi", "Etzebeth", "Du Toit", "Savea", "Barrett", "Mauvaka", "Penaud",
];

function rollAttr(rng: Rng, base: number, spread: number): number {
  const v = Math.round(base + rng.range(-spread, spread));
  return Math.max(1, Math.min(20, v));
}

function makeAttributes(rng: Rng, rating: number, forward: boolean): Attributes {
  // forwards skew to strength/tackling, backs to pace/handling/kicking
  const b = rating;
  return {
    pace: rollAttr(rng, forward ? b - 3 : b + 1, 4),
    handling: rollAttr(rng, forward ? b - 2 : b + 1, 3),
    tackling: rollAttr(rng, forward ? b + 1 : b - 1, 3),
    kicking: rollAttr(rng, forward ? b - 5 : b, 4),
    strength: rollAttr(rng, forward ? b + 2 : b - 2, 3),
    stamina: rollAttr(rng, b, 3),
  };
}

let nextId = 1;

export function buildSquad(
  rng: Rng,
  team: Team,
  side: Side,
  fmt: FormatConfig
): Player[] {
  const players: Player[] = [];
  for (let i = 0; i < fmt.playersPerSide; i++) {
    const forward = i < fmt.forwards;
    players.push({
      id: nextId++,
      side,
      number: i + 1,
      name: `${rng.pick(FORENAMES)} ${rng.pick(SURNAMES)}`,
      forward,
      attr: makeAttributes(rng, team.rating, forward),
      x: 0,
      y: 0,
      fatigue: 0,
    });
  }
  return players;
}
