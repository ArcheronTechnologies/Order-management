import type { Match, PlayerContribution } from "./match";
import type { Player, Side } from "./types";

export interface PlayerRating {
  player: Player;
  rating: number; // 4.5–10.0
  c: PlayerContribution;
}

const EMPTY: PlayerContribution = {
  carries: 0, tackles: 0, missed: 0, breaks: 0, tries: 0, turnovers: 0, kicks: 0,
};

function round1(v: number) {
  return Math.round(v * 10) / 10;
}
function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * A raw impact score. The engine resolves contact at fine granularity, so the
 * absolute counts are large — ratings are derived by comparing this to the rest
 * of the field rather than from absolute thresholds.
 */
function impact(c: PlayerContribution): number {
  return (
    c.carries * 0.2 +
    c.tackles * 0.3 +
    c.breaks * 1.2 +
    c.turnovers * 1.6 +
    c.tries * 9 +
    c.kicks * 0.25 -
    c.missed * 0.7
  );
}

function featuredOf(match: Match, side: Side): { player: Player; c: PlayerContribution }[] {
  return match.squads[side]
    .filter((p) => p.onField || match.contrib.has(p.id))
    .map((p) => ({ player: p, c: match.contrib.get(p.id) ?? EMPTY }));
}

/**
 * Rate every player who featured, normalising impact against the whole field so
 * ratings land in a believable spread (a quiet game ~6.3, a standout ~9, a
 * stinker ~5). Tries earn an extra nudge on top. Returns all, sorted best-first.
 */
export function rateMatch(match: Match): PlayerRating[] {
  const all = [...featuredOf(match, "home"), ...featuredOf(match, "away")];
  if (!all.length) return [];
  const scores = all.map((x) => impact(x.c));
  const mean = scores.reduce((s, v) => s + v, 0) / scores.length;
  const variance = scores.reduce((s, v) => s + (v - mean) ** 2, 0) / scores.length;
  const sd = Math.sqrt(variance) || 1;
  return all
    .map((x) => {
      const z = (impact(x.c) - mean) / sd;
      const rating = round1(clamp(6.6 + z * 0.95 + x.c.tries * 0.4, 4.5, 10));
      return { player: x.player, rating, c: x.c };
    })
    .sort((a, b) => b.rating - a.rating);
}

/** Ratings for one side, best-first. */
export function rateSide(match: Match, side: Side): PlayerRating[] {
  return rateMatch(match).filter((r) => r.player.side === side);
}

/** The best rating across both sides — the man of the match. */
export function manOfTheMatch(match: Match): PlayerRating | null {
  return rateMatch(match)[0] ?? null;
}
