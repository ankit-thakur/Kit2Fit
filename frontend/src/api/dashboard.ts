import { apiRequest } from './client';

export interface LeaderboardEntry {
  userId: string;
  nickname: string;
  totalPoints: number;
}

export function getLeaderboard(groupId: string): Promise<{ leaderboard: LeaderboardEntry[] }> {
  return apiRequest('GET', `/groups/${groupId}/dashboard/leaderboard`);
}

export interface ProgressSeriesPoint {
  date: string;
  value: number;
}

export interface ProgressEntry {
  userId: string;
  nickname: string;
  series: ProgressSeriesPoint[];
}

export function getProgress(
  groupId: string,
  range?: { from?: string; to?: string },
): Promise<{ progress: ProgressEntry[] }> {
  const params = new URLSearchParams();
  if (range?.from) params.set('from', range.from);
  if (range?.to) params.set('to', range.to);
  const query = params.toString();
  return apiRequest('GET', `/groups/${groupId}/dashboard/progress${query ? `?${query}` : ''}`);
}
