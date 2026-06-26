import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, Tables } from '../../lib/dynamo';
import { getUserId } from '../../lib/auth';
import { requireAdmin } from '../../lib/groups';
import { json, handleErrors, HttpError } from '../../lib/http';

const EDITABLE_FIELDS = ['name', 'goalCategory', 'challengeStartDate', 'challengeEndDate'] as const;

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  return handleErrors(async () => {
    const userId = getUserId(event);
    const groupId = event.pathParameters?.groupId;
    if (!groupId) {
      throw new HttpError(400, 'groupId is required');
    }

    await requireAdmin(groupId, userId);

    const body = JSON.parse(event.body ?? '{}');
    const updates = EDITABLE_FIELDS.filter((field) => body[field] !== undefined);
    if (updates.length === 0) {
      throw new HttpError(400, 'No editable fields provided');
    }

    const { Attributes } = await ddb.send(
      new UpdateCommand({
        TableName: Tables.groups,
        Key: { groupId },
        UpdateExpression: `SET ${updates.map((f) => `#${f} = :${f}`).join(', ')}`,
        ExpressionAttributeNames: Object.fromEntries(updates.map((f) => [`#${f}`, f])),
        ExpressionAttributeValues: Object.fromEntries(updates.map((f) => [`:${f}`, body[f]])),
        ReturnValues: 'ALL_NEW',
      }),
    );

    return json(200, Attributes);
  });
}
