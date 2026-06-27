import { useEffect, useState } from 'react';
import { getLeaderboard, getProgress, type LeaderboardEntry, type ProgressEntry } from '../api/dashboard';
import type { MyGroup } from '../api/groups';
import { LeaderboardChart } from './LeaderboardChart';
import { ProgressLineChart } from './ProgressLineChart';

export function GroupDashboardWidget({ group }: { group: MyGroup }) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [progress, setProgress] = useState<ProgressEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([getLeaderboard(group.groupId), getProgress(group.groupId)])
      .then(([leaderboardRes, progressRes]) => {
        setLeaderboard(leaderboardRes.leaderboard);
        setProgress(progressRes.progress);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load dashboard'))
      .finally(() => setIsLoading(false));
  }, [group.groupId]);

  return (
    <div className="space-y-4 rounded-2xl bg-white p-4 shadow">
      <h2 className="font-display font-bold text-ink">{group.name}</h2>

      {error && <p className="text-center text-red-500">{error}</p>}
      {isLoading ? (
        <p className="text-center text-gray-400">Loading...</p>
      ) : (
        <>
          <div>
            <h3 className="mb-3 text-sm font-bold text-charcoal">Leaderboard</h3>
            <LeaderboardChart leaderboard={leaderboard} />
          </div>
          <div>
            <h3 className="mb-3 text-sm font-bold text-charcoal">Goal progress (% to goal)</h3>
            <ProgressLineChart progress={progress} />
          </div>
        </>
      )}
    </div>
  );
}
