import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
export const ddb = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * v2 table names. `users` is the table the v1 stack owns — identity is shared
 * so members keep their accounts and their userId. Everything else is v2's own.
 */
export const Tables = {
  get users() {
    return requireEnv('USERS_TABLE');
  },
  get groups() {
    return requireEnv('V2_GROUPS_TABLE');
  },
  get groupMemberships() {
    return requireEnv('V2_GROUP_MEMBERSHIPS_TABLE');
  },
  get pledges() {
    return requireEnv('V2_PLEDGES_TABLE');
  },
  get completions() {
    return requireEnv('V2_COMPLETIONS_TABLE');
  },
  get weekScores() {
    return requireEnv('V2_WEEK_SCORES_TABLE');
  },
  get events() {
    return requireEnv('V2_EVENTS_TABLE');
  },
  get eventRsvps() {
    return requireEnv('V2_EVENT_RSVPS_TABLE');
  },
};
