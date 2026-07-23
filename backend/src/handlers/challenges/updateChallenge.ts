import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, Tables } from '../../lib/dynamo';
import { getUserId } from '../../lib/auth';
import { requireAdmin } from '../../lib/groups';
import { json, handleErrors, HttpError } from '../../lib/http';

const EDITABLE_FIELDS = ['title', 'description', 'startDate', 'endDate', 'pointValue'] as const;

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  return handleErrors(async () => {
    const userId = getUserId(event);
    const groupId = event.pathParameters?.groupId;
    const challengeId = event.pathParameters?.challengeId;
    if (!groupId || !challengeId) {
      throw new HttpError(400, 'groupId and challengeId are required');
    }

    await requireAdmin(groupId, userId);

    const body = JSON.parse(event.body ?? '{}');
    const updates = EDITABLE_FIELDS.filter((field) => body[field] !== undefined);
    if (updates.length === 0) {
      throw new HttpError(400, 'No editable fields provided');
    }
    if (
      body.pointValue !== undefined &&
      (typeof body.pointValue !== 'number' || !Number.isInteger(body.pointValue) || body.pointValue <= 0)
    ) {
      throw new HttpError(400, 'pointValue must be a positive integer');
    }

    const { Item: existingChallenge } = await ddb.send(
      new GetCommand({ TableName: Tables.adhocChallenges, Key: { groupId, challengeId } }),
    );
    if (!existingChallenge) {
      throw new HttpError(404, 'Challenge not found');
    }

    const startDate = body.startDate ?? existingChallenge.startDate;
    const endDate = body.endDate ?? existingChallenge.endDate;
    if (startDate > endDate) {
      throw new HttpError(400, 'startDate must be on or before endDate');
    }

    const { Attributes } = await ddb.send(
      new UpdateCommand({
        TableName: Tables.adhocChallenges,
        Key: { groupId, challengeId },
        UpdateExpression: `SET ${updates.map((f) => `#${f} = :${f}`).join(', ')}`,
        ExpressionAttributeNames: Object.fromEntries(updates.map((f) => [`#${f}`, f])),
        ExpressionAttributeValues: Object.fromEntries(updates.map((f) => [`:${f}`, body[f]])),
        ReturnValues: 'ALL_NEW',
      }),
    );

    return json(200, Attributes);
  });
}
