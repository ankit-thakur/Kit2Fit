import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb';
import type { Group, GroupMembership } from '@shared/v2/types';
import { ddb, Tables } from '../../lib/dynamo';
import { getUserId } from '../../../lib/auth';
import { json, handleErrors } from '../../../lib/http';
import { todayInTimeZone } from '@shared/v2/week';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  return handleErrors(async () => {
    const userId = getUserId(event);

    const { Items: memberships = [] } = await ddb.send(
      new QueryCommand({
        TableName: Tables.groupMemberships,
        IndexName: 'GSI1-UserGroups',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: { ':userId': userId },
      }),
    );
    if (memberships.length === 0) {
      return json(200, { groups: [] });
    }

    const { Responses } = await ddb.send(
      new BatchGetCommand({
        RequestItems: {
          [Tables.groups]: { Keys: memberships.map((m) => ({ groupId: m.groupId })) },
        },
      }),
    );
    const groupsById = new Map<string, Group>(
      (Responses?.[Tables.groups] ?? []).map((g) => [g.groupId as string, g as Group]),
    );

    const groups = memberships
      .map((membership) => {
        const group = groupsById.get(membership.groupId as string);
        if (!group) return null;
        return {
          group,
          membership: membership as GroupMembership,
          // Resolved server-side in the group's own zone so every member sees
          // the same "today" regardless of where they are.
          today: todayInTimeZone(group.timeZone),
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    return json(200, { groups });
  });
}
