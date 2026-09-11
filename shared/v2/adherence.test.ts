import {
  computeWeek,
  cappedCompletions,
  currentStreak,
  pledgeStreak,
  adherenceAcross,
  totalWeeklyCommitments,
  exceedsCommitmentCap,
  isValidTarget,
  type PledgeTarget,
} from './adherence';
import type { WeekScore } from './types';

const strength: PledgeTarget = { pledgeId: 'strength', targetPerWeek: 3 };
const eating: PledgeTarget = { pledgeId: 'eating', targetPerWeek: 5 };

function week(overrides: Partial<WeekScore>): WeekScore {
  return {
    groupId: 'g',
    userId: 'u',
    weekStart: '2026-01-05',
    done: 0,
    pledged: 0,
    adherencePct: null,
    fullWeek: false,
    pledges: [],
    ...overrides,
  };
}

describe('R2 — adherence is total kept over total pledged', () => {
  it('pools completions across pledges rather than averaging them', () => {
    const result = computeWeek(
      [strength, eating],
      [
        { pledgeId: 'strength', completed: 3 },
        { pledgeId: 'eating', completed: 4 },
      ],
    );
    expect(result.done).toBe(7);
    expect(result.pledged).toBe(8);
    expect(result.adherencePct).toBe(88);
  });

  it('weights a pledge by its target, so a 1x pledge cannot swing the score like a 7x one', () => {
    const heavy = computeWeek(
      [
        { pledgeId: 'daily', targetPerWeek: 7 },
        { pledgeId: 'weekly', targetPerWeek: 1 },
      ],
      [
        { pledgeId: 'daily', completed: 0 },
        { pledgeId: 'weekly', completed: 1 },
      ],
    );
    // Averaging per-pledge percentages would give 50%. Pooling gives 1 of 8.
    expect(heavy.adherencePct).toBe(13);
  });
});

describe('R3 — adding a pledge is score-neutral at equal reliability', () => {
  it('scores the same whether reliability is spread over one pledge or three', () => {
    const half = (target: number) => target / 2;

    const one = computeWeek(
      [{ pledgeId: 'a', targetPerWeek: 4 }],
      [{ pledgeId: 'a', completed: half(4) }],
    );

    const three = computeWeek(
      [
        { pledgeId: 'a', targetPerWeek: 4 },
        { pledgeId: 'b', targetPerWeek: 6 },
        { pledgeId: 'c', targetPerWeek: 2 },
      ],
      [
        { pledgeId: 'a', completed: half(4) },
        { pledgeId: 'b', completed: half(6) },
        { pledgeId: 'c', completed: half(2) },
      ],
    );

    expect(one.adherencePct).toBe(50);
    expect(three.adherencePct).toBe(50);
  });

  it('moves the score only when reliability differs between pledges', () => {
    const consistent = computeWeek(
      [strength, eating],
      [
        { pledgeId: 'strength', completed: 3 },
        { pledgeId: 'eating', completed: 5 },
      ],
    );
    const patchy = computeWeek(
      [strength, eating],
      [
        { pledgeId: 'strength', completed: 3 },
        { pledgeId: 'eating', completed: 2 },
      ],
    );
    expect(consistent.adherencePct).toBe(100);
    expect(patchy.adherencePct).toBe(63);
  });
});

describe('R4 — each pledge caps at its own target', () => {
  it('counts five sessions against a target of three as three', () => {
    expect(cappedCompletions(5, 3)).toBe(3);
  });

  it('does not let overachievement in one pledge cover a miss in another', () => {
    const result = computeWeek(
      [strength, eating],
      [
        { pledgeId: 'strength', completed: 9 },
        { pledgeId: 'eating', completed: 2 },
      ],
    );
    // 3 (capped from 9) + 2 of 8, never 8 of 8.
    expect(result.done).toBe(5);
    expect(result.adherencePct).toBe(63);
    expect(result.fullWeek).toBe(false);
  });

  it('clamps negative and fractional input', () => {
    expect(cappedCompletions(-4, 3)).toBe(0);
    expect(cappedCompletions(2.9, 3)).toBe(2);
  });
});

describe('R6 — partial credit', () => {
  it('gives a near miss real credit rather than zero', () => {
    const result = computeWeek([strength], [{ pledgeId: 'strength', completed: 2 }]);
    expect(result.adherencePct).toBe(67);
  });

  it('scores zero completions as zero without throwing', () => {
    expect(computeWeek([strength], []).adherencePct).toBe(0);
  });
});

describe('R7 — a full week is every pledge hitting its target', () => {
  it('is false when any pledge falls short', () => {
    const result = computeWeek(
      [strength, eating],
      [
        { pledgeId: 'strength', completed: 3 },
        { pledgeId: 'eating', completed: 4 },
      ],
    );
    expect(result.fullWeek).toBe(false);
    expect(result.pledges.find((p) => p.pledgeId === 'strength')?.fullWeek).toBe(true);
  });

  it('counts consecutive full weeks back from the most recent', () => {
    expect(
      currentStreak([{ fullWeek: true }, { fullWeek: false }, { fullWeek: true }, { fullWeek: true }]),
    ).toBe(2);
  });

  it('is zero when the latest closed week was missed', () => {
    expect(currentStreak([{ fullWeek: true }, { fullWeek: false }])).toBe(0);
  });

  it('tracks streaks per pledge, not per member', () => {
    const history = [
      week({ pledges: [{ pledgeId: 'strength', completed: 3, target: 3, fullWeek: true }, { pledgeId: 'eating', completed: 2, target: 5, fullWeek: false }] }),
      week({ pledges: [{ pledgeId: 'strength', completed: 3, target: 3, fullWeek: true }, { pledgeId: 'eating', completed: 5, target: 5, fullWeek: true }] }),
    ];
    expect(pledgeStreak(history, 'strength')).toBe(2);
    expect(pledgeStreak(history, 'eating')).toBe(1);
  });
});

describe('R8 — commitment cap', () => {
  it('sums weekly targets', () => {
    expect(totalWeeklyCommitments([strength, eating])).toBe(8);
  });

  it('rejects padding past the cap', () => {
    const padded = [strength, eating, { pledgeId: 'water', targetPerWeek: 7 }];
    expect(exceedsCommitmentCap(padded)).toBe(true);
    expect(exceedsCommitmentCap([strength, eating])).toBe(false);
  });

  it('accepts only whole targets from 1 to 7', () => {
    expect(isValidTarget(1)).toBe(true);
    expect(isValidTarget(7)).toBe(true);
    expect(isValidTarget(0)).toBe(false);
    expect(isValidTarget(8)).toBe(false);
    expect(isValidTarget(2.5)).toBe(false);
  });
});

describe('a member with no pledges', () => {
  it('has no adherence rather than 0%, which would read as failing', () => {
    const result = computeWeek([], []);
    expect(result.adherencePct).toBeNull();
    expect(result.fullWeek).toBe(false);
  });
});

describe('adherence across weeks', () => {
  it('uses raw counts so rounding does not drift', () => {
    const weeks = [
      week({ done: 1, pledged: 3 }),
      week({ done: 2, pledged: 3 }),
      week({ done: 3, pledged: 3 }),
    ];
    // 6 of 9 = 67%. Averaging 33 + 67 + 100 would give 66.7 -> 67 here, but
    // the raw-count path is the one that stays correct for uneven weeks.
    expect(adherenceAcross(weeks)).toBe(67);
  });

  it('stays correct when weekly commitment changes between weeks', () => {
    const weeks = [week({ done: 1, pledged: 1 }), week({ done: 0, pledged: 9 })];
    // Averaging percentages gives 50%. The truth is 1 of 10.
    expect(adherenceAcross(weeks)).toBe(10);
  });
});

describe('worked example from the spec', () => {
  it('reproduces week 2, where Sam and Dana score identically', () => {
    const sam = computeWeek(
      [{ pledgeId: 'run', targetPerWeek: 2 }],
      [{ pledgeId: 'run', completed: 2 }],
    );
    const dana = computeWeek(
      [{ pledgeId: 'move', targetPerWeek: 7 }],
      [{ pledgeId: 'move', completed: 7 }],
    );
    expect(sam.adherencePct).toBe(100);
    expect(dana.adherencePct).toBe(100);
    expect(sam.fullWeek).toBe(true);
    expect(dana.fullWeek).toBe(true);
  });
});
