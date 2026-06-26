import { createHmac, timingSafeEqual } from 'crypto';

interface InvitePayload {
  groupId: string;
  exp: number;
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input).toString('base64url');
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf-8');
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function signInviteToken(
  groupId: string,
  secret: string,
  expirySeconds = 7 * 24 * 60 * 60,
): string {
  const payload: InvitePayload = { groupId, exp: Date.now() + expirySeconds * 1000 };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export function verifyInviteToken(token: string, secret: string): InvitePayload {
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) {
    throw new Error('Malformed invite token');
  }

  const expectedSignature = sign(encodedPayload, secret);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    throw new Error('Invalid invite token signature');
  }

  const payload: InvitePayload = JSON.parse(base64UrlDecode(encodedPayload));
  if (payload.exp < Date.now()) {
    throw new Error('Invite token has expired');
  }

  return payload;
}
