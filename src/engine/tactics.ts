/**
 * Team tactics — the manager's full attack & defence setup. A formation and a
 * defensive system pick the *shape*; the 0..100 instruction sliders (50 =
 * balanced) tune *how* that shape plays. The same squad set up differently
 * should visibly play differently.
 */
export type AttackFormation = "1-3-3-1" | "2-4-2" | "1-3-2-2";
export type DefensiveSystem = "drift" | "blitz" | "umbrella";

export interface TeamTactics {
  /** how the forwards are distributed across the field in attack. */
  attackFormation: AttackFormation;
  /** how the defensive line moves and shapes. */
  defensiveSystem: DefensiveSystem;

  /** 0 passive/drift defence … 100 hard rush (line up fast and close). */
  defensiveLineSpeed: number;
  /** 0 safe … 100 aggressive contests (more turnovers won, more penalties). */
  defensiveAggression: number;
  /** 0 narrow forward bash … 100 expansive, use the width. */
  attackingWidth: number;
  /** 0 keep ball in hand … 100 kick for territory often. */
  kickingTendency: number;
  /** 0 slow & controlled … 100 fast ruck ball / high tempo. */
  tempo: number;
  /** 0 commit few to rucks (spread wide) … 100 commit heavily (secure ball). */
  ruckCommitment: number;
  /** 0 fast off-the-top set-piece ball … 100 drive & maul for power. */
  setPieceFocus: number;

  // ---- set-piece creator (discrete calls) ----
  /** lineout: a short line is safer ball; a full line offers more but is contestable. */
  lineoutThrow?: "short" | "full";
  /** scrum: steady safe ball, quick channel-one ball, or a pushover shove near the line. */
  scrumCall?: "steady" | "quick" | "pushover";
  /** kickoff/restart: a long safe kick, or contest it and try to win it back. */
  kickoffCall?: "long" | "contest";
}

export const DEFAULT_TACTICS: TeamTactics = {
  attackFormation: "1-3-3-1",
  defensiveSystem: "drift",
  defensiveLineSpeed: 50,
  defensiveAggression: 50,
  attackingWidth: 50,
  kickingTendency: 50,
  tempo: 50,
  ruckCommitment: 50,
  setPieceFocus: 50,
  lineoutThrow: "full",
  scrumCall: "steady",
  kickoffCall: "long",
};

export const LINEOUT_CALLS: { v: NonNullable<TeamTactics["lineoutThrow"]>; label: string; blurb: string }[] = [
  { v: "full", label: "Full line", blurb: "Standard — more options, but the throw can be contested." },
  { v: "short", label: "Short line", blurb: "Fewer jumpers, safer ball — harder to steal, fewer plays off it." },
];
export const SCRUM_CALLS: { v: NonNullable<TeamTactics["scrumCall"]>; label: string; blurb: string }[] = [
  { v: "steady", label: "Steady", blurb: "Win it cleanly and play." },
  { v: "quick", label: "Channel one", blurb: "Fast ball off the base — quicker to launch, a touch looser." },
  { v: "pushover", label: "Pushover", blurb: "Shove for the line — a try threat near it, but riskier ball." },
];
export const KICKOFF_CALLS: { v: NonNullable<TeamTactics["kickoffCall"]>; label: string; blurb: string }[] = [
  { v: "long", label: "Long", blurb: "Kick deep, concede possession, win territory." },
  { v: "contest", label: "Contest", blurb: "Shorter, chase hard and try to win it back — high risk/reward." },
];

export const ATTACK_FORMATIONS: AttackFormation[] = ["1-3-3-1", "2-4-2", "1-3-2-2"];
export const DEFENSIVE_SYSTEMS: DefensiveSystem[] = ["drift", "blitz", "umbrella"];

export const FORMATION_BLURB: Record<AttackFormation, string> = {
  "1-3-3-1": "Balanced — a forward in each wide channel, two pods of three in midfield.",
  "2-4-2": "Tight — a big four-man midfield pod, twos on the flanks. Go-forward power.",
  "1-3-2-2": "Wide — an extra pod out near the touch for more width and edge threat.",
};

export const SYSTEM_BLURB: Record<DefensiveSystem, string> = {
  drift: "Push the attack toward the touchline, stay inside, use the touch as an extra defender.",
  blitz: "Fly off the line, shut down space, force the error — but vulnerable to kicks and offloads.",
  umbrella: "Rush hard through midfield, hang back on the edges — a curved line.",
};

/**
 * Forward pod layout per formation: each entry is one pod, with its size and a
 * lateral lane. lane < 0 = blindside; lane in [0,1] = fraction from the ruck out
 * to the open touch. Union has 8 forwards; sevens falls back to a simple spread.
 */
export const FORMATION_PODS: Record<AttackFormation, { size: number; lane: number }[]> = {
  "1-3-3-1": [
    { size: 1, lane: -1 },
    { size: 3, lane: 0.18 },
    { size: 3, lane: 0.52 },
    { size: 1, lane: 0.95 },
  ],
  "2-4-2": [
    { size: 2, lane: -1 },
    { size: 4, lane: 0.32 },
    { size: 2, lane: 0.9 },
  ],
  "1-3-2-2": [
    { size: 1, lane: -1 },
    { size: 3, lane: 0.16 },
    { size: 2, lane: 0.55 },
    { size: 2, lane: 0.92 },
  ],
};

export interface TacticsPreset {
  name: string;
  blurb: string;
  tactics: TeamTactics;
}

export const PRESETS: TacticsPreset[] = [
  { name: "Balanced", blurb: "No strong bias — a rounded game.", tactics: { ...DEFAULT_TACTICS } },
  {
    name: "Forward Power",
    blurb: "Tight, drive the maul, keep it close and physical.",
    tactics: { attackFormation: "2-4-2", defensiveSystem: "drift", defensiveLineSpeed: 40, defensiveAggression: 60, attackingWidth: 20, kickingTendency: 35, tempo: 35, ruckCommitment: 75, setPieceFocus: 85 },
  },
  {
    name: "Expansive",
    blurb: "Use the width, quick hands, ball in hand.",
    tactics: { attackFormation: "1-3-2-2", defensiveSystem: "drift", defensiveLineSpeed: 55, defensiveAggression: 45, attackingWidth: 85, kickingTendency: 20, tempo: 75, ruckCommitment: 30, setPieceFocus: 25 },
  },
  {
    name: "Kicking Game",
    blurb: "Territory first — kick, chase, squeeze.",
    tactics: { attackFormation: "1-3-3-1", defensiveSystem: "umbrella", defensiveLineSpeed: 65, defensiveAggression: 55, attackingWidth: 40, kickingTendency: 80, tempo: 45, ruckCommitment: 45, setPieceFocus: 55 },
  },
  {
    name: "Blitz Defence",
    blurb: "Fly off the line and force the error.",
    tactics: { attackFormation: "1-3-3-1", defensiveSystem: "blitz", defensiveLineSpeed: 90, defensiveAggression: 75, attackingWidth: 55, kickingTendency: 45, tempo: 55, ruckCommitment: 40, setPieceFocus: 45 },
  },
];

/** Map a 0..100 slider onto [lo, hi]. */
export function lerpSlider(v: number, lo: number, hi: number): number {
  return lo + (Math.max(0, Math.min(100, v)) / 100) * (hi - lo);
}
