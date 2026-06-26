process.env.USERS_TABLE = 'Users';
process.env.GROUPS_TABLE = 'Groups';
process.env.GROUP_MEMBERSHIPS_TABLE = 'GroupMemberships';
process.env.DAILY_LOGS_TABLE = 'DailyLogs';
process.env.ADHOC_CHALLENGES_TABLE = 'AdhocChallenges';

import { mockClient } from 'aws-sdk-client-mock';
import { GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { ddb } from '../../src/lib/dynamo';

jest.mock('../../src/lib/llmJudge', () => ({
  judgeGoalContribution: jest.fn(),
}));
jest.mock('../../src/lib/adhocMatch', () => ({
  matchAdhocChallenge: jest.fn(),
}));

import { judgeGoalContribution } from '../../src/lib/llmJudge';
import { matchAdhocChallenge } from '../../src/lib/adhocMatch';
import { handler } from '../../src/handlers/logs/createLog';

const ddbMock = mockClient(ddb);

function buildEvent(body: unknown, groupId = 'group-1', userId = 'user-1'): APIGatewayProxyEvent {
  return {
    pathParameters: { groupId },
    body: JSON.stringify(body),
    requestContext: { authorizer: { claims: { sub: userId } } },
  } as unknown as APIGatewayProxyEvent;
}

describe('createLog handler', () => {
  beforeEach(() => {
    ddbMock.reset();
    (judgeGoalContribution as jest.Mock).mockReset();
    (matchAdhocChallenge as jest.Mock).mockReset();
  });

  it('computes duration + LLM bonus + ad-hoc bonus and increments the cached total', async () => {
    ddbMock
      .on(GetCommand, {
        TableName: 'GroupMemberships',
        Key: { groupId: 'group-1', userId: 'user-1' },
      })
      .resolves({
        Item: {
          groupId: 'group-1',
          userId: 'user-1',
          goalDescription: 'Run a faster mile',
          metricUnit: 'minutes',
          currentMetricValue: 8,
          totalPoints: 10,
        },
      });
    ddbMock
      .on(GetCommand, { TableName: 'DailyLogs', Key: { groupIdUserId: 'group-1#user-1', date: '2026-06-01' } })
      .resolves({ Item: undefined });
    ddbMock.on(PutCommand).resolves({});
    ddbMock.on(UpdateCommand).resolves({});

    (judgeGoalContribution as jest.Mock).mockResolvedValue({
      contributes: true,
      reason: 'Direct sprint work.',
    });
    (matchAdhocChallenge as jest.Mock).mockResolvedValue({
      matched: true,
      challengeId: 'challenge-1',
    });

    const event = buildEvent({
      date: '2026-06-01',
      minutesWorkedOut: 30,
      description: 'Jump rope sprints',
      metricValueAfter: 7.5,
    });

    const result = await handler(event);
    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body).toEqual({
      date: '2026-06-01',
      durationPoints: 2,
      llmBonusPoint: 1,
      llmBonusReason: 'Direct sprint work.',
      adhocBonusPoint: 1,
      totalPointsForDay: 4,
    });

    const putCall = ddbMock.commandCalls(PutCommand)[0].args[0].input;
    expect(putCall.Item).toMatchObject({
      groupIdUserId: 'group-1#user-1',
      totalPointsForDay: 4,
      adhocChallengeId: 'challenge-1',
    });

    const updateCall = ddbMock.commandCalls(UpdateCommand)[0].args[0].input;
    expect(updateCall.ExpressionAttributeValues).toEqual({
      ':metricValueAfter': 7.5,
      ':points': 4,
    });
  });

  it('rejects a duplicate log for the same date', async () => {
    ddbMock
      .on(GetCommand, {
        TableName: 'GroupMemberships',
        Key: { groupId: 'group-1', userId: 'user-1' },
      })
      .resolves({ Item: { groupId: 'group-1', userId: 'user-1' } });
    ddbMock
      .on(GetCommand, { TableName: 'DailyLogs', Key: { groupIdUserId: 'group-1#user-1', date: '2026-06-01' } })
      .resolves({ Item: { date: '2026-06-01' } });

    const event = buildEvent({
      date: '2026-06-01',
      minutesWorkedOut: 30,
      description: 'Run',
      metricValueAfter: 7.5,
    });

    const result = await handler(event);
    expect(result.statusCode).toBe(409);
  });

  it('rejects a user who is not a member of the group', async () => {
    ddbMock
      .on(GetCommand, {
        TableName: 'GroupMemberships',
        Key: { groupId: 'group-1', userId: 'user-1' },
      })
      .resolves({ Item: undefined });

    const event = buildEvent({
      date: '2026-06-01',
      minutesWorkedOut: 30,
      description: 'Run',
      metricValueAfter: 7.5,
    });

    const result = await handler(event);
    expect(result.statusCode).toBe(403);
  });
});
