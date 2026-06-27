import { apiRequest } from './client';
import type { User } from '@shared/types';

export type Me = User & { profilePictureUrl?: string };

export function getMe(): Promise<Me> {
  return apiRequest<Me>('GET', '/users/me');
}

export function updateMe(updates: Partial<Pick<User, 'name' | 'nickname' | 'phoneNumber' | 'profilePictureKey'>>): Promise<User> {
  return apiRequest<User>('PUT', '/users/me', updates);
}

export function getProfilePictureUploadUrl(): Promise<{ uploadUrl: string; key: string }> {
  return apiRequest('POST', '/users/me/profile-picture-upload-url');
}

export interface MyGoalProgress {
  groupId: string;
  groupName: string;
  goalDescription: string;
  metricUnit: string;
  series: { date: string; percent: number | null; metricValue: number }[];
}

export function getMyProgress(): Promise<{ goals: MyGoalProgress[] }> {
  return apiRequest('GET', '/users/me/progress');
}

export async function uploadProfilePicture(file: File): Promise<string> {
  const { uploadUrl, key } = await getProfilePictureUploadUrl();
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/jpeg' },
    body: file,
  });
  if (!response.ok) {
    throw new Error('Failed to upload profile picture');
  }
  return key;
}
