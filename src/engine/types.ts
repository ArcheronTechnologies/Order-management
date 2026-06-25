export type Side = "home" | "away";

/** FM-style 1–20 attributes. */
export interface Attributes {
  pace: number; // top running speed
  handling: number; // passing & catching, fewer knock-ons
  tackling: number; // tackle completion
  kicking: number; // distance & goal accuracy
  strength: number; // break tackles, win contact
  stamina: number; // resists fatigue
}

export interface Player {
  id: number;
  side: Side;
  /** 1-based shirt number / positional id within the squad. */
  number: number;
  name: string;
  forward: boolean;
  attr: Attributes;

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
