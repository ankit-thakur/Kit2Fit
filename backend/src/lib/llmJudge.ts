import Anthropic from '@anthropic-ai/sdk';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

export interface GoalContributionInput {
  workoutDescription: string;
  goalDescription: string;
  metricUnit: string;
}

export interface GoalContributionResult {
  contributes: boolean;
  reason: string;
}

export interface ChallengeCandidate {
  challengeId: string;
  title: string;
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

const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001';

let anthropicClient: Anthropic | undefined;
const secretsClient = new SecretsManagerClient({});

async function getClient(): Promise<Anthropic> {
  if (anthropicClient) return anthropicClient;
  const secretName = process.env.ANTHROPIC_SECRET_NAME;
  if (!secretName) throw new Error('ANTHROPIC_SECRET_NAME env var not set');
  const { SecretString } = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: secretName }),
  );
  if (!SecretString) throw new Error('Anthropic API key secret is empty');
  anthropicClient = new Anthropic({ apiKey: SecretString });
  return anthropicClient;
}

function buildPrompt(input: GoalContributionInput): string {
  return `A user has this fitness goal: "${input.goalDescription}" (tracked in ${input.metricUnit}).
Today's workout: "${input.workoutDescription}"

The user did not log their ${input.metricUnit} today, so judge based solely on whether this workout DIRECTLY practices or trains what the goal requires. Indirect or supporting benefits do not count — only award true if the workout itself is the activity the goal is about.

Examples:
- Goal: run a faster mile → tempo run or intervals: YES; leg press or squats: NO
- Goal: lose weight → sustained cardio session (20+ min): YES; a few burpees or a primarily strength workout: NO
- Goal: increase bench press max → bench press sets: YES; push-ups or overhead press: NO

When in doubt, answer false. Do not give credit for effort that only indirectly helps.

Respond with ONLY a JSON object, no other text:
{"contributes": true or false, "reason": "one short sentence explaining why"}`;
}

export async function judgeGoalContribution(
  input: GoalContributionInput,
): Promise<GoalContributionResult> {
  try {
    const client = await getClient();
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 200,
      messages: [{ role: 'user', content: buildPrompt(input) }],
    });
    const block = message.content.find((b) => b.type === 'text');
    if (!block || block.type !== 'text') throw new Error('No text block in response');
    return parseJudgeResponse(block.text);
  } catch (err) {
    console.error('LLM goal judge failed, defaulting to no bonus', err);
    return { contributes: false, reason: 'Unable to evaluate goal contribution' };
  }
}

function buildChallengePrompt(input: ChallengeMatchInput): string {
  const challengeList = input.challenges
    .map((c, i) => `${i + 1}. (id: "${c.challengeId}") "${c.title}" — ${c.description}`)
    .join('\n');
  return `A user logged today's workout: "${input.workoutDescription}"

Group challenges active today:
${challengeList}

A challenge is COMPLETED if the user's workout contains or includes the specific activity the challenge requires, even if the workout also includes other activities. Focus on whether the challenge requirement was actually performed.

Respond with ONLY a JSON object, no other text:
{"matched": true or false, "challengeId": "the id of the completed challenge, or null if none matched", "reason": "one short sentence explaining why"}`;
}

export async function judgeChallengeMatch(input: ChallengeMatchInput): Promise<ChallengeMatchResult> {
  if (input.challenges.length === 0) {
    return { matched: false };
  }

  try {
    const client = await getClient();
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 200,
      messages: [{ role: 'user', content: buildChallengePrompt(input) }],
    });
    const block = message.content.find((b) => b.type === 'text');
    if (!block || block.type !== 'text') throw new Error('No text block in response');
    return parseChallengeMatchResponse(block.text, input.challenges);
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
