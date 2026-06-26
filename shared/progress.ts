export function calculateGoalProgressPercent(
  startingValue: number,
  targetValue: number,
  currentValue: number,
): number | null {
  if (targetValue === startingValue) {
    return null;
  }
  const pct = ((currentValue - startingValue) / (targetValue - startingValue)) * 100;
  return Math.max(0, Math.min(100, pct));
}
