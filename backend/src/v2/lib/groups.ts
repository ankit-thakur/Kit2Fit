import { GetCommand } from '@aws-sdk/lib-dynamodb';
import type { Group, GroupMembership } from '@shared/v2/types';
import { ddb, Tables } from './dynamo';
import { HttpError } from '../../lib/http';

export async function requireMembership(
  groupId: string,
  userId: string,
): Promise<GroupMembership> {
  const { Item } = await ddb.send(
    new GetCommand({ TableName: Tables.groupMemberships, Key: { groupId, userId } }),
  );
  if (!Item) {
    throw new HttpError(403, 'You are not a member of this group');
  }
  return Item as GroupMembership;
}

export async function requireAdmin(groupId: string, userId: string): Promise<GroupMembership> {
  const membership = await requireMembership(groupId, userId);
  if (membership.role !== 'admin') {
    throw new HttpError(403, 'Only the group admin can do that');
  }
  return membership;
}

export async function requireGroup(groupId: string): Promise<Group> {
  const { Item } = await ddb.send(
    new GetCommand({ TableName: Tables.groups, Key: { groupId } }),
  );
  if (!Item) {
    throw new HttpError(404, 'Group not found');
  }
  return Item as Group;
}
