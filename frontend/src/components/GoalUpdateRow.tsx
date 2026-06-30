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
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Goal tracking {membership.metricUnit ? `(${membership.metricUnit})` : ''}
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            step="any"
            value={metricValue}
            onChange={(e) => onMetricValueChange(e.target.value)}
            placeholder={`Current ${membership.metricUnit || 'value'} (optional)`}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:border-coral focus:outline-none"
          />
          {membership.metricUnit && <span className="text-sm text-gray-500">{membership.metricUnit}</span>}
        </div>
      </div>

      {result && (
        <div className="mt-3 space-y-1 text-sm">
          <div className="flex items-center justify-between text-gray-600">
            <span>Duration</span>
            <span className="font-semibold">+{result.durationPoints}</span>
          </div>
          <div>
            <div className="flex items-center justify-between text-gray-600">
              <span>Goal bonus</span>
              <span className="font-semibold">+{result.llmBonusPoint}</span>
            </div>
            {result.llmBonusPoint === 1 && <p className="text-xs text-gray-400">{result.llmBonusReason}</p>}
          </div>
          <div className="flex items-center justify-between text-gray-600">
            <span>Challenge bonus</span>
            <span className="font-semibold">+{result.adhocBonusPoint}</span>
          </div>
          <div className="flex items-center justify-between text-gray-600">
            <span>Kit bonus</span>
            <span className="font-semibold">+{result.kitBonusPoint ?? 0}</span>
          </div>
          <div className="flex items-center justify-between border-t border-gray-200 pt-1 font-bold text-green-600">
            <span>Total</span>
            <span>{result.totalPointsForDay}</span>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </div>
  );
}
