import { PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, Tables } from './dynamo';
import { GetCommand } from '@aws-sdk/lib-dynamodb';

export function getKitUserId(): string | null {
  return process.env.KIT_USER_ID || null;
}

export function computeKitBonus(userBaseScore: number, kitTotalPoints: number | null): 0 | 1 {
  return kitTotalPoints !== null && userBaseScore > kitTotalPoints ? 1 : 0;
}

export async function getKitLog(groupId: string, kitUserId: string, date: string) {
  const { Item } = await ddb.send(
    new GetCommand({
      TableName: Tables.dailyLogs,
      Key: { groupIdUserId: `${groupId}#${kitUserId}`, date },
    }),
  );
  return Item ?? null;
}

export async function retroactivelyUpdateKitBonuses(
  groupId: string,
  adminUserId: string,
  date: string,
  kitTotalPoints: number,
): Promise<void> {
  const { Items: groupLogs = [] } = await ddb.send(
    new QueryCommand({
      TableName: Tables.dailyLogs,
      IndexName: 'GSI1-GroupDate',
      KeyConditionExpression: 'groupId = :g AND begins_with(dateUserId, :prefix)',
      ExpressionAttributeValues: { ':g': groupId, ':prefix': `${date}#` },
    }),
  );

  const now = new Date().toISOString();
  await Promise.all(
    groupLogs
      .filter((log) => log.userId !== adminUserId)
      .map(async (log) => {
        const baseScore = (log.totalPointsForDay as number) - ((log.kitBonusPoint as number) ?? 0);
        const newKitBonusPoint: 0 | 1 = computeKitBonus(baseScore, kitTotalPoints);
        const oldKitBonusPoint: 0 | 1 = ((log.kitBonusPoint as number | undefined) ?? 0) as 0 | 1;
        if (newKitBonusPoint === oldKitBonusPoint) return;

        const delta = newKitBonusPoint - oldKitBonusPoint;
        await Promise.all([
          ddb.send(
            new PutCommand({
              TableName: Tables.dailyLogs,
              Item: {
                ...log,
                kitBonusPoint: newKitBonusPoint,
                totalPointsForDay: (log.totalPointsForDay as number) + delta,
                updatedAt: now,
              },
            }),
          ),
          ddb.send(
            new UpdateCommand({
              TableName: Tables.groupMemberships,
              Key: { groupId, userId: log.userId as string },
              UpdateExpression: 'ADD totalPoints :delta',
              ExpressionAttributeValues: { ':delta': delta },
            }),
          ),
        ]);
      }),
  );
}
