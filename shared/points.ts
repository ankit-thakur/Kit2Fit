export const MAX_DURATION_POINTS = 6;
export const MINUTES_PER_POINT = 15;

export function calculateDurationPoints(minutes: number): number {
  const safeMinutes = Math.max(0, minutes);
  return Math.min(Math.floor(safeMinutes / MINUTES_PER_POINT), MAX_DURATION_POINTS);
}

export function calculateTotalPoints(
  durationPoints: number,
  llmBonusPoint: 0 | 1,
  adhocBonusPoint: 0 | 1,
  kitBonusPoint: 0 | 1 = 0,
): number {
  return durationPoints + llmBonusPoint + adhocBonusPoint + kitBonusPoint;
}
