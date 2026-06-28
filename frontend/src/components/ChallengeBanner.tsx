import { useEffect, useState } from 'react';
import type { MyGroup } from '../api/groups';
import { listChallenges } from '../api/groups';

interface ChallengeWithGroup {
  groupId: string;
  groupName: string;
  challengeId: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatWindow(startDate: string, endDate: string): string {
  const today = todayIso();
  if (startDate === endDate) return 'Today only';
  if (endDate === today) return 'Last day';
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysLeft = Math.round((new Date(endDate).getTime() - new Date(today).getTime()) / msPerDay);
  return `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`;
}

export function ChallengeBanner({ groups }: { groups: MyGroup[] }) {
  const [challenges, setChallenges] = useState<ChallengeWithGroup[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (groups.length === 0) {
      setChallenges([]);
      return;
    }
    const today = todayIso();
    Promise.all(
      groups.map((group) =>
        listChallenges(group.groupId, today).then(({ challenges: groupChallenges }) =>
          groupChallenges.map((challenge) => ({
            groupId: group.groupId,
            groupName: group.name,
            challengeId: challenge.challengeId,
            title: challenge.title,
            description: challenge.description,
            startDate: challenge.startDate,
            endDate: challenge.endDate,
          })),
        ),
      ),
    )
      .then((lists) => setChallenges(lists.flat()))
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
                  <p className="text-sm font-semibold text-charcoal">{challenge.title}</p>
                  <p className="mt-0.5 text-xs text-gray-600">{challenge.description}</p>
                  <p className="mt-1 text-xs text-gray-400">
                    {formatWindow(challenge.startDate, challenge.endDate)}
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
