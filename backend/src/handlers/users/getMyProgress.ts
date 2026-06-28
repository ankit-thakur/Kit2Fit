import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, Tables } from '../../lib/dynamo';
import { getUserId } from '../../lib/auth';
import { json, handleErrors } from '../../lib/http';
import { calculateGoalProgressPercent } from '../../lib/progress';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  return handleErrors(async () => {
    const userId = getUserId(event);
    const from = event.queryStringParameters?.from ?? '0000-01-01';
    const to = event.queryStringParameters?.to ?? '9999-12-31';

    const { Items: memberships = [] } = await ddb.send(
      new QueryCommand({
        TableName: Tables.groupMemberships,
        IndexName: 'GSI1-UserGroups',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: { ':userId': userId },
      }),
    );

    if (memberships.length === 0) {
      return json(200, { goals: [] });
    }

    const { Responses } = await ddb.send(
      new BatchGetCommand({
        RequestItems: {
          [Tables.groups]: { Keys: memberships.map((m) => ({ groupId: m.groupId })) },
        },
      }),
    );
    const groupNamesById = new Map(
      (Responses?.[Tables.groups] ?? []).map((g) => [g.groupId, g.name]),
    );

    const goals = await Promise.all(
      memberships.map(async (membership) => {
        const { Items: logs = [] } = await ddb.send(
          new QueryCommand({
            TableName: Tables.dailyLogs,
            KeyConditionExpression: 'groupIdUserId = :groupIdUserId AND #date BETWEEN :from AND :to',
            ExpressionAttributeNames: { '#date': 'date' },
            ExpressionAttributeValues: {
              ':groupIdUserId': `${membership.groupId}#${userId}`,
              ':from': from,
              ':to': to,
            },
          }),
        );

        const series = logs.filter((log) => log.metricValueAfter != null).map((log) => ({
          date: log.date,
          percent: calculateGoalProgressPercent(
            membership.startingMetricValue ?? 0,
            membership.targetMetricValue ?? 0,
            log.metricValueAfter,
          ),
          metricValue: log.metricValueAfter,
        }));

        return {
          groupId: membership.groupId,
          groupName: groupNamesById.get(membership.groupId) ?? 'Unknown group',
          goalDescription: membership.goalDescription || 'Goal',
          metricUnit: membership.metricUnit ?? '',
          series,
        };
      }),
    );

    return json(200, { goals });
  });
}
