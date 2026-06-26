import { useEffect, useState } from 'react';
import { listMyGroups, type MyGroup } from '../api/groups';
import { createLog, type CreateLogResult } from '../api/logs';
import { WorkoutForm } from '../components/WorkoutForm';
import { GoalUpdateRow } from '../components/GoalUpdateRow';
import { ApiError } from '../api/client';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function LogScreen() {
  const [groups, setGroups] = useState<MyGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [date, setDate] = useState(today());
  const [minutesWorkedOut, setMinutesWorkedOut] = useState(0);
  const [description, setDescription] = useState('');
  const [metricValues, setMetricValues] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, CreateLogResult>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    listMyGroups()
      .then(({ groups: myGroups }) => {
        setGroups(myGroups);
        setMetricValues(
          Object.fromEntries(
            myGroups.map((g) => [g.groupId, String(g.membership.currentMetricValue ?? '')]),
          ),
        );
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Failed to load groups'))
      .finally(() => setIsLoading(false));
  }, []);

  async function handleSubmit() {
    setIsSubmitting(true);
    setResults({});
    setErrors({});

    await Promise.all(
      groups.map(async (group) => {
        try {
          const result = await createLog(group.groupId, {
            date,
            minutesWorkedOut,
            description,
            metricValueAfter: Number(metricValues[group.groupId] ?? 0),
          });
          setResults((prev) => ({ ...prev, [group.groupId]: result }));
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

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-kit-dark">Log workout</h1>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
        />
      </div>

      <WorkoutForm
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
          {isSubmitting ? 'Logging...' : 'Log today’s workout'}
        </button>
      )}
    </div>
  );
}
