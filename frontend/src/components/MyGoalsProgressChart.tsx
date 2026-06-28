import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { MyGoalProgress } from '../api/users';

const COLORS = ['#0E7C7B', '#F6635C', '#14213D', '#6FD6C8', '#D94840', '#5B5B63'];

type Row = Record<string, number | string | null>;

function rawKey(label: string): string {
  return `${label}__raw`;
}

function labelGoal(goal: MyGoalProgress, goalDescriptionCounts: Map<string, number>): string {
  const isDuplicate = (goalDescriptionCounts.get(goal.goalDescription) ?? 0) > 1;
  return isDuplicate ? `${goal.goalDescription} (${goal.groupName})` : goal.goalDescription;
}

function mergeSeries(goals: MyGoalProgress[], labelByGroupId: Map<string, string>): Row[] {
  const byDate = new Map<string, Row>();
  for (const goal of goals) {
    const label = labelByGroupId.get(goal.groupId)!;
    for (const point of goal.series) {
      const row = byDate.get(point.date) ?? { date: point.date };
      row[label] = point.percent;
      row[rawKey(label)] = point.metricValue;
      byDate.set(point.date, row);
    }
  }
  return [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

interface TooltipEntry {
  name: string;
  value: number | null;
  color: string;
  payload: Row;
}

function ProgressTooltip({
  active,
  payload,
  label,
  unitByLabel,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
  unitByLabel: Map<string, string>;
}) {
  if (!active || !payload?.length) {
    return null;
  }
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-2 text-xs shadow">
      <p className="mb-1 font-semibold text-gray-700">{label}</p>
      {payload.map((entry) => {
        const raw = entry.payload[rawKey(entry.name)];
        const unit = unitByLabel.get(entry.name) ?? '';
        return (
          <p key={entry.name} style={{ color: entry.color }}>
            {entry.name}: {entry.value == null ? 'no goal set' : `${Math.round(entry.value)}%`}
            {raw !== undefined ? ` (${raw}${unit ? ` ${unit}` : ''})` : ''}
          </p>
        );
      })}
    </div>
  );
}

export function MyGoalsProgressChart({ goals }: { goals: MyGoalProgress[] }) {
  if (goals.length === 0) {
    return <p className="text-center text-gray-400">No goals tracked yet.</p>;
  }

  const goalDescriptionCounts = new Map<string, number>();
  for (const goal of goals) {
    goalDescriptionCounts.set(goal.goalDescription, (goalDescriptionCounts.get(goal.goalDescription) ?? 0) + 1);
  }
  const labelByGroupId = new Map(goals.map((g) => [g.groupId, labelGoal(g, goalDescriptionCounts)]));
  const unitByLabel = new Map(goals.map((g) => [labelByGroupId.get(g.groupId)!, g.metricUnit]));

  const data = mergeSeries(goals, labelByGroupId);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 5, right: 8, bottom: 5, left: 3 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} width={32} />
        <Tooltip content={<ProgressTooltip unitByLabel={unitByLabel} />} />
        <Legend />
        {goals.map((goal, i) => (
          <Line
            key={goal.groupId}
            type="monotone"
            dataKey={labelByGroupId.get(goal.groupId)!}
            stroke={COLORS[i % COLORS.length]}
            connectNulls
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
