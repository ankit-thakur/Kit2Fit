import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, Tables } from './dynamo';
import { HttpError } from './http';

export async function requireMembership(groupId: string, userId: string) {
  const { Item: membership } = await ddb.send(
    new GetCommand({
      TableName: Tables.groupMemberships,
      Key: { groupId, userId },
    }),
  );
  if (!membership) {
    throw new HttpError(403, 'You are not a member of this group');
  }
  return membership;
}

export async function requireAdmin(groupId: string, userId: string) {
  const membership = await requireMembership(groupId, userId);
  if (membership.role !== 'admin') {
    throw new HttpError(403, 'Only the group admin can perform this action');
  }
  return membership;
}
