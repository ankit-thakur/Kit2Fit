import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, Tables } from './dynamo';

export interface AdhocMatchResult {
  matched: boolean;
  challengeId?: string;
}

const MODEL_ID = process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-haiku-4-5-20251001-v1:0';

let client: BedrockRuntimeClient | undefined;
function getClient(): BedrockRuntimeClient {
  if (!client) client = new BedrockRuntimeClient({});
  return client;
}

async function llmMatchesChallenge(
  workoutDescription: string,
  challengeTitle: string,
  challengeDescription: string,
): Promise<boolean> {
  try {
    const prompt = `Challenge: "${challengeTitle}"
What it takes: "${challengeDescription}"
User's workout: "${workoutDescription}"

Did this workout clearly satisfy the challenge? Be generous — if the workout plausibly meets the criteria, count it.
Respond with ONLY JSON: {"matched": true or false}`;

    const command = new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 50,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const response = await getClient().send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const textBlock = responseBody.content?.find((b: { type: string }) => b.type === 'text');
    if (!textBlock) return false;

    const jsonMatch = (textBlock.text as string).match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    return parsed.matched === true;
  } catch {
    return false;
  }
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

  if (challenges.length === 0) return { matched: false };

  const results = await Promise.all(
    challenges.map(async (challenge) => ({
      challengeId: challenge.challengeId as string,
      matched: await llmMatchesChallenge(description, challenge.title, challenge.description),
    })),
  );

  const match = results.find((r) => r.matched);
  return match ? { matched: true, challengeId: match.challengeId } : { matched: false };
}
