import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { LeaderboardEntry } from '../api/dashboard';

const COLORS = ['#0E7C7B', '#F6635C', '#14213D', '#6FD6C8', '#D94840', '#5B5B63'];

export function LeaderboardChart({ leaderboard }: { leaderboard: LeaderboardEntry[] }) {
  if (leaderboard.length === 0) {
    return <p className="text-center text-gray-400">No points logged yet.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, leaderboard.length * 50)}>
      <BarChart data={leaderboard} layout="vertical" margin={{ left: 0, right: 40 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" allowDecimals={false} />
        <YAxis type="category" dataKey="nickname" width={90} />
        <Tooltip />
        <Bar dataKey="totalPoints" radius={[0, 6, 6, 0]}>
          {leaderboard.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
          <LabelList dataKey="totalPoints" position="right" style={{ fontSize: 12, fontWeight: 600, fill: '#374151' }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
