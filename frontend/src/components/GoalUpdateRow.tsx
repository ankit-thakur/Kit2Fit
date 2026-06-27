import type { MyGroup } from '../api/groups';
import type { CreateLogResult } from '../api/logs';

interface GoalUpdateRowProps {
  group: MyGroup;
  metricValue: string;
  onMetricValueChange: (value: string) => void;
  result?: CreateLogResult;
  error?: string;
}

export function GoalUpdateRow({ group, metricValue, onMetricValueChange, result, error }: GoalUpdateRowProps) {
  const { membership } = group;

  return (
    <div className="rounded-2xl bg-white p-4 shadow">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-display font-bold text-ink">{group.name}</h3>
        <span className="text-xs text-gray-400">{group.goalCategory}</span>
      </div>
      {membership.goalDescription && (
        <p className="mb-2 text-sm text-gray-500">Goal: {membership.goalDescription}</p>
      )}
      <div className="flex items-center gap-2">
        <input
          type="number"
          step="any"
          value={metricValue}
          onChange={(e) => onMetricValueChange(e.target.value)}
          placeholder={`Current ${membership.metricUnit || 'value'}`}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:border-coral focus:outline-none"
        />
        {membership.metricUnit && <span className="text-sm text-gray-500">{membership.metricUnit}</span>}
      </div>

      {result && (
        <p className="mt-2 text-sm text-green-600">
          {result.durationPoints} pts duration
          {result.llmBonusPoint ? ` + 1 pt goal bonus (${result.llmBonusReason})` : ''}
          {result.adhocBonusPoint ? ' + 1 pt challenge bonus' : ''} = {result.totalPointsForDay} pts
        </p>
      )}
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </div>
  );
}
