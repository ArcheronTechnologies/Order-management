import { Rng } from "./rng";

export type PressTone = "confident" | "measured" | "defiant" | "humble";

export interface ToneOption {
  tone: PressTone;
  label: string;
}
export const PRESS_TONES: ToneOption[] = [
  { tone: "confident", label: "Confident" },
  { tone: "measured", label: "Measured" },
  { tone: "defiant", label: "Defiant" },
  { tone: "humble", label: "Humble" },
];

const FAV_QS = [
  "You're favourites today — is the pressure all on you?",
  "Everyone expects a win here. Comfortable with that?",
  "Anything less than a win would be a disappointment, wouldn't it?",
];
const DOG_QS = [
  "Few give you a chance today. Your thoughts?",
  "You're the underdogs — is this damage limitation?",
  "On paper they're the stronger side. How do you approach it?",
];

export function pressQuestion(favourite: boolean, rng: Rng): string {
  const pool = favourite ? FAV_QS : DOG_QS;
  return pool[Math.floor(rng.next() * pool.length)];
}

export interface PressOutcome {
  morale: number; // squad-wide morale nudge
  board: number; // board approval nudge (all members)
  rep: number; // reputation nudge
  line: string; // how it went down
}

/** How a press answer lands depends on whether you're favourite or underdog. */
export function pressOutcome(tone: PressTone, favourite: boolean): PressOutcome {
  switch (tone) {
    case "confident":
      return favourite
        ? { morale: 3, board: 2, rep: 1, line: "Assured words — the room nods along." }
        : { morale: 2, board: -2, rep: 1, line: "Bullish for an underdog — bold, and it'll be remembered." };
    case "measured":
      return { morale: 1, board: 1, rep: 0, line: "A calm, professional answer. No headlines." };
    case "defiant":
      return favourite
        ? { morale: 1, board: -3, rep: 0, line: "Comes across as arrogant given the billing." }
        : { morale: 4, board: 1, rep: 1, line: "Fighting talk — the dressing room loves it." };
    case "humble":
      return { morale: 0, board: 2, rep: 0, line: "Humble and respectful — the board approve." };
  }
}
