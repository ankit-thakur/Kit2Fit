process.env.USERS_TABLE = 'Users';
process.env.GROUPS_TABLE = 'Groups';
process.env.GROUP_MEMBERSHIPS_TABLE = 'GroupMemberships';
process.env.DAILY_LOGS_TABLE = 'DailyLogs';
process.env.ADHOC_CHALLENGES_TABLE = 'AdhocChallenges';

import { mockClient } from 'aws-sdk-client-mock';
import { GetCommand, QueryCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { ddb } from '../../src/lib/dynamo';
import { handler } from '../../src/handlers/dashboard/getLeaderboard';

const ddbMock = mockClient(ddb);

function buildEvent(groupId = 'group-1', userId = 'user-1'): APIGatewayProxyEvent {
  return {
    pathParameters: { groupId },
    requestContext: { authorizer: { claims: { sub: userId } } },
  } as unknown as APIGatewayProxyEvent;
}

describe('getLeaderboard handler', () => {
  beforeEach(() => {
    ddbMock.reset();
    ddbMock
      .on(GetCommand, { TableName: 'GroupMemberships', Key: { groupId: 'group-1', userId: 'user-1' } })
      .resolves({ Item: { groupId: 'group-1', userId: 'user-1', role: 'member' } });
    ddbMock
      .on(GetCommand, { TableName: 'Groups', Key: { groupId: 'group-1' } })
      .resolves({ Item: { groupId: 'group-1', challengeStartDate: '2026-06-01', challengeEndDate: '2026-06-30' } });
  });

  it('sums points only from logs within the challenge window, ignoring stale cached totals', async () => {
    ddbMock
      .on(QueryCommand, { TableName: 'GroupMemberships', KeyConditionExpression: 'groupId = :groupId' })
      .resolves({
        Items: [
          { groupId: 'group-1', userId: 'user-1', totalPoints: 999 },
          { groupId: 'group-1', userId: 'user-2', totalPoints: 0 },
        ],
      });
    // DynamoDB's KeyConditionExpression already restricts these to the challenge window;
    // a backfilled 2026-05-15 log (before challengeStartDate) would never be returned here.
    ddbMock
      .on(QueryCommand, { TableName: 'DailyLogs', IndexName: 'GSI1-GroupDate' })
      .resolves({
        Items: [
          { userId: 'user-1', date: '2026-06-05', totalPointsForDay: 3 },
          { userId: 'user-1', date: '2026-06-10', totalPointsForDay: 2 },
          { userId: 'user-2', date: '2026-06-06', totalPointsForDay: 4 },
        ],
      });
    ddbMock.on(BatchGetCommand).resolves({
      Responses: {
        Users: [
          { userId: 'user-1', nickname: 'Alice' },
          { userId: 'user-2', nickname: 'Bob' },
        ],
      },
    });

    const result = await handler(buildEvent());
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({
      leaderboard: [
        { userId: 'user-1', nickname: 'Alice', totalPoints: 5 },
        { userId: 'user-2', nickname: 'Bob', totalPoints: 4 },
      ],
    });

    const logsQuery = ddbMock.commandCalls(QueryCommand, { TableName: 'DailyLogs' })[0].args[0].input;
    expect(logsQuery.ExpressionAttributeValues).toEqual({
      ':groupId': 'group-1',
      ':from': '2026-06-01',
      ':to': '2026-06-30#zzzz',
    });
  });

  it('returns zero points for members with no logs in the challenge window', async () => {
    ddbMock
      .on(QueryCommand, { TableName: 'GroupMemberships', KeyConditionExpression: 'groupId = :groupId' })
      .resolves({ Items: [{ groupId: 'group-1', userId: 'user-1', totalPoints: 10 }] });
    ddbMock.on(QueryCommand, { TableName: 'DailyLogs', IndexName: 'GSI1-GroupDate' }).resolves({ Items: [] });
    ddbMock.on(BatchGetCommand).resolves({
      Responses: { Users: [{ userId: 'user-1', nickname: 'Alice' }] },
    });

    const result = await handler(buildEvent());
    expect(JSON.parse(result.body)).toEqual({
      leaderboard: [{ userId: 'user-1', nickname: 'Alice', totalPoints: 0 }],
    });
  });
});
