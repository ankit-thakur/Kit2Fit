import Anthropic from '@anthropic-ai/sdk';

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

const MODEL = 'claude-haiku-4-5';

let client: Anthropic | undefined;
function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
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
    const response = await getClient().messages.create({
      model: MODEL,
      max_tokens: 200,
      messages: [{ role: 'user', content: buildPrompt(input) }],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
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
