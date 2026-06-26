import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ProgressEntry } from '../api/dashboard';

const COLORS = ['#ff6b35', '#2a9d8f', '#3a86ff', '#8338ec', '#e63946', '#ffb703'];

function mergeSeries(progress: ProgressEntry[]): Record<string, number | string>[] {
  const byDate = new Map<string, Record<string, number | string>>();
  for (const entry of progress) {
    for (const point of entry.series) {
      const row = byDate.get(point.date) ?? { date: point.date };
      row[entry.nickname] = point.value;
      byDate.set(point.date, row);
    }
  }
  return [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

export function ProgressLineChart({ progress }: { progress: ProgressEntry[] }) {
  if (progress.length === 0) {
    return <p className="text-center text-gray-400">No progress logged yet.</p>;
  }

  const data = mergeSeries(progress);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
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
