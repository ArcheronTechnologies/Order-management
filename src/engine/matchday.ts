import type { Team } from "./teams";

/** A signed sponsor's pitch-side hoarding. */
export interface SponsorBoard {
  name: string;
  color: string;
}

/** Everything the renderer needs to draw the home club's match-day environment. */
export interface MatchEnvironment {
  ground: "owned" | "shared";
  facilities: number; // 1–5, home club — sizes the stand
  pitchCondition: number; // 0–100 — lush & striped vs worn & muddy
  attendance: number; // 0–1 fraction of capacity — crowd density
  homeColor: string;
  awayColor: string;
  boards: SponsorBoard[];
}

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Does the club own its ground outright, or rent a shared communal pitch? */
export function groundOf(club: Team, override?: "owned" | "shared"): "owned" | "shared" {
  return override ?? (club.facilities >= 3 ? "owned" : "shared");
}

/**
 * Pitch condition 0–100. An owned ground you maintain yourself can be pristine
 * (facilities/upkeep driven); a shared communal ground is chewed up by every
 * other team that plays on it, so it tops out scruffy however much you'd like.
 * `care` (0..1) is the club's groundskeeping effort on an owned pitch.
 */
export function pitchCondition(ground: "owned" | "shared", facilities: number, care = 0.6): number {
  if (ground === "owned") return Math.round(clamp(34 + facilities * 9 + care * 22, 20, 100));
  return Math.round(clamp(26 + facilities * 7, 20, 60)); // communal: worn, capped
}

/**
 * Crowd as a fraction of capacity, driven by the club's standing (reputation),
 * its facilities/profile, and recent results (formBonus in [-0.15, 0.2]).
 */
export function attendance(reputation: number, facilities: number, formBonus = 0): number {
  return clamp(0.18 + (reputation - 45) / 95 + facilities * 0.02 + formBonus, 0.05, 1);
}
