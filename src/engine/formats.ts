/**
 * Both codes share the same World Rugby pitch; what changes is squad size and
 * match length. Sevens is faster and lower-scoring per minute but far more
 * end-to-end, which falls out naturally from fewer defenders on the same field.
 */
export type FormatId = "union" | "sevens";

export interface FormatConfig {
  id: FormatId;
  label: string;
  playersPerSide: number;
  forwards: number; // remaining are backs
  /** real seconds of play per half. */
  halfLength: number;
}

export const FORMATS: Record<FormatId, FormatConfig> = {
  union: {
    id: "union",
    label: "Union (15s)",
    playersPerSide: 15,
    forwards: 8,
    halfLength: 40 * 60,
  },
  sevens: {
    id: "sevens",
    label: "Sevens (7s)",
    playersPerSide: 7,
    forwards: 3,
    halfLength: 7 * 60,
  },
};

// ---- Pitch geometry, in metres. Origin top-left. -------------------------
// x runs along the length of the pitch, y across the width.
export const PITCH = {
  inGoal: 10, // depth of each in-goal area
  fieldLength: 100, // try line to try line
  width: 70,
};

export const TOTAL_LENGTH = PITCH.fieldLength + PITCH.inGoal * 2; // 120
export const HOME_TRY_LINE = PITCH.inGoal; // x = 10  (home defends here)
export const AWAY_TRY_LINE = PITCH.inGoal + PITCH.fieldLength; // x = 110 (away defends)
export const HALFWAY = PITCH.inGoal + PITCH.fieldLength / 2; // x = 60

/** Try line the given side is attacking toward. */
export function attackingLine(side: "home" | "away"): number {
  return side === "home" ? AWAY_TRY_LINE : HOME_TRY_LINE;
}

/** +1 if the side attacks toward increasing x, -1 otherwise. */
export function attackDir(side: "home" | "away"): number {
  return side === "home" ? 1 : -1;
}
