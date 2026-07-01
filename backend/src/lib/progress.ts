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

export function calculateDailyHabitSeries(
  logs: { date: string; metricValueAfter: number }[],
  targetMetricValue: number,
): { date: string; percent: number; metricValue: number }[] {
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  let hitCount = 0;
  return sorted.map((log, idx) => {
    if (log.metricValueAfter >= targetMetricValue) hitCount++;
    return {
      date: log.date,
      percent: (hitCount / (idx + 1)) * 100,
      metricValue: log.metricValueAfter,
    };
  });
}
