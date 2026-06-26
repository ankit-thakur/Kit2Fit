import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getUserId } from '../../lib/auth';
import { json, handleErrors, HttpError } from '../../lib/http';
import { s3Client } from '../../lib/s3';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  return handleErrors(async () => {
    const userId = getUserId(event);
    const bucket = process.env.PROFILE_PICTURES_BUCKET;
    if (!bucket) {
      throw new HttpError(500, 'Profile pictures bucket not configured');
    }

    const key = `profile-pictures/${userId}/${randomUUID()}.jpg`;

    const uploadUrl = await getSignedUrl(
      s3Client,
      new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: 'image/jpeg' }),
      { expiresIn: 300 },
    );

    return json(200, { uploadUrl, key });
  });
}
