import { useEffect, useState, type FormEvent } from 'react';
import type { Group, GroupMembership, AdhocChallenge } from '@shared/types';
import {
  getGroup,
  updateGroup,
  addMember,
  removeMember,
  createInviteLink,
  createChallenge,
  listChallenges,
  deleteChallenge,
} from '../api/groups';
import { getLeaderboard } from '../api/dashboard';

export function GroupAdminPanel({ groupId, onClose }: { groupId: string; onClose: () => void }) {
  const [group, setGroup] = useState<(Group & { members: GroupMembership[] }) | null>(null);
  const [nicknamesById, setNicknamesById] = useState<Map<string, string>>(new Map());
  const [challenges, setChallenges] = useState<AdhocChallenge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [settingsForm, setSettingsForm] = useState({
    name: '',
    goalCategory: '',
    challengeStartDate: '',
    challengeEndDate: '',
  });
  const [memberEmail, setMemberEmail] = useState('');
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [challengeForm, setChallengeForm] = useState({ description: '', keywords: '', activeDate: '' });

  async function refresh() {
    setIsLoading(true);
    setError(null);
    try {
      const [groupRes, leaderboardRes, challengesRes] = await Promise.all([
        getGroup(groupId),
        getLeaderboard(groupId),
        listChallenges(groupId),
      ]);
      setGroup(groupRes);
      setNicknamesById(new Map(leaderboardRes.leaderboard.map((e) => [e.userId, e.nickname])));
      setChallenges(challengesRes.challenges);
      setSettingsForm({
        name: groupRes.name,
        goalCategory: groupRes.goalCategory,
        challengeStartDate: groupRes.challengeStartDate.slice(0, 10),
        challengeEndDate: groupRes.challengeEndDate.slice(0, 10),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load group');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  async function handleSaveSettings(e: FormEvent) {
    e.preventDefault();
    try {
      await updateGroup(groupId, settingsForm);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update group');
    }
  }

  async function handleAddMember(e: FormEvent) {
    e.preventDefault();
    try {
      await addMember(groupId, memberEmail);
      setMemberEmail('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add member');
    }
  }

  async function handleRemoveMember(userId: string) {
    try {
      await removeMember(groupId, userId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    }
  }

  async function handleGenerateInvite() {
    try {
      const { inviteUrl: url } = await createInviteLink(groupId);
      setInviteUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invite link');
    }
  }

  async function handleCreateChallenge(e: FormEvent) {
    e.preventDefault();
    try {
      await createChallenge(groupId, {
        description: challengeForm.description,
        keywords: challengeForm.keywords.split(',').map((k) => k.trim()).filter(Boolean),
        activeDate: challengeForm.activeDate,
      });
      setChallengeForm({ description: '', keywords: '', activeDate: '' });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create challenge');
    }
  }

  async function handleDeleteChallenge(challengeId: string) {
    try {
      await deleteChallenge(groupId, challengeId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete challenge');
    }
  }

  return (
    <div className="space-y-4 rounded-2xl bg-white p-4 shadow">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-800">Manage group</h3>
        <button onClick={onClose} className="text-sm text-gray-400">
          Close
        </button>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {isLoading || !group ? (
        <p className="text-center text-gray-400">Loading...</p>
      ) : (
        <>
          <form onSubmit={handleSaveSettings} className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-600">Group settings</h4>
            <input
              value={settingsForm.name}
              onChange={(e) => setSettingsForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
            <input
              value={settingsForm.goalCategory}
              onChange={(e) => setSettingsForm((p) => ({ ...p, goalCategory: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
            <div className="flex gap-2">
              <input
                type="date"
                value={settingsForm.challengeStartDate}
                onChange={(e) => setSettingsForm((p) => ({ ...p, challengeStartDate: e.target.value }))}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2"
              />
              <input
                type="date"
                value={settingsForm.challengeEndDate}
                onChange={(e) => setSettingsForm((p) => ({ ...p, challengeEndDate: e.target.value }))}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <button type="submit" className="w-full rounded-lg bg-kit py-2 font-semibold text-white hover:bg-kit-dark">
              Save settings
            </button>
          </form>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-600">Members</h4>
            {group.members.map((member) => (
              <div key={member.userId} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                <span className="text-sm text-gray-700">
                  {nicknamesById.get(member.userId) ?? member.userId} ({member.role})
                </span>
                {member.role !== 'admin' && (
                  <button onClick={() => handleRemoveMember(member.userId)} className="text-xs text-red-500">
                    Remove
                  </button>
                )}
              </div>
            ))}
            <form onSubmit={handleAddMember} className="flex gap-2">
              <input
                type="email"
                required
                placeholder="Add member by email"
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2"
              />
              <button type="submit" className="rounded-lg bg-kit px-3 py-2 font-semibold text-white hover:bg-kit-dark">
                Add
              </button>
            </form>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-600">Invite link</h4>
            <button
              onClick={handleGenerateInvite}
              className="w-full rounded-lg border border-kit py-2 font-semibold text-kit-dark"
            >
              Generate invite link
            </button>
            {inviteUrl && (
              <p className="break-all rounded-lg bg-gray-50 p-2 text-xs text-gray-600">{inviteUrl}</p>
            )}
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-600">Ad-hoc challenges</h4>
            {challenges.map((challenge) => (
              <div key={challenge.challengeId} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                <span className="text-sm text-gray-700">
                  {challenge.description} ({challenge.activeDate}) — {challenge.keywords.join(', ')}
                </span>
                <button onClick={() => handleDeleteChallenge(challenge.challengeId)} className="text-xs text-red-500">
                  Delete
                </button>
              </div>
            ))}
            <form onSubmit={handleCreateChallenge} className="space-y-2">
              <input
                required
                placeholder="Description (e.g. Jump rope day)"
                value={challengeForm.description}
                onChange={(e) => setChallengeForm((p) => ({ ...p, description: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
              <input
                required
                placeholder="Keywords, comma separated (e.g. jump rope, skip)"
                value={challengeForm.keywords}
                onChange={(e) => setChallengeForm((p) => ({ ...p, keywords: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
              <input
                required
                type="date"
                value={challengeForm.activeDate}
                onChange={(e) => setChallengeForm((p) => ({ ...p, activeDate: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
              <button type="submit" className="w-full rounded-lg bg-kit py-2 font-semibold text-white hover:bg-kit-dark">
                Add challenge
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
