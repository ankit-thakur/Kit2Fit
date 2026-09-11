import {
  addDays,
  challengeDayNumber,
  dayOfWeek,
  daysBetween,
  daysLeftInWeek,
  isSameWeek,
  weekDates,
  weekStart,
  isValidTimeZone,
  todayInTimeZone,
  isWithinChallenge,
} from './week';

describe('week boundaries', () => {
  it('starts the week on Monday', () => {
    // 2026-09-09 is a Wednesday.
    expect(dayOfWeek('2026-09-09')).toBe(3);
    expect(weekStart('2026-09-09')).toBe('2026-09-07');
  });

  it('treats Monday as its own week start', () => {
    expect(weekStart('2026-09-07')).toBe('2026-09-07');
  });

  it('keeps Sunday in the week that began the previous Monday', () => {
    expect(weekStart('2026-09-13')).toBe('2026-09-07');
    expect(weekStart('2026-09-14')).toBe('2026-09-14');
  });

  it('honours a different start day', () => {
    expect(weekStart('2026-09-09', 0)).toBe('2026-09-06');
  });

  it('lists the seven dates of a week in order', () => {
    expect(weekDates('2026-09-09')).toEqual([
      '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10',
      '2026-09-11', '2026-09-12', '2026-09-13',
    ]);
  });
});

describe('date arithmetic', () => {
  it('crosses a month boundary', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(weekStart('2026-03-01')).toBe('2026-02-23');
  });

  it('crosses a year boundary', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(daysBetween('2026-12-30', '2027-01-02')).toBe(3);
  });

  it('handles a leap day', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
  });

  it('goes backwards', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-03-01', '2026-02-28')).toBe(-1);
  });

  it('rejects input that is not a plain date', () => {
    expect(() => addDays('2026-09-09T10:00:00Z', 1)).toThrow();
    expect(() => weekStart('not-a-date')).toThrow();
  });
});

describe('days left in the week', () => {
  it('counts today, so Monday has the full seven', () => {
    expect(daysLeftInWeek('2026-09-07')).toBe(7);
  });

  it('leaves one on the final day', () => {
    expect(daysLeftInWeek('2026-09-13')).toBe(1);
  });

  it('matches the "3 days left" a Friday shows', () => {
    expect(daysLeftInWeek('2026-09-11')).toBe(3);
  });
});

describe('same week', () => {
  it('groups Monday through Sunday together', () => {
    expect(isSameWeek('2026-09-07', '2026-09-13')).toBe(true);
    expect(isSameWeek('2026-09-13', '2026-09-14')).toBe(false);
  });
});

describe('challenge day number', () => {
  it('counts the start date as day zero', () => {
    expect(challengeDayNumber('2026-09-07', '2026-09-07')).toBe(0);
    expect(challengeDayNumber('2026-09-07', '2026-09-14')).toBe(7);
  });

  it('goes negative before the challenge starts', () => {
    expect(challengeDayNumber('2026-09-07', '2026-09-05')).toBe(-2);
  });
});

describe('time zones', () => {
  it('accepts real IANA zones and rejects nonsense', () => {
    expect(isValidTimeZone('America/Los_Angeles')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus_Mons')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
  });

  it('resolves the group date, not the runtime date', () => {
    // 2026-09-12T03:00Z is still the 11th in Los Angeles.
    const instant = new Date('2026-09-12T03:00:00Z');
    expect(todayInTimeZone('UTC', instant)).toBe('2026-09-12');
    expect(todayInTimeZone('America/Los_Angeles', instant)).toBe('2026-09-11');
    expect(todayInTimeZone('Asia/Tokyo', instant)).toBe('2026-09-12');
  });

  it('pads single-digit months and days', () => {
    expect(todayInTimeZone('UTC', new Date('2026-01-05T12:00:00Z'))).toBe('2026-01-05');
  });

  it('throws on an unknown zone rather than silently using UTC', () => {
    expect(() => todayInTimeZone('Nowhere/Anywhere')).toThrow();
  });
});

describe('challenge window', () => {
  it('includes both end dates', () => {
    expect(isWithinChallenge('2026-09-07', '2026-09-07', '2026-11-01')).toBe(true);
    expect(isWithinChallenge('2026-11-01', '2026-09-07', '2026-11-01')).toBe(true);
    expect(isWithinChallenge('2026-09-06', '2026-09-07', '2026-11-01')).toBe(false);
    expect(isWithinChallenge('2026-11-02', '2026-09-07', '2026-11-01')).toBe(false);
  });
});
