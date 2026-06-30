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
import { computeKitBonus, getKitUserId, getKitLog, retroactivelyUpdateKitBonuses } from '../../lib/kitBonus';

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
    const previousMetricValue = membership.currentMetricValue ?? 0;
    const metricMovedFavorably =
      metricValueAfter !== null &&
      typeof membership.targetMetricValue === 'number' &&
      Math.abs(membership.targetMetricValue - metricValueAfter) <
        Math.abs(membership.targetMetricValue - previousMetricValue);

    const [judgeResult, adhocResult, isBackfill] = await Promise.all([
      metricValueAfter === null
        ? judgeGoalContribution({
            workoutDescription: description,
            goalDescription: membership.goalDescription ?? '',
            metricUnit: membership.metricUnit ?? '',
          })
        : Promise.resolve({ contributes: false, reason: '' }),
      matchAdhocChallenge(groupId, date, description),
      hasLaterLog(groupIdUserId, date),
    ]);

    let llmBonusPoint: 0 | 1;
    let llmBonusReason: string;
    if (metricValueAfter !== null) {
      llmBonusPoint = metricMovedFavorably ? 1 : 0;
      llmBonusReason = metricMovedFavorably
        ? `Your ${membership.metricUnit ?? 'metric'} improved from ${previousMetricValue} to ${metricValueAfter}, trending toward your goal.`
        : `Your ${membership.metricUnit ?? 'metric'} did not move toward your goal today (${previousMetricValue} → ${metricValueAfter}).`;
    } else {
      llmBonusPoint = judgeResult.contributes ? 1 : 0;
      llmBonusReason = judgeResult.reason;
    }
    const adhocBonusPoint = adhocResult.matched ? 1 : 0;

    const kitUserId = getKitUserId();
    const isKit = kitUserId !== null && userId === kitUserId;
    let kitBonusPoint: 0 | 1 = 0;
    if (!isKit && kitUserId) {
      const kitLog = await getKitLog(groupId, kitUserId, date);
      const baseScore = durationPoints + llmBonusPoint + adhocBonusPoint;
      kitBonusPoint = computeKitBonus(baseScore, kitLog ? (kitLog.totalPointsForDay as number) : null);
    }

    const totalPointsForDay = calculateTotalPoints(durationPoints, llmBonusPoint, adhocBonusPoint, kitBonusPoint);
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
          llmBonusReason,
          adhocBonusPoint,
          adhocChallengeId: adhocResult.challengeId,
          kitBonusPoint,
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

    if (isKit && kitUserId) {
      await retroactivelyUpdateKitBonuses(groupId, kitUserId, date, totalPointsForDay);
    }

    return json(201, {
      date,
      durationPoints,
      llmBonusPoint,
      llmBonusReason,
      adhocBonusPoint,
      kitBonusPoint,
      totalPointsForDay,
    });
  });
}
