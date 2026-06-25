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

export interface Player {
  id: number;
  side: Side;
  /** shirt number; matches the starting position for on-field starters. */
  number: number;
  name: string;
  age: number;
  position: PositionDef;
  forward: boolean;
  attr: Attributes;
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
