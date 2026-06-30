import type { GoalCategory } from './goalCategories';

export interface User {
  userId: string;
  email: string;
  phoneNumber: string;
  name: string;
  nickname: string;
  profilePictureKey?: string;
  createdAt: string;
}

export interface Group {
  groupId: string;
  name: string;
  goalCategory: string;
  challengeStartDate: string;
  challengeEndDate: string;
  adminUserId: string;
  createdAt: string;
}

export type GroupRole = 'admin' | 'member';

export interface GroupMembership {
  groupId: string;
  userId: string;
  role: GroupRole;
  joinedAt: string;
  goalCategory?: GoalCategory;
  goalDescription: string;
  startingMetricValue: number;
  targetMetricValue: number;
  currentMetricValue: number;
  metricUnit: string;
  totalPoints: number;
  goalLockedAt?: string;
  onboardedAt?: string;
}

export interface DailyLog {
  groupId: string;
  userId: string;
  date: string;
  minutesWorkedOut: number;
  description: string;
  metricValueAfter?: number;
  durationPoints: number;
  llmBonusPoint: 0 | 1;
  llmBonusReason: string;
  adhocBonusPoint: 0 | 1;
  adhocChallengeId?: string;
  kitBonusPoint: 0 | 1;
  totalPointsForDay: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdhocChallenge {
  groupId: string;
  challengeId: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  createdBy: string;
  createdAt: string;
}
