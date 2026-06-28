import { useEffect, useState } from 'react';
import type { MyGroup } from '../api/groups';
import { listChallenges } from '../api/groups';

interface ChallengeWithGroup {
  groupId: string;
  groupName: string;
  challengeId: string;
  description: string;
  activeDate: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function formatChallengeDate(date: string): string {
  if (date === todayIso()) return 'Today';
  if (date === tomorrowIso()) return 'Tomorrow';
  return date;
}

export function ChallengeBanner({ groups }: { groups: MyGroup[] }) {
  const [challenges, setChallenges] = useState<ChallengeWithGroup[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (groups.length === 0) {
      setChallenges([]);
      return;
    }
    Promise.all(
      groups.map((group) =>
        listChallenges(group.groupId).then(({ challenges: groupChallenges }) =>
          groupChallenges.map((challenge) => ({
            groupId: group.groupId,
            groupName: group.name,
            challengeId: challenge.challengeId,
            description: challenge.description,
            activeDate: challenge.activeDate,
          })),
        ),
      ),
    )
      .then((lists) => {
        const today = todayIso();
        const upcoming = lists
          .flat()
          .filter((challenge) => challenge.activeDate >= today)
          .sort((a, b) => a.activeDate.localeCompare(b.activeDate));
        setChallenges(upcoming);
      })
      .catch(() => setChallenges([]));
  }, [groups]);

  if (challenges.length === 0) {
    return null;
  }

  const showGroupName = new Set(challenges.map((c) => c.groupId)).size > 1;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex w-full items-center justify-between rounded-2xl bg-coral-pale px-4 py-3 text-left shadow"
      >
        <span className="text-sm font-semibold text-coral-dark">
          {challenges.length} challenge{challenges.length > 1 ? 's' : ''} available
        </span>
        <span className="text-xs font-semibold text-coral-dark">Details</span>
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="max-h-[70vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-4 shadow"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-ink">Active challenges</h2>
              <button onClick={() => setIsOpen(false)} className="text-sm text-gray-400">
                Close
              </button>
            </div>
            <div className="space-y-2">
              {challenges.map((challenge) => (
                <div key={`${challenge.groupId}-${challenge.challengeId}`} className="rounded-lg bg-gray-50 p-3">
                  <p className="text-sm font-semibold text-charcoal">{challenge.description}</p>
                  <p className="text-xs text-gray-400">
                    {formatChallengeDate(challenge.activeDate)}
                    {showGroupName ? ` · ${challenge.groupName}` : ''}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
