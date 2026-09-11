process.env.USERS_TABLE = 'Users';
process.env.V2_GROUPS_TABLE = 'V2Groups';
process.env.V2_GROUP_MEMBERSHIPS_TABLE = 'V2Memberships';

import { mockClient } from 'aws-sdk-client-mock';
import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { ddb } from '../../../src/v2/lib/dynamo';
import { handler } from '../../../src/v2/handlers/groups/createGroup';

const ddbMock = mockClient(ddb);

const valid = {
  name: 'Thursday Crew',
  timeZone: 'America/Los_Angeles',
  challengeStartDate: '2026-09-07',
  challengeEndDate: '2026-11-01',
};

function buildEvent(body: unknown, userId = 'user-1'): APIGatewayProxyEvent {
  return {
    body: JSON.stringify(body),
    requestContext: { authorizer: { claims: { sub: userId } } },
  } as unknown as APIGatewayProxyEvent;
}

describe('v2 createGroup', () => {
  beforeEach(() => ddbMock.reset());

  it('writes the group and the creator membership in one transaction', async () => {
    ddbMock.on(TransactWriteCommand).resolves({});

    const res = await handler(buildEvent(valid));
    expect(res.statusCode).toBe(201);

    const body = JSON.parse(res.body);
    expect(body.group).toMatchObject({ ...valid, adminUserId: 'user-1', commitmentCap: 14 });
    expect(body.membership).toMatchObject({ userId: 'user-1', role: 'admin' });

    const calls = ddbMock.commandCalls(TransactWriteCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0].args[0].input.TransactItems).toHaveLength(2);
  });

  it('gives the membership no goal fields — pledges are separate records', async () => {
    ddbMock.on(TransactWriteCommand).resolves({});
    const res = await handler(buildEvent(valid));
    const { membership } = JSON.parse(res.body);
    expect(Object.keys(membership).sort()).toEqual(['groupId', 'joinedAt', 'role', 'userId']);
  });

  it('rejects a time zone the runtime does not know', async () => {
    const res = await handler(buildEvent({ ...valid, timeZone: 'Mars/Olympus_Mons' }));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).message).toMatch(/time zone/i);
    expect(ddbMock.commandCalls(TransactWriteCommand)).toHaveLength(0);
  });

  it('requires a time zone rather than silently defaulting to UTC', async () => {
    const { timeZone, ...withoutZone } = valid;
    const res = await handler(buildEvent(withoutZone));
    expect(res.statusCode).toBe(400);
  });

  it('rejects an end date before the start date', async () => {
    const res = await handler(
      buildEvent({ ...valid, challengeStartDate: '2026-11-01', challengeEndDate: '2026-09-07' }),
    );
    expect(res.statusCode).toBe(400);
  });

  it('rejects a malformed date', async () => {
    const res = await handler(buildEvent({ ...valid, challengeStartDate: '07-09-2026' }));
    expect(res.statusCode).toBe(400);
  });

  it('accepts an explicit commitment cap and rejects a nonsensical one', async () => {
    ddbMock.on(TransactWriteCommand).resolves({});
    const ok = await handler(buildEvent({ ...valid, commitmentCap: 10 }));
    expect(JSON.parse(ok.body).group.commitmentCap).toBe(10);

    const bad = await handler(buildEvent({ ...valid, commitmentCap: 0 }));
    expect(bad.statusCode).toBe(400);
  });

  it('rejects an unauthenticated caller', async () => {
    const res = await handler({ body: JSON.stringify(valid), requestContext: {} } as unknown as APIGatewayProxyEvent);
    expect(res.statusCode).toBe(401);
  });
});
