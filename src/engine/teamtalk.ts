import type { Player } from "./types";

/** When the talk happens — the available tones & framing differ a little. */
export type TalkPhase = "pre" | "half" | "full";

/** The manager's delivery. Reactions depend on tone × context × personality. */
export type TalkTone = "calm" | "encourage" | "passionate" | "demand" | "furious";

export interface ToneOption {
  tone: TalkTone;
  label: string;
  blurb: string;
}

export const TONES: ToneOption[] = [
  { tone: "calm", label: "Calm & Assured", blurb: "Heads up, stick to the plan." },
  { tone: "encourage", label: "Encouraging", blurb: "Arm round the shoulder." },
  { tone: "passionate", label: "Passionate", blurb: "Fire them up." },
  { tone: "demand", label: "Demanding", blurb: "Not good enough — raise it." },
  { tone: "furious", label: "Hairdryer", blurb: "Lose the rag at them." },
];

export type Mood = "lifted" | "fired-up" | "settled" | "unmoved" | "rattled" | "stung";

export interface PlayerReaction {
  player: Player;
  mood: Mood;
  delta: number; // morale change applied
}

export interface TalkContext {
  phase: TalkPhase;
  /** the talking side's score minus the opponent's (0 = level, pre-match). */
  margin: number;
  /** true if this club is the favourite (higher reputation). */
  favourite: boolean;
}

export interface TalkResult {
  reactions: PlayerReaction[];
  /** transient in-match performance modifier for this side, roughly -0.06..+0.06. */
  boost: number;
  summary: string;
}

// personality buckets (labels come from teams.personalityLabel)
const STEADY = new Set([
  "Strict Professional", "Model Professional", "Iron-Willed", "Determined",
  "Club Loyalist", "Loyal",
]);
const FIERY = new Set(["Volatile", "Temperamental", "Unreliable"]);
const EASY_GOING = new Set(["Party-goer", "Casual", "Relaxed", "Sociable"]);
const DRIVEN = new Set(["Ambitious", "Mercenary", "Charismatic Leader", "Spirited"]);

function clampMorale(v: number) {
  return Math.max(0, Math.min(100, v));
}

/**
 * How well a single player takes a given talk in the current context, in
 * roughly [-1, 1]. Driven by the scoreline (was the tone earned?), the player's
 * temperament (bigMatch / determination / professionalism) and personality.
 */
function reactionFit(p: Player, tone: TalkTone, ctx: TalkContext): number {
  const losing = ctx.margin < 0;
  const winning = ctx.margin > 0;
  const heavy = Math.abs(ctx.margin) >= 14;
  const temperament = (p.hidden.bigMatch - 10) / 10; // -0.9..1.0
  const grit = (p.hidden.determination - 10) / 10;
  const pro = (p.hidden.professionalism - 10) / 10;
  const persona = p.person.personality;

  let fit = 0;
  switch (tone) {
    case "calm":
      // Always safe; pros & steady heads value composure most.
      fit = 0.25 + pro * 0.3 + (STEADY.has(persona) ? 0.25 : 0);
      if (FIERY.has(persona)) fit -= 0.1; // hotheads want more than calm
      break;
    case "encourage":
      // Best when behind or to a relaxed dressing room; redundant when cruising.
      fit = 0.2 + (losing ? 0.3 : 0) + (EASY_GOING.has(persona) ? 0.25 : 0);
      if (winning && heavy) fit -= 0.2;
      break;
    case "passionate":
      // Lifts the temperamentally strong & the driven; can over-rev hotheads.
      fit = 0.1 + temperament * 0.35 + (DRIVEN.has(persona) ? 0.3 : 0);
      if (losing) fit += 0.15;
      if (FIERY.has(persona)) fit -= 0.05;
      break;
    case "demand":
      // Lands with pros, the driven & gritty; relaxed types resent it.
      fit = (losing ? 0.1 : -0.05) + grit * 0.3 + pro * 0.2;
      if (DRIVEN.has(persona)) fit += 0.25;
      if (EASY_GOING.has(persona)) fit -= 0.3;
      if (winning && !heavy) fit -= 0.15; // why the gripe, we're ahead?
      break;
    case "furious":
      // Only earned when underperforming. Strong temperaments take it as a
      // challenge; everyone else, and especially hotheads, gets rattled.
      if (losing) fit = 0.15 + temperament * 0.5 + grit * 0.25;
      else fit = -0.5 - (winning ? 0.2 : 0); // furious while level/ahead = baffling
      if (FIERY.has(persona)) fit -= 0.35;
      if (STEADY.has(persona)) fit -= 0.1; // resents being shouted at
      break;
  }
  // consistency damps the swing — flaky players over-react either way
  const swing = 1 + (10 - p.hidden.consistency) / 25;
  return Math.max(-1, Math.min(1, fit * swing));
}

function moodFor(delta: number): Mood {
  if (delta >= 4) return "lifted";
  if (delta >= 1.5) return "fired-up";
  if (delta > -1.5) return delta >= 0 ? "settled" : "unmoved";
  if (delta > -4) return "rattled";
  return "stung";
}

/**
 * Deliver a team talk to the on-field side (or whole squad for full-time).
 * Mutates each player's morale and returns the reactions plus a transient
 * match boost the engine reads while the half plays out.
 */
export function deliverTalk(squad: Player[], tone: TalkTone, ctx: TalkContext): TalkResult {
  // pre/half talks are to the team that takes the field; full-time to everyone
  const audience = ctx.phase === "full" ? squad : squad.filter((p) => p.onField);
  const list = audience.length ? audience : squad;
  const reactions: PlayerReaction[] = [];
  let sum = 0;
  for (const p of list) {
    const fit = reactionFit(p, tone, ctx);
    const delta = Math.round(fit * 5 * 10) / 10;
    p.condition.morale = clampMorale(p.condition.morale + delta);
    reactions.push({ player: p, mood: moodFor(delta), delta });
    sum += fit;
  }
  const avg = sum / Math.max(1, list.length);
  // full-time talk has no in-match effect
  const boost = ctx.phase === "full" ? 0 : Math.max(-0.06, Math.min(0.06, avg * 0.06));
  const lifted = reactions.filter((r) => r.delta > 0).length;
  const down = reactions.filter((r) => r.delta < 0).length;
  const summary =
    avg > 0.25
      ? `The room responds — ${lifted} lifted.`
      : avg < -0.2
        ? `That fell flat — ${down} unhappy.`
        : `A muted response (${lifted} up, ${down} down).`;
  return { reactions, boost, summary };
}
