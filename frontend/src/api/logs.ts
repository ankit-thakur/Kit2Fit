import { apiRequest } from './client';
import type { DailyLog } from '@shared/types';

export interface CreateLogInput {
  date: string;
  minutesWorkedOut: number;
  description: string;
  metricValueAfter?: number;
}

export interface CreateLogResult {
  date: string;
  durationPoints: number;
  llmBonusPoint: 0 | 1;
  llmBonusReason: string;
  adhocBonusPoint: 0 | 1;
  totalPointsForDay: number;
}

export function createLog(groupId: string, input: CreateLogInput): Promise<CreateLogResult> {
  return apiRequest('POST', `/groups/${groupId}/logs`, input);
}

export function updateLog(
  groupId: string,
  date: string,
  input: Partial<Omit<CreateLogInput, 'date'>>,
): Promise<CreateLogResult> {
  return apiRequest('PUT', `/groups/${groupId}/logs/${date}`, input);
}

export function listMyLogs(
  groupId: string,
  range?: { from?: string; to?: string },
): Promise<{ logs: DailyLog[] }> {
  const params = new URLSearchParams();
  if (range?.from) params.set('from', range.from);
  if (range?.to) params.set('to', range.to);
  const query = params.toString();
  return apiRequest('GET', `/groups/${groupId}/logs/me${query ? `?${query}` : ''}`);
}
