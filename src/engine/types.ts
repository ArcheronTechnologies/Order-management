export type Side = "home" | "away";

/** FM-style 1–20 attributes. */
export interface Attributes {
  // core
  pace: number; // top running speed
  strength: number; // break/win contact
  stamina: number; // resists fatigue
  handling: number; // passing & catching, fewer knock-ons
  tackling: number; // tackle completion
  kicking: number; // distance & goal accuracy
  decisionMaking: number; // shrewd pass/kick/run choices
  positioning: number; // defensive read, covering, support lines
  discipline: number; // fewer penalties conceded
  // set piece
  scrummaging: number; // front row / pack shove
  lineoutJump: number; // winning lineout ball in the air
  throwing: number; // hooker's lineout throw accuracy
}

export const ATTRIBUTE_KEYS: (keyof Attributes)[] = [
  "pace", "strength", "stamina", "handling", "tackling", "kicking",
  "decisionMaking", "positioning", "discipline",
  "scrummaging", "lineoutJump", "throwing",
];

/** A positional role within a squad (drives attribute weighting & shirt no.). */
export interface PositionDef {
  number: number; // shirt number
  name: string; // "Loosehead Prop"
  short: string; // "LHP"
  forward: boolean;
  /** attribute biases (added to the club's base rating before rolling). */
  weights: Partial<Record<keyof Attributes, number>>;
}

/** Hidden, FM-style attributes — not shown raw; drive development & big moments. */
export interface HiddenAttributes {
  currentAbility: number; // 1–100, overall now
  potentialAbility: number; // 1–100, ceiling
  determination: number; // 1–20
  professionalism: number; // 1–20, training gains & condition upkeep
  consistency: number; // 1–20, how often they hit their level
  bigMatch: number; // 1–20, temperament in big games
}

/** The amateur/person side: a life outside rugby that shapes availability. */
export interface PersonProfile {
  job: string;
  commitment: number; // 1–20, turns up to train & play
  workFlexibility: number; // 1–20, can get time off for matches/travel
  injuryProneness: number; // 1–20
  loyalty: number; // 1–20, sticks with the club
  ambition: number; // 1–20, wants to climb / move up
  sociability: number; // 1–20, dressing-room & social life
  personality: string; // derived FM-style label (e.g. "Club Loyalist")
  traits: string[]; // playing traits (e.g. "Offloads in the tackle")
  canPlay: string[]; // position shorts this player can cover
}

/** Match-to-match physical/morale condition (fuller model used from M5). */
export interface Condition {
  fitness: number; // 0–100 match fitness
  sharpness: number; // 0–100 match sharpness
  morale: number; // 0–100
  injuredWeeks: number; // 0 = available
}

export interface Player {
  id: number;
  side: Side; // assigned per match
  /** shirt number; matches the starting position for on-field starters. */
  number: number;
  name: string;
  age: number;
  nationality: string; // "Sweden" for locals; a rugby nation for overseas students
  /** overseas student on a 1–3 year stint (undefined for locals). */
  studentYearsLeft?: number;
  /** change in current ability over the most recent pre-season (for the UI). */
  lastDevDelta?: number;
  /** seasons served at the current club — drives "old boy" loyalty on retirement. */
  seasonsAtClub?: number;
  /** an FM-style role/duty for this player (e.g. "Playmaker", "Fetcher"); position-specific. */
  duty?: string;
  position: PositionDef;
  forward: boolean;
  attr: Attributes;
  hidden: HiddenAttributes;
  person: PersonProfile;
  condition: Condition;
  /** squad roles — set per club, persist across the season. */
  isCaptain?: boolean;
  isGoalKicker?: boolean;
  isLineoutLeader?: boolean;
  /** true while on the pitch (false on the bench). */
  onField: boolean;

  // live match state (metres on the pitch)
  x: number;
  y: number;
  /** transient fatigue 0..1, scales speed down toward 0.6 at full gas. */
  fatigue: number;
}

export interface Vec {
  x: number;
  y: number;
}

export interface Ball {
  x: number;
  y: number;
  carrier: Player | null;
  /** when in flight (pass/kick): velocity in m/s and remaining travel time. */
  vx: number;
  vy: number;
  airTime: number;
  /** who threw it, so we can ignore them as a receiver. */
  thrownBy: Player | null;
  /** sevens/union kick vs pass changes contest rules at landing. */
  kicked: boolean;
}

export type Phase =
  | "kickoff"
  | "open" // ball carrier running
  | "ruck" // tackle made, ball being recycled
  | "flight" // pass or kick in the air
  | "scrum" // set piece after a knock-on / forward pass
  | "lineout" // set piece after the ball goes to touch
  | "conversion" // shot at goal after a try
  | "penalty" // shot at goal from a penalty
  | "fulltime";

export interface ScoreEvent {
  clock: number; // match seconds
  side: Side;
  kind: "try" | "conversion" | "penalty" | "drop";
  points: number;
  text: string;
}
