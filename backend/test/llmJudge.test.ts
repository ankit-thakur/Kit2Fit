const mockSend = jest.fn();

jest.mock('@aws-sdk/client-bedrock-runtime', () => {
  return {
    BedrockRuntimeClient: jest.fn().mockImplementation(() => ({
      send: mockSend,
    })),
    InvokeModelCommand: jest.fn().mockImplementation((input) => input),
  };
});

import { judgeGoalContribution, parseJudgeResponse } from '../src/lib/llmJudge';

function bedrockResponse(content: unknown) {
  return { body: new TextEncoder().encode(JSON.stringify({ content })) };
}

describe('parseJudgeResponse', () => {
  it('parses a well-formed JSON response', () => {
    const result = parseJudgeResponse('{"contributes": true, "reason": "It is a run."}');
    expect(result).toEqual({ contributes: true, reason: 'It is a run.' });
  });

  it('parses JSON embedded in surrounding text', () => {
    const result = parseJudgeResponse(
      'Sure, here is my answer:\n{"contributes": false, "reason": "Not related."}\nThanks!',
    );
    expect(result).toEqual({ contributes: false, reason: 'Not related.' });
  });

  it('defaults to contributes: false on malformed JSON', () => {
    const result = parseJudgeResponse('not json at all');
    expect(result).toEqual({
      contributes: false,
      reason: 'Unable to evaluate goal contribution',
    });
  });

  it('defaults to contributes: false when the field is missing', () => {
    const result = parseJudgeResponse('{"reason": "missing the boolean"}');
    expect(result).toEqual({
      contributes: false,
      reason: 'Unable to evaluate goal contribution',
    });
  });
});

describe('judgeGoalContribution', () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  const input = {
    workoutDescription: 'Ran 5 interval sprints',
    goalDescription: 'Run a faster mile',
    metricUnit: 'minutes',
    previousMetricValue: 8,
    newMetricValue: 7.5,
  };

  it('returns the parsed result on a successful API call', async () => {
    mockSend.mockResolvedValue(
      bedrockResponse([{ type: 'text', text: '{"contributes": true, "reason": "Direct sprint work."}' }]),
    );

    const result = await judgeGoalContribution(input);
    expect(result).toEqual({ contributes: true, reason: 'Direct sprint work.' });
  });

  it('falls back to contributes: false when the API call throws', async () => {
    mockSend.mockRejectedValue(new Error('network error'));

    const result = await judgeGoalContribution(input);
    expect(result).toEqual({
      contributes: false,
      reason: 'Unable to evaluate goal contribution',
    });
  });

  it('falls back to contributes: false when the response has no text block', async () => {
    mockSend.mockResolvedValue(bedrockResponse([]));

    const result = await judgeGoalContribution(input);
    expect(result).toEqual({
      contributes: false,
      reason: 'Unable to evaluate goal contribution',
    });
  });
});
