process.env.USERS_TABLE = 'Users';
process.env.GROUPS_TABLE = 'Groups';
process.env.GROUP_MEMBERSHIPS_TABLE = 'GroupMemberships';
process.env.DAILY_LOGS_TABLE = 'DailyLogs';
process.env.ADHOC_CHALLENGES_TABLE = 'AdhocChallenges';

import { mockClient } from 'aws-sdk-client-mock';
import { GetCommand, QueryCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { ddb } from '../../src/lib/dynamo';
import { handler } from '../../src/handlers/dashboard/getProgress';

const ddbMock = mockClient(ddb);

function buildEvent(groupId = 'group-1', userId = 'user-1'): APIGatewayProxyEvent {
  return {
    pathParameters: { groupId },
    queryStringParameters: null,
    requestContext: { authorizer: { claims: { sub: userId } } },
  } as unknown as APIGatewayProxyEvent;
}

describe('getProgress handler', () => {
  beforeEach(() => {
    ddbMock.reset();
    ddbMock
      .on(GetCommand, { TableName: 'GroupMemberships', Key: { groupId: 'group-1', userId: 'user-1' } })
      .resolves({ Item: { groupId: 'group-1', userId: 'user-1', role: 'member' } });
    ddbMock
      .on(GetCommand, { TableName: 'Groups', Key: { groupId: 'group-1' } })
      .resolves({ Item: { groupId: 'group-1', challengeStartDate: '2026-06-01', challengeEndDate: '2026-06-30' } });
  });

  it('returns a progressive percent for a standard goal based on start/target/current', async () => {
    ddbMock.on(QueryCommand, { TableName: 'DailyLogs', IndexName: 'GSI1-GroupDate' }).resolves({
      Items: [{ userId: 'user-1', date: '2026-06-05', metricValueAfter: 176 }],
    });
    ddbMock.on(BatchGetCommand).resolves({
      Responses: { Users: [{ userId: 'user-1', nickname: 'Alice' }] },
    });
    ddbMock.on(QueryCommand, { TableName: 'GroupMemberships', KeyConditionExpression: 'groupId = :groupId' }).resolves({
      Items: [{ groupId: 'group-1', userId: 'user-1', startingMetricValue: 180, targetMetricValue: 170, metricUnit: 'lbs' }],
    });

    const result = await handler(buildEvent());
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({
      progress: [
        {
          userId: 'user-1',
          nickname: 'Alice',
          metricUnit: 'lbs',
          series: [{ date: '2026-06-05', percent: 40, metricValue: 176 }],
        },
      ],
    });
  });

  it('scores a daily_habit member against the whole challenge window, not just logged days', async () => {
    ddbMock.on(QueryCommand, { TableName: 'DailyLogs', IndexName: 'GSI1-GroupDate' }).resolves({
      Items: [
        { userId: 'user-1', date: '2026-06-01', metricValueAfter: 9000 },
        { userId: 'user-1', date: '2026-06-02', metricValueAfter: 11000 },
      ],
    });
    ddbMock.on(BatchGetCommand).resolves({
      Responses: { Users: [{ userId: 'user-1', nickname: 'Alice' }] },
    });
    ddbMock.on(QueryCommand, { TableName: 'GroupMemberships', KeyConditionExpression: 'groupId = :groupId' }).resolves({
      Items: [{ groupId: 'group-1', userId: 'user-1', goalCategory: 'daily_habit', targetMetricValue: 10000, metricUnit: 'count' }],
    });

    const result = await handler(buildEvent());
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.progress[0].series).toEqual([
      { date: '2026-06-01', percent: 0, metricValue: 9000 },
      { date: '2026-06-02', percent: 100 / 30, metricValue: 11000 },
    ]);
    expect(body.progress[0].series[1].percent).toBeLessThan(10);
  });

  it('returns 404 when the group does not exist', async () => {
    ddbMock.reset();
    ddbMock
      .on(GetCommand, { TableName: 'GroupMemberships', Key: { groupId: 'group-1', userId: 'user-1' } })
      .resolves({ Item: { groupId: 'group-1', userId: 'user-1', role: 'member' } });
    ddbMock.on(GetCommand, { TableName: 'Groups', Key: { groupId: 'group-1' } }).resolves({ Item: undefined });

    const result = await handler(buildEvent());
    expect(result.statusCode).toBe(404);
  });
});
