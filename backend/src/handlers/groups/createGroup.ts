import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, Tables } from '../../lib/dynamo';
import { getUserId } from '../../lib/auth';
import { json, handleErrors, HttpError } from '../../lib/http';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  return handleErrors(async () => {
    const userId = getUserId(event);
    const body = JSON.parse(event.body ?? '{}');
    const { name, goalCategory, challengeStartDate, challengeEndDate } = body;

    if (!name || !goalCategory || !challengeStartDate || !challengeEndDate) {
      throw new HttpError(
        400,
        'name, goalCategory, challengeStartDate, and challengeEndDate are required',
      );
    }

    const groupId = randomUUID();
    const now = new Date().toISOString();

    await ddb.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: Tables.groups,
              Item: {
                groupId,
                name,
                goalCategory,
                challengeStartDate,
                challengeEndDate,
                adminUserId: userId,
                createdAt: now,
              },
            },
          },
          {
            Put: {
              TableName: Tables.groupMemberships,
              Item: {
                groupId,
                userId,
                role: 'admin',
                joinedAt: now,
                goalDescription: '',
                targetMetricValue: 0,
                currentMetricValue: 0,
                metricUnit: '',
                totalPoints: 0,
              },
            },
          },
        ],
      }),
    );

    return json(201, { groupId, name, goalCategory, challengeStartDate, challengeEndDate });
  });
}
