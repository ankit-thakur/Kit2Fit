import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, Tables } from '../../lib/dynamo';
import { getUserId } from '../../../lib/auth';
import { json, handleErrors, HttpError } from '../../../lib/http';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  return handleErrors(async () => {
    const userId = getUserId(event);

    // Written by the v1 postConfirmation trigger on the shared pool, so a
    // member who signed up in v1 already has a row here.
    const { Item } = await ddb.send(
      new GetCommand({ TableName: Tables.users, Key: { userId } }),
    );
    if (!Item) {
      throw new HttpError(404, 'User not found');
    }

    return json(200, {
      userId: Item.userId,
      email: Item.email,
      name: Item.name ?? '',
      nickname: Item.nickname ?? '',
      profilePictureKey: Item.profilePictureKey,
      createdAt: Item.createdAt,
    });
  });
}
