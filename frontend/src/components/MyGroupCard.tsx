import { useState } from 'react';
import type { MyGroup } from '../api/groups';
import { updateMemberGoal, removeMember } from '../api/groups';
import { GroupAdminPanel } from './GroupAdminPanel';
import { calculateGoalProgressPercent } from '@shared/progress';

export function MyGroupCard({
  group,
  currentUserId,
  onChanged,
}: {
  group: MyGroup;
  currentUserId: string;
  onChanged: () => void;
}) {
  const { membership } = group;
  const isAdmin = membership.role === 'admin';
  const isLocked = new Date() >= new Date(group.challengeStartDate);

  const [isManaging, setIsManaging] = useState(false);
  const [goalForm, setGoalForm] = useState({
    goalDescription: membership.goalDescription,
    currentMetricValue: String(membership.currentMetricValue),
    targetMetricValue: String(membership.targetMetricValue),
    metricUnit: membership.metricUnit,
  });
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const progressPercent = calculateGoalProgressPercent(
    membership.startingMetricValue,
    membership.targetMetricValue,
    membership.currentMetricValue,
  );

  async function handleSaveGoal() {
    setIsSaving(true);
    setError(null);
    try {
      await updateMemberGoal(group.groupId, currentUserId, {
        goalDescription: goalForm.goalDescription,
        currentMetricValue: Number(goalForm.currentMetricValue),
        targetMetricValue: Number(goalForm.targetMetricValue),
        metricUnit: goalForm.metricUnit,
      });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save goal');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleLeave() {
    try {
      await removeMember(group.groupId, currentUserId);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to leave group');
    }
  }

  return (
    <div className="space-y-3 rounded-2xl bg-white p-4 shadow">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-bold text-ink">{group.name}</h3>
          <p className="text-xs text-gray-400">
            {group.goalCategory} · {group.challengeStartDate.slice(0, 10)} → {group.challengeEndDate.slice(0, 10)}
          </p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <button onClick={() => setIsManaging((v) => !v)} className="text-xs font-semibold text-coral">
              {isManaging ? 'Hide' : 'Manage'}
            </button>
          )}
          {!isAdmin && (
            <button onClick={handleLeave} className="text-xs text-red-500">
              Leave
            </button>
          )}
        </div>
      </div>

      {isLocked ? (
        <p className="text-sm text-gray-500">
          Goal: {membership.goalDescription || 'no goal set (bold strategy)'} ({membership.startingMetricValue} →{' '}
          {membership.currentMetricValue} / {membership.targetMetricValue} {membership.metricUnit})
          {progressPercent !== null && <span className="font-semibold"> · {Math.round(progressPercent)}%</span>}
        </p>
      ) : (
        <div className="space-y-2">
          <input
            placeholder="Goal description"
            value={goalForm.goalDescription}
            onChange={(e) => setGoalForm((p) => ({ ...p, goalDescription: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-gray-600">Starting value</label>
              <input
                type="number"
                step="any"
                placeholder="e.g. 180"
                value={goalForm.currentMetricValue}
                onChange={(e) => setGoalForm((p) => ({ ...p, currentMetricValue: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-gray-600">Target value</label>
              <input
                type="number"
                step="any"
                placeholder="e.g. 160"
                value={goalForm.targetMetricValue}
                onChange={(e) => setGoalForm((p) => ({ ...p, targetMetricValue: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <input
            placeholder="Unit (lbs, min, etc)"
            value={goalForm.metricUnit}
            onChange={(e) => setGoalForm((p) => ({ ...p, metricUnit: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            onClick={handleSaveGoal}
            disabled={isSaving}
            className="w-full rounded-lg bg-teal-pale py-2 text-sm font-semibold text-teal-dark disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save goal'}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      {isManaging && <GroupAdminPanel groupId={group.groupId} onClose={() => setIsManaging(false)} />}
    </div>
  );
}
