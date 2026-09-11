/**
 * Kit2Fit v2 domain types.
 *
 * See docs/v2-spec.md §9. Nothing here carries a score derived from volume:
 * `CompletionDetail` is recorded and displayed but never reaches adherence.
 */

export type GroupRole = 'admin' | 'member';

export interface Group {
  groupId: string;
  name: string;
  /**
   * IANA zone, e.g. "America/Los_Angeles". A challenge is scored per group, so
   * "today" and "this week" have to mean the same thing for every member — a
   * per-user zone would put two members' completions in different weeks and
   * make the rollup ambiguous.
   */
  timeZone: string;
  /** YYYY-MM-DD, inclusive. */
  challengeStartDate: string;
  challengeEndDate: string;
  /** Ceiling on each member's total weekly commitments (spec R8). */
  commitmentCap: number;
  adminUserId: string;
  createdAt: string;
}

/**
 * Membership carries no goal. Pledges are their own records keyed by
 * membership, because a member can hold several (spec R2) and the same person
 * can pledge differently in different groups.
 */
export interface GroupMembership {
  groupId: string;
  userId: string;
  role: GroupRole;
  joinedAt: string;
  /** Set once the member has set pledges and seen the intro. */
  onboardedAt?: string;
}

/** What a pledge tracks alongside its completions. Tracked, never scored. */
export type MetricKind = 'weight' | 'reps' | 'lift' | 'none';

export interface Pledge {
  groupId: string;
  userId: string;
  pledgeId: string;
  /** Shown to the group, e.g. "Strength". */
  label: string;
  /** 1-7. A "daily" pledge is simply 7 (spec R1). */
  targetPerWeek: number;
  metricKind: MetricKind;
  createdAt: string;
  /** Set when the challenge starts; a locked pledge can no longer be edited (R9). */
  lockedAt?: string;
}

/**
 * Optional context attached to a completion. Recorded for the member's own
 * charts and their tile on the group board.
 *
 * This never affects adherence. Ninety minutes and twenty minutes are both
 * exactly one completion — relaxing that is how v1 ended up with volume
 * dominating the score (docs/v2-spec.md §4).
 */
export interface CompletionDetail {
  minutes?: number;
  note?: string;
  metricValue?: number;
}

export interface Completion {
  groupId: string;
  userId: string;
  pledgeId: string;
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  detail?: CompletionDetail;
  photoKey?: string;
  createdAt: string;
}

/** One pledge's outcome for a single week. */
export interface WeekPledgeResult {
  pledgeId: string;
  /** Already capped at `target` (R4). */
  completed: number;
  target: number;
  /** Whether this pledge hit its own target — the unit a streak counts (R7). */
  fullWeek: boolean;
}

/**
 * A member's week, materialised at week close.
 *
 * `done` and `pledged` are the source of truth: `adherencePct` is rounded for
 * display, so any average across weeks should be computed from the raw counts
 * rather than by averaging percentages.
 */
export interface WeekScore {
  groupId: string;
  userId: string;
  /** YYYY-MM-DD of the week's first day. */
  weekStart: string;
  done: number;
  pledged: number;
  /** 0-100, rounded. `null` when the member has no pledges. */
  adherencePct: number | null;
  /** Every pledge hit its target. */
  fullWeek: boolean;
  /** Per-pledge breakdown, so streaks are readable without rescanning completions. */
  pledges: WeekPledgeResult[];
}

export type RsvpMode = 'in_person' | 'virtual';

export interface GroupEvent {
  groupId: string;
  eventId: string;
  hostUserId: string;
  /** ISO timestamp. */
  startsAt: string;
  theme: string;
  location?: string;
  isVirtual: boolean;
  /** Set only when the host closes early; the lifecycle is otherwise derived. */
  closedAt?: string;
  createdAt: string;
}

export interface EventRsvp {
  eventId: string;
  userId: string;
  mode: RsvpMode;
  createdAt: string;
}
