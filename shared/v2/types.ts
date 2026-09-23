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

export interface Pledge {
  groupId: string;
  userId: string;
  pledgeId: string;
  /** Shown to the group, e.g. "Strength". */
  label: string;
  /** 1-7. A "daily" pledge is simply 7 (spec R1). */
  targetPerWeek: number;
  /**
   * Names the one optional number this pledge captures — "Bench", "Sleep".
   * Freeform rather than an enum of kinds: a fixed vocabulary is what made v1's
   * goalCategory fail. Tracked, never scored.
   */
  metricLabel?: string;
  metricUnit?: string;
  /**
   * Week this version of the pledge takes effect (R9). Edits apply from next
   * week, so a target can be corrected but never lowered to rescue the week
   * currently in progress.
   */
  effectiveFrom: string;
  createdAt: string;
}

/**
 * A completion. Everything optional on it is recorded and displayed but never
 * scored: ninety minutes and twenty minutes are both exactly one completion.
 *
 * There is deliberately no `minutes` field. Duration is a metric like any other
 * if a member cares about it — making it first-class is how v1 ended up scoring
 * volume (docs/v2-spec.md §4).
 */
export interface Completion {
  groupId: string;
  userId: string;
  pledgeId: string;
  /** Local calendar date in the group's time zone, YYYY-MM-DD. */
  date: string;
  /** A few words, shown on the member's tile — "Bench day". */
  title?: string;
  /** Longer, for the member's own record. */
  note?: string;
  photoKey?: string;
  createdAt: string;
}

/**
 * A named number recorded on a date.
 *
 * With `pledgeId` it is captured when that pledge is completed; without one it
 * is a day metric such as weight, recordable on a rest day. Hanging metrics off
 * completions alone would make the series gappy on exactly the days people weigh
 * in — v1's jagged-graph problem in a new costume.
 */
export interface MetricEntry {
  groupId: string;
  userId: string;
  date: string;
  /** Stable key derived from the pledge's metricLabel, or a day metric's name. */
  metricKey: string;
  value: number;
  pledgeId?: string;
}

/** One per device, not per user: a member may install on phone and desktop. */
export interface PushSubscription {
  userId: string;
  subscriptionId: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  createdAt: string;
  lastSeenAt: string;
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
