import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserId } from '../../lib/auth';
import { requireAdmin } from '../../lib/groups';
import { json, handleErrors, HttpError } from '../../lib/http';
import { getSecretValue } from '../../lib/secrets';
import { signInviteToken } from '../../lib/inviteToken';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  return handleErrors(async () => {
    const userId = getUserId(event);
    const groupId = event.pathParameters?.groupId;
    if (!groupId) {
      throw new HttpError(400, 'groupId is required');
    }
    await requireAdmin(groupId, userId);

    const secretArn = process.env.INVITE_LINK_SECRET_ARN;
    if (!secretArn) {
      throw new HttpError(500, 'Invite link secret not configured');
    }
    const secret = await getSecretValue(secretArn);

    const body = JSON.parse(event.body ?? '{}');
    const expirySeconds = typeof body.expirySeconds === 'number' ? body.expirySeconds : undefined;

    const token = signInviteToken(groupId, secret, expirySeconds);
    const baseUrl = process.env.APP_BASE_URL ?? 'https://kit2fit.example.com';

    return json(201, { token, inviteUrl: `${baseUrl}/join?token=${token}` });
  });
}
