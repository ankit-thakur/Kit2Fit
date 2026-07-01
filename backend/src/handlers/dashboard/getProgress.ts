import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, Tables } from '../../lib/dynamo';
import { getUserId } from '../../lib/auth';
import { requireMembership } from '../../lib/groups';
import { json, handleErrors, HttpError } from '../../lib/http';
import { calculateGoalProgressPercent, calculateDailyHabitSeries } from '../../lib/progress';
import { GOAL_CATEGORIES, isGoalCategory } from '../../lib/goalCategories';

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

    const logsByUser = new Map<string, { date: string; metricValueAfter: number }[]>();
    for (const log of logs) {
      const userLogs = logsByUser.get(log.userId) ?? [];
      userLogs.push({ date: log.date, metricValueAfter: log.metricValueAfter });
      logsByUser.set(log.userId, userLogs);
    }

    const seriesByUser = new Map<
      string,
      { date: string; percent: number | null; metricValue: number }[]
    >();
    for (const [uid, userLogs] of logsByUser) {
      const member = membersById.get(uid);
      const isDailyHabit =
        member &&
        isGoalCategory(member.goalCategory) &&
        GOAL_CATEGORIES[member.goalCategory].goalType === 'daily_habit';

      if (isDailyHabit && member) {
        seriesByUser.set(uid, calculateDailyHabitSeries(userLogs, member.targetMetricValue ?? 0));
      } else {
        seriesByUser.set(
          uid,
          userLogs.map((log) => ({
            date: log.date,
            percent: member
              ? calculateGoalProgressPercent(
                  member.startingMetricValue ?? 0,
                  member.targetMetricValue ?? 0,
                  log.metricValueAfter,
                )
              : null,
            metricValue: log.metricValueAfter,
          })),
        );
      }
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
