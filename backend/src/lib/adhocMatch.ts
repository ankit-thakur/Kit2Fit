import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, Tables } from './dynamo';

export interface AdhocMatchResult {
  matched: boolean;
  challengeId?: string;
}

export async function matchAdhocChallenge(
  groupId: string,
  date: string,
  description: string,
): Promise<AdhocMatchResult> {
  const { Items: challenges = [] } = await ddb.send(
    new QueryCommand({
      TableName: Tables.adhocChallenges,
      KeyConditionExpression: 'groupId = :groupId',
      FilterExpression: 'startDate <= :date AND endDate >= :date',
      ExpressionAttributeValues: { ':groupId': groupId, ':date': date },
    }),
  );

  const lowerDescription = description.toLowerCase();
  const match = challenges.find((challenge) =>
    (challenge.keywords as string[]).some((keyword) =>
      lowerDescription.includes(keyword.toLowerCase()),
    ),
  );

  return match ? { matched: true, challengeId: match.challengeId } : { matched: false };
}
