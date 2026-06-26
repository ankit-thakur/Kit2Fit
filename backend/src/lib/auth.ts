import type { APIGatewayProxyEvent } from 'aws-lambda';
import { HttpError } from './http';

export function getUserId(event: APIGatewayProxyEvent): string {
  const claims = event.requestContext.authorizer?.claims;
  const sub = claims?.sub;
  if (!sub) {
    throw new HttpError(401, 'Unauthenticated');
  }
  return sub;
}
