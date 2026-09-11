import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import type { Group, GroupMembership } from '@shared/v2/types';
import { DEFAULT_COMMITMENT_CAP } from '@shared/v2/adherence';
import { ddb, Tables } from '../../lib/dynamo';
import { getUserId } from '../../../lib/auth';
import { json, handleErrors, HttpError } from '../../../lib/http';
import { parseBody, requireDate, requireString, requireTimeZone } from '../../lib/validate';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  return handleErrors(async () => {
    const userId = getUserId(event);
    const body = parseBody(event.body);

    const name = requireString(body.name, 'name', 60);
    const timeZone = requireTimeZone(body.timeZone);
    const challengeStartDate = requireDate(body.challengeStartDate, 'challengeStartDate');
    const challengeEndDate = requireDate(body.challengeEndDate, 'challengeEndDate');
    if (challengeStartDate > challengeEndDate) {
      throw new HttpError(400, 'challengeStartDate must be on or before challengeEndDate');
    }

    const commitmentCap =
      typeof body.commitmentCap === 'number' ? body.commitmentCap : DEFAULT_COMMITMENT_CAP;
    if (!Number.isInteger(commitmentCap) || commitmentCap < 1 || commitmentCap > 49) {
      throw new HttpError(400, 'commitmentCap must be a whole number between 1 and 49');
    }

    const groupId = randomUUID();
    const now = new Date().toISOString();

    const group: Group = {
      groupId,
      name,
      timeZone,
      challengeStartDate,
      challengeEndDate,
      commitmentCap,
      adminUserId: userId,
      createdAt: now,
    };

    // The creator's membership carries no goal: pledges are separate records,
    // set during onboarding, because a member can hold several.
    const membership: GroupMembership = {
      groupId,
      userId,
      role: 'admin',
      joinedAt: now,
    };

    await ddb.send(
      new TransactWriteCommand({
        TransactItems: [
          { Put: { TableName: Tables.groups, Item: group } },
          { Put: { TableName: Tables.groupMemberships, Item: membership } },
        ],
      }),
    );

    return json(201, { group, membership });
  });
}
