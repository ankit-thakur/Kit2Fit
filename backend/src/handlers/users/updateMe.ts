import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, Tables } from '../../lib/dynamo';
import { getUserId } from '../../lib/auth';
import { json, handleErrors, HttpError } from '../../lib/http';

const EDITABLE_FIELDS = ['name', 'nickname', 'phoneNumber', 'profilePictureKey'] as const;

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  return handleErrors(async () => {
    const userId = getUserId(event);
    const body = JSON.parse(event.body ?? '{}');

    const updates = EDITABLE_FIELDS.filter((field) => body[field] !== undefined);
    if (updates.length === 0) {
      throw new HttpError(400, 'No editable fields provided');
    }

    const { Attributes } = await ddb.send(
      new UpdateCommand({
        TableName: Tables.users,
        Key: { userId },
        UpdateExpression: `SET ${updates.map((f, i) => `#${f} = :${f}`).join(', ')}`,
        ExpressionAttributeNames: Object.fromEntries(updates.map((f) => [`#${f}`, f])),
        ExpressionAttributeValues: Object.fromEntries(updates.map((f) => [`:${f}`, body[f]])),
        ReturnValues: 'ALL_NEW',
      }),
    );

    return json(200, Attributes);
  });
}
