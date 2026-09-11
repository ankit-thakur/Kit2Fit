import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { GroupMembership } from '@shared/v2/types';
import { ddb, Tables } from '../../lib/dynamo';
import { getUserId } from '../../../lib/auth';
import { json, handleErrors, HttpError } from '../../../lib/http';
import { getSecretValue } from '../../../lib/secrets';
import { verifyInviteToken } from '../../../lib/inviteToken';
import { parseBody, requireString } from '../../lib/validate';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  return handleErrors(async () => {
    const userId = getUserId(event);
    const token = requireString(parseBody(event.body).token, 'token', 512);

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

    const membership: GroupMembership = {
      groupId,
      userId,
      role: 'member',
      joinedAt: new Date().toISOString(),
    };

    try {
      await ddb.send(
        new PutCommand({
          TableName: Tables.groupMemberships,
          Item: membership,
          // Rejoining must not reset joinedAt or demote an admin who follows
          // their own link, so let the condition decide rather than reading first.
          ConditionExpression: 'attribute_not_exists(groupId)',
        }),
      );
    } catch (err) {
      if ((err as { name?: string }).name === 'ConditionalCheckFailedException') {
        return json(200, { groupId, alreadyMember: true });
      }
      throw err;
    }

    return json(201, { groupId, alreadyMember: false });
  });
}
