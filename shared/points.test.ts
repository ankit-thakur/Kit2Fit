import { calculateDurationPoints, calculateTotalPoints } from './points';

describe('calculateDurationPoints', () => {
  it.each([
    [0, 0],
    [14, 0],
    [15, 1],
    [29, 1],
    [30, 2],
    [90, 6],
    [91, 6],
    [105, 6],
  ])('returns %i points for %i minutes', (minutes, expected) => {
    expect(calculateDurationPoints(minutes)).toBe(expected);
  });

  it('treats negative minutes as zero', () => {
    expect(calculateDurationPoints(-10)).toBe(0);
  });

  it('respects a custom workout duration cap', () => {
    expect(calculateDurationPoints(30, 30)).toBe(2);
    expect(calculateDurationPoints(45, 30)).toBe(2);
    expect(calculateDurationPoints(120, 120)).toBe(8);
    expect(calculateDurationPoints(150, 120)).toBe(8);
  });
});

describe('calculateTotalPoints', () => {
  it('sums duration, goal bonus, and ad-hoc bonus points', () => {
    expect(calculateTotalPoints(6, 1, 1)).toBe(8);
    expect(calculateTotalPoints(2, 0, 1)).toBe(3);
    expect(calculateTotalPoints(0, 0, 0)).toBe(0);
  });

  it('supports ad-hoc bonus points beyond a single point for custom challenge point values', () => {
    expect(calculateTotalPoints(4, 1, 5)).toBe(10);
    expect(calculateTotalPoints(0, 0, 10, 1)).toBe(11);
  });
});
