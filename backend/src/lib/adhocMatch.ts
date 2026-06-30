import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, Tables } from './dynamo';
import { judgeChallengeMatch } from './llmJudge';

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

  if (challenges.length === 0) {
    return { matched: false };
  }

  const result = await judgeChallengeMatch({
    workoutDescription: description,
    challenges: challenges.map((c) => ({ challengeId: c.challengeId, title: c.title, description: c.description })),
  });

  return result.matched ? { matched: true, challengeId: result.challengeId } : { matched: false };
}
