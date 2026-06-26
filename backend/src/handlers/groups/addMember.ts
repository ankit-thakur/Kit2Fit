import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, Tables } from '../../lib/dynamo';
import { getUserId } from '../../lib/auth';
import { requireAdmin } from '../../lib/groups';
import { json, handleErrors, HttpError } from '../../lib/http';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  return handleErrors(async () => {
    const adminUserId = getUserId(event);
    const groupId = event.pathParameters?.groupId;
    if (!groupId) {
      throw new HttpError(400, 'groupId is required');
    }
    await requireAdmin(groupId, adminUserId);

    const body = JSON.parse(event.body ?? '{}');
    const { email } = body;
    if (!email) {
      throw new HttpError(400, 'email is required');
    }

    const { Items: users = [] } = await ddb.send(
      new QueryCommand({
        TableName: Tables.users,
        IndexName: 'GSI1-Email',
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: { ':email': email },
      }),
    );

    const user = users[0];
    if (!user) {
      throw new HttpError(404, 'No registered user with that email');
    }

    const now = new Date().toISOString();
    await ddb.send(
      new PutCommand({
        TableName: Tables.groupMemberships,
        Item: {
          groupId,
          userId: user.userId,
          role: 'member',
          joinedAt: now,
          goalDescription: '',
          targetMetricValue: 0,
          currentMetricValue: 0,
          metricUnit: '',
          totalPoints: 0,
        },
      }),
    );

    return json(201, { groupId, userId: user.userId });
  });
}
