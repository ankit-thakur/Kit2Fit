import { config } from '../config';
import { getCurrentSession } from '../auth/cognito';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function authHeader(): Promise<Record<string, string>> {
  const session = await getCurrentSession();
  if (!session?.isValid()) {
    throw new ApiError(401, 'Not authenticated');
  }
  return { Authorization: session.getIdToken().getJwtToken() };
}

export async function apiRequest<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(await authHeader()),
  };

  const response = await fetch(`${config.apiUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : undefined;

  if (!response.ok) {
    throw new ApiError(response.status, data?.message ?? 'Request failed');
  }

  return data as T;
}
