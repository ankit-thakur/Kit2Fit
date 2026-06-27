import { signInviteToken, verifyInviteToken } from '../src/lib/inviteToken';

describe('inviteToken', () => {
  const secret = 'test-secret';

  it('round-trips a valid token', () => {
    const token = signInviteToken('group-123', secret);
    const payload = verifyInviteToken(token, secret);
    expect(payload.groupId).toBe('group-123');
  });

  it('rejects an expired token', () => {
    const token = signInviteToken('group-123', secret, -1);
    expect(() => verifyInviteToken(token, secret)).toThrow('expired');
  });

  it('rejects a tampered payload', () => {
    const token = signInviteToken('group-123', secret);
    const [encodedPayload, signature] = token.split('.');
    const tamperedPayload = Buffer.from(
      JSON.stringify({ groupId: 'group-456', exp: Date.now() + 100000 }),
    ).toString('base64url');
    const tamperedToken = `${tamperedPayload}.${signature}`;
    expect(() => verifyInviteToken(tamperedToken, secret)).toThrow('Invalid invite token signature');
  });

  it('rejects a token signed with a different secret', () => {
    const token = signInviteToken('group-123', secret);
    expect(() => verifyInviteToken(token, 'wrong-secret')).toThrow('Invalid invite token signature');
  });

  it('rejects a malformed token', () => {
    expect(() => verifyInviteToken('not-a-valid-token', secret)).toThrow('Malformed invite token');
  });
});
