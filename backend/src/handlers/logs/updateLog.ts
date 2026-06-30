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
    const date = event.pathParameters?.date;
    if (!groupId || !date) {
      throw new HttpError(400, 'groupId and date are required');
    }

    const membership = await requireMembership(groupId, userId);
    const groupIdUserId = `${groupId}#${userId}`;

    const { Item: existingLog } = await ddb.send(
      new GetCommand({ TableName: Tables.dailyLogs, Key: { groupIdUserId, date } }),
    );
    if (!existingLog) {
      throw new HttpError(404, 'No log exists for this date; create one instead');
    }

    const body = JSON.parse(event.body ?? '{}');
    const minutesWorkedOut = body.minutesWorkedOut ?? existingLog.minutesWorkedOut;
    const description = body.description ?? existingLog.description;
    const metricValueAfter: number | null =
      typeof body.metricValueAfter === 'number'
        ? body.metricValueAfter
        : existingLog.metricValueAfter ?? null;

    const durationPoints = calculateDurationPoints(minutesWorkedOut);
    const previousMetricValue = membership.currentMetricValue ?? 0;
    const metricMovedFavorably =
      metricValueAfter !== null &&
      typeof membership.targetMetricValue === 'number' &&
      Math.abs(membership.targetMetricValue - metricValueAfter) <
        Math.abs(membership.targetMetricValue - previousMetricValue);

    // Only call the LLM when no metric was logged today; when the metric is present it's the hard gate.
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
    const pointsDelta = totalPointsForDay - (existingLog.totalPointsForDay as number);
    const now = new Date().toISOString();

    await ddb.send(
      new PutCommand({
        TableName: Tables.dailyLogs,
        Item: {
          ...existingLog,
          minutesWorkedOut,
          description,
          ...(metricValueAfter !== null ? { metricValueAfter } : { metricValueAfter: undefined }),
          durationPoints,
          llmBonusPoint,
          llmBonusReason,
          adhocBonusPoint,
          adhocChallengeId: adhocResult.challengeId,
          kitBonusPoint,
          totalPointsForDay,
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
            ? 'ADD totalPoints :delta'
            : 'SET currentMetricValue = :metricValueAfter ADD totalPoints :delta',
        ExpressionAttributeValues:
          !isBackfill && metricValueAfter !== null
            ? { ':metricValueAfter': metricValueAfter, ':delta': pointsDelta }
            : { ':delta': pointsDelta },
      }),
    );

    if (isKit && kitUserId) {
      await retroactivelyUpdateKitBonuses(groupId, kitUserId, date, totalPointsForDay);
    }

    return json(200, {
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
