import { useEffect, useState } from 'react';
import { MAX_DURATION_POINTS, MINUTES_PER_POINT } from '@shared/points';
import type { AdhocChallenge } from '@shared/types';
import { listChallenges } from '../api/groups';
import type { MyGroup } from '../api/groups';
import { today } from '../lib/date';

function formatDaysLeft(endDate: string): string {
  const today = new Date().toISOString().slice(0, 10);
  if (endDate === today) return 'Last day';
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysLeft = Math.round((new Date(endDate).getTime() - new Date(today).getTime()) / msPerDay);
  return `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`;
}

export function RulesAndScoringModal({ group, onClose }: { group: MyGroup; onClose: () => void }) {
  const [challenges, setChallenges] = useState<AdhocChallenge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listChallenges(group.groupId, today())
      .then((res) => setChallenges(res.challenges))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load challenges'))
      .finally(() => setIsLoading(false));
  }, [group.groupId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-4 shadow"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-ink">Rules &amp; scoring</h2>
          <button onClick={onClose} className="text-sm text-gray-400">
            Close
          </button>
        </div>

        <div className="mb-4 space-y-1">
          <h3 className="text-sm font-bold text-charcoal">{group.name}</h3>
          <p className="text-xs text-gray-400">
            {group.goalCategory} · {group.challengeStartDate.slice(0, 10)} → {group.challengeEndDate.slice(0, 10)}
          </p>
        </div>

        <div className="mb-4 space-y-2 rounded-lg bg-teal-pale p-3 text-sm text-teal-dark">
          <p>
            +1 point per {MINUTES_PER_POINT} minutes worked out, up to {MAX_DURATION_POINTS} points/day.
          </p>
          <p>
            +1 bonus point if today's workout contributes to your goal, or your tracked number moves toward your
            target.
          </p>
          <p>+1 bonus point if today's workout matches an active group challenge.</p>
          <p>+1 bonus point if your workout score (before this bonus) beats Kit's total for the day.</p>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-bold text-charcoal">Active challenges</h3>
          {isLoading ? (
            <p className="text-sm text-gray-400">Loading...</p>
          ) : error ? (
            <p className="text-sm text-red-500">{error}</p>
          ) : challenges.length === 0 ? (
            <p className="text-sm text-gray-400">No active challenges right now.</p>
          ) : (
            challenges.map((challenge) => (
              <div key={challenge.challengeId} className="rounded-lg bg-gray-50 px-3 py-2">
                <p className="text-sm font-semibold text-charcoal">{challenge.title}</p>
                <p className="mt-0.5 text-xs text-gray-600">{challenge.description}</p>
                <p className="mt-1 text-xs text-gray-400">{formatDaysLeft(challenge.endDate)}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
