/**
 * Date-only helpers for v2.
 *
 * Dates are local calendar strings (YYYY-MM-DD), following v1's convention.
 * All arithmetic goes through Date.UTC so a member's completions never shift a
 * day because of the runtime's timezone — the string is the truth, and the Date
 * object is only ever an intermediate.
 */

/**
 * Day a week starts on, 0 = Sunday. Monday keeps the week ending on Sunday,
 * which is what the Your week screen means by "settles Sunday".
 *
 * Still open per docs/v2-spec.md: how a challenge that starts mid-week is
 * handled. Every function here takes the start day as a parameter so that
 * decision stays changeable.
 */
export const WEEK_STARTS_ON = 1;

const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function assertDate(date: string): void {
  if (!ISO_DATE.test(date)) {
    throw new Error(`Expected a YYYY-MM-DD date, received "${date}"`);
  }
}

function toUtc(date: string): number {
  assertDate(date);
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function toISO(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Day of week for a date string, 0 = Sunday. */
export function dayOfWeek(date: string): number {
  return new Date(toUtc(date)).getUTCDay();
}

export function addDays(date: string, days: number): string {
  return toISO(toUtc(date) + days * DAY_MS);
}

/** Whole days from `from` to `to`. Negative when `to` precedes `from`. */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

/** First day of the week containing `date`. */
export function weekStart(date: string, weekStartsOn: number = WEEK_STARTS_ON): string {
  const offset = (dayOfWeek(date) - weekStartsOn + 7) % 7;
  return addDays(date, -offset);
}

/** The seven dates of the week containing `date`, in order. */
export function weekDates(date: string, weekStartsOn: number = WEEK_STARTS_ON): string[] {
  const start = weekStart(date, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Whether two dates fall in the same week. */
export function isSameWeek(a: string, b: string, weekStartsOn: number = WEEK_STARTS_ON): boolean {
  return weekStart(a, weekStartsOn) === weekStart(b, weekStartsOn);
}

/**
 * Days remaining in the week, counting `date` itself. Monday of a Monday-start
 * week returns 7; the final day returns 1.
 */
export function daysLeftInWeek(date: string, weekStartsOn: number = WEEK_STARTS_ON): number {
  return 7 - ((dayOfWeek(date) - weekStartsOn + 7) % 7);
}

/**
 * Which day of the challenge `date` is, counting the start date as 0. Drives
 * the group board's daily tile rotation.
 */
export function challengeDayNumber(challengeStartDate: string, date: string): number {
  return daysBetween(challengeStartDate, date);
}
