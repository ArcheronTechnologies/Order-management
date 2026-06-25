/**
 * Team tactics — every field is a 0..100 slider (50 = balanced). These feed the
 * match engine: the same squad set up differently should visibly play differently.
 */
export interface TeamTactics {
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
}

export const DEFAULT_TACTICS: TeamTactics = {
  defensiveLineSpeed: 50,
  defensiveAggression: 50,
  attackingWidth: 50,
  kickingTendency: 50,
  tempo: 50,
  ruckCommitment: 50,
  setPieceFocus: 50,
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
    tactics: { defensiveLineSpeed: 40, defensiveAggression: 60, attackingWidth: 20, kickingTendency: 35, tempo: 35, ruckCommitment: 75, setPieceFocus: 85 },
  },
  {
    name: "Expansive",
    blurb: "Use the width, quick hands, ball in hand.",
    tactics: { defensiveLineSpeed: 55, defensiveAggression: 45, attackingWidth: 85, kickingTendency: 20, tempo: 75, ruckCommitment: 30, setPieceFocus: 25 },
  },
  {
    name: "Kicking Game",
    blurb: "Territory first — kick, chase, squeeze.",
    tactics: { defensiveLineSpeed: 65, defensiveAggression: 55, attackingWidth: 40, kickingTendency: 80, tempo: 45, ruckCommitment: 45, setPieceFocus: 55 },
  },
  {
    name: "Blitz Defence",
    blurb: "Fly off the line and force the error.",
    tactics: { defensiveLineSpeed: 90, defensiveAggression: 75, attackingWidth: 55, kickingTendency: 45, tempo: 55, ruckCommitment: 40, setPieceFocus: 45 },
  },
];

/** Map a 0..100 slider onto [lo, hi]. */
export function lerpSlider(v: number, lo: number, hi: number): number {
  return lo + (Math.max(0, Math.min(100, v)) / 100) * (hi - lo);
}
