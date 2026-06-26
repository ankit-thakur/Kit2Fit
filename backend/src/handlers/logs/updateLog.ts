import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, Tables } from '../../lib/dynamo';
import { getUserId } from '../../lib/auth';
import { requireMembership } from '../../lib/groups';
import { json, handleErrors, HttpError } from '../../lib/http';
import { calculateDurationPoints, calculateTotalPoints } from '../../lib/points';
import { judgeGoalContribution } from '../../lib/llmJudge';
import { matchAdhocChallenge } from '../../lib/adhocMatch';

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
    const metricValueAfter = body.metricValueAfter ?? existingLog.metricValueAfter;

    const durationPoints = calculateDurationPoints(minutesWorkedOut);

    const [judgeResult, adhocResult] = await Promise.all([
      judgeGoalContribution({
        workoutDescription: description,
        goalDescription: membership.goalDescription ?? '',
        metricUnit: membership.metricUnit ?? '',
        previousMetricValue: membership.currentMetricValue ?? 0,
        newMetricValue: metricValueAfter,
      }),
      matchAdhocChallenge(groupId, date, description),
    ]);

    const llmBonusPoint = judgeResult.contributes ? 1 : 0;
    const adhocBonusPoint = adhocResult.matched ? 1 : 0;
    const totalPointsForDay = calculateTotalPoints(durationPoints, llmBonusPoint, adhocBonusPoint);
    const pointsDelta = totalPointsForDay - existingLog.totalPointsForDay;
    const now = new Date().toISOString();

    await ddb.send(
      new PutCommand({
        TableName: Tables.dailyLogs,
        Item: {
          ...existingLog,
          minutesWorkedOut,
          description,
          metricValueAfter,
          durationPoints,
          llmBonusPoint,
          llmBonusReason: judgeResult.reason,
          adhocBonusPoint,
          adhocChallengeId: adhocResult.challengeId,
          totalPointsForDay,
          updatedAt: now,
        },
      }),
    );

    await ddb.send(
      new UpdateCommand({
        TableName: Tables.groupMemberships,
        Key: { groupId, userId },
        UpdateExpression: 'SET currentMetricValue = :metricValueAfter ADD totalPoints :delta',
        ExpressionAttributeValues: {
          ':metricValueAfter': metricValueAfter,
          ':delta': pointsDelta,
        },
      }),
    );

    return json(200, {
      date,
      durationPoints,
      llmBonusPoint,
      llmBonusReason: judgeResult.reason,
      adhocBonusPoint,
      totalPointsForDay,
    });
  });
}
