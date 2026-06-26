import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, Tables } from '../../lib/dynamo';
import { getUserId } from '../../lib/auth';
import { requireMembership } from '../../lib/groups';
import { json, handleErrors, HttpError } from '../../lib/http';
import { calculateGoalProgressPercent } from '../../lib/progress';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  return handleErrors(async () => {
    const userId = getUserId(event);
    const groupId = event.pathParameters?.groupId;
    if (!groupId) {
      throw new HttpError(400, 'groupId is required');
    }
    await requireMembership(groupId, userId);

    const from = event.queryStringParameters?.from ?? '0000-01-01';
    const to = event.queryStringParameters?.to ?? '9999-12-31';

    const { Items: logs = [] } = await ddb.send(
      new QueryCommand({
        TableName: Tables.dailyLogs,
        IndexName: 'GSI1-GroupDate',
        KeyConditionExpression: 'groupId = :groupId AND dateUserId BETWEEN :from AND :to',
        ExpressionAttributeValues: { ':groupId': groupId, ':from': from, ':to': `${to}#zzzz` },
      }),
    );

    const userIds = [...new Set(logs.map((l) => l.userId))];
    const { Responses } = userIds.length
      ? await ddb.send(
          new BatchGetCommand({
            RequestItems: { [Tables.users]: { Keys: userIds.map((id) => ({ userId: id })) } },
          }),
        )
      : { Responses: undefined };

    const nicknamesById = new Map(
      (Responses?.[Tables.users] ?? []).map((u) => [u.userId, u.nickname]),
    );

    const { Items: members = [] } = await ddb.send(
      new QueryCommand({
        TableName: Tables.groupMemberships,
        KeyConditionExpression: 'groupId = :groupId',
        ExpressionAttributeValues: { ':groupId': groupId },
      }),
    );
    const membersById = new Map(members.map((m) => [m.userId, m]));

    const seriesByUser = new Map<
      string,
      { date: string; percent: number | null; metricValue: number }[]
    >();
    for (const log of logs) {
      const member = membersById.get(log.userId);
      const percent = member
        ? calculateGoalProgressPercent(
            member.startingMetricValue ?? 0,
            member.targetMetricValue ?? 0,
            log.metricValueAfter,
          )
        : null;
      const series = seriesByUser.get(log.userId) ?? [];
      series.push({ date: log.date, percent, metricValue: log.metricValueAfter });
      seriesByUser.set(log.userId, series);
    }

    const progress = [...seriesByUser.entries()].map(([uid, series]) => ({
      userId: uid,
      nickname: nicknamesById.get(uid) ?? 'Unknown',
      metricUnit: membersById.get(uid)?.metricUnit ?? '',
      series,
    }));

    return json(200, { progress });
  });
}
