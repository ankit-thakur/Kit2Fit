import { useEffect, useMemo, useState } from 'react';
import { listMyGroups, type MyGroup } from '../api/groups';
import { createLog, updateLog, listMyLogs, type CreateLogResult } from '../api/logs';
import type { DailyLog } from '@shared/types';
import { WorkoutForm } from '../components/WorkoutForm';
import { GoalUpdateRow } from '../components/GoalUpdateRow';
import { WeekStrip, type DayStatus } from '../components/WeekStrip';
import { ChallengeBanner } from '../components/ChallengeBanner';
import { ApiError } from '../api/client';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function weekDatesForOffset(offsetWeeks: number): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i - offsetWeeks * 7);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function parseMetricValue(raw: string | undefined): number | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

export function LogScreen() {
  const [groups, setGroups] = useState<MyGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [weekOffset, setWeekOffset] = useState(0);
  const weekDates = useMemo(() => weekDatesForOffset(weekOffset), [weekOffset]);
  const [isWeekLoading, setIsWeekLoading] = useState(false);

  const [selectedDate, setSelectedDate] = useState(today());
  const [logsByGroup, setLogsByGroup] = useState<Record<string, Record<string, DailyLog>>>({});
  const [minutesWorkedOut, setMinutesWorkedOut] = useState(0);
  const [description, setDescription] = useState('');
  const [metricValues, setMetricValues] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, CreateLogResult>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    listMyGroups()
      .then(({ groups: myGroups }) => setGroups(myGroups))
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Failed to load groups'))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (groups.length === 0) return;
    setIsWeekLoading(true);
    Promise.all(
      groups.map(async (g) => {
        const { logs } = await listMyLogs(g.groupId, {
          from: weekDates[0],
          to: weekDates[weekDates.length - 1],
        });
        return [g.groupId, logs] as const;
      }),
    )
      .then((entries) => {
        setLogsByGroup((prev) => {
          const next = { ...prev };
          for (const [groupId, logs] of entries) {
            next[groupId] = {
              ...next[groupId],
              ...Object.fromEntries(logs.map((log) => [log.date, log])),
            };
          }
          return next;
        });
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Failed to load logs'))
      .finally(() => setIsWeekLoading(false));
  }, [groups, weekDates]);

  useEffect(() => {
    if (groups.length === 0) return;
    const existing = groups.map((g) => logsByGroup[g.groupId]?.[selectedDate]).find(Boolean);
    setMinutesWorkedOut(existing?.minutesWorkedOut ?? 0);
    setDescription(existing?.description ?? '');
    setMetricValues(
      Object.fromEntries(
        groups.map((g) => {
          const log = logsByGroup[g.groupId]?.[selectedDate];
          const value = log?.metricValueAfter ?? g.membership.currentMetricValue;
          return [g.groupId, value === undefined || value === null ? '' : String(value)];
        }),
      ),
    );
    setResults(
      Object.fromEntries(
        groups.flatMap((g) => {
          const log = logsByGroup[g.groupId]?.[selectedDate];
          if (!log) return [];
          return [[g.groupId, {
            date: selectedDate,
            durationPoints: log.durationPoints,
            llmBonusPoint: log.llmBonusPoint,
            llmBonusReason: log.llmBonusReason,
            adhocBonusPoint: log.adhocBonusPoint,
            totalPointsForDay: log.totalPointsForDay,
          }]];
        }),
      ),
    );
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, groups]);

  const statusByDate = useMemo(() => {
    const status: Record<string, DayStatus> = {};
    for (const date of weekDates) {
      if (groups.length === 0) {
        status[date] = 'none';
        continue;
      }
      const loggedCount = groups.filter((g) => logsByGroup[g.groupId]?.[date]).length;
      status[date] = loggedCount === 0 ? 'none' : loggedCount === groups.length ? 'full' : 'partial';
    }
    return status;
  }, [groups, logsByGroup, weekDates]);

  function goToWeek(offset: number) {
    const dates = weekDatesForOffset(offset);
    setWeekOffset(offset);
    setSelectedDate(dates[dates.length - 1]);
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    setResults({});
    setErrors({});

    await Promise.all(
      groups.map(async (group) => {
        const metricValueAfter = parseMetricValue(metricValues[group.groupId]) ?? undefined;
        const existingLog = logsByGroup[group.groupId]?.[selectedDate];
        try {
          const result = existingLog
            ? await updateLog(group.groupId, selectedDate, {
                minutesWorkedOut,
                description,
                ...(metricValueAfter !== undefined ? { metricValueAfter } : {}),
              })
            : await createLog(group.groupId, {
                date: selectedDate,
                minutesWorkedOut,
                description,
                ...(metricValueAfter !== undefined ? { metricValueAfter } : {}),
              });
          setResults((prev) => ({ ...prev, [group.groupId]: result }));
          setLogsByGroup((prev) => ({
            ...prev,
            [group.groupId]: {
              ...prev[group.groupId],
              [selectedDate]: {
                ...existingLog,
                groupId: group.groupId,
                userId: group.membership.userId,
                date: selectedDate,
                minutesWorkedOut,
                description,
                ...(metricValueAfter !== undefined ? { metricValueAfter } : {}),
                durationPoints: result.durationPoints,
                llmBonusPoint: result.llmBonusPoint,
                llmBonusReason: result.llmBonusReason,
                adhocBonusPoint: result.adhocBonusPoint,
                totalPointsForDay: result.totalPointsForDay,
              } as DailyLog,
            },
          }));
        } catch (err) {
          const message = err instanceof ApiError ? err.message : 'Failed to log workout';
          setErrors((prev) => ({ ...prev, [group.groupId]: message }));
        }
      }),
    );

    setIsSubmitting(false);
  }

  if (isLoading) {
    return <div className="p-4 text-center text-gray-400">Loading...</div>;
  }

  if (loadError) {
    return <div className="p-4 text-center text-red-500">{loadError}</div>;
  }

  const isToday = selectedDate === today();
  const hasAnyExistingLog = groups.some((g) => logsByGroup[g.groupId]?.[selectedDate]);
  const dayLabel = isToday ? "Today's workout" : `Workout for ${selectedDate}`;

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Log workout</h1>
        <p className="text-sm text-gray-500">Confess your cardio.</p>
      </div>

      <ChallengeBanner groups={groups} />

      <WeekStrip
        dates={weekDates}
        selectedDate={selectedDate}
        onSelect={setSelectedDate}
        statusByDate={statusByDate}
        onPrevWeek={() => goToWeek(weekOffset + 1)}
        onNextWeek={() => goToWeek(Math.max(0, weekOffset - 1))}
        canGoNext={weekOffset > 0}
        isCurrentWeek={weekOffset === 0}
        isLoading={isWeekLoading}
      />

      <WorkoutForm
        heading={dayLabel}
        minutesWorkedOut={minutesWorkedOut}
        description={description}
        onMinutesChange={setMinutesWorkedOut}
        onDescriptionChange={setDescription}
      />

      {groups.length === 0 ? (
        <p className="rounded-2xl bg-white p-4 text-center text-gray-400 shadow">
          Can't log a workout for a group you're not in. Wild concept, we know. Fix it in the Profile tab.
        </p>
      ) : (
        groups.map((group) => (
          <GoalUpdateRow
            key={group.groupId}
            group={group}
            metricValue={metricValues[group.groupId] ?? ''}
            onMetricValueChange={(value) =>
              setMetricValues((prev) => ({ ...prev, [group.groupId]: value }))
            }
            result={results[group.groupId]}
            error={errors[group.groupId]}
          />
        ))
      )}

      {groups.length > 0 && (
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full rounded-lg bg-teal py-3 font-semibold text-white transition hover:bg-teal-dark disabled:opacity-50"
        >
          {isSubmitting ? 'Locking it in...' : `${hasAnyExistingLog ? 'Update' : 'Log'} this workout`}
        </button>
      )}
    </div>
  );
}
