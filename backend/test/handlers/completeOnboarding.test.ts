process.env.USERS_TABLE = 'Users';
process.env.GROUPS_TABLE = 'Groups';
process.env.GROUP_MEMBERSHIPS_TABLE = 'GroupMemberships';
process.env.DAILY_LOGS_TABLE = 'DailyLogs';
process.env.ADHOC_CHALLENGES_TABLE = 'AdhocChallenges';

import { mockClient } from 'aws-sdk-client-mock';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { ddb } from '../../src/lib/dynamo';
import { handler } from '../../src/handlers/groups/completeOnboarding';

const ddbMock = mockClient(ddb);

function buildEvent(groupId: string, pathUserId: string, callerUserId = 'user-1'): APIGatewayProxyEvent {
  return {
    pathParameters: { groupId, userId: pathUserId },
    requestContext: { authorizer: { claims: { sub: callerUserId } } },
  } as unknown as APIGatewayProxyEvent;
}

describe('completeOnboarding handler', () => {
  beforeEach(() => {
    ddbMock.reset();
  });

  it('marks the membership as onboarded', async () => {
    ddbMock
      .on(GetCommand, { TableName: 'GroupMemberships', Key: { groupId: 'group-1', userId: 'user-1' } })
      .resolves({ Item: { groupId: 'group-1', userId: 'user-1' } });
    ddbMock.on(UpdateCommand).resolves({ Attributes: { groupId: 'group-1', userId: 'user-1', onboardedAt: 'now' } });

    const result = await handler(buildEvent('group-1', 'user-1'));
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toMatchObject({ onboardedAt: 'now' });

    const updateCall = ddbMock.commandCalls(UpdateCommand)[0].args[0].input;
    expect(updateCall.Key).toEqual({ groupId: 'group-1', userId: 'user-1' });
  });

  it('rejects completing onboarding for another user', async () => {
    const result = await handler(buildEvent('group-1', 'user-2', 'user-1'));
    expect(result.statusCode).toBe(403);
  });

  it('returns 404 when the membership does not exist', async () => {
    ddbMock
      .on(GetCommand, { TableName: 'GroupMemberships', Key: { groupId: 'group-1', userId: 'user-1' } })
      .resolves({ Item: undefined });

    const result = await handler(buildEvent('group-1', 'user-1'));
    expect(result.statusCode).toBe(404);
  });
});
