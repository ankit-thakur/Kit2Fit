import { rotatedOrder } from './rotation';

const members = ['ankit', 'dana', 'kit', 'marcus', 'priya', 'sam'];

describe('tile rotation', () => {
  it('is stable for a given day', () => {
    expect(rotatedOrder(members, 3)).toEqual(rotatedOrder(members, 3));
  });

  it('keeps every member exactly once', () => {
    for (let day = 0; day < 10; day++) {
      expect([...rotatedOrder(members, day)].sort()).toEqual([...members].sort());
    }
  });

  it('gives every member the top slot exactly once over N days', () => {
    const topSlots = new Set<string>();
    for (let day = 0; day < members.length; day++) {
      topSlots.add(rotatedOrder(members, day)[0]);
    }
    expect(topSlots.size).toBe(members.length);
  });

  it('gives every member every position exactly once over N days', () => {
    for (const member of members) {
      const positions = new Set<number>();
      for (let day = 0; day < members.length; day++) {
        positions.add(rotatedOrder(members, day).indexOf(member));
      }
      expect(positions.size).toBe(members.length);
    }
  });

  it('advances by one position per day', () => {
    const today = rotatedOrder(members, 0);
    const tomorrow = rotatedOrder(members, 1);
    expect(tomorrow[1]).toBe(today[0]);
  });

  it('repeats after N days', () => {
    expect(rotatedOrder(members, 0)).toEqual(rotatedOrder(members, members.length));
  });

  it('handles a date before the challenge started', () => {
    const result = rotatedOrder(members, -2);
    expect(result).toHaveLength(members.length);
    expect(result.every((m) => typeof m === 'string')).toBe(true);
  });

  it('handles an empty group and a group of one', () => {
    expect(rotatedOrder([], 4)).toEqual([]);
    expect(rotatedOrder(['solo'], 4)).toEqual(['solo']);
  });
});
