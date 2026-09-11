import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, Tables } from '../../lib/dynamo';
import { getUserId } from '../../../lib/auth';
import { json, handleErrors, HttpError } from '../../../lib/http';
import { requireGroup, requireMembership } from '../../lib/groups';
import { todayInTimeZone, daysLeftInWeek, weekStart } from '@shared/v2/week';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  return handleErrors(async () => {
    const userId = getUserId(event);
    const groupId = event.pathParameters?.groupId;
    if (!groupId) {
      throw new HttpError(400, 'groupId is required');
    }
    await requireMembership(groupId, userId);
    const group = await requireGroup(groupId);

    const { Items: memberships = [] } = await ddb.send(
      new QueryCommand({
        TableName: Tables.groupMemberships,
        KeyConditionExpression: 'groupId = :groupId',
        ExpressionAttributeValues: { ':groupId': groupId },
      }),
    );

    const { Responses } = memberships.length
      ? await ddb.send(
          new BatchGetCommand({
            RequestItems: {
              [Tables.users]: { Keys: memberships.map((m) => ({ userId: m.userId })) },
            },
          }),
        )
      : { Responses: undefined };

    const usersById = new Map(
      (Responses?.[Tables.users] ?? []).map((u) => [u.userId as string, u]),
    );

    const members = memberships
      .map((membership) => {
        const user = usersById.get(membership.userId as string);
        return {
          userId: membership.userId,
          role: membership.role,
          joinedAt: membership.joinedAt,
          onboardedAt: membership.onboardedAt,
          nickname: user?.nickname ?? user?.name ?? '',
          profilePictureKey: user?.profilePictureKey,
        };
      })
      // Stable order is what makes the board's daily tile rotation reproducible
      // between requests.
      .sort((a, b) => (a.userId as string).localeCompare(b.userId as string));

    const today = todayInTimeZone(group.timeZone);

    return json(200, {
      group,
      members,
      today,
      weekStart: weekStart(today),
      daysLeftInWeek: daysLeftInWeek(today),
    });
  });
}
