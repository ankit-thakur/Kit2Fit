process.env.USERS_TABLE = 'Users';
process.env.V2_GROUPS_TABLE = 'V2Groups';
process.env.V2_GROUP_MEMBERSHIPS_TABLE = 'V2Memberships';
process.env.INVITE_LINK_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:v2-invite';

import { mockClient } from 'aws-sdk-client-mock';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { ddb } from '../../../src/v2/lib/dynamo';
import { signInviteToken } from '../../../src/lib/inviteToken';

const SECRET = 'test-v2-invite-secret';
jest.mock('../../../src/lib/secrets', () => ({
  getSecretValue: jest.fn().mockResolvedValue('test-v2-invite-secret'),
}));

import { handler } from '../../../src/v2/handlers/groups/joinViaInvite';

const ddbMock = mockClient(ddb);

function buildEvent(body: unknown, userId = 'user-2'): APIGatewayProxyEvent {
  return {
    body: JSON.stringify(body),
    requestContext: { authorizer: { claims: { sub: userId } } },
  } as unknown as APIGatewayProxyEvent;
}

describe('v2 joinViaInvite', () => {
  beforeEach(() => ddbMock.reset());

  it('creates a membership with no goal fields for a valid token', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { groupId: 'group-1', name: 'Thursday Crew' } });
    ddbMock.on(PutCommand).resolves({});

    const res = await handler(buildEvent({ token: signInviteToken('group-1', SECRET) }));
    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body)).toEqual({ groupId: 'group-1', alreadyMember: false });

    const put = ddbMock.commandCalls(PutCommand)[0].args[0].input;
    expect(put.Item).toMatchObject({ groupId: 'group-1', userId: 'user-2', role: 'member' });
    expect(put.ConditionExpression).toBe('attribute_not_exists(groupId)');
  });

  it('reports an existing member without resetting their membership', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { groupId: 'group-1' } });
    const conditionFailed = Object.assign(new Error('exists'), {
      name: 'ConditionalCheckFailedException',
    });
    ddbMock.on(PutCommand).rejects(conditionFailed);

    const res = await handler(buildEvent({ token: signInviteToken('group-1', SECRET) }));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ groupId: 'group-1', alreadyMember: true });
  });

  it('rejects a token signed with another secret', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { groupId: 'group-1' } });
    const res = await handler(buildEvent({ token: signInviteToken('group-1', 'v1-secret') }));
    expect(res.statusCode).toBe(400);
    expect(ddbMock.commandCalls(PutCommand)).toHaveLength(0);
  });

  it('rejects an expired token', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { groupId: 'group-1' } });
    const res = await handler(buildEvent({ token: signInviteToken('group-1', SECRET, -60) }));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).message).toMatch(/expired/i);
  });

  it('404s when the group is gone', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    const res = await handler(buildEvent({ token: signInviteToken('group-1', SECRET) }));
    expect(res.statusCode).toBe(404);
  });

  it('requires a token', async () => {
    expect((await handler(buildEvent({}))).statusCode).toBe(400);
  });
});
