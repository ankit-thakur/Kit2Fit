import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, Tables } from '../../lib/dynamo';
import { getUserId } from '../../lib/auth';
import { requireMembership } from '../../lib/groups';
import { json, handleErrors, HttpError } from '../../lib/http';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  return handleErrors(async () => {
    const userId = getUserId(event);
    const groupId = event.pathParameters?.groupId;
    if (!groupId) {
      throw new HttpError(400, 'groupId is required');
    }
    await requireMembership(groupId, userId);

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

    const nicknamesById = new Map(
      (Responses?.[Tables.users] ?? []).map((u) => [u.userId, u.nickname]),
    );

    const leaderboard = memberships
      .map((m) => ({
        userId: m.userId,
        nickname: nicknamesById.get(m.userId) ?? 'Unknown',
        totalPoints: m.totalPoints ?? 0,
      }))
      .sort((a, b) => b.totalPoints - a.totalPoints);

    return json(200, { leaderboard });
  });
}
