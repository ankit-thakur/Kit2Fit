import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, Tables } from '../../lib/dynamo';
import { getUserId } from '../../lib/auth';
import { requireMembership } from '../../lib/groups';
import { json, handleErrors, HttpError } from '../../lib/http';
import { calculateDurationPoints, calculateTotalPoints } from '../../lib/points';
import { judgeGoalContribution } from '../../lib/llmJudge';
import { matchAdhocChallenge } from '../../lib/adhocMatch';
import { hasLaterLog } from '../../lib/logs';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  return handleErrors(async () => {
    const userId = getUserId(event);
    const groupId = event.pathParameters?.groupId;
    if (!groupId) {
      throw new HttpError(400, 'groupId is required');
    }

    const membership = await requireMembership(groupId, userId);

    const body = JSON.parse(event.body ?? '{}');
    const { date, minutesWorkedOut, description } = body;
    const metricValueAfter: number | null = typeof body.metricValueAfter === 'number' ? body.metricValueAfter : null;
    if (!date || typeof minutesWorkedOut !== 'number' || typeof description !== 'string') {
      throw new HttpError(400, 'date, minutesWorkedOut, and description are required');
    }

    const groupIdUserId = `${groupId}#${userId}`;
    const { Item: existingLog } = await ddb.send(
      new GetCommand({ TableName: Tables.dailyLogs, Key: { groupIdUserId, date } }),
    );
    if (existingLog) {
      throw new HttpError(409, 'A log already exists for this date; use update instead');
    }

    const durationPoints = calculateDurationPoints(minutesWorkedOut);

    const [judgeResult, adhocResult, isBackfill] = await Promise.all([
      judgeGoalContribution({
        workoutDescription: description,
        goalDescription: membership.goalDescription ?? '',
        metricUnit: membership.metricUnit ?? '',
        previousMetricValue: membership.currentMetricValue ?? 0,
        newMetricValue: metricValueAfter ?? membership.currentMetricValue ?? 0,
      }),
      matchAdhocChallenge(groupId, date, description),
      hasLaterLog(groupIdUserId, date),
    ]);

    const llmBonusPoint = judgeResult.contributes ? 1 : 0;
    const adhocBonusPoint = adhocResult.matched ? 1 : 0;
    const totalPointsForDay = calculateTotalPoints(durationPoints, llmBonusPoint, adhocBonusPoint);
    const now = new Date().toISOString();

    await ddb.send(
      new PutCommand({
        TableName: Tables.dailyLogs,
        Item: {
          groupIdUserId,
          groupId,
          userId,
          dateUserId: `${date}#${userId}`,
          date,
          minutesWorkedOut,
          description,
          ...(metricValueAfter !== null ? { metricValueAfter } : {}),
          durationPoints,
          llmBonusPoint,
          llmBonusReason: judgeResult.reason,
          adhocBonusPoint,
          adhocChallengeId: adhocResult.challengeId,
          totalPointsForDay,
          createdAt: now,
          updatedAt: now,
        },
      }),
    );

    await ddb.send(
      new UpdateCommand({
        TableName: Tables.groupMemberships,
        Key: { groupId, userId },
        UpdateExpression:
          isBackfill || metricValueAfter === null
            ? 'ADD totalPoints :points'
            : 'SET currentMetricValue = :metricValueAfter ADD totalPoints :points',
        ExpressionAttributeValues:
          !isBackfill && metricValueAfter !== null
            ? { ':metricValueAfter': metricValueAfter, ':points': totalPointsForDay }
            : { ':points': totalPointsForDay },
      }),
    );

    return json(201, {
      date,
      durationPoints,
      llmBonusPoint,
      llmBonusReason: judgeResult.reason,
      adhocBonusPoint,
      totalPointsForDay,
    });
  });
}
