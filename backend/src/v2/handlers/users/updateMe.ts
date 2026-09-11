import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, Tables } from '../../lib/dynamo';
import { getUserId } from '../../../lib/auth';
import { json, handleErrors, HttpError } from '../../../lib/http';
import { parseBody, requireString } from '../../lib/validate';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  return handleErrors(async () => {
    const userId = getUserId(event);
    const body = parseBody(event.body);

    const updates: Record<string, string> = {};
    if (body.name !== undefined) updates.name = requireString(body.name, 'name', 80);
    if (body.nickname !== undefined) updates.nickname = requireString(body.nickname, 'nickname', 40);

    const fields = Object.keys(updates);
    if (fields.length === 0) {
      throw new HttpError(400, 'Provide name or nickname');
    }

    // The shared Users table holds identity only, so v2 writing here is safe:
    // nothing v1 scores lives on this record.
    const { Attributes } = await ddb.send(
      new UpdateCommand({
        TableName: Tables.users,
        Key: { userId },
        UpdateExpression: `SET ${fields.map((f) => `#${f} = :${f}`).join(', ')}`,
        ExpressionAttributeNames: Object.fromEntries(fields.map((f) => [`#${f}`, f])),
        ExpressionAttributeValues: Object.fromEntries(fields.map((f) => [`:${f}`, updates[f]])),
        ConditionExpression: 'attribute_exists(userId)',
        ReturnValues: 'ALL_NEW',
      }),
    );

    return json(200, {
      userId,
      name: Attributes?.name ?? '',
      nickname: Attributes?.nickname ?? '',
    });
  });
}
