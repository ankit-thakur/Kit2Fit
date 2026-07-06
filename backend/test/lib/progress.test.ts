import {
  calculateGoalProgressPercent,
  calculateChallengeDayCount,
  calculateDailyHabitSeries,
} from '../../src/lib/progress';

describe('calculateChallengeDayCount', () => {
  it('counts inclusively across a multi-day range', () => {
    expect(calculateChallengeDayCount('2026-06-01', '2026-06-30')).toBe(30);
  });

  it('returns 1 for a single-day challenge', () => {
    expect(calculateChallengeDayCount('2026-06-01', '2026-06-01')).toBe(1);
  });
});

describe('calculateDailyHabitSeries', () => {
  it('scores progress against the whole challenge window, not just logged days', () => {
    // Motivating case: 10,000 step target, 30-day challenge, one miss then one hit logged.
    const series = calculateDailyHabitSeries(
      [
        { date: '2026-06-01', metricValueAfter: 9000 },
        { date: '2026-06-02', metricValueAfter: 11000 },
      ],
      10000,
      30,
    );

    expect(series).toEqual([
      { date: '2026-06-01', percent: 0, metricValue: 9000 },
      { date: '2026-06-02', percent: calculateGoalProgressPercent(0, 30, 1), metricValue: 11000 },
    ]);
    // 1 hit out of a 30-day challenge should read nowhere near the old logged-days-only 50%.
    expect(series[1].percent).toBeCloseTo((1 / 30) * 100);
  });

  it('accumulates hit count across out-of-order logs', () => {
    const series = calculateDailyHabitSeries(
      [
        { date: '2026-06-03', metricValueAfter: 12000 },
        { date: '2026-06-01', metricValueAfter: 5000 },
        { date: '2026-06-02', metricValueAfter: 10000 },
      ],
      10000,
      10,
    );

    expect(series.map((s) => s.date)).toEqual(['2026-06-01', '2026-06-02', '2026-06-03']);
    expect(series.map((s) => s.percent)).toEqual([0, 10, 20]);
  });
});
