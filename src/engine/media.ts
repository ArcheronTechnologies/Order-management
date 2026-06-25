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

// ======================= post-match interview ===========================
export type MatchResult = "won" | "lost" | "drew";

const WON_QS = [
  "A good win — what pleased you most out there?",
  "Three points in the bag. How big was that?",
  "The fans are buzzing. Talk us through it.",
];
const LOST_QS = [
  "A tough afternoon. Where did it go wrong?",
  "That's a loss to swallow. Your reaction?",
  "The result didn't go your way — what now?",
];
const DREW_QS = [
  "A share of the spoils — a point gained or two dropped?",
  "Honours even. Happy with that?",
  "A draw at the death. How do you feel?",
];

export function postMatchQuestion(result: MatchResult, rng: Rng): string {
  const pool = result === "won" ? WON_QS : result === "lost" ? LOST_QS : DREW_QS;
  return pool[Math.floor(rng.next() * pool.length)];
}

/** How a post-match answer lands depends on the result. */
export function postMatchOutcome(tone: PressTone, result: MatchResult): PressOutcome {
  switch (tone) {
    case "confident":
      return result === "won"
        ? { morale: 4, board: 3, rep: 2, line: "Beaming and assured — the room laps it up." }
        : result === "drew"
          ? { morale: 1, board: 0, rep: 1, line: "Spins the draw as a platform — fair enough." }
          : { morale: -1, board: -2, rep: 0, line: "Upbeat after a loss — reads as out of touch." };
    case "measured":
      return result === "won"
        ? { morale: 2, board: 2, rep: 1, line: "Credit shared, feet on the ground. Professional." }
        : { morale: 1, board: 1, rep: 0, line: "Level-headed — no drama, no headlines." };
    case "defiant":
      return result === "lost"
        ? { morale: 3, board: -1, rep: 1, line: "Refuses to panic — the dressing room responds." }
        : { morale: 1, board: -1, rep: 1, line: "Combative even in victory — a touch much." };
    case "humble":
      return result === "won"
        ? { morale: 1, board: 3, rep: 1, line: "Gracious in victory — the board nod along." }
        : { morale: 2, board: 2, rep: 0, line: "Takes it on the chin — earns some respect." };
  }
}

// ============================ rumours / social ==========================
const RUMOUR_TEMPLATES: ((club: string, rng: Rng) => string)[] = [
  (c) => `Talk in the clubhouse links a ${c} forward with a move to a rival — nothing in it, says the committee.`,
  (c) => `A local pundit tips ${c} for a mid-table finish: "honest, hard-working, but short of a cutting edge."`,
  (c) => `Social feed buzz: a ${c} youngster turned heads at training this week.`,
  (c) => `Word is a rival coach has been spotted at ${c} fixtures — scouting, or just a fan?`,
  (c) => `${c} supporters' group calls for more investment in the clubhouse bar. The board has "noted it."`,
  (c) => `Rumour on the grapevine: a former ${c} player may be tempted out of retirement for one last season.`,
  (c) => `A pundit predicts a tough run-in for ${c}: "their fixture list is unforgiving from here."`,
];

/** A flavour item for the inbox. Mostly cosmetic; the occasional small morale ripple. */
export function rumour(clubName: string, rng: Rng): { text: string; morale: number } {
  const tmpl = RUMOUR_TEMPLATES[Math.floor(rng.next() * RUMOUR_TEMPLATES.length)];
  // most rumours are pure flavour; a minority nudge morale a touch either way
  const roll = rng.next();
  const morale = roll < 0.15 ? -1 : roll > 0.85 ? 1 : 0;
  return { text: tmpl(clubName, rng), morale };
}
