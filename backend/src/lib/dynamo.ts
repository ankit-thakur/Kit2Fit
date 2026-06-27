import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
export const ddb = DynamoDBDocumentClient.from(client);

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const Tables = {
  get users() {
    return requireEnv('USERS_TABLE');
  },
  get groups() {
    return requireEnv('GROUPS_TABLE');
  },
  get groupMemberships() {
    return requireEnv('GROUP_MEMBERSHIPS_TABLE');
  },
  get dailyLogs() {
    return requireEnv('DAILY_LOGS_TABLE');
  },
  get adhocChallenges() {
    return requireEnv('ADHOC_CHALLENGES_TABLE');
  },
};
