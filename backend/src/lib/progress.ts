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

export function calculateChallengeDayCount(startDate: string, endDate: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const days = Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / msPerDay) + 1;
  return Math.max(1, days);
}

export function calculateDailyHabitSeries(
  logs: { date: string; metricValueAfter: number }[],
  targetMetricValue: number,
  totalChallengeDays: number,
): { date: string; percent: number | null; metricValue: number }[] {
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  let hitCount = 0;
  return sorted.map((log) => {
    if (log.metricValueAfter >= targetMetricValue) hitCount++;
    return {
      date: log.date,
      percent: calculateGoalProgressPercent(0, totalChallengeDays, hitCount),
      metricValue: log.metricValueAfter,
    };
  });
}
