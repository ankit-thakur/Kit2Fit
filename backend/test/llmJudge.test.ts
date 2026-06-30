const mockCreate = jest.fn();

jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: { create: mockCreate },
    })),
  };
});

jest.mock('@aws-sdk/client-secrets-manager', () => ({
  SecretsManagerClient: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({ SecretString: 'test-api-key' }),
  })),
  GetSecretValueCommand: jest.fn().mockImplementation((input) => input),
}));

process.env.ANTHROPIC_SECRET_NAME = 'test-secret';

import {
  judgeGoalContribution,
  parseJudgeResponse,
  judgeChallengeMatch,
  parseChallengeMatchResponse,
} from '../src/lib/llmJudge';

function anthropicResponse(text: string | null) {
  return {
    content: text !== null ? [{ type: 'text', text }] : [],
  };
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
    mockCreate.mockReset();
  });

  const input = {
    workoutDescription: 'Ran 5 interval sprints',
    goalDescription: 'Run a faster mile',
    metricUnit: 'minutes',
  };

  it('returns the parsed result on a successful API call', async () => {
    mockCreate.mockResolvedValue(
      anthropicResponse('{"contributes": true, "reason": "Direct sprint work."}'),
    );

    const result = await judgeGoalContribution(input);
    expect(result).toEqual({ contributes: true, reason: 'Direct sprint work.' });
  });

  it('falls back to contributes: false when the API call throws', async () => {
    mockCreate.mockRejectedValue(new Error('network error'));

    const result = await judgeGoalContribution(input);
    expect(result).toEqual({
      contributes: false,
      reason: 'Unable to evaluate goal contribution',
    });
  });

  it('falls back to contributes: false when the response has no text block', async () => {
    mockCreate.mockResolvedValue(anthropicResponse(null));

    const result = await judgeGoalContribution(input);
    expect(result).toEqual({
      contributes: false,
      reason: 'Unable to evaluate goal contribution',
    });
  });
});

describe('parseChallengeMatchResponse', () => {
  const challenges = [
    { challengeId: 'challenge-1', title: 'Pushup Challenge', description: 'Do 20 pushups' },
    { challengeId: 'challenge-2', title: '5K Run', description: 'Run a 5k' },
  ];

  it('parses a well-formed JSON response with a valid challengeId', () => {
    const result = parseChallengeMatchResponse(
      '{"matched": true, "challengeId": "challenge-1", "reason": "Did pushups."}',
      challenges,
    );
    expect(result).toEqual({ matched: true, challengeId: 'challenge-1', reason: 'Did pushups.' });
  });

  it('parses JSON embedded in surrounding text', () => {
    const result = parseChallengeMatchResponse(
      'Here you go:\n{"matched": false, "challengeId": null, "reason": "Not related."}\nDone!',
      challenges,
    );
    expect(result).toEqual({ matched: false, challengeId: undefined, reason: 'Not related.' });
  });

  it('treats matched as false if the challengeId is not one of the candidates', () => {
    const result = parseChallengeMatchResponse(
      '{"matched": true, "challengeId": "nonexistent", "reason": "Hallucinated id."}',
      challenges,
    );
    expect(result).toEqual({ matched: false, challengeId: undefined, reason: 'Hallucinated id.' });
  });

  it('defaults to matched: false on malformed JSON', () => {
    const result = parseChallengeMatchResponse('not json at all', challenges);
    expect(result).toEqual({ matched: false });
  });

  it('defaults to matched: false when the field is missing', () => {
    const result = parseChallengeMatchResponse('{"reason": "missing the boolean"}', challenges);
    expect(result).toEqual({ matched: false });
  });
});

describe('judgeChallengeMatch', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  const challenges = [{ challengeId: 'challenge-1', title: 'Pushup Challenge', description: 'Do 20 pushups' }];

  it('returns matched: false without calling the API when there are no candidate challenges', async () => {
    const result = await judgeChallengeMatch({ workoutDescription: 'Ran 3 miles', challenges: [] });
    expect(result).toEqual({ matched: false });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns the parsed result on a successful API call', async () => {
    mockCreate.mockResolvedValue(
      anthropicResponse('{"matched": true, "challengeId": "challenge-1", "reason": "Did 20 pushups."}'),
    );

    const result = await judgeChallengeMatch({
      workoutDescription: 'Ran 3 miles and did 20 pushups',
      challenges,
    });
    expect(result).toEqual({ matched: true, challengeId: 'challenge-1', reason: 'Did 20 pushups.' });
  });

  it('falls back to matched: false when the API call throws', async () => {
    mockCreate.mockRejectedValue(new Error('network error'));

    const result = await judgeChallengeMatch({ workoutDescription: 'Ran 3 miles', challenges });
    expect(result).toEqual({ matched: false });
  });
});
