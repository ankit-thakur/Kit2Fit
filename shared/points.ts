export const DEFAULT_WORKOUT_DURATION_CAP_MINUTES = 90;
export const MINUTES_PER_POINT = 15;

export function getMaxDurationPoints(capMinutes: number = DEFAULT_WORKOUT_DURATION_CAP_MINUTES): number {
  return Math.max(0, Math.floor(capMinutes / MINUTES_PER_POINT));
}

export function calculateDurationPoints(
  minutes: number,
  capMinutes: number = DEFAULT_WORKOUT_DURATION_CAP_MINUTES,
): number {
  const safeMinutes = Math.max(0, minutes);
  return Math.min(Math.floor(safeMinutes / MINUTES_PER_POINT), getMaxDurationPoints(capMinutes));
}

export function calculateTotalPoints(
  durationPoints: number,
  llmBonusPoint: 0 | 1,
  adhocBonusPoints: number,
  kitBonusPoint: 0 | 1 = 0,
): number {
  return durationPoints + llmBonusPoint + adhocBonusPoints + kitBonusPoint;
}
