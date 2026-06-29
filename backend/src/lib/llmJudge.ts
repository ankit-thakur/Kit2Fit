import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

export interface GoalContributionInput {
  workoutDescription: string;
  goalDescription: string;
  metricUnit: string;
  previousMetricValue: number;
  newMetricValue: number;
}

export interface GoalContributionResult {
  contributes: boolean;
  reason: string;
}

export interface ChallengeCandidate {
  challengeId: string;
  description: string;
}

export interface ChallengeMatchInput {
  workoutDescription: string;
  challenges: ChallengeCandidate[];
}

export interface ChallengeMatchResult {
  matched: boolean;
  challengeId?: string;
  reason?: string;
}

const MODEL_ID = process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-haiku-4-5-20251001-v1:0';

let client: BedrockRuntimeClient | undefined;
function getClient(): BedrockRuntimeClient {
  if (!client) {
    client = new BedrockRuntimeClient({});
  }
  return client;
}

function buildPrompt(input: GoalContributionInput): string {
  return `A user in a friendly fitness challenge has this goal: "${input.goalDescription}" (tracked in ${input.metricUnit}).
Today's workout description: "${input.workoutDescription}"

Decide whether today's workout activity itself DIRECTLY contributes to this specific goal (not just general fitness/health). Judge based on the activity type only — do not factor in any metric numbers, since metric progress toward the goal is scored separately. For example, if the goal is a faster mile time, a run-specific workout like interval sprints directly contributes, but an unrelated workout like a weighted leg day does not, even though it may help indirectly.

Respond with ONLY a JSON object, no other text, in this exact shape:
{"contributes": true or false, "reason": "one short sentence explaining why"}`;
}

export async function judgeGoalContribution(
  input: GoalContributionInput,
): Promise<GoalContributionResult> {
  try {
    const command = new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 200,
        messages: [{ role: 'user', content: buildPrompt(input) }],
      }),
    });

    const response = await getClient().send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    const textBlock = responseBody.content?.find((block: { type: string }) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text content in LLM response');
    }

    return parseJudgeResponse(textBlock.text);
  } catch (err) {
    console.error('LLM goal judge failed, defaulting to no bonus', err);
    return { contributes: false, reason: 'Unable to evaluate goal contribution' };
  }
}

function buildChallengePrompt(input: ChallengeMatchInput): string {
  const challengeList = input.challenges
    .map((c, i) => `${i + 1}. (id: "${c.challengeId}") ${c.description}`)
    .join('\n');
  return `A user in a friendly fitness challenge logged today's workout: "${input.workoutDescription}"

Here are the group's currently active surprise challenges:
${challengeList}

Decide whether the workout satisfies ANY one of these challenges. Judge based on whether the activity described genuinely matches what the challenge asks for, not just shared words.

Respond with ONLY a JSON object, no other text, in this exact shape:
{"matched": true or false, "challengeId": "the id of the matching challenge, or null if none", "reason": "one short sentence explaining why"}`;
}

export async function judgeChallengeMatch(input: ChallengeMatchInput): Promise<ChallengeMatchResult> {
  if (input.challenges.length === 0) {
    return { matched: false };
  }

  try {
    const command = new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 200,
        messages: [{ role: 'user', content: buildChallengePrompt(input) }],
      }),
    });

    const response = await getClient().send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    const textBlock = responseBody.content?.find((block: { type: string }) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text content in LLM response');
    }

    return parseChallengeMatchResponse(textBlock.text, input.challenges);
  } catch (err) {
    console.error('LLM challenge judge failed, defaulting to no match', err);
    return { matched: false };
  }
}

export function parseChallengeMatchResponse(
  text: string,
  challenges: ChallengeCandidate[],
): ChallengeMatchResult {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    const jsonText = match ? match[0] : text;
    const parsed = JSON.parse(jsonText);
    if (typeof parsed.matched !== 'boolean') {
      throw new Error('Missing or invalid "matched" field');
    }
    const challengeId = typeof parsed.challengeId === 'string' ? parsed.challengeId : undefined;
    const isValidId = challengeId !== undefined && challenges.some((c) => c.challengeId === challengeId);
    return {
      matched: parsed.matched && isValidId,
      challengeId: parsed.matched && isValidId ? challengeId : undefined,
      reason: typeof parsed.reason === 'string' ? parsed.reason : undefined,
    };
  } catch (err) {
    console.error('Failed to parse LLM challenge judge response, defaulting to no match', err, text);
    return { matched: false };
  }
}

export function parseJudgeResponse(text: string): GoalContributionResult {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    const jsonText = match ? match[0] : text;
    const parsed = JSON.parse(jsonText);
    if (typeof parsed.contributes !== 'boolean') {
      throw new Error('Missing or invalid "contributes" field');
    }
    return {
      contributes: parsed.contributes,
      reason: typeof parsed.reason === 'string' ? parsed.reason : '',
    };
  } catch (err) {
    console.error('Failed to parse LLM judge response, defaulting to no bonus', err, text);
    return { contributes: false, reason: 'Unable to evaluate goal contribution' };
  }
}
