import { HttpError } from '../../lib/http';
import { isValidTimeZone } from '@shared/v2/week';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function requireString(value: unknown, field: string, maxLength = 200): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new HttpError(400, `${field} is required`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new HttpError(400, `${field} must be ${maxLength} characters or fewer`);
  }
  return trimmed;
}

export function requireDate(value: unknown, field: string): string {
  const raw = requireString(value, field, 10);
  if (!ISO_DATE.test(raw) || Number.isNaN(Date.parse(`${raw}T00:00:00Z`))) {
    throw new HttpError(400, `${field} must be a YYYY-MM-DD date`);
  }
  return raw;
}

export function requireTimeZone(value: unknown): string {
  const raw = requireString(value, 'timeZone', 64);
  if (!isValidTimeZone(raw)) {
    throw new HttpError(400, `Unknown time zone "${raw}"`);
  }
  return raw;
}

export function parseBody(body: string | null): Record<string, unknown> {
  if (!body) return {};
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('not an object');
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new HttpError(400, 'Request body must be a JSON object');
  }
}
