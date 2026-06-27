import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ProgressEntry } from '../api/dashboard';

const COLORS = ['#0E7C7B', '#F6635C', '#14213D', '#6FD6C8', '#D94840', '#5B5B63'];

type Row = Record<string, number | string | null>;

function rawKey(nickname: string): string {
  return `${nickname}__raw`;
}

function mergeSeries(progress: ProgressEntry[]): Row[] {
  const byDate = new Map<string, Row>();
  for (const entry of progress) {
    for (const point of entry.series) {
      const row = byDate.get(point.date) ?? { date: point.date };
      row[entry.nickname] = point.percent;
      row[rawKey(entry.nickname)] = point.metricValue;
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
  unitByNickname,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
  unitByNickname: Map<string, string>;
}) {
  if (!active || !payload?.length) {
    return null;
  }
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-2 text-xs shadow">
      <p className="mb-1 font-semibold text-gray-700">{label}</p>
      {payload.map((entry) => {
        const raw = entry.payload[rawKey(entry.name)];
        const unit = unitByNickname.get(entry.name) ?? '';
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

export function ProgressLineChart({ progress }: { progress: ProgressEntry[] }) {
  if (progress.length === 0) {
    return <p className="text-center text-gray-400">No progress logged yet.</p>;
  }

  const data = mergeSeries(progress);
  const unitByNickname = new Map(progress.map((p) => [p.nickname, p.metricUnit]));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
        <Tooltip content={<ProgressTooltip unitByNickname={unitByNickname} />} />
        <Legend />
        {progress.map((entry, i) => (
          <Line
            key={entry.userId}
            type="monotone"
            dataKey={entry.nickname}
            stroke={COLORS[i % COLORS.length]}
            connectNulls
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
