import { useEffect, useState } from 'react';
import { listMyGroups, type MyGroup } from '../api/groups';
import { getLeaderboard, getProgress, type LeaderboardEntry, type ProgressEntry } from '../api/dashboard';
import { LeaderboardChart } from '../components/LeaderboardChart';
import { ProgressLineChart } from '../components/ProgressLineChart';
import { GroupDashboardWidget } from '../components/GroupDashboardWidget';

const WIDGET_STACK_MAX_GROUPS = 3;

function SingleGroupDashboard({ groups }: { groups: MyGroup[] }) {
  const [selectedGroupId, setSelectedGroupId] = useState(groups[0].groupId);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [progress, setProgress] = useState<ProgressEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([getLeaderboard(selectedGroupId), getProgress(selectedGroupId)])
      .then(([leaderboardRes, progressRes]) => {
        setLeaderboard(leaderboardRes.leaderboard);
        setProgress(progressRes.progress);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load dashboard'))
      .finally(() => setIsLoading(false));
  }, [selectedGroupId]);

  return (
    <div className="space-y-4">
      <select
        value={selectedGroupId}
        onChange={(e) => setSelectedGroupId(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-2 py-1 text-sm"
      >
        {groups.map((group) => (
          <option key={group.groupId} value={group.groupId}>
            {group.name}
          </option>
        ))}
      </select>

      {error && <p className="text-center text-red-500">{error}</p>}

      {isLoading ? (
        <p className="text-center text-gray-400">Loading...</p>
      ) : (
        <>
          <div className="rounded-2xl bg-white p-4 shadow">
            <h2 className="mb-3 font-bold text-gray-800">Leaderboard</h2>
            <LeaderboardChart leaderboard={leaderboard} />
          </div>

          <div className="rounded-2xl bg-white p-4 shadow">
            <h2 className="mb-3 font-bold text-gray-800">Goal progress (% to goal)</h2>
            <ProgressLineChart progress={progress} />
          </div>
        </>
      )}
    </div>
  );
}

export function DashboardScreen() {
  const [groups, setGroups] = useState<MyGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listMyGroups()
      .then(({ groups: myGroups }) => setGroups(myGroups))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load groups'))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return <div className="p-4 text-center text-gray-400">Loading...</div>;
  }

  if (groups.length === 0) {
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
      <h1 className="text-2xl font-extrabold text-kit-dark">Dashboard</h1>

      {error && <p className="text-center text-red-500">{error}</p>}

      {groups.length <= WIDGET_STACK_MAX_GROUPS ? (
        groups.map((group) => <GroupDashboardWidget key={group.groupId} group={group} />)
      ) : (
        <SingleGroupDashboard groups={groups} />
      )}
    </div>
  );
}
