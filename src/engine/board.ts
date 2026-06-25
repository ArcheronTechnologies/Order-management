import { Rng } from "./rng";

/** What a board member cares about most — colours how they vote and judge you. */
export type Priority = "Ambition" | "Prudence" | "Facilities" | "Youth" | "Community" | "Tradition";

export interface BoardMember {
  id: number;
  name: string;
  role: string;
  priority: Priority;
  approval: number; // 0–100, how much they rate the manager
}

const FORENAMES = ["Sven", "Britt", "Lars", "Karin", "Olof", "Margareta", "Bengt", "Astrid", "Gunnar", "Ingrid", "Per", "Eva"];
const SURNAMES = ["Lindholm", "Åkesson", "Brandt", "Holm", "Falk", "Sjögren", "Berg", "Lund", "Ek", "Stark", "Roos", "Hammar"];
const SEATS: { role: string; priority: Priority }[] = [
  { role: "Chairman", priority: "Ambition" },
  { role: "Treasurer", priority: "Prudence" },
  { role: "Grounds Director", priority: "Facilities" },
  { role: "Youth Officer", priority: "Youth" },
  { role: "Community Officer", priority: "Community" },
];

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}
function pick<T>(rng: Rng, a: T[]): T {
  return a[Math.floor(rng.next() * a.length)];
}

let memberId = 1;
function makeMember(rng: Rng, seat: { role: string; priority: Priority }): BoardMember {
  return {
    id: memberId++,
    name: `${pick(rng, FORENAMES)} ${pick(rng, SURNAMES)}`,
    role: seat.role,
    priority: seat.priority,
    approval: Math.round(clamp(48 + rng.range(-12, 16), 25, 80)),
  };
}

export function generateBoard(rng: Rng): BoardMember[] {
  return SEATS.map((s) => makeMember(rng, s));
}

/** Overall boardroom confidence in the manager (0–100). */
export function boardConfidence(board: BoardMember[]): number {
  if (!board.length) return 50;
  return Math.round(board.reduce((s, m) => s + m.approval, 0) / board.length);
}

export function moodLabel(approval: number): string {
  return approval >= 75 ? "Champions you" :
    approval >= 58 ? "Supportive" :
    approval >= 42 ? "Neutral" :
    approval >= 25 ? "Sceptical" : "Hostile";
}

export interface CapitalProposal {
  kind: "field" | "training" | "clubhouse";
  label: string;
  cost: number;
  affordable: boolean;
}

/** Does one member back a capital project? Their priority & opinion of you decide. */
function memberBacks(m: BoardMember, prop: CapitalProposal, rng: Rng): boolean {
  let p = 0.25 + (m.approval - 50) / 110; // base on how much they rate you
  switch (m.priority) {
    case "Facilities": p += 0.4; break; // loves building things
    case "Prudence": p -= prop.affordable ? 0.15 : 0.6; break; // hates spending, esp. beyond means
    case "Ambition": p += 0.12; break; // growth is good
    case "Community": p += prop.kind === "clubhouse" ? 0.2 : 0.05; break;
    default: break;
  }
  if (!prop.affordable) p -= 0.3;
  return rng.chance(clamp(p, 0.03, 0.95));
}

export interface VoteResult {
  approved: boolean;
  yes: number;
  no: number;
  votes: { member: BoardMember; backed: boolean }[];
}

export function holdVote(board: BoardMember[], prop: CapitalProposal, rng: Rng): VoteResult {
  const votes = board.map((m) => ({ member: m, backed: memberBacks(m, prop, rng) }));
  const yes = votes.filter((v) => v.backed).length;
  return { approved: yes * 2 > board.length, yes, no: board.length - yes, votes };
}

/** Lobby a member — a quiet word lifts their opinion of you a little. */
export function lobby(m: BoardMember, rng: Rng): number {
  const before = m.approval;
  m.approval = clamp(m.approval + rng.range(5, 11), 0, 100);
  return Math.round(m.approval - before);
}

export interface NoConfidenceResult {
  ousted: boolean;
  backers: number;
  replacement?: BoardMember;
}

/**
 * Move against a hostile member. The rest of the board backs you in proportion to
 * how much they rate you; a majority ousts the target (replaced by a fresh face).
 * Fail and the survivors sour on you for the failed coup.
 */
export function moveAgainst(board: BoardMember[], target: BoardMember, rng: Rng): NoConfidenceResult {
  const others = board.filter((m) => m.id !== target.id);
  const backers = others.filter((m) => rng.chance(clamp(0.15 + (m.approval - 45) / 90, 0.05, 0.9))).length;
  if (backers * 2 > others.length) {
    const idx = board.findIndex((m) => m.id === target.id);
    const replacement = makeMember(rng, { role: target.role, priority: target.priority });
    replacement.approval = Math.round(clamp(52 + rng.range(-6, 14), 35, 80)); // a fresh, friendlier face
    board[idx] = replacement;
    return { ousted: true, backers, replacement };
  }
  // failed coup — the board resents the manoeuvring
  for (const m of others) m.approval = clamp(m.approval - rng.range(3, 8), 0, 100);
  return { ousted: false, backers };
}

export interface BoardOutcome {
  finishPos: number;
  divisionSize: number;
  promoted: boolean;
  relegated: boolean;
  balance: number;
  invested: boolean; // bought/built something this season
  youthPlayed: boolean; // gave young players game time
  attendanceGood: boolean; // crowds reflect the community
}

/** End-of-season approval drift: each member judges you against their priority. */
export function updateBoard(board: BoardMember[], o: BoardOutcome, rng: Rng): void {
  const midTable = o.divisionSize / 2;
  for (const m of board) {
    let satisfied = false;
    switch (m.priority) {
      case "Ambition": satisfied = o.promoted || o.finishPos <= Math.max(2, midTable - 1); break;
      case "Prudence": satisfied = o.balance >= 0; break;
      case "Facilities": satisfied = o.invested; break;
      case "Youth": satisfied = o.youthPlayed; break;
      case "Community": satisfied = o.attendanceGood; break;
      case "Tradition": satisfied = !o.relegated; break;
    }
    const swing = satisfied ? rng.range(4, 9) : -rng.range(4, 9);
    // a strong/weak finish nudges everyone a little regardless
    const resultPull = (midTable - o.finishPos) * 0.8 + (o.relegated ? -4 : 0) + (o.promoted ? 4 : 0);
    m.approval = clamp(m.approval + swing + resultPull, 0, 100);
  }
}
