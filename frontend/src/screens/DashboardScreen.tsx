import { useEffect, useState } from 'react';
import { listMyGroups, type MyGroup } from '../api/groups';
import { getLeaderboard, getProgress, type LeaderboardEntry, type ProgressEntry } from '../api/dashboard';
import { LeaderboardChart } from '../components/LeaderboardChart';
import { ProgressLineChart } from '../components/ProgressLineChart';
import { GroupDashboardWidget } from '../components/GroupDashboardWidget';
import { RulesAndScoringModal } from '../components/RulesAndScoringModal';

const WIDGET_STACK_MAX_GROUPS = 3;

function SingleGroupDashboard({ groups }: { groups: MyGroup[] }) {
  const [selectedGroupId, setSelectedGroupId] = useState(groups[0].groupId);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [progress, setProgress] = useState<ProgressEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  const selectedGroup = groups.find((g) => g.groupId === selectedGroupId)!;

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
      <div className="flex items-center gap-2">
        <select
          value={selectedGroupId}
          onChange={(e) => setSelectedGroupId(e.target.value)}
          className="flex-1 rounded-lg border border-gray-300 px-2 py-1 text-sm"
        >
          {groups.map((group) => (
            <option key={group.groupId} value={group.groupId}>
              {group.name}
            </option>
          ))}
        </select>
        <button
          onClick={() => setShowRules(true)}
          aria-label="Rules & scoring"
          className="flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 text-xs font-bold text-gray-400"
        >
          i
        </button>
      </div>

      {showRules && <RulesAndScoringModal group={selectedGroup} onClose={() => setShowRules(false)} />}

      {error && <p className="text-center text-red-500">{error}</p>}

      {isLoading ? (
        <p className="text-center text-gray-400">Loading...</p>
      ) : (
        <>
          <div className="rounded-2xl bg-white p-4 shadow">
            <h2 className="mb-3 font-display font-semibold text-charcoal">Leaderboard</h2>
            <LeaderboardChart leaderboard={leaderboard} />
          </div>

          <div className="rounded-2xl bg-white p-4 shadow">
            <h2 className="mb-3 font-display font-semibold text-charcoal">Goal progress (% to goal)</h2>
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
        <h1 className="mb-1 font-display text-2xl font-bold text-ink">Dashboard</h1>
        <p className="mb-4 text-sm text-gray-500">Where excuses come to die.</p>
        <p className="rounded-2xl bg-white p-4 text-center text-gray-400 shadow">
          No groups, no dashboard. We don't make the rules — okay, we do. Go join one from the Profile tab.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Dashboard</h1>
        <p className="text-sm text-gray-500">Where excuses come to die.</p>
      </div>

      {error && <p className="text-center text-red-500">{error}</p>}

      {groups.length <= WIDGET_STACK_MAX_GROUPS ? (
        groups.map((group) => <GroupDashboardWidget key={group.groupId} group={group} />)
      ) : (
        <SingleGroupDashboard groups={groups} />
      )}
    </div>
  );
}
