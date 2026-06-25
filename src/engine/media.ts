import { Rng } from "./rng";

/**
 * There's no press corps at this level — it all plays out on social media. Your
 * matchday statements go out on the club page (the tone is how you word the
 * post), and "rumours" are players themselves — the one linked away, their
 * team-mates, and rivals — sounding off online.
 */
export type PressTone = "confident" | "measured" | "defiant" | "humble";

export interface ToneOption {
  tone: PressTone;
  label: string;
}
/** how to word the club-page post. */
export const PRESS_TONES: ToneOption[] = [
  { tone: "confident", label: "Confident" },
  { tone: "measured", label: "Measured" },
  { tone: "defiant", label: "Defiant" },
  { tone: "humble", label: "Humble" },
];

// ===================== pre-match club-page post =========================
const FAV_QS = [
  "Matchday. You're fancied for this one — what goes out on the club page?",
  "Home or away, you're favourites today. What's the matchday post?",
  "The lads are buzzing in the group chat. What do you put out?",
];
const DOG_QS = [
  "Matchday, and few fancy you here. What goes out on the club page?",
  "Tough one on paper. What's the matchday post?",
  "Underdogs again this week. How do you word the club post?",
];

export function pressQuestion(favourite: boolean, rng: Rng): string {
  const pool = favourite ? FAV_QS : DOG_QS;
  return pool[Math.floor(rng.next() * pool.length)];
}

export interface PressOutcome {
  morale: number; // squad-wide morale nudge
  board: number; // board approval nudge (all members)
  rep: number; // reputation nudge
  line: string; // how the post landed
}

/** How a club-page post lands depends on whether you're favourite or underdog. */
export function pressOutcome(tone: PressTone, favourite: boolean): PressOutcome {
  switch (tone) {
    case "confident":
      return favourite
        ? { morale: 3, board: 2, rep: 1, line: "Assured matchday post — the lads share it round." }
        : { morale: 2, board: -2, rep: 1, line: "Bullish post for an underdog — bold, and screenshotted." };
    case "measured":
      return { morale: 1, board: 1, rep: 0, line: "A calm, professional post. Steady likes." };
    case "defiant":
      return favourite
        ? { morale: 1, board: -3, rep: 0, line: "Comes across cocky online given the billing." }
        : { morale: 4, board: 1, rep: 1, line: "Fighting-talk post — the dressing room loves it." };
    case "humble":
      return { morale: 0, board: 2, rep: 0, line: "Humble, respectful post — the committee approve." };
  }
}

// ===================== full-time club-page post =========================
export type MatchResult = "won" | "lost" | "drew";

const WON_QS = [
  "Full time, a win. What does the club post?",
  "Three points. What goes up on the club page?",
  "Job done. What's the full-time post?",
];
const LOST_QS = [
  "Full time, a loss. What goes out on the club page?",
  "Beaten today. What's the full-time post?",
  "Not your day. How do you word the club post?",
];
const DREW_QS = [
  "Honours even. What does the club post?",
  "A share of the spoils. What goes on the club page?",
  "A draw at the death. What's the full-time post?",
];

export function postMatchQuestion(result: MatchResult, rng: Rng): string {
  const pool = result === "won" ? WON_QS : result === "lost" ? LOST_QS : DREW_QS;
  return pool[Math.floor(rng.next() * pool.length)];
}

/** How a full-time club-page post lands depends on the result. */
export function postMatchOutcome(tone: PressTone, result: MatchResult): PressOutcome {
  switch (tone) {
    case "confident":
      return result === "won"
        ? { morale: 4, board: 3, rep: 2, line: "Beaming full-time post — likes pouring in." }
        : result === "drew"
          ? { morale: 1, board: 0, rep: 1, line: "Spins the draw as a platform — fair enough." }
          : { morale: -1, board: -2, rep: 0, line: "Upbeat after a loss — the replies aren't kind." };
    case "measured":
      return result === "won"
        ? { morale: 2, board: 2, rep: 1, line: "Credit shared, feet on the ground. Classy post." }
        : { morale: 1, board: 1, rep: 0, line: "Level-headed post — no drama in the replies." };
    case "defiant":
      return result === "lost"
        ? { morale: 3, board: -1, rep: 1, line: "Refuses to panic — the lads rally behind the post." }
        : { morale: 1, board: -1, rep: 1, line: "Combative even in victory — a touch much online." };
    case "humble":
      return result === "won"
        ? { morale: 1, board: 3, rep: 1, line: "Gracious in victory — the committee nod along." }
        : { morale: 2, board: 2, rep: 0, line: "Takes it on the chin online — earns some respect." };
  }
}

// ===================== players sounding off (social) ====================
export interface SocialPost {
  text: string;
  morale: number; // small ripple, only applied when it's your own player
}

export interface SocialInput {
  /** the player at the centre of the post. */
  player: string;
  /** that player's club name. */
  club: string;
  /** a team-mate who might react. */
  teammate?: string;
  /** true if the player is in the user's squad (so the ripple lands at home). */
  ownClub: boolean;
  rng: Rng;
}

/**
 * A social-media post voiced by players themselves — the one linked with a move,
 * their team-mates backing (or needling) them, or a rival having their say.
 * No pundits, no rumour-mill: just the players online.
 */
export function playerSocial(inp: SocialInput): SocialPost {
  const { player, club, teammate, ownClub, rng } = inp;
  const mate = teammate ?? "A team-mate";
  const own: { text: string; morale: number }[] = [
    { text: `🗨️ ${player}: "Seen the chat about me leaving ${club} — not happening. Love this place. 🔴⚫"`, morale: 1 },
    { text: `🗨️ ${player}: "Flattered by the interest, but my head's fully at ${club} right now."`, morale: -1 },
    { text: `🗨️ ${mate}: "${player} is going NOWHERE 💪 best in the league and he knows it"`, morale: 1 },
    { text: `🗨️ ${player}: "Hard watching from the bench lately, but I'll keep grafting and earn my shirt back."`, morale: -1 },
    { text: `🗨️ ${mate}: "Buzzing for young ${player} — trained the house down this week, the real deal 👀"`, morale: 1 },
    { text: `🗨️ ${player}: "Massive few weeks coming up for ${club}. We're ready. Get down and back the lads."`, morale: 1 },
    { text: `🗨️ ${mate}: "Few of us out for a couple of quiet ones 🍺 then heads down — big game next week."`, morale: 0 },
  ];
  const rival: { text: string; morale: number }[] = [
    { text: `🗨️ ${player} (${club}): "Bring on the weekend. We owe a few people. 😤"`, morale: 0 },
    { text: `🗨️ ${player} (${club}): "Some of these pitches are a disgrace. Sort it out. 🙄"`, morale: 0 },
    { text: `🗨️ ${player} (${club}): "Confident going into this run of games. ${club} on the up. 📈"`, morale: 0 },
    { text: `🗨️ ${player} (${club}): "Respect to everyone who travels for these away days. Proper rugby folk."`, morale: 0 },
  ];
  const pool = ownClub ? own : rival;
  const pick = pool[Math.floor(rng.next() * pool.length)];
  return { text: pick.text, morale: ownClub ? pick.morale : 0 };
}
