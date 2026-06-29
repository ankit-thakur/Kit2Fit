import { useEffect, useState } from 'react';
import { getMe } from '../api/users';
import { listMyGroups, type MyGroup } from '../api/groups';
import { OnboardingFlow } from './OnboardingFlow';

export function OnboardingGate() {
  const [userId, setUserId] = useState<string | null>(null);
  const [pendingGroups, setPendingGroups] = useState<MyGroup[]>([]);

  useEffect(() => {
    getMe()
      .then(async (me) => {
        setUserId(me.userId);
        const { groups } = await listMyGroups();
        setPendingGroups(groups.filter((g) => !g.membership.onboardedAt));
      })
      .catch(() => {
        // Not authenticated yet, or the request failed; just skip onboarding for now.
      });
  }, []);

  if (!userId || pendingGroups.length === 0) {
    return null;
  }

  return (
    <OnboardingFlow
      group={pendingGroups[0]}
      userId={userId}
      onComplete={() => setPendingGroups((prev) => prev.slice(1))}
    />
  );
}
