import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, Tables } from '../../lib/dynamo';
import { getUserId } from '../../lib/auth';
import { requireMembership } from '../../lib/groups';
import { json, handleErrors, HttpError } from '../../lib/http';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  return handleErrors(async () => {
    const userId = getUserId(event);
    const groupId = event.pathParameters?.groupId;
    if (!groupId) {
      throw new HttpError(400, 'groupId is required');
    }
    await requireMembership(groupId, userId);

    const activeDate = event.queryStringParameters?.date;

    const { Items: challenges = [] } = await ddb.send(
      new QueryCommand({
        TableName: Tables.adhocChallenges,
        KeyConditionExpression: 'groupId = :groupId',
        ...(activeDate
          ? {
              FilterExpression: 'activeDate = :date',
              ExpressionAttributeValues: { ':groupId': groupId, ':date': activeDate },
            }
          : { ExpressionAttributeValues: { ':groupId': groupId } }),
      }),
    );

    return json(200, { challenges });
  });
}
