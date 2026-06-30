import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, Tables } from '../../lib/dynamo';
import { getUserId } from '../../lib/auth';
import { json, handleErrors, HttpError } from '../../lib/http';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  return handleErrors(async () => {
    const callerUserId = getUserId(event);
    const groupId = event.pathParameters?.groupId;
    const targetUserId = event.pathParameters?.userId;
    if (!groupId || !targetUserId) {
      throw new HttpError(400, 'groupId and userId are required');
    }
    if (callerUserId !== targetUserId) {
      throw new HttpError(403, 'You can only complete onboarding for yourself');
    }

    const { Item: membership } = await ddb.send(
      new GetCommand({ TableName: Tables.groupMemberships, Key: { groupId, userId: targetUserId } }),
    );
    if (!membership) {
      throw new HttpError(404, 'Membership not found');
    }

    const { Attributes } = await ddb.send(
      new UpdateCommand({
        TableName: Tables.groupMemberships,
        Key: { groupId, userId: targetUserId },
        UpdateExpression: 'SET #onboardedAt = :onboardedAt',
        ExpressionAttributeNames: { '#onboardedAt': 'onboardedAt' },
        ExpressionAttributeValues: { ':onboardedAt': new Date().toISOString() },
        ReturnValues: 'ALL_NEW',
      }),
    );

    return json(200, Attributes);
  });
}
