import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, Tables } from '../../lib/dynamo';
import { getUserId } from '../../lib/auth';
import { json, handleErrors, HttpError } from '../../lib/http';

const EDITABLE_FIELDS = [
  'goalDescription',
  'targetMetricValue',
  'currentMetricValue',
  'metricUnit',
] as const;

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  return handleErrors(async () => {
    const callerUserId = getUserId(event);
    const groupId = event.pathParameters?.groupId;
    const targetUserId = event.pathParameters?.userId;
    if (!groupId || !targetUserId) {
      throw new HttpError(400, 'groupId and userId are required');
    }
    if (callerUserId !== targetUserId) {
      throw new HttpError(403, 'You can only edit your own goal');
    }

    const { Item: group } = await ddb.send(
      new GetCommand({ TableName: Tables.groups, Key: { groupId } }),
    );
    if (!group) {
      throw new HttpError(404, 'Group not found');
    }
    if (new Date() >= new Date(group.challengeStartDate)) {
      throw new HttpError(
        403,
        'This challenge has already started; goal info can no longer be edited',
      );
    }

    const body = JSON.parse(event.body ?? '{}');
    const updates = EDITABLE_FIELDS.filter((field) => body[field] !== undefined);
    if (updates.length === 0) {
      throw new HttpError(400, 'No editable fields provided');
    }

    const { Attributes } = await ddb.send(
      new UpdateCommand({
        TableName: Tables.groupMemberships,
        Key: { groupId, userId: targetUserId },
        UpdateExpression: `SET ${updates.map((f) => `#${f} = :${f}`).join(', ')}`,
        ExpressionAttributeNames: Object.fromEntries(updates.map((f) => [`#${f}`, f])),
        ExpressionAttributeValues: Object.fromEntries(updates.map((f) => [`:${f}`, body[f]])),
        ReturnValues: 'ALL_NEW',
      }),
    );

    return json(200, Attributes);
  });
}
