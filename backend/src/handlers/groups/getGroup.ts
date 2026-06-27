import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
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

    const { Item: group } = await ddb.send(
      new GetCommand({ TableName: Tables.groups, Key: { groupId } }),
    );
    if (!group) {
      throw new HttpError(404, 'Group not found');
    }

    const { Items: members = [] } = await ddb.send(
      new QueryCommand({
        TableName: Tables.groupMemberships,
        KeyConditionExpression: 'groupId = :groupId',
        ExpressionAttributeValues: { ':groupId': groupId },
      }),
    );

    const isMember = members.some((m) => m.userId === userId);
    if (!isMember) {
      throw new HttpError(403, 'You are not a member of this group');
    }

    return json(200, { ...group, members });
  });
}
