import type { PostConfirmationTriggerHandler } from 'aws-lambda';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, Tables } from '../../lib/dynamo';

export const handler: PostConfirmationTriggerHandler = async (event) => {
  if (event.triggerSource !== 'PostConfirmation_ConfirmSignUp') {
    return event;
  }

  const attrs = event.request.userAttributes;

  await ddb.send(
    new PutCommand({
      TableName: Tables.users,
      Item: {
        userId: attrs.sub,
        email: attrs.email,
        phoneNumber: attrs.phone_number ?? '',
        name: attrs['name'] ?? '',
        nickname: attrs['nickname'] ?? '',
        createdAt: new Date().toISOString(),
      },
    }),
  );

  return event;
};
