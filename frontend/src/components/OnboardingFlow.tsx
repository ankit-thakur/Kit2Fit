import { useState } from 'react';
import { MAX_DURATION_POINTS, MINUTES_PER_POINT } from '@shared/points';
import { GOAL_CATEGORY_OPTIONS, type GoalCategory } from '@shared/goalCategories';
import type { MyGroup } from '../api/groups';
import { updateMemberGoal, completeOnboarding } from '../api/groups';

const STEPS = ['welcome', 'points', 'logging', 'goal'] as const;

export function OnboardingFlow({
  group,
  userId,
  onComplete,
}: {
  group: MyGroup;
  userId: string;
  onComplete: () => void;
}) {
  const { membership } = group;
  const isLocked = new Date() >= new Date(group.challengeStartDate);
  const [stepIndex, setStepIndex] = useState(0);
  const [goalForm, setGoalForm] = useState({
    goalDescription: membership.goalDescription,
    currentMetricValue: String(membership.currentMetricValue),
    targetMetricValue: String(membership.targetMetricValue),
    goalCategory: membership.goalCategory ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const step = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;

  async function finish() {
    setIsSaving(true);
    setError(null);
    try {
      await completeOnboarding(group.groupId, userId);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to continue');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveGoalAndFinish() {
    if (!goalForm.goalCategory) {
      setError('Please select a goal category');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await updateMemberGoal(group.groupId, userId, {
        goalDescription: goalForm.goalDescription,
        currentMetricValue: Number(goalForm.currentMetricValue),
        targetMetricValue: Number(goalForm.targetMetricValue),
        goalCategory: goalForm.goalCategory as GoalCategory,
      });
      await completeOnboarding(group.groupId, userId);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save goal');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-4 shadow">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-ink">Welcome to {group.name}</h2>
          <div className="flex gap-1">
            {STEPS.map((s, i) => (
              <span
                key={s}
                className={`h-1.5 w-5 rounded-full ${i <= stepIndex ? 'bg-teal' : 'bg-gray-200'}`}
              />
            ))}
          </div>
        </div>

        {step === 'welcome' && (
          <div className="space-y-2 text-sm text-gray-600">
            <p>
              Kit2Fit started because Kit was not fit, but he wanted to get fit.
            </p>
            <p>
              Who is Kit, you ask? Well he's an absolute fitness beast with like really big muscles and a twelve pack and can run really far... who just needs a little extra motivation sometimes. So he created a way to get fit with friends.
            </p>
            <p>
              Compete against Kit and your friends to see who can get the most points by working out, achieving goals, and completing challenges.
            </p>
            <p>
              Rack up the most points by the end of the challenge window to win! Even if you don't win, you'll (hopefully) be in better shape than when you started.
            </p>
          </div>
        )}

        {step === 'points' && (
          <div className="space-y-2 rounded-lg bg-teal-pale p-3 text-sm text-teal-dark">
            <p>
              +1 point per {MINUTES_PER_POINT} minutes worked out, up to {MAX_DURATION_POINTS} points/day.
            </p>
            <p>+1 bonus point if today's workout contributes to your goal, or your tracked number moves toward your target.</p>
            <p>+1 bonus point if today's workout matches an active group challenge.</p>
            <p>+1 bonus point if your score beats Kit's total for the day.</p>
          </div>
        )}

        {step === 'logging' && (
          <div className="space-y-2 text-sm text-gray-600">
            <p>
              Each day, log your workout on the Log screen: how long you worked out, a quick description of what you
              did, and today's value for whatever number you're tracking toward your goal.
            </p>
            <p>
              If you completed an active group challenge, mention it in your description too.
            </p>
            <p>We tally your points automatically from there.</p>
          </div>
        )}

        {step === 'goal' && (
          <div className="space-y-3">
            {isLocked ? (
              <p className="text-sm text-gray-500">
                This challenge has already started, so goals are locked in. Ask your group admin if you need to
                change yours.
              </p>
            ) : (
              <>
                <p className="text-sm text-gray-600">
                  Goals should be measureable and achievable within the challenge window. Pick a goal category, set your starting and target values, and write a short description of your goal.
                </p>
                <p className="text-sm text-gray-600">
                  For example, if your goal is to lose weight, pick the "Weight management" category, set your starting and target weights, and write a description like "Lose 10 pounds by the end of the challenge."
                </p>
                <input
                  placeholder="Goal description"
                  value={goalForm.goalDescription}
                  onChange={(e) => setGoalForm((p) => ({ ...p, goalDescription: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="any"
                    placeholder="Starting value"
                    value={goalForm.currentMetricValue}
                    onChange={(e) => setGoalForm((p) => ({ ...p, currentMetricValue: e.target.value }))}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    step="any"
                    placeholder="Target value"
                    value={goalForm.targetMetricValue}
                    onChange={(e) => setGoalForm((p) => ({ ...p, targetMetricValue: e.target.value }))}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <select
                  value={goalForm.goalCategory}
                  onChange={(e) => setGoalForm((p) => ({ ...p, goalCategory: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="" disabled>
                    Select a goal category
                  </option>
                  {GOAL_CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} ({opt.metricUnit})
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        )}

        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

        <div className="mt-4 flex gap-2">
          {stepIndex > 0 && (
            <button
              onClick={() => setStepIndex((i) => i - 1)}
              className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-semibold text-gray-600"
            >
              Back
            </button>
          )}
          {!isLastStep && (
            <button
              onClick={() => setStepIndex((i) => i + 1)}
              className="flex-1 rounded-lg bg-teal py-2 text-sm font-semibold text-white"
            >
              Next
            </button>
          )}
          {isLastStep && isLocked && (
            <button
              onClick={finish}
              disabled={isSaving}
              className="flex-1 rounded-lg bg-teal py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Got it'}
            </button>
          )}
          {isLastStep && !isLocked && (
            <button
              onClick={handleSaveGoalAndFinish}
              disabled={isSaving}
              className="flex-1 rounded-lg bg-teal py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save goal & finish'}
            </button>
          )}
        </div>

        {isLastStep && !isLocked && (
          <button onClick={finish} disabled={isSaving} className="mt-2 w-full text-center text-xs text-gray-400">
            Skip for now, I'll set my goal later
          </button>
        )}
      </div>
    </div>
  );
}
