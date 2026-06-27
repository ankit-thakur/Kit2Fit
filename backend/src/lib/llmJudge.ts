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

const MODEL_ID = process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-haiku-4-5-20251001-v1:0';

let client: BedrockRuntimeClient | undefined;
function getClient(): BedrockRuntimeClient {
  if (!client) {
    client = new BedrockRuntimeClient({});
  }
  return client;
}

function buildPrompt(input: GoalContributionInput): string {
  const metricDelta = input.newMetricValue - input.previousMetricValue;
  return `A user in a friendly fitness challenge has this goal: "${input.goalDescription}" (tracked in ${input.metricUnit}).
Their metric changed from ${input.previousMetricValue} to ${input.newMetricValue} (delta: ${metricDelta}) ${input.metricUnit} today.
Today's workout description: "${input.workoutDescription}"

Decide whether today's workout DIRECTLY contributes to this specific goal (not just general fitness/health). For example, if the goal is a faster mile time, a run-specific workout like interval sprints directly contributes, but an unrelated workout like a weighted leg day does not, even though it may help indirectly.

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
