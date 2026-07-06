process.env.USERS_TABLE = 'Users';
process.env.GROUPS_TABLE = 'Groups';
process.env.GROUP_MEMBERSHIPS_TABLE = 'GroupMemberships';
process.env.DAILY_LOGS_TABLE = 'DailyLogs';
process.env.ADHOC_CHALLENGES_TABLE = 'AdhocChallenges';

import { mockClient } from 'aws-sdk-client-mock';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { ddb } from '../../src/lib/dynamo';
import { handler } from '../../src/handlers/groups/updateMemberGoal';

const ddbMock = mockClient(ddb);

function buildEvent(
  groupId: string,
  pathUserId: string,
  body: Record<string, unknown>,
  callerUserId = 'user-1',
): APIGatewayProxyEvent {
  return {
    pathParameters: { groupId, userId: pathUserId },
    body: JSON.stringify(body),
    requestContext: { authorizer: { claims: { sub: callerUserId } } },
  } as unknown as APIGatewayProxyEvent;
}

describe('updateMemberGoal handler', () => {
  beforeEach(() => {
    ddbMock.reset();
  });

  it('allows editing the goal even though the challenge has already started', async () => {
    ddbMock.on(UpdateCommand).resolves({
      Attributes: {
        groupId: 'group-1',
        userId: 'user-1',
        goalDescription: 'Lose 10 lbs',
        targetMetricValue: 170,
        currentMetricValue: 180,
        startingMetricValue: 180,
        metricUnit: 'lbs',
      },
    });

    const result = await handler(
      buildEvent('group-1', 'user-1', {
        goalDescription: 'Lose 10 lbs',
        currentMetricValue: 180,
        targetMetricValue: 170,
        goalCategory: 'weight_loss',
      }),
    );

    expect(result.statusCode).toBe(200);
    const updateCall = ddbMock.commandCalls(UpdateCommand)[0].args[0].input;
    expect(updateCall.Key).toEqual({ groupId: 'group-1', userId: 'user-1' });
    expect(updateCall.ExpressionAttributeValues).toMatchObject({ ':targetMetricValue': 170 });
  });

  it('rejects editing another user\'s goal', async () => {
    const result = await handler(
      buildEvent('group-1', 'user-2', { goalDescription: 'Not yours' }, 'user-1'),
    );

    expect(result.statusCode).toBe(403);
    expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(0);
  });
});
