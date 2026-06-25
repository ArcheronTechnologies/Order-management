import { Rng } from "./rng";
import { type Attributes, type Player } from "./types";

export type TrainingIntensity = "light" | "normal" | "hard";
export type TrainingFocus = "balanced" | "fitness" | "attack" | "defence" | "setpiece";

export interface TrainingPlan {
  intensity: TrainingIntensity;
  focus: TrainingFocus;
}

export const DEFAULT_TRAINING: TrainingPlan = { intensity: "normal", focus: "balanced" };

export const INTENSITY_LABELS: Record<TrainingIntensity, string> = {
  light: "Light",
  normal: "Normal",
  hard: "Hard",
};
export const FOCUS_LABELS: Record<TrainingFocus, string> = {
  balanced: "Balanced",
  fitness: "Fitness & conditioning",
  attack: "Attack & handling",
  defence: "Defence & contact",
  setpiece: "Set piece",
};

/** Which attributes a focus develops (forwards/backs split where it matters). */
const FOCUS_ATTRS: Record<TrainingFocus, (keyof Attributes)[]> = {
  balanced: ["stamina", "handling", "tackling", "decisionMaking", "positioning"],
  fitness: ["stamina", "pace", "strength"],
  attack: ["handling", "pace", "decisionMaking", "kicking"],
  defence: ["tackling", "positioning", "strength"],
  setpiece: ["scrummaging", "lineoutJump", "throwing"],
};

const INTENSITY_GAIN: Record<TrainingIntensity, number> = { light: 0.45, normal: 1, hard: 1.6 };
const INTENSITY_RISK: Record<TrainingIntensity, number> = { light: 0.002, normal: 0.006, hard: 0.018 };

export interface TrainingReport {
  attended: number;
  squad: number;
  improved: number;
  topGainer: Player | null;
  knocks: number;
}

function clampA(v: number) {
  return Math.max(1, Math.min(20, v));
}
function clamp100(v: number) {
  return Math.max(1, Math.min(100, v));
}

/**
 * A week's training for one squad. Amateur reality caps it: not everyone turns
 * up (commitment + a low-reputation club struggles for numbers), so a thin
 * session develops less. Young, professional players with headroom gain most;
 * harder sessions gain more but tire legs and risk knocks. Returns a report.
 */
export function applyTraining(
  squad: Player[],
  plan: TrainingPlan,
  reputation: number,
  rng: Rng
): TrainingReport {
  const gainK = INTENSITY_GAIN[plan.intensity];
  const riskK = INTENSITY_RISK[plan.intensity];
  const attrs = FOCUS_ATTRS[plan.focus];
  // turnout: better at well-run (high-rep) clubs; committed players show up
  const repTurnout = clamp100(58 + (reputation - 55) * 0.7) / 100;
  let attended = 0;
  let improved = 0;
  let knocks = 0;
  let topGainer: Player | null = null;
  let topGain = 0;

  for (const p of squad) {
    if (p.condition.injuredWeeks > 0) continue;
    const showUp = Math.min(0.98, repTurnout * (0.5 + p.person.commitment / 30));
    if (!rng.chance(showUp)) continue;
    attended++;

    // ability headroom & how well they train
    const gap = Math.max(0, p.hidden.potentialAbility - p.hidden.currentAbility);
    const proDet = (p.hidden.professionalism + p.hidden.determination) / 2;
    const youth = Math.max(0.25, (32 - p.age) / 12); // young develop faster
    const caGain = gainK * (0.12 + gap * 0.012) * (0.6 + proDet / 25) * youth;
    if (caGain > 0.05) {
      const before = p.hidden.currentAbility;
      p.hidden.currentAbility = clamp100(before + caGain);
      // direct a slice of the work into the focused attributes
      for (const k of attrs) {
        if (rng.chance(0.35)) p.attr[k] = clampA(p.attr[k] + (rng.chance(0.5) ? 0.5 : 0));
      }
      const realGain = p.hidden.currentAbility - before;
      if (realGain >= 0.4) improved++;
      if (realGain > topGain) {
        topGain = realGain;
        topGainer = p;
      }
    }

    // sharpness up from work; hard sessions cost a little fitness
    p.condition.sharpness = clamp100(p.condition.sharpness + (plan.intensity === "light" ? 3 : 6));
    if (plan.intensity === "hard") p.condition.fitness = clamp100(p.condition.fitness - rng.range(2, 6));
    // training-ground knocks (injury-prone players more so)
    const injP = riskK * (0.6 + p.person.injuryProneness / 14);
    if (rng.chance(Math.min(0.05, injP))) {
      p.condition.injuredWeeks = rng.int(1, 3);
      knocks++;
    }
  }
  return { attended, squad: squad.length, improved, topGainer, knocks };
}
