/**
 * v2 scoring. The rules referenced here are docs/v2-spec.md §2.
 *
 * The whole model rests on one idea: a member is scored on keeping their own
 * pledge, so the denominator is their own commitment load rather than anything
 * compared against another member.
 */
import type { WeekPledgeResult, WeekScore } from './types';

/** Default ceiling on a member's total weekly commitments (R8). */
export const DEFAULT_COMMITMENT_CAP = 14;

export const MIN_TARGET_PER_WEEK = 1;
export const MAX_TARGET_PER_WEEK = 7;

export interface PledgeTarget {
  pledgeId: string;
  targetPerWeek: number;
}

/** How many completions a member logged against one pledge in a week. */
export interface PledgeTally {
  pledgeId: string;
  completed: number;
}

export interface WeekResult {
  /** Total completions counted, after capping each pledge at its target. */
  done: number;
  /** Total of every pledge's weekly target. */
  pledged: number;
  /** 0-100, rounded for display. `null` when there are no pledges. */
  adherencePct: number | null;
  /** Every pledge hit its target. */
  fullWeek: boolean;
  pledges: WeekPledgeResult[];
}

/**
 * Completions that count for one pledge in one week.
 *
 * Capped at the pledge's own target (R4): five sessions against a target of
 * three counts as three, so overachieving one pledge can never cover a miss in
 * another. Negative input is treated as zero.
 */
export function cappedCompletions(completed: number, target: number): number {
  if (!Number.isFinite(completed) || completed <= 0) return 0;
  return Math.min(Math.floor(completed), Math.max(0, target));
}

/**
 * Score a member's week.
 *
 * Adherence is total kept over total pledged (R2) — pooled, not averaged across
 * pledges. Pooling is what makes an extra pledge score-neutral for a member who
 * keeps it as reliably as their others (R3), and what stops a trivial 1x/week
 * pledge carrying the same weight as a 7x/week one.
 *
 * Partial credit is always given (R6): two of three is 67%, not zero.
 */
export function computeWeek(pledges: PledgeTarget[], tallies: PledgeTally[]): WeekResult {
  const completedByPledge = new Map<string, number>();
  for (const tally of tallies) {
    completedByPledge.set(
      tally.pledgeId,
      (completedByPledge.get(tally.pledgeId) ?? 0) + tally.completed,
    );
  }

  const results: WeekPledgeResult[] = pledges.map((pledge) => {
    const target = Math.max(0, pledge.targetPerWeek);
    const completed = cappedCompletions(completedByPledge.get(pledge.pledgeId) ?? 0, target);
    return { pledgeId: pledge.pledgeId, completed, target, fullWeek: target > 0 && completed >= target };
  });

  const done = results.reduce((sum, r) => sum + r.completed, 0);
  const pledged = results.reduce((sum, r) => sum + r.target, 0);

  return {
    done,
    pledged,
    // A member with no pledges has no adherence — not 0%, which would read as
    // failing rather than as "nothing set yet".
    adherencePct: pledged === 0 ? null : Math.round((done / pledged) * 100),
    fullWeek: results.length > 0 && results.every((r) => r.fullWeek),
    pledges: results,
  };
}

/** Total weekly commitments a set of pledges adds up to (R8). */
export function totalWeeklyCommitments(pledges: PledgeTarget[]): number {
  return pledges.reduce((sum, p) => sum + Math.max(0, p.targetPerWeek), 0);
}

export function exceedsCommitmentCap(
  pledges: PledgeTarget[],
  cap: number = DEFAULT_COMMITMENT_CAP,
): boolean {
  return totalWeeklyCommitments(pledges) > cap;
}

export function isValidTarget(targetPerWeek: number): boolean {
  return (
    Number.isInteger(targetPerWeek) &&
    targetPerWeek >= MIN_TARGET_PER_WEEK &&
    targetPerWeek <= MAX_TARGET_PER_WEEK
  );
}

/**
 * Consecutive full weeks ending at the most recent one, for a single pledge (R7).
 *
 * Pass only CLOSED weeks, oldest first: a week still in progress has not failed
 * yet, and counting it would break the streak every Monday.
 */
export function currentStreak(weeks: { fullWeek: boolean }[]): number {
  let streak = 0;
  for (let i = weeks.length - 1; i >= 0; i--) {
    if (!weeks[i].fullWeek) break;
    streak++;
  }
  return streak;
}

/** Streak for one pledge, given that pledge's closed weeks oldest first. */
export function pledgeStreak(weekScores: WeekScore[], pledgeId: string): number {
  return currentStreak(
    weekScores.map((score) => ({
      fullWeek: score.pledges.find((p) => p.pledgeId === pledgeId)?.fullWeek ?? false,
    })),
  );
}

/**
 * Adherence across several closed weeks.
 *
 * Computed from the raw counts rather than by averaging each week's rounded
 * percentage, which would drift.
 */
export function adherenceAcross(weekScores: WeekScore[]): number | null {
  const done = weekScores.reduce((sum, s) => sum + s.done, 0);
  const pledged = weekScores.reduce((sum, s) => sum + s.pledged, 0);
  return pledged === 0 ? null : Math.round((done / pledged) * 100);
}
