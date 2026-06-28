import { apiRequest } from './client';
import type { Group, GroupMembership, AdhocChallenge } from '@shared/types';

export type MyGroup = Group & { membership: GroupMembership };

export function listMyGroups(): Promise<{ groups: MyGroup[] }> {
  return apiRequest('GET', '/groups/mine');
}

export function getGroup(groupId: string): Promise<Group & { members: GroupMembership[] }> {
  return apiRequest('GET', `/groups/${groupId}`);
}

export interface CreateGroupInput {
  name: string;
  goalCategory: string;
  challengeStartDate: string;
  challengeEndDate: string;
}

export function createGroup(input: CreateGroupInput): Promise<Group> {
  return apiRequest('POST', '/groups', input);
}

export function updateGroup(groupId: string, updates: Partial<CreateGroupInput>): Promise<Group> {
  return apiRequest('PUT', `/groups/${groupId}`, updates);
}

export function addMember(groupId: string, email: string): Promise<{ groupId: string; userId: string }> {
  return apiRequest('POST', `/groups/${groupId}/members`, { email });
}

export function removeMember(groupId: string, userId: string): Promise<void> {
  return apiRequest('DELETE', `/groups/${groupId}/members/${userId}`);
}

export interface UpdateGoalInput {
  goalDescription?: string;
  targetMetricValue?: number;
  currentMetricValue?: number;
  metricUnit?: string;
}

export function updateMemberGoal(
  groupId: string,
  userId: string,
  updates: UpdateGoalInput,
): Promise<GroupMembership> {
  return apiRequest('PUT', `/groups/${groupId}/members/${userId}/goal`, updates);
}

export function createInviteLink(
  groupId: string,
  expirySeconds?: number,
): Promise<{ token: string; inviteUrl: string }> {
  return apiRequest('POST', `/groups/${groupId}/invite-link`, { expirySeconds });
}

export function joinViaInvite(token: string): Promise<{ groupId: string; alreadyMember: boolean }> {
  return apiRequest('POST', '/groups/join', { token });
}

export interface CreateChallengeInput {
  description: string;
  keywords: string[];
  startDate: string;
  endDate: string;
}

export function createChallenge(groupId: string, input: CreateChallengeInput): Promise<AdhocChallenge> {
  return apiRequest('POST', `/groups/${groupId}/challenges`, input);
}

export function listChallenges(groupId: string, date?: string): Promise<{ challenges: AdhocChallenge[] }> {
  return apiRequest('GET', `/groups/${groupId}/challenges${date ? `?date=${date}` : ''}`);
}

export function deleteChallenge(groupId: string, challengeId: string): Promise<void> {
  return apiRequest('DELETE', `/groups/${groupId}/challenges/${challengeId}`);
}
