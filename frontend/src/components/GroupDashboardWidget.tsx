import { useEffect, useState } from 'react';
import { getLeaderboard, getProgress, type LeaderboardEntry, type ProgressEntry } from '../api/dashboard';
import type { MyGroup } from '../api/groups';
import { LeaderboardChart } from './LeaderboardChart';
import { ProgressLineChart } from './ProgressLineChart';
import { RulesAndScoringModal } from './RulesAndScoringModal';

export function GroupDashboardWidget({ group }: { group: MyGroup }) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [progress, setProgress] = useState<ProgressEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      getLeaderboard(group.groupId),
      getProgress(group.groupId, { from: group.challengeStartDate, to: group.challengeEndDate }),
    ])
      .then(([leaderboardRes, progressRes]) => {
        setLeaderboard(leaderboardRes.leaderboard);
        setProgress(progressRes.progress);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load dashboard'))
      .finally(() => setIsLoading(false));
  }, [group.groupId]);

  return (
    <div className="space-y-4 rounded-2xl bg-white p-4 shadow">
      <div className="flex items-center gap-2">
        <h2 className="font-display font-bold text-ink">{group.name}</h2>
        <button
          onClick={() => setShowRules(true)}
          aria-label="Rules & scoring"
          className="flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 text-xs font-bold text-gray-400"
        >
          i
        </button>
      </div>

      {showRules && <RulesAndScoringModal group={group} onClose={() => setShowRules(false)} />}

      {error && <p className="text-center text-red-500">{error}</p>}
      {isLoading ? (
        <p className="text-center text-gray-400">Loading...</p>
      ) : (
        <>
          <div>
            <h3 className="mb-3 text-sm font-bold text-charcoal">Leaderboard</h3>
            <div className="-mx-4 overflow-hidden">
              <LeaderboardChart leaderboard={leaderboard} />
            </div>
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
