import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserId } from '../../../lib/auth';
import { json, handleErrors, HttpError } from '../../../lib/http';
import { getSecretValue } from '../../../lib/secrets';
import { signInviteToken } from '../../../lib/inviteToken';
import { requireAdmin } from '../../lib/groups';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  return handleErrors(async () => {
    const userId = getUserId(event);
    const groupId = event.pathParameters?.groupId;
    if (!groupId) {
      throw new HttpError(400, 'groupId is required');
    }
    await requireAdmin(groupId, userId);

    const secretArn = process.env.INVITE_LINK_SECRET_ARN;
    // v2 signs with its own secret, so a v1 invite link can never open a v2
    // group and vice versa.
    if (!secretArn) {
      throw new HttpError(500, 'Invite link secret not configured');
    }
    const secret = await getSecretValue(secretArn);
    const token = signInviteToken(groupId, secret);

    // Configured per deployment rather than hardcoded, which is what sent v1's
    // invite links to a fixed host.
    const baseUrl = process.env.APP_BASE_URL;
    if (!baseUrl) {
      throw new HttpError(500, 'APP_BASE_URL not configured');
    }

    return json(201, { token, url: `${baseUrl.replace(/\/$/, '')}/join?token=${token}` });
  });
}
