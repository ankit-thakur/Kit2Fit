import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, Tables } from '../../lib/dynamo';
import { getUserId } from '../../lib/auth';
import { requireAdmin } from '../../lib/groups';
import { json, handleErrors, HttpError } from '../../lib/http';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  return handleErrors(async () => {
    const userId = getUserId(event);
    const groupId = event.pathParameters?.groupId;
    if (!groupId) {
      throw new HttpError(400, 'groupId is required');
    }
    await requireAdmin(groupId, userId);

    const body = JSON.parse(event.body ?? '{}');
    const { description, keywords, startDate, endDate } = body;
    if (!description || !Array.isArray(keywords) || keywords.length === 0 || !startDate || !endDate) {
      throw new HttpError(400, 'description, keywords (non-empty array), startDate, and endDate are required');
    }
    if (startDate > endDate) {
      throw new HttpError(400, 'startDate must be on or before endDate');
    }

    const challengeId = randomUUID();
    const now = new Date().toISOString();

    await ddb.send(
      new PutCommand({
        TableName: Tables.adhocChallenges,
        Item: {
          groupId,
          challengeId,
          description,
          keywords,
          startDate,
          endDate,
          createdBy: userId,
          createdAt: now,
        },
      }),
    );

    return json(201, { groupId, challengeId, description, keywords, startDate, endDate });
  });
}
