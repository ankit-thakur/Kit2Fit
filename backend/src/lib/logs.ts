import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, Tables } from './dynamo';

export async function hasLaterLog(groupIdUserId: string, date: string): Promise<boolean> {
  const { Items } = await ddb.send(
    new QueryCommand({
      TableName: Tables.dailyLogs,
      KeyConditionExpression: 'groupIdUserId = :groupIdUserId AND #date > :date',
      ExpressionAttributeNames: { '#date': 'date' },
      ExpressionAttributeValues: { ':groupIdUserId': groupIdUserId, ':date': date },
      Limit: 1,
    }),
  );
  return (Items?.length ?? 0) > 0;
}
