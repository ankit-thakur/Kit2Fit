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
import { GOAL_CATEGORIES, isGoalCategory } from '../../lib/goalCategories';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  return handleErrors(async () => {
    const userId = getUserId(event);
    const groupId = event.pathParameters?.groupId;
    if (!groupId) {
      throw new HttpError(400, 'groupId is required');
    }

    const membership = await requireMembership(groupId, userId);

    const body = JSON.parse(event.body ?? '{}');
    const { date, minutesWorkedOut, description, metricValueAfter } = body;
    if (
      !date ||
      typeof minutesWorkedOut !== 'number' ||
      typeof description !== 'string' ||
      typeof metricValueAfter !== 'number'
    ) {
      throw new HttpError(
        400,
        'date, minutesWorkedOut, description, and metricValueAfter are required',
      );
    }

    const groupIdUserId = `${groupId}#${userId}`;
    const { Item: existingLog } = await ddb.send(
      new GetCommand({ TableName: Tables.dailyLogs, Key: { groupIdUserId, date } }),
    );
    if (existingLog) {
      throw new HttpError(409, 'A log already exists for this date; use update instead');
    }

    const durationPoints = calculateDurationPoints(minutesWorkedOut);
    const previousMetricValue = membership.currentMetricValue ?? 0;
    const isDailyHabit =
      isGoalCategory(membership.goalCategory) &&
      GOAL_CATEGORIES[membership.goalCategory].goalType === 'daily_habit';

    const [judgeResult, adhocResult, isBackfill] = await Promise.all([
      judgeGoalContribution({
        workoutDescription: description,
        goalDescription: membership.goalDescription ?? '',
        metricUnit: membership.metricUnit ?? '',
        previousMetricValue,
        newMetricValue: metricValueAfter,
      }),
      matchAdhocChallenge(groupId, date, description),
      hasLaterLog(groupIdUserId, date),
    ]);

    const metricMovedFavorably = isDailyHabit
      ? metricValueAfter >= (membership.targetMetricValue ?? 0)
      : typeof membership.targetMetricValue === 'number' &&
        Math.abs(membership.targetMetricValue - metricValueAfter) <
          Math.abs(membership.targetMetricValue - previousMetricValue);

    const llmBonusPoint = judgeResult.contributes || metricMovedFavorably ? 1 : 0;
    const llmBonusReason = judgeResult.contributes
      ? judgeResult.reason
      : metricMovedFavorably
        ? isDailyHabit
          ? `You hit your daily target of ${membership.targetMetricValue} ${membership.metricUnit ?? 'count'} with ${metricValueAfter}.`
          : `Your ${membership.metricUnit ?? 'metric'} moved from ${previousMetricValue} to ${metricValueAfter}, trending toward your goal.`
        : judgeResult.reason;
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
          metricValueAfter,
          durationPoints,
          llmBonusPoint,
          llmBonusReason,
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
        UpdateExpression: isBackfill
          ? 'ADD totalPoints :points'
          : 'SET currentMetricValue = :metricValueAfter ADD totalPoints :points',
        ExpressionAttributeValues: isBackfill
          ? { ':points': totalPointsForDay }
          : { ':metricValueAfter': metricValueAfter, ':points': totalPointsForDay },
      }),
    );

    return json(201, {
      date,
      durationPoints,
      llmBonusPoint,
      llmBonusReason,
      adhocBonusPoint,
      totalPointsForDay,
    });
  });
}
