import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DeleteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, Tables } from '../../lib/dynamo';
import { getUserId } from '../../lib/auth';
import { json, handleErrors, HttpError } from '../../lib/http';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  return handleErrors(async () => {
    const callerUserId = getUserId(event);
    const groupId = event.pathParameters?.groupId;
    const targetUserId = event.pathParameters?.userId;
    if (!groupId || !targetUserId) {
      throw new HttpError(400, 'groupId and userId are required');
    }

    if (callerUserId !== targetUserId) {
      const { Item: callerMembership } = await ddb.send(
        new GetCommand({
          TableName: Tables.groupMemberships,
          Key: { groupId, userId: callerUserId },
        }),
      );
      if (!callerMembership || callerMembership.role !== 'admin') {
        throw new HttpError(403, 'Only the group admin can remove other members');
      }
    }

    const { Item: group } = await ddb.send(
      new GetCommand({ TableName: Tables.groups, Key: { groupId } }),
    );
    if (group?.adminUserId === targetUserId) {
      throw new HttpError(400, 'The group admin cannot be removed; delete the group instead');
    }

    await ddb.send(
      new DeleteCommand({
        TableName: Tables.groupMemberships,
        Key: { groupId, userId: targetUserId },
      }),
    );

    return json(204, {});
  });
}
