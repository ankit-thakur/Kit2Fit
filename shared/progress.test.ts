import { calculateGoalProgressPercent } from './progress';

describe('calculateGoalProgressPercent', () => {
  it('handles a decreasing goal (e.g. weight loss)', () => {
    expect(calculateGoalProgressPercent(178, 165, 178)).toBe(0);
    expect(calculateGoalProgressPercent(178, 165, 171.5)).toBeCloseTo(50);
    expect(calculateGoalProgressPercent(178, 165, 165)).toBe(100);
  });

  it('handles an increasing goal (e.g. pushup count)', () => {
    expect(calculateGoalProgressPercent(10, 30, 10)).toBe(0);
    expect(calculateGoalProgressPercent(10, 30, 20)).toBeCloseTo(50);
    expect(calculateGoalProgressPercent(10, 30, 30)).toBe(100);
  });

  it('clamps overshoot and regression to 0-100', () => {
    expect(calculateGoalProgressPercent(178, 165, 160)).toBe(100);
    expect(calculateGoalProgressPercent(178, 165, 185)).toBe(0);
    expect(calculateGoalProgressPercent(10, 30, 5)).toBe(0);
    expect(calculateGoalProgressPercent(10, 30, 35)).toBe(100);
  });

  it('returns null when no goal range is configured', () => {
    expect(calculateGoalProgressPercent(0, 0, 0)).toBeNull();
    expect(calculateGoalProgressPercent(165, 165, 165)).toBeNull();
  });
});
