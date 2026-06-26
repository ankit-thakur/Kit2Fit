import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, Tables } from '../../lib/dynamo';
import { getUserId } from '../../lib/auth';
import { json, handleErrors, HttpError } from '../../lib/http';
import { getSecretValue } from '../../lib/secrets';
import { verifyInviteToken } from '../../lib/inviteToken';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  return handleErrors(async () => {
    const userId = getUserId(event);
    const body = JSON.parse(event.body ?? '{}');
    const { token } = body;
    if (!token) {
      throw new HttpError(400, 'token is required');
    }

    const secretArn = process.env.INVITE_LINK_SECRET_ARN;
    if (!secretArn) {
      throw new HttpError(500, 'Invite link secret not configured');
    }
    const secret = await getSecretValue(secretArn);

    let groupId: string;
    try {
      ({ groupId } = verifyInviteToken(token, secret));
    } catch (err) {
      throw new HttpError(400, err instanceof Error ? err.message : 'Invalid invite token');
    }

    const { Item: group } = await ddb.send(
      new GetCommand({ TableName: Tables.groups, Key: { groupId } }),
    );
    if (!group) {
      throw new HttpError(404, 'Group not found');
    }

    const { Item: existingMembership } = await ddb.send(
      new GetCommand({ TableName: Tables.groupMemberships, Key: { groupId, userId } }),
    );
    if (existingMembership) {
      return json(200, { groupId, alreadyMember: true });
    }

    const now = new Date().toISOString();
    await ddb.send(
      new PutCommand({
        TableName: Tables.groupMemberships,
        Item: {
          groupId,
          userId,
          role: 'member',
          joinedAt: now,
          goalDescription: '',
          startingMetricValue: 0,
          targetMetricValue: 0,
          currentMetricValue: 0,
          metricUnit: '',
          totalPoints: 0,
        },
      }),
    );

    return json(201, { groupId, alreadyMember: false });
  });
}
