import { useEffect, useState } from 'react';
import { listMyGroups, type MyGroup } from '../api/groups';
import { getLeaderboard, getProgress, type LeaderboardEntry, type ProgressEntry } from '../api/dashboard';
import { LeaderboardChart } from '../components/LeaderboardChart';
import { ProgressLineChart } from '../components/ProgressLineChart';

export function DashboardScreen() {
  const [groups, setGroups] = useState<MyGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [progress, setProgress] = useState<ProgressEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listMyGroups()
      .then(({ groups: myGroups }) => {
        setGroups(myGroups);
        setSelectedGroupId(myGroups[0]?.groupId ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load groups'))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedGroupId) return;
    setIsLoading(true);
    Promise.all([getLeaderboard(selectedGroupId), getProgress(selectedGroupId)])
      .then(([leaderboardRes, progressRes]) => {
        setLeaderboard(leaderboardRes.leaderboard);
        setProgress(progressRes.progress);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load dashboard'))
      .finally(() => setIsLoading(false));
  }, [selectedGroupId]);

  if (groups.length === 0 && !isLoading) {
    return (
      <div className="mx-auto max-w-lg p-4">
        <h1 className="mb-4 text-2xl font-extrabold text-kit-dark">Dashboard</h1>
        <p className="rounded-2xl bg-white p-4 text-center text-gray-400 shadow">
          Join or create a group from the Profile tab to see your dashboard.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-kit-dark">Dashboard</h1>
        {groups.length > 1 && (
          <select
            value={selectedGroupId ?? ''}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
          >
            {groups.map((group) => (
              <option key={group.groupId} value={group.groupId}>
                {group.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && <p className="text-center text-red-500">{error}</p>}

      <div className="rounded-2xl bg-white p-4 shadow">
        <h2 className="mb-3 font-bold text-gray-800">Leaderboard</h2>
        <LeaderboardChart leaderboard={leaderboard} />
      </div>

      <div className="rounded-2xl bg-white p-4 shadow">
        <h2 className="mb-3 font-bold text-gray-800">Goal progress (% to goal)</h2>
        <ProgressLineChart progress={progress} />
      </div>
    </div>
  );
}
