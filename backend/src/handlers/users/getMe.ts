import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ddb, Tables } from '../../lib/dynamo';
import { getUserId } from '../../lib/auth';
import { json, handleErrors, HttpError } from '../../lib/http';
import { s3Client } from '../../lib/s3';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  return handleErrors(async () => {
    const userId = getUserId(event);

    const { Item: user } = await ddb.send(
      new GetCommand({ TableName: Tables.users, Key: { userId } }),
    );

    if (!user) {
      throw new HttpError(404, 'User not found');
    }

    let profilePictureUrl: string | undefined;
    if (user.profilePictureKey && process.env.PROFILE_PICTURES_BUCKET) {
      profilePictureUrl = await getSignedUrl(
        s3Client,
        new GetObjectCommand({
          Bucket: process.env.PROFILE_PICTURES_BUCKET,
          Key: user.profilePictureKey,
        }),
        { expiresIn: 300 },
      );
    }

    return json(200, { ...user, profilePictureUrl });
  });
}
