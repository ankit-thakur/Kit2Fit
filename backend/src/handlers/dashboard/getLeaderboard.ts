import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand, BatchGetCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
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

    const { Item: group } = await ddb.send(
      new GetCommand({ TableName: Tables.groups, Key: { groupId } }),
    );
    if (!group) {
      throw new HttpError(404, 'Group not found');
    }

    const { Items: memberships = [] } = await ddb.send(
      new QueryCommand({
        TableName: Tables.groupMemberships,
        KeyConditionExpression: 'groupId = :groupId',
        ExpressionAttributeValues: { ':groupId': groupId },
      }),
    );

    // Points are scoped to the challenge window so a member's total can't be inflated by
    // logs backfilled before the challenge started or dated after it ended.
    const { Items: logs = [] } = await ddb.send(
      new QueryCommand({
        TableName: Tables.dailyLogs,
        IndexName: 'GSI1-GroupDate',
        KeyConditionExpression: 'groupId = :groupId AND dateUserId BETWEEN :from AND :to',
        ExpressionAttributeValues: {
          ':groupId': groupId,
          ':from': group.challengeStartDate,
          ':to': `${group.challengeEndDate}#zzzz`,
        },
      }),
    );

    const pointsByUser = new Map<string, number>();
    for (const log of logs) {
      pointsByUser.set(log.userId, (pointsByUser.get(log.userId) ?? 0) + (log.totalPointsForDay ?? 0));
    }

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
        totalPoints: pointsByUser.get(m.userId) ?? 0,
      }))
      .sort((a, b) => b.totalPoints - a.totalPoints);

    return json(200, { leaderboard });
  });
}
