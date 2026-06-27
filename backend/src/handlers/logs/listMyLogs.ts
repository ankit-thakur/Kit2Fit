import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, Tables } from '../../lib/dynamo';
import { getUserId } from '../../lib/auth';
import { json, handleErrors, HttpError } from '../../lib/http';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  return handleErrors(async () => {
    const userId = getUserId(event);
    const groupId = event.pathParameters?.groupId;
    if (!groupId) {
      throw new HttpError(400, 'groupId is required');
    }

    const from = event.queryStringParameters?.from ?? '0000-01-01';
    const to = event.queryStringParameters?.to ?? '9999-12-31';

    const { Items: logs = [] } = await ddb.send(
      new QueryCommand({
        TableName: Tables.dailyLogs,
        KeyConditionExpression: 'groupIdUserId = :groupIdUserId AND #date BETWEEN :from AND :to',
        ExpressionAttributeNames: { '#date': 'date' },
        ExpressionAttributeValues: {
          ':groupIdUserId': `${groupId}#${userId}`,
          ':from': from,
          ':to': to,
        },
      }),
    );

    return json(200, { logs });
  });
}
