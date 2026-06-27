process.env.USERS_TABLE = 'Users';
process.env.GROUPS_TABLE = 'Groups';
process.env.GROUP_MEMBERSHIPS_TABLE = 'GroupMemberships';
process.env.DAILY_LOGS_TABLE = 'DailyLogs';
process.env.ADHOC_CHALLENGES_TABLE = 'AdhocChallenges';

import { mockClient } from 'aws-sdk-client-mock';
import { QueryCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { ddb } from '../../src/lib/dynamo';
import { handler } from '../../src/handlers/users/getMyProgress';

const ddbMock = mockClient(ddb);

function buildEvent(userId = 'user-1'): APIGatewayProxyEvent {
  return {
    queryStringParameters: null,
    requestContext: { authorizer: { claims: { sub: userId } } },
  } as unknown as APIGatewayProxyEvent;
}

describe('getMyProgress handler', () => {
  beforeEach(() => {
    ddbMock.reset();
  });

  it('returns one progress series per group membership, with percent computed per log', async () => {
    ddbMock
      .on(QueryCommand, {
        TableName: 'GroupMemberships',
        IndexName: 'GSI1-UserGroups',
        KeyConditionExpression: 'userId = :userId',
      })
      .resolves({
        Items: [
          {
            groupId: 'group-1',
            userId: 'user-1',
            goalDescription: 'Lose 10 lbs',
            startingMetricValue: 180,
            targetMetricValue: 170,
            metricUnit: 'lbs',
          },
          {
            groupId: 'group-2',
            userId: 'user-1',
            goalDescription: 'Run a faster mile',
            startingMetricValue: 10,
            targetMetricValue: 8,
            metricUnit: 'minutes/mile',
          },
        ],
      });
    ddbMock.on(BatchGetCommand).resolves({
      Responses: {
        Groups: [
          { groupId: 'group-1', name: 'Summer Shred' },
          { groupId: 'group-2', name: 'Marathon Crew' },
        ],
      },
    });
    ddbMock
      .on(QueryCommand, { TableName: 'DailyLogs', KeyConditionExpression: 'groupIdUserId = :groupIdUserId AND #date BETWEEN :from AND :to' })
      .callsFake((input) => {
        if (input.ExpressionAttributeValues[':groupIdUserId'] === 'group-1#user-1') {
          return Promise.resolve({ Items: [{ date: '2026-06-01', metricValueAfter: 176 }] });
        }
        return Promise.resolve({ Items: [{ date: '2026-06-01', metricValueAfter: 9 }] });
      });

    const result = await handler(buildEvent());
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.goals).toEqual([
      {
        groupId: 'group-1',
        groupName: 'Summer Shred',
        goalDescription: 'Lose 10 lbs',
        metricUnit: 'lbs',
        series: [{ date: '2026-06-01', percent: 40, metricValue: 176 }],
      },
      {
        groupId: 'group-2',
        groupName: 'Marathon Crew',
        goalDescription: 'Run a faster mile',
        metricUnit: 'minutes/mile',
        series: [{ date: '2026-06-01', percent: 50, metricValue: 9 }],
      },
    ]);
  });

  it('returns an empty goals list when the user has no memberships', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });

    const result = await handler(buildEvent());
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ goals: [] });
  });
});
