import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { LeaderboardEntry } from '../api/dashboard';

export function LeaderboardChart({ leaderboard }: { leaderboard: LeaderboardEntry[] }) {
  if (leaderboard.length === 0) {
    return <p className="text-center text-gray-400">No points logged yet.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, leaderboard.length * 50)}>
      <BarChart data={leaderboard} layout="vertical" margin={{ left: 16 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" allowDecimals={false} />
        <YAxis type="category" dataKey="nickname" width={90} />
        <Tooltip />
        <Bar dataKey="totalPoints" fill="#F58426" radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
