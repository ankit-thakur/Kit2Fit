import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, Tables } from '../../lib/dynamo';
import { getUserId } from '../../lib/auth';
import { json, handleErrors } from '../../lib/http';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  return handleErrors(async () => {
    const userId = getUserId(event);

    const { Items: memberships = [] } = await ddb.send(
      new QueryCommand({
        TableName: Tables.groupMemberships,
        IndexName: 'GSI1-UserGroups',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: { ':userId': userId },
      }),
    );

    if (memberships.length === 0) {
      return json(200, { groups: [] });
    }

    const { Responses } = await ddb.send(
      new BatchGetCommand({
        RequestItems: {
          [Tables.groups]: {
            Keys: memberships.map((m) => ({ groupId: m.groupId })),
          },
        },
      }),
    );

    const groupsById = new Map(
      (Responses?.[Tables.groups] ?? []).map((g) => [g.groupId, g]),
    );

    const groups = memberships.map((membership) => ({
      ...groupsById.get(membership.groupId),
      membership,
    }));

    return json(200, { groups });
  });
}
