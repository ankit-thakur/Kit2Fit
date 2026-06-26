import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, Tables } from '../../lib/dynamo';
import { getUserId } from '../../lib/auth';
import { requireAdmin } from '../../lib/groups';
import { json, handleErrors, HttpError } from '../../lib/http';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  return handleErrors(async () => {
    const userId = getUserId(event);
    const groupId = event.pathParameters?.groupId;
    const challengeId = event.pathParameters?.challengeId;
    if (!groupId || !challengeId) {
      throw new HttpError(400, 'groupId and challengeId are required');
    }
    await requireAdmin(groupId, userId);

    await ddb.send(
      new DeleteCommand({ TableName: Tables.adhocChallenges, Key: { groupId, challengeId } }),
    );

    return json(204, {});
  });
}
