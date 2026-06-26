import { useEffect, useMemo, useState } from 'react';
import { listMyGroups, type MyGroup } from '../api/groups';
import { createLog, updateLog, listMyLogs, type CreateLogResult } from '../api/logs';
import type { DailyLog } from '@shared/types';
import { WorkoutForm } from '../components/WorkoutForm';
import { GoalUpdateRow } from '../components/GoalUpdateRow';
import { WeekStrip, type DayStatus } from '../components/WeekStrip';
import { ApiError } from '../api/client';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function lastNDays(n: number): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
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

const WEEK_DATES = lastNDays(7);

export function LogScreen() {
  const [groups, setGroups] = useState<MyGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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
      .then(async ({ groups: myGroups }) => {
        setGroups(myGroups);
        const entries = await Promise.all(
          myGroups.map(async (g) => {
            const { logs } = await listMyLogs(g.groupId, {
              from: WEEK_DATES[0],
              to: WEEK_DATES[WEEK_DATES.length - 1],
            });
            return [g.groupId, Object.fromEntries(logs.map((log) => [log.date, log]))] as const;
          }),
        );
        setLogsByGroup(Object.fromEntries(entries));
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Failed to load groups'))
      .finally(() => setIsLoading(false));
  }, []);

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
    setResults({});
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, groups]);

  const statusByDate = useMemo(() => {
    const status: Record<string, DayStatus> = {};
    for (const date of WEEK_DATES) {
      if (groups.length === 0) {
        status[date] = 'none';
        continue;
      }
      const loggedCount = groups.filter((g) => logsByGroup[g.groupId]?.[date]).length;
      status[date] = loggedCount === 0 ? 'none' : loggedCount === groups.length ? 'full' : 'partial';
    }
    return status;
  }, [groups, logsByGroup]);

  async function handleSubmit() {
    setIsSubmitting(true);
    setResults({});

    const nextErrors: Record<string, string> = {};
    const toSubmit: { group: MyGroup; metricValueAfter: number }[] = [];
    for (const group of groups) {
      const parsed = parseMetricValue(metricValues[group.groupId]);
      if (parsed === null) {
        nextErrors[group.groupId] = `Enter your current ${group.membership.metricUnit || 'value'}`;
      } else {
        toSubmit.push({ group, metricValueAfter: parsed });
      }
    }
    setErrors(nextErrors);

    await Promise.all(
      toSubmit.map(async ({ group, metricValueAfter }) => {
        const existingLog = logsByGroup[group.groupId]?.[selectedDate];
        try {
          const result = existingLog
            ? await updateLog(group.groupId, selectedDate, {
                minutesWorkedOut,
                description,
                metricValueAfter,
              })
            : await createLog(group.groupId, {
                date: selectedDate,
                minutesWorkedOut,
                description,
                metricValueAfter,
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
                metricValueAfter,
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
      <h1 className="text-2xl font-extrabold text-kit-dark">Log workout</h1>

      <WeekStrip
        dates={WEEK_DATES}
        selectedDate={selectedDate}
        onSelect={setSelectedDate}
        statusByDate={statusByDate}
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
          Join or create a group from the Profile tab to start logging.
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
          className="w-full rounded-lg bg-kit py-3 font-semibold text-white transition hover:bg-kit-dark disabled:opacity-50"
        >
          {isSubmitting ? 'Saving...' : `${hasAnyExistingLog ? 'Update' : 'Log'} this workout`}
        </button>
      )}
    </div>
  );
}
