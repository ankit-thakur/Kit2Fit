process.env.USERS_TABLE = 'Users';
process.env.GROUPS_TABLE = 'Groups';
process.env.GROUP_MEMBERSHIPS_TABLE = 'GroupMemberships';
process.env.DAILY_LOGS_TABLE = 'DailyLogs';
process.env.ADHOC_CHALLENGES_TABLE = 'AdhocChallenges';
process.env.INVITE_LINK_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:invite';

import { mockClient } from 'aws-sdk-client-mock';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { ddb } from '../../src/lib/dynamo';
import { signInviteToken } from '../../src/lib/inviteToken';

const SECRET = 'test-invite-secret';

jest.mock('../../src/lib/secrets', () => ({
  getSecretValue: jest.fn().mockResolvedValue('test-invite-secret'),
}));

import { handler } from '../../src/handlers/groups/joinViaInvite';

const ddbMock = mockClient(ddb);

function buildEvent(body: unknown, userId = 'user-1'): APIGatewayProxyEvent {
  return {
    body: JSON.stringify(body),
    requestContext: { authorizer: { claims: { sub: userId } } },
  } as unknown as APIGatewayProxyEvent;
}

describe('joinViaInvite handler', () => {
  beforeEach(() => {
    ddbMock.reset();
  });

  it('creates a new membership for a valid invite token', async () => {
    const token = signInviteToken('group-1', SECRET);
    ddbMock
      .on(GetCommand, { TableName: 'Groups', Key: { groupId: 'group-1' } })
      .resolves({ Item: { groupId: 'group-1', name: 'Runners' } });
    ddbMock
      .on(GetCommand, { TableName: 'GroupMemberships', Key: { groupId: 'group-1', userId: 'user-1' } })
      .resolves({ Item: undefined });
    ddbMock.on(PutCommand).resolves({});

    const result = await handler(buildEvent({ token }));
    expect(result.statusCode).toBe(201);
    expect(JSON.parse(result.body)).toEqual({ groupId: 'group-1', alreadyMember: false });

    const putCall = ddbMock.commandCalls(PutCommand)[0].args[0].input;
    expect(putCall.Item).toMatchObject({ groupId: 'group-1', userId: 'user-1', role: 'member' });
  });

  it('returns alreadyMember without writing a new item if already a member', async () => {
    const token = signInviteToken('group-1', SECRET);
    ddbMock
      .on(GetCommand, { TableName: 'Groups', Key: { groupId: 'group-1' } })
      .resolves({ Item: { groupId: 'group-1', name: 'Runners' } });
    ddbMock
      .on(GetCommand, { TableName: 'GroupMemberships', Key: { groupId: 'group-1', userId: 'user-1' } })
      .resolves({ Item: { groupId: 'group-1', userId: 'user-1' } });

    const result = await handler(buildEvent({ token }));
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ groupId: 'group-1', alreadyMember: true });
    expect(ddbMock.commandCalls(PutCommand)).toHaveLength(0);
  });

  it('rejects a tampered token', async () => {
    const token = signInviteToken('group-1', SECRET);
    const tampered = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a');

    const result = await handler(buildEvent({ token: tampered }));
    expect(result.statusCode).toBe(400);
  });

  it('returns 404 when the group no longer exists', async () => {
    const token = signInviteToken('group-missing', SECRET);
    ddbMock
      .on(GetCommand, { TableName: 'Groups', Key: { groupId: 'group-missing' } })
      .resolves({ Item: undefined });

    const result = await handler(buildEvent({ token }));
    expect(result.statusCode).toBe(404);
  });

  it('rejects a request missing the token', async () => {
    const result = await handler(buildEvent({}));
    expect(result.statusCode).toBe(400);
  });
});
